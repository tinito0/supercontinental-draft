// Player.bin field ↔ EDIT00000000 player field, so one edit in the player editor writes both files: the game takes
// the EDIT value of an edited player over the database one, so changing only Player.bin would not show.
//
// Evidence: the 17 players of the owner's EDIT (2026-11-27) that are also in his Player.bin. Stats, body,
// positions 0–8, COM styles and 28 skills are equal on all 17 (tests/pes/playerFieldSync.test.js, test:real).
// EDIT stores the 1-based values (weak foot, attitude, motions) as value − 1. Skills: the EDIT bit order is the
// Player.bin/CSV skill order, so the 13 skills none of those players has (Sombrero, Rabona, No Look Pass, the GK
// kicks, Long Throw, GK Penalty Saver, Man Marking, Interception, Acrobatic Clear) follow by position; the 28 that
// do appear all sit where that order puts them. Positions pos9–pos12 are left out: those players are C everywhere
// there, so the order of CB/LB/RB/GK is not known. Celebrations are not linked: the game takes them from the EDIT
// only (owner, 2026-11-27), and the editor edits EDIT gc1/gc2 directly.

const SKILL_ORDER = [
  // [Player.bin field, EDIT field], in the file order of both.
  ['ScissorsFeint', 'sk0'], ['DoubleTouch', 'sk28'], ['FlipFlap', 'sk1'], ['MarseilleTurn', 'sk2'], ['Sombrero', 'sk3'],
  ['CrossOverTurn', 'sk29'], ['CutBehindAndTurn', 'sk4'], ['ScotchMove', 'sk5'], ['StepOnSkillcontrol', 'sk30'],
  ['HeadingSpecial', 'sk6'], ['LongRangeDrive', 'sk7'], ['Chipshotcontrol', 'sk31'], ['LongRangeShot', 'sk39'],
  ['KnuckleShot', 'sk8'], ['DippingShots', 'sk32'], ['RisingShots', 'sk33'], ['AcrobaticFinishing', 'sk9'],
  ['HeelTrick', 'sk10'], ['FirstTimeShot', 'sk11'], ['OneTouchPass', 'sk12'], ['ThroughPassing', 'sk40'],
  ['WeightedPass', 'sk13'], ['PinpointCrossing', 'sk14'], ['OutsideCurler', 'sk15'], ['Rabona', 'sk16'],
  ['NoLookPass', 'sk34'], ['LowLoftedPass', 'sk17'], ['GKLowPunt', 'sk18'], ['GKHighPunt', 'sk35'],
  ['LongThrow', 'sk19'], ['GKLongThrow', 'sk20'], ['PenaltySpecialist', 'sk36'], ['GKPenaltySaver', 'sk37'],
  ['Gamesmanship', 'sk21'], ['ManMarking', 'sk22'], ['TrackBack', 'sk23'], ['Interception', 'sk38'],
  ['AcrobaticClear', 'sk24'], ['Captaincy', 'sk25'], ['SuperSub', 'sk26'], ['FightingSpirit', 'sk27'],
];
const COM_ORDER = ['Trickster', 'MazingRun', 'SpeedingBullet', 'IncisiveRun', 'LongBallExpert', 'EarlyCross', 'LongRanger'];

// Playing style: Player.bin uses the EJOGC numbering (names in PLAYING_STYLE_BY_ID), the EDIT the game menu order.
// Confirmed on the owner's players: EDIT 1→1, 3→3, 5→14, 6→4, 7→18, 10→6, 11→7. The rest follow the menu order
// (Goal Poacher … Defensive Goalkeeper); check them in the game before relying on them.
export const EDIT_STYLE_TO_BIN = {
  0: 0, 1: 1, 2: 2, 3: 3, 4: 13, 5: 14, 6: 4, 7: 18, 8: 19, 9: 5, 10: 6, 11: 7, 12: 8, 13: 9, 14: 20, 15: 15,
  16: 11, 17: 21, 18: 12, 19: 10, 20: 16, 21: 17,
};
const BIN_STYLE_TO_EDIT = Object.fromEntries(Object.entries(EDIT_STYLE_TO_BIN).map(([e, b]) => [b, Number(e)]));

const same = edit => ({ edit, toEdit: v => v, toBin: v => v });
const minusOne = edit => ({ edit, toEdit: v => v - 1, toBin: v => v + 1 });
const flag = edit => ({ edit, toEdit: v => (v ? 1 : 0), toBin: v => Boolean(v) });

/** Player.bin field name → { edit: EDIT field, toEdit(value), toBin(value) }. */
export const BIN_TO_EDIT = {
  name: same('name'), shirt: same('shirt'), country: same('nation'), height: same('height'), weight: same('weight'),
  age: same('age'), registeredPosition: same('reg_pos'), strongFootLeft: flag('strong_foot'),
  offensiveAwareness: same('atk'), ballControl: same('ball_ctrl'), dribbling: same('drib'), tightPossession: same('tight_pos'),
  lowPass: same('lowpass'), loftedPass: same('loftpass'), finishing: same('finish'), heading: same('header'),
  placeKicking: same('place_kick'), curl: same('swerve'), speed: same('speed'), acceleration: same('exp_pwr'),
  kickingPower: same('kick_pwr'), jump: same('jump'), physicalContact: same('phys_cont'), balance: same('body_ctrl'),
  stamina: same('stamina'), defensiveAwareness: same('def'), ballWinning: same('ball_win'), aggression: same('aggres'),
  posCF: same('pos0'), posSS: same('pos1'), posLWF: same('pos2'), posRWF: same('pos3'), posAMF: same('pos4'),
  posDMF: same('pos5'), posCMF: same('pos6'), posLMF: same('pos7'), posRMF: same('pos8'),
  weakFootUsage: minusOne('weak_use'), weakFootAcc: minusOne('weak_acc'), playingAttitude: minusOne('play_attit'),
  form: minusOne('form'), injuryResistance: minusOne('injury'), reputation: minusOne('star'),
  dribblingArmMovement: minusOne('mo_armd'), runningArmMovement: minusOne('mo_armr'), dribblingHunching: minusOne('mo_hunchd'),
  runningHunching: minusOne('mo_hunchr'), cornerKicks: minusOne('mo_ck'), freeKicks: minusOne('mo_fk'),
  penaltyKick: minusOne('mo_pk'), dribbleMotion: minusOne('mo_drib'),
  playingStyle: { edit: 'play_style', toEdit: v => BIN_STYLE_TO_EDIT[v], toBin: v => EDIT_STYLE_TO_BIN[v] },
  ...Object.fromEntries(SKILL_ORDER.map(([s, e]) => [`skill${s}`, flag(e)])),
  ...Object.fromEntries(COM_ORDER.map((c, i) => [`com${c}`, flag(`com${i}`)])),
};

/**
 * Operations for one Player.bin edit: the bin one, plus the EDIT one when the player is also in the EDIT and the
 * field has an EDIT counterpart.
 */
export function playerEditOps(playerId, field, value, { inEdit }) {
  const ops = [{ type: 'bin.player.set', target: { playerId }, field, value }];
  const link = BIN_TO_EDIT[field];
  if (inEdit && link) {
    const editValue = link.toEdit(value);
    if (editValue !== undefined) ops.push({ type: 'edit.player.set', target: { playerId }, field: link.edit, value: editValue });
  }
  return ops;
}
