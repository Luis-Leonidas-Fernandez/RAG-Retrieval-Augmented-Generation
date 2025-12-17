import { v2 as cloudinary } from "cloudinary";

/**
 * Servicio para subir imágenes a Cloudinary usando CLOUDINARY_URL
 * Ejemplo de CLOUDINARY_URL:
 *   cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 */
export class CloudinaryService {
  constructor() {
    this.isConfigured = false;
    this.config = null;
    this._configureFromEnv();
  }

  /**
   * Lee CLOUDINARY_URL desde el entorno y configura el SDK
   */
  _configureFromEnv() {
    const url = process.env.CLOUDINARY_URL;

    if (!url) {
      console.warn(
        "[CloudinaryService] CLOUDINARY_URL no está definido en el entorno. Subida de imágenes deshabilitada."
      );
      return;
    }

    try {
      // Parsear CLOUDINARY_URL de la forma cloudinary://API_KEY:API_SECRET@CLOUD_NAME
      const parsed = new URL(url);

      const apiKey = decodeURIComponent(parsed.username || "");
      const apiSecret = decodeURIComponent(parsed.password || "");
      const cloudName = parsed.hostname || "";

      if (!apiKey || !apiSecret || !cloudName) {
        throw new Error("CLOUDINARY_URL inválida. Revisar formato.");
      }

      this.config = {
        apiKey,
        apiSecret,
        cloudName,
      };

      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });

      this.isConfigured = true;
      console.log(
        `[CloudinaryService] Configurado correctamente para cloud_name="${cloudName}".`
      );
    } catch (error) {
      console.error(
        "[CloudinaryService] Error al parsear/configurar CLOUDINARY_URL:",
        error
      );
      this.isConfigured = false;
    }
  }

  /**
   * Sube una imagen a Cloudinary desde un buffer
   * @param {Buffer} buffer - Contenido binario de la imagen
   * @param {Object} options - Opciones opcionales
   * @param {string} [options.folder] - Carpeta en Cloudinary (ej: "segments")
   * @param {string} [options.publicId] - ID público opcional
   * @returns {Promise<{ url: string, secure_url: string, public_id: string }>}
   */
  async uploadImageBuffer(buffer, options = {}) {
    if (!this.isConfigured) {
      throw new Error(
        "Cloudinary no está configurado. Revisa CLOUDINARY_URL en tu .env."
      );
    }

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error("Buffer de imagen inválido.");
    }

    const uploadOptions = {
      resource_type: "image",
      folder: options.folder || "segments",
      public_id: options.publicId || undefined,
      overwrite: true,
    };

    // Timeout configurable desde variables de entorno (por defecto 60 segundos)
    const timeout = parseInt(process.env.CLOUDINARY_TIMEOUT || "60000", 10);
    const timeoutSeconds = Math.round(timeout / 1000);

    return new Promise((resolve, reject) => {
      let timeoutId = null;
      let isResolved = false;

      // Función para limpiar timeout y marcar como resuelto
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // Configurar timeout
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          // Destruir el stream si existe
          if (uploadStream && typeof uploadStream.destroy === 'function') {
            uploadStream.destroy();
          }
          const timeoutError = new Error(
            `Timeout: La subida a Cloudinary excedió ${timeoutSeconds} segundos. Intenta con una imagen más pequeña o verifica tu conexión.`
          );
          timeoutError.name = 'CloudinaryTimeoutError';
          timeoutError.timeout = true;
          console.error(`[CloudinaryService] ❌ TIMEOUT después de ${timeoutSeconds}s`);
          reject(timeoutError);
        }
      }, timeout);

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (isResolved) {
            return; // Ya se resolvió (probablemente por timeout)
          }

          cleanup();

          if (error) {
            isResolved = true;
            console.error("[CloudinaryService] Error al subir imagen:", error);
            
            // Detectar errores de timeout de Cloudinary
            if (error.http_code === 499 || error.message?.includes('Timeout') || error.name === 'TimeoutError') {
              const timeoutError = new Error(
                'La subida de imagen tardó demasiado. Intenta con una imagen más pequeña o verifica tu conexión.'
              );
              timeoutError.name = 'CloudinaryTimeoutError';
              timeoutError.timeout = true;
              timeoutError.originalError = error;
              return reject(timeoutError);
            }
            
            return reject(error);
          }

          if (!result || !result.secure_url) {
            isResolved = true;
            return reject(
              new Error(
                "Respuesta de Cloudinary inválida: falta secure_url en el resultado."
              )
            );
          }

          isResolved = true;
          resolve({
            url: result.url,
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      );

      uploadStream.on("error", (err) => {
        if (isResolved) {
          return; // Ya se resolvió
        }
        
        isResolved = true;
        cleanup();
        console.error(
          "[CloudinaryService] Error en el stream de subida de imagen:",
          err
        );
        reject(err);
      });

      uploadStream.end(buffer);
    });
  }
}


