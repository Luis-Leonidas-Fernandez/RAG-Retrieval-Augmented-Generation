/**
 * Función helper para crear respuestas consistentes
 */
export const createResponse = (ok, message, data = null) => {
  const response = {
    ok,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
};

