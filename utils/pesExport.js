import JSZip from 'jszip';
import { FORMATIONS } from './constants.js';

const PES_POSITION_MAP = {
  PT: 0,
  DFC: 1,
  LI: 2,
  LD: 3,
  MCD: 4,
  MC: 5,
  MI: 6,
  MD: 7,
  MO: 8,
  EI: 9,
  ED: 10,
  SD: 11,
  DC: 12,
};

let cachedMasterCsv = null;
let masterCsvHeaders = '';
let masterPlayersMap = null; // Map<playerId, rawCsvLine>

/**
 * Carga e indexa jugadores_exportados.csv una sola vez en memoria
 */
export async function loadMasterPesCsv() {
  if (masterPlayersMap) return masterPlayersMap;

  try {
    const res = await fetch('/jugadores_exportados.csv');
    if (!res.ok) throw new Error(`HTTP ${res.status} al cargar jugadores_exportados.csv`);
    const text = await res.text();
    cachedMasterCsv = text;

    const lines = text.split(/\r?\n/);
    masterCsvHeaders = lines[0] || '';
    masterPlayersMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const firstSemicolon = line.indexOf(';');
      if (firstSemicolon === -1) continue;
      const id = line.substring(0, firstSemicolon).trim();
      if (id) {
        masterPlayersMap.set(id, line);
      }
    }

    return masterPlayersMap;
  } catch (error) {
    console.error('Error cargando master PES CSV:', error);
    throw error;
  }
}

/**
 * Genera Roster.csv según el esquema PES
 * Id;Player1..40;Number1..40;Value1..40;TotalPlayers
 */
export function generateRosterCsv(teamId, starters, subs, dorsalsMap = {}) {
  const headers = [
    'Id',
    ...Array.from({ length: 40 }, (_, i) => `Player${i + 1}`),
    ...Array.from({ length: 40 }, (_, i) => `Number${i + 1}`),
    ...Array.from({ length: 40 }, (_, i) => `Value${i + 1}`),
    'TotalPlayers'
  ].join(';');

  const allPlayers = [...starters, ...subs];
  const total = Math.min(40, allPlayers.length);

  const playerIds = Array(40).fill(0);
  const playerNumbers = Array(40).fill(0);
  const playerValues = Array(40).fill(0);

  const usedDorsals = new Set();

  // Asignar dorsales existentes y detectar libres
  allPlayers.slice(0, 40).forEach((p, idx) => {
    playerIds[idx] = p.Id || p.id || 0;
    const customNum = parseInt(dorsalsMap[String(p.Id || p.id)] || dorsalsMap[Number(p.Id || p.id)], 10);
    if (!isNaN(customNum) && customNum >= 1 && customNum <= 99 && !usedDorsals.has(customNum)) {
      playerNumbers[idx] = customNum;
      usedDorsals.add(customNum);
    }
  });

  // Asignar número automático a los que no tienen dorsal para que PES no rompa
  let nextFree = 1;
  for (let idx = 0; idx < total; idx++) {
    if (playerNumbers[idx] === 0) {
      while (usedDorsals.has(nextFree) && nextFree < 99) {
        nextFree++;
      }
      playerNumbers[idx] = nextFree;
      usedDorsals.add(nextFree);
    }
  }

  const row = [
    teamId,
    ...playerIds,
    ...playerNumbers,
    ...playerValues,
    total
  ].join(';');

  return `${headers}\n${row}\n`;
}

/**
 * Genera Players.csv uniendo las filas originales de jugadores_exportados.csv
 */
