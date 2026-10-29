// Club ledger (Mi equipo → Finanzas). Pure, synthetic squad and offers.
import { describe, it, expect } from 'vitest';
import { buildClubLedger } from '../utils/clubLedger.js';

const squad = [
  { Id: 1, Name: 'Firmado', Precio: 10 },
  { Id: 2, Name: 'Franquicia', Precio: 50, isFranchise: true },
  { Id: 3, Name: 'Comprado', Precio: 20 },
];
const offerHistory = [
  { id: 'buy', status: 'accepted', senderId: 'me', targetTeamId: 'x', playerId: 3, playerName: 'Comprado', targetTeamName: 'X',
    offerAmount: 21000000, counterAmount: 30000000, history: [{ type: 'accepted', amount: 22000000 }] },
  { id: 'sell', status: 'accepted', senderId: 'y', targetTeamId: 'me', playerId: 9, playerName: 'Vendido', senderTeamName: 'Y',
    offerAmount: 40000000, history: [{ type: 'accepted', amount: 40000000 }] },
  { id: 'no', status: 'rejected', senderId: 'me', targetTeamId: 'z', playerId: 5, offerAmount: 1 },
];

describe('buildClubLedger', () => {
  it('charges signings at catalog price, purchases at the accepted amount, and nets sales after the fee', () => {
    const ledger = buildClubLedger({ squad, offerHistory, userId: 'me', feeRate: 0.15 });
    expect(ledger.signings.map(s => s.name)).toEqual(['Firmado']);
    expect(ledger.purchases).toMatchObject([{ name: 'Comprado', amount: 22000000 }]);
    expect(ledger.sales).toMatchObject([{ name: 'Vendido', amount: 40000000, fee: 6000000, net: 34000000 }]);
    expect(ledger.totals).toEqual({
      spentOnSignings: 10000000, spentOnPurchases: 22000000, receivedFromSales: 34000000, fees: 6000000, net: 2000000,
    });
  });

  it('is empty for a club with no movements', () => {
    expect(buildClubLedger({ userId: 'me', feeRate: 0.15 }).totals.net).toBe(0);
  });
});
