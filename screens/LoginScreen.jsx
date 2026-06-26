import React, { useState } from 'react';
import { Mail, Lock, Activity, ChevronLeft, ShieldCheck, CheckCircle2, AlertTriangle, Fingerprint, Home } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { APP_NAME, APP_ID } from '../utils/constants.js';

const googleProvider = new GoogleAuthProvider();

export function LoginScreen({ auth, db, externalError, onBackToLanding }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(externalError || '');
  const [success, setSuccess] = useState('');
  const [isMigrated, setIsMigrated] = useState(false);
  
  
  React.useEffect(() => {
    if (externalError) {
      setError(externalError);
      // If the error is about migration (set by app.jsx fallback), also activate migrated UI
      if (externalError.includes('migrada') || externalError.includes('vinculada a Google')) {
        setIsMigrated(true);
        setShowEmailForm(false);
      }
    }
  }, [externalError]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // app.jsx handle the rest
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

      // Immediately check Firestore providers BEFORE app.jsx processes onAuthStateChanged
      if (db) {
        try {
          const profileRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/profile`, "data");
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.providers?.includes('google.com')) {
              // This user already migrated — block email/password login
              await signOut(auth);
              setIsMigrated(true);
              setShowEmailForm(false);
              setError('Esta cuenta ya está vinculada a Google. Usá el botón de Google para ingresar.');
              setIsLoggingIn(false);
              return;
            }
          }
        } catch (firestoreErr) {
          // If Firestore check fails, let app.jsx handle it as fallback
          console.warn("No se pudo verificar migración, delegando a app.jsx:", firestoreErr);
        }
      }

      // If not migrated, app.jsx onAuthStateChanged will handle the linking flow
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
      setSuccess('Instrucciones enviadas. Revisá tu correo.');
    } catch (e) {
      setError('Error al enviar el correo. Verificá tu email.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#040a18] text-gray-200 selection:bg-blue-500/30 font-sans overflow-hidden">
      
      {/* ── SECCIÓN IZQUIERDA: HERO / BRANDING ── */}
      <div className="hidden lg:flex flex-col justify-center items-center w-1/2 relative border-r border-white/5">
        <div className="absolute inset-0 bg-[#050d1e]">
           <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
           <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-800/25 rounded-full blur-[120px] mix-blend-screen" />
           <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-900/15 rounded-full blur-[120px] mix-blend-screen" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center p-12 text-center max-w-lg">
          <div className="relative mb-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/15 blur-[60px] rounded-full scale-150" />
            <img src="/logo.webp" alt="SCL Logo" className="relative w-40 h-40 object-contain drop-shadow-[0_0_40px_rgba(59,130,246,0.4)]" />
          </div>
          <h1 className="text-6xl font-black text-white tracking-tighter mb-4" style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {APP_NAME} <span className="text-blue-500">.</span>
          </h1>
          <p className="text-blue-200/60 text-lg font-medium tracking-wide">
            Control de acceso restringido. Área de gestión de transferencias y monitoreo de la liga.
          </p>
        </div>
      </div>

      {/* ── SECCIÓN DERECHA: FORMULARIO ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative min-h-screen bg-[#060e20]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-900/25 rounded-full blur-[100px] lg:hidden" />
        
        <div className="w-full max-w-[420px] relative z-10">
          
          <div className="flex lg:hidden justify-center mb-8">
            <img src="/logo.webp" alt="SCL Logo" className="w-20 h-20 object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
          </div>

          <div className="mb-10 text-center lg:text-left">
            {onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-300/50 hover:text-blue-200 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Volver al inicio
              </button>
            )}
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
              {showEmailForm ? (forgotPasswordMode ? 'Recuperación' : 'Migración de Cuenta') : 'Portal de Acceso'}
            </h2>
            <p className="text-blue-300/50 font-medium">
              {isMigrated
                ? 'Tu cuenta ya fue migrada. Ingresá con Google.'
                : showEmailForm 
                  ? (forgotPasswordMode 
                      ? 'Ingresá tu correo asociado para recibir instrucciones.' 
                      : 'Ingresá con tus credenciales actuales para vincular tu cuenta a Google.')
                  : 'Ingresá con tu cuenta de Google.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/40 border border-red-900/50 flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-400 mr-3 shrink-0" />
              <span className="text-red-200 text-sm font-medium">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-blue-950/40 border border-blue-800/50 flex items-start">
              <CheckCircle2 className="w-5 h-5 text-blue-400 mr-3 shrink-0" />
              <span className="text-blue-200 text-sm font-medium">{success}</span>
            </div>
          )}

          {!showEmailForm ? (
            <div className="space-y-6">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <Activity className="w-5 h-5 animate-spin text-blue-600" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      <path d="M1 1h22v22H1z" fill="none"/>
                    </svg>
                    Ingresar con Google
                  </>
                )}
              </button>

              {isMigrated ? (
                <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex items-start">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 mr-3 shrink-0 mt-0.5" />
                  <span className="text-emerald-200 text-sm font-medium">
                    Tu cuenta ya está vinculada a Google. Usá el botón de arriba para ingresar.
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative flex items-center py-4">
                    <div className="flex-grow border-t border-blue-900/30"></div>
                    <span className="flex-shrink-0 mx-4 text-xs font-bold text-blue-300/40 uppercase tracking-widest">o</span>
                    <div className="flex-grow border-t border-blue-900/30"></div>
                  </div>

                  <button
                    onClick={() => { setShowEmailForm(true); setError(''); setSuccess(''); }}
                    className="w-full py-3.5 px-6 bg-transparent border border-blue-900/50 hover:bg-blue-900/10 text-blue-300/70 hover:text-blue-300 rounded-xl font-bold transition-all text-sm"
                  >
                    Migrar cuenta antigua (Email y Contraseña)
                  </button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={forgotPasswordMode ? handleResetPassword : handleEmailLogin} className="space-y-5">
              <div className="space-y-1.5 group">
                <label className="text-[11px] font-black text-blue-300/40 uppercase tracking-widest pl-1 group-focus-within:text-blue-400 transition-colors">
                  Correo Electrónico Actual
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-blue-900 group-focus-within:text-blue-400 transition-colors" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[#0a1628] text-white border border-blue-900/30 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-medium hover:border-blue-700/40"
                    placeholder="manager@equipo.com"
                    spellCheck="false"
                    required
                  />
                </div>
              </div>

              {!forgotPasswordMode && (
                <div className="space-y-1.5 group animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pl-1">
                    <label className="text-[11px] font-black text-blue-300/40 uppercase tracking-widest group-focus-within:text-blue-400 transition-colors">
                      Contraseña Actual
                    </label>
                    <button 
                      type="button" 
                      onClick={() => { setForgotPasswordMode(true); setError(''); setSuccess(''); }}
                      className="text-[11px] font-black text-blue-400/40 hover:text-blue-400 uppercase tracking-wider transition-colors"
                    >
                      ¿Olvidaste tu clave?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-blue-900 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-[#0a1628] text-white border border-blue-900/30 rounded-xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none font-medium tracking-widest hover:border-blue-700/40"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 space-y-3">
                <button
                  type="submit"
                  disabled={isLoggingIn || isResetting}
                  className="group relative w-full flex justify-center items-center gap-2 py-4 px-4 rounded-xl text-sm font-black text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoggingIn || isResetting ? (
                    <Activity className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {forgotPasswordMode ? (
                        <>
                          <Fingerprint className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          ENVIAR RECUPERACIÓN
                        </>
                      ) : (
                        <>
                          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform rotate-180" />
                          CONTINUAR MIGRACIÓN
                        </>
                      )}
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => { setShowEmailForm(false); setForgotPasswordMode(false); setError(''); setSuccess(''); }}
                  className="w-full py-3 text-xs font-bold text-blue-400/50 hover:text-white transition-colors"
                >
                  Volver al inicio de sesión principal
                </button>
              </div>
            </form>
          )}

          <div className="absolute bottom-8 left-0 right-0 text-center lg:hidden">
            <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">SUPERCONTINENTAL DRAFT</span>
          </div>

        </div>
      </div>
    </div>
  );
}
