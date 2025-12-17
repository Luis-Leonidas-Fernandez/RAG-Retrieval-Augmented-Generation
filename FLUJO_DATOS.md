# Flujo de Datos: Subida → Procesamiento → Pregunta → Respuesta

## 1. SUBIDA DE ARCHIVOS

```
Usuario
  │
  ├─→ Selecciona archivo (PDF, XLSX, DOCX, etc.)
  │
  └─→ POST /api/pdf/upload
         │
         ├─→ UploadDocUseCase
         │     │
         │     ├─→ Valida MIME type
         │     │     ├─→ PDF: application/pdf
         │     │     ├─→ XLSX: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
         │     │     └─→ Otros formatos soportados
         │     │
         │     └─→ Guarda archivo en /uploads
         │           │
         │           └─→ Crea registro en MongoDB (DocRepository)
         │                 │
         │                 └─→ Estado: "uploaded"
```

## 2. PROCESAMIENTO DE ARCHIVOS

```
Usuario hace clic en "Convertir a chunks"
  │
  └─→ POST /api/pdf/process/:pdfId
         │
         ├─→ ProcessDocUseCase
         │     │
         │     ├─→ Verifica que documento existe
        │     │
        │     ├─→ pdfProcessService.processPdf()
        │     │     │
        │     │     └─→ DocProcessService (Node)
        │     │           │
        │     │           ├─→ Si es PDF → pdf-parse → texto plano + chunks
        │     │           └─→ Si es XLSX → excel_loader → filas → chunks con metadata
         │     │                 │
         │     │                 ├─→ cleanText() → Limpia texto preservando tablas
         │     │                 │
         │     │                 ├─→ extractTocFromPages() → Extrae índice si existe
         │     │                 │
         │     │                 └─→ createChunks() → Divide en chunks (1200 chars, overlap 200)
         │     │                       │
         │     │                       └─→ Preserva filas de tabla completas
         │     │
         │     ├─→ Elimina chunks existentes del documento
         │     │
         │     ├─→ Guarda chunks en MongoDB (ChunkRepository)
         │     │     │
         │     │     └─→ En lotes de 100 (batchSize)
         │     │           │
         │     │           └─→ Cada chunk tiene: content, index, page, sectionType
         │     │
         │     └─→ Actualiza estado del documento a "processed"
```

## 3. CONSULTA RAG (Pregunta → Respuesta)

