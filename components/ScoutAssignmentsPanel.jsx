import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, runTransaction, Timestamp } from 'firebase/firestore';
import { HelpCircle, Loader2, Search } from 'lucide-react';
import { APP_ID, PLAYER_SKILLS_MAP, REGIONES, STAT_NAMES_MAP } from '../utils/constants.js';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Alert } from './ui/Alert.jsx';
import { Button } from './ui/Button.jsx';
import { Tabs, tabPanelProps } from './ui/Tabs.jsx';
import { buildResultsAsync, positionGroups, RESULT_COUNT_MIN, RESULT_COUNT_MAX } from '../utils/scoutEngine.js';
import { PLAYING_STYLE_GROUPS, PLAYING_STYLE_POSITIONS } from '../utils/playerGlossary.js';
import { toMillis } from '../utils/scoutView.js';
import { ScoutGuidedTutorial, SCOUT_TUTORIAL_STEPS } from './scouting/ScoutGuidedTutorial.jsx';
import { ScoutPicker, scoutDurationLabel } from './scouting/ScoutPicker.jsx';
import { ScoutSearchList } from './scouting/ScoutSearchList.jsx';

const MONTHLY_SEARCH_LIMIT = 5;

const DEFAULT_SCOUTS = [
  { id: 'scout-rapido', name: 'Tomás Ibarra', quality: 58, durationHours: 1 / 6, specialty: 'Respuesta rápida', description: 'Vuelve rápido, pero puede traer jugadores con más variación respecto a lo pedido.' },
  { id: 'scout-equilibrado', name: 'Martín Sosa', quality: 74, durationHours: 1 / 3, specialty: 'Búsqueda confiable', description: 'Buen balance entre tiempo y precisión. Ideal para búsquedas normales.' },
  { id: 'fefe-farfan', name: 'Fefe Farfan', quality: 98, durationHours: 0.5, imageUrl: '/scouts/fefe-farfan.webp', specialty: 'Élite total', description: 'El mejor ojeador de todos. Tarda más porque filtra fino y prioriza coincidencias premium.' },
  { id: 'scout-test', name: 'Ojeador de Prueba', quality: 98, durationHours: 16, testDurationSeconds: 1, specialty: 'Prueba instantánea', description: 'Funciona como Fefe Farfan, pero vuelve en 1 segundo para probar resultados. Solo lo ve el admin.' },
];


const attentionOptions = [
  { id: 'overall', label: 'Valoración general' },
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
  playingStyle: '',
};

const STYLE_GROUPS = PLAYING_STYLE_GROUPS.filter(group => !group.styles.includes('Ninguno'));

