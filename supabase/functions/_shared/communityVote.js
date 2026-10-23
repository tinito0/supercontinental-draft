// Votos del público sin cuenta (docs/COMMUNITY_PLATFORM.md): predicción de quién gana un partido del fixture y MVP de
// un partido en vivo. Las reglas de las ventanas y la validación viven acá, puras; la Edge Function `community-vote`
// las aplica en una transacción. tests/communityVote.test.js.

export const MVP_GRACE_MS = 15 * 60 * 1000;       // el MVP se sigue votando 15 min después del final
// Un partido «en vivo» sin subidas del bridge durante este tiempo se da por cortado: el MVP deja de votarse
// (antes quedaba abierto para siempre si el bridge se cerraba en medio del partido).
export const LIVE_SIGNAL_MS = 10 * 60 * 1000;
export const MAX_VOTES_PER_IP = 8;                 // casas o bares con varios votantes; no es una barrera total
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
const MATCH_KEY = /^\d{8}T\d{6}Z_\d{1,6}-\d{1,6}$/;
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
  'plata-r1': ['repechaje', 'r1'], 'plata-r2': ['repechaje', 'r2'], 'plata-semis': ['repechaje', 'semis'], 'plata-final': ['repechaje', 'final'],
};

/**
 * Si el partido del fixture (`league-<id>` o `<copa>-<ronda>-<n>`) ya tiene el resultado cargado en el torneo.
 * Poner al aire un partido ya jugado (p. ej. para la escena Final) no debe abrir una predicción.
 */
export function fixtureIsFinished(tournament, matchId) {
  if (!tournament || !matchId) return false;
  if (matchId.startsWith('league-')) {
    const match = (tournament.matches || []).find(item => item?.id === matchId.slice('league-'.length));
    return Boolean(match) && match.status === 'completed' && isScoreValue(match.homeScore) && isScoreValue(match.awayScore);
  }
  const found = /^(oro|plata)-([a-z0-9]+)-(\d+)$/.exec(matchId);
  const path = found && CUP_PATHS[`${found[1]}-${found[2]}`];
  if (!path) return false;
  const node = path.reduce((acc, key) => (acc == null ? undefined : acc[key]), tournament.bracket);
  const tie = Array.isArray(node) ? node[Number(found[3])] : node;
  return Boolean(tie) && isScoreValue(tie.scoreA) && isScoreValue(tie.scoreB);
}

const fail = (message, status) => { throw new CommunityVoteError(message, status); };

/**
 * @param {unknown} body { kind: 'prediction', matchId, choice: 'home'|'draw'|'away', deviceId }
 *                       | { kind: 'mvp', matchKey, choice: playerId, deviceId }
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
  if (body.kind === 'mvp') {
    if (typeof body.matchKey !== 'string' || !MATCH_KEY.test(body.matchKey)) fail('Partido inválido.');
    const playerId = Number(body.choice);
    if (!Number.isInteger(playerId) || playerId <= 0) fail('Jugador inválido.');
    return { kind: 'mvp', target: body.matchKey, choice: playerId, deviceId: body.deviceId };
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
  return { open: true, homeTeam: overlay.homeTeamName || '', awayTeam: overlay.awayTeamName || '' };
}

/** Encuesta de la copa (public/data/polls/{pollId}): la abre y la cierra el admin, con las opciones que carga. */
export function pollWindow(poll, choice) {
  if (!poll) return { open: false, reason: 'Esa encuesta no existe.' };
  if (!poll.open) return { open: false, reason: 'La encuesta está cerrada.' };
  if (!(poll.options || []).some(option => option.id === choice)) return { open: false, reason: 'Esa opción no está en la encuesta.' };
  return { open: true };
}

/** Jugadores que jugaron el partido: titulares y los que entraron, de los dos equipos. */
export function mvpCandidates(summary) {
  const ids = new Set();
  for (const side of ['home', 'away']) {
    for (const id of summary?.lineups?.[side]?.starting || []) ids.add(id);
  }
  for (const sub of summary?.substitutions || []) ids.add(sub.onId);
  return ids;
}

/**
 * MVP: abierto durante el partido (mientras el bridge siga subiendo datos) y hasta 15 minutos después del final.
 * El final es `finishedAt`, que match-feed pone una sola vez: antes se contaba desde la última subida, y reenviar un
 * partido viejo reabría la votación. Docs anteriores sin finishedAt usan la última subida.
 * @param {{ status, updatedAtMs, finishedAtMs? }} live doc de live_matches
 */
export function mvpWindow(live, now) {
  if (!live) return { open: false, reason: 'Ese partido no existe.' };
  if (live.status === 'live') {
    if (Number.isFinite(live.updatedAtMs) && now - live.updatedAtMs > LIVE_SIGNAL_MS) {
      return { open: false, reason: 'Se perdió la conexión con el partido: la votación del MVP está cerrada.' };
    }
    return { open: true };
  }
  const end = Number.isFinite(live.finishedAtMs) ? live.finishedAtMs : live.updatedAtMs;
  if (live.status === 'finished' && Number.isFinite(end) && now - end <= MVP_GRACE_MS) return { open: true };
  return { open: false, reason: 'La votación del MVP ya cerró.' };
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

const TOTALS_COLLECTION = { prediction: 'predictions', mvp: 'mvp_votes', cup: 'polls' };
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
        const live = (await tx.get(`${base}/live_matches/${vote.target}`))?.data;
        const window = mvpWindow(live ? { status: live.status, updatedAtMs: toMillis(live.updatedAt), finishedAtMs: toMillis(live.finishedAt) } : null, now);
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
        let summary = null;
        try { summary = JSON.parse(live.summaryJson); } catch { /* sin resumen no hay candidatos */ }
        if (!mvpCandidates(summary).has(vote.choice)) throw new CommunityVoteError('Ese jugador no jugó este partido.');
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
      tx.set(totalsPath, { ...(current?.data || {}), ...extra, votes, total }, { serverTimestamps: ['updatedAt'] });
      return { votes, total };
    });
  } catch (error) {
    if (isDuplicateBallot(error)) {
      // La boleta guarda la opción contada: el navegador muestra esa como «tu voto», no la que tocó recién.
      const ballotPath = `community_ballots/${vote.kind}_${vote.target}_${deviceHash}`;
      const ballot = await firestore.runTransaction(tx => tx.get(ballotPath)).catch(() => null);
      throw new CommunityVoteError(
        vote.kind === 'cup' ? 'Ya votaste en esta encuesta desde este navegador.' : 'Ya votaste en este partido desde este navegador.',
        409,
        { code: 'ALREADY_VOTED', choice: ballot?.data?.choice ?? null },
      );
    }
    throw error;
  }
}
