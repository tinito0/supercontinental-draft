import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { youthDraftPath } from '../utils/youthDraft.js';

/**
 * Live youth-draft document (utils/youthDraft.js). `draft` is undefined while loading and null when there is none.
 * @param {boolean} [enabled=true]
 */
export function useYouthDraft(enabled = true) {
  const [draft, setDraft] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !db) return undefined;
    return onSnapshot(
      doc(db, youthDraftPath(APP_ID)),
      (snap) => { setDraft(snap.exists() ? snap.data() : null); setError(null); },
      (err) => { console.error('Draft de promesas:', err); setError(err); setDraft(null); },
    );
  }, [enabled]);

  return { draft, error };
}
