// Votos sin cuenta (supabase/functions/_shared/communityVote.js).
import {
  addVote, clientIp, pollWindow, managerWindow, MANAGER_WINDOW_MS, parseVote, predictionClosure, predictionWindow, roundFixtures, roundIdOf, saltedHash,
} from '../supabase/functions/_shared/communityVote.js';

const deviceId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('parseVote', () => {
  it('accepts a prediction, a manager and a cup vote', () => {
    expect(parseVote({ kind: 'prediction', matchId: 'm12', choice: 'away', deviceId })).toEqual({ kind: 'prediction', target: 'm12', choice: 'away', deviceId });
    expect(parseVote({ kind: 'prediction', matchId: 'm12', choice: 'draw', deviceId }).choice).toBe('draw');
    expect(parseVote({ kind: 'cup', pollId: 'copa-oro', choice: 'team_7', deviceId })).toEqual({ kind: 'cup', target: 'copa-oro', choice: 'team_7', deviceId });
    expect(parseVote({ kind: 'manager', roundId: 'fecha-3', choice: '  Talleres ', deviceId })).toEqual({ kind: 'manager', target: 'fecha-3', choice: 'Talleres', deviceId });
  });

  it('rejects bad devices, matches, choices and kinds', () => {
    expect(() => parseVote({ kind: 'prediction', matchId: 'm1', choice: 'home', deviceId: 'x' })).toThrow(/navegador/);
    expect(() => parseVote({ kind: 'prediction', matchId: '../x', choice: 'home', deviceId })).toThrow(/Partido/);
    expect(() => parseVote({ kind: 'prediction', matchId: 'm1', choice: 'empate', deviceId })).toThrow(/local, empate o visitante/);
    expect(() => parseVote({ kind: 'cup', pollId: 'copa oro', choice: 'x', deviceId })).toThrow(/Encuesta/);
    expect(() => parseVote({ kind: 'cup', pollId: 'copa-oro', choice: '', deviceId })).toThrow(/Opción/);
    expect(() => parseVote({ kind: 'manager', roundId: 'Fecha 3', choice: 'Talleres', deviceId })).toThrow(/Fecha/);
    expect(() => parseVote({ kind: 'manager', roundId: 'fecha-3', choice: '   ', deviceId })).toThrow(/Club/);
    expect(() => parseVote({ kind: 'manager', roundId: 'fecha-3', choice: 7, deviceId })).toThrow(/Club/);
    expect(() => parseVote({ kind: 'mvp', matchKey: '20261021T232728Z_101-1230', choice: 1, deviceId })).toThrow(/desconocido/);
    expect(() => parseVote({ kind: 'poll', deviceId })).toThrow(/desconocido/);
    expect(() => parseVote(null)).toThrow(/Falta/);
  });
});

describe('predictionWindow', () => {
  const overlay = { matchId: 'm12', homeTeamName: 'Los Pibes', awayTeamName: 'La Banda' };
  it('is open only for the match on air that has not started', () => {
    expect(predictionWindow({ overlay, prediction: null, matchId: 'm12' })).toEqual({ open: true, homeTeam: 'Los Pibes', awayTeam: 'La Banda' });
    expect(predictionWindow({ overlay, prediction: { closedAt: 'x' }, matchId: 'm12' }).open).toBe(false);
    expect(predictionWindow({ overlay, prediction: null, matchId: 'm13' }).open).toBe(false);
    expect(predictionWindow({ overlay: null, prediction: null, matchId: 'm12' }).open).toBe(false);
  });
});

