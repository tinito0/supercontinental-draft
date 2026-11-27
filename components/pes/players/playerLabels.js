// Spanish names and readable values for Player.bin and EDIT player fields, for the places that list fields
// generically (EDIT vs Player.bin differences, a player that is only in the EDIT).
import { BIN_TO_EDIT } from '../../../pes/formats/pes2021/playerFieldSync.js';
import { PLAYING_STYLE_BY_ID, PLAYER_SKILLS_MAP } from '../../../utils/constants.js';
import { FIELD_LABELS, MOTION_LABELS, POSITION_FIELDS, EDIT_ONLY_GROUPS, APTITUDE_LABEL, positionName, statLabel } from './playerFields.js';

const EDIT_TO_BIN = Object.fromEntries(Object.entries(BIN_TO_EDIT).map(([bin, link]) => [link.edit, bin]));
const EDIT_ONLY_LABELS = Object.assign({ gc1: 'Festejo 1', gc2: 'Festejo 2' }, ...EDIT_ONLY_GROUPS.map(([, labels]) => labels));
const POSITION_BY_FIELD = Object.fromEntries(POSITION_FIELDS.map(p => [p.field, p.pos]));

function binLabel(name) {
  if (FIELD_LABELS[name]) return FIELD_LABELS[name];
  if (MOTION_LABELS[name]) return MOTION_LABELS[name];
  if (POSITION_BY_FIELD[name]) return `Aptitud ${POSITION_BY_FIELD[name]}`;
  const trait = name.match(/^(?:skill|com)(.+)$/);
  if (trait && PLAYER_SKILLS_MAP[trait[1]]) return PLAYER_SKILLS_MAP[trait[1]];
  return statLabel(name);
}

/** Label of a Player.bin field, or of an EDIT field when `edit` is true. */
export function fieldLabel(name, _table, edit = false) {
  if (!edit) return binLabel(name);
  if (EDIT_TO_BIN[name]) return binLabel(EDIT_TO_BIN[name]);
  return EDIT_ONLY_LABELS[name] || name;
}

/** A Player.bin value as the editor shows it. */
export function formatValue(field, value) {
  if (field === 'strongFootLeft') return value ? 'izquierdo' : 'derecho';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (field === 'playingStyle') return PLAYING_STYLE_BY_ID[value] ?? `código ${value}`;
  if (field === 'registeredPosition') return positionName(value);
  if (POSITION_BY_FIELD[field]) return APTITUDE_LABEL[value] ?? String(value);
  return String(value);
}
