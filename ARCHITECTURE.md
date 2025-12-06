# Arquitectura del Sistema - Vector Database RAG

Este documento describe la arquitectura completa del sistema, incluyendo todos los pipelines de procesamiento, conexiones a bases de datos, validaciones y modelos LLM utilizados.

## Arquitectura de Capas (Clean Architecture / Hexagonal Architecture)

El sistema está organizado siguiendo los principios de **Clean Architecture** (Arquitectura Hexagonal), separando las responsabilidades en capas independientes que permiten mantener el código mantenible, testeable y desacoplado.

### Estructura de Directorios

```
src/
├── domain/                    # Capa de Dominio (Núcleo)
│   ├── entities/             # Entidades de negocio
│   ├── repositories/         # Interfaces de repositorios
│   ├── services/             # Servicios de dominio (interfaces e implementaciones)
│   ├── exceptions/           # Excepciones de dominio
│   └── utils/                # Utilidades de dominio
│
├── application/              # Capa de Aplicación
│   ├── use-cases/           # Casos de uso organizados por dominio
│   │   ├── auth/
│   │   ├── pdf/
│   │   ├── rag/
│   │   ├── conversation/
│   │   ├── metrics/
│   │   ├── session/
│   │   ├── privacy/
│   │   └── admin/
│   ├── dtos/                # Data Transfer Objects
│   └── utils/               # Utilidades de aplicación
│
├── infrastructure/          # Capa de Infraestructura
│   ├── config/              # Configuraciones (DB, Redis)
│   ├── db/                  # Implementaciones de persistencia
│   │   ├── models/         # Modelos de Mongoose
│   │   └── repositories/   # Implementaciones de repositorios MongoDB
│   ├── redis/              # Implementación de repositorio Redis
│   ├── vector-store/       # Implementación de repositorio Qdrant
│   ├── email/              # Servicio de email
│   ├── http/               # Capa HTTP
│   │   ├── routes/         # Definición de rutas
│   │   ├── middlewares/    # Middlewares HTTP
│   │   └── utils/          # Utilidades HTTP
│   ├── services/           # Servicios de infraestructura
│   │   ├── core/           # Servicios core (embedding, LLM, etc.)
│   │   └── adapters/       # Adaptadores de servicios
│   ├── workers/            # Workers para procesamiento asíncrono
│   └── scripts/            # Scripts de utilidad
│
└── interfaces/              # Capa de Interfaces
    └── http/
        └── controllers/    # Controladores HTTP
```

### Flujo de Dependencias

```
HTTP Request
    ↓
[Interfaces Layer] Controllers
    ↓
[Application Layer] Use Cases
    ↓
[Domain Layer] Entities, Services, Repositories (interfaces)
    ↓
[Infrastructure Layer] Implementaciones concretas
    ↓
Bases de Datos / Servicios Externos
```

### Principios de la Arquitectura

1. **Independencia de Frameworks**: El dominio no depende de Express, Mongoose u otras librerías externas
2. **Testabilidad**: Las capas pueden ser testeadas independientemente mediante mocks/stubs
3. **Independencia de UI**: La lógica de negocio no depende de la interfaz HTTP
4. **Independencia de Base de Datos**: El dominio no conoce detalles de MongoDB, Redis o Qdrant
5. **Independencia de Agentes Externos**: Los servicios externos (OpenAI, Email) están abstraídos

### Capas Detalladas

#### 1. Domain Layer (`src/domain/`)
**Responsabilidad**: Contiene la lógica de negocio pura, sin dependencias externas.

- **Entities** (`entities/`): Modelos de dominio (User, Tenant)
- **Repositories** (`repositories/`): Interfaces que definen contratos para acceso a datos
  - `IUserRepository`, `IPdfRepository`, `IVectorRepository`, etc.
- **Services** (`services/`): Servicios de dominio (PasswordService, TokenService, etc.)
- **Exceptions** (`exceptions/`): Excepciones de dominio personalizadas
- **Utils** (`utils/`): Utilidades de dominio (tenant-helpers)

#### 2. Application Layer (`src/application/`)
**Responsabilidad**: Orquesta los casos de uso y coordina entre el dominio y la infraestructura.

