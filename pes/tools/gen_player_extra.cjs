// Generates pes/formats/pes2021/playerExtraLayout.js: the Player.bin fields that gen_layout.cjs leaves out
// (COM playing styles, player skills, motions, caps, flags). EJOGC's table has them past entry 57, but the
// offsets here are found by searching, not copied: for each column of an EJOGC Players CSV export, every bit
// position of the 312-byte record is tried, and a field is kept only when it equals the CSV for every id-matched
// player and its bits do not overlap a field of binLayout.js.
//
// Usage: node pes/tools/gen_player_extra.cjs <Player.bin> <jugadores_exportados.csv> [out.js]
// The CSV must be exported from the same Player.bin; with another season's export the match drops below 100%
// and the field is reported and left out.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const [binPath, csvPath, outArg] = process.argv.slice(2);
if (!binPath || !csvPath) {
  console.error('Usage: node pes/tools/gen_player_extra.cjs <Player.bin> <jugadores_exportados.csv> [out.js]');
  process.exit(1);
}
const outFile = outArg || path.resolve(__dirname, '../formats/pes2021/playerExtraLayout.js');
const RECORD = 312;

// WESYS: FF 10 <flags> "WESYS" u32 storedSize u32 size, then the payload (zlib when flags = 0x81).
const file = fs.readFileSync(binPath);
const P = file[2] === 0x81 ? zlib.inflateSync(file.subarray(16)) : file.subarray(16);
if (P.length % RECORD) throw new Error(`Player.bin: ${P.length} bytes is not a multiple of ${RECORD}`);
const N = P.length / RECORD;
const byId = new Map();
for (let i = 0; i < N; i++) byId.set(P.readUInt32LE(i * RECORD + 8), i * RECORD);

const lines = fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
const header = lines[0].split(';');
const rows = lines.slice(1).map(l => l.split(';')).filter(r => byId.has(Number(r[0])));

// [CSV column, field name, group]. Bool columns are skills and flags; the rest are small numbers.
const COM = ['Trickster', 'MazingRun', 'SpeedingBullet', 'IncisiveRun', 'LongBallExpert', 'EarlyCross', 'LongRanger'];
const SKILLS = ['ScissorsFeint', 'DoubleTouch', 'FlipFlap', 'MarseilleTurn', 'Sombrero', 'CrossOverTurn', 'CutBehindAndTurn',
  'ScotchMove', 'StepOnSkillcontrol', 'HeadingSpecial', 'LongRangeDrive', 'Chipshotcontrol', 'LongRangeShot', 'KnuckleShot',
  'DippingShots', 'RisingShots', 'AcrobaticFinishing', 'HeelTrick', 'FirstTimeShot', 'OneTouchPass', 'ThroughPassing',
  'WeightedPass', 'PinpointCrossing', 'OutsideCurler', 'Rabona', 'NoLookPass', 'LowLoftedPass', 'GKLowPunt', 'GKHighPunt',
  'LongThrow', 'GKLongThrow', 'PenaltySpecialist', 'GKPenaltySaver', 'Gamesmanship', 'ManMarking', 'TrackBack',
  'Interception', 'AcrobaticClear', 'Captaincy', 'SuperSub', 'FightingSpirit'];
const MOTIONS = [['Celebration1', 'celebration'], ['DribblingHunching', 'dribblingHunching'], ['DribblingArmMove.', 'dribblingArmMovement'],
  ['RunningHunching', 'runningHunching'], ['RunningArmMovement', 'runningArmMovement'], ['CornerKicks', 'cornerKicks'],
  ['FreeKicks', 'freeKicks'], ['PenaltyKick', 'penaltyKick'], ['DribbleMotion', 'dribbleMotion']];
const SPEC = [
  ...COM.map(c => [c, `com${c}`, 'comStyle']),
  ...SKILLS.map(c => [c, `skill${c}`, 'skill']),
  ...MOTIONS.map(([c, n]) => [c, n, 'motion']),
  ['NationalCaps', 'nationalCaps', 'career'],
  ['Legend', 'legend', 'flag'], ['Hand', 'leftHanded', 'flag'], ['WinnerGoldenBall', 'goldenBallWinner', 'flag'],
];

