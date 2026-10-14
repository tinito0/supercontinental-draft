import { useState, useEffect, useRef, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { handleListenerError } from '../utils/listenerErrorHandler.js';

/**
 * Normaliza valores de Firestore (Timestamps, Fechas, Objetos) para comparaciones profundas.
 */
export function normalizeValue(val) {
  if (val === null || val === undefined) return null;

  if (typeof val === 'object') {
    // Firestore Timestamp
    if (typeof val.toMillis === 'function') {
      return val.toMillis();
    }
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    // Arrays
    if (Array.isArray(val)) {
      return val.map(normalizeValue);
    }
    // Plain objects (excluding internal Firestore references / metadata)
    const normalized = {};
    for (const [key, value] of Object.entries(val)) {
      if (key === 'id' || key.startsWith('_')) continue;
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  }

  return val;
}

/**
 * Determina si la versión remota de un documento difiere de la versión local conocida.
 * 
 * @param {any} remoteData - Datos del documento remoto en Firestore (o null si no existe)
 * @param {any} lastKnownVersion - Versión o datos locales conocidos
 * @param {boolean} remoteExists - Si el documento remoto existe en Firestore
 * @returns {boolean} true si existe un conflicto/diferencia
 */
export function isDocumentDifferent(remoteData, lastKnownVersion, remoteExists = true) {
  // Caso 1: El documento remoto no existe en Firestore
  if (!remoteExists) {
    if (lastKnownVersion === null || lastKnownVersion === undefined) {
      return false; // Ambos coinciden en que no existe
    }
    if (typeof lastKnownVersion === 'object') {
      // Si el objeto local no tenía bloqueo o estaba vacío
      if ('lockedBy' in lastKnownVersion && !lastKnownVersion.lockedBy) {
        return false;
      }
      if (Object.keys(lastKnownVersion).length === 0) {
        return false;
      }
    }
    return true; // Existía localmente pero fue eliminado remotamente
  }

  // Caso 2: El documento remoto sí existe, pero la versión local era nula o indefinida
  if (lastKnownVersion === null || lastKnownVersion === undefined) {
    if (typeof remoteData === 'object' && remoteData !== null) {
      if ('lockedBy' in remoteData && !remoteData.lockedBy) {
        return false; // No tiene bloqueo activo
      }
    }
    return true; // Se creó un nuevo documento o bloqueo remoto
  }

  // Caso 3: lastKnownVersion es un primitivo (número de versión o estado)
  if (typeof lastKnownVersion === 'number') {
    if (typeof remoteData === 'object' && remoteData !== null && 'version' in remoteData) {
      return Number(remoteData.version) !== lastKnownVersion;
    }
    return remoteData !== lastKnownVersion;
  }

  if (typeof lastKnownVersion === 'string') {
    if (typeof remoteData === 'object' && remoteData !== null) {
      if ('status' in remoteData && typeof remoteData.status === 'string') {
        return remoteData.status !== lastKnownVersion;
      }
      if ('version' in remoteData) {
        return String(remoteData.version) !== lastKnownVersion;
      }
    }
    return remoteData !== lastKnownVersion;
  }

  // Caso 4: Ambos son objetos
  if (typeof lastKnownVersion === 'object' && typeof remoteData === 'object' && remoteData !== null) {
    // 4a. Comparación de bloqueos de jugadores (player_locks)
    if ('lockedBy' in lastKnownVersion || 'lockedBy' in remoteData) {
      const localLockedBy = lastKnownVersion.lockedBy || null;
      const remoteLockedBy = remoteData.lockedBy || null;
      if (localLockedBy !== remoteLockedBy) {
        return true;
      }
    }

    // 4b. Comparación explícita de campo 'version'
    if ('version' in lastKnownVersion && 'version' in remoteData) {
      return lastKnownVersion.version !== remoteData.version;
    }

    // 4c. Comparación de ofertas (status, counterAmount)
    if ('status' in lastKnownVersion && 'status' in remoteData) {
      if (lastKnownVersion.status !== remoteData.status) {
        return true;
      }
      if (remoteData.status === 'countered') {
        const localCounter = Number(lastKnownVersion.counterAmount) || 0;
        const remoteCounter = Number(remoteData.counterAmount) || 0;
        if (localCounter !== remoteCounter) {
          return true;
        }
      }
    }

    // 4d. Comparación de fechas de actualización (updatedAt)
    if ('updatedAt' in lastKnownVersion && 'updatedAt' in remoteData) {
      const localUpdated = normalizeValue(lastKnownVersion.updatedAt);
      const remoteUpdated = normalizeValue(remoteData.updatedAt);
      if (localUpdated !== remoteUpdated) {
        return true;
      }
    }

    // 4e. Comparación general de campos en lastKnownVersion
    for (const key of Object.keys(lastKnownVersion)) {
      if (key === 'id') continue;
      const localVal = normalizeValue(lastKnownVersion[key]);
      const remoteVal = normalizeValue(remoteData[key]);
      if (JSON.stringify(localVal) !== JSON.stringify(remoteVal)) {
        return true;
      }
    }

    // 4f. Detección de nuevos campos sustanciales en remoteData
    for (const key of Object.keys(remoteData)) {
      if (key === 'id' || key.startsWith('_')) continue;
      if (!(key in lastKnownVersion)) {
        if (remoteData[key] !== undefined && remoteData[key] !== null) {
          return true;
        }
      }
    }

    return false;
  }

  return false;
}

/**
 * Resuelve el mensaje descriptivo en español para el conflicto detectado.
 * 
 * @param {any} remoteData - Datos remotos de Firestore
 * @param {any} lastKnownVersion - Versión local conocida
 * @param {boolean} remoteExists - Si el documento existe remotamente
 * @param {string|Function} [customMessage] - Mensaje personalizado opcional
 * @returns {string} Mensaje de conflicto en español
 */
export function resolveConflictMessage(remoteData, lastKnownVersion, remoteExists = true, customMessage = null) {
  if (typeof customMessage === 'function') {
    return customMessage(remoteData, lastKnownVersion, remoteExists);
  }
  if (typeof customMessage === 'string' && customMessage.trim().length > 0) {
    return customMessage;
  }

  // Documento eliminado
  if (!remoteExists) {
    if (lastKnownVersion && typeof lastKnownVersion === 'object' && lastKnownVersion.lockedBy) {
      return 'El bloqueo del jugador ha sido liberado. Actualiza para ver los cambios.';
    }
    return 'El elemento ya no existe o fue eliminado. Actualiza para ver los cambios.';
  }

  // 1. Escenario de Jugadores (player_locks)
  if (remoteData && typeof remoteData === 'object' && ('lockedBy' in remoteData || 'teamName' in remoteData)) {
    if (remoteData.lockedBy) {
      const team = remoteData.teamName ? ` (${remoteData.teamName})` : '';
      return `Este jugador fue fichado por otro manager${team}. Actualiza para ver los cambios.`;
    }
    return 'El estado de fichaje de este jugador ha cambiado. Actualiza para ver los cambios.';
  }

  // 2. Escenario de Ofertas de traspaso (offers)
  if (remoteData && typeof remoteData === 'object' && 'status' in remoteData) {
    const status = remoteData.status;
    if (status === 'accepted') {
      return 'La oferta fue aceptada por la otra parte. Actualiza para ver los cambios.';
    }
    if (status === 'rejected') {
      return 'La oferta fue rechazada por la otra parte. Actualiza para ver los cambios.';
    }
    if (status === 'countered') {
      return 'Has recibido una contraoferta. Actualiza para ver los cambios.';
    }
    if (status === 'withdrawn') {
      return 'La oferta fue retirada por la otra parte. Actualiza para ver los cambios.';
    }
    return 'El estado de la oferta ha cambiado. Actualiza para ver los cambios.';
  }

  // 3. Escenario de Formaciones / Tácticas (formations / lineups)
  if (
    remoteData &&
    typeof remoteData === 'object' &&
    ('formation' in remoteData || 'tactics' in remoteData || 'alignment' in remoteData || 'startingXI' in remoteData)
  ) {
    return 'La alineación fue modificada por otro usuario o en otra sesión. Actualiza para ver los cambios.';
  }

  // Fallback general
  return 'Se han detectado cambios remotos. Actualiza para ver la información más reciente.';
}

/**
 * Genera una firma estable para identificar el estado remoto y permitir descartar notificaciones.
 */
function computeSignature(data, exists = true) {
  if (!exists) return '__DOC_DELETED__';
  try {
    return JSON.stringify(normalizeValue(data));
  } catch {
    return String(Date.now());
  }
}

/**
 * Hook para detectar cambios y conflictos remotos en tiempo real usando Firestore onSnapshot.
 *
 * @param {import('firebase/firestore').DocumentReference|null} docRef - Referencia al documento en Firestore
 * @param {any} lastKnownVersion - Versión o datos locales conocidos
 * @param {Object} [options] - Opciones de configuración
 * @param {string|Function} [options.customMessage] - Mensaje de conflicto personalizado
 * @param {Function} [options.comparator] - Función de comparación personalizada
 * @param {boolean} [options.enabled=true] - Habilitar/deshabilitar el listener
 * @param {Function} [options.onConflict] - Callback ejecutado al detectar un conflicto
 * @returns {{ hasConflict: boolean, conflictMessage: string, dismissConflict: () => void, remoteData: any, resetConflict: () => void }}
 */
export function useRemoteConflict(docRef, lastKnownVersion, options = {}) {
  const {
    customMessage,
    comparator,
    enabled = true,
    onConflict,
  } = options;

  const [hasConflict, setHasConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [remoteData, setRemoteData] = useState(null);

  // Registro de firma descartada por el usuario
  const dismissedSignatureRef = useRef(null);

  // Referencias para callbacks sin reiniciar listeners innecesariamente
  const lastKnownVersionRef = useRef(lastKnownVersion);
  lastKnownVersionRef.current = lastKnownVersion;

  const optionsRef = useRef({ customMessage, comparator, onConflict });
  optionsRef.current = { customMessage, comparator, onConflict };

  // Permite al usuario descartar el banner hasta que ocurra un nuevo cambio remoto
  const dismissConflict = useCallback(() => {
    const exists = remoteData !== null;
    dismissedSignatureRef.current = computeSignature(remoteData, exists);
    setHasConflict(false);
  }, [remoteData]);

  // Permite restablecer el estado (por ejemplo, después de una actualización local exitosa)
  const resetConflict = useCallback(() => {
    dismissedSignatureRef.current = null;
    setHasConflict(false);
    setConflictMessage('');
  }, []);

  // Suscripción en tiempo real a Firestore
  useEffect(() => {
    if (!enabled || !docRef) {
      setHasConflict(false);
      setConflictMessage('');
      setRemoteData(null);
      return;
    }

    let isMounted = true;

    try {
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (!isMounted) return;

          const exists = snapshot.exists();
          const remoteDocData = exists ? snapshot.data() : null;
          setRemoteData(remoteDocData);

          const currentSig = computeSignature(remoteDocData, exists);

          // Si el usuario ya descartó esta firma exacta, no volver a mostrar el banner
          if (dismissedSignatureRef.current === currentSig) {
            return;
          }

          const isDifferent = typeof optionsRef.current.comparator === 'function'
            ? optionsRef.current.comparator(remoteDocData, lastKnownVersionRef.current, snapshot)
            : isDocumentDifferent(remoteDocData, lastKnownVersionRef.current, exists);

          if (isDifferent) {
            const msg = resolveConflictMessage(
              remoteDocData,
              lastKnownVersionRef.current,
              exists,
              optionsRef.current.customMessage
            );
            setHasConflict(true);
            setConflictMessage(msg);
            optionsRef.current.onConflict?.({
              remoteData: remoteDocData,
              lastKnownVersion: lastKnownVersionRef.current,
              exists,
              message: msg,
            });
          } else {
            setHasConflict(false);
            setConflictMessage('');
          }
        },
        (error) => {
          handleListenerError(error, 'Remote Conflict');
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } catch (err) {
      console.error('[useRemoteConflict] Failed to attach snapshot listener:', err);
    }
  }, [docRef, enabled]);

  // Si la versión local cambia (p. ej. el usuario refrescó los datos locales), reevaluar
  useEffect(() => {
    if (!enabled || !docRef) return;

    const exists = remoteData !== null;
    const isDifferent = typeof comparator === 'function'
      ? comparator(remoteData, lastKnownVersion, null)
      : isDocumentDifferent(remoteData, lastKnownVersion, exists);

    if (!isDifferent) {
      setHasConflict(false);
      setConflictMessage('');
      dismissedSignatureRef.current = null;
    } else {
      const currentSig = computeSignature(remoteData, exists);
      if (dismissedSignatureRef.current !== currentSig) {
        const msg = resolveConflictMessage(remoteData, lastKnownVersion, exists, customMessage);
        setHasConflict(true);
        setConflictMessage(msg);
      }
    }
  }, [lastKnownVersion, customMessage, comparator, enabled, docRef, remoteData]);

  return {
    hasConflict,
    conflictMessage,
    dismissConflict,
    remoteData,
    resetConflict,
  };
}

export default useRemoteConflict;
