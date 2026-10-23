// Ficha del club de la web pública (utils/leagueContent.js): estadio, autoridades, títulos y campañas. Datos sintéticos.
import { describe, it, expect } from 'vitest';
import {
  cleanPhotoUrl, groupHonours, hasClubProfile, MAX_HONOURS, normalizeClub, normalizeClubProfile,
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
