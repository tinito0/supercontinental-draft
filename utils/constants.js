export const MAPEO_POS_ID = {
  0: 'PT', 1: 'DFC', 2: 'LI', 3: 'LD', 4: 'MCD', 5: 'MC',
  6: 'MI', 7: 'MD', 8: 'MO', 9: 'EI', 10: 'ED', 11: 'SD', 12: 'DC'
};

export const STAT_NAMES_MAP = {
  'OffensiveAwareness': 'Juego Ofensivo', 'BallControl': 'Control de Balón',
  'Dribbling': 'Regate', 'TightPossession': 'Posesión de Balón',
  'Finishing': 'Finalización', 'Heading': 'Cabeceo', 'PlaceKicking': 'Balón Parado',
  'Curl': 'Efecto', 'KickingPower': 'Potencia de Tiro',
  'LowPass': 'Pase Raso', 'LoftedPass': 'Pase Bombeado',
  'Speed': 'Velocidad', 'Acceleration': 'Aceleración', 'Jump': 'Salto',
  'PhysicalContact': 'Contacto Físico', 'Balance': 'Equilibrio', 'Stamina': 'Resistencia',
  'DefensiveAwareness': 'Actitud Defensiva', 'BallWinning': 'Recuperación', 'Aggression': 'Agresividad',
  'GKAwareness': 'Reflejos de PT', 'GKCatching': 'Parada de PT', 'GKClearing': 'Despeje de PT',
  'GKReflexes': 'Reacción de PT', 'GKReach': 'Estirada de PT',
  'WeakFootAcc': 'Prec. Pie Débil', 'WeakFootUsage': 'Uso Pie Débil'
};

export const DETAILED_STAT_KEYS = {
  'Ataque': ['OffensiveAwareness', 'BallControl', 'Dribbling', 'TightPossession'],
  'Disparo': ['Finishing', 'Heading', 'PlaceKicking', 'Curl', 'KickingPower'],
  'Pase': ['LowPass', 'LoftedPass'],
  'Físico': ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
  'Defensa': ['DefensiveAwareness', 'BallWinning', 'Aggression']
};

export const STATS_JUGADOR_CAMPO = {
  'Ataque y Control': ['OffensiveAwareness', 'BallControl', 'Dribbling', 'TightPossession'],
  'Disparo': ['Finishing', 'Heading', 'PlaceKicking', 'Curl', 'KickingPower'],
  'Pase y Distribución': ['LowPass', 'LoftedPass'],
  'Físico y Resistencia': ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
  'Defensa y Recuperación': ['DefensiveAwareness', 'BallWinning', 'Aggression'],
  'Otros': ['WeakFootAcc', 'WeakFootUsage']
};

export const STATS_PORTERO = {
  'Porteria': ['GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach'],
  'Pase y Técnica': ['LowPass', 'LoftedPass', 'BallControl', 'TightPossession'],
  'Físico': ['Speed', 'Acceleration', 'Jump', 'PhysicalContact', 'Balance', 'Stamina'],
  'Otros': ['WeakFootAcc', 'WeakFootUsage']
};

