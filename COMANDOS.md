## Comandos para levantar el proyecto

### 1. Variables de entorno requeridas

Crear un archivo `.env` en la raíz del proyecto con al menos:

```bash
OPENAI_API_KEY="TU_API_KEY_DE_OPENAI"
DB_URL="mongodb://localhost:27017/vector-db-rag"
QDRANT_URL="http://localhost:6333"
PORT=3000
PDF_WORKER_THREADS=2

# Autenticación JWT
JWT_SECRET="tu-secreto-super-seguro-aqui-cambiar-en-produccion"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000

# Caché Redis (opcional)
REDIS_URL="redis://localhost:6379"
CACHE_ENABLED=true
CACHE_TTL_EMBEDDING=604800
CACHE_TTL_RAG_RESPONSE=86400

# Optimización de Memoria
PDF_MAX_FILE_SIZE_MB=50
PDF_BATCH_SIZE=100
QDRANT_BATCH_SIZE=50
EMBEDDING_BATCH_SIZE=64
EMBEDDING_MAX_TEXTS=200
RAG_MAX_CONTEXT_LENGTH=4000
EXPRESS_JSON_LIMIT_MB=10

# Sistema de Métricas y Alertas
METRICS_COLLECTION_INTERVAL=30000
METRICS_QDRANT_CHECK_INTERVAL=60000
METRICS_GC_CHECK_INTERVAL=60000
METRICS_GC_MEMORY_THRESHOLD=85
METRICS_MEMORY_WARNING=80
METRICS_MEMORY_CRITICAL=95
METRICS_CPU_WARNING=80
METRICS_CPU_CRITICAL=95
CHUNK_LIST_MAX_LIMIT=500

# Seguridad
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"
```

**Notas sobre configuración**:
- `PDF_WORKER_THREADS`: Número de worker threads para procesar PDFs en paralelo. Por defecto es 2. Ajusta según los recursos de tu servidor (más threads = más CPU y memoria usados).
- `PDF_MAX_FILE_SIZE_MB`: Tamaño máximo de archivos PDF en MB. Por defecto 50MB.
- `PDF_BATCH_SIZE`: Cantidad de chunks a procesar por lote al guardar en MongoDB. Por defecto 100.
- `QDRANT_BATCH_SIZE`: Cantidad de chunks a procesar por lote al generar embeddings. Por defecto 50.
- `EMBEDDING_BATCH_SIZE`: Tamaño de batch para embeddings de OpenAI. Por defecto 64.
- `EMBEDDING_MAX_TEXTS`: Límite máximo de textos a procesar en una sola llamada a embedBatch. Por defecto 200.
- `RAG_MAX_CONTEXT_LENGTH`: Longitud máxima del contexto en caracteres para respuestas RAG. Por defecto 4000.

**Recomendaciones según recursos del servidor**:
- **Servidores pequeños (2GB RAM)**: Reduce `PDF_BATCH_SIZE=50`, `QDRANT_BATCH_SIZE=25`, `PDF_WORKER_THREADS=1`
- **Servidores medianos (4GB RAM)**: Valores por defecto están bien
- **Servidores grandes (8GB+ RAM)**: Puedes aumentar `PDF_BATCH_SIZE=200`, `QDRANT_BATCH_SIZE=100`, `PDF_WORKER_THREADS=4`

**Configuración del Heap de Node.js**:
- El tamaño máximo del heap está configurado a **512 MB** en `package.json` mediante el flag `--max-old-space-size=512`
- Esto significa que Node.js puede usar hasta 512 MB de memoria heap antes de mostrar errores de "out of memory"
- Si necesitas aumentar el heap, modifica `package.json` cambiando el valor `512` por el deseado (ej: `1024` para 1 GB)
- **Nota importante**: Después de cambiar el heap size, debes reiniciar el servidor para que los cambios surtan efecto

### 2. Instalar dependencias de Node.js

```bash
cd /Users/luis/Desktop/vector-database-rag
npm install
```

### 3. Levantar Qdrant con Docker

Contenedor de Qdrant (puerto por defecto 6333) montando la carpeta `qdrant_data` de este proyecto:

