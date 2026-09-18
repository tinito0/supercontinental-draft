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
  if (!match) return <div className="w-56 h-20 bg-slate-100 dark:bg-slate-900 border border-red-500/30 flex items-center justify-center text-red-500 font-medium text-xs rounded-xl">Error de datos</div>;

  let cardTitle = titleOverride || "";
  if (!cardTitle) {
    if (isFinal) cardTitle = "GRAN FINAL";
    else if (stage === 'semis') cardTitle = "SEMIFINAL";
    else if (stage === 'quarters') cardTitle = "CUARTOS";
    else if (stage === 'rep_r1') cardTitle = (index === 0 || index === 2) ? "PRELIMINAR" : "REPECHAJE QF";
    else if (stage === 'rep_r2') cardTitle = "FASE FUSIÓN";
    else if (stage === 'rep_semis') cardTitle = "SEMIFINAL PLATA";
    else if (stage === 'rep_final') cardTitle = "GRAN FINAL PLATA";
  }

  const containerClass = isFinal
    ? 'border-amber-400/80 dark:border-amber-500/70 shadow-md ring-1 ring-amber-400/30'
    : 'border-slate-200 dark:border-slate-800 shadow-sm';

  return (
    <div
      className={`relative flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#111722] border transition-all duration-200 w-[230px] sm:w-[250px] ${containerClass}`}
      style={{ contain: 'content' }}
    >
      <div className={`py-1 px-3 text-center font-bold text-[10px] tracking-wider uppercase border-b ${
        isFinal
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800'
      }`}>
        {cardTitle}
      </div>

      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
        {['teamA', 'teamB'].map((teamKey, tIdx) => {
          const name = match[teamKey];
          const scoreKey = teamKey === 'teamA' ? 'scoreA' : 'scoreB';
          const score = match[scoreKey];
          const logo = getTeamLogo ? getTeamLogo(name) : DEFAULT_LOGO;
          const opponentScore = match[teamKey === 'teamA' ? 'scoreB' : 'scoreA'];
          const isWinner = score !== '' && opponentScore !== '' && parseInt(score) > parseInt(opponentScore);
          const isLoser = score !== '' && opponentScore !== '' && parseInt(score) < parseInt(opponentScore);

          return (
            <div key={teamKey} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
              isWinner ? 'bg-emerald-500/10 dark:bg-emerald-500/15' : isLoser ? 'opacity-60' : ''
            }`}>
              <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                <span className="text-[10px] text-slate-400 font-mono w-3.5 shrink-0">
                  {stage === 'quarters' ? `${(index * 2) + tIdx + 1}°` : ''}
                </span>
                <img
                  src={logo}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0"
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
                {isEditing ? (
                  <TeamSelect
                    value={name}
                    onChange={(value) => updateMatch(stage, index, teamKey, value)}
                    className="w-full px-1.5 py-0.5 text-xs font-semibold"
                  />
                ) : (
                  <span className={`text-xs truncate ${isWinner ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                    {name || 'A definir'}
                  </span>
                )}
              </div>

              {isEditing ? (
                <input
                  type="number"
                  value={score}
                  onChange={(e) => updateMatch(stage, index, scoreKey, e.target.value)}
                  className="w-8 h-6 bg-slate-100 dark:bg-black/50 text-center rounded text-slate-900 dark:text-white text-xs border border-slate-300 dark:border-slate-700 outline-none font-bold ml-1.5"
                />
              ) : (
                <span className={`text-xs font-mono font-bold tabular-nums ml-2 ${
                  isWinner ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {score !== '' ? score : '-'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const BracketPair = memo(({ matchTop, matchBottom, stage, idxTop, idxBottom, isEditing, updateGeneric, getTeamLogo, side = 'left', gap = 'gap-8 sm:gap-12' }) => {
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
      <div className={`hidden lg:block absolute w-8 border-slate-300 dark:border-slate-700/60 pointer-events-none ${
        isLeft ? 'right-0 border-r-2 rounded-r-xl translate-x-full' : 'left-0 border-l-2 rounded-l-xl -translate-x-full'
      }`} style={{ top: '25%', bottom: '25%' }}>
        <div className={`absolute top-1/2 w-6 h-0.5 bg-slate-300 dark:bg-slate-700/60 ${isLeft ? 'right-0 translate-x-full' : 'left-0 -translate-x-full'}`} />
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

  const groupedByRound = useMemo(() => {
    return orderedMatches.reduce((acc, m) => {
      const r = m.round || 'Jornada Regular';
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});
  }, [orderedMatches]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6">
      <TournamentSectionTitle title="CENTRO DE PARTIDOS" subtitle="AGENDA Y RESULTADOS" />
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
        <div className="space-y-6">
          {Object.entries(groupedByRound).map(([roundName, matchesInRound]) => (
            <div key={roundName} className="space-y-2.5">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800/40 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800/60">
                <span className="uppercase tracking-wider">{roundName}</span>
                <span className="text-[11px] font-medium text-slate-500">
                  {matchesInRound.length} {matchesInRound.length === 1 ? 'partido' : 'partidos'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {matchesInRound.map(match => {
                  const isCompleted = match.status === 'completed';
                  const homeWon = isCompleted && Number(match.homeScore) > Number(match.awayScore);
                  const awayWon = isCompleted && Number(match.awayScore) > Number(match.homeScore);

                  return (
                    <article key={match.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
                      {/* Top status */}
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 font-medium text-[11px]">{match.date || 'Fecha a confirmar'}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCompleted ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          }`}>
                            {isCompleted ? 'Finalizado' : 'Próximo'}
                          </span>
                          {isEditing && (
                            <button type="button" onClick={() => onRemove(match.id)} className="rounded p-1 text-red-400 hover:bg-red-500/10 transition" title="Eliminar partido">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Teams & Score Row */}
                      <div className="space-y-2 py-1">
                        {/* Local */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={getTeamLogo(match.homeTeam)} alt="" className="w-6 h-6 object-contain shrink-0" onError={e => { e.currentTarget.src = DEFAULT_LOGO; }} />
                            {isEditing ? (
                              <TeamSelect value={match.homeTeam || ''} onChange={val => onUpdate(match.id, 'homeTeam', val)} className="w-full px-2 py-1 text-xs" />
                            ) : (
                              <span className={`text-sm truncate ${homeWon ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                {match.homeTeam || 'Local'}
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <input type="number" value={match.homeScore ?? ''} onChange={e => onUpdate(match.id, 'homeScore', e.target.value)} className="w-10 h-7 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1 text-center text-sm font-bold text-slate-900 dark:text-white" />
                          ) : isCompleted && (
                            <span className={`text-base font-bold font-mono tabular-nums ${homeWon ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                              {match.homeScore ?? 0}
                            </span>
                          )}
                        </div>

                        {/* Visitante */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={getTeamLogo(match.awayTeam)} alt="" className="w-6 h-6 object-contain shrink-0" onError={e => { e.currentTarget.src = DEFAULT_LOGO; }} />
                            {isEditing ? (
                              <TeamSelect value={match.awayTeam || ''} onChange={val => onUpdate(match.id, 'awayTeam', val)} className="w-full px-2 py-1 text-xs" />
                            ) : (
                              <span className={`text-sm truncate ${awayWon ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                {match.awayTeam || 'Visitante'}
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <input type="number" value={match.awayScore ?? ''} onChange={e => onUpdate(match.id, 'awayScore', e.target.value)} className="w-10 h-7 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1 text-center text-sm font-bold text-slate-900 dark:text-white" />
                          ) : isCompleted && (
                            <span className={`text-base font-bold font-mono tabular-nums ${awayWon ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                              {match.awayScore ?? 0}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Goalscorers & Meta */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                        {match.homeGoals || match.awayGoals ? (
                          <div className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-400">
                            <span>⚽</span>
                            <span className="truncate">{match.homeGoals || match.awayGoals}</span>
                          </div>
                        ) : (
                          <span className="italic text-[10px]">Sin goles registrados</span>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          {match.mvp && (
                            <span className="text-amber-600 dark:text-amber-300 font-semibold text-[10px]">
                              MVP: {match.mvp}
                            </span>
                          )}
                          {match.homeConfirmed && match.awayConfirmed && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                              ✓ Confirmado
                            </span>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                          <input type="date" value={match.date || ''} onChange={event => onUpdate(match.id, 'date', event.target.value)} className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-900 dark:text-white" />
                          <input value={match.mvp || ''} onChange={event => onUpdate(match.id, 'mvp', event.target.value)} placeholder="MVP" className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-900 dark:text-white" />
                          <select value={match.status || 'scheduled'} onChange={event => onUpdate(match.id, 'status', event.target.value)} className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-900 dark:text-white col-span-2">
                            <option value="scheduled">Próximo</option>
                            <option value="completed">Finalizado</option>
                          </select>
                          <input value={match.homeGoals || ''} onChange={event => onUpdate(match.id, 'homeGoals', event.target.value)} placeholder="Goleadores local (ej. Mbappé 34')" className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-900 dark:text-white" />
                          <input value={match.awayGoals || ''} onChange={event => onUpdate(match.id, 'awayGoals', event.target.value)} placeholder="Goleadores visita (ej. Rodri 78')" className="rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-slate-900 dark:text-white" />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
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
          <div className="flex flex-wrap justify-between items-center px-4 py-3 bg-white/95 dark:bg-[#0c1017]/95 backdrop-blur border-b border-slate-200 dark:border-white/10 shrink-0 gap-3">
            <div className="flex items-center gap-2.5">
              <img src={DEFAULT_LOGO} className="w-7 h-7 object-contain" alt="Logo" onError={(e) => e.target.style.display = 'none'} />
              <span className="font-bold text-slate-900 dark:text-white tracking-wide text-sm">Torneo SCL</span>
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <TournamentTabButton id="matches" label="Partidos" icon={CalendarDays} activeTab={activeTab} onClick={setActiveTab} />
              <TournamentTabButton id="groups" label="Tabla" icon={LayoutGrid} activeTab={activeTab} onClick={setActiveTab} />
              <TournamentTabButton id="bracket" label="Brackets" icon={Trophy} activeTab={activeTab} onClick={setActiveTab} />
              {isAdmin && <TournamentTabButton id="repechaje" label="Plata (Admin)" icon={ShieldAlert} activeTab={activeTab} onClick={setActiveTab} />}
              {isAdmin && <TournamentTabButton id="stats" label="Goleadores (Admin)" icon={Star} activeTab={activeTab} onClick={setActiveTab} />}
            </div>
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
                <TournamentActionButton tone="green" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
                  {isEditing ? <><Save className="w-4 h-4 mr-2" /> Guardar</> : <><Edit2 className="w-4 h-4 mr-2" /> Editar</>}
                </TournamentActionButton>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 transition" title="Cerrar"><X size={20} /></button>
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
              <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-start pt-8' : 'py-2'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="TABLA GENERAL" compact={isObsMode} />
                <div className={`w-full ${isObsMode ? 'max-w-[1640px] px-12 mt-1' : 'max-w-5xl px-2 sm:px-4 mt-2'}`}>
                  <TournamentPanel title="Clasificación" className="[&>div:last-child]:p-0">
                    <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[620px]">
                      <thead className={`bg-slate-100 dark:bg-black/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800 ${isObsMode ? 'text-sm' : 'text-xs'}`}>
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className={isObsMode ? 'px-6 py-2' : 'px-4 py-2.5'}>Club</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">PJ</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">G</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">GP</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">P</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">GF</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">GC</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-2.5">DG</th>
                          <th className={`${isObsMode ? 'px-6 py-2' : 'px-4 py-2.5'} text-right text-slate-900 dark:text-white font-bold w-14 sm:w-16`}>PTS</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y divide-slate-200/80 dark:divide-slate-800 font-medium ${isObsMode ? 'text-base' : 'text-xs sm:text-sm'}`}>
                        {(isEditing ? localData.league : localData.league.filter(team => team.name && team.name !== 'Club...')).map((team, idx) => {
                          const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                          const isTop4 = idx < 4;
                          const isBottom3 = idx >= 9;
                          const qualificationBorder = isTop4 ? 'border-l-[3px] border-emerald-500' : isBottom3 ? 'border-l-[3px] border-rose-500' : 'border-l-[3px] border-transparent';
                          const rowHighlightClass = isCurrentUser ? 'bg-sky-500/10 dark:bg-cyan-500/15' : 'hover:bg-slate-50 dark:hover:bg-white/5';
                          const numberColor = isTop4 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : isBottom3 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400 font-medium';

                          return (
                          <tr key={team.id || idx} className={`${qualificationBorder} ${rowHighlightClass} transition-colors h-11 text-slate-800 dark:text-slate-200`}>
                            <td className={`text-center text-xs font-mono tabular-nums ${numberColor}`}>
                              {idx + 1}
                            </td>
                            <td className={`flex items-center ${isObsMode ? 'gap-4 px-6 py-1.5' : 'gap-2.5 sm:gap-3 px-3 sm:px-4 py-2'}`}>
                              <img src={getTeamLogo(team.name)} className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0" onError={(e) => { e.target.src = DEFAULT_LOGO; }} />
                              {isEditing ? (
                                <TeamSelect value={team.name === 'Club...' ? '' : team.name} onChange={(value) => updateLeagueTeam(idx, 'name', value)} className="w-full px-2 py-1 text-xs" />
                              ) : (
                                <span className={`whitespace-nowrap font-semibold text-xs sm:text-sm ${isTop4 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {team.name}
                                </span>
                              )}
                            </td>
                            <td className="px-2 text-center text-slate-500 tabular-nums">{team.pj}</td>
                            <td className="px-2 text-center font-semibold tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center text-xs" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} /> : team.pg}</td>
                            <td className="px-2 text-center text-slate-500 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center text-xs" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} /> : team.gpen}</td>
                            <td className="px-2 text-center text-slate-500 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center text-xs" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} /> : team.pp}</td>
                            <td className="px-2 text-center text-slate-500 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center text-xs" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} /> : team.gf}</td>
                            <td className="px-2 text-center text-slate-500 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded text-center text-xs" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} /> : team.gc}</td>
                            <td className="px-2 text-center font-semibold tabular-nums">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                            <td className={`${isObsMode ? 'px-6 text-lg' : 'px-4 text-sm sm:text-base'} text-right font-bold text-slate-900 dark:text-white tabular-nums`}>{team.pts}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    {!isEditing && localData.league.filter(team => team.name && team.name !== 'Club...').length === 0 && (
                      <div className="p-10 text-center border-t border-slate-800">
                        <p className="text-lg font-bold text-white uppercase tracking-wide">Sin tabla cargada</p>
                        <p className="text-xs text-slate-500 mt-2">Carga equipos desde el panel del torneo</p>
                      </div>
                    )}
                  </TournamentPanel>
                </div>
              </div>
            )}

            {activeTab === 'bracket' && (
              <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full' : 'py-4 w-full'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="ELIMINATORIAS ORO" />
                <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-16 mt-8' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar'}`}>
                  <div className={`${isObsMode ? 'flex items-center justify-center gap-16' : 'min-w-[1300px] flex items-center justify-center gap-10 sm:gap-14 py-4 px-6 mx-auto'}`}>
                    {/* LEFT QUARTERS */}
                    <BracketPair matchTop={localData.bracket.quarters[0]} matchBottom={localData.bracket.quarters[1]} stage="quarters" idxTop={0} idxBottom={1} side="left" isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                    {/* LEFT SEMI */}
                    <div className="flex flex-col items-center justify-center z-10 relative">
                      <MatchCard match={localData.bracket.semis[0]} stage="semis" index={0} isEditing={isEditing} updateMatch={updateGeneric} getTeamLogo={getTeamLogo} />
                      <div className={`absolute top-1/2 w-16 h-1 bg-slate-600/50 -z-10 -right-16`}></div>
                    </div>
                    {/* FINAL */}
                    <div className="flex flex-col items-center justify-center z-20 px-4 relative -mt-6">
                      <div className="flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <Crown className="w-4 h-4" />
                        <span>Gran Final</span>
                      </div>
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
              </div>
            )}

            {activeTab === 'repechaje' && (
              <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full w-full' : 'py-4 w-full'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="COPA DE PLATA" />
                <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-24 mt-12' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar'}`}>
                  <div className={`${isObsMode ? 'flex items-center justify-center gap-24' : 'min-w-[1400px] flex items-center justify-center gap-12 sm:gap-16 py-4 px-6 mx-auto'}`}>
                    <SilverBranch side="left" matchesR1={[localData.bracket.repechaje.r1[0], localData.bracket.repechaje.r1[1]]} matchR2={localData.bracket.repechaje.r2[0]} matchSemi={localData.bracket.repechaje.semis[0]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                    <div className="flex flex-col items-center z-20 px-4 -mt-6">
                      <div className="flex items-center gap-2 px-3 py-1 mb-3 rounded-full bg-slate-500/10 dark:bg-slate-400/10 border border-slate-400/30 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                        <Trophy className="w-4 h-4 text-slate-400" />
                        <span>Final Copa de Plata</span>
                      </div>
                      <MatchCard match={localData.bracket.repechaje.final} stage="rep_final" index={0} isFinal={true} isEditing={isEditing} updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'final'], i, f, v)} getTeamLogo={getTeamLogo} />
                    </div>
                    <SilverBranch side="right" matchesR1={[localData.bracket.repechaje.r1[2], localData.bracket.repechaje.r1[3]]} matchR2={localData.bracket.repechaje.r2[1]} matchSemi={localData.bracket.repechaje.semis[1]} isEditing={isEditing} updateGeneric={updateGeneric} getTeamLogo={getTeamLogo} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-center scale-100 px-20' : 'max-w-5xl mx-auto py-4 px-4'}`}>
                <TournamentSectionTitle title="LÍDERES INDIVIDUALES" subtitle="ESTADÍSTICAS DEL TORNEO" />
                <div className={`w-full ${isObsMode ? 'grid grid-cols-2 gap-12 max-w-[1500px] mt-8' : 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-4'}`}>
                  {/* GOLEADORES */}
                  <div className="bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                           <Trophy className="w-4 h-4" />
                         </div>
                         <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Máximos Goleadores</h3>
                       </div>
                       <span className="text-xs text-slate-400 font-medium">Goles</span>
                    </div>
                    <div className="p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
                      {localData.topScorers.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-amber-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-amber-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                               {idx + 1}
                             </div>
                             {player.team && (
                               <img src={getTeamLogo(player.team)} className="w-6 h-6 object-contain" onError={(e) => { e.target.src = DEFAULT_LOGO; }} alt="" />
                             )}
                             <div className="flex flex-col min-w-0">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topScorers', idx, 'name', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 mb-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topScorers', idx, 'team', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name || '—'}</span>
                                   <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{player.team || 'Sin equipo'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-2 pl-3">
                             {isEditing ? (
                               <input type="number" value={player.goals} onChange={e => updateStat('topScorers', idx, 'goals', e.target.value)} className="w-14 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 text-center font-bold text-base rounded p-1 border border-sky-300 dark:border-sky-800" />
                             ) : (
                               <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-sky-600 dark:text-sky-400 tabular-nums">
                                 {player.goals || 0}
                               </div>
                             )}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ASISTIDORES */}
                  <div className="bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                           <Star className="w-4 h-4" />
                         </div>
                         <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Máximos Asistidores</h3>
                       </div>
                       <span className="text-xs text-slate-400 font-medium">Asist</span>
                    </div>
                    <div className="p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
                      {localData.topAssisters.map((player, idx) => (
                        <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-emerald-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-emerald-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                               {idx + 1}
                             </div>
                             {player.team && (
                               <img src={getTeamLogo(player.team)} className="w-6 h-6 object-contain" onError={(e) => { e.target.src = DEFAULT_LOGO; }} alt="" />
                             )}
                             <div className="flex flex-col min-w-0">
                               {isEditing ? (
                                 <>
                                   <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topAssisters', idx, 'name', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 mb-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                                   <input placeholder="Club" value={player.team} onChange={e => updateStat('topAssisters', idx, 'team', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                                 </>
                               ) : (
                                 <>
                                   <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name || '—'}</span>
                                   <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{player.team || 'Sin equipo'}</span>
                                 </>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-2 pl-3">
                             {isEditing ? (
                               <input type="number" value={player.assists} onChange={e => updateStat('topAssisters', idx, 'assists', e.target.value)} className="w-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-center font-bold text-base rounded p-1 border border-emerald-300 dark:border-emerald-800" />
                             ) : (
                               <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                                 {player.assists || 0}
                               </div>
                             )}
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