export const PLAYER_SKILLS_MAP = {
  'Trickster': 'Elástico', 'MazingRun': 'Regate Veloz', 'SpeedingBullet': 'Carrera Veloz',
  'IncisiveRun': 'Desmarque', 'LongBallExpert': 'Experto P. Largos', 'EarlyCross': 'Centro Temprano',
  'LongRanger': 'Tiro Larga Dist.', 'ScissorsFeint': 'Bicicleta', 'DoubleTouch': 'Doble Toque',
  'FlipFlap': 'Elástica Inversa', 'MarseilleTurn': 'Ruleta', 'Sombrero': 'Sombrero',
  'CrossOverTurn': 'Croqueta', 'CutBehindAndTurn': 'Corte y Giro', 'ScotchMove': 'Amago Escocés',
  'StepOnSkillcontrol': 'Control c/ Suela', 'HeadingSpecial': 'Cabeceador', 'LongRangeDrive': 'Disparo Potente',
  'Chipshotcontrol': 'Vaselina', 'LongRangeShot': 'Remate Lejano', 'KnuckleShot': 'Tiro s/ Vira',
  'DippingShots': 'Tiro con Rosca', 'RisingShots': 'Tiro Ascendente', 'AcrobaticFinishing': 'Remate Acrobático',
  'HeelTrick': 'Taco', 'FirstTimeShot': 'Tiro al Primer Toque', 'OneTouchPass': 'Pase al Primer Toque',
  'ThroughPassing': 'Pase en Profundidad', 'WeightedPass': 'Pase Medido',
  'PinpointCrossing': 'Centro Preciso', 'OutsideCurler': 'Tiro c/ Exterior', 'Rabona': 'Rabona',
  'NoLookPass': 'Pase sin Mirar', 'LowLoftedPass': 'Pase Bombeado Tenso', 'GKLowPunt': 'Saque de Puerta Bajo',
  'GKHighPunt': 'Saque de Puerta Alto', 'LongThrow': 'Saque Largo', 'GKLongThrow': 'Saque de Meta Largo',
  'PenaltySpecialist': 'Especialista Penales', 'GKPenaltySaver': 'Para-Penales', 'Gamesmanship': 'Pillería',
  'ManMarking': 'Marcaje', 'TrackBack': 'Persecución', 'Interception': 'Interceptador',
  'AcrobaticClear': 'Despeje Acrobático', 'Captaincy': 'Capitanía', 'SuperSub': 'Súper Suplente',
  'FightingSpirit': 'Espíritu de Lucha'
};

export const COUNTRY_CODE_MAP = {
  '1': 'AF', '2': 'BH', '3': 'BD', '5': 'BN', '7': 'CN', '8': 'HK', '9': 'IN', '10': 'ID',
  '11': 'IR', '12': 'IQ', '13': 'JP', '14': 'JO', '15': 'KP', '16': 'KR', '17': 'KW', '18': 'LA',
  '19': 'LB', '20': 'MO', '21': 'MY', '24': 'MM', '26': 'OM', '28': 'PS', '29': 'PH', '30': 'QA',
  '31': 'SA', '32': 'SG', '34': 'SY', '36': 'TH', '37': 'AE', '38': 'VN', '39': 'YE', '40': 'KG',
  '41': 'TJ', '42': 'TM', '44': 'DZ', '45': 'AO', '46': 'BJ', '48': 'BF', '49': 'BI', '50': 'CM',
  '51': 'CV', '52': 'CF', '53': 'TD', '54': 'KM', '55': 'CG', '56': 'CI', '58': 'EG', '59': 'GQ',
  '62': 'GA', '63': 'GM', '64': 'GH', '65': 'GN', '66': 'GW', '67': 'KE', '69': 'LR', '70': 'LY',
  '71': 'MG', '72': 'MW', '73': 'ML', '74': 'MR', '75': 'MU', '76': 'MA', '77': 'MZ', '78': 'NA',
  '79': 'NE', '80': 'NG', '81': 'RW', '82': 'ST', '83': 'SN', '85': 'SL', '87': 'ZA', '89': 'SS',
  '90': 'TZ', '91': 'TG', '92': 'TN', '93': 'UG', '94': 'ZM', '95': 'ZW', '98': 'CD', '104': 'AG',
  '105': 'AW', '107': 'BB', '109': 'BM', '110': 'CA', '112': 'CR', '113': 'CU', '115': 'DO', '116': 'SV',
  '117': 'GD', '119': 'GT', '120': 'HT', '121': 'HN', '122': 'JM', '124': 'MX', '125': 'NI', '127': 'PA',
  '128': 'PR', '130': 'KN', '131': 'LC', '133': 'TT', '135': 'US', '139': 'SR', '140': 'CW', '144': 'AR',
  '145': 'BO', '146': 'BR', '147': 'CL', '148': 'CO', '149': 'EC', '150': 'PY', '151': 'PE', '152': 'UY',
  '153': 'VE', '159': 'GY', '162': 'AU', '165': 'NC', '166': 'NZ', '189': 'IL', '190': 'TR', '191': 'AL',
  '192': 'AD', '193': 'AM', '194': 'AT', '195': 'AZ', '196': 'BY', '197': 'BE', '198': 'BA', '199': 'BG',
  '200': 'HR', '201': 'CY', '202': 'CZ', '203': 'DK', '204': 'GB-ENG', '205': 'EE', '206': 'FO', '207': 'FI',
  '208': 'FR', '209': 'GE', '210': 'DE', '211': 'GR', '212': 'HU', '213': 'IS', '214': 'IE', '215': 'IT',
  '216': 'KZ', '217': 'LV', '218': 'LI', '219': 'LT', '220': 'LU', '221': 'MK', '222': 'MT', '223': 'MD',
  '224': 'NL', '225': 'GB-NIR', '226': 'NO', '227': 'PL', '228': 'PT', '229': 'RO', '230': 'RU', '231': 'SM',
  '232': 'GB-SCT', '234': 'SK', '235': 'SI', '236': 'ES', '237': 'SE', '238': 'CH', '239': 'UA', '240': 'UZ',
  '241': 'GB-WLS', '245': 'GI', '260': 'NA', '298': 'TW', '303': 'RS', '304': 'ME', '311': 'XK', '312': 'SS'
};

