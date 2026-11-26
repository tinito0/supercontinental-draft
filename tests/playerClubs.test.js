// Club and league of each market player (utils/playerClubs.js). Synthetic data only; public/clubes.json comes from
// the league database through scripts/build-player-clubs.mjs.
import { describe, it, expect, vi } from 'vitest';
import {
  CLUBS_FILE_VERSION, fetchPlayerClubs, leagueLabel, NO_CLUB_LEAGUE, OTHER_CLUBS_LEAGUE, parseClubsFile, withClubs,
} from '../utils/playerClubs.js';
import { getActiveFilterChips } from '../utils/marketFilters.js';

const file = {
  version: CLUBS_FILE_VERSION,
  clubs: [
    ['CA River Plate', 'Argentina · Primera', [10, 11]],
    ['Arsenal FC', 'Inglaterra · Primera', [20]],
    ['FK Partizan', '', [30]],
  ],
};

describe('leagueLabel', () => {
  it('names domestic leagues in Spanish', () => {
    expect(leagueLabel('ENGLAND_D1_LEAGUE')).toBe('Inglaterra · Primera');
    expect(leagueLabel('SPAIN_D2_LEAGUE')).toBe('España · Segunda');
    expect(leagueLabel('TÜRKIYE_D1_LEAGUE')).toBe('Turquía · Primera');
    expect(leagueLabel('KONAMI_LEAGUE')).toBe('Liga Konami');
  });

  it('skips cups and international competitions', () => {
    expect(leagueLabel('ENGLAND_D1_CUP')).toBeNull();
    expect(leagueLabel('UEFA_CHAMPIONS_LEAGUE')).toBeNull();
    expect(leagueLabel(undefined)).toBeNull();
  });
});

describe('parseClubsFile', () => {
  it('indexes players and lists real leagues first, then other clubs and no club', () => {
    const index = parseClubsFile(file);
    expect(index.byPlayer.get('11')).toEqual({ club: 'CA River Plate', league: 'Argentina · Primera' });
    expect(index.byPlayer.get('30')).toEqual({ club: 'FK Partizan', league: OTHER_CLUBS_LEAGUE });
    expect(index.leagues).toEqual(['Argentina · Primera', 'Inglaterra · Primera', OTHER_CLUBS_LEAGUE, NO_CLUB_LEAGUE]);
    expect(index.clubs.map(c => c.name)).toEqual(['Arsenal FC', 'CA River Plate', 'FK Partizan']);
  });

  it('refuses a file of another version', () => {
    expect(parseClubsFile({ ...file, version: 99 })).toBeNull();
    expect(parseClubsFile(null)).toBeNull();
  });
});

describe('withClubs', () => {
  it('adds Club and Liga without touching the originals', () => {
    const players = [{ Id: 10, Name: 'Uno' }, { Id: 99, Name: 'Libre' }];
    const result = withClubs(players, parseClubsFile(file));
    expect(result).toEqual([
      { Id: 10, Name: 'Uno', Club: 'CA River Plate', Liga: 'Argentina · Primera' },
      { Id: 99, Name: 'Libre', Club: '', Liga: NO_CLUB_LEAGUE },
    ]);
    expect(players[0]).not.toHaveProperty('Club');
  });

  it('returns the players as they are without an index', () => {
    const players = [{ Id: 1 }];
    expect(withClubs(players, null)).toBe(players);
  });
});

describe('fetchPlayerClubs', () => {
  it('returns null when the file is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fetchPlayerClubs(async () => ({ ok: false, status: 404 }))).toBeNull();
    warn.mockRestore();
  });

  it('parses the downloaded file', async () => {
    const index = await fetchPlayerClubs(async () => ({ ok: true, json: async () => file }));
    expect(index.byPlayer.size).toBe(4);
  });
});

describe('filter chips', () => {
  it('shows league and club as chips', () => {
    const labels = getActiveFilterChips({ league: 'Argentina · Primera', club: 'River' }).map(chip => chip.label);
    expect(labels).toEqual(['Liga Argentina · Primera', 'Club River']);
  });
});
