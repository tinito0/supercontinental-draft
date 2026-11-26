// Overall rating at the registered position, ported from Ejogc327's PES2020Editor.exe V0.12.8 (class _204B).
// Matches its OverallStats export for all 27 437 players of the league database.

const OUTFIELD = ['offensiveAwareness', 'ballControl', 'dribbling', 'tightPossession', 'lowPass', 'loftedPass',
  'finishing', 'heading', 'placeKicking', 'curl', 'speed', 'acceleration', 'kickingPower', 'jump', 'physicalContact',
  'balance', 'stamina', 'defensiveAwareness', 'ballWinning', 'aggression'];
const GOALKEEPING = ['gkAwareness', 'gkCatching', 'gkClearing', 'gkReflexes', 'gkReach'];

/** Player.bin fields (binLayout names) the rating reads. */
export const RATING_FIELDS = Object.freeze([...OUTFIELD, ...GOALKEEPING, 'weakFootAcc', 'registeredPosition']);

// One row per position (0 PT … 12 DC), one weight per OUTFIELD stat.
const WEIGHTS = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.11, 0.11, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0.22, 0, 0, 0.1, 0, 0, 0.19, 0.19, 0, 0.09, 0.25, 0.17, 0.08],
  [0.06, 0.09, 0.09, 0.05, 0, 0.14, 0, 0, 0, 0, 0.16, 0.14, 0, 0.11, 0.08, 0.04, 0.14, 0.14, 0.08, 0.05],
  [0.06, 0.09, 0.09, 0.05, 0, 0.14, 0, 0, 0, 0, 0.16, 0.14, 0, 0.11, 0.08, 0.04, 0.14, 0.14, 0.08, 0.05],
  [0.07, 0.18, 0.1, 0.05, 0.18, 0.19, 0, 0, 0, 0.12, 0.03, 0.03, 0, 0.05, 0.09, 0.04, 0.14, 0.07, 0.03, 0.01],
  [0.05, 0.23, 0.16, 0.08, 0.23, 0.21, 0, 0, 0, 0, 0.04, 0.06, 0, 0, 0.03, 0.02, 0.17, 0.03, 0, 0],
  [0.07, 0.15, 0.17, 0.08, 0.07, 0.12, 0, 0, 0, 0.04, 0.24, 0.21, 0, 0, 0, 0, 0.13, 0, 0, 0],
  [0.07, 0.15, 0.17, 0.08, 0.07, 0.12, 0, 0, 0, 0.04, 0.24, 0.21, 0, 0, 0, 0, 0.13, 0, 0, 0],
  [0.14, 0.23, 0.17, 0.07, 0.21, 0.14, 0.17, 0, 0, 0, 0.05, 0.07, 0, 0, 0.02, 0.03, 0.03, 0, 0, 0],
  [0.17, 0.19, 0.15, 0.07, 0.05, 0.09, 0.11, 0, 0, 0, 0.15, 0.15, 0.05, 0, 0.02, 0.04, 0.06, 0, 0, 0],
  [0.17, 0.19, 0.15, 0.07, 0.05, 0.09, 0.11, 0, 0, 0, 0.15, 0.15, 0.05, 0, 0.02, 0.04, 0.06, 0, 0, 0],
  [0.15, 0.19, 0.13, 0.06, 0.09, 0.09, 0.14, 0, 0, 0, 0.09, 0.21, 0.06, 0, 0.02, 0.05, 0.04, 0, 0, 0],
  [0.31, 0.23, 0.09, 0.05, 0, 0, 0.36, 0.03, 0, 0, 0.05, 0.05, 0.03, 0.03, 0.08, 0.02, 0, 0, 0, 0],
];
const WEAK_FOOT_WEIGHTS = [0, 0.23, 0.56, 0.56, 0.23, 0.23, 0.56, 0.56, 0.37, 0.47, 0.47, 0.37, 0.38];
const REGISTERED_POSITION_BONUS = [8, 8, 9, 9, 9, 8, 8, 8, 8, 10, 10, 9, 8];
// Indexed by the average of the 22 ability values minus 40; outfield ratings blend 60/40 with it.
const AVERAGE_CURVE = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 56, 59,
  62, 65, 67, 70, 73, 75, 77, 79, 82, 83, 85, 87, 89, 90, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105,
  106, 107, 108, 109, 110, 111, 112, 113];
const MIN_RATING = 40;

/**
 * @param {Record<string, number>} player RATING_FIELDS values as Player.bin stores them (abilities 40–99,
 *   weakFootAcc 1–4, registeredPosition 0–12).
 * @returns {number}
 */
export function playerRating(player) {
  const pos = player.registeredPosition;
  if (!Number.isInteger(pos) || pos < 0 || pos >= WEIGHTS.length) {
    throw new RangeError(`Posición registrada inválida: ${pos}`);
  }
  const [awareness, catching, clearing, reflexes, reach] = GOALKEEPING.map(f => player[f]);
  // Integer division, as in the original.
  const gkPair = Math.trunc((awareness + reach) / 2);
  const gkTrio = Math.trunc((catching + clearing + reflexes) / 3);

  let weighted = pos === 0 ? (gkPair - 25) * 0.5 + (gkTrio - 25) * 0.48 : 0;
  let total = gkPair + gkTrio;
  OUTFIELD.forEach((field, i) => {
    weighted += (player[field] - 25) * WEIGHTS[pos][i];
    total += player[field];
  });
  weighted += (player.weakFootAcc - 1) * WEAK_FOOT_WEIGHTS[pos];

  const atPosition = Math.trunc(weighted + 0.5) + REGISTERED_POSITION_BONUS[pos];
  if (pos === 0) return Math.max(MIN_RATING, atPosition);
  const average = Math.max(MIN_RATING, Math.trunc(total / 22 + 0.5));
  return Math.max(MIN_RATING, Math.trunc(atPosition * 0.6 + AVERAGE_CURVE[average - MIN_RATING] * 0.4 + 0.5));
}