describe('manager de la fecha', () => {
  const now = 100 * MANAGER_WINDOW_MS;
  const tournament = {
    matches: [
      { id: '1', round: 'Fecha 3', homeTeam: 'Talleres', awayTeam: 'SK Konya', status: 'completed', homeScore: 2, awayScore: 1, importedFrom: 'k1' },
      { id: '2', round: 'Fecha 3', homeTeam: 'Lourinhã', awayTeam: 'Portland Rovers', status: 'completed', homeScore: 0, awayScore: 0, importedFrom: 'k2' },
      { id: '3', round: 'Fecha 4', homeTeam: 'Talleres', awayTeam: 'Lourinhã', status: 'scheduled' },
      { id: '4', round: 'Fecha 13', homeTeam: 'A', awayTeam: 'B', status: 'completed' },
    ],
  };

  it('names rounds «fecha-n» and reads only that round', () => {
    expect(roundIdOf('Fecha 3')).toBe('fecha-3');
    expect(roundIdOf('fecha 03')).toBe('fecha-3');
    expect(roundIdOf('Final')).toBeNull();
    expect(roundFixtures(tournament, 'fecha-3').map(f => f.home)).toEqual(['Talleres', 'Lourinhã']);
    expect(roundFixtures(tournament, 'fecha-1')).toEqual([]);
  });

  it('opens when the last match of the round ends and stays open 24 h from that end', () => {
    const fixtures = roundFixtures(tournament, 'fecha-3');
    const end = now - 1000;
    const open = managerWindow({ fixtures, finishedAtMs: [end - 3_600_000, end], now });
    expect(open).toMatchObject({ open: true, closesAtMs: end + MANAGER_WINDOW_MS });
    expect([...open.candidates].sort()).toEqual(['Lourinhã', 'Portland Rovers', 'SK Konya', 'Talleres']);
    expect(managerWindow({ fixtures, finishedAtMs: [end - MANAGER_WINDOW_MS - 2, end - MANAGER_WINDOW_MS - 1], now })).toMatchObject({ open: false, reason: expect.stringMatching(/ya cerró/) });
  });

  it('stays closed while a match of the round has no result', () => {
    expect(managerWindow({ fixtures: roundFixtures(tournament, 'fecha-4'), now })).toMatchObject({ open: false, reason: expect.stringMatching(/todavía no terminó/) });
    expect(managerWindow({ fixtures: [], now })).toMatchObject({ open: false });
  });

  it('counts from the first vote when a result was loaded by hand (no game end time)', () => {
    const fixtures = roundFixtures(tournament, 'fecha-13');
    expect(managerWindow({ fixtures, now })).toMatchObject({ open: true, closesAtMs: null });
    expect(managerWindow({ fixtures, openedAtMs: now - 1000, now }).closesAtMs).toBe(now - 1000 + MANAGER_WINDOW_MS);
    expect(managerWindow({ fixtures, openedAtMs: now - MANAGER_WINDOW_MS - 1, now }).open).toBe(false);
  });
});

describe('helpers', () => {
  it('adds a vote without mutating the totals', () => {
    const totals = { home: 2 };
    expect(addVote(totals, 'home')).toEqual({ home: 3 });
    expect(addVote(undefined, 119700)).toEqual({ 119700: 1 });
    expect(totals).toEqual({ home: 2 });
  });

  it('hashes with the secret salt (same input, same hash; other salt, other hash)', async () => {
    const a = await saltedHash('1.2.3.4', 's1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await saltedHash('1.2.3.4', 's1')).toBe(a);
    expect(await saltedHash('1.2.3.4', 's2')).not.toBe(a);
  });

  it('reads the client IP from the proxy headers', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
    expect(clientIp(new Headers({}))).toBe('unknown');
  });
});

describe('predictionClosure (match-feed)', () => {
  const overlay = { matchId: 'm12', homeTeamName: 'Los Pibes', awayTeamName: 'La Banda' };
  it('closes the on-air prediction when that match goes live, keeping its votes', () => {
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k1', overlay, prediction: { votes: { home: 3 }, total: 3 } }))
      .toEqual({ matchId: 'm12', data: { homeTeam: 'Los Pibes', awayTeam: 'La Banda', votes: { home: 3 }, total: 3, liveMatchKey: 'k1' } });
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k1', overlay, prediction: null }).data.votes).toEqual({});
  });

  it('does nothing for finished uploads, without a match on air, or when already closed', () => {
    expect(predictionClosure({ liveStatus: 'finished', matchKey: 'k1', overlay, prediction: null })).toBeNull();
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k1', overlay: { matchId: '' }, prediction: null })).toBeNull();
    expect(predictionClosure({ liveStatus: 'live', matchKey: 'k1', overlay, prediction: { closedAt: new Date() } })).toBeNull();
  });
});

describe('pollWindow (¿quién gana la copa?)', () => {
  const poll = { open: true, options: [{ id: 'team_7', name: 'Los Pibes' }, { id: 'team_9', name: 'La Banda' }] };
  it('accepts an option of an open poll', () => {
    expect(pollWindow(poll, 'team_7')).toEqual({ open: true });
  });
  it('rejects missing or closed polls and unknown options', () => {
    expect(pollWindow(null, 'team_7').open).toBe(false);
    expect(pollWindow({ ...poll, open: false }, 'team_7')).toEqual({ open: false, reason: 'La encuesta está cerrada.' });
    expect(pollWindow(poll, 'team_1')).toEqual({ open: false, reason: 'Esa opción no está en la encuesta.' });
  });
});
