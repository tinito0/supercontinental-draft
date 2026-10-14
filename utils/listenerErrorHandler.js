/**
 * Utilidades para manejo robusto de errores en listeners de Firestore (onSnapshot).
 * Permite advertir al usuario sobre fallos de conexión o errores del servidor sin duplicar alertas
 * ni mostrar avisos en desconexiones esperadas (offline).
 */

const DEFAULT_ERROR_MESSAGE = 'Error de conexión con el servidor. Algunos datos pueden no estar actualizados.';
const DEFAULT_COOLDOWN_MS = 4000;

let globalLastErrorToastTime = 0;

/**
 * Determina si el error corresponde a una desconexión esperada o controlada (p. ej. navegador offline).
 * 
 * @param {any} error - Error emitido por el listener
 * @returns {boolean} true si la desconexión es esperada y no debe alertar al usuario
 */
export function isExpectedDisconnection(error) {
  // Si el navegador ya detectó explícitamente que está offline, el banner de red global se encarga
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
    return true;
  }

  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();

  // Cancelaciones normales o estado cliente offline esperado
  if (code === 'cancelled' || message.includes('client is offline')) {
    return true;
  }

  return false;
}

/**
 * Maneja errores de listeners de Firestore diferenciando permisos denegados,
 * desconexiones esperadas y errores remotos que requieren notificación al usuario.
 *
 * @param {any} error - Error capturado en el callback de error de onSnapshot
 * @param {string} context - Contexto legible (ej. "Tournament Data", "Offers", "Manager Chat")
 * @param {((type: string, message: string) => void)|null} [showNotification] - Función para mostrar alerta (ej. showStatusMessage)
 * @param {Object} [options] - Opciones adicionales
 * @param {string} [options.message] - Mensaje personalizado para el usuario
 * @param {() => void} [options.onPermissionDenied] - Handler específico para permission-denied
 * @param {boolean} [options.bypassCooldown=false] - Omitir el tiempo de espera entre toasts
 * @param {number} [options.cooldownMs=4000] - Tiempo de enfriamiento para evitar spam de alertas
 */
export function handleListenerError(error, context, showNotification = null, options = {}) {
  const {
    message = DEFAULT_ERROR_MESSAGE,
    onPermissionDenied,
    bypassCooldown = false,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  } = options;

  // 1. Manejo de Permiso Denegado
  if (error?.code === 'permission-denied') {
    console.warn(`[${context}] Permiso denegado:`, error);
    if (typeof onPermissionDenied === 'function') {
      onPermissionDenied(error);
    }
    return;
  }

  // 2. Desconexiones esperadas (modo offline nativo o listener cancelado)
  if (isExpectedDisconnection(error)) {
    return;
  }

  // 3. Errores no controlados (unavailable, deadline-exceeded, internal, network-request-failed, etc.)
  console.error(`[${context}] Error de listener:`, error);

  if (typeof showNotification === 'function') {
    const now = Date.now();
    if (bypassCooldown || now - globalLastErrorToastTime >= cooldownMs) {
      globalLastErrorToastTime = now;
      showNotification('error', message);
    }
  }
}

/**
 * Resetea el temporizador de enfriamiento global (útil para tests).
 */
export function _resetErrorToastCooldown() {
  globalLastErrorToastTime = 0;
}
