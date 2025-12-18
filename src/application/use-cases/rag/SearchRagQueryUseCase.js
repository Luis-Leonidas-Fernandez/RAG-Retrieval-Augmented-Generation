import { RagQueryResponse } from "../../dtos/RagQueryResponse.js";
import { estimateTokens, truncateToTokens, truncateMessages, calculateTokenCost } from "../../utils/token-utils.js";
import { normalizeName } from "../../utils/text-utils.js";
import { extractNameEmailPairs, extractNameEmailVehiclePairs } from "../../utils/extract-pairs.js";
import { needsStructuredResponse } from "../../utils/structured-response-detector.js";
import { ExtractStructuredDataUseCase } from "./ExtractStructuredDataUseCase.js";
import { ExportStorageService } from "../../../infrastructure/services/adapters/export-storage.service.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Caso de uso para búsqueda RAG
 * Orquesta la lógica de negocio del proceso de consulta RAG
 */
export class SearchRagQueryUseCase {
  constructor(
    pdfRepository,
    chunkRepository,
    conversationRepository,
    messageRepository,
    vectorRepository,
    embeddingService,
    llmService,
    cacheService,
    conversationSummaryService,
    config = {},
    extractStructuredDataUseCase = null,
    exportStorageService = null
  ) {
    this.pdfRepository = pdfRepository;
    this.chunkRepository = chunkRepository;
    this.conversationRepository = conversationRepository;
    this.messageRepository = messageRepository;
    this.vectorRepository = vectorRepository;
    this.embeddingService = embeddingService;
    this.llmService = llmService;
    this.cacheService = cacheService;
    this.conversationSummaryService = conversationSummaryService;
    
    // Nuevos servicios para datos estructurados
    this.extractStructuredDataUseCase = extractStructuredDataUseCase || new ExtractStructuredDataUseCase(chunkRepository);
    this.exportStorageService = exportStorageService || new ExportStorageService();
    
    // Configuración inyectada (valores por defecto si no se proporciona)
    this.config = {
      minMessagesForHistory: config.minMessagesForHistory || 3,
      recentMessages: config.recentMessages || 3,
      maxTotalTokens: config.maxTotalTokens || 3500,
      documentPriority: config.documentPriority || 0.7,
      conversationSummaryRefreshThreshold: config.conversationSummaryRefreshThreshold || 30,
      searchLimit: config.searchLimit || 20,
      scoreThreshold: config.scoreThreshold || 0.3,
      maxContextLength: config.maxContextLength || 4000,
      fallbackChunksCount: config.fallbackChunksCount || 20,
      tableVisualLimit: parseInt(process.env.RAG_TABLE_VISUAL_LIMIT || "100", 10),
    };
  }

  /**
   * Determina si un documento es tabular (contiene datos estructurados en formato tabla)
   * @param {Object} docMeta - Metadata del documento (originalName, mimetype, documentKind)
   * @returns {boolean} true si es un documento tabular
   */
  isTabularDocument(docMeta) {
    if (!docMeta) return false;

    const originalName = (docMeta.originalName || '').toLowerCase();
    const mimetype = (docMeta.mimetype || '').toLowerCase();
    const documentKind = (docMeta.documentKind || '').toLowerCase();

    // 1) Si viene de XLS/XLSX/CSV → claramente tabular
    const ext = originalName.split('.').pop() || '';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return true;
    if (mimetype.includes('spreadsheet') || mimetype.includes('csv')) return true;

    // 2) Si en ingestión marcaste explícitamente que es un reporte/tablas
    if (['table', 'tabular', 'report', 'clientes', 'registros'].includes(documentKind)) {
      return true;
    }

    // 3) Si en ingestión marcaste 'book', 'libro', 'manual', etc. → NO
    if (['book', 'libro', 'narrative', 'manual'].includes(documentKind)) {
      return false;
    }

    // 4) PDFs genéricos: conservador, false por defecto
    return false;
  }

