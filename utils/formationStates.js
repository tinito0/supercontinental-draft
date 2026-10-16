// Tactical states of a formation: Inicio de partido, Con pelota, Sin pelota.
//
// They are PES 2021's three formation variants of a game plan ("fluid formation"): the EDIT stores 3 variants
// per plan (pes/formats/pes2021/editLayout.js), TacticsFormation.bin 3 formations per preset and Formation.csv
// F1/F2/F3 ("Normal Formation", "With ball Formation", "Without ball Formation" in the EJOGC editor). PES Editor
// Rebuilt (js/extras.js) treats the plan as fluid when the variants differ and, with fluid off, keeps the base
// formation in the three variants. Here `fluid` is stored explicitly so switching it off never deletes the
// positions of the other two states: they are simply not exported while it is off.
//
// Coordinates: the app's pitch (components/Pitch.jsx): x 0..100 left → right, y 0..100 top (attack) → bottom
// (own goal), percentages of the pitch box, so they do not depend on the screen size. Positions and roles are
// stored per formation slot (the lineup is keyed by slot too): moving a slot or changing its role never changes
// which player is in it.
//
// Roles: each variant has its own role per slot, as in the EDIT (Rebuilt writes roles per variant). A slot's role
// is its formation's `pos` unless the user picked another one, and it always has to be allowed where the slot
// stands (utils/positionRules.js): when it is not, the closest allowed role is played, so the board, the saved
// data and the exports never disagree.

import { resolveRole, isRoleAllowedAt, isOutfieldRole } from './positionRules.js';

export const TACTICAL_STATES = [
  { id: 'base', label: 'Inicio de partido', short: 'Inicio', variant: 0 },
  { id: 'withBall', label: 'Con pelota', short: 'Con pelota', variant: 1 },
  { id: 'withoutBall', label: 'Sin pelota', short: 'Sin pelota', variant: 2 },
];
const STATE_IDS = TACTICAL_STATES.map(s => s.id);
const OTHER_STATE_IDS = ['withBall', 'withoutBall'];

/**
 * Where an outfield marker may go (percent of the pitch). x matches the game's lateral range (8..92, see
 * toGameCoords) so a marker never sits where the export would move it; y keeps markers inside the drawn pitch.
 * The goalkeeper keeps the formation's spot, as in the EDIT.
 */
export const PITCH_BOUNDS = Object.freeze({ minX: 8, maxX: 92, minY: 6, maxY: 86 });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = v => Math.round(v * 10) / 10;
const emptyByState = () => ({ base: {}, withBall: {}, withoutBall: {} });
const PRESET_KEY = /^[\w-]{1,20}$/;

export const isGoalkeeperSlot = slot => slot?.pos === 'PT';

/** Clamps a position to the playable area and rounds it to 0.1 %. */
export function clampPosition({ x, y }) {
  return { x: round1(clamp(Number(x), PITCH_BOUNDS.minX, PITCH_BOUNDS.maxX)), y: round1(clamp(Number(y), PITCH_BOUNDS.minY, PITCH_BOUNDS.maxY)) };
}

/** Pointer position → pitch percentages, using the pitch element's current box (works at any size). */
export function clientToPitch(clientX, clientY, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  return clampPosition({ x: (clientX - rect.left) / rect.width * 100, y: (clientY - rect.top) / rect.height * 100 });
}

/** App position code → PES role (EDIT formation roles, TacticsFormation.bin `role`, Formation.csv Position). */
export const PES_POSITION_MAP = Object.freeze({ PT: 0, DFC: 1, LI: 2, LD: 3, MCD: 4, MC: 5, MI: 6, MD: 7, MO: 8, EI: 9, ED: 10, SD: 11, DC: 12 });

/**
 * App pitch → game coordinates [depth, lateral] (EDIT / TacticsFormation.bin / Formation.csv LocationX/Y).
 * Formula of utils/pesExport.js, shared with pes/draftTransfer.js: depth 3 = own goal line … 48 = rival area.
 */
export function toGameCoords({ x, y }) {
  return [clamp(Math.round((90 - y) * 0.46 + 3), 3, 48), clamp(Math.round(x), 8, 92)];
}

const emptyStates = (formationKey, fluid) => ({ formation: formationKey, fluid, positions: emptyByState(), roles: emptyByState(), presets: {} });

/**
 * Stored value → { formation, fluid, positions, roles, presets }. Values that belong to another formation, invalid
 * slots, the goalkeeper, non-numeric positions and unknown roles are dropped; numbers are clamped to the pitch.
 * @param {unknown} raw profile.formationStates (missing on legacy teams)
 * @param {string} formationKey the team's current formation
 * @param {{ layout: object[] }} formationDef FORMATIONS[formationKey]
 */
