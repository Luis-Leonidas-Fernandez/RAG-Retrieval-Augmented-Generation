import { Agent } from "undici";

const campaignAgent = new Agent({
  headersTimeout: 30000,
  bodyTimeout: 30000,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 30_000,
});

/**
 * Adaptador HTTP para el servicio de campañas
 * Hace llamadas al segundo backend de campañas
 */
export class CampaignServiceWrapper {
  constructor() {
    this.serviceUrl = process.env.CAMPAIGN_SERVICE_URL || "http://api:3000";
    this.timeout = parseInt(process.env.CAMPAIGN_SERVICE_TIMEOUT || "30000", 10); // 30 segundos por defecto
    
    console.log(`[CampaignServiceWrapper] Inicializado - URL: ${this.serviceUrl}, Timeout: ${this.timeout}ms`);
  }

  /**
   * Crea una campaña desde un segmento RAG e inicia el envío
   * @param {string} jwtToken - JWT del usuario actual
   * @param {Object} payload - { segmentId, nombreCampaña?, canales?, plantillaEmail? }
   * @returns {Promise<{ ok: boolean, message: string, data: { campaignId, segmentId, estado } }>}
   */
  async createCampaignFromRag(jwtToken, payload) {
    const startTime = Date.now();
    const endpoint = `${this.serviceUrl}/api/campaigns/from-rag`;
    
    console.log(`[CampaignServiceWrapper] 🚀 Iniciando creación de campaña desde segmento RAG`);
    console.log(`[CampaignServiceWrapper] 📍 Endpoint: ${endpoint}`);
    console.log(`[CampaignServiceWrapper] ⏱️ Timeout configurado: ${this.timeout}ms`);
    console.log(`[CampaignServiceWrapper] 📦 Payload resumen:`, {
      segmentId: payload.segmentId,
      nombreCampaña: payload.nombreCampaña,
      canales: payload.canales,
      hasPlantillaEmail: !!payload.plantillaEmail,
      hasJwtToken: !!payload.jwtToken,
      payloadSize: JSON.stringify(payload).length,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        const elapsed = Date.now() - startTime;
        console.error(`[CampaignServiceWrapper] ❌ TIMEOUT después de ${elapsed}ms (límite: ${this.timeout}ms)`);
      }, this.timeout);

      console.log(`[CampaignServiceWrapper] 📡 Enviando request HTTP POST a ${endpoint}...`);
      
      // Verificar y mostrar que el JWT está en el payload
      if (payload.jwtToken) {
        console.log(`[CampaignServiceWrapper] 🔑 JWT incluido en el payload:`, {
          presente: true,
          longitud: payload.jwtToken.length,
          preview: `${payload.jwtToken.substring(0, 20)}...${payload.jwtToken.substring(payload.jwtToken.length - 10)}`,
          partes: payload.jwtToken.split('.').length, // JWT tiene 3 partes separadas por puntos
        });
      } else {
        console.error(`[CampaignServiceWrapper] ⚠️ ADVERTENCIA: jwtToken NO está presente en el payload`);
      }
      
      // También mostrar el JWT del header
      console.log(`[CampaignServiceWrapper] 🔐 JWT en header Authorization:`, {
        presente: !!jwtToken,
        longitud: jwtToken?.length || 0,
        preview: jwtToken ? `${jwtToken.substring(0, 20)}...${jwtToken.substring(jwtToken.length - 10)}` : 'N/A',
      });
      
      const requestBody = JSON.stringify(payload);
      console.log(`[CampaignServiceWrapper] 📏 Tamaño del body: ${requestBody.length} bytes`);
      
      // Verificar que el jwtToken está en el JSON serializado
      const bodyIncludesJwt = requestBody.includes('jwtToken');
      console.log(`[CampaignServiceWrapper] ✅ Verificación: jwtToken ${bodyIncludesJwt ? 'SÍ' : 'NO'} está incluido en el body serializado`);

      // 📧 LOGS ANTES DE LLAMAR AL MAILER
      console.log(`[CampaignServiceWrapper] 📧 ====== LLAMANDO A MAILER PARA CREAR CAMPAÑA ======`);
      console.log(`[CampaignServiceWrapper] 📧 Payload recibido (antes de serializar):`, payload);
      console.log(`[CampaignServiceWrapper] 📧 Payload.jwtToken existe?:`, !!payload.jwtToken);
      console.log(`[CampaignServiceWrapper] 📧 Payload.jwtToken valor:`, payload.jwtToken);
      console.log(`[CampaignServiceWrapper] 📧 Payload serializado (requestBody):`, requestBody);
      console.log(`[CampaignServiceWrapper] 📧 JWT en header Authorization:`, jwtToken);
      console.log(`[CampaignServiceWrapper] 📧 ====== FIN LOGS ANTES DE LLAMAR A MAILER ======`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtToken}`,
        },
        body: requestBody,
        signal: controller.signal,
        dispatcher: campaignAgent,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      
      console.log(`[CampaignServiceWrapper] 📥 Respuesta recibida en ${elapsed}ms`);
      console.log(`[CampaignServiceWrapper] 📊 Status HTTP: ${response.status} ${response.statusText}`);
      console.log(`[CampaignServiceWrapper] 📋 Headers de respuesta:`, {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CampaignServiceWrapper] ❌ Error HTTP ${response.status}:`);
        console.error(`[CampaignServiceWrapper]   - Status: ${response.status} ${response.statusText}`);
        console.error(`[CampaignServiceWrapper]   - Body: ${errorText.substring(0, 500)}${errorText.length > 500 ? '...' : ''}`);
        console.error(`[CampaignServiceWrapper]   - Tiempo transcurrido: ${elapsed}ms`);
        throw new Error(`Error del servicio de campañas (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[CampaignServiceWrapper] ✅ Campaña creada exitosamente:`);
      console.log(`[CampaignServiceWrapper]   - OK: ${data.ok}`);
      console.log(`[CampaignServiceWrapper]   - Mensaje: ${data.message || 'N/A'}`);
      console.log(`[CampaignServiceWrapper]   - CampaignId: ${data.data?.campaignId || 'N/A'}`);
      console.log(`[CampaignServiceWrapper]   - SegmentId: ${data.data?.segmentId || 'N/A'}`);
      console.log(`[CampaignServiceWrapper]   - Estado: ${data.data?.estado || 'N/A'}`);
      console.log(`[CampaignServiceWrapper]   - Tiempo total: ${elapsed}ms`);

      return data;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[CampaignServiceWrapper] ❌ Error después de ${elapsed}ms:`);
      console.error(`[CampaignServiceWrapper]   - Tipo: ${error.name || error.constructor?.name}`);
      console.error(`[CampaignServiceWrapper]   - Mensaje: ${error.message}`);
      console.error(`[CampaignServiceWrapper]   - Endpoint: ${endpoint}`);
      console.error(`[CampaignServiceWrapper]   - Timeout configurado: ${this.timeout}ms`);
      
      if (error.name === 'AbortError') {
        console.error(`[CampaignServiceWrapper]   - Causa: Timeout (AbortError)`);
        throw new Error(`Timeout: El servicio de campañas no respondió en ${this.timeout}ms`);
      }
      
      if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
        console.error(`[CampaignServiceWrapper]   - Causa: Error de conexión (no se pudo conectar al servicio)`);
      }
      
      if (error.stack) {
        console.error(`[CampaignServiceWrapper]   - Stack: ${error.stack.substring(0, 500)}...`);
      }
      
      throw error;
    }
  }
}

