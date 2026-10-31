// League fee on transfers: charged on the premium only (supabase/functions/_shared/transferFee.js). Pure.
import { transferSplit } from '../supabase/functions/_shared/transferFee.js';
import { buildClubLedger } from '../utils/clubLedger.js';

describe('transferSplit', () => {
  test('the fee is 15% of what is paid above the base value', () => {
    expect(transferSplit(46000000, 40000000, 0.15)).toEqual({ premium: 6000000, fee: 900000, sellerNet: 45100000 });
  });

  test('selling at the base value costs the seller nothing', () => {
    expect(transferSplit(40000000, 40000000, 0.15)).toEqual({ premium: 0, fee: 0, sellerNet: 40000000 });
  });

  test('the seller never gets less than the base value', () => {
    for (const amount of [40000000, 41234567, 46000000]) {
      expect(transferSplit(amount, 40000000, 0.15).sellerNet).toBeGreaterThanOrEqual(40000000);
    }
  });
});

describe('buildClubLedger sales', () => {
  const sale = extra => ({ id: 's', status: 'accepted', senderId: 'y', targetTeamId: 'me', playerId: 9, history: [{ type: 'accepted', amount: 46000000, ...extra }] });

  test('uses the net the market function recorded', () => {
    const ledger = buildClubLedger({ offerHistory: [sale({ sellerNet: 45100000 })], userId: 'me', feeRate: 0.15 });
    expect(ledger.sales[0]).toMatchObject({ net: 45100000, fee: 900000 });
  });

  test('recomputes older sales from the catalog price, fee on the premium', () => {
    const ledger = buildClubLedger({ offerHistory: [sale()], userId: 'me', feeRate: 0.15, priceOf: () => 40 });
    expect(ledger.sales[0]).toMatchObject({ net: 45100000, fee: 900000 });
  });
});
