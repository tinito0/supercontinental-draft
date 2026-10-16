// Estructura de las dos copas eliminatorias y geometría compartida del bracket.
// Una sola fuente para la vista de la app (editable), la de OBS y la selección de partidos del overlay.
// Datos en Firestore (tournament/official): bracket.{quarters[4], semis[2], final{}} para la Copa de Oro y
// bracket.repechaje.{r1[4], r2[2], semis[2], final{}} para la Copa de Plata.

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

export function hasScore(value) {
  return value !== '' && value !== undefined && value !== null && Number.isFinite(Number(value));
}

/** 'A' | 'B' | null. Un empate o un resultado incompleto no tiene ganador (no se modelan penales). */
export function getMatchWinner(match) {
  if (!match || !hasScore(match.scoreA) || !hasScore(match.scoreB)) return null;
  const a = Number(match.scoreA);
  const b = Number(match.scoreB);
  if (a === b) return null;
  return a > b ? 'A' : 'B';
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
  sidePadding: 56,
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

/** Partidos de una copa en una lista plana (para el selector de partidos del overlay). */
export function listCupMatches(cupId, bracket) {
  return buildCupRounds(cupId, bracket).flatMap(round => round.matches);
}
