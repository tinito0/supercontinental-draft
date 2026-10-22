// Forma del documento del torneo (artifacts/{APP_ID}/public/data/tournament/official) y la fusión de una edición con
// lo que otro admin guardó mientras tanto. Puro; tests/tournamentModel.test.js.
//
// Por qué la fusión: el gestor del torneo edita una copia local y antes guardaba los campos enteros (matches, league,
// bracket). Si otra pestaña o la importación del colector guardaban un resultado en el medio, el guardado viejo lo
// borraba sin aviso. Ahora services/tournamentService.js, dentro de una transacción, aplica solo lo que este editor
// cambió respecto de su base sobre la última versión guardada; si los dos cambiaron lo mismo de forma distinta, no
// guarda y lo dice.

import { CUP_DEFINITIONS, EMPTY_BRACKET_MATCH } from './bracketModel.js';

export const EMPTY_LEAGUE_SLOT = 'Club...';
const LEAGUE_SIZE = 12;

const emptyRow = () => ({ id: crypto.randomUUID(), name: EMPTY_LEAGUE_SLOT, pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
const emptyMatch = () => ({ ...EMPTY_BRACKET_MATCH });
const fill = (list, length) => {
  const items = Array.isArray(list) ? list.map(item => (item && typeof item === 'object' ? { ...item } : emptyMatch())) : [];
  while (items.length < length) items.push(emptyMatch());
  return items;
};

/**
 * Copia del torneo con todas las partes que la app espera: 12 lugares en la tabla, las dos copas con sus cruces,
 * goleadores, asistidores y partidos. No cambia datos: solo completa lo que falta. Sin documento, un torneo vacío.
 */
export function normalizeTournament(raw) {
  const data = raw && typeof raw === 'object' ? JSON.parse(JSON.stringify(raw)) : {};
  const league = (Array.isArray(data.league) ? data.league : []).slice(0, LEAGUE_SIZE).map(row => ({ ...row, id: row?.id || crypto.randomUUID() }));
  while (league.length < LEAGUE_SIZE) league.push(emptyRow());
  const bracket = data.bracket && typeof data.bracket === 'object' ? data.bracket : {};
  const repechaje = bracket.repechaje && typeof bracket.repechaje === 'object' ? bracket.repechaje : {};
  return {
    ...data,
    league,
    bracket: {
      ...bracket,
      quarters: fill(bracket.quarters, 4),
      semis: fill(bracket.semis, 2),
      final: bracket.final && typeof bracket.final === 'object' ? { ...emptyMatch(), ...bracket.final } : emptyMatch(),
      repechaje: {
        ...repechaje,
        r1: fill(repechaje.r1, 4),
        r2: fill(repechaje.r2, 2),
        semis: fill(repechaje.semis, 2),
        final: repechaje.final && typeof repechaje.final === 'object' ? { ...emptyMatch(), ...repechaje.final } : emptyMatch(),
      },
    },
    topScorers: Array.isArray(data.topScorers) ? data.topScorers : Array.from({ length: 5 }, () => ({ name: '', team: '', goals: '' })),
    topAssisters: Array.isArray(data.topAssisters) ? data.topAssisters : Array.from({ length: 5 }, () => ({ name: '', team: '', assists: '' })),
    matches: Array.isArray(data.matches) ? data.matches : [],
  };
}

// Firestore devuelve 2 y el formulario '2': para decidir si algo cambió, un número y su texto son lo mismo, y el
// orden de las claves de un mapa no cuenta.
const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${key}:${stable(value[key])}`).join(',')}}`;
  return value === undefined || value === null ? '' : String(value);
};
const norm = value => stable(value);
const same = (a, b) => norm(a) === norm(b);

/**
 * Fusión campo por campo de un registro (un partido, un cruce): lo que cambió este editor gana; lo demás viene de la
 * última versión. Si los dos cambiaron el mismo campo a valores distintos, es un conflicto.
 * @returns {{ value: object, conflict: boolean }}
 */
function mergeRecord(base = {}, edited = {}, latest = {}) {
  const value = { ...latest };
  let conflict = false;
  for (const key of new Set([...Object.keys(base), ...Object.keys(edited), ...Object.keys(latest)])) {
    if (same(edited[key], base[key])) continue;
    if (!same(latest[key], base[key]) && !same(latest[key], edited[key])) conflict = true;
    if (edited[key] === undefined) delete value[key];
    else value[key] = edited[key];
  }
  return { value, conflict };
}

const matchLabel = match => `${match?.homeTeam || 'Local'} vs ${match?.awayTeam || 'Visitante'}${match?.round ? ` (${match.round})` : ''}`;

function mergeMatches(base = [], edited = [], latest = [], conflicts) {
  const keyOf = (match, index) => match?.id || `#${index}`;
  const toMap = list => new Map(list.map((match, index) => [keyOf(match, index), match]));
  const [b, e, l] = [toMap(base), toMap(edited), toMap(latest)];
  const result = [];
  for (const [key, latestMatch] of l) {
    const baseMatch = b.get(key);
    const editedMatch = e.get(key);
    if (!baseMatch) { result.push(latestMatch); continue; } // lo agregó otro: queda
    if (!editedMatch) {
      // Lo borró este editor: solo si nadie lo cambió mientras tanto.
      if (same(latestMatch, baseMatch)) continue;
      conflicts.push(`${matchLabel(latestMatch)}: lo borraste, pero otro admin lo modificó.`);
      result.push(latestMatch);
      continue;
    }
    const merged = mergeRecord(baseMatch, editedMatch, latestMatch);
    if (merged.conflict) conflicts.push(`${matchLabel(latestMatch)}: otro admin cambió el mismo partido.`);
    result.push(merged.value);
  }
  for (const [key, editedMatch] of e) {
    if (l.has(key)) continue;
    if (!b.has(key)) { result.push(editedMatch); continue; } // nuevo de este editor
    // Otro lo borró: si este editor no lo tocó, queda borrado; si lo cambió, es un conflicto.
    if (!same(editedMatch, b.get(key))) conflicts.push(`${matchLabel(editedMatch)}: lo cambiaste, pero otro admin lo borró.`);
  }
  return result;
}

const CUP_SLOTS = Object.values(CUP_DEFINITIONS).flatMap(cup => cup.rounds.flatMap(round => (
  round.isFinal
    ? [{ path: round.path, index: null, label: `${cup.name} · ${round.titles[0]}` }]
    : round.titles.map((title, index) => ({ path: round.path, index, label: `${cup.name} · ${title}` }))
)));

const readSlot = (bracket, { path, index }) => {
  const node = path.reduce((acc, key) => (acc == null ? undefined : acc[key]), bracket);
  return index === null ? node : node?.[index];
};

function mergeBracket(base, edited, latest, conflicts) {
  const result = JSON.parse(JSON.stringify(latest || {}));
  for (const slot of CUP_SLOTS) {
    const merged = mergeRecord(readSlot(base, slot) || {}, readSlot(edited, slot) || {}, readSlot(latest, slot) || {});
    if (merged.conflict) conflicts.push(`${slot.label}: otro admin cambió el mismo cruce.`);
    const parent = slot.path.slice(0, -1).reduce((acc, key) => (acc[key] = acc[key] || {}), result);
    const leaf = slot.path[slot.path.length - 1];
    if (slot.index === null) parent[leaf] = merged.value;
    else {
      parent[leaf] = Array.isArray(parent[leaf]) ? parent[leaf] : [];
      parent[leaf][slot.index] = merged.value;
    }
  }
  return result;
}

// Lo que el admin carga a mano en la tabla: qué clubes están y las estadísticas de los que no tienen partidos (las
// demás se recalculan desde los partidos al guardar). Ni el orden ni los ids cuentan como un cambio.
const leagueManualPart = league => (league || [])
  .filter(row => row?.name && row.name !== EMPTY_LEAGUE_SLOT)
  .map(row => (row.autoStats ? { name: row.name } : { name: row.name, pj: row.pj, pg: row.pg, gpen: row.gpen, pp: row.pp, pts: row.pts, gf: row.gf, gc: row.gc }))
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));

