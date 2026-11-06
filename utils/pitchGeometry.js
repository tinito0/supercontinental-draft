// App pitch ↔ PES 2021 game-plan coordinates. Calibrated live against the game's lineup screen and its position
// tables (docs/FORMATION_DEPTH_CALIBRATION.md).
//
// App coordinates are percentages of the pitch box (components/Pitch.jsx): x 0 left … 100 right, y 0 rival goal
// side … 100 own goal side. The field lines span x 4…96 and y 3…97 of that box.
// Game coordinates are [depth, lateral] (EDIT / TacticsFormation.bin / Formation.csv LocationX/Y): depth grows toward
// the rival goal, lateral grows to the right with 52 at the centre.

/** Ranges from PES2021.exe's position tables (0x1434A1560 / 0x1434A1630): outfield slots, the keeper's fixed spot. */
export const GAME_PITCH = Object.freeze({
  depthMin: 4,
  depthMax: 47,
  lateralMin: 5,
  lateralMax: 99,
  lateralCentre: 52,
  /** Side bands: lateral ≤ 20 is the left wing, ≥ 84 the right wing. */
  leftWingMax: 20,
  rightWingMin: 84,
});
export const GOALKEEPER_SPOT = Object.freeze([3, 52]);

// The game draws its lineup pitch linearly in depth from goal line (−1.98) to goal line (52.88), ±0.1 unit.
const OWN_GOAL_DEPTH = -1.98;
const RIVAL_GOAL_DEPTH = 52.88;
const FIELD_TOP_Y = 3;
const FIELD_BOTTOM_Y = 97;
// Lateral 0 … 104 spans the game's pitch view edge to edge, which is the app's touchline to touchline.
const LATERAL_SPAN = 104;
const FIELD_LEFT_X = 4;
const FIELD_RIGHT_X = 96;

const DEPTH_PER_Y = (RIVAL_GOAL_DEPTH - OWN_GOAL_DEPTH) / (FIELD_BOTTOM_Y - FIELD_TOP_Y);
const LATERAL_PER_X = LATERAL_SPAN / (FIELD_RIGHT_X - FIELD_LEFT_X);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const depthAtY = y => (FIELD_BOTTOM_Y - Number(y)) * DEPTH_PER_Y + OWN_GOAL_DEPTH;
export const yAtDepth = depth => FIELD_BOTTOM_Y - (Number(depth) - OWN_GOAL_DEPTH) / DEPTH_PER_Y;
export const lateralAtX = x => (Number(x) - FIELD_LEFT_X) * LATERAL_PER_X;
export const xAtLateral = lateral => FIELD_LEFT_X + Number(lateral) / LATERAL_PER_X;

/** Outfield app position → [depth, lateral], rounded and clamped to the game's outfield area. */
export function toOutfieldCoords({ x, y }) {
  return [
    clamp(Math.round(depthAtY(y)), GAME_PITCH.depthMin, GAME_PITCH.depthMax),
    clamp(Math.round(lateralAtX(x)), GAME_PITCH.lateralMin, GAME_PITCH.lateralMax),
  ];
}

/** Slot → [depth, lateral] as exported. The keeper always plays the game's fixed spot, as in every EDIT plan. */
export function toGameCoords(slot) {
  return slot?.pos === 'PT' ? [...GOALKEEPER_SPOT] : toOutfieldCoords(slot);
}

const ceil1 = v => Math.ceil(v * 10) / 10;
const floor1 = v => Math.floor(v * 10) / 10;

/** Where an outfield marker may stand: exactly the positions that export inside the game's outfield area. */
export const PITCH_BOUNDS = Object.freeze({
  minX: ceil1(xAtLateral(GAME_PITCH.lateralMin)),
  maxX: floor1(xAtLateral(GAME_PITCH.lateralMax)),
  minY: ceil1(yAtDepth(GAME_PITCH.depthMax)),
  maxY: floor1(yAtDepth(GAME_PITCH.depthMin)),
});

// Firestore keeps y in the encoding used before the calibration (depth = (90 − y) × 0.46 + 3), so saved boards,
// firestore.rules and older clients stay valid; x is stored as is.
const STORED_Y_AT_DEPTH_3 = 90;
const STORED_DEPTH_PER_Y = 0.46;

export const fromStoredY = y => yAtDepth((STORED_Y_AT_DEPTH_3 - Number(y)) * STORED_DEPTH_PER_Y + 3);
export const toStoredY = y => Math.round((STORED_Y_AT_DEPTH_3 - (depthAtY(y) - 3) / STORED_DEPTH_PER_Y) * 100) / 100;

const round1 = v => Math.round(v * 10) / 10;

/** Saved y → board y rounded to 0.1, nudged a tenth when the rounding alone would change the exported depth. */
export function boardYFromStored(storedY) {
  const exact = fromStoredY(storedY);
  const depth = Math.round(depthAtY(exact));
  const rounded = round1(exact);
  return [rounded, round1(rounded + 0.1), round1(rounded - 0.1)].find(y => Math.round(depthAtY(y)) === depth) ?? rounded;
}
