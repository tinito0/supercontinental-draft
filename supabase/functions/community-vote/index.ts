// Supabase Edge Function `community-vote`: votos del público sin cuenta (docs/COMMUNITY_PLATFORM.md).
//   prediction → public/data/predictions/{matchId}   (partido del fixture al aire en el overlay, antes de empezar)
//   mvp        → public/data/mvp_votes/{matchKey}     (partido en vivo del bridge, hasta 15 min después del final)
//   cup        → public/data/polls/{pollId}           (encuesta «¿quién gana la copa?», abierta por el admin)
// Un voto por navegador y partido (boleta create-only en community_ballots) y un tope por IP (community_ip). El id del
// navegador y la IP se guardan solo como hash con COMMUNITY_SALT. Las reglas validan en _shared/communityVote.js.
//
// Secrets: FIREBASE_SERVICE_ACCOUNT, COMMUNITY_SALT (≥ 32 caracteres al azar). Opcional: COMMUNITY_ALLOWED_ORIGINS
// (coma; default la web de producción). Deploy con --no-verify-jwt: la llama el navegador de cualquier visitante.
import { SignJWT, importPKCS8 } from 'npm:jose@6.2.12';
import { createFirestore } from '../_shared/firestoreRest.js';
import { createServiceAccountTokenProvider } from '../_shared/googleAuth.js';
import { castVote, clientIp, CommunityVoteError, parseVote, saltedHash } from '../_shared/communityVote.js';
import { APP_ID } from '../_shared/marketConstants.js';

const serviceAccount = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
const projectId: string = serviceAccount.project_id;
const salt = Deno.env.get('COMMUNITY_SALT') ?? '';
const allowedOrigins = (Deno.env.get('COMMUNITY_ALLOWED_ORIGINS') || 'https://supercont-d62df.web.app,https://supercont-d62df.firebaseapp.com')
  .split(',').map(origin => origin.trim()).filter(Boolean);
const MAX_BODY_BYTES = 1024;

const firestore = createFirestore({
  projectId,
  getAccessToken: createServiceAccountTokenProvider({ serviceAccount, SignJWT, importPKCS8 }),
});

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && (allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Método no permitido.' });
  if (!projectId || !serviceAccount.private_key || salt.length < 32) {
    console.error('community-vote: FIREBASE_SERVICE_ACCOUNT or COMMUNITY_SALT missing');
    return reply(500, { ok: false, error: 'El servidor no está configurado.' });
  }
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: 'Voto demasiado grande.' });
    const vote = parseVote(JSON.parse(text));
    const [ipHash, deviceHash] = await Promise.all([saltedHash(clientIp(req.headers), salt), saltedHash(vote.deviceId, salt)]);
    const result = await castVote({ firestore, appId: APP_ID, vote, ipHash, deviceHash, now: Date.now() });
    return reply(200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof CommunityVoteError) {
      // Código estable (no el texto en castellano) y la opción que quedó contada para este navegador.
      const alreadyVoted = error.code === 'ALREADY_VOTED';
      return reply(error.status, { ok: false, error: error.message, code: error.code, alreadyVoted, ...(alreadyVoted ? { choice: error.choice } : {}) });
    }
    if (error instanceof SyntaxError) return reply(400, { ok: false, error: 'JSON inválido.' });
    console.error('community-vote: failed', error);
    return reply(502, { ok: false, error: 'No se pudo registrar el voto. Probá de nuevo.' });
  }
});
