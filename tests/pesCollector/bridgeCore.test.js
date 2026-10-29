// Synthetic summaries only: these prove the bridge's selection and naming rules.
import { parseTeamMap, selectMatch, matchFileName, matchKeyOf, hashText, hashSummary, pendingUploads, backoffMs, classifyFailure, describeStatus } from '../../pes-collector/bridge/bridgeCore.js';

const summary = (home, away, extra = {}) => ({
  schema: 'scl.match/1', status: 'finished', source: { startedAt: '2026-10-21T21:06:52Z' },
  match: { homeTeamId: home, awayTeamId: away }, ...extra,
});

describe('parseTeamMap', () => {
  it('reads the Draft → PES assignment (draft team → game team id) into a lookup by game team', () => {
    const map = parseTeamMap({ draftMap: { uidA: '101', uidB: 103 }, names: { uidA: 'Los Pibes', uidB: 'La Banda' } });
    expect(map.get(101)).toEqual({ draftTeamId: 'uidA', name: 'Los Pibes' });
    expect(map.get(103)).toEqual({ draftTeamId: 'uidB', name: 'La Banda' });
  });

  it('rejects two draft teams assigned to the same game team', () => {
    expect(() => parseTeamMap({ draftMap: { a: 101, b: 101 } })).toThrow(/101/);
  });

  it('rejects ids that are not game team ids', () => {
    expect(() => parseTeamMap({ draftMap: { a: 'Arsenal' } })).toThrow(/a/);
  });
});

describe('selectMatch', () => {
  const map = parseTeamMap({ draftMap: { uidA: 101, uidB: 103 }, names: { uidA: 'Los Pibes', uidB: 'La Banda' } });

  it('keeps a match between two assigned teams and names them', () => {
    const selected = selectMatch(summary(101, 103), map);
    expect(selected.teams).toEqual({
      home: { gameTeamId: 101, draftTeamId: 'uidA', name: 'Los Pibes' },
      away: { gameTeamId: 103, draftTeamId: 'uidB', name: 'La Banda' },
    });
  });

  it('drops a match with a team outside the assignment', () => {
    expect(selectMatch(summary(101, 127), map)).toBeNull();
  });

  it('keeps every match, marked unassigned, when there is no assignment yet', () => {
    expect(selectMatch(summary(4219, 5010), null).teams).toEqual({
      home: { gameTeamId: 4219, draftTeamId: null, name: null },
      away: { gameTeamId: 5010, draftTeamId: null, name: null },
    });
  });
});

describe('matchFileName', () => {
  it('is stable per match: start time and both game team ids', () => {
    expect(matchFileName(summary(101, 103))).toBe('20261021T210652Z_101-103.json');
  });
});

describe('upload bookkeeping', () => {
  it('names a match on the server like its file, without .json', () => {
    expect(matchKeyOf(summary(101, 103))).toBe('20261021T210652Z_101-103');
  });

  it('lists only saved matches whose current content was not uploaded', () => {
    const a = summary(101, 103);
    const b = summary(127, 109, { source: { startedAt: '2026-10-21T21:32:16Z' } });
    const outbox = { [matchKeyOf(a)]: hashSummary(a), [matchKeyOf(b)]: 'stale000' };
    expect(pendingUploads([a, b], outbox)).toEqual([b]);
    expect(pendingUploads([a, b], {})).toEqual([a, b]);
  });

  it('hashes the same content to the same value and different content differently', () => {
    expect(hashText('abc')).toBe(hashText('abc'));
    expect(hashText('abc')).not.toBe(hashText('abd'));
    expect(hashText('')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('backs off 3 s, 6 s, 12 s … up to 60 s', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([3000, 6000, 12000, 24000, 48000, 60000, 60000]);
  });

  it('tells configuration errors from transient ones', () => {
    expect(classifyFailure({ error: new Error('ENOTFOUND') }).kind).toBe('offline');
    expect(classifyFailure({ status: 503 }).kind).toBe('offline');
    expect(classifyFailure({ status: 401 })).toMatchObject({ kind: 'error', message: expect.stringMatching(/token/i) });
    expect(classifyFailure({ status: 404 }).message).toMatch(/match-feed/);
    expect(classifyFailure({ status: 400 }).kind).toBe('error');
  });
});

describe('describeStatus', () => {
  const live = { status: 'live', clock: { minute: 26 }, score: { home: 1, away: 0 }, match: { homeTeamId: 4219, awayTeamId: 5010 },
    teams: { home: { name: 'Como' }, away: { name: null } } };

  it('says when nothing is uploaded because there is no configuration', () => {
    expect(describeStatus({ uploading: false, paused: false, current: live, upload: null }).state).toBe('local');
  });

  it('shows the live match while uploading works', () => {
    expect(describeStatus({ uploading: true, paused: false, current: live, upload: { queued: 0, lastFailure: null } }))
      .toMatchObject({ state: 'live', match: { label: "Como 1-0 5010 26'" } });
  });

  it('puts pause before failures and configuration errors before the match', () => {
    const upload = { queued: 1, lastFailure: { kind: 'error', message: 'Token rechazado' } };
    expect(describeStatus({ uploading: true, paused: true, current: live, upload }).state).toBe('paused');
    expect(describeStatus({ uploading: true, paused: false, current: live, upload })).toMatchObject({ state: 'error', message: 'Token rechazado' });
    expect(describeStatus({ uploading: true, paused: false, current: null, upload: { queued: 2, lastFailure: { kind: 'offline', message: 'x' } } }).state).toBe('offline');
  });

  it('is idle without a live match and counts what is still queued', () => {
    expect(describeStatus({ uploading: true, paused: false, current: { ...live, status: 'finished' }, upload: { queued: 2, lastFailure: null } }))
      .toMatchObject({ state: 'idle', match: null, message: expect.stringMatching(/2 partido/) });
  });
});
