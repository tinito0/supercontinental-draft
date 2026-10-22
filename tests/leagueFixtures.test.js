// Estado real de cada partido para la portada, /partidos y el OBS (utils/leagueFixtures.js). Datos sintéticos.
import { describe, it, expect } from 'vitest';
import { buildFixtures, formatFixtureDate, groupFixtures, leagueStage, liveState, LIVE_STALE_MS } from '../utils/leagueFixtures.js';

const NOW = Date.UTC(2026, 11, 20, 22, 0, 0);
const league = (id, extra = {}) => ({ id, round: 'Fecha 1', homeTeam: 'Boca', awayTeam: 'River', homeScore: '', awayScore: '', status: 'scheduled', ...extra });
const live = (key, extra = {}) => ({
  key, status: { kind: 'live', label: "63'" }, updatedAtMs: NOW - 10_000,
  home: { name: 'BOC', score: 1, draftTeamId: 'u-boca' }, away: { name: 'RIV', score: 0, draftTeamId: 'u-river' }, ...extra,
});
const teamsById = { 'u-boca': { teamName: 'Boca' }, 'u-river': { teamName: 'River' } };

describe('liveState', () => {
  it('is live only while the bridge keeps sending data', () => {
    expect(liveState(live('k'), NOW)).toBe('live');
    expect(liveState(live('k', { updatedAtMs: NOW - LIVE_STALE_MS - 1 }), NOW)).toBe('nosignal');
    expect(liveState(live('k', { updatedAtMs: null }), NOW)).toBe('nosignal');
    expect(liveState(live('k', { status: { kind: 'finished' } }), NOW)).toBe('finished');
    expect(liveState(null, NOW)).toBeNull();
  });
});

describe('buildFixtures', () => {
  it('a scheduled match whose kickoff time passed is still scheduled, not live', () => {
    const [fixture] = buildFixtures({ tournament: { matches: [league('1', { date: '2026-12-01', time: '18:00' })] }, now: NOW });
    expect(fixture.status).toBe('scheduled');
    expect(fixture.score).toBeNull();
  });

  it('links the live game by the draft clubs and shows its score and minute', () => {
    const [fixture] = buildFixtures({ tournament: { matches: [league('1')] }, liveMatches: [live('k1')], teamsById, now: NOW });
    expect(fixture).toMatchObject({ status: 'live', liveMatchKey: 'k1', liveScore: { home: 1, away: 0 }, minute: "63'" });
  });

  it('flips the live score when the game home side is the fixture away side', () => {
    const swapped = live('k1', { home: { name: 'RIV', score: 3, draftTeamId: 'u-river' }, away: { name: 'BOC', score: 1, draftTeamId: 'u-boca' } });
    const [fixture] = buildFixtures({ tournament: { matches: [league('1')] }, liveMatches: [swapped], teamsById, now: NOW });
    expect(fixture.liveScore).toEqual({ home: 1, away: 3 });
  });

  it('shows a final score only when it is recorded in the tournament', () => {
    const finishedGame = live('k1', { status: { kind: 'finished', label: 'Final' } });
    const [played] = buildFixtures({ tournament: { matches: [league('1')] }, liveMatches: [finishedGame], teamsById, now: NOW });
    expect(played).toMatchObject({ status: 'played', score: null, liveScore: { home: 1, away: 0 } });
    const [official] = buildFixtures({ tournament: { matches: [league('1', { homeScore: 2, awayScore: 0, status: 'completed', importedFrom: 'k1' })] }, liveMatches: [finishedGame], now: NOW });
    expect(official).toMatchObject({ status: 'finished', score: { home: 2, away: 0 }, winner: 'home', liveMatchKey: 'k1' });
  });

  it('keeps postponed, abandoned and stale matches out of live', () => {
    const tournament = { matches: [league('1', { status: 'postponed' }), league('2', { homeTeam: 'Racing', awayTeam: 'Indepe' })] };
    const fixtures = buildFixtures({
      tournament,
      liveMatches: [live('k2', { status: { kind: 'abandoned' } })],
      overlay: { matchId: 'league-2', liveMatchKey: 'k2' },
      now: NOW,
    });
    expect(fixtures.map(f => f.status)).toEqual(['postponed', 'abandoned']);
    expect(groupFixtures(fixtures).live).toEqual([]);
  });

  it('does not guess a link when two unplayed fixtures share the same clubs', () => {
    const fixtures = buildFixtures({ tournament: { matches: [league('1'), league('2')] }, liveMatches: [live('k1')], teamsById, now: NOW });
    expect(fixtures.every(f => f.status === 'scheduled')).toBe(true);
  });

  it('includes cup ties with both clubs and decides them with penalties', () => {
    const bracket = { quarters: [{ teamA: 'A', teamB: 'B', scoreA: 1, scoreB: 1, penaltiesA: 4, penaltiesB: 5 }, { teamA: 'C', teamB: '', scoreA: '', scoreB: '' }] };
    const fixtures = buildFixtures({ tournament: { bracket }, now: NOW });
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({ id: 'oro-quarters-0', competitionLabel: 'Copa de Oro', status: 'finished', winner: 'away', pens: { home: 4, away: 5 } });
  });
});

