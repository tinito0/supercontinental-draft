import { useState, useEffect, useCallback, useRef } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { handleListenerError } from '../utils/listenerErrorHandler.js';

const INITIAL_RETRY_KEYS = Object.freeze({ teams: 0, locks: 0, profile: 0 });

/** Which listeners are in 'error' and so need a new subscription. */
export function listenersToRetry({ teams, locks, profile }) {
  return { teams: teams === 'error', locks: locks === 'error', profile: profile === 'error' };
}

/** New retry keys: only the listeners in 'error' get their key bumped. */
export function bumpRetryKeys(keys, statuses) {
  const failed = listenersToRetry(statuses);
  return {
    teams: keys.teams + (failed.teams ? 1 : 0),
    locks: keys.locks + (failed.locks ? 1 : 0),
    profile: keys.profile + (failed.profile ? 1 : 0),
  };
}

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
  // 'loading' | 'ready' | 'error' per listener: an empty list after an error must not read as "no data".
  const [teamsStatus, setTeamsStatus] = useState('loading');
  const [locksStatus, setLocksStatus] = useState('loading');
  const [profileStatus, setProfileStatus] = useState('loading');
  // Bumping a key tears that listener down and subscribes again; the others keep running.
  const [retryKeys, setRetryKeys] = useState(INITIAL_RETRY_KEYS);
  const statusesRef = useRef({ teams: 'loading', locks: 'loading', profile: 'loading' });
  statusesRef.current = { teams: teamsStatus, locks: locksStatus, profile: profileStatus };
  const retryFirebaseData = useCallback(
    () => setRetryKeys(keys => bumpRetryKeys(keys, statusesRef.current)),
    [],
  );

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
      setProfileStatus('loading');
      return;
    }

    setIsCartSynced(false);
    setProfileStatus('loading');
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
      (doc) => {
        if (doc.exists()) setUserProfile(doc.data());
        setProfileStatus('ready');
      },
      (err) => { setProfileStatus('error'); handleError("Private Profile", err); }
    );

    return () => {
      unsubCart();
      unsubProfile();
    };
  }, [userId, isAuthReady, getPrivateCartCollectionRef, getPrivateProfileRef, handleError, retryKeys.profile]);

  // Public player locks
  useEffect(() => {
    if (!isAuthReady) {
      setIsLocksLoaded(false);
      setIsLocksSynced(false);
      setLocksStatus('loading');
      return;
    }

    setLocksStatus('loading');
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
          setLocksStatus('ready');
        }
        if (firstSync) {
          locksSynced = true;
          setIsLocksSynced(true);
        }
      },
      (err) => { setLocksStatus('error'); handleError("Public Locks", err); }
    );

    return unsubLocks;
  }, [isAuthReady, getPublicLocksCollectionRef, handleError, retryKeys.locks]);

  // Public teams
  useEffect(() => {
    if (!isAuthReady) {
      setIsTeamsLoaded(false);
      setTeamsStatus('loading');
      return;
    }

    setTeamsStatus('loading');
    const unsubTeams = onSnapshot(
      getPublicTeamsCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setAllTeams(data);
        setIsTeamsLoaded(true);
        setTeamsStatus('ready');
      },
      (err) => { setTeamsStatus('error'); handleError("Public Teams", err); }
    );

    return unsubTeams;
  }, [isAuthReady, getPublicTeamsCollectionRef, handleError, retryKeys.teams]);

  return {
    cart, isCartSynced, playerLocks, isLocksLoaded, isLocksSynced, allTeams, isTeamsLoaded, userProfile,
    teamsStatus, locksStatus, profileStatus, retryFirebaseData,
  };
}