export async function generatePlayersCsv(allTeamPlayers) {
  const map = await loadMasterPesCsv();
  const rows = [masterCsvHeaders];
  const missingPlayers = [];

  allTeamPlayers.forEach(player => {
    const id = String(player.Id || player.id);
    const line = map.get(id);
    if (line) {
      rows.push(line);
    } else {
      missingPlayers.push(player);
      // Fallback básico para no quebrar el CSV si es un jugador creado a mano
      const fallbackRow = `${id};${player.Name || 'Jugador'};${player.Name || ''};${player.Name?.toUpperCase() || ''};;;204;0;${player.Height || 180};${player.Weight || 75};${player.Age || 25};False;0;${PES_POSITION_MAP[player.POS_NOMBRE] || 0};0;0;0;0;0;0;0;0;0;0;0;0;0;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;70;40;40;40;40;40;2;2;5;1;5;1;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;0;0;1;1;1;1;1;1;1;1;0;0;30/6/2026 00:00:00;1/1/0001 00:00:00;100000;0;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;0;False;-1;0;0;0;0;0;False;${player.OVR_CALCULADO || 70}`;
      rows.push(fallbackRow);
    }
  });

  return {
    csvContent: rows.join('\n') + '\n',
    missingPlayers
  };
}

/**
 * Genera Team.csv con el ID de PES destino y el nombre del equipo de la liga
 */
export function generateTeamCsv(teamId, teamName) {
  const headers = "Id;Name;Country;Stadium;Coach;National;NameJapanese;NameSpanish;NameLatamSpanish;NameEnglish;NameUSEnglish;NameItalian;NamePortuguese;NameBrazilian;NameFrench;NameGerman;NameDutch;NameSwedish;NameRussian;NameGreek;NameTurkish;NameSimplifiedChinese;NameDatabase;NameEmpty1;NameEmpty2;NameEmpty3;NameEmpty4;ShortNameLicensed;ShortNameFake;Abbreviation;Commentary;StadiumFile;StadiumName;StadiumFileName;EmblemFile;EmblemFileName;Rival1;Rival2;Rival3;Banner1;Banner2;Banner3;Banner4;Kit1;Kit2;Kit3;Kit4;Kit5;Kit6;Kit7;Kit8;Kit9;Kit10;TeamColor1R;TeamColor1G;TeamColor1B;TeamColor2R;TeamColor2G;TeamColor2B;TurfPattern;SidelineColour;SeatColour;GoalStyle;NetPattern;GoalNettingDesign;GoalNettingColor1R;GoalNettingColor1G;GoalNettingColor1B;GoalNettingColor2R;GoalNettingColor2G;GoalNettingColor2B;Sponsor1;Sponsor2;Sponsor3;SponsorFile1;SponsorFile2;SponsorFile3;SponsorColorR;SponsorColorG;SponsorColorB;EditName;EditEmblem;EditStadium;EditStadiumName;EditStadiumFile;EditStadiumDetails;EditStadiumDetails2;EditRivals;EditBanners;EditTeamColors;EditCoach;EditSponsorFile;EditSponsorColors;EditSponsor;Edit1;Fake;LicencedPlayers;LicencedKits;LicencedCoach;LicencedCoach2;FeederTeam;ParentTeam;NonPlayableLeague;HasAnthem;AnthemStandingStyle;AnthemPlayersSinging;AnthemStandingAngle;Value1;Value2;Value3;Value4;Value5;Value6;Value7;ValueFF;Team2020_1;Team2020_2;Team2020_3;Team2020_4;Team2020_5;Team2020_6;Team2020_7;Team2020_8;Team2020_9;Team2020_10;Team2020_11;Country2020_1;Country2020_2;Country2020_3;Country2020_4;Country2020_5;Value2020_1;Value2020_2;Value2020_3;Value2020_4;Value2020_5;Value2020_6;Value2020_7;Value2020_8;Value2020_9;Value2020_10;Value2020_11;Value2020_12;Value2020_13;Value2020_14;Value2020_15;Value2020_16;Value2020_17";

  const safeName = (teamName || 'Equipo').substring(0, 32);
  const abbr = safeName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'SCL';
  const coachId = (parseInt(teamId, 10) * 1000) + 1;

  const row = `${teamId};${safeName};204;42;${coachId};False;${safeName};;;${safeName};${safeName};;;;;;;;;;;${safeName};;;;;;${abbr};${abbr};;-1;-1;;;-1;;0;0;0;;;;;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;0;0;0;0;0;0;-1;-1;-1;;;;0;0;0;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;False;True;True;True;True;0;0;0;False;0;0;0;-1;False;0;0;0;0;-1;0;0;0;0;128;0;177;0;0;100;132;102;146;204;228;204;232;760000;760000;-1;0;1;53152010;92488866;4;2;0;0;0;-1;0;0;0;0`;

  return `${headers}\n${row}\n`;
}

