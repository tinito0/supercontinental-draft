import React, { useEffect, useRef, useState } from 'react';

// Exit animations for overlay pieces that React would otherwise drop at once (broadcast.css `.is-leaving`).
export const SCENE_LEAVE_MS = 300;
export const CHROME_LEAVE_MS = 320;

/**
 * Keeps the last rendering of something on screen for `leaveMs` after `show` turns false, flagged as leaving.
 * @param {{ show: boolean, leaveMs?: number, children: (leaving: boolean) => React.ReactNode }} props
 */
export function Presence({ show, leaveMs = CHROME_LEAVE_MS, children }) {
  const last = useRef(null);
  const [leaving, setLeaving] = useState(false);
  if (show) last.current = children;
  useEffect(() => {
    if (show) { setLeaving(false); return undefined; }
    if (!last.current) return undefined;
    setLeaving(true);
    const timer = setTimeout(() => { last.current = null; setLeaving(false); }, leaveMs);
    return () => clearTimeout(timer);
  }, [show, leaveMs]);
  if (show) return children(false);
  return leaving && last.current ? last.current(true) : null;
}

/**
 * One scene at a time: when `sceneKey` changes, the old scene plays its exit while the new one enters just after.
 * @param {{ sceneKey: string, children: React.ReactNode }} props
 */
export function SceneSwitch({ sceneKey, children }) {
  const current = useRef({ key: sceneKey, node: children });
  const [previous, setPrevious] = useState(null);
  if (current.current.key !== sceneKey) {
    const old = current.current;
    current.current = { key: sceneKey, node: children };
    if (old.node) setPrevious(old);
  } else {
    current.current.node = children;
  }
  useEffect(() => {
    if (!previous) return undefined;
    const timer = setTimeout(() => setPrevious(null), SCENE_LEAVE_MS);
    return () => clearTimeout(timer);
  }, [previous]);
  return (
    <>
      {previous && <div className="scl-scene is-leaving" key={`leaving-${previous.key}`} aria-hidden="true">{previous.node}</div>}
      {children && <div className={`scl-scene ${previous ? 'is-after' : ''}`} key={sceneKey}>{children}</div>}
    </>
  );
}
