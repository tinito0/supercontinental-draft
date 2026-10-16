// Team editor view model: what the team workspace shows and the operations its fields produce.
// Pure (no React): reads the working copy (Team.bin, EDIT, kit-server) and returns plain data or
// operation lists for pes.apply. Field rules (byte budgets, edited flags, permissions) stay in the
// engine; this module only gathers and shapes them.
import { NAME_FIELDS, fitBytes } from './draftTransfer.js';
import { EDIT_TEAM_FIELDS, from6bit, to6bit } from './formats/pes2021/editLayout.js';
import { kitPreviewModel } from './kits/kitConfig.js';
import { kitCategory } from './kits/kitWorkspace.js';

/** EDIT rival value meaning "no rival" (PES Editor Rebuilt NO_RIVAL; 1267 of 2112 rival slots in a real EDIT). */
export const NO_RIVAL = 262143;
/** The game shows 3-character abbreviations (Rebuilt and utils/pesExport.js use the same rule). */
export const ABBR_LENGTH = 3;

const EDIT_FIELD = new Map(EDIT_TEAM_FIELDS.map(f => [f.name, f]));
const HEX = /^#[0-9a-f]{6}$/i;

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const binTeams = ws => ws?.bin?.tables.team || null;
const hasEditTeam = (ws, id) => Boolean(ws?.edit?.teams.has(id));

/** Cleans an abbreviation the way the game shows it: letters and digits, upper case, 3 characters. */
export function cleanAbbreviation(text) {
  return String(text || '').normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').slice(0, ABBR_LENGTH).toUpperCase();
}

/** 6-bit EDIT channels → #rrggbb. */
export function editColourHex(team, n) {
  const ch = c => from6bit(team[`c${n}${c}`]).toString(16).padStart(2, '0');
  return `#${ch('r')}${ch('g')}${ch('b')}`;
}

/**
 * Owners of assignment rows named by the operations themselves (bin.assignment.remove carries teamId).
 * A row removed later in the same batch is gone from the live table, so its earlier edits are only
 * attributable through this map.
 */
function assignmentOwners(ops) {
  const owners = new Map();
  for (const op of ops) {
    const t = op?.target || {};
    if (t.assignmentId != null && t.teamId != null) owners.set(t.assignmentId, Number(t.teamId));
  }
  return owners;
}

/** Team id an operation belongs to, or null (player and coach edits are not team edits). */
export function teamIdOfOp(ws, op, owners = null) {
  const t = op?.target || {};
  if (t.teamId != null) return Number(t.teamId);
  if (t.assignmentId != null) {
    const table = ws?.bin?.tables.assignment;
    if (table?.has(t.assignmentId)) return table.get(t.assignmentId, 'teamId');
    return owners?.get(t.assignmentId) ?? null;
  }
  return null;
}

/** Indexes (into `drafts`) of the unsaved operations of one team, for discardDrafts(indexes). */
export function draftIndexesForTeam(ws, drafts, teamId) {
  const owners = assignmentOwners(drafts);
  const out = [];
  drafts.forEach((op, i) => { if (teamIdOfOp(ws, op, owners) === teamId) out.push(i); });
  return out;
}

