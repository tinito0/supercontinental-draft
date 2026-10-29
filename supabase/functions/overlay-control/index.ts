// Supabase Edge Function `overlay-control`: cambia el overlay de OBS (escena, popup con QR, elementos visibles)
// desde la PC del streaming. La llama pes-collector/bridge/obs.mjs, que Macro Deck ejecuta con un botón.
// Escribe artifacts/{APP_ID}/public/data/broadcast/overlay (solo los campos del comando). Ver docs/MATCH_FEED.md.
//
// Secrets: FIREBASE_SERVICE_ACCOUNT y MATCH_FEED_TOKEN (los mismos de match-feed: el token ya identifica a esa PC).
// Opcional: OVERLAY_SITE_URL (default https://supercont-d62df.web.app), base de los enlaces del QR.
// Deploy con --no-verify-jwt, igual que match-feed.
import { SignJWT, importPKCS8 } from 'npm:jose@6.2.12';
import { createFirestore } from '../_shared/firestoreRest.js';
import { createServiceAccountTokenProvider } from '../_shared/googleAuth.js';
import { isBridgeToken } from '../_shared/matchFeed.js';
import { buildOverlayCommand, DEFAULT_SITE_URL, OverlayCommandError } from '../_shared/overlayControl.js';
import { APP_ID } from '../_shared/marketConstants.js';

const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const projectId: string = serviceAccount.project_id;
const bridgeToken = Deno.env.get('MATCH_FEED_TOKEN') ?? '';
const siteUrl = Deno.env.get('OVERLAY_SITE_URL') || DEFAULT_SITE_URL;
const MAX_BODY_BYTES = 4096;

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
    console.error('overlay-control: FIREBASE_SERVICE_ACCOUNT is missing or invalid');
    return reply(500, { ok: false, error: 'El servidor no está configurado.' });
  }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!isBridgeToken(token, bridgeToken)) return reply(401, { ok: false, error: 'No autorizado.' });

  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: 'Comando demasiado grande.' });
    const { data, mask, summary } = buildOverlayCommand(JSON.parse(text), { siteUrl, now: Date.now() });
    await firestore.runTransaction(async tx => {
      // mask = solo los campos del comando: el resto del overlay (partido, rótulos) queda como está.
      tx.set(`artifacts/${APP_ID}/public/data/broadcast/overlay`, { ...data, updatedBy: 'overlay-control' }, {
        mask: [...mask, 'updatedBy'],
        serverTimestamps: ['updatedAt'],
      });
    });
    return reply(200, { ok: true, summary });
  } catch (error) {
    if (error instanceof OverlayCommandError) return reply(400, { ok: false, error: error.message });
    if (error instanceof SyntaxError) return reply(400, { ok: false, error: 'JSON inválido.' });
    console.error('overlay-control: write failed', error);
    return reply(502, { ok: false, error: 'No se pudo cambiar el overlay.' });
  }
});
