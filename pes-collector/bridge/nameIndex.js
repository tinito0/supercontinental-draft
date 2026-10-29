// Names for the match summaries: the probe only sees ids, so the bridge looks them up in the PES database the league
// plays with (patch Team.bin / Player.bin) and the save (EDIT00000000, whose team names are the ones shown in game),
// and adds them to each summary before saving and uploading. Read-only: the files are never written.
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';

const clean = value => (typeof value === 'string' ? value.replace(/\0/g, '').trim() : '');

function tableNames(table, field) {
  const names = new Map();
  if (!table) return names;
  for (const id of table.ids()) {
    const name = clean(table.get(id, field));
    if (name) names.set(id, name);
  }
  return names;
}

/** Edited names in the save win over the database (the game shows those). */
function editNames(edit, ids, read) {
  const names = new Map();
  for (const id of ids) {
    try {
      const name = clean(read(edit, id)?.name);
      if (name) names.set(id, name);
    } catch {
      // Not in the save: the database name stays.
    }
  }
  return names;
}

// Registered position (0 GK … 12 CF, utils/formationStates.js PES_POSITION_MAP order): a player attribute, not the
// position played in a match.
function tablePositions(table) {
  const positions = new Map();
  if (!table) return positions;
  for (const id of table.ids()) {
    const position = table.get(id, 'registeredPosition');
    if (Number.isInteger(position) && position >= 0 && position <= 12) positions.set(id, position);
  }
  return positions;
}

function editPositions(edit) {
  const positions = new Map();
  for (const id of edit.players ? edit.players.keys() : []) {
    try {
      const position = edit.readPlayer(id).reg_pos;
      if (Number.isInteger(position) && position >= 0 && position <= 12) positions.set(id, position);
    } catch {
      // Unreadable record: the database position stays.
    }
  }
  return positions;
}

/**
 * @param {{ teamBin?: Uint8Array, playerBin?: Uint8Array, editBytes?: Uint8Array }} files any of them may be missing
 * @returns {{ teams: Map<number, string>, players: Map<number, string>, positions: Map<number, number>,
 *   edit: object|null }} `edit` is the decoded save, kept for the team plans (teamPlans.js)
 */
export function buildNameIndex({ teamBin, playerBin, editBytes }) {
  const binFiles = {};
  if (teamBin) binFiles['Team.bin'] = teamBin;
  if (playerBin) binFiles['Player.bin'] = playerBin;
  const db = Object.keys(binFiles).length ? loadBinDatabase(binFiles) : { tables: {} };
  const teams = tableNames(db.tables.team, 'nameEnglish');
  const players = tableNames(db.tables.player, 'name');
  const positions = tablePositions(db.tables.player);
  let edit = null;
  if (editBytes) {
    edit = loadEditDatabase(editBytes);
    for (const [id, name] of editNames(edit, [...teams.keys()], (e, teamId) => e.readTeam(teamId))) teams.set(id, name);
    for (const [id, name] of editNames(edit, edit.players ? [...edit.players.keys()] : [], (e, playerId) => e.readPlayer(playerId))) {
      players.set(id, name);
    }
    for (const [id, position] of editPositions(edit)) positions.set(id, position);
  }
  return { teams, players, positions, edit };
}

function idsInSummary(summary) {
  const ids = new Set();
  const add = id => { if (Number.isInteger(id)) ids.add(id); };
  for (const side of ['home', 'away']) {
    for (const id of summary.lineups?.[side]?.starting || []) add(id);
    for (const id of summary.lineups?.[side]?.final || []) add(id);
    for (const player of summary.players?.[side] || []) add(player.id);
  }
  for (const goal of summary.goals || []) { add(goal.playerId); add(goal.assistPlayerId); }
  for (const sub of summary.substitutions || []) { add(sub.offId); add(sub.onId); }
  for (const card of summary.cards || []) add(card.playerId);
  for (const shot of summary.shots || []) add(shot.playerId);
  for (const side of ['home', 'away']) {
    for (const state of summary.formations?.[side] || []) for (const id of state.ids || []) add(id);
  }
  return ids;
}

/**
 * Returns a copy of the summary with `names`: the game's team names, the names of every player in the match and
 * their registered positions. Unknown ids are left out (the page shows the id). Without an index the summary is
 * returned unchanged.
 */
export function attachNames(summary, index) {
  if (!summary || !index) return summary;
  const players = {};
  const positions = {};
  for (const id of [...idsInSummary(summary)].sort((a, b) => a - b)) {
    const name = index.players.get(id);
    if (name) players[id] = name;
    const position = index.positions?.get(id);
    if (position != null) positions[id] = position;
  }
  const team = id => index.teams.get(id) ?? null;
  return {
    ...summary,
    names: { teams: { home: team(summary.match?.homeTeamId), away: team(summary.match?.awayTeamId) }, players, positions },
  };
}
