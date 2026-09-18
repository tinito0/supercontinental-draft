import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { AlertCircle, Clock, HelpCircle, Search, Star, Trash2, UserPlus } from 'lucide-react';
import { APP_ID, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl, getRegionById } from '../utils/helpers.js';

const RESULT_COUNT_MIN = 3;
const RESULT_COUNT_MAX = 5;
const MONTHLY_SEARCH_LIMIT = 5;

const DEFAULT_SCOUTS = [
  { id: 'scout-rapido', name: 'Tomás Ibarra', quality: 58, durationHours: 1, specialty: 'Respuesta rápida', description: 'Vuelve rápido, pero puede traer jugadores con más variación respecto a lo pedido.' },
  { id: 'scout-equilibrado', name: 'Martín Sosa', quality: 74, durationHours: 2, specialty: 'Búsqueda confiable', description: 'Buen balance entre tiempo y precisión. Ideal para búsquedas normales.' },
  { id: 'fefe-farfan', name: 'Fefe Farfan', quality: 98, durationHours: 4, imageUrl: '/scouts/fefe-farfan.png', specialty: 'Elite total', description: 'El mejor ojeador de todos. Tarda mas porque filtra fino y prioriza coincidencias premium.' },
  { id: 'scout-test', name: 'Ojeador de Prueba', quality: 98, durationHours: 16, testDurationSeconds: 1, specialty: 'Prueba instantanea', description: 'Funciona como Fefe Farfan, pero vuelve en 1 segundo para testear resultados.' },
];

/* ── Posiciones con paleta unificada del mercado ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

/* ── Umbrales dinámicos de color OVR consistentes con el mercado ── */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#94a3af';

