// Offer expiry shared by the app, the market function and the rules' range check. Pure, synthetic values.
import { describe, it, expect } from 'vitest';
import { OFFER_TTL_MS, offerExpiresAt, isOfferExpired, offerTimeLeft } from '../supabase/functions/_shared/offerExpiry.js';
import { committedInOffers } from '../supabase/functions/_shared/budget.js';
import { buildOfferUpdate } from '../services/transferService.js';

const NOW = Date.parse('2026-10-16T12:00:00Z');

describe('offer expiry', () => {
  it('gives each turn 48 hours', () => {
    expect(offerExpiresAt(NOW)).toBe(NOW + 48 * 3600 * 1000);
    expect(OFFER_TTL_MS).toBe(48 * 3600 * 1000);
  });

  it('expires at that instant; offers made before expiry existed never expire', () => {
    const offer = { expiresAtMs: NOW + 1000 };
    expect(isOfferExpired(offer, NOW)).toBe(false);
    expect(isOfferExpired(offer, NOW + 1000)).toBe(true);
    expect(isOfferExpired({}, NOW + 1e12)).toBe(false);
    expect(offerTimeLeft({}, NOW)).toBeNull();
    expect(offerTimeLeft(offer, NOW + 5000)).toBe(0);
  });

  it('an expired pending offer no longer holds money', () => {
    const offers = [
      { id: 'a', offerAmount: 10000000, expiresAtMs: NOW + 1000 },
      { id: 'b', offerAmount: 20000000, expiresAtMs: NOW - 1000 },
      { id: 'c', offerAmount: 5000000 },
    ];
    expect(committedInOffers(offers, { nowMs: NOW })).toBe(15000000);
  });

  it('a counter or a new offer starts a new 48-hour turn', () => {
    const at = new Date(NOW).toISOString();
    const counter = buildOfferUpdate({ offer: { status: 'pending', senderId: 'b', targetTeamId: 's' }, userId: 's', action: 'counter', amount: 12000000, at });
    expect(counter.expiresAtMs).toBe(NOW + OFFER_TTL_MS);
    const reoffer = buildOfferUpdate({ offer: { status: 'countered', senderId: 'b', targetTeamId: 's' }, userId: 'b', action: 'counter', amount: 11000000, at });
    expect(reoffer.expiresAtMs).toBe(NOW + OFFER_TTL_MS);
    const reject = buildOfferUpdate({ offer: { status: 'pending', senderId: 'b', targetTeamId: 's' }, userId: 's', action: 'reject', at });
    expect(reject).not.toHaveProperty('expiresAtMs');
  });
});
