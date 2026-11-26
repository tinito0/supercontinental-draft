// Club and league of each market player, from the league's PES database (Team.bin, PlayerAssignment.bin,
// Competition.bin, CompetitionEntry.bin). scripts/build-player-clubs.mjs writes public/clubes.json; the app adds
// `Club` and `Liga` to each player when it loads the catalog, and the marketplace filters on them.

export const CLUBS_URL = '/clubes.json';
export const CLUBS_FILE_VERSION = 1;
/** Clubs of the database that play in no league of the game (rest of Europe, Asia, Master League defaults…). */
export const OTHER_CLUBS_LEAGUE = 'Otros clubes';
/** Players assigned to no club: free agents, or only called up by a national team. */
export const NO_CLUB_LEAGUE = 'Sin club';

const COUNTRY_NAMES = {
  ENGLAND: 'Inglaterra', ITALY: 'Italia', SPAIN: 'España', GERMANY: 'Alemania', NETHERLANDS: 'Países Bajos',
  PORTUGAL: 'Portugal', BRAZIL: 'Brasil', ARGENTINA: 'Argentina', CHILE: 'Chile', POLAND: 'Polonia',
  USA: 'Estados Unidos', JAPAN: 'Japón', BELGIUM: 'Bélgica', FRANCE: 'Francia', GREECE: 'Grecia',
  'TÜRKIYE': 'Turquía', COLOMBIA: 'Colombia', SAUDI: 'Arabia Saudita', DENMARK: 'Dinamarca', SCOTLAND: 'Escocia',
  SOUTH_KOREA: 'Corea del Sur',
};
const DIVISION_NAMES = { 1: 'Primera', 2: 'Segunda' };

/**
 * The name shown for a league code of Competition.bin: «ENGLAND_D1_LEAGUE» → «Inglaterra · Primera». Null for a
 * code that is not a domestic league (cups, continental and national-team competitions).
 */
export function leagueLabel(code) {
  if (code === 'KONAMI_LEAGUE') return 'Liga Konami';
  const match = /^(.+)_D(\d)_LEAGUE$/.exec(String(code || ''));
  if (!match) return null;
  const country = COUNTRY_NAMES[match[1]] || match[1].replace(/_/g, ' ').toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
  return `${country} · ${DIVISION_NAMES[match[2]] || `División ${match[2]}`}`;
}

/**
 * public/clubes.json → index by player id. Returns null for a file it does not understand, so the market works
 * without club filters instead of failing.
 * @param {{ version: number, clubs: [string, string, number[]][] }} file
 * @returns {{ byPlayer: Map<string, { club: string, league: string }>, leagues: string[], clubs: { name: string, league: string }[] } | null}
 */
export function parseClubsFile(file) {
  if (!file || file.version !== CLUBS_FILE_VERSION || !Array.isArray(file.clubs)) return null;
  const byPlayer = new Map();
  const clubs = [];
  const leagues = new Set();
  for (const row of file.clubs) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || !Array.isArray(row[2])) continue;
    const [name, rawLeague, playerIds] = row;
    const league = typeof rawLeague === 'string' && rawLeague ? rawLeague : OTHER_CLUBS_LEAGUE;
    clubs.push({ name, league });
    leagues.add(league);
    for (const id of playerIds) byPlayer.set(String(id), { club: name, league });
  }
  const byName = (a, b) => a.localeCompare(b, 'es');
  // Real leagues first, then «Otros clubes» and «Sin club».
  const sortedLeagues = [...leagues].filter(l => l !== OTHER_CLUBS_LEAGUE).sort(byName);
  if (leagues.has(OTHER_CLUBS_LEAGUE)) sortedLeagues.push(OTHER_CLUBS_LEAGUE);
  sortedLeagues.push(NO_CLUB_LEAGUE);
  return { byPlayer, leagues: sortedLeagues, clubs: clubs.sort((a, b) => byName(a.name, b.name)) };
}

/** Copies of the players with `Club` ('' without one) and `Liga`. Without an index the players come back as they are. */
export function withClubs(players, index) {
  if (!index) return players;
  return players.map(player => {
    const entry = index.byPlayer.get(String(player.Id));
    return { ...player, Club: entry?.club || '', Liga: entry?.league || NO_CLUB_LEAGUE };
  });
}

/** Downloads and parses public/clubes.json; null when it is missing or broken (the market then has no club filters). */
export async function fetchPlayerClubs(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(CLUBS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseClubsFile(await response.json());
  } catch (error) {
    console.warn('No se pudo cargar clubes.json: el mercado sigue sin filtro por club ni liga.', error);
    return null;
  }
}