function getOvrColor(ovr) {
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (ovr >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

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

const positionGroups = {
  Delantero: ['DC', 'SD', 'EI', 'ED'],
  Mediocampista: ['MC', 'MCD', 'MO', 'MI', 'MD'],
  Defensor: ['DFC', 'LI', 'LD'],
  Arquero: ['PT'],
};

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

function matchRange(value, min, max, variance = 0) {
  const numberValue = Number(value) || 0;
  const minValue = min === '' || min == null ? null : Number(min) - variance;
  const maxValue = max === '' || max == null ? null : Number(max) + variance;
  if (minValue != null && numberValue < minValue) return false;
  if (maxValue != null && numberValue > maxValue) return false;
  return true;
}

function buildResults({ allPlayers, criteria, scout, playerLocks }) {
  const quality = Number(scout?.quality) || 65;
  const variance = Math.max(0, Math.round((100 - quality) / 9));
  const lockedIds = new Set(Object.keys(playerLocks || {}).map(String));
  const wantedStats = criteria.stats || [];
  const wantedTraits = criteria.traits || [];
  const wantedPositions = criteria.positions || [];
  const groupPositions = criteria.positionGroup ? positionGroups[criteria.positionGroup] || [] : [];
  const considerBudget = criteria.considerBudget !== 'ignorar';
  const budgetMax = criteria.budgetMax === '' || criteria.budgetMax == null ? null : Number(criteria.budgetMax);

  const matchesPosition = (player) => {
    if (wantedPositions.length > 0) {
      return wantedPositions.some(pos => player.POS_NOMBRE === pos || Number(player[`Aptitude${pos}`] || 0) >= 2);
    }
    if (groupPositions.length > 0) {
      return groupPositions.includes(player.POS_NOMBRE) || groupPositions.some(pos => Number(player[`Aptitude${pos}`] || 0) >= 2);
    }
    return true;
  };

  const strict = allPlayers.filter(player => {
    if (lockedIds.has(String(player.Id))) return false;
    if (!matchesPosition(player)) return false;
    if (considerBudget && budgetMax != null && Number(player.Precio || 0) > budgetMax + variance) return false;
    if (criteria.countryId && String(player.Country1) !== String(criteria.countryId) && String(player.Country2) !== String(criteria.countryId)) return false;
    if (criteria.region && getRegionById(player.Country1) !== criteria.region) return false;
    if (!matchRange(player.Age, criteria.minAge, criteria.maxAge, variance)) return false;
    if (!matchRange(player.OVR_CALCULADO, criteria.minOvr, criteria.maxOvr, variance)) return false;
    if (!wantedStats.every(item => Number(player[item.key] || 0) >= Number(item.min || 0) - variance)) return false;
    if (!wantedTraits.every(key => Boolean(player[key]))) return false;
    return true;
  });

  const pool = strict.length >= RESULT_COUNT_MIN
    ? strict
    : allPlayers.filter(player => !lockedIds.has(String(player.Id)));

  const scored = pool.map(player => {
    let score = 0;
    if (wantedPositions.includes(player.POS_NOMBRE)) score += 34;
    else if (matchesPosition(player)) score += 22;
    if (criteria.countryId && (String(player.Country1) === String(criteria.countryId) || String(player.Country2) === String(criteria.countryId))) score += 15;
    if (criteria.region && getRegionById(player.Country1) === criteria.region) score += 12;
    if (considerBudget && budgetMax != null) score -= Math.max(0, Number(player.Precio || 0) - budgetMax) * 2;
    if (criteria.minOvr !== '') score -= Math.abs(Number(player.OVR_CALCULADO) - Number(criteria.minOvr)) * 0.8;
    if (criteria.maxOvr !== '') score -= Math.max(0, Number(player.OVR_CALCULADO) - Number(criteria.maxOvr));
    if (criteria.minAge !== '') score -= Math.max(0, Number(criteria.minAge) - Number(player.Age)) * 0.5;
    if (criteria.maxAge !== '') score -= Math.max(0, Number(player.Age) - Number(criteria.maxAge)) * 0.5;
    wantedStats.forEach(item => {
      score += Math.min(18, Math.max(-10, Number(player[item.key] || 0) - Number(item.min || 0)));
    });
    wantedTraits.forEach(key => {
      if (player[key]) score += 8;
    });
    if (criteria.attention === 'overall') score += Number(player.OVR_CALCULADO || 0) * 0.35;
    if (criteria.attention === 'skill') score += wantedStats.reduce((sum, item) => sum + Number(player[item.key] || 0), 0) * 0.08;
    if (criteria.attention === 'potential') score += Math.max(0, 30 - Number(player.Age || 99));
    score += Math.random() * (110 - quality);
    return { player, score };
  }).sort((a, b) => b.score - a.score);

  const amount = Math.min(scored.length, RESULT_COUNT_MIN + Math.floor(Math.random() * (RESULT_COUNT_MAX - RESULT_COUNT_MIN + 1)));
  return scored.slice(0, amount).map(({ player }) => ({
    Id: player.Id,
    Name: player.Name,
    POS_NOMBRE: player.POS_NOMBRE,
    Age: player.Age,
    OVR_CALCULADO: player.OVR_CALCULADO,
    Precio: player.Precio,
    Country1: player.Country1,
    Speed: player.Speed,
    Finishing: player.Finishing,
    BallControl: player.BallControl,
  }));
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
        <div className="text-[10px] font-black uppercase text-[#00b4d8] mb-2 tracking-wider">
          Paso {stepIndex + 1} de {steps.length}
        </div>
        <h3 className="text-base font-black text-white mb-2">{activeStep.title}</h3>
        <p className="text-sm text-slate-300 leading-relaxed">{activeStep.description}</p>
        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(index => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            className="min-h-11 px-4 rounded-xl bg-[#111722] hover:bg-[#161f2e] border border-white/[0.08] disabled:opacity-40 text-sm font-bold text-slate-200 transition"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) onClose();
              else setStepIndex(index => Math.min(steps.length - 1, index + 1));
            }}
            className="min-h-11 px-5 rounded-xl bg-[#00b4d8] hover:bg-[#38bdf8] text-sm font-black text-[#030712] transition shadow-md active:scale-95"
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
        const results = buildResults({ allPlayers, criteria: search.criteria || {}, scout, playerLocks });
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

  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-[#06080d] relative overflow-hidden text-slate-200">
      {/* Sutil halo atmosférico cyan tipo radar */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-[radial-gradient(ellipse_at_top,_rgba(0,180,216,0.08)_0%,_transparent_70%)] pointer-events-none z-0" />

      {/* ── HEADER SUPERIOR ── */}
      <div className="relative z-10 px-4 sm:px-6 py-4 bg-[#0c1017] border-b border-white/[0.08]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2.5">
              <Search className="w-5 h-5 text-[#00b4d8]" /> Scouting & Red de Ojeadores
            </h2>
            <p className="text-xs text-slate-400 mt-1">Asigna misiones de exploración táctica para descubrir talentos y promesas de fichaje.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="min-h-11 px-4 rounded-xl bg-[#111722] hover:bg-[#161f2e] border border-white/[0.08] text-slate-200 text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-[#00b4d8]" /> Ayuda
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 space-y-4 pb-24">
        <form onSubmit={handleCreate} className="rounded-2xl border border-white/[0.08] bg-[#0c1017] p-4 sm:p-6 space-y-5 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Nueva asignación de exploración</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedScout?.testDurationSeconds ? 'Este ojeador de prueba vuelve en 1 segundo.' : `El resultado se libera cuando termina el trabajo de ${selectedScout?.durationHours || 12} horas.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                monthlyUsage >= MONTHLY_SEARCH_LIMIT
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-[#111722] border-white/[0.08] text-slate-300'
              }`}>
                Cupo mensual: <strong className="text-white">{monthlyUsage}</strong>/{MONTHLY_SEARCH_LIMIT}
              </span>
            </div>
          </div>

          {/* Ojeadores */}
          <div data-scout-target="scout-picker" className="rounded-xl border border-white/[0.08] bg-[#111722]/50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-xs font-black text-slate-300 uppercase tracking-wider">Seleccionar Ojeador</p>
                <p className="text-xs text-slate-400">Cupo mensual disponible: {MONTHLY_SEARCH_LIMIT - monthlyUsage} asignaciones restantes</p>
              </div>
              {monthlyUsage >= MONTHLY_SEARCH_LIMIT && (
                <span className="text-xs font-black text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  Cupo agotado
                </span>
              )}
            </div>

            {monthlyUsage >= MONTHLY_SEARCH_LIMIT && (
              <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 flex items-center gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Usaste los 5 scouts disponibles de este mes. El cupo se restablece automáticamente el 1° del próximo mes.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {scouts.map(scout => {
                const selected = selectedScoutId === scout.id;
                const isQuotaFull = monthlyUsage >= MONTHLY_SEARCH_LIMIT;
                return (
                  <button
                    key={scout.id}
                    type="button"
                    disabled={isQuotaFull}
                    onClick={() => setSelectedScoutId(scout.id)}
                    className={`min-h-[96px] rounded-xl border p-3.5 text-left transition flex gap-3 overflow-hidden cursor-pointer ${
                      isQuotaFull
                        ? 'opacity-40 cursor-not-allowed bg-[#111722]/40 border-white/5'
                        : selected
                        ? 'bg-[#00b4d8]/10 border-[#00b4d8] ring-2 ring-[#00b4d8]/30 shadow-[0_0_15px_rgba(0,180,216,0.15)]'
                        : 'bg-[#111722] border-white/[0.08] hover:bg-[#161f2e] hover:border-white/[0.18]'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/60 border border-white/10 flex-shrink-0">
                      {scout.imageUrl ? (
                        <img src={scout.imageUrl} alt={scout.name} className="w-full h-full object-cover object-top" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-black text-[#00b4d8]">{scout.name.slice(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{scout.name}</p>
                      <p className="text-[11px] font-black text-[#00b4d8] mt-0.5">Q{scout.quality} • {scout.testDurationSeconds ? '1 seg' : `${scout.durationHours} h`}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{scout.specialty}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label data-scout-target="position" className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zona del campo</span>
              <select
                value={criteria.positionGroup}
                onChange={e => setCriteria(prev => ({ ...prev, positionGroup: e.target.value, positions: [] }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                <option value="">Cualquier posición</option>
                {Object.keys(positionGroups).map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label data-scout-target="attention" className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aspectos a priorizar</span>
              <select
                value={criteria.attention}
                onChange={e => setCriteria(prev => ({ ...prev, attention: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                {attentionOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {/* Posición específica */}
          <div data-scout-target="specific-position" className="rounded-xl border border-white/[0.08] bg-[#111722]/50 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-xs font-black text-slate-300 uppercase tracking-wider">Posición específica</p>
                <p className="text-xs text-slate-400">
                  {criteria.positionGroup ? 'Ninguna = se buscan jugadores aptos para toda la línea elegida.' : 'Cualquier posición = no se filtra por zona del campo.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCriteria(prev => ({ ...prev, positions: [] }))}
                className="min-h-10 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
              >
                Restablecer
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {specificPositions.length === 0 && (
                <div className="col-span-full min-h-11 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-xs font-medium text-slate-400 px-3 text-center">
                  {criteria.positionGroup ? 'No hay puestos específicos para esta línea' : 'Elegí una posición arriba (Arquero, Defensa, Medio o Delantero) para filtrar por puestos'}
                </div>
              )}
              {specificPositions.map(pos => {
                const selected = criteria.positions.includes(pos);
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setCriteria(prev => ({
                      ...prev,
                      positions: selected ? prev.positions.filter(item => item !== pos) : [...prev.positions, pos],
                    }))}
                    className={`min-h-11 rounded-xl border text-sm font-black transition cursor-pointer ${
                      selected
                        ? 'bg-[#00b4d8] border-[#00b4d8] text-[#030712] shadow-sm'
                        : 'bg-[#111722] border-white/[0.08] text-slate-300 hover:text-white hover:bg-[#161f2e]'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área geográfica y presupuesto */}
          <div data-scout-target="area" className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label data-scout-target="budget" className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">País</span>
              <select
                value={criteria.countryId}
                onChange={e => setCriteria(prev => ({ ...prev, countryId: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                <option value="">Cualquiera</option>
                {sortedCountries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Región</span>
              <select
                value={criteria.region}
                onChange={e => setCriteria(prev => ({ ...prev, region: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                <option value="">Cualquiera</option>
                {REGIONES.map(region => <option key={region} value={region}>{region}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Presupuesto</span>
              <select
                value={criteria.considerBudget}
                onChange={e => setCriteria(prev => ({ ...prev, considerBudget: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                <option value="considerar">Considerar disponibles</option>
                <option value="ignorar">Ignorar límite</option>
              </select>
            </label>
          </div>

          {/* Atributos y rangos */}
          <div data-scout-target="attributes" className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {[
              ['minAge', 'Edad mín'],
              ['maxAge', 'Edad máx'],
              ['minOvr', 'OVR mín'],
              ['maxOvr', 'OVR máx'],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={criteria[key]}
                  onChange={e => setCriteria(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Presup. máx</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={effectiveBudgetMax || 'M'}
                value={criteria.budgetMax}
                onChange={e => setCriteria(prev => ({ ...prev, budgetMax: e.target.value }))}
                disabled={criteria.considerBudget === 'ignorar'}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors disabled:opacity-40"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atributo 1</span>
              <select
                value={criteria.statKey}
                onChange={e => setCriteria(prev => ({ ...prev, statKey: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                {statOptions.map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mín 1</span>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Ej. 80"
                value={criteria.statMin}
                onChange={e => setCriteria(prev => ({ ...prev, statMin: e.target.value }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Atributo 2 opcional</span>
              <select
                value={criteria.statKey2}
                onChange={e => setCriteria(prev => ({ ...prev, statKey2: e.target.value, statMin2: e.target.value ? prev.statMin2 : '' }))}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
              >
                <option value="">Sin segundo atributo</option>
                {statOptions.filter(key => key !== criteria.statKey).map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mín 2</span>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Ej. 75"
                value={criteria.statMin2}
                onChange={e => setCriteria(prev => ({ ...prev, statMin2: e.target.value }))}
                disabled={!criteria.statKey2}
                className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors disabled:opacity-40"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Habilidad especial o rasgo</span>
            <select
              value={criteria.traitKey}
              onChange={e => setCriteria(prev => ({ ...prev, traitKey: e.target.value }))}
              className="w-full min-h-11 bg-[#111722] border border-white/[0.08] focus:border-[#00b4d8] rounded-xl px-3.5 text-sm font-semibold text-white outline-none transition-colors"
            >
              <option value="">Sin habilidad puntual</option>
              {Object.entries(PLAYER_SKILLS_MAP).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>

          {/* Comparativa informativa de ojeadores */}
          <div className="rounded-xl border border-[#00b4d8]/20 bg-[#00b4d8]/5 p-4 text-xs text-slate-300">
            <p className="font-black text-[#00b4d8] uppercase tracking-wider mb-2">Especialidades de la red de ojeadores</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {scouts.map(scout => (
                <div key={scout.id} className="rounded-xl bg-[#0c1017] border border-white/[0.08] p-3 shadow-sm">
                  <p className="font-black text-white">{scout.name} • <span className="text-[#00b4d8]">Q{scout.quality}</span></p>
                  <p className="text-emerald-400 font-bold mt-0.5">{scout.specialty}</p>
                  <p className="text-slate-400 mt-1 leading-relaxed">{scout.description || 'Mayor calidad significa menos variación y mejores coincidencias.'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de Enviar Scout */}
          <div data-scout-target="submit" className="pt-2">
            <button
              type="submit"
              disabled={isCreating || monthlyUsage >= MONTHLY_SEARCH_LIMIT}
              className="w-full min-h-12 rounded-xl bg-[#00b4d8] hover:bg-[#38bdf8] disabled:opacity-50 disabled:cursor-not-allowed text-[#030712] text-sm font-black uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 active:scale-[0.99] cursor-pointer"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  <span>Asignando misión de scout...</span>
                </>
              ) : monthlyUsage >= MONTHLY_SEARCH_LIMIT ? (
                <span>Cupo mensual agotado ({monthlyUsage}/{MONTHLY_SEARCH_LIMIT})</span>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Enviar asignación de scout</span>
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500 font-medium">
              {monthlyUsage >= MONTHLY_SEARCH_LIMIT
                ? 'Ya alcanzaste el límite de 5 búsquedas de este mes.'
                : `La búsqueda consume 1 de tus ${MONTHLY_SEARCH_LIMIT} asignaciones mensuales (${monthlyUsage}/${MONTHLY_SEARCH_LIMIT} usadas).`}
            </p>
          </div>
        </form>

        {/* Listado de Búsquedas Activas */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0c1017] p-8 flex items-center justify-center gap-3 text-slate-300 text-sm font-bold shadow-md">
              <div className="w-5 h-5 rounded-full border-2 border-[#00b4d8]/30 border-t-[#00b4d8] animate-spin" />
              <span>Cargando búsquedas de scout en curso...</span>
            </div>
          ) : searches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1017] p-10 text-center flex flex-col items-center justify-center">
              <Search className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p className="text-base font-bold text-slate-300">Todavía no mandaste ningún scout.</p>
              <p className="text-xs text-slate-500 mt-1">Configurá los filtros arriba y enviá a un ojeador a explorar talentos.</p>
            </div>
          ) : searches.map(search => (
            <div key={search.id} className="rounded-2xl border border-white/[0.08] bg-[#0c1017] overflow-hidden shadow-md">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] bg-[#111722]/80">
                <div>
                  <p className="text-sm font-black text-white flex items-center gap-2">
                    {search.scoutName || 'Scout'}
                    <span className="text-[#00b4d8] font-bold px-2 py-0.5 bg-[#00b4d8]/10 rounded-md text-xs border border-[#00b4d8]/20">
                      Q{search.scoutQuality || '-'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                    <Clock className="w-3.5 h-3.5 text-[#00b4d8]" />
                    {search.status === 'searching' ? getTimeLeft(search.resolvesAt) : search.status === 'done' ? 'Resultados listos para evaluar' : 'Descartada'}
                  </p>
                </div>
                {search.status !== 'dismissed' && (
                  <button
                    onClick={() => dismissSearch(search.id)}
                    className="min-h-10 px-3.5 rounded-xl text-xs font-black text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/25 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Descartar
                  </button>
                )}
              </div>

              {search.status === 'done' && (search.results || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                  {search.results.map(player => {
                    const isWatchlisted = wishlistSet?.has(player.Id);
                    const posColor = POS_COLOR[player.POS_NOMBRE] || '#94a3b8';
                    const ovr = player.OVR_CALCULADO || 0;
                    const ovrColor = getOvrColor(ovr);

                    return (
                      <div
                        key={player.Id}
                        className="rounded-xl border border-white/[0.08] bg-[#111722]/70 hover:bg-[#161f2e] hover:border-[#00b4d8]/40 p-4 transition-all duration-200 shadow-sm group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <img
                              src={`/fotos_jugadores/${player.Id}.webp`}
                              alt={player.Name}
                              className="w-12 h-12 rounded-xl object-cover bg-black/60 border border-white/10 flex-shrink-0"
                              onError={e => {
                                e.target.onerror = null;
                                e.target.src = `https://placehold.co/48x48/111/444?text=${player.Name?.[0] || '?'}`;
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-white group-hover:text-[#00b4d8] transition truncate">
                                {player.Name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="text-[9px] font-black text-white px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: posColor }}
                                >
                                  {player.POS_NOMBRE}
                                </span>
                                <img
                                  src={getFlagUrl(player.Country1)}
                                  alt=""
                                  className="w-4 h-3 rounded-[2px] opacity-80"
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                                <span className="text-xs text-slate-400 font-medium">{player.Age} años</span>
                              </div>
                            </div>
                            <span
                              className="text-sm font-black px-2 py-0.5 rounded-md flex-shrink-0"
                              style={{ color: ovrColor, backgroundColor: 'rgba(255,255,255,0.04)' }}
                            >
                              {ovr}
                            </span>
                          </div>

                          <div className="mt-3.5 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-400">Vel <strong className="text-white font-mono">{player.Speed || '-'}</strong></span>
                            <span className="text-slate-400">Fin <strong className="text-white font-mono">{player.Finishing || '-'}</strong></span>
                            <span className="text-emerald-400 font-black">{formatPriceShort(player.Precio)}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 pt-2">
                          <button
                            disabled={isWatchlisted}
                            onClick={() => onAddToWatchlist(player.Id)}
                            className="min-h-10 rounded-xl bg-[#0c1017] hover:bg-black/60 border border-white/[0.08] disabled:opacity-50 text-xs font-bold text-yellow-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5" fill={isWatchlisted ? 'currentColor' : 'none'} />
                            {isWatchlisted ? 'En watchlist' : 'Watchlist'}
                          </button>
                          <button
                            onClick={() => onPlayerClick(player)}
                            className="min-h-10 rounded-xl bg-[#00b4d8] hover:bg-[#38bdf8] text-[#030712] text-xs font-black flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Negociar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <ScoutGuidedTutorial
        steps={SCOUT_TUTORIAL_STEPS}
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
});