```bash
cd /Users/luis/Desktop/vector-database-rag
docker run -p 6333:6333 \
  -v "$(pwd)/qdrant_data:/qdrant/storage" \
  qdrant/qdrant
```

> Deja este contenedor corriendo en una terminal separada.

### 4. Levantar MongoDB (si no tienes uno ya en marcha)

Ejemplo rápido con Docker (Mongo en puerto 27017, volumen local opcional):

```bash
docker run -d \
  --name mongo-rag \
  -p 27017:27017 \
  mongo:7
```

Si usas otra URL distinta, actualiza `DB_URL` en tu `.env`.

### 5. Levantar Redis (si no tienes uno ya en marcha)

Ejemplo rápido con Docker (Redis en puerto 6379):

```bash
docker run -d \
  --name redis-rag \
  -p 6379:6379 \
  redis:7-alpine
```

**Si el contenedor ya existe**, puedes:

- Verificar su estado:
```bash
docker ps -a | grep redis-rag
```

- Si está parado, iniciarlo:
```bash
docker start redis-rag
```

- Si quieres eliminarlo y crear uno nuevo:
```bash
docker rm -f redis-rag
docker run -d \
  --name redis-rag \
  -p 6379:6379 \
  redis:7-alpine
```

Si usas otra URL distinta, actualiza `REDIS_URL` en tu `.env`.

**Nota**: Redis es opcional pero recomendado para mejorar el rendimiento mediante caché de embeddings y respuestas RAG. Si no levantas Redis, la aplicación funcionará en modo degradado (sin caché).

### 5.5. Comandos rápidos para Docker (Qdrant y Redis)

**Levantar Qdrant y Redis con una sola línea:**
```bash
npm run docker:up
```

Este comando:
- Inicia los contenedores si ya existen
- O los crea si no existen

**Detener Qdrant y Redis con una sola línea:**
```bash
npm run docker:down
```

**Verificar estado de los contenedores:**
```bash
docker ps | grep -E "qdrant|redis"
```

### 6. Levantar el backend Node.js

#### En modo desarrollo (con recarga automática)

```bash
cd /Users/luis/Desktop/vector-database-rag
npm run dev
```

#### En modo producción simple

```bash
cd /Users/luis/Desktop/vector-database-rag
npm start
```

El servidor se levanta por defecto en `http://localhost:3000`.

### 7. Flujo de uso del RAG

1. Abrir la página para gestionar PDFs:
   - Navega a: `http://localhost:3000/pdfs.html`
   - Sube un PDF, luego pulsa:
     - **“Convertir a chunks”** para procesarlo.
     - **“Enviar a Qdrant”** para generar embeddings e indexar en Qdrant.

2. Abrir la página para hacer preguntas a los PDFs:
   - Navega a: `http://localhost:3000/rag.html`
   - Selecciona un PDF con estado `processed`.
   - Escribe tu pregunta y pulsa **“Preguntar al PDF”**.

### 8. Detener los servicios

#### Detener el backend Node.js

- Si lo iniciaste con `npm run dev` o `npm start` en una terminal:
  - Ve a esa terminal y pulsa `Ctrl + C`.

#### Detener Qdrant en Docker

Si levantaste Qdrant con:

```bash
docker run -p 6333:6333 \
  -v "$(pwd)/qdrant_data:/qdrant/storage" \
  qdrant/qdrant
```

Ese contenedor queda en primer plano en la terminal; para detenerlo:

- En esa terminal, pulsa `Ctrl + C`.

Si lo dejaste en segundo plano con `-d` y le pusiste nombre, por ejemplo:

```bash
docker run -d --name qdrant-rag \
  -p 6333:6333 \
  -v "$(pwd)/qdrant_data:/qdrant/storage" \
  qdrant/qdrant
```

Entonces puedes detenerlo con:

```bash
docker stop qdrant
```

Y, si quieres borrarlo:

```bash
docker rm qdrant-rag
```

#### Detener MongoDB en Docker

Si levantaste Mongo con el comando de ejemplo:

