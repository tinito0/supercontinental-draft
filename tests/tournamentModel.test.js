// Fusión de una edición del torneo con lo guardado mientras tanto (utils/tournamentModel.js). Datos sintéticos.
import { describe, it, expect } from 'vitest';
import { mergeTournamentEdit, normalizeTournament } from '../utils/tournamentModel.js';

const match = (id, extra = {}) => ({ id, round: 'Fecha 1', homeTeam: `H${id}`, awayTeam: `A${id}`, homeScore: '', awayScore: '', status: 'scheduled', ...extra });
const doc = (matches, extra = {}) => normalizeTournament({ league: [{ id: 'r1', name: 'Boca' }, { id: 'r2', name: 'River' }], matches, ...extra });

describe('normalizeTournament', () => {
  it('fills 12 league places and both cups without changing stored values', () => {
    const data = normalizeTournament({ league: [{ name: 'Boca', pts: 3 }], bracket: { quarters: [{ teamA: 'X', teamB: 'Y', scoreA: 1, scoreB: 0 }] } });
    expect(data.league).toHaveLength(12);
    expect(data.league[0]).toMatchObject({ name: 'Boca', pts: 3 });
    expect(data.bracket.quarters).toHaveLength(4);
    expect(data.bracket.quarters[0]).toMatchObject({ teamA: 'X', scoreA: 1 });
    expect(data.bracket.repechaje.r1).toHaveLength(4);
    expect(data.matches).toEqual([]);
  });
});

describe('mergeTournamentEdit', () => {
  it('keeps a result another admin saved while this one edited something else', () => {
    const base = doc([match('1'), match('2')]);
    const edited = doc([match('1', { homeScore: 2, awayScore: 0, status: 'completed' }), match('2')]);
    const latest = doc([match('1'), match('2', { homeScore: 1, awayScore: 1, status: 'completed', importedFrom: 'k' })]);
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toEqual([]);
    expect(data.matches.find(m => m.id === '1')).toMatchObject({ homeScore: 2, status: 'completed' });
    expect(data.matches.find(m => m.id === '2')).toMatchObject({ homeScore: 1, status: 'completed', importedFrom: 'k' });
  });

  it('reports a conflict when both changed the same field differently', () => {
    const base = doc([match('1')]);
    const edited = doc([match('1', { homeScore: 2 })]);
    const latest = doc([match('1', { homeScore: 3 })]);
    expect(mergeTournamentEdit(base, edited, latest).conflicts).toHaveLength(1);
  });

  it('treats 2 and "2" as the same value (no false conflict)', () => {
    const base = doc([match('1', { homeScore: 2 })]);
    const edited = doc([match('1', { homeScore: '2', awayScore: '1' })]);
    const latest = doc([match('1', { homeScore: 2 })]);
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toEqual([]);
    expect(data.matches[0].awayScore).toBe('1');
  });

  it('adds new matches, keeps matches added by others, and deletes only untouched ones', () => {
    const base = doc([match('1'), match('2')]);
    const edited = doc([match('1'), match('3')]);
    const latest = doc([match('1'), match('2'), match('9')]);
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toEqual([]);
    expect(data.matches.map(m => m.id)).toEqual(['1', '9', '3']);
  });

  it('refuses to delete a match someone else changed meanwhile', () => {
    const base = doc([match('1')]);
    const edited = doc([]);
    const latest = doc([match('1', { homeScore: 1, awayScore: 0, status: 'completed' })]);
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toHaveLength(1);
    expect(data.matches).toHaveLength(1);
  });

  it('merges cup ties slot by slot', () => {
    const tie = { teamA: 'A', teamB: 'B', scoreA: '', scoreB: '' };
    const base = doc([], { bracket: { quarters: [tie, tie] } });
    const edited = doc([], { bracket: { quarters: [{ ...tie, scoreA: 1, scoreB: 0 }, tie] } });
    const latest = doc([], { bracket: { quarters: [tie, { ...tie, scoreA: 0, scoreB: 2 }] } });
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toEqual([]);
    expect(data.bracket.quarters[0]).toMatchObject({ scoreA: 1, scoreB: 0 });
    expect(data.bracket.quarters[1]).toMatchObject({ scoreA: 0, scoreB: 2 });
  });

  it('keeps a club rename done meanwhile when the editor did not touch names', () => {
    const base = doc([match('1', { homeTeam: 'Boca' })]);
    const edited = doc([match('1', { homeTeam: 'Boca', homeScore: 1, awayScore: 0, status: 'completed' })]);
    const latest = normalizeTournament({ league: [{ id: 'r1', name: 'Boca Jrs' }, { id: 'r2', name: 'River' }], matches: [match('1', { homeTeam: 'Boca Jrs' })] });
    const { data, conflicts } = mergeTournamentEdit(base, edited, latest);
    expect(conflicts).toEqual([]);
    expect(data.matches[0]).toMatchObject({ homeTeam: 'Boca Jrs', homeScore: 1 });
    expect(data.league[0].name).toBe('Boca Jrs');
  });

  it('applies other edited fields such as the manual tie order', () => {
    const base = doc([]);
    const edited = { ...doc([]), tieBreakOrder: ['River', 'Boca'] };
    const { data } = mergeTournamentEdit(base, edited, doc([]));
    expect(data.tieBreakOrder).toEqual(['River', 'Boca']);
  });
});
