// Tarjetas de vista previa de los clubes (1200x630: escudo en recuadro blanco, nombre y la liga), generadas en cada
// build por scripts/build-share-pages.mjs con el nombre y el escudo que el club tiene en Firestore. Antes eran PNG
// hechos a mano en public/og/clubs/ y quedaban viejos cuando un club cambiaba de escudo. satori pasa el texto a
// trazos con las fuentes de @fontsource (la máquina del build no tiene las de la web) y sharp lee los escudos .webp y
// escribe el PNG. tests/clubCards.test.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

export const CARD = { width: 1200, height: 630, crestBox: 300, crestSize: 236 };
const COLORS = { background: '#080b14', name: '#f1f5f9', league: '#e2e8f2', bar: '#3a66c4' };
const FETCH_TIMEOUT_MS = 15000;

const FONT_FILES = [
  ['Barlow Condensed', 800, '@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff'],
  ['Barlow Condensed', 800, '@fontsource/barlow-condensed/files/barlow-condensed-latin-ext-800-normal.woff'],
  ['Barlow', 500, '@fontsource/barlow/files/barlow-latin-500-normal.woff'],
  ['Barlow', 500, '@fontsource/barlow/files/barlow-latin-ext-500-normal.woff'],
];
let fonts = null;
const loadFonts = () => {
  fonts ??= FONT_FILES.map(([name, weight, file]) => ({ name, weight, style: 'normal', data: fs.readFileSync(path.resolve('node_modules', file)) }));
  return fonts;
};

/** Tamaño del nombre: los largos («Esportivo Lusitano do Recife») bajan para entrar en dos renglones. */
export function nameFontSize(name) {
  const length = String(name || '').trim().length;
  if (length <= 24) return 92;
  if (length <= 34) return 76;
  return 64;
}

/**
 * De dónde leer el escudo: un archivo de dist/ («/Logos_equipos/x.webp», también con barras de Windows) o una URL
 * https (el bucket league-media de Supabase). null si no hay o no es ninguna de las dos.
 * @returns {{ file: string } | { url: string } | null}
 */
export function crestSource(logoUrl, distDir) {
  const raw = String(logoUrl ?? '').trim().replace(/\\/g, '/');
  if (!raw) return null;
  if (/^https:\/\//i.test(raw)) return { url: raw };
  if (/^[a-z]+:/i.test(raw)) return null;
  const relative = decodeURIComponent(raw.split(/[?#]/)[0]).replace(/^\/+/, '');
  const file = path.resolve(distDir, relative);
  return file.startsWith(path.resolve(distDir) + path.sep) ? { file } : null;
}

async function readCrest(source) {
  if ('file' in source) return fs.promises.readFile(source.file);
  const response = await fetch(source.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`escudo: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const box = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

/**
 * El PNG de la tarjeta.
 * @param {{ name: string, crest: Buffer }} club crest: la imagen del escudo en cualquier formato que lea sharp
 * @returns {Promise<Buffer>}
 */
export async function renderClubCard({ name, crest }) {
  const { width, height, crestBox, crestSize } = CARD;
  const crestPng = await sharp(crest)
    .resize(crestSize, crestSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const size = nameFontSize(name);
  const tree = box({ width, height, flexDirection: 'column', background: COLORS.background }, [
    box({ flex: 1, alignItems: 'center', padding: '0 60px 0 80px' }, [
      box({ width: crestBox, height: crestBox, flexShrink: 0, alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 36 }, [
        { type: 'img', props: { src: `data:image/png;base64,${crestPng.toString('base64')}`, width: crestSize, height: crestSize } },
      ]),
      box({ flexDirection: 'column', marginLeft: 58, flex: 1, minWidth: 0 }, [
        box({ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: size, lineHeight: 0.94, color: COLORS.name, textTransform: 'uppercase', lineClamp: 3 }, String(name || '').trim()),
        box({ marginTop: 34, fontFamily: 'Barlow', fontWeight: 500, fontSize: 32, color: COLORS.league }, 'SuperContinental League'),
      ]),
    ]),
    box({ height: 10, flexShrink: 0, background: COLORS.bar }, []),
  ]);
  const svg = await satori(tree, { width, height, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Escribe la tarjeta del club en dist/og/clubs/{id}.png y devuelve su ruta con una marca del contenido («?v=…»), que
 * cambia cuando cambian el nombre o el escudo: WhatsApp guarda cada imagen por su dirección. null si el club no tiene
 * escudo propio o no se pudo leer (la vista previa usa entonces la foto del estadio o el escudo).
 */
export async function writeClubCard(team, distDir) {
  const source = crestSource(team?.logoUrl, distDir);
  if (!source || !/^[A-Za-z0-9_-]{1,128}$/.test(String(team?.id))) return null;
  const png = await renderClubCard({ name: team.teamName, crest: await readCrest(source) });
  const route = `/og/clubs/${team.id}.png`;
  const target = path.join(distDir, route);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, png);
  return `${route}?v=${crypto.createHash('sha1').update(png).digest('hex').slice(0, 10)}`;
}
