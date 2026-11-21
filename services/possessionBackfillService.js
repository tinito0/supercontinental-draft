import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { needsPossession, possessionPatch } from '../utils/possessionBackfill.js';

/* Administración → Partidos del colector: completa la posesión de los partidos guardados en match_lines antes de que
   match-feed la copiara (utils/possessionBackfill.js). Solo admin (catch-all de firestore.rules). Lee el resumen
   completo de live_matches solo de los partidos a los que les falta. */

const base = `artifacts/${APP_ID}/public/data`;

/**
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{ updated: number, withoutData: number, skipped: number }>}
 *   updated: con posesión; withoutData: el juego no la contó (quedan marcados); skipped: ya la tenían o sin resumen
 */
export async function backfillPossession(onProgress) {
  const snap = await getDocs(collection(db, `${base}/match_lines`));
  const pending = snap.docs.filter(d => needsPossession(d.data()));
  const result = { updated: 0, withoutData: 0, skipped: snap.size - pending.length };
  for (const [index, linesDoc] of pending.entries()) {
    const live = await getDoc(doc(db, `${base}/live_matches/${linesDoc.id}`));
    const patch = possessionPatch(live.exists() ? live.data() : null, linesDoc.data());
    if (!patch) result.skipped += 1;
    else {
      await updateDoc(linesDoc.ref, patch);
      if (patch['home.possession'] == null) result.withoutData += 1;
      else result.updated += 1;
    }
    onProgress?.(index + 1, pending.length);
  }
  return result;
}
