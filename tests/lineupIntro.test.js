// Once inicial animado de OBS (utils/lineupIntro.js). Synthetic data: the Arsenal plan of the real save decoded
// (tests/pesCollector/formations.test.js), not a recorded match.
import { formationLabel, formationLines, introStep, introTeams, lineupIntroRemainingMs } from '../utils/lineupIntro.js';

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
});