```
Usuario hace pregunta
  │
  └─→ POST /api/rag/query
         │
         ├─→ RagController.query()
         │     │
         │     ├─→ Detecta tipo de pregunta
         │     │     │
         │     │     ├─→ ¿Es solicitud de índice?
         │     │     │     │
         │     │     │     └─→ SI → GetDocIndexUseCase
         │     │     │           │
         │     │     │           └─→ Busca chunks con sectionType='toc'
         │     │     │                 │
         │     │     │                 └─→ Retorna índice formateado
         │     │     │
         │     │     └─→ NO → SearchRagQueryUseCase
         │     │
         │     └─→ SearchRagQueryUseCase.execute()
         │           │
         │           ├─→ Verifica documento en MongoDB
         │           │
         │           ├─→ isTabularDocument() → Detecta si es documento tabular
         │           │     │
         │           │     ├─→ SI es XLSX/XLS/CSV → TRUE
         │           │     ├─→ SI documentKind='table'/'tabular' → TRUE
         │           │     └─→ SI documentKind='book'/'libro' → FALSE
         │           │
         │           ├─→ ¿Es documento tabular?
         │           │     │
         │           │     ├─→ SI → needsStructuredResponse() → ¿Pregunta requiere datos estructurados?
         │           │     │     │
         │           │     │     ├─→ SI → ExtractStructuredDataUseCase
         │           │     │     │     │
         │           │     │     │     ├─→ Busca chunks en MongoDB
         │           │     │     │     │
         │           │     │     │     ├─→ Extrae pares Nombre-Email-Vehículo
         │           │     │     │     │
         │           │     │     │     ├─→ Genera resumen con LLM
         │           │     │     │     │
         │           │     │     │     ├─→ Guarda datos completos en Redis (exportId)
         │           │     │     │     │
         │           │     │     │     └─→ Retorna respuesta con tabla (primeras 100 filas) + botón descargar Excel
         │           │     │     │
         │           │     │     └─→ NO → Flujo RAG normal
         │           │     │
         │           │     └─→ NO → Flujo RAG normal
         │           │
         │           └─→ Flujo RAG Normal
         │                 │
         │                 ├─→ ¿Es consulta de email/vehículo?
         │                 │     │
         │                 │     ├─→ "email de X" → Busca chunk directo en MongoDB por nombre
         │                 │     │     │
         │                 │     │     └─→ Retorna respuesta directa (sin LLM)
         │                 │     │
         │                 │     └─→ "vehículo de X" → Busca chunk directo en MongoDB por vehículo
         │                 │           │
         │                 │           └─→ Retorna respuesta directa (sin LLM)
         │                 │
         │                 ├─→ Verifica caché de respuesta RAG
         │                 │     │
         │                 │     └─→ Si existe → Retorna respuesta cacheada
         │                 │
         │                 ├─→ Genera embedding de la pregunta
         │                 │     │
         │                 │     ├─→ Verifica caché de embedding
         │                 │     │
         │                 │     └─→ Si no existe → embeddingService.embedText()
         │                 │
         │                 ├─→ Busca chunks similares en Qdrant (Vector Store)
         │                 │     │
         │                 │     ├─→ vectorRepository.search()
         │                 │     │     │
         │                 │     │     └─→ Retorna chunks ordenados por score (similaridad)
         │                 │     │
         │                 │     └─→ Filtra por scoreThreshold (default: 0.3)
         │                 │
         │                 ├─→ Obtiene contenido de chunks desde MongoDB
         │                 │     │
         │                 │     └─→ chunkRepository.findByIds()
         │                 │
         │                 ├─→ Construye contexto optimizado
         │                 │     │
         │                 │     ├─→ Selecciona mejor chunk (mayor score)
         │                 │     │
         │                 │     ├─→ Busca vecinos (index ±1)
         │                 │     │
         │                 │     ├─→ Máximo 3 chunks
         │                 │     │
         │                 │     └─→ Si no hay chunks → Fallback (primeros 20 chunks)
         │                 │
         │                 ├─→ ¿Hay historial de conversación?
         │                 │     │
         │                 │     ├─→ SI → Incluye mensajes recientes + resumen
         │                 │     │
         │                 │     └─→ NO → Solo contexto del documento
         │                 │
         │                 ├─→ Construye prompt optimizado
         │                 │     │
         │                 │     └─→ Incluye: contexto documento + historial + pregunta
         │                 │
         │                 ├─→ LLM Service → Genera respuesta
         │                 │     │
         │                 │     ├─→ llmService.generateCompletion()
         │                 │     │     │
         │                 │     │     └─→ OpenAI API (gpt-4o-mini por defecto)
         │                 │     │
         │                 │     └─→ Retorna: answer, tokens (prompt, completion, total)
         │                 │
         │                 ├─→ Guarda mensajes en conversación
         │                 │     │
         │                 │     ├─→ Crea/actualiza Conversation
         │                 │     │
         │                 │     ├─→ Guarda Message (user)
         │                 │     │
         │                 │     └─→ Guarda Message (assistant)
         │                 │
         │                 ├─→ Guarda respuesta en caché
         │                 │
         │                 └─→ Retorna respuesta al usuario
```

## 4. CONDICIONALES: PDF vs XLSX

### Procesamiento

```
Archivo subido
  │
  ├─→ ¿Tipo de archivo?
  │     │
  │     ├─→ PDF
  │     │     │
  │     │     └─→ DocProcessService (Node):
  │     │           ├─→ Extrae texto plano con pdf-parse
  │     │           └─→ Genera chunks de texto (createChunks)
  │     │
  │     └─→ XLSX
  │           │
  │           └─→ excel_loader (Node):
  │                 ├─→ Lee hojas/filas con exceljs
  │                 ├─→ Convierte filas en texto estructurado
  │                 └─→ Genera chunks por fila con metadata (sheetName, rowIndex)
  │
  └─→ Ambos → Chunks normalizados → MongoDB → Qdrant
```

### Consulta RAG

