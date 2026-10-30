// What each playing style and each player skill does (PES 2021), for the «¿Qué es?» list in Filtros.
// Playing styles are keyed by the exact `PlayingStyle` text in jugadores.json, skills by their PLAYER_SKILLS_MAP key
// (utils/constants.js). tests/playerGlossary.test.js fails if one is missing.
//
// Playing style texts come from the league owner (2026-10-30): `summary` is the game's own one-liner, `detail` and
// `examples` his explanation, lightly edited (typos, first-person asides removed). `aka` holds the other names the
// game uses. Skill texts are our own summaries and have not been checked against the game (the UI says so).

export const PLAYING_STYLE_INFO = {
  'Cazagoles': {
    summary: 'Atacante muy ofensivo que se desmarca fácilmente.',
    detail: 'Siempre intenta romper el fuera de juego y busca huecos en la defensa para llegar solo al punto penal y recibir pases hacia atrás. Juega mano a mano con la línea defensiva: muchas veces queda en offside o solo frente al arquero.',
    examples: ['Agüero', 'Mbappé', 'Cristiano Ronaldo', 'Cavani', 'Haaland'],
  },
  'Señuelo': {
    summary: 'Jugador que crea espacios en la defensa para que lo aprovechen sus compañeros.',
    detail: 'Puede ser pivoteando, arrastrando marcas o aguantando la pelota. Participa más del juego que un Cazagoles y le gusta salir mucho más del área.',
    examples: ['Luis Suárez', 'Lewandowski', 'Firmino', 'Benzema', 'Thomas Müller', 'Diego Costa'],
  },
  'Hombre de Área': {
    summary: 'Delantero que acecha en el área rival a la espera del balón.',
    detail: 'El 9 de raza: se queda en el área esperando un mínimo descuido de la defensa o un gran pase para marcar. Se parece al Cazagoles, pero en una jugada de ataque casi nunca se lo ve fuera del área.',
    examples: ['Icardi', 'Falcao', 'Huntelaar', 'Palermo'],
  },
  'Referente': {
    aka: 'Proteger el balón',
    summary: 'Jugador que se convierte en el referente en ataque al controlar el balón en una posición avanzada.',
    detail: 'No tiene que ver con ser el líder del ataque: es para jugadores que aguantan y juegan mucho de espaldas al arco. Ideal para tirarle pelotazos desde la defensa, que la baje y juegue con sus compañeros.',
    examples: ['Ibrahimovic', 'Lukaku', 'Giroud', 'Dzeko', 'Guerrero', 'Rondón', 'Gignac', 'Pratto'],
  },
  'Extremo Prolífico': {
    summary: 'Jugador que se sitúa en la banda para recibir pases, y va hacia dentro si se presenta la oportunidad.',
    detail: 'Prioriza estar bien abierto y empieza la jugada por la banda, pero se cierra si aparece la posibilidad, como un pase en diagonal o un centro desde la banda opuesta.',
    examples: ['Neymar', 'Salah', 'Mané', 'Bale', 'Dembélé', 'Sterling'],
  },
  'Extremo Móvil': {
    aka: 'Ala móvil',
    summary: 'Jugador que tiende a desmarcarse hacia dentro desde la banda al centro para recibir pases.',
    detail: 'Con o sin pelota: cuando recibe contra la banda prefiere avanzar hacia el medio o en diagonal antes que hacia adelante, por ejemplo para después tirar un centro.',
    examples: ['Messi', 'Éverton', 'Salah'],
  },
  'Especialista en Centros': {
    summary: 'Jugador que se pega a la línea de banda esperando la ocasión de poner un centro.',
    detail: 'Prioriza el centro antes que cualquier otra opción, incluso abusando de ellos.',
    examples: ['Beckham', 'Candreva', 'Marcos Acuña'],
  },
  'El Diez Clásico': {
    summary: 'El clásico jugador con talento que prefiere el juego de toque y los pases precisos al movimiento.',
    detail: 'Sus movimientos son más estáticos: prioriza los pases sobre el recorrido físico. El enganche clásico.',
    examples: ['Özil', 'Mata', 'Ganso', 'Dani Parejo', 'Éver Banega', 'Fábregas', 'Zidane', 'Platini', 'Riquelme'],
  },
  'Jugador de Huecos': {
    summary: 'Un jugador con instinto goleador que no duda en lanzarse al ataque a la primera oportunidad.',
    detail: 'Quienes jugaron al PES 13 lo pueden comparar con la carta «Adicto al gol». Con o sin pelota avanza hacia un hueco para ocuparlo: por ejemplo, pasa la pelota y sigue al ataque aprovechando el espacio creado.',
    examples: ['Bruno Fernandes', 'Havertz', 'Cuadrado', 'Di María', 'Carrasco', 'Gündogan', 'Lemar'],
  },
  'Creador de Jugadas': {
    summary: 'Jugador que aprovecha los huecos en defensa para iniciar los ataques y hacer asistencias de gol.',
    detail: 'Agarra la pelota y le gusta orquestar el ataque. Al empezar la jugada está en la mitad de cancha o en 3/4, pero no se queda ahí: llega a posiciones de gol si la jugada lo amerita, y se acerca a sus compañeros para que le den la pelota.',
    examples: ['Messi', 'Hazard', 'Papu Gómez', 'Dybala', 'Insigne', 'Ilicic', 'Bernardo Silva', 'Neymar'],
  },
  'Omnipresente': {
    summary: 'Jugador infatigable que no deja de correr por todo el campo durante los 90 minutos.',
    detail: 'No habla de jugadores que no se cansan, sino de la iniciativa de ir de área a área: sube y baja constantemente por banda, por el centro o por ambos, y ocupa posiciones defensivas u ofensivas según la jugada. Puede serlo con poca resistencia (hará esos recorridos a menor ritmo), y tener mucha resistencia no lo convierte en omnipresente.',
    examples: ['Kanté', 'Pogba', 'Wijnaldum', 'Nainggolan', 'Koke', 'Lallana', 'Ramsey', 'Vidal'],
  },
  'Organizador': {
    summary: 'Jugador que se mueve en posiciones retrasadas listo para iniciar el ataque.',
    detail: 'Como un Creador de Jugadas pero más retrasado: en general no pasa del 3/4 de cancha. Se ofrece todo el tiempo para iniciar el ataque con pases y conexiones con sus compañeros.',
    examples: ['Kroos', 'Thiago', 'Kimmich', 'Verratti', 'Modric', 'Pjanic', 'Jorginho', 'Xhaka', 'Brozovic'],
  },
  'El Destructor': {
    summary: 'Jugador batallador que contiene los ataques rivales a base de presión y entradas duras.',
    detail: 'En general agresivo: batalla mucho para intentar cortar siempre la jugada del rival.',
    examples: ['Casemiro', 'Torreira', 'Medel', 'Lucas Leiva', 'Krychowiak', 'Fernando Reges', 'Pepe', 'Koulibaly', 'Chiellini', 'Godín'],
  },
  'El Protector': {
    aka: 'Medio escudo',
    summary: 'Mediocampista que se queda atrás para defender la retaguardia.',
    detail: 'Mediocampista defensivo que cubre espacios metiéndose entre los centrales: el famoso «5 tapón». Casi nunca sube al ataque desde esta posición.',
    examples: ['Fabinho', 'N. Mendy', 'Luiz Gustavo', 'Dier'],
  },
  'Atacante Extra': {
    summary: 'Defensa al que le gusta sumarse al ataque y asediar al área contraria a la mínima oportunidad.',
    detail: 'Muy parecido a un Lateral Ofensivo, pero por el centro: cuando el equipo ataca se para en zonas avanzadas como opción de pase o se mete al área para intentar anotar. En Europa es muy común ver centrales parados en 3/4 de cancha haciendo esto.',
    examples: ['Sergio Ramos', 'Piqué', 'Upamecano', 'David Luiz', 'Yerry Mina', 'Toloi'],
  },
  'Creación': {
    summary: 'Jugador al que le gusta retrasar su posición para recibir el balón y lanzar ataques desde atrás.',
    detail: 'El defensor que empieza la jugada desde atrás distribuyendo la pelota, con pases cortos o largos.',
    examples: ['Hummels', 'Thiago Silva', 'Koundé', 'Alderweireld', 'Vertonghen', 'Marquinhos', 'Laporte', 'Umtiti'],
  },
  'Lateral Ofensivo': {
    summary: 'Jugador con mentalidad de ataque que correrá a sumarse al ataque a la menor oportunidad.',
    detail: 'El lateral de moda: siempre es una opción de ataque por la banda y prefiere ayudar en ofensiva antes que quedarse esperando el contraataque. El estilo solo dice si sube al ataque, no si es bueno atacando o defendiendo.',
    examples: ['Jordi Alba', 'Alex Sandro', 'Carvajal', 'Semedo', 'Cancelo', 'Davies'],
  },
  'Lateral Defensivo': {
    summary: 'Todo un seguro atrás que prefiere mantenerse retrasado y cumplir con las funciones defensivas.',
    detail: 'Lo contrario al Lateral Ofensivo: le gusta quedarse más retrasado, cubriendo el espacio a la espera del contraataque rival.',
    examples: ['Lucas Hernández', 'Azpilicueta', 'Pavard', 'D’Ambrosio', 'Mercado'],
  },
  'Lateral Finalizador': {
    summary: 'Lateral ofensivo que disfruta sumándose al ataque en zonas centrales adelantadas.',
    detail: 'A diferencia del Lateral Ofensivo, que se queda más en la banda, se cierra de 3/4 de cancha en adelante: colabora en la elaboración de la jugada o termina dentro del área para finalizarla.',
    examples: ['Marcelo', 'Theo Hernández', 'Tagliafico', 'Milton Casco', 'Dani Alves (en Europa)'],
  },
  'Portero Ofensivo': {
    summary: 'Portero que a menudo hace las veces de líbero y que sale para cubrir el área tras la defensa.',
    detail: 'No se queda esperando en el arco: se adelanta para cubrir la espalda de la defensa u ofrecerse como opción de pase, y ante una pelota a la espalda de los defensores prefiere salir a cortarla.',
    examples: ['Neuer', 'Ter Stegen', 'Alisson', 'De Gea', 'Ederson'],
  },
  'Portero Defensivo': {
    summary: 'Portero seguro que prefiere quedarse cerca de la línea de gol.',
    detail: 'Lo contrario al Portero Ofensivo: cuida el arco y casi nunca sale del área. Sale a cortar un mano a mano, pero no a lugares poco comunes como los ofensivos.',
    examples: ['Oblak', 'Courtois', 'Handanovic', 'Sirigu', 'Buffon', 'Armani'],
  },
  'Ninguno': {
    summary: 'Sin estilo de juego asignado.',
  },
};

