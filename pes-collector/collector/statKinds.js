// Stat kinds of the in-memory per-player records (docs/PES_MATCH_DATA_RESEARCH.md, S1–S9). Each kind is 9 u32:
// words 0–5 are the 15-minute buckets of regular time, 6 and 7 the two extra-time halves, 8 is not a match
// stat (it did not follow the shootout), so a match total is the sum of the first 8.

export const MATCH_WORDS = 8;

// Names follow the post-match screens. Checked live against them over three matches unless marked.
// The pass types (24–31) are not on any screen: their names are the getters' (research doc S1), and in all three
// recorded matches short + through + long + cross = passes (22) and their completions add up to kind 23.
export const KIND = {
  goals: 0,
  ownGoals: 1,
  freeKickGoals: 2,
  penaltyGoals: 3,
  assists: 4,
  shots: 6,
  shotsOnTarget: 17,
  penaltyShots: 21, // static name only; matched the in-play penalties of one match
  passes: 22,
  passesCompleted: 23,
  shortPasses: 24,
  shortPassesCompleted: 25,
  throughPasses: 26,
  throughPassesCompleted: 27,
  longPasses: 28,
  longPassesCompleted: 29,
  crosses: 30,
  crossesCompleted: 31,
  tackles: 49, // individual screen "Duelos" X
  tacklesWon: 50, // individual "Duelos" (Y) and team screen "Entradas"
  clearances: 54,
  fouls: 55,
  offsides: 56,
  yellowCards: 57,
  redCards: 58,
  freeKicks: 61,
  corners: 63,
  dribbles: 65,
  dribblesCompleted: 66,
  touches: 67,
  interceptions: 78,
  shotsFaced: 131,
  shotsOnTargetFaced: 132,
  saves: 133,
};

export const KIND_NAME = Object.fromEntries(Object.entries(KIND).map(([name, kind]) => [kind, name]));

// Rows of the team stats screen that are sums of the players (possession is not: it is not in the records).
// Goals are not summed: own goals are credited to the other side, so the score comes from `state` instead.
export const TEAM_STATS = [
  'shots', 'shotsOnTarget', 'fouls', 'offsides', 'corners', 'freeKicks', 'passes', 'passesCompleted',
  'crosses', 'interceptions', 'tacklesWon', 'saves', 'yellowCards', 'redCards',
  // Not on the team screen, but plain sums of the players like the rows above.
  'shortPasses', 'shortPassesCompleted', 'throughPasses', 'throughPassesCompleted', 'longPasses',
  'longPassesCompleted', 'crossesCompleted', 'tackles', 'clearances', 'dribbles', 'dribblesCompleted', 'touches',
  'penaltyShots',
];

// Kinds kept per minute of play (summary.series): what the momentum chart and the period breakdown read.
export const SERIES_STATS = [
  'shots', 'shotsOnTarget', 'corners', 'crosses', 'throughPasses', 'passes', 'passesCompleted', 'touches',
];

/** Match total of one kind (9 raw values as emitted by the probe). */
export function kindTotal(values) {
  if (!Array.isArray(values)) return 0;
  return values.slice(0, MATCH_WORDS).reduce((sum, v) => sum + (Number(v) || 0), 0);
}
