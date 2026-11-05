// Season totals from match_lines documents (utils/seasonStats.js). Synthetic lines prove the arithmetic; the
// recorded sessions (skipped when E:\ is missing) prove it runs on real probe output.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildSeasonStats, seasonLeaders, MIN_RATED_MATCHES } from '../utils/seasonStats.js';
import { buildLiveMatchDoc } from '../supabase/functions/_shared/matchFeed.js';
import { buildMatchLinesDoc } from '../supabase/functions/_shared/matchLines.js';
import { parseEventLines, splitMatches, summarizeMatch } from '../pes-collector/collector/matchSummary.js';

const player = (id, side, extra = {}) => ({
  id, side, name: `J${id}`, position: null, started: true, minutes: 90, goals: 0, ownGoals: 0, assists: 0, yellow: 0, red: 0,
  shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, tacklesWon: 0, interceptions: 0, clearances: 0,
  dribblesCompleted: 0, saves: 0, shotsOnTargetFaced: 0, xg: 0, rating: 6, ...extra,
});
const team = (draftTeamId, name, score, xg = 1) => ({ gameTeamId: 1, draftTeamId, name, score, xg });
const lines = (matchKey, home, away, players, extra = {}) => ({
  schema: 'scl.lines/1', matchKey, status: 'finished', startedAt: matchKey.slice(0, 16), competition: 'friendly',
  home, away, shootout: null, players, ...extra,
});

const m1 = lines('20261110T200000Z_1-2', team('A', 'Los Pibes', 3), team('B', 'La Banda', 0), [
  player(9, 'home', { goals: 3, shots: 5, xg: 1.2, rating: 9 }),
  player(1, 'home', { position: 0, saves: 2 }),
  player(10, 'home', { assists: 2, rating: 7.5 }),
  player(201, 'away', { position: 0, rating: 5, red: 1, minutes: 70 }),
]);
const m2 = lines('20261117T200000Z_2-1', team('B', 'La Banda', 1), team('A', 'Los Pibes', 1), [
  player(9, 'away', { goals: 1, rating: 7, xg: null }),
  player(1, 'away', { position: 0 }),
  player(201, 'home', { position: 0, rating: null }),
], { shootout: { home: 4, away: 2 } });
const testMatch = lines('20261118T200000Z_5-6', team(null, null, 9), team(null, null, 0), [player(9, 'home', { goals: 9 })]);
const live = lines('20261119T200000Z_1-2', team('A', 'Los Pibes', 1), team('B', 'La Banda', 0), [player(9, 'home', { goals: 1 })], { status: 'live' });

const OFFICIAL = new Set([m1.matchKey, m2.matchKey, live.matchKey]);
const stats = buildSeasonStats([m1, m2, testMatch, live], { officialKeys: OFFICIAL });
const byId = id => stats.players.find(p => p.id === id);
const club = id => stats.clubs.find(c => c.key === id);

