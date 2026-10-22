import { collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';

/* Editores de la web pública: managers a los que el admin les permite editar solo los textos de la liga
   (Administración → Web pública). Un documento por usuario en artifacts/{APP_ID}/league_editors/{uid};
   firestore.rules les deja escribir únicamente league_content. */

const EDITORS_PATH = `artifacts/${APP_ID}/league_editors`;

const editorRef = uid => doc(db, EDITORS_PATH, uid);

/** Si el usuario es editor de la web. Un error de lectura cuenta como «no» (las reglas igual deciden). */
export async function fetchIsLeagueEditor(uid) {
  if (!uid) return false;
  try {
    return (await getDoc(editorRef(uid))).exists();
  } catch (error) {
    console.warn('[leagueEditorService] no se pudo leer el rol de editor', error?.code || error);
    return false;
  }
}

/** Lista de editores, en vivo (solo el admin la puede leer). @returns {() => void} */
export function subscribeLeagueEditors(onChange, onError) {
  return onSnapshot(
    collection(db, EDITORS_PATH),
    snapshot => onChange(snapshot.docs.map(item => ({ uid: item.id, ...item.data() }))),
    onError,
  );
}

export function grantLeagueEditor(uid, teamName, grantedBy) {
  return setDoc(editorRef(uid), { teamName: String(teamName || '').slice(0, 80), grantedBy: grantedBy || null, grantedAt: serverTimestamp() });
}

export function revokeLeagueEditor(uid) {
  return deleteDoc(editorRef(uid));
}
