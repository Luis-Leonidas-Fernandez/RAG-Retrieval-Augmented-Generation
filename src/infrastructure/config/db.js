import mongoose from "mongoose";


/**
 * Establece la conexión con la base de datos.
 * Utiliza la URL definida en la variable de entorno `DB_URL` o, en su defecto, conecta a MongoDB en localhost (puerto 27017).
 */
export const dbConnection = async () => {
  try {
    mongoose.set("strictQuery", true);
    
    // Configurar límites del pool para reducir memoria y conexiones simultáneas
    const options = {
      maxPoolSize: 5, // Máximo 5 conexiones simultáneas (default: 100)
      minPoolSize: 1, // Mínimo 1 conexión activa
      socketTimeoutMS: 45000, // Timeout de socket de 45 segundos
      serverSelectionTimeoutMS: 5000, // Timeout de selección de servidor de 5 segundos
      heartbeatFrequencyMS: 10000, // Heartbeat cada 10 segundos para verificar conexión
      maxIdleTimeMS: 30000, // Cerrar conexiones inactivas después de 30 segundos
    };
    
    await mongoose.connect(
      process.env.DB_URL || "mongodb://localhost:27017/vector-db-rag",
      options
    );
    console.log("Base de datos conectada correctamente.");
  } catch (error) {
    console.log("Error al conectar la base de datos: ", error);
    throw error; // Re-lanzar error para que pueda ser manejado por el llamador
  }
};

/**
 * Cerrar conexión a MongoDB
 */
export const closeDbConnection = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("[MongoDB] Conexión cerrada correctamente");
    }
  } catch (error) {
    console.error("[MongoDB] Error al cerrar conexión:", error.message);
  }
};

