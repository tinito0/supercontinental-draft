// Ratings, heat maps and shot positions of a match, from scl_probe v5 events. Pure;
// tests/pesCollector/pitchData.test.js. Evidence: docs/PES_MATCH_DATA_RESEARCH.md S15.
//
// - Rating: stat kind 179, first word read as f32 (6.0 = 0x40C00000). Checked against the post-match screen in one
//   match (Raya 7.0, Saliba 6.0; three away players 6.0 / 6.0 / 5.5).
// - Positions: `pos` events, 22 × (x, z) in metres from the centre spot, entry i = XI slot i of the `lineup` in force
//   (0–10 home). The game refreshes one team at a time, each player every 2–3 s: a sample, not a track.
// - Direction: whichever way the home keeper stands in each period, the home team attacks the other way. Heat maps
//   and shots are stored as if every team attacked to the right (x 0 = own goal line, 105 = opponent's).
// - Shot position: the shooter's last refreshed position before the stats sample that counted the shot (that
//   sample is up to 2 s late), so it is approximate: a few metres.
import { KIND } from './statKinds.js';

export const RATING_KIND = 179;
export const PITCH = { length: 105, width: 68 };
// 5 m × 4,9 m cells: fine enough for the blurred drawing on the page (components/league/match/Heatmap.jsx).
export const HEAT_GRID = { cols: 21, rows: 14 };
// Penalty: a fixed value, like the public models do.
export const PENALTY_XG = 0.76;
// Logistic model on distance (m) and the angle the goal mouth subtends (rad). Coefficients picked by hand to land
// near public distance/angle models (about 0.53 from the six-yard box, 0.26 from the penalty spot, 0.07 from 25 m);
// not fitted to PES shots. Body part, assist type and defenders are not in the data.
export const XG_MODEL = { intercept: -1.1, angle: 1.4, distance: -0.075 };

const SIDES = ['home', 'away'];
const GOAL_HALF_WIDTH = 3.66;
const ENTRIES_PER_SIDE = 11;
// A keeper this far from the centre line (m) is in his own half: his side tells the direction.
const KEEPER_SURE_X = 25;
const HALF_LENGTH = PITCH.length / 2;
const HALF_WIDTH = PITCH.width / 2;
const round1 = value => Math.round(value * 10) / 10;

const f32 = new DataView(new ArrayBuffer(4));
function asFloat(word) {
  f32.setUint32(0, Number(word) >>> 0, true);
  return f32.getFloat32(0, true);
}

/** { playerId: rating } from the replayed players (matchSummary replayPlayerStats). 0 = no rating: left out. */
export function buildRatings(players) {
  const ratings = {};
  for (const player of players) {
    const word = player.kinds?.[RATING_KIND]?.[0];
    if (word == null) continue;
    const rating = asFloat(word);
    if (rating > 0 && rating <= 10) ratings[player.id] = round1(rating);
  }
  return Object.keys(ratings).length ? ratings : null;
}

/** Player ids in XI slot order for each side, as of each lineup event: [{ ms, side, ids }]. */
function lineupTimeline(events) {
  return events.filter(e => e.t === 'lineup' && Array.isArray(e.ids)).map(e => ({ ms: e.ms, side: e.side, ids: e.ids }));
}

function idsAt(timeline, side, ms) {
  let ids = null;
  for (const entry of timeline) {
    if (entry.side === side && entry.ms <= ms) ids = entry.ids;
  }
  return ids;
}

/**
 * Pos events with each entry tied to its player: [{ ms, period, players: [{ side, id, x, y, changed }] }].
 * x, y are already turned so that the player's own team attacks to the right (0..105, 0..68).
 */
export function positionSamples(events) {
  const timeline = lineupTimeline(events);
  const raw = events.filter(e => e.t === 'pos' && Array.isArray(e.p) && e.p.length === 4 * ENTRIES_PER_SIDE);
  const homeAttacksRight = attackDirections(raw);
  const samples = [];
  let previous = null;
  for (const event of raw) {
    const period = event.c?.[0] ?? null;
    // The keeper's own position decides first: right after a period change the clock already says period 2
    // while the players still stand where the first half left them. The period's median covers a keeper who is
    // up the pitch (a corner at the end of a match).
    const keeperX = event.p[0];
    const right = Math.abs(keeperX) >= KEEPER_SURE_X ? keeperX < 0 : homeAttacksRight.get(period);
    if (right == null) {
      previous = event.p;
      continue;
    }
    const players = [];
    for (let entry = 0; entry < 2 * ENTRIES_PER_SIDE; entry += 1) {
      const side = entry < ENTRIES_PER_SIDE ? 0 : 1;
      const ids = idsAt(timeline, side, event.ms);
      const id = ids?.[entry % ENTRIES_PER_SIDE];
      const px = event.p[entry * 2];
      const pz = event.p[entry * 2 + 1];
      if (id == null || (px === 0 && pz === 0)) continue;
      const flip = (side === 0) !== right;
      players.push({
        side, id,
        x: (flip ? -px : px) + HALF_LENGTH,
        y: (flip ? -pz : pz) + HALF_WIDTH,
        changed: !previous || previous[entry * 2] !== px || previous[entry * 2 + 1] !== pz,
      });
    }
    samples.push({ ms: event.ms, period, players });
    previous = event.p;
  }
  return samples;
}

