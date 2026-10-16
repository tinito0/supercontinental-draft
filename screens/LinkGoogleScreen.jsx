import React, { useState } from 'react';
import { GoogleAuthProvider, linkWithPopup } from "firebase/auth";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { Mail } from 'lucide-react';
import { APP_ID } from '../utils/constants.js';
import { AuthLayout, GoogleButton } from '../components/auth/AuthLayout.jsx';
import { Alert } from '../components/ui/Alert.jsx';

const googleProvider = new GoogleAuthProvider();

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
        // vincular). Mover el equipo a ese usuario desde el navegador lo impiden las reglas (presupuesto,
        // locks, ofertas): lo resuelve el administrador.
        setError("Esa cuenta de Google ya está registrada en la app por separado. Pedile al administrador que la vincule a tu equipo, o elegí otra cuenta de Google.");
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
