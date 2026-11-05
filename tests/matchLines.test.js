// match_lines documents (supabase/functions/_shared/matchLines.js): the compact per-player lines the season stats
// add up. Synthetic summaries prove the mapping; the recorded sessions (skipped when E:\ is missing) prove it holds
// on real probe output.
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildLiveMatchDoc } from '../supabase/functions/_shared/matchFeed.js';
import { buildMatchLinesDoc, minutesPlayed, MATCH_LINES_SCHEMA } from '../supabase/functions/_shared/matchLines.js';
import { parseEventLines, splitMatches, summarizeMatch } from '../pes-collector/collector/matchSummary.js';

const KEY = '20261104T162412Z_50-45';
const clock = (period, minute) => ({ period, minute, second: 0 });
const XI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const XI_AWAY = XI.map(id => id + 100);

const summary = (extra = {}) => ({
  schema: 'scl.match/1', status: 'finished', clock: clock(3, 90), score: { home: 2, away: 0 }, shootout: null,
  match: { homeTeamId: 50, awayTeamId: 45, competition: 'friendly' },
  teams: { home: { gameTeamId: 50, draftTeamId: 'uidA', name: 'Los Pibes' }, away: { gameTeamId: 45, draftTeamId: 'uidB', name: 'La Banda' } },
  lineups: { home: { starting: XI, final: [...XI.slice(0, 10), 12] }, away: { starting: XI_AWAY, final: XI_AWAY } },
  substitutions: [{ side: 'home', offId: 11, onId: 12, slot: 10, clock: clock(2, 70) }],
  cards: [{ side: 'away', playerId: 105, type: 'red', clock: clock(2, 60) }],
  goals: [
    { side: 'home', playerId: 9, assistPlayerId: 10, ownGoal: false, penalty: false, clock: clock(1, 20) },
    { side: 'home', playerId: 105, assistPlayerId: null, ownGoal: true, penalty: false, clock: clock(2, 80) },
  ],
  players: {
    home: [{ id: 9, stats: { goals: 1, shots: 3, shotsOnTarget: 2, passes: 20, passesCompleted: 15 } }, { id: 10, stats: { assists: 1 } }],
    away: [{ id: 101, stats: { saves: 4, shotsOnTargetFaced: 5 } }, { id: 105, stats: { redCards: 1, tackles: 3, tacklesWon: 2 } }],
  },
  shots: [{ side: 'home', playerId: 9, xg: 0.31 }, { side: 'home', playerId: 9, xg: 0.2 }, { side: 'home', playerId: 7, xg: null }],
  xg: { home: 0.51, away: 0 },
  ratings: { 9: 8, 10: 7, 101: 6.5 },
  names: { teams: { home: 'Argentina', away: 'England' }, players: { 9: 'Delantero', 101: 'Arquero' }, positions: { 1: 0, 101: 0, 9: 12 } },
  ...extra,
});

const linesOf = (s = summary()) => buildMatchLinesDoc(buildLiveMatchDoc({ matchKey: KEY, summary: s }), s);
const line = (doc, id) => doc.players.find(p => p.id === id);

describe('minutesPlayed', () => {
  it('counts from kick-off or the sub to the end, the sub or a red card', () => {
    const s = summary();
    expect(minutesPlayed(s, 'home', 1)).toBe(90);
    expect(minutesPlayed(s, 'home', 11)).toBe(70);
    expect(minutesPlayed(s, 'home', 12)).toBe(20);
    expect(minutesPlayed(s, 'away', 105)).toBe(60);
    expect(minutesPlayed(s, 'home', 99)).toBeNull();
  });
});

