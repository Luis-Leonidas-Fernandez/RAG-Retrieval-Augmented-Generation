import {
  checkHistoryAllowed,
  deleteAllUserData,
  deleteConversationData,
  getUserDataSummary,
} from "../services/privacy.service.js";
import { UserModel } from "../models/user.model.js";
import { createResponse } from "../utils/response.js";

/**
 * Borrar mi conversación
 */
export const deleteMyConversation = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { conversationId } = req.params;
    const hardDelete = req.query.hardDelete === "true";

    if (!conversationId) {
      return res.status(400).json(
        createResponse(false, "conversationId es requerido")
      );
    }

    await deleteConversationData(tenantId, conversationId, hardDelete);

    return res.json(
      createResponse(true, "Conversación borrada correctamente")
    );
  } catch (error) {
    console.error("[Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al borrar conversación", { error: error.message })
    );
  }
};

/**
 * Borrar todos mis datos (GDPR)
 */
export const deleteAllMyData = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const hardDelete = req.query.hardDelete === "true";

    await deleteAllUserData(tenantId, userId, hardDelete);

    return res.json(
      createResponse(true, "Todos tus datos han sido borrados correctamente")
    );
  } catch (error) {
    console.error("[Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al borrar datos", { error: error.message })
    );
  }
};

/**
 * Activar/desactivar preferencia de historial
 */
export const toggleHistoryPreference = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { allowHistory } = req.body;

    if (typeof allowHistory !== "boolean") {
      return res.status(400).json(
        createResponse(false, "allowHistory debe ser un booleano")
      );
    }

    const user = await UserModel.findOneAndUpdate(
      { _id: userId, tenantId }, // CRÍTICO: validar tenant
      { $set: { allowHistory } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json(
        createResponse(false, "Usuario no encontrado")
      );
    }

    return res.json(
      createResponse(true, "Preferencia de historial actualizada", {
        allowHistory: user.allowHistory,
      })
    );
  } catch (error) {
    console.error("[Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al actualizar preferencia", { error: error.message })
    );
  }
};

/**
 * Obtener resumen de mis datos (GDPR - derecho a portabilidad)
 */
export const getMyDataSummary = async (req, res) => {
  try {
    const { tenantId, id: userId } = req.user;

    const summary = await getUserDataSummary(tenantId, userId);

    return res.json(
      createResponse(true, "Resumen de datos obtenido correctamente", {
        summary,
      })
    );
  } catch (error) {
    console.error("[Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al obtener resumen", { error: error.message })
    );
  }
};

