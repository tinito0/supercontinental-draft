// Votos del público sin cuenta (docs/COMMUNITY_PLATFORM.md): predicción de quién gana un partido del fixture, manager
// de la fecha (el que mejor manejó su equipo en el PES) y encuestas de la copa. Las reglas de las ventanas y la
// validación viven acá, puras; la Edge Function `community-vote` las aplica en una transacción.
// tests/communityVote.test.js.

// El manager de la fecha se vota cuando termina el último partido de la fecha y durante las 24 h siguientes.
export const MANAGER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_VOTES_PER_IP = 8;                 // casas o bares con varios votantes; no es una barrera total
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
const ROUND_ID = /^fecha-(\d{1,2})$/;
const CLUB_NAME_MAX = 80;
const FIXTURE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const POLL_ID = /^[a-z0-9-]{1,40}$/;
const OPTION_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const PREDICTION_CHOICES = ['home', 'draw', 'away'];

export class CommunityVoteError extends Error {
  /** @param {string} message @param {number} status @param {{ code?: string, choice?: string }} [extra] */
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.name = 'CommunityVoteError';
    this.status = status;
    this.code = extra.code || null;
    this.choice = extra.choice ?? null;
  }
}

const isScoreValue = value => value !== '' && value != null && Number.isInteger(Number(value)) && Number(value) >= 0;
// Las rutas de cada cruce, como utils/bracketModel.js CUP_DEFINITIONS (las funciones no importan fuera de su carpeta).
const CUP_PATHS = {
  'oro-quarters': ['quarters'], 'oro-semis': ['semis'], 'oro-final': ['final'],
  'plata-r1': ['repechaje', 'r1'], 'plata-r2': ['repechaje', 'r2'], 'plata-final': ['repechaje', 'final'],
};

/**
 * Si el partido del fixture (`league-<id>` o `<copa>-<ronda>-<n>`) ya tiene el resultado cargado en el torneo.
 * Poner al aire un partido ya jugado (p. ej. para la escena Final) no debe abrir una predicción.
 */
export function fixtureIsFinished(tournament, matchId) {
  const fixture = findFixture(tournament, matchId);
  return Boolean(fixture) && isScoreValue(fixture.homeScore) && isScoreValue(fixture.awayScore) && fixture.completed !== false;
}

const FIXTURE_MATCH_ID = /^(league-.+|(oro|plata)-[a-z0-9]+-\d+)$/;

/**
 * El partido del fixture con ese id (league-{id} u oro|plata-{ronda}-{n}), o null si no está en el torneo.
 * @returns {{ home: string, away: string, homeScore: unknown, awayScore: unknown, completed?: boolean } | null}
 */
export function findFixture(tournament, matchId) {
  if (!tournament || !matchId) return null;
  if (matchId.startsWith('league-')) {
    const match = (tournament.matches || []).find(item => item?.id === matchId.slice('league-'.length));
    return match ? { home: String(match.homeTeam || '').trim(), away: String(match.awayTeam || '').trim(), homeScore: match.homeScore, awayScore: match.awayScore, completed: match.status === 'completed' } : null;
  }
  const found = /^(oro|plata)-([a-z0-9]+)-(\d+)$/.exec(matchId);
  const path = found && CUP_PATHS[`${found[1]}-${found[2]}`];
  if (!path) return null;
  const node = path.reduce((acc, key) => (acc == null ? undefined : acc[key]), tournament.bracket);
  const tie = Array.isArray(node) ? node[Number(found[3])] : node;
  return tie ? { home: String(tie.teamA || '').trim(), away: String(tie.teamB || '').trim(), homeScore: tie.scoreA, awayScore: tie.scoreB } : null;
}

/**
 * Si se puede predecir ese partido según el torneo: un id del fixture tiene que estar en el torneo con los dos clubes
 * definidos. Sin el torneo, o con un id que no es del fixture, no se puede saber y no se bloquea.
 * El overlay puede quedar apuntando a un partido de otra temporada o a un cruce todavía sin equipos («Ganador 2°…»).
 */
export function fixtureIsPredictable(tournament, matchId) {
  if (!tournament || !FIXTURE_MATCH_ID.test(String(matchId || ''))) return true;
  const fixture = findFixture(tournament, matchId);
  return Boolean(fixture?.home && fixture?.away);
}

const fail = (message, status) => { throw new CommunityVoteError(message, status); };

/**
 * @param {unknown} body { kind: 'prediction', matchId, choice: 'home'|'draw'|'away', deviceId }
 *                       | { kind: 'manager', roundId: 'fecha-<n>', choice: nombre del club, deviceId }
 *                       | { kind: 'cup', pollId, choice: optionId, deviceId }  (encuesta «¿quién gana la copa?»)
 */
