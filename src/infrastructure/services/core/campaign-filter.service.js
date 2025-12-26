import { CampaignSentModel } from "../../db/models/campaign-sent.model.js";

/**
 * Servicio para filtrar clientes elegibles para recibir campañas
 * y registrar envíos de campañas
 */
export class CampaignFilterService {
  /**
   * Filtra clientes que pueden recibir campañas de email
   * Límite: máximo 1 campaña por semana
   * @param {string} tenantId - ID del tenant
   * @param {Array} clientes - Array de objetos con { email, name, vehicle, phone }
   * @param {number} limit - Límite máximo de clientes a retornar (default: 200)
   * @returns {Promise<Array>} Array de clientes elegibles
   */
  async filterEligibleForEmail(tenantId, clientes, limit = 200) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener emails que ya recibieron campaña de email esta semana
    const sentThisWeek = await CampaignSentModel.find({
      tenantId: tenantId,
      channel: "EMAIL",
      sentAt: { $gte: oneWeekAgo },
    }).select("email");

    const excludedEmails = new Set(
      sentThisWeek.map((item) => item.email.toLowerCase())
    );

    // Filtrar clientes que no están en la lista de excluidos
    const eligible = clientes
      .filter((cliente) => {
        const email = (cliente.email || "").toLowerCase().trim();
        return email && !excludedEmails.has(email);
      })
      .slice(0, limit);

    console.log(
      `[CampaignFilterService] Email: ${clientes.length} total, ${excludedEmails.size} excluidos, ${eligible.length} elegibles`
    );

    return eligible;
  }

  /**
   * Filtra clientes que pueden recibir campañas de WhatsApp
   * Límite: máximo 1 campaña por semana
   * @param {string} tenantId - ID del tenant
   * @param {Array} clientes - Array de objetos con { email, name, vehicle, phone }
   * @param {number} limit - Límite máximo de clientes a retornar (default: 200)
   * @returns {Promise<Array>} Array de clientes elegibles
   */
  async filterEligibleForWhatsApp(tenantId, clientes, limit = 200) {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Obtener emails que ya recibieron campaña de WhatsApp esta semana
    const sentThisWeek = await CampaignSentModel.find({
      tenantId: tenantId,
      channel: "WHATSAPP",
      sentAt: { $gte: oneWeekAgo },
    }).select("email");

    const excludedEmails = new Set(
      sentThisWeek.map((item) => item.email.toLowerCase())
    );

    // Filtrar clientes que no están en la lista de excluidos
    const eligible = clientes
      .filter((cliente) => {
        const email = (cliente.email || "").toLowerCase().trim();
        return email && !excludedEmails.has(email);
      })
      .slice(0, limit);

    console.log(
      `[CampaignFilterService] WhatsApp: ${clientes.length} total, ${excludedEmails.size} excluidos, ${eligible.length} elegibles`
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