  /**
   * Ejecuta el caso de uso de búsqueda RAG
   * @param {RagQueryRequest} ragQueryRequest - DTO con tenantId, userId, pdfId, question, etc.
   * @param {Object} options - Opciones adicionales { skipStructuredDetection: boolean }
   * @returns {Promise<RagQueryResponse>} DTO con answer, context, conversationId y tokens
   */
  async execute(ragQueryRequest, options = {}) {
    const { tenantId, userId, pdfId, question, conversationId, tenantSettings } = ragQueryRequest;
    const { skipStructuredDetection = false } = options;

    console.log(`[RAG] Buscando contexto para pregunta: ${question} (tenantId: ${tenantId})`);

    // Usar settings del tenant o defaults
    const maxTokens = tenantSettings?.ragLimits?.maxTokens || this.config.maxTotalTokens;
    const documentPriority = tenantSettings?.ragLimits?.documentPriority || this.config.documentPriority;
    const llmModel = tenantSettings?.llmModel || "gpt-4o-mini";

    let questionVector = null;
    let search = null;
    let chunks = null;
    let contextText = "";
    let usedChunks = [];

    try {
      // 1. Validar que PDF existe y pertenece al tenant
      const pdf = await this.pdfRepository.findById(tenantId, pdfId);
      if (!pdf || pdf.isDeleted) {
        throw new Error("PDF no encontrado o no pertenece al tenant");
      }

      // 🔹 Paso 0: Verificar si el documento es tabular
      const isTabularDoc = this.isTabularDocument(pdf);

      // Si NO es un documento tabular, desactivamos por completo el flujo estructurado
      if (!isTabularDoc || skipStructuredDetection) {
        return await this.executeNormalRagOnly(ragQueryRequest);
      }

      // ======================================================
      // 1.1. DETECTAR Y PROCESAR RESPUESTA ESTRUCTURADA
      // ======================================================
      if (needsStructuredResponse(question)) {
        console.log(`[RAG] Pregunta detectada como requerimiento de respuesta estructurada`);

        // Verificar si el documento es tabular
        const isTabular = this.isTabularDocument(docMeta);
        console.log(`[RAG] isTabularDocument: ${isTabular}`, {
          originalName: docMeta?.originalName,
          mimetype: docMeta?.mimetype,
          documentKind: docMeta?.documentKind
        });

        // 1. Extraer datos estructurados
        const structuredDataFull = await this.extractStructuredDataUseCase.execute(tenantId, pdfId, question);

        // 1.1. Validar datos extraídos
        if (!structuredDataFull || structuredDataFull.length === 0) {
          console.log(`[RAG] No se encontraron datos estructurados, haciendo fallback al flujo RAG normal`);
          // Fallback: Volver al flujo RAG normal (SIN volver a verificar needsStructuredResponse())
          return await this.executeNormalRagOnly(ragQueryRequest);
        }

        console.log(`[RAG] Datos estructurados encontrados: ${structuredDataFull.length} registros`);

        // 2. Calcular resumen en JS
        const totalRows = structuredDataFull.length;
        
        // Contar repeticiones por nombre para el resumen
        const nameCounts = {};
        structuredDataFull.forEach(item => {
          if (item.name) {
            const normalizedName = normalizeName(item.name);
            nameCounts[normalizedName] = (nameCounts[normalizedName] || 0) + 1;
          }
        });

        // Obtener top 10 nombres más repetidos
        const topNames = Object.entries(nameCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }));

        // Seleccionar 5-10 filas de ejemplo
        const exampleRows = structuredDataFull.slice(0, Math.min(10, structuredDataFull.length));

        // Crear resumen para el LLM (formato textual, no estructurado)
        let summaryText = `Encontré ${totalRows} registros en el documento. `;
        if (topNames.length > 0) {
          summaryText += `Los nombres más repetidos son: `;
          summaryText += topNames.slice(0, 3).map(t => `${t.name} (${t.count} veces)`).join(", ");
          if (topNames.length > 3) {
            summaryText += `, y ${topNames.length - 3} más.`;
          }
        }
        if (exampleRows.length > 0) {
          summaryText += ` Algunos ejemplos de registros encontrados incluyen: `;
          const examplesText = exampleRows.slice(0, 3).map(row => {
            const parts = [];
            if (row.name) parts.push(row.name);
            if (row.email) parts.push(`con email ${row.email}`);
            if (row.vehicle) parts.push(`y vehículo ${row.vehicle}`);
            return parts.join(' ');
          }).join('; ');
          summaryText += examplesText;
          if (exampleRows.length > 3) {
            summaryText += `, entre otros.`;
          } else {
            summaryText += `.`;
          }
        }

        // 2.1. Construir candidato de segmento a partir de TODOS los registros tabulares
        let segmentCandidate = null;

        const clientes = structuredDataFull
          .map((item) => ({
            nombre: item.name || "",
            email: item.email || "",
            vehiculo: item.vehicle || "",
            // Si viene desde parser tabular, puede incluir teléfono
            telefono: item.phone || "",
          }))
          // Filtrar filas completamente vacías por seguridad
          .filter(
            (c) => c.nombre || c.email || c.vehiculo || c.telefono
          );

        if (clientes.length > 0) {
          segmentCandidate = {
            tenantId,
            sourceDocId: pdfId,
            descripcionQuery: question,
            canalesOrigen: ["EMAIL"],
            imageUrlPromo: null,
            clientes,
          };
        }

        // 3. Generar respuesta amigable con LLM (usando solo resumen, NO structuredDataFull completo)
        const prompt = `El usuario pregunta: "${question}"
        
${summaryText}

Genera una respuesta amigable y descriptiva basada en estos datos REALES. IMPORTANTE: 
- NO generes tablas en markdown (formato | Columna | ... |)
- NO uses formato de tabla con pipes o guiones
- Solo genera texto descriptivo (párrafos, listas simples si es necesario)
- Describe el resumen, los top valores y la cantidad total
- No inventes datos, solo describe lo que encontré
- Menciona que encontré ${totalRows} registros en total y que abajo el sistema mostrará una tabla con las primeras filas y un botón para descargar el Excel completo.`;

        const completion = await this.llmService.generateCompletion(prompt, llmModel);
        const answer = completion.answer;
        const usage = completion.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        };

        // 4. Preparar datos para respuesta
        const visualLimit = this.config.tableVisualLimit;
        const structuredData = structuredDataFull.slice(0, visualLimit);

        // 5. Generar exportId y guardar datos en Redis
        const exportId = `export-${uuidv4()}`;
        await this.exportStorageService.save(exportId, structuredDataFull, userId, pdfId);

        // Obtener o crear conversación activa
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          let conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
          
          if (!conversation) {
            try {
              conversation = await this.conversationRepository.create(tenantId, {
                userId,
                pdfId,
                title: question.substring(0, 50).trim() || "Nueva conversación",
                isActive: true,
                contextWindowSize: 10,
                messageCount: 0,
              });
            } catch (error) {
              if (error.code === 11000) {
                conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
                if (!conversation) {
                  throw error;
                }
              } else {
                throw error;
              }
            }
          }
          
