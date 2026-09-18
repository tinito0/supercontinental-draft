import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { X, Save, Upload, Crown, Settings, Users, Trash2, RefreshCw, UserCheck, Shield, Edit2, Power, Trophy, CalendarClock, Eye, Snowflake, XCircle, Gift, AlertTriangle, MessageSquarePlus, FileText, ClipboardList, Download, Plus, DollarSign, Package, Loader2, Search, Radio } from 'lucide-react';
import { onSnapshot, setDoc, deleteDoc, doc, getDocs, query, collection, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_LOGO, DEFAULT_BUDGET, APP_ID, FORMATIONS, DEFAULT_TACTICS } from '../utils/constants.js';
import { formatPriceShort, formatBudget, formatPrice } from '../utils/helpers.js';
import { DEFAULT_BROADCAST_OVERLAY } from './BroadcastOverlay.jsx';
import { TournamentActionButton, TournamentField, TournamentPanel, TournamentSectionTitle, TournamentTabButton, tournamentBackdropClass, tournamentControlClass, tournamentShellClass } from './TournamentUI.jsx';
import { exportTeamToPesZip } from '../utils/pesExport.js';

const FIRESTORE_BATCH_LIMIT = 450;

async function commitBatchOperations(db, operations) {
  for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    operations.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach(operation => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      if (operation.type === 'set') batch.set(operation.ref, operation.data, operation.options || {});
    });
    await batch.commit();
  }
}

export const SuggestionsAdminSection = memo(function SuggestionsAdminSection({ getSuggestionsCollectionRef, showStatusMessage }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const suggestionsQuery = query(getSuggestionsCollectionRef());
        const snapshot = await getDocs(suggestionsQuery);
        const suggestionList = snapshot.docs.map(doc => ({
          id: doc.id, ...doc.data(), timestamp: doc.data().timestamp?.toDate()
        })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setSuggestions(suggestionList);
      } catch (error) {
        console.error(error); showStatusMessage('error', 'Error al cargar sugerencias.');
      }
      setIsLoading(false);
    };
    fetchSuggestions();
  }, [getSuggestionsCollectionRef, showStatusMessage]);

  if (isLoading) return <div className="text-center p-8"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;

  return (
    <div className="space-y-4">
      {suggestions.length === 0 ? (
        <p className="text-gray-500 italic text-center py-8">Bandeja de entrada vacía.</p>
      ) : (
        suggestions.map(sug => (
          <div key={sug.id} className="bg-gray-800/40 p-4 rounded-xl border border-gray-700/50 hover:border-gray-600 transition shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="font-bold text-white text-sm">{sug.teamName || 'Anónimo'}</span>
                <span className="text-xs text-gray-500 font-mono">({sug.userId?.substring(0, 5)}...)</span>
              </div>
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide bg-gray-900/50 px-2 py-1 rounded">
                {sug.timestamp ? sug.timestamp.toLocaleString('es-ES') : '-'}
              </span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed bg-gray-900/30 p-3 rounded-lg border border-gray-700/30">{sug.text}</p>
          </div>
        ))
      )}
    </div>
  );
});

