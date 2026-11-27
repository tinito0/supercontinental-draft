// Firebase app + Firestore only. The public league site (hooks/useLeagueData.js) imports this module so it never
// downloads the Auth or Storage SDKs. The draft imports config/firebase.js, which adds both on top of this.
//
// Firestore keeps the persistent multi-tab cache for everyone: there is one Firestore instance per page, the
// league and the draft share the same origin and IndexedDB, and the league's offline guard
// (listenWithOfflineGuard) and the installed PWA read from that cache when the connection drops.
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const FIREBASE_MESSAGING_SENDER_ID = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_AUTH_DOMAIN = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const FIREBASE_APP_ID = import.meta.env.VITE_FIREBASE_APP_ID;

let app;
let db;
let firebaseInitializationError = null;

try {
  const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("TU_")) {
    throw new Error("Las credenciales de Firebase no están configuradas correctamente.");
  }

  app = initializeApp(firebaseConfig);
  db = initializeFirestore(app, {
    cache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.error("Error al inicializar Firebase.", e);
  firebaseInitializationError = e;
}

export { app, db, firebaseInitializationError };
