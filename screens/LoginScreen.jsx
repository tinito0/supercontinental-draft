import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { APP_ID } from '../utils/constants.js';
import { AuthLayout, GoogleButton } from '../components/auth/AuthLayout.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Alert } from '../components/ui/Alert.jsx';

const googleProvider = new GoogleAuthProvider();

export function LoginScreen({ auth, db, externalError, onBackToLanding }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(externalError || '');
  const [success, setSuccess] = useState('');
  const [isMigrated, setIsMigrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
      if (externalError.includes('migrada') || externalError.includes('vinculada a Google')) {
        setIsMigrated(true);
        setShowEmailForm(false);
      }
    }
  }, [externalError]);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Error de login con Google:", e.code, e.message);
      if (e.code === 'auth/popup-closed-by-user') {
        setError('Inicio de sesión cancelado.');
      } else {
        setError('Ocurrió un error al iniciar sesión con Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoggingIn(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (db) {
        try {
          const profileRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/profile`, "data");
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.providers?.includes('google.com')) {
              await signOut(auth);
              setIsMigrated(true);
              setShowEmailForm(false);
              setError('Esta cuenta ya está vinculada a Google. Usá el botón de Google para ingresar.');
              setIsLoggingIn(false);
              return;
            }
          }
        } catch (firestoreErr) {
          console.warn("No se pudo verificar migración, delegando a app.jsx:", firestoreErr);
        }
      }
    } catch (e) {
      console.error("Error de login:", e.code, e.message);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas. Verificá tu email y contraseña.');
      } else {
        setError('Ocurrió un error al iniciar sesión.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Ingresá tu email para restablecer la contraseña.');
      return;
    }
    setError('');
    setSuccess('');
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Instrucciones enviadas. Revisá tu correo electrónico.');
    } catch (e) {
      setError('Error al enviar el correo. Verificá tu email.');
    } finally {
      setIsResetting(false);
    }
  };

  const backToGoogle = () => { setShowEmailForm(false); setForgotPasswordMode(false); setError(''); setSuccess(''); };

  const title = !showEmailForm ? 'Entrá a tu club' : forgotPasswordMode ? 'Recuperá el acceso' : 'Migrá tu cuenta';
  const description = isMigrated
    ? 'Tu cuenta ya está vinculada a Google: ingresá con el botón de Google.'
    : !showEmailForm
      ? 'Ingresá con tu cuenta de Google para fichar, armar tu táctica y seguir el mercado.'
      : forgotPasswordMode
        ? 'Escribí el email de tu cuenta y te mandamos un enlace para elegir otra contraseña.'
        : 'Ingresá con tu email y contraseña anteriores una sola vez: después vas a vincular tu perfil a Google.';

  return (
    <AuthLayout onBack={onBackToLanding} title={title} description={description}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {!showEmailForm ? (
          <>
            <GoogleButton onClick={handleGoogleLogin} loading={isLoggingIn}>Ingresar con Google</GoogleButton>
            {!isMigrated && (
              <>
                <div className="flex items-center gap-3 py-1" aria-hidden="true">
                  <span className="h-px flex-1 bg-line/[0.14]" />
                  <span className="text-xs text-ink-3">o</span>
                  <span className="h-px flex-1 bg-line/[0.14]" />
                </div>
                <Button variant="secondary" icon={Mail} className="w-full"
                  onClick={() => { setShowEmailForm(true); setError(''); setSuccess(''); }}>
                  Tengo una cuenta con email y contraseña
                </Button>
              </>
            )}
          </>
        ) : (
          <form onSubmit={forgotPasswordMode ? handleResetPassword : handleEmailLogin} className="space-y-4">
            <Field label="Email" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input min-h-11"
                placeholder="manager@equipo.com" autoComplete="email" spellCheck="false" />
            </Field>

            {!forgotPasswordMode && (
              <div>
                <Field label="Contraseña" required>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input min-h-11"
                    autoComplete="current-password" />
                </Field>
                <button type="button" onClick={() => { setForgotPasswordMode(true); setError(''); setSuccess(''); }}
                  className="mt-1.5 min-h-11 text-sm font-semibold text-accent-soft hover:text-ink transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoggingIn || isResetting}
              iconRight={forgotPasswordMode ? undefined : ArrowRight}>
              {forgotPasswordMode ? 'Enviar enlace' : 'Continuar'}
            </Button>
            <Button variant="ghost" icon={ArrowLeft} className="w-full" onClick={backToGoogle}>
              Volver a ingresar con Google
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
