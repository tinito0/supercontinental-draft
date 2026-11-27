import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebaseCore.js';
import { APP_ID } from '../utils/constants.js';
import { isTeamApproved } from '../supabase/functions/_shared/membership.js';
import { LEAGUE_CONTENT_COLLECTION } from '../utils/leagueContent.js';
import { parseMatchDoc } from '../utils/matchCenter.js';
import { franchiseByTeam, franchiseIdsOf } from '../utils/franchisePlayers.js';
import { OFFLINE_MESSAGE } from '../utils/leagueDataErrors.js';
import { retryDelay } from '../utils/retryDelay.js';
// The market catalog (id → price, age, OVR, name, position): ~0.4 MB gzipped against 2.3 MB for the full one.
import marketCatalogUrl from '../supabase/functions/_shared/catalog.json?url';

/* Live, public data for the league site (screens/league/). Both paths are public-read in firestore.rules. */

const FRANCHISE_INDEX_URL = '/franchise-index.json';

const sortByName = (a, b) => String(a.teamName || '').localeCompare(String(b.teamName || ''), 'es');

/** How long a listener may stay silent before the page says the connection is the problem. */
export const OFFLINE_TIMEOUT_MS = 10000;
export { OFFLINE_MESSAGE };

/** A snapshot served from the local cache that has nothing in it: Firestore has not heard from the server yet. */
function isUnansweredCacheSnapshot(snap) {
  if (!snap?.metadata?.fromCache) return false;
  if (typeof snap.exists === 'function') return !snap.exists();
  return snap.empty === true;
}

/**
 * Wraps an onSnapshot subscription so the page never waits forever. Offline with an empty cache Firestore either
 * stays silent or answers from the cache with nothing: neither is data, so `onOffline` fires after
 * OFFLINE_TIMEOUT_MS. A later real snapshot still reaches `onData` (which should clear the error).
 * @param {(next: Function, error: Function) => Function} subscribe receives the guarded callbacks, returns the unsubscribe
 * @param {{ onData: Function, onError: Function, onOffline: Function }} handlers
 * @returns {() => void} cleanup
 */
