import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, HelpCircle, RotateCcw, Save, Search, X } from 'lucide-react';
import { addDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { DETAILED_STAT_KEYS, FILTER_SKILL_KEYS, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { getActiveFilterChips, isInvertedRange, VERSATILE_LEVELS, VERSATILE_MAX, VERSATILE_POSITIONS } from '../utils/marketFilters.js';
import { BaseModal } from './ui/BaseModal.jsx';
import { ActiveFilterChips } from './marketplace/ActiveFilterChips.jsx';
import { PlayerGlossary } from './marketplace/PlayerGlossary.jsx';
import { SoftValue } from './ui/SoftValue.jsx';

// Label colours a manager can give a saved filter (stored by id in Firestore; ids must not change).
const filterColors = [
  { id: 'blue', dot: 'bg-blue-400', label: 'Azul' },
  { id: 'cyan', dot: 'bg-accent-soft', label: 'Celeste' },
  { id: 'green', dot: 'bg-emerald-400', label: 'Verde' },
  { id: 'purple', dot: 'bg-[rgb(var(--c-crest-lavender))]', label: 'Lavanda' },
  { id: 'red', dot: 'bg-red-400', label: 'Rojo' },
  { id: 'yellow', dot: 'bg-yellow-400', label: 'Amarillo' },
];

// [label, min key, max key, possible range shown in the label]. Placeholders are always «Mín» / «Máx»: «0» and «99» in
// grey read as values already typed.
const RANGES = [
  ['Media', 'ovrMin', 'ovrMax', '0 a 99'],
  ['Edad', 'ageMin', 'ageMax', '15 a 45'],
  ['Precio', 'priceMin', 'priceMax', 'en millones'],
];

const SECTION_TITLE = 'text-sm font-semibold text-ink';

const ToggleButton = memo(function ToggleButton({ label, value, onToggle, isChecked, disabled = false, title, className = '' }) {
  return (
    <button type="button" onClick={() => onToggle(value)} aria-pressed={Boolean(isChecked)} disabled={disabled} title={title}
      className={`min-h-11 rounded-lg px-3 text-sm font-semibold border transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}
        ${isChecked ? 'bg-accent/15 border-accent/50 text-ink' : 'bg-raised border-line/[0.14] text-ink-2 hover:border-line/30 hover:text-ink'}`}>
      {label}
    </button>
  );
});

function RangeInputs({ label, hint, minKey, maxKey, filters, onChange }) {
  const isInverted = isInvertedRange(filters[minKey], filters[maxKey]);
  const errorId = `${minKey}-error`;
  const invalidProps = isInverted ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  return (
    <fieldset>
      <legend className="field-label">{label}{hint && <span className="font-normal text-ink-3"> ({hint})</span>}</legend>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input type="number" inputMode="numeric" min="0" aria-label={`${label} mínimo`} placeholder="Mín" value={filters[minKey]} onChange={e => onChange(minKey, e.target.value)} className="input num" {...invalidProps} />
        <span className="text-ink-3" aria-hidden="true">–</span>
        <input type="number" inputMode="numeric" min="0" aria-label={`${label} máximo`} placeholder="Máx" value={filters[maxKey]} onChange={e => onChange(maxKey, e.target.value)} className="input num" {...invalidProps} />
      </div>
      {isInverted && <p id={errorId} className="field-error">El mínimo es mayor que el máximo: no va a haber resultados.</p>}
    </fieldset>
  );
}

/** One attribute per row (name, min, max): stacked fieldsets made the open section about 5,500 px tall on a phone. */
function StatRangeRow({ statKey, filters, onChange }) {
  const label = STAT_NAMES_MAP[statKey] || statKey;
  const minKey = `${statKey}Min`;
  const maxKey = `${statKey}Max`;
  const isInverted = isInvertedRange(filters[minKey], filters[maxKey]);
  const errorId = `${minKey}-error`;
  const invalidProps = isInverted ? { 'aria-invalid': true, 'aria-describedby': errorId } : {};
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto_4.5rem] items-center gap-2">
        <span className="text-sm text-ink-2 truncate" title={label}>{label}</span>
        <input type="number" inputMode="numeric" min="0" max="99" aria-label={`${label} mínimo`} placeholder="Mín" value={filters[minKey]}
          onChange={e => onChange(statKey, 'Min', e.target.value)} className="input num px-2 text-center" {...invalidProps} />
        <span className="text-ink-3" aria-hidden="true">–</span>
        <input type="number" inputMode="numeric" min="0" max="99" aria-label={`${label} máximo`} placeholder="Máx" value={filters[maxKey]}
          onChange={e => onChange(statKey, 'Max', e.target.value)} className="input num px-2 text-center" {...invalidProps} />
      </div>
      {isInverted && <p id={errorId} className="field-error">El mínimo es mayor que el máximo.</p>}
    </div>
  );
}

