import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { X, Save, Edit2, Trophy, ShieldAlert, LayoutGrid, Star, CalendarDays } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeTournamentView } from '../utils/tournamentViews.js';
import {
  TournamentActionButton,
  TournamentTabButton,
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
} from './tournament/index.js';

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
  const [localData, setLocalData] = useState(null);
  const isObsMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'obs';

  useEffect(() => {
    setActiveTab(normalizeTournamentView(initialTab));
  }, [initialTab]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible && !isPage) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, isPage, onClose]);

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

  const obsContentScale = activeTab === 'repechaje' ? 0.50
    : activeTab === 'bracket' ? 0.65
      : activeTab === 'stats' ? 0.82
        : activeTab === 'matches' ? 0.78
          : 1;

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

  const handleSave = () => {
    const sortedData = sortLeague(buildAutomaticTournamentData(localData));
    if (sortedData.league.length > 12) {
      sortedData.league = sortedData.league.slice(0, 12);
    }
    setLocalData(sortedData);
    onUpdateTournament(sortedData);
    setIsEditing(false);
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

  const handleCopyObsLink = (view) => {
    const url = `${window.location.origin}/torneo?mode=obs&view=${view}`;
    navigator.clipboard.writeText(url);
    alert(`Enlace OBS de ${view} copiado al portapapeles!`);
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
        <div className="w-10 h-10 border-4 border-[#00b4d8]/20 border-t-[#00b4d8] rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold text-slate-300 uppercase tracking-widest animate-pulse">
          Cargando Torneo...
        </span>
      </div>
    );
  }

  const content = (
    <>
      <div className={`${tournamentBackdropClass} z-0`}></div>
      <div className="relative z-10 w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
          {!isObsMode && (
            <div className="flex flex-col px-4 py-3 bg-[#0c1017]/95 backdrop-blur border-b border-white/10 shrink-0 gap-3">
              {/* Fila superior: Marca + Contexto de fase + Acciones */}
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                    <img src={DEFAULT_LOGO} className="w-full h-full object-contain drop-shadow" alt="Logo" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white tracking-wide text-sm">Torneo SCL</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#00b4d8]/15 text-[#00b4d8] border border-[#00b4d8]/30">
                        Temporada 2
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-semibold text-slate-300">{currentPhaseContext}</span>
                      {pendingMatchesCount > 0 && (
                        <>
                          <span className="text-white/20">•</span>
                          <span className="text-[#00b4d8] font-semibold">{pendingMatchesCount} {pendingMatchesCount === 1 ? 'partido pendiente' : 'partidos pendientes'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de acción derecha */}
                <div className="flex items-center gap-2">
                  {isPage && (
                    <>
                      <TournamentActionButton onClick={() => handleCopyObsLink('groups')}>
                        Link OBS Tabla
                      </TournamentActionButton>
                      <TournamentActionButton onClick={() => handleCopyObsLink('bracket')}>
                        Link OBS Bracket
                      </TournamentActionButton>
                      <TournamentActionButton tone="yellow" onClick={() => { const url = `${window.location.origin}/torneo?mode=obs&view=goleadores`; navigator.clipboard.writeText(url); alert('Enlace OBS Goleadores copiado!'); }}>
                        Link OBS Goleadores
                      </TournamentActionButton>
                      <TournamentActionButton tone="slate" onClick={() => { const url = `${window.location.origin}/torneo?mode=obs&view=bracket&tournament=copa-plata`; navigator.clipboard.writeText(url); alert('Enlace OBS Copa de Plata copiado!'); }}>
                        Link OBS Plata
                      </TournamentActionButton>
                    </>
                  )}
                  {isAdmin && (
                    <TournamentActionButton tone="green" onClick={() => (isEditing ? handleSave() : setIsEditing(true))}>
                      {isEditing ? <><Save className="w-4 h-4 mr-2" /> Guardar</> : <><Edit2 className="w-4 h-4 mr-2" /> Editar</>}
                    </TournamentActionButton>
                  )}
                  <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition cursor-pointer" title="Cerrar"><X size={20} /></button>
                </div>
              </div>

              {/* Fila de Tabs con badges numéricos y sin (Admin) */}
              <div className="flex items-center gap-1 bg-[#111722] p-1 rounded-xl border border-white/[0.08] overflow-x-auto max-w-full">
                <TournamentTabButton id="matches" label="Partidos" icon={CalendarDays} badge={pendingMatchesCount} activeTab={activeTab} onClick={setActiveTab} />
                <TournamentTabButton id="groups" label="Tabla" icon={LayoutGrid} activeTab={activeTab} onClick={setActiveTab} />
                <TournamentTabButton id="bracket" label="Brackets" icon={Trophy} activeTab={activeTab} onClick={setActiveTab} />
                {isAdmin && <TournamentTabButton id="repechaje" label="Plata" icon={Trophy} endIcon={ShieldAlert} activeTab={activeTab} onClick={setActiveTab} />}
                {isAdmin && <TournamentTabButton id="stats" label="Goleadores" icon={Star} endIcon={ShieldAlert} activeTab={activeTab} onClick={setActiveTab} />}
              </div>
            </div>
          )}

          <div className={`flex-grow relative ${isObsMode ? 'flex flex-col items-center justify-center p-0 overflow-hidden' : 'w-full h-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 custom-scrollbar'}`}>
            <div
              className={isObsMode ? 'w-[1920px] h-[1080px] flex flex-col items-center justify-center transition-transform duration-500 origin-center' : 'w-full max-w-7xl mx-auto flex flex-col'}
              style={{
                transform: isObsMode ? `scale(${obsContentScale})` : undefined,
                contain: isObsMode ? 'content' : undefined,
              }}
            >
              {activeTab === 'matches' && (
                <MatchCenter
                  matches={localData.matches}
                  isEditing={isEditing}
                  onUpdate={updateTournamentMatch}
                  onAdd={addTournamentMatch}
                  onRemove={removeTournamentMatch}
                  getTeamLogo={getTeamLogo}
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
            </div>
          </div>
        </div>
    </>
  );

  if (isObsMode) {
    return (
      <TournamentTeamsContext.Provider value={teamOptions}>
        <div className={`w-[1920px] h-[1080px] overflow-hidden ${tournamentShellClass}`}>
          {content}
        </div>
      </TournamentTeamsContext.Provider>
    );
  }

  if (isPage) {
    return (
      <TournamentTeamsContext.Provider value={teamOptions}>
        <div className={`w-full h-full animate-in fade-in duration-300 ${tournamentShellClass}`}>
          {content}
        </div>
      </TournamentTeamsContext.Provider>
    );
  }

  return (
    <TournamentTeamsContext.Provider value={teamOptions}>
      <BaseModal
        isOpen={true}
        onClose={onClose}
        size="full"
        showClose={false}
        className={`!p-0 ${tournamentShellClass}`}
        contentClassName="!p-0 !overflow-hidden flex flex-col"
      >
        {content}
      </BaseModal>
    </TournamentTeamsContext.Provider>
  );
});

export default TournamentModal;