```bash
docker run -d \
  --name mongo-rag \
  -p 27017:27017 \
  mongo:7
```

Para detenerlo:

```bash
docker stop mongo-rag
```

Y para borrarlo:

```bash
docker rm mongo-rag
```

#### Detener Redis en Docker

Si levantaste Redis con el comando de ejemplo:

```bash
docker run -d \
  --name redis-rag \
  -p 6379:6379 \
  redis:7-alpine
```

Para detenerlo:

```bash
docker stop redis-rag
```

Y para borrarlo:

```bash
docker rm redis-rag
```

Si el contenedor está parado y quieres iniciarlo de nuevo:

```bash
docker start redis-rag
```

### 9. Dashboard de Métricas

El proyecto incluye un dashboard de métricas para monitorear el consumo de memoria, CPU, y estado de las conexiones en tiempo real.

#### Acceder al Dashboard

1. Navega a: `http://localhost:3000/metrics.html`
   - O desde el dashboard principal, haz clic en **"Ver Métricas del Sistema"**

#### Funcionalidades del Dashboard

- **Métricas en tiempo real**:
  - Memoria Heap Usada y Total
  - RSS (Resident Set Size)
  - Uso de CPU
  - Uptime del proceso
  - Memoria libre del sistema

- **Gráficos históricos**:
  - Gráfico de memoria (últimas 50 muestras)
  - Gráfico de CPU (últimas 50 muestras)

- **Alertas automáticas**:
  - Alertas de memoria cuando supera umbrales configurados
  - Alertas de CPU cuando supera umbrales configurados
  - Niveles: Warning (amarillo) y Critical (rojo)

- **Estado de conexiones**:
  - MongoDB (conectado/desconectado)
  - Redis (conectado/desconectado)
  - Qdrant (disponible/no disponible)

- **Exportación de métricas**:
  - Exportar a CSV
  - Exportar a JSON
  - Filtros por fecha y límite de registros

#### Variables de Entorno para Métricas

Las siguientes variables pueden configurarse en el `.env`:

```bash
# Intervalo de recolección de métricas (en milisegundos)
METRICS_COLLECTION_INTERVAL=30000  # Por defecto: 30 segundos

# Intervalo de verificación de Qdrant en métricas (en milisegundos)
# Reduce llamadas a Qdrant para evitar acumulación de promesas y memoria
METRICS_QDRANT_CHECK_INTERVAL=60000  # Por defecto: 60 segundos

# Configuración de Garbage Collection automático
METRICS_GC_CHECK_INTERVAL=60000      # Por defecto: 60 segundos (verificar cada minuto)
METRICS_GC_MEMORY_THRESHOLD=85      # Por defecto: 85% (forzar GC si heap > 85%)

# Umbrales de alertas de memoria (% del heap total)
METRICS_MEMORY_WARNING=80   # Por defecto: 80%
METRICS_MEMORY_CRITICAL=95  # Por defecto: 95%

# Umbrales de alertas de CPU (% de uso)
METRICS_CPU_WARNING=80      # Por defecto: 80%
METRICS_CPU_CRITICAL=95     # Por defecto: 95%

# Límite máximo de chunks en listado paginado
CHUNK_LIST_MAX_LIMIT=500    # Por defecto: 500
```

#### Almacenamiento de Métricas

- Las métricas se guardan automáticamente en MongoDB cada `METRICS_COLLECTION_INTERVAL` milisegundos
- Se almacenan en la colección `metrics`
- Las métricas antiguas se eliminan automáticamente después de 30 días (TTL index)
- Puedes consultar métricas históricas mediante la API: `GET /api/metrics/history`

#### Endpoints de la API de Métricas

- `GET /api/metrics/current` - Obtener métricas actuales en tiempo real
- `GET /api/metrics/history` - Obtener métricas históricas (con filtros de fecha y límite)
- `GET /api/metrics/aggregated` - Obtener métricas agregadas (promedios, máximos, mínimos)
- `GET /api/metrics/export?format=json|csv` - Exportar métricas en formato JSON o CSV

**Nota**: Todos los endpoints requieren autenticación JWT.


