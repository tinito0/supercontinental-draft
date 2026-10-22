// Estructura de las dos copas eliminatorias y geometría compartida del bracket.
// Una sola fuente para la vista de la app (editable), la de OBS y la selección de partidos del overlay.
// Datos en Firestore (tournament/official): bracket.{quarters[4], semis[2], final{}} para la Copa de Oro y
// bracket.repechaje.{r1[4], r2[2], semis[2], final{}} para la Copa de Plata.
import { goldCupQuarterFinals, isScore, knockoutWinner, teamKey } from './competitionRules.js';

export const EMPTY_BRACKET_MATCH = Object.freeze({ teamA: '', teamB: '', scoreA: '', scoreB: '' });

export const CUP_IDS = { ORO: 'oro', PLATA: 'plata' };

// path: ruta dentro de `bracket` (es la misma que recibe updateGeneric en TournamentModal).
// Si una ronda tiene la mitad de partidos que la anterior, cada partido recibe a dos (horquilla);
// si tiene los mismos, recibe a uno (línea recta). Así se dibujan Oro (4-2-1) y Plata (4-2-2-1).
export const CUP_DEFINITIONS = {
  [CUP_IDS.ORO]: {
    id: CUP_IDS.ORO,
    name: 'Copa de Oro',
    subtitle: 'Eliminatorias Oro',
    finalLabel: 'Gran Final Oro',
    championLabel: 'Campeón Oro',
    tone: 'gold',
    rounds: [
      {
        id: 'quarters', label: 'Cuartos de final', path: ['quarters'], count: 4,
        titles: ['Cuartos 1', 'Cuartos 2', 'Cuartos 3', 'Cuartos 4'],
        seeds: [['1°', '8°'], ['4°', '5°'], ['2°', '7°'], ['3°', '6°']],
      },
      { id: 'semis', label: 'Semifinales', path: ['semis'], count: 2, titles: ['Semifinal 1', 'Semifinal 2'] },
      { id: 'final', label: 'Final', path: ['final'], count: 1, titles: ['Gran Final'], isFinal: true },
    ],
  },
  [CUP_IDS.PLATA]: {
    id: CUP_IDS.PLATA,
    name: 'Copa de Plata',
    subtitle: 'Copa de Plata — Repechaje',
    finalLabel: 'Final Copa de Plata',
    championLabel: 'Campeón Plata',
    tone: 'silver',
    rounds: [
      {
        id: 'r1', label: 'Preliminares', path: ['repechaje', 'r1'], count: 4,
        titles: ['Preliminar 1', 'Preliminar 2', 'Preliminar 3', 'Preliminar 4'],
      },
      { id: 'r2', label: 'Cuartos Plata', path: ['repechaje', 'r2'], count: 2, titles: ['Cuartos Plata 1', 'Cuartos Plata 2'] },
      { id: 'semis', label: 'Semifinales Plata', path: ['repechaje', 'semis'], count: 2, titles: ['Semifinal Plata 1', 'Semifinal Plata 2'] },
      { id: 'final', label: 'Final', path: ['repechaje', 'final'], count: 1, titles: ['Final Plata'], isFinal: true },
    ],
  },
};

/** Marcador cargado y válido (entero, no negativo): la misma regla que la tabla (competitionRules.isScore). */
export function hasScore(value) {
  return isScore(value);
}

/** Quién pasa: el marcador y, si quedó empatado, la tanda (penaltiesA/B). null si falta información. */
export function getMatchWinner(match) {
  return match ? knockoutWinner(match) : null;
}

/** Los dos marcadores cargados e iguales: hace falta la tanda. */
export function isTiedScore(match) {
  return Boolean(match) && hasScore(match.scoreA) && hasScore(match.scoreB) && Number(match.scoreA) === Number(match.scoreB);
}

/** «4-3 pen.» cuando el cruce se definió por penales; vacío si no. */
export function shootoutLabel(match) {
  if (!isTiedScore(match) || !hasScore(match.penaltiesA) || !hasScore(match.penaltiesB)) return '';
  return `${Number(match.penaltiesA)}-${Number(match.penaltiesB)} pen.`;
}

export function isMatchCompleted(match) {
  return Boolean(match) && hasScore(match.scoreA) && hasScore(match.scoreB);
}

function readPath(bracket, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), bracket);
}

