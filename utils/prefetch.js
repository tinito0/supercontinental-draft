// ─────────────────────────────────────────────────────────────────────────
// Prefetch de chunks lazy (React.lazy) ANTES del click.
//
// Por qué existe: cada modal de la app es React.lazy(() => import(...)), lo
// cual está bien para el bundle inicial, pero significa que el navegador
// recién pide/parsea ese chunk cuando el usuario ya hizo click — ahí se ve
// el delay ("tardan mucho en cargar"). La UI ya tenía un patrón de "prefetch
// on hover/focus/touchstart" armado en TopHeader.jsx, pero los handlers que
// se le pasaban no llamaban a import() en ningún lado — no hacían nada real.
//
// Este helper:
// 1. Deduplica: una vez que un chunk se pidió con éxito, no se vuelve a pedir.
// 2. Es consciente de la conexión: si el navegador expone Network Information
//    API y detecta "ahorro de datos" o una red lenta (2g/slow-2g), NO
//    prefetchea — importante para mánagers jugando desde el celular con
//    datos móviles limitados.
// ─────────────────────────────────────────────────────────────────────────

const prefetchedKeys = new Set();

function isPrefetchSafe() {
  if (typeof navigator === 'undefined') return true;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return true; // sin Network Information API, asumimos conexión normal
  if (conn.saveData) return false;
  if (conn.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return false;
  return true;
}

/**
 * Envuelve una función de import dinámico (ej. () => import('./Foo.jsx')) en
 * una versión "prefetch-safe": deduplicada, silenciosa si falla (permite
 * reintentar en el próximo hover), y que respeta ahorro de datos / red lenta.
 */
export function makePrefetchable(key, importFn) {
  return () => {
    if (!isPrefetchSafe() || prefetchedKeys.has(key)) return;
    prefetchedKeys.add(key);
    importFn().catch(() => {
      // Si falla (ej. offline momentáneo), se libera la key para poder reintentar.
      prefetchedKeys.delete(key);
    });
  };
}

/**
 * Corre una lista de funciones de prefetch durante tiempo idle del browser
 * (después de que ya se pintó y cargó lo crítico), para no competir por ancho
 * de banda/CPU con la carga inicial. Devuelve una función de cleanup.
 */
export function schedulePrefetchOnIdle(prefetchFns, timeoutMs = 2000) {
  const runAll = () => prefetchFns.forEach(fn => fn());

  if (typeof window === 'undefined') return () => {};

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(runAll, { timeout: timeoutMs });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(runAll, timeoutMs);
  return () => window.clearTimeout(id);
}
