/**
 * Logger estructurado para operaciones críticas
 * Formato JSON para fácil parsing y análisis
 */
export class StructuredLogger {
  static log(action, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      ...data,
    };
    
    // Console output (formato JSON)
    console.log(JSON.stringify(logEntry));
    
    // Opcional: escribir a archivo si existe LOG_FILE env var
    // if (process.env.LOG_FILE) { ... }
  }
  
  static logPdfDeletion(pdfId, tenantId, userId, metadata) {
    this.log('HARD_DELETE_PDF', {
      pdfId: pdfId?.toString(),
      tenantId: tenantId?.toString(),
      userId: userId?.toString(),
      deletedByScript: true,
      ...metadata,
    });
  }
}

