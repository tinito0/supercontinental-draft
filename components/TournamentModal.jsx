import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { X, Save, Edit2, Trophy, ShieldAlert, LayoutGrid, Crown, User, Star, CalendarDays, Radio, Trash2 } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeTournamentView } from '../utils/tournamentViews.js';
import { TournamentActionButton, TournamentPanel, TournamentSectionTitle, TournamentTabButton, tournamentBackdropClass, tournamentShellClass } from './TournamentUI.jsx';

const TournamentTeamsContext = React.createContext([]);

const TeamSelect = memo(function TeamSelect({ value, onChange, className = '' }) {
  const teams = React.useContext(TournamentTeamsContext);
  const currentValue = value || '';
  const hasCurrentValue = currentValue && !teams.some(team => team.name === currentValue);
  return (
    <select value={currentValue} onChange={event => onChange(event.target.value)} className={`bg-black/50 text-white rounded border border-cyan-500/30 outline-none focus:border-cyan-400 ${className}`}>
      <option value="">Seleccionar club...</option>
      {hasCurrentValue && <option value={currentValue}>{currentValue}</option>}
      {teams.map(team => <option key={team.id} value={team.name}>{team.name}</option>)}
    </select>
  );
});

const MatchCard = memo(({ match, stage, index, isFinal, isEditing, updateMatch, getTeamLogo, titleOverride }) => {
  if (!match) return <div className="w-[400px] h-48 bg-gray-900/50 border border-red-900/50 flex items-center justify-center text-red-500 font-mono text-xs">Error Data Match</div>;

  let cardTitle = titleOverride || "";
  if (!cardTitle) {
    if (isFinal) cardTitle = "GRAN FINAL";
    else if (stage === 'semis') cardTitle = "SEMIFINAL";
    else if (stage === 'quarters') cardTitle = "CUARTOS DE FINAL";
    else if (stage === 'rep_r1') cardTitle = (index === 0 || index === 2) ? "PRELIMINAR" : "REPECHAJE QF";
    else if (stage === 'rep_r2') cardTitle = "FASE FUSIÓN";
    else if (stage === 'rep_semis') cardTitle = "SEMIFINAL PLATA";
    else if (stage === 'rep_final') cardTitle = "GRAN FINAL PLATA";
  }

  let widthClass = 'w-[400px]', heightClass = 'h-48', textTitleSize = 'text-sm tracking-widest', textNameSize = 'text-2xl', logoSize = 'w-16 h-16';
  if (stage === 'final') { widthClass = 'w-[650px]'; heightClass = 'h-80'; textTitleSize = 'text-xl tracking-[0.5em]'; textNameSize = 'text-3xl'; logoSize = 'w-28 h-28'; }
  else if (['semis', 'quarters', 'rep_final'].includes(stage)) { widthClass = 'w-[480px]'; heightClass = 'h-56'; textNameSize = 'text-xl'; }

  const scaleClass = isFinal ? 'scale-105 z-30' : 'z-10';
  const containerClass = isFinal ? 'bg-[#0f172a] border border-yellow-500/60 shadow-[0_0_120px_rgba(234,179,8,0.4)]' : 'bg-[#1e293b] border border-slate-600/50 shadow-2xl';
  const headerClass = isFinal ? 'bg-gradient-to-r from-yellow-900/70 to-amber-900/70 text-yellow-100 border-b border-yellow-600/30' : 'bg-[#020617]/60 text-slate-300 border-b border-slate-700/50';

  return (
    <div className={`relative flex flex-col rounded-3xl overflow-hidden transition-transform duration-300 hover:scale-[1.02] ${widthClass} ${heightClass} ${containerClass} ${scaleClass}`}>
      <div className={`py-2 px-4 text-center font-black uppercase ${textTitleSize} ${headerClass}`}>{cardTitle}</div>
      <div className="flex-1 flex flex-col justify-center px-6 gap-3">
        {['teamA', 'teamB'].map((teamKey) => {
          const name = match[teamKey];
          const scoreKey = teamKey === 'teamA' ? 'scoreA' : 'scoreB';
          const score = match[scoreKey];
          const logo = getTeamLogo ? getTeamLogo(name) : DEFAULT_LOGO;
          const opponentScore = match[teamKey === 'teamA' ? 'scoreB' : 'scoreA'];
          const isWinner = score !== '' && opponentScore !== '' && parseInt(score) > parseInt(opponentScore);
          const isLoser = score !== '' && opponentScore !== '' && parseInt(score) < parseInt(opponentScore);
          const rowStyle = isLoser ? 'opacity-40 grayscale bg-black/20' : isWinner ? 'bg-gradient-to-r from-white/10 to-transparent shadow-inner' : '';
          const textStyle = isWinner ? 'text-[#4ade80] drop-shadow-[0_0_15px_rgba(74,222,128,0.7)]' : isLoser ? 'text-slate-500' : 'text-slate-200';

          return (
            <div key={teamKey} className={`flex justify-between items-center h-full max-h-28 rounded-2xl px-4 transition-all border border-transparent ${rowStyle}`}>
              <div className="flex items-center gap-6 overflow-hidden w-full">
                <div className="relative flex-shrink-0">
                  <div className={`absolute inset-0 bg-white/10 blur-xl rounded-full ${isWinner ? 'opacity-60' : 'opacity-0'}`}></div>
                  <img src={logo} className={`${logoSize} object-contain relative z-10 drop-shadow-xl ${!name || name === 'TBD' ? 'opacity-30' : ''}`} onError={(e) => e.target.src = DEFAULT_LOGO} />
                </div>
                {isEditing ? (
                  <TeamSelect value={name} onChange={(value) => updateMatch(stage, index, teamKey, value)} className="w-full px-2 py-1 text-lg font-bold" />
                ) : (
                  <span className={`${textNameSize} font-black truncate tracking-tight ${textStyle} leading-none pb-1`}>{name || 'TBD'}</span>
                )}
              </div>
              {isEditing ? (
                <input type="number" value={score} onChange={(e) => updateMatch(stage, index, scoreKey, e.target.value)} className="w-16 h-14 bg-black/50 text-center rounded text-white text-3xl border border-slate-600 outline-none font-bold" />
              ) : (
                <div className={`w-14 flex items-center justify-center font-mono font-black text-5xl ${isWinner ? 'text-[#4ade80]' : 'text-slate-600'}`}>{score !== '' ? score : '-'}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const BracketPair = memo(({ matchTop, matchBottom, stage, idxTop, idxBottom, isEditing, updateGeneric, getTeamLogo, side = 'left', gap = 'gap-80', connectorHeight = '6.5rem' }) => {
  const isLeft = side === 'left';
  const handleUpdate = (s, index, field, value) => {
    updateGeneric(stage, index, field, value);
  };

  return (
    <div className={`flex flex-col justify-center ${gap} relative`}>
      <div className="relative z-10">
        <MatchCard match={matchTop} stage={stage} index={idxTop} isEditing={isEditing} updateMatch={handleUpdate} getTeamLogo={getTeamLogo} />
      </div>
      <div className="relative z-10">
        <MatchCard match={matchBottom} stage={stage} index={idxBottom} isEditing={isEditing} updateMatch={handleUpdate} getTeamLogo={getTeamLogo} />
      </div>
      <div className={`absolute w-16 border-slate-600/50 pointer-events-none ${isLeft ? 'right-0 border-r-4 rounded-r-3xl translate-x-full' : 'left-0 border-l-4 rounded-l-3xl -translate-x-full'}`} style={{ top: connectorHeight, bottom: connectorHeight }}>
        <div className={`absolute top-1/2 w-12 h-1 bg-slate-600/50 ${isLeft ? 'right-0 translate-x-full' : 'left-0 -translate-x-full'}`}></div>
      </div>
    </div>
  );
});

const SilverBranch = memo(({ side, matchesR1, matchR2, matchSemi, isEditing, updateGeneric, getTeamLogo }) => {
  const isLeft = side === 'left';
  const r1Idx = isLeft ? [0, 1] : [2, 3];
  const r2Idx = isLeft ? 0 : 1;
  const semiIdx = isLeft ? 0 : 1;

  return (
    <div className={`flex items-center gap-20 ${!isLeft ? 'flex-row-reverse' : ''}`}>
      <BracketPair
        matchTop={matchesR1[0]}
        matchBottom={matchesR1[1]}
        stage="rep_r1"
        idxTop={r1Idx[0]}
        idxBottom={r1Idx[1]}
        side={side}
        isEditing={isEditing}
        updateGeneric={(stage, index, field, value) => updateGeneric(['repechaje', 'r1'], index, field, value)}
        getTeamLogo={getTeamLogo}
        gap="gap-[28rem]"
        connectorHeight="6rem"
      />
      <div className="relative z-10">
        <MatchCard
          match={matchR2}
          stage="rep_r2"
          index={r2Idx}
          isEditing={isEditing}
          updateMatch={(stage, index, field, value) => updateGeneric(['repechaje', 'r2'], index, field, value)}
          getTeamLogo={getTeamLogo}
        />
        <div className={`absolute top-1/2 w-20 h-1 bg-slate-600/50 -z-10 ${isLeft ? '-right-20' : '-left-20'}`}></div>
      </div>
      <div className="relative z-10">
        <MatchCard
          match={matchSemi}
          stage="rep_semis"
          index={semiIdx}
          isEditing={isEditing}
          updateMatch={(stage, index, field, value) => updateGeneric(['repechaje', 'semis'], index, field, value)}
          getTeamLogo={getTeamLogo}
        />
        <div className={`absolute top-1/2 w-20 h-1 bg-slate-600/50 -z-10 ${isLeft ? '-right-20' : '-left-20'}`}></div>
      </div>
    </div>
  );
});

const MatchCenter = memo(function MatchCenter({ matches, isEditing, onUpdate, onAdd, onRemove, getTeamLogo }) {
  const orderedMatches = [...(matches || [])].sort((a, b) => {
    const aDone = a.status === 'completed';
    const bDone = b.status === 'completed';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return String(a.date || '').localeCompare(String(b.date || ''));
  });

  return (
    <div className="w-full max-w-[1500px] px-8 py-10">
      <TournamentSectionTitle title="CENTRO DE PARTIDOS" subtitle="AGENDA, RESULTADOS Y FIGURAS" />
      {isEditing && (
        <div className="mb-5 flex justify-end">
          <TournamentActionButton tone="green" onClick={onAdd}>Agregar partido</TournamentActionButton>
        </div>
      )}
      {orderedMatches.length === 0 ? (
        <TournamentPanel title="Próximos partidos" icon={CalendarDays} compact>
          <p className="py-12 text-center text-slate-400">Todavía no hay partidos cargados. El administrador puede crear la agenda desde Editar.</p>
        </TournamentPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {orderedMatches.map((match) => {
            const isCompleted = match.status === 'completed';
            return (
              <article key={match.id} className={`rounded-3xl border p-5 shadow-2xl ${isCompleted ? 'border-slate-700/70 bg-slate-950/70' : 'border-cyan-500/25 bg-cyan-950/15'}`}>
                <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-widest">
                  {isEditing ? (
                    <input value={match.round || ''} onChange={event => onUpdate(match.id, 'round', event.target.value)} placeholder="Fecha / fase" className="w-40 rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-white" />
                  ) : <span className="text-cyan-300">{match.round || 'Partido de torneo'}</span>}
                  <div className="flex items-center gap-2">
                    <span className={isCompleted ? 'text-emerald-400' : 'text-yellow-300'}>{isCompleted ? 'Finalizado' : 'Próximo'}</span>
                    {isEditing && <button type="button" onClick={() => onRemove(match.id)} className="rounded-md border border-red-500/40 bg-red-500/10 p-1.5 text-red-300 transition hover:bg-red-500 hover:text-white" title="Eliminar partido" aria-label="Eliminar partido"><Trash2 size={14} /></button>}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {['home', 'away'].map((side, index) => {
                    const teamField = `${side}Team`;
                    const scoreField = `${side}Score`;
                    const teamName = match[teamField] || (side === 'home' ? 'Local' : 'Visitante');
                    return (
                      <React.Fragment key={side}>
                        {index === 1 && <div className="text-center text-lg font-black text-slate-500">VS</div>}
                        <div className={`min-w-0 ${side === 'away' ? 'order-3 text-right' : ''}`}>
                          <img src={getTeamLogo(teamName)} alt="" className={`mb-2 h-12 w-12 object-contain ${side === 'away' ? 'ml-auto' : ''}`} onError={event => { event.currentTarget.src = DEFAULT_LOGO; }} />
                          {isEditing ? <TeamSelect value={match[teamField] || ''} onChange={value => onUpdate(match.id, teamField, value)} className="w-full px-2 py-1 text-sm font-black" /> : <p className="truncate text-lg font-black uppercase text-white">{teamName}</p>}
                          {isEditing ? <input type="number" value={match[scoreField] ?? ''} onChange={event => onUpdate(match.id, scoreField, event.target.value)} className={`mt-2 w-16 rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-center text-xl font-black text-white ${side === 'away' ? 'ml-auto block' : ''}`} /> : isCompleted && <p className="mt-2 text-3xl font-black text-white">{match[scoreField] ?? 0}</p>}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="mt-5 grid grid-cols-1 gap-2 border-t border-white/5 pt-4 sm:grid-cols-3">
                  {isEditing ? (
                    <>
                      <input type="date" value={match.date || ''} onChange={event => onUpdate(match.id, 'date', event.target.value)} className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white" />
                      <input value={match.mvp || ''} onChange={event => onUpdate(match.id, 'mvp', event.target.value)} placeholder="MVP" className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white" />
                      <select value={match.status || 'scheduled'} onChange={event => onUpdate(match.id, 'status', event.target.value)} className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white"><option value="scheduled">Próximo</option><option value="completed">Finalizado</option></select>
                      <input value={match.homeGoals || ''} onChange={event => onUpdate(match.id, 'homeGoals', event.target.value)} placeholder="Goleadores local" className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white sm:col-span-1" />
                      <input value={match.awayGoals || ''} onChange={event => onUpdate(match.id, 'awayGoals', event.target.value)} placeholder="Goleadores visitante" className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white sm:col-span-2" />
                      <input value={match.homeAssists || ''} onChange={event => onUpdate(match.id, 'homeAssists', event.target.value)} placeholder="Asistencias local" className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white sm:col-span-1" />
                      <input value={match.awayAssists || ''} onChange={event => onUpdate(match.id, 'awayAssists', event.target.value)} placeholder="Asistencias visitante" className="rounded-lg border border-slate-600 bg-black/40 px-2 py-1 text-sm text-white sm:col-span-2" />
                      <label className="flex items-center gap-2 text-xs font-bold text-emerald-300"><input type="checkbox" checked={Boolean(match.homeConfirmed)} onChange={event => onUpdate(match.id, 'homeConfirmed', event.target.checked)} /> Confirmó local</label>
                      <label className="flex items-center gap-2 text-xs font-bold text-emerald-300"><input type="checkbox" checked={Boolean(match.awayConfirmed)} onChange={event => onUpdate(match.id, 'awayConfirmed', event.target.checked)} /> Confirmó visitante</label>
                    </>
                  ) : <><span className="text-xs font-bold text-slate-400">{match.date || 'Fecha a confirmar'}</span><span className="text-xs font-bold text-yellow-300">{match.mvp ? `MVP: ${match.mvp}` : 'MVP pendiente'}</span><span className="text-xs font-bold text-slate-500">{match.homeGoals || match.awayGoals ? `${match.homeGoals || ''} ${match.awayGoals || ''}` : 'Goleadores pendientes'}</span>{(match.homeConfirmed && match.awayConfirmed) && <span className="text-xs font-black text-emerald-300">DTs confirmados</span>}</>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
});

function buildAutomaticTournamentData(data) {
  const next = JSON.parse(JSON.stringify(data));
  const completedMatches = (next.matches || []).filter(match => match.status === 'completed');
  if (completedMatches.length === 0) return next;

  const rows = new Map();
  (next.league || []).filter(team => team.name && team.name !== 'Club...').forEach(team => {
    rows.set(team.name.trim().toLowerCase(), { ...team });
  });
  const teamsWithResults = new Set();
  completedMatches.forEach(match => {
    const homeKey = String(match.homeTeam || '').trim().toLowerCase();
    const awayKey = String(match.awayTeam || '').trim().toLowerCase();
    if (homeKey) teamsWithResults.add(homeKey);
    if (awayKey) teamsWithResults.add(awayKey);
  });
  teamsWithResults.forEach(key => {
    const team = rows.get(key);
    if (team) Object.assign(team, { pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
  });
  const scorers = new Map();
  const assisters = new Map();
  const addStatEntries = (value, team, target) => {
    String(value || '').split(/[,;]+/).map(item => item.trim()).filter(Boolean).forEach(entry => {
      const match = entry.match(/^(.*?)(?:\s*[xX]\s*(\d+))?$/);
      const name = String(match?.[1] || entry).trim();
      const amount = Number(match?.[2] || 1);
      if (!name || !Number.isFinite(amount)) return;
      const key = `${name.toLowerCase()}-${String(team || '').toLowerCase()}`;
      const current = target.get(key) || { name, team, value: 0 };
      current.value += amount;
      target.set(key, current);
    });
  };
  const ensureRow = (key, name) => {
    if (!key || !name || rows.has(key)) return;
    rows.set(key, { id: `team-${key.replace(/[^a-z0-9]/g, '-')}`, name, pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
  };

  completedMatches.forEach(match => {
    const homeKey = String(match.homeTeam || '').trim().toLowerCase();
    const awayKey = String(match.awayTeam || '').trim().toLowerCase();
    ensureRow(homeKey, match.homeTeam);
    ensureRow(awayKey, match.awayTeam);
    const home = rows.get(homeKey);
    const away = rows.get(awayKey);
    const homeScore = Number(match.homeScore);
    const awayScore = Number(match.awayScore);
    if (home && away && Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
      home.pj += 1; away.pj += 1; home.gf += homeScore; home.gc += awayScore; away.gf += awayScore; away.gc += homeScore;
      if (homeScore > awayScore) { home.pg += 1; home.pts += 2; away.pp += 1; }
      else if (awayScore > homeScore) { away.pg += 1; away.pts += 2; home.pp += 1; }
      else { home.gpen += 1; away.gpen += 1; home.pts += 1; away.pts += 1; }
    }
    addStatEntries(match.homeGoals, match.homeTeam, scorers);
    addStatEntries(match.awayGoals, match.awayTeam, scorers);
    addStatEntries(match.homeAssists, match.homeTeam, assisters);
    addStatEntries(match.awayAssists, match.awayTeam, assisters);
  });

  next.league = [...rows.values()];
  next.topScorers = [...scorers.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, goals: item.value }));
  next.topAssisters = [...assisters.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, assists: item.value }));
  while (next.topScorers.length < 5) next.topScorers.push({ name: '', team: '', goals: '' });
  while (next.topAssisters.length < 5) next.topAssisters.push({ name: '', team: '', assists: '' });
  return next;
}

export const TournamentModal = memo(function TournamentModal({ isVisible, isPage, onClose, tournamentData, isAdmin, onUpdateTournament, allTeams, initialTab = 'groups', userTeamName }) {
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
    const handleEsc = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isVisible, isPage, onClose]);

  useEffect(() => {
    if (tournamentData && !isEditing) {
      const safeData = JSON.parse(JSON.stringify(tournamentData));
      if (!safeData.league) safeData.league = [];
      const leagueNames = new Set(safeData.league.map(team => String(team?.name || '').trim().toLowerCase()).filter(Boolean));
      Object.entries(allTeams || {}).forEach(([id, team]) => {
        const name = String(team?.teamName || '').trim();
        const key = name.toLowerCase();
        if (name && !leagueNames.has(key)) {
          safeData.league.push({ id, name, pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
          leagueNames.add(key);
        }
      });
      while (safeData.league.length < 12) {
        safeData.league.push({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
      }
      safeData.league.forEach(t => { if (!t.id) t.id = crypto.randomUUID(); });

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
            final: { teamA: '', teamB: '', scoreA: '', scoreB: '' }
          }
        },
        topScorers: Array(5).fill(null).map(() => ({ name: '', team: '', goals: '' })),
        topAssisters: Array(5).fill(null).map(() => ({ name: '', team: '', assists: '' })),
        matches: []
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

  const sortLeague = (data) => {
    const sorted = { ...data };
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

  const handleSave = () => {
    const sortedData = sortLeague(buildAutomaticTournamentData(localData));
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
        id: crypto.randomUUID(), round: 'Fecha', homeTeam: '', awayTeam: '', homeScore: '', awayScore: '', date: '', mvp: '', homeGoals: '', awayGoals: '', homeAssists: '', awayAssists: '', homeConfirmed: false, awayConfirmed: false, status: 'scheduled',
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

  if ((!isVisible && !isPage) || !localData) return null;

  return (
    <TournamentTeamsContext.Provider value={teamOptions}>
    <div
      className={isObsMode
        ? `w-[1920px] h-[1080px] overflow-hidden ${tournamentShellClass}`
        : isPage ? `w-full h-full animate-in fade-in duration-300 ${tournamentShellClass}` : `fixed inset-0 z-[100] animate-in fade-in duration-300 ${tournamentShellClass}`}
      onClick={!isPage && !isObsMode ? onClose : undefined}
    >
      <div className={`${tournamentBackdropClass} z-0`}></div>
      <div className="relative z-10 w-full h-full flex flex-col" onClick={e => e.stopPropagation()}>
        {!isObsMode && (
          <div className="flex justify-between items-center p-4 bg-slate-900/80 backdrop-blur border-b border-white/5 shrink-0">
            <div className="flex items-center gap-3">
              <img src={DEFAULT_LOGO} className="w-8 h-8 object-contain" alt="Logo" onError={(e) => e.target.style.display = 'none'} />
              <span className="font-bold text-white tracking-widest text-sm">SCL DATA HUB</span>
            </div>
            <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
              <TournamentTabButton id="matches" label="Partidos" icon={CalendarDays} activeTab={activeTab} onClick={setActiveTab} />
              <TournamentTabButton id="groups" label="Tabla" icon={LayoutGrid} activeTab={activeTab} onClick={setActiveTab} />
              <TournamentTabButton id="bracket" label="Brackets" icon={Trophy} activeTab={activeTab} onClick={setActiveTab} />
              {isAdmin && <TournamentTabButton id="repechaje" label="Plata (Admin)" icon={ShieldAlert} activeTab={activeTab} onClick={setActiveTab} />}
              {isAdmin && <TournamentTabButton id="stats" label="Goleadores (Admin)" icon={Star} activeTab={activeTab} onClick={setActiveTab} />}
            </div>
            <div className="flex gap-2">
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
                <TournamentActionButton tone="green" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
                  {isEditing ? <><Save className="w-4 h-4 mr-2" /> Guardar</> : <><Edit2 className="w-4 h-4 mr-2" /> Editar</>}
                </TournamentActionButton>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition" title="Cerrar"><X size={24} /></button>
            </div>
          </div>
        )}

        <div className="flex-grow flex flex-col items-center justify-center p-0 overflow-hidden relative">
          <div
            className={`w-[1920px] h-[1080px] flex flex-col items-center justify-center transition-transform duration-500 origin-center ${isObsMode ? '' : 'scale-[0.80]'}`}
            style={isObsMode ? { transform: `scale(${obsContentScale})` } : undefined}
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
              <div className={`flex flex-col items-center w-full h-full scale-100 ${isObsMode ? 'justify-start pt-8' : 'justify-center'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="TABLA GENERAL" compact={isObsMode} />
                <div className={`w-full ${isObsMode ? 'max-w-[1640px] px-12 mt-1' : 'max-w-[1400px] px-8 mt-8'}`}>
                  <TournamentPanel title="Clasificación" className={`[&>div:last-child]:p-0 ${isObsMode ? '[&>div:first-child]:p-4 [&>div:first-child_h3]:text-3xl' : ''}`}>
                    <table className="w-full text-left border-collapse">
                      <thead className={`bg-black/40 text-slate-400 uppercase tracking-wider font-bold ${isObsMode ? 'text-sm' : 'text-lg'}`}>
                        <tr>
                          <th className={isObsMode ? 'px-6 py-2' : 'px-8 py-4'}>Club</th>
                          <th className={`px-2 text-center w-16 ${isObsMode ? 'py-2' : 'py-4'}`}>PJ</th>
                          <th className={`px-2 text-center w-16 text-green-400 ${isObsMode ? 'py-2' : 'py-4'}`}>G</th>
                          <th className={`px-2 text-center w-16 text-yellow-400 ${isObsMode ? 'py-2' : 'py-4'}`}>GP</th>
                          <th className={`px-2 text-center w-16 text-red-400 ${isObsMode ? 'py-2' : 'py-4'}`}>P</th>
                          <th className={`px-2 text-center w-16 ${isObsMode ? 'py-2' : 'py-4'}`}>GF</th>
                          <th className={`px-2 text-center w-16 ${isObsMode ? 'py-2' : 'py-4'}`}>GC</th>
                          <th className={`px-2 text-center w-16 text-blue-400 ${isObsMode ? 'py-2' : 'py-4'}`}>DG</th>
                          <th className={`${isObsMode ? 'px-6 py-2' : 'px-8 py-4'} text-right text-white w-24`}>PTS</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y divide-slate-700/30 font-medium ${isObsMode ? 'text-base' : 'text-xl'}`}>
                        {(isEditing ? localData.league : localData.league.filter(team => team.name && team.name !== 'Club...')).map((team, idx) => {
                          const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                          const isTop4 = idx < 4;
                          const isBottom3 = idx >= 9;
                          const rowHighlightClass = isCurrentUser ? 'bg-cyan-500/20 shadow-[inset_0_0_20px_rgba(6,182,212,0.3)] border-b-2 border-cyan-500' : 
                                                    isTop4 ? 'bg-green-500/5' : 
                                                    isBottom3 ? 'bg-red-500/5' : 'bg-slate-500/5';
                          const numberBg = isTop4 ? 'bg-green-600 text-black' : isBottom3 ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500';
                          return (
                          <tr key={team.id || idx} className={`${rowHighlightClass} hover:bg-white/10 transition-colors`}>
                            <td className={`flex items-center ${isObsMode ? 'gap-4 px-6 py-1.5' : 'gap-6 px-8 py-3'}`}>
                              <div className={`${isObsMode ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} flex-shrink-0 flex items-center justify-center rounded-lg font-black ${numberBg}`}>{idx + 1}</div>
                              <img src={getTeamLogo(team.name)} className={`${isObsMode ? 'w-7 h-7' : 'w-10 h-10'} object-contain flex-shrink-0`} onError={(e) => e.target.src = DEFAULT_LOGO} />
                              {isEditing ? <TeamSelect value={team.name === 'Club...' ? '' : team.name} onChange={(value) => updateLeagueTeam(idx, 'name', value)} className="w-full px-2 py-1" /> : <span className={`whitespace-nowrap font-bold ${isTop4 ? 'text-white' : 'text-slate-300'}`}>{team.name}</span>}
                            </td>
                            <td className="px-2 text-center text-slate-400">{team.pj}</td>
                            <td className="px-2 text-center text-green-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} /> : team.pg}</td>
                            <td className="px-2 text-center text-yellow-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} /> : team.gpen}</td>
                            <td className="px-2 text-center text-red-500/80">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} /> : team.pp}</td>
                            <td className="px-2 text-center text-slate-500">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} /> : team.gf}</td>
                            <td className="px-2 text-center text-slate-500">{isEditing ? <input type="number" className="w-10 bg-black/50 text-center" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} /> : team.gc}</td>
                            <td className="px-2 text-center font-bold text-blue-400">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                            <td className={`${isObsMode ? 'px-6 text-xl' : 'px-8 text-2xl'} text-right font-black text-white`}>{team.pts}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!isEditing && localData.league.filter(team => team.name && team.name !== 'Club...').length === 0 && (
                      <div className="p-12 text-center border-t border-slate-700/40">
                        <p className="text-2xl font-black text-white italic uppercase tracking-wider">Sin tabla cargada</p>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.35em] mt-3">Carga equipos desde el panel del torneo</p>
                      </div>
                    )}
                  </TournamentPanel>
                </div>
              </div>
            )}

            {activeTab === 'bracket' && (
              <div className="flex flex-col items-center justify-center h-full">
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="ELIMINATORIAS ORO" />
                <div className="flex items-center justify-center gap-16 w-full mt-8">
                  {/* LEFT QUARTERS */}
                  <BracketPair matchTop={localData.bracket.quarters[0]} matchBottom={localData.bracket.quarters[1]} stage="quarters" idxTop={0} idxBottom={1} side="left" isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                  {/* LEFT SEMI */}
                  <div className="flex flex-col items-center justify-center z-10 relative">
                    <MatchCard match={localData.bracket.semis[0]} stage="semis" index={0} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                    <div className={`absolute top-1/2 w-16 h-1 bg-slate-600/50 -z-10 -right-16`}></div>
                  </div>
                  {/* FINAL */}
                  <div className="flex flex-col items-center justify-center z-20 px-4 relative -mt-16">
                    <div className="text-yellow-500 animate-pulse mb-6 drop-shadow-[0_0_50px_rgba(234,179,8,0.6)]"><Crown size={120} strokeWidth={1.5} /></div>
                    <MatchCard match={localData.bracket.final} stage="final" index={0} isFinal={true} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                  </div>
                  {/* RIGHT SEMI */}
                  <div className="flex flex-col items-center justify-center z-10 relative">
                    <MatchCard match={localData.bracket.semis[1]} stage="semis" index={1} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                    <div className={`absolute top-1/2 w-16 h-1 bg-slate-600/50 -z-10 -left-16`}></div>
                  </div>
                  {/* RIGHT QUARTERS */}
                  <BracketPair matchTop={localData.bracket.quarters[2]} matchBottom={localData.bracket.quarters[3]} stage="quarters" idxTop={2} idxBottom={3} side="right" isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                </div>
              </div>
            )}

            {activeTab === 'repechaje' && (
              <div className="flex flex-col items-center justify-center h-full w-full">
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="COPA DE PLATA" />
                <div className="flex items-center justify-center gap-24 w-full mt-12">
                  <SilverBranch side="left" matchesR1={[localData.bracket.repechaje.r1[0], localData.bracket.repechaje.r1[1]]} matchR2={localData.bracket.repechaje.r2[0]} matchSemi={localData.bracket.repechaje.semis[0]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                  <div className="flex flex-col items-center z-20 px-4 -mt-32">
                    <div className="text-slate-500 opacity-60 mb-8 drop-shadow-2xl"><Trophy size={130} strokeWidth={1} /></div>
                    <MatchCard match={localData.bracket.repechaje.final} stage="rep_final" index={0} isFinal={true} isEditing={isEditing} updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'final'], i, f, v)} getTeamLogo={getTeamLogo} />
                  </div>
                  <SilverBranch side="right" matchesR1={[localData.bracket.repechaje.r1[2], localData.bracket.repechaje.r1[3]]} matchR2={localData.bracket.repechaje.r2[1]} matchSemi={localData.bracket.repechaje.semis[1]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="flex flex-col items-center w-full h-full justify-center scale-100 px-20">
                <TournamentSectionTitle title="LÍDERES INDIVIDUALES" subtitle="ESTADÍSTICAS REALES" />
                <div className="grid grid-cols-2 gap-20 w-full max-w-[1500px] mt-10">
                  {/* GOLEADORES */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-yellow-600/20 to-transparent p-6 border-b border-slate-700/50 flex items-center gap-4">
                       <Trophy className="text-yellow-500 w-8 h-8" />
                       <h3 className="text-3xl font-black text-white italic tracking-wider">MÁXIMOS GOLEADORES</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {localData.topScorers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-400">{idx+1}</div>
                             <div className="flex flex-col">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topScorers', idx, 'name', e.target.value)} className="bg-black/50 text-white px-2 py-1 mb-1 rounded border border-slate-700 text-sm"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topScorers', idx, 'team', e.target.value)} className="bg-black/50 text-slate-400 px-2 py-1 rounded border border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xl font-black text-white uppercase">{player.name || '---'}</span>
                                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{player.team || '---'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             {isEditing ? (
                               <input type="number" value={player.goals} onChange={e => updateStat('topScorers', idx, 'goals', e.target.value)} className="w-16 bg-blue-600/20 text-blue-400 text-center font-black text-2xl rounded p-2" />
                             ) : (
                               <div className="text-4xl font-black text-blue-400">{player.goals || 0}</div>
                             )}
                             <span className="text-[10px] font-black text-slate-600 uppercase vertical-lr tracking-widest">GOLES</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ASISTIDORES */}
                  <div className="bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-r from-blue-600/20 to-transparent p-6 border-b border-slate-700/50 flex items-center gap-4">
                       <Star className="text-blue-500 w-8 h-8" />
                       <h3 className="text-3xl font-black text-white italic tracking-wider">MÁXIMOS ASISTIDORES</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {localData.topAssisters.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-slate-400">{idx+1}</div>
                             <div className="flex flex-col">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topAssisters', idx, 'name', e.target.value)} className="bg-black/50 text-white px-2 py-1 mb-1 rounded border border-slate-700 text-sm"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topAssisters', idx, 'team', e.target.value)} className="bg-black/50 text-slate-400 px-2 py-1 rounded border border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xl font-black text-white uppercase">{player.name || '---'}</span>
                                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{player.team || '---'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-3">
                             {isEditing ? (
                               <input type="number" value={player.assists} onChange={e => updateStat('topAssisters', idx, 'assists', e.target.value)} className="w-16 bg-emerald-600/20 text-emerald-400 text-center font-black text-2xl rounded p-2" />
                             ) : (
                               <div className="text-4xl font-black text-emerald-400">{player.assists || 0}</div>
                             )}
                             <span className="text-[10px] font-black text-slate-600 uppercase vertical-lr tracking-widest">ASIST</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </TournamentTeamsContext.Provider>
  );
});
