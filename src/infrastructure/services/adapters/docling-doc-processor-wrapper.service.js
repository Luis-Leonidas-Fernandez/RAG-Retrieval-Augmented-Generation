import { IDocProcessor } from "../../../domain/services/IDocProcessor.js";
import path from "path";
import { Agent } from "undici";


// 👇 Agent dedicado solo para Docling
const doclingAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  keepAliveTimeout: 30_000,      // ✔ permitido
  keepAliveMaxTimeout: 30_000,   // ✔ permitido
});


/**
 * Adaptador HTTP que implementa IDocProcessor
 * Hace llamadas al microservicio Python de Docling
 */
export class DoclingDocProcessorWrapper extends IDocProcessor {
  constructor() {
    super();
    this.serviceUrl = process.env.DOCLING_SERVICE_URL || "http://localhost:8000";
    this.timeout = parseInt(process.env.DOCLING_SERVICE_TIMEOUT || "600000", 10); // 10 minutos por defecto
    // Calcular minutos una sola vez
    this.timeoutMinutes = Math.round(this.timeout / 1000 / 60);
    // Ruta base dentro del contenedor Docker donde se monta el directorio uploads
    this.containerUploadsPath = process.env.DOCLING_CONTAINER_UPLOADS_PATH || "/app/uploads";
    
    console.log(">> DOC_TIMEOUT =", process.env.DOCLING_SERVICE_TIMEOUT);
    console.log(">> TIMEOUT FINAL =", this.timeout);
    console.log(`[DoclingDocProcessorWrapper] Inicializado - URL: ${this.serviceUrl}, Timeout: ${this.timeout}ms (${this.timeoutMinutes}min), ContainerPath: ${this.containerUploadsPath}`);
  }

  /**
   * Convierte una ruta absoluta del host a la ruta del contenedor Docker
   * @param {string} hostPath - Ruta absoluta en el host (ej: /Users/.../uploads/file.pdf)
   * @returns {string} Ruta en el contenedor (ej: /app/uploads/file.pdf)
   */
  convertToContainerPath(hostPath) {
    // Extraer el nombre del archivo de la ruta
    const filename = path.basename(hostPath);
    // Construir la ruta en el contenedor
    const containerPath = path.join(this.containerUploadsPath, filename);
    console.log(`[DoclingDocProcessorWrapper] Convirtiendo ruta - Host: ${hostPath} → Container: ${containerPath}`);
    return containerPath;
  }

  /**
   * Procesa un documento usando el microservicio Docling
   * @param {string} pdfPath - Ruta absoluta al archivo documento
   * @returns {Promise<{
   *   cleaned_text: string,
   *   markdown: string | null,
   *   toc: string | null,
   *   metadata: {
   *     total_pages: number,
   *     title: string | null,
   *     author: string | null
   *   }
   * }>}
   */
  async processPdf(pdfPath) {
    const startTime = Date.now();
    console.log(`[DoclingDocProcessorWrapper] ⚡ Iniciando procesamiento de documento - path: ${pdfPath}`);
    
    try {
      // Convertir la ruta del host a la ruta del contenedor Docker
      const containerPath = this.convertToContainerPath(pdfPath);
      
      console.log(`[DoclingDocProcessorWrapper] 📤 Enviando petición POST a ${this.serviceUrl}/process`);
      console.log(`[DoclingDocProcessorWrapper] ⏱️ Timeout configurado: ${this.timeout}ms (${this.timeoutMinutes} minutos)`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`[DoclingDocProcessorWrapper] ❌ TIMEOUT alcanzado después de ${elapsed}ms (${elapsed/1000/60} minutos)`);
        console.error(`[DoclingDocProcessorWrapper] El servicio Docling no respondió a tiempo`);
        controller.abort();
      }, this.timeout);

      const fetchStartTime = Date.now();
      console.log(`[DoclingDocProcessorWrapper] 🌐 Fetch iniciado a las ${new Date().toISOString()}`);
      