/**
 * Genera Coach.csv
 */
export function generateCoachCsv(teamId, coachName = 'Director Técnico') {
  const headers = "Id;Name;Country;JapName;Adaptability;Photo;Photo_file;EditName;EditCountry;EditPhoto;EditIntern;Value1;Value2;Value3;Value4;Value5;Value6";
  const coachId = (parseInt(teamId, 10) * 1000) + 1;
  const row = `${coachId};${coachName};204;;85;0;;False;False;False;False;0;0;0;-1;-1;-1`;
  return `${headers}\n${row}\n`;
}

/**
 * Genera Formation.csv mapeando slots, coordenadas y roles de pateadores
 */
export function generateFormationCsv(teamId, formationKey, starters, setPieces = {}, allPlayers = []) {
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
  const layout = formation.layout || FORMATIONS['4-3-3'].layout;

  // Header completo de Formation.csv
  const headers = "Id;Position1F1S1;Position2F1S1;Position3F1S1;Position4F1S1;Position5F1S1;Position6F1S1;Position7F1S1;Position8F1S1;Position9F1S1;Position10F1S1;Position11F1S1;LocationX1F1S1;LocationY1F1S1;LocationX2F1S1;LocationY2F1S1;LocationX3F1S1;LocationY3F1S1;LocationX4F1S1;LocationY4F1S1;LocationX5F1S1;LocationY5F1S1;LocationX6F1S1;LocationY6F1S1;LocationX7F1S1;LocationY7F1S1;LocationX8F1S1;LocationY8F1S1;LocationX9F1S1;LocationY9F1S1;LocationX10F1S1;LocationY10F1S1;LocationX11F1S1;LocationY11F1S1;Position1F2S1;Position2F2S1;Position3F2S1;Position4F2S1;Position5F2S1;Position6F2S1;Position7F2S1;Position8F2S1;Position9F2S1;Position10F2S1;Position11F2S1;LocationX1F2S1;LocationY1F2S1;LocationX2F2S1;LocationY2F2S1;LocationX3F2S1;LocationY3F2S1;LocationX4F2S1;LocationY4F2S1;LocationX5F2S1;LocationY5F2S1;LocationX6F2S1;LocationY6F2S1;LocationX7F2S1;LocationY7F2S1;LocationX8F2S1;LocationY8F2S1;LocationX9F2S1;LocationY9F2S1;LocationX10F2S1;LocationY10F2S1;LocationX11F2S1;LocationY11F2S1;Position1F3S1;Position2F3S1;Position3F3S1;Position4F3S1;Position5F3S1;Position6F3S1;Position7F3S1;Position8F3S1;Position9F3S1;Position10F3S1;Position11F3S1;LocationX1F3S1;LocationY1F3S1;LocationX2F3S1;LocationY2F3S1;LocationX3F3S1;LocationY3F3S1;LocationX4F3S1;LocationY4F3S1;LocationX5F3S1;LocationY5F3S1;LocationX6F3S1;LocationY6F3S1;LocationX7F3S1;LocationY7F3S1;LocationX8F3S1;LocationY8F3S1;LocationX9F3S1;LocationY9F3S1;LocationX10F3S1;LocationY10F3S1;LocationX11F3S1;LocationY11F3S1;AttackingStylesS1;BuildUpS1;AttackingAreaS1;PositioningS1;SupportRangeS1;NumbersInAttackS1;DefensiveStylesS1;ContainmentAreaS1;PressuringS1;DefensiveLineS1;CompactnessS1;NumbersInDefenseS1;FluidS1;AdvancedAtt1S1;AdvancedAtt2S1;AdvancedDef1S1;AdvancedDef2S1;FFS1;Value1S1;Value2S1;Value3S1;Value4S1;Value5S1;Position1F1S2;Position2F1S2;Position3F1S2;Position4F1S2;Position5F1S2;Position6F1S2;Position7F1S2;Position8F1S2;Position9F1S2;Position10F1S2;Position11F1S2;LocationX1F1S2;LocationY1F1S2;LocationX2F1S2;LocationY2F1S2;LocationX3F1S2;LocationY3F1S2;LocationX4F1S2;LocationY4F1S2;LocationX5F1S2;LocationY5F1S2;LocationX6F1S2;LocationY6F1S2;LocationX7F1S2;LocationY7F1S2;LocationX8F1S2;LocationY8F1S2;LocationX9F1S2;LocationY9F1S2;LocationX10F1S2;LocationY10F1S2;LocationX11F1S2;LocationY11F1S2;Position1F2S2;Position2F2S2;Position3F2S2;Position4F2S2;Position5F2S2;Position6F2S2;Position7F2S2;Position8F2S2;Position9F2S2;Position10F2S2;Position11F2S2;LocationX1F2S2;LocationY1F2S2;LocationX2F2S2;LocationY2F2S2;LocationX3F2S2;LocationY3F2S2;LocationX4F2S2;LocationY4F2S2;LocationX5F2S2;LocationY5F2S2;LocationX6F2S2;LocationY6F2S2;LocationX7F2S2;LocationY7F2S2;LocationX8F2S2;LocationY8F2S2;LocationX9F2S2;LocationY9F2S2;LocationX10F2S2;LocationY10F2S2;LocationX11F2S2;LocationY11F2S2;Position1F3S2;Position2F3S2;Position3F3S2;Position4F3S2;Position5F3S2;Position6F3S2;Position7F3S2;Position8F3S2;Position9F3S2;Position10F3S2;Position11F3S2;LocationX1F3S2;LocationY1F3S2;LocationX2F3S2;LocationY2F3S2;LocationX3F3S2;LocationY3F3S2;LocationX4F3S2;LocationY4F3S2;LocationX5F3S2;LocationY5F3S2;LocationX6F3S2;LocationY6F3S2;LocationX7F3S2;LocationY7F3S2;LocationX8F3S2;LocationY8F3S2;LocationX9F3S2;LocationY9F3S2;LocationX10F3S2;LocationY10F3S2;LocationX11F3S2;LocationY11F3S2;AttackingStylesS2;BuildUpS2;AttackingAreaS2;PositioningS2;SupportRangeS2;NumbersInAttackS2;DefensiveStylesS2;ContainmentAreaS2;PressuringS2;DefensiveLineS2;CompactnessS2;NumbersInDefenseS2;FluidS2;AdvancedAtt1S2;AdvancedAtt2S2;AdvancedDef1S2;AdvancedDef2S2;FFS2;Value1S2;Value2S2;Value3S2;Value4S2;Value5S2;Position1F1S3;Position2F1S3;Position3F1S3;Position4F1S3;Position5F1S3;Position6F1S3;Position7F1S3;Position8F1S3;Position9F1S3;Position10F1S3;Position11F1S3;LocationX1F1S3;LocationY1F1S3;LocationX2F1S3;LocationY2F1S3;LocationX3F1S3;LocationY3F1S3;LocationX4F1S3;LocationY4F1S3;LocationX5F1S3;LocationY5F1S3;LocationX6F1S3;LocationY6F1S3;LocationX7F1S3;LocationY7F1S3;LocationX8F1S3;LocationY8F1S3;LocationX9F1S3;LocationY9F1S3;LocationX10F1S3;LocationY10F1S3;LocationX11F1S3;LocationY11F1S3;Position1F2S3;Position2F2S3;Position3F2S3;Position4F2S3;Position5F2S3;Position6F2S3;Position7F2S3;Position8F2S3;Position9F2S3;Position10F2S3;Position11F2S3;LocationX1F2S3;LocationY1F2S3;LocationX2F2S3;LocationY2F2S3;LocationX3F2S3;LocationY3F2S3;LocationX4F2S3;LocationY4F2S3;LocationX5F2S3;LocationY5F2S3;LocationX6F2S3;LocationY6F2S3;LocationX7F2S3;LocationY7F2S3;LocationX8F2S3;LocationY8F2S3;LocationX9F2S3;LocationY9F2S3;LocationX10F2S3;LocationY10F2S3;LocationX11F2S3;LocationY11F2S3;Position1F3S3;Position2F3S3;Position3F3S3;Position4F3S3;Position5F3S3;Position6F3S3;Position7F3S3;Position8F3S3;Position9F3S3;Position10F3S3;Position11F3S3;LocationX1F3S3;LocationY1F3S3;LocationX2F3S3;LocationY2F3S3;LocationX3F3S3;LocationY3F3S3;LocationX4F3S3;LocationY4F3S3;LocationX5F3S3;LocationY5F3S3;LocationX6F3S3;LocationY6F3S3;LocationX7F3S3;LocationY7F3S3;LocationX8F3S3;LocationY8F3S3;LocationX9F3S3;LocationY9F3S3;LocationX10F3S3;LocationY10F3S3;LocationX11F3S3;LocationY11F3S3;AttackingStylesS3;BuildUpS3;AttackingAreaS3;PositioningS3;SupportRangeS3;NumbersInAttackS3;DefensiveStylesS3;ContainmentAreaS3;PressuringS3;DefensiveLineS3;CompactnessS3;NumbersInDefenseS3;FluidS3;AdvancedAtt1S3;AdvancedAtt2S3;AdvancedDef1S3;AdvancedDef2S3;FFS3;Value1S3;Value2S3;Value3S3;Value4S3;Value5S3;IndexPlayer1;IndexPlayer2;IndexPlayer3;IndexPlayer4;IndexPlayer5;IndexPlayer6;IndexPlayer7;IndexPlayer8;IndexPlayer9;IndexPlayer10;IndexPlayer11;IndexPlayer12;IndexPlayer13;IndexPlayer14;IndexPlayer15;IndexPlayer16;IndexPlayer17;IndexPlayer18;IndexPlayer19;IndexPlayer20;IndexPlayer21;IndexPlayer22;IndexPlayer23;IndexPlayer24;IndexPlayer25;IndexPlayer26;IndexPlayer27;IndexPlayer28;IndexPlayer29;IndexPlayer30;IndexPlayer31;IndexPlayer32;IndexPlayer33;IndexPlayer34;IndexPlayer35;IndexPlayer36;IndexPlayer37;IndexPlayer38;IndexPlayer39;IndexPlayer40;Captain;ShortFK;LongFK;RightCorner;LeftCorner;Penalty;SecondKicker;Header1;Header2;Header3;AutoSubstitutions;OffsideTrap;SwitchTactics;AutoChangeAttDef;Value1;Value2;Zeros";

  // 11 posiciones numéricas y coordenadas calculadas
  const positions = layout.slice(0, 11).map(slot => PES_POSITION_MAP[slot.pos] ?? 5);
  const locPairs = layout.slice(0, 11).map(slot => {
    const pesX = Math.max(3, Math.min(48, Math.round((90 - slot.y) * 0.46 + 3)));
    const pesY = Math.max(8, Math.min(92, Math.round(slot.x)));
    return `${pesX};${pesY}`;
  });

  const positionsString = positions.join(';');
  const locationsString = locPairs.join(';');

  // Estrategia base PES estándar (presets 1, 2, 3)
  const strategyChunk = "1;1;1;1;6;2;0;0;0;8;2;0;0;0;0;0;0;0;0;0;0;0;0";

  // IndexPlayer1..40 (40 ceros como el estándar oficial de PES)
  const indexPlayers = Array(40).fill(0).join(';');

  // Helper para resolver índice (0..10) en los titulares a partir de un ID
  const getPlayerIndex = (targetId, defaultIdx = 0) => {
    if (!targetId) return defaultIdx;
    const foundIdx = starters.findIndex(p => String(p.Id || p.id) === String(targetId));
    return foundIdx >= 0 ? foundIdx : defaultIdx;
  };

  // Roles de balón parado
  const captainIdx = getPlayerIndex(setPieces.captain, 0);
  const shortFkIdx = getPlayerIndex(setPieces.shortFK, 0);
  const longFkIdx = getPlayerIndex(setPieces.longFK, 0);
  const rightCornerIdx = getPlayerIndex(setPieces.rightCorner, 0);
  const leftCornerIdx = getPlayerIndex(setPieces.leftCorner, 0);
  const penaltyIdx = getPlayerIndex(setPieces.penalty, 0);
  const secondKickerIdx = getPlayerIndex(setPieces.secondKicker, 0);
  const header1Idx = getPlayerIndex(setPieces.header1, 1);
  const header2Idx = getPlayerIndex(setPieces.header2, 2);
  const header3Idx = getPlayerIndex(setPieces.header3, 3);

  const rolesString = `${captainIdx};${shortFkIdx};${longFkIdx};${rightCornerIdx};${leftCornerIdx};${penaltyIdx};${secondKickerIdx};${header1Idx};${header2Idx};${header3Idx};0;0;0;0;0;0;0`;

  // F1S1, F2S1, F3S1 repetidos para preset ofensivo, defensivo y custom
  const row = `${teamId};${positionsString};${locationsString};${positionsString};${locationsString};${positionsString};${locationsString};${strategyChunk};${positionsString};${locationsString};${positionsString};${locationsString};${positionsString};${locationsString};${strategyChunk};${positionsString};${locationsString};${positionsString};${locationsString};${positionsString};${locationsString};${strategyChunk};${indexPlayers};${rolesString}`;

  return `${headers}\n${row}\n`;
}

