// Votos del público sin cuenta: predicción, MVP y encuesta de la copa (Edge Function `community-vote`, docs/COMMUNITY_PLATFORM.md).
// El navegador guarda un id al azar (no identifica a la persona) y lo que ya votó, para mostrar el resultado.
// Sin importar config/supabase.js: la página pública no necesita el cliente de Supabase ni Firebase Auth.
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const SUPABASE_FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

const DEVICE_KEY = 'scl.community.device';
const voteKey = (kind, target) => `scl.community.vote.${kind}.${target}`;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Id del navegador para «un voto por navegador»; sin almacenamiento se crea uno por visita. */
export function getDeviceId() {
  const store = storage();
  try {
    const saved = store?.getItem(DEVICE_KEY);
    if (saved && /^[A-Za-z0-9-]{16,64}$/.test(saved)) return saved;
    const created = crypto.randomUUID();
    store?.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function getMyVote(kind, target) {
  try {
    return storage()?.getItem(voteKey(kind, target)) ?? null;
  } catch {
    return null;
  }
}

function rememberVote(kind, target, choice) {
  try {
    storage()?.setItem(voteKey(kind, target), String(choice));
  } catch {
    // Sin almacenamiento el voto igual cuenta; solo no se recuerda en este navegador.
  }
}

/**
 * @param {{ kind: 'prediction', matchId: string, choice: 'home'|'draw'|'away' } | { kind: 'mvp', matchKey: string, choice: number }
 *   | { kind: 'cup', pollId: string, choice: string }} vote
 * @returns {Promise<{ ok: true, votes, total } | { ok: false, error: string, alreadyVoted?: boolean }>}
 */
export async function sendVote(vote) {
  if (!SUPABASE_FUNCTIONS_URL) return { ok: false, error: 'La votación no está disponible ahora.' };
  const target = { prediction: vote.matchId, mvp: vote.matchKey, cup: vote.pollId }[vote.kind];
  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/community-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vote, deviceId: getDeviceId() }),
    });
    const body = await response.json().catch(() => ({}));
    if (body.ok) {
      rememberVote(vote.kind, target, vote.choice);
      return body;
    }
    // Ya había votado: se recuerda la opción que contó el servidor (body.choice), no la que se tocó ahora. Una
    // respuesta sin choice (función vieja) no guarda nada, así no se marca una opción que no fue la contada.
    if (body.alreadyVoted && body.choice != null) rememberVote(vote.kind, target, body.choice);
    return { ok: false, error: body.error || 'No se pudo registrar el voto.', alreadyVoted: Boolean(body.alreadyVoted), choice: body.choice ?? null };
  } catch {
    return { ok: false, error: 'Sin conexión: probá de nuevo.' };
  }
}
