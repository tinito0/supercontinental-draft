// Writes public/clubes.json (club and league of each player, utils/playerClubs.js) from the league's PES database.
// The game files are not in git (vendor/), so the generated file is committed: run this again after changing the
// database, like scripts/build-market-catalog.mjs.
//
//   node scripts/build-player-clubs.mjs [pesdb folder]   (default vendor/UML_Database/common/etc/pesdb)
//
// Formats, read only:
// - Team.bin and PlayerAssignment.bin through the PES engine (pes/formats/pes2021/binDatabase.js).
// - Competition.bin: 36-byte rows; byte 5 = competition id, bytes 8–35 = internal name (UTF-8, NUL padded).
// - CompetitionEntry.bin: 12-byte rows; uint32 LE team id, uint32 LE row id, uint32 LE whose low byte is the
//   competition id. Checked on the league database (2026-11-26): every row's team id exists in Team.bin, and Arsenal
//   (101) enters ENGLAND_D1_LEAGUE, ENGLAND_D1_CUP and UEFA_CHAMPIONS_LEAGUE. Inferred, not from a tool's source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeWesys } from '../pes/core/wesys.js';
import { loadBinDatabase } from '../pes/formats/pes2021/binDatabase.js';
import { CLUBS_FILE_VERSION, leagueLabel } from '../utils/playerClubs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pesdb = path.resolve(process.argv[2] || path.join(root, 'vendor', 'UML_Database', 'common', 'etc', 'pesdb'));
const target = path.join(root, 'public', 'clubes.json');
const COMPETITION_ROW = 36;
const ENTRY_ROW = 12;

function readFile(name) {
  const file = path.join(pesdb, name);
  if (!fs.existsSync(file)) {
    console.error(`[clubes] Falta ${file}. Pasá la carpeta pesdb como argumento.`);
    process.exit(1);
  }
  return new Uint8Array(fs.readFileSync(file));
}

function readCompetitions(payload) {
  const names = new Map();
  for (let offset = 0; offset + COMPETITION_ROW <= payload.length; offset += COMPETITION_ROW) {
    const nameBytes = payload.subarray(offset + 8, offset + COMPETITION_ROW);
    const end = nameBytes.indexOf(0);
    names.set(payload[offset + 5], Buffer.from(end === -1 ? nameBytes : nameBytes.subarray(0, end)).toString('utf8'));
  }
  return names;
}

/** Team id → league name, from the domestic league each team enters. */
function readTeamLeagues(entryPayload, competitions) {
  const view = new DataView(entryPayload.buffer, entryPayload.byteOffset, entryPayload.byteLength);
  const leagues = new Map();
  for (let offset = 0; offset + ENTRY_ROW <= entryPayload.length; offset += ENTRY_ROW) {
    const teamId = view.getUint32(offset, true);
    const label = leagueLabel(competitions.get(view.getUint32(offset + 8, true) & 0xff));
    if (!label) continue;
    if (leagues.has(teamId) && leagues.get(teamId) !== label) console.warn(`[clubes] El equipo ${teamId} está en dos ligas; queda ${leagues.get(teamId)}.`);
    else leagues.set(teamId, label);
  }
  return leagues;
}

const db = loadBinDatabase({ 'Team.bin': readFile('Team.bin'), 'PlayerAssignment.bin': readFile('PlayerAssignment.bin') });
const competitions = readCompetitions(decodeWesys(readFile('Competition.bin'), 'Competition.bin').payload);
const teamLeagues = readTeamLeagues(decodeWesys(readFile('CompetitionEntry.bin'), 'CompetitionEntry.bin').payload, competitions);
const teams = db.tables.team;
const assignments = db.tables.assignment;

const playersByClub = new Map();
for (const id of assignments.ids()) {
  const teamId = assignments.get(id, 'teamId');
  if (!teams.has(teamId) || teams.get(teamId, 'national')) continue;
  if (!playersByClub.has(teamId)) playersByClub.set(teamId, new Set());
  playersByClub.get(teamId).add(assignments.get(id, 'playerId'));
}

const rows = [...playersByClub.entries()]
  .map(([teamId, players]) => [String(teams.get(teamId, 'nameEnglish') || `Club ${teamId}`).trim(), teamLeagues.get(teamId) || '', [...players].sort((a, b) => a - b), teamId]);
// The club filter matches by name, so a name two clubs share gets its league (or team id) added.
const nameCount = new Map();
rows.forEach(([name]) => nameCount.set(name, (nameCount.get(name) || 0) + 1));
const clubs = rows
  .map(([name, league, players, teamId]) => [nameCount.get(name) > 1 ? `${name} (${league || teamId})` : name, league, players])
  .sort((a, b) => a[0].localeCompare(b[0], 'es'));

fs.writeFileSync(target, `${JSON.stringify({ version: CLUBS_FILE_VERSION, clubs })}\n`);
const playerCount = clubs.reduce((sum, row) => sum + row[2].length, 0);
const leagueCount = new Set(clubs.map(row => row[1]).filter(Boolean)).size;
console.log(`[clubes] ${clubs.length} clubes, ${leagueCount} ligas, ${playerCount} jugadores → ${path.relative(root, target)} (${(fs.statSync(target).size / 1e3).toFixed(0)} kB)`);
