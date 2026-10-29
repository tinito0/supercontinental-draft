// EDIT00000000 data-section layout for PES 2020/2021.
// Field list adapted from PES Editor Rebuilt js/pesdata.js (BSD-3-Clause), which ports
// 4ccEditor (zlib license, the4chancup). See pes/THIRD_PARTY_NOTICES.md.
//
// The spec lists fields in file order as [key, startBit, bits] / ['skip', bytes] /
// ['str', key, bytes]; compile() reproduces 4ccEditor's cursor rules and turns them
// into descriptors for pes/core/fields.js.

const PLAYER_SPEC = [
  ['id', 0, 32], ['comm_id', 0, 32], ['nation', 0, 16], ['height', 0, 8], ['weight', 0, 8], ['gc1', 0, 8], ['gc2', 0, 8],
  ['atk', 0, 7], ['ball_ctrl', 7, 7], ['weak_use', 6, 2], ['tight_pos', 0, 7], ['lowpass', 7, 7], ['loftpass', 6, 7],
  ['finish', 5, 7], ['mo_armd', 4, 4], ['place_kick', 0, 7], ['swerve', 7, 7], ['speed', 6, 7], ['exp_pwr', 5, 7],
  ['mo_armr', 4, 4], ['jump', 0, 7], ['phys_cont', 7, 7], ['body_ctrl', 6, 7], ['stamina', 5, 7], ['mo_ck', 4, 4],
  ['ball_win', 0, 7], ['aggres', 7, 7], ['gk', 6, 7], ['catching', 5, 7], ['form', 4, 3], ['e_player', 7, 1],
  ['cover', 0, 7], ['age', 7, 6], ['reg_pos', 5, 4], ['play_style', 2, 5], ['mo_fk', 7, 5], ['star', 4, 3],
  ['e_basic', 7, 1], ['def', 0, 7], ['clearing', 7, 7], ['header', 6, 7], ['mo_hunchd', 5, 3], ['mo_hunchr', 0, 3],
  ['mo_pk', 3, 3], ['weak_acc', 6, 2], ['drib', 0, 7], ['injury', 7, 2], ['play_attit', 1, 2], ['mo_drib', 3, 2],
  ['pos12', 5, 2], ['pos9', 7, 2], ['pos10', 1, 2], ['pos11', 3, 2], ['pos5', 5, 2], ['pos6', 7, 2], ['pos7', 1, 2],
  ['pos8', 3, 2], ['pos4', 5, 2], ['e_regpos', 7, 1], ['pos3', 0, 2], ['pos1', 2, 2], ['pos0', 4, 2], ['reflex', 6, 7],
  ['kick_pwr', 5, 7], ['pos2', 4, 2], ['e_playpos', 6, 1], ['e_ability', 7, 1], ['e_skill', 0, 1], ['e_style', 1, 1],
  ['e_com', 2, 1], ['e_motion', 3, 1], ['strong_foot', 5, 1], ['strong_hand', 6, 1],
  ['com0', 7, 1], ['com1', 0, 1], ['com2', 1, 1], ['com3', 2, 1], ['com4', 3, 1], ['com5', 4, 1], ['com6', 5, 1],
  ['sk0', 6, 1], ['sk28', 7, 1], ['sk1', 0, 1], ['sk2', 1, 1], ['sk3', 2, 1], ['sk29', 3, 1], ['sk4', 4, 1], ['sk5', 5, 1],
  ['sk30', 6, 1], ['sk6', 7, 1], ['sk7', 0, 1], ['sk31', 1, 1], ['sk39', 2, 1], ['sk8', 3, 1], ['sk32', 4, 1], ['sk33', 5, 1],
  ['sk9', 6, 1], ['sk10', 7, 1], ['sk11', 0, 1], ['sk12', 1, 1], ['sk40', 2, 1], ['sk13', 3, 1], ['sk14', 4, 1], ['sk15', 5, 1],
  ['sk16', 6, 1], ['sk34', 7, 1], ['sk17', 0, 1], ['sk18', 1, 1], ['sk35', 2, 1], ['sk19', 3, 1], ['sk20', 4, 1], ['sk36', 5, 1],
  ['sk37', 6, 1], ['sk21', 7, 1], ['sk22', 0, 1], ['sk23', 1, 1], ['sk38', 2, 1], ['sk24', 3, 1], ['sk25', 4, 1], ['sk26', 5, 1],
  ['sk27', 6, 1], ['skip', 1],
  ['str', 'name', 61], ['str', 'shirt', 61], ['skip', 64],
  ['skip', 4], ['e_face', 0, 1], ['e_hair', 1, 1], ['e_phys', 2, 1], ['e_strip', 3, 1], ['boot_id', 4, 14], ['glove_id', 2, 14],
  ['copy_id', 0, 32],
  ['neck_len', 0, 4], ['neck_size', 4, 4], ['shldr_hi', 0, 4], ['shldr_wid', 4, 4], ['chest', 0, 4], ['waist', 4, 4],
  ['arm_size', 0, 4], ['arm_len', 4, 4], ['thigh', 0, 4], ['calf', 4, 4], ['leg_len', 0, 4], ['head_len', 4, 4],
  ['head_wid', 0, 4], ['head_dep', 4, 4], ['wrist_col_l', 0, 3], ['wrist_col_r', 3, 3], ['wrist_tape', 6, 2],
  ['spec_col', 0, 3], ['spec_style', 3, 3], ['sleeve', 6, 2], ['inners', 0, 2], ['socks', 2, 2], ['undershorts', 4, 2],
  ['untucked', 6, 1], ['ankle_tape', 7, 1], ['gloves', 0, 1], ['gloves_col', 1, 3], ['skip', 23], ['skin_col', 0, 3],
  ['skip', 19], ['iris_col', 0, 4],
];

