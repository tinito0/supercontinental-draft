import React, { useState } from 'react';
import { GoogleAuthProvider, linkWithPopup, getAuth, signInWithCredential, signOut } from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { Mail } from 'lucide-react';
import { APP_ID } from '../utils/constants.js';
import { AuthLayout, GoogleButton } from '../components/auth/AuthLayout.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { app } from '../config/firebase.js';
import { migrateAccount } from '../services/marketService.js';

const googleProvider = new GoogleAuthProvider();

/**
 * The Google account already exists as its own Firebase user, so it cannot be linked to this one. The market
 * function moves the club to it (supabase/functions/_shared/market.js → migrateAccount). The Google sign-in
 * happens in a separate Firebase app instance, so this session (the old account, which authorises the move)
 * stays signed in until the club has moved; then the app signs in with Google.
 */
async function migrateToExistingGoogleAccount(auth, credential) {
  const secondary = initializeApp(app.options, `migration-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondary);
    const { user: googleUser } = await signInWithCredential(secondaryAuth, credential);
    await migrateAccount({ newIdToken: await googleUser.getIdToken() });
    await signOut(secondaryAuth);
  } finally {
    deleteApp(secondary).catch(() => {});
  }
  await signInWithCredential(auth, credential);
}

export function LinkGoogleScreen({ auth, db, user, onLinked }) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState('');
  const [loadingText, setLoadingText] = useState('');

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    setError('');
    setLoadingText('Vinculando cuenta...');

    try {
      await linkWithPopup(user, googleProvider);
      await setDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/profile`, "data"), {
        providers: arrayUnion("google.com"),
        migratedAt: new Date().toISOString()
      }, { merge: true });
      onLinked();
    } catch (e) {
      console.error("Error al vincular con Google:", e.code, e.message);
      if (e.code === 'auth/credential-already-in-use') {
        // Esa cuenta de Google ya es otro usuario de Firebase (p. ej. probó "Ingresar con Google" antes de
        // vincular): el servidor mueve el equipo a esa cuenta y después se entra con Google.
        const credential = GoogleAuthProvider.credentialFromError(e);
        if (!credential) {
          setError("No se pudo leer la cuenta de Google. Intentalo de nuevo.");
          setIsLinking(false);
          return;
        }
        try {
          setLoadingText('Moviendo tu equipo a la cuenta de Google…');
          await migrateToExistingGoogleAccount(auth, credential);
          window.location.reload();
          return;
        } catch (migrationError) {
          console.error("Error al migrar a la cuenta de Google:", migrationError);
          setError(migrationError?.message || "No se pudo mover el equipo a esa cuenta de Google. Pedile ayuda al administrador.");
        }
      } else if (e.code === 'auth/popup-closed-by-user') {
        setError("Proceso cancelado, intentalo de nuevo.");
      } else {
        setError("Ocurrió un error al vincular. Intentalo más tarde.");
      }
      setIsLinking(false);
    }
  };

  return (
    <AuthLayout
      title="Vinculá tu cuenta"
      description="Para continuar, vinculá tu cuenta de Google. De ahora en adelante vas a ingresar solo con Google."
    >
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <GoogleButton onClick={handleLinkGoogle} loading={isLinking}>
          {isLinking ? (loadingText || 'Vinculando…') : 'Vincular con Google'}
        </GoogleButton>
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Cuenta actual: {user.email}</span>
        </p>
      </div>
    </AuthLayout>
  );
}
