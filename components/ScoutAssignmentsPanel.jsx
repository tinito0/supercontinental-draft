import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { Clock, HelpCircle, Loader2, Search, Star, Trash2, UserPlus } from 'lucide-react';
import { APP_ID, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl, getRegionById, getPosColorClass, getStatAndOvrColorClass } from '../utils/helpers.js';
import { Page } from './ui/Page.jsx';
import { PageHeader, SectionHeader } from './ui/PageHeader.jsx';
import { Alert } from './ui/Alert.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import { buildResultsAsync, positionGroups, RESULT_COUNT_MIN, RESULT_COUNT_MAX } from '../utils/scoutEngine.js';

const MONTHLY_SEARCH_LIMIT = 5;

const DEFAULT_SCOUTS = [
  { id: 'scout-rapido', name: 'Tomás Ibarra', quality: 58, durationHours: 1, specialty: 'Respuesta rápida', description: 'Vuelve rápido, pero puede traer jugadores con más variación respecto a lo pedido.' },
  { id: 'scout-equilibrado', name: 'Martín Sosa', quality: 74, durationHours: 2, specialty: 'Búsqueda confiable', description: 'Buen balance entre tiempo y precisión. Ideal para búsquedas normales.' },
  { id: 'fefe-farfan', name: 'Fefe Farfan', quality: 98, durationHours: 4, imageUrl: '/scouts/fefe-farfan.webp', specialty: 'Elite total', description: 'El mejor ojeador de todos. Tarda mas porque filtra fino y prioriza coincidencias premium.' },
  { id: 'scout-test', name: 'Ojeador de Prueba', quality: 98, durationHours: 16, testDurationSeconds: 1, specialty: 'Prueba instantanea', description: 'Funciona como Fefe Farfan, pero vuelve en 1 segundo para testear resultados.' },
];

const SCOUT_TUTORIAL_STEPS = [
  {
    targetSelector: '[data-scout-target="scout-picker"]',
    title: 'Elegir ojeador',
    description: 'Aca elegis quien sale a buscar. Fefe Farfan es el mas preciso; los otros vuelven antes pero tienen mas margen de error.',
  },
  {
    targetSelector: '[data-scout-target="position"]',
    title: 'Zona del campo',
    description: 'Podes buscar cualquier posicion o enfocar por delantero, mediocampista, defensor o arquero.',
  },
  {
    targetSelector: '[data-scout-target="specific-position"]',
    title: 'Posicion especifica',
    description: 'Si queres hilar fino, marca una o varias posiciones puntuales segun aptitud. Si lo dejas en ninguna, busca toda la linea.',
  },
  {
    targetSelector: '[data-scout-target="area"]',
    title: 'Area de busqueda',
    description: 'Filtra por pais o region para buscar talentos de una zona concreta.',
  },
  {
    targetSelector: '[data-scout-target="attention"]',
    title: 'Aspecto principal',
    description: 'Decidi si el ojeador prioriza valoracion general, una habilidad puntual o promesas jovenes.',
  },
  {
    targetSelector: '[data-scout-target="budget"]',
    title: 'Presupuesto',
    description: 'Si elegis considerar, el ojeador intenta respetar tu presupuesto disponible o el maximo que cargues.',
  },
  {
    targetSelector: '[data-scout-target="attributes"]',
    title: 'Atributos',
    description: 'Podes pedir hasta dos atributos, por ejemplo Velocidad 80 y Definicion 75.',
  },
  {
    targetSelector: '[data-scout-target="submit"]',
    title: 'Enviar scout',
    description: 'Cuando este todo listo, mandas la asignacion. Se descuenta del cupo mensual y los resultados llegan al vencer el tiempo.',
  },
];


const attentionOptions = [
  { id: 'overall', label: 'Valoracion general' },
  { id: 'skill', label: 'Por habilidad' },
  { id: 'potential', label: 'Joven promesa' },
];

const statOptions = [
  'Speed',
  'Acceleration',
  'Finishing',
  'BallControl',
  'Dribbling',
  'LowPass',
  'LoftedPass',
  'DefensiveAwareness',
  'BallWinning',
  'Stamina',
  'PhysicalContact',
];

const initialCriteria = {
  positionGroup: '',
  positions: [],
  minAge: '',
  maxAge: '',
  minOvr: '',
  maxOvr: '',
  countryId: '',
  region: '',
  attention: 'overall',
  considerBudget: 'considerar',
  budgetMax: '',
  statKey: 'Speed',
  statMin: '',
  statKey2: '',
  statMin2: '',
  traitKey: '',
};

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime();
}