describe('buildMatchLinesDoc', () => {
  it('keeps the match header: key, status, date, competition, both teams with score and xG', () => {
    const doc = linesOf();
    expect(doc).toMatchObject({
      schema: MATCH_LINES_SCHEMA, matchKey: KEY, status: 'finished', startedAt: '20261104T162412Z', competition: 'friendly',
      home: { gameTeamId: 50, draftTeamId: 'uidA', name: 'Los Pibes', score: 2, xg: 0.51 },
      away: { gameTeamId: 45, draftTeamId: 'uidB', name: 'La Banda', score: 0, xg: 0 },
      shootout: null,
    });
  });

  it('writes one line per player who played, starters and subs, nobody from the bench', () => {
    const doc = linesOf();
    expect(doc.players).toHaveLength(23);
    expect(line(doc, 12)).toMatchObject({ side: 'home', started: false, minutes: 20 });
    expect(line(doc, 1)).toMatchObject({ side: 'home', started: true, minutes: 90, position: 0 });
  });

  it('takes goals and assists from the goal list, so an own goal is not a goal of the player', () => {
    const doc = linesOf();
    expect(line(doc, 9)).toMatchObject({ goals: 1, assists: 0, shots: 3, shotsOnTarget: 2, xg: 0.51, rating: 8, name: 'Delantero' });
    expect(line(doc, 10)).toMatchObject({ assists: 1, rating: 7 });
    expect(line(doc, 105)).toMatchObject({ goals: 0, ownGoals: 1, red: 1, tackles: 3, tacklesWon: 2, minutes: 60 });
  });

  it('leaves unknown values as null instead of zero: rating, name, xG of a shot without position', () => {
    const doc = linesOf();
    expect(line(doc, 7)).toMatchObject({ rating: null, name: null, xg: null, shots: 0 });
    expect(line(doc, 101)).toMatchObject({ saves: 4, rating: 6.5 });
  });

  it('works on summaries recorded before ratings, shots and names existed', () => {
    const doc = linesOf(summary({ ratings: undefined, shots: undefined, xg: undefined, names: undefined }));
    expect(line(doc, 9)).toMatchObject({ goals: 1, rating: null, xg: null, name: null, position: null });
    // Without registered positions the first starter is still the keeper: PES always puts him in slot 0.
    expect(line(doc, 1).position).toBe(0);
    expect(line(doc, 101).position).toBe(0);
    expect(doc.home.xg).toBeNull();
  });

  it('still credits scorers, assisters and booked players when the lineups are missing (early probe sessions)', () => {
    const doc = linesOf(summary({ lineups: undefined, substitutions: [], players: { home: [], away: [] } }));
    expect(doc.players.map(p => [p.id, p.side]).sort((a, b) => a[0] - b[0])).toEqual([[9, 'home'], [10, 'home'], [105, 'away']]);
    expect(line(doc, 105)).toMatchObject({ ownGoals: 1, red: 1, minutes: null, started: false });
  });

  it('does not throw on a malformed summary: lists that are not arrays count as empty', () => {
    const doc = linesOf(summary({ goals: {}, cards: 'x', substitutions: null, players: { home: {}, away: 3 }, shots: {} }));
    expect(line(doc, 9)).toMatchObject({ goals: 0, shots: 0, xg: null });
    // 22 starters plus the sub 12, still found through the final lineup.
    expect(doc.players).toHaveLength(23);
  });

  it('keeps the goals in match order with minute, scorer and the side they count for', () => {
    expect(linesOf().goals).toEqual([
      { side: 'home', minute: 20, second: 0, playerId: 9, ownGoal: false },
      { side: 'home', minute: 80, second: 0, playerId: 105, ownGoal: true },
    ]);
  });

  it('drops goals without a clock from the goal list (the score stays as the game reported it)', () => {
    const doc = linesOf(summary({ goals: [{ side: 'away', playerId: 101, ownGoal: false }, 'junk'] }));
    expect(doc.goals).toEqual([]);
  });

  it('keeps the shootout when there was one', () => {
    expect(linesOf(summary({ shootout: { home: 4, away: 3 } })).shootout).toEqual({ home: 4, away: 3 });
  });
});

const SESSION = 'E:/eFootball PES 2021/scl_probe/20261104_132319/events.ndjson';
describe.skipIf(!existsSync(SESSION))('buildMatchLinesDoc on a recorded session (real probe output)', () => {
  it('produces 22+ players whose goals add up to the score', () => {
    const [recorded] = splitMatches(parseEventLines(readFileSync(SESSION, 'utf8'))).map(summarizeMatch);
    const key = `${recorded.source.startedAt.replace(/[-:]/g, '')}_${recorded.match.homeTeamId}-${recorded.match.awayTeamId}`;
    const doc = buildMatchLinesDoc(buildLiveMatchDoc({ matchKey: key, summary: recorded }), recorded);
    expect(doc.players.length).toBeGreaterThanOrEqual(22);
    for (const side of ['home', 'away']) {
      const own = doc.players.filter(p => p.side === side).reduce((n, p) => n + p.goals, 0);
      const ownGoalsFor = doc.players.filter(p => p.side !== side).reduce((n, p) => n + p.ownGoals, 0);
      expect(own + ownGoalsFor).toBe(doc[side].score);
    }
    expect(JSON.stringify(doc).length).toBeLessThan(12 * 1024);
  });
});
