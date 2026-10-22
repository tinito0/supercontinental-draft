// Importar partidos del colector al torneo (utils/collectorImport.js). Datos sintéticos con la forma de live_matches.
import { findImported, planCollectorImport, resolveTeams } from '../utils/collectorImport.js';
import { parseMatchDoc } from '../utils/matchCenter.js';

const KEY = '20261022T200000Z_101-1230';
function liveMatch({ tournamentId = 17, score = { home: 2, away: 1 }, shootout = null, key = KEY } = {}) {
  const summary = {
    schema: 'scl.match/1', status: 'finished',
    match: { homeTeamId: 101, awayTeamId: 1230, tournamentId },
    score, shootout, clock: { period: 3, minute: 90, second: 0 },
    goals: [
      { side: 'home', playerId: 7, assistPlayerId: 8, clock: { period: 1, minute: 10, second: 0 } },
      { side: 'home', playerId: 7, clock: { period: 2, minute: 60, second: 0 } },
      { side: 'away', playerId: 9, clock: { period: 2, minute: 70, second: 0 } },
    ].slice(0, score.home + score.away),
    names: { teams: { home: 'Arsenal', away: 'Gençlerbirliği' }, players: { 7: 'Saka', 8: 'Rice', 9: 'Nine' } },
  };
  return parseMatchDoc({ matchKey: key, status: 'finished', summaryJson: JSON.stringify(summary) });
}
const teamMap = { 101: 'Los Pibes', 1230: 'La Banda' };

describe('resolveTeams', () => {
  it('maps the game teams to tournament names', () => {
    expect(resolveTeams(liveMatch(), teamMap)).toEqual({ home: 'Los Pibes', away: 'La Banda' });
    expect(resolveTeams(liveMatch(), {})).toEqual({ home: null, away: null });
  });
});

