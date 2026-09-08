import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Filter, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X
} from 'lucide-react';
import { addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';

const filterColors = [
  { id: 'blue', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]', dot: 'bg-blue-400' },
  { id: 'cyan', bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]', dot: 'bg-cyan-400' },
  { id: 'green', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]', dot: 'bg-emerald-400' },
  { id: 'purple', bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'shadow-[inset_0_0_0_1px_rgba(168,85,247,0.18)]', dot: 'bg-purple-400' },
  { id: 'red', bg: 'bg-red-500/15', text: 'text-red-300', border: 'shadow-[inset_0_0_0_1px_rgba(239,68,68,0.18)]', dot: 'bg-red-400' },
  { id: 'yellow', bg: 'bg-yellow-500/15', text: 'text-yellow-300', border: 'shadow-[inset_0_0_0_1px_rgba(234,179,8,0.18)]', dot: 'bg-yellow-400' },
];

const fieldLabels = {
  ovrMin: 'OVR min',
  ovrMax: 'OVR max',
  ageMin: 'Edad min',
  ageMax: 'Edad max',
  priceMin: 'Precio min',
  priceMax: 'Precio max',
  pos: 'Posición',
  foot: 'Pie',
  country: 'País',
  region: 'Región',
  playingStyle: 'Estilo',
};

function getActiveFilters(filters) {
  const active = [];
  Object.entries(fieldLabels).forEach(([key, label]) => {
    if (filters[key]) active.push(`${label}: ${filters[key]}`);
  });
  Object.entries(filters.grupos || {}).forEach(([group, enabled]) => {
    if (enabled) active.push(group);
  });
  Object.entries(filters.skills || {}).forEach(([skill, enabled]) => {
    if (enabled) active.push(PLAYER_SKILLS_MAP[skill] || skill);
  });
  Object.entries(DETAILED_STAT_KEYS).forEach(([, stats]) => {
    stats.forEach(stat => {
      const min = filters[`${stat}Min`];
      const max = filters[`${stat}Max`];
      if (min || max) {
        active.push(`${STAT_NAMES_MAP[stat] || stat}: ${min || '0'}-${max || '99'}`);
      }
    });
  });
  return active;
}

const ChipToggle = memo(function ChipToggle({ label, value, onToggle, isChecked }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(value)}
      className={`min-h-11 rounded-xl px-3 text-sm font-black transition active:scale-[0.98] ${
        isChecked
          ? 'bg-cyan-500/18 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]'
          : 'bg-[#111923] text-gray-400 hover:bg-[#172230] hover:text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.045)]'
      }`}
    >
      {label}
    </button>
  );
});

const StatRangeInput = memo(function StatRangeInput({ label, statKey, filters, onChange }) {
  return (
    <div className="rounded-xl bg-black/20 p-3 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.045)]">
      <label className="filter-label">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Mín"
          min="0"
          max="99"
          value={filters[`${statKey}Min`]}
          onChange={(e) => onChange(statKey, 'Min', e.target.value)}
          className="input-filter"
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="Máx"
          min="0"
          max="99"
          value={filters[`${statKey}Max`]}
          onChange={(e) => onChange(statKey, 'Max', e.target.value)}
          className="input-filter"
        />
      </div>
    </div>
  );
});

const FilterSection = memo(function FilterSection({ title, description, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="filter-section">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="min-h-12 w-full flex items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-sm font-black text-white uppercase tracking-wide">{title}</span>
          {description && <span className="block text-xs text-gray-500 mt-0.5">{description}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-cyan-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="pt-4">{children}</div>}
    </section>
  );
});

