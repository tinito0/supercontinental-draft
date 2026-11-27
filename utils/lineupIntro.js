// Once inicial animado sobre el juego (components/broadcast/LineupIntro.jsx) mientras carga el partido: el probe lee
// el once y la formación con que se cargó el partido (evento `prematch`), el bridge los manda a overlay-control
// (acción `lineup`) y quedan en el doc del overlay como `lineupIntro`. Puro; tests/lineupIntro.test.js.
import { roleLabel } from './matchAnalysis.js';
import { timedRemainingMs } from './overlayPopup.js';

/** Tiempo de cada equipo en pantalla si el doc no lo trae (LINEUP_TEAM_SECONDS de overlay-control). */
export const LINEUP_INTRO_TEAM_SEC = 9;
/** Dos jugadores de campo a menos de esta profundidad del juego (unidades 4–47) van en la misma línea. */
const LINE_GAP = 5;

/**
 * Líneas del arco hacia adelante (arquero primero), cada una de la banda izquierda a la derecha (lateral del juego:
 * 5 izquierda … 99 derecha, mirando al arco rival).
 * @param {Array<{ depth: number, lateral: number }>} players los 11, el arquero en el índice 0
 * @returns {Array<Array<object>>}
 */
export function formationLines(players) {
  if (!players?.length) return [];
  const [keeper, ...outfield] = players;
  const lines = [[keeper]];
  let current = null;
  let lastDepth = -Infinity;
  for (const player of [...outfield].sort((a, b) => a.depth - b.depth)) {
    if (!current || player.depth - lastDepth >= LINE_GAP) {
      current = [];
      lines.push(current);
    }
    current.push(player);
    lastDepth = player.depth;
  }
  return lines.map(line => [...line].sort((a, b) => a.lateral - b.lateral));
}

/** Cancha del once (lineupIntro.css: .scl-xi-pitch sin su relleno) y tarjeta de jugador, en px. */
export const XI_PITCH = { width: 1504, height: 496, cardWidth: 284, cardHeight: 88, gap: 10 };
// Lateral del juego: 5 = banda izquierda … 99 = banda derecha.
const LATERAL_MIN = 5;
const LATERAL_MAX = 99;
const SEPARATE_PASSES = 40;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Separa las tarjetas que se pisan, por el eje en que menos se pisan, sin salir de la cancha. */
function separate(cards, pitch) {
  const maxX = pitch.width - pitch.cardWidth;
  const maxY = pitch.height - pitch.cardHeight;
  const spanX = pitch.cardWidth + pitch.gap;
  const spanY = pitch.cardHeight + pitch.gap;
  let placed = cards.map(card => ({ ...card }));
  for (let pass = 0; pass < SEPARATE_PASSES; pass += 1) {
    let moved = false;
    placed = placed.map((card, i) => {
      let { x, y } = card;
      placed.forEach((other, j) => {
        if (i === j) return;
        const dx = x - other.x;
        const dy = y - other.y;
        const overlapX = spanX - Math.abs(dx);
        const overlapY = spanY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) return;
        moved = true;
        // Cada una se corre la mitad; con la misma coordenada decide el orden (la de índice menor, arriba/izquierda).
        const away = (delta, fallback) => (delta === 0 ? fallback : Math.sign(delta));
        if (overlapY <= overlapX) y += (away(dy, i < j ? -1 : 1) * overlapY) / 2;
        else x += (away(dx, i < j ? -1 : 1) * overlapX) / 2;
      });
      return { ...card, x: clamp(x, 0, maxX), y: clamp(y, 0, maxY) };
    });
    if (!moved) break;
  }
  return placed;
}

