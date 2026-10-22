import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { X, Save, Edit2, Trophy, LayoutGrid, Star, CalendarDays } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Spinner } from './ui/Spinner.jsx';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeTournamentView } from '../utils/tournamentViews.js';
import { seedGoldCup as seedGoldCupBracket } from '../utils/bracketModel.js';
import { normalizeTournament } from '../utils/tournamentModel.js';
import { LEAGUE_ROUNDS, roundStatus } from './tournament/tournamentEngine.js';
import { TieBreakEditor } from './tournament/TieBreakEditor.jsx';
import {
  tournamentBackdropClass,
  tournamentShellClass,
} from './TournamentUI.jsx';
import {
  TournamentTeamsContext,
  TeamSelect,
  MatchCard,
  BracketFork,
  MatchCenter,
  LeagueTableView,
  BracketView,
  RepechajeView,
  StatsView,
  buildAutomaticTournamentData,
  buildAutomaticTournamentReport,
  rankLeague,
  suggestSwissRound,
} from './tournament/index.js';
import { Alert } from './ui/Alert.jsx';
import { draftUrl } from '../utils/siteRoutes.js';

export {
  TournamentTeamsContext,
  TeamSelect,
  MatchCard,
  BracketFork,
  MatchCenter,
  LeagueTableView,
  BracketView,
  RepechajeView,
  StatsView,
  buildAutomaticTournamentData,
};

