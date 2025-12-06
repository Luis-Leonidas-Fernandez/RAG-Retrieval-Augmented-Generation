# URLs del Proyecto - Vector Database RAG

Este documento contiene todas las URLs/endpoints disponibles en el proyecto.

**Base URL:** `http://localhost:3000` (o el puerto configurado en `PORT`)

---

## 📋 Índice

- [Páginas Estáticas](#páginas-estáticas)
- [API - Health Check](#api---health-check)
- [API - Autenticación](#api---autenticación)
- [API - PDFs](#api---pdfs)
- [API - Chunks](#api---chunks)
- [API - RAG](#api---rag)
- [API - Conversaciones](#api---conversaciones)
- [API - Métricas](#api---métricas)
- [API - Sesiones](#api---sesiones)
- [API - Privacidad](#api---privacidad)
- [API - Admin Privacidad](#api---admin-privacidad)

---

## Páginas Estáticas

| Método | URL | Descripción |
|--------|-----|-------------|
| GET | `/` | Redirige a `/login.html` |
| GET | `/login.html` | Página de login |
| GET | `/request-password-reset.html` | Página para solicitar reset de contraseña |
| GET | `/reset-password.html` | Página para resetear contraseña |
| GET | `/pdfs.html` | Página de gestión de PDFs |
| GET | `/rag.html` | Página de consultas RAG |
| GET | `/metrics.html` | Página de métricas |

---

## API - Health Check

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/health` | ❌ No | Verificar estado del servidor |

---

## API - Autenticación

Todas las rutas de autenticación tienen rate limiting estricto (5 req/min por IP).

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| POST | `/api/auth/register` | ❌ No | Registrar nuevo usuario |
| POST | `/api/auth/login` | ❌ No | Iniciar sesión |
| GET | `/api/auth/profile` | ✅ Sí | Obtener perfil del usuario autenticado |
| PUT | `/api/auth/profile` | ✅ Sí | Actualizar perfil del usuario |
| POST | `/api/auth/verify-email` | ❌ No | Verificar email con token |
| POST | `/api/auth/resend-verification` | ✅ Sí | Reenviar email de verificación |
| POST | `/api/auth/request-password-reset` | ❌ No | Solicitar reset de contraseña |
| POST | `/api/auth/reset-password` | ❌ No | Resetear contraseña con token |

---

## API - PDFs

Todas las rutas requieren autenticación y tienen rate limiting por usuario y tenant.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| POST | `/api/pdf/upload` | ✅ Sí | Subir un PDF |
| GET | `/api/pdf` | ✅ Sí | Listar todos los PDFs del usuario |
| POST | `/api/pdf/process/:id` | ✅ Sí | Procesar un PDF (extraer texto) |
| POST | `/api/pdf/embed/:id` | ✅ Sí | Generar embeddings y guardar en Qdrant |

**Parámetros:**
- `:id` - ID del PDF (MongoDB ObjectId)

---

## API - Chunks

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/chunks/:pdfId` | ✅ Sí | Listar chunks de un PDF específico |

**Parámetros:**
- `:pdfId` - ID del PDF (MongoDB ObjectId)

---

## API - RAG

Todas las rutas requieren autenticación y tienen rate limiting por usuario y tenant.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| POST | `/api/rag/query` | ✅ Sí | Realizar consulta RAG sobre un PDF |

**Body (POST /api/rag/query):**
```json
{
  "pdfId": "string (ObjectId)",
  "question": "string (3-1000 caracteres)",
  "conversationId": "string (ObjectId, opcional)"
}
```

---

## API - Conversaciones

Todas las rutas requieren autenticación.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/conversations` | ✅ Sí | Listar todas las conversaciones del usuario |
| GET | `/api/conversations/active/:pdfId` | ✅ Sí | Obtener conversación activa de un PDF |
| GET | `/api/conversations/:conversationId` | ✅ Sí | Obtener conversación específica |
| GET | `/api/conversations/:conversationId/context` | ✅ Sí | Obtener contexto de una conversación |
| GET | `/api/conversations/:conversationId/tokens` | ✅ Sí | Obtener estadísticas de tokens de una conversación |
| DELETE | `/api/conversations/:conversationId` | ✅ Sí | Cerrar una conversación |

**Parámetros:**
- `:pdfId` - ID del PDF (MongoDB ObjectId)
- `:conversationId` - ID de la conversación (MongoDB ObjectId)

---

## API - Métricas

Todas las rutas requieren autenticación.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/metrics/current` | ✅ Sí | Obtener métricas actuales del sistema |
| GET | `/api/metrics/history` | ✅ Sí | Obtener métricas históricas |
| GET | `/api/metrics/aggregated` | ✅ Sí | Obtener métricas agregadas |
| GET | `/api/metrics/export` | ✅ Sí | Exportar datos de métricas |

---

## API - Sesiones

Todas las rutas requieren autenticación.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/sessions` | ✅ Sí | Listar mis sesiones activas |
| GET | `/api/sessions/history` | ✅ Sí | Obtener historial de logins |
| DELETE | `/api/sessions/:sessionId` | ✅ Sí | Cerrar una sesión específica |
| DELETE | `/api/sessions` | ✅ Sí | Cerrar todas mis sesiones |

**Parámetros:**
- `:sessionId` - ID de la sesión

---

## API - Privacidad

Todas las rutas requieren autenticación. Permiten gestionar los datos propios del usuario (GDPR).

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| GET | `/api/privacy/data` | ✅ Sí | Obtener resumen de mis datos (GDPR) |
| DELETE | `/api/privacy/data` | ✅ Sí | Borrar todos mis datos (GDPR) |
| DELETE | `/api/privacy/conversation/:conversationId` | ✅ Sí | Borrar una conversación específica |
| PUT | `/api/privacy/history` | ✅ Sí | Activar/desactivar historial de conversaciones |

**Parámetros:**
- `:conversationId` - ID de la conversación (MongoDB ObjectId)

---

## API - Admin Privacidad

Todas las rutas requieren autenticación y rol de administrador.

| Método | URL | Autenticación | Descripción |
|--------|-----|---------------|-------------|
| DELETE | `/api/admin/privacy/user/:userId` | ✅ Sí (Admin) | Borrar datos de un usuario (admin) |
| GET | `/api/admin/privacy/user/:userId/export` | ✅ Sí (Admin) | Exportar datos de un usuario (GDPR) |

**Parámetros:**
- `:userId` - ID del usuario (MongoDB ObjectId)

---

## 🔐 Autenticación

Para las rutas que requieren autenticación, incluir el token JWT en el header:

```
Authorization: Bearer <token>
```

El token se obtiene mediante el endpoint `/api/auth/login`.

---

## ⚡ Rate Limiting

- **Global:** 200 req/min por IP (todas las rutas `/api/*`)
- **Auth:** 5 req/min por IP (rutas de autenticación)
- **Upload:** Límites por usuario y tenant (subida de PDFs)
- **Process:** Límites por usuario y tenant (procesamiento de PDFs)
- **RAG:** Límites por usuario y tenant (consultas RAG)
- **General:** Límites por usuario (otras rutas protegidas)

---

## 📝 Notas

- Todas las rutas de la API están bajo el prefijo `/api`
- Los IDs deben ser MongoDB ObjectIds válidos
- Las respuestas siguen el formato:
  ```json
  {
    "ok": true/false,
    "message": "string",
    "data": {} // opcional
  }
  ```
- El servidor escucha en el puerto definido en la variable de entorno `PORT` (por defecto: 3000)

---

## 🔗 Referencias

- Ver `src/infrastructure/http/routes/` para la definición completa de rutas
- Ver `src/app.js` para la configuración de Express y middlewares
- Ver `src/server.js` para la configuración del servidor