export function normalizeFormationStates(raw, formationKey, formationDef) {
  const layout = formationDef?.layout || [];
  const fluid = Boolean(raw && typeof raw === 'object' && raw.fluid);
  if (!raw || typeof raw !== 'object' || raw.formation !== formationKey) return emptyStates(formationKey, fluid);
  const states = emptyStates(formationKey, fluid);
  const isOutfieldSlot = i => Number.isInteger(i) && layout[i] && !isGoalkeeperSlot(layout[i]);
  for (const id of STATE_IDS) {
    for (const [k, p] of Object.entries(raw.positions?.[id] || {})) {
      const i = Number(k);
      if (!isOutfieldSlot(i) || !p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) continue;
      states.positions[id][i] = clampPosition(p);
    }
    for (const [k, role] of Object.entries(raw.roles?.[id] || {})) {
      const i = Number(k);
      if (isOutfieldSlot(i) && isOutfieldRole(role)) states.roles[id][i] = role;
    }
  }
  for (const id of OTHER_STATE_IDS) {
    const key = raw.presets?.[id];
    if (typeof key === 'string' && PRESET_KEY.test(key)) states.presets[id] = key;
  }
  return states;
}

/** Positions after a formation change: the new shape starts from its own layout; the fluid switch is kept. */
export function resetForFormation(states, formationKey) {
  return emptyStates(formationKey, Boolean(states?.fluid));
}

/** The state actually used for `stateId`: with fluid off every state plays the base formation. */
export function effectiveState(states, stateId) {
  return states?.fluid && STATE_IDS.includes(stateId) ? stateId : 'base';
}

/**
 * Formation layout of one state: the formation's slots with that state's moved positions and chosen roles
 * applied. Every outfield role is valid where its slot stands (resolveRole).
 */
export function layoutForState(formationDef, states, stateId) {
  const layout = formationDef?.layout || [];
  const id = effectiveState(states, stateId);
  const own = states?.positions?.[id] || {};
  const base = states?.positions?.base || {};
  const ownRoles = states?.roles?.[id] || {};
  const baseRoles = states?.roles?.base || {};
  return layout.map((slot, i) => {
    if (isGoalkeeperSlot(slot)) return slot;
    // A state that was never edited starts from the base formation (what the game does when fluid is turned on).
    const p = own[i] || (id !== 'base' ? base[i] : null);
    const at = p ? { x: p.x, y: p.y } : { x: slot.x, y: slot.y };
    const chosen = ownRoles[i] || (id !== 'base' ? baseRoles[i] : null) || slot.pos;
    return { ...slot, ...at, pos: resolveRole(chosen, at) };
  });
}

/**
 * Moves one slot in one state; returns a new object (the input is not changed). Inactive states cannot be
 * edited: with fluid off a move goes to the base formation. The role follows the zone (layoutForState).
 */
export function moveSlot(states, stateId, slotIndex, position, formationDef) {
  const slot = formationDef?.layout?.[slotIndex];
  if (!slot || isGoalkeeperSlot(slot)) return states;
  const id = effectiveState(states, stateId);
  return { ...states, positions: { ...states.positions, [id]: { ...states.positions[id], [slotIndex]: clampPosition(position) } } };
}

/**
 * Gives one slot of one state another role. Returns the input unchanged when the role is not allowed where the
 * slot stands in that state (check roleUnavailableReason first to tell the user why).
 */
export function setSlotRole(states, stateId, slotIndex, role, formationDef) {
  const slot = formationDef?.layout?.[slotIndex];
  if (!slot || isGoalkeeperSlot(slot) || !isOutfieldRole(role)) return states;
  const id = effectiveState(states, stateId);
  const at = layoutForState(formationDef, states, id)[slotIndex];
  if (!isRoleAllowedAt(role, at)) return states;
  return { ...states, roles: { ...states.roles, [id]: { ...states.roles[id], [slotIndex]: role } } };
}

const isEmptyState = (states, id) => !Object.keys(states.positions?.[id] || {}).length && !Object.keys(states.roles?.[id] || {}).length;

/** Turns the Con pelota / Sin pelota states on or off. Turning on seeds never-edited states from the base. */
export function setFluid(states, on) {
  if (!on) return { ...states, fluid: false };
  const positions = { ...states.positions };
  const roles = { ...states.roles };
  for (const id of OTHER_STATE_IDS) {
    if (isEmptyState(states, id)) {
      positions[id] = { ...positions.base };
      roles[id] = { ...roles.base };
    }
  }
  return { ...states, fluid: true, positions, roles };
}