export const FiltrosModal = memo(function FiltrosModal({
  isVisible,
  onClose,
  filters,
  setFilters,
  applyFilters,
  resetFilters,
  uniquePositions,
  sortedCountries,
  uniquePlayingStyles,
  userId,
  getSavedFiltersCollectionRef,
  showStatusMessage,
}) {
  const [savedFilters, setSavedFilters] = useState([]);
  const [newFilterName, setNewFilterName] = useState('');
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const savingFilterRef = useRef(false);
  const activeFilters = useMemo(() => getActiveFilters(filters), [filters]);
  const visibleActiveFilters = activeFilters.slice(0, 8);

  useEffect(() => {
    if (!isVisible || !userId) return undefined;
    setIsLoadingFilters(true);
    const filtersRef = getSavedFiltersCollectionRef(userId);
    const unsubscribe = onSnapshot(filtersRef, (snapshot) => {
      const loaded = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));
      loaded.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      setSavedFilters(loaded);
      setIsLoadingFilters(false);
    }, (error) => {
      console.error('Error cargando filtros guardados:', error);
      setIsLoadingFilters(false);
    });
    return () => unsubscribe();
  }, [getSavedFiltersCollectionRef, isVisible, userId]);

  const handleSaveFilter = async () => {
    if (!newFilterName.trim() || !userId || savingFilterRef.current) return;
    savingFilterRef.current = true;
    try {
      await addDoc(getSavedFiltersCollectionRef(userId), {
        name: newFilterName.trim(),
        color: selectedColor,
        config: { ...filters },
        createdAt: new Date().toISOString(),
      });
      showStatusMessage('success', 'Filtro guardado.');
      setNewFilterName('');
    } catch (error) {
      console.error(error);
      showStatusMessage('error', 'Error al guardar.');
    } finally {
      savingFilterRef.current = false;
    }
  };

  const handleDeleteFilter = async (filterRef, event) => {
    event.stopPropagation();
    if (!window.confirm('¿Eliminar este filtro?')) return;
    try {
      await deleteDoc(filterRef);
      showStatusMessage('success', 'Filtro eliminado.');
    } catch (error) {
      console.error(error);
      showStatusMessage('error', 'Error al eliminar.');
    }
  };

  const handleNumericChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleGroupToggle = (group) => setFilters(prev => ({ ...prev, grupos: { ...prev.grupos, [group]: !prev.grupos[group] } }));
  const handleSkillToggle = (skill) => setFilters(prev => ({ ...prev, skills: { ...prev.skills, [skill]: !prev.skills[skill] } }));
  const handleStatRangeChange = (key, type, val) => setFilters(prev => ({ ...prev, [`${key}${type}`]: val }));

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        className="bg-[#08111c] sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 bg-[#09131f]/96 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_1px_0_rgba(34,211,238,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/12 flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14)]">
                  <SlidersHorizontal className="w-5 h-5 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-black text-white tracking-tight">Filtros</h2>
                  <p className="text-xs text-gray-500">Configurá tu búsqueda avanzada sin perderte en la letra chica.</p>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="min-w-11 min-h-11 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition">
              <X size={22} />
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-cyan-500/[0.045] p-3 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-cyan-200">
                <Filter className="w-4 h-4" /> {activeFilters.length} filtros activos
              </div>
              {activeFilters.length > 8 && (
                <span className="text-[11px] font-bold text-gray-500">+{activeFilters.length - 8} más</span>
              )}
            </div>
            {activeFilters.length === 0 ? (
              <p className="text-xs text-gray-500 font-semibold">Sin filtros aplicados. Elegí criterios abajo o cargá uno guardado.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {visibleActiveFilters.map(item => (
                  <span key={item} className="shrink-0 rounded-lg bg-black/25 px-2.5 py-1.5 text-[11px] font-bold text-gray-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-28 sm:pb-6">
          <FilterSection title="Filtros guardados" description={userId ? 'Cargá presets o guardá el armado actual.' : 'Iniciá sesión para guardar presets.'}>
            <div className="flex flex-wrap gap-2 min-h-11 mb-4">
              {isLoadingFilters ? (
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => <div key={i} className="w-24 h-10 rounded-xl bg-cyan-500/[0.05] animate-pulse" />)}
                </div>
              ) : savedFilters.length === 0 ? (
                <span className="text-xs text-gray-500 font-bold">No tenés filtros guardados.</span>
              ) : savedFilters.map(f => {
                const theme = filterColors.find(c => c.id === f.color) || filterColors[0];
                return (
                  <div
                    key={f.id}
                    className={`group min-h-11 flex items-center gap-1 rounded-xl pl-3 pr-1 transition hover:-translate-y-0.5 ${theme.bg} ${theme.border}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                    <button
                      type="button"
                      onClick={() => { setFilters(f.config); showStatusMessage('success', `Filtro "${f.name}" cargado.`); }}
                      className={`min-h-10 px-1 text-xs font-black ${theme.text}`}
                    >
                      {f.name}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleDeleteFilter(f.ref, event)}
                      className="min-w-8 min-h-8 rounded-lg text-white/60 hover:text-white hover:bg-black/20 flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 pt-4 shadow-[0_-1px_0_rgba(34,211,238,0.06)]">
              <input
                type="text"
                placeholder="Nombre para guardar..."
                value={newFilterName}
                onChange={e => setNewFilterName(e.target.value)}
                className="input-filter"
              />
              <div className="flex gap-2 rounded-xl bg-black/20 p-1.5 justify-center shadow-[inset_0_0_0_1px_rgba(34,211,238,0.045)]">
                {filterColors.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColor(color.id)}
                    className={`min-w-10 min-h-10 rounded-xl transition ${color.bg} ${selectedColor === color.id ? 'scale-105 shadow-[0_0_0_2px_rgba(34,211,238,0.32)]' : 'opacity-70 hover:opacity-100'}`}
                    aria-label={`Color ${color.id}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveFilter}
                disabled={!newFilterName.trim()}
                className="min-h-11 rounded-xl px-5 bg-cyan-500/16 text-cyan-200 font-black hover:bg-cyan-500/24 disabled:bg-white/[0.04] disabled:text-white/30 transition shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]"
              >
                <Save className="w-4 h-4 inline mr-2" /> Guardar
              </button>
            </div>
          </FilterSection>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 mt-5">
            <section className="lg:col-span-5 filter-section space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wide">Rangos principales</h3>
                <p className="text-xs text-gray-500 mt-0.5">Media, edad y precio del jugador.</p>
              </div>

              {[
                ['Media (OVR)', 'ovrMin', 'ovrMax', '0', '99'],
                ['Edad', 'ageMin', 'ageMax', '15', '45'],
                ['Precio ($M)', 'priceMin', 'priceMax', 'Mín', 'Máx'],
              ].map(([label, minKey, maxKey, minPlaceholder, maxPlaceholder]) => (
                <div key={label}>
                  <label className="filter-label">{label}</label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <input type="number" inputMode="numeric" placeholder={minPlaceholder} value={filters[minKey]} onChange={e => handleNumericChange(minKey, e.target.value)} className="input-filter" />
                    <span className="text-white/30 font-black">-</span>
                    <input type="number" inputMode="numeric" placeholder={maxPlaceholder} value={filters[maxKey]} onChange={e => handleNumericChange(maxKey, e.target.value)} className="input-filter" />
                  </div>
                </div>
              ))}
            </section>

            <section className="lg:col-span-7 filter-section space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wide">Identidad del jugador</h3>
                <p className="text-xs text-gray-500 mt-0.5">Posición, pie, país, región y estilo.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="filter-label">Posición</span>
                  <select value={filters.pos} onChange={e => setFilters(p => ({ ...p, pos: e.target.value }))} className="select-filter">
                    <option value="">Todas</option>
                    {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>
                  <span className="filter-label">Pie</span>
                  <select value={filters.foot} onChange={e => setFilters(p => ({ ...p, foot: e.target.value }))} className="select-filter">
                    <option value="">Cualquiera</option>
                    <option value="Derecho">Derecho</option>
                    <option value="Izquierdo">Izquierdo</option>
                  </select>
                </label>
                <label>
                  <span className="filter-label">Nacionalidad</span>
                  <span className="relative block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input type="text" placeholder="Buscar país..." value={filters.country} onChange={e => setFilters(p => ({ ...p, country: e.target.value }))} className="input-filter pl-9" />
                  </span>
                </label>
                <label>
                  <span className="filter-label">Región</span>
                  <select value={filters.region} onChange={e => setFilters(p => ({ ...p, region: e.target.value }))} className="select-filter">
                    <option value="">Todas</option>
                    {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="filter-label">Estilo de juego</span>
                  <select value={filters.playingStyle} onChange={e => setFilters(p => ({ ...p, playingStyle: e.target.value }))} className="select-filter">
                    <option value="">Cualquiera</option>
                    {uniquePlayingStyles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </section>
          </div>

          <section className="filter-section mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">Líneas del campo</h3>
              <p className="text-xs text-gray-500 mt-0.5">Filtrá por rol general dentro de la cancha.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Delanteros', 'Mediocampistas', 'Defensores', 'Arqueros'].map(g => (
                <ChipToggle key={g} label={g} value={g} onToggle={handleGroupToggle} isChecked={filters.grupos[g]} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
            <FilterSection title="Stats específicas" description="Rangos finos por atributo." defaultOpen={false}>
              <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                {Object.entries(DETAILED_STAT_KEYS).map(([groupName, stats]) => (
                  <div key={groupName}>
                    <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wide mb-2">{groupName}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {stats.map(key => (
                        <StatRangeInput key={key} label={STAT_NAMES_MAP[key] || key} statKey={key} filters={filters} onChange={handleStatRangeChange} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Habilidades" description="Skills puntuales del jugador." defaultOpen={false}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                {Object.entries(PLAYER_SKILLS_MAP).map(([key, name]) => (
                  <ChipToggle key={key} label={name} value={key} onToggle={handleSkillToggle} isChecked={filters.skills[key]} />
                ))}
              </div>
            </FilterSection>
          </div>
        </div>

        <div className="shrink-0 bg-[#09131f]/96 backdrop-blur px-4 py-4 sm:px-6 sm:py-5 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-1px_0_rgba(34,211,238,0.08)]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-12 w-full sm:w-auto rounded-xl px-5 bg-red-500/8 text-red-300 font-black hover:bg-red-500/14 transition active:scale-[0.98] shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12)]"
            >
              <RotateCcw className="w-4 h-4 inline mr-2" /> Limpiar todo
            </button>
            <button
              type="button"
              onClick={() => { applyFilters(); onClose(); }}
              className="min-h-12 w-full sm:w-auto rounded-xl px-8 bg-cyan-500 text-black font-black shadow-lg shadow-cyan-950/30 hover:bg-cyan-400 transition active:scale-[0.98]"
            >
              <Search className="w-5 h-5 inline mr-2" /> Ver resultados
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .filter-section {
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.035);
          box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.045);
          padding: 16px;
        }
        .input-filter,
        .select-filter {
          width: 100%;
          min-height: 44px;
          padding: 0.72rem 0.78rem;
          background-color: rgba(0, 0, 0, 0.26);
          border-radius: 10px;
          color: white;
          text-align: left;
          border: 0;
          box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.12);
          font-size: 14px;
          outline: none;
          transition: background-color 0.16s ease, box-shadow 0.16s ease;
        }
        .input-filter:focus,
        .select-filter:focus {
          background-color: rgba(34, 211, 238, 0.055);
          box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.48), 0 0 0 3px rgba(34, 211, 238, 0.08);
        }
        .input-filter::placeholder { color: rgba(255, 255, 255, 0.34); }
        .input-filter::-webkit-outer-spin-button,
        .input-filter::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .input-filter[type=number] { -moz-appearance: textfield; }
        .select-filter option { background-color: #0d1520; color: white; }
        .filter-label {
          display: block;
          margin-bottom: 0.35rem;
          color: rgba(255, 255, 255, 0.52);
          font-size: 0.73rem;
          font-weight: 800;
        }
        @media (max-width: 767px) {
          .filter-section { padding: 14px; border-radius: 12px; }
          .input-filter,
          .select-filter { font-size: 14px; }
        }
      `}</style>
    </div>
  );
});
