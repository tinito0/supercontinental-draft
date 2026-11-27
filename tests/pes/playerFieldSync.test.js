// Player.bin ↔ EDIT00000000 field links (pes/formats/pes2021/playerFieldSync.js).
// SYNTHETIC: the link table is consistent with both layouts. REAL (npm run test:real, vendor/EDIT00000000 +
// pesdb Player.bin): every linked field agrees on the players of the EDIT, minus the ones the EDIT edited.
import { BIN_TO_EDIT, EDIT_STYLE_TO_BIN, playerEditOps } from '../../pes/formats/pes2021/playerFieldSync.js';
import { PLAYER_FIELDS } from '../../pes/formats/pes2021/binLayout.js';
import { PLAYER_EXTRA_FIELDS } from '../../pes/formats/pes2021/playerExtraLayout.js';
import { EDIT_PLAYER_FIELDS, EDIT_LOCKED_FIELDS } from '../../pes/formats/pes2021/editLayout.js';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { PLAYING_STYLE_BY_ID } from '../../utils/constants.js';
import { hasEdit, hasPesdb, readEdit, readPesdb } from './fixtures.js';

const binNames = new Set([...PLAYER_FIELDS, ...PLAYER_EXTRA_FIELDS].map(f => f.name));
const editNames = new Set(EDIT_PLAYER_FIELDS.map(f => f.name));

describe('playerFieldSync (synthetic)', () => {
  it('links existing, editable fields one to one', () => {
    const targets = Object.values(BIN_TO_EDIT).map(l => l.edit);
    expect(new Set(targets).size).toBe(targets.length);
    for (const [bin, link] of Object.entries(BIN_TO_EDIT)) {
      expect(binNames.has(bin), bin).toBe(true);
      expect(editNames.has(link.edit), link.edit).toBe(true);
      expect(EDIT_LOCKED_FIELDS.has(link.edit), link.edit).toBe(false);
    }
  });

  it('covers every skill and COM style of Player.bin', () => {
    for (const f of PLAYER_EXTRA_FIELDS.filter(x => x.group === 'skill' || x.group === 'comStyle')) expect(BIN_TO_EDIT[f.name], f.name).toBeDefined();
  });

  it('maps all 22 playing styles both ways', () => {
    expect(Object.keys(EDIT_STYLE_TO_BIN).map(Number).sort((a, b) => a - b)).toEqual(Object.keys(PLAYING_STYLE_BY_ID).map(Number));
    expect(new Set(Object.values(EDIT_STYLE_TO_BIN)).size).toBe(22);
    for (let v = 0; v < 22; v++) expect(BIN_TO_EDIT.playingStyle.toBin(BIN_TO_EDIT.playingStyle.toEdit(v))).toBe(v);
  });

  it('adds the EDIT operation only when the player is in the EDIT', () => {
    expect(playerEditOps(7, 'weakFootUsage', 3, { inEdit: false })).toHaveLength(1);
    expect(playerEditOps(7, 'weakFootUsage', 3, { inEdit: true })[1]).toEqual({ type: 'edit.player.set', target: { playerId: 7 }, field: 'weak_use', value: 2 });
    expect(playerEditOps(7, 'skillRabona', true, { inEdit: true })[1]).toMatchObject({ field: 'sk16', value: 1 });
    expect(playerEditOps(7, 'celebration', 12, { inEdit: true })).toHaveLength(1);
  });
});

describe('playerFieldSync (real files)', () => {
  it.skipIf(!hasEdit || !hasPesdb)('agrees on the players both files have', () => {
    const edit = loadEditDatabase(readEdit());
    const bin = loadBinDatabase(readPesdb(['Player.bin'])).tables.player;
    const ids = [...edit.players.keys()].filter(id => bin.has(id));
    expect(ids.length).toBeGreaterThan(0);
    for (const [field, link] of Object.entries(BIN_TO_EDIT)) {
      if (/^(name|shirt|age)$/.test(field) || link.edit.startsWith('mo_')) continue; // edited on some players
      for (const id of ids) expect(link.toBin(edit.readPlayer(id)[link.edit]), `${field} ${id}`).toBe(bin.get(id, field));
    }
  });
});
