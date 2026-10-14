import React, { memo, useState, useEffect, useMemo } from 'react';
import { ArrowUpDown, LayoutGrid, List as ListIcon, Search, SlidersHorizontal, Star, X } from 'lucide-react';

const SEARCH_DEBOUNCE_MS = 300;

/** Active filters as removable chips (label + how to clear it). */
function buildChips(filters, setFilters, clearSearch) {
  const chips = [];
  const clear = patch => () => setFilters(prev => ({ ...prev, ...patch }));
  if (filters.name) chips.push({ id: 'name', label: `«${filters.name}»`, onRemove: clearSearch });
  if (filters.ovrMin || filters.ovrMax) chips.push({ id: 'ovr', label: `OVR ${filters.ovrMin || '0'}–${filters.ovrMax || '99'}`, onRemove: clear({ ovrMin: '', ovrMax: '' }) });
  if (filters.ageMin || filters.ageMax) chips.push({ id: 'age', label: `Edad ${filters.ageMin || '15'}–${filters.ageMax || '45'}`, onRemove: clear({ ageMin: '', ageMax: '' }) });
  if (filters.priceMin || filters.priceMax) chips.push({ id: 'price', label: `Precio $${filters.priceMin || '0'}M–${filters.priceMax || '∞'}M`, onRemove: clear({ priceMin: '', priceMax: '' }) });
  if (filters.pos) chips.push({ id: 'pos', label: `Posición ${filters.pos}`, onRemove: clear({ pos: '' }) });
  if (filters.foot) chips.push({ id: 'foot', label: `Pie ${filters.foot}`, onRemove: clear({ foot: '' }) });
  if (filters.country) chips.push({ id: 'country', label: `País ${filters.country}`, onRemove: clear({ country: '' }) });
  if (filters.region) chips.push({ id: 'region', label: `Región ${filters.region}`, onRemove: clear({ region: '' }) });
  if (filters.playingStyle) chips.push({ id: 'style', label: `Estilo ${filters.playingStyle}`, onRemove: clear({ playingStyle: '' }) });
  Object.entries(filters.grupos || {}).forEach(([group, enabled]) => {
    if (enabled) chips.push({ id: `grupo-${group}`, label: group, onRemove: () => setFilters(prev => ({ ...prev, grupos: { ...prev.grupos, [group]: false } })) });
  });
  if (filters.wishlistOnly) chips.push({ id: 'wishlist', label: 'Solo favoritos', onRemove: clear({ wishlistOnly: false }) });
  return chips;
}

export function countActiveFilters(filters) {
  let count = 0;
  ['ovrMin', 'ovrMax', 'ageMin', 'ageMax', 'priceMin', 'priceMax', 'pos', 'foot', 'country', 'region', 'playingStyle'].forEach(k => { if (filters[k]) count++; });
  Object.values(filters.grupos || {}).forEach(v => { if (v) count++; });
  Object.values(filters.skills || {}).forEach(v => { if (v) count++; });
  Object.values(filters.detailedStats || {}).forEach(v => { if (v) count++; });
  return count;
}

/**
 * Marketplace toolbar. Typing only updates the local text and, after a pause, filters.name: it never
 * clears the search, opens/closes the filters dialog or navigates (the clear button is type="button",
 * so Enter submits the form instead of "clicking" it).
 */