const TEAM_SPEC = [
  ['id', 0, 32], ['manager_id', 0, 32], ['skip', 2], ['stadium_id', 0, 16], ['skip', 2], ['country', 0, 9], ['skip', 7],
  ['c1r', 2, 6], ['c1g', 0, 6], ['e_name', 6, 1], ['e_emblem', 7, 1], ['c2g', 0, 6], ['c2b', 6, 6], ['skip', 2],
  ['e_stadium', 6, 1], ['e_stadname', 7, 1], ['skip', 2], ['c1b', 0, 6], ['c2r', 6, 6],
  ['skip', 0x39], ['rival1', 0, 32], ['rival2', 0, 32], ['rival3', 0, 32], ['skip', 4],
  ['str', 'name', 0x46], ['str', 'short', 4], ['str', 'stadium_name', 181],
  ['str', 'banner1', 16], ['str', 'banner2', 16], ['str', 'banner3', 16], ['str', 'banner4', 16],
];

function compile(spec) {
  const out = [];
  let cursor = 0;
  for (const f of spec) {
    if (f[0] === 'skip') { cursor += f[1]; continue; }
    if (f[0] === 'str') { out.push({ name: f[1], kind: 'string', offset: cursor, length: f[2] }); cursor += f[2]; continue; }
    const [name, startBit, bits] = f;
    out.push({ name, kind: 'bits', offset: cursor, shift: startBit, bits, addend: 0 });
    cursor += Math.floor((startBit + bits) / 8);
  }
  return out;
}

export const EDIT_PLAYER_FIELDS = compile(PLAYER_SPEC);
export const EDIT_TEAM_FIELDS = compile(TEAM_SPEC);

export const EDIT_LAYOUT = {
  playerSize: 0x138,
  playerStart: 0x7c,
  playerCountOffset: 96,
  teamCountOffset: 100,
  teamStart: 0x8ed2fc,
  rosterSize: 0x11c,
  rosterSlots: 40,
  tacticsSize: 0x274,
  2021: { teamSize: 0x24c, roster: 0x9d4648, tactics: 0xa09880 },
  2020: { teamSize: 0x210, roster: 0x9ccc04, tactics: 0xa01e3c },
};

// Coach (manager) section, PES 2021 only. Offsets from the EJOGC Edit-mode layout for PES 2021
// (data length 10995800, team start 0x8ED2FC, coach table 1300 × 88 bytes), verified on the user's EDIT:
// u16 at 102 = 727 used entries, unused slots have id 0xFFFFFFFF; 706/706 coaches also in Coach.bin
// have the same name and country; every team's manager_id (+4) is one of these coaches and equals
// Team.bin `coach` for 704/704 teams. Byte 8 holds flags (bit 0 name edited, bit 1 country edited,
// EJOGC labels); the upper bits (0x60 on 725/727 entries) are preserved.
export const EDIT_COACH = { start: 0x958da4, size: 88, max: 1300, countOffset: 102 };

export const EDIT_COACH_FIELDS = [
  { name: 'id', kind: 'uint', offset: 0, size: 4 },
  { name: 'country', kind: 'uint', offset: 4, size: 2 },
  { name: 'e_name', kind: 'bool', offset: 8, bit: 0 },
  { name: 'e_country', kind: 'bool', offset: 8, bit: 1 },
  { name: 'name', kind: 'string', offset: 9, length: 78 },
];

// Team tactics block (one per team, `tacticsBase`), from PES Editor Rebuilt js/app.js + js/extras.js
// ("offsets verified in-game"), and confirmed on the user's EDIT (Ireland, Arsenal, Chelsea):
//   +0x004 + plan*0xA0         plan p (3 plans); inside each plan:
//      + v*0x21                  formation variant v (3): byte 0 = 0, roles[1..10], pos[0..10] as (depth, lateral)
//      +0x63..0x69               strategy toggles (0/1); +0x6C/+0x74 attack instr., +0x7C/+0x84 defence instr.
//      +0x8C..0x90               support range, numbers in attack, defensive line, compactness, numbers in defence
//      +0x91 (11 bytes)          marking per formation slot, 0xFF = automatic
//   +0x1E4 (40 bytes)          order: permutation of the 40 roster slots; [0] GK, [1..10] formation entries 1..10, rest bench
//   +0x20C (9 bytes)           set-piece takers (roster slot, 0xFF = none), in game-menu order
//   +0x215                     captain (roster slot)
// The GK sits at (3, 52) in every formation of the EDIT; lateral grows to the right (RB ≈ 88).
export const EDIT_TACTICS = {
  planBase: 4, planSize: 0xa0, plans: 3, variantSize: 0x21, variants: 3,
  order: 0x1e4, takers: 0x20c, takerCount: 9, captain: 0x215,
  advanced: [0x6c, 0x74, 0x7c, 0x84], marking: 0x91, markingCount: 11,
  gkPosition: [3, 52],
};

