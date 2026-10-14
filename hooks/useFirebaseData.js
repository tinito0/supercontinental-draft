import { useState, useEffect, useCallback } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { handleListenerError } from '../utils/listenerErrorHandler.js';

/**
 * Hook to manage private (cart, profile) and public (locks, teams) Firebase data listeners.
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
  const [playerLocks, setPlayerLocks] = useState({});
  const [isLocksLoaded, setIsLocksLoaded] = useState(false);
  const [allTeams, setAllTeams] = useState({});
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
      setUserProfile(null);
      return;
    }

    const unsubCart = onSnapshot(
      getPrivateCartCollectionRef(userId),
      (snap) => setCart(snap.docs.map(d => d.data())),
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
      return;
    }

    const unsubLocks = onSnapshot(
      getPublicLocksCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setPlayerLocks(data);
        setIsLocksLoaded(true);
      },
      (err) => handleError("Public Locks", err)
    );

    const unsubTeams = onSnapshot(
      getPublicTeamsCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setAllTeams(data);
      },
      (err) => handleError("Public Teams", err)
    );

    return () => {
      unsubLocks();
      unsubTeams();
    };
  }, [isAuthReady, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, handleError]);

  return { cart, playerLocks, isLocksLoaded, allTeams, userProfile };
}
