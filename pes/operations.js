// Operation model: every change to a workspace is a plain, serializable operation.
// Operations are authorized, validated and applied atomically per batch: if any
// operation in a batch fails, the workspace is restored to its previous state.
import { authorize } from './permissions.js';
import { PesValidationError } from './core/errors.js';
import { validateFieldValue } from './core/fields.js';
import { textureFromFile, TEXTURE_SLOT_IDS } from './kits/kitTextures.js';

/**
 * @typedef {object} PesWorkspace
 * @property {{ tables: Record<string, import('./formats/pes2021/binDatabase.js').RecordTable>, passthrough: object, unsupported: string[] }} [bin]
 * @property {import('./formats/pes2021/editDatabase.js').EditDatabase} [edit]
 * @property {import('./kits/kitWorkspace.js').KitWorkspace} [kits]
 * @property {{ leagueTeamIds?: number[] }} [meta]
 */

function requireBin(ws) {
  if (!ws.bin) throw new PesValidationError('NO_BIN', 'No hay una base pesdb cargada.');
  return ws.bin;
}
function requireTable(ws, kind) {
  const t = requireBin(ws).tables[kind];
  if (!t) throw new PesValidationError('NO_TABLE', `Falta ${{ team: 'Team.bin', player: 'Player.bin', coach: 'Coach.bin' }[kind] || 'PlayerAssignment.bin'}.`);
  return t;
}
function requireEdit(ws) {
  if (!ws.edit) throw new PesValidationError('NO_EDIT', 'No hay un EDIT00000000 cargado.');
  return ws.edit;
}
function requireKits(ws) {
  if (!ws.kits) throw new PesValidationError('NO_KITS', 'No hay un kit-server cargado.');
  return ws.kits;
}

const APPLY = {
  'bin.team.set': (ws, op) => requireTable(ws, 'team').set(op.target.teamId, op.field, op.value),
  'bin.player.set': (ws, op) => requireTable(ws, 'player').set(op.target.playerId, op.field, op.value),
  'bin.coach.set': (ws, op) => {
    if (!['name', 'country', 'adaptability'].includes(op.field)) throw new PesValidationError('FIELD_READ_ONLY', `Entrenador: "${op.field}" no es editable.`);
    return requireTable(ws, 'coach').set(op.target.coachId, op.field, op.value);
  },
  'bin.assignment.set': (ws, op) => {
    if (!['playerId', 'teamId', 'shirtNumber'].includes(op.field)) throw new PesValidationError('FIELD_READ_ONLY', `Asignación: "${op.field}" no es editable.`);
    const pa = requireTable(ws, 'assignment');
    if (op.field === 'shirtNumber' && !(Number.isInteger(op.value) && op.value >= 1 && op.value <= 99)) throw new PesValidationError('OUT_OF_RANGE', 'Dorsal fuera de rango (1–99).');
    if (op.field === 'playerId' && !requireTable(ws, 'player').has(op.value)) throw new PesValidationError('DANGLING_REF', `El jugador ${op.value} no existe en Player.bin.`);
    if (op.field === 'teamId' && !requireTable(ws, 'team').has(op.value)) throw new PesValidationError('DANGLING_REF', `El equipo ${op.value} no existe en Team.bin.`);
    return pa.set(op.target.assignmentId, op.field, op.value);
  },
  'bin.assignment.add': (ws, op) => {
    const pa = requireTable(ws, 'assignment');
    const { assignmentId, templateId, playerId, teamId, shirtNumber } = op.value;
    if (!requireTable(ws, 'player').has(playerId)) throw new PesValidationError('DANGLING_REF', `El jugador ${playerId} no existe en Player.bin.`);
    if (!requireTable(ws, 'team').has(teamId)) throw new PesValidationError('DANGLING_REF', `El equipo ${teamId} no existe en Team.bin.`);
    if (!(Number.isInteger(shirtNumber) && shirtNumber >= 1 && shirtNumber <= 99)) throw new PesValidationError('OUT_OF_RANGE', 'Dorsal fuera de rango (1–99).');
    validateFieldValue(pa.field('shirtNumber'), shirtNumber); // validate before mutating
    validateFieldValue(pa.field('id'), assignmentId);
    pa.appendFrom(templateId, assignmentId);
    pa.set(assignmentId, 'playerId', playerId);
    pa.set(assignmentId, 'teamId', teamId);
    pa.set(assignmentId, 'shirtNumber', shirtNumber);
    return { before: null, after: op.value };
  },
  'bin.assignment.remove': (ws, op) => {
    const pa = requireTable(ws, 'assignment');
    const before = pa.read(op.target.assignmentId);
    pa.remove(op.target.assignmentId);
    return { before, after: null };
  },
  'edit.team.set': (ws, op) => requireEdit(ws).setTeamField(op.target.teamId, op.field, op.value),
  'edit.player.set': (ws, op) => requireEdit(ws).setPlayerField(op.target.playerId, op.field, op.value),
  'edit.coach.set': (ws, op) => requireEdit(ws).setCoachField(op.target.coachId, op.field, op.value),
  'edit.roster.number': (ws, op) => requireEdit(ws).setRosterNumber(op.target.teamId, op.target.slot, op.value),
  'edit.roster.player': (ws, op) => requireEdit(ws).setRosterPlayer(op.target.teamId, op.target.slot, op.value),
  'edit.team.squad': (ws, op) => requireEdit(ws).setSquad(op.target.teamId, op.value),
  'edit.roster.remove': (ws, op) => {
    const r = requireEdit(ws).removeFromRoster(op.target.teamId, op.value);
    return { before: r.before, after: { removed: op.value, substitute: r.substitute, emptyPosition: r.emptyPosition } };
  },
  'kit.set': (ws, op) => requireKits(ws).setValue(op.target.teamId, op.target.kit, op.key, op.value),
  'kit.add': (ws, op) => requireKits(ws).addKit(op.target.teamId, { kit: op.value?.kit, from: op.value?.from, section: op.value?.section }),
  'kit.texture.set': (ws, op) => {
    if (!TEXTURE_SLOT_IDS.includes(op.slot)) throw new PesValidationError('UNKNOWN_SLOT', `Ranura de textura desconocida: ${op.slot}.`);
    const ext = op.ext || '.ftex';
    const bytes = ws.assetStore?.get(op.asset?.sha256);
    if (!bytes) throw new PesValidationError('ASSET_MISSING', `Falta la textura ${op.value}${ext} (sha256 ${op.asset?.sha256}).`);
    textureFromFile(op.slot, op.value + ext, bytes); // re-verify structure before using it
    return requireKits(ws).setTextureAsset(op.target.teamId, op.target.kit, op.slot, op.value, bytes, ext);
  },
};

