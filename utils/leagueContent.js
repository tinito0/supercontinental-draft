// Content of the public league site written by the admin (components/admin/LeagueContentAdminSection.jsx):
// the league's history, each club's history and the season's competition rules.
// Stored in artifacts/{APP_ID}/public/data/league_content (public read, admin write: firestore.rules).
// Plain text only, split into paragraphs on blank lines, so nothing is ever rendered as HTML.
// Pure; tests/leagueContent.test.js.

export const LEAGUE_CONTENT_COLLECTION = 'league_content';
export const LEAGUE_HISTORY_DOC = 'history';
export const SEASON_RULES_DOC = 'rules';

export const MAX_STORY_LENGTH = 20000;
export const MAX_TITLE_LENGTH = 120;
export const MAX_SEASON_LENGTH = 40;
export const MAX_CHAPTERS = 40;

/** Document id of a club's history: one per draft team. */
export function clubStoryDocId(teamId) {
  return `club-${teamId}`;
}

/** Paragraphs of a text: separated by blank lines; single line breaks stay inside a paragraph. */
export function toParagraphs(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
}

/**
 * A club history split into chapters. A line starting with `## ` opens a chapter: `## 1913 | La fundación`
 * (era | title; without `|` it is only the title). `##! Título` marks the closing chapter, shown highlighted.
 * Text before the first heading becomes an untitled chapter, so histories without markers still work.
 * @returns {Array<{ era: string, title: string, closing: boolean, paragraphs: string[] }>}
 */