/**
 * Dónde va cada tarjeta en la cancha (arco propio a la izquierda, banda izquierda arriba), con las coordenadas del
 * juego: el arquero contra su arco, los de campo estirados por profundidad entre la defensa y el ataque, y la altura
 * por el lateral. Las que se pisan se separan lo justo.
 * @param {Array<Array<{ depth: number, lateral: number }>>} lines formationLines (arquero en la primera)
 * @returns {Array<object>} cada jugador con x, y (px, esquina superior izquierda), line y slot (su línea y su lugar
 *   en ella, de izquierda a derecha: el orden de entrada)
 */
export function pitchLayout(lines, pitch = XI_PITCH) {
  if (!lines?.length) return [];
  const maxX = pitch.width - pitch.cardWidth;
  const maxY = pitch.height - pitch.cardHeight;
  const outfield = lines.slice(1).flat();
  const depths = outfield.map(player => player.depth);
  const [minDepth, maxDepth] = [Math.min(...depths), Math.max(...depths)];
  const firstX = pitch.cardWidth + pitch.gap * 3;
  const xOf = depth => (maxDepth > minDepth ? firstX + ((depth - minDepth) / (maxDepth - minDepth)) * (maxX - firstX) : (firstX + maxX) / 2);
  const yOf = lateral => clamp((lateral - LATERAL_MIN) / (LATERAL_MAX - LATERAL_MIN), 0, 1) * maxY;
  const cards = lines.flatMap((line, lineIndex) => line.map((player, slot) => ({
    ...player,
    line: lineIndex,
    slot,
    x: lineIndex === 0 ? 0 : xOf(player.depth),
    y: lineIndex === 0 ? maxY / 2 : yOf(player.lateral),
  })));
  return separate(cards, pitch).map(card => ({ ...card, x: Math.round(card.x), y: Math.round(card.y) }));
}

// Códigos de puesto del juego (ROLE_LABELS de utils/matchAnalysis.js): 1–3 defensa, 4 MCD, 5–8 medio, 9–12 ataque.
const roleGroup = role => {
  if (role >= 1 && role <= 3) return 'def';
  if (role === 4) return 'pivot';
  if (role >= 5 && role <= 8) return 'mid';
  if (role >= 9 && role <= 12) return 'att';
  return null;
};

/**
 * El dibujo como lo dice la tele («4-3-3», «3-5-2»), por los puestos y no por las columnas de la cancha (que separan
 * a un volante un poco más adelantado). Con un solo delantero y doble MCD, los MCD van en su propia línea: «4-2-3-1».
 * @param {Array<{ role: number }>} players los 11
 */
export function formationLabel(players) {
  const count = { def: 0, pivot: 0, mid: 0, att: 0 };
  for (const player of players ?? []) {
    const group = roleGroup(player.role);
    if (group) count[group] += 1;
  }
  const splitPivots = count.pivot >= 2 && count.mid > 0 && count.att <= 1;
  const middle = splitPivots ? [count.pivot, count.mid] : [count.pivot + count.mid];
  return [count.def, ...middle, count.att].filter(Boolean).join('-');
}

const teamSec = intro => (Number(intro?.teamSec) > 0 ? Number(intro.teamSec) : LINEUP_INTRO_TEAM_SEC);
const validTeams = intro => (Array.isArray(intro?.teams) ? intro.teams.filter(team => team?.players?.length === 11) : []);

/**
 * Los equipos listos para dibujar: líneas, dibujo («4-4-2») y el puesto de cada jugador («DFC»).
 * @param {object|null} intro el campo `lineupIntro` del doc del overlay
 * @returns {Array<{ name: string, draftTeamId: string|null, formation: string, lines: object[][] }>}
 */
export function introTeams(intro) {
  return validTeams(intro).map(team => {
    const lines = formationLines(team.players.map(player => ({ ...player, roleLabel: roleLabel(player.role) })));
    return { name: team.name, draftTeamId: team.draftTeamId ?? null, formation: formationLabel(team.players), lines, cards: pitchLayout(lines) };
  });
}

