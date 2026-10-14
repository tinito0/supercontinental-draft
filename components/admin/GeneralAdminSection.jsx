import React, { useState, useEffect, memo } from 'react';
import { Settings, Save, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { onSnapshot, setDoc, getDocs, query, collection, doc } from 'firebase/firestore';
import { APP_ID, DEFAULT_TACTICS } from '../../utils/constants.js';
import { commitBatchOperations } from './commitBatchOperations.js';

export const GeneralAdminSection = memo(function GeneralAdminSection({
  getMarketStatusDocRef,
  getPublicLocksCollectionRef,
  getPublicTeamsCollectionRef,
  db,
  showStatusMessage,
}) {
  const [marketStatus, setMarketStatus] = useState({ status: 'loading', openTime: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState('loading');
  const [localOpenTime, setLocalOpenTime] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetProgress, setResetProgress] = useState({ active: false, current: 0, total: 0, stage: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(getMarketStatusDocRef(), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMarketStatus(data);
        setLocalStatus(data.status);
        setLocalOpenTime(data.status === 'scheduled' && data.openTime ? data.openTime : new Date().toISOString().substring(0, 16));
      } else {
        setMarketStatus({ status: 'closed', openTime: null });
        setLocalStatus('closed');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [getMarketStatusDocRef]);

  const handleSaveStatus = async () => {
    setIsSaving(true);
    showStatusMessage('loading', 'Actualizando el estado del mercado...');
    try {
      await setDoc(getMarketStatusDocRef(), {
        status: localStatus,
        openTime: localStatus === 'scheduled' ? localOpenTime : null,
      });
      showStatusMessage('success', 'Estado actualizado.');
    } catch (e) {
      showStatusMessage('error', 'Error al guardar.');
    }
    setIsSaving(false);
  };

  const handleConfirmResetDraft = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESETEAR') return;
    setIsSaving(true);
    showStatusMessage('loading', 'Iniciando el reseteo de temporada...');
    setResetProgress({ active: true, current: 0, total: 100, stage: 'Consultando colecciones de clubes, ofertas y mercado...' });
    try {
      const [locks, legacyLocks, teams, offers, transfers, sharedFormations, news] = await Promise.all([
        getDocs(query(getPublicLocksCollectionRef())),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/locks`))),
        getDocs(query(getPublicTeamsCollectionRef())),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/offers`))),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/transfers`))),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/shared_formations`))),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/news`))),
      ]);

      const operations = [];

      // Borrar locks, ofertas, transferencias, noticias y formaciones compartidas
      [locks, legacyLocks, offers, transfers, sharedFormations, news].forEach(snapshot => {
        snapshot.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
      });

      // Borrar subcolecciones de mensajes de cada oferta
      const offerMessagesPromises = offers.docs.map(offerDoc =>
        getDocs(collection(db, `artifacts/${APP_ID}/public/data/offers/${offerDoc.id}/messages`))
      );
      const offerMessagesSnapshots = await Promise.all(offerMessagesPromises);
      offerMessagesSnapshots.forEach(messagesSnap => {
        messagesSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
      });

      // Recopilar todos los IDs de usuario / equipos únicos
      const userIds = new Set(teams.docs.map(t => t.id));

      // Para cada usuario: borrar cart, scout_usage, scout_searches
      const userCollectionsPromises = Array.from(userIds).map(async (uid) => {
        const [cartSnap, scoutUsageSnap, scoutSearchesSnap] = await Promise.all([
          getDocs(collection(db, `artifacts/${APP_ID}/users/${uid}/cart`)),
          getDocs(collection(db, `artifacts/${APP_ID}/users/${uid}/scout_usage`)),
          getDocs(collection(db, `artifacts/${APP_ID}/users/${uid}/scout_searches`)),
        ]);
        return { uid, cartSnap, scoutUsageSnap, scoutSearchesSnap };
      });

      const userCollections = await Promise.all(userCollectionsPromises);

      userCollections.forEach(({ uid, cartSnap, scoutUsageSnap, scoutSearchesSnap }) => {
        // Borrar carritos de jugadores
        cartSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
        // Borrar usos de scout mensuales
        scoutUsageSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
        // Borrar historial y resultados de búsquedas scout
        scoutSearchesSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));

        // Reiniciar plantilla y formación en perfil privado (manteniendo presupuesto)
        const profileRef = doc(db, `artifacts/${APP_ID}/users/${uid}/profile`, 'data');
        operations.push({
          type: 'set',
          ref: profileRef,
          data: {
            franchisePlayerUsed: false,
            franchisePlayerId: null,
            lineup: {},
            dorsals: {},
            formation: '4-3-3',
            setPieces: {},
            tactics: DEFAULT_TACTICS,
            availability: {},
            matchBench: [],
          },
          options: { merge: true },
        });

        // Reiniciar plantilla y formación en equipo público (manteniendo presupuesto)
        const publicTeamRef = doc(db, `artifacts/${APP_ID}/public/data/teams`, uid);
        operations.push({
          type: 'set',
          ref: publicTeamRef,
          data: {
            lineup: {},
            dorsals: {},
            formation: '4-3-3',
            setPieces: {},
            tactics: DEFAULT_TACTICS,
            availability: {},
            matchBench: [],
          },
          options: { merge: true },
        });
      });

      setResetProgress({ active: true, current: 0, total: operations.length, stage: `Purgando 0 de ${operations.length} registros...` });
      await commitBatchOperations(db, operations, (current, total) => {
        setResetProgress({ active: true, current, total, stage: `Purgando registros en Firestore: ${current} de ${total}...` });
      });
      showStatusMessage('success', `Reset completado con éxito. Se purgaron ${operations.length} registros (plantillas, carritos, scouts, locks y ofertas).`);
      setIsResetModalOpen(false);
      setResetConfirmInput('');
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al resetear temporada.');
    } finally {
      setIsSaving(false);
      setResetProgress({ active: false, current: 0, total: 0, stage: '' });
    }
  };

  if (isLoading) return <div className="text-center text-slate-400 text-xs py-8">Cargando configuración...</div>;

  return (
    <div className="space-y-8">
      {/* CONTROL DE MERCADO */}
      <div className="bg-[#0c1017] p-6 rounded-2xl border border-white/[0.08] shadow-lg">
        <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider mb-4 flex items-center">
          <Settings className="w-4 h-4 mr-2" /> Control de Mercado
        </h4>
        <div className="space-y-3">
          {['open', 'closed', 'scheduled', 'FranchiseMarket'].map((status) => (
            <label
              key={status}
              className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                localStatus === status
                  ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm shadow-cyan-500/10'
                  : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              <input
                type="radio"
                name="marketStatus"
                value={status}
                checked={localStatus === status}
                onChange={(e) => setLocalStatus(e.target.value)}
                className="form-radio h-4 w-4 text-cyan-400 bg-black/50 border-slate-600 focus:ring-cyan-400 mr-3"
              />
              <span className="text-sm font-medium">
                {status === 'open' && 'Abierto (Libre)'}
                {status === 'closed' && 'Cerrado (Mantenimiento)'}
                {status === 'scheduled' && 'Programado'}
                {status === 'FranchiseMarket' && 'Mercado Franquicia'}
              </span>
            </label>
          ))}
        </div>

        {localStatus === 'scheduled' && (
          <div className="mt-4 pl-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-xs text-slate-400 block mb-1 font-bold uppercase">Fecha de Apertura</label>
            <input
              type="datetime-local"
              value={localOpenTime}
              onChange={(e) => setLocalOpenTime(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 bg-black/50 text-white border border-white/10 rounded-lg text-sm focus:border-cyan-400 outline-none"
            />
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/[0.06] flex justify-end">
          <button
            onClick={handleSaveStatus}
            disabled={isSaving}
            className="flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? 'Guardando...' : <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>}
          </button>
        </div>
      </div>

      {/* ZONA DE PELIGRO */}
      <div className="p-5 sm:p-6 bg-red-950/20 rounded-2xl border border-red-500/30 shadow-inner relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <h4 className="text-red-400 text-sm font-black uppercase tracking-wider">
            Zona de Peligro — Reseteo Integral de Temporada
          </h4>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed max-w-2xl">
          Esta acción vacía todos los planteles (carritos), plantillas y formaciones (alineación, tácticas, dorsales y banco), borra los usos y búsquedas del scout, y elimina bloqueos de mercado, ofertas activas y transferencias. Conserva los presupuestos de los equipos y el estado del mercado actual.
        </p>
        <button
          onClick={() => { setIsResetModalOpen(true); setResetConfirmInput(''); }}
          disabled={isSaving}
          className="bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider py-2.5 px-5 rounded-xl flex items-center gap-2 disabled:opacity-50 transition shadow-lg shadow-red-950/50 active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
          Resetear Temporada...
        </button>
      </div>

      {/* MODAL DOBLE CONFIRMACION RESET */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[110] p-4" onClick={() => setIsResetModalOpen(false)}>
          <div className="bg-[#0d121c] rounded-2xl border border-red-500/40 w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
              <div className="p-2 bg-red-500/20 rounded-xl text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wide">Confirmación Crítica — Reseteo de Temporada</h3>
                <p className="text-xs text-red-400 font-semibold">Esta acción es irreversible y purga planteles de todos los clubes</p>
              </div>
            </div>

            <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-4 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-red-300">Se purgarán los siguientes datos de TODOS los equipos:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                <li>Planteles y carritos de jugadores</li>
                <li>Alineaciones, tácticas, dorsales y suplentes</li>
                <li>Historial y créditos mensuales del Scout</li>
                <li>Bloqueos de mercado, ofertas, noticias y transferencias</li>
              </ul>
              <p className="text-emerald-400 font-medium pt-1">✓ Se conservan los presupuestos actuales y el estado del mercado.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Para confirmar, escribe <span className="text-red-400 font-mono font-black">RESETEAR</span> a continuación:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="RESETEAR"
                disabled={isSaving}
                className="w-full px-4 py-2.5 bg-black/60 border border-red-500/40 rounded-xl text-white font-mono text-sm uppercase outline-none focus:border-red-400 disabled:opacity-50"
                autoFocus
              />
            </div>

            {resetProgress.active && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3.5 space-y-2 animate-in fade-in duration-200" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-xs font-bold text-red-300">
                  <span className="flex items-center gap-2 truncate pr-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400 shrink-0" />
                    <span className="truncate">{resetProgress.stage}</span>
                  </span>
                  {resetProgress.total > 0 && (
                    <span className="font-mono text-red-400 shrink-0">
                      {Math.round((resetProgress.current / resetProgress.total) * 100)}%
                    </span>
                  )}
                </div>
                {resetProgress.total > 0 && (
                  <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-red-500/20">
                    <div
                      className="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.round((resetProgress.current / resetProgress.total) * 100))}%` }}
                    />
                  </div>
                )}
                <p className="text-[10px] text-slate-400 text-center">Por favor, no cierres esta ventana mientras la operación esté en curso.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { if (!isSaving) { setIsResetModalOpen(false); setResetConfirmInput(''); } }}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResetDraft}
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESETEAR' || isSaving}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition flex items-center gap-2 shadow-lg shadow-red-950/50"
              >
                <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                {isSaving ? 'Reseteando...' : 'Confirmar Reseteo Total'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default GeneralAdminSection;
