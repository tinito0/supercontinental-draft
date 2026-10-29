import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { handleListenerError } from '../utils/listenerErrorHandler.js';

/**
 * Hook to manage private (cart, profile) and public (locks, teams) Firebase data listeners.
 * isCartSynced / isLocksSynced turn true once a snapshot came from the server, not the persistent cache:
 * code that deletes or rewrites data from these lists (hooks/useSquadSync.js) must wait for them.
 */
export function useFirebaseData(
  userId,
  isAuthReady,
  getPrivateCartCollectionRef,
  getPublicLocksCollectionRef,
  getPublicTeamsCollectionRef,
  getPrivateProfileRef,
  setError,
  setIsLoading,
  showNotification
) {
  const [cart, setCart] = useState([]);
  const [isCartSynced, setIsCartSynced] = useState(false);
  const [playerLocks, setPlayerLocks] = useState({});
  const [isLocksLoaded, setIsLocksLoaded] = useState(false);
  const [isLocksSynced, setIsLocksSynced] = useState(false);
  const [allTeams, setAllTeams] = useState({});
  // First teams snapshot (cache or server): until then an empty allTeams means "loading", not "no clubs".
  const [isTeamsLoaded, setIsTeamsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const handleError = useCallback((context, err) => {
    handleListenerError(err, context, showNotification || ((type, msg) => setError?.(msg)), {
      onPermissionDenied: () => {
        setIsLoading?.(false);
        setError?.("Sin permisos para cargar los datos: " + context);
      }
    });
  }, [setError, setIsLoading, showNotification]);

  // Private data: Cart and User Profile
  useEffect(() => {
    if (!isAuthReady || !userId) {
      setCart([]);
      setIsCartSynced(false);
      setUserProfile(null);
      return;
    }

    setIsCartSynced(false);
    let cartSynced = false;
    const unsubCart = onSnapshot(
      getPrivateCartCollectionRef(userId),
      { includeMetadataChanges: true },
      (snap) => {
        // Metadata-only snapshots change no data: only the first server confirmation matters.
        const firstSync = !cartSynced && !snap.metadata.fromCache;
        if (snap.docChanges().length > 0 || firstSync) setCart(snap.docs.map(d => d.data()));
        if (firstSync) {
          cartSynced = true;
          setIsCartSynced(true);
        }
      },
      (err) => handleError("Private Cart", err)
    );

    const unsubProfile = onSnapshot(
      getPrivateProfileRef(userId),
      (doc) => { if (doc.exists()) setUserProfile(doc.data()); },
      (err) => handleError("Private Profile", err)
    );

    return () => {
      unsubCart();
      unsubProfile();
    };
  }, [userId, isAuthReady, getPrivateCartCollectionRef, getPrivateProfileRef, handleError]);

  // Public data: Player Locks and Public Teams
  useEffect(() => {
    if (!isAuthReady) {
      setIsLocksLoaded(false);
      setIsLocksSynced(false);
      setIsTeamsLoaded(false);
      return;
    }

    let locksSynced = false;
    const unsubLocks = onSnapshot(
      getPublicLocksCollectionRef(),
      { includeMetadataChanges: true },
      (snap) => {
        const firstSync = !locksSynced && !snap.metadata.fromCache;
        if (snap.docChanges().length > 0 || firstSync || snap.empty) {
          const data = {};
          snap.docs.forEach(d => data[d.id] = d.data());
          setPlayerLocks(data);
          setIsLocksLoaded(true);
        }
        if (firstSync) {
          locksSynced = true;
          setIsLocksSynced(true);
        }
      },
      (err) => handleError("Public Locks", err)
    );

    const unsubTeams = onSnapshot(
      getPublicTeamsCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setAllTeams(data);
        setIsTeamsLoaded(true);
      },
      (err) => handleError("Public Teams", err)
    );

    return () => {
      unsubLocks();
      unsubTeams();
    };
  }, [isAuthReady, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, handleError]);

  return { cart, isCartSynced, playerLocks, isLocksLoaded, isLocksSynced, allTeams, isTeamsLoaded, userProfile };
}
