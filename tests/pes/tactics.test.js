// Tactics.bin / TacticsFormation.bin on the real UML database. Expected values come from the EJOGC
// Formation.csv export of Borussia Dortmund (team 126, preset S1, formation F1).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadBinDatabase, serializeBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { decodeWesys } from '../../pes/core/wesys.js';
import { applyOperations } from '../../pes/operations.js';
import { authorize } from '../../pes/permissions.js';
import { readTeamTactics, tacticsIdsOfTeam, validateTeamTactics } from '../../pes/formats/pes2021/tacticsBin.js';
import { binStrategyFromTactics, planDraftTransfer } from '../../pes/draftTransfer.js';
import { validateWorkspace } from '../../pes/validator.js';
import { buildExport } from '../../pes/exportService.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';
import { hasPesdb, hasEdit, readPesdb, readEdit } from './fixtures.js';

const admin = { uid: 'a', role: 'super_admin' };
const DORTMUND_S1 = { attackingStyles: 1, buildUp: 1, attackingArea: 0, positioning: 1, supportRange: 5, numbersInAttack: 1, defensiveStyles: 1, containmentArea: 0, pressuring: 1, defensiveLine: 6, compactness: 7, numbersInDefense: 1 };
const DORTMUND_F1 = '0@3,52 1@10,63 1@10,41 3@12,89 2@12,15 5@20,41 5@24,66 10@38,87 9@38,17 8@32,46 12@43,52';

describe('tactics validation', () => {
  it('maps the app tactics 1:1 and clamps out-of-range values', () => {
    expect(binStrategyFromTactics({ pressuring: 1, numbersInAttack: 2, defensiveLine: 12 }, DEFAULT_TACTICS)).toMatchObject({ pressuring: 1, numbersInAttack: 2, defensiveLine: 10 });
  });
  it('rejects invalid formations and strategies before writing', () => {
    const pos = Array.from({ length: 11 }, () => [10, 50]);
    expect(() => validateTeamTactics({ formation: { roles: [1, ...Array(10).fill(5)], pos } })).toThrow(/arquero/);
    expect(() => validateTeamTactics({ formation: { roles: [0, ...Array(10).fill(13)], pos } })).toThrow(/puesto/);
    expect(() => validateTeamTactics({ strategy: { supportRange: 0 } })).toThrow(/fuera de rango/);
    expect(() => validateTeamTactics({ strategy: { fluid: 1 } })).toThrow(/desconocida/);
  });
  it('is a Super Admin operation', () => {
    const op = { type: 'bin.team.tactics', target: { teamId: 126 }, value: {} };
    expect(() => authorize(admin, op)).not.toThrow();
    expect(() => authorize({ uid: 'k', role: 'kit_manager' }, op)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

describe.skipIf(!hasPesdb)('tactics in the real database', () => {
  let files;
  beforeAll(() => { files = readPesdb(['Team.bin', 'Player.bin', 'PlayerAssignment.bin', 'Coach.bin', 'Tactics.bin', 'TacticsFormation.bin']); });
  const fresh = () => ({ bin: loadBinDatabase(files), meta: {} });

  it('reads Dortmund like the EJOGC Formation.csv', () => {
    const { bin } = fresh();
    expect(bin.tables.tactics.count).toBe(1408);
    expect(bin.tables.tacticsFormation.count).toBe(46464);
    expect(bin.tables.tacticsFormation.duplicateIds).toEqual([]);
    const [s1, s2] = readTeamTactics(bin.tables, 126);
    expect(s1.strategy).toEqual(DORTMUND_S1);
    expect(s2.strategy).toMatchObject({ attackingStyles: 0, supportRange: 7, defensiveLine: 4, compactness: 6 });
    expect(s1.formations[0].map(r => `${r.role}@${r.depth},${r.lateral}`).join(' ')).toBe(DORTMUND_F1);
  });

  it('writes strategy and formation into both presets, touching only those records', () => {
    const ws = fresh();
    const formation = { roles: [0, 1, 1, 3, 2, 5, 5, 8, 10, 9, 12], pos: [[3, 52], [10, 64], [10, 40], [12, 88], [12, 16], [22, 40], [22, 64], [30, 52], [40, 85], [40, 19], [45, 52]] };
    const strategy = { ...DORTMUND_S1, pressuring: 0, supportRange: 9 };
    applyOperations(ws, [{ type: 'bin.team.tactics', target: { teamId: 126 }, value: { strategy, formation } }], admin);
    for (const p of readTeamTactics(ws.bin.tables, 126)) {
      expect(p.strategy).toEqual(strategy);
      for (const f of p.formations) expect(f.map(r => [r.role, r.depth, r.lateral])).toEqual(formation.roles.map((r, i) => [r, ...formation.pos[i]]));
    }
    const out = serializeBinDatabase(ws.bin);
    expect(Object.keys(out).sort()).toEqual(['Tactics.bin', 'TacticsFormation.bin']);
    const ids = tacticsIdsOfTeam(ws.bin.tables, 126);
    const allowedT = ids.map(id => ws.bin.tables.tactics.baseOf(id));
    const before = decodeWesys(files['Tactics.bin']).payload, after = decodeWesys(out['Tactics.bin']).payload;
    for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) expect(allowedT.some(b => i >= b + 8 && i < b + 12)).toBe(true);
    // Another team is untouched.
    expect(readTeamTactics(ws.bin.tables, 138)).toEqual(readTeamTactics(fresh().bin.tables, 138));
  });

  it('rolls back when a team has no tactics', () => {
    const ws = fresh();
    expect(() => applyOperations(ws, [{ type: 'bin.team.tactics', target: { teamId: 999999 }, value: { strategy: { pressuring: 0 } } }], admin))
      .toThrow(expect.objectContaining({ code: 'NO_TACTICS' }));
    expect(ws.bin.tables.tactics.isModified()).toBe(false);
  });

  it.skipIf(!hasEdit)('the draft transfer writes the base tactics and exports them verified', async () => {
    const ws = { ...fresh(), edit: loadEditDatabase(readEdit()) };
    const ids = ws.edit.roster(126).map(r => r.playerId);
    const tactics = { ...DEFAULT_TACTICS, pressuring: 0, supportRange: 3 };
    const team = { id: 'u1', name: 'Supercontinental', country: 9, formation: '4-3-3', players: ids.map(id => ({ Id: id })), lineup: {}, dorsals: {}, tactics };
    const plan = planDraftTransfer(ws, [team], { u1: 126 }, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS });
    expect(plan.ok).toBe(true);
    const op = plan.ops.find(o => o.type === 'bin.team.tactics');
    expect(op.value.strategy).toMatchObject({ pressuring: 0, supportRange: 3 });
    applyOperations(ws, plan.ops, admin);
    expect(readTeamTactics(ws.bin.tables, 126)[0].strategy).toMatchObject({ pressuring: 0, supportRange: 3 });
    expect(readTeamTactics(ws.bin.tables, 126)[1].formations[2][0]).toEqual({ role: 0, depth: 3, lateral: 52 });
    const v = validateWorkspace(ws);
    expect(v.errors).toEqual([]);
    const { manifest } = await buildExport(ws, { actor: admin, workspaceId: 't', operations: plan.ops, sources: [] });
    expect(manifest.files.map(f => f.path)).toEqual(expect.arrayContaining(['common/etc/pesdb/Tactics.bin', 'common/etc/pesdb/TacticsFormation.bin']));
  });
});
