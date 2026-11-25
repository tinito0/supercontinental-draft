import { describe, it, expect } from 'vitest';
import { authorize, can, ROLES } from '../../pes/permissions.js';

const superAdmin = { uid: 's', role: ROLES.SUPER_ADMIN };
const draftAdmin = { uid: 'd', role: ROLES.DRAFT_ADMIN };
const lusitano = { uid: 'l', role: ROLES.KIT_MANAGER, label: 'Lusitano' };
const balvanera = { uid: 'b', role: ROLES.KIT_MANAGER, label: 'Talleres de Balvanera' };
const nobody = { uid: 'n', role: null };

const ops = {
  binPlayer: { type: 'bin.player.set', target: { playerId: 1 }, field: 'speed', value: 80 },
  binTeam: { type: 'bin.team.set', target: { teamId: 1 }, field: 'nameEnglish', value: 'X' },
  replaceRow: { type: 'bin.assignment.add', target: { teamId: 1 }, value: {} },
  editPlayer: { type: 'edit.player.set', target: { playerId: 1 }, field: 'height', value: 180 },
  teamColour: { type: 'edit.team.set', target: { teamId: 1 }, field: 'c1r', value: 10 },
  teamName: { type: 'edit.team.set', target: { teamId: 1 }, field: 'name', value: 'X' },
  kitCollar: { type: 'kit.set', target: { teamId: 1, kit: 'p1' }, key: 'Collar', value: 3 },
  uniColor: { type: 'kit.set', target: { teamId: 1, kit: 'p1' }, key: 'UniColor_Color1', value: '#FFFFFF' },
  kitUnknown: { type: 'kit.set', target: { teamId: 1, kit: 'p1' }, key: 'Unk_Offset0x1C_Bits0to1', value: 1 },
  font: { type: 'kit.texture.set', target: { teamId: 1, kit: 'p1' }, slot: 'name', value: 'x_name', ext: '.ftex' },
  kitTexture: { type: 'kit.texture.set', target: { teamId: 1, kit: 'p1' }, slot: 'kit', value: 'u0001p1', ext: '.ftex' },
  fontWrongKey: { type: 'kit.texture.set', target: { teamId: 1, kit: 'p1' }, slot: 'Collar', value: 'x', ext: '.ftex' },
};

const allowed = (actor, op, ctx) => { try { authorize(actor, op, ctx); return true; } catch { return false; } };

describe('PES permissions', () => {
  it('Super Admin can do everything, including export and role management', () => {
    for (const op of Object.values(ops).filter(o => o !== ops.kitUnknown && o !== ops.fontWrongKey)) expect(allowed(superAdmin, op)).toBe(true);
    expect(can(superAdmin, 'export')).toBe(true);
    expect(can(superAdmin, 'roles.manage')).toBe(true);
  });

  it('Draft Admin is read-only (only the Super Admin edits the database)', () => {
    for (const op of Object.values(ops)) expect(allowed(draftAdmin, op), op.type).toBe(false);
    expect(can(draftAdmin, 'workspace.read')).toBe(true);
    expect(can(draftAdmin, 'export')).toBe(false);
  });

  it('both Kit Managers edit kits, textures, fonts, UniColors and team data (Team.bin and EDIT) of league teams', () => {
    for (const km of [lusitano, balvanera]) {
      for (const op of [ops.kitCollar, ops.uniColor, ops.font, ops.kitTexture, ops.teamColour, ops.teamName, ops.binTeam]) expect(allowed(km, op), `${km.label} ${op.type}`).toBe(true);
    }
  });

  it('Kit Managers cannot touch players, squads, coaches or tactics, replace teams or export', () => {
    const squad = { type: 'edit.roster.number', target: { teamId: 1 }, value: 9 };
    const coach = { type: 'bin.coach.set', target: { coachId: 1, teamId: 1 }, field: 'name', value: 'X' };
    const tactics = { type: 'bin.team.tactics', target: { teamId: 1 }, value: {} };
    for (const op of [ops.binPlayer, ops.replaceRow, ops.editPlayer, ops.kitUnknown, ops.fontWrongKey, squad, coach, tactics]) {
      expect(allowed(lusitano, op), op.type + (op.field || op.key)).toBe(false);
    }
    expect(can(lusitano, 'export')).toBe(false);
    expect(can(lusitano, 'roles.manage')).toBe(false);
    expect(can(lusitano, 'team.replace')).toBe(false);
  });

  it('restricts Kit Managers to league teams when the workspace defines them', () => {
    const ctx = { leagueTeamIds: [5, 6] };
    expect(allowed(lusitano, { ...ops.kitCollar, target: { teamId: 5, kit: 'p1' } }, ctx)).toBe(true);
    expect(allowed(lusitano, ops.kitCollar, ctx)).toBe(false);
    expect(allowed(lusitano, { ...ops.teamName, target: { teamId: 5 } }, ctx)).toBe(true);
    expect(allowed(lusitano, ops.teamName, ctx)).toBe(false);
    expect(allowed(lusitano, ops.binTeam, ctx)).toBe(false);
    expect(allowed(superAdmin, ops.kitCollar, ctx)).toBe(true);
  });

  it('users without a PES role get nothing', () => {
    for (const op of Object.values(ops)) expect(allowed(nobody, op)).toBe(false);
    expect(can(nobody, 'workspace.read')).toBe(false);
    expect(allowed(undefined, ops.kitCollar)).toBe(false);
  });

  it('rejects unknown operation types', () => {
    expect(() => authorize(superAdmin, { type: 'db.drop' })).toThrow(expect.objectContaining({ code: 'UNKNOWN_OP' }));
  });
});
