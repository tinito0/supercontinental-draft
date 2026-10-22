// Votos sin cuenta (supabase/functions/_shared/communityVote.js).
import {
  addVote, clientIp, pollWindow, mvpCandidates, mvpWindow, MVP_GRACE_MS, parseVote, predictionClosure, predictionWindow, saltedHash,
} from '../supabase/functions/_shared/communityVote.js';

const deviceId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('parseVote', () => {
  it('accepts a prediction and an MVP vote', () => {
    expect(parseVote({ kind: 'prediction', matchId: 'm12', choice: 'away', deviceId })).toEqual({ kind: 'prediction', target: 'm12', choice: 'away', deviceId });
    expect(parseVote({ kind: 'prediction', matchId: 'm12', choice: 'draw', deviceId }).choice).toBe('draw');
    expect(parseVote({ kind: 'cup', pollId: 'copa-oro', choice: 'team_7', deviceId })).toEqual({ kind: 'cup', target: 'copa-oro', choice: 'team_7', deviceId });
    expect(parseVote({ kind: 'mvp', matchKey: '20261021T232728Z_101-1230', choice: '119700', deviceId })).toMatchObject({ kind: 'mvp', choice: 119700 });
  });

  it('rejects bad devices, matches, choices and kinds', () => {
    expect(() => parseVote({ kind: 'prediction', matchId: 'm1', choice: 'home', deviceId: 'x' })).toThrow(/navegador/);
    expect(() => parseVote({ kind: 'prediction', matchId: '../x', choice: 'home', deviceId })).toThrow(/Partido/);
    expect(() => parseVote({ kind: 'prediction', matchId: 'm1', choice: 'empate', deviceId })).toThrow(/local, empate o visitante/);
    expect(() => parseVote({ kind: 'cup', pollId: 'copa oro', choice: 'x', deviceId })).toThrow(/Encuesta/);
    expect(() => parseVote({ kind: 'cup', pollId: 'copa-oro', choice: '', deviceId })).toThrow(/Opción/);
    expect(() => parseVote({ kind: 'mvp', matchKey: 'nope', choice: 1, deviceId })).toThrow(/Partido/);
    expect(() => parseVote({ kind: 'mvp', matchKey: '20261021T232728Z_101-1230', choice: -3, deviceId })).toThrow(/Jugador/);
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

describe('mvpWindow and candidates', () => {
  it('is open while live and for 15 minutes after the end', () => {
    const now = 10_000_000;
    expect(mvpWindow({ status: 'live' }, now).open).toBe(true);
    expect(mvpWindow({ status: 'finished', updatedAtMs: now - MVP_GRACE_MS + 1 }, now).open).toBe(true);
    expect(mvpWindow({ status: 'finished', updatedAtMs: now - MVP_GRACE_MS - 1 }, now).open).toBe(false);
    expect(mvpWindow({ status: 'abandoned', updatedAtMs: now }, now).open).toBe(false);
    expect(mvpWindow(null, now).open).toBe(false);
  });

  it('candidates are the starters and the players who came on', () => {
    const ids = mvpCandidates({ lineups: { home: { starting: [1, 2] }, away: { starting: [3] } }, substitutions: [{ onId: 4, offId: 2 }] });
    expect([...ids].sort()).toEqual([1, 2, 3, 4]);
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
