import { useLayoutEffect, useRef } from 'react';
import { RANK_SHIFT_MS, prefersReducedMotion, rankShifts } from '../utils/motion.js';

/* Rows that change place slide from where they were to where they are (FLIP). Rows carry `data-rank-key`; `orderKey`
   is the order as a string, so a render that does not reorder measures nothing. With reduced motion a moved row's
   `[data-rank-flash]` cell flashes once instead. docs/DESIGN_SYSTEM.md "Table reorder". */

const tops = container => new Map(
  [...container.querySelectorAll('[data-rank-key]')].map(row => [row.dataset.rankKey, row.offsetTop]),
);

function flash(row) {
  const cell = row.querySelector('[data-rank-flash]');
  if (!cell) return;
  cell.classList.remove('value-flash');
  void cell.offsetWidth; // restart the animation when the same row moves twice in a row
  cell.classList.add('value-flash');
}

/**
 * @param {React.RefObject<HTMLElement>} containerRef element that holds the rows (a <tbody> works)
 * @param {string} orderKey row keys in order, e.g. rows.map(r => r.name).join('|')
 * @param {string} [easing] the OBS overlay passes its own curve (var(--scl-ease)); the site uses --ease-in-out
 */
export function useRankShift(containerRef, orderKey, easing = 'cubic-bezier(0.4, 0, 0.2, 1)') {
  const previous = useRef(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rows = new Map([...container.querySelectorAll('[data-rank-key]')].map(row => [row.dataset.rankKey, row]));
    // offsetTop ignores the translate of a slide still running, so a second goal mid-slide starts from the real place.
    rows.forEach(row => row.getAnimations?.().forEach(animation => { if (animation.id === 'rank-shift') animation.cancel(); }));
    const after = tops(container);
    const before = previous.current;
    previous.current = after;
    if (!before) return;
    const reduced = prefersReducedMotion();
    for (const { key, dy } of rankShifts(before, after)) {
      const row = rows.get(key);
      if (!row) continue;
      if (reduced || typeof row.animate !== 'function') { flash(row); continue; }
      const animation = row.animate(
        [{ translate: `0 ${dy}px` }, { translate: '0 0' }],
        { duration: RANK_SHIFT_MS, easing },
      );
      animation.id = 'rank-shift';
      flash(row);
    }
  }, [containerRef, orderKey, easing]);
}