/** Map period → true when the home team attacks +x, from the median x of the home keeper (entry 0). */
function attackDirections(raw) {
  const byPeriod = new Map();
  for (const event of raw) {
    const period = event.c?.[0];
    const x = event.p[0];
    if (period == null || (x === 0 && event.p[1] === 0)) continue;
    if (!byPeriod.has(period)) byPeriod.set(period, []);
    byPeriod.get(period).push(x);
  }
  const result = new Map();
  for (const [period, xs] of byPeriod) {
    const sorted = [...xs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median !== 0) result.set(period, median < 0);
  }
  return result;
}

function cellOf(x, y) {
  const col = Math.min(HEAT_GRID.cols - 1, Math.max(0, Math.floor((x / PITCH.length) * HEAT_GRID.cols)));
  const row = Math.min(HEAT_GRID.rows - 1, Math.max(0, Math.floor((y / PITCH.width) * HEAT_GRID.rows)));
  return row * HEAT_GRID.cols + col;
}

/**
 * Counts of refreshed positions per grid cell (row-major, rows from the attacking team's left touchline), per
 * player and per team. Only refreshed entries count: the game rewrites one team at a time, and the other team's
 * unchanged entries would count twice. null without positions.
 */
export function buildHeatmaps(samples) {
  const players = {};
  const teams = { home: new Array(HEAT_GRID.cols * HEAT_GRID.rows).fill(0), away: new Array(HEAT_GRID.cols * HEAT_GRID.rows).fill(0) };
  let count = 0;
  for (const sample of samples) {
    for (const p of sample.players) {
      if (!p.changed) continue;
      const cell = cellOf(p.x, p.y);
      players[p.id] = players[p.id] || new Array(HEAT_GRID.cols * HEAT_GRID.rows).fill(0);
      players[p.id][cell] += 1;
      teams[SIDES[p.side]][cell] += 1;
      count += 1;
    }
  }
  return count ? { ...HEAT_GRID, length: PITCH.length, width: PITCH.width, players, teams } : null;
}

/** xG of a shot from (x, y) with the team attacking to the right; penalties get PENALTY_XG. */
export function shotXg({ x, y, penalty }) {
  if (penalty) return PENALTY_XG;
  const dx = PITCH.length - x;
  const dy = y - HALF_WIDTH;
  const distance = Math.hypot(dx, dy);
  const angle = Math.abs(Math.atan2(GOAL_HALF_WIDTH + dy, dx) - Math.atan2(dy - GOAL_HALF_WIDTH, dx));
  const logit = XG_MODEL.intercept + XG_MODEL.angle * angle + XG_MODEL.distance * distance;
  return Math.round((1 / (1 + Math.exp(-logit))) * 100) / 100;
}

/** ms of each shot of buildShots(), in the same order: kind-6 rises expanded by their delta. */
function shotTimes(rises) {
  const times = [];
  for (const rise of rises) {
    if (rise.kind !== KIND.shots) continue;
    for (let n = 0; n < rise.delta; n += 1) times.push(rise.ms);
  }
  return times;
}

function shooterPosition(samples, shot, ms) {
  let found = null;
  for (const sample of samples) {
    if (sample.ms > ms) break;
    const p = sample.players.find(entry => entry.id === shot.playerId && SIDES[entry.side] === shot.side && entry.changed);
    if (p) found = p;
  }
  return found;
}

/**
 * Shots with x, y (attacking right, metres) and xg when the shooter's position is known. A penalty gets
 * PENALTY_XG and the spot even without positions. Shots without a position keep xg null.
 */
export function locateShots(shots, rises, samples) {
  const times = shotTimes(rises);
  return shots.map((shot, index) => {
    if (shot.penalty) return { ...shot, x: PITCH.length - 11, y: HALF_WIDTH, xg: PENALTY_XG };
    const ms = times[index];
    const p = ms != null && samples.length ? shooterPosition(samples, shot, ms) : null;
    if (!p) return { ...shot, x: null, y: null, xg: null };
    const located = { ...shot, x: round1(p.x), y: round1(p.y) };
    return { ...located, xg: shotXg(located) };
  });
}

/**
 * Team xG: the sum over its shots, 0 without shots, null when one of its shots has no position (a partial sum
 * would read as a measured total). null for the match when neither side has a value.
 */
export function teamXg(shots) {
  const totals = {};
  for (const side of SIDES) {
    const own = shots.filter(shot => shot.side === side);
    totals[side] = own.some(shot => shot.xg == null)
      ? null
      : Math.round(own.reduce((sum, shot) => sum + shot.xg, 0) * 100) / 100;
  }
  return totals.home == null && totals.away == null ? null : totals;
}
