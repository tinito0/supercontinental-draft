import React, { useEffect, useState } from 'react';

/** --dur-base plus a frame: the old value is dropped once both halves of the cross-fade have ended. */
const SOFT_SWAP_MS = 200;

/**
 * A number that cross-fades into its new value in place when the data behind it changes (transitions.dev
 * "Text swap soft", `.soft-swap` in index.css). Nothing moves, so a row of values can change together.
 * The first render shows the value without animating.
 */
export function SoftValue({ value, className = '' }) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(null);

  // Derived during render, so the old value never flashes off for a frame before the swap starts.
  if (value !== current) {
    setPrevious(current);
    setCurrent(value);
  }

  useEffect(() => {
    if (previous == null) return undefined;
    const timer = setTimeout(() => setPrevious(null), SOFT_SWAP_MS);
    return () => clearTimeout(timer);
  }, [previous, current]);

  return (
    <span className={`soft-swap ${className}`}>
      {previous != null && <span key={`old-${previous}`} className="soft-swap-old" aria-hidden="true">{previous}</span>}
      <span key={`new-${current}`} className={previous != null ? 'soft-swap-new' : undefined}>{current}</span>
    </span>
  );
}

export default SoftValue;
