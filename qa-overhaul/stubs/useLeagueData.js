// QA stub of hooks/useLeagueData.js: returns the scenario chosen with ?data= (qa-overhaul/mockData.js).
import { parseLive, scenario, teams, teamsById } from '../mockData.js';

const params = new URLSearchParams(window.location.search);
const state = scenario(params.get('data') || 'cups');
const loading = params.get('loading') === '1';
const failing = params.get('error') === '1';
const live = parseLive(state.liveDocs);

export const useLeagueTeams = () => ({ teams: loading ? [] : teams, teamsById: loading ? {} : teamsById, loading, error: failing ? 'No se pudieron cargar los equipos.' : '' });
export const useLeagueContent = id => ({ content: String(id || '').startsWith('club-') && params.get('profiles') ? { body: 'Fundado por un grupo de amigos del barrio, el club se hizo fuerte en la quinta.\n\nGanó la primera Supercontinental en 2025.', profile: sampleProfile } : params.get('history') ? { body: 'La Supercontinental nació en 2024 entre amigos que jugaban al PES todos los viernes.\n\nLa primera temporada se jugó en una quinta, con doce clubes y un sistema suizo.' } : null, loading: false, error: '' });
export const useTournament = () => ({ tournament: loading ? null : state.tournament, loading, error: failing ? 'No se pudo cargar el torneo.' : '' });
export const useLiveMatches = () => ({ matches: loading ? [] : live, loading, error: '' });
export const useLiveMatch = key => ({ match: live.find(m => m.key === key) || null, loading: false, error: '' });
export const useBroadcastOverlay = () => ({ data: state.overlay, loading: false, error: '' });
export const usePrediction = id => ({ data: id ? { votes: { home: 12, draw: 5, away: 7 }, homeTeam: '', awayTeam: '' } : null, loading: false, error: '' });
export const useMvpVotes = () => ({ data: null, loading: false, error: '' });
export const useAllMvpVotes = () => ({ byMatchKey: {}, loading: false, error: '' });
export const usePesTeamMap = () => ({ data: null, loading: false, error: '' });
export const usePoll = () => ({ data: null, loading: false, error: '' });
export const SEASON_MATCH_LIMIT = 300;
const sampleProfile = { nickname: 'El Santo', city: 'Rosario', country: 'Argentina', founded: '1921', stadium: 'Estadio Gigante de la Cabeza', capacity: '41.500', coach: 'Ramiro Gómez', president: 'Marta Díaz', manager: 'Santi L.', captain: 'Iván Ferreyra', colors: 'Rojo y negro', stadiumPhotoUrl: params.get('photo') ? '/Capa%201.webp' : '', honours: [{ id: 'a', scope: 'supercontinental', name: 'Supercontinental League', count: 1, years: '2025' }, { id: 'b', scope: 'nacional', name: 'Liga Profesional', count: 3, years: '2019, 2021, 2023' }, { id: 'c', scope: 'nacional', name: 'Copa Argentina', count: 2, years: '2018, 2022' }, { id: 'd', scope: 'internacional', name: 'Copa Sudamericana', count: 1, years: '2020' }], seasons: [{ id: 's1', season: '2025', competition: 'Supercontinental League', result: 'Campeón', played: '8', won: '6', drawn: '1', lost: '1', goalsFor: '17', goalsAgainst: '6' }, { id: 's2', season: '2024', competition: 'Supercontinental League', result: 'Semifinal Copa de Oro', played: '7', won: '4', drawn: '1', lost: '2', goalsFor: '12', goalsAgainst: '9' }] };
export const useClubProfiles = () => ({ byTeamId: params.get('profiles') ? Object.fromEntries(teams.slice(0, 6).map(t => [t.id, sampleProfile])) : {}, loading: false, error: '' });
