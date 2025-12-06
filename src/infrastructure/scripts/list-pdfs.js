import dotenv from "dotenv";
dotenv.config();
import { dbConnection, closeDbConnection } from "../config/db.js";
import { DocModel } from "../db/models/doc.model.js";
import mongoose from "mongoose";

/**
 * Script para listar todos los PDFs en la base de datos
 * 
 * Uso: node src/infrastructure/scripts/list-pdfs.js [tenantId]
 * 
 * Ejemplo:
 *   node src/infrastructure/scripts/list-pdfs.js
 *   node src/infrastructure/scripts/list-pdfs.js 507f1f77bcf86cd799439012
 */

const listPdfs = async () => {
  try {
    const tenantId = process.argv[2];

    // Conectar a la base de datos
    console.log("📡 Conectando a MongoDB...");
    await dbConnection();
    console.log("✅ Conectado a MongoDB\n");

    // Construir query
    const query = {};
    if (tenantId) {
      if (!mongoose.Types.ObjectId.isValid(tenantId)) {
        console.error(`❌ Error: El tenantId no es válido: ${tenantId}`);
        await closeDbConnection();
        process.exit(1);
      }
      query.tenantId = tenantId;
      console.log(`🔍 Filtrando por tenantId: ${tenantId}\n`);
    }

    // Buscar PDFs
    const pdfs = await DocModel.find(query)
      .select("_id originalName fileName size status tenantId userId createdAt isDeleted")
      .lean()
      .sort({ createdAt: -1 });

    if (pdfs.length === 0) {
      console.log("📭 No se encontraron PDFs en la base de datos.\n");
      await closeDbConnection();
      process.exit(0);
    }

    // Mostrar resultados
    console.log(`📚 Se encontraron ${pdfs.length} PDF(s):\n`);
    console.log("─".repeat(100));

    pdfs.forEach((pdf, index) => {
      const sizeMB = (pdf.size / 1024 / 1024).toFixed(2);
      const deleted = pdf.isDeleted ? "❌ ELIMINADO" : "✅ Activo";
      const date = pdf.createdAt ? new Date(pdf.createdAt).toLocaleString() : "N/A";

      console.log(`\n${index + 1}. ${pdf.originalName}`);
      console.log(`   ID: ${pdf._id}`);
      console.log(`   Estado: ${deleted}`);
      console.log(`   Tamaño: ${sizeMB} MB`);
      console.log(`   Status: ${pdf.status || "N/A"}`);
      console.log(`   Tenant ID: ${pdf.tenantId}`);
      console.log(`   User ID: ${pdf.userId}`);
      console.log(`   Creado: ${date}`);
      console.log(`   Archivo: ${pdf.fileName || "N/A"}`);
    });

    console.log("\n" + "─".repeat(100));
    console.log("\n💡 Para eliminar un PDF, usa:");
    console.log(`   node src/infrastructure/scripts/delete-pdf.js <pdfId> [tenantId] [userId]\n`);

    // Cerrar conexión
    await closeDbConnection();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error al listar PDFs:", error.message);
    try {
      await closeDbConnection();
    } catch (closeError) {
      // Ignorar errores al cerrar
    }
    process.exit(1);
  }
};

// Ejecutar script
listPdfs();

