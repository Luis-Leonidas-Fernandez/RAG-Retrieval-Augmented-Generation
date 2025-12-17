/**
 * Utilidades de autenticación
 * Maneja tokens JWT, verificación de sesión y peticiones autenticadas
 */

// Claves para localStorage
const TOKEN_KEY = 'rag_auth_token';
const USER_KEY = 'rag_user_data';

/**
 * Obtener token guardado
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Obtener datos del usuario
 */
export function getUser() {
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
}

/**
 * Guardar token y datos del usuario
 */
export function setToken(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Eliminar token y datos del usuario
 */
export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Verificar si hay token válido
 */
export function isAuthenticated() {
  const token = getToken();
  return !!token;
}

/**
 * Verificar autenticación y redirigir si no hay token
 */
export function checkAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Verificar validez del token llamando al endpoint de perfil
 */
export async function verifyToken() {
  const token = getToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.data && data.data.user) {
        // Actualizar datos del usuario
        setToken(token, data.data.user);
        return true;
      }
    }

    // Si no es válido, limpiar
    removeToken();
    return false;
  } catch (error) {
    console.error('Error verificando token:', error);
    removeToken();
    return false;
  }
}

/**
 * Cerrar sesión y redirigir a login
 */
export function logout() {
  removeToken();
  window.location.href = '/login.html';
}

/**
 * Wrapper de fetch que agrega token automáticamente
 * Maneja errores 401 (token expirado/inválido)
 */
export async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si token expirado o inválido, limpiar sesión y redirigir
    if (response.status === 401) {
      removeToken();
      
      // Solo redirigir si no estamos ya en login
      if (!window.location.pathname.includes('login.html')) {
        alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        window.location.href = '/login.html';
      }
      
      throw new Error('Sesión expirada o token inválido');
    }

    return response;
  } catch (error) {
    // Si es error de red y no es 401, relanzar
    if (error.message !== 'Sesión expirada o token inválido') {
      throw error;
    }
    throw error;
  }
}

/**
 * Iniciar sesión
 */
export async function login(email, password, tenantSlug = "default") {
  try {
    console.log('[AUTH.JS] 🔐 Iniciando proceso de login');
    console.log('[AUTH.JS] Email:', email);
    console.log('[AUTH.JS] TenantSlug recibido:', tenantSlug || '(vacío)');
    
    // Normalizar tenantSlug a lowercase
    const normalizedTenantSlug = tenantSlug ? tenantSlug.toLowerCase().trim() : "default";
    console.log('[AUTH.JS] TenantSlug normalizado:', normalizedTenantSlug);

    const requestBody = { 
      email, 
      password,
      tenantSlug: normalizedTenantSlug 
    };
    console.log('[AUTH.JS] Request body (sin password):', { 
      email, 
      tenantSlug: normalizedTenantSlug,
      password: '***' 
    });

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[AUTH.JS] Response status:', response.status);
    console.log('[AUTH.JS] Response ok:', response.ok);

    const data = await response.json();
    console.log('[AUTH.JS] Response data:', data);

    if (response.ok && data.ok && data.data) {
      console.log('[AUTH.JS] ✅ Login exitoso');
      console.log('[AUTH.JS] Usuario:', data.data.user?.email);
      console.log('[AUTH.JS] TenantId del usuario:', data.data.user?.tenantId);
      setToken(data.data.token, data.data.user);
      return { 
        success: true, 
        user: data.data.user,
        requiresVerification: data.data?.requiresVerification || false,
        email: data.data?.email || email
      };
    } else {
      console.error('[AUTH.JS] ❌ Login fallido');
      console.error('[AUTH.JS] Error message:', data.message);
      console.error('[AUTH.JS] Error completo:', data);
      return { 
        success: false, 
        error: data.message || 'Error al iniciar sesión',
        requiresVerification: data.data?.requiresVerification || false,
        email: data.data?.email || email
      };
    }
  } catch (error) {
    console.error('[AUTH.JS] ❌ Error de conexión en login:', error);
    console.error('[AUTH.JS] Error stack:', error.stack);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

/**
 * Registrar nuevo usuario
 */
export async function register(name, email, password, businessName) {
  const requestBody = { name, email, password };

  if (businessName && businessName.trim()) {
    requestBody.businessName = businessName.trim();
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (response.ok && data.ok && data.data) {
      // Si requiere verificación, NO guardar token
      if (data.data.requiresVerification === true) {
        return { 
          success: true, 
          requiresVerification: true,
          user: data.data.user 
        };
      }
      
      // Si no requiere verificación (compatibilidad con clientes viejos), guardar token
      if (data.data.token) {
        setToken(data.data.token, data.data.user);
      }
      return { success: true, user: data.data.user };
    } else {
      return { success: false, error: data.message || 'Error al registrar usuario' };
    }
  } catch (error) {
    console.error('[AUTH.JS] Error en registro:', error);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

/**
 * Verificar email del usuario
 */
export async function verifyEmail(token) {
  try {
    const response = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (response.ok && data.ok && data.data) {
      // Guardar token y usuario después de verificación exitosa
      setToken(data.data.token, data.data.user);
      return { success: true, user: data.data.user };
    } else {
      return { success: false, error: data.message || 'Error al verificar email' };
    }
  } catch (error) {
    console.error('[AUTH.JS] Error en verificación:', error);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

/**
 * Reenviar email de verificación
 */
export async function resendVerification(email) {
  try {
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      return { success: true, message: data.message };
    } else {
      return { success: false, error: data.message || 'Error al reenviar email' };
    }
  } catch (error) {
    console.error('[AUTH.JS] Error al reenviar verificación:', error);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

/**
 * Solicitar reset de contraseña
 */
export async function requestPasswordReset(email, tenantSlug = "default") {
  try {
    // Normalizar tenantSlug a lowercase
    const normalizedTenantSlug = tenantSlug ? tenantSlug.toLowerCase().trim() : "default";

    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        email,
        tenantSlug: normalizedTenantSlug 
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      return { success: true, message: data.message };
    } else {
      return { success: false, error: data.message || 'Error al solicitar reset de contraseña' };
    }
  } catch (error) {
    console.error('[AUTH.JS] Error al solicitar reset de contraseña:', error);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

/**
 * Resetear contraseña usando token
 */
export async function resetPassword(token, newPassword, confirmPassword) {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      return { success: true, message: data.message };
    } else {
      return { success: false, error: data.message || 'Error al restablecer contraseña' };
    }
  } catch (error) {
    console.error('[AUTH.JS] Error al restablecer contraseña:', error);
    return { success: false, error: 'Error de conexión. Por favor intenta nuevamente.' };
  }
}

