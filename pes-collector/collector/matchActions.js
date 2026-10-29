// Timed actions of a match, built from the per-player stat rises that matchSummary.js replays (pstats samples
// every 2 s, each with the match clock). Pure; tests/pesCollector/matchActions.test.js.
//
// Evidence (docs/PES_MATCH_DATA_RESEARCH.md, S10): in the recorded matches a shot (kind 6), its on-target flag (17),
// the goal (0), the penalty flag (21) and the opposing keeper's save (133) all rise in the same sample, so a shot's
// outcome is read from the rises of the same player in the same moment. Nothing here has a pitch position: the
// game's stat records hold counts only.
import { KIND, MATCH_WORDS, SERIES_STATS } from './statKinds.js';

const SIDES = ['home', 'away'];
// Rises that belong to the same shot: same sample in every recording; the window absorbs one late sample.
const SHOT_WINDOW_BEFORE_MS = 2000;
const SHOT_WINDOW_AFTER_MS = 4000;
// The probe can find the stats block after kick-off (late start, bridge restart): its first sample then holds
// everything that happened so far, at one instant. Such rises have no real time.
const LATE_START_SECONDS = 60;
// Periods 1–4 are regular and extra time. An in-play penalty reports period 5 while it is taken (S9).
const PLAY_PERIODS = [1, 2, 3, 4];

const sideName = side => SIDES[side] ?? null;
const clockSeconds = clock => (clock ? clock.minute * 60 + clock.second : 0);

/**
 * ms of the match's first pstats sample when it came after LATE_START_SECONDS, else null. Decided once for the
 * match, not per side: a side whose counters did not move in the first minute is not a late start.
 */
function lateFirstSample(rises) {
  const first = rises[0];
  return first && clockSeconds(first.clock) >= LATE_START_SECONDS ? first.ms : null;
}

/**
 * Copies of the rises with `timed` (false for a late first sample) and the period carried over a period-5 kick.
 * Without extra time, periods 3–4 are the second half's stoppage time (the period flaps 2↔3 near 90').
 */
function timedRises(rises, { extraTime = false } = {}) {
  const lateMs = lateFirstSample(rises);
  let period = 1;
  return rises.map(rise => {
    if (PLAY_PERIODS.includes(rise.clock?.period)) period = extraTime ? rise.clock.period : Math.min(rise.clock.period, 2);
    const timed = Boolean(rise.clock) && rise.ms !== lateMs;
    return { ...rise, timed, period };
  });
}

function takeNear(pool, shot, kind, count) {
  const taken = pool.filter(r => !r.used && r.kind === kind && r.side === shot.side && r.id === shot.id
    && r.ms >= shot.ms - SHOT_WINDOW_BEFORE_MS && r.ms <= shot.ms + SHOT_WINDOW_AFTER_MS).slice(0, count);
  const total = taken.reduce((sum, r) => sum + r.delta, 0);
  for (const r of taken) r.used = true;
  return Math.min(total, count);
}

/**
 * One entry per shot, in match order: { side, playerId, clock, outcome, penalty }.
 * outcome: 'goal' | 'on_target' (saved or stopped on the line) | 'off_target' (wide, over or blocked: the game
 * counts both as not on target and nothing tells them apart). clock is null when the time is unknown (late start).
 * @param {{ extraTime?: boolean }} [match] whether the match had extra time
 */
export function buildShots(rises, match) {
  const all = timedRises(rises, match);
  const pool = all.filter(r => [KIND.goals, KIND.shotsOnTarget, KIND.penaltyShots].includes(r.kind))
    .map(r => ({ ...r, used: false }));
  const shots = [];
  for (const shot of all.filter(r => r.kind === KIND.shots)) {
    const goals = takeNear(pool, shot, KIND.goals, shot.delta);
    const onTarget = Math.max(goals, takeNear(pool, shot, KIND.shotsOnTarget, shot.delta));
    const penalties = takeNear(pool, shot, KIND.penaltyShots, shot.delta);
    for (let n = 0; n < shot.delta; n += 1) {
      const outcome = n < goals ? 'goal' : n < onTarget ? 'on_target' : 'off_target';
      shots.push({
        side: sideName(shot.side),
        playerId: shot.id,
        clock: shot.timed ? { ...shot.clock, period: shot.period } : null,
        outcome,
        penalty: n < penalties,
      });
    }
  }
  return shots;
}

/**
 * Per-minute counts of SERIES_STATS for both sides: { kinds, from, rows: [[period, minute, ...home, ...away]] }.
 * Only minutes with an action are listed. `from` is the clock of a late first sample (the series starts there).
 * @param {{ extraTime?: boolean }} [match] whether the match had extra time
 */
export function buildSeries(rises, match) {
  const all = timedRises(rises, match);
  const kinds = SERIES_STATS.map(name => KIND[name]);
  const rows = new Map();
  for (const rise of all.filter(r => r.timed)) {
    const column = kinds.indexOf(rise.kind);
    if (column < 0) continue;
    const key = `${rise.period}:${rise.clock.minute}`;
    const row = rows.get(key) || [rise.period, rise.clock.minute, ...Array(kinds.length * 2).fill(0)];
    row[2 + rise.side * kinds.length + column] += rise.delta;
    rows.set(key, row);
  }
  const lateRise = all.find(r => !r.timed && r.clock);
  return {
    kinds: SERIES_STATS,
    from: lateRise ? { ...lateRise.clock, period: lateRise.period } : null,
    rows: [...rows.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  };
}

/**
 * Team totals of SERIES_STATS per stat-record bucket (research doc S2/S8): words 0–5 are 15-minute blocks of regular
 * time, 6 and 7 the extra-time halves. These are the game's own counters, complete even after a late start.
 */
export function buildBuckets(players) {
  const buckets = {};
  for (const side of SIDES) {
    buckets[side] = Object.fromEntries(SERIES_STATS.map(name => [name, Array(MATCH_WORDS).fill(0)]));
  }
  for (const player of players) {
    const side = sideName(player.side);
    for (const name of SERIES_STATS) {
      const values = player.kinds[KIND[name]];
      if (!Array.isArray(values)) continue;
      for (let word = 0; word < MATCH_WORDS; word += 1) buckets[side][name][word] += Number(values[word]) || 0;
    }
  }
  return buckets;
}