/** teamId → number of unsaved operations. */
export function unsavedByTeam(ws, drafts) {
  const owners = assignmentOwners(drafts);
  const counts = new Map();
  for (const op of drafts) {
    const id = teamIdOfOp(ws, op, owners);
    if (id != null) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

/** Ids of teams changed from the sources (saved history that is not discarded, plus drafts). */
export function modifiedTeamIds(ws, savedOps, drafts) {
  const ops = [...savedOps.filter(o => o.state !== 'discarded'), ...drafts];
  const owners = assignmentOwners(ops);
  const ids = new Set();
  for (const op of ops) {
    const id = teamIdOfOp(ws, op, owners);
    if (id != null) ids.add(id);
  }
  return ids;
}

/** First player kit (p1 before p2…) of every kit-server team: teamId → {kit, cfg}. One pass over the configs. */
export function primaryKits(kits) {
  const out = new Map();
  if (!kits) return out;
  const teamOfFolder = new Map([...kits.map].map(([id, folder]) => [folder.toLowerCase(), id]));
  for (const path of kits.configs.keys()) {
    const m = path.match(/^(.*)\/([^/]+)\/config\.txt$/i);
    if (!m) continue;
    const teamId = teamOfFolder.get(m[1].toLowerCase());
    if (teamId == null || kitCategory(m[2]) !== 'player') continue;
    const prev = out.get(teamId);
    if (!prev || m[2].localeCompare(prev.kit, undefined, { numeric: true }) < 0) out.set(teamId, { kit: m[2], cfg: kits.configs.get(path) });
  }
  return out;
}

/**
 * Two team colours for badges and the header band. EDIT colours are the team's own; without an EDIT
 * entry the first player kit's shirt colours stand in. Null when neither exists.
 */
export function teamColours(ws, teamId, primary = null) {
  if (hasEditTeam(ws, teamId)) {
    const t = ws.edit.readTeam(teamId);
    return { c1: editColourHex(t, 1), c2: editColourHex(t, 2), source: 'edit' };
  }
  const kit = (primary || primaryKits(ws?.kits)).get(teamId);
  if (kit) {
    const m = kitPreviewModel(kit.cfg);
    if (HEX.test(m.shirtColor1 || '')) return { c1: m.shirtColor1, c2: HEX.test(m.shirtColor2 || '') ? m.shirtColor2 : m.shirtColor1, source: 'kit' };
  }
  return null;
}

/** Shirt colours of the team's first player kit, for «Usar colores del kit titular». */
export function primaryKitColours(ws, teamId) {
  const kit = primaryKits(ws?.kits).get(teamId);
  if (!kit) return null;
  const m = kitPreviewModel(kit.cfg);
  if (!HEX.test(m.shirtColor1 || '')) return null;
  return { kit: kit.kit, c1: m.shirtColor1, c2: HEX.test(m.shirtColor2 || '') ? m.shirtColor2 : m.shirtColor1 };
}

function playerCounts(ws) {
  const counts = new Map();
  const table = ws?.bin?.tables.assignment;
  if (table) for (const id of table.ids()) { const t = table.get(id, 'teamId'); counts.set(t, (counts.get(t) || 0) + 1); }
  return counts;
}

/**
 * Every team of the working copy (Team.bin, EDIT and kit-server ids), with what the list needs.
 * @returns {{ id: number, name: string, abbr: string, national: boolean, colours: object|null, players: number,
 *   inLeague: boolean, unsaved: number, modified: boolean, hasBin: boolean, hasEdit: boolean, hasKits: boolean }[]}
 */
export function listTeams(ws, { leagueTeamIds = [], drafts = [], savedOps = [] } = {}) {
  if (!ws) return [];
  const bin = binTeams(ws);
  const ids = new Set([...(bin ? bin.ids() : []), ...(ws.edit ? ws.edit.teams.keys() : []), ...(ws.kits ? ws.kits.teamIds() : [])]);
  const primary = primaryKits(ws.kits);
  const counts = playerCounts(ws);
  const unsaved = unsavedByTeam(ws, drafts);
  const modified = modifiedTeamIds(ws, savedOps, drafts);
  const league = new Set(leagueTeamIds);
  return [...ids].map(id => {
    const hasBin = Boolean(bin?.has(id));
    const edit = hasEditTeam(ws, id) ? ws.edit.readTeam(id) : null;
    const folder = ws.kits?.map.get(id);
    // EDIT first, like teamIdentity(): the list and the header must name the team the same way.
    const name = edit?.name || (hasBin && (bin.get(id, 'nameEnglish') || bin.get(id, 'nameDatabase'))) || folder?.split('/').pop() || '';
    const abbr = edit?.short || (hasBin && bin.get(id, 'shortNameLicensed')) || '';
    return {
      id, name, abbr,
      national: hasBin ? Boolean(bin.get(id, 'national')) : false,
      colours: teamColours(ws, id, primary),
      players: counts.get(id) ?? (edit ? ws.edit.roster(id).length : 0),
      inLeague: league.has(id),
      unsaved: unsaved.get(id) || 0,
      modified: modified.has(id),
      hasBin, hasEdit: Boolean(edit), hasKits: Boolean(folder),
    };
  });
}

/** Accent- and case-insensitive search over name and abbreviation, or an exact id. */
export function filterTeams(rows, query) {
  const q = fold(query).trim();
  if (!q) return rows;
  return rows.filter(r => String(r.id) === q || fold(r.name).includes(q) || fold(r.abbr).includes(q));
}

export const TEAM_SORTS = {
  name: (a, b) => (a.name || '￿').localeCompare(b.name || '￿', 'es'),
  id: (a, b) => a.id - b.id,
};

/** Current display name and abbreviation of a team (EDIT first: it is what the game uses when present). */
export function teamIdentity(ws, teamId) {
  const bin = binTeams(ws);
  const hasBin = Boolean(bin?.has(teamId));
  const edit = hasEditTeam(ws, teamId) ? ws.edit.readTeam(teamId) : null;
  return {
    name: edit?.name || (hasBin ? bin.get(teamId, 'nameEnglish') || bin.get(teamId, 'nameDatabase') : '') || '',
    abbr: edit?.short || (hasBin ? bin.get(teamId, 'shortNameLicensed') : '') || '',
    country: edit ? edit.country : hasBin ? bin.get(teamId, 'country') : null,
    national: hasBin ? Boolean(bin.get(teamId, 'national')) : false,
    stadiumId: edit ? edit.stadium_id : hasBin ? bin.get(teamId, 'stadium') : null,
    stadiumName: edit?.stadium_name || '',
    hasBin, hasEdit: Boolean(edit),
  };
}

/** Largest name the EDIT and the English Team.bin name accept, in UTF-8 bytes. */
export function nameByteLimit(ws, teamId) {
  const limits = [];
  if (binTeams(ws)?.has(teamId)) limits.push(binTeams(ws).field('nameEnglish').length - 1);
  if (hasEditTeam(ws, teamId)) limits.push(EDIT_FIELD.get('name').length - 1);
  return limits.length ? Math.min(...limits) : 0;
}

/**
 * Renames a team everywhere the game reads it: every Team.bin name field (each cut to its own byte
 * budget, so the 23-byte database name may be shorter) and the EDIT name. Only changed fields.
 */
export function nameOps(ws, teamId, name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('El nombre no puede quedar vacío.');
  const ops = [];
  const bin = binTeams(ws);
  if (bin?.has(teamId)) {
    for (const f of NAME_FIELDS) {
      const value = fitBytes(clean, bin.field(f).length - 1);
      if (bin.get(teamId, f) !== value) ops.push({ type: 'bin.team.set', target: { teamId }, field: f, value });
    }
  }
  if (hasEditTeam(ws, teamId)) {
    const value = fitBytes(clean, EDIT_FIELD.get('name').length - 1);
    if (ws.edit.readTeam(teamId).name !== value) ops.push({ type: 'edit.team.set', target: { teamId }, field: 'name', value });
  }
  return ops;
}

/** Abbreviation in Team.bin (licensed and fake) and in the EDIT, cleaned to 3 letters/digits. */
export function abbreviationOps(ws, teamId, abbr) {
  const clean = cleanAbbreviation(abbr);
  if (!clean) throw new Error('La abreviatura necesita al menos una letra o número.');
  const ops = [];
  const bin = binTeams(ws);
  if (bin?.has(teamId)) {
    for (const f of ['shortNameLicensed', 'shortNameFake']) {
      if (bin.get(teamId, f) !== clean) ops.push({ type: 'bin.team.set', target: { teamId }, field: f, value: clean });
    }
  }
  if (hasEditTeam(ws, teamId) && ws.edit.readTeam(teamId).short !== clean) {
    ops.push({ type: 'edit.team.set', target: { teamId }, field: 'short', value: clean });
  }
  return ops;
}

/** EDIT colour channels that change when colour `n` (1 or 2) becomes `hex`. */
export function colourOps(ws, teamId, n, hex) {
  if (!HEX.test(hex || '')) throw new Error(`Color inválido: ${hex}.`);
  if (!hasEditTeam(ws, teamId)) return [];
  const t = ws.edit.readTeam(teamId);
  return ['r', 'g', 'b']
    .map((c, i) => [`c${n}${c}`, to6bit(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16))])
    .filter(([field, value]) => t[field] !== value)
    .map(([field, value]) => ({ type: 'edit.team.set', target: { teamId }, field, value }));
}

/** A numeric value both files hold under their own field names (country, stadium). Only changed fields. */
export function sharedFieldOps(ws, teamId, { bin: binField, edit: editField }, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Valor inválido: ${raw}.`);
  const ops = [];
  if (binTeams(ws)?.has(teamId) && binTeams(ws).get(teamId, binField) !== value) ops.push({ type: 'bin.team.set', target: { teamId }, field: binField, value });
  if (hasEditTeam(ws, teamId) && ws.edit.readTeam(teamId)[editField] !== value) ops.push({ type: 'edit.team.set', target: { teamId }, field: editField, value });
  return ops;
}

/** Country in Team.bin and the EDIT (both hold it). */
export const countryOps = (ws, teamId, country) => sharedFieldOps(ws, teamId, { bin: 'country', edit: 'country' }, country);
/** Stadium id in Team.bin and the EDIT (the EDIT raises e_stadium itself). */
export const stadiumOps = (ws, teamId, stadium) => sharedFieldOps(ws, teamId, { bin: 'stadium', edit: 'stadium_id' }, stadium);

/**
 * Who may edit what for one team. Mirrors pes/permissions.js authorize(): the Super Admin edits all;
 * a Kit Manager only kits and EDIT colours, and only of league teams when a league is set.
 */
export function teamAccess(caps, leagueTeamIds, teamId) {
  const league = leagueTeamIds || [];
  const kitManagerOnly = caps.has('kit.edit') && !caps.has('team.edit');
  const inLeague = !league.length || league.includes(teamId) || caps.has('workspace.manage');
  const kits = caps.has('kit.edit') && (!kitManagerOnly || inLeague);
  return { data: caps.has('team.edit'), colours: caps.has('team.edit') || kits, kits, outOfLeague: kitManagerOnly && !inLeague };
}
