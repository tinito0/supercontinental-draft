// Team editor view model (pes/teamView.js).
// SYNTHETIC fixtures only: a Team.bin built from the verified layout, the synthetic kit-server and a
// minimal EDIT stand-in (plain object with the EditDatabase read API). They prove the view logic and
// the operations it produces, not game compatibility.
import { describe, it, expect } from 'vitest';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { KitWorkspace } from '../../pes/kits/kitWorkspace.js';
import { applyOperations } from '../../pes/operations.js';
import { ROLES } from '../../pes/permissions.js';
import { from6bit } from '../../pes/formats/pes2021/editLayout.js';
import {
  NO_RIVAL, cleanAbbreviation, listTeams, filterTeams, teamIdentity, nameOps, abbreviationOps, colourOps, countryOps, stadiumOps,
  draftIndexesForTeam, unsavedByTeam, teamColours, primaryKitColours, teamAccess, nameByteLimit,
} from '../../pes/teamView.js';
import { syntheticTable, syntheticKitServer } from './fixtures.js';

const superAdmin = { uid: 'admin', role: ROLES.SUPER_ADMIN };

/** Minimal EDIT stand-in: two teams, colour channels in 6 bits. */
function stubEdit() {
  const teams = new Map([
    [9999, { name: 'Test FC', short: 'TFC', country: 9, stadium_id: 3, stadium_name: '', c1r: 63, c1g: 0, c1b: 0, c2r: 63, c2g: 63, c2b: 63, rival1: NO_RIVAL }],
    [7777, { name: 'Edit Only', short: 'EDO', country: 0, stadium_id: 0, stadium_name: 'Cancha', c1r: 0, c1g: 0, c1b: 63, c2r: 0, c2g: 0, c2b: 0, rival1: 9999 }],
  ]);
  return { teams, readTeam: id => ({ ...teams.get(id) }), roster: id => (id === 9999 ? [{ slot: 0, playerId: 1, number: 9 }] : []) };
}

function workspace({ edit = true } = {}) {
  const bin = loadBinDatabase({ 'Team.bin': syntheticTable({ count: 2, size: 1532, idOffset: 8, ids: [9999, 8888] }) });
  const s = syntheticKitServer();
  return { bin, edit: edit ? stubEdit() : null, kits: new KitWorkspace(s.texts, s.all), meta: {}, assetStore: new Map() };
}

describe('teamView: list and search (synthetic)', () => {
  it('lists Team.bin, EDIT and kit-server teams once each', () => {
    const rows = listTeams(workspace());
    expect(rows.map(r => r.id).sort()).toEqual([7777, 8888, 9999]);
    const edo = rows.find(r => r.id === 7777);
    expect(edo).toMatchObject({ name: 'Edit Only', abbr: 'EDO', hasBin: false, hasEdit: true, hasKits: false });
    const other = rows.find(r => r.id === 8888);
    expect(other).toMatchObject({ name: 'Other FC', hasBin: true, hasEdit: false, hasKits: true });
  });

  it('counts unsaved operations per team, including dorsal edits targeted by assignment id', () => {
    const ws = workspace();
    const drafts = [
      { type: 'edit.team.set', target: { teamId: 9999 }, field: 'c1r', value: 1 },
      { type: 'kit.set', target: { teamId: 9999, kit: 'p1' }, key: 'Collar', value: 2 },
      { type: 'bin.player.set', target: { playerId: 5 }, field: 'speed', value: 70 },
      { type: 'edit.team.set', target: { teamId: 7777 }, field: 'name', value: 'X' },
    ];
    expect(unsavedByTeam(ws, drafts)).toEqual(new Map([[9999, 2], [7777, 1]]));
    expect(draftIndexesForTeam(ws, drafts, 9999)).toEqual([0, 1]);
    const rows = listTeams(ws, { drafts, savedOps: [{ type: 'edit.team.set', target: { teamId: 8888 }, field: 'x', state: 'discarded' }] });
    expect(rows.find(r => r.id === 9999)).toMatchObject({ unsaved: 2, modified: true });
    expect(rows.find(r => r.id === 8888).modified).toBe(false);
  });

  it('attributes edits of an assignment row removed later in the batch to the removing team', () => {
    const ws = workspace();
    const drafts = [
      { type: 'bin.assignment.set', target: { assignmentId: 555 }, field: 'shirtNumber', value: 7 },
      { type: 'bin.assignment.remove', target: { assignmentId: 555, teamId: 9999 } },
    ];
    expect(draftIndexesForTeam(ws, drafts, 9999)).toEqual([0, 1]);
  });

  it('searches without accents or case, by abbreviation, and by exact id', () => {
    const rows = [{ id: 1, name: 'Atlético Paraná', abbr: 'ATP' }, { id: 12, name: 'Boca', abbr: 'BOC' }];
    expect(filterTeams(rows, 'atletico parana').map(r => r.id)).toEqual([1]);
    expect(filterTeams(rows, 'boc').map(r => r.id)).toEqual([12]);
    expect(filterTeams(rows, '1').map(r => r.id)).toEqual([1]);
    expect(filterTeams(rows, '  ')).toHaveLength(2);
  });
});

