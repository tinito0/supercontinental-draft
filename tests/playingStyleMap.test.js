// PLAYING_STYLE_BY_ID (utils/constants.js) must stay equal to MAPEO_PLAYING_STYLE in scripts/main.py, which writes
// the style names into public/jugadores.json.
import fs from 'node:fs';
import path from 'node:path';
import { PLAYING_STYLE_BY_ID } from '../utils/constants.js';

it('matches MAPEO_PLAYING_STYLE in scripts/main.py', () => {
  const py = fs.readFileSync(path.resolve(__dirname, '../scripts/main.py'), 'utf8');
  const block = py.match(/MAPEO_PLAYING_STYLE = \{([\s\S]*?)\}/)[1];
  const fromPy = Object.fromEntries([...block.matchAll(/(\d+):\s*'([^']+)'/g)].map(m => [m[1], m[2]]));
  expect(PLAYING_STYLE_BY_ID).toEqual(Object.fromEntries(Object.entries(fromPy).map(([k, v]) => [Number(k), v])));
});