/** Rondas de una copa con sus partidos, rellenando los que falten con partidos vacíos. */
export function buildCupRounds(cupId, bracket) {
  const cup = CUP_DEFINITIONS[cupId];
  if (!cup) throw new Error(`Copa desconocida: ${cupId}`);
  return cup.rounds.map(round => {
    const stored = readPath(bracket || {}, round.path);
    const list = round.isFinal ? [stored] : (Array.isArray(stored) ? stored : []);
    const matches = Array.from({ length: round.count }, (_, index) => {
      const match = list[index] && typeof list[index] === 'object' ? list[index] : EMPTY_BRACKET_MATCH;
      return {
        key: `${cupId}-${round.id}-${index}`,
        cupId,
        roundId: round.id,
        roundLabel: round.label,
        path: round.path,
        index,
        isFinal: Boolean(round.isFinal),
        title: round.titles?.[index] || `${round.label} ${index + 1}`,
        seedA: round.seeds?.[index]?.[0] || '',
        seedB: round.seeds?.[index]?.[1] || '',
        match,
      };
    });
    return { id: round.id, label: round.label, isFinal: Boolean(round.isFinal), matches };
  });
}

/**
 * Columnas del bracket.
 * - 'mirrored': dos alas que convergen en la final (la presentación clásica de la app).
 * - 'linear': de izquierda a derecha, una columna por ronda (la mitad de columnas; cabe más ancho por tarjeta).
 * Cada columna: { id, label, side: 'left'|'right'|'center', isFinal, entries }.
 */
export function buildBracketColumns(rounds, layout = 'mirrored') {
  if (layout === 'linear') {
    return rounds.map(round => ({ id: round.id, label: round.label, side: 'left', isFinal: round.isFinal, entries: round.matches }));
  }
  const nonFinal = rounds.filter(round => !round.isFinal);
  const final = rounds.find(round => round.isFinal);
  const left = nonFinal.map(round => ({
    id: `${round.id}-left`, label: round.label, side: 'left', isFinal: false,
    entries: round.matches.slice(0, Math.ceil(round.matches.length / 2)),
  }));
  const right = nonFinal.map(round => ({
    id: `${round.id}-right`, label: round.label, side: 'right', isFinal: false,
    entries: round.matches.slice(Math.ceil(round.matches.length / 2)),
  })).reverse();
  const center = final ? [{ id: final.id, label: final.label, side: 'center', isFinal: true, entries: final.matches }] : [];
  return [...left, ...center, ...right];
}

/** Centro vertical (0–100) del partido `index` de una columna con `count` partidos repartidos en partes iguales. */
export function slotCenter(index, count) {
  return ((2 * index + 1) / (2 * count)) * 100;
}

/**
 * Trazos SVG (viewBox 0 0 100 100, sin conservar proporción) entre dos columnas vecinas.
 * `from` alimenta a `to`; `direction` 'ltr' si `from` está a la izquierda, 'rtl' si está a la derecha.
 * Con 2n → n se dibuja una horquilla por partido destino; con n → n, líneas rectas.
 */
export function connectorPaths(fromCount, toCount, direction = 'ltr') {
  if (!fromCount || !toCount) return [];
  const [x0, xMid, x1] = direction === 'rtl' ? [100, 50, 0] : [0, 50, 100];
  const paths = [];
  for (let target = 0; target < toCount; target += 1) {
    const yTarget = slotCenter(target, toCount);
    if (fromCount === toCount * 2) {
      const yA = slotCenter(target * 2, fromCount);
      const yB = slotCenter(target * 2 + 1, fromCount);
      paths.push(`M ${x0},${yA} H ${xMid} V ${yB} H ${x0} M ${xMid},${yTarget} H ${x1}`);
    } else {
      const ySource = slotCenter(Math.min(target, fromCount - 1), fromCount);
      paths.push(ySource === yTarget
        ? `M ${x0},${ySource} H ${x1}`
        : `M ${x0},${ySource} H ${xMid} V ${yTarget} H ${x1}`);
    }
  }
  return paths;
}

/** Conectores entre cada par de columnas vecinas, con la dirección del flujo hacia la final. */
export function buildConnectors(columns) {
  const connectors = [];
  for (let i = 0; i < columns.length - 1; i += 1) {
    const left = columns[i];
    const right = columns[i + 1];
    const flowsRight = left.side === 'left';
    const from = flowsRight ? left : right;
    const to = flowsRight ? right : left;
    connectors.push({
      id: `${left.id}__${right.id}`,
      toFinal: to.isFinal,
      paths: connectorPaths(from.entries.length, to.entries.length, flowsRight ? 'ltr' : 'rtl'),
    });
  }
  return connectors;
}

