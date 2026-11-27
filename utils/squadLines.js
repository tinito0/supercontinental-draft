// The four lines of the squad, in the order the finance charts and lists show them. `token` is the same
// --c-data-* variable the pos-* position chips use (index.css), so a chart colour and a chip colour cannot drift.
export const SQUAD_LINES = Object.freeze([
  { key: 'portero', label: 'Porteros', grupo: 'Arqueros', token: '--c-data-yellow', fallback: '255 196 0' },
  { key: 'defensa', label: 'Defensas', grupo: 'Defensores', token: '--c-data-blue', fallback: '0 174 255' },
  { key: 'medio', label: 'Medios', grupo: 'Mediocampistas', token: '--c-data-green', fallback: '0 179 74' },
  { key: 'delantero', label: 'Delanteros', grupo: null, token: '--c-data-red', fallback: '255 77 77' },
]);

/** Line of a player: the three named groups, everything else counts as forward (as the board does). */
export function squadLineKey(grupo) {
  return SQUAD_LINES.find(line => line.grupo === grupo)?.key ?? 'delantero';
}

/** Players per line, keyed by line key. */
export function countByLine(players) {
  const counts = { portero: 0, defensa: 0, medio: 0, delantero: 0 };
  (players || []).forEach(player => { counts[squadLineKey(player?.Grupo)] += 1; });
  return counts;
}

/** `rgb(...)` for a line colour, read from the CSS token (canvas charts cannot use var()). */
export function lineColor(line, root = typeof document !== 'undefined' ? document.documentElement : null) {
  const raw = root ? getComputedStyle(root).getPropertyValue(line.token).trim() : '';
  return `rgb(${(raw || line.fallback).split(/\s+/).join(', ')})`;
}
