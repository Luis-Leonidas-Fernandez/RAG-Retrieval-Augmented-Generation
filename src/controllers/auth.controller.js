import { UserModel } from "../models/user.model.js";
import { TenantModel } from "../models/tenant.model.js";
import { createResponse } from "../utils/response.js";
import { createActiveSession } from "../services/session.service.js";

/**
 * Registrar nuevo usuario
 */
export const register = async (req, res) => {
  try {
    const { email, password, name, tenantSlug } = req.body;
    
    // Obtener tenant (por slug o usar default)
    let tenant;
    if (tenantSlug) {
      tenant = await TenantModel.findOne({ slug: tenantSlug.toLowerCase() });
      if (!tenant) {
        return res.status(400).json(
          createResponse(false, "Tenant no encontrado")
        );
      }
    } else {
      // Buscar tenant default o crear uno si no existe
      tenant = await TenantModel.findOne({ slug: "default" });
      if (!tenant) {
        // Crear tenant default si no existe
        tenant = await TenantModel.create({
          name: "Default Tenant",
          slug: "default",
        });
      }
    }

    // Verificar si el usuario ya existe en este tenant
    const existingUser = await UserModel.exists({
      tenantId: tenant._id,
      email: email.toLowerCase(),
    });
    if (existingUser) {
      return res.status(400).json(
        createResponse(false, "El email ya está registrado en este tenant")
      );
    }

    // Crear nuevo usuario con tenantId
    const user = await UserModel.create({
      tenantId: tenant._id,
      email: email.toLowerCase(),
      password,
      name,
      emailVerified: false,
    });

    // Generar token de verificación
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Enviar email de verificación (async, no bloquea)
    const { sendVerificationEmail } = await import("../services/email.service.js");
    sendVerificationEmail(user.email, user.name, verificationToken)
      .then((result) => {
        console.log("[REGISTER] ✅ Email enviado exitosamente:", result);
      })
      .catch((err) => {
        console.error("[REGISTER] ❌ Error al enviar email de verificación:");
        console.error("[REGISTER] Error completo:", err);
        console.error("[REGISTER] Mensaje:", err.message);
        if (err.stack) {
          console.error("[REGISTER] Stack:", err.stack);
        }
        // Verificar variables de entorno
        console.error("[REGISTER] RESEND_API_KEY existe:", !!process.env.RESEND_API_KEY);
        console.error("[REGISTER] RESEND_FROM:", process.env.RESEND_FROM || "NO CONFIGURADA");
        console.error("[REGISTER] RESEND_FROM_EMAIL:", process.env.RESEND_FROM_EMAIL || "NO CONFIGURADA");
      });

    // NO generar JWT hasta que el email esté verificado
    // Respuesta sin password y sin tokens de verificación
    const userResponse = user.toJSON();
    return res.status(201).json(
      createResponse(true, "Registro exitoso. Revisa tu correo para verificar tu email.", {
        requiresVerification: true,
        user: userResponse,
      })
    );
  } catch (error) {
    console.error("[REGISTER] Error al registrar usuario:", error);

    // Errores de validación de Mongoose
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json(
        createResponse(false, "Error de validación", { errors })
      );
    }

    // Error de duplicado
    if (error.code === 11000) {
      return res.status(400).json(
        createResponse(false, "El email ya está registrado")
      );
    }

    // Error de conexión a base de datos
    if (error.name === "MongoServerError" || error.name === "MongoError") {
      return res.status(500).json(
        createResponse(false, "Error de conexión con la base de datos")
      );
    }

    return res.status(500).json(
      createResponse(false, "Error interno del servidor al registrar usuario")
    );
  }
};

