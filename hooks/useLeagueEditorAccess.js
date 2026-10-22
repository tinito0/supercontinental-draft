import { useEffect, useState } from 'react';
import { fetchIsLeagueEditor } from '../services/leagueEditorService.js';

/**
 * Si el usuario ve «Web pública» sin ser admin. Solo una pista para la interfaz: firestore.rules deciden cada
 * escritura. El admin ya la ve, así que no se consulta.
 */
export function useLeagueEditorAccess(userId, isAdmin) {
  const [isEditor, setIsEditor] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!userId || isAdmin) { setIsEditor(false); return undefined; }
    fetchIsLeagueEditor(userId).then(result => { if (alive) setIsEditor(result); });
    return () => { alive = false; };
  }, [userId, isAdmin]);
  return isEditor;
}
