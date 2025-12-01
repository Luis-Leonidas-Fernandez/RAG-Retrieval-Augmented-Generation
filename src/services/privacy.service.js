import { UserModel } from "../models/user.model.js";
import { ConversationModel } from "../models/conversation.model.js";
import { MessageModel } from "../models/message.model.js";
import { LoginHistoryModel } from "../models/login-history.model.js";
import { PdfModel } from "../models/pdf.model.js";
import { ChunkModel } from "../models/chunk.model.js";
import { deactivateAllUserSessions } from "./session.service.js";

const ALLOW_HISTORY_GLOBAL = process.env.ALLOW_HISTORY_GLOBAL !== "false";
const GDPR_STRICT_MODE = process.env.GDPR_STRICT_MODE === "true";

/**
 * Verificar si el historial está permitido para un usuario
 */
export async function checkHistoryAllowed(tenantId, userId) {
  if (!ALLOW_HISTORY_GLOBAL) {
    return false;
  }

  const user = await UserModel.findOne({
    _id: userId,
    tenantId, // CRÍTICO: validar tenant
  })
    .select("allowHistory")
    .lean();

  if (!user) {
    return false;
  }

  return user.allowHistory !== false;
}

/**
 * Anonimizar historial de login (GDPR)
 */
export async function anonymizeLoginHistory(tenantId, userId) {
  await LoginHistoryModel.updateMany(
    { tenantId, userId, anonymized: false },
    {
      $set: {
        anonymized: true,
        anonymizedAt: new Date(),
      },
      $unset: {
        ipAddress: "",
        userAgent: "",
        deviceInfo: "",
      },
    }
  );
}

/**
 * Borrar todos los datos de un usuario (GDPR)
 */
export async function deleteAllUserData(tenantId, userId, hardDelete = false) {
  // Desactivar todas las sesiones
  await deactivateAllUserSessions(tenantId, userId);

  if (hardDelete || GDPR_STRICT_MODE) {
    // Hard-delete: eliminar físicamente
    await MessageModel.deleteMany({ tenantId, userId });
    await ConversationModel.deleteMany({ tenantId, userId });
    
    // Obtener PDFs del usuario para borrar chunks
    const userPdfs = await PdfModel.find({ tenantId, userId }).select('_id').lean();
    const pdfIds = userPdfs.map(p => p._id);
    
    await ChunkModel.deleteMany({ tenantId, pdfId: { $in: pdfIds } });
    await PdfModel.deleteMany({ tenantId, userId });
    await LoginHistoryModel.deleteMany({ tenantId, userId });
  } else {
    // Soft-delete: marcar como borrado
    await MessageModel.updateMany(
      { tenantId, userId },
      { $set: { deletedAt: new Date() } }
    );
    await ConversationModel.updateMany(
      { tenantId, userId },
      { $set: { deletedAt: new Date() } }
    );
    await PdfModel.updateMany(
      { tenantId, userId },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    // Anonimizar historial de login
    await anonymizeLoginHistory(tenantId, userId);
  }

  return { deleted: true, hardDelete };
}

/**
 * Borrar datos de una conversación específica
 */
export async function deleteConversationData(tenantId, conversationId, hardDelete = false) {
  // Validar que conversación pertenece al tenant
  const conversation = await ConversationModel.findOne({
    _id: conversationId,
    tenantId, // CRÍTICO: validar tenant
  });

  if (!conversation) {
    throw new Error("Conversación no encontrada o no pertenece al tenant");
  }

  if (hardDelete || GDPR_STRICT_MODE) {
    // Hard-delete
    await MessageModel.deleteMany({ tenantId, conversationId });
    await ConversationModel.deleteOne({ _id: conversationId, tenantId });
  } else {
    // Soft-delete
    await MessageModel.updateMany(
      { tenantId, conversationId },
      { $set: { deletedAt: new Date() } }
    );
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $set: { deletedAt: new Date() },
    });
  }

  return { deleted: true, hardDelete };
}

/**
 * Obtener resumen de datos del usuario (GDPR - derecho a portabilidad)
 */
export async function getUserDataSummary(tenantId, userId) {
  const user = await UserModel.findOne({
    _id: userId,
    tenantId, // CRÍTICO: validar tenant
  })
    .select("email name role createdAt")
    .lean();

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const conversations = await ConversationModel.find({ tenantId, userId })
    .select("_id pdfId title createdAt lastMessageAt messageCount")
    .lean();

  const pdfs = await PdfModel.find({ tenantId, userId })
    .select("_id originalName createdAt status")
    .lean();

  const loginHistory = await LoginHistoryModel.find({ tenantId, userId })
    .select("loggedInAt loggedOutAt sessionDuration wasActive")
    .limit(100)
    .lean();

  return {
    user,
    conversations: conversations.length,
    pdfs: pdfs.length,
    loginHistory: loginHistory.length,
    data: {
      conversations,
      pdfs,
      loginHistory,
    },
  };
}

