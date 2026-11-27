// Once inicial animado de OBS (utils/lineupIntro.js). Synthetic data: the Arsenal plan of the real save decoded
// (tests/pesCollector/formations.test.js), not a recorded match.
import { formationLabel, formationLines, introStep, introTeams, introWakeMs, lineupIntroRemainingMs, pitchLayout, wipeSchedule, XI_MOTION, XI_PITCH } from '../utils/lineupIntro.js';

// Arsenal variant 0: roles and (depth, lateral) per formation slot.
const ROLES = [0, 1, 1, 3, 2, 4, 5, 10, 9, 8, 12];
const POS = [[3, 52], [11, 64], [11, 40], [13, 88], [13, 16], [21, 58], [30, 40], [35, 91], [36, 17], [32, 67], [42, 56]];
const players = (roles = ROLES, pos = POS) => roles.map((role, i) => ({ id: 1000 + i, name: `J${i}`, number: i + 1, role, depth: pos[i][0], lateral: pos[i][1] }));
const team = (name, list = players()) => ({ name, draftTeamId: null, players: list });
const intro = (teams, extra = {}) => ({ visible: true, key: 'k', teamSec: 9, shownAt: 0, teams, ...extra });

describe('formationLines', () => {
  it('puts the keeper first, then lines by depth, each from the left wing to the right', () => {
    const lines = formationLines(players());
    expect(lines.map(line => line.map(p => p.id - 1000))).toEqual([[0], [4, 2, 1, 3], [5], [8, 6, 9, 7], [10]]);
  });

  it('returns nothing without players', () => {
    expect(formationLines([])).toEqual([]);
    expect(formationLines(null)).toEqual([]);
  });
});

describe('formationLabel', () => {
  it('names the formation by roles like on TV', () => {
    expect(formationLabel(players())).toBe('4-3-3');
    expect(formationLabel(players([0, 1, 1, 1, 4, 4, 7, 6, 8, 11, 12]))).toBe('3-5-2');
    expect(formationLabel(players([0, 1, 1, 2, 3, 4, 4, 6, 8, 7, 12]))).toBe('4-2-3-1');
    expect(formationLabel(players([0, 1, 1, 2, 3, 6, 5, 5, 7, 12, 12]))).toBe('4-4-2');
  });
});

describe('pitchLayout', () => {
  // Recorded (probe v7, session 20261125_141509, Panathinaikos vs Sheriff): role, depth, lateral of each XI.
  const REAL_433 = [[0, 3, 52], [2, 12, 15], [1, 10, 41], [1, 10, 63], [3, 12, 89], [5, 21, 38], [5, 21, 67], [8, 33, 53], [9, 39, 14], [12, 43, 52], [10, 39, 86]];
  const REAL_442 = [[0, 3, 52], [2, 13, 16], [1, 11, 40], [1, 11, 64], [3, 13, 88], [5, 21, 40], [4, 21, 64], [5, 31, 16], [7, 31, 88], [12, 43, 40], [11, 41, 64]];
  const fromRows = rows => rows.map(([role, depth, lateral], i) => ({ id: i + 1, role, depth, lateral }));
  const overlaps = cards => cards.some((a, i) => cards.some((b, j) => i < j
    && Math.abs(a.x - b.x) < XI_PITCH.cardWidth && Math.abs(a.y - b.y) < XI_PITCH.cardHeight));
  const inside = cards => cards.every(c => c.x >= 0 && c.y >= 0
    && c.x <= XI_PITCH.width - XI_PITCH.cardWidth && c.y <= XI_PITCH.height - XI_PITCH.cardHeight);

  it.each([['real 4-3-3', fromRows(REAL_433)], ['real 4-4-2', fromRows(REAL_442)], ['fixture 4-3-3', players()],
    ['fixture 3-5-2', players([0, 1, 1, 1, 4, 4, 7, 6, 8, 11, 12], [[3, 52], [11, 32], [11, 52], [11, 72], [19, 40], [19, 64], [31, 16], [33, 52], [31, 88], [43, 26], [41, 64]])]])(
    '%s: every card on the pitch, none on top of another', (_, list) => {
      const cards = pitchLayout(formationLines(list));
      expect(cards).toHaveLength(11);
      expect(inside(cards)).toBe(true);
      expect(overlaps(cards)).toBe(false);
    },
  );

  it('keeps the game shape: keeper on the left, wide midfielders out on the wings, strikers furthest forward', () => {
    const cards = pitchLayout(formationLines(fromRows(REAL_442)));
    const byId = id => cards.find(c => c.id === id);
    expect(byId(1)).toMatchObject({ x: 0, line: 0 });
    expect(byId(8).y).toBe(Math.min(...cards.map(c => c.y)));
    expect(byId(9).y).toBe(Math.max(...cards.map(c => c.y)));
    expect(byId(8).y).toBeLessThan(byId(6).y);
    expect(Math.max(byId(10).x, byId(11).x)).toBe(XI_PITCH.width - XI_PITCH.cardWidth);
    expect(byId(6).x).toBeLessThan(byId(8).x);
  });

  it('returns nothing without lines', () => {
    expect(pitchLayout([])).toEqual([]);
  });
});

