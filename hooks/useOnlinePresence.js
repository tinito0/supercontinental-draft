import { useState, useEffect, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';

export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const TEN_MINUTES_MS = 10 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // Refrescar heartbeat cada 2 minutos

/**
 * Extrae milisegundos desde cualquier formato de timestamp compatible
 * (Firestore Timestamp, Date, milisegundos numéricos, string ISO).
 */
export function getTimestampMillis(val) {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Determina si un documento de presencia se considera activo.
 * Activo si:
 * - online !== false Y (online === true O lastSeen está dentro de los últimos 5 minutos).
 */
export function isPresenceActive(data, now = Date.now()) {
  if (!data || typeof data !== 'object') return false;
  if (data.online === false) return false;

  const lastSeenMs = getTimestampMillis(data.lastSeen);
  const isRecent = lastSeenMs > 0 && (now - lastSeenMs) <= FIVE_MINUTES_MS;
  const isOnline = data.online === true;

  return isOnline || isRecent;
}

/**
 * Determina si un documento de presencia está obsoleto (más de 10 min) y debe eliminarse.
 */
export function isPresenceStale(data, now = Date.now()) {
  if (!data || typeof data !== 'object') return false;
  const lastSeenMs = getTimestampMillis(data.lastSeen);
  return lastSeenMs > 0 && (now - lastSeenMs) > TEN_MINUTES_MS;
}

/**
 * Hook de presencia online para managers utilizando Firestore.
 *
 * @param {Object|string} options - { userId, teamName, appId, db } o userId directamente
 * @param {string} [legacyTeamName] - teamName si se invoca como (userId, teamName)
 * @returns {{ onlineCount: number, isConnected: boolean }}
 */
export function useOnlinePresence(options, legacyTeamName) {
  let userId = null;
  let teamName = 'Manager';
  let appId = APP_ID;
  let firestoreDb = db;

  if (typeof options === 'object' && options !== null) {
    userId = options.userId || null;
    teamName = options.teamName || 'Manager';
    if (options.appId) appId = options.appId;
    if (options.db) firestoreDb = options.db;
  } else if (typeof options === 'string') {
    userId = options;
    if (legacyTeamName) teamName = legacyTeamName;
  }

  const [onlineCount, setOnlineCount] = useState(userId ? 1 : 0);
  const [isConnected, setIsConnected] = useState(false);
  const isCleaningRef = useRef(new Set());

  // 1. Gestionar documento de presencia propio (montaje, heartbeat, desmontaje, beforeunload)
  useEffect(() => {
    if (!userId || !firestoreDb) return;

    const presenceDocRef = doc(firestoreDb, `artifacts/${appId}/presence`, String(userId));

    // Al montar / heartbeat: escribir doc con lastSeen, teamName y online: true
    const markOnline = () => {
      setDoc(
        presenceDocRef,
        {
          lastSeen: serverTimestamp(),
          teamName: teamName || 'Manager',
          online: true,
        },
        { merge: true }
      ).catch((err) => {
        console.warn('[useOnlinePresence] Error actualizando presencia online:', err);
      });
    };

    markOnline();

    // Heartbeat periódico para mantener lastSeen actualizado
    const heartbeatTimer = setInterval(markOnline, HEARTBEAT_INTERVAL_MS);

    // Al desmontar o cerrar pestaña (beforeunload/pagehide): actualizar online: false
    const markOffline = () => {
      try {
        setDoc(
          presenceDocRef,
          {
            online: false,
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      } catch (e) {
        // Ignorar excepciones al cerrar navegador
      }
    };

    const handleBeforeUnload = () => {
      markOffline();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      markOffline();
    };
  }, [userId, teamName, appId, firestoreDb]);

  // 2. Listener en tiempo real sobre la colección de presencia
  useEffect(() => {
    if (!firestoreDb) return;

    const presenceColRef = collection(firestoreDb, `artifacts/${appId}/presence`);

    const unsubscribe = onSnapshot(
      presenceColRef,
      (snapshot) => {
        setIsConnected(true);
        const now = Date.now();
        let count = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();

          // Limpieza de documentos obsoletos (> 10 min) en cada lectura
          if (isPresenceStale(data, now)) {
            if (!isCleaningRef.current.has(docSnap.id)) {
              isCleaningRef.current.add(docSnap.id);
              deleteDoc(docSnap.ref)
                .catch((err) => {
                  console.warn('[useOnlinePresence] Error eliminando doc obsoleto:', err);
                })
                .finally(() => {
                  isCleaningRef.current.delete(docSnap.id);
                });
            }
            return;
          }

          // Contar documentos activos (online === true O lastSeen en últimos 5 min)
          if (isPresenceActive(data, now)) {
            count++;
          }
        });

        // Asegurar mínimo 1 si el usuario local está autenticado
        setOnlineCount(userId ? Math.max(1, count) : count);
      },
      (error) => {
        console.warn('[useOnlinePresence] Error en listener de presencia:', error);
        setIsConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [appId, firestoreDb, userId]);

  return { onlineCount, isConnected };
}

export default useOnlinePresence;