// Medidas de referencia del lienzo de OBS (1920×1080). Todo el bracket de transmisión se dimensiona con
// u = min(ancho/1920, alto/1080), así llena cualquier fuente 16:9 y en otras proporciones manda el lado corto.
export const BROADCAST_REFERENCE = { width: 1920, height: 1080 };
// minCardWidth: ancho en el que un nombre de club típico ("Manchester City") entra entero junto a escudo,
// siembra y marcador con la letra de 26u. Con 316u (Oro espejado en 16:9) los nombres se cortaban.
export const BROADCAST_METRICS = {
  sidePadding: 72, // raíz + marco + panel (broadcastBracket.css)
  connectorWidth: 56,
  minCardWidth: 400,
  maxCardWidth: 520,
};

export function getBroadcastUnit(width, height) {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(width / BROADCAST_REFERENCE.width, height / BROADCAST_REFERENCE.height);
}

/** Ancho por tarjeta (en px reales) que deja un layout con `columnCount` columnas de partidos. */
export function cardWidthFor(columnCount, width, unit) {
  const { sidePadding, connectorWidth } = BROADCAST_METRICS;
  const free = width - 2 * sidePadding * unit - (columnCount - 1) * connectorWidth * unit;
  return free / columnCount;
}

/**
 * Elige el layout de transmisión según el espacio real: espejado si cada tarjeta mantiene el ancho mínimo
 * legible, si no lineal (la mitad de columnas). Devuelve también el ancho de tarjeta resultante.
 */
export function chooseBroadcastLayout(rounds, width, height) {
  const unit = getBroadcastUnit(width, height);
  const mirroredColumns = buildBracketColumns(rounds, 'mirrored').length;
  const mirroredWidth = cardWidthFor(mirroredColumns, width, unit);
  if (mirroredWidth >= BROADCAST_METRICS.minCardWidth * unit) {
    return { layout: 'mirrored', unit, cardWidth: Math.min(mirroredWidth, BROADCAST_METRICS.maxCardWidth * unit) };
  }
  const linearWidth = cardWidthFor(rounds.length, width, unit);
  return { layout: 'linear', unit, cardWidth: Math.min(linearWidth, BROADCAST_METRICS.maxCardWidth * unit) };
}

// ── Avance de las copas ────────────────────────────────────────────────────────────────────────────────────────
// Decisión del usuario (2026-10-22): el admin arma la Copa de Oro con la tabla final (1-8, 4-5, 2-7, 3-6) y desde ahí
// los ganadores pasan solos. Copa de Plata: Ronda 1 = 9.° a 12.° contra los 4 perdedores de cuartos de Oro (el 9.°
// contra el peor ubicado de ellos, el 12.° contra el mejor), después la ronda 2, y en semis entran los 2 perdedores
// de semis de Oro. Solo se completan lugares vacíos: nunca se pisa algo cargado a mano.

const isBlank = value => !String(value ?? '').trim();
const slotAt = (list, index) => (Array.isArray(list) && list[index] && typeof list[index] === 'object' ? list[index] : { ...EMPTY_BRACKET_MATCH });
const teamNames = ranking => (ranking || []).map(row => (typeof row === 'string' ? row : row?.name)).filter(name => name && name !== 'Club...');

function decided(match) {
  const side = getMatchWinner(match);
  if (!side) return null;
  return side === 'A' ? { winner: match.teamA, loser: match.teamB } : { winner: match.teamB, loser: match.teamA };
}

/**
 * «Armar Copa de Oro»: cuartos desde la tabla final. Solo si los cuartos están vacíos.
 * @returns {{ ok: true, bracket: object } | { ok: false, reason: string }}
 */
export function seedGoldCup(bracket, ranking) {
  const quarters = Array.from({ length: 4 }, (_, index) => slotAt(bracket?.quarters, index));
  if (quarters.some(match => !isBlank(match.teamA) || !isBlank(match.teamB))) {
    return { ok: false, reason: 'Los cuartos de la Copa de Oro ya tienen equipos: vacialos a mano si querés volver a armarlos.' };
  }
  let seeds;
  try {
    seeds = goldCupQuarterFinals(teamNames(ranking).map(name => ({ name })));
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true, bracket: { ...bracket, quarters: seeds.map(({ teamA, teamB }) => ({ ...EMPTY_BRACKET_MATCH, teamA, teamB })) } };
}

