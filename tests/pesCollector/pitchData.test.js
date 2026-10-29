import {
  PENALTY_XG, buildHeatmaps, buildRatings, locateShots, positionSamples, shotXg, teamXg,
} from '../../pes-collector/collector/pitchData.js';

// Synthetic probe events (encode/decode symmetry only, not game compatibility). The real-data check of the same
// rules is in docs/PES_MATCH_DATA_RESEARCH.md S15 (session 20261029_001439).

const HOME = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AWAY = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
const lineup = (side, ids, ms = 0) => ({ t: 'lineup', side, ids, ms, c: [1, 0, 0] });

/** 22 (x, z) pairs: home keeper at homeKeeperX, everyone else spread on the pitch, `moved` shifts all by 1 m. */
function pos(ms, period, { homeKeeperX = -45, moved = 0 } = {}) {
  const p = [];
  for (let i = 0; i < 22; i += 1) {
    if (i === 0) p.push(homeKeeperX, 0);
    else if (i === 11) p.push(-homeKeeperX, 0);
    else p.push(i - 11 + moved, (i % 5) - 2);
  }
  return { t: 'pos', ms, c: [period, 10, 0], p };
}

const float = value => new Uint32Array(new Float32Array([value]).buffer)[0];

describe('buildRatings', () => {
  test('reads kind 179 word 0 as a float and leaves out empty ratings', () => {
    const players = [
      { id: 101520, kinds: { 179: [float(7), 0, 0, 0, 90, 74, 3, 1, 0] } },
      { id: 126689, kinds: { 179: [float(6.5), 0, 0, 0, 0, 0, 0, 0, 0] } },
      { id: 127571, kinds: { 179: [0, 0, 1, 3, 0, 0, 0, 0, 0] } },
      { id: 5, kinds: {} },
    ];

    expect(buildRatings(players)).toEqual({ 101520: 7, 126689: 6.5 });
  });

  test('null without any rating', () => {
    expect(buildRatings([{ id: 1, kinds: {} }])).toBeNull();
  });
});

describe('positionSamples', () => {
  test('ties entries to the XI by slot and turns each team to attack right', () => {
    const events = [lineup(0, HOME), lineup(1, AWAY), pos(1000, 1)];

    const [sample] = positionSamples(events);

    const keeper = sample.players.find(p => p.id === 1);
    const awayKeeper = sample.players.find(p => p.id === 21);
    expect(keeper).toMatchObject({ side: 0, x: 7.5, y: 34 });
    // The away keeper stands at +45: turned, its own goal is also at the left.
    expect(awayKeeper).toMatchObject({ side: 1, x: 7.5, y: 34 });
  });

  test('second half: the direction comes from where the home keeper stands', () => {
    const events = [lineup(0, HOME), lineup(1, AWAY), pos(1000, 2, { homeKeeperX: 45 })];

    const keeper = positionSamples(events)[0].players.find(p => p.id === 1);

    expect(keeper.x).toBe(7.5);
  });

  test('a substitute takes the slot from the lineup in force', () => {
    const changed = [...HOME];
    changed[10] = 99;
    const events = [lineup(0, HOME), lineup(1, AWAY), pos(1000, 1), lineup(0, changed, 2000), pos(3000, 1, { moved: 1 })];

    const [first, second] = positionSamples(events);

    expect(first.players.some(p => p.id === 11)).toBe(true);
    expect(second.players.some(p => p.id === 99)).toBe(true);
    expect(second.players.some(p => p.id === 11)).toBe(false);
  });
});

describe('buildHeatmaps', () => {
  test('counts only refreshed entries, per player and per team', () => {
    const events = [lineup(0, HOME), lineup(1, AWAY), pos(1000, 1), pos(2000, 1), pos(3000, 1, { moved: 1 })];

    const heat = buildHeatmaps(positionSamples(events));

    const sum = cells => cells.reduce((a, b) => a + b, 0);
    // First sample: all 22 new. Second: nothing moved. Third: 20 outfield players moved, keepers did not.
    expect(sum(heat.teams.home) + sum(heat.teams.away)).toBe(22 + 20);
    expect(sum(heat.players[1])).toBe(1);
    expect(heat.cols * heat.rows).toBe(heat.teams.home.length);
  });

  test('null without positions', () => {
    expect(buildHeatmaps([])).toBeNull();
  });
});

describe('shotXg', () => {
  test('closer and more central is worth more; a penalty is fixed', () => {
    const sixYards = shotXg({ x: 99.5, y: 34 });
    const spot = shotXg({ x: 94, y: 34 });
    const long = shotXg({ x: 80, y: 34 });
    const wide = shotXg({ x: 99.5, y: 10 });

    expect(sixYards).toBeGreaterThan(spot);
    expect(spot).toBeGreaterThan(long);
    expect(sixYards).toBeGreaterThan(wide);
    expect(shotXg({ x: 50, y: 34, penalty: true })).toBe(PENALTY_XG);
  });
});

describe('locateShots and teamXg', () => {
  const rises = [
    { ms: 5000, kind: 6, delta: 1 },
    { ms: 9000, kind: 6, delta: 1 },
  ];

  test('takes the shooter position refreshed before the shot; unknown stays null', () => {
    const events = [lineup(0, HOME), lineup(1, AWAY), pos(4000, 1)];
    const samples = positionSamples(events);
    const shots = [
      { side: 'home', playerId: 11, outcome: 'off_target', penalty: false },
      { side: 'away', playerId: 77, outcome: 'off_target', penalty: false },
    ];

    const located = locateShots(shots, rises, samples);

    // Slot 10 stands at (−1, −2) from the centre spot, home attacking +x.
    expect(located[0]).toMatchObject({ x: 51.5, y: 32 });
    expect(located[0].xg).toBeGreaterThan(0);
    expect(located[1]).toMatchObject({ x: null, y: null, xg: null });
    expect(teamXg(located)).toEqual({ home: located[0].xg, away: null });
  });

  test('a team without shots has xG 0', () => {
    expect(teamXg([{ side: 'home', xg: 0.4 }])).toEqual({ home: 0.4, away: 0 });
  });
});
