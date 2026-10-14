// Workspace validation. Issues found in the working copy are compared with the
// issues already present in the untouched source files: only *new* issues block
// export, pre-existing ones are reported as warnings.
import { RecordTable, BIN_TABLES } from './formats/pes2021/binDatabase.js';
import { readField } from './core/fields.js';
import { validateKitValue, KIT_EDITABLE_KEYS } from './kits/kitConfig.js';
import { EDIT_LAYOUT } from './formats/pes2021/editLayout.js';

function issue(key, severity, scope, message) { return { key, severity, scope, message }; }

function binIssues(tables) {
  const out = [];
  const { team, player, assignment, coach, tactics, tacticsFormation } = tables;
  for (const t of [team, player, assignment, coach, tactics, tacticsFormation]) {
    if (!t) continue;
    for (const id of t.duplicateIds) out.push(issue(`dup:${t.file}:${id}`, 'error', t.file, `${t.file}: id ${id} repetido.`));
  }
  if (tactics && team) {
    for (const id of tactics.ids()) {
      const tid = tactics.get(id, 'teamId');
      if (!team.has(tid)) out.push(issue(`tactics-team:${id}:${tid}`, 'warning', 'Tactics.bin', `Táctica ${id}: el equipo ${tid} no existe en Team.bin.`));
    }
  }
  if (tactics && tacticsFormation) {
    const missing = new Set();
    for (const key of tacticsFormation.ids()) { const id = tacticsFormation.get(key, 'tacticsId'); if (!tactics.has(id)) missing.add(id); }
    for (const id of missing) out.push(issue(`formation-tactics:${id}`, 'warning', 'TacticsFormation.bin', `Formación de la táctica ${id}: no existe en Tactics.bin.`));
  }
  if (team && coach) {
    for (const id of team.ids()) {
      const c = team.get(id, 'coach');
      if (c && !coach.has(c)) out.push(issue(`team-coach:${id}:${c}`, 'warning', 'Team.bin', `Equipo ${id}: el entrenador ${c} no existe en Coach.bin.`));
    }
  }
  if (assignment) {
    const numbers = new Map();
    const f = n => assignment.field(n);
    for (let i = 0; i < assignment.count; i++) {
      const base = i * assignment.recordSize;
      const id = readField(assignment.data, base, f('id'));
      const pid = readField(assignment.data, base, f('playerId'));
      const tid = readField(assignment.data, base, f('teamId'));
      const num = readField(assignment.data, base, f('shirtNumber'));
      if (player && !player.has(pid)) out.push(issue(`pa-player:${id}:${pid}`, 'error', 'PlayerAssignment.bin', `Asignación ${id}: el jugador ${pid} no existe en Player.bin.`));
      if (team && !team.has(tid)) out.push(issue(`pa-team:${id}:${tid}`, 'error', 'PlayerAssignment.bin', `Asignación ${id}: el equipo ${tid} no existe en Team.bin.`));
      const k = `${tid}:${num}`;
      if (numbers.has(k)) out.push(issue(`pa-num:${tid}:${num}`, 'error', 'PlayerAssignment.bin', `Equipo ${tid}: dorsal ${num} repetido (asignaciones ${numbers.get(k)} y ${id}).`));
      else numbers.set(k, id);
    }
  }
  return out;
}

function editIssues(edit, data, playerIds) {
  const out = [];
  for (const id of edit.teams.keys()) {
    const roster = edit.roster(id, data);
    const seenP = new Set(), seenN = new Set();
    for (const r of roster) {
      if (seenP.has(r.playerId)) out.push(issue(`edit-rdup:${id}:${r.playerId}`, 'error', 'EDIT', `EDIT equipo ${id}: el jugador ${r.playerId} aparece dos veces.`));
      if (seenN.has(r.number)) out.push(issue(`edit-ndup:${id}:${r.number}`, 'warning', 'EDIT', `EDIT equipo ${id}: dorsal ${r.number} repetido.`));
      if (playerIds && !edit.players.has(r.playerId) && !playerIds.has(r.playerId)) {
        out.push(issue(`edit-rref:${id}:${r.playerId}`, 'warning', 'EDIT', `EDIT equipo ${id}: el jugador ${r.playerId} no está en el EDIT ni en Player.bin.`));
      }
      seenP.add(r.playerId);
      seenN.add(r.number);
    }
  }
  if (EDIT_LAYOUT.playerStart + edit.nPlayers * EDIT_LAYOUT.playerSize > EDIT_LAYOUT.teamStart) {
    out.push(issue('edit-pfit', 'error', 'EDIT', 'EDIT: demasiados jugadores para el espacio disponible.'));
  }
  return out;
}

function kitIssues(kits) {
  const out = [];
  for (const path of kits.modified) {
    const cfg = kits.configs.get(path);
    for (const key of KIT_EDITABLE_KEYS) {
      const i = cfg.keys.get(key);
      if (i === undefined) continue;
      try { validateKitValue(cfg, key, cfg.lines[i].value); } catch (e) { out.push(issue(`kit:${path}:${key}`, 'error', 'kit-server', `${path}: ${e.message}`)); }
    }
  }
  return out;
}

function sourceTables(tables) {
  const out = {};
  for (const [kind, t] of Object.entries(tables)) {
    out[kind] = new RecordTable(kind, BIN_TABLES[kind], { header: t.header, compressed: t.compressed, payload: t.source });
  }
  return out;
}

/**
 * @returns {{ passed: boolean, errors: object[], warnings: object[], preexisting: object[], checkedAt: string }}
 */
export function validateWorkspace(ws) {
  const now = [];
  const before = new Set();
  if (ws.bin) {
    now.push(...binIssues(ws.bin.tables));
    for (const i of binIssues(sourceTables(ws.bin.tables))) before.add(i.key);
  }
  if (ws.edit) {
    const pids = ws.bin?.tables.player ? new Set(ws.bin.tables.player.index.keys()) : null;
    now.push(...editIssues(ws.edit, ws.edit.data, pids));
    for (const i of editIssues(ws.edit, ws.edit.originalData, pids)) before.add(i.key);
  }
  if (ws.kits) now.push(...kitIssues(ws.kits));

  const preexisting = now.filter(i => before.has(i.key)).map(i => ({ ...i, severity: 'warning', preexisting: true }));
  const fresh = now.filter(i => !before.has(i.key));
  const errors = fresh.filter(i => i.severity === 'error');
  const warnings = fresh.filter(i => i.severity === 'warning');
  return { passed: errors.length === 0, errors, warnings, preexisting, checkedAt: new Date().toISOString() };
}