async function main() {
// Bits already taken by binLayout.js (an ES module).
const { PLAYER_FIELDS } = await import(require('url').pathToFileURL(path.resolve(__dirname, '../formats/pes2021/binLayout.js')).href);
const used = new Set();
for (const f of PLAYER_FIELDS) {
  const s = f.kind === 'bits' ? f.offset * 8 + f.shift : f.kind === 'bool' ? f.offset * 8 + f.bit : f.offset * 8;
  const len = f.kind === 'bits' ? f.bits : f.kind === 'bool' ? 1 : (f.kind === 'string' ? f.length : f.size) * 8;
  for (let p = s; p < s + len; p++) used.add(p);
}

const bitAt = (base, p) => (P[base + (p >> 3)] >> (p & 7)) & 1;
const readBits = (base, p, bits) => { let v = 0; for (let i = 0; i < bits; i++) v += bitAt(base, p + i) << i; return v; };
const bases = rows.map(r => byId.get(Number(r[0])));

const fields = [];
const skipped = [];
for (const [col, name, group] of SPEC) {
  const c = header.indexOf(col);
  if (c < 0) { skipped.push(`${col}: no column`); continue; }
  const values = rows.map(r => r[c]);
  if (values.every(v => v === 'True' || v === 'False')) {
    const want = values.map(v => (v === 'True' ? 1 : 0));
    const trues = want.reduce((a, b) => a + b, 0);
    const hits = [];
    for (let p = 0; p < RECORD * 8; p++) {
      if (used.has(p)) continue;
      let ok = true;
      for (let i = 0; i < bases.length && ok; i++) ok = bitAt(bases[i], p) === want[i];
      if (ok) hits.push(p);
    }
    if (hits.length !== 1 || trues === 0) { skipped.push(`${col}: ${hits.length} exact positions, ${trues} players with it`); continue; }
    const p = hits[0];
    fields.push({ name, kind: 'bool', offset: p >> 3, bit: p & 7, group, csv: col,
      evidence: `bit ${p}; ${rows.length}/${rows.length} id-matched players equal the EJOGC Players export (${trues} true); only matching position`,
      confidence: 'verified' });
    continue;
  }
  const nums = values.map(Number);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  let found = null;
  for (let bits = Math.max(1, Math.ceil(Math.log2(max - min + 1))); bits <= 16 && !found; bits++) {
    for (const addend of [0, 1]) {
      for (let p = 0; p + bits <= RECORD * 8 && !found; p++) {
        let free = true;
        for (let i = 0; i < bits && free; i++) free = !used.has(p + i);
        if (!free) continue;
        let ok = true;
        for (let i = 0; i < bases.length && ok; i++) ok = readBits(bases[i], p, bits) + addend === nums[i];
        if (ok) found = { p, bits, addend };
      }
      if (found) break;
    }
  }
  if (!found) { skipped.push(`${col}: no exact bit field`); continue; }
  const { p, bits, addend } = found;
  // Values the game data uses: the UI offers this range, never the field's full bit capacity.
  fields.push({ name, kind: 'bits', offset: p >> 3, shift: p & 7, bits, addend, min, max, group, csv: col,
    evidence: `bits ${p}–${p + bits - 1}; ${rows.length}/${rows.length} id-matched players equal the EJOGC Players export; values ${min}–${max}`,
    confidence: 'verified' });
}

// No two new fields may share a bit either.
const taken = new Map();
for (const f of fields) {
  const s = f.kind === 'bool' ? f.offset * 8 + f.bit : f.offset * 8 + f.shift;
  const len = f.kind === 'bool' ? 1 : f.bits;
  for (let p = s; p < s + len; p++) {
    if (taken.has(p)) throw new Error(`${f.name} overlaps ${taken.get(p)} at bit ${p}`);
    taken.set(p, f.name);
  }
}

const js = `// GENERATED by pes/tools/gen_player_extra.cjs — do not edit by hand.
// Player.bin fields not covered by binLayout.js, found by searching every bit of the record against an EJOGC
// Players CSV export of the same file (${rows.length} players). Matching that export is not an in-game test.
// Each field's bits are outside every binLayout.js field and outside each other.

export const PLAYER_EXTRA_FIELDS = ${JSON.stringify(fields, null, 2)};
`;
fs.writeFileSync(outFile, js);
console.log(`${fields.length} fields written to ${path.relative(process.cwd(), outFile)}`);
if (skipped.length) console.log(`Skipped:\n  ${skipped.join('\n  ')}`);
}
main().catch(err => { console.error(err); process.exit(1); });
