// Starting XI of the match being loaded, from the probe's `prematch` events (probe v7): the plan and order in
// MATCH_INFO between the match setup and kick-off, with the squad the order indexes. It is the plan the match was
// loaded with (research doc S12): changes made on the pre-match screen only reach MATCH_INFO at kick-off.
// Pure; tests/pesCollector/prematch.test.js.
import { decodePlan } from './formations.js';

const SIDES = ['home', 'away'];

/** One side from its newest prematch event: { ids, roles, pos } of the XI by formation slot, or null. */
function sideOf(event) {
  const plan = decodePlan(event?.plan);
  if (!plan || !Array.isArray(event.order) || !Array.isArray(event.squad)) return null;
  const ids = event.order.slice(0, 11).map(index => event.squad[index]);
  if (ids.length !== 11 || !ids.every(id => Number.isInteger(id) && id > 0)) return null;
  const [kickoff] = plan.variants;
  return { ids, roles: kickoff.roles, pos: kickoff.pos };
}

/**
 * The XI of both teams of the newest session, while its match has not started; null once it kicked off (a
 * `stats_appeared` after the session), or while a side is still unknown.
 * @param {object[]} events parsed events.ndjson lines
 * @returns {null | { session: { ts: string, homeTeamId: number, awayTeamId: number, tournamentId: number|null },
 *   home: { ids: number[], roles: number[], pos: number[][] }, away: object }}
 */
export function prematchLineups(events) {
  const start = events.map(event => event.t).lastIndexOf('session');
  if (start < 0) return null;
  const session = events[start];
  const after = events.slice(start + 1);
  if (after.some(event => event.t === 'stats_appeared')) return null;
  const sides = {};
  for (const [index, side] of SIDES.entries()) {
    sides[side] = sideOf(after.filter(event => event.t === 'prematch' && event.side === index).at(-1));
    if (!sides[side]) return null;
  }
  return {
    session: {
      ts: session.ts ?? null,
      homeTeamId: session.home_team ?? null,
      awayTeamId: session.away_team ?? null,
      tournamentId: session.tournament_id ?? null,
    },
    ...sides,
  };
}