/**
 * Iniciar sesión
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        createResponse(false, "Email y contraseña son requeridos")
      );
    }

    // Buscar usuario y incluir password (select: false por defecto)
    // Nota: En un sistema multi-tenant real, el email debería ser único por tenant
    // Por ahora buscamos por email (asumiendo que el tenant viene del contexto o es único)
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+password tenantId");

    if (!user) {
      return res.status(401).json(
        createResponse(false, "Credenciales inválidas")
      );
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json(
        createResponse(false, "Credenciales inválidas")
      );
    }

    // Verificar que el email esté verificado
    if (!user.emailVerified) {
      return res.status(403).json(
        createResponse(false, "Por favor verifica tu email antes de iniciar sesión", {
          requiresVerification: true,
          email: user.email,
        })
      );
    }

    // Generar token JWT
    const token = user.generateAuthToken();

    // Crear sesión activa en Redis
    const session = await createActiveSession(
      user.tenantId.toString(),
      user._id.toString(),
      token,
      req
    );

    // Respuesta sin password
    const userResponse = user.toJSON();

    return res.json(
      createResponse(true, "Inicio de sesión exitoso", {
        token,
        user: userResponse,
        sessionId: session?.tokenId, // ID de sesión para referencia
      })
    );
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return res.status(500).json(
      createResponse(false, "Error interno del servidor al iniciar sesión")
    );
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
export const getProfile = async (req, res) => {
  try {
    // El usuario ya está en req.user gracias al middleware authenticateToken
    const userId = req.user.id;

    // Obtener usuario con solo campos necesarios para el perfil
    const user = await UserModel.findById(userId)
      .select('email name role createdAt')
      .lean();
    if (!user) {
      return res.status(404).json(
        createResponse(false, "Usuario no encontrado")
      );
    }

    return res.json(
      createResponse(true, "Perfil obtenido correctamente", {
        user: user,
      })
    );
  } catch (error) {
    console.error("Error al obtener perfil:", error);
    return res.status(500).json(
      createResponse(false, "Error interno del servidor al obtener perfil")
    );
  }
};

/**
 * Actualizar perfil del usuario autenticado
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    // Campos permitidos para actualizar
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();

    // Verificar si el email ya está en uso por otro usuario (solo verificar existencia)
    if (email) {
      const existingUser = await UserModel.exists({
        email: email.toLowerCase(),
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json(
          createResponse(false, "El email ya está en uso por otro usuario")
        );
      }
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json(
        createResponse(false, "Usuario no encontrado")
      );
    }

    return res.json(
      createResponse(true, "Perfil actualizado correctamente", {
        user: user.toJSON(),
      })
    );
  } catch (error) {
    console.error("Error al actualizar perfil:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json(
        createResponse(false, "Error de validación", { errors })
      );
    }

    return res.status(500).json(
      createResponse(false, "Error interno del servidor al actualizar perfil")
    );
  }
};

/**
 * Verificar email del usuario
 */
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json(
        createResponse(false, "Token de verificación requerido")
      );
    }

    // Buscar usuario con el token de verificación usando método estático
    const user = await UserModel.verifyEmailToken(token);

    if (!user) {
      return res.status(400).json(
        createResponse(false, "Token de verificación inválido o expirado")
      );
    }

    // Marcar email como verificado y limpiar token
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Generar token JWT ahora que el email está verificado
    const authToken = user.generateAuthToken();

    // Crear sesión activa
    createActiveSession(user.tenantId.toString(), user._id.toString(), authToken, req).catch((err) => {
      console.error("[VERIFY] Error al crear sesión activa:", err);
    });

    const userResponse = user.toJSON();

    return res.json(
      createResponse(true, "Email verificado correctamente", {
        token: authToken,
        user: userResponse,
      })
    );
  } catch (error) {
    console.error("[VERIFY] Error al verificar email:", error);
    return res.status(500).json(
      createResponse(false, "Error interno del servidor al verificar email")
    );
  }
};

/**
 * Reenviar email de verificación
 */
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(
        createResponse(false, "Email requerido")
      );
    }

    // Buscar usuario
    const user = await UserModel.findOne({ email: email.toLowerCase() })
      .select("+verificationToken +verificationTokenExpires");

    if (!user) {
      // Por seguridad, no revelar si el email existe o no
      return res.json(
        createResponse(true, "Si el email existe y no está verificado, se enviará un nuevo email de verificación")
      );
    }

    // Si ya está verificado, no hacer nada
    if (user.emailVerified) {
      return res.json(
        createResponse(true, "El email ya está verificado")
      );
    }

    // Generar nuevo token de verificación
    const verificationToken = user.generateVerificationToken();
    await user.save();

    // Enviar email
    const { resendVerificationEmail } = await import("../services/email.service.js");
    await resendVerificationEmail(user.email, user.name, verificationToken);

    return res.json(
      createResponse(true, "Email de verificación reenviado correctamente")
    );
  } catch (error) {
    console.error("[RESEND] Error al reenviar email:", error);
    return res.status(500).json(
      createResponse(false, "Error interno del servidor al reenviar email")
    );
  }
};

