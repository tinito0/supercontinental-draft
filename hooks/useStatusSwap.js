import { useEffect, useState } from 'react';

/** Matches --dur-fast, the exit of .status-swap (index.css). */
const STATUS_EXIT_MS = 120;

/**
 * A status text that swaps in place (transitions.dev "Text states swap"): when `value` changes, the old one stays
 * on screen with `isLeaving` for its exit, then the new one mounts and plays its entry. `null` means nothing shown.
 * Render the returned `shown` with `key={shown}` and `data-leaving={isLeaving || undefined}` on a `.status-swap`.
 */
export function useStatusSwap(value) {
  const [shown, setShown] = useState(value);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (value === shown) return undefined;
    if (shown == null) {
      setShown(value);
      return undefined;
    }
    setIsLeaving(true);
    const timer = setTimeout(() => {
      setShown(value);
      setIsLeaving(false);
    }, STATUS_EXIT_MS);
    return () => clearTimeout(timer);
  }, [value, shown]);

  return { shown, isLeaving };
}