// Market position codes (POS_NOMBRE in jugadores.json), not the game's: the game's DEC is DFC here, EXD/EXI are
// ED/EI and MDD/MDI are MD/MI. Source: the league owner, 2026-10-30.
export const PLAYING_STYLE_POSITIONS = {
  'Cazagoles': ['DC', 'SD'],
  'Señuelo': ['DC', 'SD', 'MO'],
  'Hombre de Área': ['DC'],
  'Referente': ['DC'],
  'Extremo Prolífico': ['ED', 'EI'],
  'Extremo Móvil': ['ED', 'EI', 'MD', 'MI'],
  'Especialista en Centros': ['ED', 'EI', 'MD', 'MI'],
  'El Diez Clásico': ['SD', 'MO', 'MC'],
  'Jugador de Huecos': ['SD', 'MO', 'MD', 'MI', 'MC'],
  'Creador de Jugadas': ['SD', 'ED', 'EI', 'MO', 'MD', 'MI'],
  'Omnipresente': ['MO', 'MD', 'MI', 'MC', 'MCD'],
  'Organizador': ['MC', 'MCD'],
  'El Destructor': ['MC', 'MCD', 'DFC'],
  'El Protector': ['MCD'],
  'Atacante Extra': ['DFC'],
  'Creación': ['DFC'],
  'Lateral Ofensivo': ['LD', 'LI'],
  'Lateral Defensivo': ['LD', 'LI'],
  'Lateral Finalizador': ['LD', 'LI'],
  'Portero Ofensivo': ['PT'],
  'Portero Defensivo': ['PT'],
};

