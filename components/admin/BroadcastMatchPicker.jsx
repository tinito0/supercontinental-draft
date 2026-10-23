import React, { memo, useMemo, useState } from 'react';
import { CalendarDays, Radio, Search, X } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import {
  BROADCAST_SOURCES,
  BROADCAST_SOURCE_LABELS,
  filterBroadcastMatches,
  formatRoundLabel,
  resolveTeamId,
  sortBroadcastMatches,
} from '../../utils/broadcastMatches.js';

const STATUS_FILTERS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'completed', label: 'Finalizados' },
  { id: 'all', label: 'Todos' },
];

export function teamLogoFor(name, allTeams) {
  const id = resolveTeamId(name, allTeams);
  return (id && allTeams?.[id]?.logoUrl) || DEFAULT_LOGO;
}

function TeamCell({ name, allTeams, align = 'left' }) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <img
        src={teamLogoFor(name, allTeams)}
        alt=""
        width={28}
        height={28}
        className="w-7 h-7 object-contain shrink-0"
        onError={event => { event.currentTarget.src = DEFAULT_LOGO; }}
      />
      <span className={`truncate text-sm font-semibold ${name ? 'text-ink' : 'text-ink-3 italic font-medium'}`} title={name || undefined}>
        {name || 'A definir'}
      </span>
    </div>
  );
}

const MatchRow = memo(function MatchRow({ match, isOnAir, isBusy, isDisabled, allTeams, onSelect }) {
  const scoreText = match.isCompleted ? `${match.homeScore} – ${match.awayScore}` : 'vs';
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 transition-colors ${
        isOnAir ? 'border-accent bg-accent-deep/60' : 'border-line/[0.12] bg-raised/40 hover:border-line/25'
      }`}
      aria-current={isOnAir ? 'true' : undefined}
    >
      <div className="col-span-2 sm:col-span-4 flex items-center justify-between gap-2 text-xs text-ink-3">
        <span className="truncate">{formatRoundLabel(match)}{match.date ? ` · ${match.date}` : ''}</span>
        <span className={match.isCompleted ? 'text-success-soft font-semibold' : 'text-ink-3'}>
          {match.isCompleted ? 'Finalizado' : 'Pendiente'}
        </span>
      </div>
      <TeamCell name={match.homeTeam} allTeams={allTeams} />
      <span className={`font-display num text-lg font-bold text-center min-w-12 sm:order-none ${match.isCompleted ? 'text-ink' : 'text-ink-3'}`}>
        {scoreText}
      </span>
      <div className="min-w-0 sm:order-none"><TeamCell name={match.awayTeam} allTeams={allTeams} align="right" /></div>
      <div className="flex justify-end">
        {isOnAir ? (
          <span className="inline-flex items-center gap-1.5 min-h-11 px-3 text-xs font-bold uppercase tracking-wider text-accent-soft">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            Elegido
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm min-h-11"
            onClick={() => onSelect(match)}
            disabled={isDisabled}
            title={isDisabled ? 'Esperá a que termine el cambio en curso' : 'Lo pone en el borrador de la escena; llega a OBS al mandarla al aire'}
          >
            <Radio className="w-4 h-4" aria-hidden="true" />
            {isBusy ? 'Eligiendo…' : 'Elegir'}
          </button>
        )}
      </div>
    </li>
  );
});

/**
 * Lista de partidos (liga + Copa de Oro + Copa de Plata) para elegir cuál muestra el marcador de OBS.
 * Elegir un partido solo cambia el overlay; los resultados del torneo se editan en Torneo › Editar.
 */
export const BroadcastMatchPicker = memo(function BroadcastMatchPicker({
  matches,
  activeMatchId,
  busyMatchId,
  allTeams,
  isTournamentLoaded,
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('pending');
  const [source, setSource] = useState('all');

  const visible = useMemo(
    () => sortBroadcastMatches(filterBroadcastMatches(matches, { query, status, source })),
    [matches, query, status, source],
  );
  const availableSources = useMemo(
    () => Object.values(BROADCAST_SOURCES).filter(id => matches.some(match => match.source === id)),
    [matches],
  );

  if (!isTournamentLoaded) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Cargando partidos">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No hay partidos cargados"
        description="Cargá fechas en Torneo › Partidos o cruces en los brackets (botón Editar). Mientras tanto podés armar el marcador a mano abajo."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar club o fase…"
            aria-label="Buscar partido"
            className="input pl-9 pr-10"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="btn btn-ghost btn-icon btn-sm absolute right-1 top-1/2 -translate-y-1/2" aria-label="Borrar búsqueda">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="tab-list" role="group" aria-label="Estado del partido">
            {STATUS_FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                className="tab"
                aria-pressed={status === filter.id}
                onClick={() => setStatus(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {availableSources.length > 1 && (
            <select value={source} onChange={event => setSource(event.target.value)} className="select w-auto" aria-label="Competición">
              <option value="all">Todas las competiciones</option>
              {availableSources.map(id => <option key={id} value={id}>{BROADCAST_SOURCE_LABELS[id]}</option>)}
            </select>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-ink-3 text-center py-8 border border-dashed border-line/15 rounded-xl">
          Ningún partido coincide con el filtro.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[28rem] overflow-y-auto custom-scrollbar pr-1">
          {visible.map(match => (
            <MatchRow
              key={match.id}
              match={match}
              isOnAir={match.id === activeMatchId}
              isBusy={match.id === busyMatchId}
              isDisabled={Boolean(busyMatchId)}
              allTeams={allTeams}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-3">
        Mostrando <span className="num">{visible.length}</span> de <span className="num">{matches.length}</span>. Elegir un partido cambia el borrador de la escena; OBS lo muestra al mandarla al aire. Nunca cambia el resultado en el torneo.
      </p>
    </div>
  );
});

export default BroadcastMatchPicker;
