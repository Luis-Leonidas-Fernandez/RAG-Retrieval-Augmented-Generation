import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "El email es requerido"],
      unique: true,
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
  },
  {
    timestamps: true,
  }
);

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
  return userObject;
};

export const UserModel = mongoose.model("User", UserSchema);

