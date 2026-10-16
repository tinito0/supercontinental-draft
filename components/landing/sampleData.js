// Sample data for the public landing. Copied from public/jugadores.json (Id, OVR_CALCULADO, POS_NOMBRE,
// Precio): the landing is public and must not load the 27k-player file. tests/landingSampleData.test.js
// fails when these drift from the market data or from the files utils/pesExport.js writes.

export const MARKET_PLAYER_COUNT_LABEL = 'Más de 27.000';

// `short` is the name drawn on the pitch.
export const SAMPLE_PLAYERS = {
  mbappe:     { id: 110718, card: 'K. MBAPPÉ',        short: 'Mbappé',     ovr: 91, pos: 'DC',  price: 94.99 },
  haaland:    { id: 133543, card: 'E. HAALAND',       short: 'Haaland',    ovr: 90, pos: 'DC',  price: 86.79 },
  kane:       { id: 47287,  card: 'H. KANE',          short: 'Kane',       ovr: 90, pos: 'DC',  price: 80.11 },
  courtois:   { id: 44383,  card: 'T. COURTOIS',      short: 'Courtois',   ovr: 89, pos: 'PT',  price: 57.31 },
  vinicius:   { id: 117047, card: 'VINÍCIUS JR.',     short: 'Vinícius',   ovr: 88, pos: 'EI',  price: 71.33 },
  rodri:      { id: 110815, card: 'RODRI',            short: 'Rodri',      ovr: 87, pos: 'MCD', price: 58.17 },
  bellingham: { id: 132933, card: 'J. BELLINGHAM',    short: 'Bellingham', ovr: 87, pos: 'MO',  price: 54.88 },
  salah:      { id: 57123,  card: 'M. SALAH',         short: 'Salah',      ovr: 87, pos: 'ED',  price: 60.07 },
  vanDijk:    { id: 44840,  card: 'V. VAN DIJK',      short: 'Van Dijk',   ovr: 87, pos: 'DFC', price: 49.73 },
  saliba:     { id: 126689, card: 'W. SALIBA',        short: 'Saliba',     ovr: 87, pos: 'DFC', price: 52.77 },
  messi:      { id: 7511,   card: 'L. MESSI',         short: 'Messi',      ovr: 87, pos: 'DC',  price: 54.62 },
  lautaro:    { id: 108657, card: 'LAUTARO MARTÍNEZ', short: 'Lautaro',    ovr: 86, pos: 'DC',  price: 55.82 },
  deBruyne:   { id: 44379,  card: 'K. DE BRUYNE',     short: 'De Bruyne',  ovr: 85, pos: 'MO',  price: 44.97 },
  rudiger:    { id: 104677, card: 'A. RÜDIGER',       short: 'Rüdiger',    ovr: 82, pos: 'DFC', price: 30.22 },
  hakimi:     { id: 113960, card: 'A. HAKIMI',        short: 'Hakimi',     ovr: 87, pos: 'LD',  price: 50.28 },
  davies:     { id: 129961, card: 'A. DAVIES',        short: 'Davies',     ovr: 83, pos: 'LI',  price: 34.16 },
};

const pick = keys => keys.map(key => ({ key, ...SAMPLE_PLAYERS[key] }));

export const SHOWCASE_PLAYERS = pick([
  'mbappe', 'haaland', 'kane', 'courtois', 'vinicius', 'rodri',
  'bellingham', 'salah', 'vanDijk', 'messi', 'lautaro', 'deBruyne',
]);

export const MARKET_SAMPLE = pick(['mbappe', 'rodri', 'courtois', 'haaland', 'bellingham', 'vanDijk']);

/* The market demo starts with Mbappé already signed out of this example budget. */
export const DEMO_TOTAL_BUDGET = 200;
export const DEMO_SIGNED_AT_START = [SAMPLE_PLAYERS.mbappe.id];

export const MARKET_FILTERS = [
  { id: 'ALL', label: 'Todos', positions: null },
  { id: 'FW', label: 'Delanteros', positions: ['DC', 'EI', 'ED'] },
  { id: 'MF', label: 'Medios', positions: ['MCD', 'MC', 'MO'] },
  { id: 'DF', label: 'Defensas', positions: ['DFC', 'LI', 'LD'] },
  { id: 'GK', label: 'Arqueros', positions: ['PT'] },
];

/*
 * Starting XI per formation, in the slot order of FORMATIONS[key].layout (utils/constants.js), drawn with the
 * read-only Pitch of the public tactics view.
 */
export const DEMO_LINEUPS = {
  '4-3-3': {
    lineup: ['courtois', 'hakimi', 'rudiger', 'vanDijk', 'davies', 'rodri', 'bellingham', 'deBruyne', 'salah', 'haaland', 'vinicius'],
    tactics: {
      attackStyle: 'Posesión',
      buildup: 'Pase corto',
      attackArea: 'Por el centro',
      defLine: '8 / 10',
      pressure: 'Agresiva en campo rival',
      corners: 'K. De Bruyne',
      freekicks: 'M. Salah',
      penalties: 'E. Haaland',
    },
  },
  '4-2-3-1': {
    lineup: ['courtois', 'hakimi', 'rudiger', 'vanDijk', 'davies', 'rodri', 'deBruyne', 'salah', 'bellingham', 'vinicius', 'mbappe'],
    tactics: {
      attackStyle: 'Contraataque',
      buildup: 'Pase largo',
      attackArea: 'Por bandas',
      defLine: '6 / 10',
      pressure: 'Bloque medio',
      corners: 'M. Salah',
      freekicks: 'K. De Bruyne',
      penalties: 'K. Mbappé',
    },
  },
  '3-5-2': {
    lineup: ['courtois', 'saliba', 'vanDijk', 'rudiger', 'rodri', 'hakimi', 'bellingham', 'deBruyne', 'davies', 'haaland', 'mbappe'],
    tactics: {
      attackStyle: 'Contraataque',
      buildup: 'Directo',
      attackArea: 'Mixta',
      defLine: '5 / 10',
      pressure: 'Intensa tras pérdida',
      corners: 'K. De Bruyne',
      freekicks: 'J. Bellingham',
      penalties: 'E. Haaland',
    },
  },
};

/* Files written by utils/pesExport.js, in the order it adds them to the ZIP. */
export const EXPORT_FILES = [
  { name: 'Roster.csv', desc: 'Titulares, suplentes y dorsales del plantel.' },
  { name: 'Players.csv', desc: 'Atributos y posiciones de cada jugador.' },
  { name: 'Appearances.csv', desc: 'Datos de apariencia de cada jugador.' },
  { name: 'Team.csv', desc: 'Nombre y nacionalidad del equipo.' },
  { name: 'Coach.csv', desc: 'Nombre y nacionalidad del DT.' },
  { name: 'Formation.csv', desc: 'Posiciones de los titulares, lanzadores y táctica.' },
];
