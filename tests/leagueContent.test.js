import { describe, it, expect } from 'vitest';
import {
  MAX_STORY_LENGTH,
  clubStoryDocId,
  moveChapter,
  newChapter,
  normalizeSeasonRules,
  normalizeStory,
  toChapters,
  toParagraphs,
} from '../utils/leagueContent.js';

describe('toParagraphs', () => {
  it('splits on blank lines and keeps single line breaks inside a paragraph', () => {
    expect(toParagraphs('Uno\nsigue\n\n\nDos\r\n\r\nTres  ')).toEqual(['Uno\nsigue', 'Dos', 'Tres']);
  });

  it('returns nothing for empty text', () => {
    expect(toParagraphs('   \n\n ')).toEqual([]);
    expect(toParagraphs(undefined)).toEqual([]);
  });
});

describe('normalizeStory', () => {
  it('trims the text and normalises line endings', () => {
    expect(normalizeStory('  Hola\r\nmundo  ')).toEqual({ ok: true, value: { body: 'Hola\nmundo' } });
  });

  it('accepts an empty text (clears the section)', () => {
    expect(normalizeStory('')).toEqual({ ok: true, value: { body: '' } });
  });

  it('rejects a text over the limit', () => {
    const result = normalizeStory('a'.repeat(MAX_STORY_LENGTH + 1));
    expect(result.ok).toBe(false);
  });
});

describe('normalizeSeasonRules', () => {
  it('keeps chapters in order, trimmed, and drops completely empty ones', () => {
    const result = normalizeSeasonRules({
      season: ' Temporada 2026 ',
      chapters: [
        { id: 'a', title: ' Formato ', body: ' Liga de 12 ' },
        { id: 'b', title: '', body: '   ' },
        { id: 'c', title: 'Puntos', body: '' },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        season: 'Temporada 2026',
        chapters: [
          { id: 'a', title: 'Formato', body: 'Liga de 12' },
          { id: 'c', title: 'Puntos', body: '' },
        ],
      },
    });
  });

  it('asks for a title when a chapter has text', () => {
    const result = normalizeSeasonRules({ chapters: [{ id: 'a', title: 'Uno', body: 'x' }, { id: 'b', title: ' ', body: 'texto' }] });
    expect(result).toEqual({ ok: false, error: 'El capítulo 2 necesita un título.' });
  });

  it('handles missing input', () => {
    expect(normalizeSeasonRules()).toEqual({ ok: true, value: { season: '', chapters: [] } });
  });
});

describe('moveChapter', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('moves a chapter without mutating the list', () => {
    expect(moveChapter(list, 2, -1).map(c => c.id)).toEqual(['a', 'c', 'b']);
    expect(list.map(c => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores moves past either end', () => {
    expect(moveChapter(list, 0, -1)).toBe(list);
    expect(moveChapter(list, 2, 1)).toBe(list);
  });
});

describe('ids', () => {
  it('builds one history document per club', () => {
    expect(clubStoryDocId('abc')).toBe('club-abc');
  });

  it('gives each new chapter a distinct id', () => {
    expect(newChapter().id).not.toBe(newChapter().id);
  });
});

describe('toChapters', () => {
  it('splits on ## headings with era | title and a closing ##! chapter', () => {
    const text = 'Intro\n\n## 1913 | La fundación\nNació.\n\nSe mudó.\n## Los años duros\nCayó.\n##! Hoy\nRenace.';
    expect(toChapters(text)).toEqual([
      { era: '', title: '', closing: false, paragraphs: ['Intro'] },
      { era: '1913', title: 'La fundación', closing: false, paragraphs: ['Nació.', 'Se mudó.'] },
      { era: '', title: 'Los años duros', closing: false, paragraphs: ['Cayó.'] },
      { era: '', title: 'Hoy', closing: true, paragraphs: ['Renace.'] },
    ]);
  });

  it('keeps a history without markers as one untitled chapter and returns nothing for empty text', () => {
    expect(toChapters('Uno\n\nDos')).toHaveLength(1);
    expect(toChapters('  ')).toEqual([]);
  });
});
