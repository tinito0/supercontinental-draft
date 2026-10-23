// Saved game plan of each team (EDIT00000000: lineup order, formation, shirt numbers, team strategy), added to a
// match summary as `teamPlans` only when it is the plan the match was played with.
//
// The probe does not see formations or positions (docs/PES_MATCH_DATA_RESEARCH.md). What it does see is the kick-off
// XI in pitch-slot order, and in 7 of 8 recorded team-matches that order equalled the save's lineup slot by slot,
// with each player's registered position equal to the formation role of that slot (S11). So when the XI matches,
// slot i played formation entry i of the saved plan. When it does not (the save is stale, or the lineup was changed
// before kick-off), nothing of the plan is used. Changes made during the match are never visible.

const SIDES = ['home', 'away'];

/**
 * Plan of one team from a decoded save (pes/formats/pes2021/editDatabase.js), or null when the save has none.
 * @returns {null | { lineup: number[], numbers: Record<number, number>, roles: number[], pos: number[][],
 *   strategy: Record<string, number>, advanced: number[] }}
 */
export function readTeamPlan(edit, teamId) {
  if (!edit) return null;
  let roster;
  let tactics;
  try {
    roster = edit.roster(teamId);
    tactics = edit.readTactics(teamId);
  } catch {
    return null; // team not in the save, or without a squad/game plan
  }
  const bySlot = new Map(roster.map(entry => [entry.slot, entry]));
  const lineup = tactics.order.slice(0, 11).map(slot => bySlot.get(slot)?.playerId ?? null);
  if (lineup.some(id => id == null)) return null;
  return {
    lineup,
    numbers: Object.fromEntries(roster.map(entry => [entry.playerId, entry.number])),
    roles: tactics.formation.roles,
    pos: tactics.formation.pos,
    strategy: tactics.strategy,
    advanced: tactics.advanced,
  };
}

function planForSide(summary, side, plan) {
  const kickoff = summary.lineups?.[side]?.starting || [];
  if (!plan) return { status: 'missing' };
  if (kickoff.length !== 11) return { status: 'unknown' }; // kick-off XI not read yet
  if (!kickoff.every((id, slot) => id === plan.lineup[slot])) return { status: 'differs' };
  const played = new Set([...kickoff, ...(summary.substitutions || []).filter(s => s.side === side).map(s => s.onId)]);
  const numbers = {};
  for (const id of played) if (Number.isInteger(plan.numbers[id])) numbers[id] = plan.numbers[id];
  return { status: 'matches', roles: plan.roles, pos: plan.pos, numbers, strategy: plan.strategy, advanced: plan.advanced };
}

/**
 * Copy of the summary with `teamPlans: { home, away }`. Each side is { status } where status is 'matches' (then
 * also roles, pos, numbers, strategy, advanced), 'differs', 'unknown' (no kick-off XI yet) or 'missing' (no plan).
 * @param {(teamId: number) => ReturnType<typeof readTeamPlan>} planOf
 */
export function attachTeamPlans(summary, planOf) {
  if (!summary || typeof planOf !== 'function') return summary;
  const teamPlans = {};
  for (const side of SIDES) {
    teamPlans[side] = planForSide(summary, side, planOf(summary.match?.[`${side}TeamId`]));
  }
  return { ...summary, teamPlans };
}
