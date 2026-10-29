// A club renamed by the admin keeps its standings, brackets, matches and overlay. Synthetic data only.
import { describe, it, expect } from 'vitest';
import { renameTeamInTournament } from '../utils/tournamentRename.js';
import { buildAutomaticTournamentData } from '../components/tournament/tournamentEngine.js';

const tournament = {
  league: [{ id: 'a', name: 'Talleres', pts: 4 }, { id: 'b', name: 'Portland', pts: 1 }],
  bracket: {
    quarters: [{ teamA: 'talleres ', teamB: 'Portland', scoreA: '2', scoreB: '1' }],
    semis: [], final: { teamA: '', teamB: '' },
    repechaje: { r1: [{ teamA: 'Portland', teamB: 'Talleres' }], r2: [], semis: [], final: {} },
  },
  matches: [{ id: 'm1', homeTeam: 'Talleres', awayTeam: 'Portland', homeScore: 2, awayScore: 1, status: 'completed', homeGoals: 'Pérez x2', awayGoals: 'Gómez' }],
  topScorers: [{ name: 'Talleres', team: 'Talleres', goals: 2 }],
};

describe('renameTeamInTournament', () => {
  it('renames the club everywhere it is referenced, ignoring case and spaces', () => {
    const { data, changed } = renameTeamInTournament(tournament, 'Talleres', 'Talleres de Córdoba');
    expect(data.league[0].name).toBe('Talleres de Córdoba');
    expect(data.bracket.quarters[0].teamA).toBe('Talleres de Córdoba');
    expect(data.bracket.repechaje.r1[0].teamB).toBe('Talleres de Córdoba');
    expect(data.matches[0].homeTeam).toBe('Talleres de Córdoba');
    expect(data.topScorers[0].team).toBe('Talleres de Córdoba');
    expect(changed).toBe(5); // league row, quarter, repechaje, match, top scorer's club
  });

  it('leaves player names, other clubs and the original object alone', () => {
    const { data } = renameTeamInTournament(tournament, 'Talleres', 'Talleres de Córdoba');
    expect(data.topScorers[0].name).toBe('Talleres'); // a player who happens to share the name
    expect(data.league[1].name).toBe('Portland');
    expect(tournament.league[0].name).toBe('Talleres');
  });

  it('keeps a single standings row after the rename (it used to split in two)', () => {
    const { data } = renameTeamInTournament(tournament, 'Talleres', 'Talleres de Córdoba');
    const rows = buildAutomaticTournamentData(data).league.filter(row => /talleres/i.test(row.name));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Talleres de Córdoba', pts: 2, pj: 1 });
  });

  it('reports only the top-level fields that changed, and keeps Firestore values like Timestamps intact', () => {
    class FakeTimestamp { constructor(s) { this.seconds = s; } toMillis() { return this.seconds * 1000; } }
    const updatedAt = new FakeTimestamp(5);
    const overlay = { homeTeamName: 'Talleres', awayTeamName: 'Portland', updatedAt, view: { teamA: 'x' } };
    const { data, changedKeys } = renameTeamInTournament(overlay, 'Talleres', 'TDC');
    expect(changedKeys).toEqual(['homeTeamName']);
    expect(data.updatedAt).toBe(updatedAt);
    expect(renameTeamInTournament(tournament, 'Talleres', 'TDC').changedKeys).toEqual(['league', 'bracket', 'matches', 'topScorers']);
  });

  it('renames the overlay names too, and does nothing for an unchanged name', () => {
    const overlay = { homeTeamId: 'u1', homeTeamName: 'Talleres', awayTeamName: 'Portland' };
    expect(renameTeamInTournament(overlay, 'Talleres', 'TDC').data.homeTeamName).toBe('TDC');
    expect(renameTeamInTournament(tournament, 'Talleres', ' talleres ').changed).toBe(0);
  });
});
