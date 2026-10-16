// Club ledger for "Mi equipo → Finanzas": what the season's signings, purchases and sales cost or brought in.
// Signings are charged at the catalog price (the budget formula, supabase/functions/_shared/budget.js); a
// transfer's amount is the last entry of the accepted offer's history (the market function writes it), and the
// seller receives it minus the league fee. Informational: the budget itself comes from useBudget. Pure.
import { toUnits } from '../supabase/functions/_shared/budget.js';

const acceptedAmount = offer => Number(offer?.history?.at?.(-1)?.amount ?? offer?.offerAmount) || 0;

/**
 * @param {object} args
 * @param {object[]} args.squad owned players (cart copies: Id, Name, Precio, isFranchise)
 * @param {object[]} args.offerHistory closed offers involving the club
 * @param {string} args.userId
 * @param {number} args.feeRate TRANSFER_FEE_RATE
 */
export function buildClubLedger({ squad = [], offerHistory = [], userId, feeRate }) {
  const accepted = offerHistory.filter(offer => offer.status === 'accepted');
  const purchases = accepted
    .filter(offer => offer.senderId === userId)
    .map(offer => ({ id: offer.id, playerId: offer.playerId, name: offer.playerName, club: offer.targetTeamName, amount: acceptedAmount(offer) }));
  const sales = accepted
    .filter(offer => offer.targetTeamId === userId)
    .map(offer => {
      const amount = acceptedAmount(offer);
      const net = Math.round(amount * (1 - feeRate));
      return { id: offer.id, playerId: offer.playerId, name: offer.playerName, club: offer.senderTeamName, amount, fee: amount - net, net };
    });

  const bought = new Set(purchases.map(p => String(p.playerId)));
  const signings = squad
    .filter(player => !player.isFranchise && !bought.has(String(player.Id)))
    .map(player => ({ playerId: player.Id, name: player.Name, amount: toUnits(player.Precio) }));

  const sum = (rows, key = 'amount') => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const spentOnSignings = sum(signings);
  const spentOnPurchases = sum(purchases);
  const receivedFromSales = sum(sales, 'net');
  return {
    signings,
    purchases,
    sales,
    totals: {
      spentOnSignings,
      spentOnPurchases,
      receivedFromSales,
      fees: sum(sales, 'fee'),
      net: receivedFromSales - spentOnSignings - spentOnPurchases,
    },
  };
}
