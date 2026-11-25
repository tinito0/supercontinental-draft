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
    return { name: team.name, draftTeamId: team.draftTeamId ?? null, formation: formationLabel(team.players), lines };
  });
}

/** Lo que le queda en pantalla a toda la animación (todos los equipos), como un popup con autoHideSec. */
export function lineupIntroRemainingMs(intro, nowMs) {
  const count = validTeams(intro).length;
  if (!count) return 0;
  return timedRemainingMs({ ...intro, autoHideSec: teamSec(intro) * count }, nowMs);
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
