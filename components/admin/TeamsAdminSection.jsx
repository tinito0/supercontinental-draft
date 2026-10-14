import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { RefreshCw, Plus, Search, X, Users, Edit2, Crown, Trash2, Upload, Save } from 'lucide-react';
import { getDocs, query, collection, getDoc, writeBatch, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_LOGO, DEFAULT_BUDGET, APP_ID } from '../../utils/constants.js';
import { formatBudget } from '../../utils/helpers.js';

export const TeamsAdminSection = memo(function TeamsAdminSection({
  getPublicTeamsCollectionRef,
  getPublicTeamRef,
  getPrivateProfileRef,
  storage,
  db,
  showStatusMessage,
}) {
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

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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
    setFormData({
      teamName: team.teamName,
      budget: team.budget,
      logoUrl: team.logoUrl,
      country: team.country || 204,
      manualStats: team.manualStats || {},
    });
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
        franchisePlayerId: null,
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

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-slate-400 text-xs">Cargando equipos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Gestión de equipos registrados en la liga.</p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button onClick={fetchTeams} className="text-cyan-400 text-xs hover:underline flex items-center">
            <RefreshCw size={12} className="mr-1" />
            Actualizar
          </button>
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
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition">
                <X size={18} />
              </button>
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

export default TeamsAdminSection;
