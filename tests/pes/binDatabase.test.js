import { describe, it, expect, beforeAll } from 'vitest';
import { loadBinDatabase, serializeBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { decodeWesys } from '../../pes/core/wesys.js';
import { fieldByteSpan } from '../../pes/core/fields.js';
import { TEAM_FIELDS, PLAYER_FIELDS } from '../../pes/formats/pes2021/binLayout.js';
import { hasPesdb, readPesdb, syntheticTable } from './fixtures.js';

function changedBytes(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

describe('pesdb format detection (synthetic)', () => {
  it('rejects a Team.bin whose size is not a multiple of the record size', () => {
    const bad = syntheticTable({ count: 1, size: 1000, idOffset: 8 });
    expect(() => loadBinDatabase({ 'Team.bin': bad })).toThrow(expect.objectContaining({ code: 'RECORD_SIZE_MISMATCH' }));
  });

  it('requires at least one supported file', () => {
    expect(() => loadBinDatabase({ 'Derby.bin': syntheticTable({ count: 1, size: 100, idOffset: 0 }) }))
      .toThrow(expect.objectContaining({ code: 'NO_SUPPORTED_FILES' }));
  });

  it('reports unknown files instead of dropping them silently', () => {
    const db = loadBinDatabase({ 'Team.bin': syntheticTable({ count: 2, size: 1532, idOffset: 8 }), 'Mystery.bin': new Uint8Array(4) });
    expect(db.unsupported).toEqual(['Mystery.bin']);
  });

  it('detects duplicate ids', () => {
    const db = loadBinDatabase({ 'Team.bin': syntheticTable({ count: 3, size: 1532, idOffset: 8, ids: [5, 6, 5] }) });
    expect(db.tables.team.duplicateIds).toEqual([5]);
  });
});

describe.skipIf(!hasPesdb)('pesdb on the real UML database', () => {
  let files;
  beforeAll(() => { files = readPesdb(); });

  it('loads the supported tables with the verified record counts', () => {
    const db = loadBinDatabase(files);
    expect(db.tables.team.count).toBe(704);
    expect(db.tables.player.count).toBe(27437);
    expect(db.tables.assignment.count).toBe(19404);
    expect(db.tables.coach.count).toBe(1851);
    expect(db.unsupported).toEqual([]);
    expect(Object.keys(db.passthrough).length).toBeGreaterThan(0);
  });

  it('reads documented team and player fields', () => {
    const db = loadBinDatabase(files);
    expect(db.tables.team.read(1).nameEnglish).toBe('Ireland');
    const p = db.tables.player.read(45685);
    expect(p.name).toBe('J. Quintero');
    expect(p.height).toBe(169);
  });

  it('a player edit changes only the bytes of that field and survives serialization', () => {
    const db = loadBinDatabase(files);
    const before = db.tables.player.data.slice();
    db.tables.player.set(45685, 'height', 181);
    const out = serializeBinDatabase(db);
    expect(Object.keys(out)).toEqual(['Player.bin']); // unmodified tables are not re-written
    const after = decodeWesys(out['Player.bin']).payload;
    const base = db.tables.player.baseOf(45685);
    const [s, e] = fieldByteSpan(PLAYER_FIELDS.find(f => f.name === 'height'));
    for (const i of changedBytes(before, after)) expect(i >= base + s && i < base + e).toBe(true);
    expect(loadBinDatabase({ 'Player.bin': out['Player.bin'] }).tables.player.get(45685, 'height')).toBe(181);
  });

  it('serializes a modified table back to an identical payload when the edit is reverted', () => {
    const db = loadBinDatabase(files);
    const original = db.tables.team.get(1, 'nameSpanish');
    db.tables.team.set(1, 'nameSpanish', 'Prueba');
    db.tables.team.set(1, 'nameSpanish', original);
    expect(db.tables.team.isModified()).toBe(false);
  });

  it('keeps unknown bytes of a team record intact', () => {
    const db = loadBinDatabase(files);
    const before = db.tables.team.data.slice();
    db.tables.team.set(1, 'nameEnglish', 'Republic of Ireland');
    const base = db.tables.team.baseOf(1);
    const [s, e] = fieldByteSpan(TEAM_FIELDS.find(f => f.name === 'nameEnglish'));
    for (const i of changedBytes(before, db.tables.team.data)) expect(i >= base + s && i < base + e).toBe(true);
  });

  it('refuses id changes and unverified fields', () => {
    const db = loadBinDatabase(files);
    expect(() => db.tables.player.set(45685, 'id', 1)).toThrow(expect.objectContaining({ code: 'ID_IMMUTABLE' }));
    expect(() => db.tables.player.set(45685, 'gkReach', 70)).toThrow(expect.objectContaining({ code: 'FIELD_READ_ONLY' }));
    expect(() => db.tables.team.set(1, 'nonPlayableLeague', 0)).toThrow(expect.objectContaining({ code: 'FIELD_READ_ONLY' }));
    expect(() => db.tables.player.set(45685, 'speed', 200)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => db.tables.player.set(999999999, 'speed', 70)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});
