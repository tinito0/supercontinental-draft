import { describe, it, expect, vi } from 'vitest';
import {
  getOfferAmount,
  appendHistory,
  counterTransferOffer,
  rejectTransferOffer,
  withdrawTransferOffer
} from '../services/transferService.js';

describe('services/transferService.js', () => {
  describe('getOfferAmount', () => {
    it('returns counterAmount when status is "countered"', () => {
      const offer = { status: 'countered', offerAmount: 10000000, counterAmount: 11000000 };
      expect(getOfferAmount(offer)).toBe(11000000);
    });

    it('returns offerAmount when status is "pending" or other', () => {
      const offer = { status: 'pending', offerAmount: 10000000, counterAmount: 11000000 };
      expect(getOfferAmount(offer)).toBe(10000000);
    });

    it('handles null/undefined offer gracefully', () => {
      expect(getOfferAmount(null)).toBeUndefined();
      expect(getOfferAmount(undefined)).toBeUndefined();
    });
  });

  describe('appendHistory', () => {
    it('appends event and strips undefined fields', () => {
      const initialOffer = {
        history: [
          { type: 'sent', amount: 5000000 }
        ]
      };
      const event = {
        type: 'countered',
        amount: 5500000,
        notes: undefined,
        teamName: 'Equipo A'
      };

      const updated = appendHistory(initialOffer, event);
      expect(updated.length).toBe(2);
      expect(updated[1].type).toBe('countered');
      expect(updated[1].amount).toBe(5500000);
      expect(updated[1].teamName).toBe('Equipo A');
      expect('notes' in updated[1]).toBe(false);
    });

    it('initializes array if offer.history is undefined', () => {
      const offerWithoutHistory = {};
      const event = { type: 'sent', amount: 1000000 };
      const updated = appendHistory(offerWithoutHistory, event);
      expect(Array.isArray(updated)).toBe(true);
      expect(updated.length).toBe(1);
    });
  });

  describe('counterTransferOffer validation boundaries', () => {
    it('rejects counter offer when livePlayer is not found', async () => {
      await expect(counterTransferOffer({
        db: {},
        offer: { id: 'off-1' },
        counterAmountMillions: 12,
        livePlayer: null,
        teamName: 'Boca'
      })).rejects.toThrow(/La contraoferta debe estar entre el valor base/);
    });

    it('rejects counter offer below player base price', async () => {
      const livePlayer = { Id: '10', Precio: 10.0 }; // Base price 10M
      await expect(counterTransferOffer({
        db: {},
        offer: { id: 'off-1' },
        counterAmountMillions: 9.5, // Below base
        livePlayer,
        teamName: 'Boca'
      })).rejects.toThrow(/La contraoferta debe estar entre el valor base y \$11\.50M/);
    });

    it('rejects counter offer above 115% of player base price', async () => {
      const livePlayer = { Id: '10', Precio: 10.0 }; // Base price 10M, max 11.5M
      await expect(counterTransferOffer({
        db: {},
        offer: { id: 'off-1' },
        counterAmountMillions: 11.51, // Above 115%
        livePlayer,
        teamName: 'Boca'
      })).rejects.toThrow(/La contraoferta debe estar entre el valor base y \$11\.50M/);
    });

    it('rejects non-numeric or negative counter values', async () => {
      const livePlayer = { Id: '10', Precio: 10.0 };
      await expect(counterTransferOffer({
        db: {},
        offer: { id: 'off-1' },
        counterAmountMillions: -5,
        livePlayer,
        teamName: 'Boca'
      })).rejects.toThrow();

      await expect(counterTransferOffer({
        db: {},
        offer: { id: 'off-1' },
        counterAmountMillions: NaN,
        livePlayer,
        teamName: 'Boca'
      })).rejects.toThrow();
    });
  });
});
