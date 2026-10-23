// QA-only mock league built with the real engine (finalizeTournament), so tables and pairings are genuine.
import { finalizeTournament } from '../components/tournament/tournamentEngine.js';
import { normalizeTournament } from '../utils/tournamentModel.js';
import { parseMatchDoc } from '../utils/matchCenter.js';

const CLUBS = [
  ['u01', 'Santa Cabeza', 'sta_cabeza'],
  ['u02', 'Esportivo Lusitano do Recife', 'esportivo_lusitano_do_recife'],
  ['u03', 'Falke Düsseldorf', 'falke_dusseldorf'],
  ['u04', 'Red Bull Lusail', 'red_bull_lusail'],
  ['u05', 'Sendai Ryu', 'sendai_ryu'],
  ['u06', 'SK Konya', 'sk_konya'],
  ['u07', 'Talleres', 'talleres'],
  ['u08', 'Dinamo Višegrad', 'dinamo_visegrad'],
  ['u09', 'Kaiser iz Varaždin', 'kaiser_iz_varazdin_1'],
  ['u10', 'Estudiantes de Tero Violado', 'estudiantes_de_tero_violado'],
  ['u11', 'Lourinhã', 'LOURINHA'],
  ['u12', 'Portland', null], // sin escudo: iniciales
];

export const teamsById = Object.fromEntries(CLUBS.map(([id, teamName, logo], i) => [id, {
  id, teamName, approved: true, logoUrl: logo ? `/Logos_equipos/${logo}.webp` : null, country: 204, budget: 300000000 - i * 1000000,
}]));
export const teams = Object.values(teamsById);
const names = CLUBS.map(([, name]) => name);

function play(match, n) {
  const [h, a] = [names.indexOf(match.homeTeam), names.indexOf(match.awayTeam)];
  const seed = (h * 7 + a * 3 + n) % 9;
  if (seed === 0) return { ...match, homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4, status: 'completed', homeGoals: 'Ronaldo', awayGoals: 'Haaland' };
  const homeWins = (h + seed) % 3 !== 0;
  return { ...match, homeScore: homeWins ? 2 + (seed % 2) : seed % 2, awayScore: homeWins ? seed % 2 : 2, status: 'completed', homeGoals: homeWins ? 'Messi x2' : '', awayGoals: homeWins ? '' : 'Mbappé x2' };
}

function season(roundsPlayed, { leaveOpen = 0 } = {}) {
  const roundOne = [];
  for (let i = 0; i < 12; i += 2) roundOne.push({ id: `f1-${i / 2 + 1}`, round: 'Fecha 1', homeTeam: names[i], awayTeam: names[i + 1], homeScore: '', awayScore: '', date: '2026-12-12', time: `${18 + (i / 2) % 3}:00`, status: 'scheduled' });
  let data = normalizeTournament({ league: names.map(name => ({ name })), matches: roundOne });
  for (let round = 1; round <= roundsPlayed; round += 1) {
    const isLast = round === roundsPlayed;
    let open = isLast ? leaveOpen : 0;
    data = {
      ...data,
      matches: data.matches.map(match => {
        if (match.round !== `Fecha ${round}`) return match;
        if (open > 0) { open -= 1; return { ...match, date: `2026-12-${12 + round * 7}`, time: '21:00' }; }
        return play({ ...match, date: `2026-12-${12 + round * 7 - 7}` }, round);
      }),
    };
    data = finalizeTournament(data).data;
  }
  return data;
}

const quarter = (a, b, sa, sb, pa = '', pb = '') => ({ teamA: a, teamB: b, scoreA: sa, scoreB: sb, penaltiesA: pa, penaltiesB: pb });

