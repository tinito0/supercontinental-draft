// Draft → PES: each draft team (built by a user in the marketplace) replaces an existing game team.
// Input is the same data utils/pesExport.js used for the EJOGC CSVs (teamName, country, players,
// dorsals, formation + lineup, setPieces, tactics). Output is a list of engine operations for:
//   pesdb  Team.bin names/abbreviation/country, PlayerAssignment.bin squad
//   EDIT   team name/abbreviation/country, full squad + order + formation + strategy + captain + takers
//   both   transferred players are removed from their previous club (national teams untouched)
//   both   optional coach: the replaced team's own coach is renamed (Coach.bin + EDIT coach entry)
// Planning is simulated on the working copy and rolled back, so the plan reflects the real result.
import { applyOperations, snapshot, restore } from './operations.js';
import { planTeamReplacement } from './teamReplacement.js';
import { readField } from './core/fields.js';
import { EDIT_TACTICS, EDIT_TAKER_ROLES, EDIT_STRATEGY } from './formats/pes2021/editLayout.js';
import { PesValidationError } from './core/errors.js';

/** App position code → PES role (same table as utils/pesExport.js PES_POSITION_MAP). */
export const PES_POSITION_MAP = { PT: 0, DFC: 1, LI: 2, LD: 3, MCD: 4, MC: 5, MI: 6, MD: 7, MO: 8, EI: 9, ED: 10, SD: 11, DC: 12 };

const NAME_FIELDS = ['nameJapanese', 'nameSpanish', 'nameLatamSpanish', 'nameEnglish', 'nameUSEnglish', 'nameItalian', 'namePortuguese',
  'nameBrazilian', 'nameFrench', 'nameGerman', 'nameDutch', 'nameSwedish', 'nameRussian', 'nameGreek', 'nameTurkish', 'nameSimplifiedChinese', 'nameDatabase'];
const SUPER = { uid: 'draft-transfer', role: 'super_admin' };
const enc = new TextEncoder();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
const idOf = p => Number(p?.Id ?? p?.id);

/** Truncates to a UTF-8 byte budget without cutting a character. */
export function fitBytes(text, maxBytes) {
  let s = String(text || '').trim();
  while (enc.encode(s).length > maxBytes) s = s.slice(0, -1);
  return s;
}

