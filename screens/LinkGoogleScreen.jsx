import React, { useState } from 'react';
import { GoogleAuthProvider, linkWithPopup, signInWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, deleteDoc, arrayUnion } from "firebase/firestore";
import { Activity, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { APP_ID } from '../utils/constants.js';

const googleProvider = new GoogleAuthProvider();

export function LinkGoogleScreen({ auth, db, user, onLinked }) {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState('');
  const [loadingText, setLoadingText] = useState('');

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    setError('');
    setLoadingText('Vinculando cuenta...');
    const currentUid = user.uid;

    try {
      await linkWithPopup(user, googleProvider);
      
      const userRef = doc(db, `artifacts/${APP_ID}/users/${currentUid}/profile`, "data");
      await setDoc(userRef, {
        providers: arrayUnion("google.com"),
        migratedAt: new Date().toISOString()
      }, { merge: true });

      onLinked();

    } catch (e) {
      console.error("Error al vincular con Google:", e.code, e.message);
      
      if (e.code === 'auth/credential-already-in-use') {
        try {
          sessionStorage.setItem('isMigrating', 'true');
          setLoadingText('Leyendo datos actuales...');

          // READ EVERYTHING FIRST while still email user
          const googleCredential = GoogleAuthProvider.credentialFromError(e);
          
          const oldProfileRef = doc(db, `artifacts/${APP_ID}/users/${currentUid}/profile`, "data");
          const oldProfileSnap = await getDoc(oldProfileRef);
          
          const cartSnap = await getDocs(
            collection(db, `artifacts/${APP_ID}/users/${currentUid}/cart`)
          );
          
          const locksSnap = await getDocs(
            collection(db, `artifacts/${APP_ID}/public/data/player_locks`)
          );
          
          const oldTeamRef = doc(db, `artifacts/${APP_ID}/public/data/teams/${currentUid}`);
          const oldTeamSnap = await getDoc(oldTeamRef);
          
          const offersSnap = await getDocs(
            collection(db, `artifacts/${APP_ID}/public/data/offers`)
          );
          
          const transfersSnap = await getDocs(
            collection(db, `artifacts/${APP_ID}/public/data/transfers`)
          );

          setLoadingText('Migrando tu cuenta...');

          // NOW switch to Google auth
          const googleResult = await signInWithCredential(auth, googleCredential);
          const googleUid = googleResult.user.uid;

          if (googleUid === currentUid) {
            // Same user, just update providers
            await setDoc(oldProfileRef, {
              providers: arrayUnion("google.com"),
              migratedAt: new Date().toISOString()
            }, { merge: true });
            sessionStorage.removeItem('isMigrating');
            onLinked();
            return;
          }

          // Write all data to new UID
          const batch = writeBatch(db);

          // Profile
          if (oldProfileSnap.exists()) {
            const newProfileRef = doc(db, `artifacts/${APP_ID}/users/${googleUid}/profile`, "data");
            batch.set(newProfileRef, {
              ...oldProfileSnap.data(),
              providers: ["google.com"],
              migratedFrom: currentUid,
              migratedAt: new Date().toISOString()
            });
          }

          // Cart
          cartSnap.docs.forEach(cartDoc => {
            batch.set(
              doc(db, `artifacts/${APP_ID}/users/${googleUid}/cart/${cartDoc.id}`),
              cartDoc.data()
            );
          });

          // Team
          if (oldTeamSnap.exists()) {
            const newTeamRef = doc(db, `artifacts/${APP_ID}/public/data/teams/${googleUid}`);
            batch.set(newTeamRef, {
              ...oldTeamSnap.data(),
              userId: googleUid
            });
            batch.delete(oldTeamRef); // safe to delete public collection
          }

          await batch.commit();

          // Player locks
          const lockBatch = writeBatch(db);
          let hasLocks = false;
          locksSnap.docs.forEach(lockDoc => {
            if (lockDoc.data().lockedBy === currentUid) {
              lockBatch.update(lockDoc.ref, { lockedBy: googleUid });
              hasLocks = true;
            }
          });
          if (hasLocks) await lockBatch.commit();

          // Offers
          const offerBatch = writeBatch(db);
          let hasOfferChanges = false;
          offersSnap.docs.forEach(offerDoc => {
            const data = offerDoc.data();
            let updateData = {};
            if (data.senderId === currentUid) updateData.senderId = googleUid;
            if (data.targetTeamId === currentUid) updateData.targetTeamId = googleUid;
            
            if (Object.keys(updateData).length > 0) {
              offerBatch.update(offerDoc.ref, updateData);
              hasOfferChanges = true;
            }
          });
          if (hasOfferChanges) await offerBatch.commit();

          // Transfers
          const transferBatch = writeBatch(db);
          let hasTransferChanges = false;
          transfersSnap.docs.forEach(transferDoc => {
            const data = transferDoc.data();
            let updateData = {};
            if (data.teamId === currentUid) updateData.teamId = googleUid;
            if (data.fromTeamId === currentUid) updateData.fromTeamId = googleUid;
            
            if (Object.keys(updateData).length > 0) {
              transferBatch.update(transferDoc.ref, updateData);
              hasTransferChanges = true;
            }
          });
          if (hasTransferChanges) await transferBatch.commit();

          // Try to delete old data, ignore if permission denied
          try {
            await deleteDoc(oldProfileRef);
          } catch (delErr) {
            console.warn("No se pudo borrar el perfil antiguo, probablemente por reglas de seguridad:", delErr);
          }
          
          for (const cartDoc of cartSnap.docs) {
            try {
              await deleteDoc(cartDoc.ref);
            } catch (delErr) {
              // Ignorar, el doc queda huérfano sin consecuencias
            }
          }

          setLoadingText("¡Cuenta migrada exitosamente!");
          sessionStorage.removeItem('isMigrating');
          setTimeout(() => {
            onLinked();
          }, 1500);

        } catch (mergeError) {
          console.error("Error durante la migración:", mergeError);
          sessionStorage.removeItem('isMigrating');
          
          if (mergeError.code === 'permission-denied') {
            setError("Error de permisos al migrar. Contactá al administrador.");
          } else {
            setError("Error al migrar la cuenta. Intentalo de nuevo.");
          }
          setIsLinking(false);
        }
      } else if (e.code === 'auth/popup-closed-by-user') {
        setError("Proceso cancelado, intentalo de nuevo.");
        setIsLinking(false);
      } else {
        setError("Ocurrió un error al vincular. Intentalo más tarde.");
        setIsLinking(false);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#040a18] items-center justify-center p-6 text-gray-200">
      <div className="absolute inset-0 bg-[#050d1e] z-0">
         <div className="absolute top-[10%] left-[20%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-[#0a1628] rounded-3xl p-8 border border-blue-900/30 shadow-2xl text-center">
        <img src="/logo.webp" alt="SCL Logo" className="w-24 h-24 object-contain mx-auto mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />

        <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Migración de Cuenta</h2>
        
        <p className="text-blue-200/70 mb-8 leading-relaxed font-medium">
          Para continuar, vinculá tu cuenta de Google. De ahora en adelante vas a ingresar solo con Google.
        </p>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/40 border border-red-900/50 flex items-start text-left">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-3 shrink-0" />
            <span className="text-red-200 text-sm font-medium">{error}</span>
          </div>
        )}

        <button
          onClick={handleLinkGoogle}
          disabled={isLinking}
          className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLinking ? (
            <>
              <Activity className="w-5 h-5 animate-spin text-blue-600" />
              <span>{loadingText || "Vinculando..."}</span>
            </>
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                <path d="M1 1h22v22H1z" fill="none"/>
              </svg>
              Vincular con Google
            </>
          )}
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-blue-300/40">
          <Mail className="w-4 h-4" />
          <span>Cuenta actual: {user.email}</span>
        </div>
      </div>
    </div>
  );
}
