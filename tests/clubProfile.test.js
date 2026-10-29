// Ficha del club de la web pública (utils/leagueContent.js): estadio, autoridades, títulos y campañas. Datos sintéticos.
import { describe, it, expect } from 'vitest';
import {
  cleanPhotoFrame, cleanPhotoUrl, clubChapters, DEFAULT_PHOTO_FRAME, groupHonours, hasClubProfile, MAX_HONOURS, MAX_PHOTO_ZOOM,
  normalizeClub, normalizeClubProfile, photoFrameStyle,
} from '../utils/leagueContent.js';

describe('normalizeClubProfile', () => {
  it('trims every field and keeps empty ones as empty text', () => {
    const result = normalizeClubProfile({ stadium: '  La Cabeza  ', coach: 'R. Gómez', extra: 'ignorado' });
    expect(result.ok).toBe(true);
    expect(result.value.stadium).toBe('La Cabeza');
    expect(result.value.president).toBe('');
    expect(result.value).not.toHaveProperty('extra');
    expect(result.value.honours).toEqual([]);
  });

  it('accepts only https photo links', () => {
    expect(cleanPhotoUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(cleanPhotoUrl('')).toBe('');
    expect(cleanPhotoUrl('http://example.com/a.jpg')).toBeNull();
    expect(cleanPhotoUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeClubProfile({ stadiumPhotoUrl: 'ftp://x' }).ok).toBe(false);
  });

  it('keeps the photo frame inside its range and defaults it when missing or broken', () => {
    expect(normalizeClubProfile({}).value.stadiumPhotoFrame).toEqual(DEFAULT_PHOTO_FRAME);
    expect(cleanPhotoFrame({ x: 12.345, y: -20, zoom: 9 })).toEqual({ x: 12.3, y: 0, zoom: MAX_PHOTO_ZOOM });
    expect(cleanPhotoFrame({ x: 'a', y: null, zoom: 0.2 })).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(cleanPhotoFrame('texto')).toEqual(DEFAULT_PHOTO_FRAME);
  });

  it('turns the photo frame into the same object-position and zoom origin', () => {
    expect(photoFrameStyle({ x: 20, y: 80, zoom: 1.5 })).toEqual({ objectPosition: '20% 80%', transformOrigin: '20% 80%', transform: 'scale(1.5)' });
    expect(photoFrameStyle(undefined).transform).toBeUndefined();
  });

  it('drops empty title rows, defaults the count to 1 and rejects bad counts', () => {
    const ok = normalizeClubProfile({ honours: [{ name: 'Liga', count: '' }, { name: '', years: '' }, { scope: 'raro', name: 'Copa', count: '2' }] });
    expect(ok.value.honours.map(item => [item.name, item.count, item.scope])).toEqual([['Liga', 1, 'nacional'], ['Copa', 2, 'nacional']]);
    expect(normalizeClubProfile({ honours: [{ name: 'Liga', count: '0' }] }).ok).toBe(false);
    expect(normalizeClubProfile({ honours: [{ name: '', years: '2020' }] }).ok).toBe(false);
    expect(normalizeClubProfile({ honours: Array.from({ length: MAX_HONOURS + 1 }, () => ({ name: 'X' })) }).ok).toBe(false);
  });

  it('a past campaign needs its season and result', () => {
    expect(normalizeClubProfile({ seasons: [{ season: '2025', competition: 'SCL', result: 'Campeón' }] }).ok).toBe(true);
    expect(normalizeClubProfile({ seasons: [{ season: '2025', competition: 'SCL', result: '' }] }).ok).toBe(false);
  });

  it('keeps the optional season numbers and rejects anything that is not a whole number', () => {
    const ok = normalizeClubProfile({ seasons: [{ season: '2025', result: 'Campeón', played: '8', won: ' 6 ', goalsFor: '' }] });
    expect(ok.value.seasons[0]).toMatchObject({ played: '8', won: '6', goalsFor: '' });
    expect(normalizeClubProfile({ seasons: [{ season: '2025', result: 'Campeón', played: '-1' }] }).ok).toBe(false);
    expect(normalizeClubProfile({ seasons: [{ season: '2025', result: 'Campeón', won: 'seis' }] }).ok).toBe(false);
  });
});

describe('normalizeClub', () => {
  it('validates the history and the card together', () => {
    const result = normalizeClub({ body: ' Historia ', profile: { coach: 'DT' } });
    expect(result).toMatchObject({ ok: true, value: { body: 'Historia', profile: { coach: 'DT' } } });
    expect(normalizeClub({ body: 'x'.repeat(20001), profile: {} }).ok).toBe(false);
  });
});

describe('club chapters', () => {
  it('saves chapters with a plain body derived from their texts', () => {
    const result = normalizeClub({
      chapters: [{ era: ' 1913 ', title: 'Fundación', body: 'Nació.' }, { title: '', body: '' }, { title: 'Hoy', body: 'Renace.', closing: true }],
      profile: {},
    });
    expect(result.ok).toBe(true);
    expect(result.value.body).toBe('Nació.\n\nRenace.');
    expect(result.value.chapters.map(chapter => [chapter.era, chapter.title, chapter.closing])).toEqual([['1913', 'Fundación', false], ['', 'Hoy', true]]);
  });

  it('rejects a closing chapter that is not the last one', () => {
    expect(normalizeClub({ chapters: [{ title: 'A', body: 'x', closing: true }, { title: 'B', body: 'y' }], profile: {} }).ok).toBe(false);
  });

  it('shows saved chapters, or the older body split by its ## marks', () => {
    expect(clubChapters({ chapters: [{ era: '1913', title: 'Fundación', body: 'Uno\n\nDos' }] })).toEqual([
      { era: '1913', title: 'Fundación', closing: false, paragraphs: ['Uno', 'Dos'] },
    ]);
    expect(clubChapters({ body: '## 1913 | Fundación\nUno' })[0]).toMatchObject({ era: '1913', title: 'Fundación', paragraphs: ['Uno'] });
    expect(clubChapters(null)).toEqual([]);
  });
});

describe('groupHonours and hasClubProfile', () => {
  it('groups the titles by scope in a fixed order and adds them up', () => {
    const groups = groupHonours([
      { scope: 'internacional', name: 'Copa Sudamericana', count: 1 },
      { scope: 'nacional', name: 'Liga', count: 3 },
      { scope: 'nacional', name: 'Copa', count: 2 },
    ]);
    expect(groups.map(group => [group.id, group.total])).toEqual([['nacional', 5], ['internacional', 1]]);
  });

  it('knows when a card is still empty', () => {
    expect(hasClubProfile(null)).toBe(false);
    expect(hasClubProfile(normalizeClubProfile({}).value)).toBe(false);
    expect(hasClubProfile({ stadium: 'La Cabeza' })).toBe(true);
  });
});
