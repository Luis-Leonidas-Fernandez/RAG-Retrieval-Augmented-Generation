import {
  getActiveSessionsByUser,
  deactivateSession,
  deactivateAllUserSessions,
  getLoginHistory,
  hashToken,
} from "../services/session.service.js";
import { createResponse } from "../utils/response.js";

/**
 * Obtener mis sesiones activas
 */
export const getMySessions = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;

    const sessions = await getActiveSessionsByUser(tenantId, userId);

    return res.json(
      createResponse(true, "Sesiones obtenidas correctamente", {
        sessions,
        count: sessions.length,
      })
    );
  } catch (error) {
    console.error("[Session Controller] Error al obtener sesiones:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener sesiones", { error: error.message })
    );
  }
};

/**
 * Cerrar sesión específica
 */
export const closeSession = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { sessionId } = req.params; // tokenId

    if (!sessionId) {
      return res.status(400).json(
        createResponse(false, "sessionId es requerido")
      );
    }

    await deactivateSession(tenantId, userId, sessionId);

    return res.json(
      createResponse(true, "Sesión cerrada correctamente")
    );
  } catch (error) {
    console.error("[Session Controller] Error al cerrar sesión:", error);
    return res.status(500).json(
      createResponse(false, "Error al cerrar sesión", { error: error.message })
    );
  }
};

/**
 * Cerrar todas mis sesiones
 */
export const closeAllSessions = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;

    await deactivateAllUserSessions(tenantId, userId);

    return res.json(
      createResponse(true, "Todas las sesiones cerradas correctamente")
    );
  } catch (error) {
    console.error("[Session Controller] Error al cerrar todas las sesiones:", error);
    return res.status(500).json(
      createResponse(false, "Error al cerrar todas las sesiones", { error: error.message })
    );
  }
};

/**
 * Obtener historial de logins
 */
export const getLoginHistoryController = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const limit = parseInt(req.query.limit || "50", 10);

    const history = await getLoginHistory(tenantId, userId, limit);

    return res.json(
      createResponse(true, "Historial obtenido correctamente", {
        history,
        count: history.length,
      })
    );
  } catch (error) {
    console.error("[Session Controller] Error al obtener historial:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener historial", { error: error.message })
    );
  }
};