      const response = await fetch(`${this.serviceUrl}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doc_path: containerPath,
          file_type: null,  // Se detecta automáticamente en el servicio
        }),
        signal: controller.signal,
        dispatcher: doclingAgent,
      });

      const fetchTime = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);
      console.log(`[DoclingDocProcessorWrapper] ✅ Respuesta recibida en ${fetchTime}ms (${fetchTime/1000} segundos) - Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DoclingDocProcessorWrapper] ❌ Error HTTP ${response.status}: ${errorText}`);
        throw new Error(
          `Error del microservicio Docling (${response.status}): ${errorText}`
        );
      }

      const parseStartTime = Date.now();
      const data = await response.json();
      const parseTime = Date.now() - parseStartTime;
      
      const totalTime = Date.now() - startTime;
      console.log(`[DoclingDocProcessorWrapper] 📄 JSON parseado en ${parseTime}ms`);
      console.log(`[DoclingDocProcessorWrapper] ✅ Documento procesado exitosamente - Tiempo total: ${totalTime}ms (${totalTime/1000} segundos)`);
      console.log(`[DoclingDocProcessorWrapper] 📊 Metadata - Páginas: ${data.metadata?.total_pages || 'N/A'}, Título: ${data.metadata?.title || 'N/A'}`);

      return {
        cleaned_text: data.cleaned_text || "",
        markdown: data.markdown || null,
        toc: data.toc || null,
        metadata: {
          total_pages: data.metadata?.total_pages || 1,
          title: data.metadata?.title || null,
          author: data.metadata?.author || null,
          file_type: data.metadata?.file_type || null,
        },
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[DoclingDocProcessorWrapper] ❌ Error después de ${totalTime}ms (${totalTime/1000} segundos)`);
      console.error(`[DoclingDocProcessorWrapper] Tipo de error: ${error.name || 'Unknown'}`);
      console.error(`[DoclingDocProcessorWrapper] Mensaje: ${error.message}`);
      
      // Capturar más detalles del error "fetch failed"
      if (error.cause) {
        console.error(`[DoclingDocProcessorWrapper] Causa del error:`, error.cause);
        console.error(`[DoclingDocProcessorWrapper] Tipo de causa: ${error.cause?.constructor?.name || 'Unknown'}`);
        if (error.cause?.code) {
          console.error(`[DoclingDocProcessorWrapper] Código de error: ${error.cause.code}`);
        }
        if (error.cause?.errno) {
          console.error(`[DoclingDocProcessorWrapper] Errno: ${error.cause.errno}`);
        }
        if (error.cause?.syscall) {
          console.error(`[DoclingDocProcessorWrapper] Syscall: ${error.cause.syscall}`);
        }
        // 🔍 NUEVO: Información detallada del socket cuando está disponible
        if (error.cause?.socket) {
          const socket = error.cause.socket;
          console.error(`[DoclingDocProcessorWrapper] 📊 Estadísticas del socket:`);
          console.error(`[DoclingDocProcessorWrapper]   - Bytes escritos (request enviada): ${socket.bytesWritten || 0} bytes`);
          console.error(`[DoclingDocProcessorWrapper]   - Bytes leídos (respuesta recibida): ${socket.bytesRead || 0} bytes`);
          console.error(`[DoclingDocProcessorWrapper]   - Dirección local: ${socket.localAddress || 'N/A'}:${socket.localPort || 'N/A'}`);
          console.error(`[DoclingDocProcessorWrapper]   - Dirección remota: ${socket.remoteAddress || 'N/A'}:${socket.remotePort || 'N/A'}`);
          console.error(`[DoclingDocProcessorWrapper]   - Familia: ${socket.remoteFamily || 'N/A'}`);
          console.error(`[DoclingDocProcessorWrapper]   - Timeout configurado: ${socket.timeout || 'N/A'}ms`);
        }
      }
      
      if (error.name === "AbortError") {
        console.error(`[DoclingDocProcessorWrapper] ⏱️ TIMEOUT - El servicio no respondió en ${this.timeout}ms (${this.timeoutMinutes} minutos)`);
        console.error(`[DoclingDocProcessorWrapper] 💡 NOTA: El procesamiento de documentos grandes puede tardar 8+ minutos según los logs del servicio`);
        console.error(`[DoclingDocProcessorWrapper] AbortError detectado → probablemente timeout`);
        throw new Error(
          `Timeout al procesar documento: el servicio no respondió en ${this.timeout}ms (${this.timeoutMinutes} minutos). ` +
          `Para documentos grandes, el procesamiento puede tardar 8+ minutos. Considera aumentar DOCLING_SERVICE_TIMEOUT.`
        );
      }
      
      // 🔍 MEJORADO: Detección mejorada de errores de conexión y socket
      const isConnectionError = 
        error.message.includes("ECONNREFUSED") || 
        error.message.includes("fetch failed") ||
        error.cause?.code === "ECONNREFUSED" ||
        error.cause?.code === "ETIMEDOUT" ||
        error.cause?.code === "ECONNRESET" ||
        error.cause?.code === "UND_ERR_SOCKET"; // 🔍 NUEVO: Manejar UND_ERR_SOCKET específicamente
      
      if (isConnectionError) {
        const socket = error.cause?.socket;
        const bytesRead = socket?.bytesRead || 0;
        const bytesWritten = socket?.bytesWritten || 0;
        
        // Determinar el tipo de error más específico basado en el contexto
        let errorType = "desconocido";
        let suggestion = "";
        let diagnosticInfo = "";
        
        if (error.cause?.code === "UND_ERR_SOCKET") {
          if (bytesRead > 100000) {
            // Se recibió una cantidad significativa de datos (>100KB) antes de que se cerrara
            errorType = "socket cerrado durante el procesamiento (servicio crasheó)";
            suggestion = `El servicio Docling empezó a procesar el documento (recibió ${(bytesRead / 1024).toFixed(2)} KB) pero cerró la conexión abruptamente. Esto indica que el servicio crasheó durante el procesamiento.`;
            diagnosticInfo = `🔍 DIAGNÓSTICO: El servicio estaba procesando (${(bytesRead / 1024).toFixed(2)} KB recibidos) pero crasheó. Revisa los logs de Docling para ver el error interno: docker logs docling-rag --tail 100`;
          } else if (bytesRead > 0) {
            // Se recibió algo de datos pero muy poco
            errorType = "socket cerrado durante el inicio del procesamiento";
            suggestion = `El servicio Docling empezó a responder (recibió ${bytesRead} bytes) pero cerró la conexión muy rápido. Esto podría indicar un error temprano en el procesamiento.`;
            diagnosticInfo = `🔍 DIAGNÓSTICO: El servicio empezó a responder pero cerró rápidamente. Revisa los logs: docker logs docling-rag --tail 50`;
          } else {
            // No se recibió ningún dato
            errorType = "socket cerrado antes de la respuesta";
            suggestion = `El servicio Docling cerró la conexión antes de enviar una respuesta. El servicio puede estar reiniciándose o crasheó antes de procesar la request.`;
            diagnosticInfo = `🔍 DIAGNÓSTICO: No se recibió respuesta. Verifica el estado del servicio: docker ps -a | grep docling-rag`;
          }
        } else if (error.cause?.code === "ECONNREFUSED") {
          errorType = "conexión rechazada";
          suggestion = `El servicio Docling no está disponible en ${this.serviceUrl}. El servicio puede no estar corriendo.`;
          diagnosticInfo = `🔍 DIAGNÓSTICO: Verifica que el servicio esté corriendo: docker ps | grep docling-rag. Si no está, inícialo: docker start docling-rag`;
        } else if (error.cause?.code === "ECONNRESET") {
          errorType = "conexión reseteada";
          suggestion = `La conexión fue reseteada por el servidor. El servicio puede estar sobrecargado, reiniciándose, o haber alcanzado un límite.`;
          diagnosticInfo = `🔍 DIAGNÓSTICO: Revisa los logs y el estado del servicio: docker logs docling-rag --tail 50 && docker stats docling-rag`;
        } else if (error.cause?.code === "ETIMEDOUT") {
          errorType = "timeout de conexión";
          suggestion = `La conexión tardó demasiado en establecerse. El servicio puede estar sin responder.`;
          diagnosticInfo = `🔍 DIAGNÓSTICO: Verifica la salud del servicio: curl http://localhost:8000/health`;
        } else {
          errorType = "error de conexión";
          suggestion = `No se pudo conectar al microservicio Docling.`;
          diagnosticInfo = `🔍 DIAGNÓSTICO: Verifica el estado general: docker ps | grep docling-rag && docker logs docling-rag --tail 50`;
        }
        
        console.error(`[DoclingDocProcessorWrapper] 🔌 Error de conexión - Tipo: ${errorType}`);
        console.error(`[DoclingDocProcessorWrapper] Código de error: ${error.cause?.code || 'N/A'}`);
        
        if (bytesRead > 0 || bytesWritten > 0) {
          console.error(`[DoclingDocProcessorWrapper] 📊 Tráfico de red:`);
          console.error(`[DoclingDocProcessorWrapper]   - Request enviada: ${bytesWritten} bytes (${(bytesWritten / 1024).toFixed(2)} KB)`);
          console.error(`[DoclingDocProcessorWrapper]   - Respuesta recibida: ${bytesRead} bytes (${(bytesRead / 1024).toFixed(2)} KB)`);
          if (bytesRead > 0) {
            console.error(`[DoclingDocProcessorWrapper]   - Porcentaje recibido: ${((bytesRead / bytesWritten) * 100).toFixed(2)}% (relativo a request)`);
          }
        }
        
        console.error(`[DoclingDocProcessorWrapper] 💡 SUGERENCIA: ${suggestion}`);
        console.error(`[DoclingDocProcessorWrapper] ${diagnosticInfo}`);
        console.error(`[DoclingDocProcessorWrapper] 💡 Comando rápido: docker logs docling-rag --tail 50`);
        
        throw new Error(
          `Error al procesar documento: ${errorType}. ` +
          `${suggestion} ` +
          `${diagnosticInfo} ` +
          `Código de error: ${error.cause?.code || 'fetch failed'}`
        );
      }
      
      console.error(`[DoclingDocProcessorWrapper] ❌ Error inesperado:`, error);
      if (error.stack) {
        console.error(`[DoclingDocProcessorWrapper] Stack trace:`, error.stack);
      }
      throw error;
    }
  }
}

