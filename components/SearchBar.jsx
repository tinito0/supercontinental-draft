import React, { memo, useState, useEffect, useMemo } from 'react';
import {
  ArrowUpWideNarrow, LayoutGrid, List as ListIcon, Search, SlidersHorizontal, Star, X, Filter
} from 'lucide-react';

export const SearchBar = memo(function SearchBar({
  filters, setFilters, resetFilters, setIsFiltrosModalVisible, sortConfig, setSortConfig,
  viewMode, setViewMode, gridColumns, setGridColumns,
  resultCount, totalCount
}) {
  const [inputValue, setInputValue] = useState(filters.name || '');

  // Sincronizar input solo si filters.name cambia externamente
  useEffect(() => {
    setInputValue(filters.name || '');
  }, [filters.name]);

  // Solo ejecuta la búsqueda cuando el usuario presiona Enter o hace clic en "Buscar"
  const triggerSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if ((filters.name || '') !== inputValue.trim()) {
      setFilters(prev => ({ ...prev, name: inputValue.trim() }));
    }
  };

  const handleClearSearch = () => {
    setInputValue('');
    if (filters.name) {
      setFilters(prev => ({ ...prev, name: '' }));
    }
  };

  const handleSortChange = (event) => {
    const [key, direction] = event.target.value.split('-');
    setSortConfig({ key, direction });
  };

  // Generación de chips de filtros activos para descarte rápido
  const activeChips = useMemo(() => {
    const chips = [];
    if (filters.name) {
      chips.push({
        id: 'name',
        label: `"${filters.name}"`,
        onRemove: handleClearSearch
      });
    }
    if (filters.ovrMin || filters.ovrMax) {
      chips.push({
        id: 'ovr',
        label: `OVR: ${filters.ovrMin || '0'}-${filters.ovrMax || '99'}`,
        onRemove: () => setFilters(prev => ({ ...prev, ovrMin: '', ovrMax: '' }))
      });
    }
    if (filters.ageMin || filters.ageMax) {
      chips.push({
        id: 'age',
        label: `Edad: ${filters.ageMin || '15'}-${filters.ageMax || '45'}`,
        onRemove: () => setFilters(prev => ({ ...prev, ageMin: '', ageMax: '' }))
      });
    }
    if (filters.priceMin || filters.priceMax) {
      chips.push({
        id: 'price',
        label: `Precio: $${filters.priceMin || '0'}M-${filters.priceMax || '∞'}M`,
        onRemove: () => setFilters(prev => ({ ...prev, priceMin: '', priceMax: '' }))
      });
    }
    if (filters.pos) {
      chips.push({
        id: 'pos',
        label: `Pos: ${filters.pos}`,
        onRemove: () => setFilters(prev => ({ ...prev, pos: '' }))
      });
    }
    if (filters.foot) {
      chips.push({
        id: 'foot',
        label: `Pie: ${filters.foot}`,
        onRemove: () => setFilters(prev => ({ ...prev, foot: '' }))
      });
    }
    if (filters.country) {
      chips.push({
        id: 'country',
        label: `País: ${filters.country}`,
        onRemove: () => setFilters(prev => ({ ...prev, country: '' }))
      });
    }
    if (filters.region) {
      chips.push({
        id: 'region',
        label: `Región: ${filters.region}`,
        onRemove: () => setFilters(prev => ({ ...prev, region: '' }))
      });
    }
    if (filters.playingStyle) {
      chips.push({
        id: 'style',
        label: `Estilo: ${filters.playingStyle}`,
        onRemove: () => setFilters(prev => ({ ...prev, playingStyle: '' }))
      });
    }
    Object.entries(filters.grupos || {}).forEach(([group, enabled]) => {
      if (enabled) {
        chips.push({
          id: `grupo-${group}`,
          label: group,
          onRemove: () => setFilters(prev => ({ ...prev, grupos: { ...prev.grupos, [group]: false } }))
        });
      }
    });
    if (filters.wishlistOnly) {
      chips.push({
        id: 'wishlist',
        label: '⭐ Favoritos',
        onRemove: () => setFilters(prev => ({ ...prev, wishlistOnly: false }))
      });
    }
    return chips;
  }, [filters, setFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    const directKeys = ['ovrMin', 'ovrMax', 'ageMin', 'ageMax', 'priceMin', 'priceMax', 'pos', 'foot', 'country', 'region', 'playingStyle'];
    directKeys.forEach(k => { if (filters[k]) count++; });
    Object.values(filters.grupos || {}).forEach(v => { if (v) count++; });
    Object.values(filters.skills || {}).forEach(v => { if (v) count++; });
    Object.values(filters.detailedStats || {}).forEach(v => { if (v) count++; });
    return count;
  }, [filters]);

  const currentSortValue = `${sortConfig.key}-${sortConfig.direction}`;
  const softControl = 'bg-white dark:bg-[#0c1017] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111722] border border-slate-200 dark:border-white/[0.08]';
  const activeControl = 'bg-sky-600 dark:bg-[#00b4d8] text-white dark:text-[#030712] font-bold shadow-sm';

  return (
    <div data-app-tour="search" className="flex flex-col space-y-3 mb-6">
      <form onSubmit={triggerSearch} className="flex flex-col md:flex-row md:space-x-4 space-y-3 md:space-y-0">
        <div className="flex-grow relative">
          <input
            type="text"
            enterKeyHint="search"
            placeholder="Buscar por nombre..."
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            className="w-full min-h-12 pl-10 pr-10 py-2.5 bg-white dark:bg-[#0c1017] text-slate-900 dark:text-white rounded-xl text-base outline-none border border-slate-200 dark:border-white/[0.08] focus:border-sky-500 dark:focus:border-[#00b4d8] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors shadow-sm"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
          {inputValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              title="Borrar texto de búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 md:gap-4">
          <button 
            type="submit" 
            className="min-h-12 flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-sky-600 dark:bg-[#00b4d8] text-white dark:text-[#030712] font-bold rounded-xl hover:bg-sky-500 dark:hover:bg-[#38bdf8] transition shadow-md active:scale-95 text-sm cursor-pointer"
          >
            <Search className="w-4 h-4 mr-1.5" /> Buscar
          </button>

          <button
            type="button"
            onClick={() => {
              setFilters(prev => ({ ...prev, wishlistOnly: !prev.wishlistOnly }));
            }}
            className={`min-h-12 flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 font-bold rounded-xl transition active:scale-95 text-sm cursor-pointer ${
              filters.wishlistOnly
                ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-300 border border-yellow-500/30'
                : softControl
            }`}
          >
            <Star className="w-4 h-4 mr-1.5" fill={filters.wishlistOnly ? 'currentColor' : 'none'} /> Favoritos
          </button>

          <button 
            type="button" 
            data-app-tour="filters" 
            onClick={() => setIsFiltrosModalVisible(true)} 
            className={`min-h-12 flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 font-bold rounded-xl transition active:scale-95 text-sm cursor-pointer ${softControl}`}
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5 text-sky-600 dark:text-[#00b4d8]" /> 
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-sky-600 dark:bg-[#00b4d8] text-white dark:text-[#030712] font-bold text-[10px] rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </form>

      {/* ── CHIPS DE FILTROS ACTIVOS ── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 py-1 px-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-sky-600 dark:text-[#00b4d8]" /> Filtros activos:
          </span>
          {activeChips.map(chip => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#111722] border border-slate-200 dark:border-[#00b4d8]/25 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition cursor-pointer"
                title="Quitar este filtro"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {resetFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 font-bold ml-1.5 transition cursor-pointer hover:underline"
            >
              Limpiar todos
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white dark:bg-[#0c1017] p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <div data-app-tour="sort" className="relative w-full lg:w-auto">
          <select value={currentSortValue} onChange={handleSortChange} className={`appearance-none w-full lg:w-64 min-h-10 px-4 py-2 pl-10 rounded-lg transition outline-none focus:border-sky-500 dark:focus:border-[#00b4d8] text-sm font-semibold cursor-pointer ${softControl}`}>
            <option value="ovr-desc">Media (Mayor a Menor)</option>
            <option value="ovr-asc">Media (Menor a Mayor)</option>
            <option value="precio-desc">Precio (Mayor a Menor)</option>
            <option value="precio-asc">Precio (Menor a Mayor)</option>
            <option value="nombre-asc">Nombre (A-Z)</option>
            <option value="edad-asc">Edad (Joven a Viejo)</option>
            <option value="edad-desc">Edad (Viejo a Joven)</option>
          </select>
          <ArrowUpWideNarrow className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm font-medium text-center lg:text-left px-2">
          <span>
            {totalCount === 0
              ? 'No se encontraron jugadores.'
              : resultCount < totalCount
                ? <>Mostrando <span className="text-sky-600 dark:text-[#00b4d8] font-bold">{resultCount}</span> de <span className="text-slate-900 dark:text-white font-bold">{totalCount}</span> jugadores</>
                : <>Mostrando <span className="text-slate-900 dark:text-white font-bold">{totalCount}</span> jugadores</>
            }
          </span>
        </div>

        <div data-app-tour="view" className={`flex items-center space-x-1.5 rounded-lg p-1 ${softControl}`}>
          <button onClick={() => setViewMode('list')} className={`min-w-9 min-h-9 p-2 rounded-md transition cursor-pointer ${viewMode === 'list' ? activeControl : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'}`} title="Vista de Lista">
            <ListIcon size={18} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`min-w-9 min-h-9 p-2 rounded-md transition cursor-pointer ${viewMode === 'grid' ? activeControl : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'}`} title="Vista de Cuadrícula">
            <LayoutGrid size={18} />
          </button>

          {viewMode === 'grid' && (
            <div className="flex items-center pl-2 space-x-1 border-l border-slate-200 dark:border-white/10">
              {[2, 3, 4, 6].map(cols => (
                <button
                  key={cols}
                  onClick={() => setGridColumns(cols)}
                  className={`${cols === 2 ? '' : cols === 3 ? 'hidden sm:block' : cols === 4 ? 'hidden md:block' : 'hidden xl:block'} min-w-8 min-h-8 px-2 py-1 text-xs font-bold rounded transition cursor-pointer ${
                    gridColumns === cols ? 'bg-sky-600 dark:bg-[#00b4d8] text-white dark:text-[#030712]' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {cols}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
