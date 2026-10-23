// Names added by the bridge (pes-collector/bridge/nameIndex.js). attachNames uses a synthetic index; the real
// database check runs only when the game files are in vendor/ (real fixture, skipped otherwise).
import fs from 'node:fs';
import path from 'node:path';
import { attachNames, buildNameIndex } from '../../pes-collector/bridge/nameIndex.js';
import { PESDB_DIR, EDIT_FILE, hasPesdb, hasEdit } from '../pes/fixtures.js';

const index = {
  teams: new Map([[101, 'Arsenal'], [103, 'Liverpool']]),
  players: new Map([[1, 'A. Uno'], [2, 'B. Dos'], [3, 'C. Tres'], [4, 'D. Cuatro'], [99, 'Nadie']]),
  positions: new Map([[1, 0], [4, 12], [99, 5]]),
};

const summary = {
  match: { homeTeamId: 101, awayTeamId: 999 },
  lineups: { home: { starting: [1], final: [1] }, away: { starting: [2], final: [4] } },
  players: { home: [{ id: 1 }], away: [{ id: 2 }, { id: 4 }, { id: 77 }] },
  goals: [{ side: 'home', playerId: 1, assistPlayerId: 3 }],
  substitutions: [{ side: 'away', offId: 2, onId: 4 }],
  cards: [],
};

describe('attachNames', () => {
  it('adds the team names and only the names of players in the match, leaving unknown ids out', () => {
    const named = attachNames(summary, index);
    expect(named.names.teams).toEqual({ home: 'Arsenal', away: null });
    expect(named.names.players).toEqual({ 1: 'A. Uno', 2: 'B. Dos', 3: 'C. Tres', 4: 'D. Cuatro' });
    expect(named.names.positions).toEqual({ 1: 0, 4: 12 }); // registered positions of players in the match only
    expect(summary.names).toBeUndefined(); // the original is not mutated
  });

  it('returns the summary unchanged without an index', () => {
    expect(attachNames(summary, null)).toBe(summary);
  });
});

describe.skipIf(!hasPesdb || !hasEdit)('buildNameIndex (real patch database and save)', () => {
  it('reads the names the game shows: the save wins over Team.bin', () => {
    const read = file => new Uint8Array(fs.readFileSync(file));
    const names = buildNameIndex({
      teamBin: read(path.join(PESDB_DIR, 'Team.bin')),
      playerBin: read(path.join(PESDB_DIR, 'Player.bin')),
      editBytes: read(EDIT_FILE),
    });
    expect(names.teams.get(101)).toBe('Arsenal');
    expect(names.players.get(119700)).toBe('L. Trossard');
  });
});
