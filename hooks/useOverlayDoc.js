import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { retryDelay as overlayRetryDelay } from '../utils/retryDelay.js';

export const OVERLAY_DOC_PATH = `artifacts/${APP_ID}/public/data/broadcast/overlay`;
export {
  RETRY_BASE_MS as OVERLAY_RETRY_BASE_MS,
  RETRY_MAX_MS as OVERLAY_RETRY_MAX_MS,
  retryDelay as overlayRetryDelay,
} from '../utils/retryDelay.js';

/**
 * The overlay doc for the OBS sources and the control panel. Unlike usePublicDoc a read error does not end the
 * listener: it keeps the last data (the air stays as it was), reports `error` and subscribes again with backoff.
 * @returns {{ data: object|null, loading: boolean, error: string, attempts: number }}
 */
export function useOverlayDoc() {
  const [state, setState] = useState({ data: null, loading: true, error: '', attempts: 0 });
  useEffect(() => {
    let unsubscribe = () => {};
    let timer = null;
    let attempts = 0;
    let cancelled = false;
    const subscribe = () => {
      unsubscribe = onSnapshot(
        doc(db, OVERLAY_DOC_PATH),
        (snap) => {
          attempts = 0;
          setState({ data: snap.exists() ? snap.data() : null, loading: false, error: '', attempts: 0 });
        },
        (err) => {
          console.error('[useOverlayDoc]', err);
          attempts += 1;
          setState(prev => ({ ...prev, loading: false, error: 'No se pudo leer el overlay.', attempts }));
          if (!cancelled) timer = setTimeout(subscribe, overlayRetryDelay(attempts));
        },
      );
    };
    subscribe();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
  return state;
}
