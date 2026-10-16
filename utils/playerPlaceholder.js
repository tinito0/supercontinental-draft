// Imagen de reemplazo para jugadores sin foto: un SVG con las iniciales, generado en el momento.
// Antes cada foto faltante pedía una imagen a placehold.co (una petición a un tercero por jugador,
// que además fallaba sin conexión en la PWA).
const cache = new Map();

export function playerPlaceholder(name) {
  const initials = String(name || '?').trim().slice(0, 2).toUpperCase() || '?';
  if (cache.has(initials)) return cache.get(initials);
  const safe = initials.replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#151b2b"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Barlow Condensed,Barlow,sans-serif" font-weight="700" font-size="40" fill="#8692ab">${safe}</text></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(initials, uri);
  return uri;
}
