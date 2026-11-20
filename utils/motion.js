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

/** How long a table row takes to slide to its new place (docs/DESIGN_SYSTEM.md "Table reorder"). */
export const RANK_SHIFT_MS = 450;

/**
 * Rows that changed place between two layouts, and how far: `dy` is old top minus new top, so translating the row by
 * `dy` puts it back where it was and animating to 0 slides it into place. Rows that are new, gone or did not move
 * (less than half a pixel) are left out. Pure.
 * @param {Map<string, number>} before row key → top, relative to the table
 * @param {Map<string, number>} after row key → top, relative to the table
 */
export function rankShifts(before, after) {
  const shifts = [];
  after.forEach((top, key) => {
    if (!before.has(key)) return;
    const dy = before.get(key) - top;
    if (Math.abs(dy) >= 0.5) shifts.push({ key, dy });
  });
  return shifts;
}

/** Removed items between two renders, with the index each one had. Pure. */
export function findRemoved(previous, next) {
  const nextKeys = new Set(next.map(item => item.key));
  return previous
    .map((item, index) => ({ ...item, index }))
    .filter(item => !nextKeys.has(item.key));
}