/**
 * Lleva a los ganadores (y a los perdedores que van a la Plata) a su próximo cruce. Idempotente: con el mismo bracket
 * devuelve el mismo bracket. Si un lugar ya tiene otro club (un resultado corregido después de avanzar), no lo toca y
 * lo avisa en `warnings`.
 * @param {object} bracket
 * @param {Array<string|{name}>} ranking tabla de la liga ordenada
 * @param {{ leagueComplete?: boolean }} options la Ronda 1 de Plata necesita la tabla final
 * @returns {{ bracket: object, changes: string[], warnings: string[] }}
 */
export function advanceCups(bracket, ranking = [], { leagueComplete = false } = {}) {
  const source = bracket || {};
  const repechaje = source.repechaje || {};
  const next = {
    ...source,
    quarters: Array.from({ length: 4 }, (_, i) => slotAt(source.quarters, i)),
    semis: Array.from({ length: 2 }, (_, i) => slotAt(source.semis, i)),
    final: source.final && typeof source.final === 'object' ? { ...source.final } : { ...EMPTY_BRACKET_MATCH },
    repechaje: {
      ...repechaje,
      r1: Array.from({ length: 4 }, (_, i) => slotAt(repechaje.r1, i)),
      r2: Array.from({ length: 2 }, (_, i) => slotAt(repechaje.r2, i)),
      semis: Array.from({ length: 2 }, (_, i) => slotAt(repechaje.semis, i)),
      final: repechaje.final && typeof repechaje.final === 'object' ? { ...repechaje.final } : { ...EMPTY_BRACKET_MATCH },
    },
  };
  const changes = [];
  const warnings = [];
  const place = (slot, side, team, label) => {
    if (isBlank(team)) return slot;
    if (isBlank(slot[side])) {
      changes.push(`${team} → ${label}`);
      return { ...slot, [side]: team };
    }
    if (teamKey(slot[side]) !== teamKey(team)) warnings.push(`${label}: figura ${slot[side]}, pero el que corresponde es ${team}. Corregilo a mano.`);
    return slot;
  };
  const fillPair = (slot, a, b, label) => place(place(slot, 'teamA', a, label), 'teamB', b, label);

  const q = next.quarters.map(decided);
  next.semis[0] = fillPair(next.semis[0], q[0]?.winner, q[1]?.winner, 'Semifinal 1 (Oro)');
  next.semis[1] = fillPair(next.semis[1], q[2]?.winner, q[3]?.winner, 'Semifinal 2 (Oro)');
  const s = next.semis.map(decided);
  next.final = fillPair(next.final, s[0]?.winner, s[1]?.winner, 'Gran Final (Oro)');

  const names = teamNames(ranking);
  if (leagueComplete && names.length >= 12 && q.every(Boolean)) {
    const position = name => {
      const index = names.findIndex(item => teamKey(item) === teamKey(name));
      return index === -1 ? names.length : index;
    };
    const losers = q.map(result => result.loser).sort((a, b) => position(a) - position(b));
    // 9.° vs el peor ubicado de los perdedores de cuartos … 12.° vs el mejor.
    for (let k = 0; k < 4; k += 1) {
      next.repechaje.r1[k] = fillPair(next.repechaje.r1[k], names[8 + k], losers[3 - k], `Preliminar ${k + 1} (Plata)`);
    }
  }
  const r1 = next.repechaje.r1.map(decided);
  next.repechaje.r2[0] = fillPair(next.repechaje.r2[0], r1[0]?.winner, r1[1]?.winner, 'Cuartos Plata 1');
  next.repechaje.r2[1] = fillPair(next.repechaje.r2[1], r1[2]?.winner, r1[3]?.winner, 'Cuartos Plata 2');
  const r2 = next.repechaje.r2.map(decided);
  next.repechaje.semis[0] = fillPair(next.repechaje.semis[0], r2[0]?.winner, s[0]?.loser, 'Semifinal Plata 1');
  next.repechaje.semis[1] = fillPair(next.repechaje.semis[1], r2[1]?.winner, s[1]?.loser, 'Semifinal Plata 2');
  const ps = next.repechaje.semis.map(decided);
  next.repechaje.final = fillPair(next.repechaje.final, ps[0]?.winner, ps[1]?.winner, 'Final Plata');

  return { bracket: changes.length ? next : source, changes, warnings };
}

/** Partidos de una copa en una lista plana (para el selector de partidos del overlay). */
export function listCupMatches(cupId, bracket) {
  return buildCupRounds(cupId, bracket).flatMap(round => round.matches);
}