- **Use Cases** (`use-cases/`): Casos de uso organizados por dominio funcional
  - `auth/`: LoginUserUseCase, RegisterUserUseCase, etc.
  - `pdf/`: UploadPdfUseCase, ProcessPdfUseCase, EmbedPdfChunksUseCase
  - `rag/`: SearchRagQueryUseCase
  - `conversation/`: GetConversationUseCase, CloseConversationUseCase, etc.
  - `metrics/`: GetCurrentMetricsUseCase, GetMetricsHistoryUseCase, etc.
  - `session/`: GetMySessionsUseCase, CloseSessionUseCase, etc.
  - `privacy/`: DeleteMyDataUseCase, GetMyDataSummaryUseCase, etc.
  - `admin/`: AdminDeleteUserDataUseCase, AdminExportUserDataUseCase
- **DTOs** (`dtos/`): Objetos de transferencia de datos (LoginRequest, RagQueryResponse, etc.)

#### 3. Infrastructure Layer (`src/infrastructure/`)
**Responsabilidad**: Implementaciones concretas de repositorios, servicios y configuraciones.

- **Config** (`config/`): Configuraciones de conexión (MongoDB, Redis)
- **DB** (`db/`):
  - `models/`: Modelos Mongoose (UserModel, PdfModel, etc.)
  - `repositories/`: Implementaciones MongoDB (UserRepositoryMongo, PdfRepositoryMongo, etc.)
- **Redis** (`redis/`): Implementación de SessionRepositoryRedis
- **Vector Store** (`vector-store/`): Implementación de QdrantVectorRepository
- **Email** (`email/`): Servicio de envío de emails con templates
- **HTTP** (`http/`):
  - `routes/`: Definición de rutas Express
  - `middlewares/`: Middlewares (auth, rate-limit, validation, etc.)
- **Services** (`services/`):
  - `core/`: Servicios core (embedding, LLM, PDF processing, etc.)
  - `adapters/`: Adaptadores que envuelven servicios core
- **Workers** (`workers/`): Workers para procesamiento asíncrono de PDFs

#### 4. Interfaces Layer (`src/interfaces/`)
**Responsabilidad**: Punto de entrada HTTP, adapta requests HTTP a casos de uso.

- **Controllers** (`http/controllers/`): Controladores que:
  - Reciben requests HTTP
  - Validan y transforman datos a DTOs
  - Instancian y ejecutan casos de uso
  - Manejan excepciones y formatean respuestas
  - Ejemplos: AuthController, DocController, RagController, etc.

### Ejemplo de Flujo Completo

**Request: POST /api/auth/login**

1. **HTTP Layer** (`app.js`):
   - Middleware de rate limiting
   - Middleware de sanitización
   - Routing a `/api/auth/login`

2. **Route** (`infrastructure/http/routes/auth.routes.js`):
   - Valida request con express-validator
   - Llama a `AuthController.login()`

3. **Controller** (`interfaces/http/controllers/AuthController.js`):
   - Extrae datos del request
   - Crea `LoginRequest` DTO
   - Instancia `LoginUserUseCase` con dependencias
   - Ejecuta el caso de uso
   - Maneja excepciones y retorna respuesta

4. **Use Case** (`application/use-cases/auth/LoginUserUseCase.js`):
   - Usa `IUserRepository` (interfaz) para buscar usuario
   - Usa `PasswordService` para verificar contraseña
   - Usa `TokenService` para generar JWT
   - Usa `ISessionRepository` para crear sesión
   - Retorna `LoginResponse` DTO

5. **Infrastructure**:
   - `UserRepositoryMongo` implementa `IUserRepository`
   - `SessionRepositoryRedis` implementa `ISessionRepository`
   - Accede a MongoDB y Redis según corresponda

### Ventajas de esta Arquitectura

- **Mantenibilidad**: Cambios en una capa no afectan otras
- **Testabilidad**: Fácil crear mocks de repositorios y servicios
- **Escalabilidad**: Fácil agregar nuevos casos de uso o cambiar implementaciones
- **Separación de Responsabilidades**: Cada capa tiene una responsabilidad clara
- **Flexibilidad**: Fácil cambiar de MongoDB a otra DB, o de Express a otro framework

## Diagrama de Flujo del Sistema

