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
   * Soporta dos firmas:
   * - findById(id) - busca solo por ID
   * - findById(tenantId, userId, options) - busca por tenantId y userId (multi-tenant seguro)
   */
  async findById(...args) {
    // Si recibe 1 argumento, busca solo por ID
    if (args.length === 1) {
      const [id] = args;
      const userDoc = await UserModel.findById(id);

      if (!userDoc) {
        return null;
      }

      return this._toDomainEntity(userDoc);
    }
    
    // Si recibe 2 o más argumentos, busca por tenantId y userId
    if (args.length >= 2) {
      const [tenantId, userId, options = {}] = args;
      return await this.findByIdAndTenant(userId, tenantId, options);
    }
    
    throw new Error('findById requiere al menos 1 argumento (id) o 2 argumentos (tenantId, userId)');
  }

  /**
   * Crea un nuevo usuario
   */
  async create(userData) {
    console.log('[USER_REPOSITORY] 📝 Creando usuario en MongoDB...');
    console.log('[USER_REPOSITORY] Datos recibidos:', {
      tenantId: userData.tenantId,
      email: userData.email,
      name: userData.name,
      emailVerified: userData.emailVerified,
      hasPassword: !!userData.password,
      hasVerificationToken: !!userData.verificationToken,
      hasVerificationTokenExpires: !!userData.verificationTokenExpires
    });
    console.log('[USER_REPOSITORY] Base de datos:', UserModel.db?.databaseName || 'desconocida');
    console.log('[USER_REPOSITORY] Colección:', UserModel.collection?.name || 'desconocida');

    try {
      const userDoc = await UserModel.create(userData);
      console.log('[USER_REPOSITORY] ✅ Usuario creado en MongoDB:');
      console.log('[USER_REPOSITORY] - _id:', userDoc._id.toString());
      console.log('[USER_REPOSITORY] - email:', userDoc.email);
      console.log('[USER_REPOSITORY] - tenantId:', userDoc.tenantId.toString());
      console.log('[USER_REPOSITORY] - name:', userDoc.name);
      console.log('[USER_REPOSITORY] - emailVerified:', userDoc.emailVerified);
      console.log('[USER_REPOSITORY] - role:', userDoc.role);

      // Verificar que se guardó en MongoDB con retry (para manejar consistencia eventual)
      console.log('[USER_REPOSITORY] 🔍 Verificando que el usuario se guardó en MongoDB...');
      let verifyDoc = null;
      const maxRetries = 3;
      const retryDelays = [50, 100, 200]; // ms
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Usar .lean() para obtener objeto plano y evitar problemas de caché
          verifyDoc = await UserModel.findById(userDoc._id).lean();
          if (verifyDoc) {
            console.log(`[USER_REPOSITORY] ✅ Verificación exitosa (intento ${attempt + 1}/${maxRetries})`);
            console.log('[USER_REPOSITORY] - Verified _id:', verifyDoc._id.toString());
            console.log('[USER_REPOSITORY] - Verified email:', verifyDoc.email);
            console.log('[USER_REPOSITORY] - Verified tenantId:', verifyDoc.tenantId.toString());
            break;
          }
        } catch (verifyError) {
          console.warn(`[USER_REPOSITORY] ⚠️ Error en verificación (intento ${attempt + 1}/${maxRetries}):`, verifyError.message);
        }
        
        // Si no se encontró y no es el último intento, esperar antes de reintentar
        if (!verifyDoc && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      }
      
      if (!verifyDoc) {
        console.warn('[USER_REPOSITORY] ⚠️ Usuario no encontrado en verificación inmediata (puede ser delay de consistencia)');
        console.warn('[USER_REPOSITORY] El usuario fue creado exitosamente, pero la verificación no lo encontró después de varios intentos');
        console.warn('[USER_REPOSITORY] Esto puede ser normal en MongoDB con réplicas. El usuario debería estar disponible en breve.');
        // No lanzar error, el usuario fue creado exitosamente
      }

      return this._toDomainEntity(userDoc);
    } catch (error) {
      console.error('[USER_REPOSITORY] ❌ Error al crear usuario:', error);
      console.error('[USER_REPOSITORY] Error name:', error.name);
      console.error('[USER_REPOSITORY] Error code:', error.code);
      console.error('[USER_REPOSITORY] Error message:', error.message);
      if (error.errors) {
        console.error('[USER_REPOSITORY] Validation errors:', Object.keys(error.errors));
        Object.keys(error.errors).forEach(key => {
          console.error(`[USER_REPOSITORY] - ${key}:`, error.errors[key].message);
        });
      }
      if (error.stack) {
        console.error('[USER_REPOSITORY] Error stack:', error.stack);
      }
      throw error;
    }
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

