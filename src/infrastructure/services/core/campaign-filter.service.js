import { CampaignSentModel } from "../../db/models/campaign-sent.model.js";

/**
 * Servicio para filtrar clientes elegibles para recibir campañas
 * y registrar envíos de campañas
 */
export class CampaignFilterService {
  /**
   * Filtra clientes que pueden recibir campañas de email
   * Límite: menos de 2 campañas esta semana (0 o 1 campaña)
   * @param {string} tenantId - ID del tenant
   * @param {Array} clientes - Array de objetos con { email, name, vehicle, phone }
   * @param {number} limit - Límite máximo de clientes a retornar (default: 200)
   * @returns {Promise<Array>} Array de clientes elegibles
   */
  async filterEligibleForEmail(tenantId, clientes, limit = 200) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener todos los envíos de email esta semana con campaignId
    const sentThisWeek = await CampaignSentModel.find({
      tenantId: tenantId,
      channel: "EMAIL",
      sentAt: { $gte: oneWeekAgo },
      campaignId: { $ne: null }, // Solo contar campañas con ID válido
    }).select("email campaignId");

    // Contar cuántas campañas únicas (por campaignId) ha recibido cada cliente
    const campaignCountByEmail = new Map();
    
    sentThisWeek.forEach((item) => {
      const email = item.email.toLowerCase();
      if (!campaignCountByEmail.has(email)) {
        campaignCountByEmail.set(email, new Set());
      }
      // Agregar campaignId al set (automáticamente elimina duplicados)
      if (item.campaignId) {
        campaignCountByEmail.get(email).add(item.campaignId);
      }
    });

    // Filtrar clientes que tienen menos de 2 campañas (0 o 1 campaña)
    const eligible = clientes
      .filter((cliente) => {
        const email = (cliente.email || "").toLowerCase().trim();
        if (!email) return false;
        
        const campaignCount = campaignCountByEmail.has(email)
          ? campaignCountByEmail.get(email).size
          : 0;
        
        // Incluir solo clientes con menos de 2 campañas
        return campaignCount < 2;
      })
      .slice(0, limit);

    const excludedCount = clientes.length - eligible.length;
    console.log(
      `[CampaignFilterService] Email: ${clientes.length} total, ${excludedCount} excluidos (2+ campañas), ${eligible.length} elegibles (menos de 2 campañas)`
    );

    return eligible;
  }

  /**
   * Filtra clientes que pueden recibir campañas de WhatsApp
   * Límite: menos de 2 campañas esta semana (0 o 1 campaña)
   * @param {string} tenantId - ID del tenant
   * @param {Array} clientes - Array de objetos con { email, name, vehicle, phone }
   * @param {number} limit - Límite máximo de clientes a retornar (default: 200)
   * @returns {Promise<Array>} Array de clientes elegibles
   */
  async filterEligibleForWhatsApp(tenantId, clientes, limit = 200) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener todos los envíos de WhatsApp esta semana con campaignId
    const sentThisWeek = await CampaignSentModel.find({
      tenantId: tenantId,
      channel: "WHATSAPP",
      sentAt: { $gte: oneWeekAgo },
      campaignId: { $ne: null }, // Solo contar campañas con ID válido
    }).select("email campaignId");

    // Contar cuántas campañas únicas (por campaignId) ha recibido cada cliente
    const campaignCountByEmail = new Map();
    
    sentThisWeek.forEach((item) => {
      const email = item.email.toLowerCase();
      if (!campaignCountByEmail.has(email)) {
        campaignCountByEmail.set(email, new Set());
      }
      // Agregar campaignId al set (automáticamente elimina duplicados)
      if (item.campaignId) {
        campaignCountByEmail.get(email).add(item.campaignId);
      }
    });

    // Filtrar clientes que tienen menos de 2 campañas (0 o 1 campaña)
    const eligible = clientes
      .filter((cliente) => {
        const email = (cliente.email || "").toLowerCase().trim();
        if (!email) return false;
        
        const campaignCount = campaignCountByEmail.has(email)
          ? campaignCountByEmail.get(email).size
          : 0;
        
        // Incluir solo clientes con menos de 2 campañas
        return campaignCount < 2;
      })
      .slice(0, limit);

    const excludedCount = clientes.length - eligible.length;
    console.log(
      `[CampaignFilterService] WhatsApp: ${clientes.length} total, ${excludedCount} excluidos (2+ campañas), ${eligible.length} elegibles (menos de 2 campañas)`
    );

    return eligible;
  }

  /**
   * Registra que se envió una campaña a un cliente
   * @param {string} tenantId - ID del tenant
   * @param {string} email - Email del cliente
   * @param {string} channel - Canal de envío ('EMAIL' o 'WHATSAPP')
   * @param {string|null} campaignId - ID de la campaña (opcional)
   * @returns {Promise<void>}
   */
  async recordCampaignSent(tenantId, email, channel, campaignId = null) {
    await CampaignSentModel.create({
      tenantId,
      email: email.toLowerCase().trim(),
      channel,
      campaignId,
      sentAt: new Date(),
    });
  }

  /**
   * Registra múltiples envíos de campaña (batch)
   * @param {string} tenantId - ID del tenant
   * @param {Array<string>} emails - Array de emails
   * @param {string} channel - Canal de envío ('EMAIL' o 'WHATSAPP')
   * @param {string|null} campaignId - ID de la campaña (opcional)
   * @returns {Promise<void>}
   */
  async recordCampaignsSent(tenantId, emails, channel, campaignId = null) {
    const records = emails
      .map((email) => ({
        tenantId,
        email: email.toLowerCase().trim(),
        channel,
        campaignId,
        sentAt: new Date(),
      }))
      .filter((record) => record.email); // Filtrar emails vacíos

    if (records.length > 0) {
      await CampaignSentModel.insertMany(records);
      console.log(
        `[CampaignFilterService] Registrados ${records.length} envíos de campaña (${channel})`
      );
    }
  }
}