```mermaid
flowchart TD
    %% ========== INICIO DEL SISTEMA ==========
    Start([Inicio del Sistema])
    Start --> InitDB[Inicializar MongoDB]
    Start --> InitQdrant[Inicializar Qdrant]
    Start --> InitRedis[Inicializar Redis]
    InitDB --> ServerReady[Servidor Listo]
    InitQdrant --> ServerReady
    InitRedis --> ServerReady

    %% ========== PIPELINE DE AUTENTICACIÓN ==========
    ServerReady --> AuthFlow{Request entrante}
    AuthFlow -->|Login/Register| AuthRequest[POST /api/auth/login]
    AuthRequest --> AuthValidate[Validar Credenciales]
    AuthValidate --> AuthDB[(MongoDB: Users)]
    AuthDB -->|Usuario válido| AuthJWT[Generar JWT Token]
    AuthJWT --> AuthResponse[Retornar Token]
    
    AuthFlow -->|Request Protegido| CheckToken{Verificar JWT}
    CheckToken -->|Sin token| AuthError[401: Token requerido]
    CheckToken -->|Token inválido| AuthError
    CheckToken -->|Token válido| AuthVerify[Verificar Usuario en DB]
    AuthVerify --> AuthDB2[(MongoDB: Users)]
    AuthDB2 -->|Usuario encontrado| AuthSuccess[Usuario autenticado]
    AuthDB2 -->|Usuario no encontrado| AuthError

    %% ========== PIPELINE DE UPLOAD DE PDF ==========
    AuthSuccess --> RateLimit1{Rate Limit Global}
    RateLimit1 -->|Excedido| RateLimitError[429: Rate limit excedido]
    RateLimit1 -->|OK| UploadRoute[POST /api/pdf/upload]
    UploadRoute --> RateLimit2{Rate Limit Usuario}
    RateLimit2 -->|Excedido| RateLimitError
    RateLimit2 -->|OK| MulterMiddleware[Multer Middleware]
    MulterMiddleware --> ValidateType{Tipo PDF válido?}
    ValidateType -->|No| UploadError[400: Solo PDFs permitidos]
    ValidateType -->|Sí| ValidateSize{Tamaño < 50MB?}
    ValidateSize -->|No| UploadError
    ValidateSize -->|Sí| Sanitize[MongoDB Sanitize]
    Sanitize --> SecurityLogger[Security Logger]
    SecurityLogger --> SaveFile[Guardar archivo en /uploads]
    SaveFile --> SavePDFMeta[Guardar metadata en MongoDB]
    SavePDFMeta --> PDFDB[(MongoDB: PDFs<br/>status: uploaded)]
    PDFDB --> UploadResponse[201: PDF subido correctamente]

    %% ========== PIPELINE DE PROCESAMIENTO DE PDF ==========
    UploadResponse --> ProcessRoute[POST /api/pdf/process/:id]
    ProcessRoute --> ValidateId1[Validar ObjectId]
    ValidateId1 -->|Inválido| ProcessError[400: ID inválido]
    ValidateId1 -->|Válido| RateLimit3{Rate Limit Usuario}
    RateLimit3 -->|Excedido| RateLimitError
    RateLimit3 -->|OK| FindPDF[Buscar PDF en MongoDB]
    FindPDF --> PDFDB2[(MongoDB: PDFs)]
    PDFDB2 -->|No encontrado| ProcessError
    PDFDB2 -->|Encontrado| UpdateStatus1[Actualizar status: processing]
    UpdateStatus1 --> PDFDB3[(MongoDB: PDFs)]
    UpdateStatus1 --> WorkerPool[Worker Pool - Piscina]
    WorkerPool --> WorkerThread[Worker Thread]
    WorkerThread --> ReadPDF[Leer archivo PDF]
    ReadPDF --> PDFParse[PDF Parse - Extraer texto]
    PDFParse --> CleanText[Limpiar texto]
    CleanText --> CreateChunks[Crear Chunks<br/>Tamaño: 1200 chars<br/>Overlap: 200 chars]
    CreateChunks --> CalcPages[Calcular número de página]
    CalcPages --> DeleteOldChunks[Eliminar chunks antiguos del PDF]
    DeleteOldChunks --> CHUNKDB1[(MongoDB: Chunks)]
    DeleteOldChunks --> BatchInsert[Insertar chunks en lotes<br/>Batch: 100]
    BatchInsert --> CHUNKDB2[(MongoDB: Chunks<br/>status: chunked<br/>content, page, index)]
    BatchInsert --> UpdateStatus2[Actualizar PDF status: processed]
    UpdateStatus2 --> PDFDB4[(MongoDB: PDFs)]
    UpdateStatus2 --> InvalidateCache1[Invalidar caché RAG del PDF]
    InvalidateCache1 --> REDIS1[(Redis: Caché RAG)]
    InvalidateCache1 --> ProcessResponse[200: PDF procesado]

    %% ========== PIPELINE DE EMBEDDING ==========
    ProcessResponse --> EmbedRoute[POST /api/pdf/embed/:id]
    EmbedRoute --> ValidateId2[Validar ObjectId]
    ValidateId2 -->|Inválido| EmbedError[400: ID inválido]
    ValidateId2 -->|Válido| FindPDF2[Buscar PDF en MongoDB]
    FindPDF2 --> PDFDB5[(MongoDB: PDFs)]
    PDFDB5 -->|No encontrado| EmbedError
    PDFDB5 -->|Encontrado| FindChunks[Buscar chunks: status='chunked']
    FindChunks --> CHUNKDB3[(MongoDB: Chunks)]
    CHUNKDB3 -->|Sin chunks| EmbedResponse[200: Sin chunks para embeder]
    CHUNKDB3 -->|Chunks encontrados| ProcessBatch[Procesar en lotes<br/>Batch: 50 chunks]
    ProcessBatch --> PreprocessText[Preprocesar texto<br/>Límite: 8000 chars]
    PreprocessText --> EmbedBatch[OpenAI Embeddings<br/>Model: text-embedding-3-small<br/>Dimensiones: 1536]
    EmbedBatch --> OPENAI1[OpenAI API]
    OPENAI1 -->|Vectores| CreatePoints[Crear puntos Qdrant<br/>Vector + payload]
    CreatePoints --> UpsertQdrant[Upsert en Qdrant]
    UpsertQdrant --> QDRANT[(Qdrant: pdf_chunks<br/>Colección: pdf_chunks<br/>Distance: Cosine)]
    UpsertQdrant --> UpdateChunkStatus[Actualizar chunks: status='embedded']
    UpdateChunkStatus --> CHUNKDB4[(MongoDB: Chunks)]
    UpdateChunkStatus --> InvalidateCache2[Invalidar caché RAG del PDF]
    InvalidateCache2 --> REDIS2[(Redis: Caché RAG)]
    InvalidateCache2 --> EmbedResponse2[200: Chunks embedidos]

    %% ========== PIPELINE DE RAG QUERY ==========
    EmbedResponse2 --> RAGRoute[POST /api/rag/query]
    RAGRoute --> ValidateRAG[Validar: pdfId + question<br/>question: 3-1000 chars]
    ValidateRAG -->|Inválido| RAGError[400: Validación fallida]
    ValidateRAG -->|Válido| RateLimit4{Rate Limit Usuario}
    RateLimit4 -->|Excedido| RateLimitError
    RateLimit4 -->|OK| CheckCacheResponse{Verificar caché<br/>respuesta completa}
    CheckCacheResponse --> REDIS3[(Redis: Caché RAG<br/>TTL: 24h)]
    REDIS3 -->|Cache hit| RAGCacheHit[Respuesta desde caché]
    RAGCacheHit --> RAGResponse[200: Respuesta RAG]
    
    CheckCacheResponse -->|Cache miss| CheckEmbedCache{Verificar caché<br/>embedding pregunta}
    CheckEmbedCache --> REDIS4[(Redis: Caché Embeddings<br/>TTL: 7 días)]
    REDIS4 -->|Cache hit| UseCachedEmbed[Usar embedding cacheado]
    REDIS4 -->|Cache miss| GenerateEmbed[Generar embedding pregunta]
    GenerateEmbed --> OPENAI2[OpenAI API<br/>Model: text-embedding-3-small]
    OPENAI2 -->|Vector 1536D| SaveEmbedCache[Guardar embedding en caché]
    SaveEmbedCache --> REDIS5[(Redis: Caché Embeddings)]
    SaveEmbedCache --> UseCachedEmbed
    
    UseCachedEmbed --> SearchQdrant[Búsqueda en Qdrant<br/>Limit: 20<br/>Score threshold: 0.5<br/>Filter: pdfId]
    SearchQdrant --> QDRANT2[(Qdrant: pdf_chunks)]
    QDRANT2 -->|Vectores similares| GetChunkIds[Obtener chunkIds de resultados]
    GetChunkIds --> FindChunksMongo[Buscar chunks en MongoDB<br/>Ordenar por index]
    FindChunksMongo --> CHUNKDB5[(MongoDB: Chunks)]
    CHUNKDB5 -->|Chunks encontrados| BuildContext[Construir contexto<br/>Max: 4000 chars<br/>Fallback: 8000 chars]
    BuildContext --> CheckEmptyContext{Contexto vacío?}
    CheckEmptyContext -->|Sí| FallbackChunks[Buscar primeros chunks<br/>o chunks con keywords]
    FallbackChunks --> CHUNKDB6[(MongoDB: Chunks)]
    CHUNKDB6 --> BuildContext
    CheckEmptyContext -->|No| CreatePrompt[Crear prompt con contexto]
    CreatePrompt --> CallLLM[LLM Completion<br/>OpenAI GPT-4o-mini<br/>Temperature: 0.2]
    CallLLM --> OPENAI3[OpenAI API]
    OPENAI3 -->|Respuesta| SaveRAGCache[Guardar respuesta en caché]
    SaveRAGCache --> REDIS6[(Redis: Caché RAG)]
    SaveRAGCache --> FormatResponse[Formatear respuesta<br/>answer + context]
    FormatResponse --> RAGResponse

    %% ========== ESTILOS ==========
    classDef dbStyle fill:#4a90e2,stroke:#2c5aa0,stroke-width:2px,color:#fff
    classDef llmStyle fill:#10a37f,stroke:#0d7c5f,stroke-width:2px,color:#fff
    classDef errorStyle fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef validationStyle fill:#f39c12,stroke:#d68910,stroke-width:2px,color:#fff
    classDef cacheStyle fill:#9b59b6,stroke:#7d3c98,stroke-width:2px,color:#fff
    classDef processStyle fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff

    class PDFDB,PDFDB2,PDFDB3,PDFDB4,PDFDB5,CHUNKDB1,CHUNKDB2,CHUNKDB3,CHUNKDB4,CHUNKDB5,CHUNKDB6,AuthDB,AuthDB2 dbStyle
    class OPENAI1,OPENAI2,OPENAI3,EmbedBatch,CallLLM llmStyle
    class UploadError,ProcessError,EmbedError,RAGError,AuthError,RateLimitError errorStyle
    class ValidateType,ValidateSize,ValidateId1,ValidateId2,ValidateRAG,CheckToken,AuthValidate validationStyle
    class REDIS1,REDIS2,REDIS3,REDIS4,REDIS5,REDIS6,CheckCacheResponse,CheckEmbedCache,SaveEmbedCache,SaveRAGCache cacheStyle
    class WorkerPool,WorkerThread,ProcessBatch,BatchInsert,CreateChunks,PreprocessText processStyle
```

