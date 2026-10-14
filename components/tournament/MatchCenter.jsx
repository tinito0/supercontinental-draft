import React, { useState, useMemo, memo } from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TournamentActionButton, TournamentPanel, TournamentSectionTitle } from '../TournamentUI.jsx';
import { TeamSelect } from './TournamentTeamsContext.jsx';

export const MatchCenter = memo(function MatchCenter({
  matches,
  isEditing,
  onUpdate,
  onAdd,
  onRemove,
  getTeamLogo,
}) {
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full custom-scrollbar -mx-2 px-2">
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
                              width={24}
                              height={24}
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
                              width={24}
                              height={24}
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

export default MatchCenter;
