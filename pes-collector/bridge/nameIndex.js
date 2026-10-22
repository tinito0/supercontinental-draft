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

/**
 * @param {{ teamBin?: Uint8Array, playerBin?: Uint8Array, editBytes?: Uint8Array }} files any of them may be missing
 * @returns {{ teams: Map<number, string>, players: Map<number, string> }}
 */
export function buildNameIndex({ teamBin, playerBin, editBytes }) {
  const binFiles = {};
  if (teamBin) binFiles['Team.bin'] = teamBin;
  if (playerBin) binFiles['Player.bin'] = playerBin;
  const db = Object.keys(binFiles).length ? loadBinDatabase(binFiles) : { tables: {} };
  const teams = tableNames(db.tables.team, 'nameEnglish');
  const players = tableNames(db.tables.player, 'name');
  if (editBytes) {
    const edit = loadEditDatabase(editBytes);
    for (const [id, name] of editNames(edit, [...teams.keys()], (e, teamId) => e.readTeam(teamId))) teams.set(id, name);
    for (const [id, name] of editNames(edit, edit.players ? [...edit.players.keys()] : [], (e, playerId) => e.readPlayer(playerId))) {
      players.set(id, name);
    }
  }
  return { teams, players };
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
  return ids;
}

/**
 * Returns a copy of the summary with `names`: the game's team names and the names of every player in the match.
 * Unknown ids are left out (the page shows the id). Without an index the summary is returned unchanged.
 */
export function attachNames(summary, index) {
  if (!summary || !index) return summary;
  const players = {};
  for (const id of [...idsInSummary(summary)].sort((a, b) => a - b)) {
    const name = index.players.get(id);
    if (name) players[id] = name;
  }
  const team = id => index.teams.get(id) ?? null;
  return {
    ...summary,
    names: { teams: { home: team(summary.match?.homeTeamId), away: team(summary.match?.awayTeamId) }, players },
  };
}