## Descripción de Componentes

### Bases de Datos

1. **MongoDB** - Base de datos principal (multi-tenant)
   
   **Colecciones:**
   - **Tenants** - Organizaciones/clientes del sistema (multi-tenancy)
     - Campos: name, slug, settings (rate limits, LLM model, etc.)
   - **Users** - Usuarios del sistema
     - Campos: tenantId, email, password, name, role, emailVerified, verificationToken, resetPasswordToken, allowHistory
     - Índices: tenantId + email (único), tenantId
   - **PDFs** - Metadata de archivos PDF subidos
     - Campos: tenantId, userId, filename, originalName, filePath, fileSize, status (uploaded, processing, processed, error), uploadedAt, processedAt
     - Índices: tenantId + userId, tenantId
   - **Chunks** - Fragmentos de texto extraídos de PDFs
     - Campos: tenantId, pdfId, content, page, index, status (chunked, embedded)
     - Índices: tenantId + pdfId, tenantId
   - **Conversations** - Conversaciones de RAG con contexto
     - Campos: tenantId, userId, pdfId, title, isActive, contextWindowSize, messageCount, summary, totalTokens, tokenCost
     - Índices: tenantId + userId + pdfId + isActive (único parcial), tenantId + userId
   - **Messages** - Mensajes dentro de conversaciones
     - Campos: tenantId, conversationId, role (user/assistant), content, index, metadata (pdfId, chunks, tokens)
     - Índices: tenantId + conversationId, tenantId
   - **LoginHistory** - Historial de inicios de sesión
     - Campos: tenantId, userId, tokenId, ipAddress, userAgent, loggedInAt, loggedOutAt, sessionDuration
     - Índices: tenantId + userId, tenantId
   - **Metrics** - Métricas del sistema
     - Campos: tenantId, timestamp, metrics (varios tipos de métricas agregadas)

