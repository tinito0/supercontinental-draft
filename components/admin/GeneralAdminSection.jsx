import React, { useState, useEffect, memo } from 'react';
import { Settings, Save, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { onSnapshot, setDoc, getDocs, query, collection, doc } from 'firebase/firestore';
import { APP_ID } from '../../utils/constants.js';
import { profileResetData, teamResetData, canResetSeason } from '../../utils/seasonReset.js';
import { commitBatchOperations } from './commitBatchOperations.js';
import { toLocalDateTimeInput } from '../../utils/helpers.js';
import { parseOpenTime } from '../../supabase/functions/_shared/marketTime.js';
import { BaseModal } from '../ui/BaseModal.jsx';

export const GeneralAdminSection = memo(function GeneralAdminSection({
  getMarketStatusDocRef,
  getPublicLocksCollectionRef,
  getPublicTeamsCollectionRef,
  db,
  showStatusMessage,
}) {
  const [marketStatus, setMarketStatus] = useState({ status: 'loading', openTime: null });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openTimeError, setOpenTimeError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState('loading');
  const [localOpenTime, setLocalOpenTime] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetProgress, setResetProgress] = useState({ active: false, current: 0, total: 0, stage: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(getMarketStatusDocRef(), (doc) => {
      // openTime se guarda como instante ISO (toISOString) para que el servidor, que corre en UTC, abra a la
      // misma hora que la app. El campo muestra ese instante en la hora local del admin.
      if (doc.exists()) {
        const data = doc.data();
        setMarketStatus(data);
        setLocalStatus(data.status);
        const savedOpenTime = data.status === 'scheduled' ? parseOpenTime(data.openTime) : null;
        setLocalOpenTime(toLocalDateTimeInput(savedOpenTime || new Date()));
      } else {
        setMarketStatus({ status: 'closed', openTime: null });
        setLocalStatus('closed');
        setLocalOpenTime(toLocalDateTimeInput(new Date()));
      }
      setLoadError('');
      setIsLoading(false);
    }, (error) => {
      // Sin este callback un error de permisos dejaba "Cargando configuración..." para siempre.
      console.error(error);
      setLoadError('No se pudo leer el estado del mercado. Revisá la conexión o tus permisos y recargá.');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [getMarketStatusDocRef]);

  const handleSaveStatus = async () => {
    if (localStatus === 'scheduled' && (!localOpenTime || Number.isNaN(new Date(localOpenTime).getTime()))) {
      setOpenTimeError('Elegí la fecha y hora de apertura.');
      return;
    }
    setOpenTimeError('');
    setIsSaving(true);
    showStatusMessage('loading', 'Actualizando el estado del mercado...');
    try {
      await setDoc(getMarketStatusDocRef(), {
        status: localStatus,
        openTime: localStatus === 'scheduled' ? new Date(localOpenTime).toISOString() : null,
      });
      showStatusMessage('success', 'Estado actualizado.');
    } catch (e) {
      showStatusMessage('error', 'Error al guardar.');
    }
    setIsSaving(false);
  };

  const handleConfirmResetDraft = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESETEAR') return;
    if (!canResetSeason(marketStatus)) {
      showStatusMessage('error', 'Cerrá el mercado antes de resetear: con el mercado abierto un fichaje podía quedar a medias.');
      return;
    }
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

        // Perfil privado y equipo público: plantilla y formación vacías, franquicia libre; el presupuesto queda.
        // mergeFields reemplaza cada campo entero (con merge: true las tácticas se fusionaban con las viejas).
        const profileData = profileResetData();
        operations.push({
          type: 'set',
          ref: doc(db, `artifacts/${APP_ID}/users/${uid}/profile`, 'data'),
          data: profileData,
          options: { mergeFields: Object.keys(profileData) },
        });
        const teamData = teamResetData();
        operations.push({
          type: 'set',
          ref: doc(db, `artifacts/${APP_ID}/public/data/teams`, uid),
          data: teamData,
          options: { mergeFields: Object.keys(teamData) },
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
      // Each batch is committed on its own: a failure leaves part of the season deleted. Running it again is safe,
      // it reads what is left and finishes it.
      showStatusMessage('error', 'El reseteo se cortó a mitad de camino. Volvé a ejecutarlo: borra lo que quedó y termina.');
    } finally {
      setIsSaving(false);
      setResetProgress({ active: false, current: 0, total: 0, stage: '' });
    }
  };

  if (isLoading) return <div className="text-center text-ink-3 text-xs py-8">Cargando configuración...</div>;
  if (loadError) return <div role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.07] px-4 py-3 text-sm text-danger-soft">{loadError}</div>;

  return (
    <div className="space-y-8">
      {/* CONTROL DE MERCADO */}
      <div className="bg-surface p-6 rounded-2xl border border-line/[0.12] shadow-lg">
        <h2 className="section-title flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-accent-soft" aria-hidden="true" /> Control del mercado
        </h2>
        <div className="space-y-3">
          {['open', 'closed', 'scheduled', 'FranchiseMarket'].map((status) => (
            <label
              key={status}
              className={`flex items-center p-3 rounded-xl border cursor-pointer transition-colors ${
                localStatus === status
                  ? 'bg-accent/15 border-accent text-ink shadow-sm shadow-accent/10'
                  : 'bg-white/[0.02] border-line/[0.08] text-ink-2 hover:bg-white/[0.05]'
              }`}
            >
              <input
                type="radio"
                name="marketStatus"
                value={status}
                checked={localStatus === status}
                onChange={(e) => setLocalStatus(e.target.value)}
                className="form-radio h-4 w-4 text-accent bg-black/50 border-line/20 focus:ring-accent mr-3"
              />
              <span className="text-sm font-medium">
                {status === 'open' && <>Abierto <span className="block text-xs font-normal text-ink-3">Todos fichan, ofertan y liberan.</span></>}
                {status === 'closed' && <>Cerrado <span className="block text-xs font-normal text-ink-3">Solo lectura; el acceso anticipado sigue pudiendo usarlo.</span></>}
                {status === 'scheduled' && <>Programado <span className="block text-xs font-normal text-ink-3">Abre solo en la fecha y hora de abajo.</span></>}
                {status === 'FranchiseMarket' && <>Mercado de franquicia <span className="block text-xs font-normal text-ink-3">Solo se fichan jugadores franquicia.</span></>}
              </span>
            </label>
          ))}
        </div>

        {localStatus === 'scheduled' && (
          <div className="mt-4 pl-2 animate-in fade-in slide-in-from-top-2">
            <label htmlFor="market-open-time" className="text-xs text-ink-3 block mb-1 font-bold">Fecha de Apertura (hora local)</label>
            <input
              id="market-open-time"
              type="datetime-local"
              value={localOpenTime}
              aria-invalid={openTimeError ? true : undefined}
              onChange={(e) => { setLocalOpenTime(e.target.value); setOpenTimeError(''); }}
              className="input sm:w-auto"
            />
            {openTimeError && <p className="field-error" role="alert">{openTimeError}</p>}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-line/[0.08] flex justify-end">
          <button
            type="button"
            onClick={handleSaveStatus}
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? 'Guardando…' : <><Save className="w-4 h-4" aria-hidden="true" /> Guardar cambios</>}
          </button>
        </div>
      </div>

      {/* ZONA DE PELIGRO */}
      <div className="p-5 sm:p-6 bg-danger/[0.06] rounded-2xl border border-danger/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="p-1.5 rounded-lg bg-danger/20 text-danger-soft">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </span>
          <h2 className="text-danger-soft text-base font-bold">
            Zona de peligro: reseteo de temporada
          </h2>
        </div>
        <p className="text-sm text-ink-2 mb-4 leading-relaxed max-w-2xl">
          Vacía todos los planteles (carritos y plantilla pública), plantillas y formaciones (alineación, tácticas, dorsales y banco), borra los usos y búsquedas del scout, y elimina bloqueos de mercado, ofertas, noticias, formaciones compartidas y transferencias. Conserva los presupuestos, el acceso anticipado, el torneo, el chat y las sugerencias.
        </p>
        {!canResetSeason(marketStatus) && (
          <p className="text-xs text-warning-soft mb-3 font-semibold">Primero poné el mercado en «Cerrado» y guardá: con el mercado abierto un fichaje podía quedar a medias.</p>
        )}
        <button
          type="button"
          onClick={() => { setIsResetModalOpen(true); setResetConfirmInput(''); }}
          disabled={isSaving || !canResetSeason(marketStatus)}
          className="btn btn-danger"
        >
          <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} aria-hidden="true" />
          Resetear temporada…
        </button>
      </div>

      {/* Doble confirmación: BaseModal mueve el foco al campo, lo mantiene adentro y Escape cancela (salvo durante el reseteo). */}
      <BaseModal
        isOpen={isResetModalOpen}
        onClose={() => { if (!isSaving) { setIsResetModalOpen(false); setResetConfirmInput(''); } }}
        size="md"
        title="¿Resetear la temporada?"
        subtitle="Vacía los planteles de todos los clubes"
        icon={AlertTriangle}
        showClose={false}
        footer={(
          <>
            <button
              type="button"
              onClick={() => { if (!isSaving) { setIsResetModalOpen(false); setResetConfirmInput(''); } }}
              disabled={isSaving}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmResetDraft}
              disabled={resetConfirmInput.trim().toUpperCase() !== 'RESETEAR' || isSaving}
              className="btn btn-danger"
            >
              <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isSaving ? 'Reseteando…' : 'Resetear temporada'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="text-sm text-ink-2 space-y-2">
            <p className="font-semibold text-ink">Se borra, en todos los equipos:</p>
            <ul className="list-disc list-inside space-y-1 text-ink-2 pl-1">
              <li>Planteles: carritos y plantilla pública de cada club</li>
              <li>Alineaciones, tácticas, dorsales y suplentes</li>
              <li>Historial y créditos mensuales del Scout</li>
              <li>Bloqueos de mercado, ofertas (con su chat), noticias, formaciones compartidas y transferencias</li>
            </ul>
            <p className="pt-1">Se conservan los presupuestos, el acceso anticipado, el torneo, el chat de managers y las sugerencias.</p>
            <p className="text-warning-soft font-semibold pt-1">Si necesitás los planteles de esta temporada en el PES (Draft → PES o CSV), exportalos antes: después del reseteo ya no existen.</p>
            <p className="font-semibold text-danger-soft">No se puede deshacer.</p>
          </div>

          <div>
            <label htmlFor="reset-confirm-input" className="block text-sm font-semibold text-ink-2 mb-1.5">
              Para confirmar, escribí <span className="text-danger-soft font-mono font-bold">RESETEAR</span>
            </label>
            <input
              id="reset-confirm-input"
              type="text"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESETEAR"
              autoComplete="off"
              disabled={isSaving}
              className="input w-full font-mono uppercase"
            />
          </div>

          {resetProgress.active && (
            <div className="rounded-xl bg-raised p-3.5 space-y-2 animate-in fade-in" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-sm font-semibold text-ink">
                <span className="flex items-center gap-2 truncate pr-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                  <span className="truncate">{resetProgress.stage}</span>
                </span>
                {resetProgress.total > 0 && (
                  <span className="num shrink-0">
                    {Math.round((resetProgress.current / resetProgress.total) * 100)}%
                  </span>
                )}
              </div>
              {resetProgress.total > 0 && (
                <div className="w-full bg-canvas rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-[width] duration-move ease-out"
                    style={{ width: `${Math.min(100, Math.round((resetProgress.current / resetProgress.total) * 100))}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-ink-3">No cierres esta ventana mientras se resetea.</p>
            </div>
          )}
        </div>
      </BaseModal>
    </div>
  );
});

export default GeneralAdminSection;
