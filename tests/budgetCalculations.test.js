import { describe, it, expect } from 'vitest';

function calculateCartCost(ownedCart = [], userProfile) {
  return ownedCart.reduce((total, player) => {
    const isFranchise = player.isFranchise || (userProfile?.franchisePlayerId === player.Id);
    return total + (isFranchise ? 0 : (Number(player.Precio) || 0) * 1000000);
  }, 0);
}

function calculateCommittedOffers(sentOffers = [], userId) {
  if (!userId || !sentOffers) return 0;
  return sentOffers
    .filter(o => o.senderId === userId && o.status === 'pending')
    .reduce((sum, o) => sum + (Number(o.offerAmount) || 0), 0);
}

function calculateRemainingBudget(userProfile, totalCartCost, committedInOffers) {
  if (!userProfile) return 0;
  const baseBudget = Number(userProfile.budget) || 0;
  return baseBudget - totalCartCost - committedInOffers;
}

function calculateBudgetPercent(remainingBudget, totalBudget) {
  if (!totalBudget || totalBudget <= 0) return 100;
  return Math.max(0, (remainingBudget / totalBudget) * 100);
}

describe('Budget Financial Calculations (useBudget core logic)', () => {
  const userProfile = {
    budget: 100000000, // 100M
    franchisePlayerId: '10'
  };

  const sampleRoster = [
    { Id: '10', Name: 'Messi', Precio: 25.0 }, // Franchise player -> $0 cost
    { Id: '11', Name: 'De Paul', Precio: 15.0 }, // $15M
    { Id: '12', Name: 'Romero', Precio: 12.5 }, // $12.5M
  ];

  it('correctly calculates totalCartCost excluding franchise players', () => {
    const cost = calculateCartCost(sampleRoster, userProfile);
    // 15M + 12.5M = 27.5M (27,500,000)
    expect(cost).toBe(27500000);
  });

  it('respects player.isFranchise flag on player object', () => {
    const roster = [
      { Id: '20', Name: 'Mbappe', Precio: 30.0, isFranchise: true },
      { Id: '21', Name: 'Camavinga', Precio: 10.0 }
    ];
    const cost = calculateCartCost(roster, { budget: 100000000 });
    expect(cost).toBe(10000000);
  });

  it('calculates committed funds only for pending offers sent by the current user', () => {
    const offers = [
      { senderId: 'user-1', status: 'pending', offerAmount: 5000000 },
      { senderId: 'user-1', status: 'pending', offerAmount: 3000000 },
      { senderId: 'user-1', status: 'rejected', offerAmount: 10000000 },
      { senderId: 'user-1', status: 'accepted', offerAmount: 4000000 },
      { senderId: 'user-2', status: 'pending', offerAmount: 8000000 }, // Rival offer
    ];

    const committed = calculateCommittedOffers(offers, 'user-1');
    expect(committed).toBe(8000000); // Only pending from user-1
  });

  it('calculates remaining budget taking into account roster and committed transfers', () => {
    const cartCost = 27500000;
    const committed = 8000000;
    const remaining = calculateRemainingBudget(userProfile, cartCost, committed);
    // 100M - 27.5M - 8M = 64.5M
    expect(remaining).toBe(64500000);
  });

  it('calculates budget percentage and clamps to zero if overspent', () => {
    expect(calculateBudgetPercent(50000000, 100000000)).toBe(50);
    expect(calculateBudgetPercent(15000000, 100000000)).toBe(15);
    expect(calculateBudgetPercent(-5000000, 100000000)).toBe(0);
  });
});
