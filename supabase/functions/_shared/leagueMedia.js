// Images of the public league site kept in Supabase Storage (function `league-media`): club kits and crests.
// Pure helpers, shared by the function and its tests.

export const LEAGUE_MEDIA_BUCKET = 'league-media';
export const KIT_SLOT_IDS = ['home', 'away', 'third'];
export const MEDIA_LIMITS = {
  kit: 12 * 1024 * 1024,
  crest: 2 * 1024 * 1024,
};
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
// Draft team ids are Firebase uids; anything else would let a caller pick its own folder.
const TEAM_ID = /^[A-Za-z0-9_-]{1,128}$/;

export class LeagueMediaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'LeagueMediaError';
    this.status = status;
  }
}

/**
 * Reads ?kind=kit|crest&team=<id>[&slot=home|away|third] plus the body's type and size.
 * Returns the object path; each upload gets a new name so no cache serves the previous image.
 */
export function parseMediaRequest(params, { contentType, size, now = Date.now() }) {
  const kind = params.get('kind');
  if (!(kind in MEDIA_LIMITS)) throw new LeagueMediaError('Tipo de imagen desconocido.');
  const teamId = params.get('team') ?? '';
  if (!TEAM_ID.test(teamId)) throw new LeagueMediaError('Club inválido.');
  const slot = kind === 'kit' ? params.get('slot') : null;
  if (kind === 'kit' && !KIT_SLOT_IDS.includes(slot)) throw new LeagueMediaError('Camiseta desconocida.');
  const type = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) throw new LeagueMediaError('La imagen tiene que ser PNG, JPG o WEBP.', 415);
  if (!size) throw new LeagueMediaError('La imagen está vacía.');
  if (size > MEDIA_LIMITS[kind]) {
    throw new LeagueMediaError(`La imagen pesa más de ${MEDIA_LIMITS[kind] / (1024 * 1024)} MB.`, 413);
  }
  const stamp = now.toString(36);
  const path = kind === 'kit' ? `kits/${teamId}/${slot}-${stamp}.${ext}` : `crests/${teamId}-${stamp}.${ext}`;
  return { kind, teamId, slot, contentType: type, path };
}

/** Kits: the admin or a web editor (league_editors/{uid}). Crests: the admin only. */
export function canUploadMedia(kind, { isAdmin, isEditor }) {
  if (isAdmin) return true;
  return kind === 'kit' && isEditor;
}

export function publicMediaUrl(supabaseUrl, path) {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${LEAGUE_MEDIA_BUCKET}/${path}`;
}

/**
 * Uploads with the service role key. The public bucket is created on the first upload, so the deploy needs no SQL.
 */
export async function storeMedia({ supabaseUrl, serviceKey, path, contentType, body, fetchImpl = fetch }) {
  const base = supabaseUrl.replace(/\/$/, '');
  const auth = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  const upload = () => fetchImpl(`${base}/storage/v1/object/${LEAGUE_MEDIA_BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': contentType, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
    body,
  });

  let response = await upload();
  if (!response.ok && await isMissingBucket(response)) {
    const created = await fetchImpl(`${base}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: LEAGUE_MEDIA_BUCKET,
        name: LEAGUE_MEDIA_BUCKET,
        public: true,
        file_size_limit: MEDIA_LIMITS.kit,
        allowed_mime_types: Object.keys(EXTENSIONS),
      }),
    });
    // 409: another upload created it first.
    if (!created.ok && created.status !== 409) throw new Error(`bucket create failed: ${created.status} ${await created.text()}`);
    response = await upload();
  }
  if (!response.ok) throw new Error(`upload failed: ${response.status} ${await response.text()}`);
  return publicMediaUrl(base, path);
}

async function isMissingBucket(response) {
  if (response.status !== 404 && response.status !== 400) return false;
  const text = await response.clone().text();
  return /bucket not found/i.test(text);
}
