// Budget arithmetic: the app (hooks/useBudget.js calculateBudget) and the market function
// (supabase/functions/_shared/market.js getCommittedFunds) share supabase/functions/_shared/budget.js.
// The parity tests feed both the same locks and offers. Synthetic data only.
import { describe, it, expect } from 'vitest';
import { calculateBudget } from '../hooks/useBudget.js';
import { committedInOffers, heldAmount, isFranchiseLock, spentOnLocks } from '../supabase/functions/_shared/budget.js';
import { getCommittedFunds, marketPaths } from '../supabase/functions/_shared/market.js';

const PRICES = { 10: 25.0, 11: 15.0, 12: 12.5, 13: 7.35 };
const priceOf = id => PRICES[id] ?? 0;

describe('budget.js', () => {
  it('charges owned non-franchise players at their price', () => {
    const owned = [['10', { isFranchise: true }], ['11', { isFranchise: false }], ['12', {}]];
    expect(spentOnLocks(owned, priceOf)).toBe(27500000);
  });

  it('falls back to franchisePlayerId only for locks without the flag', () => {
    expect(isFranchiseLock('10', {}, 10)).toBe(true);
    expect(isFranchiseLock('10', { isFranchise: false }, '10')).toBe(false); // released and signed again
    expect(isFranchiseLock('11', {}, '10')).toBe(false);
    expect(spentOnLocks([['10', {}], ['11', {}]], priceOf, { franchisePlayerId: '10' })).toBe(15000000);
  });

  it('rounds each price to whole units like the server', () => {
    expect(spentOnLocks([['13', {}]], priceOf)).toBe(7350000);
  });

  it('never lets an offer amount release money', () => {
    expect([-1e12, 'abc', NaN, Infinity, null, 0].map(heldAmount)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(committedInOffers([{ id: 'a', offerAmount: 5000000 }, { id: 'b', offerAmount: -1e12 }])).toBe(5000000);
    expect(committedInOffers([{ id: 'a', offerAmount: 5000000 }], { excludeOfferId: 'a' })).toBe(0);
  });
});

describe('calculateBudget (app)', () => {
  const locks = {
    10: { lockedBy: 'user-1', isFranchise: true },
    11: { lockedBy: 'user-1', isFranchise: false },
    12: { lockedBy: 'user-1' },
    13: { lockedBy: 'user-2' },
  };
  const offers = [
    { id: 'o1', senderId: 'user-1', status: 'pending', offerAmount: 5000000 },
    { id: 'o2', senderId: 'user-1', status: 'pending', offerAmount: 3000000 },
    { id: 'o3', senderId: 'user-1', status: 'rejected', offerAmount: 10000000 },
    { id: 'o4', senderId: 'user-1', status: 'countered', offerAmount: 4000000 },
    { id: 'o5', senderId: 'user-2', status: 'pending', offerAmount: 8000000 },
  ];

  it('subtracts owned players (from locks, not the cart) and pending offers from the team budget', () => {
    const budget = calculateBudget({ baseBudget: 100000000, playerLocks: locks, userId: 'user-1', sentOffers: offers, priceOf });
    expect(budget).toEqual({ base: 100000000, spent: 27500000, committed: 8000000, remaining: 64500000 });
  });

  it('counts a player bought in a transfer before any cart copy exists', () => {
    const afterTransfer = { ...locks, 13: { lockedBy: 'user-1', isFranchise: false } };
    expect(calculateBudget({ baseBudget: 100000000, playerLocks: afterTransfer, userId: 'user-1', priceOf }).spent).toBe(34850000);
  });
});

/** Minimal stand-in for the REST transaction: only the two queries getCommittedFunds runs. */
function fakeTx(paths, { locks, offers }) {
  const matches = (data, filters) => filters.every(([field, , value]) => data[field] === value);
  return {
    async query(collectionPath, filters) {
      const source = collectionPath === paths.locks ? locks : offers;
      return Object.entries(source)
        .filter(([, data]) => matches(data, filters))
        .map(([id, data]) => ({ id, data }));
    },
  };
}

describe('app and market function agree', () => {
  const paths = marketPaths('test-app');
  const catalog = Object.fromEntries(Object.entries(PRICES).map(([id, price]) => [id, [price, 30, 80, 'P', 'DC', 1]]));
  const cases = {
    'franchise, legacy lock and pending offers': {
      locks: { 10: { lockedBy: 'u', isFranchise: true }, 11: { lockedBy: 'u' }, 12: { lockedBy: 'u', isFranchise: false }, 13: { lockedBy: 'v' } },
      offers: { a: { senderId: 'u', status: 'pending', offerAmount: 12000000 }, b: { senderId: 'u', status: 'countered', offerAmount: 1 }, c: { senderId: 'v', status: 'pending', offerAmount: 5 } },
      franchisePlayerId: undefined,
    },
    'legacy franchise lock without the flag': {
      locks: { 10: { lockedBy: 'u' }, 13: { lockedBy: 'u' } },
      offers: {},
      franchisePlayerId: 10,
    },
    'forged negative offer': {
      locks: { 11: { lockedBy: 'u' } },
      offers: { a: { senderId: 'u', status: 'pending', offerAmount: -1e12 } },
      franchisePlayerId: undefined,
    },
  };

  for (const [name, { locks, offers, franchisePlayerId }] of Object.entries(cases)) {
    it(name, async () => {
      const server = await getCommittedFunds(fakeTx(paths, { locks, offers }), paths, catalog, 'u', { franchisePlayerId });
      const sentOffers = Object.entries(offers).map(([id, data]) => ({ id, ...data }));
      const client = calculateBudget({ baseBudget: 200000000, playerLocks: locks, userId: 'u', sentOffers, priceOf, franchisePlayerId });
      expect(client.spent + client.committed).toBe(server);
      expect(server).toBeGreaterThanOrEqual(0);
    });
  }
});