/**
 * Genera Appearances.csv para los jugadores del equipo
 */
export function generateAppearancesCsv(allTeamPlayers) {
  const headers = "Id;NeckLength;NeckSize;ShoulderHeight;ShoulderWidth;ChestMeasurement;WaistSize;ArmSize;ThighSize;CalfSize;LegLength;ArmLength;SkinColour;HeadLength;HeadWidth;HeadDepth;FaceHeight;FaceSize;UpperEyelidType;BottomEyelidType;EyeHeight;HorizontalEyePosition;IrisColour;PupilSize;UpperEyelidHt.(Inner);UpperEyelidWd.(Inner);UpperEyelidHt.(Outer);UpperEyelidWd.(Outer);InnerEyeHeight;InnerEyePosition;EyeCornerHeight;OuterEyePosition;BottomEyelidHeight;EyeDepth;Forehead;EyebrowType;EyebrowThickness;EyebrowStyle;EyebrowDensity;EyebrowColourR;EyebrowColourG;EyebrowColourB;InnerEyebrowHeight;BrowWidth;OuterEdyebrowHeight;TempleWidth;EyebrowDepth;NoseType;LaughterLines;NoseHeight;NostrilWidth;NoseWidth;NoseTipDepth;NoseDepth;UpperLipType;LowerLipType;MouthPosition;LipSize;LipWidth;MouthCornerHeight;MouthDepth;FacialHairType;FacialHairColourR;FacialHairColourG;FacialHairColourB;Thickness;CheekType;NeckLineType;Cheekbones;ChinHeight;ChinWidth;JawHeight;Jawline;ChinDepth;EarLength;EarWidth;EarAngle;Overall-Style;Overall-Length;Overall-WaveLevel;Overall-HairVariation;Font-Style;Font-Parted;Font-Hairline;Font-ForeheadWidth;Side/Back-Style;Side/Back-Cropped;HairColourR;HairColourG;HairColourB;AccessoryColour;HairColour;Accessories;Wristtaping;WristTapeColour1;WristTapeColour2;AnkleTaping;PlayerGloves;Colour;Undershorts;Sleeves;Shirttail;SockLength;Long-SleevedInners;ValueAp1;ValueAp2;ValueAp3;ValueAp4;ValueAp5;ValueAp6;ValueAp7;ValueAp8;ValueAp9;ValueAp10;ValueAp11;ValueAp12;ValueAp13;ValueAp14;ValueAp15;ValueAp16;ValueAp17;ValueAp18;ValueAp19;IdFace;Boots;Gloves;EditFace;EditHair;EditPhysique;EditStrip;ValueA";

  const rows = allTeamPlayers.map(p => {
    const id = p.Id || p.id;
    return `${id};0;0;0;0;0;0;0;0;0;0;0;1;0;0;0;0;0;1;1;0;0;1;0;0;0;0;0;0;0;0;0;0;0;1;1;1;1;1;0;0;0;0;0;0;0;0;1;1;0;0;0;0;0;1;1;0;0;0;0;0;0;0;0;0;0;1;1;0;0;0;0;0;0;0;0;0;1;1;0;0;1;1;1;1;1;0;0;0;0;0;0;False;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;False;False;False;False;0`;
  });

  return `${headers}\n${rows.join('\n')}\n`;
}