2. **Qdrant (Vector Database)** - Base de datos vectorial
   - **Colección: pdf_chunks** - Almacena vectores de embeddings
   - **Dimensiones:** 1536 (text-embedding-3-small)
   - **Distancia:** Cosine similarity
   - **Payload:** pdfId, chunkId, index, page, content, tenantId
   - **Filtros:** Soporte para filtrado por tenantId y pdfId

3. **Redis (Caché y Sesiones)**
   - **Caché de Embeddings** - TTL: 7 días
     - Clave: `embedding:{hash}` → Vector embedding
   - **Caché de Respuestas RAG** - TTL: 24 horas
     - Clave: `rag:{pdfId}:{questionHash}` → Respuesta completa
   - **Sesiones de Usuario** - TTL: Configurable (default: 24h)
     - Clave: `session:{tenantId}:{userId}:{tokenId}` → Datos de sesión
     - Estructura: { tokenId, userId, tenantId, ipAddress, userAgent, createdAt, lastActivityAt }

### Modelos LLM Utilizados

1. **OpenAI text-embedding-3-small**
   - **Uso:** Generación de embeddings
   - **Dimensiones:** 1536
   - **Usado en:**
     - Embedding de chunks de PDFs
     - Embedding de preguntas en RAG queries

2. **OpenAI gpt-4o-mini**
   - **Uso:** Generación de respuestas en RAG
   - **Temperature:** 0.2 (baja para respuestas más determinísticas)
   - **Contexto:** Hasta 4000 caracteres de chunks relevantes

