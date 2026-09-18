import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, Lock, Activity, ChevronLeft, ShieldCheck, 
  CheckCircle2, AlertTriangle, Fingerprint, ArrowLeft, 
  Zap, Sliders, Package, Shield 
} from 'lucide-react';
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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const videoRef = useRef(null);

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

  return (
    <div className="flex min-h-screen bg-[#06080d] text-[#f8fafc] font-sans overflow-hidden">
      
      {/* ── LEFT PANEL: BRANDING & AMBIENT VIDEO (DESKTOP) ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative border-r border-white/5 p-12 overflow-hidden">
        {/* Background Ambient Video */}
        <div className="absolute inset-0 z-0 bg-[#06080d] overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-cover opacity-35 filter brightness-90 saturate-110"
          >
            <source src="/intro.mp4" type="video/mp4" />
          </video>
          {/* Dark Vignette Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(6, 8, 13, 0.4) 0%, rgba(6, 8, 13, 0.85) 75%, #06080d 100%), linear-gradient(to bottom, rgba(6, 8, 13, 0.7) 0%, transparent 25%, transparent 70%, #06080d 100%)'
            }}
          />
        </div>

        {/* Top Header info */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.webp" alt="SCL" className="w-9 h-9 object-contain" />
            <div>
              <div className="text-sm font-black tracking-wide text-white leading-tight">{APP_NAME}</div>
              <div className="text-[10px] font-bold tracking-widest text-[#00b4d8] uppercase">LIGA MASTER PES 2021</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MERCADO ACTIVO
          </div>
        </div>

        {/* Center Main Copy */}
        <div className="relative z-10 max-w-md my-auto py-8">
          <div className="inline-block text-[11px] font-extrabold tracking-wider text-[#00b4d8] uppercase mb-3">
            TEMPORADA OFICIAL · PES 2021
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white tracking-tight uppercase leading-[1.08] mb-4">
            Gestión Deportiva &amp; Mercado en Vivo
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-8">
            Control de acceso exclusivo para managers de la liga. Administrá tu presupuesto, diseñá tus alineaciones tácticas S1 y exportá directamente a tu consola o PC.
          </p>

          {/* Feature Badges */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Bloqueo de fichajes en tiempo real sin solapamientos</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Pizarra táctica sincronizada con Preset oficial S1</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
              <Package className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-semibold text-slate-300">Exportación automática de Option File ZIP (EJOGC327)</span>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          © {new Date().getFullYear()} {APP_NAME}. Sistema de competición deportiva.
        </div>
      </div>

      {/* ── RIGHT PANEL: AUTHENTICATION FORM ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 md:p-16 relative min-h-screen bg-white dark:bg-[#06080d] text-slate-900 dark:text-slate-100 transition-colors duration-200">
        
        {/* Top bar with back action */}
        <div className="flex items-center justify-between w-full max-w-[420px] mx-auto">
          {onBackToLanding ? (
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al inicio</span>
            </button>
          ) : <div />}

          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">v2.0.4</span>
        </div>

        {/* Central Auth Container */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-8">
          
          {/* Mobile Logo Branding */}
          <div className="flex lg:hidden flex-col items-center text-center mb-8">
            <img src="/logo.webp" alt="SCL" className="w-14 h-14 object-contain mb-3" />
            <div className="text-lg font-bold text-slate-900 dark:text-white">{APP_NAME}</div>
            <div className="text-xs text-sky-600 dark:text-[#00b4d8] font-bold">LIGA MASTER PES 2021</div>
          </div>

          {/* Header titles */}
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {showEmailForm 
                ? (forgotPasswordMode ? 'Recuperar Acceso' : 'Migración de Cuenta') 
                : 'Portal de Acceso'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              {isMigrated
                ? 'Tu cuenta ya fue migrada a Google. Hacé clic en el botón inferior para ingresar.'
                : showEmailForm 
                  ? (forgotPasswordMode 
                      ? 'Ingresá tu correo asociado para recibir el enlace de restablecimiento.' 
                      : 'Ingresá con tus credenciales anteriores para vincular tu perfil a Google.')
                  : 'Iniciá sesión con tu cuenta de Google para acceder al draft y tus plantillas.'}
            </p>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-rose-700 dark:text-rose-300 text-xs font-medium leading-snug">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-emerald-700 dark:text-emerald-300 text-xs font-medium leading-snug">{success}</span>
            </div>
          )}

          {/* ── GOOGLE AUTH MODE (DEFAULT) ── */}
          {!showEmailForm ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoggingIn ? (
                  <Activity className="w-5 h-5 animate-spin text-sky-500" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Ingresar con Google</span>
                  </>
                )}
              </button>

              {isMigrated ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    Tu cuenta ya está vinculada a Google. Utilizá el botón principal para ingresar.
                  </span>
                </div>
              ) : (
                <>
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                    <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      O BIEN
                    </span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                  </div>

                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(true); setError(''); setSuccess(''); }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-all text-xs cursor-pointer"
                  >
                    Migrar cuenta antigua (Email y Contraseña)
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ── EMAIL / PASSWORD FORM MODE ── */
            <form onSubmit={forgotPasswordMode ? handleResetPassword : handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none text-sm font-medium placeholder-slate-400"
                    placeholder="manager@equipo.com"
                    spellCheck="false"
                    required
                  />
                </div>
              </div>

              {!forgotPasswordMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contraseña
                    </label>
                    <button 
                      type="button" 
                      onClick={() => { setForgotPasswordMode(true); setError(''); setSuccess(''); }}
                      className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors"
                    >
                      ¿Olvidaste tu clave?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none text-sm font-medium tracking-widest placeholder-slate-400"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 space-y-2.5">
                <button
                  type="submit"
                  disabled={isLoggingIn || isResetting}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isLoggingIn || isResetting ? (
                    <Activity className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {forgotPasswordMode ? (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          <span>Enviar Instrucciones</span>
                        </>
                      ) : (
                        <>
                          <span>Continuar Migración</span>
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </>
                      )}
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={() => { setShowEmailForm(false); setForgotPasswordMode(false); setError(''); setSuccess(''); }}
                  className="w-full py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Volver al inicio de sesión con Google
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="w-full max-w-[420px] mx-auto text-center text-xs text-slate-400 dark:text-slate-600">
          Supercontinental Master League · Compatible con PES 2021
        </div>
      </div>
    </div>
  );
}
