// Coach (DT) support: Coach.bin + the EDIT coach section, checked against the user's real files and
// the EJOGC team exports (Downloads/EQUIPOS PARA EXPORTAR: Dortmund 126 → Niko Kovač 47, River 138 → Coudet).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadBinDatabase, serializeBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { decodeWesys } from '../../pes/core/wesys.js';
import { applyOperations } from '../../pes/operations.js';
import { planCoach, coachNameOfTeam, planDraftTransfer } from '../../pes/draftTransfer.js';
import { authorize } from '../../pes/permissions.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';
import { hasPesdb, hasEdit, readPesdb, readEdit } from './fixtures.js';

const superAdmin = { uid: 'admin', role: 'super_admin' };

describe('coach operations permissions', () => {
  it('only the Super Admin may change a coach', () => {
    const op = { type: 'edit.coach.set', target: { coachId: 47, teamId: 126 }, field: 'name', value: 'X' };
    expect(() => authorize(superAdmin, op)).not.toThrow();
    expect(() => authorize({ uid: 'k', role: 'kit_manager' }, op)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(() => authorize({ uid: 'd', role: 'draft_admin' }, { ...op, type: 'bin.coach.set' })).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  });
});

describe.skipIf(!hasPesdb || !hasEdit)('coaches on the real files', () => {
  let files, editBytes;
  beforeAll(() => { files = readPesdb(['Team.bin', 'Player.bin', 'PlayerAssignment.bin', 'Coach.bin']); editBytes = readEdit(); });
  const fresh = () => ({ bin: loadBinDatabase(files), edit: loadEditDatabase(editBytes), meta: {} });

  it('reads Coach.bin like the EJOGC exports', () => {
    const { bin } = fresh();
    expect(bin.tables.coach.count).toBe(1851);
    expect(bin.tables.coach.read(47)).toEqual({ id: 47, country: 200, adaptability: 78, name: 'Niko Kovač' });
    expect(bin.tables.coach.read(362336)).toEqual({ id: 362336, country: 144, adaptability: 79, name: 'Eduardo Coudet' });
    expect(bin.tables.team.get(126, 'coach')).toBe(47);
  });

  it('reads the EDIT coach section and team managers', () => {
    const { edit } = fresh();
    expect(edit.coaches.size).toBe(727);
    expect(edit.coachOfTeam(126)).toBe(47);
    expect(edit.readCoach(47)).toMatchObject({ id: 47, country: 200, name: 'Niko Kovač', e_name: false });
  });

  it('renames only the replaced team\'s coach, in both files, and raises the EDIT flags', () => {
    const ws = fresh();
    const { ops, warnings } = planCoach(ws, 126, { name: 'Marcelo Gallardo', country: 9 });
    expect(warnings).toEqual([]);
    expect(ops.map(o => o.type)).toEqual(['bin.coach.set', 'bin.coach.set', 'edit.coach.set', 'edit.coach.set']);
    applyOperations(ws, ops, superAdmin);
    expect(ws.bin.tables.coach.read(47)).toMatchObject({ name: 'Marcelo Gallardo', country: 9, adaptability: 78 });
    expect(ws.edit.readCoach(47)).toMatchObject({ name: 'Marcelo Gallardo', country: 9, e_name: true, e_country: true });
    expect(coachNameOfTeam(ws, 126)).toBe('Marcelo Gallardo');
    expect(ws.bin.tables.coach.get(362336, 'name')).toBe('Eduardo Coudet');

    // Only the coach record bytes change in Coach.bin; the container round-trips.
    const out = serializeBinDatabase(ws.bin);
    expect(Object.keys(out)).toEqual(['Coach.bin']);
    const before = decodeWesys(files['Coach.bin']).payload, after = decodeWesys(out['Coach.bin']).payload;
    const base = ws.bin.tables.coach.baseOf(47);
    for (let i = 0; i < after.length; i++) if (before[i] !== after[i]) expect(i >= base && i < base + 100).toBe(true);
  });

  it('rejects a name that does not fit instead of truncating mid-character', () => {
    const ws = fresh();
    expect(() => applyOperations(ws, [{ type: 'bin.coach.set', target: { coachId: 47, teamId: 126 }, field: 'name', value: 'x'.repeat(45) }], superAdmin))
      .toThrow(expect.objectContaining({ code: 'STRING_TOO_LONG' }));
    expect(ws.bin.tables.coach.get(47, 'name')).toBe('Niko Kovač');
  });

  it('is part of the draft transfer when a coach is given', () => {
    const ws = fresh();
    const ids = ws.edit.roster(126).map(r => r.playerId);
    const team = { id: 'u1', name: 'Supercontinental', country: 9, formation: '4-3-3', players: ids.map(id => ({ Id: id })), lineup: {}, dorsals: {} };
    const plan = planDraftTransfer(ws, [team], { u1: 126 }, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS, coaches: { u1: { name: 'DT Supercontinental' } } });
    expect(plan.ok).toBe(true);
    expect(plan.teams[0].coachName).toBe('DT Supercontinental');
    expect(plan.ops.filter(o => /coach/.test(o.type))).toHaveLength(4);
    const noCoach = planDraftTransfer(fresh(), [team], { u1: 126 }, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS });
    expect(noCoach.ops.some(o => /coach/.test(o.type))).toBe(false);
  });
});
