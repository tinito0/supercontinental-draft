// Unit tests with synthetic tournament data: OBS match selection never touches tournament results.
import { describe, it, expect } from 'vitest';
import {
  EMPTY_OVERLAY_MATCH,
  buildOverlayPatchForMatch,
  filterBroadcastMatches,
  getDirtyOverlayFields,
  getOverlayMatchDrift,
  getUnresolvedTeams,
  listBroadcastMatches,
  rebaseOverlayForm,
  resolveTeamId,
  sortBroadcastMatches,
} from '../utils/broadcastMatches.js';

const allTeams = {
  uidBoca: { teamName: 'Boca Juniors', logoUrl: '/boca.webp' },
  uidRiver: { teamName: 'River Plate ', logoUrl: '/river.webp' },
};

const tournamentData = {
  matches: [
    { id: 'm1', round: 'Fecha 1', homeTeam: 'Boca Juniors', awayTeam: 'River Plate', homeScore: 2, awayScore: 1, status: 'completed', date: '2026-10-01' },
    { id: 'm2', round: 'Fecha 2', homeTeam: 'River Plate', awayTeam: 'Racing', homeScore: '', awayScore: '', status: 'scheduled', date: '2026-10-09' },
    { id: 'm3', round: 'Fecha 2', homeTeam: 'Huracán', awayTeam: 'Boca Juniors', status: 'scheduled', date: '2026-10-08' },
    { round: 'sin id', homeTeam: 'X', awayTeam: 'Y' },
  ],
  bracket: {
    quarters: [{ teamA: 'Boca Juniors', teamB: 'Racing', scoreA: 1, scoreB: 0 }, { teamA: '', teamB: '' }],
    repechaje: { r1: [{ teamA: 'Huracán', teamB: '', scoreA: '', scoreB: '' }] },
  },
};

describe('listBroadcastMatches', () => {
  const list = listBroadcastMatches(tournamentData);

  it('includes league matches with an id and cup ties with at least one team', () => {
    expect(list.map(m => m.id)).toEqual(['league-m1', 'league-m2', 'league-m3', 'oro-quarters-0', 'plata-r1-0']);
    expect(list.find(m => m.id === 'oro-quarters-0')).toMatchObject({ competition: 'Copa de Oro', round: 'Cuartos 1', homeScore: '1', isCompleted: true });
  });

  it('a completed league match without both scores is not a result', () => {
    const [match] = listBroadcastMatches({ matches: [{ id: 'z', status: 'completed', homeScore: '', awayScore: 2 }] });
    expect(match.isCompleted).toBe(false);
    expect(match.homeScore).toBe('');
  });

  it('handles empty or missing data', () => {
    expect(listBroadcastMatches(null)).toEqual([]);
    expect(listBroadcastMatches({ matches: 'nope', bracket: null })).toEqual([]);
  });
});

describe('sort and filter', () => {
  const list = listBroadcastMatches(tournamentData);

  it('puts pending matches first, by date', () => {
    expect(sortBroadcastMatches(list).map(m => m.id).slice(0, 3)).toEqual(['league-m3', 'league-m2', 'plata-r1-0']);
    expect(sortBroadcastMatches(list).at(-1).isCompleted).toBe(true);
  });

  it('filters by status, competition and text', () => {
    expect(filterBroadcastMatches(list, { status: 'completed' }).map(m => m.id)).toEqual(['league-m1', 'oro-quarters-0']);
    expect(filterBroadcastMatches(list, { source: 'plata' }).map(m => m.id)).toEqual(['plata-r1-0']);
    expect(filterBroadcastMatches(list, { query: '  racing ' }).map(m => m.id)).toEqual(['league-m2', 'oro-quarters-0']);
    expect(filterBroadcastMatches(list, { query: 'copa de oro' })).toHaveLength(1);
    expect(filterBroadcastMatches(list, { query: 'nadie' })).toEqual([]);
  });
});

describe('buildOverlayPatchForMatch', () => {
  const list = listBroadcastMatches(tournamentData);

  it('resolves registered clubs case/space-insensitively and keeps the names as fallback', () => {
    expect(resolveTeamId('river plate', allTeams)).toBe('uidRiver');
    expect(resolveTeamId('Racing', allTeams)).toBe('');
    const patch = buildOverlayPatchForMatch(list.find(m => m.id === 'league-m2'), allTeams);
    expect(patch).toEqual({
      matchId: 'league-m2', homeTeamId: 'uidRiver', awayTeamId: '', homeTeamName: 'River Plate', awayTeamName: 'Racing',
      homeScore: '0', awayScore: '0', roundLabel: 'Fecha 2', clock: '00:00', matchStatus: 'EN VIVO',
    });
  });

  it('a finished match goes on air with its result, FINAL and the cup in the round label', () => {
    const patch = buildOverlayPatchForMatch(list.find(m => m.id === 'oro-quarters-0'), allTeams);
    expect(patch).toMatchObject({ homeScore: '1', awayScore: '0', matchStatus: 'FINAL', clock: '', roundLabel: 'Copa de Oro · Cuartos 1' });
  });

  it('only contains overlay match fields (never tournament data) and the clear patch has the same keys', () => {
    const patch = buildOverlayPatchForMatch(list[0], allTeams);
    expect(Object.keys(patch).sort()).toEqual(Object.keys(EMPTY_OVERLAY_MATCH).sort());
    expect(EMPTY_OVERLAY_MATCH.matchId).toBe('');
  });

  it('reports clubs without an account', () => {
    expect(getUnresolvedTeams(list.find(m => m.id === 'league-m2'), allTeams)).toEqual(['Racing']);
  });
});

describe('getOverlayMatchDrift', () => {
  const list = listBroadcastMatches(tournamentData);
  const m1 = list.find(m => m.id === 'league-m1');

  it('is null while the overlay matches the tournament', () => {
    expect(getOverlayMatchDrift(m1, buildOverlayPatchForMatch(m1, allTeams))).toBeNull();
  });

  it('flags a changed final result or changed teams', () => {
    expect(getOverlayMatchDrift(m1, { ...buildOverlayPatchForMatch(m1, allTeams), homeScore: '0' })).toEqual({ teamsChanged: false, resultChanged: true });
    expect(getOverlayMatchDrift(m1, { homeTeamName: 'Otro', awayTeamName: 'River Plate', homeScore: '2', awayScore: '1' })).toEqual({ teamsChanged: true, resultChanged: false });
  });

  it('a live (pending) match does not flag the running score', () => {
    const m2 = list.find(m => m.id === 'league-m2');
    expect(getOverlayMatchDrift(m2, { ...buildOverlayPatchForMatch(m2, allTeams), homeScore: '3' })).toBeNull();
  });
});

describe('overlay form merging', () => {
  const fields = ['headline', 'homeScore', 'ticker'];

  it('applies remote changes to untouched fields and keeps local edits', () => {
    const base = { headline: 'A', homeScore: '0', ticker: 'T' };
    const local = { ...base, headline: 'Escribiendo…' };
    const remote = { headline: 'B', homeScore: '1', ticker: 'T2' };
    expect(rebaseOverlayForm(local, base, remote, fields)).toEqual({ headline: 'Escribiendo…', homeScore: '1', ticker: 'T2' });
  });

  it('detects dirty fields against the saved version', () => {
    expect(getDirtyOverlayFields({ headline: 'x', homeScore: 0, ticker: '' }, { headline: 'x', homeScore: '0' }, fields)).toEqual([]);
    expect(getDirtyOverlayFields({ headline: 'y' }, { headline: 'x' }, fields)).toEqual(['headline']);
  });
});
