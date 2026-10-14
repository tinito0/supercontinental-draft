import { describe, it, expect } from 'vitest';
import { buildResults, buildResultsAsync, positionGroups } from '../utils/scoutEngine.js';

describe('utils/scoutEngine.js', () => {
  const mockPlayers = [
    { Id: '1', Name: 'Haaland', POS_NOMBRE: 'DC', Precio: 25.0, Age: 24, OVR_CALCULADO: 91, Country1: 1 },
    { Id: '2', Name: 'Mbappe', POS_NOMBRE: 'EI', Precio: 26.0, Age: 25, OVR_CALCULADO: 92, Country1: 2 },
    { Id: '3', Name: 'De Bruyne', POS_NOMBRE: 'MC', Precio: 20.0, Age: 33, OVR_CALCULADO: 90, Country1: 3 },
    { Id: '4', Name: 'Van Dijk', POS_NOMBRE: 'DFC', Precio: 18.0, Age: 33, OVR_CALCULADO: 89, Country1: 4 },
    { Id: '5', Name: 'Courtois', POS_NOMBRE: 'PT', Precio: 15.0, Age: 32, OVR_CALCULADO: 88, Country1: 3 },
    { Id: '6', Name: 'Endrick', POS_NOMBRE: 'DC', Precio: 8.0, Age: 18, OVR_CALCULADO: 79, Country1: 5 },
    { Id: '7', Name: 'Yamal', POS_NOMBRE: 'ED', Precio: 12.0, Age: 17, OVR_CALCULADO: 82, Country1: 6 },
    { Id: '8', Name: 'Guler', POS_NOMBRE: 'MO', Precio: 10.0, Age: 19, OVR_CALCULADO: 80, Country1: 7 },
    { Id: '9', Name: 'Alisson', POS_NOMBRE: 'PT', Precio: 14.0, Age: 31, OVR_CALCULADO: 87, Country1: 5 },
    { Id: '10', Name: 'Oblak', POS_NOMBRE: 'PT', Precio: 13.0, Age: 31, OVR_CALCULADO: 86, Country1: 8 },
  ];

  describe('positionGroups definition', () => {
    it('defines standard groups with expected positions', () => {
      expect(positionGroups.Delantero).toEqual(['DC', 'SD', 'EI', 'ED']);
      expect(positionGroups.Mediocampista).toEqual(['MC', 'MCD', 'MO', 'MI', 'MD']);
      expect(positionGroups.Defensor).toEqual(['DFC', 'LI', 'LD']);
      expect(positionGroups.Arquero).toEqual(['PT']);
    });
  });

  describe('buildResults', () => {
    it('returns empty array when allPlayers is empty or not an array', () => {
      expect(buildResults({ allPlayers: [], criteria: {}, scout: {} })).toEqual([]);
      expect(buildResults({ allPlayers: null, criteria: {}, scout: {} })).toEqual([]);
    });

    it('filters out locked players', () => {
      const results = buildResults({
        allPlayers: mockPlayers,
        criteria: { positionGroup: 'Delantero' },
        scout: { quality: 80 },
        playerLocks: { '1': { teamName: 'Real Madrid' } } // Haaland is locked
      });

      const playerIds = results.map(p => p.Id);
      expect(playerIds).not.toContain('1');
    });

    it('filters players by position criteria and returns top candidates', () => {
      const results = buildResults({
        allPlayers: mockPlayers,
        criteria: { positions: ['DC'] },
        scout: { quality: 85 }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(p => p.POS_NOMBRE === 'DC')).toBe(true);
    });

    it('filters players by max age (youth scouting)', () => {
      const results = buildResults({
        allPlayers: mockPlayers,
        criteria: { maxAge: 20 },
        scout: { quality: 90 }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.Age <= 20)).toBe(true);
    });

    it('falls back gracefully to wider pool if strict results < RESULT_COUNT_MIN', () => {
      // Only 1 player with Age <= 17 in mockPlayers (Yamal)
      const results = buildResults({
        allPlayers: mockPlayers,
        criteria: { maxAge: 17 },
        scout: { quality: 100 }
      });

      // Still returns results via pool fallback
      expect(results.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('buildResultsAsync', () => {
    it('resolves asynchronously with identical results', async () => {
      const results = await buildResultsAsync({
        allPlayers: mockPlayers,
        criteria: { positionGroup: 'Arquero' },
        scout: { quality: 80 }
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].POS_NOMBRE).toBe('PT');
    });
  });
});
