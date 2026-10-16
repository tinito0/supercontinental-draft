import React from 'react';
import { X } from 'lucide-react';

/** Removable chips for the active filters (utils/marketFilters.js), plus an optional "clear all" button. */
export function ActiveFilterChips({ chips, setFilters, onClearAll, className = '' }) {
  if (chips.length === 0) return null;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Filtros activos">
      {chips.map(chip => (
        <li key={chip.id} className="chip pr-1">
          {chip.label}
          <button type="button" onClick={() => setFilters(chip.clear)} aria-label={`Quitar filtro ${chip.label}`} title="Quitar este filtro"
            className="w-6 h-6 rounded flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10 transition-colors">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
      {onClearAll && (
        <li>
          <button type="button" onClick={onClearAll} className="btn btn-ghost btn-sm text-danger-soft hover:text-danger-soft">Limpiar filtros</button>
        </li>
      )}
    </ul>
  );
}
