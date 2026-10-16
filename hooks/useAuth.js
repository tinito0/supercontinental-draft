import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, setDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import {
  ADMIN_USER_ID,
  ADMIN_USER_IDS,
  DEFAULT_BUDGET,
  DEFAULT_LOGO,
} from '../utils/constants.js';
import { handleListenerError } from '../utils/listenerErrorHandler.js';

/**
 * Hook personalizado para gestionar el ciclo de vida de autenticación,
 * sincronización de perfil inicial, verificación de roles (admin) y estado del mercado.
 */
export function useAuth({
  auth,
  db,
  getPrivateProfileRef,
  getPublicTeamRef,
  getMarketStatusDocRef,
  firebaseInitializationError,
  setAppError,
  setIsLoading,
  showNotification,
}) {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [needsGoogleLinking, setNeedsGoogleLinking] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ status: 'loading', openTime: null });

  useEffect(() => {
    if (firebaseInitializationError) {
      setIsLoading(false);
      return;
    }

    const statusRef = getMarketStatusDocRef();

    const unsubscribeMarket = onSnapshot(statusRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMarketStatus(docSnap.data());
        } else {
          setMarketStatus({ status: 'closed', openTime: null });
        }
      },
      (error) => {
        handleListenerError(error, "Market Status", showNotification || ((type, msg) => setAppError?.(msg)), {
          onPermissionDenied: () => {
            setIsLoading(false);
            setAppError("Sin permisos para cargar Market Status");
          }
        });
        // Sin estado de mercado la app espera para siempre: mostrar el error con reintento.
        if (error?.code !== 'permission-denied') {
          setAppError?.('No se pudo leer el estado del mercado. Revisá tu conexión y reintentá.');
        }
      }
    );

    const handleAuthUser = async (firebaseUser) => {
      // Versiones viejas de LinkGoogleScreen dejaban esta marca y, si la pestaña se cerraba a mitad de la
      // migración, el ingreso quedaba trabado en "Conectando al servidor…".
      try { sessionStorage.removeItem('isMigrating'); } catch { /* sin sessionStorage */ }

      if (firebaseUser) {
        setUser(firebaseUser);
        const uid = firebaseUser.uid;
        setUserId(uid);

        const idTokenResult = await firebaseUser.getIdTokenResult();
        const isGoogleSignIn = idTokenResult.signInProvider === 'google.com';

        const adminUidList = Array.isArray(ADMIN_USER_IDS) ? ADMIN_USER_IDS : [ADMIN_USER_ID];
        const isUserAdmin = (
          uid === ADMIN_USER_ID ||
          adminUidList.includes(uid) ||
          idTokenResult.claims?.admin === true
        );
        setIsAdmin(isUserAdmin);

        const profileRef = getPrivateProfileRef(uid);
        const publicTeamRef = getPublicTeamRef(uid);

        // Leer documentos en paralelo para minimizar latencia de login
        const [profileSnap, publicTeamSnap] = await Promise.all([
          getDoc(profileRef),
          getDoc(publicTeamRef),
        ]);

        let profileData;

        if (!profileSnap.exists()) {
          if (isGoogleSignIn) {
            await signOut(auth);
            setAuthError("Esta cuenta de Google no tiene un equipo asociado. Si tenés una cuenta antigua, hacé click en 'Migrar cuenta antigua' para vincularla.");
            setIsAuthReady(true);
            setIsLoading(false);
            return;
          }

          profileData = {
            teamName: `Equipo ${uid.substring(0, 5)}`,
            budget: DEFAULT_BUDGET,
            userId: uid,
            logoUrl: DEFAULT_LOGO,
            formation: '4-3-3',
            lineup: {},
            wishlist: [],
            providers: [idTokenResult.signInProvider]
          };

          const batch = writeBatch(db);
          batch.set(profileRef, profileData);
          batch.set(publicTeamRef, {
            teamName: profileData.teamName,
            userId: uid,
            logoUrl: profileData.logoUrl,
            budget: profileData.budget,
            inWhitelist: false
          });
          await batch.commit();

        } else {
          profileData = profileSnap.data();
          if (profileData.isAdmin === true || profileData.role === 'admin') {
            setIsAdmin(true);
          }

          if (!isGoogleSignIn) {
            // Logueado con email/password
            if (profileData.providers?.includes('google.com')) {
              await signOut(auth);
              setAuthError("Esta cuenta ya ha sido migrada. Por favor, ingresa directamente con el botón 'Ingresar con Google'.");
              setIsAuthReady(true);
              setIsLoading(false);
              return;
            } else {
              setNeedsGoogleLinking(true);
              setAuthError(null);
            }
          } else {
            // Logueado con Google
            if (!profileData.providers?.includes('google.com')) {
              await signOut(auth);
              setAuthError("Para ingresar con Google, primero debés migrar tu cuenta. Hacé clic en 'Migrar cuenta antigua'.");
              setIsAuthReady(true);
              setIsLoading(false);
              return;
            }
            setNeedsGoogleLinking(false);
            setAuthError(null);
          }

          if (!publicTeamSnap.exists()) {
            await setDoc(publicTeamRef, {
              teamName: profileData.teamName,
              userId: uid,
              logoUrl: profileData.logoUrl || DEFAULT_LOGO,
              budget: profileData.budget,
              inWhitelist: false
            }, { merge: true });
          } else {
            const publicBudget = Number(publicTeamSnap.data().budget);
            const publicTeam = publicTeamSnap.data();
            const syncBatch = writeBatch(db);
            let needsSync = false;
            if (Number.isFinite(publicBudget) && publicBudget !== Number(profileData.budget)) {
              syncBatch.set(profileRef, { budget: publicBudget }, { merge: true });
              needsSync = true;
              profileData = { ...profileData, budget: publicBudget };
            }

            const visualTeamData = {
              teamName: profileData.teamName,
              userId: uid,
              logoUrl: profileData.logoUrl || DEFAULT_LOGO,
            };
            if (
              publicTeam.teamName !== visualTeamData.teamName ||
              publicTeam.userId !== visualTeamData.userId ||
              publicTeam.logoUrl !== visualTeamData.logoUrl
            ) {
              syncBatch.set(publicTeamRef, visualTeamData, { merge: true });
              needsSync = true;
            }
            if (needsSync) await syncBatch.commit();
          }
        }

        setIsAuthReady(true);
        setIsLoading(false);

      } else {
        setUser(null);
        setUserId(null);
        setIsAdmin(false);
        setIsAuthReady(true);
        setIsLoading(false);
      }
    };

    // Un fallo leyendo o creando el perfil (p. ej. sin conexión en el primer ingreso) dejaba la
    // app en "Conectando al servidor..." para siempre.
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      handleAuthUser(firebaseUser).catch(error => {
        console.error('Error al cargar la cuenta:', error);
        setAppError?.('No se pudo cargar tu cuenta. Revisá tu conexión y reintentá.');
        setIsAuthReady(true);
        setIsLoading(false);
      });
    });

    const initialSignIn = async () => {
      try {
        if (typeof window !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        }
      } catch (error) {
        console.warn("Error al intentar auto-login con token.", error);
      }
    };
    if (!auth.currentUser) {
      initialSignIn();
    }

    return () => {
      unsubscribeAuth();
      unsubscribeMarket();
    };
  }, [auth, db, firebaseInitializationError, getMarketStatusDocRef, getPrivateProfileRef, getPublicTeamRef, setAppError, setIsLoading]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Error signing out:", e);
    }
  }, [auth]);

  return {
    user,
    userId,
    isAdmin,
    isAuthReady,
    needsGoogleLinking,
    setNeedsGoogleLinking,
    authError,
    setAuthError,
    marketStatus,
    setMarketStatus,
    handleLogout,
  };
}
