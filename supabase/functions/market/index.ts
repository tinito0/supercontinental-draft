// Supabase Edge Function `market`: signs players and accepts transfer offers on the server, so the
// prices and budgets cannot be forged from the browser. Writes Firestore through its REST API with a
// Firebase service account. Setup and deploy: docs/MARKET_FUNCTION.md.
//
// Secrets (supabase secrets set …):
//   FIREBASE_SERVICE_ACCOUNT  JSON key of a Firebase service account (Cloud Datastore User role)
//   MARKET_ALLOWED_ORIGINS    optional, comma-separated origins allowed by CORS (default: any)
// Deploy with JWT verification off: the caller sends a Firebase ID token, verified here.
import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from 'npm:jose@6.2.12';
import catalog from '../_shared/catalog.json' with { type: 'json' };
import { createFirestore } from '../_shared/firestoreRest.js';
import { FIREBASE_JWKS_URL, verifyFirebaseIdToken, createServiceAccountTokenProvider } from '../_shared/googleAuth.js';
import { handleMarketAction, isMarketAdmin, MarketError } from '../_shared/market.js';
import { APP_ID } from '../_shared/marketConstants.js';

const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const projectId: string = serviceAccount.project_id;
// Quotes are stripped: pasting `"a,b"` into the dashboard stores the quotes as part of the value.
const allowedOrigins = (Deno.env.get('MARKET_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map(o => o.trim().replace(/^["']+|["']+$/g, '').replace(/\/+$/, ''))
  .filter(Boolean);

const keySet = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
const firestore = createFirestore({
  projectId,
  getAccessToken: createServiceAccountTokenProvider({ serviceAccount, SignJWT, importPKCS8 }),
});

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins.length === 0 ? '*' : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(origin, 405, { ok: false, error: 'Método no permitido.' });
  if (!projectId || !serviceAccount.private_key) {
    console.error('market: FIREBASE_SERVICE_ACCOUNT is missing or invalid');
    return reply(origin, 500, { ok: false, error: 'El mercado no está configurado en el servidor.' });
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  let user;
  try {
    const { uid, claims } = await verifyFirebaseIdToken(token, { projectId, jwtVerify, keySet });
    user = { uid, isAdmin: isMarketAdmin(uid, claims) };
  } catch {
    return reply(origin, 401, { ok: false, error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return reply(origin, 400, { ok: false, error: 'Pedido inválido.' });
  }

  try {
    const result = await handleMarketAction({ firestore, appId: APP_ID, catalog, user, body });
    return reply(origin, 200, { ok: true, result });
  } catch (error) {
    if (error instanceof MarketError) return reply(origin, error.status, { ok: false, error: error.message });
    console.error('market: unexpected error', error);
    return reply(origin, 500, { ok: false, error: 'No se pudo completar la operación. Reintentá en unos instantes.' });
  }
});