          if (conversation._id) {
            activeConversationId = typeof conversation._id === 'string' ? conversation._id : conversation._id.toString();
          } else if (conversation.id) {
            activeConversationId = typeof conversation.id === 'string' ? conversation.id : conversation.id.toString();
          }
        }

        // Guardar mensajes en conversación
        if (activeConversationId) {
          const conversation = await this.conversationRepository.findById(tenantId, activeConversationId);
          if (conversation) {
            const updateData = {
              $inc: { messageCount: 1 },
              $set: { lastMessageAt: new Date() },
            };

            if (conversation.messageCount === 0) {
              const title = question.substring(0, 50).trim() || "Nueva conversación";
              updateData.$set.title = title;
            }

            const updatedConv = await this.conversationRepository.update(tenantId, activeConversationId, updateData);
            if (updatedConv) {
              const userIndex = updatedConv.messageCount - 1;

              await this.messageRepository.create(tenantId, activeConversationId, {
                role: "user",
                content: question,
                index: userIndex,
                metadata: {
                  pdfId,
                  tokens: {
                    prompt_tokens: estimateTokens(prompt),
                    completion_tokens: 0,
                    total_tokens: estimateTokens(prompt),
                  },
                },
              });

              await this.conversationRepository.update(tenantId, activeConversationId, {
                $inc: { messageCount: 1 },
                $set: { lastMessageAt: new Date() },
              });

              const assistantIndex = userIndex + 1;
              const cost = calculateTokenCost(
                usage.prompt_tokens,
                usage.completion_tokens,
                llmModel
              );

              await this.messageRepository.create(tenantId, activeConversationId, {
                role: "assistant",
                content: answer,
                index: assistantIndex,
                metadata: {
                  pdfId,
                  tokens: {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens,
                  },
                  llmModel,
                },
              });

              await this.conversationRepository.updateTokenStats(tenantId, activeConversationId, {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                cost,
              });
            }
          }
        }

        // 6. Retornar respuesta con datos estructurados
        return new RagQueryResponse({
          answer,
          context: [],
          conversationId: activeConversationId,
          tokens: usage,
          structuredData,
          structuredDataFull, // Solo uso interno
          totalRows,
          dataType: 'table',
          exportId,
          // Opcional: solo presente cuando hay clientes duplicados
          segmentCandidate,
        });
      }

      // Si la pregunta no requiere lista/tabla → RAG normal
      return await this.executeNormalRagOnly(ragQueryRequest);
    } catch (error) {
      console.error("[RAG] Error:", error);
      throw error;
    } finally {
      // Limpieza de memoria
      questionVector = null;
      search = null;
      chunks = null;
      contextText = null;
      usedChunks = null;
    }
  }

  /**
   * Ejecuta el flujo RAG normal sin detección estructurada
   * @param {RagQueryRequest} ragQueryRequest - DTO con tenantId, userId, pdfId, question, etc.
   * @returns {Promise<RagQueryResponse>} DTO con answer, context, conversationId y tokens
   */
  async executeNormalRagOnly(ragQueryRequest) {
    const { tenantId, userId, pdfId, question, conversationId, tenantSettings } = ragQueryRequest;

    console.log(`[RAG] Ejecutando flujo RAG normal para pregunta: ${question}`);

    // Usar settings del tenant o defaults
    const maxTokens = tenantSettings?.ragLimits?.maxTokens || this.config.maxTotalTokens;
    const documentPriority = tenantSettings?.ragLimits?.documentPriority || this.config.documentPriority;
    const llmModel = tenantSettings?.llmModel || "gpt-4o-mini";

    let questionVector = null;
    let search = null;
    let chunks = null;
    let contextText = "";
    let usedChunks = [];

    try {
      // Validar que PDF existe y pertenece al tenant (si no se validó antes)
      const pdf = await this.pdfRepository.findById(tenantId, pdfId);
      if (!pdf || pdf.isDeleted) {
        throw new Error("PDF no encontrado o no pertenece al tenant");
      }

      // ======================================================
      // 1.5. DETECTAR CONSULTA TIPO "email de X"
      // ======================================================
      const emailQueryRegex = /(email|correo)\s+(de\s+)?(.+)/i;
      const emailMatch = question.match(emailQueryRegex);
      
      if (emailMatch) {
        const rawName = emailMatch[3].trim();
        console.log(`[RAG] → Pregunta detectada como consulta de email: "${rawName}"`);

        // Buscar chunk directo en MongoDB
        const chunk = await this.chunkRepository.findChunkByName(tenantId, pdfId, rawName);
        
        if (chunk) {
          console.log(`[RAG] → Chunk encontrado por búsqueda directa (index: ${chunk.index})`);

          // Extraer tripletes Nombre-Email-Vehículo del chunk encontrado
          const pairs = extractNameEmailVehiclePairs(chunk.content);
          const targetNorm = normalizeName(rawName);

          // Buscar coincidencia en los tripletes extraídos
          for (const p of pairs) {
            if (p.normalized.name.includes(targetNorm) || targetNorm.includes(p.normalized.name)) {
              console.log(`[RAG] → Email encontrado: ${p.email}`);
              if (p.vehicle) {
                console.log(`[RAG] → Vehículo encontrado: ${p.vehicle}`);
              }

              // Obtener o crear conversación activa para la respuesta
              let activeConversationId = conversationId;
              if (!activeConversationId) {
                let conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
                
                if (!conversation) {
                  try {
                    conversation = await this.conversationRepository.create(tenantId, {
                      userId,
                      pdfId,
                      title: "Nueva conversación",
                      isActive: true,
                      contextWindowSize: 10,
                      messageCount: 0,
                    });
                  } catch (error) {
                    if (error.code === 11000) {
                      conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
                      if (!conversation) {
                        throw error;
                      }
                    } else {
                      throw error;
                    }
                  }
                }
                
                if (conversation._id) {
                  activeConversationId = typeof conversation._id === 'string' ? conversation._id : conversation._id.toString();
                } else if (conversation.id) {
                  activeConversationId = typeof conversation.id === 'string' ? conversation.id : conversation.id.toString();
                }
              }

              // Guardar mensajes en conversación
              if (activeConversationId) {
                const conversation = await this.conversationRepository.findById(tenantId, activeConversationId);
                if (conversation) {
                  // Incrementar messageCount y obtener nuevo valor para el mensaje del usuario
                  const updateData = {
                    $inc: { messageCount: 1 },
                    $set: { lastMessageAt: new Date() },
                  };

                  if (conversation.messageCount === 0) {
                    const title = question.substring(0, 50).trim() || "Nueva conversación";
                    updateData.$set.title = title;
                  }

                  const updatedConv = await this.conversationRepository.update(tenantId, activeConversationId, updateData);
                  if (updatedConv) {
                    const userIndex = updatedConv.messageCount - 1;

                    // Guardar mensaje del usuario
                    await this.messageRepository.create(tenantId, activeConversationId, {
                      role: "user",
                      content: question,
                      index: userIndex,
                      metadata: {
                        pdfId,
                        tokens: {
                          prompt_tokens: estimateTokens(question),
                          completion_tokens: 0,
                          total_tokens: estimateTokens(question),
                        },
                      },
                    });

                    // Preparar respuesta (incluir vehículo si está disponible)
                    let answer = `El email de ${rawName} es: ${p.email}`;
                    if (p.vehicle && p.vehicle.trim()) {
                      answer += `. Vehículo: ${p.vehicle}`;
                    }
                    const assistantIndex = userIndex + 1;

                    // Actualizar conversación para el mensaje del assistant
                    await this.conversationRepository.update(tenantId, activeConversationId, {
                      $inc: { messageCount: 1 },
                      $set: { lastMessageAt: new Date() },
                    });

                    // Guardar mensaje del assistant
                    await this.messageRepository.create(tenantId, activeConversationId, {
                      role: "assistant",
                      content: answer,
                      index: assistantIndex,
                      metadata: {
                        pdfId,
                        chunks: [chunk._id ? chunk._id.toString() : chunk.id],
                        tokens: {
                          prompt_tokens: estimateTokens(question),
                          completion_tokens: estimateTokens(answer),
                          total_tokens: estimateTokens(question) + estimateTokens(answer),
                        },
                        llmModel: "direct-mongo",
                      },
                    });

                    // Actualizar estadísticas de tokens
                    await this.conversationRepository.updateTokenStats(tenantId, activeConversationId, {
                      promptTokens: estimateTokens(question),
                      completionTokens: estimateTokens(answer),
                      totalTokens: estimateTokens(question) + estimateTokens(answer),
                      cost: 0, // No hay costo para respuesta directa
                    });
                  }
                }
              }

              // Retornar respuesta inmediata (sin pasar por Qdrant/LLM)
              let answerText = `El email de ${rawName} es: ${p.email}`;
              if (p.vehicle && p.vehicle.trim()) {
                answerText += `. Vehículo: ${p.vehicle}`;
              }
              
              return new RagQueryResponse({
                answer: answerText,
                context: [chunk],
                conversationId: activeConversationId || conversationId,
                tokens: {
                  prompt_tokens: estimateTokens(question),
                  completion_tokens: estimateTokens(answerText),
                  total_tokens: estimateTokens(question) + estimateTokens(answerText),
                },
              });
            }
          }

          console.log(`[RAG] ❌ No se encontró email dentro del chunk aunque el nombre estaba presente`);
        } else {
          console.log(`[RAG] ❌ No se encontró chunk en Mongo por nombre directo`);
        }
      }

      // ======================================================
      // 1.6. DETECTAR CONSULTA TIPO "vehículo de X"
      // ======================================================
      const vehicleQueryRegex = /(vehículo|vehiculo|auto|carro|coche|moto)\s+(de\s+)?(.+)/i;
      const vehicleMatch = question.match(vehicleQueryRegex);
      
      if (vehicleMatch) {
        const rawName = vehicleMatch[3].trim();
        console.log(`[RAG] → Pregunta detectada como consulta de vehículo: "${rawName}"`);

        // Buscar chunk directo en MongoDB por vehículo
        const chunk = await this.chunkRepository.findChunkByVehicle(tenantId, pdfId, rawName);
        
        if (chunk) {
          console.log(`[RAG] → Chunk encontrado por búsqueda directa de vehículo (index: ${chunk.index})`);

          // Extraer tripletes Nombre-Email-Vehículo del chunk encontrado
          const pairs = extractNameEmailVehiclePairs(chunk.content);
          const targetNorm = normalizeName(rawName);

          // Buscar coincidencia en los tripletes extraídos (por vehículo normalizado)
          for (const p of pairs) {
            if (p.normalized.vehicle.includes(targetNorm) || targetNorm.includes(p.normalized.vehicle)) {
              console.log(`[RAG] → Vehículo encontrado: ${p.vehicle}`);
              console.log(`[RAG] → Nombre: ${p.name}, Email: ${p.email}`);

              // Obtener o crear conversación activa para la respuesta
              let activeConversationId = conversationId;
              if (!activeConversationId) {
                let conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
                
                if (!conversation) {
                  try {
                    conversation = await this.conversationRepository.create(tenantId, {
                      userId,
                      pdfId,
                      title: "Nueva conversación",
                      isActive: true,
                      contextWindowSize: 10,
                      messageCount: 0,
                    });
                  } catch (error) {
                    if (error.code === 11000) {
                      conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
                      if (!conversation) {
                        throw error;
                      }
                    } else {
                      throw error;
                    }
                  }
                }
                
                if (conversation._id) {
                  activeConversationId = typeof conversation._id === 'string' ? conversation._id : conversation._id.toString();
                } else if (conversation.id) {
                  activeConversationId = typeof conversation.id === 'string' ? conversation.id : conversation.id.toString();
                }
              }

              // Guardar mensajes en conversación
              if (activeConversationId) {
                const conversation = await this.conversationRepository.findById(tenantId, activeConversationId);
                if (conversation) {
                  // Incrementar messageCount y obtener nuevo valor para el mensaje del usuario
                  const updateData = {
                    $inc: { messageCount: 1 },
                    $set: { lastMessageAt: new Date() },
                  };

                  if (conversation.messageCount === 0) {
                    const title = question.substring(0, 50).trim() || "Nueva conversación";
                    updateData.$set.title = title;
                  }

                  const updatedConv = await this.conversationRepository.update(tenantId, activeConversationId, updateData);
                  if (updatedConv) {
                    const userIndex = updatedConv.messageCount - 1;

                    // Guardar mensaje del usuario
                    await this.messageRepository.create(tenantId, activeConversationId, {
                      role: "user",
                      content: question,
                      index: userIndex,
                      metadata: {
                        pdfId,
                        tokens: {
                          prompt_tokens: estimateTokens(question),
                          completion_tokens: 0,
                          total_tokens: estimateTokens(question),
                        },
                      },
                    });

                    // Preparar respuesta con información completa
                    const answer = `El vehículo ${p.vehicle} pertenece a ${p.name}. Email: ${p.email}`;
                    const assistantIndex = userIndex + 1;

                    // Actualizar conversación para el mensaje del assistant
                    await this.conversationRepository.update(tenantId, activeConversationId, {
                      $inc: { messageCount: 1 },
                      $set: { lastMessageAt: new Date() },
                    });

                    // Guardar mensaje del assistant
                    await this.messageRepository.create(tenantId, activeConversationId, {
                      role: "assistant",
                      content: answer,
                      index: assistantIndex,
                      metadata: {
                        pdfId,
                        chunks: [chunk._id ? chunk._id.toString() : chunk.id],
                        tokens: {
                          prompt_tokens: estimateTokens(question),
                          completion_tokens: estimateTokens(answer),
                          total_tokens: estimateTokens(question) + estimateTokens(answer),
                        },
                        llmModel: "direct-mongo",
                      },
                    });

                    // Actualizar estadísticas de tokens
                    await this.conversationRepository.updateTokenStats(tenantId, activeConversationId, {
                      promptTokens: estimateTokens(question),
                      completionTokens: estimateTokens(answer),
                      totalTokens: estimateTokens(question) + estimateTokens(answer),
                      cost: 0, // No hay costo para respuesta directa
                    });
                  }
                }
              }

              // Retornar respuesta inmediata (sin pasar por Qdrant/LLM)
              const answerText = `El vehículo ${p.vehicle} pertenece a ${p.name}. Email: ${p.email}`;
              
              return new RagQueryResponse({
                answer: answerText,
                context: [chunk],
                conversationId: activeConversationId || conversationId,
                tokens: {
                  prompt_tokens: estimateTokens(question),
                  completion_tokens: estimateTokens(answerText),
                  total_tokens: estimateTokens(question) + estimateTokens(answerText),
                },
              });
            }
          }

          console.log(`[RAG] ❌ No se encontró vehículo dentro del chunk aunque el término estaba presente`);
        } else {
          console.log(`[RAG] ❌ No se encontró chunk en Mongo por vehículo directo`);
        }
      }

      // 2. Detectar si es solicitud de índice ANTES del caché
      const lowerQuestion = question.toLowerCase();
      const isIndexRequest = /índice|indice|tabla de contenidos|temas del libro|temas|capítulos|contenido del libro|temario|table of contents|index|contents|chapters|chapter|topics|summary|outline/i.test(lowerQuestion);

      // 2. Obtener o crear conversación activa
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        let conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
        
        if (!conversation) {
          // Crear nueva conversación
          try {
            conversation = await this.conversationRepository.create(tenantId, {
              userId,
              pdfId,
              title: "Nueva conversación",
              isActive: true,
              contextWindowSize: 10,
              messageCount: 0,
            });
          } catch (error) {
            // Manejar error de índice único (race condition)
            if (error.code === 11000) {
              conversation = await this.conversationRepository.findActive(tenantId, userId, pdfId);
              if (!conversation) {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
        // Convertir ID a string si es necesario
        if (conversation._id) {
          activeConversationId = typeof conversation._id === 'string' ? conversation._id : conversation._id.toString();
        } else if (conversation.id) {
          activeConversationId = typeof conversation.id === 'string' ? conversation.id : conversation.id.toString();
        }
      }

      // 3. Verificar caché de respuesta completa RAG (solo si NO es solicitud de índice)
      // Las solicitudes de índice no se cachean para asegurar búsqueda fresca
      let cachedResponse = null;
      if (!isIndexRequest) {
        cachedResponse = await this.cacheService.getCachedRagResponse(tenantId, pdfId, question);
        if (cachedResponse) {
          console.log(`[RAG] Respuesta obtenida desde caché`);
          // Asegurar que el conversationId sea el activo, no el del caché
          return new RagQueryResponse({
            answer: cachedResponse.answer,
            context: cachedResponse.context,
            conversationId: activeConversationId || cachedResponse.conversationId,
            tokens: cachedResponse.tokens,
          });
        }
      } else {
        console.log(`[RAG] Solicitud de índice detectada, omitiendo caché para búsqueda fresca`);
      }      

      // 4. Generar o recuperar embedding de la pregunta
      questionVector = await this.cacheService.getCachedEmbedding(tenantId, question);

      if (!questionVector) {
        console.log(`[RAG] Generando embedding para pregunta`);
        questionVector = await this.embeddingService.embedText(question);
        await this.cacheService.setCachedEmbedding(tenantId, question, questionVector);
        console.log(`[RAG] Embedding guardado en caché`);
      } else {
        console.log(`[RAG] Embedding obtenido desde caché`);
      }

      // 5. Buscar chunks similares en vector store
      // Para solicitudes de índice, usar threshold más bajo ya que pueden tener formato diferente
      const searchScoreThreshold = isIndexRequest 
        ? 0.3  // Threshold más bajo para índices (pueden tener formato diferente)
        : this.config.scoreThreshold;

      // 🔍 DIAGNÓSTICO: Buscar primero sin threshold para ver todos los resultados
      const searchWithoutThreshold = await this.vectorRepository.search(tenantId, pdfId, questionVector, {
        limit: 50, // Buscar más resultados para diagnóstico
        scoreThreshold: 0, // Sin threshold para ver todos
      });

      console.log(`[RAG] 🔍 Diagnóstico: ${searchWithoutThreshold.length} chunks encontrados sin threshold (limit=50)`);
      
      // Verificar si el chunk 93 está en los resultados
      const chunk93Result = searchWithoutThreshold.find(hit => hit.payload.index === 93);
      if (chunk93Result) {
        console.log(`[RAG] ✅ Chunk 93 encontrado en Qdrant:`);
        console.log(`[RAG]   - Score: ${chunk93Result.score.toFixed(4)}`);
        console.log(`[RAG]   - ChunkId: ${chunk93Result.payload.chunkId}`);
        console.log(`[RAG]   - Index: ${chunk93Result.payload.index}`);
        console.log(`[RAG]   - Content preview: "${(chunk93Result.payload.content || '').substring(0, 200)}${(chunk93Result.payload.content || '').length > 200 ? '...' : ''}"`);
        if (chunk93Result.score < searchScoreThreshold) {
          console.log(`[RAG] ⚠️  Chunk 93 tiene score ${chunk93Result.score.toFixed(4)} que está por debajo del threshold ${searchScoreThreshold}`);
        }
      } else {
        console.log(`[RAG] ❌ Chunk 93 NO encontrado en Qdrant para esta búsqueda`);
        // Verificar si el chunk 93 existe en MongoDB
        const chunk93InMongo = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
          filters: { index: 93 },
          limit: 1,
        });
        if (chunk93InMongo.length > 0) {
          console.log(`[RAG] ⚠️  Chunk 93 existe en MongoDB pero NO está en Qdrant:`);
          console.log(`[RAG]   - ChunkId: ${chunk93InMongo[0]._id}`);
          console.log(`[RAG]   - Status: ${chunk93InMongo[0].status}`);
          console.log(`[RAG]   - Content preview: "${(chunk93InMongo[0].content || '').substring(0, 200)}${(chunk93InMongo[0].content || '').length > 200 ? '...' : ''}"`);
        } else {
          console.log(`[RAG] ⚠️  Chunk 93 NO existe en MongoDB`);
        }
      }

      // Mostrar los top 10 chunks sin threshold para diagnóstico
      console.log(`[RAG] 🔍 Top 10 chunks encontrados (sin threshold):`);
      searchWithoutThreshold.slice(0, 10).forEach((hit, idx) => {
        console.log(`[RAG]   ${idx + 1}. Index: ${hit.payload.index}, Score: ${hit.score.toFixed(4)}, ChunkId: ${hit.payload.chunkId}`);
      });

      // Buscar específicamente el chunk 93 para ver su score (búsqueda ampliada)
      console.log(`[RAG] 🔍 Buscando específicamente el chunk 93 para ver su score (búsqueda ampliada a 200 resultados)...`);
      const searchChunk93 = await this.vectorRepository.search(tenantId, pdfId, questionVector, {
        limit: 200, // Buscar más resultados para encontrar el chunk 93
        scoreThreshold: 0, // Sin threshold
      });

      const chunk93InSearch = searchChunk93.find(hit => hit.payload.index === 93);
      if (chunk93InSearch) {
        const chunk93Position = searchChunk93.findIndex(h => h.payload.index === 93) + 1;
        console.log(`[RAG] ✅ Chunk 93 encontrado en búsqueda ampliada:`);
        console.log(`[RAG]   - Score: ${chunk93InSearch.score.toFixed(4)}`);
        console.log(`[RAG]   - Posición en ranking: ${chunk93Position} de ${searchChunk93.length}`);
        console.log(`[RAG]   - ChunkId: ${chunk93InSearch.payload.chunkId}`);
        console.log(`[RAG]   - Comparación con top 3:`);
        searchChunk93.slice(0, 3).forEach((hit, idx) => {
          const scoreDiff = hit.score - chunk93InSearch.score;
          console.log(`[RAG]     ${idx + 1}. Index ${hit.payload.index}: score ${hit.score.toFixed(4)} (diferencia: ${scoreDiff > 0 ? '+' : ''}${scoreDiff.toFixed(4)})`);
        });
        if (chunk93InSearch.score < searchScoreThreshold) {
          console.log(`[RAG] ⚠️  Chunk 93 tiene score ${chunk93InSearch.score.toFixed(4)} que está por debajo del threshold ${searchScoreThreshold}`);
          console.log(`[RAG]   - Por eso no aparece en los resultados finales`);
        }
      } else {
        console.log(`[RAG] ⚠️  Chunk 93 NO encontrado ni siquiera en los primeros 200 resultados`);
        console.log(`[RAG]   - Esto indica que el embedding del chunk 93 no es similar al de la pregunta`);
        console.log(`[RAG]   - El chunk 93 está en Qdrant pero su similitud semántica con la pregunta es muy baja`);
      }

      // Ahora hacer la búsqueda real con threshold
      search = await this.vectorRepository.search(tenantId, pdfId, questionVector, {
        limit: this.config.searchLimit,
        scoreThreshold: searchScoreThreshold,
      });

      console.log(`[RAG] Encontrados ${search.length} chunks similares con score >= ${searchScoreThreshold}`);

      // 6. Si es solicitud de índice, buscar también en los primeros chunks del documento
      if (isIndexRequest) {
        console.log(`[RAG] Solicitud de índice detectada, buscando en primeros chunks del documento`);
        
        // Buscar chunks del inicio del documento (índices suelen estar al principio)
        const earlyChunks = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
          limit: 50, // Primeros 50 chunks (ajustar según necesidad)
          sort: { index: 1 },
          select: "content index page",
        });
        
        // Filtrar chunks que contengan palabras clave relacionadas con índice
        const indexKeywords = ['índice', 'indice', 'contenido', 'capítulo', 'capitulo', 'tema', 'página', 'pagina', 'tabla', 'temario', 'index', 'contents', 'table of contents', 'chapters', 'chapter', 'topics', 'summary', 'outline'];
        const relevantEarlyChunks = earlyChunks.filter(chunk => {
          const content = (chunk.content || '').toLowerCase();
          return indexKeywords.some(keyword => content.includes(keyword));
        });
        
        // Combinar con resultados de búsqueda vectorial
        const earlyChunkIds = relevantEarlyChunks.map(c => c._id.toString());
        const vectorChunkIds = search.map(hit => hit.payload.chunkId);
        const combinedIds = [...new Set([...vectorChunkIds, ...earlyChunkIds])];
        
        // Obtener todos los chunks combinados
        chunks = await this.chunkRepository.findByIds(tenantId, combinedIds, pdfId);
        
        // Ordenar por índice para mantener orden del documento
        chunks.sort((a, b) => (a.index || 0) - (b.index || 0));
        
        console.log(`[RAG] Total de chunks encontrados (vectorial + primeros): ${chunks.length}`);
      } else {
        // 6. Obtener chunkIds y buscar textos en MongoDB (código original)
        const ids = search.map((hit) => hit.payload.chunkId);
        chunks = await this.chunkRepository.findByIds(tenantId, ids, pdfId);
        
        // 🔍 DIAGNÓSTICO: Logs detallados de chunks encontrados
        console.log(`[RAG] 🔍 Diagnóstico: ${chunks.length} chunks obtenidos de MongoDB`);
        console.log(`[RAG] 🔍 Scores de los chunks encontrados:`);
        search.forEach((hit, idx) => {
          const chunk = chunks.find(c => c._id.toString() === hit.payload.chunkId);
          if (chunk) {
            console.log(`[RAG]   Chunk ${idx + 1}:`);
            console.log(`[RAG]     - Score: ${hit.score.toFixed(4)}`);
            console.log(`[RAG]     - Index: ${chunk.index}`);
            console.log(`[RAG]     - Page: ${chunk.page}`);
            console.log(`[RAG]     - Content length: ${(chunk.content || '').length} caracteres`);
            console.log(`[RAG]     - Content preview: "${(chunk.content || '').substring(0, 200)}${(chunk.content || '').length > 200 ? '...' : ''}"`);
          }
        });
      }

      // 7. Construir contexto del documento
      if (isIndexRequest) {
        // Lógica actual para índices (mantener sin cambios)
        console.log(`[RAG] 🔍 Construyendo contexto con ${chunks.length} chunks disponibles`);
        contextText = "";
        usedChunks = [];
        
        for (const chunk of chunks) {
          const chunkText = chunk.content || "";
          const separatorLength = contextText ? 2 : 0;
          const totalLength = contextText.length + separatorLength + chunkText.length;

          if (totalLength > this.config.maxContextLength) {
            break;
          }
          
          // Incluir metadatos para índice
          let chunkWithMetadata = chunkText;
          if (chunk.page || chunk.index !== undefined) {
            chunkWithMetadata = `[Página ${chunk.page || 'N/A'}, Chunk ${chunk.index || 'N/A'}]\n${chunkText}`;
          }
          
          contextText += (contextText ? "\n\n" : "") + chunkWithMetadata;
          usedChunks.push(chunk);
        }
        
        console.log(`[RAG] 🔍 Contexto construido:`);
        console.log(`[RAG]   - Chunks usados: ${usedChunks.length}`);
        console.log(`[RAG]   - Contexto length: ${contextText.length} caracteres`);
        
      } else {
        // -----------------------------------------------------------------------
        // 🔍 Construcción optimizada del contexto (máximo 3 chunks)
        // -----------------------------------------------------------------------

        // Mapear scores de Qdrant a chunks de MongoDB usando chunkId
        const scoredChunks = chunks
          .map((chunk) => {
            const match = search.find(
              (hit) => hit.payload.chunkId === chunk._id.toString()
            );

            if (!match) {
              console.warn(`[RAG] No se encontró score para chunk ${chunk._id}`);
              return null;
            }

            return {
              chunk,
              score: match.score,
            };
          })
          .filter((item) => item !== null);

        // Si no hay chunks con score → dejar vacío para que el fallback se active
        if (scoredChunks.length === 0) {
          console.log("[RAG] scoredChunks vacío → usando fallback.");
          contextText = "";
          usedChunks = [];
        } else {
          // 1️⃣ Ordenar chunks por score DESC (Qdrant ya los manda ordenados,
          //    pero esto garantiza consistencia después del mapeo)
          scoredChunks.sort((a, b) => b.score - a.score);

          // 2️⃣ Seleccionar mejor chunk
          const best = scoredChunks[0];
          const bestChunk = best.chunk;

          console.log(
            `[RAG] Mejor chunk → index=${bestChunk.index}, page=${bestChunk.page}, score=${best.score.toFixed(4)}`
          );

          // 3️⃣ Buscar vecinos: mismo PDF, index ±1
          const neighbors = scoredChunks
            .filter((c) => {
              if (!c || !c.chunk) return false;
              if (!c.chunk._id || !bestChunk._id) return false;
              if (c.chunk._id.toString() === bestChunk._id.toString()) return false;
              
              // Validar que pdfId existe antes de comparar
              if (!bestChunk.pdfId || !c.chunk.pdfId) return false;
              if (c.chunk.pdfId.toString() !== bestChunk.pdfId.toString()) return false;
              
              // Validar que index existe antes de comparar
              if (typeof bestChunk.index !== 'number' || typeof c.chunk.index !== 'number') {
                return false;
              }
              
              return Math.abs(c.chunk.index - bestChunk.index) <= 1;
            })
            .slice(0, 2); // máximo 2 vecinos

          // 4️⃣ Construir selección inicial
          let selected = [best, ...neighbors];

          // 5️⃣ Si faltan chunks, rellenar con mejores scores restantes
          if (selected.length < 3) {
            for (const item of scoredChunks.slice(1)) {
              if (
                selected.some(
                  (s) => s.chunk._id.toString() === item.chunk._id.toString()
                )
              ) {
                continue;
              }
              selected.push(item);
              if (selected.length === 3) break;
            }
          }

          // 6️⃣ Ordenar para flujo de lectura natural (por página y luego index)
          selected = selected.sort((a, b) => {
            if (a.chunk.page !== b.chunk.page) {
              return a.chunk.page - b.chunk.page;
            }
            return a.chunk.index - b.chunk.index;
          });

          // 7️⃣ Construir contexto final
          const contextParts = selected.map((c) => c.chunk.content);
          contextText = contextParts.join("\n\n");

          // 8️⃣ Guardar usedChunks para el response final
          usedChunks = selected.map((s) => s.chunk);

          console.log(`[RAG] Contexto construido con ${selected.length} chunks.`);
        }
      }

      // 8. Fallback si no hay chunks
      if (usedChunks.length === 0 || contextText.trim().length === 0) {
        console.log(`[RAG] No se encontraron chunks similares, usando fallback`);

        const fallbackChunks = await this.chunkRepository.findByPdfId(tenantId, pdfId, {
          limit: this.config.fallbackChunksCount,
          sort: { index: 1 },
          select: "content index page",
        });

        contextText = "";
        usedChunks = [];

        for (const chunk of fallbackChunks) {
          const chunkText = chunk.content || "";
          const separatorLength = contextText ? 2 : 0;
          const totalLength = contextText.length + separatorLength + chunkText.length;

          if (totalLength > this.config.maxContextLength) {
            break;
          }
          contextText += (contextText ? "\n\n" : "") + chunkText;
          usedChunks.push(chunk);
        }
      }

      // 9. Construir contexto optimizado (con historial si aplica)
      let optimizedContext = {
        documentContext: contextText,
        historyContext: null,
        totalTokens: estimateTokens(contextText),
      };

      if (activeConversationId && (await this.requiresHistory(tenantId, question, activeConversationId))) {
        optimizedContext = await this.buildOptimizedContext(
          tenantId,
          activeConversationId,
          question,
          contextText,
          maxTokens,
          documentPriority
        );
      }

      // 10. Construir prompt optimizado
      const prompt = this.buildOptimizedPrompt(
        optimizedContext.documentContext,
        optimizedContext.historyContext,
        question,
        optimizedContext.totalTokens
      );

      // 11. Llamar al LLM
      const completion = await this.llmService.generateCompletion(prompt, llmModel);
      const answer = completion.answer;
      const usage = completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      // 12. Guardar mensajes en conversación si existe
      if (activeConversationId) {
        // Obtener conversación para validar y obtener messageCount
        const conversation = await this.conversationRepository.findById(tenantId, activeConversationId);
        if (!conversation) {
          throw new Error("Conversación no encontrada");
        }

        // Actualización atómica: incrementar messageCount y obtener nuevo valor para el mensaje del usuario
        const updateData = {
          $inc: { messageCount: 1 },
          $set: { lastMessageAt: new Date() },
        };

        // Si es el primer mensaje (messageCount será 1 después del incremento), generar título
        if (conversation.messageCount === 0) {
          const title = question.substring(0, 50).trim() || "Nueva conversación";
          updateData.$set.title = title;
        }

        const updatedConv = await this.conversationRepository.update(tenantId, activeConversationId, updateData);
        if (!updatedConv) {
          throw new Error("Error al actualizar conversación");
        }

        // Calcular index desde messageCount (empieza en 0)
        const userIndex = updatedConv.messageCount - 1;

        // Guardar mensaje del usuario
        await this.messageRepository.create(tenantId, activeConversationId, {
          role: "user",
          content: question,
          index: userIndex,
          metadata: {
            pdfId,
            tokens: {
              prompt_tokens: estimateTokens(prompt),
              completion_tokens: 0,
              total_tokens: estimateTokens(prompt),
            },
          },
        });

        // Actualizar conversación para el mensaje del assistant
        const assistantUpdateData = {
          $inc: { messageCount: 1 },
          $set: { lastMessageAt: new Date() },
        };

        const updatedConvForAssistant = await this.conversationRepository.update(
          tenantId,
          activeConversationId,
          assistantUpdateData
        );
        if (!updatedConvForAssistant) {
          throw new Error("Error al actualizar conversación para assistant");
        }

        // Calcular index para el mensaje del assistant
        const assistantIndex = updatedConvForAssistant.messageCount - 1;

        // Calcular costo de tokens
        const cost = calculateTokenCost(
          usage.prompt_tokens,
          usage.completion_tokens,
          llmModel
        );

        // Guardar mensaje del assistant con actualización de tokens
        await this.messageRepository.create(tenantId, activeConversationId, {
          role: "assistant",
          content: answer,
          index: assistantIndex,
          metadata: {
            pdfId,
            chunks: usedChunks.map((c) => (c._id ? c._id.toString() : c.id)),
            tokens: {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              total_tokens: usage.total_tokens,
            },
            llmModel,
          },
        });

        // 13. Actualizar estadísticas de tokens en la conversación
        await this.conversationRepository.updateTokenStats(tenantId, activeConversationId, {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost,
        });

        // 14. Invalidar resumen si hay muchos mensajes nuevos
        const finalConversation = await this.conversationRepository.findById(tenantId, activeConversationId);
        if (finalConversation && finalConversation.messageCount % this.config.conversationSummaryRefreshThreshold === 0) {
          await this.conversationSummaryService.invalidateConversationSummary(
            tenantId,
            activeConversationId,
            "threshold_reached"
          );
        }
      }

      // 15. Preparar respuesta
      const response = new RagQueryResponse({
        answer,
        context: usedChunks,
        conversationId: activeConversationId,
        tokens: usage,
      });

      // 16. Guardar respuesta completa en caché (solo si NO es solicitud de índice)
      // Las solicitudes de índice no se cachean para asegurar búsqueda fresca siempre
      if (!isIndexRequest) {
        await this.cacheService.setCachedRagResponse(tenantId, pdfId, question, {
          answer,
          context: usedChunks,
          tokens: usage,
          conversationId: activeConversationId,
        });
        console.log(`[RAG] Respuesta guardada en caché`);
      } else {
        console.log(`[RAG] Respuesta de índice no cacheada (siempre se busca fresca)`);
      }

      return response;
    } catch (error) {
      console.error("[RAG] Error:", error);
      throw error;
    } finally {
      // Limpieza de memoria
      questionVector = null;
      search = null;
      chunks = null;
      contextText = null;
      usedChunks = null;
    }
  }

  /**
   * Verificar si se necesita historial basado en messageCount y palabras clave
   */
  async requiresHistory(tenantId, question, conversationId) {
    if (!conversationId) return false;

    const conversation = await this.conversationRepository.findById(tenantId, conversationId, {
      select: "messageCount",
    });

    if (!conversation) return false;

    // Si hay pocos mensajes, no usar historial
    if (conversation.messageCount < this.config.minMessagesForHistory) {
      return false;
    }

    // Palabras clave que indican referencia al historial
    const historyKeywords = ["antes", "mencionaste", "dijiste", "anteriormente", "previamente", "ya hablamos"];
    const hasHistoryKeyword = historyKeywords.some((keyword) =>
      question.toLowerCase().includes(keyword)
    );

    // Si hay muchos mensajes O hay palabra clave, usar historial
    return conversation.messageCount >= this.config.minMessagesForHistory || hasHistoryKeyword;
  }

  /**
   * Construir contexto optimizado con historial y documento
   */
  async buildOptimizedContext(tenantId, conversationId, question, documentContext, maxTokens, documentPriority) {
    // Obtener mensajes recientes
    const recentMessages = await this.messageRepository.findRecent(tenantId, conversationId, this.config.recentMessages);

    // Obtener o generar resumen de mensajes antiguos
    const summary = await this.conversationSummaryService.getOrGenerateSummary(tenantId, conversationId);

    // Calcular tokens disponibles
    const documentTokens = estimateTokens(documentContext);
    const documentBudget = Math.floor(maxTokens * documentPriority);
    const historyBudget = maxTokens - documentBudget;

    // Truncar contexto del documento si es necesario
    let optimizedDocumentContext = documentContext;
    if (documentTokens > documentBudget) {
      optimizedDocumentContext = truncateToTokens(documentContext, documentBudget);
    }

    // Construir contexto histórico
    let historyContext = null;
    let totalTokens = estimateTokens(optimizedDocumentContext);

    if (recentMessages.length > 0 || summary) {
      const historyMessages = [];

      // Agregar resumen si existe
      if (summary && summary.summary) {
        historyMessages.push({
          role: "system",
          content: `Resumen de conversación anterior: ${summary.summary}`,
        });
      }

      // Agregar mensajes recientes (truncados)
      const truncatedRecent = truncateMessages(recentMessages, historyBudget);
      historyMessages.push(...truncatedRecent.map((msg) => ({
        role: msg.role,
        content: truncateToTokens(msg.content, Math.floor(historyBudget / truncatedRecent.length)),
      })));

      const historyText = historyMessages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n\n");

      totalTokens += estimateTokens(historyText);

      // Si excede el presupuesto, truncar más
      if (totalTokens > maxTokens) {
        const excess = totalTokens - maxTokens;
        const reductionFactor = (maxTokens - documentTokens) / (totalTokens - documentTokens);
        historyContext = truncateToTokens(historyText, Math.floor(estimateTokens(historyText) * reductionFactor));
      } else {
        historyContext = historyText;
      }
    }

    return {
      documentContext: optimizedDocumentContext,
      historyContext,
      totalTokens: estimateTokens(optimizedDocumentContext) + (historyContext ? estimateTokens(historyContext) : 0),
    };
  }

  /**
   * Construir prompt optimizado
   */
  buildOptimizedPrompt(documentContext, historyContext, question, totalTokens) {
    let prompt = `
Responde únicamente usando el contenido del documento que aparece en el contexto a continuación.

- Puedes resumir y parafrasear, pero no inventes datos.

- No uses conocimiento externo.

- Puedes inferir conceptos siempre que la evidencia esté implícita en los fragmentos.

- Si el documento muestra ejemplos, código, uso práctico o descripciones que permiten deducir un concepto, puedes explicarlo con tus propias palabras.

- NO inventes datos nuevos que no se puedan derivar del contenido.

- Las inferencias deben basarse únicamente en el material presente en los fragmentos.

- Si la información esencial para responder NO está en el contexto,
  responde ÚNICAMENTE con:
  "He realizado una búsqueda pero lamentablemente no hay información suficiente para una respuesta adecuada."

CONTEXTO DEL DOCUMENTO:

`;

    if (historyContext) {
      prompt += `Historial de conversación:\n${historyContext}\n\n`;
    }

    prompt += `${documentContext}\n\n`;
    prompt += `Pregunta: ${question}\n\n`;
    
    // Detectar si se pide índice, tabla de contenidos, temas, etc.
    // Nota: Esta detección también se hace en execute() para lógica de búsqueda
    const lowerQuestion = question.toLowerCase();
    const isIndexRequest = /índice|indice|tabla de contenidos|temas del libro|temas|capítulos|contenido del libro|temario|table of contents|index|contents|chapters|chapter|topics|summary|outline/i.test(lowerQuestion);
    
    prompt += `Instrucciones:\n`;
    
    if (isIndexRequest) {
      // Instrucciones específicas para solicitudes de índice
      prompt += `- El usuario está pidiendo el ÍNDICE, TABLA DE CONTENIDOS o TEMAS del documento.\n`;
      prompt += `- Si encuentras el índice en el contexto, devuélvelo COMPLETO y EXACTO, sin resumir ni omitir temas.\n`;
      prompt += `- Mantén el formato original (números de página, jerarquía, etc.).\n`;
      prompt += `- NO resumas ni parafrasees el índice.\n`;
      prompt += `- Si el índice está incompleto en el contexto, indica qué parte falta.\n`;
    } else {
      // Instrucciones generales más flexibles
      prompt += `- Si la respuesta está en el contexto, responde de forma clara y concisa.\n`;
      prompt += `- Puedes resumir o parafrasear el contenido, pero sin agregar información que no esté presente.\n`;
      prompt += `- Puedes hacer inferencias y explicar conceptos deducidos de los ejemplos, código o descripciones del documento.\n`;
      prompt += `- Si hay información parcial pero relacionada, responde de forma breve indicando que está basada solo en el documento.\n`;
      prompt += `- Cita fragmentos específicos cuando sea relevante.\n`;
    }
    
    // Instrucción adicional para información estructurada
    prompt += `- Si la pregunta solicita información estructurada (listas, tablas, índices), devuélvela en su formato original cuando sea posible.\n`;

    prompt += `

REGLAS FINALES:
- Usa solo información presente en el contexto o que puedas inferir de manera justificada a partir de él.
- Puedes hacer inferencias cuando la evidencia esté implícita en los fragmentos.
- No inventes información que no se pueda derivar del contenido.
- No uses conocimiento externo.
- Si no hay suficiente contexto:
  responde ÚNICAMENTE con la siguiente frase (sin añadir nada más, antes ni después):
  "He realizado una búsqueda pero lamentablemente no hay información suficiente para una respuesta adecuada."

`;

    return prompt;
  }
}