/** Captures the mutable state of a workspace so a failed batch can be rolled back. */
export function snapshot(ws) {
  return {
    bin: ws.bin && Object.fromEntries(Object.entries(ws.bin.tables).map(([k, t]) => [k, t.data.slice()])),
    edit: ws.edit && ws.edit.data.slice(),
    kits: ws.kits && {
      configs: new Map(ws.kits.configs), modified: new Set(ws.kits.modified), assets: new Map(ws.kits.assets),
      texts: new Map(ws.kits.texts), original: new Map(ws.kits.original), orderEdits: new Set(ws.kits.orderEdits), allPaths: new Set(ws.kits.allPaths),
    },
  };
}

export function restore(ws, snap) {
  if (snap.bin) for (const [k, data] of Object.entries(snap.bin)) { ws.bin.tables[k].data = data; ws.bin.tables[k].reindex(); }
  if (snap.edit) { ws.edit.data.set(snap.edit); ws.edit.reindex(); }
  if (snap.kits) Object.assign(ws.kits, snap.kits);
}

/**
 * Authorizes and applies a batch atomically.
 * @returns {object[]} the operations with `before`/`after` filled in
 */
export function applyOperations(ws, ops, actor) {
  for (const op of ops) authorize(actor, op, ws.meta || {});
  const snap = snapshot(ws);
  const applied = [];
  try {
    for (const op of ops) {
      const fn = APPLY[op.type];
      const res = fn(ws, op);
      applied.push({ ...op, before: res?.before ?? null, after: res?.after ?? op.value });
    }
  } catch (e) {
    restore(ws, snap);
    e.details = { ...(e.details || {}), failedAt: applied.length, rolledBack: true };
    throw e;
  }
  return applied;
}

/**
 * Replays persisted operations on a freshly loaded workspace. Firestore rules already
 * authorized them; validation still runs and an operation that fails is skipped and
 * reported. Every APPLY handler validates before writing, so a failure leaves no
 * partial change and no per-operation snapshot is needed.
 */
export function replayOperations(ws, ops) {
  const failures = [];
  for (const op of ops) {
    try { APPLY[op.type](ws, op); } catch (e) { failures.push({ op, error: e }); }
  }
  return failures;
}
