// Market operations that only the server may perform (Supabase Edge Function `market`, see
// supabase/functions/market): signing, releasing a player and accepting a transfer offer. The function checks
// the Firebase ID token, the real prices and the live budgets; firestore.rules reject these writes
// from the browser.
import { auth } from '../config/firebase.js';

// El SDK de Supabase (~200 kB) se carga recién al primer uso (o antes, en segundo plano: app.jsx lo
// precarga cuando el navegador está libre). Importarlo estático lo metía en la carga inicial de toda la app.
export const loadMarketClient = () => import('../config/supabase.js');

const MARKET_FUNCTION = 'market';
const UNAVAILABLE = 'No se pudo contactar al servidor del mercado. Reintentá en unos instantes.';

async function readFunctionError(error) {
  try {
    const body = await error?.context?.json?.();
    return body?.error || null;
  } catch {
    return null;
  }
}

export async function callMarket(action, payload = {}) {
  const { supabase, supabaseConfigured } = await loadMarketClient();
  if (!supabaseConfigured) {
    throw new Error('El mercado no está disponible: falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).');
  }
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Debes iniciar sesión.');

  const { data, error } = await supabase.functions.invoke(MARKET_FUNCTION, {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error((await readFunctionError(error)) || UNAVAILABLE);
  if (!data?.ok) throw new Error(data?.error || UNAVAILABLE);
  return data.result;
}

export const signPlayer = ({ playerId, isFranchise = false }) => callMarket('sign', { playerId, isFranchise });
export const acceptOffer = ({ offerId }) => callMarket('acceptOffer', { offerId });
export const releasePlayer = ({ playerId }) => callMarket('release', { playerId });
/** Moves the signed-in (old email) account's club to the Google account whose ID token is given. */
export const migrateAccount = ({ newIdToken }) => callMarket('migrateAccount', { newIdToken });
/** Admin only: moves the club of `fromUid` to the pending, empty team of `toUid` (market.js transferClub). */
export const transferClub = ({ fromUid, toUid, managerName }) => callMarket('transferClub', { fromUid, toUid, managerName });
