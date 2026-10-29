// Unit tests for the match-feed Edge Function pieces (supabase/functions/_shared/matchFeed.js). No network.
import { describe, it, expect } from 'vitest';
import { buildLiveMatchDoc, isBridgeToken, MatchFeedError } from '../supabase/functions/_shared/matchFeed.js';

const KEY = '20261021T210652Z_101-103';
const summary = (extra = {}) => ({
  schema: 'scl.match/1',
  status: 'live',
  match: { homeTeamId: 101, awayTeamId: 103 },
  clock: { period: 1, minute: 26, second: 6 },
  score: { home: 1, away: 0 },
  teams: {
    home: { gameTeamId: 101, draftTeamId: 'uidA', name: 'Los Pibes' },
    away: { gameTeamId: 103, draftTeamId: null, name: null },
  },
  goals: [], cards: [], substitutions: [], players: { home: [], away: [] },
  ...extra,
});

describe('isBridgeToken', () => {
  const secret = 'x'.repeat(40);

  it('accepts only the exact configured token', () => {
    expect(isBridgeToken(secret, secret)).toBe(true);
    expect(isBridgeToken(`${secret}y`, secret)).toBe(false);
    expect(isBridgeToken('', secret)).toBe(false);
  });

  it('refuses everything when the configured token is missing or too short', () => {
    expect(isBridgeToken('', '')).toBe(false);
    expect(isBridgeToken('short', 'short')).toBe(false);
  });
});

describe('buildLiveMatchDoc', () => {
  it('keeps the listing fields at the top and the full summary as JSON', () => {
    const doc = buildLiveMatchDoc({ matchKey: KEY, summary: summary() });
    expect(doc).toMatchObject({
      schema: 'scl.match/1', matchKey: KEY, status: 'live', homeGameTeamId: 101, awayGameTeamId: 103,
      homeName: 'Los Pibes', awayName: null, homeDraftTeamId: 'uidA', awayDraftTeamId: null,
      score: { home: 1, away: 0 }, clock: { period: 1, minute: 26, second: 6 },
    });
    expect(JSON.parse(doc.summaryJson).teams.home.name).toBe('Los Pibes');
  });

  it('rejects a key that does not name the same teams as the summary', () => {
    expect(() => buildLiveMatchDoc({ matchKey: '20261021T210652Z_101-127', summary: summary() })).toThrow(MatchFeedError);
  });

  it('rejects malformed keys, other schemas, statuses and scores', () => {
    const bad = [
      { matchKey: '../teams/x', summary: summary() },
      { matchKey: KEY, summary: summary({ schema: 'other/1' }) },
      { matchKey: KEY, summary: summary({ status: 'won' }) },
      { matchKey: KEY, summary: summary({ score: { home: -1, away: 0 } }) },
      { matchKey: KEY, summary: summary({ score: { home: 1.5, away: 0 } }) },
      { matchKey: KEY, summary: null },
    ];
    for (const body of bad) expect(() => buildLiveMatchDoc(body), JSON.stringify(body).slice(0, 80)).toThrow(MatchFeedError);
  });

  it('rejects summaries larger than the limit', () => {
    const big = summary({ warnings: ['x'.repeat(300 * 1024)] });
    expect(() => buildLiveMatchDoc({ matchKey: KEY, summary: big })).toThrow(/large/);
  });

  it('cuts team names to a sane length', () => {
    const doc = buildLiveMatchDoc({ matchKey: KEY, summary: summary({ teams: {
      home: { gameTeamId: 101, draftTeamId: 'a', name: 'N'.repeat(500) },
      away: { gameTeamId: 103, draftTeamId: 'b', name: 'B' },
    } }) });
    expect(doc.homeName).toHaveLength(60);
  });
});