export const TournamentModal = memo(function TournamentModal({
  isVisible,
  isPage,
  onClose,
  tournamentData,
  isAdmin,
  onUpdateTournament,
  allTeams,
  initialTab = 'groups',
  userTeamName,
  allPlayers,
}) {
  const [activeTab, setActiveTab] = useState(() => normalizeTournamentView(initialTab));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Avisos del último guardado (empates sin tanda, empates en la tabla): no bloquean.
  const [saveWarnings, setSaveWarnings] = useState([]);
  const [localData, setLocalData] = useState(null);
  const editBaselineRef = useRef('');
  const editBaseRef = useRef(null);
  // Las vistas de OBS viven en screens/ObsScreen.jsx (BroadcastOverlay); acá siempre es la vista de la app.
  const isObsMode = false;

  useEffect(() => {
    setActiveTab(normalizeTournamentView(initialTab));
  }, [initialTab]);

  // Escape lo maneja BaseModal (que además no cierra mientras se escribe en un campo). Un segundo listener
  // acá llamaba onClose dos veces y cerraba aunque el foco estuviera en un input.

  // Fuera del modo edición la copia local sigue a Firestore; al editar queda fija y se guarda como diferencia
  // contra su base (services/tournamentService.js), así que lo que otro admin guarde mientras tanto no se pisa.
  useEffect(() => {
    if (isEditing) return;
    if (tournamentData) setLocalData(normalizeTournament(tournamentData));
    else setLocalData(prev => prev || normalizeTournament(null));
  }, [tournamentData, isEditing]);

  // Otro guardado mientras se edita: no bloquea (se combina al guardar), pero se avisa.
  const editStartDataRef = useRef(null);
  const changedWhileEditing = isEditing && editStartDataRef.current !== null && editStartDataRef.current !== tournamentData;

  const teamOptions = useMemo(() => Object.entries(allTeams || {})
    .map(([id, team]) => ({ id, name: String(team?.teamName || '').trim() }))
    .filter(team => team.name)
    .sort((a, b) => a.name.localeCompare(b.name)), [allTeams]);

  const getTeamLogo = useCallback((teamName) => {
    if (!teamName || !allTeams) return DEFAULT_LOGO;
    const target = teamName.trim().toLowerCase();
    const foundId = Object.keys(allTeams).find(id => allTeams[id].teamName.trim().toLowerCase() === target);
    // Un club sin escudo cargado (logoUrl vacío) mostraba una imagen rota: usa el escudo de la liga.
    return (foundId && allTeams[foundId].logoUrl) || DEFAULT_LOGO;
  }, [allTeams]);

  const getPlayerPhoto = useCallback((name) => {
    if (!name || !allPlayers) return null;
    const n = name.trim().toLowerCase();
    const found = allPlayers.find(p => (p.Name || p.name)?.trim().toLowerCase() === n);
    return found ? `/fotos_jugadores/${found.Id || found.id}.webp` : null;
  }, [allPlayers]);

  // Empates sin desempate posible con la tabla que quedaría al guardar (sin el orden manual, para poder cambiarlo).
  const liveTies = useMemo(() => {
    if (!isEditing || !localData) return [];
    return rankLeague(buildAutomaticTournamentReport(localData).data.league).unresolvedTies;
  }, [isEditing, localData]);

  const finalRanking = useMemo(() => {
    if (!localData) return null;
    const data = buildAutomaticTournamentReport(localData).data;
    if (!roundStatus(data, LEAGUE_ROUNDS).complete) return null;
    return rankLeague(data.league, data.tieBreakOrder).league;
  }, [localData]);

  const clearLeagueSlot = useCallback((index) => {
    setLocalData(prev => {
      const newLeague = [...prev.league];
      newLeague[index] = { id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 };
      return { ...prev, league: newLeague };
    });
  }, []);

  const startEditing = () => {
    editBaselineRef.current = JSON.stringify(localData);
    editBaseRef.current = JSON.parse(editBaselineRef.current);
    editStartDataRef.current = tournamentData;
    setSaveError(null);
    setIsEditing(true);
  };

  const hasUnsavedChanges = () => isEditing && JSON.stringify(localData) !== editBaselineRef.current;

  // Se sale del modo edición solo si el guardado terminó bien: si falla, los cambios siguen en pantalla.
  // Tabla, desempates, fecha suiza automática y avance de copas los recalcula el servicio al guardar.
  const handleSave = async () => {
    if (isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const result = await onUpdateTournament(localData, { base: editBaseRef.current });
      if (!result?.ok) {
        setSaveError(result?.conflicts?.length ? `${result.error} ${result.conflicts.join(' ')}` : (result?.error || 'No se pudo guardar.'));
        return;
      }
      setSaveWarnings([
        ...(result.issues || []),
        ...(result.unresolvedTies || []).map(group => `Empate en la tabla sin desempate posible: ${group.join(', ')}. Ordenalos con «Editar».`),
        ...(result.warnings || []),
        ...(result.generatedRound ? [`Se armó la ${result.generatedRound} con la tabla actual. Ya está publicada.`] : []),
        ...(result.cupChanges?.length ? [`Copas: ${result.cupChanges.join(' · ')}.`] : []),
      ]);
      editStartDataRef.current = null;
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const setTieBreakOrder = useCallback((order) => {
    setLocalData(prev => ({ ...prev, tieBreakOrder: order }));
  }, []);

  // «Armar Copa de Oro»: cuartos 1-8, 4-5, 2-7, 3-6 con la tabla final; desde ahí los ganadores pasan solos.
  const seedGoldCup = () => {
    const result = seedGoldCupBracket(localData.bracket, finalRanking);
    if (!result.ok) {
      setSaveWarnings([result.reason]);
      return;
    }
    const list = result.bracket.quarters.map(match => `${match.teamA} vs ${match.teamB}`).join('\n');
    if (!window.confirm(`Cuartos de la Copa de Oro:\n${list}\n\nSe publican al presionar Guardar.`)) return;
    setLocalData(prev => ({ ...prev, bracket: result.bracket }));
  };

  const handleCancelEditing = () => {
    if (hasUnsavedChanges() && !window.confirm('¿Descartar los cambios sin guardar del torneo?')) return;
    setIsEditing(false); // el efecto de sincronización vuelve a cargar los datos guardados
  };

  const handleClose = () => {
    if (hasUnsavedChanges() && !window.confirm('Hay cambios del torneo sin guardar. ¿Cerrar y descartarlos?')) return;
    setIsEditing(false);
    onClose?.();
  };

  const updateMatchGeneric = useCallback((path, index, field, value) => {
    setLocalData(prev => {
      const newData = { ...prev, bracket: { ...prev.bracket } };
      let target = newData.bracket;
      for (const key of path) {
        if (Array.isArray(target[key])) target[key] = [...target[key]];
        else target[key] = { ...(target[key] || {}) };
        target = target[key];
      }
      if (Array.isArray(target)) {
        while (target.length <= index) target.push({ teamA: '', teamB: '', scoreA: '', scoreB: '' });
        target[index] = { ...target[index], [field]: value };
      } else target[field] = value;
      return newData;
    });
  }, []);

  const updateGeneric = useCallback((s, i, f, v) => {
    const path = Array.isArray(s) ? s : [s];
    updateMatchGeneric(path, i, f, v);
  }, [updateMatchGeneric]);

  const updateLeagueTeam = (index, field, value) => {
    const newLeague = [...localData.league];
    const updatedTeam = { ...newLeague[index], [field]: value };
    if (['pg', 'gpen', 'pp'].includes(field)) {
      const pg = Number(updatedTeam.pg) || 0;
      const gpen = Number(updatedTeam.gpen) || 0;
      const pp = Number(updatedTeam.pp) || 0;
      updatedTeam.pj = pg + gpen + pp;
      updatedTeam.pts = (pg * 2) + (gpen * 1);
    }
    newLeague[index] = updatedTeam;
    setLocalData({ ...localData, league: newLeague });
  };

  const updateStat = (type, index, field, value) => {
    setLocalData(prev => {
      const newData = { ...prev };
      const list = [...newData[type]];
      list[index] = { ...list[index], [field]: value };
      newData[type] = list;
      return newData;
    });
  };

  const updateTournamentMatch = useCallback((matchId, field, value) => {
    setLocalData(prev => ({
      ...prev,
      matches: (prev.matches || []).map(match => match.id === matchId ? { ...match, [field]: value } : match),
    }));
  }, []);

  const addTournamentMatch = useCallback(() => {
    setLocalData(prev => ({
      ...prev,
      matches: [...(prev.matches || []), {
        id: crypto.randomUUID(),
        round: 'Fecha',
        homeTeam: '',
        awayTeam: '',
        homeScore: '',
        awayScore: '',
        date: '',
        mvp: '',
        homeGoals: '',
        awayGoals: '',
        homeAssists: '',
        awayAssists: '',
        homeConfirmed: false,
        awayConfirmed: false,
        status: 'scheduled',
      }],
    }));
  }, []);

  // La fecha suiza se arma sola al guardar el último resultado de una fecha. Este botón es el respaldo manual (por
  // ejemplo si el admin borró una fecha generada para rehacerla): mismos ids fijos, así que nunca la duplica.
  const suggestNextRound = useCallback(() => {
    const suggestion = suggestSwissRound(localData);
    if (!suggestion.ok) {
      setSaveWarnings([suggestion.reason]);
      return;
    }
    const list = suggestion.pairs.map(([home, away]) => `${home} vs ${away}`).join('\n');
    if (!window.confirm(`${suggestion.round} sugerida:\n${list}\n\n¿Agregar estos partidos? Se guardan al presionar Guardar.`)) return;
    setSaveWarnings([]);
    setLocalData(prev => {
      const ids = new Set((prev.matches || []).map(match => match.id));
      return { ...prev, matches: [...(prev.matches || []), ...suggestion.matches.filter(match => !ids.has(match.id))] };
    });
  }, [localData]);

  const removeTournamentMatch = useCallback((matchId) => {
    if (!window.confirm('¿Eliminar este partido? Se aplicará al presionar Guardar.')) return;
    setLocalData(prev => ({ ...prev, matches: (prev.matches || []).filter(match => match.id !== matchId) }));
  }, []);

  const [copiedObs, setCopiedObs] = useState(null);
  const copyObsUrl = async (label, scene) => {
    const url = draftUrl(`/overlay?scene=${scene}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedObs({ label, ok: true });
    } catch {
      setCopiedObs({ label, ok: false, url });
    }
  };

  const pendingMatchesCount = useMemo(() => {
    if (!localData?.matches || !Array.isArray(localData.matches)) return 0;
    return localData.matches.filter(m => m.status !== 'completed').length;
  }, [localData?.matches]);

  const currentPhaseContext = useMemo(() => {
    if (activeTab === 'matches' || activeTab === 'groups') {
      const nextM = (localData?.matches || []).find(m => m.status !== 'completed');
      if (nextM?.round) return `Fase de Liga — ${nextM.round}`;
      return 'Fase de Liga — Temporada Regular';
    }
    if (activeTab === 'bracket') return 'Fase Eliminatoria — Cuadro Principal';
    if (activeTab === 'repechaje') return 'Copa de Plata — Repechaje';
    if (activeTab === 'stats') return 'Estadísticas — Goleadores y Asistidores';
    return 'Supercontinental League';
  }, [activeTab, localData?.matches]);

  if (!isVisible && !isPage) return null;

  if (!localData) {
    return (
      <div className={isPage ? `w-full h-full flex flex-col items-center justify-center p-12 ${tournamentShellClass}` : `fixed inset-0 z-[100] flex flex-col items-center justify-center p-12 ${tournamentShellClass}`}>
        <Spinner size="lg" label="Cargando el torneo…" />
      </div>
    );
  }

  const tabContent = (
    <>
      {activeTab === 'matches' && (
        <MatchCenter
          matches={localData.matches}
          isEditing={isEditing}
          onUpdate={updateTournamentMatch}
          onAdd={addTournamentMatch}
          onSuggestRound={suggestNextRound}
          onRemove={removeTournamentMatch}
          getTeamLogo={getTeamLogo}
          isObsMode={isObsMode}
        />
      )}

      {activeTab === 'groups' && (
        <LeagueTableView
          localData={localData}
          isEditing={isEditing}
          isObsMode={isObsMode}
          userTeamName={userTeamName}
          getTeamLogo={getTeamLogo}
          updateLeagueTeam={updateLeagueTeam}
          clearLeagueSlot={clearLeagueSlot}
        />
      )}

      {activeTab === 'bracket' && (
        <BracketView
          localData={localData}
          isEditing={isEditing}
          isObsMode={isObsMode}
          getTeamLogo={getTeamLogo}
          updateGeneric={updateGeneric}
        />
      )}

      {activeTab === 'repechaje' && (
        <RepechajeView
          localData={localData}
          isEditing={isEditing}
          isObsMode={isObsMode}
          getTeamLogo={getTeamLogo}
          updateGeneric={updateGeneric}
        />
      )}

      {activeTab === 'stats' && (
        <StatsView
          localData={localData}
          isEditing={isEditing}
          isObsMode={isObsMode}
          getTeamLogo={getTeamLogo}
          getPlayerPhoto={getPlayerPhoto}
          updateStat={updateStat}
        />
      )}
    </>
  );

  const content = (
    <>
      <div className={`${tournamentBackdropClass} z-0`}></div>
      <div className="relative z-10 w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
          {!isObsMode && (
            <div className={`flex flex-col shrink-0 gap-4 ${isPage ? 'pb-4' : 'px-4 sm:px-6 py-4 border-b border-line/10'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="eyebrow mb-1.5">Competición</p>
                  {isPage ? <h1 className="page-title">Torneo</h1> : <h2 className="font-display text-2xl font-bold text-ink">Torneo</h2>}
                  <p className="mt-2 text-sm text-ink-2">
                    {currentPhaseContext}
                    {pendingMatchesCount > 0 && <span className="text-ink-3"> · <span className="num">{pendingMatchesCount}</span> {pendingMatchesCount === 1 ? 'partido pendiente' : 'partidos pendientes'}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isPage && isAdmin && (
                    <details className="relative">
                      <summary className="btn btn-secondary list-none cursor-pointer [&::-webkit-details-marker]:hidden">Enlaces OBS</summary>
                      <div className="absolute right-0 top-full mt-2 z-dropdown panel p-2 w-56 flex flex-col">
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Tabla', 'tabla')}>Copiar enlace de la tabla</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Copa de Oro', 'bracket')}>Copiar enlace de la Copa de Oro</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Goleadores', 'goleadores')}>Copiar enlace de goleadores</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Copa de Plata', 'repechaje')}>Copiar enlace de Copa de Plata</button>
                      </div>
                    </details>
                  )}
                  {isAdmin && isEditing && (
                    <button type="button" className="btn btn-ghost" onClick={handleCancelEditing} disabled={isSaving}>
                      Cancelar
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className={`btn ${isEditing ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => (isEditing ? handleSave() : startEditing())}
                      disabled={isSaving}
                    >
                      {isEditing
                        ? <><Save className="w-4 h-4" aria-hidden="true" />{isSaving ? 'Guardando…' : 'Guardar'}</>
                        : <><Edit2 className="w-4 h-4" aria-hidden="true" />Editar</>}
                    </button>
                  )}
                  {!isPage && onClose && (
                    <button type="button" onClick={handleClose} className="btn btn-ghost btn-icon" aria-label="Cerrar torneo"><X className="w-5 h-5" aria-hidden="true" /></button>
                  )}
                </div>
              </div>
              {saveError && isEditing && <Alert tone="danger">{saveError}</Alert>}
              {changedWhileEditing && (
                <Alert tone="info">Otro admin guardó cambios del torneo mientras editabas. Al guardar se combinan con los tuyos; si tocaron lo mismo, se avisa y no se pisa nada.</Alert>
              )}
              {isAdmin && localData.swissStatus?.blocked && (
                <Alert tone="warning" title={`No se pudo armar la Fecha ${localData.swissStatus.blocked.round}`}>
                  {localData.swissStatus.blocked.reason} Cargá esa fecha a mano con «Agregar partido».
                </Alert>
              )}
              {isAdmin && isEditing && <TieBreakEditor groups={liveTies} order={localData.tieBreakOrder || []} onChange={setTieBreakOrder} />}
              {isAdmin && isEditing && activeTab === 'bracket' && finalRanking && !localData.bracket?.quarters?.some(match => match?.teamA || match?.teamB) && (
                <Alert tone="info" title="La liga terminó">
                  <span className="mr-2">Armá los cuartos de la Copa de Oro con la tabla final (1-8, 4-5, 2-7, 3-6). Después los ganadores pasan solos.</span>
                  <button type="button" className="btn btn-secondary btn-sm min-h-11 mt-2" onClick={seedGoldCup}>Armar Copa de Oro</button>
                </Alert>
              )}
              {saveWarnings.length > 0 && (
                <Alert tone="warning" title="Revisá la tabla">
                  <ul className="list-disc space-y-0.5 pl-4">{saveWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
                </Alert>
              )}
              {copiedObs && (
                <p role="status" className={`text-xs ${copiedObs.ok ? 'text-success-soft' : 'text-warning-soft'}`}>
                  {copiedObs.ok ? `Enlace OBS de ${copiedObs.label} copiado.` : <>No se pudo copiar. Enlace: <code className="text-ink-2 break-all">{copiedObs.url}</code></>}
                </p>
              )}
              <Tabs label="Secciones del torneo" value={activeTab} onChange={setActiveTab} tabs={[
                { id: 'matches', label: 'Partidos', icon: CalendarDays, count: pendingMatchesCount || null },
                { id: 'groups', label: 'Tabla', icon: LayoutGrid },
                { id: 'bracket', label: 'Copa de Oro', icon: Trophy },
                { id: 'repechaje', label: 'Copa de Plata', icon: Trophy },
                { id: 'stats', label: 'Goleadores', icon: Star },
              ]} />
            </div>
          )}

          <div className={`flex-grow relative w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar ${isPage ? '' : 'p-3 sm:p-6'}`}>
            <div className={`w-full mx-auto flex flex-col ${activeTab === 'bracket' || activeTab === 'repechaje' ? '' : 'max-w-7xl'}`}>
              {tabContent}
            </div>
          </div>
        </div>
    </>
  );

  if (isPage) {
    return (
      <TournamentTeamsContext.Provider value={teamOptions}>
        <div className="mx-auto w-full max-w-page h-full min-h-[32rem] flex flex-col relative text-ink">
          {content}
        </div>
      </TournamentTeamsContext.Provider>
    );
  }

  return (
    <TournamentTeamsContext.Provider value={teamOptions}>
      <BaseModal
        isOpen={true}
        onClose={handleClose}
        size="full"
        showClose={false}
        ariaLabel="Torneo"
        className={`!p-0 ${tournamentShellClass}`}
        contentClassName="!p-0 !overflow-hidden flex flex-col"
      >
        {content}
      </BaseModal>
    </TournamentTeamsContext.Provider>
  );
});

export default TournamentModal;
