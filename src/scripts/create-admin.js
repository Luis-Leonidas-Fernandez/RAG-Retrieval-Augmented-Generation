import dotenv from "dotenv";
dotenv.config();
import { dbConnection } from "../config/db.js";
import { UserModel } from "../models/user.model.js";

/**
 * Script para crear usuario administrador inicial
 * Uso: node src/scripts/create-admin.js
 */

const createAdmin = async () => {
  try {
    // Conectar a la base de datos
    await dbConnection();

    // Verificar si ya existe un usuario admin (solo verificar existencia y obtener email)
    const existingAdmin = await UserModel.findOne({ role: "admin" })
      .select("email")
      .lean();
    if (existingAdmin) {
      console.log("⚠️  Ya existe un usuario administrador:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log("\n   Para crear otro admin, usa el registro y luego actualiza el rol manualmente.");
      process.exit(0);
    }

    // Obtener datos del usuario desde argumentos o usar valores por defecto
    const email = process.argv[2] || process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.argv[3] || process.env.ADMIN_PASSWORD || "admin123";
    const name = process.argv[4] || process.env.ADMIN_NAME || "Administrador";

    // Validar email
    if (!email || !email.includes("@")) {
      console.error("❌ Error: Debes proporcionar un email válido");
      console.log("\nUso: node src/scripts/create-admin.js [email] [password] [name]");
      console.log("Ejemplo: node src/scripts/create-admin.js admin@example.com mypassword Admin");
      process.exit(1);
    }

    // Validar password
    if (password.length < 6) {
      console.error("❌ Error: La contraseña debe tener al menos 6 caracteres");
      process.exit(1);
    }

    // Crear usuario admin
    const admin = await UserModel.create({
      email: email.toLowerCase(),
      password,
      name,
      role: "admin",
    });

    console.log("✅ Usuario administrador creado exitosamente!");
    console.log(`\n   Email: ${admin.email}`);
    console.log(`   Nombre: ${admin.name}`);
    console.log(`   Rol: ${admin.role}`);
    console.log("\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión.");
    console.log("   Usa el endpoint PUT /api/auth/profile para actualizar tu contraseña.\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error al crear usuario administrador:", error.message);

    if (error.code === 11000) {
      console.error("\n   El email ya está en uso. Usa otro email o elimina el usuario existente.");
    }

    process.exit(1);
  }
};

createAdmin();

