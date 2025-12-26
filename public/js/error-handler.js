/**
 * Servicio para manejo de errores HTTP
 * Sigue principios de arquitectura limpia: lógica de negocio pura sin dependencias de DOM
 */
export class ErrorHandler {
  /**
   * Mapeo de códigos HTTP a mensajes descriptivos (sin mostrar códigos al usuario)
   */
  static ERROR_MESSAGES = {
    400: "Error de validación: el archivo no cumple con los requisitos",
    401: "Error de autenticación: por favor inicia sesión nuevamente",
    403: "No tienes permisos para realizar esta acción",
    413: "El archivo es demasiado grande",
    500: "Error del servidor: por favor intenta más tarde",
    502: "Error del servidor: por favor intenta más tarde",
    503: "Servicio temporalmente no disponible: por favor intenta más tarde",
  };

  /**
   * Obtiene mensaje descriptivo según código HTTP
   * @param {number} status - Código HTTP
   * @returns {string} Mensaje descriptivo
   */
  static getErrorMessageByStatus(status) {
    if (status >= 500) {
      return this.ERROR_MESSAGES[500] || "Error del servidor: por favor intenta más tarde";
    }
    return this.ERROR_MESSAGES[status] || "Error al procesar la solicitud";
  }

  /**
   * Parsea respuesta JSON del servidor
   * @param {string} responseText - Texto de respuesta
   * @returns {Object|null} Objeto parseado o null si falla
   */
  static parseResponse(responseText) {
    if (!responseText) return null;
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      return null;
    }
  }

  /**
   * Extrae mensaje de error de la respuesta del servidor
   * @param {Object} errorData - Datos de error parseados
   * @returns {string} Mensaje de error
   */
  static extractErrorMessage(errorData) {
    if (!errorData) return null;
    
    return errorData.message || errorData.error || errorData.msg || null;
  }

  /**
   * Parsea error HTTP y retorna mensaje descriptivo
   * @param {XMLHttpRequest} xhr - Objeto XMLHttpRequest con error
   * @returns {Object} { message: string, status: number }
   */
  static parseError(xhr) {
    const status = xhr.status;
    let errorMessage = null;

    // Intentar parsear respuesta del servidor
    const errorData = this.parseResponse(xhr.responseText);
    
    if (errorData) {
      // Priorizar mensaje del servidor
      errorMessage = this.extractErrorMessage(errorData);
    }

    // Si no hay mensaje del servidor, verificar si responseText es descriptivo
    if (!errorMessage && xhr.responseText) {
      const responseText = xhr.responseText.trim();
      // Si no empieza con número (código HTTP), usar el texto
      if (responseText && !responseText.match(/^\d{3}/)) {
        errorMessage = responseText;
      }
    }

    // Si aún no hay mensaje, usar mensaje según código HTTP
    if (!errorMessage) {
      errorMessage = this.getErrorMessageByStatus(status);
    }

    return {
      message: errorMessage,
      status: status,
    };
  }
}

