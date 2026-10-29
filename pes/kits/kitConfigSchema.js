// Value ranges of config.txt keys as Sider's kit-server module accepts them.
//
// Source: modules/kserv.lua v1.17 (juce, zlac; UML build), table `overlay_states`, which drives the in-game
// kit config editor (min/max of each stepper, or the list of allowed values). These are the values the
// module itself writes back to config.txt, so they are the reference for validation.
//
// The inline comments Kit Studio 2021 writes next to each key ("; 0 to 14") are NOT authoritative: in the
// UML patch they disagree with kserv.lua for several keys, e.g. ShortsNumberX "0 to 14" while kserv.lua
// allows 0..31 (30/31 hide the number) and real kits use 16. The comment range is kept only as a hint and
// for keys kserv.lua does not list.
//
// kserv.lua parses config.txt as: strip a UTF-8 BOM, take the comment from the first ';', `key=value`,
// trailing spaces removed, `tonumber(value)` when it looks like a number (pes/kits/kitConfig.js keeps the
// raw line; this schema only says which numbers are valid).

/** @typedef {{ type: 'range', min: number, max: number } | { type: 'enum', values: number[], labels: Record<string, string> }} KitConstraint */

const range = (min, max) => ({ type: 'range', min, max });
const choice = labels => ({ type: 'enum', values: Object.keys(labels).map(Number), labels });

/** @type {Record<string, KitConstraint>} */
export const KSERV_CONSTRAINTS = {
  ShortSleevesModel: range(1, 2),
  ShirtModel: choice({ 144: '', 151: 'Semi-long', 160: '', 176: 'Legacy' }),
  Collar: range(1, 135),
  TightKit: choice({ 0: 'Off', 1: 'On' }),
  ShirtPattern: range(0, 6),
  WinterCollar: range(1, 135),
  LongSleevesType: choice({ 62: 'Normal & Undershirt', 187: 'Only Undershirt' }),
  SleeveLimits: choice({ 0: 'None', 1: 'Only long', 2: 'Only short' }),
  ChestNumberSize: range(0, 28),
  ChestNumberX: range(0, 29),
  ChestNumberY: range(0, 29),
  ShortsModel: range(0, 17),
  ShortsNumberSize: range(0, 28),
  ShortsNumberX: range(0, 31),
  ShortsNumberY: range(0, 31),
  ShortsNumberSide: choice({ 0: 'Left', 1: 'Right' }),
  Name: choice({ 0: 'On', 1: 'Off' }),
  NameShape: choice({ 0: 'Straight', 1: 'Light curve', 2: 'Medium curve', 3: 'Extreme curve' }),
  NameY: range(0, 39),
  NameSize: range(0, 20),
  NameStretch: range(0, 3),
  BackNumberSize: range(0, 28),
  BackNumberY: range(0, 29),
  BackNumberSpacing: range(0, 15),
  BackNumberType: range(0, 1),
  RightShortX: range(0, 31),
  RightShortY: range(0, 31),
  RightLongX: range(0, 31),
  RightLongY: range(0, 31),
  LeftShortX: range(0, 31),
  LeftShortY: range(0, 31),
  LeftLongX: range(0, 31),
  LeftLongY: range(0, 31),
};

const sameConstraint = (a, b) => (a.type === 'range' && b.type === 'range'
  ? a.min === b.min && a.max === b.max
  : a.type === b.type && a.values.length === b.values.length && a.values.every(v => b.values.includes(v)));

/**
 * The constraint a key is validated against: kserv.lua's when known, else the line's own comment.
 * @param {string} key
 * @param {KitConstraint|null} [commentConstraint] parsed from the line's inline comment
 * @returns {{ constraint: KitConstraint|null, source: 'kserv'|'comment'|null, comment: KitConstraint|null, disagrees: boolean }}
 */
export function keyConstraint(key, commentConstraint = null) {
  const kserv = KSERV_CONSTRAINTS[key] || null;
  if (kserv) {
    return { constraint: kserv, source: 'kserv', comment: commentConstraint, disagrees: Boolean(commentConstraint && !sameConstraint(kserv, commentConstraint)) };
  }
  return { constraint: commentConstraint, source: commentConstraint ? 'comment' : null, comment: commentConstraint, disagrees: false };
}

/** True when `n` satisfies the constraint (no constraint = anything goes). */
export function satisfies(constraint, n) {
  if (!constraint) return true;
  return constraint.type === 'range' ? n >= constraint.min && n <= constraint.max : constraint.values.includes(n);
}

export const describeConstraint = c => (c.type === 'range' ? `${c.min} a ${c.max}` : c.values.join(', '));

/**
 * Sleeve badge positions (RightShortX … LeftLongY). kserv.lua turns a badge off by writing X=31, Y=0
 * (option hide_comp_kits_badges); that pair is the only "off" value confirmed by the module's source.
 */
export const BADGE_KEYS = {
  right: { short: ['RightShortX', 'RightShortY'], long: ['RightLongX', 'RightLongY'] },
  left: { short: ['LeftShortX', 'LeftShortY'], long: ['LeftLongX', 'LeftLongY'] },
};
export const isBadgeOff = (x, y) => x === 31 && y === 0;
