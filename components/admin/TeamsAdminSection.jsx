import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { RefreshCw, Search, X, Users, Edit2, Crown, Trash2, Upload, Save, KeyRound, UserCheck } from 'lucide-react';
import { getDocs, query, collection, getDoc, writeBatch, doc, setDoc, where, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_LOGO, APP_ID } from '../../utils/constants.js';
import { formatBudget } from '../../utils/helpers.js';
import { filterAdminTeams, mergeAdminTeamProfile, parseBudgetInput, sortByTeamName, validateLogoFile } from '../../utils/adminTeams.js';
import { BaseModal } from '../ui/BaseModal.jsx';
import { commitBatchOperations } from './commitBatchOperations.js';
import { resizeImageFile } from '../../utils/resizeImage.js';
import { renameTeamInTournament } from '../../utils/tournamentRename.js';

const ACCESS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes de aprobación' },
  { id: 'early', label: 'Con acceso anticipado' },
  { id: 'regular', label: 'Sin acceso anticipado' },
];

// Equipos y usuarios en una sola lista: cada usuario registrado es un equipo (teams/{uid} + su perfil).
// Antes había dos pestañas que leían los mismos documentos y editaban los mismos campos; la de
// "Usuarios" solo agregaba la whitelist, que acá es el acceso anticipado al mercado.
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState('all');
  const [togglingUid, setTogglingUid] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({ teamName: '', budget: '', logoUrl: '', country: 204, manualStats: {} });
  const [formErrors, setFormErrors] = useState({});
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
        return { ...mergeAdminTeamProfile(uid, publicData, privateData), playerCount: cartSnap.size };
      });
      setTeams(sortByTeamName(await Promise.all(teamPromises)));
      setHasLoaded(true);
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al cargar equipos.');
    }
    setIsLoading(false);
  }, [getPublicTeamsCollectionRef, getPrivateProfileRef, db, showStatusMessage]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const filteredTeams = useMemo(
    () => filterAdminTeams(teams, { query: searchTerm, access: accessFilter }),
    [teams, searchTerm, accessFilter],
  );
  const earlyAccessCount = teams.filter(team => team.inWhitelist).length;
  const pendingCount = teams.filter(team => team.pendingApproval).length;

  // Membership: a new sign-in cannot sign, make offers or chat until approved here (rules and market function).
  // Rejecting someone is deleting their team (the trash button).
  const handleApprove = async (team) => {
    setTogglingUid(team.uid);
    try {
      await setDoc(getPublicTeamRef(team.uid), { approved: true }, { merge: true });
      setTeams(prev => prev.map(row => (row.uid === team.uid ? { ...row, pendingApproval: false } : row)));
      showStatusMessage('success', `${team.teamName} ya es parte de la liga.`);
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'No se pudo aprobar el equipo.');
    }
    setTogglingUid('');
  };

  // La whitelist (teams/{uid}.inWhitelist) deja usar el mercado aunque esté cerrado o programado (app.jsx → isMarketOpen).
  const handleToggleAccess = async (team) => {
    const next = !team.inWhitelist;
    if (!next && !window.confirm(`¿Quitarle a "${team.teamName}" el acceso anticipado? Si el mercado está cerrado, deja de poder usarlo.`)) return;
    setTogglingUid(team.uid);
    try {
      await setDoc(getPublicTeamRef(team.uid), { inWhitelist: next }, { merge: true });
      setTeams(prev => prev.map(row => (row.uid === team.uid ? { ...row, inWhitelist: next } : row)));
      showStatusMessage('success', next ? `${team.teamName} tiene acceso anticipado al mercado.` : `${team.teamName} ya no tiene acceso anticipado.`);
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'No se pudo cambiar el acceso anticipado.');
    }
    setTogglingUid('');
  };

  const openEditTeamModal = (team) => {
    setEditingTeam(team);
    setFormErrors({});
    setFormData({
      teamName: team.teamName,
      budget: String(team.budget),
      logoUrl: team.logoUrl,
      country: team.country || 204,
      manualStats: team.manualStats || {},
    });
  };

  const closeModal = () => {
    if (isSaving) return;
    setEditingTeam(null);
  };

  const handleLogoUpload = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!String(picked.type || '').startsWith('image/')) {
      showStatusMessage('error', 'El escudo tiene que ser una imagen.');
      return;
    }
    setIsUploading(true);
    // Se achica a 512 px antes de validar el peso: una imagen grande que queda chica ya no se rechaza.
    const file = await resizeImageFile(picked);
    const fileError = validateLogoFile(file);
    if (fileError) {
      showStatusMessage('error', fileError);
      setIsUploading(false);
      return;
    }
    try {
      const uid = editingTeam.uid;
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

  /**
   * Adds the tournament and overlay rewrites for a renamed club to `transaction`; returns where it changed.
   * Reads both documents first (a transaction needs every read before its writes) so a result saved meanwhile
   * makes Firestore retry with it instead of being overwritten.
   */
  const renameTeamEverywhere = async (transaction, oldName, newName) => {
    if (!oldName || oldName.trim() === newName.trim()) return '';
    const targets = [
      { ref: doc(db, `artifacts/${APP_ID}/public/data/tournament`, 'official'), label: 'el torneo' },
      { ref: doc(db, `artifacts/${APP_ID}/public/data/broadcast`, 'overlay'), label: 'el overlay' },
    ];
    const snaps = await Promise.all(targets.map(({ ref }) => transaction.get(ref)));
    const places = [];
    targets.forEach(({ ref, label }, index) => {
      if (!snaps[index].exists()) return;
      const { data, changedKeys } = renameTeamInTournament(snaps[index].data(), oldName, newName);
      if (!changedKeys.length) return;
      // Sólo los campos con el nombre viejo (league, matches, bracket…): el resto del documento no se toca.
      transaction.set(ref, Object.fromEntries(changedKeys.map(key => [key, data[key]])), { mergeFields: changedKeys });
      places.push(label);
    });
    return places.join(' y ');
  };

  const handleSaveTeam = async () => {
    const budget = parseBudgetInput(formData.budget);
    const errors = {};
    if (!formData.teamName.trim()) errors.teamName = 'El nombre del equipo es obligatorio.';
    if (budget.error) errors.budget = budget.error;
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSaving(true);
    try {
      const uid = editingTeam.uid;
      const saveData = {
        teamName: formData.teamName.trim(),
        budget: budget.value,
        logoUrl: formData.logoUrl || DEFAULT_LOGO,
        country: Number(formData.country) || 204,
        manualStats: formData.manualStats || {},
      };
      // El torneo y el overlay identifican a los clubes por nombre: el cambio de nombre va en la misma transacción,
      // así la tabla no se parte en dos filas ni se pierde el escudo.
      const renamedIn = await runTransaction(db, async transaction => {
        const places = await renameTeamEverywhere(transaction, editingTeam.teamName, saveData.teamName);
        transaction.set(getPrivateProfileRef(uid), saveData, { merge: true });
        // manualStats es un mapa entero: mergeFields lo reemplaza (con merge: true un campo vaciado no se borraba).
        transaction.set(getPublicTeamRef(uid), saveData, { mergeFields: Object.keys(saveData) });
        return places;
      });
      showStatusMessage('success', `Equipo "${saveData.teamName}" actualizado.${renamedIn ? ` También se renombró en ${renamedIn}.` : ''}`);
      setEditingTeam(null);
      await fetchTeams();
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'Error al guardar equipo.');
    }
    setIsSaving(false);
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`¿Eliminar el equipo "${team.teamName}"?\n\nSe borran su ficha pública, su perfil (formación, dorsales, franquicia), su plantel (${team.playerCount} jugadores) y sus bloqueos de mercado: esos jugadores vuelven a quedar libres. Sus ofertas abiertas se cierran. No se puede deshacer.`)) return;
    try {
      // El perfil también: si quedaba, useAuth volvía a crear el equipo en el próximo ingreso del usuario.
      const operations = [
        { type: 'delete', ref: getPublicTeamRef(team.uid) },
        { type: 'delete', ref: getPrivateProfileRef(team.uid) },
      ];
      const cartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${team.uid}/cart`));
      cartSnap.forEach(d => operations.push({ type: 'delete', ref: d.ref }));
      const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
      locksSnap.forEach(d => {
        if (d.data().lockedBy === team.uid) operations.push({ type: 'delete', ref: d.ref });
      });
      // Ofertas abiertas del equipo (como comprador o vendedor): se cierran para que no retengan dinero.
      const offersRef = collection(db, `artifacts/${APP_ID}/public/data/offers`);
      const [sent, received] = await Promise.all([
        getDocs(query(offersRef, where('senderId', '==', team.uid))),
        getDocs(query(offersRef, where('targetTeamId', '==', team.uid))),
      ]);
      const closedAt = new Date().toISOString();
      [...sent.docs, ...received.docs]
        .filter(d => ['pending', 'countered'].includes(d.data().status))
        .forEach(d => operations.push({
          type: 'set', ref: d.ref, options: { merge: true },
          data: { status: 'withdrawn', withdrawnAt: closedAt, withdrawnReason: 'Equipo eliminado' },
        }));
      await commitBatchOperations(db, operations);
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

  if (isLoading && !hasLoaded) {
    return (
      <div className="text-center p-8">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-ink-3 text-xs">Cargando equipos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Cada usuario registrado es un equipo: acá se edita su club, su presupuesto y su acceso al mercado.</p>
        <button type="button" onClick={fetchTeams} disabled={isLoading} className="btn btn-ghost btn-sm self-end sm:self-auto">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
          {isLoading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por equipo, email o ID de usuario..."
          aria-label="Buscar equipo o usuario"
          className="w-full bg-canvas border border-line/[0.12] rounded-xl pl-9 pr-8 py-2.5 text-xs text-ink placeholder-slate-500 outline-none focus:border-accent/50"
        />
        {searchTerm && (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="tab-list" role="group" aria-label="Filtrar por acceso al mercado">
          {ACCESS_FILTERS.map(filter => (
            <button key={filter.id} type="button" className="tab" aria-pressed={accessFilter === filter.id} onClick={() => setAccessFilter(filter.id)}>
              {filter.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3 px-1">
          Mostrando <span className="num">{filteredTeams.length}</span> de <span className="num">{teams.length}</span> · Acceso anticipado: <span className="num">{earlyAccessCount}</span>
          {pendingCount > 0 && <> · <span className="font-semibold text-warning-soft">Pendientes de aprobación: <span className="num">{pendingCount}</span></span></>}
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-line/[0.12] rounded-2xl">
          <Users className="w-12 h-12 text-ink-3 mb-3" />
          <p className="text-ink-3 font-medium text-xs">No hay equipos registrados todavía. Aparecen acá cuando cada usuario crea su cuenta.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {filteredTeams.length === 0 ? (
            <div className="text-center py-10 text-ink-3 text-xs border border-dashed border-line/[0.12] rounded-xl">
              Ningún equipo coincide con la búsqueda o el filtro.
            </div>
          ) : (
            filteredTeams.map(team => (
              <div key={team.uid} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5 bg-surface rounded-xl border border-line/[0.12] hover:border-accent/30 transition group">
                {/* Badge */}
                <img
                  src={team.logoUrl || DEFAULT_LOGO}
                  alt="Escudo"
                  className="w-11 h-11 rounded-xl object-contain bg-black/50 p-1 border border-line/[0.12] flex-shrink-0"
                  onError={(e) => e.target.src = DEFAULT_LOGO}
                />
                {/* Info */}
                <div className="flex-1 min-w-[10rem]">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-wide truncate group-hover:text-accent transition-colors">{team.teamName}</h4>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {team.email && <span className="text-xs text-ink-2 truncate max-w-[220px]">{team.email}</span>}
                    <span className="text-[10px] text-ink-3 font-mono" title={team.uid}>ID: {team.uid.substring(0, 8)}</span>
                    {team.inWhitelist && <span className="text-[11px] font-semibold text-success-soft">Acceso anticipado</span>}
                    {team.pendingApproval && <span className="text-[11px] font-semibold text-warning-soft">Pendiente de aprobación</span>}
                  </div>
                </div>
                {/* Stats */}
                <div className="flex items-center gap-4 text-right flex-shrink-0">
                  <div>
                    <p className="text-[9px] text-ink-3 uppercase font-bold">Jugadores</p>
                    <p className="text-sm font-bold text-ink font-mono">{team.playerCount}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-ink-3 uppercase font-bold">Presupuesto</p>
                    <p className="text-sm font-bold text-success-soft font-mono">{formatBudget(team.budget)}</p>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 ml-auto opacity-80 group-hover:opacity-100 transition flex-shrink-0">
                  {team.pendingApproval && (
                    <button type="button" onClick={() => handleApprove(team)} disabled={togglingUid === team.uid}
                      className="btn btn-success btn-sm" title="Aprobar: puede fichar, ofertar y usar el chat">
                      <UserCheck size={16} aria-hidden="true" />Aprobar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleAccess(team)}
                    disabled={togglingUid === team.uid}
                    aria-pressed={team.inWhitelist}
                    className={`btn btn-icon ${team.inWhitelist ? 'btn-success' : 'btn-ghost'}`}
                    title={team.inWhitelist ? 'Quitar acceso anticipado al mercado' : 'Dar acceso anticipado al mercado (puede usarlo aunque esté cerrado)'}
                    aria-label={team.inWhitelist ? `Quitar acceso anticipado a ${team.teamName}` : `Dar acceso anticipado a ${team.teamName}`}
                  >
                    <KeyRound size={16} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => openEditTeamModal(team)} className="btn btn-ghost btn-icon" title="Editar equipo" aria-label={`Editar ${team.teamName}`}>
                    <Edit2 size={16} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => handleResetFranchise(team)} className="btn btn-ghost btn-icon hover:text-accent-soft" title="Resetear Jugador Franquicia" aria-label={`Resetear jugador franquicia de ${team.teamName}`}>
                    <Crown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => handleDeleteTeam(team)} className="btn btn-ghost btn-icon hover:text-danger-soft" title="Eliminar equipo" aria-label={`Eliminar ${team.teamName}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingTeam && (
        <BaseModal
          isOpen={true}
          onClose={closeModal}
          title="Editar equipo"
          subtitle={editingTeam.teamName}
          size="sm"
          footer={(
            <>
              <button type="button" onClick={closeModal} disabled={isSaving} className="btn btn-ghost">Cancelar</button>
              <button type="button" onClick={handleSaveTeam} disabled={isSaving || isUploading} className="btn btn-primary">
                <Save size={16} aria-hidden="true" /> {isSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        >
            <div className="space-y-4">
              {/* Logo preview + upload */}
              <div className="flex items-center gap-4">
                <img
                  src={formData.logoUrl || DEFAULT_LOGO}
                  alt="Escudo"
                  className="w-16 h-16 rounded-xl object-contain bg-black/50 p-1.5 border border-line/[0.12]"
                  onError={(e) => e.target.src = DEFAULT_LOGO}
                />
                <div className="flex-1">
                  <label className="text-xs font-bold text-ink-3 uppercase block mb-1">Escudo</label>
                  <label className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-line/[0.12] rounded-lg text-xs text-ink-2 cursor-pointer hover:bg-white/[0.05] transition">
                    <Upload size={14} /> {isUploading ? 'Subiendo...' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              {/* Team name */}
              <div>
                <label htmlFor="team-admin-name" className="text-xs font-bold text-ink-3 uppercase block mb-1">Nombre del equipo</label>
                <input
                  id="team-admin-name"
                  type="text"
                  aria-invalid={formErrors.teamName ? true : undefined}
                  aria-describedby={formErrors.teamName ? 'team-admin-name-error' : undefined}
                  value={formData.teamName}
                  onChange={e => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-ink border border-line/[0.12] rounded-lg text-sm outline-none focus:border-accent transition"
                  placeholder="Ej: Club Atlético SuperCont"
                />
                {formErrors.teamName && <p id="team-admin-name-error" className="field-error" role="alert">{formErrors.teamName}</p>}
              </div>
              {/* Budget */}
              <div>
                <label htmlFor="team-admin-budget" className="text-xs font-bold text-ink-3 uppercase block mb-1">Presupuesto ($)</label>
                <input
                  id="team-admin-budget"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  aria-invalid={formErrors.budget ? true : undefined}
                  aria-describedby={formErrors.budget ? 'team-admin-budget-error' : undefined}
                  value={formData.budget}
                  onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-ink border border-line/[0.12] rounded-lg text-sm font-mono outline-none focus:border-accent transition"
                  placeholder="0"
                />
                {formErrors.budget && <p id="team-admin-budget-error" className="field-error" role="alert">{formErrors.budget}</p>}
              </div>
              {/* Country / Nationality */}
              <div>
                <label className="text-xs font-bold text-ink-3 uppercase block mb-1">Nacionalidad / País del Club</label>
                <select
                  value={formData.country || 204}
                  onChange={e => setFormData(prev => ({ ...prev, country: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-black/40 text-ink border border-line/[0.12] rounded-lg text-xs outline-none focus:border-accent transition cursor-pointer"
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
              <div className="border-t border-line/[0.12] pt-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-accent-soft">Estadísticas públicas (edición manual)</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {[
                    ['played', 'Partidos'], ['wins', 'Ganados'], ['draws', 'Empatados'], ['losses', 'Perdidos'],
                    ['gf', 'Goles a favor'], ['ga', 'Goles en contra'], ['titles', 'Títulos'],
                  ].map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase text-ink-3">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.manualStats?.[field] ?? ''}
                        onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, [field]: e.target.value } }))}
                        className="w-full rounded-lg border border-line/[0.12] bg-black/40 px-3 py-1.5 text-xs text-ink outline-none focus:border-accent font-mono"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-ink-3">Rivalidad</span>
                  <input
                    type="text"
                    value={formData.manualStats?.rival ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, rival: e.target.value } }))}
                    className="w-full rounded-lg border border-line/[0.12] bg-black/40 px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
                    placeholder="Ej: SK Konya"
                  />
                </label>
                <p className="mt-2 text-[10px] text-ink-3">Los campos cargados reemplazan el cálculo automático del perfil público.</p>
              </div>
              <div className="text-xs text-ink-3 bg-black/30 p-3 rounded-xl border border-line/[0.08]">
                <span className="font-bold text-ink-2">User ID:</span> <span className="font-mono text-[11px]">{editingTeam.uid}</span>
              </div>
            </div>
        </BaseModal>
      )}
    </div>
  );
});

export default TeamsAdminSection;
