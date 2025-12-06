/**
 * Interface para repositorio de usuarios
 * Define el contrato que deben cumplir las implementaciones
 */
export class IUserRepository {
  /**
   * Busca un usuario por email y tenantId
   * @param {string} email - Email del usuario
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByEmailAndTenant(email, tenantId) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un usuario por ID
   * @param {string} id - ID del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(id) {
    throw new Error("Method not implemented");
  }

  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>} Usuario creado
   */
  async create(userData) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza un usuario existente
   * @param {string} id - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async update(id, userData) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un usuario por token de verificación de email válido (no expirado)
   * @param {string} token - Token de verificación
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByVerificationToken(token) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un usuario por token de reset de contraseña válido (no expirado)
   * @param {string} token - Token de reset
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByResetToken(token) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza la contraseña de un usuario
   * @param {string} id - ID del usuario
   * @param {string} password - Nueva contraseña en texto plano
   * @returns {Promise<User>} Usuario actualizado
   */
  async updatePassword(id, password) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un usuario por ID y tenantId
   * @param {string|ObjectId} userId - ID del usuario
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {Object} options - Opciones adicionales (select: string)
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByIdAndTenant(userId, tenantId, options = {}) {
    throw new Error("Method not implemented");
  }

  /**
   * Verifica si existe un usuario con el email dado en el tenant, excluyendo un usuario específico
   * @param {string} email - Email a verificar
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} excludeUserId - ID del usuario a excluir de la búsqueda
   * @returns {Promise<boolean>} true si el email existe, false en caso contrario
   */
  async existsByEmailInTenant(email, tenantId, excludeUserId) {
    throw new Error("Method not implemented");
  }

  /**
   * Actualiza un usuario por ID y tenantId (multi-tenant seguro)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} userData - Datos a actualizar
   * @returns {Promise<User|null>} Usuario actualizado o null si no existe
   */
  async updateByTenant(tenantId, userId, userData) {
    throw new Error("Method not implemented");
  }

  /**
   * Busca un usuario por ID y tenantId (alias para findByIdAndTenant)
   * @param {string|ObjectId} tenantId - ID del tenant
   * @param {string|ObjectId} userId - ID del usuario
   * @param {Object} options - Opciones adicionales (select: string)
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(tenantId, userId, options = {}) {
    throw new Error("Method not implemented");
  }
}