/**
 * Collapsible group: a heading button, no box around it (hairline between groups). Opens like transitions.dev
 * «Accordion»: the row grows from 0fr to 1fr while the content fades, so what is below slides instead of jumping.
 * The closed content is `inert` (out of the tab order and the accessibility tree).
 */
function FilterSection({ id, title, description, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = id ? `${id}-panel` : undefined;
  return (
    <section id={id} className="border-t border-line/[0.08] pt-4 first:border-t-0 first:pt-0 scroll-mt-4">
      <button type="button" onClick={() => setIsOpen(prev => !prev)} aria-expanded={isOpen} aria-controls={panelId}
        className="min-h-11 w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className={`${SECTION_TITLE} block`}>{title}</span>
          {description && <span className="block text-xs text-ink-3 mt-0.5">{description}</span>}
        </span>
        <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform duration-move ease-out ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={panelId} inert={isOpen ? undefined : ''}
        className={`grid transition-[grid-template-rows,opacity] duration-move ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** «¿Qué es?» link that opens the glossary right below it (it used to jump to a separate section at the bottom). */
function GlossaryLink({ label, isOpen, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={isOpen}
      className="inline-flex items-center gap-1 min-h-11 -my-2 px-1 text-xs font-semibold text-accent-soft hover:text-ink">
      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />{isOpen ? 'Ocultar' : label}
    </button>
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
  // Which «¿Qué es?» link has the glossary open: 'style', 'skills' or null.
  const [glossaryAt, setGlossaryAt] = useState(null);
  const toggleGlossary = where => setGlossaryAt(prev => (prev === where ? null : where));
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
  const versatilePos = filters.versatilePos || [];
  const versatileLevel = filters.versatileLevel || 2;
  const versatileFull = versatilePos.length >= VERSATILE_MAX;
  const handleVersatileToggle = (pos) => setFilters(prev => {
    const current = prev.versatilePos || [];
    if (current.includes(pos)) return { ...prev, versatilePos: current.filter(p => p !== pos) };
    if (current.length >= VERSATILE_MAX) return prev;
    return { ...prev, versatilePos: [...current, pos] };
  });
  const handleStatRangeChange = (key, type, val) => setFilters(prev => ({ ...prev, [`${key}${type}`]: val }));
  // Enter in a field applies the filters; it never submits anything else or closes the dialog by itself.
  const onFieldKeyDown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); };

  // No early return while hidden: BaseModal needs isOpen to go false to play its exit.
  const footer = (
    <div className="w-full flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pb-[env(safe-area-inset-bottom)]">
      <button type="button" onClick={resetFilters} className="btn btn-ghost">
        <RotateCcw className="w-4 h-4" aria-hidden="true" />Limpiar filtros
      </button>
      <button type="button" onClick={onClose} className="btn btn-primary min-h-12 sm:px-8">
        <Search className="w-4 h-4" aria-hidden="true" />
        {typeof resultCount === 'number'
          ? <>Ver <SoftValue value={resultCount.toLocaleString('es-AR')} className="num" /> {resultCount === 1 ? 'jugador' : 'jugadores'}</>
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
      footer={footer}
      className="h-[94dvh] sm:h-[88dvh]"
      contentClassName="p-4 sm:p-6"
    >
      {/* Focus starts here (data-modal-start, useModalDialog), so the close button does not open with a focus ring. */}
      <div className="space-y-6" onKeyDown={onFieldKeyDown} data-modal-start tabIndex={-1}>
        <ActiveFilterChips chips={activeChips} setFilters={setFilters} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column: ranges and the field lines, so it is about as tall as the profile column on the right. */}
          <div className="lg:col-span-5 space-y-6">
            <section className="space-y-4" aria-labelledby="filters-ranges">
              <h3 id="filters-ranges" className={SECTION_TITLE}>Rangos</h3>
              {RANGES.map(([label, minKey, maxKey, hint]) => (
                <RangeInputs key={label} label={label} hint={hint} minKey={minKey} maxKey={maxKey} filters={filters} onChange={handleNumericChange} />
              ))}
            </section>

            <section aria-labelledby="filters-lines">
              <h3 id="filters-lines" className={`${SECTION_TITLE} mb-3`}>Líneas del campo</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Delanteros', 'Mediocampistas', 'Defensores', 'Arqueros'].map(g => (
                  <ToggleButton key={g} label={g} value={g} onToggle={handleGroupToggle} isChecked={filters.grupos[g]} />
                ))}
              </div>
            </section>
          </div>

          <section className="lg:col-span-7 space-y-4" aria-labelledby="filters-identity">
            <h3 id="filters-identity" className={SECTION_TITLE}>Perfil del jugador</h3>
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
              {/* The «¿Qué es?» button stays outside the <label>: inside it, it would become the labelled control. */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="filter-playing-style" className="field-label">Estilo de juego</label>
                  <GlossaryLink label="¿Qué es?" isOpen={glossaryAt === 'style'} onToggle={() => toggleGlossary('style')} />
                </div>
                <select id="filter-playing-style" value={filters.playingStyle} onChange={e => setFilters(p => ({ ...p, playingStyle: e.target.value }))} className="select">
                  <option value="">Cualquiera</option>
                  {uniquePlayingStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {glossaryAt === 'style' && <div className="mt-3 well p-3 animate-in fade-in"><PlayerGlossary /></div>}
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="field-label">Juega de</legend>
                <p className="text-sm text-ink-2 mb-2">Elegí hasta {VERSATILE_MAX} posiciones: salen los jugadores con aptitud en todas.</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {VERSATILE_POSITIONS.map(pos => {
                    const isChecked = versatilePos.includes(pos);
                    const isBlocked = versatileFull && !isChecked;
                    return (
                      <ToggleButton key={pos} label={pos} value={pos} onToggle={handleVersatileToggle} isChecked={isChecked}
                        disabled={isBlocked} title={isBlocked ? `Máximo ${VERSATILE_MAX} posiciones: sacá una para elegir otra` : undefined}
                        className="text-center num" />
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3" role="group" aria-labelledby="versatile-level-label">
                  <span id="versatile-level-label" className="text-sm text-ink-2 mr-1">Nivel de aptitud</span>
                  {VERSATILE_LEVELS.map(level => (
                    <ToggleButton key={level.value} label={level.label} value={level.value} isChecked={versatileLevel === level.value}
                      onToggle={value => setFilters(p => ({ ...p, versatileLevel: value }))} />
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        </div>

        <div className="space-y-4 border-t border-line/[0.08] pt-4">
          <FilterSection title="Atributos" description="Rangos finos por atributo." defaultOpen={false}>
            <div className="space-y-5">
              {Object.entries(DETAILED_STAT_KEYS).map(([groupName, stats]) => (
                <div key={groupName}>
                  <h4 className="text-xs font-semibold text-ink-3 mb-2">{groupName}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
                    {stats.map(key => (
                      <StatRangeRow key={key} statKey={key} filters={filters} onChange={handleStatRangeChange} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Habilidades" description="Skills puntuales del jugador." defaultOpen={false}>
            <div className="-mt-2 mb-2">
              <GlossaryLink label="¿Qué hace cada una?" isOpen={glossaryAt === 'skills'} onToggle={() => toggleGlossary('skills')} />
            </div>
            {glossaryAt === 'skills' && <div className="mb-3 well p-3 animate-in fade-in"><PlayerGlossary /></div>}
            {/* Chips that wrap: one full-width button per skill made a list of about 40 rows on a phone. */}
            <div className="flex flex-wrap gap-2">
              {FILTER_SKILL_KEYS.map(key => (
                <ToggleButton key={key} label={PLAYER_SKILLS_MAP[key]} value={key} onToggle={handleSkillToggle} isChecked={filters.skills[key]} />
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Filtros guardados" description={userId ? 'Cargá un filtro guardado o guardá el armado actual.' : 'Iniciá sesión para guardar filtros.'}>
            {userId && (<>
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
                    className={`w-11 h-11 rounded-lg flex items-center justify-center border transition-colors ${selectedColor === color.id ? 'border-ink/60 bg-overlay' : 'border-transparent hover:bg-white/[0.05]'}`}>
                    <span className={`w-4 h-4 rounded-full ${color.dot}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={handleSaveFilter} disabled={!newFilterName.trim() || !userId} className="btn btn-secondary"
                title={!newFilterName.trim() ? 'Escribí un nombre para guardar el filtro' : undefined}>
                <Save className="w-4 h-4" aria-hidden="true" />Guardar
              </button>
            </div>
            </>)}
          </FilterSection>
        </div>
      </div>
    </BaseModal>
  );
});
