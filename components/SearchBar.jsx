import React, { memo, useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, Grid3x3, LayoutGrid, List as ListIcon, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { getActiveFilterChips, countActiveFilters } from '../utils/marketFilters.js';
import { ActiveFilterChips } from './marketplace/ActiveFilterChips.jsx';

export { countActiveFilters };

const SEARCH_DEBOUNCE_MS = 300;

const VIEW_OPTIONS = [
  { id: 'list', label: 'Vista de lista', icon: ListIcon, viewMode: 'list' },
  { id: 'grid', label: 'Cuadrícula', icon: LayoutGrid, viewMode: 'grid', density: 'comfortable' },
  { id: 'compact', label: 'Cuadrícula compacta', icon: Grid3x3, viewMode: 'grid', density: 'compact' },
];

const numberFormat = new Intl.NumberFormat('es-AR');

/**
 * Marketplace toolbar. The search is live: typing updates filters.name after a pause, and Enter applies it at
 * once. Typing never clears the search, opens/closes the filters dialog or navigates (every button is
 * type="button", so Enter can only submit the search form).
 */
export const SearchBar = memo(function SearchBar({
  filters, setFilters, resetFilters, setIsFiltrosModalVisible, sortConfig, setSortConfig,
  viewMode, setViewMode, density, setDensity, totalCount,
}) {
  const [inputValue, setInputValue] = useState(filters.name || '');

  // Sync the text only when filters.name changes from outside (filters reset, saved filter loaded).
  useEffect(() => {
    setInputValue(filters.name || '');
  }, [filters.name]);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if ((filters.name || '') === trimmed) return undefined;
    const timer = setTimeout(() => setFilters(prev => ({ ...prev, name: trimmed })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, filters.name, setFilters]);

  const applySearchNow = (event) => {
    event.preventDefault();
    if ((filters.name || '') !== inputValue.trim()) setFilters(prev => ({ ...prev, name: inputValue.trim() }));
  };

  const handleClearSearch = () => {
    setInputValue('');
    if (filters.name) setFilters(prev => ({ ...prev, name: '' }));
  };

  const handleSortChange = (event) => {
    const [key, direction] = event.target.value.split('-');
    setSortConfig({ key, direction });
  };

  const chips = useMemo(() => getActiveFilterChips(filters), [filters]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const currentSortValue = `${sortConfig.key}-${sortConfig.direction}`;
  const isViewSelected = option => option.viewMode === viewMode && (viewMode === 'list' || option.density === density);

  return (
    <div data-app-tour="search"
      className="flex flex-col gap-3 mb-4 md:sticky md:-top-5 lg:-top-7 md:z-20 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 md:py-3 md:bg-canvas/95 md:backdrop-blur md:border-b md:border-line/10">
      <div className="flex flex-col md:flex-row gap-2 md:gap-3">
        <form onSubmit={applySearchNow} role="search" className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3 pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Buscar por nombre…"
            aria-label="Buscar jugadores por nombre"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            className="input min-h-12 pl-11 pr-11 text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Borrar texto de búsqueda"
              title="Borrar texto de búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-icon"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </form>

        <div className="grid grid-cols-2 md:flex gap-2">
          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, wishlistOnly: !prev.wishlistOnly }))}
            aria-pressed={Boolean(filters.wishlistOnly)}
            className={`btn min-h-12 ${filters.wishlistOnly ? 'bg-warning/[0.12] text-warning-soft border border-warning/30 hover:bg-warning/20' : 'btn-secondary'}`}
          >
            <Star className="w-4 h-4 shrink-0" fill={filters.wishlistOnly ? 'currentColor' : 'none'} aria-hidden="true" />Favoritos
          </button>
          <button type="button" data-app-tour="filters" onClick={() => setIsFiltrosModalVisible(true)} className="btn btn-secondary min-h-12">
            <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />Filtros
            {activeFilterCount > 0 && (
              <span className="num min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] font-bold flex items-center justify-center">
                {activeFilterCount}<span className="sr-only"> activos</span>
              </span>
            )}
          </button>
        </div>
      </div>

      <ActiveFilterChips chips={chips} setFilters={setFilters} onClearAll={resetFilters} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div data-app-tour="sort" className="relative flex-1 min-w-0 sm:flex-none">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none z-[1]" aria-hidden="true" />
          <select value={currentSortValue} onChange={handleSortChange} aria-label="Ordenar jugadores por" className="select pl-9 w-full sm:w-56 font-semibold">
            {/* Nombres cortos: en celular el selector comparte fila con la vista. */}
            <option value="ovr-desc">Mayor media</option>
            <option value="ovr-asc">Menor media</option>
            <option value="precio-desc">Más caros</option>
            <option value="precio-asc">Más baratos</option>
            <option value="nombre-asc">Nombre A–Z</option>
            <option value="edad-asc">Más jóvenes</option>
            <option value="edad-desc">Más grandes</option>
          </select>
        </div>

        <p className="text-sm text-ink-3 order-last w-full sm:order-none sm:w-auto" aria-live="polite">
          {totalCount === 0
            ? 'No se encontraron jugadores.'
            : <><span className="num font-semibold text-ink">{numberFormat.format(totalCount)}</span> {totalCount === 1 ? 'jugador' : 'jugadores'}</>}
        </p>

        <div data-app-tour="view" className="tab-list shrink-0" role="group" aria-label="Vista">
          {VIEW_OPTIONS.map(option => {
            const Icon = option.icon;
            return (
              <button key={option.id} type="button" title={option.label} aria-label={option.label} aria-pressed={isViewSelected(option)}
                onClick={() => { setViewMode(option.viewMode); if (option.density) setDensity(option.density); }}
                className="tab min-w-9 justify-center">
                <Icon className="w-4 h-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
