// Después de `vite build`: un HTML por página de la web de la liga con su propia vista previa de links (título,
// descripción e imagen), para WhatsApp, Telegram y X, que no ejecutan JavaScript. Las etiquetas salen de
// utils/sharePages.js; firebase.json `cleanUrls` sirve dist/torneo.html en /torneo y dist/equipos/{id}.html en
// /equipos/{id}. Los clubes se leen de Firestore por REST (lectura pública); si eso falla, se escriben solo las
// páginas fijas y el build sigue. Las vistas previas de un club cambian recién con el próximo deploy.
import fs from 'node:fs';
import path from 'node:path';
import { STATIC_PAGES, clubPage, pageFile, renderSharePage } from '../utils/sharePages.js';

const DIST = path.resolve('dist');
const PROJECT_ID = 'supercont-d62df';
const FETCH_TIMEOUT_MS = 15000;

function envValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find(entry => entry.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

function appId() {
  const source = fs.readFileSync('utils/constants.js', 'utf8');
  const match = /export const APP_ID = '([^']+)'/.exec(source);
  if (!match) throw new Error('No se encontró APP_ID en utils/constants.js');
  return match[1];
}

/** Valor de la API REST de Firestore → JS (solo los tipos que usan teams y league_content). */
function fromFirestore(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestore);
  if ('mapValue' in value) return fieldsToObject(value.mapValue.fields);
  return null;
}
const fieldsToObject = fields => Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestore(value)]));

async function listCollection(collectionPath, apiKey) {
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}`);
    url.searchParams.set('pageSize', '300');
    if (apiKey) url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`${collectionPath}: HTTP ${response.status}`);
    const body = await response.json();
    for (const doc of body.documents || []) docs.push({ id: doc.name.split('/').pop(), ...fieldsToObject(doc.fields) });
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function clubPages() {
  const base = `artifacts/${appId()}/public/data`;
  const apiKey = envValue('VITE_FIREBASE_API_KEY');
  const [teams, content] = await Promise.all([listCollection(`${base}/teams`, apiKey), listCollection(`${base}/league_content`, apiKey)]);
  const contentById = new Map(content.map(doc => [doc.id, doc]));
  // Los mismos clubes que muestra la web (hooks/useLeagueData.js useLeagueTeams): aprobados y con nombre.
  return teams
    .filter(team => team.approved !== false && String(team.teamName || '').trim())
    .map(team => {
      // Tarjetas 1200x630 por club (escudo y nombre) en public/og/clubs/, copiadas a dist/ por Vite. Un club nuevo sin
      // tarjeta usa su escudo.
      const card = `/og/clubs/${team.id}.png`;
      return clubPage(team, contentById.get(`club-${team.id}`) || null, undefined, { card: fs.existsSync(path.join(DIST, card)) ? card : null });
    });
}

function writePage(html, page) {
  const file = pageFile(page.path);
  if (!file) return false;
  const rendered = renderSharePage(html, page);
  if (!rendered) throw new Error('dist/index.html no tiene los marcadores share:start / share:end');
  const target = path.join(DIST, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, rendered);
  return true;
}

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
let written = 0;
for (const page of STATIC_PAGES) written += writePage(html, page) ? 1 : 0;
try {
  const clubs = await clubPages();
  for (const page of clubs) written += writePage(html, page) ? 1 : 0;
  console.log(`[share-pages] ${written} páginas (${clubs.length} clubes).`);
} catch (error) {
  console.warn(`[share-pages] Sin páginas de clubes (${error.message}); quedan las ${written} fijas.`);
}
