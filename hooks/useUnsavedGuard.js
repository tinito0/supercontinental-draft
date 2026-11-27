import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { confirmAction } from '../components/ui/ConfirmDialog.jsx';
import { hasUnsavedChanges, LEAVE_CONFIRM, mustConfirmLeave, withDirtyFlag } from '../utils/unsavedGuard.js';

/*
 * Unsaved-changes guard (audit T-3). A container calls `useUnsavedGuardHost()`, wraps its children in
 * `UnsavedGuardContext.Provider value={guard.value}` and awaits `guard.confirmLeave()` before closing or switching.
 * Editors below it call `useReportDirty(isDirty)`, and `useConfirmLeave()` for their own inner tabs.
 * Without a provider both are no-ops, so an editor still works standalone.
 */
export const UnsavedGuardContext = createContext(null);

export function useUnsavedGuardHost() {
  const [flags, setFlags] = useState({});
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const isDirty = hasUnsavedChanges(flags);

  const setDirty = useCallback((id, dirty) => setFlags(prev => (Boolean(prev[id]) === dirty ? prev : withDirtyFlag(prev, id, dirty))), []);
  const confirmLeave = useCallback(async (targetId, currentId) => {
    if (!mustConfirmLeave(flagsRef.current, currentId, targetId)) return true;
    return confirmAction({ ...LEAVE_CONFIRM, tone: 'danger' });
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const value = useMemo(() => ({ setDirty, confirmLeave }), [setDirty, confirmLeave]);
  return { value, isDirty, confirmLeave };
}

/** Flags the calling editor as dirty while `isDirty` is true; clears itself on unmount. */
export function useReportDirty(isDirty) {
  const guard = useContext(UnsavedGuardContext);
  const id = useId();
  const setDirty = guard?.setDirty;
  useEffect(() => {
    if (!setDirty) return undefined;
    setDirty(id, Boolean(isDirty));
    return () => setDirty(id, false);
  }, [setDirty, id, isDirty]);
}

/** `await confirmLeave()` resolves true when nothing is dirty or the user accepts losing it. */
export function useConfirmLeave() {
  const guard = useContext(UnsavedGuardContext);
  return guard?.confirmLeave || (async () => true);
}
