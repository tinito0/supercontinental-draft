import React from 'react';
import { SearchInput } from '../PesUi.jsx';
import { PlayerPhoto } from './PesPlayerProfile.jsx';
import { getPosColorClass, getStatAndOvrColorClass } from '../../../utils/helpers.js';

/**
 * Searchable player list with photos. `results`: [{ id, name, src: 'bin'|'edit', pos?, ovr? }].
 * On phones the list is a collapsible block above the profile; from lg it is a sticky column.
 */
export function PesPlayerList({ total, results, query, onQuery, selectedId, onSelect, truncated }) {
  return (
    <section className="panel-flat p-3 lg:sticky lg:top-4 lg:self-start" aria-label="Lista de jugadores">
      <div className="flex items-baseline justify-between gap-2 px-1 mb-2">
        <h2 className="section-title">Jugadores</h2>
        <span className="num text-xs text-ink-3">{total.toLocaleString('es-AR')}</span>
      </div>
      <SearchInput value={query} onChange={onQuery} placeholder="Nombre o id" label="Buscar jugador por nombre o id" />
      <ul className="mt-2 max-h-[45vh] lg:max-h-[calc(100vh-15rem)] overflow-y-auto overscroll-contain -mx-1 px-1">
        {results.map(p => {
          const selected = p.id === selectedId;
          return (
            <li key={`${p.src}-${p.id}`}>
              <button type="button" onClick={() => onSelect(p.id)} aria-current={selected ? 'true' : undefined}
                className={`w-full flex items-center gap-3 min-h-12 px-2 py-1.5 rounded-lg text-left transition-colors
                  ${selected ? 'bg-accent/15 text-ink' : 'text-ink-2 hover:bg-white/[0.04] hover:text-ink'}`}>
                <PlayerPhoto id={p.id} className="w-9 h-9 rounded-lg shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name || `Jugador ${p.id}`}</span>
                  <span className="block text-[11px] text-ink-3">
                    <span className="num">{p.id}</span>{p.src === 'edit' && ' · editado en el EDIT'}
                  </span>
                </span>
                {p.pos && <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${getPosColorClass(p.pos)}`}>{p.pos}</span>}
                {p.ovr > 0 && <span className={`shrink-0 w-8 text-center rounded font-display num text-sm font-bold ${getStatAndOvrColorClass(p.ovr)}`}>{p.ovr}</span>}
              </button>
            </li>
          );
        })}
        {results.length === 0 && <li className="px-2 py-6 text-center text-sm text-ink-3">Ningún jugador coincide con «{query}».</li>}
      </ul>
      {truncated && <p className="px-1 pt-2 text-[11px] text-ink-3">Se muestran los primeros resultados: escribí más letras para acotar.</p>}
    </section>
  );
}
