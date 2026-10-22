// Votos del público sin cuenta (docs/COMMUNITY_PLATFORM.md): predicción de quién gana un partido del fixture y MVP de
// un partido en vivo. Las reglas de las ventanas y la validación viven acá, puras; la Edge Function `community-vote`
// las aplica en una transacción. tests/communityVote.test.js.

export const MVP_GRACE_MS = 15 * 60 * 1000;       // el MVP se sigue votando 15 min después del final
export const MAX_VOTES_PER_IP = 8;                 // casas o bares con varios votantes; no es una barrera total
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
const MATCH_KEY = /^\d{8}T\d{6}Z_\d{1,6}-\d{1,6}$/;
const FIXTURE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const POLL_ID = /^[a-z0-9-]{1,40}$/;
const OPTION_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const PREDICTION_CHOICES = ['home', 'draw', 'away'];

export class CommunityVoteError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CommunityVoteError';
    this.status = status;
  }
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
export function predictionWindow({ overlay, prediction, matchId }) {
  if (!overlay || overlay.matchId !== matchId) return { open: false, reason: 'Ese partido no está por jugarse ahora.' };
  if (prediction?.closedAt) return { open: false, reason: 'El partido ya empezó: la predicción está cerrada.' };
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
 * MVP: abierto durante el partido y hasta 15 minutos después del final.
 * @param {{ status, updatedAtMs }} live doc de live_matches (updatedAtMs: última subida del bridge)
 */
export function mvpWindow(live, now) {
  if (!live) return { open: false, reason: 'Ese partido no existe.' };
  if (live.status === 'live') return { open: true };
  if (live.status === 'finished' && Number.isFinite(live.updatedAtMs) && now - live.updatedAtMs <= MVP_GRACE_MS) return { open: true };
  return { open: false, reason: 'La votación del MVP ya cerró.' };
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

/** IP del votante según los encabezados del proxy de Supabase (la primera de x-forwarded-for). */
export function clientIp(headers) {
  const forwarded = headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || headers.get('cf-connecting-ip') || headers.get('x-real-ip') || 'unknown';
}

/**
 * match-feed: cuando el bridge sube un partido EN VIVO, la predicción del partido al aire se cierra y queda vinculada
 * a ese partido del juego (una sola PC: lo que se juega es lo que está al aire). Las subidas de partidos terminados
 * (reintentos del bridge) no cierran nada: el admin ya puede haber puesto al aire el siguiente.
 * @returns {null | { matchId: string, data: object }} qué escribir, o null si no hay nada que cerrar
 */
export function predictionClosure({ liveStatus, matchKey, overlay, prediction }) {
  if (liveStatus !== 'live' || !overlay?.matchId) return null;
  if (prediction?.closedAt) return null;
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
        const window = predictionWindow({ overlay: overlay?.data, prediction: current?.data, matchId: vote.target });
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
        extra = { homeTeam: window.homeTeam, awayTeam: window.awayTeam };
      } else if (vote.kind === 'cup') {
        const window = pollWindow(current?.data, vote.choice);
        if (!window.open) throw new CommunityVoteError(window.reason, 409);
      } else {
        const live = (await tx.get(`${base}/live_matches/${vote.target}`))?.data;
        const window = mvpWindow(live ? { status: live.status, updatedAtMs: toMillis(live.updatedAt) } : null, now);
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
    if (isDuplicateBallot(error)) throw new CommunityVoteError(vote.kind === 'cup' ? 'Ya votaste en esta encuesta desde este navegador.' : 'Ya votaste en este partido desde este navegador.', 409);
    throw error;
  }
}
