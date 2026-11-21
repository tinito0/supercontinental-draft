import { useEffect, useRef, useState } from 'react';

// OBS browser sources expose window.obsstudio; switching scenes needs the source's «Page permissions» set to
// «Advanced access to OBS» (control level 4) or more.
const ADVANCED_ACCESS = 4;

/**
 * Switches the real OBS scene when the overlay scene changes (the remote control source, ?control=obs). Only on
 * changes: a scene picked by hand in OBS stays until the overlay moves again.
 * @param {string|null} target OBS scene name
 * @returns {'no-obs'|'no-permission'|'ready'|'switched'} status, shown on the control page for setup
 */
export function useObsSceneControl(target) {
  const [status, setStatus] = useState(() => (typeof window !== 'undefined' && window.obsstudio ? 'ready' : 'no-obs'));
  const applied = useRef(null);
  useEffect(() => {
    const obs = typeof window !== 'undefined' ? window.obsstudio : null;
    if (!obs || !target || applied.current === target) return;
    applied.current = target;
    const apply = () => obs.getCurrentScene(current => {
      if (current?.name !== target) obs.setCurrentScene(target);
      setStatus('switched');
    });
    if (typeof obs.getControlLevel !== 'function') { apply(); return; }
    obs.getControlLevel(level => {
      if (level < ADVANCED_ACCESS) { applied.current = null; setStatus('no-permission'); return; }
      apply();
    });
  }, [target]);
  return status;
}
