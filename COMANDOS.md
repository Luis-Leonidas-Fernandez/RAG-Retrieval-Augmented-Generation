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
REDIS_URL="redis://localhost:6380"
CACHE_ENABLED=true
CACHE_TTL_EMBEDDING=604800
CACHE_TTL_RAG_RESPONSE=86400

# Optimización de Memoria
PDF_MAX_FILE_SIZE_MB=50
PDF_BATCH_SIZE=100
QDRANT_BATCH_SIZE=50
EMBEDDING_BATCH_SIZE=64
EMBEDDING_MAX_TEXTS=200
EMBEDDING_PARALLEL_REQUESTS=3
QDRANT_PARALLEL_BATCHES=2
RAG_MAX_CONTEXT_LENGTH=4000
RAG_SCORE_THRESHOLD=0.3
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
- `EMBEDDING_PARALLEL_REQUESTS`: Número de requests paralelos a OpenAI API para generar embeddings. Por defecto 1 (secuencial). Valores recomendados: 3-5 para mejorar rendimiento en archivos grandes. Aumenta el tiempo de procesamiento pero puede sobrecargar la API si es muy alto.
- `QDRANT_PARALLEL_BATCHES`: Número de batches paralelos para indexar en Qdrant. Por defecto 1 (secuencial). Valores recomendados: 2-3 para mejorar rendimiento. Valores más altos pueden sobrecargar Qdrant.
- `RAG_MAX_CONTEXT_LENGTH`: Longitud máxima del contexto en caracteres para respuestas RAG. Por defecto 4000.
- `RAG_SCORE_THRESHOLD`: Umbral mínimo de similitud (score) para considerar un chunk como relevante en búsquedas RAG. Valor entre 0.0 y 1.0. Por defecto 0.3. Valores más bajos (0.25-0.35) traen más resultados pero pueden incluir ruido. Valores más altos (0.4-0.6) son más estrictos pero pueden perder resultados relevantes. Para solicitudes de índice se usa automáticamente 0.3.

**Recomendaciones según recursos del servidor**:
- **Servidores pequeños (2GB RAM)**: Reduce `PDF_BATCH_SIZE=50`, `QDRANT_BATCH_SIZE=25`, `PDF_WORKER_THREADS=1`, `EMBEDDING_PARALLEL_REQUESTS=1`, `QDRANT_PARALLEL_BATCHES=1`
- **Servidores medianos (4GB RAM)**: Valores por defecto están bien. Puedes activar paralelismo con `EMBEDDING_PARALLEL_REQUESTS=3`, `QDRANT_PARALLEL_BATCHES=2`
- **Servidores grandes (8GB+ RAM)**: Puedes aumentar `PDF_BATCH_SIZE=200`, `QDRANT_BATCH_SIZE=100`, `PDF_WORKER_THREADS=4`, `EMBEDDING_PARALLEL_REQUESTS=5`, `QDRANT_PARALLEL_BATCHES=3`

**Configuración del Heap de Node.js**:
- El tamaño máximo del heap está configurado a **2048 MB (2 GB)** en `package.json` mediante el flag `--max-old-space-size=2048`
- Esto significa que Node.js puede usar hasta 2 GB de memoria heap antes de mostrar errores de "out of memory"
- Si necesitas aumentar o reducir el heap, modifica `package.json` cambiando el valor `2048` por el deseado (ej: `1024` para 1 GB, `4096` para 4 GB)
- **Nota importante**: Después de cambiar el heap size, debes reiniciar el servidor para que los cambios surtan efecto

### 2. Instalar dependencias de Node.js

```bash
cd /Users/luis/Desktop/vector-database-rag
npm install
```

**Ver MongoDB (Producción):**
docker exec -it mongo-rag mongosh vector-db-rag


### 3. Levantar servicios Docker

#### 3.1 Docker Compose (recomendado)

**Configuración de MongoDB (Desarrollo vs Producción):**

- **DESARROLLO (MongoDB Atlas)**: El contenedor usa `DB_URL` de tu archivo `.env`. Asegúrate de que tu `.env` tenga:
  ```bash
  DB_URL="url_de_tu_base_de_datos"
  ```

- **PRODUCCIÓN (MongoDB del contenedor)**: Para usar el MongoDB del contenedor, edita `docker-compose.yml` y cambia la línea `DB_URL` en el servicio `app` a:
  ```yaml
  DB_URL: mongodb://mongo-rag:27017/vector-db-rag
  ```
  O define `DB_URL` en el `.env` con la URL del MongoDB de producción.

- **Levantar todos los servicios (Mongo, Redis, Qdrant y backend Node) con una sola línea:**
  ```bash
  cd /Users/luis/Desktop/vector-database-rag
  docker compose up -d
  ```

- **Reconstruir el contenedor después de cambios en el código:**
  ```bash
  docker compose down
  docker compose build --no-cache app
  docker compose up -d
  ```

-- **Detener y eliminar contenedores definidos en `docker-compose.yml`:**
  ```bash
  docker compose down
  ```