export function listenWithOfflineGuard(subscribe, { onData, onError, onOffline }) {
  let answered = false;
  const timer = setTimeout(() => { if (!answered) onOffline(); }, OFFLINE_TIMEOUT_MS);
  const unsubscribe = subscribe(
    (snap) => {
      if (isUnansweredCacheSnapshot(snap)) return;
      answered = true;
      clearTimeout(timer);
      onData(snap);
    },
    (err) => {
      answered = true;
      clearTimeout(timer);
      onError(err);
    },
  );
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/** Offline state for a hook's `setState`: stops the skeletons and says why, keeping whatever data it had. */
/* Without metadata changes Firestore never reports the server confirming an empty result it already had from
   the cache, so the guard would wait for an answer that never comes (useFirebaseData.js does the same). */
const METADATA = { includeMetadataChanges: true };

const offlineState = prev => ({ ...prev, loading: false, error: OFFLINE_MESSAGE });

/**
 * The league's clubs: every approved draft team, by name.
 * @returns {{ teams: Array<object>, teamsById: Record<string, object>, loading: boolean, error: string }}
 */
export function useLeagueTeams() {
  const [state, setState] = useState({ teams: [], loading: true, error: '' });

  useEffect(() => listenWithOfflineGuard(
    (next, error) => onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/teams`), METADATA, next, error),
    {
      onData: (snap) => {
        const teams = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(team => isTeamApproved(team) && String(team.teamName || '').trim())
          .sort(sortByName);
        setState({ teams, loading: false, error: '' });
      },
      onError: (err) => {
        console.error('[useLeagueTeams]', err);
        setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los equipos.' }));
      },
      onOffline: () => setState(offlineState),
    },
  ), []);

  // TournamentModal expects the app's shape: an object keyed by team id.
  const teamsById = useMemo(
    () => Object.fromEntries(state.teams.map(team => [team.id, team])),
    [state.teams],
  );

  return { ...state, teamsById };
}

/**
 * One text of the league site written in Administración → Web pública (utils/leagueContent.js).
 * `content` is null until the admin saves it for the first time.
 * @param {string|null} docId null skips the read (e.g. the club id is not known yet)
 * @returns {{ content: object|null, loading: boolean, error: string }}
 */
export function useLeagueContent(docId) {
  const [state, setState] = useState({ content: null, loading: Boolean(docId), error: '' });

  useEffect(() => {
    if (!docId) {
      setState({ content: null, loading: false, error: '' });
      return undefined;
    }
    setState(prev => ({ ...prev, loading: true }));
    return onSnapshot(
      doc(db, `artifacts/${APP_ID}/public/data/${LEAGUE_CONTENT_COLLECTION}`, docId),
      (snap) => setState({ content: snap.exists() ? snap.data() : null, loading: false, error: '' }),
      (err) => {
        console.error(`[useLeagueContent:${docId}]`, err);
        setState({ content: null, loading: false, error: 'No se pudo cargar este texto.' });
      },
    );
  }, [docId]);

  return state;
}

/**
 * The official tournament document (standings, brackets, scorers).
 * @returns {{ tournament: object|null, loading: boolean, error: string }}
 */
export function useTournament() {
  const [state, setState] = useState({ tournament: null, loading: true, error: '' });

  useEffect(() => listenWithOfflineGuard(
    (next, error) => onSnapshot(doc(db, `artifacts/${APP_ID}/public/data/tournament/official`), METADATA, next, error),
    {
      onData: snap => setState({ tournament: snap.exists() ? snap.data() : null, loading: false, error: '' }),
      onError: (err) => {
        console.error('[useTournament]', err);
        setState(prev => ({ ...prev, loading: false, error: 'No se pudo cargar el torneo.' }));
      },
      onOffline: () => setState(offlineState),
    },
  ), []);

  return state;
}

const LIVE_MATCHES = `artifacts/${APP_ID}/public/data/live_matches`;
const MATCH_LIST_LIMIT = 40;
/** Tope para lo que suma toda la temporada (Jugador del Torneo): una temporada tiene unos 40 partidos oficiales. */
export const SEASON_MATCH_LIMIT = 300;

/**
 * Partidos que subió el bridge del PES (registro de partidos), los más nuevos primero, en vivo.
 * @param {number} [max] cuántos partidos traer (los más nuevos)
 * @returns {{ matches: Array<object>, loading: boolean, error: string }} matches ya pasados por parseMatchDoc
 */
export function useLiveMatches(max = MATCH_LIST_LIMIT) {
  const [state, setState] = useState({ matches: [], loading: true, error: '' });

  useEffect(() => onSnapshot(
    query(collection(db, LIVE_MATCHES), orderBy('startedAt', 'desc'), limit(max)),
    (snap) => setState({ matches: snap.docs.map(d => parseMatchDoc(d.data())).filter(Boolean), loading: false, error: '' }),
    (err) => {
      console.error('[useLiveMatches]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los partidos.' }));
    },
  ), [max]);

  return state;
}

/**
 * Un partido, actualizado en vivo mientras se juega.
 * @returns {{ match: object|null, loading: boolean, error: string }}
 */
export function useLiveMatch(matchKey) {
  const [state, setState] = useState({ match: null, loading: true, error: '' });

  useEffect(() => {
    if (!matchKey) return undefined;
    setState({ match: null, loading: true, error: '' });
    return onSnapshot(
      doc(db, LIVE_MATCHES, matchKey),
      (snap) => setState({ match: snap.exists() ? parseMatchDoc(snap.data()) : null, loading: false, error: '' }),
      (err) => {
        console.error('[useLiveMatch]', err);
        setState(prev => ({ ...prev, loading: false, error: 'No se pudo cargar el partido.' }));
      },
    );
  }, [matchKey]);

  return state;
}

/**
 * Un doc público en vivo (overlay, predicción o votos del MVP); null si no existe o si no hay path.
 * El estado recuerda de qué path es: al cambiar de partido no se muestran los datos del anterior mientras llega el nuevo.
 * Un error de lectura no es definitivo: se vuelve a suscribir con espera creciente (2 s … 30 s) y conserva los últimos
 * datos mientras tanto.
 */
function usePublicDoc(path, label) {
  const [state, setState] = useState({ path, data: null, loading: Boolean(path), error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [path]);
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, loading: false, error: '' });
      return undefined;
    }
    setState(prev => (prev.path === path ? prev : { path, data: null, loading: true, error: '' }));
    let retryTimer = null;
    const unsubscribe = onSnapshot(
      doc(db, path),
      (snap) => {
        setAttempt(0);
        setState({ path, data: snap.exists() ? snap.data() : null, loading: false, error: '' });
      },
      (err) => {
        console.error(`[${label}]`, err);
        setState(prev => ({ path, data: prev.path === path ? prev.data : null, loading: false, error: 'No se pudo cargar.' }));
        retryTimer = setTimeout(() => setAttempt(n => n + 1), retryDelay(attempt + 1));
      },
    );
    return () => {
      clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [path, label, attempt]);
  return state.path === path ? state : { path, data: null, loading: Boolean(path), error: '' };
}

const PUBLIC_DATA = `artifacts/${APP_ID}/public/data`;

/** El overlay de OBS: dice qué partido del fixture está al aire (para la predicción). */
export const useBroadcastOverlay = () => usePublicDoc(`${PUBLIC_DATA}/broadcast/overlay`, 'useBroadcastOverlay');

/** Totales de la predicción de un partido del fixture (los escribe la función community-vote). */
export const usePrediction = matchId => usePublicDoc(matchId ? `${PUBLIC_DATA}/predictions/${matchId}` : null, 'usePrediction');

/**
 * Votos del manager de la fecha, todas las fechas (pocas por temporada), por id «fecha-n». Los escribe la función
 * community-vote; /en-vivo muestra la fecha abierta y el manager del torneo (utils/managerOfTournament.js) los suma.
 */
export function useManagerVotes() {
  const [state, setState] = useState({ byRoundId: {}, loading: true, error: '' });
  useEffect(() => onSnapshot(
    collection(db, `${PUBLIC_DATA}/manager_votes`),
    (snap) => setState({ byRoundId: Object.fromEntries(snap.docs.map(d => [d.id, d.data()])), loading: false, error: '' }),
    (err) => {
      console.error('[useManagerVotes]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los votos.' }));
    },
  ), []);
  return state;
}

/** Equipos del juego → clubes del torneo (los elige el admin al importar partidos del colector). */
export const usePesTeamMap = () => usePublicDoc(`${PUBLIC_DATA}/config/pesTeamMap`, 'usePesTeamMap');

/** Encuesta «¿quién gana la copa?» (utils/communityView.js CUP_POLLS): la abre el admin, los votos los suma la función. */
export const usePoll = pollId => usePublicDoc(pollId ? `${PUBLIC_DATA}/polls/${pollId}` : null, 'usePoll');

/** Fichas de todos los clubes (league_content/club-{teamId}.profile), por teamId: la página Equipos muestra estadio y mánager. */
export function useClubProfiles() {
  const [state, setState] = useState({ byTeamId: {}, loading: true, error: '' });
  useEffect(() => listenWithOfflineGuard(
    (next, error) => onSnapshot(collection(db, `${PUBLIC_DATA}/${LEAGUE_CONTENT_COLLECTION}`), METADATA, next, error),
    {
      onData: snap => setState({
        byTeamId: Object.fromEntries(snap.docs.filter(d => d.id.startsWith('club-') && d.data()?.profile).map(d => [d.id.slice('club-'.length), d.data().profile])),
        loading: false,
        error: '',
      }),
      onError: (err) => {
        console.error('[useClubProfiles]', err);
        setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar las fichas de los clubes.' }));
      },
      onOffline: () => setState(offlineState),
    },
  ), []);
  return state;
}

/**
 * Líneas por jugador de cada partido (match_lines, las escribe match-feed): lo que suman las estadísticas de temporada.
 * @returns {{ docs: Array<object>, loading: boolean, error: string }}
 */
export function useMatchLines() {
  const [state, setState] = useState({ docs: [], loading: true, error: '' });
  useEffect(() => onSnapshot(
    query(collection(db, `${PUBLIC_DATA}/match_lines`), orderBy('startedAt', 'desc'), limit(SEASON_MATCH_LIMIT)),
    (snap) => setState({ docs: snap.docs.map(d => d.data()), loading: false, error: '' }),
    (err) => {
      console.error('[useMatchLines]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar las estadísticas.' }));
    },
  ), []);
  return state;
}

let franchiseIndexPromise = null;
/** Small subset of the catalog with the possible franchise players, built by scripts/build-franchise-index.mjs. */
export function loadFranchiseIndex() {
  if (!franchiseIndexPromise) {
    franchiseIndexPromise = fetch(FRANCHISE_INDEX_URL)
      .then(response => {
        if (!response.ok) throw new Error(`Índice de franquicias no disponible (${response.status})`);
        return response.json();
      })
      .catch(err => {
        franchiseIndexPromise = null;
        throw err;
      });
  }
  return franchiseIndexPromise;
}

let marketCatalogPromise = null;
/** Fetched once per page load and shared; a failed fetch is retried on the next call. */
export function loadMarketCatalog() {
  if (!marketCatalogPromise) {
    marketCatalogPromise = fetch(marketCatalogUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Catálogo no disponible (${response.status})`);
        return response.json();
      })
      .catch(err => {
        marketCatalogPromise = null;
        throw err;
      });
  }
  return marketCatalogPromise;
}