const MERGED_KEYS = new Set(['matches', 'bracket', 'league']);

/**
 * Aplica la edición (`edited`, hecha sobre `base`) sobre la última versión guardada (`latest`).
 * - partidos: por id, campo por campo;
 * - copas: por cruce, campo por campo;
 * - tabla: si el editor cambió clubes o estadísticas a mano, su tabla; si no, la guardada;
 * - el resto de los campos (goleadores a mano, orden de desempate…): el del editor si lo cambió.
 * @returns {{ data: object, conflicts: string[] }}
 */
export function mergeTournamentEdit(base, edited, latest) {
  const [b, e, l] = [normalizeTournament(base), normalizeTournament(edited), normalizeTournament(latest)];
  const conflicts = [];
  const data = { ...l };
  data.matches = mergeMatches(b.matches, e.matches, l.matches, conflicts);
  data.bracket = mergeBracket(b.bracket, e.bracket, l.bracket, conflicts);
  data.league = same(leagueManualPart(e.league), leagueManualPart(b.league)) ? l.league : e.league;
  for (const key of new Set([...Object.keys(b), ...Object.keys(e)])) {
    if (MERGED_KEYS.has(key) || same(e[key], b[key])) continue;
    if (!same(l[key], b[key]) && !same(l[key], e[key])) conflicts.push(`«${key}»: otro admin también lo cambió.`);
    if (e[key] === undefined) delete data[key];
    else data[key] = e[key];
  }
  return { data, conflicts };
}
