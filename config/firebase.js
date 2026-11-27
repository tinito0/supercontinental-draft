// Full Firebase setup for the draft: app and Firestore from ./firebaseCore.js plus Auth and Storage.
// The public league site must import ./firebaseCore.js instead, so it does not load Auth or Storage.
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { app, db, firebaseInitializationError as coreError } from "./firebaseCore.js";

let auth;
let storage;
let firebaseInitializationError = coreError;

if (!coreError) {
  try {
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (e) {
    console.error("Error al inicializar Firebase.", e);
    firebaseInitializationError = e;
  }
}

export { app, auth, db, storage, firebaseInitializationError };
