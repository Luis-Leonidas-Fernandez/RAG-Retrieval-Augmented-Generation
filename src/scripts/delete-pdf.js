import dotenv from "dotenv";
dotenv.config();
import { dbConnection, closeDbConnection } from "../config/db.js";
import { PdfModel } from "../models/pdf.model.js";
import { ChunkModel } from "../models/chunk.model.js";
import { hardDeletePdf } from "../services/pdf-lifecycle.service.js";
import { deletePdfFile } from "../services/pdf.service.js";
import { countPointsInQdrant } from "../services/qdrant.service.js";
import { StructuredLogger } from "../utils/structured-logger.js";
import mongoose from "mongoose";
import readline from "readline";
import fs from "fs/promises";

/**
 * Script para eliminar completamente un PDF y todos sus datos relacionados
 * 
 * Elimina:
 * - PDF de MongoDB
 * - Chunks de MongoDB
 * - Vectores de Qdrant
 * - Archivo físico del servidor
 * - Caché RAG relacionado
 * 
 * Uso: node src/scripts/delete-pdf.js <pdfId> [tenantId] [userId] [--dry-run] [--force]
 * 
 * Ejemplos:
 *   node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011
 *   node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011 --dry-run
 *   node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011 --force
 *   node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011 507f1f77bcf86cd799439012 507f1f77bcf86cd799439013 --dry-run
 */

/**
 * Parsear argumentos de la línea de comandos
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  };
  
  // Filtrar flags y obtener argumentos posicionales
  const positional = args.filter(arg => !arg.startsWith('--'));
  
  return {
    pdfId: positional[0],
    tenantId: positional[1],
    userId: positional[2],
    ...flags,
  };
}

/**
 * Obtener información previa a la eliminación
 */
async function getDeletionInfo(pdf, tenantId) {
  const pdfId = pdf._id;
  
  const [chunkCount, vectorCount, fileExists] = await Promise.all([
    ChunkModel.countDocuments({ tenantId, pdfId }),
    countPointsInQdrant(tenantId, pdfId),
    pdf.path
      ? fs.access(pdf.path).then(() => true).catch(() => false)
      : Promise.resolve(false),
  ]);
  
  return { chunkCount, vectorCount, fileExists };
}

/**
 * Confirmación interactiva
 */
