import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { X, Save, Edit2, Trophy, LayoutGrid, Star, CalendarDays } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Spinner } from './ui/Spinner.jsx';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeTournamentView } from '../utils/tournamentViews.js';
import { CUP_IDS } from '../utils/bracketModel.js';
import { useElementSize } from '../hooks/useElementSize.js';
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
} from './tournament/index.js';
import { Alert } from './ui/Alert.jsx';
import { BroadcastBracket } from './tournament/BroadcastBracket.jsx';

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

// Escala propia de cada vista dentro del lienzo de 1920×1080 de OBS (las copas usan BroadcastBracket).
const OBS_CONTENT_SCALE = { groups: 1, stats: 0.82, matches: 0.78 };
const OBS_STAGE = { width: 1920, height: 1080 };

/** Lienzo de 1920×1080 ajustado a la ventana real (antes era fijo y se recortaba en fuentes de 1280×720). */
function ObsStage({ scale = 1, children }) {
  const [ref, { width, height }] = useElementSize();
  const fit = width && height ? Math.min(width / OBS_STAGE.width, height / OBS_STAGE.height) : 1;
  return (
    // Sin tournamentShellClass: trae `relative`, que pisa a `fixed`, deja el contenedor con alto 0 y el lienzo
    // centrado en ese alto nulo (media tabla fuera de pantalla y sin ajuste de escala).
    <div ref={ref} className="fixed inset-0 overflow-hidden bg-canvas text-ink font-sans">
      <div
        className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center"
        style={{
          width: OBS_STAGE.width,
          height: OBS_STAGE.height,
          transform: `translate(-50%, -50%) scale(${fit * scale})`,
          contain: 'content',
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
  isBroadcast,
}) {
  const [activeTab, setActiveTab] = useState(() => normalizeTournamentView(initialTab));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localData, setLocalData] = useState(null);
  const editBaselineRef = useRef('');
  // Las rutas de OBS lo indican con isBroadcast; ?mode=obs queda como respaldo para enlaces viejos.
  const isObsMode = isBroadcast ?? (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'obs');

  useEffect(() => {
    setActiveTab(normalizeTournamentView(initialTab));
  }, [initialTab]);

  // Escape lo maneja BaseModal (que además no cierra mientras se escribe en un campo). Un segundo listener
  // acá llamaba onClose dos veces y cerraba aunque el foco estuviera en un input.

  useEffect(() => {
    if (tournamentData && !isEditing) {
      const safeData = JSON.parse(JSON.stringify(tournamentData));
      if (!Array.isArray(safeData.league)) safeData.league = [];
      // STRICT 12-TEAM CAP: SuperContinental League has exactly 12 teams
      if (safeData.league.length > 12) {
        safeData.league = safeData.league.slice(0, 12);
      }
      while (safeData.league.length < 12) {
        safeData.league.push({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
      }
      safeData.league.forEach(t => {
        if (!t.id) t.id = crypto.randomUUID();
      });

      if (!safeData.bracket) safeData.bracket = { quarters: [], semis: [], final: {}, repechaje: { r1: [], r2: [], semis: [], final: {} } };
      if (!safeData.bracket.repechaje) safeData.bracket.repechaje = { r1: [], r2: [], semis: [], final: {} };

      const fillArray = (arr, requiredLength) => {
        if (!Array.isArray(arr)) arr = [];
        while (arr.length < requiredLength) {
          arr.push({ teamA: '', teamB: '', scoreA: '', scoreB: '' });
        }
        return arr;
      };

      safeData.bracket.repechaje.r1 = fillArray(safeData.bracket.repechaje.r1, 4);
      safeData.bracket.repechaje.r2 = fillArray(safeData.bracket.repechaje.r2, 2);
      safeData.bracket.repechaje.semis = fillArray(safeData.bracket.repechaje.semis, 2);
      safeData.bracket.quarters = fillArray(safeData.bracket.quarters, 4);
      safeData.bracket.semis = fillArray(safeData.bracket.semis, 2);

      // Estadísticas
      if (!safeData.topScorers) safeData.topScorers = Array(5).fill(null).map(() => ({ name: '', team: '', goals: '' }));
      if (!safeData.topAssisters) safeData.topAssisters = Array(5).fill(null).map(() => ({ name: '', team: '', assists: '' }));
      if (!Array.isArray(safeData.matches)) safeData.matches = [];

      setLocalData(safeData);
    } else if (!tournamentData && !localData) {
      setLocalData({
        league: Array(12).fill(null).map(() => ({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 })),
        bracket: {
          quarters: Array(4).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
          semis: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
          final: { teamA: '', teamB: '', scoreA: '', scoreB: '' },
          repechaje: {
            r1: Array(4).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            r2: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            semis: Array(2).fill(null).map(() => ({ teamA: '', teamB: '', scoreA: '', scoreB: '' })),
            final: { teamA: '', teamB: '', scoreA: '', scoreB: '' },
          },
        },
        topScorers: Array(5).fill(null).map(() => ({ name: '', team: '', goals: '' })),
        topAssisters: Array(5).fill(null).map(() => ({ name: '', team: '', assists: '' })),
        matches: [],
      });
    }
  }, [tournamentData, allTeams, isEditing]);

  const teamOptions = useMemo(() => Object.entries(allTeams || {})
    .map(([id, team]) => ({ id, name: String(team?.teamName || '').trim() }))
    .filter(team => team.name)
    .sort((a, b) => a.name.localeCompare(b.name)), [allTeams]);

  const getTeamLogo = useCallback((teamName) => {
    if (!teamName || !allTeams) return DEFAULT_LOGO;
    const target = teamName.trim().toLowerCase();
    const foundId = Object.keys(allTeams).find(id => allTeams[id].teamName.trim().toLowerCase() === target);
    return foundId ? allTeams[foundId].logoUrl : DEFAULT_LOGO;
  }, [allTeams]);

  const getPlayerPhoto = useCallback((name) => {
    if (!name || !allPlayers) return null;
    const n = name.trim().toLowerCase();
    const found = allPlayers.find(p => (p.Name || p.name)?.trim().toLowerCase() === n);
    return found ? `/fotos_jugadores/${found.Id || found.id}.webp` : null;
  }, [allPlayers]);

  const sortLeague = (data) => {
    const sorted = { ...data };
    sorted.league = [...(sorted.league || [])].slice(0, 12);
    sorted.league.sort((a, b) => {
      if (a.name === 'Club...') return 1;
      if (b.name === 'Club...') return -1;
      const ptsA = Number(a.pts) || 0;
      const ptsB = Number(b.pts) || 0;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const dgA = (Number(a.gf) || 0) - (Number(a.gc) || 0);
      const dgB = (Number(b.gf) || 0) - (Number(b.gc) || 0);
      if (dgB !== dgA) return dgB - dgA;
      return (Number(b.gf) || 0) - (Number(a.gf) || 0);
    });
    return sorted;
  };

  const clearLeagueSlot = useCallback((index) => {
    setLocalData(prev => {
      const newLeague = [...prev.league];
      newLeague[index] = { id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 };
      return { ...prev, league: newLeague };
    });
  }, []);

  const startEditing = () => {
    editBaselineRef.current = JSON.stringify(localData);
    setIsEditing(true);
  };

  const hasUnsavedChanges = () => isEditing && JSON.stringify(localData) !== editBaselineRef.current;

  // Se sale del modo edición solo si el guardado terminó bien: si falla, los cambios siguen en pantalla.
  const handleSave = async () => {
    if (isSaving) return;
    const { data: computed, overflow } = buildAutomaticTournamentReport(localData);
    // La liga es de 12: un club de más casi siempre es un partido con un nombre que no está en la tabla.
    // Antes se descartaba sin aviso al guardar (y con él, sus resultados en la tabla).
    if (overflow.length > 0) {
      setSaveError(`La tabla tendría ${12 + overflow.length} clubes y la liga admite 12. No entran: ${overflow.join(', ')}. Revisá el nombre de esos clubes en los partidos o quitá un club de la tabla.`);
      return;
    }
    setSaveError(null);
    const sortedData = sortLeague(computed);
    setLocalData(sortedData);
    setIsSaving(true);
    try {
      const saved = await onUpdateTournament(sortedData);
      if (saved !== false) setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
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

  const removeTournamentMatch = useCallback((matchId) => {
    if (!window.confirm('¿Eliminar este partido? Se aplicará al presionar Guardar.')) return;
    setLocalData(prev => ({ ...prev, matches: (prev.matches || []).filter(match => match.id !== matchId) }));
  }, []);

  const [copiedObs, setCopiedObs] = useState(null);
  const copyObsUrl = async (label, query) => {
    const url = `${window.location.origin}/torneo?mode=obs&${query}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedObs({ label, ok: true });
    } catch {
      setCopiedObs({ label, ok: false, url });
    }
  };
  const handleCopyObsLink = (view) => copyObsUrl(view === 'groups' ? 'Tabla' : 'Bracket', `view=${view}`);

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
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => handleCopyObsLink('groups')}>Copiar enlace de la tabla</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => handleCopyObsLink('bracket')}>Copiar enlace del bracket</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Goleadores', 'view=goleadores')}>Copiar enlace de goleadores</button>
                        <button type="button" className="btn btn-ghost justify-start" onClick={() => copyObsUrl('Copa de Plata', 'view=bracket&tournament=copa-plata')}>Copiar enlace de Copa de Plata</button>
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
              {copiedObs && (
                <p role="status" className={`text-xs ${copiedObs.ok ? 'text-success-soft' : 'text-warning-soft'}`}>
                  {copiedObs.ok ? `Enlace OBS de ${copiedObs.label} copiado.` : <>No se pudo copiar. Enlace: <code className="text-ink-2 break-all">{copiedObs.url}</code></>}
                </p>
              )}
              <Tabs label="Secciones del torneo" value={activeTab} onChange={setActiveTab} tabs={[
                { id: 'matches', label: 'Partidos', icon: CalendarDays, count: pendingMatchesCount || null },
                { id: 'groups', label: 'Tabla', icon: LayoutGrid },
                { id: 'bracket', label: 'Brackets', icon: Trophy },
                { id: 'repechaje', label: 'Copa de Plata', icon: Trophy, hidden: !isAdmin },
                { id: 'stats', label: 'Goleadores', icon: Star, hidden: !isAdmin },
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

  if (isObsMode) {
    if (activeTab === 'bracket' || activeTab === 'repechaje') {
      return (
        <BroadcastBracket
          cupId={activeTab === 'bracket' ? CUP_IDS.ORO : CUP_IDS.PLATA}
          bracket={localData.bracket}
          getTeamLogo={getTeamLogo}
        />
      );
    }
    return (
      <TournamentTeamsContext.Provider value={teamOptions}>
        <ObsStage scale={OBS_CONTENT_SCALE[activeTab] ?? 1}>{tabContent}</ObsStage>
      </TournamentTeamsContext.Provider>
    );
  }

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
