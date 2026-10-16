import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, RotateCcw, Save, Search, SlidersHorizontal, X } from 'lucide-react';
import { addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { getActiveFilterChips, isInvertedRange } from '../utils/marketFilters.js';
import { BaseModal } from './ui/BaseModal.jsx';
import { ActiveFilterChips } from './marketplace/ActiveFilterChips.jsx';

// Label colours a manager can give a saved filter (stored by id in Firestore; ids must not change).
const filterColors = [
  { id: 'blue', dot: 'bg-blue-400', label: 'Azul' },
  { id: 'cyan', dot: 'bg-accent-soft', label: 'Celeste' },
  { id: 'green', dot: 'bg-emerald-400', label: 'Verde' },
  { id: 'purple', dot: 'bg-[rgb(var(--c-crest-lavender))]', label: 'Lavanda' },
  { id: 'red', dot: 'bg-red-400', label: 'Rojo' },
  { id: 'yellow', dot: 'bg-yellow-400', label: 'Amarillo' },
];

const RANGES = [
  ['Media (OVR)', 'ovrMin', 'ovrMax', '0', '99'],
  ['Edad', 'ageMin', 'ageMax', '15', '45'],
  ['Precio ($M)', 'priceMin', 'priceMax', 'Mín', 'Máx'],
];

const ToggleButton = memo(function ToggleButton({ label, value, onToggle, isChecked }) {
  return (
    <button type="button" onClick={() => onToggle(value)} aria-pressed={Boolean(isChecked)}
      className={`min-h-11 rounded-lg px-3 text-sm font-semibold border transition-colors text-left
        ${isChecked ? 'bg-accent/15 border-accent/50 text-ink' : 'bg-raised border-line/[0.14] text-ink-2 hover:border-line/30 hover:text-ink'}`}>
      {label}
    </button>
  );
});

function RangeInputs({ label, minKey, maxKey, minPlaceholder, maxPlaceholder, filters, onChange }) {
  const isInverted = isInvertedRange(filters[minKey], filters[maxKey]);
  const errorId = `${minKey}-error`;
  const invalidProps = isInverted ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input type="number" inputMode="numeric" min="0" aria-label={`${label} mínimo`} placeholder={minPlaceholder} value={filters[minKey]} onChange={e => onChange(minKey, e.target.value)} className="input num" {...invalidProps} />
        <span className="text-ink-3" aria-hidden="true">–</span>
        <input type="number" inputMode="numeric" min="0" aria-label={`${label} máximo`} placeholder={maxPlaceholder} value={filters[maxKey]} onChange={e => onChange(maxKey, e.target.value)} className="input num" {...invalidProps} />
      </div>
      {isInverted && <p id={errorId} className="field-error">El mínimo es mayor que el máximo: no va a haber resultados.</p>}
    </fieldset>
  );
}

/** Collapsible group: a heading button, no box around it (hairline between groups). */
function FilterSection({ title, description, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-line/[0.08] pt-4 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setIsOpen(prev => !prev)} aria-expanded={isOpen} className="min-h-11 w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className="section-title block">{title}</span>
          {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && <div className="pt-4 animate-in fade-in">{children}</div>}
    </section>
  );
}

