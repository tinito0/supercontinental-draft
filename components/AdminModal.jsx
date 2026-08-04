import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { X, Save, Upload, Crown, Settings, Users, Trash2, RefreshCw, UserCheck, Shield, Edit2, Power, Trophy, CalendarClock, Eye, Snowflake, XCircle, Gift, AlertTriangle, MessageSquarePlus, FileText, ClipboardList, Download, Plus, DollarSign } from 'lucide-react';
import { onSnapshot, setDoc, deleteDoc, doc, getDocs, query, collection, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_LOGO, DEFAULT_BUDGET, APP_ID, FORMATIONS } from '../utils/constants.js';
import { formatPriceShort, formatBudget, formatPrice } from '../utils/helpers.js';
import { DEFAULT_BROADCAST_OVERLAY } from './BroadcastOverlay.jsx';
import { TournamentActionButton, TournamentField, TournamentPanel, TournamentSectionTitle, TournamentTabButton, tournamentBackdropClass, tournamentControlClass, tournamentShellClass } from './TournamentUI.jsx';

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

  const handleResetDraft = async () => {
    if (!window.confirm("¡PELIGRO! Esto resetea la temporada completa: planteles, locks, ofertas, mercado en vivo y formaciones. ¿Continuar?")) return;
    setIsSaving(true);
    try {
      const [locks, legacyLocks, teams, offers, transfers, sharedFormations] = await Promise.all([
        getDocs(query(getPublicLocksCollectionRef())),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/locks`))),
        getDocs(query(getPublicTeamsCollectionRef())),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/offers`))),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/transfers`))),
        getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/shared_formations`))),
      ]);

      const operations = [];
      [locks, legacyLocks, offers, transfers, sharedFormations].forEach(snapshot => {
        snapshot.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
      });

      const carts = await Promise.all(teams.docs.map(t => getDocs(collection(db, `artifacts/${APP_ID}/users/${t.id}/cart`))));
      carts.forEach(c => c.forEach(d => operations.push({ type: 'delete', ref: d.ref })));

      teams.docs.forEach(t => {
        const profileRef = doc(db, `artifacts/${APP_ID}/users/${t.id}/profile`, "data");
        operations.push({
          type: 'set',
          ref: profileRef,
          data: {
            franchisePlayerUsed: false,
            franchisePlayerId: null,
            lineup: {},
            dorsals: {},
            formation: '4-3-3'
          },
          options: { merge: true }
        });
      });

      await commitBatchOperations(db, operations);
      showStatusMessage('success', `Reset completado. Se limpiaron ${operations.length} registros.`);
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al resetear temporada.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="text-center text-gray-500 text-sm">Cargando...</div>;

  return (
    <div className="space-y-8">
      {/* CONTROL DE MERCADO */}
      <div className="bg-gray-800/40 p-6 rounded-xl border border-blue-500/30 shadow-lg">
        <h4 className="text-sm font-bold text-blue-300 uppercase tracking-wider mb-4 flex items-center">
          <Settings className="w-4 h-4 mr-2" /> Control de Mercado
        </h4>
        <div className="space-y-3">
          {['open', 'closed', 'scheduled', 'FranchiseMarket'].map((status) => (
            <label key={status} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${localStatus === status ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-900/50 border-gray-700 text-gray-400 hover:bg-gray-800'}`}>
              <input type="radio" name="marketStatus" value={status} checked={localStatus === status} onChange={(e) => setLocalStatus(e.target.value)} className="form-radio h-4 w-4 text-blue-500 bg-gray-900 border-gray-600 focus:ring-blue-500 mr-3" />
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
            <label className="text-xs text-gray-400 block mb-1 font-bold uppercase">Fecha de Apertura</label>
            <input type="datetime-local" value={localOpenTime} onChange={(e) => setLocalOpenTime(e.target.value)} className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white border border-gray-600 rounded-lg text-sm focus:border-blue-500 outline-none" />
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-700/50 flex justify-end">
          <button onClick={handleSaveStatus} disabled={isSaving} className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition disabled:opacity-50">
            {isSaving ? 'Guardando...' : <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>}
          </button>
        </div>
      </div>

      {/* ZONA DE PELIGRO */}
      <div className="p-4 bg-red-900/10 rounded-xl border border-red-900/50">
        <h4 className="text-red-400 font-bold mb-2 flex items-center"><AlertTriangle className="w-4 h-4 mr-2" /> Zona de Peligro</h4>
        <button onClick={handleResetDraft} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:opacity-50">
          <RefreshCw className="w-4 h-4 mr-2" /> {isSaving ? 'Reseteando...' : 'Resetear Temporada'}
        </button>
      </div>
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

    // Validar tipo y tamaño (opcional, ej: max 2MB)
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
    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/50 hover:border-gray-600 transition flex flex-col sm:flex-row sm:items-center gap-3">
      {isEditing ? (
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-3 items-center w-full">
          {/* Columna 1: Upload y Preview (2 cols) */}
          <div className="sm:col-span-2 flex justify-center sm:justify-start relative group">
            <img src={data.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-gray-600 bg-gray-900" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload size={12} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
            {isUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
          </div>

          {/* Columna 2: Inputs (8 cols) */}
          <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" value={data.teamName} onChange={e => setData({ ...data, teamName: e.target.value })} className="bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:border-blue-500 outline-none w-full" placeholder="Nombre Equipo" />
            <div className="relative">
              <span className="absolute left-2 top-1.5 text-gray-500 text-xs">$</span>
              <input type="number" value={data.budget} onChange={e => setData({ ...data, budget: e.target.value })} className="bg-gray-900 border border-gray-600 rounded pl-5 pr-3 py-1.5 text-white text-sm focus:border-blue-500 outline-none w-full" placeholder="Presupuesto" />
            </div>
          </div>

          {/* Columna 3: Botones (2 cols) */}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button onClick={handleSave} disabled={isSaving || isUploading} className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-500 transition"><Save size={16} /></button>
            <button onClick={() => setIsEditing(false)} className="bg-gray-600 text-white p-2 rounded-lg hover:bg-gray-500 transition"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            <img src={user.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-gray-600 bg-gray-900" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate">{user.teamName}</div>
              <div className="text-[10px] text-gray-500 font-mono truncate">{user.uid}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <span className="text-xs font-mono text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-900/50 mr-2">{formatBudget(user.budget)}</span>
            <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition" title="Editar"><Edit2 size={16} /></button>
            <button onClick={handleToggleWhitelist} className={`p-2 rounded-lg transition ${user.inWhitelist ? 'text-green-400 bg-green-900/20 hover:bg-green-900/40' : 'text-gray-500 bg-gray-900 hover:bg-gray-700'}`} title={user.inWhitelist ? "Quitar de Whitelist" : "Añadir a Whitelist"}>
              <UserCheck size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

const WhitelistAdminSection = memo(function WhitelistAdminSection({ getPublicTeamsCollectionRef, getPublicTeamRef, getPrivateProfileRef, storage, db, showStatusMessage }) {
  // Lógica de fetch igual que antes, solo renderiza WhitelistUserRow.
  // Por brevedad, mantiene la lógica de fetchAllUsers acá.
  // Si necesitás el código completo de esta sección, es igual al anterior pero envuelto.
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) return <div className="text-center p-4 text-xs text-gray-500">Cargando usuarios...</div>

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end mb-2 px-1">
        <p className="text-xs text-gray-400">Gestión de usuarios y permisos de acceso (Whitelist).</p>
        <button onClick={fetchAllUsers} className="text-blue-400 text-xs hover:underline"><RefreshCw size={12} className="inline mr-1" />Actualizar</button>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
        {allUsers.map(user => (
          <WhitelistUserRow key={user.uid} user={user} getPublicTeamRef={getPublicTeamRef} getPrivateProfileRef={getPrivateProfileRef} storage={storage} db={db} showStatusMessage={showStatusMessage} onDataChange={fetchAllUsers} />
        ))}
      </div>
    </div>
  );
});

// Equipos admin section
const TeamsAdminSection = memo(function TeamsAdminSection({ getPublicTeamsCollectionRef, getPublicTeamRef, getPrivateProfileRef, storage, db, showStatusMessage }) {
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null); // null = new, object = editing
  const [formData, setFormData] = useState({ teamName: '', budget: 0, logoUrl: '', manualStats: {} });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  const openNewTeamModal = () => {
    setEditingTeam(null);
    setFormData({ teamName: '', budget: DEFAULT_BUDGET, logoUrl: '', manualStats: {} });
    setShowModal(true);
  };

  const openEditTeamModal = (team) => {
    setEditingTeam(team);
    setFormData({ teamName: team.teamName, budget: team.budget, logoUrl: team.logoUrl, manualStats: team.manualStats || {} });
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
          manualStats: formData.manualStats || {},
        };
        batch.set(getPrivateProfileRef(uid), saveData, { merge: true });
        batch.set(getPublicTeamRef(uid), saveData, { merge: true });
        await batch.commit();
        showStatusMessage('success', `Equipo "${formData.teamName}" actualizado.`);
      } else {
        // Creating a new team entry requires a userId; admin can't create users here.
        // but can pre-register a slot. For now show explanation.
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
      // Delete public team doc
      batch.delete(getPublicTeamRef(team.uid));
      // Delete all cart items
      const cartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${team.uid}/cart`));
      cartSnap.forEach(d => batch.delete(d.ref));
      // Delete player locks belonging to this user
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
      // 1. Read the franchise player ID from the profile
      const profileSnap = await getDoc(getPrivateProfileRef(team.uid));
      const franchisePlayerId = profileSnap.exists() ? profileSnap.data().franchisePlayerId : null;

      // 2. Reset franchise flags in profile
      batch.set(getPrivateProfileRef(team.uid), {
        franchisePlayerUsed: false,
        franchisePlayerId: null
      }, { merge: true });

      // 3. If there was a franchise player, remove its lock and cart entry
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

  if (isLoading) return <div className="text-center p-8"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div><p className="text-gray-400 text-sm">Cargando equipos...</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-xs text-gray-400">Gestión de equipos registrados en la liga.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTeams} className="text-blue-400 text-xs hover:underline flex items-center"><RefreshCw size={12} className="mr-1" />Actualizar</button>
          <button onClick={openNewTeamModal} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition shadow active:scale-95">
            <Plus size={14} /> Agregar Equipo
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-700 rounded-2xl">
          <Users className="w-12 h-12 text-gray-700 mb-3" />
          <p className="text-gray-500 font-medium mb-4">No hay equipos registrados todavía.</p>
          <button onClick={openNewTeamModal} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition">
            Agregá tu primer equipo
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {teams.map(team => (
            <div key={team.uid} className="flex items-center gap-4 p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-gray-600 transition group">
              {/* Badge */}
              <img
                src={team.logoUrl || DEFAULT_LOGO}
                alt="Escudo"
                className="w-11 h-11 rounded-xl object-contain bg-black/50 p-1 border border-gray-700 flex-shrink-0"
                onError={(e) => e.target.src = DEFAULT_LOGO}
              />
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-white uppercase tracking-wide truncate">{team.teamName}</h4>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-600 font-mono">ID: {team.uid.substring(0, 8)}</span>
                  {team.email && <span className="text-[10px] text-gray-500 truncate max-w-[150px]">{team.email}</span>}
                </div>
              </div>
              {/* Stats */}
              <div className="flex items-center gap-4 text-right flex-shrink-0">
                <div>
                  <p className="text-[9px] text-gray-600 uppercase font-bold">Jugadores</p>
                  <p className="text-sm font-black text-white/70">{team.playerCount}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-600 uppercase font-bold">Presupuesto</p>
                  <p className="text-sm font-black text-emerald-400">{formatBudget(team.budget)}</p>
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button onClick={() => openEditTeamModal(team)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition" title="Editar equipo">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleResetFranchise(team)} className="p-2 rounded-lg hover:bg-purple-500/10 text-gray-400 hover:text-purple-400 transition" title="Resetear Jugador Franquicia">
                  <Crown size={14} />
                </button>
                <button onClick={() => handleDeleteTeam(team)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition" title="Eliminar equipo">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white">{editingTeam ? 'Editar Equipo' : 'Agregar Equipo'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Logo preview + upload */}
              <div className="flex items-center gap-4">
                <img
                  src={formData.logoUrl || DEFAULT_LOGO}
                  alt="Escudo"
                  className="w-16 h-16 rounded-xl object-contain bg-black/50 p-1.5 border border-gray-700"
                  onError={(e) => e.target.src = DEFAULT_LOGO}
                />
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Escudo</label>
                  <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 cursor-pointer hover:bg-gray-700 transition">
                    <Upload size={14} /> {isUploading ? 'Subiendo...' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              {/* Team name */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Nombre del equipo</label>
                <input
                  type="text"
                  value={formData.teamName}
                  onChange={e => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm outline-none focus:border-blue-500 transition"
                  placeholder="Ej: Club Atlético SuperCont"
                />
              </div>
              {/* Budget */}
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Presupuesto ($)</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={e => setFormData(prev => ({ ...prev, budget: Number(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-gray-800 text-white border border-gray-700 rounded-lg text-sm outline-none focus:border-blue-500 transition"
                  placeholder="0"
                />
              </div>
              <div className="border-t border-gray-700 pt-4">
                <p className="mb-3 text-xs font-black uppercase tracking-wider text-cyan-300">Estadísticas públicas (edición manual)</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    ['played', 'Partidos'], ['wins', 'Ganados'], ['draws', 'Empatados'], ['losses', 'Perdidos'],
                    ['gf', 'Goles a favor'], ['ga', 'Goles en contra'], ['titles', 'Títulos'],
                  ].map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.manualStats?.[field] ?? ''}
                        onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, [field]: e.target.value } }))}
                        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-gray-500">Rivalidad</span>
                  <input
                    type="text"
                    value={formData.manualStats?.rival ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, rival: e.target.value } }))}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="Ej: SK Konya"
                  />
                </label>
                <p className="mt-2 text-[10px] text-gray-500">Los campos cargados reemplazan el cálculo automático del perfil público.</p>
              </div>
              {editingTeam && (
                <div className="text-xs text-gray-500 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                  <span className="font-bold text-gray-400">User ID:</span> {editingTeam.uid}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 font-bold text-sm hover:text-white transition">Cancelar</button>
              <button onClick={handleSaveTeam} disabled={isSaving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition shadow disabled:opacity-50 active:scale-95">
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
          dorsals: profileData.dorsals || {},
          formation: profileData.formation || '4-3-3',
          lineup: profileData.lineup || {},
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
        1: { halign: 'center', cellWidth: 15 },
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

  return (
    <div className="space-y-4">
      <button onClick={fetchData} className="text-blue-400 text-sm flex items-center hover:underline mb-4">
        <RefreshCw size={14} className="mr-1" /> Recargar Datos de Plantillas
      </button>

      {isLoading ? (
        <div className="text-center p-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Recopilando datos de todos los equipos...</p>
        </div>
      ) : teamsData.length === 0 ? (
        <div className="text-center p-8 text-gray-500 border border-dashed border-gray-700 rounded-xl">
          No hay datos cargados. Pulsa "Recargar Datos".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamsData.map(team => (
            <div key={team.id} className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 hover:bg-gray-800/60 transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-white text-lg">{team.name}</h4>
                  <p className="text-xs text-gray-500 font-mono">ID: {team.id.substring(0, 8)}</p>
                </div>
                <span className="bg-blue-900/30 text-blue-300 text-xs px-2 py-1 rounded border border-blue-500/20">
                  {team.players.length} Jugadores
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                <span className="flex items-center"><ClipboardList size={12} className="mr-1" /> {FORMATIONS[team.formation]?.name || team.formation}</span>
              </div>

              <button
                onClick={() => generatePDF(team)}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center shadow-lg transition transform active:scale-95"
              >
                <Download size={16} className="mr-2" /> Descargar PDF Táctico
              </button>
            </div>
          ))}
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
              <label key={field} className={`flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer transition ${form[field] ? 'bg-blue-500/10 border-blue-500/50 text-white shadow-[inset_0_0_24px_rgba(59,130,246,0.12)]' : 'bg-black/30 border-slate-700/70 text-slate-400 hover:bg-white/5'}`}>
                <span className="font-black text-sm uppercase tracking-wider">{label}</span>
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

export const AdminModal = memo(function AdminModal({ isVisible, isPage, onClose, ...props }) {
  const [activeTab, setActiveTab] = useState('general');
  const TabButton = ({ tabId, label, icon: Icon }) => (
    <TournamentTabButton id={tabId} label={label} icon={Icon} activeTab={activeTab} onClick={setActiveTab} />
  );

  if (!isVisible && !isPage) return null;

  return (
    <div className={isPage ? "w-full h-full flex flex-col animate-in fade-in duration-300" : "fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300"} onClick={!isPage ? onClose : undefined}>
      <div className={isPage ? "w-full h-full min-h-0 flex flex-col relative overflow-hidden" : "bg-gray-900/95 sm:rounded-2xl shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] flex flex-col border-0 sm:border border-gray-700/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"} onClick={!isPage ? (e => e.stopPropagation()) : undefined}>
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-700 bg-gray-800/80 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-white">Admin Panel</h2>
          {!isPage && <button onClick={onClose}><X size={24} /></button>}
        </div>

        {/* Botón para la pestaña Usuarios */}
        <div className="flex border-b border-gray-700 bg-gray-900/50 px-2 sm:px-4 overflow-x-auto">
          <TabButton tabId="general" label="Config" icon={Settings} />
          <TabButton tabId="equipos" label="Equipos" icon={Shield} />
          <TabButton tabId="users" label="Usuarios" icon={Users} />
          <TabButton tabId="templates" label="Plantillas" icon={FileText} />
          <TabButton tabId="overlay" label="Overlay OBS" icon={Eye} />
          <TabButton tabId="suggestions" label="Buzón" icon={MessageSquarePlus} />
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-20">
          {activeTab === 'general' && <GeneralAdminSection {...props} />}
          {activeTab === 'equipos' && <TeamsAdminSection {...props} />}
          {activeTab === 'users' && <WhitelistAdminSection {...props} />}
          {activeTab === 'templates' && <TemplateAdminSection {...props} />}
          {activeTab === 'overlay' && <OverlayAdminSection {...props} />}
          {activeTab === 'suggestions' && <SuggestionsAdminSection {...props} />}
        </div>
      </div>
    </div>
  );
});