describe('introTeams', () => {
  it('keeps only teams with exactly 11 players and labels the roles', () => {
    const teams = introTeams(intro([team('A'), team('B', players().slice(0, 10))]));
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ name: 'A', draftTeamId: null, formation: '4-3-3' });
    expect(teams[0].lines[0][0].roleLabel).toBe('PT');
    expect(introTeams(null)).toEqual([]);
  });
});

describe('timing', () => {
  const doc = intro([team('A'), team('B')]);

  it('lasts teamSec per team from shownAt', () => {
    expect(lineupIntroRemainingMs(doc, 0)).toBe(18_000);
    expect(lineupIntroRemainingMs(doc, 18_000)).toBe(0);
    expect(lineupIntroRemainingMs(intro([]), 0)).toBe(0);
  });

  it('shows the home team first, then the away team', () => {
    expect(introStep(doc, 18_000)).toEqual({ index: 0, remainingMs: 9_000 });
    expect(introStep(doc, 9_500)).toEqual({ index: 0, remainingMs: 500 });
    expect(introStep(doc, 9_000)).toEqual({ index: 1, remainingMs: 9_000 });
    expect(introStep(doc, 1_000)).toEqual({ index: 1, remainingMs: 1_000 });
    expect(introStep(doc, 0)).toBeNull();
  });

  it('wakes the clock right when each team starts leaving and when it is gone, not only once a second', () => {
    // 18 s in total, 9 s per team, 300 ms exit: the home team starts leaving with 9 300 ms left.
    expect(introWakeMs(doc, 18_000, 300)).toBe(1_000);
    expect(introWakeMs(doc, 9_800, 300)).toBe(500);
    expect(introStep(doc, 9_300)).toEqual({ index: 0, remainingMs: 300 });
    expect(introWakeMs(doc, 9_300, 300)).toBe(300);
    expect(introWakeMs(doc, 500, 300)).toBe(200);
    expect(introWakeMs(doc, 200, 300)).toBe(200);
  });
});

describe('wipeSchedule', () => {
  const cards = pitchLayout(formationLines(players()));
  const order = schedule => Object.entries(schedule).sort((a, b) => a[1].inMs - b[1].inMs).map(([id]) => Number(id) - 1000);

  it('wipes the keeper first, then each line from the left wing, with a pause between lines', () => {
    const schedule = wipeSchedule(cards);
    expect(order(schedule)).toEqual([0, 4, 2, 1, 3, 5, 8, 6, 9, 7, 10]);
    const { playersStartMs: start, staggerMs: step, lineGapMs: gap } = XI_MOTION;
    expect(schedule[1000].inMs).toBe(start);
    expect(schedule[1004].inMs).toBe(start + step + gap);
    expect(schedule[1002].inMs).toBe(start + 2 * step + gap);
    expect(schedule[1010].inMs).toBe(start + 10 * step + 4 * gap);
  });

  it('leaves in the same order, outStaggerMs apart, starting with no delay', () => {
    const schedule = wipeSchedule(cards);
    expect(schedule[1000].outMs).toBe(0);
    expect(schedule[1010].outMs).toBe(10 * XI_MOTION.outStaggerMs);
  });

  it('follows another order and stagger when configured', () => {
    const forwards = wipeSchedule(cards, { ...XI_MOTION, order: 'forwards-first' });
    expect(order(forwards)).toEqual([10, 8, 6, 9, 7, 5, 4, 2, 1, 3, 0]);
    const topDown = wipeSchedule(cards, { ...XI_MOTION, order: 'top-down', staggerMs: 50 });
    const ranks = order(topDown);
    const ys = ranks.map(i => cards.find(c => c.id === 1000 + i).y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(topDown[1000 + ranks[3]].inMs).toBe(XI_MOTION.playersStartMs + 150);
  });

  it('fits every exit inside leaveMs', () => {
    const last = (cards.length - 1) * XI_MOTION.outStaggerMs + XI_MOTION.outWipeMs;
    expect(last).toBeLessThanOrEqual(XI_MOTION.leaveMs);
    expect(XI_MOTION.panelOutDelayMs + XI_MOTION.panelOutMs).toBeLessThanOrEqual(XI_MOTION.leaveMs);
  });
});
