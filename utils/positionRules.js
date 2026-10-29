// Which roles a formation slot may take, depending on where it stands on the pitch (PES 2021).
//
// Evidence, strongest first:
// 1. Game data: every team's formations in the EDIT (vendor/EDIT00000000, 704 teams × 3 plans × 3 fluid variants,
//    63,360 outfield slots). Each role only ever appears inside fixed depth and side bands, and the band edges are
//    the same for every role (15/16, 25/26, 34/35, 39/40 in depth; 20 and 84 in lateral, symmetric around the
//    GK's 52). The table below is that data: a role is allowed in a zone when Konami's own formations use it there.
// 2. Community documentation (Rigged Wiki, PES 2021 Tactical): each position has a playing area and a player
//    can be switched between positions where two areas overlap (e.g. CMF and AMF). That matches the overlaps here.
// What is NOT verified: Konami's internal constants. This is the game's observed behaviour, not its source, and
// the app→game coordinate mapping (utils/formationStates.js toGameCoords) is the app's own approximation.
//
// The GK is not covered: it always keeps its spot and role, as in the EDIT.

/** Game depth bands (toGameCoords depth: 3 own goal line … 48 rival area). `max` is inclusive. */
export const DEPTH_LINES = Object.freeze([
  { id: 'defense', label: 'Defensa', max: 15 },
  { id: 'midLow', label: 'Mediocampo defensivo', max: 25 },
  { id: 'midHigh', label: 'Mediocampo ofensivo', max: 34 },
  { id: 'attackLow', label: 'Ataque', max: 39 },
  { id: 'attackHigh', label: 'Área rival', max: Infinity },
]);

/**
 * Distance from the pitch centre at which a slot counts as wide. Game data: LB/LMF/LWF never pass lateral 20 and
 * RB/RMF/RWF never go below 84, 32 units from the centre (52). The app's pitch is centred on x = 50.
 */
export const WIDE_OFFSET = 32;
const APP_CENTRE_X = 50;

export const SIDES = Object.freeze({ left: 'Banda izquierda', center: 'Centro', right: 'Banda derecha' });

/**
 * Allowed roles per zone, the zone's default first. Second entries are overlaps the game data uses: CB on the
 * wing of the back line (21 teams), CMF on the flank of midfield (8 teams), SS on the wing of the attack (26 teams).
 */
export const ZONE_ROLES = Object.freeze({
  defense: { left: ['LI', 'DFC'], center: ['DFC'], right: ['LD', 'DFC'] },
  midLow: { left: ['MI', 'MC'], center: ['MCD', 'MC'], right: ['MD', 'MC'] },
  midHigh: { left: ['MI', 'MC'], center: ['MO', 'MC'], right: ['MD', 'MC'] },
  attackLow: { left: ['EI', 'SD'], center: ['SD'], right: ['ED', 'SD'] },
  attackHigh: { left: ['EI', 'SD'], center: ['DC', 'SD'], right: ['ED', 'SD'] },
});

/** Outfield roles in pitch order, with the game's names (PES 2021 in Spanish / English). */
export const OUTFIELD_ROLES = Object.freeze([
  { id: 'DFC', label: 'Defensa central', en: 'CB' },
  { id: 'LI', label: 'Lateral izquierdo', en: 'LB' },
  { id: 'LD', label: 'Lateral derecho', en: 'RB' },
  { id: 'MCD', label: 'Mediocentro defensivo', en: 'DMF' },
  { id: 'MC', label: 'Mediocentro', en: 'CMF' },
  { id: 'MI', label: 'Interior izquierdo', en: 'LMF' },
  { id: 'MD', label: 'Interior derecho', en: 'RMF' },
  { id: 'MO', label: 'Mediapunta', en: 'AMF' },
  { id: 'EI', label: 'Extremo izquierdo', en: 'LWF' },
  { id: 'ED', label: 'Extremo derecho', en: 'RWF' },
  { id: 'SD', label: 'Segundo delantero', en: 'SS' },
  { id: 'DC', label: 'Delantero centro', en: 'CF' },
]);
const KNOWN_ROLES = new Set(OUTFIELD_ROLES.map(r => r.id));
export const isOutfieldRole = role => KNOWN_ROLES.has(role);

/**
 * When a slot moves where its role is not allowed, the closest role that is, in this order; if none fits,
 * the zone's default. Keeps the player's job as similar as possible (an AMF dragged back becomes a CMF, not a DMF).
 */
const FALLBACK = Object.freeze({
  DFC: ['MCD', 'MC'],
  LI: ['DFC', 'MI'],
  LD: ['DFC', 'MD'],
  MCD: ['MC', 'DFC'],
  MC: ['MCD', 'MO', 'MI', 'MD'],
  MO: ['MC', 'SD'],
  MI: ['MC', 'EI', 'LI'],
  MD: ['MC', 'ED', 'LD'],
  EI: ['SD', 'MI'],
  ED: ['SD', 'MD'],
  SD: ['DC', 'MO', 'EI', 'ED'],
  DC: ['SD'],
});

/** Game depth of a pitch position, with the rounding of the export (toGameCoords). */
const gameDepth = y => Math.round((90 - Number(y)) * 0.46 + 3);

/** Zone of a pitch position ({ x, y } percent of the app pitch): { line, side } plus a readable label. */
export function zoneAt({ x, y }) {
  const depth = gameDepth(y);
  const line = DEPTH_LINES.find(l => depth <= l.max);
  const offset = Math.round(Number(x)) - APP_CENTRE_X;
  const side = offset <= -WIDE_OFFSET ? 'left' : offset >= WIDE_OFFSET ? 'right' : 'center';
  return { line: line.id, side, label: `${line.label} · ${SIDES[side]}` };
}

/** Roles allowed at a pitch position, the zone's default first. */
export function rolesAt(position) {
  const { line, side } = zoneAt(position);
  return ZONE_ROLES[line][side];
}

export const isRoleAllowedAt = (role, position) => rolesAt(position).includes(role);

/**
 * The role a slot plays at `position`: `role` itself when the zone allows it, otherwise the closest allowed one.
 * The GK and unknown roles are returned unchanged.
 */
export function resolveRole(role, position) {
  if (!isOutfieldRole(role)) return role;
  const allowed = rolesAt(position);
  if (allowed.includes(role)) return role;
  return (FALLBACK[role] || []).find(r => allowed.includes(r)) || allowed[0];
}

/**
 * Why `role` cannot be used at `position` (Spanish, for the UI), or null when it can.
 * e.g. "MO no está disponible en Mediocampo defensivo · Centro: acá van MCD o MC."
 */
export function roleUnavailableReason(role, position) {
  if (!isOutfieldRole(role)) return 'Esa posición no existe en el juego.';
  if (isRoleAllowedAt(role, position)) return null;
  const zone = zoneAt(position);
  const allowed = rolesAt(position);
  return `${role} no está disponible en ${zone.label}: acá ${allowed.length > 1 ? 'van' : 'va'} ${allowed.join(' o ')}.`;
}
