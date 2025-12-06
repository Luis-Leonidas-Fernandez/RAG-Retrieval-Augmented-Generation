import { UserModel } from "../models/user.model.js";
import { User } from "../../../domain/entities/User.js";
import { IUserRepository } from "../../../domain/repositories/IUserRepository.js";

/**
 * Implementación de IUserRepository usando Mongoose
 */
export class UserRepositoryMongo extends IUserRepository {
  /**
   * Busca un usuario por email y tenantId
   * Incluye password y emailVerified en la selección
   */
  async findByEmailAndTenant(email, tenantId) {
    const userDoc = await UserModel.findOne({
      email: email.toLowerCase(),
      tenantId: tenantId,
    }).select("+password +emailVerified");

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Busca un usuario por ID
   */
  async findById(id) {
    const userDoc = await UserModel.findById(id);

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Crea un nuevo usuario
   */
  async create(userData) {
    const userDoc = await UserModel.create(userData);
    return this._toDomainEntity(userDoc);
  }

  /**
   * Actualiza un usuario existente
   * Maneja campos undefined usando $unset para limpiarlos
   * Si se actualiza el password, usa save() para ejecutar el pre-save hook
   */
  async update(id, userData) {
    // Si se está actualizando el password, necesitamos usar save() para que se ejecute el pre-save hook
    if (userData.password !== undefined) {
      const userDoc = await UserModel.findById(id);
      if (!userDoc) {
        return null;
      }

      // Actualizar campos directamente en el documento
      Object.keys(userData).forEach((key) => {
        if (userData[key] === undefined) {
          // Limpiar campo (setear a undefined)
          userDoc[key] = undefined;
        } else {
          userDoc[key] = userData[key];
        }
      });

      // Guardar (esto ejecutará el pre-save hook que hashea la contraseña)
      await userDoc.save();

      return this._toDomainEntity(userDoc);
    }

    // Para otros campos, usar findByIdAndUpdate (más eficiente)
    const setData = {};
    const unsetData = {};

    // Separar campos a setear de campos a limpiar (undefined)
    for (const [key, value] of Object.entries(userData)) {
      if (value === undefined) {
        unsetData[key] = "";
      } else {
        setData[key] = value;
      }
    }

    // Construir operación de actualización
    const updateOperation = {};
    if (Object.keys(setData).length > 0) {
      updateOperation.$set = setData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateOperation.$unset = unsetData;
    }

    const userDoc = await UserModel.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true, runValidators: true }
    );

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Busca un usuario por token de verificación de email válido (no expirado)
   */
  async findByVerificationToken(token) {
    const userDoc = await UserModel.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    }).select("+verificationToken +verificationTokenExpires");

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Busca un usuario por token de reset de contraseña válido (no expirado)
   */
  async findByResetToken(token) {
    const userDoc = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires +password");

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Actualiza la contraseña de un usuario
   * El password se pasa en texto plano, Mongoose lo hashea automáticamente
   * NOTA: Este método usa save() para ejecutar el pre-save hook
   */
  async updatePassword(id, password) {
    const userDoc = await UserModel.findById(id);
    
    if (!userDoc) {
      return null;
    }

    // Modificar password directamente en el documento
    userDoc.password = password;
    
    // Guardar (esto ejecutará el pre-save hook que hashea la contraseña)
    await userDoc.save();

    return this._toDomainEntity(userDoc);
  }

  /**
   * Busca un usuario por ID y tenantId
   */
  async findByIdAndTenant(userId, tenantId, options = {}) {
    const { select = null } = options;

    // Si el select incluye campos sensibles (password, verificationToken), necesitamos la entidad completa
    const needsFullEntity = select && (select.includes('password') || select.includes('verificationToken'));

    let queryBuilder = UserModel.findOne({
      _id: userId,
      tenantId: tenantId,
    });

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    // Si necesitamos la entidad completa, no usar .lean() para poder convertir a entidad
    // Si solo necesitamos campos públicos, usar .lean() para mejor rendimiento
    const userDoc = needsFullEntity 
      ? await queryBuilder
      : await queryBuilder.lean();

    if (!userDoc) {
      return null;
    }

    // Si necesitamos la entidad completa, convertir a entidad de dominio
    if (needsFullEntity) {
      return this._toDomainEntity(userDoc);
    }

    // Para campos públicos, retornar objeto plano directamente
    return userDoc;
  }

  /**
   * Verifica si existe un usuario con el email dado en el tenant, excluyendo un usuario específico
   */
  async existsByEmailInTenant(email, tenantId, excludeUserId) {
    const normalizedEmail = email.toLowerCase().trim();
    
    const exists = await UserModel.exists({
      tenantId: tenantId,
      email: normalizedEmail,
      _id: { $ne: excludeUserId },
    });

    return !!exists;
  }

  /**
   * Actualiza un usuario por ID y tenantId (multi-tenant seguro)
   */
  async updateByTenant(tenantId, userId, userData) {
    const setData = {};
    const unsetData = {};

    // Separar campos a setear de campos a limpiar (undefined)
    for (const [key, value] of Object.entries(userData)) {
      if (value === undefined) {
        unsetData[key] = "";
      } else {
        setData[key] = value;
      }
    }

    // Construir operación de actualización
    const updateOperation = {};
    if (Object.keys(setData).length > 0) {
      updateOperation.$set = setData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateOperation.$unset = unsetData;
    }

    const userDoc = await UserModel.findOneAndUpdate(
      { _id: userId, tenantId },
      updateOperation,
      { new: true, runValidators: true }
    );

    if (!userDoc) {
      return null;
    }

    return this._toDomainEntity(userDoc);
  }

  /**
   * Busca un usuario por ID y tenantId (alias para findByIdAndTenant)
   */
  async findById(tenantId, userId, options = {}) {
    return await this.findByIdAndTenant(userId, tenantId, options);
  }

  /**
   * Convierte un documento Mongoose a entidad de dominio User
   */
  _toDomainEntity(userDoc) {
    return new User({
      id: userDoc._id.toString(),
      tenantId: userDoc.tenantId.toString(),
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role,
      emailVerified: userDoc.emailVerified,
      passwordHash: userDoc.password, // password ya está hasheado por el pre-save hook
    });
  }
}

