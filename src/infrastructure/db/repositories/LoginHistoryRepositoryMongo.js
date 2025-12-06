import { LoginHistoryModel } from "../models/login-history.model.js";
import { ILoginHistoryRepository } from "../../../domain/repositories/ILoginHistoryRepository.js";

/**
 * Implementación de ILoginHistoryRepository usando Mongoose
 */
export class LoginHistoryRepositoryMongo extends ILoginHistoryRepository {
  /**
   * Busca historial de logins de un usuario
   */
  async findByUser(tenantId, userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      sort = { loggedInAt: -1 }, // Más recientes primero por defecto
      startDate = null,
      endDate = null,
    } = options;

    const query = { tenantId, userId };

    // Filtrar por rango de fechas si se proporciona
    if (startDate || endDate) {
      query.loggedInAt = {};
      if (startDate) {
        query.loggedInAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.loggedInAt.$lte = new Date(endDate);
      }
    }

    return await LoginHistoryModel.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .lean();
  }

  /**
   * Anonimiza el historial de logins de un usuario
   */
  async anonymizeByUser(tenantId, userId) {
    const result = await LoginHistoryModel.updateMany(
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

    return result.modifiedCount;
  }

  /**
   * Elimina permanentemente el historial de logins de un usuario
   */
  async hardDeleteByUser(tenantId, userId) {
    const result = await LoginHistoryModel.deleteMany({ tenantId, userId });
    return result.deletedCount;
  }
}