export const PLAYING_STYLE_GROUPS = [
  { title: 'Delanteros', styles: ['Cazagoles', 'Señuelo', 'Hombre de Área', 'Referente'] },
  { title: 'Extremos y mediapuntas', styles: ['Extremo Prolífico', 'Extremo Móvil', 'Especialista en Centros', 'El Diez Clásico', 'Jugador de Huecos'] },
  { title: 'Mediocampistas', styles: ['Creador de Jugadas', 'Omnipresente', 'Organizador', 'El Destructor', 'El Protector'] },
  { title: 'Defensores', styles: ['Atacante Extra', 'Creación', 'Lateral Ofensivo', 'Lateral Defensivo', 'Lateral Finalizador'] },
  { title: 'Arqueros', styles: ['Portero Ofensivo', 'Portero Defensivo'] },
  { title: 'Otro', styles: ['Ninguno'] },
];

// COM styles share PLAYER_SKILLS_MAP with the skills, but the game treats them separately, so the list shows them apart.
export const COM_STYLE_KEYS = ['Trickster', 'MazingRun', 'SpeedingBullet', 'IncisiveRun', 'LongBallExpert', 'EarlyCross', 'LongRanger'];

export const SKILL_INFO = {
  Trickster: 'Encara y gambetea seguido con movimientos vistosos para superar a su marcador.',
  MazingRun: 'Se mete en diagonal con la pelota pegada al pie, esquivando rivales en el camino.',
  SpeedingBullet: 'Arranca con la pelota a toda velocidad y casi sin perder el control al correr.',
  IncisiveRun: 'Llega desde segunda línea con carreras que rompen la defensa rival.',
  LongBallExpert: 'Prefiere los pases largos para cambiar el juego y habilitar a los delanteros.',
  EarlyCross: 'Centra rápido, sin esperar a llegar a la línea de fondo.',
  LongRanger: 'Remata desde afuera del área con frecuencia.',
  ScissorsFeint: 'Pasa el pie por encima de la pelota para engañar al defensor.',
  DoubleTouch: 'Toca dos veces seguidas para sacarse al rival de encima.',
  FlipFlap: 'Cambia de dirección con toques de la parte externa e interna del pie.',
  MarseilleTurn: 'Giro de 360° protegiendo la pelota con el cuerpo.',
  Sombrero: 'Levanta la pelota por encima del rival para pasarlo.',
  CrossOverTurn: 'Cambia de dirección rápido cruzando la pelota.',
  CutBehindAndTurn: 'Pasa la pelota por detrás de su pierna de apoyo para girar.',
  ScotchMove: 'Usa el cuerpo del defensor o el piso para rebotar la pelota y escapar de la marca.',
  StepOnSkillcontrol: 'Frena y mueve la pelota con la suela para cambiar de ritmo.',
  HeadingSpecial: 'Gana de arriba y cabecea con más potencia y precisión.',
  LongRangeDrive: 'Pegada fuerte con trayectoria recta desde afuera del área.',
  Chipshotcontrol: 'Tiros por encima del arquero con más control.',
  LongRangeShot: 'Mejora precisión y potencia de los remates desde lejos.',
  KnuckleShot: 'Patea con trayectoria impredecible, sin rotación.',
  DippingShots: 'El tiro baja rápido después de pasar al arquero.',
  RisingShots: 'El tiro sube y se mantiene en el aire más tiempo.',
  AcrobaticFinishing: 'Define con chilenas, voleas y remates en el aire.',
  HeelTrick: 'Remata o pasa con el talón.',
  FirstTimeShot: 'Patea de primera sin controlar.',
  OneTouchPass: 'Pasa de primera con más precisión.',
  ThroughPassing: 'Mejora los pases filtrados entre la defensa rival.',
  WeightedPass: 'Le da efecto hacia atrás a los pases elevados, así la pelota frena al caer y es más fácil de controlar.',
  PinpointCrossing: 'Centros muy precisos al área.',
  OutsideCurler: 'Pasa o centra con el exterior del pie, con efecto.',
  Rabona: 'Patea cruzando la pierna de apoyo por detrás.',
  NoLookPass: 'Pasa mirando para otro lado y confunde a la marca.',
  LowLoftedPass: 'Levanta la pelota con poca altura para pasar sobre un rival.',
  GKLowPunt: 'El arquero saca de volea con trayectoria baja.',
  GKHighPunt: 'El arquero saca de volea con trayectoria alta.',
  LongThrow: 'Tira el lateral muy lejos, hasta el área.',
  GKLongThrow: 'El arquero lanza con la mano a larga distancia.',
  PenaltySpecialist: 'Más probabilidades de convertir desde los doce pasos.',
  GKPenaltySaver: 'Más chances de atajar penales.',
  Gamesmanship: 'Se tira, hace tiempo y provoca faltas del rival.',
  ManMarking: 'Se pega al rival que tiene asignado y lo sigue por todo el campo.',
  TrackBack: 'Vuelve a defender cuando pierde la pelota.',
  Interception: 'Anticipa los pases rivales y corta líneas de pase.',
  AcrobaticClear: 'Despeja con chilena o volea desde situaciones complicadas.',
  Captaincy: 'Mejora el rendimiento de los compañeros que juegan con él.',
  SuperSub: 'Rinde mejor cuando entra desde el banco.',
  FightingSpirit: 'Sigue rindiendo igual aunque esté cansado o su equipo pierda.',
};
