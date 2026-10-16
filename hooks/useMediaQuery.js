import { useSyncExternalStore } from 'react';

/** true mientras la media query coincide (se actualiza al rotar o redimensionar). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** Ahorro de datos activado (Network Information API; sin soporte → false). */
export function prefersSaveData() {
  return typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData);
}

export default useMediaQuery;