/** Lo que le queda en pantalla a toda la animación (todos los equipos), como un popup con autoHideSec. */
export function lineupIntroRemainingMs(intro, nowMs) {
  const count = validTeams(intro).length;
  if (!count) return 0;
  return timedRemainingMs({ ...intro, autoHideSec: teamSec(intro) * count }, nowMs);
}

/**
 * Cuándo tiene que volver a mirar el reloj la animación: al empezar la salida del equipo en pantalla (leaveMs antes
 * del cambio) y al terminarla, y al menos una vez por segundo. Sin esto el reloj avanzaba de a un segundo y la
 * salida de 300 ms casi nunca caía en un tick: el equipo se cortaba sin swipe (2026-11-26).
 * @returns {number} ms hasta el próximo tick
 */
export function introWakeMs(intro, remainingMs, leaveMs) {
  const step = introStep(intro, remainingMs);
  if (!step) return remainingMs;
  const untilLeave = step.remainingMs - leaveMs;
  return untilLeave > 0 ? Math.min(untilLeave, 1000) : step.remainingMs;
}

/**
 * Ritmo del once (ms), con barridos de components/broadcast/wipe.css. Entrada: el panel, después el encabezado
 * (escudo, nombre, formación, sello), y los jugadores uno por uno en `order` con `staggerMs` entre cada
 * uno y `lineGapMs` extra al pasar de línea. Salida (`leaveMs` antes del cambio de equipo): los jugadores en el mismo
 * orden, después el encabezado y al final el panel.
 */
export const XI_MOTION = Object.freeze({
  panelMs: 600,
  headStartMs: 260,
  headStepMs: 90,
  playersStartMs: 760,
  staggerMs: 80,
  lineGapMs: 140,
  wipeMs: 520,
  order: 'keeper-first',
  inDirection: 'right',
  outDirection: 'right',
  outStaggerMs: 30,
  outWipeMs: 380,
  headOutMs: 300,
  headOutStepMs: 40,
  panelOutDelayMs: 800,
  panelOutMs: 440,
  leaveMs: 1250,
});

/** Órdenes de aparición: del arco hacia adelante, de los delanteros hacia atrás, o de la banda izquierda a la derecha. */
export const XI_ORDERS = Object.freeze({
  'keeper-first': (a, b) => a.line - b.line || a.slot - b.slot,
  'forwards-first': (a, b) => b.line - a.line || a.slot - b.slot,
  'top-down': (a, b) => a.y - b.y || a.x - b.x,
});

/**
 * Cuándo arranca el barrido de cada jugador, a la entrada y a la salida (relativo al comienzo de la salida).
 * @param {Array<{ id: number, line: number, slot: number, x: number, y: number }>} cards de pitchLayout
 * @returns {Record<number, { inMs: number, outMs: number }>} por id de jugador
 */
export function wipeSchedule(cards, motion = XI_MOTION) {
  const sorted = [...(cards || [])].sort(XI_ORDERS[motion.order] || XI_ORDERS['keeper-first']);
  const byLine = motion.order !== 'top-down';
  let lineBreaks = 0;
  return Object.fromEntries(sorted.map((card, rank) => {
    if (byLine && rank > 0 && card.line !== sorted[rank - 1].line) lineBreaks += 1;
    const inMs = motion.playersStartMs + rank * motion.staggerMs + lineBreaks * motion.lineGapMs;
    return [card.id, { inMs, outMs: rank * motion.outStaggerMs }];
  }));
}

/**
 * Qué equipo va en pantalla según lo que le queda a la animación: su índice y cuánto le queda a ese equipo.
 * @returns {null | { index: number, remainingMs: number }}
 */
export function introStep(intro, remainingMs) {
  const count = validTeams(intro).length;
  if (!count || !remainingMs) return null;
  const teamMs = teamSec(intro) * 1000;
  const elapsed = Math.max(0, count * teamMs - remainingMs);
  const index = Math.min(count - 1, Math.floor(elapsed / teamMs));
  return { index, remainingMs: (index + 1) * teamMs - elapsed };
}
