import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { APP_ID } from '../utils/constants.js';
import { isTeamApproved } from '../supabase/functions/_shared/membership.js';
import { LEAGUE_CONTENT_COLLECTION } from '../utils/leagueContent.js';
import { parseMatchDoc } from '../utils/matchCenter.js';

/* Live, public data for the league site (screens/league/). Both paths are public-read in firestore.rules. */

const sortByName = (a, b) => String(a.teamName || '').localeCompare(String(b.teamName || ''), 'es');

/**
 * The league's clubs: every approved draft team, by name.
 * @returns {{ teams: Array<object>, teamsById: Record<string, object>, loading: boolean, error: string }}
 */
export function useLeagueTeams() {
  const [state, setState] = useState({ teams: [], loading: true, error: '' });

  useEffect(() => onSnapshot(
    collection(db, `artifacts/${APP_ID}/public/data/teams`),
    (snap) => {
      const teams = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(team => isTeamApproved(team) && String(team.teamName || '').trim())
        .sort(sortByName);
      setState({ teams, loading: false, error: '' });
    },
    (err) => {
      console.error('[useLeagueTeams]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los equipos.' }));
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

  useEffect(() => onSnapshot(
    doc(db, `artifacts/${APP_ID}/public/data/tournament/official`),
    (snap) => setState({ tournament: snap.exists() ? snap.data() : null, loading: false, error: '' }),
    (err) => {
      console.error('[useTournament]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudo cargar el torneo.' }));
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
 */
function usePublicDoc(path, label) {
  const [state, setState] = useState({ path, data: null, loading: Boolean(path), error: '' });
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, loading: false, error: '' });
      return undefined;
    }
    setState({ path, data: null, loading: true, error: '' });
    return onSnapshot(
      doc(db, path),
      (snap) => setState({ path, data: snap.exists() ? snap.data() : null, loading: false, error: '' }),
      (err) => {
        console.error(`[${label}]`, err);
        setState({ path, data: null, loading: false, error: 'No se pudo cargar.' });
      },
    );
  }, [path, label]);
  return state.path === path ? state : { path, data: null, loading: Boolean(path), error: '' };
}

const PUBLIC_DATA = `artifacts/${APP_ID}/public/data`;

/** El overlay de OBS: dice qué partido del fixture está al aire (para la predicción). */
export const useBroadcastOverlay = () => usePublicDoc(`${PUBLIC_DATA}/broadcast/overlay`, 'useBroadcastOverlay');

/** Totales de la predicción de un partido del fixture (los escribe la función community-vote). */
export const usePrediction = matchId => usePublicDoc(matchId ? `${PUBLIC_DATA}/predictions/${matchId}` : null, 'usePrediction');

/** Totales del MVP de un partido en vivo. */
export const useMvpVotes = matchKey => usePublicDoc(matchKey ? `${PUBLIC_DATA}/mvp_votes/${matchKey}` : null, 'useMvpVotes');

/** Todos los totales de MVP, por matchKey: el Jugador del Torneo (utils/playerOfTournament.js) los suma. */
export function useAllMvpVotes() {
  const [state, setState] = useState({ byMatchKey: {}, loading: true, error: '' });
  useEffect(() => onSnapshot(
    collection(db, `${PUBLIC_DATA}/mvp_votes`),
    (snap) => setState({ byMatchKey: Object.fromEntries(snap.docs.map(d => [d.id, d.data()])), loading: false, error: '' }),
    (err) => {
      console.error('[useAllMvpVotes]', err);
      setState(prev => ({ ...prev, loading: false, error: 'No se pudieron cargar los votos.' }));
    },
  ), []);
  return state;
}

/** Equipos del juego → clubes del torneo (los elige el admin al importar partidos del colector). */
export const usePesTeamMap = () => usePublicDoc(`${PUBLIC_DATA}/config/pesTeamMap`, 'usePesTeamMap');

/** Encuesta «¿quién gana la copa?» (utils/communityView.js CUP_POLLS): la abre el admin, los votos los suma la función. */
export const usePoll = pollId => usePublicDoc(pollId ? `${PUBLIC_DATA}/polls/${pollId}` : null, 'usePoll');