/** Zone of the field a playing style belongs to, from its first position (Lateral Ofensivo → Defensor). */
function zoneForStyle(style) {
  const firstPosition = PLAYING_STYLE_POSITIONS[style]?.[0];
  return Object.keys(positionGroups).find(group => positionGroups[group].includes(firstPosition)) || '';
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function makeCriteriaFingerprint(scoutId, criteria) {
  return `${scoutId}:${JSON.stringify(criteria)}`;
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
  const [usageLoaded, setUsageLoaded] = useState(false);
  const [searchesError, setSearchesError] = useState(false);
  const [usageError, setUsageError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [view, setView] = useState('new');
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
    setIsLoading(true);
    setSearchesError(false);
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
      console.error('Error cargando búsquedas:', error);
      setSearchesError(true);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [db, scoutSearchesRef, userId, readAttempt]);

  useEffect(() => {
    if (!scoutUsageRef) return undefined;
    setUsageLoaded(false);
    setUsageError(false);
    const unsubscribe = onSnapshot(scoutUsageRef, (snap) => {
      setMonthlyUsage(Number(snap.data()?.count || 0));
      setUsageLoaded(true);
    }, (error) => {
      console.error('Error cargando cupo de búsquedas:', error);
      setUsageError(true);
    });
    return () => unsubscribe();
  }, [scoutUsageRef, readAttempt]);

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
        try {
          const results = await buildResultsAsync({ allPlayers, criteria: search.criteria || {}, scout, playerLocks });
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
            text: `Ojeador listo: ${scout.name} trajo ${results.length} candidatos para revisar.`,
            time: 'Scouting',
          });
        } catch (error) {
          console.error('Error resolviendo búsqueda:', error);
          // Not in the effect deps on purpose: a new callback identity must not re-trigger retries.
          showStatusMessage?.('error', 'No se pudo completar la búsqueda del ojeador. Se reintenta al reabrir la pestaña.');
        } finally {
          resolvingRef.current.delete(search.id);
        }
      });
  }, [addNotification, allPlayers, clockTick, db, playerLocks, scoutSearchesRef, searches, scouts, userId]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!scoutSearchesRef || isCreatingRef.current) return;
    if (monthlyUsage >= MONTHLY_SEARCH_LIMIT) {
      showStatusMessage?.('error', `Ya usaste las ${MONTHLY_SEARCH_LIMIT} búsquedas de este mes.`);
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
      playingStyle: criteria.playingStyle,
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
      setView('mine');
      showStatusMessage?.('success', scout.testDurationSeconds ? 'Búsqueda de prueba creada. Volvé en 1 segundo.' : `Búsqueda creada. Volvé en ${scoutDurationLabel(scout)}.`);
    } catch (error) {
      console.error('Error creando búsqueda:', error);
      if (error.message === 'scout-limit-reached') {
        showStatusMessage?.('error', `Ya usaste las ${MONTHLY_SEARCH_LIMIT} búsquedas de este mes.`);
      } else if (error.message === 'scout-search-duplicate') {
        showStatusMessage?.('error', 'Ya tenés una búsqueda idéntica en curso.');
      } else {
        showStatusMessage?.('error', 'No se pudo crear la búsqueda.');
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
      console.error('Error descartando búsqueda:', error);
    }
  };

  const readFailed = searchesError || usageError;
  const quotaKnown = usageLoaded && !usageError;
  const quotaFull = quotaKnown && monthlyUsage >= MONTHLY_SEARCH_LIMIT;
  const fieldLabel = 'field-label';

  return (
    <Page className="pb-24">
      <PageHeader
        eyebrow="Mi club"
        title="Scouting"
        description="Mandá ojeadores a buscar jugadores con los criterios que elijas. Cada búsqueda cuenta para tu cupo del mes."
        actions={(
          <>
            {quotaKnown && (
              <span className={`text-sm ${quotaFull ? 'text-danger-soft' : 'text-ink-3'}`}>
                Cupo del mes: <span className="num font-semibold text-ink">{monthlyUsage}/{MONTHLY_SEARCH_LIMIT}</span>
              </span>
            )}
            <button type="button" onClick={() => { setView('new'); setIsGuideOpen(true); }} className="btn btn-secondary min-h-11">
              <HelpCircle className="w-4 h-4" aria-hidden="true" />Cómo funciona
            </button>
          </>
        )}
      />

      {readFailed && (
        <Alert
          tone="danger"
          title="No pudimos cargar tus búsquedas"
          action={<Button className="min-h-11" onClick={() => setReadAttempt(n => n + 1)}>Reintentar</Button>}
        >
          No sabemos cuántas búsquedas te quedan este mes. Reintentá en unos segundos.
        </Alert>
      )}

      {quotaFull && (
        <Alert tone="danger" title="Cupo mensual agotado">
          Usaste las {MONTHLY_SEARCH_LIMIT} búsquedas de este mes. El cupo se restablece el 1.º del mes que viene.
        </Alert>
      )}

      <Tabs
        idPrefix="scout"
        label="Scouting"
        value={view}
        onChange={setView}
        tabs={[
          { id: 'new', label: 'Nueva búsqueda' },
          { id: 'mine', label: 'Mis búsquedas', count: searches.length },
        ]}
      />

      {view === 'new' && (
      <form {...tabPanelProps('scout', 'new')} onSubmit={handleCreate} className="panel p-4 sm:p-6 space-y-6">
        <div>
          <h2 id="scout-form-title" className="section-title">Nueva búsqueda</h2>
          <p className="text-xs text-ink-3 mt-1">
            {selectedScout?.testDurationSeconds ? 'Este ojeador de prueba vuelve en 1 segundo.' : `El resultado llega cuando termina el trabajo de ${scoutDurationLabel(selectedScout)}.`}
          </p>
        </div>

        <fieldset data-scout-target="scout-picker">
          <legend className="eyebrow mb-3">Ojeador</legend>
          <ScoutPicker scouts={scouts} selectedId={selectedScoutId} onSelect={setSelectedScoutId} disabled={quotaFull} />
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
              <button type="button" onClick={() => setCriteria(prev => ({ ...prev, positions: [] }))} className="btn btn-ghost btn-sm min-h-11">Restablecer</button>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-line/[0.08] pt-5">
          <div data-scout-target="area" className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
          <label>
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
          </div>
          <label data-scout-target="budget">
            <span className={fieldLabel}>Presupuesto</span>
            <select value={criteria.considerBudget} onChange={e => setCriteria(prev => ({ ...prev, considerBudget: e.target.value }))} className="select">
              <option value="considerar">Solo los que puedo pagar</option>
              <option value="ignorar">Ignorar el presupuesto</option>
            </select>
          </label>
        </div>

        <div data-scout-target="attributes" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {[['minAge', 'Edad mín'], ['maxAge', 'Edad máx'], ['minOvr', 'Media mín'], ['maxOvr', 'Media máx']].map(([key, label]) => (
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <label>
            <span className={fieldLabel}>Estilo de juego</span>
            {/* Si la zona está vacía, el estilo la completa; si ya hay una elegida, se respeta. */}
            <select value={criteria.playingStyle}
              onChange={e => {
                const playingStyle = e.target.value;
                setCriteria(prev => ({
                  ...prev,
                  playingStyle,
                  positionGroup: prev.positionGroup || zoneForStyle(playingStyle),
                }));
              }}
              className="select">
              <option value="">Cualquier estilo</option>
              {STYLE_GROUPS.map(group => (
                <optgroup key={group.title} label={group.title}>
                  {group.styles.map(style => <option key={style} value={style}>{style}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="block mt-1 text-2xs text-ink-3">Prioriza ese estilo; si hay pocos, completa con otros.</span>
          </label>
        </div>

        <div data-scout-target="submit" className="border-t border-line/[0.08] pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-ink-3">
            {!quotaKnown ? 'Cuenta como 1 búsqueda del mes.' : quotaFull ? `Ya usaste las ${MONTHLY_SEARCH_LIMIT} búsquedas de este mes.` : `Cuenta como 1 de tus ${MONTHLY_SEARCH_LIMIT} búsquedas del mes (${monthlyUsage} usadas).`}
          </p>
          <button type="submit" disabled={isCreating || quotaFull || readFailed}
            title={isCreating ? 'Hay una operación en curso' : quotaFull ? 'Ya usaste las búsquedas de este mes' : undefined}
            className="btn btn-primary btn-lg w-full sm:w-auto">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
            {isCreating ? 'Enviando ojeador…' : quotaFull ? 'Cupo agotado' : 'Enviar ojeador'}
          </button>
        </div>
      </form>
      )}

      {view === 'mine' && (
        <section {...tabPanelProps('scout', 'mine')} aria-label="Mis búsquedas">
          <ScoutSearchList
            searches={searches}
            isLoading={isLoading}
            hasError={searchesError}
            userId={userId}
            allPlayers={allPlayers}
            playerLocks={playerLocks}
            wishlistSet={wishlistSet}
            onDismiss={dismissSearch}
            onAddToWatchlist={onAddToWatchlist}
            onPlayerClick={onPlayerClick}
          />
        </section>
      )}

      <ScoutGuidedTutorial steps={SCOUT_TUTORIAL_STEPS} isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </Page>
  );
});