/** Copies the base positions and roles into another state. */
export function copyBaseTo(states, stateId) {
  if (stateId === 'base') return states;
  const presets = { ...states.presets };
  delete presets[stateId];
  return {
    ...states,
    positions: { ...states.positions, [stateId]: { ...states.positions.base } },
    roles: { ...states.roles, [stateId]: { ...states.roles.base } },
    presets,
  };
}

/** Back to the formation's default layout and roles for one state. */
export function resetState(states, stateId) {
  const presets = { ...states.presets };
  delete presets[stateId];
  return { ...states, positions: { ...states.positions, [stateId]: {} }, roles: { ...states.roles, [stateId]: {} }, presets };
}

/** Every outfield slot of one state, written out (positions and the roles they play). */
function snapshotState(formationDef, states, stateId) {
  const positions = {}, roles = {};
  layoutForState(formationDef, states, stateId).forEach((slot, i) => {
    if (isGoalkeeperSlot(slot)) return;
    positions[i] = { x: slot.x, y: slot.y };
    roles[i] = slot.pos;
  });
  return { positions, roles };
}

/** The formation preset whose name the selector shows for a state (the base formation unless one was applied). */
export function formationKeyForState(states, stateId) {
  const id = effectiveState(states, stateId);
  return (id !== 'base' && states?.presets?.[id]) || states?.formation;
}

/**
 * Applies a formation preset to the state being edited, as choosing a formation does in the game:
 * - Inicio de partido (or fluid off): the team's formation changes. With fluid on, Con pelota and Sin pelota keep
 *   exactly what they showed (they are written out from the old formation first), so they never reset.
 * - Con pelota / Sin pelota: only that state takes the preset's positions and roles; the team's formation, the other
 *   states and the lineup do not change.
 * @param {string} formationKey the preset chosen
 * @param {Record<string, { layout: object[] }>} formations FORMATIONS
 */
export function applyFormationToState(states, stateId, formationKey, formations) {
  const next = formations?.[formationKey];
  const current = formations?.[states.formation];
  if (!next) return states;
  const id = effectiveState(states, stateId);
  if (id !== 'base') {
    const { positions, roles } = snapshotState(next, emptyStates(formationKey, false), 'base');
    return {
      ...states,
      positions: { ...states.positions, [id]: positions },
      roles: { ...states.roles, [id]: roles },
      presets: { ...states.presets, [id]: formationKey },
    };
  }
  if (formationKey === states.formation) return states;
  const fresh = emptyStates(formationKey, Boolean(states.fluid));
  if (!states.fluid || !current) return fresh;
  for (const other of OTHER_STATE_IDS) {
    const { positions, roles } = snapshotState(current, states, other);
    fresh.positions[other] = positions;
    fresh.roles[other] = roles;
    fresh.presets[other] = states.presets?.[other] || states.formation;
  }
  return fresh;
}

/** Value saved in Firestore (plain JSON, slot keys as strings). */
const FORMATION_FIELDS = ['formation', 'formationStates', 'advancedInstructions', 'lineup', 'dorsals', 'setPieces', 'tactics', 'availability', 'matchBench'];

const stableJson = value => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

/**
 * The saved board fields of a profile as one comparable string, independent of key order (Firestore can return a
 * map's keys in another order than they were written). FormationModal uses it to tell another device's changes
 * from the echo of its own save.
 */
export function formationSignature(profile) {
  return stableJson(FORMATION_FIELDS.map(key => profile?.[key] ?? null));
}

export function serializeFormationStates(states) {
  const positions = {}, roles = {};
  for (const id of STATE_IDS) {
    positions[id] = Object.fromEntries(Object.entries(states.positions?.[id] || {}).map(([k, p]) => [String(k), { x: p.x, y: p.y }]));
    roles[id] = Object.fromEntries(Object.entries(states.roles?.[id] || {}).map(([k, r]) => [String(k), r]));
  }
  return { formation: states.formation, fluid: Boolean(states.fluid), positions, roles, presets: { ...(states.presets || {}) } };
}

/**
 * The three formation variants to export, in game order (base, with ball, without ball). With fluid off the
 * three are the base formation, as the game and PES Editor Rebuilt keep them.
 * @returns {object[][]} three layouts
 */
export function exportVariants(formationDef, states) {
  return TACTICAL_STATES.map(s => layoutForState(formationDef, states, s.id));
}
