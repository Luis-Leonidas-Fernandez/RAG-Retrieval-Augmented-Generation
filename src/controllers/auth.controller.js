import { UserModel } from "../models/user.model.js";
import { createResponse } from "../utils/response.js";

/**
 * Registrar nuevo usuario
 */
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // Verificar si el usuario ya existe (solo verificar existencia, no cargar datos completos)
    const existingUser = await UserModel.exists({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json(
        createResponse(false, "El email ya está registrado")
      );
    }

    // Crear nuevo usuario
    const user = await UserModel.create({
      email: email.toLowerCase(),
      password,
      name,
    });

    // Generar token JWT
    const token = user.generateAuthToken();

    // Respuesta sin password
    const userResponse = user.toJSON();
    return res.status(201).json(
      createResponse(true, "Usuario registrado correctamente", {
        token,
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
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+password");

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

    // Generar token JWT
    const token = user.generateAuthToken();

    // Respuesta sin password
    const userResponse = user.toJSON();

    return res.json(
      createResponse(true, "Inicio de sesión exitoso", {
        token,
        user: userResponse,
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