/**
 * Jugador Franquicia of every club, by teamId (utils/franchisePlayers.js): the public franchise locks, with name,
 * position and OVR from the market catalog once it loads (until then, and if it fails, only the id and photo).
 */
export function useFranchisePlayers() {
  const [state, setState] = useState({ locks: [], loading: true, error: '' });
  const [catalog, setCatalog] = useState(null);

  useEffect(() => listenWithOfflineGuard(
    (next, error) => onSnapshot(query(collection(db, `${PUBLIC_DATA}/player_locks`), where('isFranchise', '==', true)), METADATA, next, error),
    {
      onData: snap => setState({ locks: snap.docs.map(d => ({ id: d.id, ...d.data() })), loading: false, error: '' }),
      onError: (err) => {
        console.error('[useFranchisePlayers]', err);
        setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los jugadores franquicia.' }));
      },
      onOffline: () => setState(offlineState),
    },
  ), []);

  // The home only needs the few rows a franchise player can be (public/franchise-index.json, ~6 kB). The full
  // catalog is fetched only when a lock is not in the index (or the index is missing), so the names still show.
  const franchiseIdsKey = useMemo(() => [...franchiseIdsOf(state.locks)].sort().join(','), [state.locks]);
  useEffect(() => {
    if (!franchiseIdsKey) return undefined;
    let active = true;
    const ids = franchiseIdsKey.split(',');
    loadFranchiseIndex()
      .catch(err => { console.warn('[useFranchisePlayers] índice', err); return null; })
      .then(index => {
        if (!active) return null;
        if (index) setCatalog(index);
        if (index && ids.every(id => index[id])) return null;
        return loadMarketCatalog().then(data => { if (active) setCatalog(data); });
      })
      .catch(err => console.error('[useFranchisePlayers] catálogo', err));
    return () => { active = false; };
  }, [franchiseIdsKey]);

  const byTeamId = useMemo(() => franchiseByTeam(state.locks, catalog), [state.locks, catalog]);
  return { byTeamId, loading: state.loading, error: state.error };
}