const GeneralAdminSection = memo(function GeneralAdminSection({ getMarketStatusDocRef, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, db, showStatusMessage }) {
  const [marketStatus, setMarketStatus] = useState({ status: 'loading', openTime: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState('loading');
  const [localOpenTime, setLocalOpenTime] = useState('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(getMarketStatusDocRef(), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMarketStatus(data); setLocalStatus(data.status);
        setLocalOpenTime(data.status === 'scheduled' && data.openTime ? data.openTime : new Date().toISOString().substring(0, 16));
      } else {
        setMarketStatus({ status: 'closed', openTime: null }); setLocalStatus('closed');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [getMarketStatusDocRef]);

  const handleSaveStatus = async () => {
    setIsSaving(true);
    try {
      await setDoc(getMarketStatusDocRef(), { status: localStatus, openTime: localStatus === 'scheduled' ? localOpenTime : null });
      showStatusMessage('success', 'Estado actualizado.');
    } catch (e) { showStatusMessage('error', 'Error al guardar.'); }
    setIsSaving(false);
  };

  const handleConfirmResetDraft = async () => {
    if (resetConfirmInput.trim().toUpperCase() !== 'RESETEAR') return;
    setIsSaving(true);
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
        const profileRef = doc(db, `artifacts/${APP_ID}/users/${uid}/profile`, "data");
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
            matchBench: []
          },
          options: { merge: true }
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
            matchBench: []
          },
          options: { merge: true }
        });
      });

      await commitBatchOperations(db, operations);
      showStatusMessage('success', `Reset completado con éxito. Se purgaron ${operations.length} registros (plantillas, carritos, scouts, locks y ofertas).`);
      setIsResetModalOpen(false);
      setResetConfirmInput('');
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al resetear temporada.');
    } finally {
      setIsSaving(false);
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
            <label key={status} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${localStatus === status ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm shadow-cyan-500/10' : 'bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]'}`}>
              <input type="radio" name="marketStatus" value={status} checked={localStatus === status} onChange={(e) => setLocalStatus(e.target.value)} className="form-radio h-4 w-4 text-cyan-400 bg-black/50 border-slate-600 focus:ring-cyan-400 mr-3" />
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
            <input type="datetime-local" value={localOpenTime} onChange={(e) => setLocalOpenTime(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-black/50 text-white border border-white/10 rounded-lg text-sm focus:border-cyan-400 outline-none" />
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/[0.06] flex justify-end">
          <button onClick={handleSaveStatus} disabled={isSaving} className="flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition disabled:opacity-50 active:scale-95">
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
                className="w-full px-4 py-2.5 bg-black/60 border border-red-500/40 rounded-xl text-white font-mono text-sm uppercase outline-none focus:border-red-400"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition"
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
const WhitelistUserRow = memo(function WhitelistUserRow({ user, getPublicTeamRef, getPrivateProfileRef, storage, db, showStatusMessage, onDataChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [data, setData] = useState({ ...user, logoUrl: user.logoUrl || '', budget: user.budget || 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const profileData = { teamName: data.teamName, budget: Number(data.budget), logoUrl: data.logoUrl || DEFAULT_LOGO, userId: user.uid };
      const publicData = { ...profileData, inWhitelist: user.inWhitelist };
      batch.set(getPrivateProfileRef(user.uid), profileData, { merge: true });
      batch.set(getPublicTeamRef(user.uid), publicData, { merge: true });
      await batch.commit();
      showStatusMessage('success', 'Guardado.'); setIsEditing(false); onDataChange();
    } catch (e) { showStatusMessage('error', 'Error.'); }
    setIsSaving(false);
  };

  const handleToggleWhitelist = async () => {
    try {
      await setDoc(getPublicTeamRef(user.uid), { inWhitelist: !user.inWhitelist }, { merge: true });
      onDataChange();
    } catch (e) { }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showStatusMessage('error', 'La imagen es muy pesada (Máx 2MB).');
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setData(prev => ({ ...prev, logoUrl: url }));
      showStatusMessage('success', 'Logo subido. Recuerda pulsar Guardar.');
    } catch (error) {
      console.error("Error upload:", error);
      showStatusMessage('error', 'Error al subir imagen.');
    }
    setIsUploading(false);
  };

  return (
    <div className="bg-[#0c1017] p-3.5 rounded-xl border border-white/[0.08] hover:border-cyan-500/30 transition flex flex-col sm:flex-row sm:items-center gap-3">
      {isEditing ? (
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-3 items-center w-full">
          {/* Columna 1: Upload y Preview */}
          <div className="sm:col-span-2 flex justify-center sm:justify-start relative group">
            <img src={data.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-white/10 bg-black/50" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload size={12} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
            {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full"><div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div></div>}
          </div>

          {/* Columna 2: Inputs */}
          <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" value={data.teamName} onChange={e => setData({ ...data, teamName: e.target.value })} className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-cyan-400 outline-none w-full" placeholder="Nombre Equipo" />
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">$</span>
              <input type="number" value={data.budget} onChange={e => setData({ ...data, budget: e.target.value })} className="bg-black/50 border border-white/10 rounded-lg pl-6 pr-3 py-1.5 text-white text-sm focus:border-cyan-400 outline-none w-full font-mono" placeholder="Presupuesto" />
            </div>
          </div>

          {/* Columna 3: Botones */}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button onClick={handleSave} disabled={isSaving || isUploading} className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-500 transition"><Save size={16} /></button>
            <button onClick={() => setIsEditing(false)} className="bg-slate-700 text-white p-2 rounded-lg hover:bg-slate-600 transition"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            <img src={user.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-white/10 bg-black/50" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate">{user.teamName}</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{user.uid}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-500/20 mr-2">{formatBudget(user.budget)}</span>
            <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition" title="Editar"><Edit2 size={16} /></button>
            <button onClick={handleToggleWhitelist} className={`p-2 rounded-lg transition ${user.inWhitelist ? 'text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 hover:bg-emerald-900/40' : 'text-slate-500 bg-black/40 border border-white/[0.06] hover:bg-white/[0.06]'}`} title={user.inWhitelist ? "Quitar de Whitelist" : "Añadir a Whitelist"}>
              <UserCheck size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

const WhitelistAdminSection = memo(function WhitelistAdminSection({ getPublicTeamsCollectionRef, getPublicTeamRef, getPrivateProfileRef, storage, db, showStatusMessage }) {
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const teamsQuery = query(getPublicTeamsCollectionRef());
      const teamsSnapshot = await getDocs(teamsQuery);

      const profilePromises = teamsSnapshot.docs.map(async (doc) => {
        const publicData = doc.data();
        const privateRef = getPrivateProfileRef(doc.id);
        const privateSnap = await getDoc(privateRef);

        if (privateSnap.exists()) {
          const privateData = privateSnap.data();
          return {
            uid: doc.id,
            teamName: privateData.teamName || publicData.teamName,
            logoUrl: privateData.logoUrl || publicData.logoUrl,
            budget: privateData.budget ?? publicData.budget,
            inWhitelist: publicData.inWhitelist || false
          };
        }
        return { uid: doc.id, ...publicData };
      });

      const combinedUsers = await Promise.all(profilePromises);
      combinedUsers.sort((a, b) => a.teamName.localeCompare(b.teamName));
      setAllUsers(combinedUsers);

    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al cargar usuarios.');
    }
    setIsLoading(false);
  }, [getPublicTeamsCollectionRef, getPrivateProfileRef, showStatusMessage]);

  useEffect(() => { fetchAllUsers(); }, [fetchAllUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return allUsers;
    const term = searchTerm.toLowerCase().trim();
    return allUsers.filter(u =>
      (u.teamName && u.teamName.toLowerCase().includes(term)) ||
      (u.uid && u.uid.toLowerCase().includes(term))
    );
  }, [allUsers, searchTerm]);

  if (isLoading) return <div className="text-center p-8 text-xs text-slate-400">Cargando usuarios...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Gestión de usuarios y permisos de acceso (Whitelist).</p>
        <button onClick={fetchAllUsers} className="text-cyan-400 text-xs hover:underline flex items-center self-end sm:self-auto"><RefreshCw size={12} className="inline mr-1" />Actualizar</button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por equipo o UID..."
          className="w-full bg-[#080c14] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
        <span>Mostrando {filteredUsers.length} de {allUsers.length} usuarios</span>
        <span>Whitelist activa: {allUsers.filter(u => u.inWhitelist).length}</span>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-white/[0.08] rounded-xl">
            No se encontraron usuarios coincidentes con "{searchTerm}".
          </div>
        ) : (
          filteredUsers.map(user => (
            <WhitelistUserRow key={user.uid} user={user} getPublicTeamRef={getPublicTeamRef} getPrivateProfileRef={getPrivateProfileRef} storage={storage} db={db} showStatusMessage={showStatusMessage} onDataChange={fetchAllUsers} />
          ))
        )}
      </div>
    </div>
  );
});

// Equipos admin section
const TeamsAdminSection = memo(function TeamsAdminSection({ getPublicTeamsCollectionRef, getPublicTeamRef, getPrivateProfileRef, storage, db, showStatusMessage }) {
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null); // null = new, object = editing
  const [formData, setFormData] = useState({ teamName: '', budget: 0, logoUrl: '', country: 204, manualStats: {} });
  const [countryOptions, setCountryOptions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetch('/paises.json')
      .then(res => res.json())
      .then(data => {
        const list = Object.entries(data)
          .map(([id, name]) => ({ id: Number(id), name }))
          .filter(c => c.id > 0 && c.name && c.name !== 'N/A')
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountryOptions(list);
      })
      .catch(() => {});
  }, []);

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const teamsSnap = await getDocs(query(getPublicTeamsCollectionRef()));
      const teamPromises = teamsSnap.docs.map(async (teamDoc) => {
        const publicData = teamDoc.data();
        const uid = teamDoc.id;
        const privateSnap = await getDoc(getPrivateProfileRef(uid));
        const privateData = privateSnap.exists() ? privateSnap.data() : {};
        // Count players in cart
        const cartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${uid}/cart`));
        return {
          uid,
          teamName: privateData.teamName || publicData.teamName || 'Sin Nombre',
          logoUrl: privateData.logoUrl || publicData.logoUrl || DEFAULT_LOGO,
          budget: privateData.budget ?? publicData.budget ?? 0,
          country: publicData.country || privateData.country || 204,
          manualStats: publicData.manualStats || {},
          inWhitelist: publicData.inWhitelist || false,
          playerCount: cartSnap.size,
          email: privateData.email || '',
        };
      });
      const result = await Promise.all(teamPromises);
      result.sort((a, b) => a.teamName.localeCompare(b.teamName));
      setTeams(result);
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al cargar equipos.');
    }
    setIsLoading(false);
  }, [getPublicTeamsCollectionRef, getPrivateProfileRef, db, showStatusMessage]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const filteredTeams = useMemo(() => {
    if (!searchTerm.trim()) return teams;
    const term = searchTerm.toLowerCase().trim();
    return teams.filter(t => 
      (t.teamName && t.teamName.toLowerCase().includes(term)) ||
      (t.uid && t.uid.toLowerCase().includes(term)) ||
      (t.email && t.email.toLowerCase().includes(term))
    );
  }, [teams, searchTerm]);

  const openNewTeamModal = () => {
    setEditingTeam(null);
    setFormData({ teamName: '', budget: DEFAULT_BUDGET, logoUrl: '', country: 204, manualStats: {} });
    setShowModal(true);
  };

  const openEditTeamModal = (team) => {
    setEditingTeam(team);
    setFormData({ teamName: team.teamName, budget: team.budget, logoUrl: team.logoUrl, country: team.country || 204, manualStats: team.manualStats || {} });
    setShowModal(true);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uid = editingTeam?.uid || `new_${Date.now()}`;
      const storageRef = ref(storage, `team_logos/${uid}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setFormData(prev => ({ ...prev, logoUrl: url }));
      showStatusMessage('success', 'Escudo subido.');
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'Error al subir el escudo.');
    }
    setIsUploading(false);
  };

  const handleSaveTeam = async () => {
    if (!formData.teamName.trim()) {
      showStatusMessage('error', 'El nombre del equipo es obligatorio.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingTeam) {
        // Edit existing team
        const uid = editingTeam.uid;
        const batch = writeBatch(db);
        const saveData = {
          teamName: formData.teamName.trim(),
          budget: Number(formData.budget) || 0,
          logoUrl: formData.logoUrl || DEFAULT_LOGO,
          country: Number(formData.country) || 204,
          manualStats: formData.manualStats || {},
        };
        batch.set(getPrivateProfileRef(uid), saveData, { merge: true });
        batch.set(getPublicTeamRef(uid), saveData, { merge: true });
        await batch.commit();
        showStatusMessage('success', `Equipo "${formData.teamName}" actualizado.`);
      } else {
        showStatusMessage('error', 'Para agregar un equipo nuevo, el usuario debe registrarse primero. Luego podés editarlo acá.');
        setIsSaving(false);
        return;
      }
      setShowModal(false);
      await fetchTeams();
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'Error al guardar equipo.');
    }
    setIsSaving(false);
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`¿Seguro que querés eliminar el equipo "${team.teamName}"? Esta acción no se puede deshacer.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(getPublicTeamRef(team.uid));
      const cartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${team.uid}/cart`));
      cartSnap.forEach(d => batch.delete(d.ref));
      const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
      locksSnap.forEach(d => {
        if (d.data().lockedBy === team.uid) batch.delete(d.ref);
      });
      await batch.commit();
      showStatusMessage('success', `Equipo "${team.teamName}" eliminado.`);
      await fetchTeams();
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'Error al eliminar equipo.');
    }
  };

  const handleResetFranchise = async (team) => {
    if (!window.confirm(`¿Resetear el Jugador Franquicia de "${team.teamName}"? Esto liberará su cupo y eliminará al jugador de su plantilla.`)) return;
    try {
      const batch = writeBatch(db);
      const profileSnap = await getDoc(getPrivateProfileRef(team.uid));
      const franchisePlayerId = profileSnap.exists() ? profileSnap.data().franchisePlayerId : null;

      batch.set(getPrivateProfileRef(team.uid), {
        franchisePlayerUsed: false,
        franchisePlayerId: null
      }, { merge: true });

      if (franchisePlayerId) {
        const lockRef = doc(db, `artifacts/${APP_ID}/public/data/player_locks`, String(franchisePlayerId));
        batch.delete(lockRef);
        const cartRef = doc(db, `artifacts/${APP_ID}/users/${team.uid}/cart`, String(franchisePlayerId));
        batch.delete(cartRef);
      }

      await batch.commit();
      showStatusMessage('success', `Franquicia de "${team.teamName}" reseteada.`);
      await fetchTeams();
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'Error al resetear franquicia.');
    }
  };

  if (isLoading) return <div className="text-center p-8"><div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div><p className="text-slate-400 text-xs">Cargando equipos...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Gestión de equipos registrados en la liga.</p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button onClick={fetchTeams} className="text-cyan-400 text-xs hover:underline flex items-center"><RefreshCw size={12} className="mr-1" />Actualizar</button>
          <button onClick={openNewTeamModal} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow active:scale-95">
            <Plus size={14} /> Agregar Equipo
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar equipo por nombre, ID o email..."
          className="w-full bg-[#080c14] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
        <span>Mostrando {filteredTeams.length} de {teams.length} equipos</span>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/[0.08] rounded-2xl">
          <Users className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400 font-medium mb-4 text-xs">No hay equipos registrados todavía.</p>
          <button onClick={openNewTeamModal} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition">
            Agregá tu primer equipo
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {filteredTeams.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-white/[0.08] rounded-xl">
              No se encontraron equipos que coincidan con "{searchTerm}".
            </div>
          ) : (
            filteredTeams.map(team => (
              <div key={team.uid} className="flex items-center gap-4 p-3.5 bg-[#0c1017] rounded-xl border border-white/[0.08] hover:border-cyan-500/30 transition group">
                {/* Badge */}
                <img
                  src={team.logoUrl || DEFAULT_LOGO}
                  alt="Escudo"
                  className="w-11 h-11 rounded-xl object-contain bg-black/50 p-1 border border-white/10 flex-shrink-0"
                  onError={(e) => e.target.src = DEFAULT_LOGO}
                />
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-white uppercase tracking-wide truncate group-hover:text-cyan-400 transition-colors">{team.teamName}</h4>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-mono">ID: {team.uid.substring(0, 8)}</span>
                    {team.email && <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{team.email}</span>}
                  </div>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Jugadores</p>
                    <p className="text-sm font-black text-white font-mono">{team.playerCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Presupuesto</p>
                    <p className="text-sm font-black text-emerald-400 font-mono">{formatBudget(team.budget)}</p>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition flex-shrink-0">
                  <button onClick={() => openEditTeamModal(team)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition" title="Editar equipo">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleResetFranchise(team)} className="p-2 rounded-lg hover:bg-purple-500/10 text-slate-400 hover:text-purple-400 transition" title="Resetear Jugador Franquicia">
                    <Crown size={14} />
                  </button>
                  <button onClick={() => handleDeleteTeam(team)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition" title="Eliminar equipo">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[#0c1017] rounded-2xl border border-white/[0.1] w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-white/[0.08]">
              <h3 className="text-base font-black text-white uppercase tracking-wider">{editingTeam ? 'Editar Equipo' : 'Agregar Equipo'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Logo preview + upload */}
              <div className="flex items-center gap-4">
                <img
                  src={formData.logoUrl || DEFAULT_LOGO}
                  alt="Escudo"
                  className="w-16 h-16 rounded-xl object-contain bg-black/50 p-1.5 border border-white/10"
                  onError={(e) => e.target.src = DEFAULT_LOGO}
                />
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Escudo</label>
                  <label className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-slate-300 cursor-pointer hover:bg-white/[0.05] transition">
                    <Upload size={14} /> {isUploading ? 'Subiendo...' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              {/* Team name */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nombre del equipo</label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={e => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-white border border-white/10 rounded-lg text-sm outline-none focus:border-cyan-400 transition"
                  placeholder="Ej: Club Atlético SuperCont"
                />
              </div>
              {/* Budget */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Presupuesto ($)</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={e => setFormData(prev => ({ ...prev, budget: Number(e.target.value) || 0 }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-white border border-white/10 rounded-lg text-sm font-mono outline-none focus:border-cyan-400 transition"
                  placeholder="0"
                />
              </div>
              {/* Country / Nationality */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Nacionalidad / País del Club</label>
                <select
                  value={formData.country || 204}
                  onChange={e => setFormData(prev => ({ ...prev, country: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-white border border-white/10 rounded-lg text-xs outline-none focus:border-cyan-400 transition cursor-pointer"
                >
                  {countryOptions.length > 0 ? (
                    countryOptions.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                    ))
                  ) : (
                    <option value={204}>Inglaterra (ID: 204)</option>
                  )}
                </select>
              </div>
              <div className="border-t border-white/[0.08] pt-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-cyan-300">Estadísticas públicas (edición manual)</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {[
                    ['played', 'Partidos'], ['wins', 'Ganados'], ['draws', 'Empatados'], ['losses', 'Perdidos'],
                    ['gf', 'Goles a favor'], ['ga', 'Goles en contra'], ['titles', 'Títulos'],
                  ].map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.manualStats?.[field] ?? ''}
                        onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, [field]: e.target.value } }))}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Rivalidad</span>
                  <input
                    type="text"
                    value={formData.manualStats?.rival ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, rival: e.target.value } }))}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                    placeholder="Ej: SK Konya"
                  />
                </label>
                <p className="mt-2 text-[10px] text-slate-500">Los campos cargados reemplazan el cálculo automático del perfil público.</p>
              </div>
              {editingTeam && (
                <div className="text-xs text-slate-400 bg-black/30 p-3 rounded-xl border border-white/[0.06]">
                  <span className="font-bold text-slate-300">User ID:</span> <span className="font-mono text-[11px]">{editingTeam.uid}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/[0.08]">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 font-bold text-xs hover:text-white transition">Cancelar</button>
              <button onClick={handleSaveTeam} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow disabled:opacity-50 active:scale-95">
                <Save size={14} /> {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const TemplateAdminSection = memo(({ getPublicTeamsCollectionRef, getPrivateProfileRef, db, showStatusMessage }) => {
  const [teamsData, setTeamsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. CARGA DE DATOS (Aseguramos que traiga players, formation y lineup)
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const publicSnaps = await getDocs(query(getPublicTeamsCollectionRef()));

      const promises = publicSnaps.docs.map(async (teamDoc) => {
        const publicData = teamDoc.data();
        const userId = teamDoc.id;

        const [profileSnap, cartSnap] = await Promise.all([
          getDoc(getPrivateProfileRef(userId)),
          getDocs(collection(db, `artifacts/${APP_ID}/users/${userId}/cart`))
        ]);

        const profileData = profileSnap.exists() ? profileSnap.data() : {};
        const players = cartSnap.docs.map(d => d.data());

        return {
          id: userId,
          name: publicData.teamName || profileData.teamName || "Sin Nombre",
          country: publicData.country || profileData.country || 204,
          dorsals: profileData.dorsals || {},
          formation: profileData.formation || '4-3-3',
          lineup: profileData.lineup || {},
          setPieces: profileData.setPieces || {},
          tactics: profileData.tactics || {},
          players: players || [] // Aseguramos que sea un array
        };
      });

      const results = await Promise.all(promises);
      setTeamsData(results.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error cargando datos de plantillas.');
    }
    setIsLoading(false);
  };

  const [pesExportModalTeam, setPesExportModalTeam] = useState(null);
  const [targetPesTeamId, setTargetPesTeamId] = useState(103);
  const [targetTeamName, setTargetTeamName] = useState('');
  const [targetTeamNationality, setTargetTeamNationality] = useState(204);
  const [targetCoachName, setTargetCoachName] = useState('Director Técnico');
  const [targetCoachNationality, setTargetCoachNationality] = useState(204);
  const [countryOptions, setCountryOptions] = useState([]);
  const [isExportingPes, setIsExportingPes] = useState(false);

  useEffect(() => {
    fetch('/paises.json')
      .then(res => res.json())
      .then(data => {
        const list = Object.entries(data)
          .map(([id, name]) => ({ id: Number(id), name }))
          .filter(c => c.id > 0 && c.name && c.name !== 'N/A')
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountryOptions(list);
      })
      .catch(() => {});
  }, []);

  const handleDownloadPesZip = async () => {
    if (!pesExportModalTeam) return;
    setIsExportingPes(true);
    try {
      const result = await exportTeamToPesZip(
        pesExportModalTeam,
        targetPesTeamId,
        targetCoachName,
        targetTeamName,
        targetCoachNationality,
        targetTeamNationality
      );
      if (result.missingPlayers?.length > 0) {
        showStatusMessage('warning', `Option File exportado con éxito. Nota: ${result.missingPlayers.length} jugador(es) no estaban en el CSV maestro y se exportaron con valores base.`);
      } else {
        showStatusMessage('success', `Option File (${targetTeamName || pesExportModalTeam.name}) exportado correctamente para PES (ID ${targetPesTeamId}).`);
      }
      setPesExportModalTeam(null);
    } catch (err) {
      console.error('Error exportando PES zip:', err);
      showStatusMessage('error', 'Error al generar Option File PES: ' + (err?.message || ''));
    } finally {
      setIsExportingPes(false);
    }
  };

  // 2. Generación de PDF (adaptado a la nueva estructura 'layout')
  const generatePDF = (team) => {
    if (!team.players || !Array.isArray(team.players)) {
      showStatusMessage('error', 'Este equipo no tiene datos de jugadores válidos.');
      return;
    }

    // Importante: asegurate de tener 'import autoTable from "jspdf-autotable";' arriba.
    const doc = new jsPDF();

    // --- HEADER ---
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(`Reporte de Plantilla: ${team.name}`, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`ID Equipo: ${team.id}`, 14, 28);

    // Obtenemos la formación. Si no existe, usamos 4-3-3 por defecto.
    const currentFormation = FORMATIONS[team.formation] || FORMATIONS['4-3-3'];
    doc.text(`Esquema Táctico: ${currentFormation.name}`, 14, 34);

    // --- Procesamiento de alineación ---
    const starters = [];
    const usedPlayerIds = new Set();

    // Iteramos sobre 'layout' en vez de 'slots'.
    // Accedemos a 'slot.pos' para obtener el nombre de la posición (PT, DFC, etc.).
    if (currentFormation.layout) {
      currentFormation.layout.forEach((slot, index) => {
        const posLabel = slot.pos; // Obtenemos el nombre de la posición desde el objeto
        const playerId = team.lineup[index];

        if (playerId) {
          const player = team.players.find(p => String(p.Id) === String(playerId));
          if (player) {
            starters.push({
              posTactical: posLabel,
              dorsal: team.dorsals[player.Id] || '-',
              name: player.Name,
              id: player.Id,
              naturalPos: player.POS_NOMBRE,
              ovr: player.OVR_CALCULADO
            });
            usedPlayerIds.add(String(player.Id));
          } else {
            // Jugador en alineación pero no en carrito (vendido)
            starters.push({ posTactical: posLabel, dorsal: '-', name: '(Vendido/No Disponible)', id: '-', naturalPos: '-', ovr: '-' });
          }
        } else {
          // Hueco vacío
          starters.push({ posTactical: posLabel, dorsal: '-', name: '(Posición Vacía)', id: '-', naturalPos: '-', ovr: '-' });
        }
      });
    }

    // --- PROCESAMIENTO DE SUPLENTES ---
    const subs = team.players
      .filter(p => !usedPlayerIds.has(String(p.Id)))
      .map(p => ({
        dorsal: team.dorsals[p.Id] || '-',
        name: p.Name,
        id: p.Id,
        naturalPos: p.POS_NOMBRE,
        ovr: p.OVR_CALCULADO
      }))
      .sort((a, b) => {
        const dA = parseInt(a.dorsal) || 999;
        const dB = parseInt(b.dorsal) || 999;
        return dA - dB;
      });

    // --- TABLA TITULARES ---
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("11 INICIAL (Posicionamiento en Cancha)", 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [['Rol', '#', 'Jugador', 'ID (Juego)', 'Pos', 'Val']],
      body: starters.map(r => [r.posTactical, r.dorsal, r.name, r.id, r.naturalPos, r.ovr]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        3: { fontStyle: 'italic', fontSize: 9, cellWidth: 30 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 }
      },
      styles: { fontSize: 10, cellPadding: 3, valign: 'middle' }
    });

    // --- TABLA SUPLENTES ---
    let finalY = doc.lastAutoTable.finalY + 15;

    // Salto de página si falta espacio
    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(12);
    doc.text(`BANQUILLO (${subs.length} Jugadores)`, 14, finalY);

    if (subs.length > 0) {
      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Jugador', 'ID (Juego)', 'Pos', 'Val']],
        body: subs.map(r => [r.dorsal, r.name, r.id, r.naturalPos, r.ovr]),
        theme: 'striped',
        headStyles: { fillColor: [127, 140, 141] },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
          2: { fontStyle: 'italic', fontSize: 9, cellWidth: 30 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 15 }
        },
        styles: { fontSize: 10, valign: 'middle' }
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("No hay jugadores en el banquillo.", 14, finalY + 10);
    }

    doc.save(`Plantilla_${team.name.replace(/\s+/g, '_')}_Tactico.pdf`);
  };

  const filteredTeamsData = useMemo(() => {
    if (!searchTerm.trim()) return teamsData;
    const term = searchTerm.toLowerCase().trim();
    return teamsData.filter(t => (t.name && t.name.toLowerCase().includes(term)) || (t.id && t.id.toLowerCase().includes(term)));
  }, [teamsData, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Exportación de plantillas tácticas a PDF y Option File para PES 2021.</p>
        <button onClick={fetchData} className="text-cyan-400 text-xs flex items-center hover:underline self-end sm:self-auto">
          <RefreshCw size={12} className="mr-1" /> Recargar Plantillas
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtrar por club o ID..."
          className="w-full bg-[#080c14] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center p-8">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-slate-400 text-xs">Recopilando datos de todos los equipos...</p>
        </div>
      ) : teamsData.length === 0 ? (
        <div className="text-center p-8 text-slate-500 text-xs border border-dashed border-white/[0.08] rounded-xl">
          No hay datos cargados. Pulsa "Recargar Plantillas".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTeamsData.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-slate-500 text-xs border border-dashed border-white/[0.08] rounded-xl">
              No se encontraron plantillas para "{searchTerm}".
            </div>
          ) : (
            filteredTeamsData.map(team => (
              <div key={team.id} className="bg-[#0c1017] border border-white/[0.08] rounded-xl p-4 hover:border-cyan-500/30 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-white text-base">{team.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {team.id.substring(0, 8)}</p>
                  </div>
                  <span className="bg-cyan-500/10 text-cyan-300 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-cyan-500/20">
                    {team.players.length} Jugadores
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                  <span className="flex items-center"><ClipboardList size={12} className="mr-1" /> {FORMATIONS[team.formation]?.name || team.formation}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => generatePDF(team)}
                    className="bg-white/[0.04] hover:bg-white/[0.08] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center transition border border-white/[0.08] active:scale-95"
                  >
                    <Download size={14} className="mr-1.5" /> PDF Táctico
                  </button>
                  <button
                    onClick={() => {
                      setPesExportModalTeam(team);
                      setTargetPesTeamId(103);
                      setTargetTeamName(team.name || '');
                      setTargetTeamNationality(team.country || 204);
                      setTargetCoachName(team.name ? `DT ${team.name}` : 'Director Técnico');
                      setTargetCoachNationality(204);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center transition shadow-lg active:scale-95"
                  >
                    <Package size={14} className="mr-1.5" /> Exportar PES (.zip)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL EXPORTAR PES OPTION FILE ── */}
      {pesExportModalTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Exportar Option File PES</h3>
              </div>
              <button onClick={() => setPesExportModalTeam(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <div className="text-xs text-gray-300 bg-blue-950/40 border border-blue-800/40 p-3 rounded-xl space-y-1">
              <p className="font-bold text-blue-300">Equipo Original: {pesExportModalTeam.name}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Genera un ZIP con <span className="text-cyan-300 font-mono">Team.csv</span>, <span className="text-cyan-300 font-mono">Roster.csv</span>, <span className="text-cyan-300 font-mono">Players.csv</span>, <span className="text-cyan-300 font-mono">Coach.csv</span>, <span className="text-cyan-300 font-mono">Appearances.csv</span> y <span className="text-cyan-300 font-mono">Formation.csv</span> listo para PES 2021.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Nombre del Club en PES
                  </label>
                  <input
                    type="text"
                    value={targetTeamName}
                    onChange={(e) => setTargetTeamName(e.target.value)}
                    maxLength={32}
                    className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="Ej: Liverpool FC, Boca Juniors, etc."
                  />
                  <span className="text-[10px] text-gray-500">Nombre en PES (máx. 32 car.).</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Nacionalidad / País del Club
                  </label>
                  <select
                    value={targetTeamNationality}
                    onChange={(e) => setTargetTeamNationality(Number(e.target.value))}
                    className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-lg px-2.5 py-2 text-white text-xs outline-none cursor-pointer"
                  >
                    {countryOptions.length > 0 ? (
                      countryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                      ))
                    ) : (
                      <option value={204}>Inglaterra (ID: 204)</option>
                    )}
                  </select>
                  <span className="text-[10px] text-gray-500">País asignado al equipo en Team.csv.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  ID del Club PES a reemplazar
                </label>
                <input
                  type="number"
                  value={targetPesTeamId}
                  onChange={(e) => setTargetPesTeamId(Number(e.target.value))}
                  className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none"
                  placeholder="Ej: 103 (Liverpool), etc."
                />
                <span className="text-[10px] text-gray-500">Ejemplo: 103 para reemplazar Liverpool FC o el ID del club deseado.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Nombre del DT
                  </label>
                  <input
                    type="text"
                    value={targetCoachName}
                    onChange={(e) => setTargetCoachName(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="Director Técnico"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Nacionalidad del DT
                  </label>
                  <select
                    value={targetCoachNationality}
                    onChange={(e) => setTargetCoachNationality(Number(e.target.value))}
                    className="w-full bg-black/60 border border-gray-700 focus:border-cyan-500 rounded-lg px-2.5 py-2 text-white text-xs outline-none cursor-pointer"
                  >
                    {countryOptions.length > 0 ? (
                      countryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                      ))
                    ) : (
                      <option value={204}>Inglaterra (ID: 204)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPesExportModalTeam(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDownloadPesZip}
                disabled={isExportingPes}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50"
              >
                {isExportingPes ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                ) : (
                  <><Download className="w-4 h-4" /> Descargar ZIP</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const OverlayAdminSection = memo(function OverlayAdminSection({
  allTeams,
  broadcastOverlayData,
  onUpdateBroadcastOverlay,
  showStatusMessage,
}) {
  const [form, setForm] = useState({ ...DEFAULT_BROADCAST_OVERLAY, ...(broadcastOverlayData || {}) });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({ ...DEFAULT_BROADCAST_OVERLAY, ...(broadcastOverlayData || {}) });
  }, [broadcastOverlayData]);

  const teams = useMemo(() => {
    return Object.entries(allTeams || {})
      .map(([id, team]) => ({ id, name: team.teamName || `Equipo ${id.slice(0, 5)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeams]);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveOverlay = async (nextForm = form) => {
    if (!onUpdateBroadcastOverlay) return;
    setIsSaving(true);
    try {
      await onUpdateBroadcastOverlay({
        ...nextForm,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetOverlay = () => {
    const next = { ...DEFAULT_BROADCAST_OVERLAY };
    setForm(next);
    saveOverlay(next);
  };

  const copyObsLink = async (scene = form.scene) => {
    const tournamentViews = {
      tabla: 'groups',
      llaves: 'bracket',
      bracket: 'bracket',
      repechaje: 'repechaje',
      goleadores: 'goleadores',
    };
    const tournamentView = tournamentViews[scene];
    const url = tournamentView
      ? `${window.location.origin}/torneo?mode=obs&view=${tournamentView}`
      : `${window.location.origin}/overlay?scene=${scene}`;
    try {
      await navigator.clipboard.writeText(url);
      showStatusMessage('success', 'Link OBS copiado.');
    } catch (error) {
      showStatusMessage('error', url);
    }
  };

  const Input = ({ label, field, placeholder, type = 'text' }) => (
    <TournamentField label={label}>
      <input
        type={type}
        value={form[field] ?? ''}
        onChange={(event) => updateField(field, event.target.value)}
        placeholder={placeholder}
        className={tournamentControlClass}
      />
    </TournamentField>
  );

  return (
    <div className={`-m-4 sm:-m-6 min-h-full ${tournamentShellClass}`}>
      <div className={tournamentBackdropClass}></div>
      <div className="relative z-10 p-5 sm:p-8 space-y-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <TournamentSectionTitle title="Overlay OBS" subtitle="Control de transmision" compact />
          <div className="flex flex-wrap gap-2 justify-center xl:justify-end shrink-0">
            <TournamentActionButton onClick={() => copyObsLink('live')}>Copiar Live</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('tabla')}>Copiar Tabla</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('llaves')}>Copiar Llaves</TournamentActionButton>
            <TournamentActionButton onClick={() => copyObsLink('repechaje')}>Copiar Repechaje</TournamentActionButton>
            <TournamentActionButton tone="slate" onClick={() => copyObsLink(form.scene)}>Copiar Escena</TournamentActionButton>
          </div>
        </div>

        <TournamentPanel title="Escena" icon={Eye} compact>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TournamentField label="Escena">
            <select
              value={form.scene}
              onChange={(event) => updateField('scene', event.target.value)}
              className={tournamentControlClass}
            >
              <option value="live">En vivo</option>
              <option value="previa">Previa</option>
              <option value="descanso">Descanso</option>
              <option value="final">Final</option>
              <option value="tabla">Tabla</option>
              <option value="bracket">Llaves</option>
              <option value="repechaje">Repechaje</option>
              <option value="goleadores">Goleadores</option>
            </select>
            </TournamentField>

            <TournamentField label="Local">
            <select
              value={form.homeTeamId}
              onChange={(event) => updateField('homeTeamId', event.target.value)}
              className={tournamentControlClass}
            >
              <option value="">LOCAL</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            </TournamentField>

            <TournamentField label="Visitante">
            <select
              value={form.awayTeamId}
              onChange={(event) => updateField('awayTeamId', event.target.value)}
              className={tournamentControlClass}
            >
              <option value="">VISITANTE</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            </TournamentField>
          </div>
        </TournamentPanel>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <TournamentPanel title="Marcador" icon={Trophy} compact>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input label="Goles Local" field="homeScore" />
                <Input label="Goles Visitante" field="awayScore" />
                <Input label="Reloj" field="clock" placeholder="45+2" />
                <Input label="Estado" field="matchStatus" placeholder="EN VIVO" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Competicion" field="competitionLabel" />
                <Input label="Fase / Grupo" field="roundLabel" placeholder="GRUPO A" />
              </div>
            </div>
          </TournamentPanel>

          <TournamentPanel title="Rotulos" icon={FileText} compact>
            <div className="space-y-4">
              <Input label="Titular" field="headline" />
              <Input label="Subtitulo" field="subheadline" />
              <Input label="Ticker" field="ticker" />
            </div>
          </TournamentPanel>
        </div>

        <TournamentPanel title="Visibilidad" icon={Eye} accent="slate" compact>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['showScoreboard', 'Marcador'],
              ['showLowerThird', 'Lower third'],
              ['showTicker', 'Ticker'],
            ].map(([field, label]) => (
              <label key={field} className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition ${form[field] ? 'bg-blue-500/10 border-blue-500/50 text-white' : 'bg-black/30 border-slate-700/70 text-slate-400 hover:bg-white/5'}`}>
                <span className="font-semibold text-sm text-slate-200">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={(event) => updateField(field, event.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
              </label>
            ))}
          </div>
        </TournamentPanel>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <TournamentActionButton tone="slate" onClick={resetOverlay} disabled={isSaving}>Reset</TournamentActionButton>
          <TournamentActionButton tone="green" onClick={() => saveOverlay()} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" /> {isSaving ? 'Guardando...' : 'Guardar Overlay'}
          </TournamentActionButton>
        </div>
      </div>
    </div>
  );
});

const TorneoAdminSection = memo(function TorneoAdminSection({
  tournamentData,
  allTeams,
  onOpenTournamentModal,
  showStatusMessage,
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  const copyUrl = async (key, url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      showStatusMessage('success', 'Enlace copiado al portapapeles.');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showStatusMessage('error', 'Error al copiar.');
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const obsLinks = [
    {
      key: 'live',
      title: 'Overlay Marcador En Vivo',
      desc: 'Marcador, tiempo, escudos, lower third y ticker para la transmisión en directo.',
      url: `${origin}/overlay?scene=live`,
      badge: 'Transmisión',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      key: 'groups',
      title: 'Tabla General de Posiciones',
      desc: 'Tabla de clasificación en vivo con puntos, DG y partidos jugados en 1080p.',
      url: `${origin}/torneo?mode=obs&view=groups`,
      badge: 'Fase Regular',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      key: 'bracket',
      title: 'Llaves Eliminatorias (Oro)',
      desc: 'Bracket de cuartos, semifinales y Gran Final de la SuperContinental League.',
      url: `${origin}/torneo?mode=obs&view=bracket`,
      badge: 'Playoffs',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    {
      key: 'repechaje',
      title: 'Copa de Plata (Repechaje)',
      desc: 'Cuadro de eliminación para los equipos de fase de repechaje.',
      url: `${origin}/torneo?mode=obs&view=repechaje`,
      badge: 'Repechaje',
      badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    {
      key: 'goleadores',
      title: 'Líderes de Goleo',
      desc: 'Ranking individual con los máximos goleadores del torneo.',
      url: `${origin}/torneo?mode=obs&view=goleadores`,
      badge: 'Estadísticas',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      key: 'previa',
      title: 'Escena Previa',
      desc: 'Rótulo de previa de transmisión con titular y subtítulo personalizable.',
      url: `${origin}/overlay?scene=previa`,
      badge: 'Previa',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
    {
      key: 'descanso',
      title: 'Escena Entretiempo',
      desc: 'Rótulo de descanso/medio tiempo con marcador fijado.',
      url: `${origin}/overlay?scene=descanso`,
      badge: 'Entretiempo',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
    {
      key: 'final',
      title: 'Escena Post-Partido',
      desc: 'Rótulo de finalización con estadísticas y resultado definitivo.',
      url: `${origin}/overlay?scene=final`,
      badge: 'Post-Partido',
      badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    },
  ];

  const leagueTeamsCount = tournamentData?.league?.filter(t => t.name && t.name !== 'Club...')?.length || 0;
  const matchesCount = tournamentData?.matches?.length || 0;
  const completedMatches = tournamentData?.matches?.filter(m => m.status === 'completed')?.length || 0;
  const topScorer = tournamentData?.topScorers?.[0];

  return (
    <div className="space-y-6">
      {/* HUB BANNER & LAUNCHER */}
      <div className="bg-gradient-to-br from-[#0c1322] via-[#090d16] to-[#06080d] p-6 rounded-2xl border border-cyan-500/20 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Trophy className="w-5 h-5" />
              </span>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Centro de Control de Torneo & OBS</h3>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 border border-sky-500/25 text-sky-400">
                ADMIN EXCLUSIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed mt-1">
              El módulo de torneos está optimizado exclusivamente para transmisiones OBS y gestión del administrador. Usa los enlaces directos transparentes para tus escenas o abre el gestor para editar cruces y partidos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onOpenTournamentModal) {
                  onOpenTournamentModal();
                } else {
                  navigate('/torneo');
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> Abrir Gestor de Torneo
            </button>
            <button
              type="button"
              onClick={() => navigate('/torneo')}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              Pantalla Completa ↗
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/[0.07] relative z-10">
          <div className="bg-black/30 rounded-xl p-3 border border-white/[0.05]">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Equipos en Tabla</span>
            <span className="text-lg font-black text-white font-mono">{leagueTeamsCount}</span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-white/[0.05]">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Partidos Jugados</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{completedMatches} <span className="text-xs text-slate-500">/ {matchesCount}</span></span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-white/[0.05]">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Goleador Actual</span>
            <span className="text-sm font-black text-cyan-400 truncate block">{topScorer?.name ? `${topScorer.name} (${topScorer.goals || 0})` : 'Sin datos'}</span>
          </div>
          <div className="bg-black/30 rounded-xl p-3 border border-white/[0.05]">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Modo OBS</span>
            <span className="text-sm font-black text-amber-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 1080p Activo
            </span>
          </div>
        </div>
      </div>

      {/* OBS DIRECT LINKS GRID */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" /> Fuentes de Navegador para OBS Studio
          </h4>
          <span className="text-[11px] text-slate-400">Resolución recomendada: 1920x1080 (Fondo Transparente)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {obsLinks.map((link) => {
            const isCopied = copiedKey === link.key;
            return (
              <div
                key={link.key}
                className="bg-[#0c1017] hover:bg-[#101724] p-4 rounded-xl border border-white/[0.08] hover:border-cyan-500/30 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {link.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${link.badgeColor}`}>
                      {link.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {link.desc}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
                  <input
                    type="text"
                    readOnly
                    value={link.url}
                    className="flex-1 bg-black/40 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 font-mono truncate select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyUrl(link.key, link.url)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                      isCopied
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-white/[0.06] hover:bg-cyan-500 hover:text-slate-950 text-slate-300'
                    }`}
                  >
                    {isCopied ? '¡Copiado!' : 'Copiar'}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition"
                    title="Previsualizar escena"
                  >
                    <Eye size={14} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export const AdminModal = memo(function AdminModal({
  isVisible,
  isPage,
  onClose,
  tournamentData,
  onUpdateTournament,
  onOpenTournamentModal,
  ...props
}) {
  const [activeTab, setActiveTab] = useState('general');
  const TabButton = ({ tabId, label, icon: Icon }) => (
    <TournamentTabButton id={tabId} label={label} icon={Icon} activeTab={activeTab} onClick={setActiveTab} />
  );

  if (!isVisible && !isPage) return null;

  return (
    <div className={isPage ? "w-full h-full flex flex-col animate-in fade-in duration-300" : "fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300"} onClick={!isPage ? onClose : undefined}>
      <div className={isPage ? "w-full h-full min-h-0 flex flex-col relative overflow-hidden bg-[#06080d]" : "bg-[#0c1017] sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] flex flex-col border-0 sm:border border-white/[0.08] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"} onClick={!isPage ? (e => e.stopPropagation()) : undefined}>
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-white/[0.08] bg-[#0c1017] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">Panel de Administración</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 border border-sky-500/25 text-sky-400">
              v2.6.0
            </span>
          </div>
          {!isPage && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"><X size={20} /></button>}
        </div>

        {/* Pestañas de administración */}
        <div className="flex border-b border-white/[0.08] bg-[#080c14] px-2 sm:px-4 overflow-x-auto">
          <TabButton tabId="general" label="Config" icon={Settings} />
          <TabButton tabId="equipos" label="Equipos" icon={Shield} />
          <TabButton tabId="users" label="Usuarios" icon={Users} />
          <TabButton tabId="torneo" label="Torneo & OBS" icon={Trophy} />
          <TabButton tabId="templates" label="Plantillas" icon={FileText} />
          <TabButton tabId="overlay" label="Marcador En Vivo" icon={Radio} />
          <TabButton tabId="suggestions" label="Buzón" icon={MessageSquarePlus} />
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-20">
          {activeTab === 'general' && <GeneralAdminSection {...props} />}
          {activeTab === 'equipos' && <TeamsAdminSection {...props} />}
          {activeTab === 'users' && <WhitelistAdminSection {...props} />}
          {activeTab === 'torneo' && (
            <TorneoAdminSection
              tournamentData={tournamentData}
              allTeams={props.allTeams}
              onOpenTournamentModal={onOpenTournamentModal}
              showStatusMessage={props.showStatusMessage}
            />
          )}
          {activeTab === 'templates' && <TemplateAdminSection {...props} />}
          {activeTab === 'overlay' && <OverlayAdminSection {...props} />}
          {activeTab === 'suggestions' && <SuggestionsAdminSection {...props} />}
        </div>
      </div>
    </div>
  );
});