### Funcionalidades del Sistema

#### Autenticación y Autorización
- **Registro de usuarios** con verificación de email
- **Login multi-tenant** (soporte para múltiples organizaciones)
- **Gestión de sesiones** con Redis (tracking de IP, User-Agent, duración)
- **JWT tokens** para autenticación
- **Reset de contraseña** con tokens seguros
- **Gestión de perfil** (actualización de nombre y email)

#### Gestión de PDFs
- **Upload de PDFs** con validación de tipo y tamaño
- **Procesamiento asíncrono** en Worker Threads
- **Chunking inteligente** (1200 chars, overlap 200)
- **Generación de embeddings** en lotes
- **Almacenamiento vectorial** en Qdrant
- **Eliminación segura** de PDFs y sus datos asociados

#### RAG (Retrieval Augmented Generation)
- **Búsqueda vectorial** en Qdrant
- **Contexto inteligente** con fallback
- **Caché de respuestas** y embeddings
- **Conversaciones persistentes** con historial
- **Tracking de tokens** y costos por conversación
- **Resumen automático** de conversaciones largas

#### Conversaciones
- **Conversaciones por PDF** (una activa por usuario/PDF)
- **Historial de mensajes** con contexto
- **Ventana de contexto** configurable
- **Estadísticas de tokens** por conversación
- **Cierre y reactivación** de conversaciones

#### Métricas y Monitoreo
- **Métricas en tiempo real** del sistema
- **Historial de métricas** agregadas
- **Métricas por tenant** (multi-tenancy)
- **Exportación de datos** de métricas
- **Tracking de uso** de recursos (tokens, embeddings, etc.)

#### Privacidad y Cumplimiento
- **Eliminación de datos personales** (GDPR-ready)
- **Anonimización de historial** de login
- **Preferencias de historial** por usuario
- **Exportación de datos** del usuario
- **Eliminación de conversaciones** individuales

#### Administración
- **Panel de administración** para gestión de usuarios
- **Exportación de datos** de usuarios
- **Eliminación de datos** de usuarios (admin)

