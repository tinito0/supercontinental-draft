// Acciones del admin sobre los votos del público (Administración → Comunidad, docs/COMMUNITY_PLATFORM.md).
// Las boletas (community_ballots) y los topes por IP (community_ip) caen en el catch-all de firestore.rules: solo admin.
import { collection, deleteField, doc, documentId, getDocs, increment, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';

const TOTALS_COLLECTION = { prediction: 'predictions', mvp: 'mvp_votes', cup: 'polls' };
const BATCH_LIMIT = 450;
// Último carácter posible para un rango por prefijo de id (U+F8FF, uso privado).
const PREFIX_END = '\uf8ff';
// Las boletas y los topes terminan en el sha-256 en hex: así «a_» no agarra las de otra votación «a_b_…».
const HASH_SUFFIX = /^[0-9a-f]{64}$/;

const totalsRef = (kind, target) => doc(db, `artifacts/${APP_ID}/public/data/${TOTALS_COLLECTION[kind]}/${target}`);

/** Los ids de boletas y topes son `${kind}_${target}_${hash}`: se buscan por prefijo y se queda solo el id exacto. */
async function refsWithPrefix(collectionName, prefix) {
  const snap = await getDocs(query(collection(db, collectionName), where(documentId(), '>=', prefix), where(documentId(), '<', `${prefix}${PREFIX_END}`)));
  return snap.docs.filter(entry => HASH_SUFFIX.test(entry.id.slice(prefix.length))).map(entry => entry.ref);
}

/**
 * Vuelve a cero una votación: totales en 0 y boletas borradas, así cada navegador puede votar de nuevo.
 * Primero los totales: un voto que entra en el medio queda contado (a lo sumo ese navegador vota otra vez).
 * resetCount sube en 1: el navegador lo usa para olvidar el voto que recordaba (communityService.getMyVote).
 * mergeFields y no merge: merge mezclaría `votes` con los conteos viejos en vez de vaciarlo.
 * @returns {Promise<number>} cuántas boletas se borraron
 */
export async function resetCommunityVotes(kind, target) {
  if (!TOTALS_COLLECTION[kind] || !target) throw new Error(`Votación inválida: ${kind}/${target}`);
  await setDoc(totalsRef(kind, target),
    { votes: {}, total: 0, resetCount: increment(1), resetAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { mergeFields: ['votes', 'total', 'resetCount', 'resetAt', 'updatedAt'] });
  const prefix = `${kind}_${target}_`;
  const [ballots, ipCounters] = await Promise.all([refsWithPrefix('community_ballots', prefix), refsWithPrefix('community_ip', prefix)]);
  const refs = [...ballots, ...ipCounters];
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    refs.slice(start, start + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return ballots.length;
}

/** Cierra o reabre a mano una predicción o la votación del MVP (closedAt; community-vote lo respeta). */
export async function setVotingClosed(kind, target, closed) {
  if (!['prediction', 'mvp'].includes(kind) || !target) throw new Error(`Votación inválida: ${kind}/${target}`);
  await setDoc(totalsRef(kind, target), { closedAt: closed ? serverTimestamp() : deleteField(), updatedAt: serverTimestamp() }, { merge: true });
}