describe('planCollectorImport', () => {
  it('asks for the teams first', () => {
    expect(planCollectorImport({ match: liveMatch(), tournamentData: {}, teamMap: { 101: 'Los Pibes' } }))
      .toMatchObject({ ok: false, missingTeams: ['away'] });
  });

  it('a friendly fills the unplayed league match, oriented to the fixture, with scorers and assists', () => {
    const tournamentData = { matches: [{ id: 'f3', round: 'Fecha 3', homeTeam: 'La Banda', awayTeam: 'Los Pibes', status: 'scheduled' }] };
    const plan = planCollectorImport({ match: liveMatch(), tournamentData, teamMap });
    expect(plan).toMatchObject({ ok: true, kind: 'league', matchId: 'f3', label: 'Fecha 3: La Banda vs Los Pibes' });
    expect(plan.update).toMatchObject({
      homeTeam: 'La Banda', awayTeam: 'Los Pibes', homeScore: 1, awayScore: 2,
      homeGoals: 'Nine', awayGoals: 'Saka x2', awayAssists: 'Rice', status: 'completed', importedFrom: KEY,
    });
  });

  it('carries the shootout of a league draw', () => {
    const tournamentData = { matches: [{ id: 'f1', round: 'Fecha 1', homeTeam: 'Los Pibes', awayTeam: 'La Banda', status: 'scheduled' }] };
    const plan = planCollectorImport({ match: liveMatch({ score: { home: 1, away: 1 }, shootout: { home: 5, away: 4 } }), tournamentData, teamMap });
    expect(plan.update).toMatchObject({ homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4 });
  });

  it('never overwrites a played league match, and falls back to an unplayed Plata tie', () => {
    const tournamentData = {
      matches: [{ id: 'f1', homeTeam: 'Los Pibes', awayTeam: 'La Banda', homeScore: 3, awayScore: 0, status: 'completed' }],
      bracket: { repechaje: { r1: [{ teamA: 'La Banda', teamB: 'Los Pibes', scoreA: '', scoreB: '' }] } },
    };
    expect(planCollectorImport({ match: liveMatch(), tournamentData, teamMap })).toMatchObject({
      ok: true, kind: 'cup', cupId: 'plata', path: ['repechaje', 'r1'], index: 0, update: { scoreA: 1, scoreB: 2, importedFrom: KEY },
    });
  });

  it('a Konami Cup match goes to its Oro tie, with the shootout', () => {
    const tournamentData = { bracket: { quarters: [{ teamA: 'Los Pibes', teamB: 'La Banda', scoreA: '', scoreB: '' }] } };
    const plan = planCollectorImport({ match: liveMatch({ tournamentId: 48, score: { home: 1, away: 1 }, shootout: { home: 12, away: 11 } }), tournamentData, teamMap });
    expect(plan).toMatchObject({ ok: true, kind: 'cup', cupId: 'oro', path: ['quarters'], update: { scoreA: 1, scoreB: 1, penaltiesA: 12, penaltiesB: 11 } });
  });

  it('a Konami Cup match between Oro quarter-finalists who already played goes to the Plata final', () => {
    const tournamentData = { bracket: {
      quarters: [{ teamA: 'Los Pibes', teamB: 'La Banda', scoreA: 0, scoreB: 1 }],
      repechaje: { final: { teamA: 'Los Pibes', teamB: 'La Banda', scoreA: '', scoreB: '' } },
    } };
    expect(planCollectorImport({ match: liveMatch({ tournamentId: 48 }), tournamentData, teamMap }))
      .toMatchObject({ ok: true, cupId: 'plata', isFinal: true, path: ['repechaje', 'final'], update: { scoreA: 2, scoreB: 1 } });
  });

  it('refuses a match already imported or not finished', () => {
    const tournamentData = { matches: [{ id: 'f1', round: 'Fecha 1', homeTeam: 'Los Pibes', awayTeam: 'La Banda', status: 'completed', importedFrom: KEY }] };
    expect(findImported(tournamentData, KEY)).toBe('Fecha 1: Los Pibes vs La Banda');
    expect(planCollectorImport({ match: liveMatch(), tournamentData, teamMap }).reason).toMatch(/Ya está importado/);
    const live = { ...liveMatch(), status: { kind: 'live', label: "50'" } };
    expect(planCollectorImport({ match: live, tournamentData: {}, teamMap }).reason).toMatch(/terminados/);
  });
});

describe('applyCollectorImport', () => {
  it('writes the league match and the cup tie without mutating the tournament', async () => {
    const { applyCollectorImport } = await import('../utils/collectorImport.js');
    const tournamentData = {
      matches: [{ id: 'f1', homeTeam: 'A', awayTeam: 'B', status: 'scheduled' }],
      bracket: { quarters: [{ teamA: 'A', teamB: 'B', scoreA: '', scoreB: '' }], repechaje: { final: { teamA: 'C', teamB: 'D' } } },
    };
    const frozen = JSON.stringify(tournamentData);
    const league = applyCollectorImport(tournamentData, { kind: 'league', matchId: 'f1', update: { homeScore: 1, status: 'completed' } });
    expect(league.matches[0]).toMatchObject({ homeTeam: 'A', homeScore: 1, status: 'completed' });
    const quarter = applyCollectorImport(tournamentData, { kind: 'cup', path: ['quarters'], index: 0, isFinal: false, update: { scoreA: 2, scoreB: 0 } });
    expect(quarter.bracket.quarters[0]).toMatchObject({ teamA: 'A', scoreA: 2, scoreB: 0 });
    const final = applyCollectorImport(tournamentData, { kind: 'cup', path: ['repechaje', 'final'], index: 0, isFinal: true, update: { scoreA: 1, scoreB: 3 } });
    expect(final.bracket.repechaje.final).toEqual({ teamA: 'C', teamB: 'D', scoreA: 1, scoreB: 3 });
    expect(JSON.stringify(tournamentData)).toBe(frozen);
  });
});
