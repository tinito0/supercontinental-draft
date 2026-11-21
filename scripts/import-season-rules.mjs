// Loads a season rules file (content/*.json: { season, chapters: [{ id, title, body }] }) into
// league_content/rules, the document /reglamento reads. It replaces the whole document, like saving in
// Administración → Web pública → Reglamento. Validates with the same normalizeSeasonRules the admin editor uses.
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/import-season-rules.mjs content/x.json           (dry run)
//   GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/import-season-rules.mjs content/x.json --apply   (writes)
// From the phone: GitHub → Actions → import-season-rules.
import { readFileSync } from 'node:fs';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { APP_ID } from '../utils/constants.js';
import { LEAGUE_CONTENT_COLLECTION, SEASON_RULES_DOC, normalizeSeasonRules } from '../utils/leagueContent.js';

const file = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!file) {
  console.error('Uso: node scripts/import-season-rules.mjs <archivo.json> [--apply]');
  process.exit(1);
}

const normalized = normalizeSeasonRules(JSON.parse(readFileSync(file, 'utf8')));
if (!normalized.ok) {
  console.error(`No se puede importar: ${normalized.error}`);
  process.exit(1);
}
const { season, chapters } = normalized.value;
console.log(`${season || '(sin temporada)'}: ${chapters.length} capítulos`);
chapters.forEach((chapter, index) => console.log(`  ${index + 1}. ${chapter.title} (${chapter.body.length} caracteres)`));

if (!APPLY) {
  console.log('Prueba: no se escribió nada. Agregá --apply para publicarlo.');
  process.exit(0);
}

initializeApp({ credential: applicationDefault() });
const ref = getFirestore().doc(`artifacts/${APP_ID}/public/data/${LEAGUE_CONTENT_COLLECTION}/${SEASON_RULES_DOC}`);
await ref.set({ season, chapters, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'import' });
console.log(`Publicado en ${ref.path}.`);
