// Qué hace cada estilo de juego y cada habilidad de jugador (PES 2021), para el «¿Qué es?» de Filtros.
// Los estilos se indexan por el texto exacto de `PlayingStyle` en jugadores.json; las habilidades por la
// clave de PLAYER_SKILLS_MAP (utils/constants.js). tests/playerGlossary.test.js avisa si falta alguna.

export const PLAYING_STYLE_INFO = {
  // Delanteros
  'Cazagoles': 'Delantero que vive cerca del área rival, atento al rebote y al pase final. Se ubica en la espalda de los defensores para definir de primera.',
  'Señuelo': 'Delantero que se mueve para llevarse marcas y abrir espacios. Su trabajo es liberar a los compañeros, no tanto convertir.',
  'Hombre de Área': 'Se queda dentro del área esperando centros y pases cortos para definir. Participa poco en la construcción del juego.',
  'Referente': 'Delantero de referencia: recibe de espaldas, aguanta la marca y descarga para los que llegan. Muy útil en el juego aéreo.',
  // Extremos y mediapuntas
  'Extremo Prolífico': 'Extremo que encara hacia adentro del área para definir o asistir. Gana la línea de fondo y busca el gol más que el centro.',
  'Extremo Móvil': 'Extremo que no se queda pegado a la banda: se mueve por todo el frente de ataque y se mete por el centro.',
  'Especialista en Centros': 'Prioriza los centros desde la banda. Ancho por la derecha o izquierda, busca la línea de fondo y manda la pelota al área.',
  'El Diez Clásico': 'Mediapunta creativo que pide la pelota entre líneas y maneja el ritmo del ataque con pases y gambetas.',
  'Jugador de Huecos': 'Se mueve por los espacios libres entre las líneas rivales para recibir y filtrar pases o definir.',
  // Mediocampistas
  'Creador de Jugadas': 'Mediocampista creativo: se mueve por todo el campo buscando el pase clave y generando situaciones de gol.',
  'Omnipresente': 'Box-to-box: sube a apoyar el ataque y vuelve a defender. Cubre mucha cancha y exige buena resistencia.',
  'Organizador': 'Reparte el juego desde el mediocampo, se ofrece como opción de pase y equilibra entre defensa y ataque.',
  'El Destructor': 'Mediocampista que corta el juego rival: presiona, roba y marca de cerca. Poco aporte ofensivo.',
  'El Protector': 'Se queda delante de la defensa para cubrir el espacio y proteger a los centrales. No suele adelantarse.',
  // Defensores
  'Atacante Extra': 'Defensor que se suma al ataque en jugadas de pelota parada o cuando el equipo carga con todo.',
  'Creación': 'Defensor central que sale jugando: inicia la jugada con pases precisos desde atrás en lugar de revolear.',
  'Lateral Ofensivo': 'Lateral que sube constantemente por la banda para sumarse al ataque y llegar a la línea de fondo.',
  'Lateral Defensivo': 'Lateral que prioriza marcar y se queda atrás cubriendo su banda. Casi no pasa de mitad de cancha.',
  'Lateral Finalizador': 'Lateral que se mete hacia adentro y llega al área rival para rematar, como un mediocampista más.',
  // Arqueros
  'Portero Ofensivo': 'Arquero que adelanta su posición y sale a cortar balones detrás de la defensa. Juega como líbero.',
  'Portero Defensivo': 'Arquero que se queda en la línea de gol y prioriza atajar sin arriesgar salidas.',
  'Ninguno': 'Sin estilo de juego asignado: se comporta de forma neutra en el campo.',
};

// Orden y agrupación con que se muestran los estilos en la lista.
export const PLAYING_STYLE_GROUPS = [
  { title: 'Delanteros', styles: ['Cazagoles', 'Señuelo', 'Hombre de Área', 'Referente'] },
  { title: 'Extremos y mediapuntas', styles: ['Extremo Prolífico', 'Extremo Móvil', 'Especialista en Centros', 'El Diez Clásico', 'Jugador de Huecos'] },
  { title: 'Mediocampistas', styles: ['Creador de Jugadas', 'Omnipresente', 'Organizador', 'El Destructor', 'El Protector'] },
  { title: 'Defensores', styles: ['Atacante Extra', 'Creación', 'Lateral Ofensivo', 'Lateral Defensivo', 'Lateral Finalizador'] },
  { title: 'Arqueros', styles: ['Portero Ofensivo', 'Portero Defensivo'] },
  { title: 'Otro', styles: ['Ninguno'] },
];

// Estilos COM: en PLAYER_SKILLS_MAP conviven con las habilidades, pero el juego los trata aparte.
export const COM_STYLE_KEYS = ['Trickster', 'MazingRun', 'SpeedingBullet', 'IncisiveRun', 'LongBallExpert', 'EarlyCross', 'LongRanger'];

