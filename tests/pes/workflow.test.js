// End-to-end engine workflow: operations, rollback, team replacement, validation, export.
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { KitWorkspace } from '../../pes/kits/kitWorkspace.js';
import { applyOperations, replayOperations } from '../../pes/operations.js';
import { planTeamReplacement } from '../../pes/teamReplacement.js';
import { validateWorkspace } from '../../pes/validator.js';
import { buildExport } from '../../pes/exportService.js';
import { encodeFtex } from '../../pes/kits/ftex.js';
import { sha256Hex } from '../../pes/core/fields.js';
import { decodeWesys } from '../../pes/core/wesys.js';
import { ROLES } from '../../pes/permissions.js';
import { hasPesdb, readPesdb, hasEdit, readEdit, syntheticKitServer } from './fixtures.js';

const superAdmin = { uid: 'admin', role: ROLES.SUPER_ADMIN };
const kitManager = { uid: 'km', role: ROLES.KIT_MANAGER, label: 'Lusitano' };
const info = { workspaceId: 'test', sources: [], operations: [] };

function kitsWorkspace() {
  const s = syntheticKitServer();
  return { kits: new KitWorkspace(s.texts, s.all), meta: {}, assetStore: new Map() };
}

describe('operations on kits (synthetic)', () => {
  it('applies authorized kit edits and rejects unauthorized ones without side effects', () => {
    const ws = kitsWorkspace();
    applyOperations(ws, [{ type: 'kit.set', target: { teamId: 9999, kit: 'p1' }, key: 'UniColor_Color1', value: '#123456' }], kitManager);
    expect(ws.kits.modified.size).toBe(1);
    expect(() => applyOperations(ws, [{ type: 'bin.player.set', target: { playerId: 1 }, field: 'speed', value: 70 }], kitManager))
      .toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('rolls back a whole batch when one operation fails', () => {
    const ws = kitsWorkspace();
    const batch = [
      { type: 'kit.set', target: { teamId: 9999, kit: 'p1' }, key: 'Collar', value: 5 },
      { type: 'kit.set', target: { teamId: 9999, kit: 'p1' }, key: 'Collar', value: 999 },
    ];
    expect(() => applyOperations(ws, batch, superAdmin)).toThrow(expect.objectContaining({ code: 'OUT_OF_RANGE' }));
    expect(ws.kits.modified.size).toBe(0);
  });

  it('applies a generated font from the asset store and exports it verified', async () => {
    const ws = kitsWorkspace();
    const bytes = encodeFtex(new Uint8Array(128 * 16 * 4).fill(255), 128, 16);
    const sha = await sha256Hex(bytes);
    ws.assetStore.set(sha, bytes);
    const op = { type: 'kit.texture.set', target: { teamId: 9999, kit: 'p1' }, slot: 'back', value: 'club_back', ext: '.ftex', asset: { sha256: sha } };
    applyOperations(ws, [op], kitManager);
    const { zip, manifest } = await buildExport(ws, info);
    const z = await JSZip.loadAsync(zip);
    const entries = Object.values(z.files).filter(f => !f.dir).map(f => f.name).sort();
    expect(entries).toEqual(['content/kit-server/Test League/Test FC/p1/club_back.ftex', 'content/kit-server/Test League/Test FC/p1/config.txt', 'manifest.json']);
    expect(manifest.verification.find(v => v.path.endsWith('.ftex')).check).toMatch(/FTEX parsed: DXT5 128x16/);
    expect(manifest.compatibility.gameTested).toBe(false);
  });

  it('replays a missing font asset as a reported failure, not a silent skip', () => {
    const ws = kitsWorkspace();
    const failures = replayOperations(ws, [{ type: 'kit.texture.set', target: { teamId: 9999, kit: 'p1' }, slot: 'name', value: 'x', ext: '.ftex', asset: { sha256: 'missing' } }]);
    expect(failures).toHaveLength(1);
    expect(failures[0].error.code).toBe('ASSET_MISSING');
  });

  it('refuses to export when there are no changes', async () => {
    await expect(buildExport(kitsWorkspace(), info)).rejects.toMatchObject({ code: 'NOTHING_TO_EXPORT' });
  });
});

describe.skipIf(!hasPesdb)('team replacement and export on the real database', () => {
  let files;
  beforeAll(() => { files = readPesdb(['Team.bin', 'Player.bin', 'PlayerAssignment.bin']); });
  const fresh = () => ({ bin: loadBinDatabase(files), meta: {} });

  function squadOf(ws, teamId) {
    const pa = ws.bin.tables.assignment;
    return pa.ids().map(id => pa.read(id)).filter(r => r.teamId === teamId);
  }

  it('reports pre-existing dangling references as warnings, not errors', () => {
    const v = validateWorkspace(fresh());
    expect(v.passed).toBe(true);
    expect(v.preexisting.length).toBeGreaterThan(0);
  });

  it('plans a replacement with its impact and applies it atomically', () => {
    const ws = fresh();
    const club = squadOf(ws, 101); // Arsenal in the UML map
    const donor = squadOf(ws, 102); // Chelsea
    expect(club.length).toBeGreaterThan(donor.length); // real data: Arsenal 32 rows, Chelsea 29
    const roster = donor.map((r, i) => ({ playerId: r.playerId, shirtNumber: i + 1 }));
    const plan = planTeamReplacement(ws.bin, { teamId: 101, fields: { nameEnglish: 'Supercontinental FC' }, roster });
    expect(plan.ok).toBe(true);
    expect(plan.impact).toMatchObject({ rowsAdded: 0, rowsRemoved: club.length - donor.length, rowsReused: donor.length });
    expect(plan.impact.playersOut.length).toBe(club.length);
    expect(plan.impact.otherClubs.length).toBe(roster.length); // they are still Chelsea players
    applyOperations(ws, plan.ops, superAdmin);
    expect(ws.bin.tables.team.get(101, 'nameEnglish')).toBe('Supercontinental FC');
    expect(squadOf(ws, 101).map(r => r.playerId).sort()).toEqual(roster.map(r => r.playerId).sort());
    expect(validateWorkspace(ws).passed).toBe(true);
  });

  it('grows a squad by appending assignment rows with new ids', () => {
    const ws = fresh();
    const club = squadOf(ws, 102);
    const extra = squadOf(ws, 101).slice(0, 3);
    const roster = [...club, ...extra].map((r, i) => ({ playerId: r.playerId, shirtNumber: i + 1 }));
    const plan = planTeamReplacement(ws.bin, { teamId: 102, roster });
    expect(plan.impact).toMatchObject({ rowsAdded: 3, rowsRemoved: 0 });
    const countBefore = ws.bin.tables.assignment.count;
    applyOperations(ws, plan.ops, superAdmin);
    expect(ws.bin.tables.assignment.count).toBe(countBefore + 3);
    expect(squadOf(ws, 102)).toHaveLength(roster.length);
    expect(validateWorkspace(ws).passed).toBe(true);
  });

  it('rejects invalid replacements before touching anything', () => {
    const ws = fresh();
    const plan = planTeamReplacement(ws.bin, { teamId: 101, fields: { id: 5, gkReach: 70 }, roster: [{ playerId: 999999999, shirtNumber: 0 }, { playerId: 999999999, shirtNumber: 0 }] });
    expect(plan.ok).toBe(false);
    expect(plan.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('rolls back a replacement when an operation fails mid-batch', () => {
    const ws = fresh();
    const before = ws.bin.tables.assignment.data.slice();
    const plan = planTeamReplacement(ws.bin, { teamId: 101, roster: squadOf(ws, 101).map((r, i) => ({ playerId: r.playerId, shirtNumber: i + 1 })) });
    const broken = [...plan.ops, { type: 'bin.assignment.set', target: { assignmentId: 1 }, field: 'playerId', value: 999999999 }];
    expect(() => applyOperations(ws, broken, superAdmin)).toThrow(expect.objectContaining({ code: 'DANGLING_REF', details: expect.objectContaining({ rolledBack: true }) }));
    expect(Buffer.compare(Buffer.from(ws.bin.tables.assignment.data), Buffer.from(before))).toBe(0);
  });

  it('blocks export when the edits create new errors', async () => {
    const ws = fresh();
    const [a, b] = squadOf(ws, 101);
    applyOperations(ws, [{ type: 'bin.assignment.set', target: { assignmentId: b.id }, field: 'shirtNumber', value: a.shirtNumber }], superAdmin);
    const v = validateWorkspace(ws);
    expect(v.passed).toBe(false);
    await expect(buildExport(ws, info)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('exports only the modified BIN files, verified, with a manifest', async () => {
    const ws = fresh();
    applyOperations(ws, [{ type: 'bin.player.set', target: { playerId: 45685 }, field: 'speed', value: 85 }], superAdmin);
    const { zip, manifest } = await buildExport(ws, { ...info, operations: [{}] });
    const z = await JSZip.loadAsync(zip);
    expect(Object.values(z.files).filter(f => !f.dir).map(f => f.name).sort()).toEqual(['common/etc/pesdb/Player.bin', 'manifest.json']);
    const bin = await z.file('common/etc/pesdb/Player.bin').async('uint8array');
    expect(loadBinDatabase({ 'Player.bin': bin }).tables.player.get(45685, 'speed')).toBe(85);
    expect(decodeWesys(bin).payload.length).toBe(27437 * 312);
    const m = JSON.parse(await z.file('manifest.json').async('string'));
    expect(m.files[0]).toMatchObject({ path: 'common/etc/pesdb/Player.bin', sha256: await sha256Hex(bin) });
    expect(m.compatibility.gameTested).toBe(false);
    expect(manifest.validation.passed).toBe(true);
  });
});

describe.skipIf(!hasEdit)('EDIT workflow', () => {
  it('kit manager can change team colours in the EDIT but not names', () => {
    const ws = { edit: loadEditDatabase(readEdit()), meta: {} };
    applyOperations(ws, [{ type: 'edit.team.set', target: { teamId: 1 }, field: 'c1r', value: 63 }], kitManager);
    expect(ws.edit.readTeam(1).c1r).toBe(63);
    expect(() => applyOperations(ws, [{ type: 'edit.team.set', target: { teamId: 1 }, field: 'name', value: 'X' }], kitManager)).toThrow();
  });

  it('exports the EDIT verified', async () => {
    const ws = { edit: loadEditDatabase(readEdit()), meta: {} };
    applyOperations(ws, [{ type: 'edit.team.set', target: { teamId: 1 }, field: 'c2g', value: 20 }], superAdmin);
    const { manifest } = await buildExport(ws, info);
    expect(manifest.files.map(f => f.path)).toEqual(['save/EDIT00000000']);
    expect(manifest.verification[0].check).toMatch(/decrypted; data identical/);
  });
});