export function parseVote(body) {
  if (!body || typeof body !== 'object') fail('Falta el voto.');
  if (typeof body.deviceId !== 'string' || !DEVICE_ID.test(body.deviceId)) fail('Identificador de navegador inválido.');
  if (body.kind === 'prediction') {
    if (typeof body.matchId !== 'string' || !FIXTURE_ID.test(body.matchId)) fail('Partido inválido.');
    if (!PREDICTION_CHOICES.includes(body.choice)) fail('Elegí local, empate o visitante.');
    return { kind: 'prediction', target: body.matchId, choice: body.choice, deviceId: body.deviceId };
  }
  if (body.kind === 'manager') {
    if (typeof body.roundId !== 'string' || !ROUND_ID.test(body.roundId)) fail('Fecha inválida.');
    const club = typeof body.choice === 'string' ? body.choice.trim() : '';
    if (!club || club.length > CLUB_NAME_MAX) fail('Club inválido.');
    return { kind: 'manager', target: body.roundId, choice: club, deviceId: body.deviceId };
  }
  if (body.kind === 'cup') {
    if (typeof body.pollId !== 'string' || !POLL_ID.test(body.pollId)) fail('Encuesta inválida.');
    if (typeof body.choice !== 'string' || !OPTION_ID.test(body.choice)) fail('Opción inválida.');
    return { kind: 'cup', target: body.pollId, choice: body.choice, deviceId: body.deviceId };
  }
  return fail('Tipo de voto desconocido.');
}

/**
 * La predicción de un partido del fixture está abierta mientras ese partido está al aire en el overlay y no empezó
 * (match-feed pone closedAt al recibir el partido en vivo).
 * @returns {{ open: true, homeTeam, awayTeam } | { open: false, reason }}
 */
export function predictionWindow({ overlay, prediction, matchId, tournament = null }) {
  if (!overlay || overlay.matchId !== matchId) return { open: false, reason: 'Ese partido no está por jugarse ahora.' };
  if (prediction?.closedAt) return { open: false, reason: 'El partido ya empezó: la predicción está cerrada.' };
  if (fixtureIsFinished(tournament, matchId)) return { open: false, reason: 'Ese partido ya se jugó.' };
  if (!fixtureIsPredictable(tournament, matchId)) return { open: false, reason: 'Ese partido todavía no tiene los dos equipos definidos.' };
  return { open: true, homeTeam: overlay.homeTeamName || '', awayTeam: overlay.awayTeamName || '' };
}

/** Encuesta de la copa (public/data/polls/{pollId}): la abre y la cierra el admin, con las opciones que carga. */
export function pollWindow(poll, choice) {
  if (!poll) return { open: false, reason: 'Esa encuesta no existe.' };
  if (!poll.open) return { open: false, reason: 'La encuesta está cerrada.' };
  if (!(poll.options || []).some(option => option.id === choice)) return { open: false, reason: 'Esa opción no está en la encuesta.' };
  return { open: true };
}

/** Id de la fecha para la votación: «Fecha 4» → «fecha-4»; null si el nombre no tiene número. */
export function roundIdOf(label) {
  const number = /(\d{1,2})/.exec(String(label || ''))?.[1];
  return number ? `fecha-${Number(number)}` : null;
}

/**
 * Los partidos de liga de una fecha en el torneo, con los dos clubes, si ya se cargó el resultado y el partido del
 * juego del que se importó (importedFrom), si lo hay.
 * @returns {{ home: string, away: string, completed: boolean, importedFrom: string|null, homeScore, awayScore }[]}
 */
export function roundFixtures(tournament, roundId) {
  const number = Number(ROUND_ID.exec(String(roundId || ''))?.[1]);
  if (!number) return [];
  return (tournament?.matches || [])
    .filter(match => /fecha/i.test(String(match?.round || '')) && roundIdOf(match.round) === roundId)
    .map(match => ({
      home: String(match.homeTeam || '').trim(),
      away: String(match.awayTeam || '').trim(),
      completed: match.status === 'completed',
      importedFrom: typeof match.importedFrom === 'string' && match.importedFrom ? match.importedFrom : null,
      // Solo para mostrar en /en-vivo qué hizo cada club en la fecha; la ventana no los usa.
      homeScore: match.homeScore ?? null,
      awayScore: match.awayScore ?? null,
    }));
}

