// Genera public/jugadores.compact.json (formato columnar, ver utils/playerCatalog.js) desde
// public/jugadores.json. Corre solo en `npm run dev` y `npm run build`; el archivo generado no se versiona.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePlayersCompact } from '../utils/playerCatalog.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'jugadores.json');
const target = path.join(root, 'public', 'jugadores.compact.json');

if (!fs.existsSync(source)) {
  console.warn('[players-compact] No existe public/jugadores.json: no se genera el catálogo compacto.');
  process.exit(0);
}

// Se compara el hash del origen, no la fecha: tras un `git checkout` o una copia el compacto puede quedar
// con fecha más nueva que un jugadores.json distinto. El hash vive fuera de public/ para no publicarse.
const stampFile = path.join(root, 'node_modules', '.cache', 'players-compact.sha1');
const sourceStat = fs.statSync(source);
const sourceText = fs.readFileSync(source, 'utf8');
const sourceHash = crypto.createHash('sha1').update(sourceText).digest('hex');
const readStamp = () => { try { return fs.readFileSync(stampFile, 'utf8').trim(); } catch { return null; } };
if (fs.existsSync(target) && readStamp() === sourceHash) {
  console.log('[players-compact] Al día.');
  process.exit(0);
}

const players = JSON.parse(sourceText);
if (!Array.isArray(players) || players.length === 0) {
  console.error('[players-compact] public/jugadores.json no es un array de jugadores.');
  process.exit(1);
}
const compact = encodePlayersCompact(players);
fs.writeFileSync(target, JSON.stringify(compact));
fs.mkdirSync(path.dirname(stampFile), { recursive: true });
fs.writeFileSync(stampFile, sourceHash);
const mb = bytes => (bytes / 1e6).toFixed(1);
console.log(`[players-compact] ${players.length} jugadores: ${mb(sourceStat.size)} MB → ${mb(fs.statSync(target).size)} MB`);
