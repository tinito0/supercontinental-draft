// Vistas previas de links (WhatsApp, Telegram, X…) por página de la web de la liga. Esas apps no ejecutan JavaScript:
// leen las etiquetas del HTML que devuelve el hosting. scripts/build-share-pages.mjs escribe, después del build, un
// HTML por página (dist/torneo.html, dist/equipos/{id}.html, …) con este bloque de etiquetas; firebase.json
// `cleanUrls` los sirve en /torneo y /equipos/{id}. Puro; tests/sharePages.test.js.

export const SITE_URL = 'https://supercont-d62df.firebaseapp.com';
export const SITE_NAME = 'SuperContinental League';
export const SHARE_START = '<!-- share:start -->';
export const SHARE_END = '<!-- share:end -->';
const DEFAULT_IMAGE = '/og/liga.png';
const DESCRIPTION_LENGTH = 160;

/** Páginas fijas de la web de la liga (screens/league/LeagueSite.jsx). */
export const STATIC_PAGES = [
  { path: '/', title: SITE_NAME, description: 'La liga de eFootball PES 2021: resultados, tabla, copas y la historia de cada club.' },
  { path: '/historia', title: `Historia · ${SITE_NAME}`, description: 'Cómo nació la SuperContinental League y todo lo que pasó temporada por temporada.' },
  { path: '/equipos', title: `Equipos · ${SITE_NAME}`, description: 'Los clubes de la SuperContinental League: escudos, estadios, palmarés y planteles.' },
  { path: '/torneo', title: `Torneo · ${SITE_NAME}`, description: 'La tabla oficial, la Copa de Oro, la Copa de Plata y los goleadores, actualizados con cada resultado.' },
  { path: '/partidos', title: `Partidos · ${SITE_NAME}`, description: 'El fixture con los resultados oficiales y el minuto a minuto de cada partido jugado.' },
  { path: '/en-vivo', title: `En vivo · ${SITE_NAME}`, description: 'El partido que se está jugando: marcador, votá al MVP y quién gana.' },
  { path: '/reglamento', title: `Reglamento · ${SITE_NAME}`, description: 'El reglamento de la temporada: formato, puntos, desempates y copas.' },
];

const TEAM_ID = /^[A-Za-z0-9_-]{1,128}$/;

const escapeAttr = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function clip(text, max = DESCRIPTION_LENGTH) {
  const clean = oneLine(text);
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/** Una dirección absoluta https, o null. Las relativas («/escudos/x.png») se completan con el sitio. */
export function absoluteUrl(value, siteUrl = SITE_URL) {
  const raw = String(value ?? '').trim().replace(/\\/g, '/');
  if (!raw) return null;
  try {
    const url = new URL(raw, siteUrl);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Archivo de dist/ para una ruta: «/torneo» → «torneo.html»; «/» → «index.html». null si la ruta no es segura. */
export function pageFile(path) {
  if (path === '/') return 'index.html';
  const parts = String(path || '').split('/').filter(Boolean);
  if (!parts.length || parts.some(part => !TEAM_ID.test(part))) return null;
  return `${parts.join('/')}.html`;
}

/**
 * Datos de la vista previa de un club: el apodo, el estadio y de dónde es; si no hay ficha, el comienzo de su historia.
 * Imagen: la foto del estadio; si no hay, la tarjeta del club (public/og/clubs/{id}.png, escudo y nombre); si
 * tampoco, el escudo en tarjeta chica.
 * @param {{ id: string, teamName: string, logoUrl?: string }} team
 * @param {{ body?: string, profile?: object } | null} content el doc league_content/club-{id}
 * @param {{ card?: string | null }} [options] card: ruta de la tarjeta del club, si existe
 */
export function clubPage(team, content, siteUrl = SITE_URL, { card = null } = {}) {
  const name = oneLine(team?.teamName);
  const profile = content?.profile || {};
  const place = [profile.city, profile.country].map(oneLine).filter(Boolean).join(', ');
  const facts = [
    profile.nickname && `«${oneLine(profile.nickname)}»`,
    profile.stadium && `Estadio ${oneLine(profile.stadium)}`,
    place,
    profile.founded && `fundado en ${oneLine(profile.founded)}`,
  ].filter(Boolean);
  const firstParagraph = String(content?.body || '').split(/\n\s*\n/).map(oneLine).find(Boolean) || '';
  const description = facts.length
    ? clip(`${facts.join(' · ')}. Historia, palmarés y plantel en la ${SITE_NAME}.`)
    : clip(firstParagraph || `Historia, palmarés y plantel de ${name} en la ${SITE_NAME}.`);
  const photo = absoluteUrl(profile.stadiumPhotoUrl, siteUrl);
  const cardUrl = absoluteUrl(card, siteUrl);
  const crest = absoluteUrl(team?.logoUrl, siteUrl);
  return {
    path: `/equipos/${team.id}`,
    title: `${name} · ${SITE_NAME}`,
    description,
    image: photo || cardUrl || crest || null,
    largeImage: Boolean(photo || cardUrl),
  };
}

/** El bloque de etiquetas de una página, listo para ir entre SHARE_START y SHARE_END. */
export function shareTags(page, siteUrl = SITE_URL) {
  const url = new URL(page.path, siteUrl).href;
  const image = page.image || new URL(DEFAULT_IMAGE, siteUrl).href;
  const large = page.image ? page.largeImage : true;
  const tags = [
    `<title>${escapeAttr(page.title)}</title>`,
    `<meta name="description" content="${escapeAttr(page.description)}">`,
    `<link rel="canonical" href="${escapeAttr(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:locale" content="es_AR">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta property="og:title" content="${escapeAttr(page.title)}">`,
    `<meta property="og:description" content="${escapeAttr(page.description)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    ...(page.image ? [] : ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']),
    `<meta name="twitter:card" content="${large ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeAttr(page.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(page.description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
  ];
  return tags.map(tag => `  ${tag}`).join('\n');
}

/** El index.html del build con el bloque de etiquetas de esta página; null si el HTML no tiene los marcadores. */
export function renderSharePage(html, page, siteUrl = SITE_URL) {
  const start = html.indexOf(SHARE_START);
  const end = html.indexOf(SHARE_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${html.slice(0, start + SHARE_START.length)}\n${shareTags(page, siteUrl)}\n  ${html.slice(end)}`;
}
