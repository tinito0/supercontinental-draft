import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { RefreshCw, Search, X, Users, Edit2, Crown, Trash2, Upload, Save, KeyRound, UserCheck } from 'lucide-react';
import { getDocs, query, collection, getDoc, writeBatch, doc, setDoc, where, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { DEFAULT_LOGO, APP_ID } from '../../utils/constants.js';
import { formatPriceShort } from '../../utils/helpers.js';
import { filterAdminTeams, mergeAdminTeamProfile, parseBudgetInput, sortByTeamName, validateLogoFile } from '../../utils/adminTeams.js';
import { BaseModal } from '../ui/BaseModal.jsx';
import { commitBatchOperations } from './commitBatchOperations.js';
import { resizeImageFile } from '../../utils/resizeImage.js';
import { renameTeamInTournament } from '../../utils/tournamentRename.js';
import { confirmAction } from '../ui/ConfirmDialog.jsx';

const ACCESS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'early', label: 'Con acceso' },
  { id: 'regular', label: 'Sin acceso' },
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
      const [teamsSnap, locksSnap] = await Promise.all([
        getDocs(query(getPublicTeamsCollectionRef())),
        getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`)),
      ]);
      const playerCounts = {};
      locksSnap.forEach(lockDoc => {
        const owner = lockDoc.data().lockedBy;
        if (owner) playerCounts[owner] = (playerCounts[owner] || 0) + 1;
      });
      const teamPromises = teamsSnap.docs.map(async (teamDoc) => {
        const publicData = teamDoc.data();
        const uid = teamDoc.id;
        const privateSnap = await getDoc(getPrivateProfileRef(uid));
        const privateData = privateSnap.exists() ? privateSnap.data() : {};
        return { ...mergeAdminTeamProfile(uid, publicData, privateData), playerCount: playerCounts[uid] || 0 };
      });
      setTeams(sortByTeamName(await Promise.all(teamPromises)));
      setHasLoaded(true);
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'No se pudieron cargar los equipos. Probá con «Actualizar».');
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
    if (!next && !(await confirmAction({
      title: `¿Quitarle el acceso anticipado a ${team.teamName}?`,
      message: 'Si el mercado está cerrado o programado, deja de poder fichar y ofertar hasta que abra.',
      confirmLabel: 'Quitar acceso',
    }))) return;
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
      showStatusMessage('error', `No se pudo guardar el equipo: ${err?.message || 'reintentá en unos instantes.'}`);
    }
    setIsSaving(false);
  };

  const handleDeleteTeam = async (team) => {
    const isConfirmed = await confirmAction({
      title: `¿Eliminar ${team.teamName}?`,
      message: `Se borran su ficha pública, su perfil (formación, dorsales, franquicia) y su plantel: sus ${team.playerCount} jugadores vuelven a quedar libres en el mercado. Sus ofertas abiertas se cierran.`,
      confirmLabel: 'Eliminar equipo',
      irreversible: true,
    });
    if (!isConfirmed) return false;
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
      showStatusMessage('success', `${team.teamName} eliminado.`);
      await fetchTeams();
      return true;
    } catch (err) {
      console.error(err);
      showStatusMessage('error', `No se pudo eliminar ${team.teamName}: ${err?.message || 'reintentá en unos instantes.'}`);
      return false;
    }
  };

  const handleResetFranchise = async (team) => {
    const isConfirmed = await confirmAction({
      title: `¿Resetear el franquicia de ${team.teamName}?`,
      message: 'El jugador sale de su plantel y el club puede elegir otro franquicia.',
      confirmLabel: 'Resetear franquicia',
      irreversible: true,
    });
    if (!isConfirmed) return;
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
      showStatusMessage('error', `No se pudo resetear el franquicia: ${err?.message || 'reintentá en unos instantes.'}`);
    }
  };

  if (isLoading && !hasLoaded) {
    return (
      <div className="text-center p-8">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-ink-3 text-xs">Cargando equipos…</p>
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
        <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por equipo, email o ID de usuario…"
          aria-label="Buscar equipo o usuario"
          className="input pl-9 pr-11 placeholder:text-ink-3"
        />
        {searchTerm && (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => setSearchTerm('')} className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-ink-3 hover:text-ink">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="tab-list max-w-full overflow-x-auto" role="group" aria-label="Filtrar por aprobación y acceso anticipado">
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
        <div className="space-y-2">
          {filteredTeams.length === 0 ? (
            <div className="text-center py-10 text-ink-3 text-xs border border-dashed border-line/[0.12] rounded-xl">
              Ningún equipo coincide con la búsqueda o el filtro.
            </div>
          ) : (
            filteredTeams.map(team => (
              <div key={team.uid} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5 bg-surface rounded-xl border border-line/[0.12]">
                <img
                  src={team.logoUrl || DEFAULT_LOGO}
                  alt=""
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-xl object-contain bg-black/50 p-1 border border-line/[0.12] flex-shrink-0"
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
                <div className="flex-1 min-w-[10rem]">
                  <h2 className="text-sm font-bold text-ink truncate">{team.teamName}</h2>
                  <div className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap">
                    {team.email && <span className="text-xs text-ink-2 truncate max-w-[220px]">{team.email}</span>}
                    {team.pendingApproval && <span className="text-xs font-semibold text-warning-soft">Pendiente de aprobación</span>}
                  </div>
                </div>
                <dl className="flex items-center gap-5 text-right flex-shrink-0">
                  <div>
                    <dt className="text-xs text-ink-3">Jugadores</dt>
                    <dd className="font-display num text-lg font-bold text-ink leading-tight">{team.playerCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-3">Presupuesto</dt>
                    <dd className="font-display num text-lg font-bold text-ink leading-tight">{formatPriceShort((Number(team.budget) || 0) / 1000000)}</dd>
                  </div>
                </dl>
                {/* Safe actions only, with words: resetting the franchise player and deleting live in the editor. */}
                <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                  {team.pendingApproval && (
                    <button type="button" onClick={() => handleApprove(team)} disabled={togglingUid === team.uid}
                      className="btn btn-success btn-sm" title="Puede fichar, ofertar y usar el chat">
                      <UserCheck size={16} aria-hidden="true" />Aprobar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleAccess(team)}
                    disabled={togglingUid === team.uid}
                    aria-pressed={Boolean(team.inWhitelist)}
                    className={`btn btn-sm ${team.inWhitelist ? 'btn-success' : 'btn-secondary'}`}
                    title="Con acceso anticipado puede usar el mercado aunque esté cerrado o programado"
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    {team.inWhitelist ? 'Acceso anticipado' : 'Dar acceso anticipado'}
                  </button>
                  <button type="button" onClick={() => openEditTeamModal(team)} className="btn btn-secondary btn-sm" aria-label={`Editar ${team.teamName}`}>
                    <Edit2 size={16} aria-hidden="true" />Editar
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
                  <p className="field-label">Escudo</p>
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    <Upload size={14} aria-hidden="true" /> {isUploading ? 'Subiendo…' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              {/* Team name */}
              <div>
                <label htmlFor="team-admin-name" className="field-label">Nombre del equipo</label>
                <input
                  id="team-admin-name"
                  type="text"
                  aria-invalid={formErrors.teamName ? true : undefined}
                  aria-describedby={formErrors.teamName ? 'team-admin-name-error' : undefined}
                  value={formData.teamName}
                  onChange={e => setFormData(prev => ({ ...prev, teamName: e.target.value }))}
                  className="input"
                  placeholder="Ej: Club Atlético SuperCont"
                />
                {formErrors.teamName && <p id="team-admin-name-error" className="field-error" role="alert">{formErrors.teamName}</p>}
              </div>
              {/* Budget */}
              <div>
                <label htmlFor="team-admin-budget" className="field-label">Presupuesto (en pesos, sin puntos)</label>
                <input
                  id="team-admin-budget"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  aria-invalid={formErrors.budget ? true : undefined}
                  aria-describedby={formErrors.budget ? 'team-admin-budget-error' : undefined}
                  value={formData.budget}
                  onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                  className="input num"
                  placeholder="0"
                />
                {formErrors.budget && <p id="team-admin-budget-error" className="field-error" role="alert">{formErrors.budget}</p>}
              </div>
              {/* Country / Nationality */}
              <div>
                <label htmlFor="team-admin-country" className="field-label">País del club</label>
                <select
                  id="team-admin-country"
                  value={formData.country || 204}
                  onChange={e => setFormData(prev => ({ ...prev, country: Number(e.target.value) }))}
                  className="select"
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
                <p className="mb-3 text-sm font-semibold text-ink">Estadísticas públicas (edición manual)</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {[
                    ['played', 'Partidos'], ['wins', 'Ganados'], ['draws', 'Empatados'], ['losses', 'Perdidos'],
                    ['gf', 'Goles a favor'], ['ga', 'Goles en contra'], ['titles', 'Títulos'],
                  ].map(([field, label]) => (
                    <label key={field} className="block">
                      <span className="field-label">{label}</span>
                      <input
                        type="number"
                        min="0"
                        value={formData.manualStats?.[field] ?? ''}
                        onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, [field]: e.target.value } }))}
                        className="input num"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block">
                  <span className="field-label">Rivalidad</span>
                  <input
                    type="text"
                    value={formData.manualStats?.rival ?? ''}
                    onChange={e => setFormData(prev => ({ ...prev, manualStats: { ...prev.manualStats, rival: e.target.value } }))}
                    className="input"
                    placeholder="Ej: SK Konya"
                  />
                </label>
                <p className="field-help">Los campos cargados reemplazan el cálculo automático del perfil público.</p>
              </div>
              <p className="text-xs text-ink-3">
                <span className="font-semibold text-ink-2">ID de usuario:</span> <span className="font-mono">{editingTeam.uid}</span>
              </p>
              <div className="rounded-xl border border-danger/30 bg-danger/[0.06] p-4 space-y-3">
                <p className="text-sm font-semibold text-danger-soft">Zona de peligro</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleResetFranchise(editingTeam)} disabled={isSaving} className="btn btn-danger btn-sm">
                    <Crown size={16} aria-hidden="true" />Resetear franquicia
                  </button>
                  <button type="button" onClick={async () => { if (await handleDeleteTeam(editingTeam)) closeModal(); }} disabled={isSaving} className="btn btn-danger btn-sm">
                    <Trash2 size={16} aria-hidden="true" />Eliminar equipo
                  </button>
                </div>
              </div>
            </div>
        </BaseModal>
      )}
    </div>
  );
});

export default TeamsAdminSection;
