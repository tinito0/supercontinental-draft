// Squad rules of the season reglamento (T3): bench average, squad minimum and local players.
// The bench is every squad player outside the saved starting XI. Its average is exact (one decimal shown):
// rounding would let a 72.6 bench pass a 73 floor.

import { strengthBarScale } from './teamStrength.js';

export const BENCH_MIN_AVG_OVR = 73;
export const SQUAD_MIN_PLAYERS = 21;
export const LOCAL_MIN_PLAYERS = 7;
export const STARTERS_COUNT = 11;

const idOf = player => String(player?.Id ?? player?.id ?? player?.playerId ?? '');

/** Ids of the starters in a lineup map ({ slot: playerId }) that are still in the squad. */
export function starterIds(lineup, squad) {
  const inSquad = new Set((squad || []).map(idOf).filter(Boolean));
  return new Set(Object.values(lineup || {}).map(String).filter(id => inSquad.has(id)));
}

/** The squad players outside the starting XI. */
export function benchPlayers(squad, lineup) {
  const starters = starterIds(lineup, squad);
  return (squad || []).filter(player => idOf(player) && !starters.has(idOf(player)));
}

/** Exact average OVR, or null for an empty list. */
export function averageOvr(players) {
  if (!players?.length) return null;
  return players.reduce((sum, player) => sum + (Number(player.OVR_CALCULADO) || 0), 0) / players.length;
}

/** «72,6»: the bench average as the reglamento reads it. */
export function formatAverage(value) {
  return value == null ? '–' : value.toFixed(1).replace('.', ',');
}

/** Born in or holding the nationality of the club's country (first or second nationality). */
export function isLocalPlayer(player, teamCountry) {
  if (teamCountry == null || teamCountry === '') return false;
  const country = String(teamCountry);
  return String(player?.Country1 ?? '') === country || String(player?.Country2 ?? '') === country;
}

/**
 * The bench rule for one lineup. It is measured only with a full XI and a squad at the reglamento minimum:
 * before that the bench is still being built and blocking a save would stop the draft itself.
 * @returns {{ applies: boolean, ok: boolean, average: number|null, benchCount: number, reason: string|null }}
 */
export function checkBench(squad, lineup) {
  const size = squad?.length || 0;
  const startersCount = starterIds(lineup, squad).size;
  const bench = benchPlayers(squad, lineup);
  const average = averageOvr(bench);
  if (size < SQUAD_MIN_PLAYERS) {
    return { applies: false, ok: true, average, benchCount: bench.length, reason: `Se mide desde los ${SQUAD_MIN_PLAYERS} jugadores` };
  }
  if (startersCount < STARTERS_COUNT) {
    return { applies: false, ok: true, average, benchCount: bench.length, reason: 'Se mide con el once completo' };
  }
  const ok = average != null && average >= BENCH_MIN_AVG_OVR;
  return { applies: true, ok, average, benchCount: bench.length, reason: null };
}

/**
 * The three squad rules for a team, in reglamento order.
 * @param {{ squad: object[], lineup: object, teamCountry: number|string }} team
 * `fill` and `tick` (0..1) draw each rule's meter: counts fill up to their minimum (a full bar is the minimum met);
 * the bench uses the same OVR scale as «Fuerza del once», with the 73 floor marked by the tick.
 * @returns {{ ok: boolean, rules: Array<{ id: string, label: string, ok: boolean, applies: boolean, value: string, target: string, detail: string, fill: number, tick: number|null }> }}
 */
export function evaluateSquadRules({ squad, lineup, teamCountry }) {
  const players = squad || [];
  const bench = checkBench(players, lineup);
  const locals = players.filter(player => isLocalPlayer(player, teamCountry)).length;
  const hasCountry = teamCountry != null && teamCountry !== '';

  const rules = [
    {
      id: 'squad',
      label: 'Plantel mínimo',
      ok: players.length >= SQUAD_MIN_PLAYERS,
      applies: true,
      value: String(players.length),
      target: String(SQUAD_MIN_PLAYERS),
      detail: players.length >= SQUAD_MIN_PLAYERS
        ? 'Cumple'
        : `Faltan ${SQUAD_MIN_PLAYERS - players.length}`,
      fill: Math.min(1, players.length / SQUAD_MIN_PLAYERS),
      tick: null,
    },
    {
      id: 'bench',
      label: 'Media del banco',
      ok: bench.ok,
      applies: bench.applies,
      value: formatAverage(bench.average),
      target: String(BENCH_MIN_AVG_OVR),
      detail: !bench.applies ? bench.reason : bench.ok ? 'Cumple' : 'Por debajo del mínimo',
      fill: strengthBarScale(bench.average),
      tick: strengthBarScale(BENCH_MIN_AVG_OVR),
    },
    {
      id: 'locals',
      label: 'Jugadores locales',
      ok: hasCountry && locals >= LOCAL_MIN_PLAYERS,
      applies: hasCountry,
      value: String(locals),
      target: String(LOCAL_MIN_PLAYERS),
      detail: !hasCountry
        ? 'Club sin país cargado'
        : locals >= LOCAL_MIN_PLAYERS ? 'Cumple' : `Faltan ${LOCAL_MIN_PLAYERS - locals}`,
      fill: Math.min(1, locals / LOCAL_MIN_PLAYERS),
      tick: null,
    },
  ];
  return { ok: rules.every(rule => rule.ok), rules };
}

/** Message shown when a lineup cannot be saved because of the bench rule. */
export function benchBlockMessage(check) {
  return `El banco queda en ${formatAverage(check.average)} de media y el mínimo es ${BENCH_MIN_AVG_OVR}. Mandá al banco a un jugador de más media o reemplazá a un suplente.`;
}

/**
 * One row per approved club for the admin board: its squad (from player_locks, the ownership record), its saved
 * lineup and country, and the rules result. Failing clubs first, then by name.
 */
export function buildTeamRuleRows(allTeams, playerLocks, playersById) {
  const squads = new Map();
  Object.entries(playerLocks || {}).forEach(([playerId, lock]) => {
    const player = playersById.get(String(playerId));
    if (!lock?.lockedBy || !player) return;
    if (!squads.has(lock.lockedBy)) squads.set(lock.lockedBy, []);
    squads.get(lock.lockedBy).push(player);
  });
  return Object.entries(allTeams || {})
    .filter(([, team]) => team && team.approved !== false)
    .map(([userId, team]) => ({
      userId,
      teamName: team.teamName || 'Sin nombre',
      logoUrl: team.logoUrl,
      result: evaluateSquadRules({ squad: squads.get(userId) || [], lineup: team.lineup, teamCountry: team.country }),
    }))
    .sort((a, b) => Number(a.result.ok) - Number(b.result.ok) || a.teamName.localeCompare(b.teamName));
}
