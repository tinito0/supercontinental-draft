// Player.bin skills, COM styles and motions (pes/formats/pes2021/playerExtraLayout.js).
// SYNTHETIC: layout consistency and single-bit writes on a zeroed record; they say nothing about the game.
// REAL (npm run test:real): every field equals the EJOGC export scripts/jugadores_exportados.csv for every player.
import fs from 'node:fs';
import path from 'node:path';
import { PLAYER_FIELDS, PLAYER_RECORD_SIZE } from '../../pes/formats/pes2021/binLayout.js';
import { PLAYER_EXTRA_FIELDS } from '../../pes/formats/pes2021/playerExtraLayout.js';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { fieldRange, readField, writeField, validateFieldValue } from '../../pes/core/fields.js';
import { PLAYER_SKILLS_MAP } from '../../utils/constants.js';
import { hasPesdb, readPesdb } from './fixtures.js';

const bitsOf = f => {
  const start = f.kind === 'bits' ? f.offset * 8 + f.shift : f.kind === 'bool' ? f.offset * 8 + f.bit : f.offset * 8;
  const len = f.kind === 'bits' ? f.bits : f.kind === 'bool' ? 1 : (f.kind === 'string' ? f.length : f.size) * 8;
  return Array.from({ length: len }, (_, i) => start + i);
};

describe('playerExtraLayout (synthetic)', () => {
  it('has a field for every skill and COM style the market knows', () => {
    const csv = new Set(PLAYER_EXTRA_FIELDS.map(f => f.csv));
    for (const key of Object.keys(PLAYER_SKILLS_MAP)) expect(csv.has(key), key).toBe(true);
  });

  it('never shares a bit with binLayout.js or with another extra field', () => {
    const owner = new Map();
    for (const f of [...PLAYER_FIELDS, ...PLAYER_EXTRA_FIELDS]) {
      for (const b of bitsOf(f)) {
        expect(owner.get(b), `${f.name} bit ${b}`).toBeUndefined();
        owner.set(b, f.name);
      }
    }
  });

  it('a skill write sets one bit and nothing else', () => {
    const f = PLAYER_EXTRA_FIELDS.find(x => x.name === 'skillScissorsFeint');
    const buf = new Uint8Array(PLAYER_RECORD_SIZE);
    writeField(buf, 0, f, true);
    expect(buf.reduce((n, b) => n + b.toString(2).split('1').length - 1, 0)).toBe(1);
    expect(readField(buf, 0, f)).toBe(true);
    writeField(buf, 0, f, false);
    expect(buf.every(b => b === 0)).toBe(true);
  });

  it('limits motions to the types the game data uses', () => {
    const f = PLAYER_EXTRA_FIELDS.find(x => x.name === 'penaltyKick');
    expect(fieldRange(f)).toEqual({ min: f.min, max: f.max });
    expect(() => validateFieldValue(f, f.max + 1)).toThrow(/fuera de rango/);
  });
});

const CSV = path.resolve(__dirname, '../../scripts/jugadores_exportados.csv');

describe('playerExtraLayout (real Player.bin)', () => {
  it.skipIf(!hasPesdb || !fs.existsSync(CSV))('equals the EJOGC export for every player', () => {
    const table = loadBinDatabase(readPesdb(['Player.bin'])).tables.player;
    const lines = fs.readFileSync(CSV, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(';');
    const rows = lines.slice(1).map(l => l.split(';')).filter(r => table.has(Number(r[0])));
    expect(rows.length).toBeGreaterThan(1000);
    for (const f of PLAYER_EXTRA_FIELDS) {
      const c = header.indexOf(f.csv);
      const bad = rows.filter(r => {
        const v = table.get(Number(r[0]), f.name);
        return f.kind === 'bool' ? v !== (r[c] === 'True') : v !== Number(r[c]);
      });
      expect(bad.length, f.name).toBe(0);
    }
  });
});
