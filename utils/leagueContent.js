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
