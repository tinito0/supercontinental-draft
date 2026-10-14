import React, { useState, useMemo, memo } from 'react';
import { CalendarDays, Trash2, Goal, Star, Check } from 'lucide-react';
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
                ? 'bg-accent text-black shadow-sm'
                : 'bg-raised text-ink-3 hover:text-ink border border-line/[0.12]'
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
                  ? 'bg-accent text-black shadow-sm'
                  : 'bg-raised text-ink-3 hover:text-ink border border-line/[0.12]'
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
          <div className="py-16 text-center text-ink-3 flex flex-col items-center justify-center">
            <CalendarDays className="w-10 h-10 text-ink-3 mb-3" />
            <p className="font-bold text-ink text-base">Sin partidos programados</p>
            <p className="text-xs text-ink-3 mt-1 max-w-sm">
              El administrador puede cargar las fechas, cruces y resultados desde el botón Editar.
            </p>
          </div>
        </TournamentPanel>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByRound).map(([roundName, matchesInRound]) => (
            <div key={roundName} className="space-y-3">
              <div className="flex items-center justify-between px-3 py-2 bg-surface rounded-xl text-xs font-bold text-ink-2 border border-line/[0.08]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="uppercase tracking-wider font-bold">{roundName}</span>
                </div>
                <span className="text-[11px] font-semibold text-ink-3">
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
                      className="rounded-xl border border-line/[0.12] bg-surface p-3.5 shadow-md transition-all hover:border-white/[0.18]"
                    >
                      {/* Top status */}
                      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs border-b border-line/[0.08] pb-2">
                        <span className="text-ink-3 font-medium text-[11px]">
                          {match.date || 'Fecha a confirmar'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              isCompleted
                                ? 'bg-success/15 text-success-soft border border-success/30'
                                : 'bg-warning/15 text-warning-soft border border-warning/30'
                            }`}
                          >
                            {isCompleted ? 'FINALIZADO' : 'PROGRAMADO'}
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => onRemove(match.id)}
                              className="p-1 text-danger-soft hover:bg-danger/10 rounded transition cursor-pointer"
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
                                  homeWon ? 'font-bold text-ink' : 'font-medium text-ink-2'
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
                              className="w-10 h-7 rounded-lg border border-white/20 bg-black/50 px-1 text-center text-sm font-bold text-ink outline-none"
                            />
                          ) : isCompleted ? (
                            <span
                              className={`text-base font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
                                homeWon ? 'bg-success/20 text-success-soft' : 'text-ink-3'
                              }`}
                            >
                              {match.homeScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-ink-3 text-xs font-mono font-bold">-</span>
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
                                  awayWon ? 'font-bold text-ink' : 'font-medium text-ink-2'
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
                              className="w-10 h-7 rounded-lg border border-white/20 bg-black/50 px-1 text-center text-sm font-bold text-ink outline-none"
                            />
                          ) : isCompleted ? (
                            <span
                              className={`text-base font-bold font-mono tabular-nums px-2 py-0.5 rounded ${
                                awayWon ? 'bg-success/20 text-success-soft' : 'text-ink-3'
                              }`}
                            >
                              {match.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-ink-3 text-xs font-mono font-bold">-</span>
                          )}
                        </div>
                      </div>

                      {/* Goalscorers & Meta */}
                      <div className="mt-2.5 pt-2 border-t border-line/[0.08] text-[11px] text-ink-3 flex flex-wrap items-center justify-between gap-2">
                        {match.homeGoals || match.awayGoals ? (
                          <div className="flex items-center gap-1.5 truncate text-ink-2">
                            <Goal className="w-3.5 h-3.5 shrink-0" aria-label="Goles" />
                            <span className="truncate">{match.homeGoals || match.awayGoals}</span>
                          </div>
                        ) : (
                          <span className="italic text-[10px] text-ink-3">Sin goles registrados</span>
                        )}
                        <div className="flex items-center gap-2 shrink-0">
                          {match.mvp && (
                            <span className="text-warning-soft font-semibold text-[11px] flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" aria-hidden="true" />MVP: {match.mvp}
                            </span>
                          )}
                          {match.homeConfirmed && match.awayConfirmed && (
                            <span className="text-success-soft font-semibold text-[11px] flex items-center gap-1">
                              <Check className="w-3 h-3" aria-hidden="true" />Confirmado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Formulario de Edición */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-line/[0.12] grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">Fecha</label>
                            <input
                              type="date"
                              value={match.date || ''}
                              onChange={event => onUpdate(match.id, 'date', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">Jornada</label>
                            <input
                              type="text"
                              value={match.round || ''}
                              placeholder="Ej. Fecha 1"
                              onChange={event => onUpdate(match.id, 'round', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">Estado</label>
                            <select
                              value={match.status || 'scheduled'}
                              onChange={event => onUpdate(match.id, 'status', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            >
                              <option value="scheduled">Programado</option>
                              <option value="completed">Finalizado</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">MVP</label>
                            <input
                              value={match.mvp || ''}
                              onChange={event => onUpdate(match.id, 'mvp', event.target.value)}
                              placeholder="Jugador MVP"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">Goles Local</label>
                            <input
                              value={match.homeGoals || ''}
                              onChange={event => onUpdate(match.id, 'homeGoals', event.target.value)}
                              placeholder="Ej. Haaland 23', Foden 65'"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-ink-3 font-bold uppercase block mb-1">Goles Visitante</label>
                            <input
                              value={match.awayGoals || ''}
                              onChange={event => onUpdate(match.id, 'awayGoals', event.target.value)}
                              placeholder="Ej. Mbappé 45', Vini 89'"
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
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
