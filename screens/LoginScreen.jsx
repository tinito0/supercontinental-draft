import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { APP_ID } from '../utils/constants.js';
import { AuthLayout, GoogleButton } from '../components/auth/AuthLayout.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Alert } from '../components/ui/Alert.jsx';

const googleProvider = new GoogleAuthProvider();

const CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos. Revisá los datos o usá «¿Olvidaste tu contraseña?» para elegir una nueva.';
const EMAIL_FALLBACK_MESSAGE = 'No pudimos iniciar sesión. Probá de nuevo en unos minutos o avisale al admin de la liga.';
const GOOGLE_FALLBACK_MESSAGE = 'No pudimos iniciar sesión con Google. Probá de nuevo o avisale al admin de la liga.';

/** Firebase auth error code to a message that says what happened and what to do next. */
const AUTH_ERROR_MESSAGES = {
  'auth/network-request-failed': 'Sin conexión. Revisá tu internet y volvé a intentar.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos o restablecé la contraseña.',
  'auth/wrong-password': CREDENTIALS_MESSAGE,
  'auth/invalid-credential': CREDENTIALS_MESSAGE,
  'auth/user-not-found': CREDENTIALS_MESSAGE,
  'auth/popup-closed-by-user': 'Cancelaste el inicio de sesión. Probá de nuevo cuando quieras.',
  'auth/popup-blocked': 'Tu navegador bloqueó la ventana de Google. Permitila y volvé a intentar.',
};

/** Message for a failed sign-in; `fallback` is the flow's generic one for codes not listed above. */
export function authErrorMessage(code, fallback) {
  return AUTH_ERROR_MESSAGES[code] || fallback;
}

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
  const [showPassword, setShowPassword] = useState(false);
  const panelRef = useRef(null);

  // Focus the first control of the panel that just appeared (the clicked button unmounts, so focus would fall to body).
  // The ref starts at the first panel, so the initial render does not steal focus.
  const panelKey = `${showEmailForm}:${forgotPasswordMode}`;
  const shownPanelKey = useRef(panelKey);
  useEffect(() => {
    if (shownPanelKey.current === panelKey) return;
    shownPanelKey.current = panelKey;
    panelRef.current?.querySelector('input, button')?.focus();
  }, [panelKey]);

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
      setError(authErrorMessage(e.code, GOOGLE_FALLBACK_MESSAGE));
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
      setError(authErrorMessage(e.code, EMAIL_FALLBACK_MESSAGE));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Escribí tu email para restablecer la contraseña.');
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
      ? 'Entrá con tu cuenta de Google para fichar, armar tu táctica y seguir el mercado.'
      : forgotPasswordMode
        ? 'Escribí el email de tu cuenta y te mandamos un link para elegir otra contraseña.'
        : 'Entrá con tu email y contraseña anteriores una sola vez: después vas a vincular tu perfil a Google.';

  return (
    <AuthLayout onBack={onBackToLanding} title={title} description={description}>
      <div className="space-y-4" ref={panelRef}>
        {error && <Alert tone="danger">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {!showEmailForm ? (
          <>
            <GoogleButton onClick={handleGoogleLogin} loading={isLoggingIn}>Entrar con Google</GoogleButton>
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
                {/* Not Field: the toggle sits inside the input box, and Field would put its id on the wrapper. */}
                <label htmlFor="login-password" className="field-label">
                  Contraseña<span className="text-danger-soft" aria-hidden="true"> *</span>
                </label>
                <div className="relative">
                  <input id="login-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} className="input min-h-11 pr-12"
                    autoComplete="current-password" required />
                  {/* The label names the action, so the state is not also announced with aria-pressed. */}
                  <IconButton icon={showPassword ? EyeOff : Eye} variant="ghost"
                    label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11" />
                </div>
                <button type="button" onClick={() => { setForgotPasswordMode(true); setError(''); setSuccess(''); }}
                  className="mt-1.5 min-h-11 text-sm font-semibold text-accent-soft hover:text-ink transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isLoggingIn || isResetting}
              iconRight={forgotPasswordMode ? undefined : ArrowRight}>
              {forgotPasswordMode ? 'Enviar link' : 'Continuar'}
            </Button>
            <Button variant="ghost" icon={ArrowLeft} className="w-full" onClick={backToGoogle}>
              Volver a entrar con Google
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
