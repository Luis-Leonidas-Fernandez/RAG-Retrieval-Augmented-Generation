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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        const elapsed = Date.now() - startTime;
        console.error(`[CampaignServiceWrapper] ❌ TIMEOUT después de ${elapsed}ms (límite: ${this.timeout}ms)`);
      }, this.timeout);

      if (!payload.jwtToken) {
        console.error(`[CampaignServiceWrapper] ⚠️ ADVERTENCIA: jwtToken NO está presente en el payload`);
      }

      const requestBody = JSON.stringify(payload);

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CampaignServiceWrapper] ❌ Error HTTP ${response.status}: ${response.statusText}`);
        console.error(`[CampaignServiceWrapper]   - Body: ${errorText.substring(0, 500)}${errorText.length > 500 ? '...' : ''}`);
        console.error(`[CampaignServiceWrapper]   - Tiempo transcurrido: ${elapsed}ms`);
        throw new Error(`Error del servicio de campañas (${response.status}): ${errorText}`);
      }

      const data = await response.json();
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