/** Same rule as utils/pesExport.js generateTeamCsv: first 3 letters/digits, upper case. */
export function abbreviationOf(name) {
  return String(name || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'SCL';
}

/** App pitch (x 0..100 left→right, y 0 attack .. 90 own goal) → EDIT (depth, lateral); formula of pesExport.js. */
export function toPitch(slot) {
  return [clamp((90 - slot.y) * 0.46 + 3, 3, 48), clamp(slot.x, 8, 92)];
}

/** App tactics → EDIT strategy bytes. Pressuring is inverted; "numbers in" go 0..2 → 1..3. */
export function strategyFromTactics(tactics = {}, defaults = {}) {
  const t = { ...defaults, ...tactics };
  const out = {};
  const bin = k => (t[k] == null ? undefined : clamp(t[k], 0, 1));
  for (const k of ['attackingStyles', 'buildUp', 'attackingArea', 'positioning', 'defensiveStyles', 'containmentArea']) out[k] = bin(k);
  if (t.pressuring != null) out.pressuring = 1 - clamp(t.pressuring, 0, 1);
  for (const k of ['supportRange', 'defensiveLine', 'compactness']) if (t[k] != null) out[k] = clamp(t[k], 1, 10);
  for (const k of ['numbersInAttack', 'numbersInDefense']) if (t[k] != null) out[k] = clamp(t[k] + 1, 1, 3);
  for (const k of Object.keys(out)) if (out[k] === undefined || !(k in EDIT_STRATEGY)) delete out[k];
  return out;
}

// Set-piece scores from PES Editor Rebuilt (extras.js SP_ROLES), on verified Player.bin attributes.
const TAKER_SCORE = {
  longFK: a => a.placeKicking * 2 + a.kickingPower * 2 + a.curl,
  shortFK: a => a.placeKicking * 2 + a.curl * 2,
  secondKicker: a => a.placeKicking * 2 + a.curl * 2,
  leftCorner: a => a.curl * 2 + a.loftedPass + a.placeKicking,
  rightCorner: a => a.curl * 2 + a.loftedPass + a.placeKicking,
  penalty: a => a.finishing * 2 + a.placeKicking + a.kickingPower,
  header1: a => a.heading * 2 + a.jump + a.physicalContact,
  header2: a => a.heading * 2 + a.jump + a.physicalContact,
  header3: a => a.heading * 2 + a.jump + a.physicalContact,
};

/**
 * Builds the EDIT squad spec of one draft team.
 * @returns {{ spec: object, roster: {playerId:number, number:number}[], warnings: string[], errors: string[] }}
 */
export function buildSquadSpec(team, { formations, defaultTactics = {}, playerTable = null }) {
  const warnings = [], errors = [];
  const formation = formations[team.formation] || formations['4-3-3'];
  if (!formations[team.formation]) warnings.push(`Formación "${team.formation}" desconocida: se usa 4-3-3.`);
  const layout = formation.layout.slice(0, 11);
  const players = (team.players || []).filter(p => Number.isInteger(idOf(p)) && idOf(p) > 0);
  const byId = new Map(players.map(p => [idOf(p), p]));
  if (players.length > 40) errors.push(`Tiene ${players.length} jugadores; el juego admite 40.`);
  if (players.length < 11) errors.push(`Tiene ${players.length} jugadores; hacen falta al menos 11.`);

  // Starters in layout order (GK entry first), filling empty positions with remaining players.
  const gkIndex = Math.max(0, layout.findIndex(s => s.pos === 'PT'));
  const entries = [gkIndex, ...layout.map((_, i) => i).filter(i => i !== gkIndex)];
  const used = new Set();
  const starterIds = entries.map(i => {
    const id = Number((team.lineup || {})[i]);
    if (byId.has(id) && !used.has(id)) { used.add(id); return id; }
    return null;
  });
  const rest = players.map(idOf).filter(id => !used.has(id));
  starterIds.forEach((id, k) => {
    if (id == null && rest.length) {
      const next = rest.shift();
      used.add(next);
      starterIds[k] = next;
      warnings.push(`Puesto ${layout[entries[k]].pos} sin titular: se usa a ${byId.get(next)?.Name || (playerTable?.has(next) ? playerTable.get(next, 'name') : next)}.`);
    }
  });
  const ordered = [...starterIds.filter(id => id != null), ...players.map(idOf).filter(id => !used.has(id))].slice(0, 40);

  // Shirt numbers: the user's choice when valid and unique, otherwise the first free number.
  const taken = new Set();
  const wanted = id => Number((team.dorsals || {})[String(id)] ?? (team.dorsals || {})[id]);
  const roster = ordered.map(id => {
    const n = wanted(id);
    if (Number.isInteger(n) && n >= 1 && n <= 99 && !taken.has(n)) { taken.add(n); return { playerId: id, number: n, chosen: true }; }
    return { playerId: id, number: 0, chosen: false };
  });
  let next = 1;
  for (const r of roster) {
    if (r.number) continue;
    while (taken.has(next)) next++;
    r.number = next;
    taken.add(next);
  }
  const auto = roster.filter(r => !r.chosen).length;
  if (auto) warnings.push(`${auto} jugador(es) sin dorsal elegido: se asignó el primero libre.`);

  const slotOf = id => roster.findIndex(r => r.playerId === id);
  const lineup = starterIds.map(id => slotOf(id));
  const roles = [0, ...entries.slice(1).map(i => PES_POSITION_MAP[layout[i].pos] ?? 5)];
  const pos = [EDIT_TACTICS.gkPosition, ...entries.slice(1).map(i => toPitch(layout[i]))];

  // Captain and takers: the user's picks; empty picks are filled with the best starter (Rebuilt scores).
  const sp = team.setPieces || {};
  const starterSlots = lineup.slice(1).filter(s => s >= 0);
  const attrs = slot => {
    const id = roster[slot]?.playerId;
    if (!playerTable?.has(id)) return null;
    return Object.fromEntries(['placeKicking', 'kickingPower', 'curl', 'loftedPass', 'finishing', 'heading', 'jump', 'physicalContact'].map(k => [k, playerTable.get(id, k)]));
  };
  const pick = (role, exclude = []) => {
    const cands = starterSlots.filter(s => !exclude.includes(s) && attrs(s));
    if (!cands.length) return starterSlots[0] ?? 255;
    return cands.sort((a, b) => TAKER_SCORE[role](attrs(b)) - TAKER_SCORE[role](attrs(a)))[0];
  };
  const takers = [];
  let autoTakers = 0;
  EDIT_TAKER_ROLES.forEach((role, k) => {
    const chosen = slotOf(Number(sp[role]));
    if (chosen >= 0) { takers.push(chosen); return; }
    autoTakers++;
    const exclude = role === 'secondKicker' ? [takers[1]] : role.startsWith('header') ? [takers[3], takers[4], ...takers.slice(6)] : [];
    takers.push(pick(role, exclude));
  });
  if (autoTakers) warnings.push(`${autoTakers} pateador(es) sin elegir: se eligió automáticamente al titular más apto.`);
  let captain = slotOf(Number(sp.captain));
  if (captain < 0) { captain = starterSlots[0] ?? 0; warnings.push('Sin capitán elegido: se usa al primer titular de campo.'); }

  return {
    spec: {
      players: roster.map(({ playerId, number }) => ({ playerId, number })),
      lineup,
      formation: { roles, pos },
      strategy: strategyFromTactics(team.tactics, defaultTactics),
      captain,
      takers,
    },
    roster: roster.map(({ playerId, number }) => ({ playerId, number })),
    warnings,
    errors,
  };
}

function clubRowsOf(bin, playerIds, excludeTeams) {
  const { team, assignment: pa } = bin.tables;
  const f = n => pa.field(n);
  const rows = [];
  for (let i = 0; i < pa.count; i++) {
    const base = i * pa.recordSize;
    const pid = readField(pa.data, base, f('playerId'));
    if (!playerIds.has(pid)) continue;
    const tid = readField(pa.data, base, f('teamId'));
    if (excludeTeams.has(tid) || !team.has(tid) || team.get(tid, 'national')) continue;
    rows.push({ id: readField(pa.data, base, f('id')), playerId: pid, teamId: tid });
  }
  return rows;
}

function binSquadSize(ws, teamId) {
  const pa = ws.bin?.tables.assignment;
  if (!pa) return null;
  const f = pa.field('teamId');
  let n = 0;
  for (let i = 0; i < pa.count; i++) if (readField(pa.data, i * pa.recordSize, f) === teamId) n++;
  return n;
}

function isNational(ws, teamId) {
  return Boolean(ws.bin?.tables.team?.has(teamId) && ws.bin.tables.team.get(teamId, 'national'));
}

/**
 * Plans the transfer of every mapped draft team.
 * @param {object} ws workspace (needs bin with team/player/assignment and/or edit)
 * @param {object[]} draftTeams draft teams (see TemplateAdminSection data shape) with `id`
 * @param {Record<string, number>} mapping draft team id → PES team id
 * @param {{ formations: object, defaultTactics?: object, coaches?: Record<string, {name?: string, country?: number}> }} options
 *   coaches: draft team id → coach to write; teams without an entry keep the game team's coach.
 */
export function planDraftTransfer(ws, draftTeams, mapping, options) {
  const errors = [], warnings = [];
  const teams = draftTeams.filter(t => mapping[t.id] != null && mapping[t.id] !== '');
  if (!teams.length) throw new PesValidationError('NO_MAPPING', 'No hay equipos del draft asignados a equipos del juego.');
  if (!ws.bin?.tables.assignment && !ws.edit) throw new PesValidationError('NO_SOURCES', 'Cargá la base (pesdb) y/o el EDIT.');
  const playerTable = ws.bin?.tables.player || null;

  // Mapping sanity: each game team used once, each player in one draft team only.
  const targets = new Map();
  for (const t of teams) {
    const pesId = Number(mapping[t.id]);
    if (targets.has(pesId)) errors.push(`El equipo del juego ${pesId} está asignado a "${targets.get(pesId).name}" y a "${t.name}".`);
    targets.set(pesId, t);
    if (ws.bin?.tables.team && !ws.bin.tables.team.has(pesId)) errors.push(`"${t.name}": el equipo del juego ${pesId} no existe en Team.bin.`);
    if (ws.edit && !ws.edit.teams.has(pesId)) errors.push(`"${t.name}": el equipo del juego ${pesId} no existe en el EDIT.`);
    if (isNational(ws, pesId)) warnings.push(`"${t.name}" reemplaza a una selección nacional (${pesId}).`);
  }
  const owner = new Map();
  for (const t of teams) {
    for (const p of t.players || []) {
      const id = idOf(p);
      if (owner.has(id) && owner.get(id) !== t.name) errors.push(`${p.Name || id} está en "${owner.get(id)}" y en "${t.name}".`);
      owner.set(id, t.name);
      if (playerTable && !playerTable.has(id) && !ws.edit?.players.has(id)) {
        errors.push(`"${t.name}": ${p.Name || id} (id ${id}) no existe en la base cargada. ¿Se generó jugadores.json desde otra base?`);
      }
    }
  }

  const perTeam = teams.map(t => {
    const built = buildSquadSpec(t, { ...options, playerTable });
    built.errors.forEach(e => errors.push(`"${t.name}": ${e}`));
    return { team: t, pesTeamId: Number(mapping[t.id]), ...built };
  });
  if (errors.length) return { ok: false, errors, warnings, teams: perTeam.map(summary), ops: [] };

  // Simulate on the working copy, collecting operations; always roll back.
  const snap = snapshot(ws);
  const ops = [];
  const removed = [];
  const run = list => { if (list.length) { const applied = applyOperations(ws, list, SUPER); ops.push(...list); return applied; } return []; };
  try {
    const targetIds = new Set(targets.keys());
    const drafted = new Set(owner.keys());

    // 1. Remove transferred players from their previous clubs (BIN rows, then EDIT rosters).
    if (ws.bin?.tables.assignment) {
      const rows = clubRowsOf(ws.bin, drafted, targetIds);
      run(rows.map(r => ({ type: 'bin.assignment.remove', target: { assignmentId: r.id, teamId: r.teamId }, batch: 'draft.transfer' })));
      rows.forEach(r => removed.push({ file: 'pesdb', playerId: r.playerId, teamId: r.teamId }));
    }
    if (ws.edit && !ws.bin?.tables.team) {
      warnings.push('Sin Team.bin no se puede distinguir clubes de selecciones: los fichados no se sacan de sus clubes en el EDIT.');
    } else if (ws.edit) {
      for (const teamId of ws.edit.teams.keys()) {
        if (targetIds.has(teamId) || isNational(ws, teamId)) continue;
        for (const r of ws.edit.roster(teamId).filter(x => drafted.has(x.playerId))) {
          const [applied] = run([{ type: 'edit.roster.remove', target: { teamId }, value: r.playerId, batch: 'draft.transfer' }]);
          removed.push({ file: 'EDIT', playerId: r.playerId, teamId, substitute: applied?.after?.substitute ?? null, emptyPosition: Boolean(applied?.after?.emptyPosition) });
        }
      }
    }

    // 2. Write every draft team over its game team.
    for (const entry of perTeam) {
      const { team: t, pesTeamId, spec, roster } = entry;
      const name = String(t.name || 'Equipo').trim();
      const abbr = abbreviationOf(name);
      const country = Number(t.country);
      if (ws.bin?.tables.team) {
        const tt = ws.bin.tables.team;
        const fields = {};
        for (const f of NAME_FIELDS) fields[f] = fitBytes(name, tt.field(f).length - 1);
        fields.shortNameLicensed = fitBytes(abbr, tt.field('shortNameLicensed').length - 1);
        fields.shortNameFake = fitBytes(abbr, tt.field('shortNameFake').length - 1);
        if (Number.isInteger(country) && country > 0) fields.country = country;
        const plan = planTeamReplacement(ws.bin, { teamId: pesTeamId, fields, roster: roster.map(r => ({ playerId: r.playerId, shirtNumber: r.number })) });
        if (!plan.ok) { plan.errors.forEach(e => errors.push(`"${name}": ${e}`)); continue; }
        // Players are still listed under other clubs only when the BIN removal above skipped them (national teams).
        entry.binImpact = plan.impact;
        run(plan.ops.map(op => ({ ...op, batch: 'draft.transfer' })));
      }
      if (ws.edit?.teams.has(pesTeamId)) {
        const editOps = [
          { type: 'edit.team.set', target: { teamId: pesTeamId }, field: 'name', value: fitBytes(name, 0x45) },
          { type: 'edit.team.set', target: { teamId: pesTeamId }, field: 'short', value: abbr },
        ];
        if (Number.isInteger(country) && country > 0 && country < 512) editOps.push({ type: 'edit.team.set', target: { teamId: pesTeamId }, field: 'country', value: country });
        editOps.push({ type: 'edit.team.squad', target: { teamId: pesTeamId }, value: spec });
        run(editOps.map(op => ({ ...op, batch: 'draft.transfer' })));
      }
      const coach = options.coaches?.[t.id];
      if (coach?.name?.trim()) {
        const res = planCoach(ws, pesTeamId, { name: coach.name, country: Number(coach.country) || country });
        res.warnings.forEach(w => warnings.push(`"${name}": ${w}`));
        entry.coachName = res.ops.length ? fitBytes(coach.name, 44) : null;
        run(res.ops.map(op => ({ ...op, batch: 'draft.transfer' })));
      }
    }

    // 3. Clubs left short of players.
    const clubs = new Set(removed.map(r => r.teamId));
    for (const teamId of clubs) {
      const sizes = [binSquadSize(ws, teamId), ws.edit?.teams.has(teamId) ? ws.edit.roster(teamId).length : null].filter(v => v != null);
      const size = Math.min(...sizes);
      if (size < 11) warnings.push(`El equipo ${teamName(ws, teamId)} queda con ${size} jugador(es): no alcanza para un 11.`);
    }
  } catch (e) {
    errors.push(e.message);
  } finally {
    restore(ws, snap);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [...warnings, ...perTeam.flatMap(p => p.warnings.map(w => `"${p.team.name}": ${w}`))],
    teams: perTeam.map(summary),
    removed: removed.map(r => ({ ...r, teamName: teamName(ws, r.teamId), playerName: playerName(ws, r.playerId), substituteName: r.substitute ? playerName(ws, r.substitute) : null })),
    ops: errors.length ? [] : ops,
  };
}

function summary(p) {
  return { draftTeamId: p.team.id, name: p.team.name, pesTeamId: p.pesTeamId, players: p.roster.length, coachName: p.coachName ?? null, warnings: p.warnings, errors: p.errors };
}

/** Coach currently assigned to a game team ({ bin, edit } ids; null where the file is not loaded). */
export function coachOfTeam(ws, teamId) {
  return {
    bin: ws.bin?.tables.team?.has(teamId) ? ws.bin.tables.team.get(teamId, 'coach') : null,
    edit: ws.edit?.teams.has(teamId) ? ws.edit.coachOfTeam(teamId) : null,
  };
}

/** Current coach name of a game team, for display. */
export function coachNameOfTeam(ws, teamId) {
  const { bin, edit } = coachOfTeam(ws, teamId);
  if (edit != null && ws.edit.coaches.has(edit)) return ws.edit.readCoach(edit).name;
  if (bin != null && ws.bin.tables.coach?.has(bin)) return ws.bin.tables.coach.get(bin, 'name');
  return null;
}

/**
 * Renames the coach of `teamId`. Every game team has its own coach (verified: no coach is shared
 * in the PES 2021 database), so renaming it replaces the coach of that team only; a shared coach
 * is refused instead of silently renaming the other team's coach too.
 */
export function planCoach(ws, teamId, { name, country }) {
  const warnings = [], ops = [];
  const ids = coachOfTeam(ws, teamId);
  const sharedWith = id => (ws.bin?.tables.team ? ws.bin.tables.team.ids().filter(t => t !== teamId && ws.bin.tables.team.get(t, 'coach') === id) : [])
    .concat(ws.edit ? [...ws.edit.teams.keys()].filter(t => t !== teamId && ws.edit.coachOfTeam(t) === id) : []);
  const shared = [...new Set([ids.bin, ids.edit].filter(v => v != null).flatMap(sharedWith))];
  if (shared.length) {
    warnings.push(`el DT del equipo del juego también dirige a ${shared.map(t => teamName(ws, t)).join(', ')}: no se cambia el DT.`);
    return { ops, warnings };
  }
  const validCountry = Number.isInteger(country) && country > 0 && country < 512;
  const coachTable = ws.bin?.tables.coach;
  if (ids.bin != null && coachTable?.has(ids.bin)) {
    ops.push({ type: 'bin.coach.set', target: { coachId: ids.bin, teamId }, field: 'name', value: fitBytes(name, 44) });
    if (validCountry) ops.push({ type: 'bin.coach.set', target: { coachId: ids.bin, teamId }, field: 'country', value: country });
  } else if (ws.bin?.tables.team) {
    warnings.push(coachTable ? `el DT ${ids.bin} no está en Coach.bin.` : 'falta Coach.bin en la base: el DT no cambia en la base.');
  }
  if (ids.edit != null && ws.edit.coaches.has(ids.edit)) {
    ops.push({ type: 'edit.coach.set', target: { coachId: ids.edit, teamId }, field: 'name', value: fitBytes(name, 77) });
    if (validCountry) ops.push({ type: 'edit.coach.set', target: { coachId: ids.edit, teamId }, field: 'country', value: country });
  } else if (ws.edit) {
    warnings.push(`el DT ${ids.edit} no está en la lista de entrenadores del EDIT: no cambia en el EDIT.`);
  }
  return { ops, warnings };
}

function teamName(ws, id) {
  if (ws.bin?.tables.team?.has(id)) return ws.bin.tables.team.get(id, 'nameEnglish');
  if (ws.edit?.teams.has(id)) return ws.edit.readTeam(id).name;
  return `#${id}`;
}

function playerName(ws, id) {
  if (ws.bin?.tables.player?.has(id)) return ws.bin.tables.player.get(id, 'name');
  if (ws.edit?.players.has(id)) return ws.edit.readPlayer(id).name;
  return `#${id}`;
}
