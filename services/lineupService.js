// Lineup saves go through the Edge Function `market` (supabase/functions/_shared/lineup.js), which checks the bench
// rule against player_locks and config/squadRules. firestore.rules reject `lineup` and `matchBench` from the browser.
import { auth } from '../config/firebase.js';
import { loadMarketClient } from './marketService.js';

const MARKET_FUNCTION = 'market';
const UNAVAILABLE = 'No se pudo contactar al servidor. Reintentá en unos instantes.';
const FUNCTION_OUTDATED = 'El servidor todavía no guarda formaciones: hay que volver a publicar la función market.';

/** Error from the function, with its `code` ('bench-below-minimum', 'lineup-invalid', …) and `details`. */
export class LineupError extends Error {
  constructor(message, { code = 'unavailable', status = 0, details = null } = {}) {
    super(message);
    this.name = 'LineupError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function readErrorBody(error) {
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

async function callLineupAction(action, payload) {
  const { supabase, supabaseConfigured } = await loadMarketClient();
  if (!supabaseConfigured) throw new LineupError('Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).', { code: 'not-configured' });
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new LineupError('Debes iniciar sesión.', { code: 'unauthenticated', status: 401 });

  const { data, error } = await supabase.functions.invoke(MARKET_FUNCTION, {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = error ? await readErrorBody(error) : data;
  if (!error && body?.ok) return body.result;
  if (body?.error === 'Acción desconocida.') throw new LineupError(FUNCTION_OUTDATED, { code: 'function-outdated', status: 400 });
  throw new LineupError(body?.error || UNAVAILABLE, {
    code: body?.code || (body?.error ? 'rejected' : 'unavailable'),
    status: error?.context?.status ?? 0,
    details: body?.details ?? null,
  });
}

/**
 * Saves the starting XI and the board in one server write, replacing each field whole (mergeFields semantics) on
 * users/{uid}/profile/data and teams/{uid}.
 * @param {{ lineup: Record<string, string>, teamId?: string, formation?: string, dorsals?: object, setPieces?: object,
 *   tactics?: object, availability?: object, formationStates?: object|null, advancedInstructions?: object|null }} input
 *   `teamId` defaults to the signed-in user; another club needs an admin. `matchBench` is computed by the server.
 * @returns {Promise<{ teamId: string, saved: object, dropped: string[],
 *   bench: { applies: boolean, average: number|null, min: number, benchCount: number } }>}
 *   `saved` is exactly what was written (use it for formationSignature); `dropped` lists starters the club no longer owns.
 * @throws {LineupError} code 'bench-below-minimum' (details { average, min, benchCount }), 'lineup-invalid',
 *   'forbidden', 'team-not-found', 'function-outdated', 'unauthenticated', 'not-configured', 'unavailable'.
 */
export function saveLineup({ lineup, teamId, ...boardFields }) {
  return callLineupAction('saveLineup', { lineup, ...(teamId ? { teamId } : {}), ...boardFields });
}

/** Admin only: squad size, bench and locals of every approved club, as the server reads them. */
export function fetchSquadCompliance() {
  return callLineupAction('squadCompliance', {});
}