describe('teamView: colours (synthetic)', () => {
  it('uses EDIT colours, else the first player kit shirt colour, else null', () => {
    const ws = workspace();
    expect(teamColours(ws, 9999)).toEqual({ c1: '#ff0000', c2: '#ffffff', source: 'edit' });
    expect(teamColours(ws, 8888)).toMatchObject({ c1: '#D12B2B', source: 'kit' });
    expect(teamColours(workspace({ edit: false }), 7777)).toBeNull();
    expect(primaryKitColours(ws, 9999)).toMatchObject({ kit: 'p1', c1: '#D12B2B' });
    expect(primaryKitColours(ws, 7777)).toBeNull();
  });

  it('emits only the channels that change, rounded to 6 bits', () => {
    const ws = workspace();
    const ops = colourOps(ws, 9999, 1, '#ff0000');
    expect(ops).toEqual([]);
    const blue = colourOps(ws, 9999, 1, '#0000fe');
    expect(blue.map(o => o.field)).toEqual(['c1r', 'c1b']);
    expect(from6bit(blue[1].value)).toBe(255);
    expect(() => colourOps(ws, 9999, 1, 'red')).toThrow();
    expect(colourOps(ws, 8888, 1, '#000000')).toEqual([]);
  });
});

describe('teamView: names, abbreviation, country (synthetic)', () => {
  it('renames every Team.bin name field plus the EDIT name, each within its byte budget', () => {
    const ws = workspace();
    const ops = nameOps(ws, 9999, '  Club Atlético Supercontinental de la Liga de Amigos  ');
    const bin = ops.filter(o => o.type === 'bin.team.set');
    expect(bin).toHaveLength(17);
    const db = bin.find(o => o.field === 'nameDatabase');
    expect(new TextEncoder().encode(db.value).length).toBeLessThanOrEqual(23);
    expect(ops.find(o => o.type === 'edit.team.set')).toMatchObject({ field: 'name' });
    applyOperations({ ...ws, edit: null }, bin, superAdmin);
    expect(ws.bin.tables.team.get(9999, 'nameEnglish')).toBe('Club Atlético Supercontinental de la Liga de Amigos');
    expect(nameOps(ws, 9999, 'Club Atlético Supercontinental de la Liga de Amigos').filter(o => o.type === 'bin.team.set')).toEqual([]);
    expect(() => nameOps(ws, 9999, '   ')).toThrow('vacío');
    expect(nameByteLimit(ws, 9999)).toBe(69);
  });

  it('cleans abbreviations to 3 upper-case letters or digits', () => {
    expect(cleanAbbreviation('bó-ca juniors')).toBe('BOC');
    const ops = abbreviationOps(workspace(), 9999, 'tfc');
    expect(ops.map(o => [o.type, o.field, o.value])).toEqual([
      ['bin.team.set', 'shortNameLicensed', 'TFC'], ['bin.team.set', 'shortNameFake', 'TFC'],
    ]);
    expect(() => abbreviationOps(workspace(), 9999, '--')).toThrow();
  });

  it('writes the country to both files and reads identity EDIT first', () => {
    const ws = workspace();
    expect(countryOps(ws, 9999, 9).map(o => o.type)).toEqual(['bin.team.set']);
    expect(countryOps(ws, 7777, 12).map(o => o.type)).toEqual(['edit.team.set']);
    expect(stadiumOps(ws, 9999, 3).map(o => [o.type, o.field])).toEqual([['bin.team.set', 'stadium']]);
    expect(stadiumOps(ws, 7777, 5).map(o => o.field)).toEqual(['stadium_id']);
    expect(() => stadiumOps(ws, 9999, -1)).toThrow();
    expect(teamIdentity(ws, 9999)).toMatchObject({ name: 'Test FC', abbr: 'TFC', hasBin: true, hasEdit: true });
    expect(teamIdentity(ws, 7777)).toMatchObject({ stadiumName: 'Cancha', hasBin: false });
  });
});

describe('teamView: access mirrors authorize()', () => {
  const km = new Set(['workspace.read', 'kit.read', 'kit.edit']);
  const sa = new Set(['workspace.read', 'workspace.manage', 'team.edit', 'kit.read', 'kit.edit']);
  const draftAdmin = new Set(['workspace.read']);

  it('limits a Kit Manager to league teams when a league is set', () => {
    expect(teamAccess(km, [9999], 9999)).toEqual({ data: false, colours: true, kits: true, outOfLeague: false });
    expect(teamAccess(km, [9999], 8888)).toEqual({ data: false, colours: false, kits: false, outOfLeague: true });
    expect(teamAccess(km, [], 8888).kits).toBe(true);
  });

  it('lets the Super Admin edit everything and keeps the Draft Admin read-only', () => {
    expect(teamAccess(sa, [9999], 8888)).toEqual({ data: true, colours: true, kits: true, outOfLeague: false });
    expect(teamAccess(draftAdmin, [], 9999)).toEqual({ data: false, colours: false, kits: false, outOfLeague: false });
  });
});
