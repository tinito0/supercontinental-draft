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
    <select
      value={currentValue}
      onChange={event => onChange(event.target.value)}
      className={`bg-[#0c1017] text-white rounded-lg border border-white/10 px-2 py-1 outline-none focus:border-[#00b4d8] text-xs transition-colors ${className}`}
    >
      <option value="">Seleccionar club...</option>
      {hasCurrentValue && <option value={currentValue}>{currentValue}</option>}
      {teams.map(team => <option key={team.id} value={team.name}>{team.name}</option>)}
    </select>
  );
});

const MatchCard = memo(({ match, stage, index, isFinal, isEditing, updateMatch, getTeamLogo, titleOverride, seedA, seedB }) => {
  if (!match) {
    return (
      <div className="w-[240px] sm:w-[260px] h-24 bg-[#0c1017]/80 border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 font-medium text-xs rounded-xl p-3 shadow-sm">
        <span className="text-[11px] font-semibold text-slate-400">Por definir</span>
        <span className="text-[9px] text-slate-600 mt-0.5">Cruce pendiente</span>
      </div>
    );
  }

  let cardTitle = titleOverride || "";
  if (!cardTitle) {
    if (isFinal) cardTitle = "GRAN FINAL";
    else if (stage === 'semis') cardTitle = `SEMIFINAL ${index + 1}`;
    else if (stage === 'quarters') cardTitle = `CUARTOS ${index + 1}`;
    else if (stage === 'rep_r1') cardTitle = `PRELIMINAR ${index + 1}`;
    else if (stage === 'rep_r2') cardTitle = `CUARTOS PLATA ${index + 1}`;
    else if (stage === 'rep_semis') cardTitle = `SEMIFINAL PLATA ${index + 1}`;
    else if (stage === 'rep_final') cardTitle = "GRAN FINAL PLATA";
  }

  const hasScoreA = match.scoreA !== '' && match.scoreA !== undefined && match.scoreA !== null;
  const hasScoreB = match.scoreB !== '' && match.scoreB !== undefined && match.scoreB !== null;
  const isCompleted = hasScoreA && hasScoreB;
  const numA = parseInt(match.scoreA) || 0;
  const numB = parseInt(match.scoreB) || 0;
  const teamAWon = isCompleted && numA > numB;
  const teamBWon = isCompleted && numB > numA;

  return (
    <div
      className={`w-[240px] sm:w-[260px] rounded-xl overflow-hidden bg-[#0c1017] border transition-all duration-200 shadow-md ${
        isFinal
          ? 'border-amber-500/60 shadow-[0_0_24px_rgba(245,158,11,0.14)] ring-1 ring-amber-500/30'
          : 'border-white/[0.08] hover:border-white/[0.18]'
      }`}
    >
      {/* Top Header Bar */}
      <div className={`px-3 py-1.5 flex items-center justify-between border-b text-[10px] font-bold uppercase tracking-wider ${
        isFinal
          ? 'bg-amber-950/40 text-amber-300 border-amber-500/30'
          : 'bg-[#111722] text-slate-400 border-white/[0.06]'
      }`}>
        <div className="flex items-center gap-1.5 truncate">
          {isFinal && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <span className="truncate">{cardTitle}</span>
        </div>
        <div>
          {isCompleted ? (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              FIN
            </span>
          ) : (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-white/[0.04] text-slate-500">
              PEND
            </span>
          )}
        </div>
      </div>

      {/* Teams Body */}
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {[
          { key: 'teamA', scoreKey: 'scoreA', isWinner: teamAWon, isLoser: teamBWon, seed: seedA },
          { key: 'teamB', scoreKey: 'scoreB', isWinner: teamBWon, isLoser: teamAWon, seed: seedB },
        ].map(({ key, scoreKey, isWinner, isLoser, seed }) => {
          const name = match[key];
          const score = match[scoreKey];
          const logo = getTeamLogo ? getTeamLogo(name) : DEFAULT_LOGO;

          return (
            <div
              key={key}
              className={`flex items-center justify-between px-3 py-2 transition-colors ${
                isWinner ? 'bg-emerald-500/[0.08]' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isWinner ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-transparent shrink-0" />
                )}
                {seed && (
                  <span className="text-[10px] text-slate-500 font-mono font-bold shrink-0">{seed}</span>
                )}
                <img
                  src={logo}
                  alt=""
                  className="w-5 h-5 object-contain shrink-0 drop-shadow"
                  onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }}
                />
                {isEditing ? (
                  <TeamSelect
                    value={name}
                    onChange={(value) => updateMatch(stage, index, key, value)}
                    className="w-full px-2 py-0.5 text-xs font-semibold"
                  />
                ) : (
                  <span
                    className={`text-xs truncate tracking-wide ${
                      isWinner
                        ? 'font-black text-white'
                        : isLoser
                        ? 'text-slate-400 font-medium'
                        : 'text-slate-300 font-medium'
                    }`}
                    title={name || 'A definir'}
                  >
                    {name || 'A definir'}
                  </span>
                )}
              </div>

              {isEditing ? (
                <input
                  type="number"
                  value={score ?? ''}
                  onChange={(e) => updateMatch(stage, index, scoreKey, e.target.value)}
                  className="w-8 h-6 bg-slate-900 text-center rounded text-white text-xs border border-white/20 outline-none font-bold ml-2"
                />
              ) : (
                <div
                  className={`min-w-[24px] h-6 flex items-center justify-center rounded px-1.5 ml-2 font-mono text-xs font-bold tabular-nums ${
                    isWinner
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isLoser
                      ? 'text-slate-500'
                      : 'text-slate-400'
                  }`}
                >
                  {score !== '' && score !== undefined && score !== null ? score : '-'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const BracketFork = memo(({ height = 180, tone = 'slate' }) => {
  const strokeColor = tone === 'gold' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.18)';
  return (
    <div className="w-10 shrink-0 flex items-center justify-center relative self-stretch">
      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
        <path
          d="M 0,25 H 20 V 75 H 0 M 20,50 H 40"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

const MatchCenter = memo(function MatchCenter({ matches, isEditing, onUpdate, onAdd, onRemove, getTeamLogo }) {
  const [selectedRound, setSelectedRound] = useState('all');

  const orderedMatches = useMemo(() => {
    return [...(matches || [])].sort((a, b) => {
      const aDone = a.status === 'completed';
      const bDone = b.status === 'completed';
      if (aDone !== bDone) return aDone ? 1 : -1;
      return String(a.date || '').localeCompare(String(b.date || ''));
    });
  }, [matches]);

  const allRounds = useMemo(() => {
    const rounds = new Set();
    orderedMatches.forEach(m => {
      if (m.round && m.round.trim()) rounds.add(m.round.trim());
    });
    return Array.from(rounds);
  }, [orderedMatches]);

  const filteredMatches = useMemo(() => {
    if (selectedRound === 'all') return orderedMatches;
    return orderedMatches.filter(m => (m.round || '').trim() === selectedRound);
  }, [orderedMatches, selectedRound]);

  const groupedByRound = useMemo(() => {
    return filteredMatches.reduce((acc, m) => {
      const r = m.round || 'Jornada Regular';
      if (!acc[r]) acc[r] = [];
      acc[r].push(m);
      return acc;
    }, {});
  }, [filteredMatches]);

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4">
      <TournamentSectionTitle title="CENTRO DE PARTIDOS" subtitle="AGENDA Y RESULTADOS EN VIVO" />

      {/* Selector de Jornadas estilo SofaScore */}
      <div className="flex items-center justify-between gap-3 mt-4 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedRound('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedRound === 'all'
                ? 'bg-[#00b4d8] text-black shadow-sm'
                : 'bg-[#111722] text-slate-400 hover:text-white border border-white/[0.08]'
            }`}
          >
            Todas ({orderedMatches.length})
          </button>
          {allRounds.map(round => (
            <button
              key={round}
              type="button"
              onClick={() => setSelectedRound(round)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedRound === round
                  ? 'bg-[#00b4d8] text-black shadow-sm'
                  : 'bg-[#111722] text-slate-400 hover:text-white border border-white/[0.08]'
              }`}
            >
              {round}
            </button>
          ))}
        </div>

        {isEditing && (
          <TournamentActionButton tone="green" onClick={onAdd}>
            + Agregar partido
          </TournamentActionButton>
        )}
      </div>

      {orderedMatches.length === 0 ? (
        <TournamentPanel title="Próximos partidos" icon={CalendarDays} compact>
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
            <CalendarDays className="w-10 h-10 text-slate-600 mb-3" />
            <p className="font-bold text-white text-base">Sin partidos programados</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              El administrador puede cargar las fechas, cruces y resultados desde el botón Editar.
            </p>
          </div>
        </TournamentPanel>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByRound).map(([roundName, matchesInRound]) => (
            <div key={roundName} className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 bg-[#0c1017] rounded-xl text-xs font-bold text-slate-300 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00b4d8]" />
                  <span className="uppercase tracking-wider font-black">{roundName}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {matchesInRound.length} {matchesInRound.length === 1 ? 'partido' : 'partidos'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchesInRound.map(match => {
                  const isCompleted = match.status === 'completed';
                  const homeScore = Number(match.homeScore) || 0;
                  const awayScore = Number(match.awayScore) || 0;
                  const homeWon = isCompleted && homeScore > awayScore;
                  const awayWon = isCompleted && awayScore > homeScore;

                  return (
                    <article
                      key={match.id}
                      className="rounded-xl border border-white/[0.08] bg-[#0c1017] p-3.5 shadow-md transition-all hover:border-white/[0.18]"
                    >
                      {/* Top status */}
                      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs border-b border-white/[0.06] pb-2">
                        <span className="text-slate-400 font-medium text-[11px]">
                          {match.date || 'Fecha a confirmar'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isCompleted ? 'FINALIZADO' : 'PROGRAMADO'}
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => onRemove(match.id)}
                              className="p-1 text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                              title="Eliminar partido"
                            >
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
                            <img
                              src={getTeamLogo(match.homeTeam)}
                              alt=""
                              className="w-6 h-6 object-contain shrink-0 drop-shadow"
                              onError={e => { e.currentTarget.src = DEFAULT_LOGO; }}
                            />
                            {isEditing ? (
                              <TeamSelect
                                value={match.homeTeam || ''}
                                onChange={val => onUpdate(match.id, 'homeTeam', val)}
                                className="w-full px-2 py-1 text-xs"
                              />
                            ) : (
                              <span
                                className={`text-xs sm:text-sm truncate tracking-wide ${
                                  homeWon ? 'font-black text-white' : 'font-medium text-slate-300'
                                }`}
                              >
                                {match.homeTeam || 'Local'}
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <input
                              type="number"
                              value={match.homeScore ?? ''}
                              onChange={e => onUpdate(match.id, 'homeScore', e.target.value)}
                              className="w-10 h-7 rounded-lg border border-white/20 bg-black/50 px-1 text-center text-sm font-bold text-white outline-none"
                            />
                          ) : isCompleted ? (
                            <span
                              className={`text-base font-black font-mono tabular-nums px-2 py-0.5 rounded ${
                                homeWon ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {match.homeScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs font-mono font-bold">-</span>
                          )}
                        </div>

                        {/* Visitante */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img
                              src={getTeamLogo(match.awayTeam)}
                              alt=""
                              className="w-6 h-6 object-contain shrink-0 drop-shadow"
                              onError={e => { e.currentTarget.src = DEFAULT_LOGO; }}
                            />
                            {isEditing ? (
                              <TeamSelect
                                value={match.awayTeam || ''}
                                onChange={val => onUpdate(match.id, 'awayTeam', val)}
                                className="w-full px-2 py-1 text-xs"
                              />
                            ) : (
                              <span
                                className={`text-xs sm:text-sm truncate tracking-wide ${
                                  awayWon ? 'font-black text-white' : 'font-medium text-slate-300'
                                }`}
                              >
                                {match.awayTeam || 'Visitante'}
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <input
                              type="number"
                              value={match.awayScore ?? ''}
                              onChange={e => onUpdate(match.id, 'awayScore', e.target.value)}
                              className="w-10 h-7 rounded-lg border border-white/20 bg-black/50 px-1 text-center text-sm font-bold text-white outline-none"
                            />
                          ) : isCompleted ? (
                            <span
                              className={`text-base font-black font-mono tabular-nums px-2 py-0.5 rounded ${
                                awayWon ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400'
                              }`}
                            >
                              {match.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs font-mono font-bold">-</span>
                          )}
                        </div>
                      </div>

                      {/* Goalscorers & Meta */}
                      <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                        {match.homeGoals || match.awayGoals ? (
                          <div className="flex items-center gap-1.5 truncate text-slate-300">
                            <span>⚽</span>
                            <span className="truncate">{match.homeGoals || match.awayGoals}</span>
                          </div>
                        ) : (
                          <span className="italic text-[10px] text-slate-500">Sin goles registrados</span>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          {match.mvp && (
                            <span className="text-amber-400 font-bold text-[10px] flex items-center gap-1">
                              ⭐ MVP: {match.mvp}
                            </span>
                          )}
                          {match.homeConfirmed && match.awayConfirmed && (
                            <span className="text-emerald-400 font-bold text-[10px]">
                              ✓ Confirmado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Formulario de Edición */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Fecha</label>
                            <input
                              type="date"
                              value={match.date || ''}
                              onChange={event => onUpdate(match.id, 'date', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Jornada</label>
                            <input
                              type="text"
                              value={match.round || ''}
                              placeholder="Ej. Fecha 1"
                              onChange={event => onUpdate(match.id, 'round', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Estado</label>
                            <select
                              value={match.status || 'scheduled'}
                              onChange={event => onUpdate(match.id, 'status', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            >
                              <option value="scheduled">Programado</option>
                              <option value="completed">Finalizado</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">MVP</label>
                            <input
                              value={match.mvp || ''}
                              onChange={event => onUpdate(match.id, 'mvp', event.target.value)}
                              placeholder="Jugador MVP"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Goles Local</label>
                            <input
                              value={match.homeGoals || ''}
                              onChange={event => onUpdate(match.id, 'homeGoals', event.target.value)}
                              placeholder="Ej. Haaland 23', Foden 65'"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Goles Visitante</label>
                            <input
                              value={match.awayGoals || ''}
                              onChange={event => onUpdate(match.id, 'awayGoals', event.target.value)}
                              placeholder="Ej. Mbappé 45', Vini 89'"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white outline-none"
                            />
                          </div>
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

  next.league = [...rows.values()].slice(0, 12);
  while (next.league.length < 12) {
    next.league.push({ id: crypto.randomUUID(), name: 'Club...', pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 });
  }
  next.topScorers = [...scorers.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, goals: item.value }));
  next.topAssisters = [...assisters.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 5).map(item => ({ name: item.name, team: item.team, assists: item.value }));
  while (next.topScorers.length < 5) next.topScorers.push({ name: '', team: '', goals: '' });
  while (next.topAssisters.length < 5) next.topAssisters.push({ name: '', team: '', assists: '' });
  return next;
}

export const TournamentModal = memo(function TournamentModal({ isVisible, isPage, onClose, tournamentData, isAdmin, onUpdateTournament, allTeams, initialTab = 'groups', userTeamName, allPlayers }) {
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
      if (!Array.isArray(safeData.league)) safeData.league = [];
      // STRICT 12-TEAM CAP: SuperContinental League has exactly 12 teams
      if (safeData.league.length > 12) {
        safeData.league = safeData.league.slice(0, 12);
      }
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
          <div className="flex flex-col px-4 py-3 bg-[#0c1017]/95 backdrop-blur border-b border-white/10 shrink-0 gap-3">
            {/* Fila superior: Marca + Contexto de fase + Acciones */}
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                  <img src={DEFAULT_LOGO} className="w-full h-full object-contain drop-shadow" alt="Logo" onError={(e) => e.target.style.display = 'none'} />
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
                  <TournamentActionButton tone="green" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
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
              <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-start pt-8' : 'py-2'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="TABLA GENERAL DE POSICIONES" compact={isObsMode} />
                <div className={`w-full ${isObsMode ? 'max-w-[1640px] px-12 mt-1' : 'max-w-5xl px-2 sm:px-4 mt-2'}`}>
                  <TournamentPanel title="Clasificación Oficial (12 Equipos)" className="[&>div:last-child]:p-0">
                    <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[620px]">
                      <thead className={`bg-[#111722] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] ${isObsMode ? 'text-sm' : 'text-xs'}`}>
                        <tr>
                          <th className="py-3 px-3 w-10 text-center">#</th>
                          <th className={isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'}>Club</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3">PJ</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3 text-emerald-400">G</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3 text-amber-400">GP</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3 text-rose-400">P</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3">GF</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3">GC</th>
                          <th className="px-2 text-center w-10 sm:w-12 py-3">DG</th>
                          <th className="px-2 text-center w-28 py-3">Forma</th>
                          <th className={`${isObsMode ? 'px-6 py-2.5' : 'px-4 py-3'} text-right text-white font-black w-14 sm:w-16 bg-white/[0.02]`}>PTS</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y divide-white/[0.05] font-medium ${isObsMode ? 'text-base' : 'text-xs sm:text-sm'}`}>
                        {(isEditing
                          ? localData.league
                          : localData.league.filter(team => team.name && team.name !== 'Club...')
                        ).slice(0, 12).map((team, idx) => {
                          const isCurrentUser = userTeamName && userTeamName.trim().toLowerCase() === team.name?.trim().toLowerCase();
                          const isTop4 = idx < 4;
                          const isSilver = idx >= 4 && idx < 12;
                          const qualificationBorder = isTop4 ? 'border-l-[4px] border-[#00b4d8]' : isSilver ? 'border-l-[4px] border-slate-600' : 'border-l-[4px] border-transparent';
                          const rowHighlightClass = isCurrentUser ? 'bg-[#00b4d8]/10' : 'hover:bg-white/[0.03]';
                          const numberColor = isTop4 ? 'text-[#00b4d8] font-black' : 'text-slate-400 font-bold';

                          // Derivar forma reciente (últimos 5 partidos)
                          const teamNameLower = team.name?.trim().toLowerCase();
                          const teamMatches = (localData.matches || [])
                            .filter(m => m.status === 'completed' && (
                              m.homeTeam?.trim().toLowerCase() === teamNameLower ||
                              m.awayTeam?.trim().toLowerCase() === teamNameLower
                            ));
                          const recentTeamMatches = teamMatches.slice(-5);
                          const formResults = recentTeamMatches.map(m => {
                            const isHome = m.homeTeam?.trim().toLowerCase() === teamNameLower;
                            const myScore = Number(isHome ? m.homeScore : m.awayScore) || 0;
                            const oppScore = Number(isHome ? m.awayScore : m.homeScore) || 0;
                            const oppName = isHome ? m.awayTeam : m.homeTeam;
                            if (myScore > oppScore) return { char: 'V', bg: 'bg-emerald-500 text-white', title: `Victoria vs ${oppName} (${myScore}-${oppScore})` };
                            if (myScore === oppScore) return { char: 'P', bg: 'bg-amber-500 text-slate-950 font-black', title: `Penales vs ${oppName} (${myScore}-${oppScore})` };
                            return { char: 'D', bg: 'bg-rose-500 text-white', title: `Derrota vs ${oppName} (${myScore}-${oppScore})` };
                          });

                          // Rellenar hasta 5 con puntos neutrales
                          const paddedForm = [...formResults];
                          while (paddedForm.length < 5) {
                            paddedForm.push({ char: '•', bg: 'bg-transparent text-slate-600 font-bold', title: 'Por disputar' });
                          }

                          return (
                          <tr key={team.id || idx} className={`${qualificationBorder} ${rowHighlightClass} transition-colors h-11 text-slate-200`}>
                            <td className={`text-center text-xs font-mono tabular-nums ${numberColor}`}>
                              {idx + 1}
                            </td>
                            <td className={`flex items-center ${isObsMode ? 'gap-4 px-6 py-1.5' : 'gap-2.5 sm:gap-3 px-3 sm:px-4 py-2'}`}>
                              <img
                                src={getTeamLogo(team.name)}
                                className="w-6 h-6 sm:w-7 sm:h-7 object-contain flex-shrink-0 drop-shadow"
                                onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }}
                              />
                              {isEditing ? (
                                <div className="flex items-center gap-1.5 w-full">
                                  <TeamSelect
                                    value={team.name === 'Club...' ? '' : team.name}
                                    onChange={(value) => updateLeagueTeam(idx, 'name', value)}
                                    className="w-full px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => clearLeagueSlot(idx)}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                                    title="Vaciar este lugar"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ) : (
                                <span className={`whitespace-nowrap font-bold text-xs sm:text-sm tracking-wide ${isTop4 ? 'text-white' : 'text-slate-300'}`}>
                                  {team.name}
                                </span>
                              )}
                            </td>
                            <td className="px-2 text-center text-slate-400 tabular-nums">{team.pj}</td>
                            <td className="px-2 text-center font-bold text-emerald-400 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.pg} onChange={(e) => updateLeagueTeam(idx, 'pg', e.target.value)} /> : team.pg}</td>
                            <td className="px-2 text-center font-bold text-amber-400 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gpen} onChange={(e) => updateLeagueTeam(idx, 'gpen', e.target.value)} /> : team.gpen}</td>
                            <td className="px-2 text-center font-bold text-rose-400 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.pp} onChange={(e) => updateLeagueTeam(idx, 'pp', e.target.value)} /> : team.pp}</td>
                            <td className="px-2 text-center text-slate-400 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gf} onChange={(e) => updateLeagueTeam(idx, 'gf', e.target.value)} /> : team.gf}</td>
                            <td className="px-2 text-center text-slate-400 tabular-nums">{isEditing ? <input type="number" className="w-9 bg-slate-900 border border-white/20 rounded text-center text-xs text-white" value={team.gc} onChange={(e) => updateLeagueTeam(idx, 'gc', e.target.value)} /> : team.gc}</td>
                            <td className="px-2 text-center font-semibold text-slate-300 tabular-nums">{(Number(team.gf) || 0) - (Number(team.gc) || 0)}</td>
                            <td className="px-2 py-1 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {paddedForm.map((r, rIdx) => (
                                  <span
                                    key={rIdx}
                                    title={r.title}
                                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${r.bg} shadow-sm`}
                                  >
                                    {r.char}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className={`${isObsMode ? 'px-6 text-lg' : 'px-4 text-sm sm:text-base'} text-right font-black text-white tabular-nums bg-white/[0.02]`}>{team.pts}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    {/* Leyenda SofaScore */}
                    <div className="p-3 border-t border-white/[0.06] bg-[#0c1017] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#00b4d8]" />
                          <span className="font-semibold text-slate-300">Puestos 1-4: Cuartos de Final (Oro)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                          <span className="font-semibold text-slate-300">Puestos 5-12: Repechaje (Copa de Plata)</span>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        PG = 2 pts • GPEN = 1 pt • PP = 0 pts
                      </div>
                    </div>
                  </TournamentPanel>
                </div>
              </div>
            )}

            {activeTab === 'bracket' && (
              <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full' : 'py-4 w-full'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="ELIMINATORIAS ORO" />
                <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-4 mt-6' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar'}`}>
                  <div className={`${isObsMode ? 'flex items-center justify-center' : 'min-w-[1240px] flex items-center justify-center py-4 px-6 mx-auto'}`}>
                    
                    {/* WING LEFT: Cuartos 1 y 2 */}
                    <div className="flex flex-col gap-10">
                      <MatchCard
                        match={localData.bracket.quarters[0]}
                        stage="quarters"
                        index={0}
                        seedA="1°"
                        seedB="8°"
                        titleOverride="CUARTOS 1 (1° vs 8°)"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                      <MatchCard
                        match={localData.bracket.quarters[1]}
                        stage="quarters"
                        index={1}
                        seedA="4°"
                        seedB="5°"
                        titleOverride="CUARTOS 2 (4° vs 5°)"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* SVG Fork Left to Semi 1 */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,25 H 20 V 75 H 0 M 20,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Left Semifinal */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.semis[0]}
                        stage="semis"
                        index={0}
                        titleOverride="SEMIFINAL 1"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Connector Semi 1 to Final */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(245,158,11,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* GRAN FINAL (CENTER) */}
                    <div className="flex flex-col items-center z-10 px-2">
                      <div className="flex items-center gap-2 px-3.5 py-1 mb-2.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow-lg">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        <span>Gran Final Oro</span>
                      </div>
                      <MatchCard
                        match={localData.bracket.final}
                        stage="final"
                        index={0}
                        isFinal={true}
                        titleOverride="CAMPEÓN ORO"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Connector Final to Semi 2 */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(245,158,11,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Right Semifinal */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.semis[1]}
                        stage="semis"
                        index={1}
                        titleOverride="SEMIFINAL 2"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* SVG Fork Semi 2 to Cuartos 3 y 4 (reversed) */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 40,25 H 20 V 75 H 40 M 20,50 H 0" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* WING RIGHT: Cuartos 3 y 4 */}
                    <div className="flex flex-col gap-10">
                      <MatchCard
                        match={localData.bracket.quarters[2]}
                        stage="quarters"
                        index={2}
                        seedA="2°"
                        seedB="7°"
                        titleOverride="CUARTOS 3 (2° vs 7°)"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                      <MatchCard
                        match={localData.bracket.quarters[3]}
                        stage="quarters"
                        index={3}
                        seedA="3°"
                        seedB="6°"
                        titleOverride="CUARTOS 4 (3° vs 6°)"
                        isEditing={isEditing}
                        updateMatch={updateGeneric}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                  </div>
                </div>
              </div>
            )}

            {activeTab === 'repechaje' && (
              <div className={`flex flex-col items-center justify-center ${isObsMode ? 'h-full w-full' : 'py-4 w-full'}`}>
                <TournamentSectionTitle title="SUPERCONTINENTAL LEAGUE" subtitle="COPA DE PLATA — REPECHAJE" />
                <div className={`w-full ${isObsMode ? 'flex items-center justify-center gap-4 mt-6' : 'overflow-x-auto overflow-y-visible pb-12 pt-4 custom-scrollbar'}`}>
                  <div className={`${isObsMode ? 'flex items-center justify-center' : 'min-w-[1440px] flex items-center justify-center py-4 px-6 mx-auto'}`}>
                    
                    {/* WING LEFT: Preliminares 1 y 2 */}
                    <div className="flex flex-col gap-12">
                      <MatchCard
                        match={localData.bracket.repechaje.r1[0]}
                        stage="rep_r1"
                        index={0}
                        titleOverride="PRELIMINAR 1"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                      <MatchCard
                        match={localData.bracket.repechaje.r1[1]}
                        stage="rep_r1"
                        index={1}
                        titleOverride="PRELIMINAR 2"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* SVG Fork Left to Fase Fusión 1 */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,25 H 20 V 75 H 0 M 20,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Fase Fusión 1 */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.repechaje.r2[0]}
                        stage="rep_r2"
                        index={0}
                        titleOverride="CUARTOS PLATA 1"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r2'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Line Fusión 1 to Semifinal Plata 1 */}
                    <div className="w-8 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Semifinal Plata 1 */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.repechaje.semis[0]}
                        stage="rep_semis"
                        index={0}
                        titleOverride="SEMIFINAL PLATA 1"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'semis'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Connector Semifinal Plata 1 to Final Plata */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(148,163,184,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* FINAL COPA DE PLATA (CENTER) */}
                    <div className="flex flex-col items-center z-10 px-2">
                      <div className="flex items-center gap-2 px-3.5 py-1 mb-2.5 rounded-full bg-slate-800 border border-slate-600 text-slate-200 text-xs font-black uppercase tracking-wider shadow-lg">
                        <Trophy className="w-4 h-4 text-slate-400" />
                        <span>Final Copa de Plata</span>
                      </div>
                      <MatchCard
                        match={localData.bracket.repechaje.final}
                        stage="rep_final"
                        index={0}
                        isFinal={true}
                        titleOverride="CAMPEÓN PLATA"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'final'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Connector Final Plata to Semifinal Plata 2 */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(148,163,184,0.6)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Semifinal Plata 2 */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.repechaje.semis[1]}
                        stage="rep_semis"
                        index={1}
                        titleOverride="SEMIFINAL PLATA 2"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'semis'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* Line Semifinal Plata 2 to Fusión 2 */}
                    <div className="w-8 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 0,50 H 40" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Fase Fusión 2 */}
                    <div className="flex flex-col justify-center">
                      <MatchCard
                        match={localData.bracket.repechaje.r2[1]}
                        stage="rep_r2"
                        index={1}
                        titleOverride="CUARTOS PLATA 2"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r2'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

                    {/* SVG Fork Fusión 2 to Preliminares 3 y 4 (reversed) */}
                    <div className="w-10 shrink-0 self-stretch flex items-center justify-center">
                      <svg className="w-full h-full" viewBox="0 0 40 100" preserveAspectRatio="none" fill="none">
                        <path d="M 40,25 H 20 V 75 H 40 M 20,50 H 0" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* WING RIGHT: Preliminares 3 y 4 */}
                    <div className="flex flex-col gap-12">
                      <MatchCard
                        match={localData.bracket.repechaje.r1[2]}
                        stage="rep_r1"
                        index={2}
                        titleOverride="PRELIMINAR 3"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                      <MatchCard
                        match={localData.bracket.repechaje.r1[3]}
                        stage="rep_r1"
                        index={3}
                        titleOverride="PRELIMINAR 4"
                        isEditing={isEditing}
                        updateMatch={(s, i, f, v) => updateGeneric(['repechaje', 'r1'], i, f, v)}
                        getTeamLogo={getTeamLogo}
                      />
                    </div>

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
                      {localData.topScorers.map((player, idx) => {
                        const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto(player.name));

                        return (
                        <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-amber-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-amber-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                               {idx + 1}
                             </div>

                             {/* Foto del jugador con mini escudo del club */}
                             <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-sm">
                               <img
                                 src={photoUrl || `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`}
                                 alt={player.name}
                                 className="w-full h-full object-cover"
                                 onError={(e) => {
                                   e.target.onerror = null;
                                   e.target.src = `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`;
                                 }}
                               />
                               {player.team && (
                                 <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 p-0.5 border border-white/20 flex items-center justify-center">
                                   <img src={getTeamLogo(player.team)} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} alt="" />
                                 </div>
                               )}
                             </div>

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
                        );
                      })}
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
                      {localData.topAssisters.map((player, idx) => {
                        const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto(player.name));

                        return (
                        <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                           <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-emerald-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-emerald-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                               {idx + 1}
                             </div>

                             {/* Foto del jugador con mini escudo del club */}
                             <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-sm">
                               <img
                                 src={photoUrl || `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`}
                                 alt={player.name}
                                 className="w-full h-full object-cover"
                                 onError={(e) => {
                                   e.target.onerror = null;
                                   e.target.src = `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`;
                                 }}
                               />
                               {player.team && (
                                 <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 p-0.5 border border-white/20 flex items-center justify-center">
                                   <img src={getTeamLogo(player.team)} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} alt="" />
                                 </div>
                               )}
                             </div>

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
                        );
                      })}
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