/**
 * Manager de la fecha: abre cuando todos los partidos de la fecha tienen resultado y queda abierta MANAGER_WINDOW_MS.
 * El final de la fecha es el `finishedAt` más nuevo de sus partidos del juego (live_matches, lo pone match-feed). Si
 * algún resultado se cargó a mano (sin partido del juego), no hay hora de final: cuenta desde el primer voto
 * (`openedAt` del doc de votos, lo pone esta función).
 * @param {{ fixtures: ReturnType<typeof roundFixtures>, finishedAtMs?: number[], openedAtMs?: number, now: number }} input
 *   finishedAtMs: el finishedAt de cada partido importado de la fecha (NaN si no tiene)
 * @returns {{ open: true, candidates: Set<string>, closesAtMs: number|null } | { open: false, reason: string, closesAtMs?: number }}
 */
export function managerWindow({ fixtures, finishedAtMs = [], openedAtMs = NaN, now }) {
  if (!fixtures.length) return { open: false, reason: 'Esa fecha no está en el torneo.' };
  if (fixtures.some(fixture => !fixture.completed)) {
    return { open: false, reason: 'La fecha todavía no terminó: la votación abre cuando se juega el último partido.' };
  }
  const allTimed = fixtures.every(fixture => fixture.importedFrom) && finishedAtMs.length === fixtures.length
    && finishedAtMs.every(Number.isFinite);
  const start = allTimed ? Math.max(...finishedAtMs) : openedAtMs;
  const closesAtMs = Number.isFinite(start) ? start + MANAGER_WINDOW_MS : null;
  if (closesAtMs != null && now > closesAtMs) return { open: false, reason: 'La votación de esta fecha ya cerró.', closesAtMs };
  const candidates = new Set(fixtures.flatMap(fixture => [fixture.home, fixture.away]).filter(Boolean));
  return { open: true, candidates, closesAtMs };
}

/**
 * finishedAt del doc de live_matches: se pone la primera vez que llega el partido terminado y después se conserva.
 * @returns {{ keep: Date | null, stamp: boolean }} keep: el valor a reescribir; stamp: ponerlo ahora (hora del servidor)
 */
export function finishedAtFor(existing, status) {
  if (status !== 'finished') return { keep: null, stamp: false };
  const previous = existing?.finishedAt;
  if (previous instanceof Date && !Number.isNaN(previous.getTime())) return { keep: previous, stamp: false };
  return { keep: null, stamp: true };
}

/** Totales nuevos (copias, no muta). */
export function addVote(totals, choice) {
  const key = String(choice);
  return { ...(totals || {}), [key]: ((totals || {})[key] || 0) + 1 };
}

