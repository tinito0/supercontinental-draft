import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const FIREBASE_API_KEY = "AIzaSyC3dU2SsxKd0RGqHu8eODMnVx1Rme4mDtg";
const FIREBASE_PROJECT_ID = "supercont-d62df";
const FIREBASE_MESSAGING_SENDER_ID = "1083109181179";
const FIREBASE_AUTH_DOMAIN = "supercont-d62df.firebaseapp.com";
const FIREBASE_STORAGE_BUCKET = "supercont-d62df.appspot.com";
const FIREBASE_APP_ID = "1:1083109181179:web:b1ea53e2da91a04a05525e";

let app;
let auth;
let db;
let storage;
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
  auth = getAuth(app);
  db = initializeFirestore(app, {
    cache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  storage = getStorage(app);
} catch (e) {
  console.error("Error al inicializar Firebase.", e);
  firebaseInitializationError = e;
}

export { app, auth, db, storage, firebaseInitializationError };
