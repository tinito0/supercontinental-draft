import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatPriceShort,
  formatBudget,
  normalizarString,
  processPlayersData,
  getPosCategory,
  getPosColorClass,
  getPitchPosColors,
  getOvrBadgeColor,
  getStatAndOvrColorClass,
  getPosColor,
  getRegionById,
  getFlagCode
} from '../utils/helpers.js';

describe('utils/helpers.js', () => {
  describe('formatPrice', () => {
    it('formats price in millions correctly', () => {
      const result = formatPrice(15.5);
      // Depending on locale es-ES: 15.500.000 or with non-breaking spaces
      expect(result).toMatch(/15[.\s]500[.\s]000/);
    });

    it('returns "0" for invalid inputs', () => {
      expect(formatPrice(null)).toBe('0');
      expect(formatPrice(undefined)).toBe('0');
      expect(formatPrice('abc')).toBe('0');
      expect(formatPrice(NaN)).toBe('0');
    });
  });

  describe('formatPriceShort', () => {
    it('formats price short notation with dollar and M suffix', () => {
      expect(formatPriceShort(12)).toBe('$12.00M');
      expect(formatPriceShort(0.75)).toBe('$0.75M');
      expect(formatPriceShort(12.345)).toBe('$12.35M');
    });

    it('returns $0M for NaN or non-number inputs', () => {
      expect(formatPriceShort(null)).toBe('$0M');
      expect(formatPriceShort(undefined)).toBe('$0M');
      expect(formatPriceShort(NaN)).toBe('$0M');
    });
  });

  describe('formatBudget', () => {
    it('formats standard integer budget', () => {
      const result = formatBudget(100000000);
      expect(result).toMatch(/100[.\s]000[.\s]000/);
    });
  });

  describe('normalizarString', () => {
    it('removes accents and diacritics and converts to lowercase', () => {
      expect(normalizarString('Lionel Messi')).toBe('lionel messi');
      expect(normalizarString('Ángel Di María')).toBe('angel di maria');
      expect(normalizarString('Éder Militão')).toBe('eder militao');
      expect(normalizarString('  Kylian Mbappé  ')).toBe('kylian mbappe');
    });

    it('handles non-string inputs safely', () => {
      expect(normalizarString(null)).toBe('');
      expect(normalizarString(undefined)).toBe('');
      expect(normalizarString(123)).toBe('');
    });
  });

  describe('processPlayersData', () => {
    it('adds normalized searchableName and ensures numeric types', () => {
      const rawPlayers = [
        { Id: '1', Name: 'Julián Álvarez', Precio: '18.5', Age: '24', OVR_CALCULADO: '88' },
        { Id: '2', Name: null, Precio: null, Age: undefined, OVR_CALCULADO: '' }
      ];

      const processed = processPlayersData(rawPlayers);
      expect(processed[0].searchableName).toBe('julian alvarez');
      expect(processed[0].Precio).toBe(18.5);
      expect(processed[0].Age).toBe(24);
      expect(processed[0].OVR_CALCULADO).toBe(88);

      expect(processed[1].searchableName).toBe('');
      expect(processed[1].Precio).toBe(0);
      expect(processed[1].Age).toBe(0);
      expect(processed[1].OVR_CALCULADO).toBe(0);
    });
  });

  describe('getPosCategory', () => {
    it('correctly maps forward positions', () => {
      expect(getPosCategory('DC')).toBe('forward');
      expect(getPosCategory('SD')).toBe('forward');
      expect(getPosCategory('EI')).toBe('forward');
      expect(getPosCategory('ED')).toBe('forward');
    });

    it('correctly maps midfield positions', () => {
      expect(getPosCategory('MC')).toBe('midfield');
      expect(getPosCategory('MCD')).toBe('midfield');
      expect(getPosCategory('MO')).toBe('midfield');
      expect(getPosCategory('MI')).toBe('midfield');
      expect(getPosCategory('MD')).toBe('midfield');
    });

    it('correctly maps defense positions', () => {
      expect(getPosCategory('DFC')).toBe('defense');
      expect(getPosCategory('LI')).toBe('defense');
      expect(getPosCategory('LD')).toBe('defense');
    });

    it('correctly maps goalkeeper position', () => {
      expect(getPosCategory('PT')).toBe('keeper');
    });

    it('returns none for unknown positions', () => {
      expect(getPosCategory('XYZ')).toBe('none');
      expect(getPosCategory(null)).toBe('none');
    });
  });

  describe('getPosColorClass', () => {
    it('returns correct CSS classes for positions', () => {
      expect(getPosColorClass('DC')).toBe('pos-delantero');
      expect(getPosColorClass('MC')).toBe('pos-medio');
      expect(getPosColorClass('DFC')).toBe('pos-defensa');
      expect(getPosColorClass('PT')).toBe('pos-portero');
      expect(getPosColorClass('OTHER')).toBe('pos-default');
    });
  });

  describe('getPitchPosColors', () => {
    it('returns valid theme styling objects', () => {
      const forwardColor = getPitchPosColors('DC');
      expect(forwardColor.text).toBe('text-red-400');
      const keeperColor = getPitchPosColors('PT');
      expect(keeperColor.text).toBe('text-yellow-400');
    });
  });

  describe('getOvrBadgeColor', () => {
    it('returns correct emerald for >= 85', () => {
      expect(getOvrBadgeColor(85)).toBe('bg-emerald-500');
      expect(getOvrBadgeColor(92)).toBe('bg-emerald-500');
    });

    it('returns yellow for >= 70 and < 85', () => {
      expect(getOvrBadgeColor(70)).toBe('bg-yellow-500');
      expect(getOvrBadgeColor(84)).toBe('bg-yellow-500');
    });

    it('returns orange for < 70', () => {
      expect(getOvrBadgeColor(69)).toBe('bg-orange-500');
      expect(getOvrBadgeColor(0)).toBe('bg-orange-500');
    });
  });

  describe('getStatAndOvrColorClass', () => {
    it('returns appropriate stat color class based on thresholds', () => {
      expect(getStatAndOvrColorClass(95)).toBe('stat-c-90');
      expect(getStatAndOvrColorClass(82)).toBe('stat-c-80');
      expect(getStatAndOvrColorClass(73)).toBe('stat-c-70');
      expect(getStatAndOvrColorClass(64)).toBe('stat-c-60');
      expect(getStatAndOvrColorClass(55)).toBe('stat-c-50');
      expect(getStatAndOvrColorClass(40)).toBe('stat-c-default');
    });
  });

  describe('getPosColor', () => {
    it('returns color scheme for aptitude 3, 2, 1 and default', () => {
      expect(getPosColor(3).bgColor).toBe('#00b34a');
      expect(getPosColor(2).bgColor).toBe('#a0dd00');
      expect(getPosColor(1).bgColor).toBe('#ffc400');
      expect(getPosColor(0).bgColor).toBe('#333');
    });
  });

  describe('getRegionById & getFlagCode', () => {
    it('handles region resolution and unknown countries safely', () => {
      expect(getRegionById('invalid')).toBe('Otras');
      expect(getFlagCode(null)).toBe('NA');
    });
  });
});
