// Motion helpers shared by the app shell and the landing. Durations and curves live in index.css (--dur-*, --ease-*);
// see docs/DESIGN_SYSTEM.md "Movimiento".

/** Upper bound for an exit animation: an element is removed after this even if its animation never reports done. */
export const EXIT_TIMEOUT_MS = 400;

/** True when the user asked the OS for reduced motion (or there is no window, as in tests and prerendering). */
export const prefersReducedMotion = () => typeof window === 'undefined'
  || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const isFinite = animation => {
  const end = animation.effect?.getComputedTiming?.().endTime;
  return end === undefined || Number.isFinite(end);
};

/**
 * Resolves when the element's own exit animations end (a spinner inside it, or any infinite animation, is ignored),
 * or after timeoutMs at the latest. Resolves right away when nothing animates, e.g. with reduced motion.
 */
export function waitForExit(element, timeoutMs = EXIT_TIMEOUT_MS) {
  const animations = (element?.getAnimations?.() ?? []).filter(isFinite);
  if (animations.length === 0) return Promise.resolve();
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); });
  return Promise.race([Promise.allSettled(animations.map(animation => animation.finished)), timeout])
    .finally(() => clearTimeout(timer));
}

/**
 * The items to render while some are leaving: the current ones in order, plus each leaving one back at the index it
 * had, flagged `leaving` so it can play its exit before it is dropped. Pure.
 * @param {Array<{ key: string }>} items current items
 * @param {Array<{ key: string, index: number }>} leaving removed items still animating out
 */
export function mergeWithLeaving(items, leaving) {
  const current = items.map(item => ({ ...item, leaving: false }));
  const currentKeys = new Set(items.map(item => item.key));
  const merged = [...current];
  leaving
    .filter(item => !currentKeys.has(item.key))
    .sort((a, b) => a.index - b.index)
    .forEach(item => merged.splice(Math.min(item.index, merged.length), 0, { ...item, leaving: true }));
  return merged;
}

/** Removed items between two renders, with the index each one had. Pure. */
export function findRemoved(previous, next) {
  const nextKeys = new Set(next.map(item => item.key));
  return previous
    .map((item, index) => ({ ...item, index }))
    .filter(item => !nextKeys.has(item.key));
}
