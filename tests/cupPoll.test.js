// Encuesta «¿quién gana la copa?» del admin: utils/cupPoll.js.
import { buildPoll, pollOptionId, suggestedPollTeams } from '../utils/cupPoll.js';

describe('pollOptionId', () => {
  it('turns a team name into an id the vote function accepts', () => {
    expect(pollOptionId('Gençlerbirliği')).toBe('genclerbirligi');
    expect(pollOptionId('  Los Pibes FC!! ')).toBe('los-pibes-fc');
    expect(pollOptionId('***')).toBe('');
    expect(pollOptionId('Real Madrid')).toMatch(/^[A-Za-z0-9_-]{1,80}$/);
  });
});

describe('suggestedPollTeams', () => {
  const tournamentData = {
    league: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    bracket: {
      quarters: [{ teamA: 'A', teamB: 'B' }, { teamA: 'C', teamB: '' }],
      repechaje: { r1: [] },
    },
  };
  it('uses the first round of each cup', () => {
    expect(suggestedPollTeams(tournamentData, 'copa-oro')).toEqual(['A', 'B', 'C']);
  });
  it('falls back to the whole league table when the cup is not drawn yet', () => {
    expect(suggestedPollTeams(tournamentData, 'copa-plata')).toEqual(['A', 'B', 'C']);
    expect(suggestedPollTeams(null, 'copa-oro')).toEqual([]);
  });
});

describe('buildPoll', () => {
  it('builds the fields to save', () => {
    expect(buildPoll({ title: ' ¿Quién gana? ', open: true, names: ['Los Pibes', 'La Banda', ''] })).toEqual({
      ok: true,
      poll: { title: '¿Quién gana?', open: true, options: [{ id: 'los-pibes', name: 'Los Pibes' }, { id: 'la-banda', name: 'La Banda' }] },
    });
  });
  it('rejects a missing title, repeated teams and too few options', () => {
    expect(buildPoll({ title: '', names: ['A', 'B'] })).toEqual({ ok: false, reason: 'Falta la pregunta.' });
    expect(buildPoll({ title: 'x', names: ['Los Pibes', 'los pibes'] }).reason).toMatch(/repetido/);
    expect(buildPoll({ title: 'x', names: ['A'] }).reason).toMatch(/al menos 2/);
  });
});
