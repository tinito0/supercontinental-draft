// Supabase Edge Function `match-feed`: receives match summaries from the local PES bridge
// (pes-collector/bridge/bridge.mjs) and writes artifacts/{APP_ID}/public/data/live_matches/{matchKey}.
// Setup and deploy: docs/MATCH_FEED.md.
//
// Secrets (supabase secrets set …):
//   FIREBASE_SERVICE_ACCOUNT  same service account as `market`
//   MATCH_FEED_TOKEN          random string (≥ 32 chars) shared with the bridge; only allows these writes
// Deploy with JWT verification off: the bridge is not a Supabase or Firebase user, it sends MATCH_FEED_TOKEN.
import { SignJWT, importPKCS8 } from 'npm:jose@6.2.12';
import { createFirestore } from '../_shared/firestoreRest.js';
import { createServiceAccountTokenProvider } from '../_shared/googleAuth.js';
import { buildLiveMatchDoc, isBridgeToken, MatchFeedError } from '../_shared/matchFeed.js';
import { finishedAtFor, predictionClosure } from '../_shared/communityVote.js';
import { DEFAULT_SITE_URL, liveOverlayUpdate } from '../_shared/overlayControl.js';
import { APP_ID } from '../_shared/marketConstants.js';

const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const projectId: string = serviceAccount.project_id;
const bridgeToken = Deno.env.get('MATCH_FEED_TOKEN') ?? '';
const siteUrl = Deno.env.get('OVERLAY_SITE_URL') || DEFAULT_SITE_URL;

const firestore = createFirestore({
  projectId,
  getAccessToken: createServiceAccountTokenProvider({ serviceAccount, SignJWT, importPKCS8 }),
});

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Método no permitido.' });
  if (!projectId || !serviceAccount.private_key) {
    console.error('match-feed: FIREBASE_SERVICE_ACCOUNT is missing or invalid');
    return reply(500, { ok: false, error: 'El servidor no está configurado.' });
  }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!isBridgeToken(token, bridgeToken)) return reply(401, { ok: false, error: 'No autorizado.' });

  try {
    const doc = buildLiveMatchDoc(await req.json());
    const base = `artifacts/${APP_ID}/public/data`;
    await firestore.runTransaction(async tx => {
      const overlayPath = `${base}/broadcast/overlay`;
      const overlay = (await tx.get(overlayPath))?.data;
      const livePath = `${base}/live_matches/${doc.matchKey}`;
      // finishedAt se escribe una sola vez, la primera vez que llega el partido terminado: la ventana del MVP cuenta
      // desde ahí y no se corre con cada subida posterior del bridge.
      const finished = finishedAtFor((await tx.get(livePath))?.data, doc.status);
      if (finished.keep) doc.finishedAt = finished.keep;
      // Partido en vivo → se cierra la predicción del partido al aire (docs/COMMUNITY_PLATFORM.md).
      let closure = null;
      if (doc.status === 'live' && overlay?.matchId) {
        const prediction = await tx.get(`${base}/predictions/${overlay.matchId}`);
        closure = predictionClosure({ liveStatus: doc.status, matchKey: doc.matchKey, overlay, prediction: prediction?.data, liveDoc: doc });
      }
      // Escenas con datos en vivo y popup «Votá el MVP» en el entretiempo y al final (solo los campos que cambian).
      const overlayUpdate = liveOverlayUpdate({ doc, overlay, siteUrl, now: Date.now() });
      tx.set(livePath, doc, { serverTimestamps: finished.stamp ? ['updatedAt', 'finishedAt'] : ['updatedAt'] });
      if (closure) tx.set(`${base}/predictions/${closure.matchId}`, closure.data, { serverTimestamps: ['closedAt', 'updatedAt'] });
      if (overlayUpdate) tx.set(overlayPath, overlayUpdate.data, { mask: overlayUpdate.mask });
    });
    return reply(200, { ok: true, matchKey: doc.matchKey, status: doc.status });
  } catch (error) {
    if (error instanceof MatchFeedError) return reply(error.status, { ok: false, error: error.message });
    if (error instanceof SyntaxError) return reply(400, { ok: false, error: 'JSON inválido.' });
    console.error('match-feed: write failed', error);
    return reply(502, { ok: false, error: 'No se pudo guardar el partido.' });
  }
});
