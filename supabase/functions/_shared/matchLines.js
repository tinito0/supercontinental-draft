// Compact per-player lines of one match, written by match-feed next to live_matches as
// artifacts/{APP_ID}/public/data/match_lines/{matchKey}. A whole summary is 13–35 KB; a lines document is a few KB,
// so the season pages (utils/seasonStats.js) can read every match of a season. Pure: tests/matchLines.test.js.
// Shared with the app (utils/matchStats.js re-exports minutesPlayed), so it must not import from outside
// supabase/functions.

export const MATCH_LINES_SCHEMA = 'scl.lines/1';
const SIDES = ['home', 'away'];
const GOALKEEPER = 0;
// Summary stat name → line field. Missing stats count as 0: the probe only reports kinds that moved.
const STAT_FIELDS = {
  shots: 'shots', shotsOnTarget: 'shotsOnTarget', passes: 'passes', passesCompleted: 'passesCompleted',
  tackles: 'tackles', tacklesWon: 'tacklesWon', interceptions: 'interceptions', clearances: 'clearances',
  dribblesCompleted: 'dribblesCompleted', saves: 'saves', shotsOnTargetFaced: 'shotsOnTargetFaced',
};

// The summary comes from the bridge: a field that should be a list but is not counts as empty, so a malformed
// upload cannot throw here and cost the live write (match-feed builds this in the same request).
const list = value => (Array.isArray(value) ? value : []);

/**
 * Minutes played: from kick-off, or the minute the player came on, to the end, the substitution or a red card.
 * Worked out from the summary (the game does not report it); null when the final minute or the player is unknown.
 */
export function minutesPlayed(summary, side, id) {
  const end = summary?.clock?.minute ?? null;
  if (end == null) return null;
  const subs = list(summary.substitutions).filter(sub => sub.side === side);
  const cameOn = subs.find(sub => sub.onId === id);
  const started = list(summary.lineups?.[side]?.starting).includes(id);
  if (!started && !cameOn) return null;
  const from = started ? 0 : cameOn.clock?.minute ?? null;
  const wentOff = subs.find(sub => sub.offId === id)?.clock?.minute;
  const sentOff = list(summary.cards).find(card => card.playerId === id && card.type === 'red')?.clock?.minute;
  const until = Math.min(end, wentOff ?? end, sentOff ?? end);
  return from == null ? null : Math.max(0, until - from);
}

const round2 = n => Math.round(n * 100) / 100;

const otherSide = side => (side === 'home' ? 'away' : 'home');

/**
 * Everyone who stepped on the pitch for one side: starters, then subs in the order they came on. Scorers,
 * assisters and booked players are added too, so a session that missed the lineups (an early probe, a late start)
 * still credits them. An own goal is listed under the team that benefits, so its scorer plays for the other side.
 */
function playedIds(summary, side) {
  const ids = [
    ...list(summary.lineups?.[side]?.starting),
    ...list(summary.substitutions).filter(sub => sub.side === side).map(sub => sub.onId),
    ...list(summary.lineups?.[side]?.final),
    ...list(summary.goals).filter(goal => (goal.ownGoal ? otherSide(goal.side) : goal.side) === side).map(goal => goal.playerId),
    ...list(summary.goals).filter(goal => goal.side === side).map(goal => goal.assistPlayerId),
    ...list(summary.cards).filter(card => card.side === side).map(card => card.playerId),
  ];
  return [...new Set(ids.filter(Number.isInteger))];
}

/** Sum of the shots' xG for a player; null when the summary has no shot list or a shot has no estimate. */
function playerXg(summary, id) {
  if (!Array.isArray(summary.shots)) return null;
  const own = summary.shots.filter(shot => shot.playerId === id);
  if (own.some(shot => typeof shot.xg !== 'number')) return null;
  return round2(own.reduce((sum, shot) => sum + shot.xg, 0));
}

function countWhere(items, test) {
  return items.filter(test).length;
}

function playerLine(summary, side, id) {
  const stats = list(summary.players?.[side]).find(player => player.id === id)?.stats || {};
  const fromStats = Object.fromEntries(Object.entries(STAT_FIELDS).map(([stat, field]) => [field, Number(stats[stat]) || 0]));
  const goals = list(summary.goals);
  const cards = list(summary.cards);
  return {
    id,
    side,
    name: summary.names?.players?.[id] ?? null,
    // Registered position from the bridge's names; without them, the first starter is the keeper (PES slot 0).
    position: summary.names?.positions?.[id] ?? (list(summary.lineups?.[side]?.starting)[0] === id ? GOALKEEPER : null),
    started: list(summary.lineups?.[side]?.starting).includes(id),
    minutes: minutesPlayed(summary, side, id),
    // From the goal list, not the stat kinds: an own goal is in the list under the team that benefits.
    goals: countWhere(goals, goal => goal.playerId === id && !goal.ownGoal),
    ownGoals: countWhere(goals, goal => goal.playerId === id && goal.ownGoal),
    assists: countWhere(goals, goal => goal.assistPlayerId === id),
    yellow: countWhere(cards, card => card.playerId === id && card.type === 'yellow'),
    red: countWhere(cards, card => card.playerId === id && card.type === 'red'),
    ...fromStats,
    xg: playerXg(summary, id),
    rating: typeof summary.ratings?.[id] === 'number' ? summary.ratings[id] : null,
  };
}

function teamHeader(liveDoc, summary, side) {
  return {
    gameTeamId: liveDoc[`${side}GameTeamId`],
    draftTeamId: liveDoc[`${side}DraftTeamId`],
    name: liveDoc[`${side}Name`],
    score: liveDoc.score[side],
    xg: typeof summary.xg?.[side] === 'number' ? round2(summary.xg[side]) : null,
  };
}

/**
 * The match_lines document for a match.
 * @param {object} liveDoc the validated live_matches fields (buildLiveMatchDoc in matchFeed.js)
 * @param {object} summary the summary that produced it
 */
/**
 * The goals in match order, for records that need the minute (fastest goal, comebacks). `side` is the team the goal
 * counts for, also for an own goal. Goals without a clock are left out.
 */
function goalList(summary) {
  return list(summary.goals)
    .filter(goal => SIDES.includes(goal?.side) && Number.isInteger(goal.clock?.minute))
    .map(goal => ({
      side: goal.side,
      minute: goal.clock.minute,
      second: Number.isInteger(goal.clock.second) ? goal.clock.second : 0,
      playerId: goal.playerId ?? null,
      ownGoal: Boolean(goal.ownGoal),
    }))
    .sort((a, b) => a.minute - b.minute || a.second - b.second);
}

export function buildMatchLinesDoc(liveDoc, summary) {
  const shootout = summary.shootout && Number.isInteger(summary.shootout.home) && Number.isInteger(summary.shootout.away)
    ? { home: summary.shootout.home, away: summary.shootout.away }
    : null;
  return {
    schema: MATCH_LINES_SCHEMA,
    matchKey: liveDoc.matchKey,
    status: liveDoc.status,
    startedAt: liveDoc.startedAt,
    competition: summary.match?.competition ?? null,
    home: teamHeader(liveDoc, summary, 'home'),
    away: teamHeader(liveDoc, summary, 'away'),
    shootout,
    goals: goalList(summary),
    players: SIDES.flatMap(side => playedIds(summary, side).map(id => playerLine(summary, side, id))),
  };
}
