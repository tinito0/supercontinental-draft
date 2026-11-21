import { auth } from '../config/firebase.js';

/* Kits and crests of the league site go to Supabase Storage through the Edge Function `league-media`
   (supabase/functions/_shared/leagueMedia.js), which checks the Firebase session: kits for the admin or a web
   editor, crests for the admin. Returns the image's public link. */

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const EXTENSIONS = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_KIT_IMAGE_BYTES = 12 * 1024 * 1024;

async function uploadLeagueMedia(query, image) {
  if (!SUPABASE_URL) throw new Error('Falta configurar Supabase (VITE_SUPABASE_URL) para subir imágenes.');
  if (!EXTENSIONS.includes(image?.type)) throw new Error('La imagen tiene que ser PNG, JPG o WEBP.');
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Iniciá sesión para subir imágenes.');
  const response = await fetch(`${SUPABASE_URL}/functions/v1/league-media?${new URLSearchParams(query)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.type },
    body: image,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) throw new Error(result.error || 'No se pudo subir la imagen.');
  return result.url;
}

/** @param {'home'|'away'|'third'} slot */
export function uploadClubKitImage(teamId, slot, image) {
  if (image?.size > MAX_KIT_IMAGE_BYTES) return Promise.reject(new Error('La imagen pesa más de 12 MB.'));
  return uploadLeagueMedia({ kind: 'kit', team: teamId, slot }, image);
}

export function uploadClubCrest(teamId, image) {
  return uploadLeagueMedia({ kind: 'crest', team: teamId }, image);
}