### Pipelines Detallados

#### 1. Pipeline de Autenticación
1. Validación de credenciales (email, password, tenantSlug)
2. Búsqueda de tenant por slug
3. Búsqueda de usuario por email + tenantId
4. Verificación de contraseña con bcrypt
5. Verificación de email verificado
6. Generación de JWT token
7. Creación de sesión en Redis
8. Registro en LoginHistory
9. Retorno de token y datos de usuario

#### 2. Pipeline de Upload de PDF
1. Validación de autenticación
2. Rate limiting (global y por usuario)
3. Validación de tipo de archivo (solo PDF)
4. Validación de tamaño (máx 50MB)
5. Sanitización MongoDB
6. Guardado en disco (`/uploads`)
7. Guardado de metadata en MongoDB

#### 3. Pipeline de Procesamiento de PDF
1. Validación de ID y rate limiting
2. Actualización de status a "processing"
3. Procesamiento en Worker Thread (Piscina)
   - Lectura del PDF
   - Extracción de texto (pdf-parse)
   - Limpieza de texto
   - Chunking (1200 chars, overlap 200)
   - Cálculo de página por chunk
4. Eliminación de chunks antiguos
5. Inserción de nuevos chunks en MongoDB (lotes de 100)
6. Actualización de status a "processed"
7. Invalidación de caché RAG

#### 4. Pipeline de Embedding
1. Validación de ID
2. Búsqueda de chunks con status "chunked"
3. Procesamiento en lotes (50 chunks)
4. Preprocesamiento de texto (límite 8000 chars)
5. Generación de embeddings (OpenAI text-embedding-3-small)
6. Creación de puntos para Qdrant
7. Upsert en Qdrant con vectores
8. Actualización de status a "embedded"
9. Invalidación de caché RAG

#### 5. Pipeline de RAG Query (con Conversaciones)
1. Validación de entrada (pdfId + question)
2. Rate limiting por usuario y tenant
3. Verificación de caché de respuesta completa
4. **Gestión de conversación:**
   - Buscar conversación activa para usuario + PDF
   - Si no existe, crear nueva conversación
   - Obtener mensajes anteriores (contexto de conversación)
5. Verificación de caché de embedding de pregunta
6. Si no hay caché: generación de embedding
7. Búsqueda vectorial en Qdrant (top 20, threshold 0.5, filtro por tenantId + pdfId)
8. Obtención de chunks relevantes de MongoDB
9. Construcción de contexto:
   - Contexto de conversación (mensajes anteriores)
   - Chunks relevantes del PDF (máx 4000 chars)
   - Fallback si no hay contexto (primeros chunks o keywords)
10. Creación de prompt con contexto completo
11. Llamada a LLM (GPT-4o-mini, temperature 0.2)
12. Guardado de mensajes (user + assistant) en MongoDB
13. Actualización de estadísticas de tokens y costos
14. Guardado en caché de respuesta
15. **Resumen automático** (si la conversación excede límite de mensajes)
16. Retorno de respuesta con contexto

### Multi-Tenancy

El sistema está diseñado con soporte completo para **multi-tenancy**, permitiendo que múltiples organizaciones (tenants) compartan la misma instancia del sistema de forma aislada.

**Características:**
- **Aislamiento de datos:** Todos los datos están asociados a un `tenantId`
- **Configuración por tenant:** Cada tenant puede tener:
  - Límites de rate limiting personalizados
  - Modelo LLM configurable
  - Límites de tokens y documentos
- **Slug de tenant:** Identificación amigable por URL (ej: `/api/...?tenantSlug=acme`)
- **Tenant por defecto:** Si no se especifica, se usa "default"
- **Índices optimizados:** Todos los índices de MongoDB incluyen `tenantId` como primer campo

**Implementación:**
- Middleware de autenticación valida `tenantId` del token JWT
- Todos los repositorios filtran por `tenantId` automáticamente
- Qdrant incluye `tenantId` en el payload de vectores para filtrado
- Redis usa `tenantId` en las claves de sesión

### Validaciones y Seguridad

- **Autenticación JWT:** 
  - Verificación en cada request protegido
  - Validación de `tenantId` en el token
  - Expiración configurable de tokens
