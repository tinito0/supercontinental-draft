// Shared PES files in Supabase Storage (bucket VITE_SUPABASE_TEXTURE_BUCKET):
//   <workspaceId>/<sha256>.ftex|.dds              kit textures and fonts (content-addressed)
//   <workspaceId>/sources/<sha256>.pesdb|edit|kits original sources uploaded by the Super Admin
// Files are never overwritten; every download is verified against its SHA-256 before use.
import { supabase, supabaseConfigured, TEXTURE_BUCKET, refreshFirebaseClaims } from '../config/supabase.js';
import { sha256Hex } from '../pes/core/fields.js';
import { packSource, unpackSource, sourceSha } from '../pes/storage/sourceArchive.js';

const texturePath = (workspaceId, sha256, ext) => `${workspaceId}/${sha256}${ext || '.ftex'}`;
const sourcePath = (workspaceId, sha256, kind) => `${workspaceId}/sources/${sha256}.${kind}`;

function requireClient() {
  if (!supabaseConfigured) {
    throw new Error('Supabase no está configurado (faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).');
  }
  return supabase;
}

const explain = (error, action) => {
  const msg = error?.message || String(error);
  if (/row-level security|unauthorized|403|jwt|permission|policy/i.test(msg)) {
    return new Error(`${action}: Supabase rechazó el permiso. Tu usuario necesita el claim pes_role (npm run pes:claims -- --apply) y volver a iniciar sesión. Detalle: ${msg}`);
  }
  return new Error(`${action}: ${msg}`);
};

let claimsRefreshed = false;
async function ensureFreshToken() {
  if (claimsRefreshed) return;
  await refreshFirebaseClaims();
  claimsRefreshed = true;
}

async function upload(path, bytes, action) {
  const client = requireClient();
  await ensureFreshToken();
  const { error } = await client.storage.from(TEXTURE_BUCKET).upload(path, bytes, { contentType: 'application/octet-stream', upsert: false });
  // Content-addressed path already present: same content, nothing to do.
  if (error && !/exists|duplicate|409/i.test(`${error.message} ${error.statusCode ?? ''}`)) throw explain(error, action);
}

async function download(path, action) {
  const client = requireClient();
  await ensureFreshToken();
  const { data, error } = await client.storage.from(TEXTURE_BUCKET).download(path);
  if (error) {
    if (/not found|404|object not found/i.test(`${error.message} ${error.statusCode ?? ''}`)) return null;
    throw explain(error, action);
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function uploadTexture(workspaceId, sha256, bytes, ext) {
  if (await sha256Hex(bytes) !== sha256) throw new Error('El hash de la textura no coincide; no se sube.');
  await upload(texturePath(workspaceId, sha256, ext), bytes, 'Subida de textura');
}

export async function downloadTexture(workspaceId, sha256, ext) {
  const bytes = await download(texturePath(workspaceId, sha256, ext), 'Descarga de textura');
  if (!bytes) return null;
  if (await sha256Hex(bytes) !== sha256) throw new Error(`La textura ${sha256.slice(0, 12)}… descargada no coincide con su hash: se descarta.`);
  return bytes;
}

/** Uploads an original source (pesdb / EDIT / kit-server) so every user works on the same files. */
export async function uploadSource(workspaceId, source) {
  if (await sourceSha(source.record) !== source.sha256) throw new Error('El hash de la fuente no coincide; no se sube.');
  await upload(sourcePath(workspaceId, source.sha256, source.kind), packSource(source.record), 'Subida de la base compartida');
}

/** Downloads and verifies a shared source; returns the record IndexedDB stores, or null if absent. */
export async function downloadSource(workspaceId, summary) {
  const bytes = await download(sourcePath(workspaceId, summary.sha256, summary.kind), 'Descarga de la base compartida');
  if (!bytes) return null;
  const record = unpackSource(summary.kind, bytes);
  if (await sourceSha(record) !== summary.sha256) throw new Error(`La fuente ${summary.kind} descargada no coincide con su hash: se descarta.`);
  return record;
}
