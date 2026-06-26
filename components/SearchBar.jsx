import React, { memo, useState } from 'react';
import {
  ArrowUpWideNarrow, LayoutGrid, List as ListIcon, Search, SlidersHorizontal, Star
} from 'lucide-react';

export const SearchBar = memo(function SearchBar({
  filters, setFilters, applyFilters, setIsFiltrosModalVisible, sortConfig, setSortConfig,
  viewMode, setViewMode, gridColumns, setGridColumns,
  resultCount, totalCount
}) {
  const [inputValue, setInputValue] = useState(filters.name);

  const triggerSearch = () => {
    setFilters(prev => ({ ...prev, name: inputValue }));
    applyFilters();
  };

  const handleSortChange = (event) => {
    const [key, direction] = event.target.value.split('-');
    setSortConfig({ key, direction });
  };

  const currentSortValue = `${sortConfig.key}-${sortConfig.direction}`;
  const softControl = 'bg-[#172230] text-gray-100 hover:bg-[#1d2a3a] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]';
  const activeControl = 'bg-blue-600 text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]';

  return (
    <div data-app-tour="search" className="flex flex-col space-y-3 mb-6">
      <div className="flex flex-col md:flex-row md:space-x-4 space-y-3 md:space-y-0">
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') triggerSearch(); }}
            className="w-full min-h-12 pl-10 pr-4 py-2.5 bg-[#111923] text-white rounded-xl text-base outline-none shadow-[inset_0_0_0_1px_rgba(34,211,238,0.10)] focus:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.42),0_0_0_3px_rgba(34,211,238,0.08)] placeholder:text-gray-500"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
        </div>

        <div className="flex gap-2 md:gap-4">
          <button onClick={triggerSearch} className="min-h-12 flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition shadow-[0_10px_24px_rgba(37,99,235,0.18)] active:scale-95 text-sm">
            <Search className="w-4 h-4 mr-1.5" /> Buscar
          </button>

          <button
            onClick={() => {
              setFilters(prev => ({ ...prev, wishlistOnly: !prev.wishlistOnly }));
              setTimeout(applyFilters, 0);
            }}
            className={`min-h-12 flex-1 md:flex-none flex items-center justify-center px-4 py-2.5 font-bold rounded-xl transition active:scale-95 text-sm ${
              filters.wishlistOnly
                ? 'bg-yellow-500/18 text-yellow-300 shadow-[inset_0_0_0_1px_rgba(234,179,8,0.22)]'
                : softControl
            }`}
          >
            <Star className="w-4 h-4 mr-1.5" fill={filters.wishlistOnly ? 'currentColor' : 'none'} /> Favoritos
          </button>

          <button data-app-tour="filters" onClick={() => setIsFiltrosModalVisible(true)} className={`min-h-12 flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 font-bold rounded-xl transition active:scale-95 text-sm ${softControl}`}>
            <SlidersHorizontal className="w-4 h-4 mr-1.5" /> Filtros
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#0f1419] p-2 rounded-xl shadow-[inset_0_0_0_1px_rgba(34,211,238,0.045)]">
        <div data-app-tour="sort" className="relative w-full lg:w-auto">
          <select value={currentSortValue} onChange={handleSortChange} className={`appearance-none w-full lg:w-64 min-h-10 px-4 py-2 pl-10 rounded-lg transition outline-none focus:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.34)] text-sm font-semibold ${softControl}`}>
            <option value="ovr-desc">Media (Mayor a Menor)</option>
            <option value="ovr-asc">Media (Menor a Mayor)</option>
            <option value="precio-desc">Precio (Mayor a Menor)</option>
            <option value="precio-asc">Precio (Menor a Mayor)</option>
            <option value="nombre-asc">Nombre (A-Z)</option>
            <option value="edad-asc">Edad (Joven a Viejo)</option>
            <option value="edad-desc">Edad (Viejo a Joven)</option>
          </select>
          <ArrowUpWideNarrow className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="flex items-center gap-4 text-gray-400 text-sm font-medium text-center lg:text-left px-2">
          <span>
            {resultCount === 0
              ? 'No se encontraron jugadores.'
              : <>Mostrando <span className="text-white font-bold">{resultCount}</span> de {totalCount}</>
            }
          </span>
        </div>

        <div data-app-tour="view" className={`flex items-center space-x-2 rounded-lg p-1 ${softControl}`}>
          <button onClick={() => setViewMode('list')} className={`min-w-9 min-h-9 p-2 rounded-md transition ${viewMode === 'list' ? activeControl : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`} title="Vista de Lista">
            <ListIcon size={18} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`min-w-9 min-h-9 p-2 rounded-md transition ${viewMode === 'grid' ? activeControl : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`} title="Vista de Cuadrícula">
            <LayoutGrid size={18} />
          </button>

          {viewMode === 'grid' && (
            <div className="flex items-center pl-2 space-x-1 shadow-[-1px_0_0_rgba(34,211,238,0.08)]">
              {[2, 3, 4, 6].map(cols => (
                <button
                  key={cols}
                  onClick={() => setGridColumns(cols)}
                  className={`${cols === 2 ? '' : cols === 3 ? 'hidden sm:block' : cols === 4 ? 'hidden md:block' : 'hidden xl:block'} min-w-8 min-h-8 px-2 py-1 text-xs font-bold rounded transition ${
                    gridColumns === cols ? 'bg-blue-600/70 text-white' : 'text-gray-400 hover:bg-white/[0.04]'
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