export const SearchBar = memo(function SearchBar({
  filters, setFilters, resetFilters, setIsFiltrosModalVisible, sortConfig, setSortConfig,
  viewMode, setViewMode, gridColumns, setGridColumns,
  resultCount, totalCount
}) {
  const [inputValue, setInputValue] = useState(filters.name || '');

  // Sync the text only when filters.name changes from outside (chip removed, filters reset).
  useEffect(() => {
    setInputValue(filters.name || '');
  }, [filters.name]);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if ((filters.name || '') === trimmed) return undefined;
    const timer = setTimeout(() => setFilters(prev => ({ ...prev, name: trimmed })), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue, filters.name, setFilters]);

  const triggerSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
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

  const activeChips = useMemo(() => buildChips(filters, setFilters, handleClearSearch), [filters, setFilters]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const currentSortValue = `${sortConfig.key}-${sortConfig.direction}`;

  return (
    <div data-app-tour="search" className="flex flex-col gap-3 mb-5">
      <form onSubmit={triggerSearch} role="search" className="flex flex-col md:flex-row gap-2 md:gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            enterKeyHint="search"
            placeholder="Buscar por nombre…"
            aria-label="Buscar jugadores por nombre"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            className="input min-h-12 pl-11 pr-11 text-base"
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
        </div>

        <div className="grid grid-cols-3 md:flex gap-2">
          <button type="submit" className="btn btn-primary min-h-12 px-2 sm:px-4">
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />Buscar
          </button>
          <button
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, wishlistOnly: !prev.wishlistOnly }))}
            aria-pressed={Boolean(filters.wishlistOnly)}
            className={`btn min-h-12 px-2 sm:px-4 ${filters.wishlistOnly ? 'bg-warning/[0.12] text-warning-soft border border-warning/30 hover:bg-warning/20' : 'btn-secondary'}`}
          >
            <Star className="w-4 h-4 shrink-0" fill={filters.wishlistOnly ? 'currentColor' : 'none'} aria-hidden="true" />Favoritos
          </button>
          <button type="button" data-app-tour="filters" onClick={() => setIsFiltrosModalVisible(true)} className="btn btn-secondary min-h-12 px-2 sm:px-4">
            <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />Filtros
            {activeFilterCount > 0 && (
              <span className="num min-w-5 h-5 px-1.5 rounded-full bg-accent text-on-accent text-[11px] font-bold flex items-center justify-center" aria-label={`${activeFilterCount} activos`}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </form>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {activeChips.map(chip => (
            <span key={chip.id} className="chip pr-1">
              {chip.label}
              <button type="button" onClick={chip.onRemove} aria-label={`Quitar filtro ${chip.label}`} title="Quitar este filtro"
                className="w-6 h-6 rounded flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10 transition-colors">
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          {resetFilters && (
            <button type="button" onClick={resetFilters} className="btn btn-ghost btn-sm text-danger-soft hover:text-danger-soft">Limpiar todo</button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-app-tour="sort" className="relative w-full sm:w-auto">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none z-[1]" aria-hidden="true" />
          <select value={currentSortValue} onChange={handleSortChange} aria-label="Ordenar jugadores por" className="select pl-9 sm:w-64 font-semibold">
            <option value="ovr-desc">Media: mayor a menor</option>
            <option value="ovr-asc">Media: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="nombre-asc">Nombre (A–Z)</option>
            <option value="edad-asc">Edad: más joven primero</option>
            <option value="edad-desc">Edad: más grande primero</option>
          </select>
        </div>

        <p className="text-sm text-ink-3 order-last w-full sm:order-none sm:w-auto" aria-live="polite">
          {totalCount === 0
            ? 'No se encontraron jugadores.'
            : resultCount < totalCount
              ? <>Mostrando <span className="num font-semibold text-ink">{resultCount}</span> de <span className="num font-semibold text-ink">{totalCount}</span> jugadores</>
              : <><span className="num font-semibold text-ink">{totalCount}</span> jugadores</>}
        </p>

        <div data-app-tour="view" className="tab-list ml-auto sm:ml-0">
          <button type="button" onClick={() => setViewMode('list')} aria-label="Vista de lista" title="Vista de lista" aria-pressed={viewMode === 'list'} className="tab min-w-9 justify-center">
            <ListIcon className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setViewMode('grid')} aria-label="Vista de cuadrícula" title="Vista de cuadrícula" aria-pressed={viewMode === 'grid'} className="tab min-w-9 justify-center">
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          </button>
          {viewMode === 'grid' && (
            <span className="flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-line/15" role="group" aria-label="Cantidad de columnas">
              {[2, 3, 4, 6].map(cols => (
                <button key={cols} type="button" onClick={() => setGridColumns(cols)} aria-label={`Mostrar ${cols} columnas`} aria-pressed={gridColumns === cols}
                  className={`${cols === 2 ? '' : cols === 3 ? 'hidden sm:inline-flex' : cols === 4 ? 'hidden md:inline-flex' : 'hidden xl:inline-flex'} tab min-w-8 justify-center num`}>
                  {cols}
                </button>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
