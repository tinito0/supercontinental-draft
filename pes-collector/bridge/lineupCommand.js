// The overlay-control command that plays the OBS starting-XI animation (components/broadcast/LineupIntro.jsx) while
// a match loads: both XIs from the probe's prematch events (collector/prematch.js), with the names of the database
// and the save and the shirt numbers of the save. Pure; tests/pesCollector/lineupCommand.test.js.

const SIDES = ['home', 'away'];

/** Key of one loaded match: the session start (compact UTC) and both game team ids. Sent once per key. */
export function lineupKey(session) {
  const started = String(session?.ts || '').replace(/[-:]/g, '').replace(/\.\d+/, '');
  return `${started}_${session?.homeTeamId}-${session?.awayTeamId}`;
}

/**
 * @param {ReturnType<import('../collector/prematch.js').prematchLineups>} prematch
 * @param {{ teamMap?: Map<number, { draftTeamId, name }>|null, names?: { teams: Map, players: Map }|null,
 *   numbersOf?: (teamId: number) => Record<number, number>|null }} context
 * @returns {null | { action: 'lineup', key: string, teams: object[] }} null when a team is outside the league
 */
export function buildLineupCommand(prematch, { teamMap = null, names = null, numbersOf = () => null } = {}) {
  if (!prematch) return null;
  const teamIdOf = side => prematch.session[`${side}TeamId`];
  if (teamMap && !SIDES.every(side => teamMap.has(teamIdOf(side)))) return null;
  const teams = SIDES.map(side => {
    const teamId = teamIdOf(side);
    const assigned = teamMap?.get(teamId);
    const numbers = numbersOf(teamId) || {};
    const { ids, roles, pos } = prematch[side];
    return {
      name: assigned?.name || names?.teams?.get(teamId) || `Equipo ${teamId}`,
      draftTeamId: assigned?.draftTeamId ?? null,
      players: ids.map((id, slot) => ({
        id,
        name: names?.players?.get(id) || null,
        number: Number.isInteger(numbers[id]) ? numbers[id] : null,
        role: roles[slot],
        depth: pos[slot][0],
        lateral: pos[slot][1],
      })),
    };
  });
  return { action: 'lineup', key: lineupKey(prematch.session), teams };
}
