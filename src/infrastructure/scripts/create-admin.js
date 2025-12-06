import dotenv from "dotenv";
dotenv.config();
import { dbConnection, closeDbConnection } from "../config/db.js";
import { UserModel } from "../db/models/user.model.js";
import { TenantModel } from "../db/models/tenant.model.js";

/**
 * Script para crear usuario administrador inicial
 * Uso: node src/infrastructure/scripts/create-admin.js [email] [password] [name]
 */
const createAdmin = async () => {
  try {
    // Conectar a la base de datos
    console.log("📡 Conectando a MongoDB...");
    await dbConnection();
    console.log("✅ Conectado a MongoDB\n");

    // Buscar o crear tenant "default"
    let tenant = await TenantModel.findOne({ slug: "default" });
    if (!tenant) {
      console.log("📝 Creando tenant 'default'...");
      tenant = await TenantModel.create({
        name: "Default Tenant",
        slug: "default",
      });
      console.log(`✅ Tenant 'default' creado (ID: ${tenant._id})\n`);
    }

    // Verificar si ya existe un usuario admin en este tenant
    const existingAdmin = await UserModel.findOne({ 
      role: "admin",
      tenantId: tenant._id 
    })
      .select("email")
      .lean();
    
    if (existingAdmin) {
      console.log("⚠️  Ya existe un usuario administrador:");
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
      console.log("\n   Para crear otro admin, usa el registro y luego actualiza el rol manualmente.");
      await closeDbConnection();
      process.exit(0);
    }

    // Obtener datos del usuario desde argumentos o usar valores por defecto
    const email = process.argv[2] || process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.argv[3] || process.env.ADMIN_PASSWORD || "admin123";
    const name = process.argv[4] || process.env.ADMIN_NAME || "Administrador";

    // Validar email
    if (!email || !email.includes("@")) {
      console.error("❌ Error: Debes proporcionar un email válido");
      console.log("\nUso: node src/infrastructure/scripts/create-admin.js [email] [password] [name]");
      console.log("Ejemplo: node src/infrastructure/scripts/create-admin.js admin@example.com mypassword Admin");
      await closeDbConnection();
      process.exit(1);
    }

    // Validar password
    if (password.length < 6) {
      console.error("❌ Error: La contraseña debe tener al menos 6 caracteres");
      await closeDbConnection();
      process.exit(1);
    }

    // Verificar si el email ya existe en este tenant
    const existingUser = await UserModel.findOne({
      email: email.toLowerCase(),
      tenantId: tenant._id,
    }).lean();

    if (existingUser) {
      console.error("❌ Error: El email ya está registrado en este tenant");
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
      await closeDbConnection();
      process.exit(1);
    }

    // Crear usuario admin
    const admin = await UserModel.create({
      tenantId: tenant._id,
      email: email.toLowerCase(),
      password,
      name,
      role: "admin",
      emailVerified: true, // Admin no necesita verificación de email
    });

    console.log("✅ Usuario administrador creado exitosamente!");
    console.log(`\n   Email: ${admin.email}`);
    console.log(`   Nombre: ${admin.name}`);
    console.log(`   Rol: ${admin.role}`);
    console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
    console.log("\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión.");
    console.log("   Usa el endpoint PUT /api/auth/profile para actualizar tu contraseña.\n");

    // Cerrar conexión a la base de datos
    await closeDbConnection();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al crear usuario administrador:", error.message);

    if (error.code === 11000) {
      console.error("\n   El email ya está en uso en este tenant. Usa otro email o elimina el usuario existente.");
    }

    // Intentar cerrar conexión en caso de error
    try {
      await closeDbConnection();
    } catch (closeError) {
      // Ignorar errores al cerrar
    }

    process.exit(1);
  }
};

createAdmin();

