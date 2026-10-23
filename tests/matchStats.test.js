// Estadísticas del registro de partidos (utils/matchStats.js) con resúmenes sintéticos.
import { formatStat, minutesPlayed, percent, playerLeaders, playerProfile, shotRows, statSections } from '../utils/matchStats.js';

const clock = (period, minute, second = 0) => ({ period, minute, second });

const fullStats = (over = {}) => ({
  shots: 6, shotsOnTarget: 4, passes: 80, passesCompleted: 60, shortPasses: 50, shortPassesCompleted: 45,
  throughPasses: 10, throughPassesCompleted: 5, longPasses: 15, longPassesCompleted: 8, crosses: 5, crossesCompleted: 2,
  corners: 3, fouls: 2, saves: 1, yellowCards: 0, redCards: 0, interceptions: 7, tacklesWon: 2, tackles: 5,
  clearances: 4, dribbles: 6, dribblesCompleted: 3, touches: 120, offsides: 1, freeKicks: 2, penaltyShots: 0, ...over,
});

const summary = {
  status: 'finished',
  clock: clock(2, 90),
  score: { home: 2, away: 1 },
  teamStats: { home: fullStats(), away: fullStats({ shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0 }) },
  players: {
    home: [{ id: 10, stats: { goals: 2, shots: 4, passes: 30, passesCompleted: 25, touches: 40 } }, { id: 11, stats: { goals: 0, touches: 5 } }],
    away: [{ id: 20, stats: { goals: 0, interceptions: 3 } }],
  },
  goals: [{ side: 'away', playerId: 11, ownGoal: true, clock: clock(1, 10) }],
  lineups: { home: { starting: [10, 11] }, away: { starting: [20] } },
  substitutions: [{ side: 'home', offId: 11, onId: 12, clock: clock(2, 60) }],
  cards: [{ side: 'away', playerId: 20, type: 'red', clock: clock(2, 75) }],
  shots: [
    { side: 'home', playerId: 10, clock: clock(1, 5, 3), outcome: 'goal', penalty: false },
    { side: 'home', playerId: 10, clock: null, outcome: 'off_target', penalty: false },
  ],
  names: { players: { 10: 'Diez', 11: 'Once', 12: 'Doce', 20: 'Veinte' } },
  teamPlans: { home: { status: 'matches', numbers: { 10: 9 } } },
};

describe('percent and formatStat', () => {
  it('rounds to whole percent and gives null without a denominator', () => {
    expect(percent(2, 3)).toBe(67);
    expect(percent(0, 0)).toBeNull();
    expect(percent(1, undefined)).toBeNull();
  });

  it('formats counts, ratios and missing values', () => {
    expect(formatStat(5)).toBe('5');
    expect(formatStat({ made: 44, total: 54, pct: 81 })).toBe('44/54 (81 %)');
    expect(formatStat({ made: 0, total: 0, pct: null })).toBe('0/0');
    expect(formatStat(null)).toBe('—');
  });
});

describe('statSections', () => {
  const sections = statSections(summary);
  const row = (section, key) => sections.find(s => s.id === section).rows.find(r => r.key === key);

  it('groups the rows and computes the derived ones with their denominators', () => {
    expect(sections.map(s => s.id)).toEqual(['principales', 'tiros', 'pases', 'defensa', 'duelos', 'disciplina']);
    expect(row('tiros', 'shotsOffTarget').home).toBe(2);
    expect(row('pases', 'passAccuracy').home).toEqual({ made: 60, total: 80, pct: 75 });
    expect(row('pases', 'longPasses').display.home).toBe('8/15 (53 %)');
    expect(row('duelos', 'duels').home).toEqual({ made: 2, total: 5, pct: 40 });
  });

  it('counts only the team\'s own shot goals in the conversion, not own goals of the rival', () => {
    expect(row('tiros', 'shotGoals')).toMatchObject({ home: 2, away: 0 });
    expect(row('tiros', 'conversion').home).toEqual({ made: 2, total: 6, pct: 33 });
    expect(row('tiros', 'conversion').away).toEqual({ made: 0, total: 0, pct: null });
  });

  it('draws percentages against 100 and counts against the sum, with the leader marked', () => {
    expect(row('principales', 'shots').share).toEqual({ home: 100, away: 0 });
    expect(row('principales', 'shots').leader).toBe('home');
    expect(row('pases', 'passAccuracy').share.home).toBe(75);
  });

  it('leaves out rows nobody measured instead of showing zeros (old summaries)', () => {
    const old = { teamStats: { home: { shots: 3, passes: 10, passesCompleted: 8, crosses: 2 }, away: { shots: 1, passes: 9, passesCompleted: 5, crosses: 0 } } };
    const keys = statSections(old).flatMap(s => s.rows.map(r => r.key));
    expect(keys).toContain('shots');
    expect(keys).not.toContain('longPasses');
    expect(keys).not.toContain('touches');
    expect(statSections(old).find(s => s.id === 'pases').rows.find(r => r.key === 'crosses').home).toBe(2); // count only
    expect(statSections({})).toEqual([]);
  });

  it('puts possession first when the collector measured it, and leaves it out when it is unknown', () => {
    const withPossession = statSections({ ...summary, possession: { home: 46, away: 54, counters: { home: 6536, away: 7553 } } });
    expect(withPossession[0].rows[0]).toMatchObject({ key: 'possession', display: { home: '46 %', away: '54 %' } });
    expect(sections.flatMap(s => s.rows).some(r => r.key === 'possession')).toBe(false);
  });
});

describe('shots and players', () => {
  it('lists shots with minute, outcome and an unknown minute as a dash', () => {
    expect(shotRows(summary).map(s => [s.name, s.minute, s.outcomeLabel])).toEqual([
      ['Diez', "6'", 'Gol'], ['Diez', '—', 'Desviado o bloqueado'],
    ]);
    expect(shotRows({})).toEqual([]);
  });

  it('computes minutes played from kick-off, substitutions and red cards', () => {
    expect(minutesPlayed(summary, 'home', 10)).toBe(90);
    expect(minutesPlayed(summary, 'home', 11)).toBe(60);
    expect(minutesPlayed(summary, 'home', 12)).toBe(30);
    expect(minutesPlayed(summary, 'away', 20)).toBe(75);
    expect(minutesPlayed(summary, 'home', 99)).toBeNull();
  });

  it('builds a profile with measured groups only, the shirt number and the player\'s shots', () => {
    const profile = playerProfile(summary, 'home', 10);
    expect(profile).toMatchObject({ name: 'Diez', number: 9, minutes: 90, hasStats: true });
    expect(profile.groups[0].rows.map(r => r.label)).toEqual(['Goles', 'Tiros', 'Toques']);
    expect(profile.shots).toHaveLength(2);
    expect(playerProfile(summary, 'home', 12)).toMatchObject({ hasStats: false, groups: [] });
  });

  it('ranks leaders across both teams and skips stats nobody recorded', () => {
    const leaders = playerLeaders(summary);
    expect(leaders.find(l => l.key === 'touches').players.map(p => p.id)).toEqual([10, 11]);
    expect(leaders.find(l => l.key === 'interceptions').players).toEqual([{ side: 'away', id: 20, name: 'Veinte', value: 3 }]);
    expect(leaders.find(l => l.key === 'tacklesWon')).toBeUndefined();
  });
});
