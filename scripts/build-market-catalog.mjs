// Builds supabase/functions/_shared/catalog.json, the price list the market Edge Function trusts,
// from public/jugadores.json with the same filtering and number coercion as the app
// (isGlitchedPlayer + processPlayersData). Re-run whenever jugadores.json changes:
//   node scripts/build-market-catalog.mjs
// Row: [Precio (millions), Age, OVR_CALCULADO, Name, POS_NOMBRE, Country1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGlitchedPlayer, processPlayersData } from '../utils/helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/jugadores.json');
const target = path.join(root, 'supabase/functions/_shared/catalog.json');

export function buildMarketCatalog(players) {
  const rows = processPlayersData(players.filter(player => !isGlitchedPlayer(player)))
    .map(p => [String(p.Id), [p.Precio, p.Age, p.OVR_CALCULADO, p.Name || '', p.POS_NOMBRE || '', p.Country1 ?? '']]);
  return Object.fromEntries(rows);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = buildMarketCatalog(JSON.parse(fs.readFileSync(source, 'utf8')));
  fs.writeFileSync(target, JSON.stringify(catalog));
  console.log(`catalog.json: ${Object.keys(catalog).length} players, ${fs.statSync(target).size} bytes`);
}