/** sha-256 hex de valor + sal secreta: el servidor nunca guarda la IP ni el id del navegador en claro. */
export async function saltedHash(value, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * IP del votante. Primero cf-connecting-ip, que pone el borde de Cloudflare delante de Supabase y el cliente no puede
 * fijar; después x-real-ip. El primer valor de x-forwarded-for queda último: un cliente puede mandar su propio
 * encabezado y, si el proxy lo agrega en vez de reemplazarlo, ese primer valor lo elige el cliente.
 */
export function clientIp(headers) {
  const forwarded = (headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return headers.get('cf-connecting-ip') || headers.get('x-real-ip') || forwarded || 'unknown';
}

/**
 * match-feed: cuando el bridge sube un partido EN VIVO, la predicción del partido al aire se cierra y queda vinculada
 * a ese partido del juego (una sola PC: lo que se juega es lo que está al aire). Las subidas de partidos terminados
 * (reintentos del bridge) no cierran nada: el admin ya puede haber puesto al aire el siguiente.
 * @returns {null | { matchId: string, data: object }} qué escribir, o null si no hay nada que cerrar
 */
export function predictionClosure({ liveStatus, matchKey, overlay, prediction, liveDoc = null }) {
  if (liveStatus !== 'live' || !overlay?.matchId) return null;
  if (prediction?.closedAt) return null;
  // Si se sabe qué clubes juegan (asignación Draft → PES) y qué clubes tiene el partido al aire, tienen que ser los
  // mismos: si el admin ya puso al aire el siguiente partido mientras el anterior sigue subiendo datos, la predicción
  // del siguiente no se cierra ni queda vinculada al partido equivocado.
  const live = [liveDoc?.homeDraftTeamId, liveDoc?.awayDraftTeamId].filter(Boolean);
  const onAir = [overlay.homeTeamId, overlay.awayTeamId].filter(Boolean);
  if (live.length === 2 && onAir.length === 2 && [...live].sort().join('|') !== [...onAir].sort().join('|')) return null;
  return {
    matchId: overlay.matchId,
    data: {
      ...(prediction || {}),
      homeTeam: prediction?.homeTeam || overlay.homeTeamName || '',
      awayTeam: prediction?.awayTeam || overlay.awayTeamName || '',
      votes: prediction?.votes || {},
      total: prediction?.total || 0,
      liveMatchKey: matchKey,
    },
  };
}

const TOTALS_COLLECTION = { prediction: 'predictions', manager: 'manager_votes', cup: 'polls' };
const toMillis = value => (value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN);
const isDuplicateBallot = error => ['FAILED_PRECONDITION', 'ALREADY_EXISTS'].includes(error?.code);

/**
 * Registra un voto en una transacción: valida la ventana, el candidato y el tope por IP, crea la boleta (falla si este
 * navegador ya votó) y suma al total público. Usado por la Edge Function y por tests/rules/communityVote.test.js.
 * @param {{ firestore, appId: string, vote: ReturnType<typeof parseVote>, ipHash: string, deviceHash: string, now: number }} input
 * @returns {Promise<{ votes: object, total: number }>}
 */
export async function castVote({ firestore, appId, vote, ipHash, deviceHash, now }) {
  const base = `artifacts/${appId}/public/data`;
  const isPrediction = vote.kind === 'prediction';
  const totalsPath = `${base}/${TOTALS_COLLECTION[vote.kind]}/${vote.target}`;
  try {
    return await firestore.runTransaction(async tx => {
      const current = await tx.get(totalsPath);
      let extra = {};
      let stampOpenedAt = false;
      if (isPrediction) {
        const overlay = await tx.get(`${base}/broadcast/overlay`);
        const tournament = await tx.get(`${base}/tournament/official`);
        const window = predictionWindow({ overlay: overlay?.data, prediction: current?.data, matchId: vote.target, tournament: tournament?.data });
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
        extra = { homeTeam: window.homeTeam, awayTeam: window.awayTeam };
      } else if (vote.kind === 'cup') {
        const window = pollWindow(current?.data, vote.choice);
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
      } else {
        const tournament = (await tx.get(`${base}/tournament/official`))?.data;
        const fixtures = roundFixtures(tournament, vote.target);
        const finishedAtMs = [];
        for (const fixture of fixtures) {
          if (!fixture.importedFrom) continue;
          finishedAtMs.push(toMillis((await tx.get(`${base}/live_matches/${fixture.importedFrom}`))?.data?.finishedAt));
        }
        const window = managerWindow({ fixtures, finishedAtMs, openedAtMs: toMillis(current?.data?.openedAt), now });
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
        // El admin puede cerrarla antes de tiempo (Administración → Comunidad): closedAt en el doc de votos.
        if (current?.data?.closedAt) throw new CommunityVoteError('La votación de esta fecha está cerrada.', 409);
        if (!window.candidates.has(vote.choice)) throw new CommunityVoteError('Ese club no jugó esta fecha.');
        if (!current?.data?.openedAt) stampOpenedAt = true;
      }

      const ipPath = `community_ip/${vote.kind}_${vote.target}_${ipHash}`;
      const ipCount = Number((await tx.get(ipPath))?.data?.count) || 0;
      if (ipCount >= MAX_VOTES_PER_IP) throw new CommunityVoteError('Demasiados votos desde esta conexión.', 429);

      // create(): si este navegador ya votó, el commit falla y no se suma nada.
      tx.create(`community_ballots/${vote.kind}_${vote.target}_${deviceHash}`,
        { kind: vote.kind, target: vote.target, choice: String(vote.choice) }, { serverTimestamps: ['createdAt'] });
      tx.set(ipPath, { count: ipCount + 1 }, { serverTimestamps: ['updatedAt'] });
      const votes = addVote(current?.data?.votes, vote.choice);
      const total = Object.values(votes).reduce((sum, n) => sum + Number(n), 0);
      tx.set(totalsPath, { ...(current?.data || {}), ...extra, votes, total },
        { serverTimestamps: stampOpenedAt ? ['updatedAt', 'openedAt'] : ['updatedAt'] });
      return { votes, total };
    });
  } catch (error) {
    if (isDuplicateBallot(error)) {
      // La boleta guarda la opción contada: el navegador muestra esa como «tu voto», no la que tocó recién.
      const ballotPath = `community_ballots/${vote.kind}_${vote.target}_${deviceHash}`;
      const ballot = await firestore.runTransaction(tx => tx.get(ballotPath)).catch(() => null);
      throw new CommunityVoteError(
        { cup: 'Ya votaste en esta encuesta desde este navegador.', manager: 'Ya votaste en esta fecha desde este navegador.' }[vote.kind]
          || 'Ya votaste en este partido desde este navegador.',
        409,
        { code: 'ALREADY_VOTED', choice: ballot?.data?.choice ?? null },
      );
    }
    throw error;
  }
}