export function scenario(name) {
  if (name === 'empty') return { tournament: null, liveDocs: [], overlay: { scene: 'live' } };
  if (name === 'preseason') {
    const t = season(0);
    return { tournament: t, liveDocs: [], overlay: { scene: 'previa', matchId: 'league-f1-1' } };
  }
  if (name === 'live') {
    const t = season(2, { leaveOpen: 2 });
    const open = t.matches.filter(m => m.round === 'Fecha 2' && m.status !== 'completed');
    const live = liveDoc('20261219T210000Z_101-102', open[0].homeTeam, open[0].awayTeam, 'live', { home: 1, away: 0 });
    return { tournament: t, liveDocs: [live], overlay: { scene: 'live', matchId: `league-${open[0].id}`, liveMatchKey: live.matchKey } };
  }
  const t = season(4);
  const ranking = t.league.map(row => row.name);
  if (name === 'cups') {
    const quarters = [quarter(ranking[0], ranking[7], 3, 1), quarter(ranking[3], ranking[4], 1, 1, 3, 4), quarter(ranking[1], ranking[6], 2, 0), quarter(ranking[2], ranking[5], '', '')];
    const data = finalizeTournament({ ...t, bracket: { ...t.bracket, quarters } }).data;
    return { tournament: data, liveDocs: [], overlay: { scene: 'bracket' } };
  }
  // 'done': both cups complete.
  const won = (a, b, sa = 2, sb = 1) => quarter(a, b, sa, sb);
  let data = finalizeTournament({ ...t, bracket: { ...t.bracket, quarters: [won(ranking[0], ranking[7]), quarter(ranking[3], ranking[4], 0, 0, 5, 4), won(ranking[1], ranking[6]), won(ranking[2], ranking[5])] } }).data;
  const fill = (path, list) => {
    const b = JSON.parse(JSON.stringify(data.bracket));
    let node = b;
    path.slice(0, -1).forEach(k => { node = node[k]; });
    const leaf = path[path.length - 1];
    node[leaf] = Array.isArray(node[leaf]) ? node[leaf].map((m, i) => ({ ...m, ...(list[i] || {}) })) : { ...node[leaf], ...list[0] };
    data = finalizeTournament({ ...data, bracket: b }).data;
  };
  fill(['semis'], [{ scoreA: 1, scoreB: 0 }, { scoreA: 2, scoreB: 3 }]);
  fill(['final'], [{ scoreA: 2, scoreB: 2, penaltiesA: 4, penaltiesB: 2 }]);
  fill(['repechaje', 'r1'], [{ scoreA: 1, scoreB: 0 }, { scoreA: 0, scoreB: 2 }, { scoreA: 3, scoreB: 1 }, { scoreA: 1, scoreB: 2 }]);
  fill(['repechaje', 'r2'], [{ scoreA: 2, scoreB: 0 }, { scoreA: 1, scoreB: 1, penaltiesA: 3, penaltiesB: 5 }]);
  fill(['repechaje', 'semis'], [{ scoreA: 0, scoreB: 1 }, { scoreA: 2, scoreB: 1 }]);
  fill(['repechaje', 'final'], [{ scoreA: 1, scoreB: 0 }]);
  return { tournament: data, liveDocs: [], overlay: { scene: 'repechaje' } };
}

function liveDoc(matchKey, homeTeam, awayTeam, status, score) {
  const home = CLUBS.find(([, n]) => n === homeTeam);
  const away = CLUBS.find(([, n]) => n === awayTeam);
  return {
    matchKey, status, score,
    homeName: homeTeam, awayName: awayTeam, homeDraftTeamId: home[0], awayDraftTeamId: away[0],
    clock: { period: 2, minute: 62, second: 10 },
    updatedAt: { toMillis: () => Date.now() - 5000 },
    summaryJson: JSON.stringify(sampleSummary(score)),
  };
}

// 4-2-3-1 for both sides with real photo ids, a brace, a card and a change: only for the lineup pitch QA.
function sampleSummary(score) {
  const homeIds = [102913, 102914, 102915, 102916, 102922, 102927, 102928, 102942, 102945, 102947, 102948];
  const awayIds = [102949, 102950, 102951, 102966, 102967, 102968, 102969, 102971, 102972, 102975, 102977];
  const pos = [[3, 50], [18, 12], [16, 37], [16, 63], [18, 88], [28, 38], [28, 62], [38, 15], [38, 50], [38, 85], [47, 50]];
  const roles = [0, 4, 1, 1, 3, 5, 5, 9, 8, 10, 12];
  const names = Object.fromEntries([...homeIds, ...awayIds].map((id, i) => [id, ['Iván Ferreyra', 'Lucas Romero', 'Tomás Aguirre', 'Bruno Sosa', 'Matías Vera', 'Nico Paz', 'Joaquín Ledesma', 'Santi Rey', 'Franco Díaz', 'Leo Benítez', 'Mauro Quiroga'][i % 11] + (i >= 11 ? ' Jr' : '')]));
  const plan = ids => ({ status: 'matches', roles, pos, numbers: Object.fromEntries(ids.map((id, i) => [id, [1, 4, 2, 6, 3, 5, 8, 11, 10, 7, 9][i]])) });
  return {
    score,
    lineups: { home: { starting: homeIds }, away: { starting: awayIds } },
    teamPlans: { home: plan(homeIds), away: plan(awayIds) },
    names: { players: names, positions: Object.fromEntries([...homeIds, ...awayIds].map((id, i) => [id, roles[i % 11]])) },
    players: Object.fromEntries([['home', homeIds], ['away', awayIds]].map(([side, ids]) => [side, ids.map((id, i) => ({ id, stats: { touches: 20 + i * 3, passes: 15 + i * 2, passesCompleted: 12 + i, shots: i % 3, shotsOnTarget: i % 2, tackles: (i * 7) % 4, interceptions: i % 3 } }))])),
    goals: score.home ? [{ side: 'home', playerId: 102948, clock: { period: 1, minute: 20, second: 0 } }] : [],
    cards: [{ side: 'away', playerId: 102966, type: 'yellow', clock: { period: 1, minute: 33, second: 0 } }],
    substitutions: [{ side: 'home', offId: 102942, onId: 102984, clock: { period: 2, minute: 55, second: 0 } }],
  };
}

export const parseLive = docs => docs.map(parseMatchDoc).filter(Boolean);
