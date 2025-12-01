import {
  deleteAllUserData,
  deleteConversationData,
  getUserDataSummary,
} from "../services/privacy.service.js";
import { createResponse } from "../utils/response.js";

/**
 * Borrar datos de un usuario (admin)
 */
export const deleteUserData = async (req, res) => {
  try {
    const { tenantId } = req.user; // Admin debe estar en el mismo tenant
    const { userId } = req.params;
    const hardDelete = req.query.hardDelete === "true";

    if (!userId) {
      return res.status(400).json(
        createResponse(false, "userId es requerido")
      );
    }

    await deleteAllUserData(tenantId, userId, hardDelete);

    return res.json(
      createResponse(true, "Datos del usuario borrados correctamente")
    );
  } catch (error) {
    console.error("[Admin Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al borrar datos del usuario", { error: error.message })
    );
  }
};

/**
 * Exportar datos de un usuario (GDPR - derecho a portabilidad)
 */
export const exportUserData = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json(
        createResponse(false, "userId es requerido")
      );
    }

    const summary = await getUserDataSummary(tenantId, userId);

    return res.json(
      createResponse(true, "Datos exportados correctamente", {
        data: summary,
      })
    );
  } catch (error) {
    console.error("[Admin Privacy Controller] Error:", error);
    return res.status(500).json(
      createResponse(false, "Error al exportar datos", { error: error.message })
    );
  }
};