/**
 * Advanced instruction codes the game accepts in the attack slots (+0x6C, +0x74) and defence slots (+0x7C, +0x84)
 * of a plan; 0 = none. From PES Editor Rebuilt js/extras.js ADV_CODES ("verified in the game"; 15 is "probable").
 * Names and descriptions for the UI: utils/advancedInstructions.js.
 */
export const EDIT_ADVANCED_CODES = { attack: [1, 2, 3, 4, 5, 6, 7, 9], defense: [11, 12, 13, 14, 15, 16] };

/** Set-piece takers in EDIT order (Rebuilt SP_ROLES): index -> meaning. */
export const EDIT_TAKER_ROLES = ['longFK', 'shortFK', 'secondKicker', 'leftCorner', 'rightCorner', 'penalty', 'header1', 'header2', 'header3'];

/** Strategy bytes inside a plan with their valid ranges (Rebuilt STRAT_BIN / STRAT_RANGE). */
export const EDIT_STRATEGY = {
  attackingStyles: { offset: 0x63, min: 0, max: 1 }, // 0 counter attack, 1 possession
  buildUp: { offset: 0x64, min: 0, max: 1 }, // 0 long pass, 1 short pass
  attackingArea: { offset: 0x65, min: 0, max: 1 }, // 0 wings, 1 centre
  positioning: { offset: 0x66, min: 0, max: 1 }, // 0 maintain formation, 1 flexible
  defensiveStyles: { offset: 0x67, min: 0, max: 1 }, // 0 frontline pressure, 1 all-out defence
  containmentArea: { offset: 0x68, min: 0, max: 1 }, // 0 centre, 1 wings
  pressuring: { offset: 0x69, min: 0, max: 1 }, // 0 aggressive, 1 conservative (inverse of the app)
  supportRange: { offset: 0x8c, min: 1, max: 10 },
  numbersInAttack: { offset: 0x8d, min: 1, max: 3 },
  defensiveLine: { offset: 0x8e, min: 1, max: 10 },
  compactness: { offset: 0x8f, min: 1, max: 10 },
  numbersInDefense: { offset: 0x90, min: 1, max: 3 },
};

// Fields that are identifiers or edit flags: shown but never editable through the engine.
export const EDIT_LOCKED_FIELDS = new Set(['id', 'comm_id', 'copy_id', 'e_player', 'e_basic', 'e_regpos', 'e_playpos', 'e_ability',
  'e_skill', 'e_style', 'e_com', 'e_motion', 'e_face', 'e_hair', 'e_phys', 'e_strip', 'e_name', 'e_emblem', 'e_stadium', 'e_stadname']);

const BODY_FIELDS = new Set(['head_len', 'head_wid', 'head_dep', 'neck_len', 'neck_size', 'shldr_hi', 'shldr_wid', 'chest', 'waist',
  'arm_size', 'arm_len', 'thigh', 'calf', 'leg_len', 'skin_col', 'iris_col']);

// "Edited" flags the game needs raised so it uses the EDIT value instead of the
// database one. Mirrors FIELD_FLAGS / setT calls in PES Editor Rebuilt js/app.js.
// Team colours (c1r..c2b) raise no flag there either.
export function editFlagsFor(entity, field, value) {
  if (entity === 'team') {
    if (field === 'name' || field === 'short') return ['e_name'];
    if (field === 'stadium_id') return ['e_stadium'];
    if (field === 'stadium_name') return value ? ['e_stadname'] : [];
    return [];
  }
  if (/^(name|shirt|comm_id)$/.test(field)) return ['e_player'];
  if (/^(nation|age|height|weight|strong_foot|strong_hand|star|play_attit)$/.test(field)) return ['e_player', 'e_basic'];
  if (field === 'reg_pos') return ['e_regpos'];
  if (/^pos\d+$/.test(field)) return ['e_playpos'];
  if (/^sk\d+$/.test(field)) return ['e_skill'];
  if (/^com\d$/.test(field) || field === 'play_style') return ['e_style', 'e_com'];
  if (/^(mo_|gc)/.test(field)) return ['e_motion'];
  if (BODY_FIELDS.has(field)) return ['e_phys'];
  if (/^(wrist|spec|sleeve|inners|socks|undershorts|untucked|ankle|gloves|boot_id|glove_id)/.test(field)) return ['e_strip'];
  return ['e_ability'];
}

/** Converts an 8-bit colour channel to the 6-bit value stored in EDIT team colours. */
export const to6bit = v => Math.round(v * 63 / 255);
/** Converts a stored 6-bit colour channel back to 8 bits for display. */
export const from6bit = v => Math.round(v * 255 / 63);
