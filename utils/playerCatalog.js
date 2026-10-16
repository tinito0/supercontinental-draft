// Catálogo de jugadores en formato compacto (columnar).
// public/jugadores.json repite los 110 nombres de campo en cada uno de los ~27.000 jugadores (~60 MB):
// en el celular la descarga, el JSON.parse y la copia posterior de cada objeto bloqueaban el hilo
// principal. scripts/build-players-compact.mjs lo convierte (en cada dev/build) a
//   { version, fields, booleanFields, rows: [[...valores en el orden de fields]] }
// con los booleanos como 0/1 (~9 MB, ~1,5 MB comprimido). Los ids y valores no cambian.
import { isGlitchedPlayer, normalizarString } from './helpers.js';

export const COMPACT_CATALOG_VERSION = 1;
export const COMPACT_CATALOG_URL = '/jugadores.compact.json';
export const LEGACY_CATALOG_URL = '/jugadores.json';

/** Array de jugadores → formato compacto. Los campos son la unión de todas las claves, en orden de aparición. */
export function encodePlayersCompact(players) {
  const fieldSet = new Set();
  players.forEach(player => Object.keys(player).forEach(key => fieldSet.add(key)));
  const fields = [...fieldSet];
  const booleanFields = fields.filter(field => players.every(player => typeof player[field] === 'boolean'));
  const isBoolean = new Set(booleanFields);
  const rows = players.map(player => fields.map(field => {
    const value = player[field];
    if (isBoolean.has(field)) return value ? 1 : 0;
    return value === undefined ? null : value;
  }));
  return { version: COMPACT_CATALOG_VERSION, fields, booleanFields, rows };
}

/** Formato compacto → objetos idénticos a los de jugadores.json. Un campo ausente en el original vuelve como null. */
export function decodePlayersCompact(payload) {
  if (!payload || payload.version !== COMPACT_CATALOG_VERSION || !Array.isArray(payload.fields) || !Array.isArray(payload.rows)) {
    throw new Error('Formato de catálogo compacto desconocido.');
  }
  const { fields, rows } = payload;
  const isBoolean = fields.map(field => payload.booleanFields?.includes(field));
  return rows.map(row => {
    const player = {};
    for (let i = 0; i < fields.length; i += 1) {
      player[fields[i]] = isBoolean[i] ? row[i] === 1 : row[i];
    }
    return player;
  });
}

/**
 * Lo mismo que hacía app.jsx con el JSON crudo (filtro de glitcheados + processPlayersData), pero en una
 * sola pasada sobre las filas: sin el array intermedio ni la segunda copia de cada objeto.
 */
export function buildMarketPlayers(rawPlayers) {
  const result = [];
  for (const player of rawPlayers) {
    if (isGlitchedPlayer(player)) continue;
    player.searchableName = player.Name ? normalizarString(player.Name) : '';
    player.Precio = Number(player.Precio) || 0;
    player.Age = Number(player.Age) || 0;
    player.OVR_CALCULADO = Number(player.OVR_CALCULADO) || 0;
    result.push(player);
  }
  return result;
}

/**
 * Descarga el catálogo crudo (array de jugadores como en jugadores.json). Usa el compacto y, si no existe
 * (p. ej. vite arrancado sin `npm run dev`), cae al JSON original.
 */
export async function fetchRawPlayers(fetchImpl = fetch) {
  // Hosting y Vite devuelven index.html con 200 cuando falta el archivo: cualquier error de lectura cae al legacy.
  try {
    const compact = await fetchImpl(COMPACT_CATALOG_URL);
    if (compact.ok) return decodePlayersCompact(await compact.json());
  } catch {
    // sigue con jugadores.json
  }
  const legacy = await fetchImpl(LEGACY_CATALOG_URL);
  if (!legacy.ok) throw new Error(`Catálogo no disponible (${legacy.status})`);
  const data = await legacy.json();
  if (!Array.isArray(data)) throw new Error('El catálogo no contiene jugadores.');
  return data;
}
