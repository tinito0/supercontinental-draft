// Pre-export check for the admin (Admin → Plantillas): per team, what would be left out, guessed or refused
// when exporting to PES (EJOGC CSVs or Draft → PES). Same team data as both exporters
// (services/draftTeamsService.js) and the same limits as pes/draftTransfer.js. Pure.

const MAX_PLAYERS = 40; // the game's squad size (pes/draftTransfer.js, utils/pesExport.js)
const STARTERS = 11;

/**
 * @param {object} team a team from loadDraftTeams()
 * @returns {{ id: string, name: string, errors: string[], warnings: string[] }}
 */
export function draftTeamReport(team) {
  const errors = [];
  const warnings = [...(team.squadWarnings || [])];
  const players = team.players || [];
  const ids = new Set(players.map(player => String(player.Id)));

  if (players.length === 0) errors.push('No tiene jugadores.');
  if (players.length > MAX_PLAYERS) errors.push(`Tiene ${players.length} jugadores; el juego admite ${MAX_PLAYERS}.`);

  const lineupIds = Object.values(team.lineup || {}).map(String).filter(Boolean);
  const notOwned = lineupIds.filter(id => !ids.has(id));
  const starters = lineupIds.filter(id => ids.has(id)).length;
  if (notOwned.length) warnings.push(`${notOwned.length} titular(es) de la formación ya no son del equipo: esos puestos quedan vacíos.`);
  if (players.length >= STARTERS && starters < STARTERS) warnings.push(`Alineación incompleta: ${starters} de ${STARTERS} titulares.`);

  const captain = team.setPieces?.captain;
  if (!captain || !ids.has(String(captain))) warnings.push('Sin capitán elegido: se usa al primer titular de campo.');

  const numbers = new Map();
  for (const player of players) {
    const number = team.dorsals?.[player.Id];
    if (!number) continue;
    numbers.set(number, [...(numbers.get(number) || []), player.Name || player.Id]);
  }
  for (const [number, names] of numbers) {
    if (names.length > 1) warnings.push(`Dorsal ${number} repetido: ${names.join(', ')}.`);
  }
  const withoutNumber = players.filter(player => !team.dorsals?.[player.Id]).length;
  if (withoutNumber) warnings.push(`${withoutNumber} jugador(es) sin dorsal.`);

  return { id: team.id, name: team.name, errors, warnings };
}

/** Reports for every team, with problems first (errors, then warnings), then by name. */
export function draftExportReport(teams) {
  const weight = report => (report.errors.length ? 0 : report.warnings.length ? 1 : 2);
  return (teams || []).map(draftTeamReport).sort((a, b) => weight(a) - weight(b) || a.name.localeCompare(b.name));
}
