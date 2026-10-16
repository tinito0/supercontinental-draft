import { useEffect, useMemo } from 'react';
import { deleteDoc, setDoc } from 'firebase/firestore';
import { buildPublicRoster, isSameRoster, reconcileCart } from '../utils/squadSync.js';

/**
 * Keeps the signed-in manager's data in line with player_locks (written by the market function):
 * - private cart: adds players the team now owns (e.g. bought in a transfer), drops players sold to
 *   another team (rows without any lock are kept: utils/squadSync.js);
 * - profile budget: copies teams/{uid}.budget, which the server changes on transfers;
 * - public roster (teams/{uid}.roster): rewritten only when it actually differs.
 * Nothing is written until cart and locks come from the server, not the local cache.
 * Returns needsCatalog: the team owns players the cart cannot describe until the catalog loads.
 */
export function useSquadSync({
  userId, userProfile, cart, isCartSynced, playerLocks, isLocksSynced, allTeams, playerById,
  getPrivateCartDocRef, getPrivateProfileRef, getPublicTeamRef,
}) {
  const isReady = Boolean(userId && userProfile && isCartSynced && isLocksSynced);

  const plan = useMemo(
    () => (isReady ? reconcileCart({ playerLocks, cart, uid: userId, playerById }) : null),
    [isReady, playerLocks, cart, userId, playerById],
  );

  useEffect(() => {
    if (!plan) return;
    plan.toAdd.forEach(({ playerId, data }) => {
      setDoc(getPrivateCartDocRef(userId, playerId), data)
        .catch(err => console.error('No se pudo agregar al plantel un jugador propio:', err));
    });
    plan.toRemove.forEach(playerId => {
      deleteDoc(getPrivateCartDocRef(userId, playerId))
        .catch(err => console.error('No se pudo quitar del plantel un jugador que ya no es propio:', err));
    });
  }, [plan, userId, getPrivateCartDocRef]);

  const publicBudget = Number(allTeams?.[userId]?.budget);
  const privateBudget = Number(userProfile?.budget);
  useEffect(() => {
    if (!userId || !userProfile || !Number.isFinite(publicBudget) || publicBudget === privateBudget) return;
    setDoc(getPrivateProfileRef(userId), { budget: publicBudget }, { merge: true })
      .catch(err => console.error('No se pudo sincronizar el presupuesto del perfil:', err));
  }, [userId, userProfile, publicBudget, privateBudget, getPrivateProfileRef]);

  const storedRoster = allTeams?.[userId]?.roster;
  useEffect(() => {
    if (!isReady || !allTeams?.[userId]) return;
    const roster = buildPublicRoster({ playerLocks, cart, uid: userId, playerById, userProfile });
    if (!roster || isSameRoster(storedRoster, roster)) return;
    setDoc(getPublicTeamRef(userId), { roster, rosterUpdatedAt: new Date().toISOString() }, { merge: true })
      .catch(err => console.error('No se pudo sincronizar la plantilla pública:', err));
  }, [isReady, playerLocks, cart, userId, playerById, userProfile, storedRoster, allTeams, getPublicTeamRef]);

  return { needsCatalog: Boolean(plan?.missingCatalog.length) };
}
