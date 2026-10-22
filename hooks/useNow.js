import { useEffect, useState } from 'react';

/**
 * La hora actual, refrescada cada `intervalMs`. Para estados que dependen del tiempo sin que cambien los datos
 * (un partido «en vivo» que deja de recibir datos pasa a «sin señal»).
 */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