function getTimeLeft(resolvesAt) {
  const diff = toMillis(resolvesAt) - Date.now();
  if (diff <= 0) return 'Lista para revisar';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.ceil((diff % 3600000) / 60000);
  if (hours <= 0) return `${minutes} min restantes`;
  return `${hours} h ${minutes} min restantes`;
}

function makeCriteriaFingerprint(scoutId, criteria) {
  return `${scoutId}:${JSON.stringify(criteria)}`;
}


function ScoutGuidedTutorial({ steps, isOpen, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const activeStep = steps[stepIndex];

  const updatePosition = () => {
    if (!activeStep) return;
    const target = document.querySelector(activeStep.targetSelector);
    if (!target) {
      setSpotlightRect(null);
      setTooltipStyle({
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 10;
    const nextRect = {
      x: Math.max(8, rect.left - padding),
      y: Math.max(8, rect.top - padding),
      width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
    };
    setSpotlightRect(nextRect);

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setTooltipStyle({
        left: '12px',
        right: '12px',
        bottom: 'calc(14px + env(safe-area-inset-bottom))',
        transform: 'none',
      });
      return;
    }

    const tooltipWidth = 340;
    const belowTop = nextRect.y + nextRect.height + 14;
    const aboveTop = nextRect.y - 220;
    const top = belowTop + 210 < window.innerHeight ? belowTop : Math.max(16, aboveTop);
    const left = Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, nextRect.x + nextRect.width / 2 - tooltipWidth / 2));
    setTooltipStyle({ left: `${left}px`, top: `${top}px`, width: `${tooltipWidth}px`, transform: 'none' });
  };

  useEffect(() => {
    if (!isOpen || !activeStep) return undefined;
    const target = document.querySelector(activeStep.targetSelector);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const frame = requestAnimationFrame(() => {
      window.setTimeout(updatePosition, 240);
    });
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [activeStep, isOpen, stepIndex]);

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  if (!isOpen || !activeStep) return null;

  const isLast = stepIndex === steps.length - 1;
  const path = spotlightRect
    ? `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${spotlightRect.x} ${spotlightRect.y + 12} Q ${spotlightRect.x} ${spotlightRect.y} ${spotlightRect.x + 12} ${spotlightRect.y} H ${spotlightRect.x + spotlightRect.width - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + 12} V ${spotlightRect.y + spotlightRect.height - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x + spotlightRect.width - 12} ${spotlightRect.y + spotlightRect.height} H ${spotlightRect.x + 12} Q ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height - 12} Z`
    : `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z`;

  return (
    <div className="scout-guide-layer" role="dialog" aria-modal="true" aria-label="Tutorial de scouting">
      <svg className="scout-guide-backdrop" width="100%" height="100%" aria-hidden="true">
        <path d={path} fill="rgba(0,0,0,0.72)" fillRule="evenodd" />
      </svg>
      {spotlightRect && (
        <div
          className="scout-guide-ring"
          style={{
            left: spotlightRect.x,
            top: spotlightRect.y,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}
      <div className="scout-guide-popover" style={tooltipStyle}>
        <button type="button" onClick={onClose} className="scout-guide-skip">Saltar</button>
        <div className="eyebrow mb-2">
          Paso {stepIndex + 1} de {steps.length}
        </div>
        <h3 className="font-display text-lg font-bold text-ink mb-2">{activeStep.title}</h3>
        <p className="text-sm text-ink-2 leading-relaxed">{activeStep.description}</p>
        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(index => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            title={stepIndex === 0 ? 'Este es el primer paso' : undefined}
            className="btn btn-secondary"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) onClose();
              else setStepIndex(index => Math.min(steps.length - 1, index + 1));
            }}
            className="btn btn-primary"
          >
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ScoutAssignmentsPanel = memo(function ScoutAssignmentsPanel({
  db,
  userId,
  isAdmin = false,
  allPlayers,
  playerLocks,
  countryMap,
  remainingBudget,
  wishlistSet,
  onAddToWatchlist,
  onPlayerClick,
  addNotification,
  showStatusMessage,
}) {
  const [searches, setSearches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);
  const [selectedScoutId, setSelectedScoutId] = useState('fefe-farfan');
  const [criteria, setCriteria] = useState(initialCriteria);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const resolvingRef = useRef(new Set());

  const scouts = useMemo(() => DEFAULT_SCOUTS.filter(scout => isAdmin || scout.id !== 'scout-test'), [isAdmin]);
  const selectedScout = scouts.find(item => item.id === selectedScoutId) || scouts[0];
  const scoutSearchesRef = useMemo(() => {
    if (!userId) return null;
    return collection(db, `artifacts/${APP_ID}/users/${userId}/scout_searches`);
  }, [db, userId]);
  const monthKey = useMemo(() => getMonthKey(), []);
  const scoutUsageRef = useMemo(() => {
    if (!userId) return null;
    return doc(db, `artifacts/${APP_ID}/users/${userId}/scout_usage`, monthKey);
  }, [db, monthKey, userId]);

  const specificPositions = positionGroups[criteria.positionGroup] || [];
  const effectiveBudgetMax = criteria.budgetMax || (remainingBudget ? (remainingBudget / 1000000).toFixed(2) : '');

  const sortedCountries = useMemo(() => {
    return Object.entries(countryMap || {})
      .filter(([id]) => id !== '0')
      .sort(([, a], [, b]) => String(a).localeCompare(String(b)));
  }, [countryMap]);

  useEffect(() => {
    if (!scouts.some(scout => scout.id === selectedScoutId)) {
      setSelectedScoutId('fefe-farfan');
    }
  }, [scouts, selectedScoutId]);

  useEffect(() => {
    if (!scoutSearchesRef) return undefined;
    const unsubscribe = onSnapshot(scoutSearchesRef, (snap) => {
      const nextSearches = [];
      snap.docs.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (data.status === 'dismissed') return;
        nextSearches.push(data);
      });
      setSearches(nextSearches.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)));
      setIsLoading(false);
    }, (error) => {
      console.error('Error cargando busquedas scout:', error);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [db, scoutSearchesRef, userId]);

  useEffect(() => {
    if (!scoutUsageRef) return undefined;
    const unsubscribe = onSnapshot(scoutUsageRef, (snap) => {
      setMonthlyUsage(Number(snap.data()?.count || 0));
    }, (error) => {
      console.error('Error cargando cupo scout:', error);
    });
    return () => unsubscribe();
  }, [scoutUsageRef]);

  // El snapshot no se actualiza por el simple paso del tiempo. Programamos el
  // próximo vencimiento para que una búsqueda se complete aun sin otros cambios.
  useEffect(() => {
    const nextResolveAt = searches
      .filter(search => search.status === 'searching')
      .map(search => Number(search.resolvesAtMs) || toMillis(search.resolvesAt))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    if (!nextResolveAt) return undefined;

    const delay = Math.max(0, nextResolveAt - Date.now()) + 50;
    const timeout = setTimeout(() => setClockTick(Date.now()), delay);
    return () => clearTimeout(timeout);
  }, [searches]);

  useEffect(() => {
    if (!scoutSearchesRef || allPlayers.length === 0) return;
    searches
      .filter(search => search.status === 'searching' && toMillis(search.resolvesAt) <= Date.now() && !resolvingRef.current.has(search.id))
      .forEach(async (search) => {
        resolvingRef.current.add(search.id);
        const scout = DEFAULT_SCOUTS.find(item => item.id === search.scoutId) || scouts[0] || DEFAULT_SCOUTS[0];
        const results = await buildResultsAsync({ allPlayers, criteria: search.criteria || {}, scout, playerLocks });
        try {
          const searchRef = doc(db, `artifacts/${APP_ID}/users/${userId}/scout_searches`, search.id);
          const didResolve = await runTransaction(db, async (transaction) => {
            const latest = await transaction.get(searchRef);
            const latestData = latest.data();
            const resolvesAt = Number(latestData?.resolvesAtMs) || toMillis(latestData?.resolvesAt);
            if (!latest.exists() || latestData.status !== 'searching' || resolvesAt > Date.now()) return false;
            transaction.update(searchRef, {
              status: 'done',
              results,
              resultIds: results.map(player => player.Id),
              resolvedAt: Timestamp.now(),
            });
            return true;
          });
          if (!didResolve) return;
          addNotification?.({
            id: `scout-${search.id}`,
            category: 'scout',
            type: 'info',
            text: `Scout listo: ${scout.name} trajo ${results.length} candidatos para revisar.`,
            time: 'Scout',
          });
        } catch (error) {
          console.error('Error resolviendo busqueda scout:', error);
        } finally {
          resolvingRef.current.delete(search.id);
        }
      });
  }, [addNotification, allPlayers, clockTick, db, playerLocks, scoutSearchesRef, searches, scouts, userId]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!scoutSearchesRef || isCreatingRef.current) return;
    if (monthlyUsage >= MONTHLY_SEARCH_LIMIT) {
      showStatusMessage?.('error', 'Ya usaste los 5 scouts disponibles de este mes.');
      return;
    }

    const scout = scouts.find(item => item.id === selectedScoutId) || scouts[0];
    const stats = [
      criteria.statMin === '' ? null : { key: criteria.statKey, min: Number(criteria.statMin) },
      criteria.statKey2 && criteria.statMin2 !== '' ? { key: criteria.statKey2, min: Number(criteria.statMin2) } : null,
    ].filter(Boolean).slice(0, 2);
    const traits = criteria.traitKey ? [criteria.traitKey] : [];
    const budgetMax = criteria.considerBudget === 'considerar' ? effectiveBudgetMax : '';
    const createdAtDate = new Date();
    const durationMs = scout.testDurationSeconds
      ? scout.testDurationSeconds * 1000
      : Number(scout.durationHours || 12) * 60 * 60 * 1000;
    const resolvesAtDate = new Date(createdAtDate.getTime() + durationMs);

    const normalizedCriteria = {
      positionGroup: criteria.positionGroup,
      positions: criteria.positions,
      minAge: criteria.minAge,
      maxAge: criteria.maxAge,
      minOvr: criteria.minOvr,
      maxOvr: criteria.maxOvr,
      countryId: criteria.countryId,
      region: criteria.region,
      attention: criteria.attention,
      considerBudget: criteria.considerBudget,
      budgetMax,
      stats,
      traits,
    };
    const dedupeKey = makeCriteriaFingerprint(scout.id, normalizedCriteria);

    // Evita altas duplicadas por doble clic o búsquedas idénticas en curso
    const hasActiveDuplicate = searches.some(item => {
      const pendingUntil = Number(item.resolvesAtMs) || toMillis(item.resolvesAt);
      return item.dedupeKey === dedupeKey && item.status === 'searching' && pendingUntil > Date.now();
    });
    if (hasActiveDuplicate) {
      showStatusMessage?.('error', 'Ya tenés una búsqueda idéntica en curso.');
      return;
    }

    isCreatingRef.current = true;
    setIsCreating(true);
    try {
      const newSearchRef = doc(scoutSearchesRef);

      await runTransaction(db, async (transaction) => {
        const usageSnap = scoutUsageRef ? await transaction.get(scoutUsageRef) : null;
        const currentUsage = Number(usageSnap?.data()?.count || 0);
        if (currentUsage >= MONTHLY_SEARCH_LIMIT) {
          throw new Error('scout-limit-reached');
        }

        transaction.set(newSearchRef, {
          managerId: userId,
          scoutId: scout.id,
          scoutName: scout.name,
          scoutQuality: scout.quality,
          createdAt: Timestamp.fromDate(createdAtDate),
          resolvesAt: Timestamp.fromDate(resolvesAtDate),
          resolvesAtMs: resolvesAtDate.getTime(),
          criteria: normalizedCriteria,
          dedupeKey,
          status: 'searching',
          results: [],
          resultIds: [],
        });

        if (scoutUsageRef) {
          transaction.set(scoutUsageRef, {
            count: currentUsage + 1,
            month: monthKey,
            updatedAt: Timestamp.now(),
          }, { merge: true });
        }
      });
      setCriteria(initialCriteria);
      showStatusMessage?.('success', scout.testDurationSeconds ? 'Busqueda scout de prueba creada. Vuelve en 1 segundo.' : `Busqueda scout creada. Vuelve en ${scout.durationHours || 12} horas.`);
    } catch (error) {
      console.error('Error creando busqueda scout:', error);
      if (error.message === 'scout-limit-reached') {
        showStatusMessage?.('error', 'Ya usaste los 5 scouts disponibles de este mes.');
      } else if (error.message === 'scout-search-duplicate') {
        showStatusMessage?.('error', 'Ya tenés una búsqueda idéntica en curso.');
      } else {
        showStatusMessage?.('error', 'No se pudo crear la busqueda scout.');
      }
    } finally {
      isCreatingRef.current = false;
      setIsCreating(false);
    }
  };

  const dismissSearch = async (searchId) => {
    try {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/scout_searches`, searchId));
    } catch (error) {
      console.error('Error descartando busqueda scout:', error);
    }
  };

  const quotaFull = monthlyUsage >= MONTHLY_SEARCH_LIMIT;
  const fieldLabel = 'field-label';

  return (
    <Page className="pb-24">
      <PageHeader
        eyebrow="Mi club"
        title="Scouting"
        description="Mandá ojeadores a buscar jugadores con los criterios que elijas. Cada búsqueda usa una de tus asignaciones del mes."
        actions={(
          <>
            <span className={`text-sm ${quotaFull ? 'text-danger-soft' : 'text-ink-3'}`}>
              Cupo del mes: <span className="num font-semibold text-ink">{monthlyUsage}/{MONTHLY_SEARCH_LIMIT}</span>
            </span>
            <button type="button" onClick={() => setIsGuideOpen(true)} className="btn btn-secondary">
              <HelpCircle className="w-4 h-4" aria-hidden="true" />Cómo funciona
            </button>
          </>
        )}
      />

      {quotaFull && (
        <Alert tone="danger" title="Cupo mensual agotado">
          Usaste las {MONTHLY_SEARCH_LIMIT} asignaciones de este mes. El cupo se restablece el 1.º del mes que viene.
        </Alert>
      )}

      <form onSubmit={handleCreate} className="panel p-4 sm:p-6 space-y-6" aria-labelledby="scout-form-title">
        <div>
          <h2 id="scout-form-title" className="section-title">Nueva búsqueda</h2>
          <p className="text-xs text-ink-3 mt-1">
            {selectedScout?.testDurationSeconds ? 'Este ojeador de prueba vuelve en 1 segundo.' : `El resultado llega cuando termina el trabajo de ${selectedScout?.durationHours || 12} horas.`}
          </p>
        </div>

        <fieldset data-scout-target="scout-picker">
          <legend className="eyebrow mb-3">Ojeador</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup" aria-label="Ojeador">
            {scouts.map(scout => {
              const selected = selectedScoutId === scout.id;
              return (
                <button
                  key={scout.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={quotaFull}
                  title={quotaFull ? 'Ya usaste las asignaciones de este mes' : scout.description || undefined}
                  onClick={() => setSelectedScoutId(scout.id)}
                  className={`min-h-[88px] rounded-xl border p-3 text-left transition-colors flex gap-3 overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected ? 'bg-accent/10 border-accent' : 'bg-raised border-line/[0.12] hover:border-line/30'
                  }`}
                >
                  <span className="w-14 h-14 rounded-lg overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
                    {scout.imageUrl ? (
                      <img src={scout.imageUrl} alt="" width={56} height={56} className="w-full h-full object-cover object-top"
                        onError={e => {
                          if (e.currentTarget.src.endsWith('.webp')) e.currentTarget.src = '/scouts/fefe-farfan.png';
                          else e.currentTarget.style.display = 'none';
                        }} />
                    ) : (
                      <span className="font-display text-lg font-bold text-ink-2">{scout.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate">{scout.name}</span>
                    <span className="block text-xs text-ink-3 mt-0.5">Calidad <span className="num text-ink-2">{scout.quality}</span> · {scout.testDurationSeconds ? '1 seg' : `${scout.durationHours} h`}</span>
                    <span className="block text-xs text-ink-3 line-clamp-2 mt-0.5">{scout.specialty}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-line/[0.08] pt-5">
          <label data-scout-target="position">
            <span className={fieldLabel}>Zona del campo</span>
            <select value={criteria.positionGroup} onChange={e => setCriteria(prev => ({ ...prev, positionGroup: e.target.value, positions: [] }))} className="select">
              <option value="">Cualquier posición</option>
              {Object.keys(positionGroups).map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label data-scout-target="attention" className="md:col-span-2">
            <span className={fieldLabel}>Qué priorizar</span>
            <select value={criteria.attention} onChange={e => setCriteria(prev => ({ ...prev, attention: e.target.value }))} className="select">
              {attentionOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <fieldset data-scout-target="specific-position">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <legend className="eyebrow">Posición específica</legend>
              <p className="text-xs text-ink-3 mt-1">
                {criteria.positionGroup ? 'Sin elegir ninguna se buscan jugadores para toda la línea.' : 'Elegí primero una zona del campo para filtrar por puesto.'}
              </p>
            </div>
            {criteria.positions.length > 0 && (
              <button type="button" onClick={() => setCriteria(prev => ({ ...prev, positions: [] }))} className="btn btn-ghost btn-sm">Restablecer</button>
            )}
          </div>
          {specificPositions.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {specificPositions.map(pos => {
                const selected = criteria.positions.includes(pos);
                return (
                  <button key={pos} type="button" aria-pressed={selected}
                    onClick={() => setCriteria(prev => ({ ...prev, positions: selected ? prev.positions.filter(item => item !== pos) : [...prev.positions, pos] }))}
                    className={`min-h-11 rounded-lg border text-sm font-semibold transition-colors ${selected ? 'bg-accent border-accent text-on-accent' : 'bg-raised border-line/[0.14] text-ink-2 hover:text-ink hover:border-line/30'}`}>
                    {pos}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <div data-scout-target="area" className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-line/[0.08] pt-5">
          <label data-scout-target="budget">
            <span className={fieldLabel}>País</span>
            <select value={criteria.countryId} onChange={e => setCriteria(prev => ({ ...prev, countryId: e.target.value }))} className="select">
              <option value="">Cualquiera</option>
              {sortedCountries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Región</span>
            <select value={criteria.region} onChange={e => setCriteria(prev => ({ ...prev, region: e.target.value }))} className="select">
              <option value="">Cualquiera</option>
              {REGIONES.map(region => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Presupuesto</span>
            <select value={criteria.considerBudget} onChange={e => setCriteria(prev => ({ ...prev, considerBudget: e.target.value }))} className="select">
              <option value="considerar">Solo los que puedo pagar</option>
              <option value="ignorar">Ignorar el presupuesto</option>
            </select>
          </label>
        </div>

        <div data-scout-target="attributes" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {[['minAge', 'Edad mín'], ['maxAge', 'Edad máx'], ['minOvr', 'OVR mín'], ['maxOvr', 'OVR máx']].map(([key, label]) => (
            <label key={key}>
              <span className={fieldLabel}>{label}</span>
              <input type="number" inputMode="numeric" min="0" max="99" value={criteria[key]} onChange={e => setCriteria(prev => ({ ...prev, [key]: e.target.value }))} className="input num" />
            </label>
          ))}
          <label>
            <span className={fieldLabel}>Precio máx (M)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder={effectiveBudgetMax || 'M'} value={criteria.budgetMax}
              onChange={e => setCriteria(prev => ({ ...prev, budgetMax: e.target.value }))} disabled={criteria.considerBudget === 'ignorar'}
              title={criteria.considerBudget === 'ignorar' ? 'Elegiste ignorar el presupuesto' : undefined} className="input num" />
          </label>
          <label className="col-span-2 sm:col-span-1 lg:col-span-1">
            <span className={fieldLabel}>Atributo 1</span>
            <select value={criteria.statKey} onChange={e => setCriteria(prev => ({ ...prev, statKey: e.target.value }))} className="select">
              {statOptions.map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Mínimo 1</span>
            <input type="number" inputMode="numeric" min="0" max="99" placeholder="Ej. 80" value={criteria.statMin} onChange={e => setCriteria(prev => ({ ...prev, statMin: e.target.value }))} className="input num" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label>
            <span className={fieldLabel}>Atributo 2 (opcional)</span>
            <select value={criteria.statKey2} onChange={e => setCriteria(prev => ({ ...prev, statKey2: e.target.value, statMin2: e.target.value ? prev.statMin2 : '' }))} className="select">
              <option value="">Sin segundo atributo</option>
              {statOptions.filter(key => key !== criteria.statKey).map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
            </select>
          </label>
          <label>
            <span className={fieldLabel}>Mínimo 2</span>
            <input type="number" inputMode="numeric" min="0" max="99" placeholder="Ej. 75" value={criteria.statMin2} onChange={e => setCriteria(prev => ({ ...prev, statMin2: e.target.value }))}
              disabled={!criteria.statKey2} title={!criteria.statKey2 ? 'Primero elegí el segundo atributo' : undefined} className="input num" />
          </label>
          <label>
            <span className={fieldLabel}>Habilidad especial</span>
            <select value={criteria.traitKey} onChange={e => setCriteria(prev => ({ ...prev, traitKey: e.target.value }))} className="select">
              <option value="">Sin habilidad puntual</option>
              {Object.entries(PLAYER_SKILLS_MAP).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>

        <div data-scout-target="submit" className="border-t border-line/[0.08] pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-ink-3">
            {quotaFull ? `Ya usaste las ${MONTHLY_SEARCH_LIMIT} búsquedas de este mes.` : `Usa 1 de tus ${MONTHLY_SEARCH_LIMIT} asignaciones del mes (${monthlyUsage} usadas).`}
          </p>
          <button type="submit" disabled={isCreating || quotaFull}
            title={isCreating ? 'Hay una operación en curso' : quotaFull ? 'Ya usaste las asignaciones de este mes' : undefined}
            className="btn btn-primary btn-lg w-full sm:w-auto">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
            {isCreating ? 'Enviando ojeador…' : quotaFull ? 'Cupo agotado' : 'Enviar ojeador'}
          </button>
        </div>
      </form>

      <section className="space-y-4" aria-labelledby="scout-searches-title">
        <SectionHeader title={<span id="scout-searches-title">Búsquedas</span>} />
        {isLoading ? (
          <div className="space-y-3" aria-hidden="true">{[0, 1].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        ) : searches.length === 0 ? (
          <EmptyState icon={Search} title="Todavía no mandaste ningún ojeador" description="Elegí los criterios arriba y enviá a un ojeador a buscar." />
        ) : searches.map(search => (
          <article key={search.id} className="panel-flat overflow-hidden" aria-label={`Búsqueda de ${search.scoutName || 'ojeador'}`}>
            <header className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-line/[0.08]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{search.scoutName || 'Ojeador'} <span className="text-ink-3 font-normal">· calidad <span className="num">{search.scoutQuality || '-'}</span></span></p>
                <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${search.status === 'done' ? 'text-success-soft' : 'text-ink-3'}`}>
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  {search.status === 'searching' ? getTimeLeft(search.resolvesAt) : search.status === 'done' ? 'Resultados listos' : 'Descartada'}
                </p>
              </div>
              {search.status !== 'dismissed' && (
                <button type="button" onClick={() => dismissSearch(search.id)} className="btn btn-ghost btn-sm text-danger-soft hover:text-danger-soft">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />Descartar
                </button>
              )}
            </header>

            {search.status === 'done' && (search.results || []).length > 0 && (
              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                {search.results.map(player => {
                  const isWatchlisted = wishlistSet?.has(player.Id);
                  const ovr = player.OVR_CALCULADO || 0;
                  return (
                    <li key={player.Id} className="rounded-xl border border-line/[0.12] bg-raised p-3.5 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" width={48} height={48}
                          className="w-12 h-12 rounded-lg object-cover object-top bg-surface flex-shrink-0"
                          onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink truncate">{player.Name}</p>
                          <p className="flex items-center gap-2 mt-1 text-xs text-ink-3">
                            <span className={`px-1.5 rounded text-[10px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
                            <img src={getFlagUrl(player.Country1)} alt="" className="w-4 h-3 rounded-[2px]" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            {player.Age} años
                          </p>
                        </div>
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 ${getStatAndOvrColorClass(ovr)}`}>{ovr}</span>
                      </div>
                      <p className="flex items-center justify-between text-xs text-ink-3 border-t border-line/[0.07] pt-2.5">
                        <span>Velocidad <span className="num font-semibold text-ink-2">{player.Speed || '-'}</span></span>
                        <span>Finalización <span className="num font-semibold text-ink-2">{player.Finishing || '-'}</span></span>
                        <span className="num font-semibold text-ink">{formatPriceShort(player.Precio)}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={isWatchlisted} onClick={() => onAddToWatchlist(player.Id)} aria-pressed={Boolean(isWatchlisted)}
                          title={isWatchlisted ? 'Ya está en tus favoritos' : undefined} className="btn btn-secondary btn-sm min-h-10">
                          <Star className="w-3.5 h-3.5" fill={isWatchlisted ? 'currentColor' : 'none'} aria-hidden="true" />
                          {isWatchlisted ? 'En favoritos' : 'Favorito'}
                        </button>
                        <button type="button" onClick={() => onPlayerClick(player)} className="btn btn-primary btn-sm min-h-10">
                          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />Ver y negociar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        ))}
      </section>

      <ScoutGuidedTutorial steps={SCOUT_TUTORIAL_STEPS} isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </Page>
  );
});
