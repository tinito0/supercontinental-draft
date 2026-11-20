import { deleteField, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { KIT_SLOTS, clubStoryDocId } from '../utils/leagueContent.js';

/* Camisetas de la página de un club: la imagen va a Firebase Storage (league_kits/{teamId}/…, storage.rules) y su link
   a la ficha del club (league_content/club-{teamId}.profile.kits.{slot}). Lo usan Administración → Web pública y el
   botón «Publicar en el club» del visor 3D. Admin o editor de la web. */

const SLOT_IDS = KIT_SLOTS.map(([slot]) => slot);
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MAX_KIT_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * Sube la imagen de una camiseta y devuelve su link público. Un nombre nuevo por subida: el link viejo deja de
 * usarse y ninguna caché muestra la imagen anterior.
 * @param {string} teamId id del club (el del draft)
 * @param {'home'|'away'|'third'} slot
 * @param {Blob} image png, jpg o webp, hasta 12 MB
 */
export async function uploadClubKitImage(teamId, slot, image) {
  if (!SLOT_IDS.includes(slot)) throw new Error(`Camiseta desconocida: ${slot}`);
  const ext = EXTENSIONS[image?.type];
  if (!ext) throw new Error('La imagen tiene que ser PNG, JPG o WEBP.');
  if (image.size > MAX_KIT_IMAGE_BYTES) throw new Error('La imagen pesa más de 12 MB.');
  const fileRef = ref(storage, `league_kits/${teamId}/${slot}-${Date.now().toString(36)}.${ext}`);
  const snapshot = await uploadBytes(fileRef, image, { contentType: image.type, cacheControl: 'public, max-age=31536000, immutable' });
  return getDownloadURL(snapshot.ref);
}

/**
 * Pone (o saca, con url '') el link de una camiseta en la ficha del club sin tocar el resto del documento:
 * mergeFields sobre profile.kits.{slot}, con updatedAt/updatedBy como piden las reglas.
 */
export async function setClubKit(teamId, slot, url) {
  if (!SLOT_IDS.includes(slot)) throw new Error(`Camiseta desconocida: ${slot}`);
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Tenés que iniciar sesión.');
  const docRef = doc(db, `artifacts/${APP_ID}/public/data/league_content/${clubStoryDocId(teamId)}`);
  await setDoc(docRef, { profile: { kits: { [slot]: url || deleteField() } }, updatedAt: serverTimestamp(), updatedBy: uid },
    { mergeFields: [`profile.kits.${slot}`, 'updatedAt', 'updatedBy'] });
}
