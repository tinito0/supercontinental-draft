// REAL data: public/jugadores.json (OVR_CALCULADO = EJOGC's OverallStats export) and, when present, the
// game's Player.bin from vendor/. Both check the formula against the game database, not against itself.
import fs from 'node:fs';
import path from 'node:path';
import { playerRating, RATING_FIELDS } from '../../pes/rating.js';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { hasPesdb, readPesdb } from './fixtures.js';

const POSITIONS = ['PT', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MI', 'MD', 'MO', 'EI', 'ED', 'SD', 'DC'];
const market = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/jugadores.json'), 'utf8'));

// jugadores.json keeps the CSV column names; the engine uses binLayout's.
const csvName = field => (field.startsWith('gk') ? `GK${field.slice(2)}` : field[0].toUpperCase() + field.slice(1));

function fromMarket(player) {
  const stats = Object.fromEntries(RATING_FIELDS.filter(f => f !== 'registeredPosition').map(f => [f, Number(player[csvName(f)])]));
  return { ...stats, registeredPosition: POSITIONS.indexOf(player.POS_NOMBRE) };
}

const mismatches = rate => market
  .map(p => ({ id: p.Id, name: p.Name, expected: p.OVR_CALCULADO, got: rate(p) }))
  .filter(r => r.got !== r.expected);

describe('playerRating', () => {
  it('matches OVR_CALCULADO for every marketplace player', () => {
    expect(mismatches(p => playerRating(fromMarket(p)))).toEqual([]);
  });

  it('never goes below 40', () => {
    const floor = Object.fromEntries(RATING_FIELDS.map(f => [f, 40]));
    expect(playerRating({ ...floor, weakFootAcc: 1, registeredPosition: 5 })).toBe(40);
  });

  it('rejects an unknown position', () => {
    expect(() => playerRating({ ...fromMarket(market[0]), registeredPosition: 13 })).toThrow(RangeError);
  });
});

describe.skipIf(!hasPesdb)('playerRating on the real Player.bin', () => {
  it('matches OVR_CALCULADO for every marketplace player read from the game database', () => {
    const players = loadBinDatabase(readPesdb(['Player.bin'])).tables.player;
    const read = p => playerRating(Object.fromEntries(RATING_FIELDS.map(f => [f, players.get(Number(p.Id), f)])));
    expect(mismatches(read)).toEqual([]);
  });
});
