import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { APP_ID } from '../utils/constants.js';
import { draftUrl } from '../utils/siteRoutes.js';

const sharedPath = () => `artifacts/${APP_ID}/public/data/shared_formations`;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and insecure contexts have no async clipboard.
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch { return false; }
  }
}

/**
 * The board's public link (audit PIZ-10): one document per club (shared_formations/{teamId}), so sharing again
 * updates the same link and «Dejar de compartir» revokes it, together with the one-off links made before.
 * `beforeShare` resolves false to stop (the board is not saved); `buildSnapshot` returns the document.
 */
export function useBoardShare({ db, teamId, buildSnapshot, beforeShare, showStatusMessage }) {
  const [shareUrl, setShareUrl] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!db || !teamId) return undefined;
    let alive = true;
    getDoc(doc(db, sharedPath(), teamId))
      .then(snap => { if (alive && snap.exists()) setShareUrl(draftUrl(`/tactics/view/${teamId}`)); })
      .catch(err => console.error('Link público de la táctica:', err));
    return () => { alive = false; };
  }, [db, teamId]);

  const run = useCallback(async task => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    try { await task(); } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }, []);

  const share = useCallback(() => run(async () => {
    if (!teamId) return;
    if (beforeShare && !(await beforeShare())) {
      showStatusMessage?.('error', 'Primero guardá la táctica: el link tiene que mostrar lo que guardaste.');
      return;
    }
    try {
      await setDoc(doc(db, sharedPath(), teamId), buildSnapshot());
      const url = draftUrl(`/tactics/view/${teamId}`);
      setShareUrl(url);
      setCopied(await copyText(url));
    } catch (err) {
      console.error('Error al compartir la táctica:', err);
      showStatusMessage?.('error', 'No se pudo generar el link público. Reintentá en unos instantes.');
    }
  }), [run, teamId, beforeShare, db, buildSnapshot, showStatusMessage]);

  const unshare = useCallback(() => run(async () => {
    try {
      const legacy = await getDocs(query(collection(db, sharedPath()), where('createdBy', '==', teamId)));
      await Promise.all([doc(db, sharedPath(), teamId), ...legacy.docs.map(d => d.ref)].map(ref => deleteDoc(ref)));
      setShareUrl('');
      setCopied(false);
      showStatusMessage?.('success', 'Dejaste de compartir la táctica: el link ya no abre.');
    } catch (err) {
      console.error('Error al dejar de compartir la táctica:', err);
      showStatusMessage?.('error', 'No se pudo quitar el link público. Reintentá en unos instantes.');
    }
  }), [run, db, teamId, showStatusMessage]);

  const copyAgain = useCallback(async () => setCopied(await copyText(shareUrl)), [shareUrl]);

  return { shareUrl, isShared: Boolean(shareUrl), isBusy, copied, share, unshare, copyAgain, resetCopied: () => setCopied(false) };
}
