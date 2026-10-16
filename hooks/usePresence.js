import { useCallback, useEffect, useRef, useState } from 'react';
import { findRemoved, mergeWithLeaving, waitForExit } from '../utils/motion.js';

/**
 * Keeps removed items rendered while they animate out. Items need a stable `key`. Returns the list to render (each
 * entry has `leaving`) and `onExited(key)`, which drops a leaving item once its exit ends (see useExitAnimation).
 */
export function usePresenceList(items) {
  const [previousItems, setPreviousItems] = useState(items);
  const [leaving, setLeaving] = useState([]);

  // Derived from the previous render, during render (no extra commit): a removed item is never unmounted and
  // mounted again, so its exit starts from what is on screen.
  if (items !== previousItems) {
    const removed = findRemoved(previousItems, items);
    setPreviousItems(items);
    if (removed.length > 0) {
      const removedKeys = new Set(removed.map(item => item.key));
      setLeaving(current => [...current.filter(item => !removedKeys.has(item.key)), ...removed]);
    }
  }

  const onExited = useCallback(key => setLeaving(current => current.filter(item => item.key !== key)), []);
  return { items: mergeWithLeaving(items, leaving), onExited };
}

/** Calls onExited once the element's exit animation (started by `data-closing`) ends. */
export function useExitAnimation(ref, isLeaving, onExited) {
  const onExitedRef = useRef(onExited);
  useEffect(() => { onExitedRef.current = onExited; }, [onExited]);

  useEffect(() => {
    if (!isLeaving) return undefined;
    let active = true;
    waitForExit(ref.current).then(() => { if (active) onExitedRef.current?.(); });
    return () => { active = false; };
  }, [isLeaving, ref]);
}
