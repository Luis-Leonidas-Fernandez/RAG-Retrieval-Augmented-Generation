import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const UserSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "El email es requerido"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Por favor ingresa un email válido",
      ],
    },
    password: {
      type: String,
      required: [true, "La contraseña es requerida"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
      select: false, // No incluir password por defecto en queries
    },
    name: {
      type: String,
      required: [true, "El nombre es requerido"],
      trim: true,
      maxlength: [100, "El nombre no puede exceder 100 caracteres"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    allowHistory: {
      type: Boolean,
      default: true,
    },
    // Campos de verificación de email
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false, // No incluir en queries por defecto
    },
    verificationTokenExpires: {
      type: Date,
      select: false,
    },
    // Campos para reset de contraseña
    resetPasswordToken: {
      type: String,
      select: false, // No incluir en queries por defecto
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Índice único compuesto: email único por tenant
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Hash password antes de guardar
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Método para comparar password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para generar JWT token
UserSchema.methods.generateAuthToken = function () {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    tenantId: this.tenantId.toString(),
  };

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "24h";

  if (!secret) {
    throw new Error("JWT_SECRET no está configurado en las variables de entorno");
  }

  return jwt.sign(payload, secret, { expiresIn });
};

// Método para obtener datos públicos del usuario (sin password)
UserSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpires;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  return userObject;
};

// Método de instancia para generar token de verificación
UserSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  
  this.verificationToken = token;
  const expiryHours = parseInt(process.env.EMAIL_VERIFICATION_EXPIRY?.replace('h', '') || '24', 10);
  this.verificationTokenExpires = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  
  return token;
};

// Método estático para verificar token de email
UserSchema.statics.verifyEmailToken = async function (token) {
  const user = await this.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() },
  }).select("+verificationToken +verificationTokenExpires");
  
  return user;
};

// Método de instancia para generar token de reset de contraseña
UserSchema.methods.generateResetPasswordToken = function () {
  const token = crypto.randomBytes(32).toString("hex"); // 64 caracteres
  
  this.resetPasswordToken = token;
  
  // Parsear PASSWORD_RESET_EXPIRY (formato: "1h", "30m", "900s")
  const expiryStr = process.env.PASSWORD_RESET_EXPIRY || "1h";
  let expiryMs = 3600000; // Default: 1 hora en milisegundos
  
  if (expiryStr.endsWith('h')) {
    const hours = parseInt(expiryStr.replace('h', ''), 10);
    expiryMs = hours * 60 * 60 * 1000;
  } else if (expiryStr.endsWith('m')) {
    const minutes = parseInt(expiryStr.replace('m', ''), 10);
    expiryMs = minutes * 60 * 1000;
  } else if (expiryStr.endsWith('s')) {
    const seconds = parseInt(expiryStr.replace('s', ''), 10);
    expiryMs = seconds * 1000;
  }
  
  this.resetPasswordExpires = new Date(Date.now() + expiryMs);
  
  return token;
};

// Método estático para buscar usuario por token de reset válido
UserSchema.statics.findByResetToken = async function (token) {
  const user = await this.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+resetPasswordToken +resetPasswordExpires +password");
  
  return user;
};

export const UserModel = mongoose.model("User", UserSchema);

