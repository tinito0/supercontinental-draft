import React, { useState, useMemo, memo } from 'react';
import { CalendarDays, Trash2, Goal, Star, Check } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { TournamentActionButton, TournamentPanel, TournamentSectionTitle } from '../TournamentUI.jsx';
import { TeamSelect } from './TournamentTeamsContext.jsx';
import { hasScore } from '../../utils/bracketModel.js';
import { leagueMatchOutcome } from '../../utils/competitionRules.js';
import { formatFixtureDate } from '../../utils/leagueFixtures.js';
import { Disclosure } from '../pes/PesUi.jsx';
import { FromGameLock, FromGameNote, isFromGame } from './FromGame.jsx';

// El motor (tournamentEngine.js) lee "Nombre" o "Nombre x2" separados por coma; un minuto ("23'") quedaría
// como parte del nombre y partiría al goleador en dos filas.
const SCORERS_HINT = 'Separá con comas; "x2" para dobletes. Ej.: Haaland x2, Foden';

const MANUAL_FIELDS = ['mvp', 'homeGoals', 'awayGoals', 'homeAssists', 'awayAssists'];
const EDIT_FIELDS = [
  { field: 'homeGoals', label: 'Goles local', placeholder: 'Haaland x2, Foden' },
  { field: 'awayGoals', label: 'Goles visitante', placeholder: 'Mbappé, Vini Jr.' },
  { field: 'homeAssists', label: 'Asistencias local', placeholder: 'De Bruyne x2' },
  { field: 'awayAssists', label: 'Asistencias visitante', placeholder: 'Bellingham' },
];

