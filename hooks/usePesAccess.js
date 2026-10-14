import { useEffect, useState } from 'react';
import { fetchPesRole } from '../services/pesWorkspaceService.js';

/**
 * Whether the user may see the PES editor entry. Only a UI hint: the screen re-checks the
 * role and firestore.rules enforce every read and write.
 */
export function usePesAccess(userId, isAdmin) {
  const [hasAccess, setHasAccess] = useState(Boolean(isAdmin));
  useEffect(() => {
    let alive = true;
    if (!userId) { setHasAccess(false); return undefined; }
    fetchPesRole(userId, isAdmin).then(r => { if (alive) setHasAccess(Boolean(r)); });
    return () => { alive = false; };
  }, [userId, isAdmin]);
  return hasAccess;
}