-- **Verificar estado de todos los contenedores del stack:**
  ```bash
  docker ps | grep -E "qdrant-rag|redis-rag|mongo-rag|vector-rag-app"
  ```

- **Flujo recomendado:**
  - Desarrollo con backend en Docker:
    - `docker compose up -d`
    - Navegar a `http://localhost:3000`
  - Alternativa (backend en host):
    - `docker compose up -d` para infraestructura
    - `npm run dev` para el backend en tu máquina

#### Información sobre los servicios

**Qdrant**:
- Base de datos vectorial para almacenar embeddings
- Puerto: 6333
- Datos persistentes en: `qdrant_data/`

**MongoDB**:
- Base de datos principal para documentos, usuarios, chunks, etc.
- Puerto: 27017
- Si usas otra URL, actualiza `DB_URL` en tu `.env`

**Redis** (opcional):
- Caché para embeddings y respuestas RAG
- Puerto: 6379
- Si no levantas Redis, la aplicación funcionará en modo degradado (sin caché)
- Si usas otra URL, actualiza `REDIS_URL` en tu `.env`

#### Utilidades adicionales

**Remover colección Qdrant (limpiar datos vectoriales):**
```bash
rm -rf qdrant_data/collections/*
```

### 4. Levantar el backend Node.js

#### En modo desarrollo (con recarga automática)
```bash
cd /Users/luis/Desktop/vector-database-rag
npm run dev
```

#### En modo producción
```bash
cd /Users/luis/Desktop/vector-database-rag
npm start
```

El servidor se levanta por defecto en `http://localhost:3000`.

### 5. Flujo de uso del RAG

1. **Gestionar PDFs**:
   - Navega a: `http://localhost:3000/pdfs.html`
   - Sube un PDF, luego pulsa:
     - **"Convertir a chunks"** para procesarlo.
     - **"Enviar a Qdrant"** para generar embeddings e indexar en Qdrant.

2. **Hacer preguntas a los PDFs**:
   - Navega a: `http://localhost:3000/rag.html`
   - Selecciona un PDF con estado `processed`.
   - Escribe tu pregunta y pulsa **"Preguntar al PDF"**.

### 6. Detener los servicios

#### Detener el backend Node.js
- Si lo iniciaste con `npm run dev` o `npm start` en una terminal:
  - Ve a esa terminal y pulsa `Ctrl + C`.

#### Detener todos los servicios Docker
```bash
npm run docker:down && docker stop mongo-rag
```

#### Detener servicios Docker individuales

**Qdrant:**
```bash
docker stop qdrant-rag
```

**MongoDB:**
```bash
docker stop mongo-rag
```

**Redis:**
```bash
docker stop redis-rag
```

#### Eliminar contenedores Docker (si necesitas recrearlos)

**Eliminar todos:**
```bash
docker rm -f mongo-rag redis-rag qdrant-rag
```

**Eliminar individuales:**
```bash
docker rm -f mongo-rag    # MongoDB
docker rm -f redis-rag    # Redis
docker rm -f qdrant-rag   # Qdrant
```

### 7. Dashboard de Métricas

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

---

## Configuración del Servicio de Campañas (Segundo Backend)

### Conectar el servicio `api` (ford-mailer-api) a la red Docker

El servicio de campañas está en un proyecto separado. Para que ambos servicios se comuniquen correctamente dentro de Docker, el servicio `api` debe estar en la misma red Docker.

#### En el docker-compose.yml del servicio de campañas (ford-mailer-api):

Agrega la siguiente configuración:

```yaml
services:
  api:
    # ... tu configuración existente
    container_name: ford-mailer-api
    ports:
      - "3001:3000"  # Host:3001 → Container:3000 (corregir mapeo)
    networks:
      - vector-rag-network  # Conectar a la misma red

networks:
  vector-rag-network:
    external: true
    name: vector-rag-network
```

#### Crear la red Docker (si no existe):

```bash
docker network create vector-rag-network
```

#### Verificar la conexión:

1. Levanta ambos proyectos con `docker-compose up`
2. Desde el contenedor `vector-rag-app`, deberías poder hacer ping al servicio `api`:
   ```bash
   docker exec -it vector-rag-app ping -c 2 api
   ```

#### Variables de entorno:

**En este proyecto (vector-database-rag):**
- No es necesario configurar `CAMPAIGN_SERVICE_URL` en el `.env` si ambos servicios están en la misma red
- El valor por defecto `http://api:3000` funcionará correctamente

**Si necesitas sobrescribir la URL** (por ejemplo, para desarrollo local fuera de Docker):
```bash
# En .env (solo si es necesario)
CAMPAIGN_SERVICE_URL=http://host.docker.internal:3001
```

#### Notas importantes:

- El servicio `api` debe escuchar en el puerto **3000** internamente (dentro del contenedor)
- El mapeo de puertos debe ser `3001:3000` (puerto del host : puerto del contenedor)
- Ambos servicios deben estar en la red `vector-rag-network` para comunicarse por nombre