/**
 * Empaqueta y descarga el ZIP completo de Option File para PES
 */
export async function exportTeamToPesZip(teamData, targetPesTeamId = 103, coachName = 'Director Técnico') {
  const zip = new JSZip();

  const starters = [];
  const starterIds = new Set();
  const lineup = teamData.lineup || {};
  const currentFormation = FORMATIONS[teamData.formation] || FORMATIONS['4-3-3'];

  // 1. Extraer titulares en orden de slot táctico
  if (currentFormation?.layout) {
    currentFormation.layout.forEach((_, idx) => {
      const pId = lineup[idx];
      if (pId) {
        const p = teamData.players.find(pl => String(pl.Id || pl.id) === String(pId));
        if (p) {
          starters.push(p);
          starterIds.add(String(p.Id || p.id));
        }
      }
    });
  }

  // 2. Extraer suplentes (el resto del plantel)
  const subs = (teamData.players || []).filter(p => !starterIds.has(String(p.Id || p.id)));
  const allSquad = [...starters, ...subs];

  // 3. Generar CSVs
  const rosterCsv = generateRosterCsv(targetPesTeamId, starters, subs, teamData.dorsals || {});
  const { csvContent: playersCsv, missingPlayers } = await generatePlayersCsv(allSquad);
  const teamCsv = generateTeamCsv(targetPesTeamId, teamData.name);
  const coachCsv = generateCoachCsv(targetPesTeamId, coachName);
  const formationCsv = generateFormationCsv(targetPesTeamId, teamData.formation, starters, teamData.setPieces || {}, allSquad);
  const appearancesCsv = generateAppearancesCsv(allSquad);

  // 4. Agregar al archivo ZIP
  zip.file('Roster.csv', rosterCsv);
  zip.file('Players.csv', playersCsv);
  zip.file('Appearances.csv', appearancesCsv);
  zip.file('Team.csv', teamCsv);
  zip.file('Coach.csv', coachCsv);
  zip.file('Formation.csv', formationCsv);

  // Generar blob y forzar descarga
  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  const safeName = (teamData.name || 'Equipo').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = downloadUrl;
  a.download = `PES_OptionFile_${safeName}_ID${targetPesTeamId}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return {
    success: true,
    totalPlayers: allSquad.length,
    missingPlayers
  };
}