export const REGIONES = [
  'Sudamérica',
  'Europa',
  'Norte y Centroamérica',
  'África',
  'Asia',
  'Oceanía',
  'Otras'
];

export const REGION_COUNTRIES = {
  'Asia': [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 26, 28, 29, 30, 31, 32, 34, 36, 37, 38, 39, 40, 41, 42, 298],
  'África': [44, 45, 46, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 62, 63, 64, 65, 66, 67, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 85, 87, 89, 90, 91, 92, 93, 94, 95, 98, 312],
  'Norte y Centroamérica': [104, 105, 107, 109, 110, 112, 113, 115, 116, 117, 119, 120, 121, 122, 124, 125, 127, 128, 130, 131, 133, 135, 139, 140],
  'Sudamérica': [144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 159],
  'Oceanía': [162, 165, 166],
  'Europa': [189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 234, 235, 236, 237, 238, 239, 240, 241, 245, 303, 304, 311]
};

export const FORMATIONS = {
  '4-3-3': {
    name: '4-3-3',
    layout: [
      { pos: 'PT',  x: 50, y: 90 },
      { pos: 'LD',  x: 82, y: 74 },
      { pos: 'DFC', x: 62, y: 74 },
      { pos: 'DFC', x: 38, y: 74 },
      { pos: 'LI',  x: 18, y: 74 },
      { pos: 'MCD', x: 50, y: 57 },
      { pos: 'MC',  x: 68, y: 42 },
      { pos: 'MC',  x: 32, y: 42 },
      { pos: 'ED',  x: 82, y: 22 },
      { pos: 'DC',  x: 50, y: 10 },
      { pos: 'EI',  x: 18, y: 22 },
    ]
  },
  '4-4-2': {
    name: '4-4-2 (Plana)',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 }, // Doble 5 cerrado
      { pos: 'MC', x: 30, y: 42 }, // Doble 5 cerrado
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 70, y: 58 },
      { pos: 'MCD', x: 30, y: 58 },
      { pos: 'MD', x: 88, y: 25 },
      { pos: 'MO', x: 50, y: 25 },
      { pos: 'MI', x: 12, y: 25 },
      { pos: 'DC', x: 50, y: 10 },
    ]
  },
  '4-1-2-1-2': {
    name: '4-1-2-1-2 (Rombo)',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MD', x: 88, y: 42 }, // Interior ancho
      { pos: 'MI', x: 12, y: 42 }, // Interior ancho
      { pos: 'MO', x: 50, y: 25 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '3-4-3': {
    name: '3-4-3',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'ED', x: 88, y: 10 },
      { pos: 'DC', x: 50, y: 10 },
      { pos: 'EI', x: 12, y: 10 },
    ]
  },
  '3-5-2': {
    name: '3-5-2',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '4-2-2-2': {
    name: '4-2-2-2 (Cubo)',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 70, y: 58 },
      { pos: 'MCD', x: 30, y: 58 },
      { pos: 'MO', x: 70, y: 25 }, // MOs centralizados
      { pos: 'MO', x: 30, y: 25 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '4-5-1': {
    name: '4-5-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 50, y: 10 },
    ]
  },
  '5-3-2': {
    name: '5-3-2',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 }, // Libero
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '4-1-2-3': {
    name: '4-1-2-3',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'ED', x: 88, y: 10 },
      { pos: 'DC', x: 50, y: 10 },
      { pos: 'EI', x: 12, y: 10 },
    ]
  },
  '4-2-1-3': {
    name: '4-2-1-3',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 70, y: 58 },
      { pos: 'MCD', x: 30, y: 58 },
      { pos: 'MO', x: 50, y: 25 },
      { pos: 'ED', x: 88, y: 10 },
      { pos: 'DC', x: 50, y: 10 },
      { pos: 'EI', x: 12, y: 10 },
    ]
  },
  '5-4-1': {
    name: '5-4-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 50, y: 10 },
    ]
  },
  '4-1-4-1': {
    name: '4-1-4-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MCD', x: 50, y: 58 }, // Pivote solo
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MC', x: 70, y: 42 },
      { pos: 'MC', x: 30, y: 42 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 50, y: 10 },
    ]
  },
  '5-3-1-1': {
    name: '5-3-1-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'LD', x: 88, y: 75 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'LI', x: 12, y: 75 },
      { pos: 'MC', x: 70, y: 58 },
      { pos: 'MCD', x: 50, y: 58 },
      { pos: 'MC', x: 30, y: 58 },
      { pos: 'SD', x: 50, y: 25 }, // Mediapunta/SD
      { pos: 'DC', x: 50, y: 10 },
    ]
  },
  '3-2-3-2': {
    name: '3-2-3-2',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'MCD', x: 70, y: 58 },
      { pos: 'MCD', x: 30, y: 58 },
      { pos: 'MD', x: 88, y: 42 },
      { pos: 'MO', x: 50, y: 25 },
      { pos: 'MI', x: 12, y: 42 },
      { pos: 'DC', x: 70, y: 10 },
      { pos: 'DC', x: 30, y: 10 },
    ]
  },
  '3-2-4-1': {
    name: '3-2-4-1',
    layout: [
      { pos: 'PT', x: 50, y: 90 },
      { pos: 'DFC', x: 70, y: 75 },
      { pos: 'DFC', x: 50, y: 75 },
      { pos: 'DFC', x: 30, y: 75 },
      { pos: 'MCD', x: 70, y: 58 },
      { pos: 'MCD', x: 30, y: 58 },
      { pos: 'MD', x: 88, y: 25 }, // Extremos altos
      { pos: 'MO', x: 70, y: 25 }, // Cuadrado mágico
      { pos: 'MO', x: 30, y: 25 },
      { pos: 'MI', x: 12, y: 25 },
      { pos: 'DC', x: 50, y: 10 },
    ]
  }
};

