// Encuesta «¿quién gana la copa?» del admin: utils/cupPoll.js.
import { buildPoll, cupPollTeams, pollMatchesTeams, pollOptionId } from '../utils/cupPoll.js';

describe('pollOptionId', () => {
  it('turns a team name into an id the vote function accepts', () => {
    expect(pollOptionId('Gençlerbirliği')).toBe('genclerbirligi');
    expect(pollOptionId('  Los Pibes FC!! ')).toBe('los-pibes-fc');
    expect(pollOptionId('***')).toBe('');
    expect(pollOptionId('Real Madrid')).toMatch(/^[A-Za-z0-9_-]{1,80}$/);
  });
});

describe('cupPollTeams', () => {
  const q = (a, b) => ({ teamA: a, teamB: b });
  const quarters = [q('O1', 'O8'), q('O4', 'O5'), q('O2', 'O7'), q('O3', 'O6')];
  const r1 = [q('P9', 'O8'), q('P10', 'O5'), q('P11', 'O7'), q('P12', 'O6')];

  it('keeps both polls closed until the cup is drawn', () => {
    const empty = { league: [{ name: 'O1' }], bracket: { quarters: [q('O1', ''), q('', ''), q('', ''), q('', '')], repechaje: { r1: [] } } };
    expect(cupPollTeams(empty, 'copa-oro').ready).toBe(false);
    expect(cupPollTeams(empty, 'copa-plata').ready).toBe(false);
    expect(cupPollTeams(null, 'copa-oro').ready).toBe(false);
  });

  it('uses the 8 quarter-finalists for the Copa de Oro', () => {
    const result = cupPollTeams({ bracket: { quarters } }, 'copa-oro');
    expect(result.ready).toBe(true);
    expect(result.teams).toHaveLength(8);
  });

  it('uses every team that can still win the Copa de Plata, Oro semi-finalists included', () => {
    const result = cupPollTeams({ bracket: { quarters, repechaje: { r1 } } }, 'copa-plata');
    expect(result.ready).toBe(true);
    expect(result.teams.sort()).toEqual(['O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'P10', 'P11', 'P12', 'P9']);
  });

  it('tells whether a saved poll already has exactly those teams', () => {
    expect(pollMatchesTeams({ options: [{ name: 'B' }, { name: 'A' }] }, ['A', 'B'])).toBe(true);
    expect(pollMatchesTeams({ options: [{ name: 'A' }] }, ['A', 'B'])).toBe(false);
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