export const FiltrosModal = memo(function FiltrosModal({
  isVisible,
  onClose,
  filters,
  setFilters,
  resetFilters,
  uniquePositions,
  sortedCountries,
  uniquePlayingStyles,
  userId,
  getSavedFiltersCollectionRef,
  showStatusMessage,
  resultCount,
}) {
  const [savedFilters, setSavedFilters] = useState([]);
  const [newFilterName, setNewFilterName] = useState('');
  const [selectedColor, setSelectedColor] = useState('cyan');
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const savingFilterRef = useRef(false);
  const activeChips = useMemo(() => getActiveFilterChips(filters), [filters]);

  useEffect(() => {
    if (!isVisible || !userId) return undefined;
    setIsLoadingFilters(true);
    const unsubscribe = onSnapshot(getSavedFiltersCollectionRef(userId), (snapshot) => {
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

  const handleDeleteFilter = async (filterRef) => {
    setPendingDeleteId(null);
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
  // Enter in a field applies the filters; it never submits anything else or closes the dialog by itself.
  const onFieldKeyDown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); };

  // No early return while hidden: BaseModal needs isOpen to go false to play its exit.
  const footer = (
    <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pb-[env(safe-area-inset-bottom)]">
      <button type="button" onClick={resetFilters} className="btn btn-ghost text-danger-soft hover:text-danger-soft">
        <RotateCcw className="w-4 h-4" aria-hidden="true" />Limpiar filtros
      </button>
      <button type="button" onClick={onClose} className="btn btn-primary min-h-12 sm:px-8">
        <Search className="w-4 h-4" aria-hidden="true" />
        {typeof resultCount === 'number'
          ? <>Ver <span className="num">{resultCount.toLocaleString('es-AR')}</span> {resultCount === 1 ? 'jugador' : 'jugadores'}</>
          : 'Ver resultados'}
      </button>
    </div>
  );

  return (
    <BaseModal
      isOpen={isVisible}
      onClose={onClose}
      size="2xl"
      title="Filtros"
      subtitle={activeChips.length ? `${activeChips.length} ${activeChips.length === 1 ? 'filtro activo' : 'filtros activos'}` : 'Sin filtros aplicados'}
      icon={SlidersHorizontal}
      footer={footer}
      className="h-[94dvh] sm:h-[88dvh]"
      contentClassName="p-4 sm:p-6"
    >
      <div className="space-y-6" onKeyDown={onFieldKeyDown}>
        <ActiveFilterChips chips={activeChips} setFilters={setFilters} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-5 space-y-4" aria-labelledby="filters-ranges">
            <h3 id="filters-ranges" className="eyebrow">Rangos</h3>
            {RANGES.map(([label, minKey, maxKey, minPlaceholder, maxPlaceholder]) => (
              <RangeInputs key={label} label={label} minKey={minKey} maxKey={maxKey} minPlaceholder={minPlaceholder} maxPlaceholder={maxPlaceholder} filters={filters} onChange={handleNumericChange} />
            ))}
          </section>

          <section className="lg:col-span-7 space-y-4" aria-labelledby="filters-identity">
            <h3 id="filters-identity" className="eyebrow">Perfil del jugador</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label>
                <span className="field-label">Posición</span>
                <select value={filters.pos} onChange={e => setFilters(p => ({ ...p, pos: e.target.value }))} className="select">
                  <option value="">Todas</option>
                  {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>
                <span className="field-label">Pie</span>
                <select value={filters.foot} onChange={e => setFilters(p => ({ ...p, foot: e.target.value }))} className="select">
                  <option value="">Cualquiera</option>
                  <option value="Derecho">Derecho</option>
                  <option value="Izquierdo">Izquierdo</option>
                </select>
              </label>
              <label>
                <span className="field-label">Nacionalidad</span>
                <span className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" aria-hidden="true" />
                  <input type="text" list="countries-datalist" placeholder="Buscar o elegir país…" value={filters.country}
                    onChange={e => setFilters(p => ({ ...p, country: e.target.value }))} className="input pl-9 pr-10" />
                  {filters.country && (
                    <button type="button" onClick={() => setFilters(p => ({ ...p, country: '' }))} aria-label="Borrar país" title="Borrar país"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10">
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                  <datalist id="countries-datalist">
                    {sortedCountries?.map(([id, name]) => <option key={id} value={name} />)}
                  </datalist>
                </span>
              </label>
              <label>
                <span className="field-label">Región</span>
                <select value={filters.region} onChange={e => setFilters(p => ({ ...p, region: e.target.value }))} className="select">
                  <option value="">Todas</option>
                  {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Estilo de juego</span>
                <select value={filters.playingStyle} onChange={e => setFilters(p => ({ ...p, playingStyle: e.target.value }))} className="select">
                  <option value="">Cualquiera</option>
                  {uniquePlayingStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </section>
        </div>

        <section aria-labelledby="filters-lines">
          <h3 id="filters-lines" className="eyebrow mb-3">Líneas del campo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['Delanteros', 'Mediocampistas', 'Defensores', 'Arqueros'].map(g => (
              <ToggleButton key={g} label={g} value={g} onToggle={handleGroupToggle} isChecked={filters.grupos[g]} />
            ))}
          </div>
        </section>

        <div className="space-y-4 border-t border-line/[0.08] pt-4">
          <FilterSection title="Atributos" description="Rangos finos por atributo." defaultOpen={false}>
            <div className="space-y-5">
              {Object.entries(DETAILED_STAT_KEYS).map(([groupName, stats]) => (
                <div key={groupName}>
                  <h4 className="eyebrow mb-2">{groupName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                    {stats.map(key => (
                      <RangeInputs key={key} label={STAT_NAMES_MAP[key] || key} minKey={`${key}Min`} maxKey={`${key}Max`} minPlaceholder="Mín" maxPlaceholder="Máx"
                        filters={filters} onChange={(k, v) => handleStatRangeChange(key, k.endsWith('Min') ? 'Min' : 'Max', v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Habilidades" description="Skills puntuales del jugador." defaultOpen={false}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(PLAYER_SKILLS_MAP).map(([key, name]) => (
                <ToggleButton key={key} label={name} value={key} onToggle={handleSkillToggle} isChecked={filters.skills[key]} />
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Filtros guardados" description={userId ? 'Cargá un filtro guardado o guardá el armado actual.' : 'Iniciá sesión para guardar filtros.'}>
            <div className="flex flex-wrap gap-2 min-h-11">
              {isLoadingFilters ? (
                [0, 1, 2].map(i => <div key={i} className="skeleton w-24 h-10" aria-hidden="true" />)
              ) : savedFilters.length === 0 ? (
                <p className="text-sm text-ink-3">Todavía no guardaste filtros.</p>
              ) : savedFilters.map(f => {
                const theme = filterColors.find(c => c.id === f.color) || filterColors[0];
                return (
                  <span key={f.id} className="chip min-h-10 pl-3 pr-1 gap-1">
                    <span className={`w-2 h-2 rounded-full ${theme.dot}`} aria-hidden="true" />
                    <button type="button" className="min-h-9 px-1 font-semibold text-ink hover:text-accent-soft"
                      onClick={() => { setFilters(f.config); showStatusMessage('success', `Filtro "${f.name}" cargado.`); }}>
                      {f.name}
                    </button>
                    {pendingDeleteId === f.id ? (
                      <>
                        <button type="button" onClick={() => handleDeleteFilter(f.ref)} className="btn btn-danger btn-sm">Eliminar</button>
                        <button type="button" onClick={() => setPendingDeleteId(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setPendingDeleteId(f.id)} aria-label={`Eliminar el filtro ${f.name}`}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10">
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 mt-4">
              <input type="text" placeholder="Nombre para guardar…" aria-label="Nombre del filtro" value={newFilterName}
                onChange={e => setNewFilterName(e.target.value)} className="input" />
              <div className="flex items-center gap-1.5 justify-center" role="radiogroup" aria-label="Color del filtro">
                {filterColors.map(color => (
                  <button key={color.id} type="button" role="radio" aria-checked={selectedColor === color.id} aria-label={color.label} title={color.label}
                    onClick={() => setSelectedColor(color.id)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${selectedColor === color.id ? 'border-ink/60 bg-overlay' : 'border-transparent hover:bg-white/[0.05]'}`}>
                    <span className={`w-4 h-4 rounded-full ${color.dot}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleSaveFilter} disabled={!newFilterName.trim() || !userId} className="btn btn-secondary"
                title={!newFilterName.trim() ? 'Escribí un nombre para guardar el filtro' : undefined}>
                <Save className="w-4 h-4" aria-hidden="true" />Guardar
              </button>
            </div>
          </FilterSection>
        </div>
      </div>
    </BaseModal>
  );
});
