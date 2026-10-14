// Role-based, field-level authorization for PES operations.
// The same rules are enforced again by firestore.rules when an operation is persisted;
// tests/pes/rulesSync.test.js checks that both lists stay identical.
import { PesPermissionError } from './core/errors.js';
import { KIT_EDITABLE_KEYS } from './kits/kitConfig.js';
import { TEXTURE_SLOT_IDS } from './kits/kitTextures.js';

/**
 * EDIT team-colour fields (6-bit RGB of team colour 1 and 2). The only database fields a
 * Kit Manager may change; every other pesdb/EDIT field is Super Admin only.
 */
export const EDIT_TEAM_KIT_FIELDS = ['c1r', 'c1g', 'c1b', 'c2r', 'c2g', 'c2b'];

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DRAFT_ADMIN: 'draft_admin',
  KIT_MANAGER: 'kit_manager',
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  draft_admin: 'Admin del Draft',
  kit_manager: 'Kit Manager',
};

/** Operation types and the capability each one needs. */
export const OP_TYPES = {
  'bin.team.set': 'team.edit',
  'bin.player.set': 'player.edit',
  'bin.coach.set': 'team.edit',
  'bin.team.tactics': 'team.edit',
  'bin.assignment.set': 'team.edit',
  'bin.assignment.add': 'team.edit',
  'bin.assignment.remove': 'team.edit',
  'edit.team.set': 'team.edit',
  'edit.player.set': 'player.edit',
  'edit.coach.set': 'team.edit',
  'edit.roster.number': 'team.edit',
  'edit.roster.player': 'team.edit',
  'edit.team.squad': 'team.edit',
  'edit.roster.remove': 'team.edit',
  'kit.set': 'kit.edit',
  'kit.texture.set': 'kit.edit',
  'kit.add': 'kit.edit',
};

/**
 * @typedef {{ uid: string, role: string|null, label?: string }} PesActor
 */

/** Capabilities granted to an actor (not tied to one operation). */
export function capabilitiesOf(actor) {
  const caps = new Set();
  if (!actor || !actor.role) return caps;
  caps.add('workspace.read');
  switch (actor.role) {
    case ROLES.SUPER_ADMIN:
      ['workspace.manage', 'team.edit', 'team.replace', 'player.edit', 'kit.read', 'kit.edit', 'export', 'roles.manage'].forEach(c => caps.add(c));
      break;
    case ROLES.DRAFT_ADMIN:
      // Read-only: only the Super Admin edits the PES database.
      break;
    case ROLES.KIT_MANAGER:
      caps.add('kit.read');
      caps.add('kit.edit');
      break;
    default:
      caps.clear();
  }
  return caps;
}

export function can(actor, capability) {
  return capabilitiesOf(actor).has(capability);
}

/**
 * Throws PesPermissionError unless `actor` may perform `op`.
 * @param {PesActor} actor
 * @param {{ type: string, field?: string, key?: string, target?: object }} op
 * @param {{ leagueTeamIds?: number[] }} [ctx]
 */
export function authorize(actor, op, ctx = {}) {
  const needed = OP_TYPES[op.type];
  if (!needed) throw new PesPermissionError('UNKNOWN_OP', `Operación desconocida: ${op.type}.`);
  if (!actor?.role) throw new PesPermissionError('NO_ROLE', 'Tu usuario no tiene un rol en el editor PES.');

  if (actor.role === ROLES.KIT_MANAGER) {
    const teamId = op.target?.teamId;
    const league = ctx.leagueTeamIds || [];
    if (league.length && !league.includes(teamId)) {
      throw new PesPermissionError('TEAM_NOT_IN_LEAGUE', `El equipo ${teamId} no es de la liga: no podés editar sus kits.`, { teamId });
    }
    if (op.type === 'kit.texture.set') {
      if (!TEXTURE_SLOT_IDS.includes(op.slot)) throw new PesPermissionError('FIELD_FORBIDDEN', `Kit Manager: "${op.slot}" no es una ranura de textura.`, { slot: op.slot });
      return;
    }
    if (op.type === 'kit.add') return;
    if (op.type === 'kit.set') {
      if (!KIT_EDITABLE_KEYS.includes(op.key)) throw new PesPermissionError('FIELD_FORBIDDEN', `Kit Manager: "${op.key}" no es un campo de kit editable.`, { key: op.key });
      return;
    }
    if (op.type === 'edit.team.set' && EDIT_TEAM_KIT_FIELDS.includes(op.field)) return;
    // Everything else in the database files (pesdb BINs, EDIT) is Super Admin only.
    throw new PesPermissionError('FORBIDDEN', 'Kit Manager: solo se pueden editar kits, colores de equipo y UniColors.', { type: op.type, field: op.field });
  }

  if (!can(actor, needed)) {
    throw new PesPermissionError('FORBIDDEN', `Tu rol (${ROLE_LABELS[actor.role] || actor.role}) no permite ${needed}.`, { type: op.type, needed });
  }
}