export const MatchCenter = memo(function MatchCenter({
  matches,
  isEditing,
  onUpdate,
  onAdd,
  onRemove,
  getTeamLogo,
  isObsMode = false,
  isAdmin = false,
  redoRound = null,
  onDrawRoundOne = null,
  importPanel = null,
}) {
  const [selectedRound, setSelectedRound] = useState('all');
  // Partidos del juego que el admin desbloqueó para corregir a mano en esta edición.
  const [unlockedIds, setUnlockedIds] = useState(() => new Set());
  const unlock = id => setUnlockedIds(prev => new Set(prev).add(id));

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

      {/* Selector de Jornadas estilo SofaScore (no en OBS: ahí nadie puede tocarlo) */}
      {!isObsMode && (
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
          <div className="flex flex-wrap gap-2">
            {/* Las fechas 2 a 4 se arman solas al guardar; esto aparece solo si una fecha generada se borró. */}
            {redoRound && (
              <TournamentActionButton tone="blue" onClick={redoRound.onClick}>
                Rehacer {redoRound.round}
              </TournamentActionButton>
            )}
            <TournamentActionButton tone="slate" onClick={onAdd}
              title="Para cargar un partido a mano, por ejemplo si el sistema suizo no pudo armar una fecha">
              Agregar partido a mano
            </TournamentActionButton>
          </div>
        )}
      </div>
      )}

      {!isObsMode && importPanel}

      {orderedMatches.length === 0 ? (
        <TournamentPanel title="Próximos partidos" icon={CalendarDays} compact>
          <div className="py-16 text-center text-ink-3 flex flex-col items-center justify-center">
            <CalendarDays className="w-10 h-10 text-ink-3 mb-3" />
            <p className="font-bold text-ink text-base">Todavía no hay partidos</p>
            <p className="text-xs text-ink-3 mt-1 max-w-sm">
              {isAdmin && onDrawRoundOne
                ? 'La Fecha 1 sale de un sorteo entre los clubes de la tabla. Ves los cruces antes de aceptarlos y se publican al guardar.'
                : 'Los cruces aparecen acá cuando se sortee la Fecha 1.'}
            </p>
            {isAdmin && onDrawRoundOne && (
              <button type="button" className="btn btn-primary btn-sm min-h-11 mt-4" onClick={onDrawRoundOne}>Sortear Fecha 1</button>
            )}
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
                  // Finalizado sin los dos marcadores: el motor no lo cuenta en la tabla, avisarlo al editar.
                  const isMissingScore = isCompleted && (!hasScore(match.homeScore) || !hasScore(match.awayScore));
                  // Reglamento 2/1/0: un empate se define por penales (competitionRules.leagueMatchOutcome).
                  const outcome = leagueMatchOutcome(match);
                  const homeWon = isCompleted && outcome.ok && outcome.winner === 'home';
                  const awayWon = isCompleted && outcome.ok && outcome.winner === 'away';
                  const isDraw = hasScore(match.homeScore) && hasScore(match.awayScore) && Number(match.homeScore) === Number(match.awayScore);
                  const isMissingShootout = isCompleted && isDraw && !outcome.ok;
                  const fromGame = isFromGame(match);
                  const isLocked = isEditing && fromGame && !unlockedIds.has(match.id);
                  // Marcador, equipos, tanda y goleadores: editables salvo en un partido del juego bloqueado.
                  const canEditResult = isEditing && !isLocked;
                  const hasManualStats = MANUAL_FIELDS.some(field => match[field]);

                  return (
                    <article
                      key={match.id}
                      className="rounded-xl border border-line/[0.12] bg-surface p-3.5 shadow-md transition-colors hover:border-white/[0.18]"
                    >
                      {/* Top status */}
                      <div className="mb-2.5 flex items-center justify-between gap-2 text-xs border-b border-line/[0.08] pb-2">
                        <span className="flex items-center gap-2 min-w-0 text-ink-3 font-medium text-[11px]">
                          <span className="truncate">{formatFixtureDate(match) || 'Fecha a confirmar'}</span>
                          {fromGame && <FromGameNote />}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              isCompleted
                                ? 'bg-success/15 text-success-soft border border-success/30'
                                : match.status === 'postponed'
                                  ? 'bg-raised text-ink-2 border border-line/30'
                                  : 'bg-warning/15 text-warning-soft border border-warning/30'
                            }`}
                          >
                            {isCompleted ? 'FINALIZADO' : match.status === 'postponed' ? 'POSTERGADO' : 'PROGRAMADO'}
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
                              className="w-6 h-6 object-contain shrink-0"
                              onError={e => { e.currentTarget.src = DEFAULT_LOGO; }}
                            />
                            {canEditResult ? (
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
                          {canEditResult ? (
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              aria-label={`Goles de ${match.homeTeam || 'local'}`}
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
                              className="w-6 h-6 object-contain shrink-0"
                              onError={e => { e.currentTarget.src = DEFAULT_LOGO; }}
                            />
                            {canEditResult ? (
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
                          {canEditResult ? (
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              aria-label={`Goles de ${match.awayTeam || 'visitante'}`}
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

                      {!canEditResult && isCompleted && outcome.ok && outcome.decidedBy === 'shootout' && (
                        <p className="text-right text-[11px] font-semibold text-ink-3 tabular-nums">
                          Penales {match.homePenalties}-{match.awayPenalties}
                        </p>
                      )}
                      {canEditResult && isDraw && (
                        <div className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-xs text-ink-3">
                          <span>Empate: penales</span>
                          <span className="flex items-center gap-1.5">
                            {[['homePenalties', match.homeTeam || 'local'], ['awayPenalties', match.awayTeam || 'visitante']].map(([field, team]) => (
                              <input
                                key={field}
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={match[field] ?? ''}
                                aria-label={`Penales de ${team}`}
                                onChange={e => onUpdate(match.id, field, e.target.value)}
                                className="w-10 h-7 rounded-lg border border-white/20 bg-black/50 px-1 text-center text-sm font-bold text-ink outline-none"
                              />
                            ))}
                          </span>
                        </div>
                      )}

                      {/* Goalscorers & Meta */}
                      <div className="mt-2.5 pt-2 border-t border-line/[0.08] text-[11px] text-ink-3 flex flex-wrap items-center justify-between gap-2">
                        {match.homeGoals || match.awayGoals ? (
                          <div className="flex items-center gap-1.5 min-w-0 text-ink-2">
                            <Goal className="w-3.5 h-3.5 shrink-0" aria-label="Goles" />
                            <span className="truncate" title={[match.homeGoals, match.awayGoals].filter(Boolean).join(' · ')}>
                              {[match.homeGoals, match.awayGoals].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        ) : (
                          <span className="italic text-[11px] text-ink-3">Sin goles registrados</span>
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

                      {isLocked && <FromGameLock onUnlock={() => unlock(match.id)} />}

                      {/* Formulario de edición: agenda siempre; goleadores y MVP a mano, plegados (los trae el colector). */}
                      {canEditResult && isMissingShootout && (
                        <p role="alert" className="mt-2 text-[11px] text-warning-soft">
                          Empate sin la tanda: suma el partido y los goles, pero no los puntos, hasta cargar los penales.
                        </p>
                      )}
                      {canEditResult && isMissingScore && (
                        <p role="alert" className="mt-2 text-[11px] text-warning-soft">
                          Marcado como finalizado sin marcador completo: no suma a la tabla hasta cargar los dos resultados.
                        </p>
                      )}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-line/[0.12] grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[11px] text-ink-3 font-bold block mb-1">Fecha</label>
                            <input
                              type="date"
                              value={match.date || ''}
                              onChange={event => onUpdate(match.id, 'date', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-ink-3 font-bold block mb-1">Hora</label>
                            <input
                              type="time"
                              value={match.time || ''}
                              onChange={event => onUpdate(match.id, 'time', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-ink-3 font-bold block mb-1">Jornada</label>
                            <input
                              type="text"
                              value={match.round || ''}
                              placeholder="Ej. Fecha 1"
                              onChange={event => onUpdate(match.id, 'round', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-ink-3 font-bold block mb-1">Estado</label>
                            <select
                              value={match.status || 'scheduled'}
                              disabled={isLocked}
                              onChange={event => onUpdate(match.id, 'status', event.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                            >
                              <option value="scheduled">Programado</option>
                              <option value="postponed">Postergado</option>
                              <option value="completed">Finalizado</option>
                            </select>
                          </div>
                          {canEditResult && (
                            <Disclosure
                              className="col-span-2"
                              summaryClassName="text-[11px] font-bold text-ink-3"
                              summary="Goleadores, asistencias y MVP a mano"
                              defaultOpen={hasManualStats && !fromGame}
                            >
                              <div className="grid grid-cols-2 gap-2 pb-1">
                                <div>
                                  <label className="text-[11px] text-ink-3 font-bold block mb-1">MVP</label>
                                  <input
                                    value={match.mvp || ''}
                                    onChange={event => onUpdate(match.id, 'mvp', event.target.value)}
                                    placeholder="Jugador MVP"
                                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                                  />
                                </div>
                                {EDIT_FIELDS.map(({ field, label, placeholder }) => (
                                  <label key={field} className="block">
                                    <span className="text-[11px] text-ink-3 font-bold block mb-1">{label}</span>
                                    <input
                                      value={match[field] || ''}
                                      onChange={event => onUpdate(match.id, field, event.target.value)}
                                      placeholder={placeholder}
                                      className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-ink outline-none"
                                    />
                                  </label>
                                ))}
                                <p className="col-span-2 text-[11px] text-ink-3">{SCORERS_HINT}</p>
                              </div>
                            </Disclosure>
                          )}
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
