import { useSyncExternalStore } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebaseCore.js';
import { APP_ID } from '../utils/constants.js';
import { DEFAULT_BENCH_MIN_AVG_OVR, normalizeBenchMin, squadRulesConfigPath } from '../utils/squadRules.js';

// One Firestore listener for the whole page, shared by every component that calls the hook (board, Mi Equipo,
// Administración, rules page). It opens with the first subscriber and closes with the last one.
const DEFAULT_STATE = Object.freeze({ benchMin: DEFAULT_BENCH_MIN_AVG_OVR, isLoading: true });
let state = DEFAULT_STATE;
let unsubscribeFirestore = null;
const listeners = new Set();

function publish(next) {
  state = next;
  listeners.forEach(listener => listener());
}

function startListening() {
  if (!db) {
    publish({ benchMin: DEFAULT_BENCH_MIN_AVG_OVR, isLoading: false });
    return;
  }
  unsubscribeFirestore = onSnapshot(
    doc(db, squadRulesConfigPath(APP_ID)),
    snap => publish({ benchMin: normalizeBenchMin(snap.exists() ? snap.data()?.benchMinAvgOvr : undefined), isLoading: false }),
    err => {
      console.error('Reglas del plantel:', err);
      publish({ benchMin: DEFAULT_BENCH_MIN_AVG_OVR, isLoading: false });
    },
  );
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) startListening();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeFirestore?.();
      unsubscribeFirestore = null;
      state = DEFAULT_STATE;
    }
  };
}

/**
 * Live squad-rules config (`artifacts/{APP_ID}/public/data/config/squadRules`). `benchMin` is the bench's minimum
 * average OVR: the default while loading, when the document is missing or when it cannot be read.
 * @returns {{ benchMin: number, isLoading: boolean }}
 */
export function useSquadRulesConfig() {
  return useSyncExternalStore(subscribe, () => state, () => DEFAULT_STATE);
}
