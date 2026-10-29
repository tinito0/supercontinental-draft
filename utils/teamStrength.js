// Team strength of a starting XI, as PES shows it beside the squad list: the average OVR of each line.
// Lines come from the role each starter plays on the pitch (the slot), not from the player's natural position.
import { getPosCategory } from './helpers.js';

/** The outfield lines shown as bars, in pitch order from the opponent's goal back. */
export const STRENGTH_LINES = [
  { key: 'attack', label: 'Ataque', category: 'forward' },
  { key: 'midfield', label: 'Mediocampo', category: 'midfield' },
  { key: 'defense', label: 'Defensa', category: 'defense' },
];

// The bar starts at this OVR: from zero, a 78 and an 84 line would look the same length.
const BAR_FLOOR_OVR = 40;
const BAR_CEILING_OVR = 99;

const average = values => (values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null);

/**
 * @param {Array<{ pos: string, ovr: number }>} starters role played and OVR of each starter
 * @returns {{ attack: number|null, midfield: number|null, defense: number|null, keeper: number|null, overall: number|null, count: number }}
 */
export function teamStrength(starters) {
  const byCategory = { forward: [], midfield: [], defense: [], keeper: [] };
  (starters || []).forEach(starter => {
    const ovr = Number(starter?.ovr);
    const bucket = byCategory[getPosCategory(starter?.pos)];
    if (bucket && Number.isFinite(ovr) && ovr > 0) bucket.push(ovr);
  });
  const all = Object.values(byCategory).flat();
  return {
    attack: average(byCategory.forward),
    midfield: average(byCategory.midfield),
    defense: average(byCategory.defense),
    keeper: average(byCategory.keeper),
    overall: average(all),
    count: all.length,
  };
}

/** Bar length (0..1) for a line's average OVR. */
export function strengthBarScale(ovr) {
  if (ovr == null) return 0;
  const scale = (ovr - BAR_FLOOR_OVR) / (BAR_CEILING_OVR - BAR_FLOOR_OVR);
  return Math.min(1, Math.max(0, scale));
}
