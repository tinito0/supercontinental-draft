import { describe, it, expect } from 'vitest';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { decryptEdit } from '../../pes/formats/pes2021/editCrypto.js';
import { hasEdit, readEdit, hasPesdb, readPesdb } from './fixtures.js';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';

describe('EDIT00000000 format detection', () => {
  it('rejects data that is not a PES 2020/2021 save', () => {
    expect(() => loadEditDatabase(new Uint8Array(4096).map((_, i) => i % 256))).toThrow(expect.objectContaining({ code: 'NOT_EDIT' }));
    expect(() => loadEditDatabase(new Uint8Array(10))).toThrow(expect.objectContaining({ code: 'NOT_EDIT' }));
  });
});

describe.skipIf(!hasEdit)('EDIT00000000 of the user patch', () => {
  it('decrypts and re-encrypts byte for byte', () => {
    const src = readEdit();
    const ed = loadEditDatabase(src);
    expect(ed.info()).toMatchObject({ game: '2021', teams: 704 });
    expect(Buffer.compare(Buffer.from(ed.serialize()), Buffer.from(src))).toBe(0);
  });

  it('rejects a truncated EDIT', () => {
    const src = readEdit();
    expect(() => loadEditDatabase(src.subarray(0, src.length - 1))).toThrow(expect.objectContaining({ code: 'NOT_EDIT' }));
  });

  it('edits a player and raises the edit flags the game needs', () => {
    const ed = loadEditDatabase(readEdit());
    const r = ed.setPlayerField(45685, 'height', 172);
    expect(r).toMatchObject({ before: 169, after: 172, flags: ['e_player', 'e_basic'] });
    const again = loadEditDatabase(ed.serialize());
    expect(again.readPlayer(45685)).toMatchObject({ height: 172, e_player: 1, e_basic: 1 });
  });

  it('keeps description, logo and serial sections unchanged after an edit', () => {
    const src = readEdit();
    const ed = loadEditDatabase(src);
    ed.setTeamField(1, 'c1r', 10);
    const a = decryptEdit(src), b = decryptEdit(ed.serialize());
    expect(Buffer.compare(Buffer.from(a.desc), Buffer.from(b.desc))).toBe(0);
    expect(Buffer.compare(Buffer.from(a.logo), Buffer.from(b.logo))).toBe(0);
    expect(Buffer.compare(Buffer.from(a.serial), Buffer.from(b.serial))).toBe(0);
  });

  it('validates roster edits', () => {
    const ed = loadEditDatabase(readEdit());
    const [first, second] = ed.roster(1);
    expect(() => ed.setRosterNumber(1, first.slot, second.number)).toThrow(expect.objectContaining({ code: 'DUPLICATE_NUMBER' }));
    expect(() => ed.setRosterNumber(1, first.slot, 100)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(() => ed.setRosterPlayer(1, first.slot, second.playerId)).toThrow(expect.objectContaining({ code: 'DUPLICATE_IN_ROSTER' }));
    expect(() => ed.setPlayerField(45685, 'id', 1)).toThrow(expect.objectContaining({ code: 'FIELD_READ_ONLY' }));
  });

  it.skipIf(!hasPesdb)('agrees with Player.bin on the shared player (cross-format check)', () => {
    const ed = loadEditDatabase(readEdit());
    const bin = loadBinDatabase(readPesdb(['Player.bin']));
    expect(ed.readPlayer(45685).name).toBe(bin.tables.player.get(45685, 'name'));
    expect(ed.readPlayer(45685).height).toBe(bin.tables.player.get(45685, 'height'));
  });
});
