// Motor del torneo de punta a punta con datos sintéticos realistas (12 y 14 clubes, 4 fechas suizas, copas):
// finalizeTournament = tabla + desempates + fecha suiza automática + avance de copas (components/tournament/tournamentEngine.js).
import { describe, it, expect } from 'vitest';
import {
  applyAutomaticSwiss,
  finalizeTournament,
  rankLeague,
  roundStatus,
  suggestSwissRound,
  getRevertedResults,
} from '../components/tournament/tournamentEngine.js';
import { normalizeTournament } from '../utils/tournamentModel.js';
import { swissPairings, teamKey } from '../utils/competitionRules.js';

const names = n => Array.from({ length: n }, (_, i) => `Club ${String(i + 1).padStart(2, '0')}`);
const strength = name => Number(name.slice(-2));

/** Torneo con la Fecha 1 cargada a mano (1v2, 3v4, …), sin jugar. */
function seasonWithRoundOne(n = 12) {
  const teams = names(n);
  const matches = [];
  for (let i = 0; i < n; i += 2) {
    matches.push({ id: `f1-${i / 2 + 1}`, round: 'Fecha 1', homeTeam: teams[i], awayTeam: teams[i + 1], homeScore: '', awayScore: '', status: 'scheduled' });
  }
  return { ...normalizeTournament({ league: teams.slice(0, 12).map(name => ({ name })) }), league: teams.map(name => ({ id: name, name, pj: 0, pg: 0, gpen: 0, pp: 0, pts: 0, gf: 0, gc: 0 })), matches };
}

/** Resultado determinista: el de número más bajo gana 2-0; cada tanto, empate 1-1 definido por penales. */
function play(match) {
  const [h, a] = [strength(match.homeTeam), strength(match.awayTeam)];
  if ((h + a) % 5 === 0) return { ...match, homeScore: 1, awayScore: 1, homePenalties: h < a ? 5 : 3, awayPenalties: h < a ? 3 : 5, status: 'completed' };
  return { ...match, homeScore: h < a ? 2 : 0, awayScore: h < a ? 0 : 2, status: 'completed' };
}

const playRound = (data, round) => ({ ...data, matches: data.matches.map(match => (match.round === `Fecha ${round}` ? play(match) : match)) });

// finalizeTournament trabaja con 12 lugares de tabla; para 14 clubes se prueba el emparejamiento directo.
function finalize12(data) {
  const result = finalizeTournament(data);
  expect(result.ok).toBe(true);
  return result;
}