function askConfirmation(pdfInfo, deletionInfo, tenantId) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    console.log('\n⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE.');
    console.log('\nVas a eliminar definitivamente:');
    console.log(`  - PDF: ${pdfInfo.originalName}`);
    console.log(`  - PDF ID: ${pdfInfo._id}`);
    console.log(`  - Tenant ID: ${tenantId}`);
    console.log(`  - Chunks en MongoDB: ${deletionInfo.chunkCount}`);
    console.log(`  - Vectores en Qdrant: ${deletionInfo.vectorCount ?? 'N/A'}`);
    console.log(`  - Archivo físico: ${pdfInfo.path || 'N/A'}`);
    
    rl.question('\n¿Estás seguro? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

const deletePdfCompletely = async () => {
  try {
    // Parsear argumentos
    const { pdfId, tenantId, userId, dryRun, force } = parseArgs();

    // Validar que se proporcionó al menos el pdfId
    if (!pdfId) {
      console.error("❌ Error: Debes proporcionar al menos el ID del PDF");
      console.log("\nUso: node src/scripts/delete-pdf.js <pdfId> [tenantId] [userId] [--dry-run] [--force]");
      console.log("\nEjemplos:");
      console.log("  node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011");
      console.log("  node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011 --dry-run");
      console.log("  node src/scripts/delete-pdf.js 507f1f77bcf86cd799439011 --force");
      process.exit(1);
    }

    // Validar formato de ObjectId
    if (!mongoose.Types.ObjectId.isValid(pdfId)) {
      console.error(`❌ Error: El ID del PDF no es válido: ${pdfId}`);
      process.exit(1);
    }

    // Conectar a la base de datos
    console.log("📡 Conectando a MongoDB...");
    await dbConnection();
    console.log("✅ Conectado a MongoDB\n");

    // Buscar el PDF para obtener tenantId y userId si no se proporcionaron
    let finalTenantId = tenantId;
    let finalUserId = userId;

    const pdf = await PdfModel.findById(pdfId).lean();
    
    if (!pdf) {
      console.error(`❌ Error: PDF no encontrado con ID: ${pdfId}`);
      console.log("\n💡 Sugerencia: Verifica que el ID sea correcto.");
      console.log("   Puedes listar todos los PDFs con:");
      console.log("   node src/scripts/list-pdfs.js");
      await closeDbConnection();
      process.exit(1);
    }

    // Si no se proporcionó tenantId, usar el del PDF
    if (!finalTenantId) {
      finalTenantId = pdf.tenantId?.toString();
      if (!finalTenantId) {
        console.error("❌ Error: El PDF no tiene tenantId asignado y no se proporcionó uno");
        await closeDbConnection();
        process.exit(1);
      }
      console.log(`ℹ️  Usando tenantId del PDF: ${finalTenantId}`);
    } else {
      // Validar que el tenantId proporcionado coincida con el del PDF
      if (pdf.tenantId?.toString() !== finalTenantId) {
        console.error(`❌ Error: El tenantId proporcionado (${finalTenantId}) no coincide con el del PDF (${pdf.tenantId?.toString()})`);
        await closeDbConnection();
        process.exit(1);
      }
    }

    // Si no se proporcionó userId, usar el del PDF
    if (!finalUserId) {
      finalUserId = pdf.userId?.toString();
      if (!finalUserId) {
        console.error("❌ Error: El PDF no tiene userId asignado y no se proporcionó uno");
        await closeDbConnection();
        process.exit(1);
      }
      console.log(`ℹ️  Usando userId del PDF: ${finalUserId}`);
    }

    // Obtener información previa a la eliminación
    const deletionInfo = await getDeletionInfo(pdf, finalTenantId);

    // Modo dry-run
    if (dryRun) {
      console.log('\n🔍 MODO DRY-RUN (Simulación - No se eliminará nada)\n');
      console.log('📄 PDF que se eliminaría:');
      console.log(`   Nombre: ${pdf.originalName}`);
      console.log(`   ID: ${pdf._id}`);
      console.log(`   Tamaño: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Tenant ID: ${finalTenantId}`);
      console.log(`   User ID: ${finalUserId}`);
      console.log('\n📊 Datos a eliminar:');
      console.log(`   Chunks en MongoDB: ${deletionInfo.chunkCount}`);
      console.log(
        `   Vectores en Qdrant: ${
          deletionInfo.vectorCount === null ? 'Error al contar' : deletionInfo.vectorCount
        }`
      );
      console.log(
        `   Archivo físico: ${pdf.path || 'N/A'} ${
          deletionInfo.fileExists ? '(existe)' : '(no existe)'
        }`
      );
      await closeDbConnection();
      process.exit(0);
    }

    // Confirmación interactiva (si no es --force)
    if (!force) {
      const confirmed = await askConfirmation(pdf, deletionInfo, finalTenantId);
      if (!confirmed) {
        console.log('\n❌ Eliminación cancelada por el usuario.');
        await closeDbConnection();
        process.exit(0);
      }
    }

    // Mostrar información del PDF a eliminar
    console.log("\n📄 Información del PDF a eliminar:");
    console.log(`   ID: ${pdf._id}`);
    console.log(`   Nombre: ${pdf.originalName}`);
    console.log(`   Tamaño: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Tenant ID: ${finalTenantId}`);
    console.log(`   User ID: ${finalUserId}`);
    console.log(`   Archivo: ${pdf.path || 'N/A'}`);

    // Realizar hard delete
    console.log("\n🗑️  Iniciando eliminación...");
    await hardDeletePdf(finalTenantId, pdfId, finalUserId);
    console.log("✅ PDF eliminado de MongoDB");
    console.log("✅ Chunks eliminados de MongoDB");
    console.log("✅ Vectores eliminados de Qdrant");
    console.log("✅ Caché RAG invalidada");

    // Eliminar archivo físico si existe
    if (pdf.path) {
      try {
        const deleted = await deletePdfFile(pdf.path);
        if (deleted) {
          console.log("✅ Archivo físico eliminado del servidor");
        } else {
          console.log("⚠️  Archivo físico no encontrado o ya eliminado");
        }
      } catch (fileError) {
        console.error("⚠️  Error al eliminar archivo físico:", fileError.message);
        console.log("   El archivo puede necesitar eliminación manual:", pdf.path);
      }
    } else {
      console.log("⚠️  No se encontró ruta del archivo físico");
    }

    // Logging estructurado después de eliminar exitosamente
    StructuredLogger.logPdfDeletion(pdfId, finalTenantId, finalUserId, {
      pdfName: pdf.originalName,
      pdfSize: pdf.size,
      chunksDeleted: deletionInfo.chunkCount,
      vectorsDeleted: deletionInfo.vectorCount,
      fileDeleted: deletionInfo.fileExists,
    });

    console.log("\n✅ Eliminación completa exitosa!");
    console.log(`   PDF ${pdfId} y todos sus datos relacionados han sido eliminados.\n`);

    // Cerrar conexión
    await closeDbConnection();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error al eliminar PDF:", error.message);
    
    if (error.message.includes("no encontrado") || error.message.includes("no pertenece")) {
      console.error("\n💡 Verifica que:");
      console.error("   - El ID del PDF sea correcto");
      console.error("   - El tenantId coincida con el del PDF");
      console.error("   - El PDF no haya sido eliminado previamente");
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

// Ejecutar script
deletePdfCompletely();
