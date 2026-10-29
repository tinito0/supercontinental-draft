import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Tabs } from '../../ui/Tabs.jsx';
import { SearchInput, Pill } from '../PesUi.jsx';
import { filterTeams, TEAM_SORTS } from '../../../pes/teamView.js';
import { TeamBadge } from './TeamBadge.jsx';

const LIMIT = 200;
const ANNOUNCE_DELAY_MS = 600;

const FILTERS = {
  all: () => true,
  league: r => r.inLeague,
  unsaved: r => r.unsaved > 0,
  modified: r => r.modified,
};

/** The result count, announced once typing pauses (not on every keystroke). */
function useDebounced(value, delay) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setShown(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return shown;
}

function SkeletonRows() {
  return (
    <ul className="space-y-1" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 min-h-11">
          <span className="skeleton w-8 h-8" />
          <span className="flex-1 space-y-1.5"><span className="skeleton block h-3 w-3/4" /><span className="skeleton block h-2.5 w-1/2" /></span>
        </li>
      ))}
    </ul>
  );
}

function RowState({ row, kitManager }) {
  if (row.unsaved > 0) return <Pill tone="amber">sin guardar</Pill>;
  if (kitManager && !row.inLeague) {
    return <span className="inline-flex items-center gap-1 text-xs text-ink-3"><Lock className="w-3 h-3" aria-hidden="true" />solo lectura</span>;
  }
  return null;
}

/** Master list of the team workspace: search, filter, sort and one row per team. */
export function TeamList({ rows, loading, selectedId, onSelect, hasLeague, kitManager, query, onQuery, filter, onFilter, sort, onSort }) {
  const selectedRef = useRef(null);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, fn]) => [k, rows.filter(fn).length])), [rows]);
  const visible = useMemo(
    () => filterTeams(rows.filter(FILTERS[filter] || FILTERS.all), query).sort(TEAM_SORTS[sort] || TEAM_SORTS.name),
    [rows, filter, query, sort],
  );
  const shown = visible.slice(0, LIMIT);
  const countText = visible.length > LIMIT
    ? `Mostrando ${LIMIT} de ${visible.length} · refiná la búsqueda`
    : `${visible.length} equipo${visible.length === 1 ? '' : 's'}`;
  const announced = useDebounced(countText, ANNOUNCE_DELAY_MS);

  // Opening a team from the URL: bring its row into view without moving the page more than needed.
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [selectedId, loading]);

  const filterTabs = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'league', label: 'Liga', count: counts.league, hidden: !hasLeague },
    { id: 'unsaved', label: 'Sin guardar', count: counts.unsaved },
    { id: 'modified', label: 'Modificados', count: counts.modified },
  ];

  return (
    <nav aria-label="Equipos" className="panel-flat flex flex-col min-w-0 min-h-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]">
      <div className="p-3 space-y-2 border-b border-line/[0.1]">
        <SearchInput value={query} onChange={onQuery} placeholder="Nombre, abreviatura o id" label="Buscar equipo" />
        <Tabs tabs={filterTabs} value={filter} onChange={onFilter} label="Filtrar equipos" size="sm" className="flex flex-wrap w-full" />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-3" aria-hidden="true">{countText}</p>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            Orden
            <select value={sort} onChange={e => onSort(e.target.value)} className="select py-1 text-xs w-auto">
              <option value="name">Nombre</option>
              <option value="id">Id</option>
            </select>
          </label>
        </div>
        <p className="sr-only" role="status">{loading ? '' : announced}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
        {loading ? <SkeletonRows /> : shown.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-ink-3">
            <p>Ningún equipo coincide.</p>
            {(query || filter !== 'all') && (
              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => { onQuery(''); onFilter('all'); }}>Limpiar búsqueda</button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map(r => {
              const selected = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button type="button" ref={selected ? selectedRef : undefined} onClick={() => onSelect(r.id)} aria-current={selected || undefined}
                    className={`w-full flex items-center gap-3 min-h-11 px-3 py-1.5 rounded-lg text-left transition-colors ${selected ? 'bg-accent-deep text-ink' : 'text-ink-2 hover:bg-overlay hover:text-ink'}`}>
                    <TeamBadge abbr={r.abbr} colours={r.colours} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold" title={r.name}>{r.name || '(sin nombre)'}</span>
                      <span className="block truncate text-xs text-ink-3">
                        <span className="num">{r.id}</span> · {r.national ? 'Selección' : 'Club'} · <span className="num">{r.players}</span> jug.
                      </span>
                    </span>
                    <RowState row={r} kitManager={kitManager} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}
