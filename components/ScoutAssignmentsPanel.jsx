import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, increment, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Clock, HelpCircle, Search, Star, Trash2, UserPlus } from 'lucide-react';
import { APP_ID, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl, getRegionById } from '../utils/helpers.js';

const RESULT_COUNT_MIN = 3;
const RESULT_COUNT_MAX = 5;
const MONTHLY_SEARCH_LIMIT = 5;

const DEFAULT_SCOUTS = [
  { id: 'scout-rapido', name: 'Nico Radar', quality: 58, durationHours: 4, specialty: 'Respuesta corta', description: 'Vuelve rapido, pero puede traer jugadores con mas variacion respecto a lo pedido.' },
  { id: 'scout-equilibrado', name: 'Rolo Cancha', quality: 74, durationHours: 8, specialty: 'Busqueda confiable', description: 'Buen balance entre tiempo y precision. Ideal para busquedas normales.' },
  { id: 'fefe-farfan', name: 'Fefe Farfan', quality: 98, durationHours: 16, imageUrl: '/scouts/fefe-farfan.png', specialty: 'Elite total', description: 'El mejor ojeador de todos. Tarda mas porque filtra fino y prioriza coincidencias premium.' },
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
        <div className="text-[10px] font-black uppercase text-emerald-300 mb-2">
          Paso {stepIndex + 1} de {steps.length}
        </div>
        <h3 className="text-base font-black text-white mb-2">{activeStep.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{activeStep.description}</p>
        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(index => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            className="min-h-11 px-4 rounded-lg bg-white/[0.06] disabled:opacity-40 text-sm font-black text-white"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) onClose();
              else setStepIndex(index => Math.min(steps.length - 1, index + 1));
            }}
            className="min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-black text-white"
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
  const [selectedScoutId, setSelectedScoutId] = useState('fefe-farfan');
  const [criteria, setCriteria] = useState(initialCriteria);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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
        if (data.status === 'dismissed') {
          deleteDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/scout_searches`, docSnap.id)).catch(error => {
            console.error('Error limpiando busqueda scout descartada:', error);
          });
          return;
        }
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

  useEffect(() => {
    if (!scoutSearchesRef || allPlayers.length === 0) return;
    searches
      .filter(search => search.status === 'searching' && toMillis(search.resolvesAt) <= Date.now() && !resolvingRef.current.has(search.id))
      .forEach(async (search) => {
        resolvingRef.current.add(search.id);
        const scout = DEFAULT_SCOUTS.find(item => item.id === search.scoutId) || scouts[0] || DEFAULT_SCOUTS[0];
        const results = buildResults({ allPlayers, criteria: search.criteria || {}, scout, playerLocks });
        try {
          await updateDoc(doc(db, `artifacts/${APP_ID}/users/${userId}/scout_searches`, search.id), {
            status: 'done',
            results,
            resultIds: results.map(player => player.Id),
            resolvedAt: Timestamp.now(),
          });
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
  }, [addNotification, allPlayers, db, playerLocks, scoutSearchesRef, searches, scouts, userId]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!scoutSearchesRef || isCreating) return;
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

    setIsCreating(true);
    try {
      const usageSnap = scoutUsageRef ? await getDoc(scoutUsageRef) : null;
      const currentUsage = Number(usageSnap?.data()?.count || monthlyUsage || 0);
      if (currentUsage >= MONTHLY_SEARCH_LIMIT) {
        showStatusMessage?.('error', 'Ya usaste los 5 scouts disponibles de este mes.');
        return;
      }

      await addDoc(scoutSearchesRef, {
        managerId: userId,
        scoutId: scout.id,
        scoutName: scout.name,
        scoutQuality: scout.quality,
        createdAt: Timestamp.fromDate(createdAtDate),
        resolvesAt: Timestamp.fromDate(resolvesAtDate),
        criteria: {
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
        },
        status: 'searching',
        results: [],
        resultIds: [],
      });
      if (scoutUsageRef) {
        await setDoc(scoutUsageRef, {
          count: increment(1),
          month: monthKey,
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
      setCriteria(initialCriteria);
      showStatusMessage?.('success', scout.testDurationSeconds ? 'Busqueda scout de prueba creada. Vuelve en 1 segundo.' : `Busqueda scout creada. Vuelve en ${scout.durationHours || 12} horas.`);
    } catch (error) {
      console.error('Error creando busqueda scout:', error);
      showStatusMessage?.('error', 'No se pudo crear la busqueda scout.');
    } finally {
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
    <div className="w-full h-full min-h-0 flex flex-col bg-[#0a0a0a]">
      <div className="px-4 sm:px-6 py-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-400" /> Scout
            </h2>
            <p className="text-xs text-gray-500 mt-1">Crea busquedas con cupo mensual y recibi candidatos para fichar.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="min-h-11 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-gray-300 text-xs font-black flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4" /> Ayuda
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-4 space-y-4 pb-24">
        <form onSubmit={handleCreate} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-black text-white uppercase">Nueva asignacion</h3>
              <p className="text-xs text-gray-500">
                {selectedScout?.testDurationSeconds ? 'Este ojeador de prueba vuelve en 1 segundo.' : `El resultado se libera cuando termina el trabajo de ${selectedScout?.durationHours || 12} horas.`}
              </p>
            </div>
            <button data-scout-target="submit" disabled={isCreating} className="min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-black transition">
              {isCreating ? 'Creando...' : 'Enviar scout'}
            </button>
          </div>

          <div data-scout-target="scout-picker" className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-xs font-black text-gray-300 uppercase">Ojeador</p>
                <p className="text-xs text-gray-600">Cupo mensual: {monthlyUsage}/{MONTHLY_SEARCH_LIMIT}</p>
              </div>
              {monthlyUsage >= MONTHLY_SEARCH_LIMIT && (
                <span className="text-xs font-black text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                  Cupo agotado
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {scouts.map(scout => {
                const selected = selectedScoutId === scout.id;
                return (
                  <button
                    key={scout.id}
                    type="button"
                    onClick={() => setSelectedScoutId(scout.id)}
                    className={`min-h-[96px] rounded-xl border p-3 text-left transition flex gap-3 overflow-hidden ${
                      selected
                        ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/20'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-900 border border-white/10 flex-shrink-0">
                      {scout.imageUrl ? (
                        <img src={scout.imageUrl} alt={scout.name} className="w-full h-full object-cover object-top" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-300">{scout.name.slice(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white truncate">{scout.name}</p>
                      <p className="text-[11px] font-bold text-emerald-300">Q{scout.quality} - {scout.testDurationSeconds ? '1 seg' : `${scout.durationHours} h`}</p>
                      <p className="text-[11px] text-gray-500 line-clamp-2">{scout.specialty}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label data-scout-target="position" className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Posicion</span>
              <select
                value={criteria.positionGroup}
                onChange={e => setCriteria(prev => ({ ...prev, positionGroup: e.target.value, positions: [] }))}
                className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white"
              >
                <option value="">Cualquier posicion</option>
                {Object.keys(positionGroups).map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label data-scout-target="attention" className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Aspectos a prestar atencion</span>
              <select value={criteria.attention} onChange={e => setCriteria(prev => ({ ...prev, attention: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                {attentionOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div data-scout-target="specific-position" className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <p className="text-xs font-black text-gray-300 uppercase">Posicion especifica</p>
              <p className="text-xs text-gray-600">
                {criteria.positionGroup ? 'Ninguna = se buscan jugadores aptos para toda la linea elegida.' : 'Cualquier posicion = no se filtra por zona del campo.'}
              </p>
              </div>
              <button
                type="button"
                onClick={() => setCriteria(prev => ({ ...prev, positions: [] }))}
                className="min-h-11 px-3 rounded-lg text-xs font-black text-gray-400 hover:text-white hover:bg-white/[0.06]"
              >
                Ninguna
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {specificPositions.length === 0 && (
                <div className="col-span-full min-h-11 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-xs font-bold text-gray-600">
                  Sin posicion especifica
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
                    className={`min-h-11 rounded-lg border text-sm font-black transition ${
                      selected
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          <div data-scout-target="area" className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label data-scout-target="budget" className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Pais</span>
              <select value={criteria.countryId} onChange={e => setCriteria(prev => ({ ...prev, countryId: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                <option value="">Cualquiera</option>
                {sortedCountries.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Region</span>
              <select value={criteria.region} onChange={e => setCriteria(prev => ({ ...prev, region: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                <option value="">Cualquiera</option>
                {REGIONES.map(region => <option key={region} value={region}>{region}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Presupuesto</span>
              <select value={criteria.considerBudget} onChange={e => setCriteria(prev => ({ ...prev, considerBudget: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                <option value="considerar">Considerar</option>
                <option value="ignorar">Ignorar</option>
              </select>
            </label>
          </div>

          <div data-scout-target="attributes" className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {[
              ['minAge', 'Edad min'],
              ['maxAge', 'Edad max'],
              ['minOvr', 'OVR min'],
              ['maxOvr', 'OVR max'],
            ].map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-xs font-bold text-gray-500">{label}</span>
                <input type="number" min="0" max="99" value={criteria[key]} onChange={e => setCriteria(prev => ({ ...prev, [key]: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white" />
              </label>
            ))}
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Presup. max</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={effectiveBudgetMax || 'M'}
                value={criteria.budgetMax}
                onChange={e => setCriteria(prev => ({ ...prev, budgetMax: e.target.value }))}
                disabled={criteria.considerBudget === 'ignorar'}
                className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white disabled:opacity-40"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Atributo 1</span>
              <select value={criteria.statKey} onChange={e => setCriteria(prev => ({ ...prev, statKey: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                {statOptions.map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Min 1</span>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Ej. 80"
                value={criteria.statMin}
                onChange={e => setCriteria(prev => ({ ...prev, statMin: e.target.value }))}
                className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Atributo 2 opcional</span>
              <select value={criteria.statKey2} onChange={e => setCriteria(prev => ({ ...prev, statKey2: e.target.value, statMin2: e.target.value ? prev.statMin2 : '' }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
                <option value="">Sin segundo atributo</option>
                {statOptions.filter(key => key !== criteria.statKey).map(key => <option key={key} value={key}>{STAT_NAMES_MAP[key] || key}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-bold text-gray-500">Min 2</span>
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Ej. 75"
                value={criteria.statMin2}
                onChange={e => setCriteria(prev => ({ ...prev, statMin2: e.target.value }))}
                disabled={!criteria.statKey2}
                className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white disabled:opacity-40"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-bold text-gray-500">Habilidad especial</span>
            <select value={criteria.traitKey} onChange={e => setCriteria(prev => ({ ...prev, traitKey: e.target.value }))} className="w-full min-h-11 bg-black/40 border border-white/10 rounded-lg px-3 text-sm text-white">
              <option value="">Sin habilidad puntual</option>
              {Object.entries(PLAYER_SKILLS_MAP).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-100/80">
            <p className="font-black text-emerald-200 mb-1">Diferencias entre ojeadores</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {scouts.map(scout => (
                <div key={scout.id} className="rounded-lg bg-black/20 border border-white/10 p-2">
                  <p className="font-black text-white">{scout.name} - Q{scout.quality}</p>
                  <p className="text-emerald-300">{scout.specialty}</p>
                  <p className="text-gray-400 mt-1">{scout.description || 'Mayor calidad significa menos variacion y mejores coincidencias.'}</p>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex items-center gap-3 text-gray-400 text-sm font-bold">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" />
              Cargando busquedas scout...
            </div>
          ) : searches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <Search className="w-10 h-10 mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500 font-bold">Todavia no mandaste ningun scout.</p>
            </div>
          ) : searches.map(search => (
            <div key={search.id} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5">
                <div>
                  <p className="text-sm font-black text-white">{search.scoutName || 'Scout'} <span className="text-emerald-400">Q{search.scoutQuality || '-'}</span></p>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {search.status === 'searching' ? getTimeLeft(search.resolvesAt) : search.status === 'done' ? 'Resultados listos' : 'Descartada'}
                  </p>
                </div>
                {search.status !== 'dismissed' && (
                  <button onClick={() => dismissSearch(search.id)} className="min-h-11 px-3 rounded-lg text-xs font-black text-red-300 hover:bg-red-500/10 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Descartar
                  </button>
                )}
              </div>

              {search.status === 'done' && (search.results || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                  {search.results.map(player => {
                    const isWatchlisted = wishlistSet?.has(player.Id);
                    return (
                      <div key={player.Id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="flex items-center gap-3">
                          <img src={`/fotos_jugadores/${player.Id}.webp`} alt={player.Name} className="w-12 h-12 rounded-lg object-cover bg-gray-900" onError={e => { e.target.src = `https://placehold.co/48x48/111/333?text=${player.Name?.[0] || '?'}`; }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-white truncate">{player.Name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200">{player.POS_NOMBRE}</span>
                              <img src={getFlagUrl(player.Country1)} alt="" className="w-4 h-3 rounded-sm" onError={e => { e.target.style.display = 'none'; }} />
                              <span className="text-xs text-gray-500">{player.Age} anos</span>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-black">{player.OVR_CALCULADO}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                          <span>Vel {player.Speed || '-'}</span>
                          <span>Fin {player.Finishing || '-'}</span>
                          <span>{formatPriceShort(player.Precio)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button disabled={isWatchlisted} onClick={() => onAddToWatchlist(player.Id)} className="min-h-11 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-xs font-black text-white flex items-center justify-center gap-1">
                            <Star className="w-4 h-4" /> {isWatchlisted ? 'En watchlist' : 'Watchlist'}
                          </button>
                          <button onClick={() => onPlayerClick(player)} className="min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white flex items-center justify-center gap-1">
                            <UserPlus className="w-4 h-4" /> Negociar
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
