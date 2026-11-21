// Supabase Edge Function `league-media`: uploads club kits and crests of the league site to the public bucket
// `league-media` (_shared/leagueMedia.js). The caller sends its Firebase ID token; kits accept the admin or a web
// editor (league_editors/{uid} in Firestore), crests only the admin.
//   POST ?kind=kit&team=<id>&slot=home|away|third   body: the image (png, jpg, webp)
//   POST ?kind=crest&team=<id>
// Secrets: FIREBASE_SERVICE_ACCOUNT (already set for the other functions). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY come with every Edge Function. Optional: COMMUNITY_ALLOWED_ORIGINS (comma separated).
// Deploy with --no-verify-jwt: the token is Firebase's, not Supabase's.
import { jwtVerify, createRemoteJWKSet, SignJWT, importPKCS8 } from 'npm:jose@6.2.12';
import { createFirestore } from '../_shared/firestoreRest.js';
import { FIREBASE_JWKS_URL, verifyFirebaseIdToken, createServiceAccountTokenProvider } from '../_shared/googleAuth.js';
import { isMarketAdmin } from '../_shared/market.js';
import { APP_ID } from '../_shared/marketConstants.js';
import { canUploadMedia, LeagueMediaError, MEDIA_LIMITS, parseMediaRequest, storeMedia } from '../_shared/leagueMedia.js';

const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const projectId: string = serviceAccount.project_id;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const allowedOrigins = (Deno.env.get('COMMUNITY_ALLOWED_ORIGINS') || 'https://supercontinental-draft.vercel.app')
  .split(',').map(origin => origin.trim()).filter(Boolean);

const keySet = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
const firestore = createFirestore({
  projectId,
  getAccessToken: createServiceAccountTokenProvider({ serviceAccount, SignJWT, importPKCS8 }),
});

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    Vary: 'Origin',
  };
}

async function isLeagueEditor(uid: string): Promise<boolean> {
  const doc = await firestore.runTransaction(tx => tx.get(`artifacts/${APP_ID}/league_editors/${uid}`));
  return Boolean(doc);
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Método no permitido.' });
  if (!projectId || !serviceAccount.private_key || !supabaseUrl || !serviceKey) {
    console.error('league-media: FIREBASE_SERVICE_ACCOUNT or the Supabase env is missing');
    return reply(500, { ok: false, error: 'El servidor no está configurado.' });
  }

  let user;
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { uid, claims } = await verifyFirebaseIdToken(token, { projectId, jwtVerify, keySet });
    user = { uid, isAdmin: isMarketAdmin(uid, claims) };
  } catch {
    return reply(401, { ok: false, error: 'Sesión inválida o vencida. Volvé a iniciar sesión.' });
  }

  try {
    const params = new URL(req.url).searchParams;
    const declared = Number(req.headers.get('Content-Length') ?? 0);
    if (declared > MEDIA_LIMITS.kit) throw new LeagueMediaError('La imagen es demasiado pesada.', 413);
    const body = new Uint8Array(await req.arrayBuffer());
    const media = parseMediaRequest(params, { contentType: req.headers.get('Content-Type'), size: body.byteLength });
    const isEditor = !user.isAdmin && media.kind === 'kit' ? await isLeagueEditor(user.uid) : false;
    if (!canUploadMedia(media.kind, { isAdmin: user.isAdmin, isEditor })) {
      return reply(403, { ok: false, error: 'No tenés permiso para subir esta imagen.' });
    }
    const url = await storeMedia({ supabaseUrl, serviceKey, path: media.path, contentType: media.contentType, body });
    return reply(200, { ok: true, url });
  } catch (error) {
    if (error instanceof LeagueMediaError) return reply(error.status, { ok: false, error: error.message });
    console.error('league-media: failed', error);
    return reply(502, { ok: false, error: 'No se pudo subir la imagen. Probá de nuevo.' });
  }
});