export function toChapters(text) {
  const chapters = [];
  let current = null;
  const flush = () => {
    if (current && (current.title || current.era || current.lines.length)) {
      chapters.push({ era: current.era, title: current.title, closing: current.closing, paragraphs: toParagraphs(current.lines.join('\n')) });
    }
  };
  for (const line of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^##(!?)\s+(.*)$/.exec(line.trim());
    if (heading) {
      flush();
      const [era, ...rest] = heading[2].includes('|') ? heading[2].split('|') : ['', heading[2]];
      current = { era: era.trim(), title: rest.join('|').trim(), closing: heading[1] === '!', lines: [] };
    } else {
      current = current || { era: '', title: '', closing: false, lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return chapters.filter(chapter => chapter.title || chapter.era || chapter.paragraphs.length);
}

const cleanText = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

/**
 * A history text ready to save, or the reason it cannot be saved.
 * @returns {{ ok: true, value: { body: string } } | { ok: false, error: string }}
 */
export function normalizeStory(body) {
  const raw = String(body ?? '').replace(/\r\n?/g, '\n').trim();
  if (raw.length > MAX_STORY_LENGTH) {
    return { ok: false, error: `El texto supera los ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.` };
  }
  return { ok: true, value: { body: raw } };
}

let chapterSeq = 0;
/** A new empty chapter with a stable id for React keys and reordering. */
export function newChapter() {
  chapterSeq += 1;
  return { id: `ch-${Date.now().toString(36)}-${chapterSeq}`, title: '', body: '' };
}

/**
 * The season rules ready to save: trimmed, completely empty chapters dropped, limits applied.
 * A chapter needs a title when it has text, so the public index never shows a nameless entry.
 * @returns {{ ok: true, value: { season: string, chapters: Array<{ id, title, body }> } } | { ok: false, error: string }}
 */
export function normalizeSeasonRules({ season, chapters } = {}) {
  const kept = (Array.isArray(chapters) ? chapters : [])
    .map((chapter, index) => ({
      id: String(chapter?.id || `ch-${index + 1}`),
      title: cleanText(chapter?.title, MAX_TITLE_LENGTH),
      body: String(chapter?.body ?? '').replace(/\r\n?/g, '\n').trim(),
    }))
    .filter(chapter => chapter.title || chapter.body);

  if (kept.length > MAX_CHAPTERS) return { ok: false, error: `Máximo ${MAX_CHAPTERS} capítulos.` };
  const untitled = kept.findIndex(chapter => !chapter.title);
  if (untitled !== -1) return { ok: false, error: `El capítulo ${untitled + 1} necesita un título.` };
  const tooLong = kept.findIndex(chapter => chapter.body.length > MAX_STORY_LENGTH);
  if (tooLong !== -1) {
    return { ok: false, error: `El capítulo ${tooLong + 1} supera los ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.` };
  }

  return { ok: true, value: { season: cleanText(season, MAX_SEASON_LENGTH), chapters: kept } };
}

/** Moves the chapter at `from` one place up (-1) or down (+1); returns a new array. */
export function moveChapter(chapters, from, delta) {
  const to = from + delta;
  if (to < 0 || to >= chapters.length) return chapters;
  const next = [...chapters];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// ── Club profile (ficha del club) ────────────────────────────────────────────────────────────────────────────────
// Saved in the club's document next to its history (`club-{teamId}`: { body, profile }), always together, because a
// save replaces the whole document. Every field is optional; the public page hides what is empty.

/** Text fields of the club card: [key, label, max length, placeholder]. Same keys as firestore.rules isValidClubProfile. */
export const CLUB_PROFILE_FIELDS = [
  ['nickname', 'Apodo', 60, 'Ej.: El Ciclón'],
  ['founded', 'Fundación', 40, 'Ej.: 1913'],
  ['city', 'Ciudad', 60, 'Ej.: Córdoba'],
  ['country', 'País', 60, 'Ej.: Argentina'],
  ['stadium', 'Estadio', 80, 'Ej.: Estadio La Boutique'],
  ['capacity', 'Capacidad', 20, 'Ej.: 57.000'],
  ['coach', 'Director técnico', 80, ''],
  ['president', 'Presidente', 80, ''],
  ['manager', 'Mánager en la liga', 80, 'Quién maneja el club cuando juega'],
  ['captain', 'Capitán', 80, ''],
  ['colors', 'Colores', 60, 'Ej.: Azul y blanco'],
];
export const MAX_PHOTO_URL_LENGTH = 500;
export const MAX_HONOURS = 30;
export const MAX_CLUB_SEASONS = 40;
const HONOUR_NAME_LENGTH = 80;
const HONOUR_YEARS_LENGTH = 160;
const SEASON_LABEL_LENGTH = 40;
const SEASON_RESULT_LENGTH = 120;

/** Optional numbers of a past campaign: [key, short label, long label]. Kept as text so an unknown number stays empty. */
export const SEASON_STATS = [
  ['played', 'PJ', 'Partidos jugados'], ['won', 'G', 'Ganados'], ['drawn', 'E', 'Empatados'],
  ['lost', 'P', 'Perdidos'], ['goalsFor', 'GF', 'Goles a favor'], ['goalsAgainst', 'GC', 'Goles en contra'],
];

/** Kinds of titles, in the order the public page groups them. */
export const HONOUR_SCOPES = [
  { id: 'supercontinental', label: 'Supercontinental League' },
  { id: 'nacional', label: 'Nacionales' },
  { id: 'internacional', label: 'Internacionales' },
];
const HONOUR_SCOPE_IDS = HONOUR_SCOPES.map(scope => scope.id);

let rowSeq = 0;
const newRowId = prefix => {
  rowSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${rowSeq}`;
};
/** A new empty title row («Liga Profesional», 3 veces, 2019, 2021, 2023). */
export const newHonour = () => ({ id: newRowId('hn'), scope: 'nacional', name: '', count: '1', years: '' });
/** A new empty row of the club's past campaigns. */
export const newClubSeason = () => ({ id: newRowId('ss'), season: '', competition: '', result: '', ...Object.fromEntries(SEASON_STATS.map(([key]) => [key, ''])) });

/** An https address, or '' when empty; null when it is not a valid https link. */
export function cleanPhotoUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > MAX_PHOTO_URL_LENGTH) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// How the stadium photo sits in the club hero: the focal point (x, y in % of the photo, as CSS object-position) and a
// zoom around that point. The photo itself is never cropped; the hero and the editor preview render it the same way.
export const DEFAULT_PHOTO_FRAME = Object.freeze({ x: 50, y: 50, zoom: 1 });
export const MAX_PHOTO_ZOOM = 3;

const clampRounded = (value, min, max, fallback, decimals) => {
  const number = value === null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(number)) return fallback;
  const factor = 10 ** decimals;
  return Math.round(Math.min(max, Math.max(min, number)) * factor) / factor;
};

/** A valid photo frame: numbers clamped to their range, defaults for anything missing or broken. */
export function cleanPhotoFrame(frame) {
  return {
    x: clampRounded(frame?.x, 0, 100, DEFAULT_PHOTO_FRAME.x, 1),
    y: clampRounded(frame?.y, 0, 100, DEFAULT_PHOTO_FRAME.y, 1),
    zoom: clampRounded(frame?.zoom, 1, MAX_PHOTO_ZOOM, DEFAULT_PHOTO_FRAME.zoom, 2),
  };
}

/** Inline style for an object-cover <img> showing `frame`. */
export function photoFrameStyle(frame) {
  const { x, y, zoom } = cleanPhotoFrame(frame);
  return {
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: zoom === 1 ? undefined : `scale(${zoom})`,
  };
}

function normalizeHonours(rows) {
  const kept = (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `hn-${index + 1}`),
      scope: HONOUR_SCOPE_IDS.includes(row?.scope) ? row.scope : 'nacional',
      name: cleanText(row?.name, HONOUR_NAME_LENGTH),
      count: String(row?.count ?? '').trim(),
      years: cleanText(row?.years, HONOUR_YEARS_LENGTH),
    }))
    .filter(row => row.name || row.years);
  if (kept.length > MAX_HONOURS) return { ok: false, error: `Máximo ${MAX_HONOURS} títulos.` };
  const untitled = kept.findIndex(row => !row.name);
  if (untitled !== -1) return { ok: false, error: `El título ${untitled + 1} necesita el nombre de la competición.` };
  const withCounts = kept.map(row => ({ ...row, count: Number(row.count || 1) }));
  const badCount = withCounts.find(row => !Number.isInteger(row.count) || row.count < 1 || row.count > 99);
  if (badCount) return { ok: false, error: `«${badCount.name}»: la cantidad tiene que ser un número entre 1 y 99.` };
  return { ok: true, value: withCounts };
}

function normalizeClubSeasons(rows) {
  const kept = (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `ss-${index + 1}`),
      season: cleanText(row?.season, SEASON_LABEL_LENGTH),
      competition: cleanText(row?.competition, HONOUR_NAME_LENGTH),
      result: cleanText(row?.result, SEASON_RESULT_LENGTH),
      ...Object.fromEntries(SEASON_STATS.map(([key]) => [key, String(row?.[key] ?? '').trim()])),
    }))
    .filter(row => row.season || row.competition || row.result);
  if (kept.length > MAX_CLUB_SEASONS) return { ok: false, error: `Máximo ${MAX_CLUB_SEASONS} campañas.` };
  const missing = kept.findIndex(row => !row.season || !row.result);
  if (missing !== -1) return { ok: false, error: `La campaña ${missing + 1} necesita la temporada y cómo le fue.` };
  const badStat = kept.find(row => SEASON_STATS.some(([key]) => row[key] !== '' && !/^\d{1,3}$/.test(row[key])));
  if (badStat) return { ok: false, error: `Campaña ${badStat.season}: los números (PJ, G, E, P, GF, GC) tienen que ser enteros de 0 a 999.` };
  return { ok: true, value: kept };
}

/**
 * The club card ready to save: trimmed, limits applied, empty rows dropped.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function normalizeClubProfile(profile = {}) {
  const value = {};
  for (const [key, , max] of CLUB_PROFILE_FIELDS) value[key] = cleanText(profile?.[key], max);
  const photo = cleanPhotoUrl(profile?.stadiumPhotoUrl);
  if (photo === null) return { ok: false, error: 'La foto del estadio tiene que ser un link que empiece con https://.' };
  value.stadiumPhotoUrl = photo;
  value.stadiumPhotoFrame = cleanPhotoFrame(profile?.stadiumPhotoFrame);
  const honours = normalizeHonours(profile?.honours);
  if (!honours.ok) return honours;
  const seasons = normalizeClubSeasons(profile?.seasons);
  if (!seasons.ok) return seasons;
  return { ok: true, value: { ...value, honours: honours.value, seasons: seasons.value } };
}

export const MAX_ERA_LENGTH = 40;

/** A new empty chapter of a club history (era, title, text; `closing` = the highlighted final chapter). */
export function newClubChapter() {
  chapterSeq += 1;
  return { id: `cc-${Date.now().toString(36)}-${chapterSeq}`, era: '', title: '', body: '', closing: false };
}

/** Chapters ready to save: trimmed, empty ones dropped, only the last one may be the closing chapter. */
function normalizeClubChapters(rows) {
  const kept = (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `cc-${index + 1}`),
      era: cleanText(row?.era, MAX_ERA_LENGTH),
      title: cleanText(row?.title, MAX_TITLE_LENGTH),
      body: String(row?.body ?? '').replace(/\r\n?/g, '\n').trim(),
      closing: Boolean(row?.closing),
    }))
    .filter(row => row.era || row.title || row.body);
  if (kept.length > MAX_CHAPTERS) return { ok: false, error: `Máximo ${MAX_CHAPTERS} capítulos.` };
  const misplaced = kept.findIndex((row, index) => row.closing && index !== kept.length - 1);
  if (misplaced !== -1) return { ok: false, error: 'Solo el último capítulo puede ser el de cierre.' };
  return { ok: true, value: kept };
}

/**
 * History and card of a club, validated together (they live in one document). With `chapters`, `body` is rebuilt from
 * their texts (plain, for previews and the home page); without them the history is the single `body` text.
 */
export function normalizeClub({ body, chapters, profile } = {}) {
  const card = normalizeClubProfile(profile);
  if (!card.ok) return card;
  if (chapters === undefined) {
    const story = normalizeStory(body);
    if (!story.ok) return story;
    return { ok: true, value: { body: story.value.body, profile: card.value } };
  }
  const list = normalizeClubChapters(chapters);
  if (!list.ok) return list;
  const tooLong = list.value.findIndex(chapter => chapter.body.length > MAX_STORY_LENGTH);
  if (tooLong !== -1) return { ok: false, error: `El capítulo ${tooLong + 1} supera los ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.` };
  const story = normalizeStory(list.value.map(chapter => chapter.body).filter(Boolean).join('\n\n'));
  if (!story.ok) return { ok: false, error: `La historia completa supera los ${MAX_STORY_LENGTH.toLocaleString('es-AR')} caracteres.` };
  return { ok: true, value: { body: story.value.body, chapters: list.value, profile: card.value } };
}

/**
 * Chapters of a club history to show: the saved `chapters`, or (older histories) the `body` split by its `##` marks.
 * @returns {Array<{ era: string, title: string, closing: boolean, paragraphs: string[] }>}
 */
export function clubChapters(content) {
  if (Array.isArray(content?.chapters) && content.chapters.length) {
    return content.chapters
      .map(chapter => ({ era: chapter.era || '', title: chapter.title || '', closing: Boolean(chapter.closing), paragraphs: toParagraphs(chapter.body) }))
      .filter(chapter => chapter.era || chapter.title || chapter.paragraphs.length);
  }
  return toChapters(content?.body);
}

/** Titles grouped by scope for the public page, with the total per group. Groups without titles are left out. */
export function groupHonours(honours) {
  return HONOUR_SCOPES
    .map(scope => {
      const items = (honours || []).filter(item => (item.scope || 'nacional') === scope.id);
      return { ...scope, items, total: items.reduce((sum, item) => sum + (Number(item.count) || 1), 0) };
    })
    .filter(group => group.items.length);
}

/** Whether a saved card has anything worth showing. */
export function hasClubProfile(profile) {
  if (!profile) return false;
  return CLUB_PROFILE_FIELDS.some(([key]) => String(profile[key] || '').trim())
    || Boolean(profile.stadiumPhotoUrl) || Boolean(profile.honours?.length) || Boolean(profile.seasons?.length);
}