```
Pregunta recibida
  │
  ├─→ isTabularDocument()
  │     │
  │     ├─→ ¿Es XLSX/XLS/CSV?
  │     │     │
  │     │     └─→ SI → isTabular = TRUE
  │     │
  │     ├─→ ¿documentKind='table'/'tabular'?
  │     │     │
  │     │     └─→ SI → isTabular = TRUE
  │     │
  │     └─→ ¿documentKind='book'/'libro'?
  │           │
  │           └─→ SI → isTabular = FALSE
  │
  ├─→ ¿isTabular = TRUE?
  │     │
  │     ├─→ SI → needsStructuredResponse()
  │     │     │
  │     │     ├─→ ¿Pregunta requiere lista/tabla?
  │     │     │     │
  │     │     │     ├─→ SI → ExtractStructuredDataUseCase
  │     │     │     │     │
  │     │     │     │     ├─→ Busca chunks con tablas
  │     │     │     │     │
  │     │     │     │     ├─→ Extrae datos estructurados (Nombre, Email, Vehículo)
  │     │     │     │     │
  │     │     │     │     ├─→ Genera respuesta con tabla visual
  │     │     │     │     │
  │     │     │     │     └─→ Guarda datos completos para exportar Excel
  │     │     │     │
  │     │     │     └─→ NO → Flujo RAG normal
  │     │     │
  │     └─→ NO → Flujo RAG normal (búsqueda vectorial)
```

## 5. ALMACENAMIENTO

```
Datos almacenados en:
  │
  ├─→ MongoDB
  │     │
  │     ├─→ Documents (docs collection)
  │     │     └─→ Metadata: originalName, fileName, path, size, mimetype, status
  │     │
  │     ├─→ Chunks (chunks collection)
  │     │     └─→ Contenido: content, index, page, sectionType, pdfId
  │     │
  │     ├─→ Conversations (conversations collection)
  │     │     └─→ Metadata: userId, pdfId, title, messageCount, tokenStats
  │     │
  │     └─→ Messages (messages collection)
  │           └─→ Contenido: role, content, index, metadata (tokens, chunks, llmModel)
  │
  ├─→ Qdrant (Vector Database)
  │     │
  │     └─→ Vectors (pdf_chunks collection)
  │           └─→ Vector: embedding (1536 dims), payload: chunkId, index, content, pdfId
  │
  └─→ Redis
        │
        ├─→ Caché de embeddings
        │     └─→ Key: tenantId:embedding:question → Value: vector
        │
        ├─→ Caché de respuestas RAG
        │     └─→ Key: tenantId:rag:pdfId:question → Value: respuesta completa
        │
        └─→ Almacenamiento temporal de exports
              └─→ Key: exportId → Value: datos estructurados completos
```

## 6. FLUJO COMPLETO RESUMIDO

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO COMPLETO DE DATOS                      │
└─────────────────────────────────────────────────────────────────┘

1. SUBIDA
   Usuario → Frontend → POST /api/pdf/upload → UploadDocUseCase
   → Guarda archivo → MongoDB (estado: "uploaded")

2. PROCESAMIENTO
   Usuario → Frontend → POST /api/pdf/process/:id → ProcessDocUseCase
   → DocProcessService (Node) → pdf-parse / excel_loader → Extrae texto/filas
   → Crea chunks → MongoDB (estado: "processed")
   → (Opcional) Embed chunks → Qdrant (vectores)

3. CONSULTA
   Usuario → Frontend → POST /api/rag/query → RagController
   → SearchRagQueryUseCase
   → ¿Es tabular? → ¿Requiere datos estructurados?
   → SI: Extrae datos → Respuesta con tabla
   → NO: Embedding → Qdrant → Chunks similares → LLM → Respuesta

4. RESPUESTA
   → Guarda en conversación (MongoDB)
   → Guarda en caché (Redis)
   → Retorna al usuario
```

## 7. DIFERENCIAS CLAVE: PDF vs XLSX

| Aspecto | PDF | XLSX |
|---------|-----|------|
| **Procesamiento** | Extrae texto plano, detecta TOC | Convierte tablas a markdown |
| **Chunks** | Texto normal, puede cortar en medio de palabras | Preserva filas de tabla completas |
| **Detección** | `isTabularDocument()` → FALSE (por defecto) | `isTabularDocument()` → TRUE |
| **Consulta** | Flujo RAG normal (búsqueda vectorial) | Puede usar ExtractStructuredDataUseCase si pregunta requiere tabla |
| **Respuesta** | Texto generado por LLM | Tabla estructurada + opción descargar Excel |
| **Almacenamiento** | Chunks de texto en MongoDB + vectores en Qdrant | Chunks con tablas markdown en MongoDB + vectores en Qdrant |

