/**
 * Caso de uso para cerrar todas las sesiones del usuario
 * Orquesta la lógica de negocio del proceso de cerrar todas las sesiones
 */
export class CloseAllSessionsUseCase {
  constructor(sessionRepository) {
    this.sessionRepository = sessionRepository;
  }

  /**
   * Ejecuta el caso de uso de cerrar todas las sesiones
   * @param {Object} request - Objeto con tenantId, userId y options
   * @param {string|ObjectId} request.tenantId - ID del tenant
   * @param {string|ObjectId} request.userId - ID del usuario
   * @param {Object} request.options - Opciones (excludeCurrentSession: boolean)
   * @returns {Promise<Object>} Objeto con closedCount (número de sesiones cerradas)
   */
  async execute({ tenantId, userId, options = {} }) {
    // Obtener sesiones activas antes de cerrarlas para contar
    const sessions = await this.sessionRepository.findActiveSessions(
      tenantId,
      userId
    );

    const initialCount = sessions.length;

    // Cerrar todas las sesiones
    // Nota: El servicio actual cierra todas, no hay opción para excluir la actual
    // Si en el futuro se necesita, se puede agregar la lógica aquí
    await this.sessionRepository.closeAllSessions(tenantId, userId, options);

    // El servicio no retorna el count exacto, así que usamos el count inicial
    // En el futuro se puede mejorar el repositorio para retornar el count exacto
    return {
      closedCount: initialCount,
    };
  }
}