describe('groupFixtures', () => {
  it('orders results newest first and upcoming soonest first, with the on-air match on top', () => {
    const tournament = { matches: [
      league('a', { round: 'Fecha 1', status: 'completed', homeScore: 1, awayScore: 0, date: '2026-12-01' }),
      league('b', { round: 'Fecha 2', status: 'completed', homeScore: 0, awayScore: 2, date: '2026-12-08' }),
      league('c', { round: 'Fecha 3', date: '2026-12-15', time: '20:00' }),
      league('d', { round: 'Fecha 3', date: '2026-12-15', time: '18:00' }),
      league('e', { round: 'Fecha 3', date: '2026-12-16' }),
    ] };
    const groups = groupFixtures(buildFixtures({ tournament, overlay: { matchId: 'league-e' }, now: NOW }));
    expect(groups.results.map(f => f.sourceId)).toEqual(['b', 'a']);
    expect(groups.upcoming.map(f => f.sourceId)).toEqual(['e', 'd', 'c']);
  });
});

describe('leagueStage', () => {
  it('describes the season from stored data only', () => {
    expect(leagueStage({})).toMatchObject({ phase: 'preseason' });
    expect(leagueStage({ matches: [league('1', { round: 'Fecha 2' })] })).toMatchObject({ phase: 'league', detail: 'Fecha 2 de 4 · 1 partido por jugar' });
    const done = Array.from({ length: 2 }, (_, i) => league(String(i), { round: 'Fecha 4', status: 'completed', homeScore: 1, awayScore: 0 }));
    expect(leagueStage({ matches: done })).toMatchObject({ phase: 'league-done' });
    expect(leagueStage({ matches: done, bracket: { quarters: [{ teamA: 'A', teamB: 'B', scoreA: '', scoreB: '' }] } })).toMatchObject({ phase: 'cups', label: 'Copa de Oro', detail: 'Cuartos de final' });
    expect(leagueStage({ bracket: { final: { teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 2, penaltiesA: 3, penaltiesB: 4 } } })).toMatchObject({ phase: 'done', detail: 'Campeón de la Copa de Oro: B' });
  });
});

describe('formatFixtureDate', () => {
  it('formats the local day and the optional time', () => {
    expect(formatFixtureDate({ date: '2026-12-19', time: '21:30' })).toMatch(/19\/12 · 21:30$/);
    expect(formatFixtureDate({ date: '2026-12-19' })).toMatch(/19\/12$/);
    expect(formatFixtureDate({ time: '21:30' })).toBe('');
    expect(formatFixtureDate({ date: 'mañana' })).toBe('');
  });
});