- **Rate Limiting:** 
  - **Global:** 200 req/min por IP
  - **Por usuario:** Límites específicos por operación
  - **Por tenant:** Límites configurables por tenant (ragPerMinute, uploadPerMinute, processPerMinute)
  - **Endpoints críticos:** Límites más estrictos (login: 5 req/min)
- **Validación de Archivos:** 
  - Tipo: Solo PDF (validación MIME type)
  - Tamaño: Máximo 50MB (configurable)
  - Sanitización de nombres de archivo
- **Validación de Datos:**
  - ObjectId de MongoDB (validación de formato)
  - Longitud de strings (question: 3-1000 chars, name: 1-100 chars)
  - Validación de email (formato y dominio)
  - Sanitización MongoDB (prevención NoSQL injection)
  - Express-validator para validación de requests
- **Seguridad:**
  - **Helmet:** Headers HTTP seguros (CSP, HSTS, etc.)
  - **CORS:** Configurado con orígenes permitidos
  - **Security Logger:** Logging de intentos de acceso y errores
  - **Sanitización de inputs:** Escape de caracteres peligrosos
  - **Bcrypt:** Hashing de contraseñas (10 rounds)
  - **Tokens seguros:** Verificación y reset de contraseña con tokens criptográficos
  - **Sesiones:** Tracking de sesiones con IP y User-Agent
  - **Graceful shutdown:** Cierre ordenado de conexiones y recursos

### Optimizaciones de Memoria

- **Worker Threads:** Procesamiento de PDFs fuera del hilo principal
- **Procesamiento en Lotes:**
  - Chunks: 100 por lote en MongoDB
  - Embeddings: 50 por lote para Qdrant
- **Caché:** Redis para embeddings y respuestas RAG
- **Cursors:** Lectura de chunks con cursor para evitar cargar todo en memoria
- **Limpieza de Memoria:** Liberación explícita de referencias grandes

## Variables de Entorno Importantes

```
# Bases de Datos
DB_URL=mongodb://localhost:27017/vector-rag
QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.2

# JWT y Autenticación
JWT_SECRET=tu-secret-key-super-segura
JWT_EXPIRES_IN=24h
SESSION_TTL_HOURS=24

# Límites y Configuración
PDF_MAX_FILE_SIZE_MB=50
PDF_WORKER_THREADS=2
PDF_BATCH_SIZE=100
QDRANT_BATCH_SIZE=50
RAG_SEARCH_LIMIT=20
RAG_SCORE_THRESHOLD=0.5
RAG_MAX_CONTEXT_LENGTH=4000
RAG_FALLBACK_CONTEXT_LENGTH=8000
CONVERSATION_CONTEXT_WINDOW_SIZE=10
CONVERSATION_SUMMARY_THRESHOLD=20

# Caché
CACHE_ENABLED=true
CACHE_TTL_EMBEDDING=604800  # 7 días (segundos)
CACHE_TTL_RAG_RESPONSE=86400  # 24 horas (segundos)

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000  # 1 minuto
RATE_LIMIT_MAX_REQUESTS=200  # Global
RATE_LIMIT_AUTH_MAX_REQUESTS=5  # Login/Register
RATE_LIMIT_UPLOAD_PER_MINUTE=100  # Por usuario
RATE_LIMIT_PROCESS_PER_MINUTE=200  # Por usuario
RATE_LIMIT_RAG_PER_MINUTE=500  # Por usuario

# Express
EXPRESS_JSON_LIMIT_MB=10
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Sesiones
SESSION_CLEANUP_INTERVAL_MINUTES=15

# Email (si se usa servicio de email)
EMAIL_FROM=noreply@example.com
EMAIL_SERVICE=...  # Configuración del servicio de email

# Multi-Tenancy
DEFAULT_TENANT_SLUG=default
```

### Configuración por Tenant

Los tenants pueden tener configuraciones personalizadas almacenadas en MongoDB:

```javascript
{
  name: "Nombre del Tenant",
  slug: "tenant-slug",
  settings: {
    maxUsers: 10,
    maxPdfs: 100,
    llmModel: "gpt-4o-mini",
    ragLimits: {
      maxTokens: 3500,
      documentPriority: 0.7
    },
    rateLimits: {
      ragPerMinute: 500,
      uploadPerMinute: 100,
      processPerMinute: 200
    }
  }
}
```