export const SKILL_INFO = {
  // Estilos COM: los siete primeros de PLAYER_SKILLS_MAP; en la lista van aparte (COM_STYLE_KEYS).
  Trickster: 'Encara y gambetea seguido con movimientos vistosos para superar a su marcador.',
  MazingRun: 'Se mete en diagonal con la pelota pegada al pie, esquivando rivales en el camino.',
  SpeedingBullet: 'Arranca con la pelota a toda velocidad y casi sin perder el control al correr.',
  IncisiveRun: 'Llega desde segunda línea con carreras que rompen la defensa rival.',
  LongBallExpert: 'Prefiere los pases largos para cambiar el juego y habilitar a los delanteros.',
  EarlyCross: 'Centra rápido, sin esperar a llegar a la línea de fondo.',
  LongRanger: 'Remata desde afuera del área con frecuencia.',
  // Gambetas y control
  ScissorsFeint: 'Finta de tijera: pasa el pie por encima de la pelota para engañar al defensor.',
  DoubleTouch: 'Doble toque: toca dos veces seguidas para sacarse al rival de encima.',
  FlipFlap: 'Gambeta con la parte externa e interna del pie para cambiar de dirección.',
  MarseilleTurn: 'Marsellesa: giro de 360° protegiendo la pelota con el cuerpo.',
  Sombrero: 'Sombrerito: levanta la pelota por encima del rival para pasarlo.',
  CrossOverTurn: 'Cortada: cambia de dirección rápido cruzando la pelota.',
  CutBehindAndTurn: 'Amago por detrás y giro: pasa la pelota por detrás de su pierna de apoyo para girar.',
  ScotchMove: 'Rebote interior: usa el cuerpo del defensor o el piso para rebotar la pelota y escapar de la marca.',
  StepOnSkillcontrol: 'Pisar el balón: frena y mueve la pelota con la suela para cambiar de ritmo.',
  // Cabeceo y remates
  HeadingSpecial: 'Cabeceador: gana de arriba y cabecea con más potencia y precisión.',
  LongRangeDrive: 'Cañonero: pegada fuerte con trayectoria recta desde afuera del área.',
  Chipshotcontrol: 'Sombrero: tiros por encima del arquero con más control.',
  LongRangeShot: 'Tiro de larga distancia: mejora precisión y potencia de los remates desde lejos.',
  KnuckleShot: 'Tiro con empeine: patea con trayectoria impredecible, sin rotación.',
  DippingShots: 'Disparo descendente: el tiro baja rápido después de pasar al arquero.',
  RisingShots: 'Disparo ascendente: el tiro sube y se mantiene en el aire más tiempo.',
  AcrobaticFinishing: 'Finalización acrobática: define con chilenas, voleas y remates en el aire.',
  HeelTrick: 'Taconazo: remata o pasa con el talón.',
  FirstTimeShot: 'Remate primer toque: patea de primera sin controlar.',
  // Pases
  OneTouchPass: 'Pase al primer toque: pasa de primera con más precisión.',
  ThroughPassing: 'Pase en profundidad: mejora los pases filtrados entre la defensa rival.',
  WeightedPass: 'Pase a profundidad: pases con potencia y precisión para largas distancias.',
  PinpointCrossing: 'Pase cruzado: centros muy precisos al área.',
  OutsideCurler: 'Centro con rosca: pasa o centra con el exterior del pie, con efecto.',
  Rabona: 'Rabona: patea cruzando la pierna de apoyo por detrás.',
  NoLookPass: 'Pase sin mirar: pasa mirando para otro lado y confunde a la marca.',
  LowLoftedPass: 'Pase bombeado bajo: levanta la pelota con poca altura para pasar sobre un rival.',
  // Arqueros y pelota parada
  GKLowPunt: 'Patadón en corto: el arquero saca con precisión a un compañero cercano.',
  GKHighPunt: 'Patadón en largo: el arquero saca con potencia a larga distancia.',
  LongThrow: 'Saque largo de banda: tira el lateral muy lejos, hasta el área.',
  GKLongThrow: 'Saque largo del arquero: lanza con la mano hasta mitad de cancha.',
  PenaltySpecialist: 'Especialista en penales: más probabilidades de convertir desde los doce pasos.',
  GKPenaltySaver: 'Parapenales: más chances de atajar penales.',
  // Defensa y mentalidad
  Gamesmanship: 'Malicia: se tira, hace tiempo y provoca faltas del rival.',
  ManMarking: 'Marcaje: se pega al rival que tiene asignado y lo sigue por todo el campo.',
  TrackBack: 'Delantero atrasado: vuelve a defender cuando pierde la pelota.',
  Interception: 'Interceptador: anticipa los pases rivales y corta líneas de pase.',
  AcrobaticClear: 'Despeje acrobático: despeja con chilena o volea desde situaciones complicadas.',
  Captaincy: 'Capitanía: mejora el rendimiento de los compañeros que juegan con él.',
  SuperSub: 'Súper refuerzo: rinde mejor cuando entra desde el banco.',
  FightingSpirit: 'Espíritu de lucha: sigue rindiendo igual aunque esté cansado o su equipo pierda.',
};
