import { useCallback, useState } from 'react';

/**
 * A small UI preference (one of `options`) remembered in localStorage. Falls back to the first option when
 * storage is unavailable (private mode, blocked site data) or holds an unknown value.
 */
export function useStoredChoice(key, options) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return options.includes(stored) ? stored : options[0];
    } catch {
      return options[0];
    }
  });

  const update = useCallback((next) => {
    if (!options.includes(next)) return;
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Preference only: the UI keeps working without storage.
    }
    // options is a literal array per call site; its contents never change.
  }, [key]);

  return [value, update];
}