describe('fecha suiza automática a lo largo de una temporada de 12', () => {
  it('genera las fechas 2, 3 y 4 una sola vez, sin revanchas y con cada club una vez por fecha', () => {
    let data = seasonWithRoundOne(12);
    for (let round = 1; round <= 4; round += 1) {
      const result = finalize12(playRound(data, round));
      expect(result.generatedRound).toBe(round < 4 ? `Fecha ${round + 1}` : null);
      data = result.data;
      // Guardar de nuevo sin cambios no agrega nada (idempotente).
      const again = finalize12(data);
      expect(again.data.matches).toHaveLength(data.matches.length);
      expect(again.generatedRound).toBeNull();
    }
    expect(data.swissStatus.generatedRounds).toEqual([2, 3, 4]);
    expect(data.matches).toHaveLength(24);
    const pairs = new Set();
    for (const match of data.matches) {
      const key = [teamKey(match.homeTeam), teamKey(match.awayTeam)].sort().join('|');
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
    for (let round = 1; round <= 4; round += 1) expect(roundStatus(data, round)).toEqual({ complete: true });
  });

  it('pairs on the points of the finished round and balances home games', () => {
    const data = finalize12(playRound(seasonWithRoundOne(12), 1)).data;
    const round2 = data.matches.filter(match => match.round === 'Fecha 2');
    expect(round2).toHaveLength(6);
    expect(round2.every(match => match.id.startsWith('swiss-r2-') && match.status === 'scheduled')).toBe(true);
    const points = Object.fromEntries(data.league.map(row => [row.name, row.pts]));
    // Ganadores contra ganadores: nadie cruza con más de un punto de diferencia en la fecha 2.
    for (const match of round2) expect(Math.abs(points[match.homeTeam] - points[match.awayTeam])).toBeLessThanOrEqual(1);
    // Nadie que fue local en la fecha 1 lo es de nuevo si su rival fue visitante.
    const homeInRound1 = new Set(data.matches.filter(m => m.round === 'Fecha 1').map(m => m.homeTeam));
    for (const match of round2) {
      if (homeInRound1.has(match.homeTeam)) expect(homeInRound1.has(match.awayTeam)).toBe(true);
    }
  });

  it('does not advance while a match is unfinished, postponed, missing or a draw without shootout', () => {
    const base = playRound(seasonWithRoundOne(12), 1);
    const variants = {
      scheduled: { status: 'scheduled' },
      postponed: { status: 'postponed' },
      noShootout: { homeScore: 1, awayScore: 1, homePenalties: '', awayPenalties: '' },
      noScore: { homeScore: '', awayScore: '' },
    };
    for (const [label, patch] of Object.entries(variants)) {
      const data = { ...base, matches: base.matches.map((match, i) => (i === 0 ? { ...match, ...patch } : match)) };
      const result = finalizeTournament(data);
      expect(result.ok, label).toBe(true);
      expect(result.generatedRound, label).toBeNull();
      expect(result.data.matches.some(match => match.round === 'Fecha 2'), label).toBe(false);
    }
    const missing = { ...base, matches: base.matches.slice(1) };
    expect(roundStatus(missing, 1)).toMatchObject({ complete: false, reason: expect.stringMatching(/no jugaron/) });
  });

  it('a round deleted after being generated is not generated again (the admin rebuilds it by hand)', () => {
    const generated = finalize12(playRound(seasonWithRoundOne(12), 1)).data;
    const withoutRound2 = { ...generated, matches: generated.matches.filter(match => match.round !== 'Fecha 2') };
    const result = finalize12(withoutRound2);
    expect(result.generatedRound).toBeNull();
    expect(result.data.matches.some(match => match.round === 'Fecha 2')).toBe(false);
  });

  it('records why a round could not be paired instead of allowing a rematch', () => {
    const teams = ['A', 'B', 'C', 'D'];
    const done = (id, round, homeTeam, awayTeam) => ({ id, round, homeTeam, awayTeam, homeScore: 1, awayScore: 0, status: 'completed' });
    const data = {
      league: teams.map(name => ({ name })),
      matches: [done('1', 'Fecha 1', 'A', 'B'), done('2', 'Fecha 1', 'C', 'D'), done('3', 'Fecha 2', 'A', 'C'), done('4', 'Fecha 2', 'B', 'D'),
        done('5', 'Fecha 3', 'A', 'D'), done('6', 'Fecha 3', 'B', 'C')],
    };
    // Con 4 clubes y 3 fechas jugadas, la fecha 4 obliga a repetir: se bloquea con el motivo.
    const { blocked, generated } = applyAutomaticSwiss(data);
    expect(generated).toBeNull();
    expect(blocked).toMatchObject({ round: 4, reason: expect.stringMatching(/repetir un rival/) });
  });

  it('treats team names case-insensitively when avoiding rematches', () => {
    const data = {
      league: [{ name: 'Boca' }, { name: 'River' }, { name: 'Racing' }, { name: 'Indepe' }],
      matches: [
        { id: '1', round: 'Fecha 1', homeTeam: 'boca ', awayTeam: 'River', homeScore: 1, awayScore: 0, status: 'completed' },
        { id: '2', round: 'Fecha 1', homeTeam: 'Racing', awayTeam: 'Indepe', homeScore: 1, awayScore: 0, status: 'completed' },
      ],
    };
    const suggestion = suggestSwissRound(data);
    expect(suggestion.ok).toBe(true);
    for (const [home, away] of suggestion.pairs) expect([teamKey(home), teamKey(away)].sort().join()).not.toBe('boca,river');
  });
});

// La tabla del torneo hoy es de 12 lugares (buildAutomaticTournamentReport); con 14 clubes se prueba el algoritmo de
// emparejamiento, que no depende de ese tope.
describe('emparejamiento con 14 clubes', () => {
  it('pairs four full rounds without rematches, on points', () => {
    const teams = names(14);
    const points = new Map(teams.map(name => [name, 0]));
    const played = [];
    for (let round = 1; round <= 4; round += 1) {
      const ranking = [...teams].sort((a, b) => points.get(b) - points.get(a) || strength(a) - strength(b)).map(name => ({ name, points: points.get(name) }));
      const result = swissPairings(ranking, played);
      expect(result.ok, `fecha ${round}`).toBe(true);
      expect(result.pairs.flat().sort()).toEqual([...teams].sort());
      for (const [a, b] of result.pairs) {
        played.push([a, b]);
        points.set(strength(a) < strength(b) ? a : b, points.get(strength(a) < strength(b) ? a : b) + 2);
      }
    }
    const keys = played.map(pair => [...pair].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('desempate manual (tieBreakOrder)', () => {
  const tied = [{ name: 'Alfa', pts: 2, gf: 2, gc: 0, pg: 1 }, { name: 'Beta', pts: 2, gf: 2, gc: 0, pg: 1 }, { name: 'Gama', pts: 4, gf: 4, gc: 0, pg: 2 }];

  it('without an order the tie is reported, with one it is applied only inside the tie', () => {
    expect(rankLeague(tied).unresolvedTies).toEqual([['Alfa', 'Beta']]);
    const ordered = rankLeague(tied, ['Beta', 'Alfa']);
    expect(ordered.league.map(row => row.name)).toEqual(['Gama', 'Beta', 'Alfa']);
    expect(ordered.unresolvedTies).toEqual([]);
    // Un orden manual no puede subir a nadie por encima de un club con más puntos.
    expect(rankLeague(tied, ['Beta', 'Alfa', 'Gama']).league[0].name).toBe('Gama');
  });

  it('keeps both rows when two league rows share a name', () => {
    const { league } = rankLeague([{ id: 1, name: 'Boca', pts: 2 }, { id: 2, name: 'Boca', pts: 0 }]);
    expect(league.map(row => row.id)).toEqual([1, 2]);
  });
});

describe('copas dentro del guardado', () => {
  it('advances Oro winners and builds the Plata round 1 from places 9-12 and the QF losers', () => {
    let data = seasonWithRoundOne(12);
    for (let round = 1; round <= 4; round += 1) data = finalize12(playRound(data, round)).data;
    const ranking = data.league.map(row => row.name);
    const quarters = [[1, 8], [4, 5], [2, 7], [3, 6]].map(([a, b], i) => ({
      teamA: ranking[a - 1], teamB: ranking[b - 1], scoreA: i === 1 ? 2 : 1, scoreB: i === 1 ? 2 : 0, penaltiesA: i === 1 ? 3 : '', penaltiesB: i === 1 ? 4 : '',
    }));
    const result = finalize12({ ...data, bracket: { ...data.bracket, quarters } });
    const { bracket } = result.data;
    // Cuartos 2 (4.° vs 5.°) lo ganó el 5.° por penales.
    expect([bracket.semis[0].teamA, bracket.semis[0].teamB]).toEqual([ranking[0], ranking[4]]);
    expect([bracket.semis[1].teamA, bracket.semis[1].teamB]).toEqual([ranking[1], ranking[2]]);
    const losersByRank = [ranking[3], ranking[5], ranking[6], ranking[7]];
    expect(bracket.repechaje.r1.map(m => [m.teamA, m.teamB])).toEqual([
      [ranking[8], losersByRank[3]], [ranking[9], losersByRank[2]], [ranking[10], losersByRank[1]], [ranking[11], losersByRank[0]],
    ]);
    // Idempotente: guardar otra vez no cambia nada.
    expect(finalize12(result.data).cupChanges).toEqual([]);
  });
});

describe('noticias de resultados revertidos', () => {
  it('lists matches that lost their published result', () => {
    const previous = [{ id: 'a', status: 'completed' }, { id: 'b', status: 'completed' }, { id: 'c', status: 'scheduled' }];
    const next = [{ id: 'a', status: 'scheduled' }, { id: 'c', status: 'completed' }];
    expect(getRevertedResults(previous, next)).toEqual(['a', 'b']);
  });
});
