// Builds public/franchise-index.json: the few market catalog rows a Jugador Franquicia can be, in the same
// row shape as supabase/functions/_shared/catalog.json ([price, age, ovr, name, pos, country]).
// The league home reads this small file for franchise names and OVR instead of the whole catalog.
// Runs in `npm run dev` and `npm run build` (predev/prebuild); the output is generated and not versioned.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRANCHISE_MAX_OVR, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR } from '../supabase/functions/_shared/marketConstants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'supabase', 'functions', '_shared', 'catalog.json');
const target = path.join(root, 'public', 'franchise-index.json');
const stampFile = path.join(root, 'node_modules', '.cache', 'franchise-index.sha1');

const AGE = 1;
const OVR = 2;

/** Catalog rows that meet the franchise age and OVR rules (utils/constants.js, copied in marketConstants.js). */
export function buildFranchiseIndex(catalog) {
  return Object.fromEntries(Object.entries(catalog || {}).filter(([, row]) => {
    const age = Number(row?.[AGE]);
    const ovr = Number(row?.[OVR]);
    return age >= FRANCHISE_MIN_AGE && ovr >= FRANCHISE_MIN_OVR && ovr <= FRANCHISE_MAX_OVR;
  }));
}

function run() {
  if (!fs.existsSync(source)) {
    console.warn('[franchise-index] No existe supabase/functions/_shared/catalog.json: no se genera el índice.');
    return;
  }
  const text = fs.readFileSync(source, 'utf8');
  const hash = crypto.createHash('sha1').update(text).digest('hex');
  let stamp = null;
  try { stamp = fs.readFileSync(stampFile, 'utf8').trim(); } catch { /* first run */ }
  if (fs.existsSync(target) && stamp === hash) {
    console.log('[franchise-index] Al día.');
    return;
  }
  const index = buildFranchiseIndex(JSON.parse(text));
  fs.writeFileSync(target, JSON.stringify(index));
  fs.mkdirSync(path.dirname(stampFile), { recursive: true });
  fs.writeFileSync(stampFile, hash);
  console.log(`[franchise-index] ${Object.keys(index).length} jugadores, ${fs.statSync(target).size} bytes`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
