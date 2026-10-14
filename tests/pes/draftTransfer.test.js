// Draft → PES on the real UML database + the user's EDIT. Draft teams are built from real players
// with the same data shape the app stores (see components/admin/TemplateAdminSection.jsx).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { applyOperations } from '../../pes/operations.js';
import { planDraftTransfer, strategyFromTactics, toPitch, abbreviationOf, buildSquadSpec } from '../../pes/draftTransfer.js';
import { validateWorkspace } from '../../pes/validator.js';
import { buildExport } from '../../pes/exportService.js';
import { EDIT_TACTICS } from '../../pes/formats/pes2021/editLayout.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';
import { hasPesdb, hasEdit, readPesdb, readEdit } from './fixtures.js';

const options = { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS };
const superAdmin = { uid: 'admin', role: 'super_admin' };

describe('draft → PES mappings (pure)', () => {
  it('converts app tactics to EDIT strategy (pressuring inverted, numbers +1)', () => {
    expect(strategyFromTactics({ pressuring: 1, numbersInAttack: 0, numbersInDefense: 2, defensiveLine: 12, attackingStyles: 0 }, DEFAULT_TACTICS))
      .toMatchObject({ pressuring: 0, numbersInAttack: 1, numbersInDefense: 3, defensiveLine: 10, attackingStyles: 0, buildUp: 1 });
    expect(strategyFromTactics({ pressuring: 0 }).pressuring).toBe(1);
  });

  it('places the app pitch like pesExport.js and the EDIT (GK depth 3, right side high)', () => {
    expect(toPitch({ x: 50, y: 90 })).toEqual([3, 50]);
    expect(toPitch({ x: 82, y: 74 })).toEqual([10, 82]); // LD of the app 4-3-3
    expect(toPitch({ x: 50, y: 10 })).toEqual([40, 50]);
  });

  it('abbreviates like generateTeamCsv', () => {
    expect(abbreviationOf('Talleres de Balvanera')).toBe('TAL');
    expect(abbreviationOf('Ñandú FC')).toBe('NAN');
  });

  it('fills an incomplete lineup and assigns free numbers (synthetic ids)', () => {
    const players = Array.from({ length: 14 }, (_, i) => ({ Id: 1000 + i, Name: `P${i}` }));
    const { spec, warnings } = buildSquadSpec({ formation: '4-3-3', players, lineup: { 0: 1000, 1: 1001 }, dorsals: { 1000: 1, 1001: 1 } }, options);
    expect(spec.lineup).toHaveLength(11);
    expect(new Set(spec.players.map(p => p.number)).size).toBe(14);
    expect(spec.players[0]).toEqual({ playerId: 1000, number: 1 });
    expect(warnings.join(' ')).toMatch(/sin titular/);
  });
});

