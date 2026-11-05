// Season totals from match_lines documents (utils/seasonStats.js). Synthetic lines prove the arithmetic; the
// recorded sessions (skipped when E:\ is missing) prove it runs on real probe output.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildSeasonStats, clubMatchLog, headToHead, matchupFacts, playerMatchLog, seasonLeaders, teamOfTheRound, MIN_RATED_MATCHES } from '../utils/seasonStats.js';
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

const goal = (side, minute, playerId, extra = {}) => ({ side, minute, second: 0, playerId, ownGoal: false, ...extra });
const comeback = lines('20261124T200000Z_1-2', team('A', 'Los Pibes', 3), team('B', 'La Banda', 2), [
  player(9, 'home', { goals: 2 }), player(10, 'home', { goals: 1 }), player(300, 'away', { goals: 2 }),
], { goals: [goal('away', 3, 300), goal('away', 30, 300), goal('home', 50, 9), goal('home', 70, 10), goal('home', 88, 9)] });
const quick = lines('20261201T200000Z_2-1', team('B', 'La Banda', 2), team('A', 'Los Pibes', 0), [player(300, 'home', { goals: 1 })], {
  goals: [goal('home', 1, 999, { ownGoal: true, second: 10 }), goal('home', 2, 300, { second: 40 })],
});
const brokenGoals = lines('20261202T200000Z_2-1', team('B', 'La Banda', 2), team('A', 'Los Pibes', 1), [], {
  // The list misses a goal: no comeback can be worked out from it.
  goals: [goal('away', 5, 9), goal('home', 60, 300)],
});

describe('season records from the goal list', () => {
  const records = buildSeasonStats([m1, comeback, quick, brokenGoals]).records;

  it('finds the fastest goal, leaving own goals out, with the scorer name from the lines', () => {
    expect(records.fastestGoal).toMatchObject({ matchKey: quick.matchKey, minute: 2, second: 40, playerId: 300, name: 'J300', side: 'home' });
  });

  it('finds comebacks: the winner was behind, by how many goals', () => {
    expect(records.comebacks).toEqual([expect.objectContaining({ matchKey: comeback.matchKey, deficit: 2, winner: 'home' })]);
  });

  it('skips matches whose goal list does not add up to the score, and documents without goals (older uploads)', () => {
    expect(records.comebacks.map(c => c.matchKey)).not.toContain(brokenGoals.matchKey);
    expect(buildSeasonStats([m1]).records).toMatchObject({ fastestGoal: null, comebacks: [] });
  });
});

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
    expect(stats.records.mostGoals).toMatchObject({ matchKey: m1.matchKey, goals: 3 });
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
    expect(buildSeasonStats([])).toMatchObject({ matches: 0, players: [], clubs: [], records: { biggestWin: null, mostGoals: null, hatTricks: [], fastestGoal: null, comebacks: [] } });
  });
});

describe('playerMatchLog', () => {
  it('lists the official matches a player played, newest first, with rival, result and his line', () => {
    const log = playerMatchLog([m1, m2, testMatch, live], 9, { officialKeys: OFFICIAL });
    expect(log.map(entry => entry.matchKey)).toEqual([m2.matchKey, m1.matchKey]);
    expect(log[0]).toMatchObject({ own: { name: 'Los Pibes', score: 1 }, rival: { name: 'La Banda', score: 1 }, result: 'D', line: { goals: 1 } });
    expect(log[1]).toMatchObject({ result: 'W', line: { goals: 3, rating: 9 } });
  });

  it('is empty for a player with no official match', () => {
    expect(playerMatchLog([m1], 999, { officialKeys: OFFICIAL })).toEqual([]);
  });
});

describe('teamOfTheRound', () => {
  // PES codes: 0 PT, 1 DFC, 5 MC, 12 DC.
  const round = lines('20261124T200000Z_1-2', team('A', 'Los Pibes', 2), team('B', 'La Banda', 1), [
    player(1, 'home', { position: 0, rating: 7 }), player(201, 'away', { position: 0, rating: 8 }),
    ...[2, 3, 4, 5, 6].map(id => player(id, 'home', { position: 1, rating: 5 + id / 10 })),
    ...[20, 21, 22, 23].map(id => player(id, 'away', { position: 5, rating: 6 + id / 100 })),
    ...[30, 31, 32].map(id => player(id, 'home', { position: 12, rating: 7.5, goals: id === 31 ? 2 : 0 })),
    player(40, 'home', { position: null, rating: 9.5 }), player(41, 'home', { position: 12, rating: null }),
  ]);
  const xi = teamOfTheRound([round, m1], [round.matchKey]);

  it('picks a 4-3-3 from the best ratings of the round, by registered position', () => {
    expect(xi.keeper.map(p => p.id)).toEqual([201]);
    expect(xi.defense.map(p => p.id)).toEqual([6, 5, 4, 3]);
    expect(xi.midfield.map(p => p.id)).toEqual([23, 22, 21]);
    expect(xi.forward[0]).toMatchObject({ id: 31, clubName: 'Los Pibes', matchKey: round.matchKey });
  });

  it('leaves out players without rating or position and matches outside the round', () => {
    const ids = [...xi.keeper, ...xi.defense, ...xi.midfield, ...xi.forward].map(p => p.id);
    expect(ids).not.toContain(40);
    expect(ids).not.toContain(41);
    expect(ids).not.toContain(9);
    expect(teamOfTheRound([round], [])).toBeNull();
  });
});

describe('clubMatchLog', () => {
  it('lists a club official results newest first, from its side', () => {
    const log = clubMatchLog([m1, m2, testMatch, live], 'B', { officialKeys: OFFICIAL });
    expect(log.map(entry => [entry.matchKey, entry.result, entry.own.score, entry.rival.score])).toEqual([
      [m2.matchKey, 'D', 1, 1], [m1.matchKey, 'L', 0, 3],
    ]);
    expect(log[0].shootout).toEqual({ home: 4, away: 2 });
  });
});

describe('headToHead', () => {
  it('counts the meetings between two clubs from the first club side', () => {
    const h2h = headToHead([m1, m2, testMatch], 'A', 'B', { officialKeys: OFFICIAL });
    expect(h2h).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 4, goalsAgainst: 1 });
    expect(h2h.matches.map(entry => entry.matchKey)).toEqual([m2.matchKey, m1.matchKey]);
    expect(headToHead([m1], 'A', 'Z').played).toBe(0);
  });
});

describe('matchupFacts', () => {
  it('gives each club form and their head to head, for the OBS preview', () => {
    expect(matchupFacts([m1, m2], 'A', 'B', { officialKeys: OFFICIAL })).toEqual({
      homeForm: ['D', 'W'], awayForm: ['D', 'L'], h2h: { played: 2, won: 1, drawn: 1, lost: 0 },
    });
  });

  it('is null when neither club has an official match yet, or a club id is missing', () => {
    expect(matchupFacts([m1], 'X', 'Y')).toBeNull();
    expect(matchupFacts([m1], 'A', null)).toBeNull();
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
