// Maps Player.bin fields (pes/formats/pes2021/binLayout.js, camelCase EJOGC names) to the app's football
// vocabulary: Spanish stat names (STAT_NAMES_MAP uses the EJOGC CSV column names, PascalCase), the
// position map of PlayerModal and the stat groups of the player card.
import { STAT_NAMES_MAP, STATS_JUGADOR_CAMPO, STATS_PORTERO, MAPEO_POS_ID, PLAYING_STYLE_BY_ID, PLAYER_SKILLS_MAP } from '../../../utils/constants.js';

/** offensiveAwareness → OffensiveAwareness, gkReach → GKReach (CSV column names). */
export function csvName(field) {
  if (field.startsWith('gk')) return `GK${field.slice(2)}`;
  return field[0].toUpperCase() + field.slice(1);
}

/** CSV column name → Player.bin field name (inverse of csvName). */
export function binName(csv) {
  if (csv.startsWith('GK')) return `gk${csv.slice(2)}`;
  return csv[0].toLowerCase() + csv.slice(1);
}

export const statLabel = field => STAT_NAMES_MAP[csvName(field)] || field;

/** Player.bin position aptitude fields, with the app's Spanish position and its place on the pitch grid. */
export const POSITION_FIELDS = [
  { field: 'posCF', pos: 'DC', col: 2, row: 1 },
  { field: 'posLWF', pos: 'EI', col: 1, row: 2 },
  { field: 'posSS', pos: 'SD', col: 2, row: 2 },
  { field: 'posRWF', pos: 'ED', col: 3, row: 2 },
  { field: 'posAMF', pos: 'MO', col: 2, row: 3 },
  { field: 'posLMF', pos: 'MI', col: 1, row: 4 },
  { field: 'posCMF', pos: 'MC', col: 2, row: 4 },
  { field: 'posRMF', pos: 'MD', col: 3, row: 4 },
  { field: 'posDMF', pos: 'MCD', col: 2, row: 5 },
  { field: 'posLB', pos: 'LI', col: 1, row: 6 },
  { field: 'posCB', pos: 'DFC', col: 2, row: 6 },
  { field: 'posRB', pos: 'LD', col: 3, row: 6 },
  { field: 'posGK', pos: 'PT', col: 2, row: 7 },
];

/** Aptitude in Player.bin: 0 = C, 1 = B, 2 = A. The registered position is always A. */
export const APTITUDE_LABEL = ['C', 'B', 'A'];

/** registeredPosition index (0 GK … 12 CF) → Spanish label, same order as MAPEO_POS_ID. */
export const positionName = index => MAPEO_POS_ID[index] ?? `#${index}`;
export const POSITION_OPTIONS = Object.entries(MAPEO_POS_ID).map(([id, label]) => ({ id: Number(id), label }));
export const PLAYING_STYLE_OPTIONS = Object.entries(PLAYING_STYLE_BY_ID).map(([id, label]) => ({ id: Number(id), label }));

/** Fields of pes/formats/pes2021/playerExtraLayout.js shown in their own sections instead of «Otros datos». */
export const TRAIT_GROUPS = ['skill', 'comStyle', 'motion'];
export const fieldsInGroup = (fields, group) => fields.filter(f => f.group === group);

/** Skill and COM style names as the game shows them (PLAYER_SKILLS_MAP is keyed by the CSV column). */
export const traitLabel = field => PLAYER_SKILLS_MAP[field.csv] || field.name;

export const MOTION_LABELS = {
  celebration: 'Festejo', dribblingHunching: 'Gambeta: inclinación', dribblingArmMovement: 'Gambeta: brazos',
  runningHunching: 'Carrera: inclinación', runningArmMovement: 'Carrera: brazos', dribbleMotion: 'Forma de gambetear',
  cornerKicks: 'Córners', freeKicks: 'Tiros libres', penaltyKick: 'Penales',
};

/**
 * Stat groups of the player card, limited to the fields present in Player.bin.
 * @param {object[]} fields table.fields
 * @param {boolean} goalkeeper registered position is GK
 */
export function statGroups(fields, goalkeeper) {
  const byName = new Map(fields.map(f => [f.name, f]));
  const source = goalkeeper ? STATS_PORTERO : STATS_JUGADOR_CAMPO;
  return Object.entries(source)
    .map(([title, keys]) => [title, keys.map(k => byName.get(binName(k))).filter(Boolean)])
    .filter(([, list]) => list.length);
}

/** Fields shown in the identity form, in this order. */
export const IDENTITY_FIELDS = ['name', 'shirt', 'shirtNational', 'japName', 'country', 'country2', 'age', 'height', 'weight', 'strongFootLeft', 'registeredPosition', 'playingStyle'];

/** Field labels in Spanish for the identity and "other" sections. */
export const FIELD_LABELS = {
  name: 'Nombre', shirt: 'Nombre en la camiseta', shirtNational: 'Camiseta de selección', japName: 'Nombre japonés',
  country: 'Nacionalidad', country2: 'Segunda nacionalidad', age: 'Edad', height: 'Altura (cm)', weight: 'Peso (kg)',
  strongFootLeft: 'Pie hábil', registeredPosition: 'Posición registrada', playingStyle: 'Estilo de juego',
  form: 'Forma', injuryResistance: 'Resistencia a lesiones', reputation: 'Reputación', playingAttitude: 'Actitud',
  nationalCaps: 'Partidos con la selección', legend: 'Leyenda', leftHanded: 'Mano izquierda', goldenBallWinner: 'Ganó el Balón de Oro',
};

/** Colour class of a stat (same scale as PlayerModal; weak-foot values use their 1–4 scale). */
export function statTone(field, value, statColor) {
  if (field === 'weakFootAcc' || field === 'weakFootUsage') {
    const v = Number(value);
    return v >= 4 ? 'stat-c-90' : v === 3 ? 'stat-c-80' : v === 2 ? 'stat-c-60' : 'stat-c-50';
  }
  return statColor(value);
}
