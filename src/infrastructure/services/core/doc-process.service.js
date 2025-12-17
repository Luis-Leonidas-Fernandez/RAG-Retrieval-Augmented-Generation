// Este módulo quedó como stub para métricas legacy.
// El procesamiento real de documentos ahora se realiza en
// `DocProcessService` (src/infrastructure/services/adapters/doc-process-wrapper.service.js).

// Mantener la firma de export para no romper imports existentes:
// - processDocById ya no se usa; si alguien lo invoca, lanzamos un error claro.
// - getDocPool y closeDocPool se usan solo para métricas; devolvemos null/no-op.

export const processDocById = async () => {
  throw new Error(
    "processDocById está deprecado. Usa ProcessDocUseCase + DocProcessService (pdf-parse / excel_loader) en su lugar."
  );
};

/**
 * Obtener el pool de workers (para métricas).
 * Ahora no hay worker pool, así que devolvemos null.
 */
export const getDocPool = () => {
  return null;
};

/**
 * Cerrar el pool de workers de forma ordenada.
 * Al no haber pool, esto es un no-op.
 */
export const closeDocPool = async () => {
  return;
};


