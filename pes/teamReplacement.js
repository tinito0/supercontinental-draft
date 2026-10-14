// Team replacement (pesdb): turns an existing Team.bin slot into another club by
// rewriting its metadata and its squad in PlayerAssignment.bin.
//
// The team id is never changed: Competition*/Tactics files reference it and their
// layouts are not supported, so an id change could not be propagated safely.
import { readField } from './core/fields.js';
import { PesValidationError } from './core/errors.js';

function assignmentsOf(pa, teamId) {
  const f = n => pa.field(n);
  const rows = [];
  for (let i = 0; i < pa.count; i++) {
    const base = i * pa.recordSize;
    if (readField(pa.data, base, f('teamId')) !== teamId) continue;
    rows.push({
      id: readField(pa.data, base, f('id')),
      playerId: readField(pa.data, base, f('playerId')),
      shirtNumber: readField(pa.data, base, f('shirtNumber')),
    });
  }
  return rows;
}

function clubOf(pa, team, playerId, exceptTeamId) {
  const f = n => pa.field(n);
  const clubs = [];
  for (let i = 0; i < pa.count; i++) {
    const base = i * pa.recordSize;
    if (readField(pa.data, base, f('playerId')) !== playerId) continue;
    const tid = readField(pa.data, base, f('teamId'));
    if (tid === exceptTeamId || !team.has(tid)) continue;
    if (!team.get(tid, 'national')) clubs.push(tid);
  }
  return clubs;
}

/**
 * Computes the effect of a replacement without changing anything.
 * @param {object} bin loaded pesdb (needs team, player, assignment tables)
 * @param {{ teamId: number, fields?: Record<string, any>, roster?: { playerId: number, shirtNumber: number }[] }} request
 * @param {{ kits?: import('./kits/kitWorkspace.js').KitWorkspace }} [extra]
 */
export function planTeamReplacement(bin, request, extra = {}) {
  const { team, player, assignment: pa } = bin.tables;
  if (!team || !player || !pa) throw new PesValidationError('MISSING_TABLES', 'El reemplazo de equipo necesita Team.bin, Player.bin y PlayerAssignment.bin.');
  const { teamId, fields = {}, roster } = request;
  if (!team.has(teamId)) throw new PesValidationError('NOT_FOUND', `El equipo ${teamId} no existe.`);

  const errors = [];
  const warnings = [];
  const ops = [];

  for (const [name, value] of Object.entries(fields)) {
    if (name === 'id') { errors.push('El id del equipo no se puede cambiar (lo referencian otras tablas no soportadas).'); continue; }
    const f = team.fieldByName.get(name);
    if (!f) { errors.push(`Campo de equipo desconocido: ${name}.`); continue; }
    if (f.confidence !== 'verified') { errors.push(`El campo ${name} es de solo lectura.`); continue; }
    if (team.get(teamId, name) !== value) ops.push({ type: 'bin.team.set', target: { teamId }, field: name, value });
  }

  const current = assignmentsOf(pa, teamId);
  const impact = { teamId, teamName: team.get(teamId, 'nameEnglish'), fieldChanges: ops.length, playersOut: [], playersIn: [], rowsReused: 0, rowsAdded: 0, rowsRemoved: 0, otherClubs: [], kits: null };

  if (roster) {
    const seenP = new Set(), seenN = new Set();
    for (const r of roster) {
      if (!player.has(r.playerId)) errors.push(`El jugador ${r.playerId} no existe en Player.bin.`);
      if (seenP.has(r.playerId)) errors.push(`El jugador ${r.playerId} está dos veces en el plantel nuevo.`);
      if (!Number.isInteger(r.shirtNumber) || r.shirtNumber < 1 || r.shirtNumber > 99) errors.push(`Dorsal inválido para ${r.playerId}: ${r.shirtNumber}.`);
      if (seenN.has(r.shirtNumber)) errors.push(`Dorsal ${r.shirtNumber} repetido en el plantel nuevo.`);
      seenP.add(r.playerId);
      seenN.add(r.shirtNumber);
    }
    const newIds = new Set(roster.map(r => r.playerId));
    const oldIds = new Set(current.map(r => r.playerId));
    impact.playersOut = current.filter(r => !newIds.has(r.playerId)).map(r => r.playerId);
    impact.playersIn = roster.filter(r => !oldIds.has(r.playerId)).map(r => r.playerId);
    if (!team.get(teamId, 'national')) {
      for (const r of roster) {
        const clubs = clubOf(pa, team, r.playerId, teamId);
        if (clubs.length) impact.otherClubs.push({ playerId: r.playerId, teamIds: clubs });
      }
      if (impact.otherClubs.length) warnings.push(`${impact.otherClubs.length} jugador(es) del plantel nuevo siguen asignados a otro club.`);
    }

    // Reuse existing rows in order, add rows for extra players, remove leftover rows.
    const reuse = Math.min(current.length, roster.length);
    for (let i = 0; i < reuse; i++) {
      const row = current[i], want = roster[i];
      if (row.playerId !== want.playerId) ops.push({ type: 'bin.assignment.set', target: { assignmentId: row.id }, field: 'playerId', value: want.playerId });
      if (row.shirtNumber !== want.shirtNumber) ops.push({ type: 'bin.assignment.set', target: { assignmentId: row.id }, field: 'shirtNumber', value: want.shirtNumber });
    }
    impact.rowsReused = reuse;
    let nextId = pa.maxId() + 1;
    const templateId = current[0]?.id ?? pa.ids()[0];
    for (let i = reuse; i < roster.length; i++) {
      ops.push({ type: 'bin.assignment.add', target: { teamId }, value: { assignmentId: nextId++, templateId, playerId: roster[i].playerId, teamId, shirtNumber: roster[i].shirtNumber } });
      impact.rowsAdded++;
    }
    for (let i = reuse; i < current.length; i++) {
      ops.push({ type: 'bin.assignment.remove', target: { assignmentId: current[i].id, teamId } });
      impact.rowsRemoved++;
    }
    if (impact.rowsAdded || impact.rowsRemoved) {
      warnings.push('El reemplazo cambia la cantidad de filas de PlayerAssignment.bin. El formato lo permite, pero no está probado en el juego.');
    }
    // Shirt-number moves are applied row by row; a temporary clash between reused rows is expected and
    // checked on the final state by the validator.
  }

  if (extra.kits) {
    try { impact.kits = { folder: extra.kits.teamFolder(teamId), kits: extra.kits.kitsOf(teamId).map(k => k.kit) }; } catch { impact.kits = { folder: null, kits: [] }; }
    warnings.push(impact.kits.folder
      ? `Los kits siguen siendo los de "${impact.kits.folder}" (el kit-server se asigna por id de equipo).`
      : 'El equipo no tiene carpeta en el kit-server: el juego usará los kits de la base.');
  }

  return { ok: errors.length === 0, errors, warnings, impact, ops: ops.map(op => ({ ...op, batch: 'team.replace' })) };
}