export const APP_NAME = "Supercontinental Draft";
export const DEFAULT_BUDGET = 200000000;
export const DEFAULT_LOGO = "/logo.webp";
export const ADMIN_USER_ID = "2Qn5j9a9ABW66iPyFL6ZfqwXBqG3";
export const ADMIN_USER_IDS = [
  "2Qn5j9a9ABW66iPyFL6ZfqwXBqG3"
];
export const APP_ID = 'scl-draft-2025';

export const DEFAULT_TACTICS = {
  attackingStyles: 1,    // 0: Contraataque, 1: Posesión
  buildUp: 1,            // 0: Pase largo, 1: Pase corto
  attackingArea: 1,      // 0: Por las bandas, 1: Por el centro
  positioning: 1,        // 0: Mantener formación, 1: Flexible
  supportRange: 6,       // Slider 1-10
  numbersInAttack: 2,    // 0: Pocos, 1: Medio, 2: Muchos
  defensiveStyles: 0,    // 0: Presión en la frontal, 1: Defensa total
  containmentArea: 0,    // 0: Por el centro, 1: Por las bandas
  pressuring: 0,         // 0: Conservador, 1: Agresivo
  defensiveLine: 8,      // Slider 1-10
  compactness: 2,        // Slider 1-10
  numbersInDefense: 0    // 0: Pocos, 1: Medio, 2: Muchos
};
