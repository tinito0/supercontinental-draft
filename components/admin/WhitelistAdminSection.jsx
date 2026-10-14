import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Upload, Save, X, Edit2, UserCheck, RefreshCw, Search } from 'lucide-react';
import { writeBatch, setDoc, getDocs, query, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { formatBudget } from '../../utils/helpers.js';

export const WhitelistUserRow = memo(function WhitelistUserRow({
  user,
  getPublicTeamRef,
  getPrivateProfileRef,
  storage,
  db,
  showStatusMessage,
  onDataChange,
}) {
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
      showStatusMessage('success', 'Guardado.');
      setIsEditing(false);
      onDataChange();
    } catch (e) {
      showStatusMessage('error', 'Error.');
    }
    setIsSaving(false);
  };

  const handleToggleWhitelist = async () => {
    try {
      await setDoc(getPublicTeamRef(user.uid), { inWhitelist: !user.inWhitelist }, { merge: true });
      onDataChange();
    } catch (e) {}
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
      console.error('Error upload:', error);
      showStatusMessage('error', 'Error al subir imagen.');
    }
    setIsUploading(false);
  };

  return (
    <div className="bg-surface p-3.5 rounded-xl border border-line/[0.12] hover:border-accent/30 transition flex flex-col sm:flex-row sm:items-center gap-3">
      {isEditing ? (
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-12 gap-3 items-center w-full">
          {/* Columna 1: Upload y Preview */}
          <div className="sm:col-span-2 flex justify-center sm:justify-start relative group">
            <img src={data.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-line/[0.12] bg-black/50" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <Upload size={12} className="text-ink" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          {/* Columna 2: Inputs */}
          <div className="sm:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={data.teamName}
              onChange={e => setData({ ...data, teamName: e.target.value })}
              className="bg-black/50 border border-line/[0.12] rounded-lg px-3 py-1.5 text-ink text-sm focus:border-accent outline-none w-full"
              placeholder="Nombre Equipo"
            />
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-ink-3 text-xs">$</span>
              <input
                type="number"
                value={data.budget}
                onChange={e => setData({ ...data, budget: e.target.value })}
                className="bg-black/50 border border-line/[0.12] rounded-lg pl-6 pr-3 py-1.5 text-ink text-sm focus:border-accent outline-none w-full font-mono"
                placeholder="Presupuesto"
              />
            </div>
          </div>

          {/* Columna 3: Botones */}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button onClick={handleSave} disabled={isSaving || isUploading} className="bg-emerald-600 text-ink p-2 rounded-lg hover:bg-emerald-500 transition">
              <Save size={16} />
            </button>
            <button onClick={() => setIsEditing(false)} className="bg-overlay text-ink p-2 rounded-lg hover:bg-slate-600 transition">
              <X size={16} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            <img src={user.logoUrl || DEFAULT_LOGO} className="w-10 h-10 rounded-full object-cover border border-line/[0.12] bg-black/50" onError={(e) => e.target.src = DEFAULT_LOGO} />
            <div className="min-w-0">
              <div className="font-bold text-ink text-sm truncate">{user.teamName}</div>
              <div className="text-[10px] text-ink-3 font-mono truncate">{user.uid}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <span className="text-xs font-mono font-bold text-success-soft bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-success/20 mr-2">
              {formatBudget(user.budget)}
            </span>
            <button onClick={() => setIsEditing(true)} className="p-2 text-ink-3 hover:text-ink hover:bg-white/[0.06] rounded-lg transition" title="Editar">
              <Edit2 size={16} />
            </button>
            <button
              onClick={handleToggleWhitelist}
              className={`p-2 rounded-lg transition ${user.inWhitelist ? 'text-success-soft bg-emerald-950/30 border border-success/30 hover:bg-emerald-900/40' : 'text-ink-3 bg-black/40 border border-line/[0.08] hover:bg-white/[0.06]'}`}
              title={user.inWhitelist ? 'Quitar de Whitelist' : 'Añadir a Whitelist'}
            >
              <UserCheck size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export const WhitelistAdminSection = memo(function WhitelistAdminSection({
  getPublicTeamsCollectionRef,
  getPublicTeamRef,
  getPrivateProfileRef,
  storage,
  db,
  showStatusMessage,
}) {
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
            inWhitelist: publicData.inWhitelist || false,
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

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return allUsers;
    const term = searchTerm.toLowerCase().trim();
    return allUsers.filter(u =>
      (u.teamName && u.teamName.toLowerCase().includes(term)) ||
      (u.uid && u.uid.toLowerCase().includes(term))
    );
  }, [allUsers, searchTerm]);

  if (isLoading) return <div className="text-center p-8 text-xs text-ink-3">Cargando usuarios...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Gestión de usuarios y permisos de acceso (Whitelist).</p>
        <button onClick={fetchAllUsers} className="text-accent text-xs hover:underline flex items-center self-end sm:self-auto">
          <RefreshCw size={12} className="inline mr-1" />
          Actualizar
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por equipo o UID..."
          className="w-full bg-canvas border border-line/[0.12] rounded-xl pl-9 pr-8 py-2.5 text-xs text-ink placeholder-slate-500 outline-none focus:border-accent/50"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] text-ink-3 px-1">
        <span>Mostrando {filteredUsers.length} de {allUsers.length} usuarios</span>
        <span>Whitelist activa: {allUsers.filter(u => u.inWhitelist).length}</span>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-ink-3 text-xs border border-dashed border-line/[0.12] rounded-xl">
            No se encontraron usuarios coincidentes con "{searchTerm}".
          </div>
        ) : (
          filteredUsers.map(user => (
            <WhitelistUserRow
              key={user.uid}
              user={user}
              getPublicTeamRef={getPublicTeamRef}
              getPrivateProfileRef={getPrivateProfileRef}
              storage={storage}
              db={db}
              showStatusMessage={showStatusMessage}
              onDataChange={fetchAllUsers}
            />
          ))
        )}
      </div>
    </div>
  );
});

export default WhitelistAdminSection;
