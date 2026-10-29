import { describe, it, expect, vi } from 'vitest';
import {
  getOfferAmount,
  appendHistory,
  buildOfferUpdate,
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

  describe('buildOfferUpdate (turns, same table as firestore.rules)', () => {
    const at = '2026-10-14T00:00:00.000Z';
    const pending = { senderId: 'buyer', targetTeamId: 'seller', status: 'pending', offerAmount: 11000000, history: [{ type: 'sent' }] };
    const countered = { ...pending, status: 'countered', counterAmount: 11500000 };

    it('the seller counters a pending offer', () => {
      const update = buildOfferUpdate({ offer: pending, userId: 'seller', action: 'counter', amount: 11500000, teamName: 'S', at });
      expect(update).toMatchObject({ status: 'countered', counterAmount: 11500000, counterBy: 'S' });
      expect(update.history.at(-1)).toMatchObject({ type: 'countered', teamId: 'seller', amount: 11500000 });
    });

    it("the buyer answers a counter with a new offer, which goes back to the seller's turn", () => {
      const update = buildOfferUpdate({ offer: countered, userId: 'buyer', action: 'counter', amount: 11200000, teamName: 'B', at });
      expect(update).toMatchObject({ status: 'pending', offerAmount: 11200000 });
      expect(update).not.toHaveProperty('counterAmount');
      expect(update.history.at(-1)).toMatchObject({ type: 'sent', teamId: 'buyer', amount: 11200000 });
    });

    it('rejects moves out of turn: the buyer cannot counter their own pending offer, nor the seller re-counter', () => {
      expect(() => buildOfferUpdate({ offer: pending, userId: 'buyer', action: 'counter', amount: 1, at })).toThrow(/no es tu turno/);
      expect(() => buildOfferUpdate({ offer: countered, userId: 'seller', action: 'counter', amount: 1, at })).toThrow(/no es tu turno/);
    });

    it('credits a rejection to the team that rejects it', () => {
      const bySeller = buildOfferUpdate({ offer: pending, userId: 'seller', action: 'reject', teamName: 'S', at });
      const byBuyer = buildOfferUpdate({ offer: countered, userId: 'buyer', action: 'reject', teamName: 'B', at });
      expect(bySeller.history.at(-1)).toMatchObject({ teamId: 'seller', amount: 11000000 });
      expect(byBuyer.history.at(-1)).toMatchObject({ teamId: 'buyer', amount: 11500000 });
    });

    it('lets the buyer withdraw a pending offer and the seller withdraw their counter', () => {
      expect(buildOfferUpdate({ offer: pending, userId: 'buyer', action: 'withdraw', at }).status).toBe('withdrawn');
      expect(buildOfferUpdate({ offer: countered, userId: 'seller', action: 'withdraw', at }).status).toBe('withdrawn');
    });

    it('refuses closed offers (e.g. already accepted in another tab) and outsiders', () => {
      const accepted = { ...pending, status: 'accepted' };
      expect(() => buildOfferUpdate({ offer: accepted, userId: 'buyer', action: 'withdraw', at })).toThrow(/no es tu turno/);
      expect(() => buildOfferUpdate({ offer: pending, userId: 'mallory', action: 'reject', at })).toThrow(/No participás/);
    });
  });
});