describe.skipIf(!hasPesdb || !hasEdit)('draft → PES on the real files', () => {
  let files, editBytes;
  beforeAll(() => { files = readPesdb(['Team.bin', 'Player.bin', 'PlayerAssignment.bin']); editBytes = readEdit(); });
  const fresh = () => ({ bin: loadBinDatabase(files), edit: loadEditDatabase(editBytes), meta: {} });
  const squad = (ws, teamId) => { const pa = ws.bin.tables.assignment; return pa.ids().map(id => pa.read(id)).filter(r => r.teamId === teamId); };

  // Draft team A: Chelsea's squad with the app's 4-3-3; Draft team B: 18 Brentford players, no lineup.
  function draftTeams(ws) {
    const chelsea = ws.edit.roster(102).map(r => r.playerId);
    const brentford = squad(ws, 4180).map(r => r.playerId).slice(0, 18);
    const lineup = Object.fromEntries(chelsea.slice(0, 11).map((id, i) => [i, id]));
    return [
      {
        id: 'userA', name: 'Club Atlético Supercontinental', country: 9, formation: '4-3-3',
        players: chelsea.map(id => ({ Id: id, Name: ws.bin.tables.player.get(id, 'name') })),
        lineup, dorsals: { [chelsea[0]]: 1, [chelsea[1]]: 4 },
        setPieces: { captain: chelsea[1], penalty: chelsea[9], header1: chelsea[2] },
        tactics: { attackingStyles: 0, pressuring: 1, numbersInAttack: 2, defensiveLine: 6 },
      },
      { id: 'userB', name: 'Talleres de Balvanera', country: 9, formation: '4-4-2', players: brentford.map(id => ({ Id: id })), lineup: {}, dorsals: {}, setPieces: {}, tactics: {} },
    ];
  }

  it('plans without modifying the working copy', () => {
    const ws = fresh();
    const binBefore = ws.bin.tables.assignment.data.slice(), editBefore = ws.edit.data.slice();
    const plan = planDraftTransfer(ws, draftTeams(ws), { userA: 101, userB: 178 }, options);
    expect(plan.errors).toEqual([]);
    expect(plan.ok).toBe(true);
    expect(plan.ops.length).toBeGreaterThan(20);
    expect(plan.removed.length).toBeGreaterThan(0);
    // Team A takes Chelsea's whole squad: Chelsea is reported as unable to field 11.
    expect(plan.warnings.join(' ')).toContain('Chelsea FC queda con 0 jugador(es)');
    expect(plan.removed.some(r => r.emptyPosition)).toBe(true);
    expect(Buffer.compare(Buffer.from(ws.bin.tables.assignment.data), Buffer.from(binBefore))).toBe(0);
    expect(Buffer.compare(Buffer.from(ws.edit.data), Buffer.from(editBefore))).toBe(0);
  });

  it('writes both teams into the database and the EDIT and moves the players', () => {
    const ws = fresh();
    const teams = draftTeams(ws);
    const plan = planDraftTransfer(ws, teams, { userA: 101, userB: 178 }, options);
    applyOperations(ws, plan.ops, superAdmin);
    const A = teams[0], ids = A.players.map(p => p.Id);

    // pesdb
    const tt = ws.bin.tables.team;
    expect(tt.get(101, 'nameEnglish')).toBe('Club Atlético Supercontinental');
    expect(tt.get(101, 'nameSpanish')).toBe('Club Atlético Supercontinental');
    expect(tt.get(101, 'shortNameLicensed')).toBe('CLU');
    expect(tt.get(101, 'country')).toBe(9);
    const binSquad = squad(ws, 101);
    expect(binSquad.map(r => r.playerId).sort()).toEqual([...ids].sort());
    expect(binSquad.find(r => r.playerId === ids[1]).shirtNumber).toBe(4);
    const pa = ws.bin.tables.assignment;
    for (const id of ids) {
      const clubs = pa.ids().map(x => pa.read(x)).filter(r => r.playerId === id && !tt.get(r.teamId, 'national')).map(r => r.teamId);
      expect(clubs).toEqual([101]);
    }
    expect(squad(ws, 178)).toHaveLength(18);

    // EDIT
    const ed = ws.edit;
    expect(ed.readTeam(101)).toMatchObject({ name: 'Club Atlético Supercontinental', short: 'CLU', country: 9, e_name: 1 });
    const roster = ed.roster(101);
    expect(roster.map(r => r.playerId)).toEqual(ids);
    expect(roster[0].number).toBe(1);
    const tac = ed.readTactics(101);
    expect(tac.order.slice(0, 11)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...tac.order].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(tac.captain).toBe(1);
    expect(tac.takers[5]).toBe(9); // penalty
    expect(tac.takers[6]).toBe(2); // header 1
    expect(tac.takers.every(s => s < roster.length)).toBe(true);
    expect(tac.formation.pos[0]).toEqual(EDIT_TACTICS.gkPosition);
    expect(tac.formation.roles.slice(1)).toEqual([3, 1, 1, 2, 4, 5, 5, 10, 12, 9]); // app 4-3-3 after the GK
    expect(tac.strategy).toMatchObject({ attackingStyles: 0, pressuring: 0, numbersInAttack: 3, defensiveLine: 6 });
    // Chelsea (102) lost those players in the EDIT and still has a consistent order/captain.
    const chelsea = ed.roster(102);
    expect(chelsea.some(r => ids.includes(r.playerId))).toBe(false);
    const t102 = ed.readTactics(102);
    expect([...t102.order].sort((a, b) => a - b)).toEqual(Array.from({ length: 40 }, (_, i) => i));
    expect(t102.captain === 255 || t102.captain < Math.max(chelsea.length, 1)).toBe(true);

    expect(validateWorkspace(ws).passed).toBe(true);
  });

  it('exports both files verified', async () => {
    const ws = fresh();
    const plan = planDraftTransfer(ws, draftTeams(ws), { userA: 101, userB: 178 }, options);
    applyOperations(ws, plan.ops, superAdmin);
    const { manifest } = await buildExport(ws, { workspaceId: 't', sources: [], operations: plan.ops });
    expect(manifest.files.map(f => f.path).sort()).toEqual(['common/etc/pesdb/PlayerAssignment.bin', 'common/etc/pesdb/Team.bin', 'save/EDIT00000000']);
    expect(manifest.compatibility.gameTested).toBe(false);
  });

  it('reports conflicts instead of writing anything', () => {
    const ws = fresh();
    const [a, b] = draftTeams(ws);
    const dup = { ...b, players: [...b.players, a.players[0]] };
    const unknown = { ...b, id: 'userC', name: 'Fantasma', players: [{ Id: 999999999, Name: 'Nadie' }, ...b.players] };
    const p1 = planDraftTransfer(ws, [a, dup], { userA: 101, userB: 178 }, options);
    expect(p1.ok).toBe(false);
    expect(p1.errors.join(' ')).toMatch(/está en "Club Atlético Supercontinental" y en "Talleres de Balvanera"/);
    const p2 = planDraftTransfer(ws, [a, b], { userA: 101, userB: 101 }, options);
    expect(p2.errors.join(' ')).toMatch(/asignado a/);
    const p3 = planDraftTransfer(ws, [unknown], { userC: 178 }, options);
    expect(p3.errors.join(' ')).toMatch(/no existe en la base cargada/);
    expect(p3.ops).toEqual([]);
  });
});