describe('buildSeasonStats', () => {
  it('counts only finished official matches: test games and the live match stay out', () => {
    expect(stats.matches).toBe(2);
    expect(byId(9)).toMatchObject({ apps: 2, goals: 4, assists: 0, minutes: 180 });
  });

  it('without an official list every finished match counts (preseason, nothing imported yet)', () => {
    expect(buildSeasonStats([m1, m2, testMatch, live]).matches).toBe(3);
  });

  it('averages the rating over rated matches only and keeps xG null when one match has no estimate', () => {
    expect(byId(9)).toMatchObject({ rating: 8, rated: 2, xg: null });
    expect(byId(201)).toMatchObject({ rating: 5, rated: 1 });
  });

  it('keeps the player clubs by draft team, newest last', () => {
    expect(byId(9)).toMatchObject({ clubKey: 'A', clubName: 'Los Pibes', name: 'J9' });
  });

  it('gives a goalkeeper a clean sheet when his team conceded nothing and he played the whole match', () => {
    expect(byId(1)).toMatchObject({ cleanSheets: 1, saves: 2 });
    expect(byId(201).cleanSheets).toBe(0);
  });

  it('builds the club record: results, goals, and the form newest first, a shootout draw marked', () => {
    expect(club('A')).toMatchObject({ name: 'Los Pibes', played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 1 });
    expect(club('A').form).toEqual(['D', 'W']);
    expect(club('B').form).toEqual(['D', 'L']);
    expect(club('A').matchKeys).toEqual([m2.matchKey, m1.matchKey]);
  });

  it('finds the records: biggest win and hat-tricks', () => {
    expect(stats.records.biggestWin).toMatchObject({ matchKey: m1.matchKey, margin: 3 });
    expect(stats.records.hatTricks).toEqual([{ matchKey: m1.matchKey, playerId: 9, name: 'J9', goals: 3 }]);
  });

  it('keeps one club when its first matches were uploaded before the draft assignment existed', () => {
    const early = lines('20261101T200000Z_1-2', { ...team(null, null, 1), gameTeamId: 7 }, { ...team(null, null, 0), gameTeamId: 8 }, [player(9, 'home', { goals: 1 })]);
    const later = lines('20261102T200000Z_1-2', { ...team('A', 'Los Pibes', 2), gameTeamId: 7 }, { ...team('B', 'La Banda', 0), gameTeamId: 8 }, [player(9, 'home')]);
    const season = buildSeasonStats([early, later]);
    expect(season.clubs.map(c => c.key).sort()).toEqual(['A', 'B']);
    expect(season.clubs.find(c => c.key === 'A')).toMatchObject({ name: 'Los Pibes', played: 2, won: 2 });
    expect(season.players.find(p => p.id === 9).clubKey).toBe('A');
  });

  it('returns empty totals for no matches', () => {
    expect(buildSeasonStats([])).toMatchObject({ matches: 0, players: [], clubs: [], records: { biggestWin: null, hatTricks: [] } });
  });
});

describe('seasonLeaders', () => {
  it('ranks by a field, drops zeros, and ties go to fewer minutes', () => {
    expect(seasonLeaders(stats.players, 'goals').map(p => p.id)).toEqual([9]);
    expect(seasonLeaders(stats.players, 'assists').map(p => p.id)).toEqual([10]);
  });

  it(`ranks ratings only for players with at least ${MIN_RATED_MATCHES} rated matches`, () => {
    // 9 averages 8 over two matches, the keeper 1 averages 6; 10 and 201 have one rated match each.
    expect(seasonLeaders(stats.players, 'rating').map(p => p.id)).toEqual([9, 1]);
  });
});

const PROBE = 'E:/eFootball PES 2021/scl_probe';
describe.skipIf(!existsSync(PROBE))('buildSeasonStats on the recorded sessions (real probe output)', () => {
  it('adds up every recorded match without throwing, goals matching the scores', () => {
    const docs = readdirSync(PROBE).filter(d => /^2026/.test(d) && existsSync(`${PROBE}/${d}/events.ndjson`)).flatMap(dir => {
      const summaries = splitMatches(parseEventLines(readFileSync(`${PROBE}/${dir}/events.ndjson`, 'utf8'))).map(summarizeMatch);
      return summaries.map(s => {
        const key = `${String(s.source.startedAt).replace(/[-:]/g, '')}_${s.match.homeTeamId}-${s.match.awayTeamId}`;
        return buildMatchLinesDoc(buildLiveMatchDoc({ matchKey: key, summary: s }), s);
      });
    });
    const season = buildSeasonStats(docs);
    const finished = docs.filter(d => d.status === 'finished');
    expect(season.matches).toBe(finished.length);
    const goals = season.players.reduce((n, p) => n + p.goals + p.ownGoals, 0);
    expect(goals).toBe(finished.reduce((n, d) => n + d.home.score + d.away.score, 0));
  });
});
