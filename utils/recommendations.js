/**
 * Utility for scoring and recommending players based on squad needs, budget, and positional gaps.
 * Extracted from app.jsx to decouple heavy O(N) calculations from the React render phase.
 */

const POS_GROUPS = {
  PT: ['PT'],
  DEF: ['DFC', 'LD', 'LI'],
  MED: ['MC', 'MCD', 'MO', 'MD', 'MI'],
  DEL: ['DC', 'SD', 'ED', 'EI'],
};

const GROUP_LABELS = { PT: 'arco', DEF: 'defensa', MED: 'mediocampo', DEL: 'ataque' };
const GROUP_TARGETS = { PT: 2, DEF: 7, MED: 7, DEL: 5 };
const TARGET_SQUAD_SIZE = 21;

function getPlayerGroup(pos) {
  for (const [group, positions] of Object.entries(POS_GROUPS)) {
    if (positions.includes(pos)) return group;
  }
  return null;
}

export function calculateSmartRecommendations({
  allPlayers = [],
  cart = [],
  playerLocks = {},
  remainingBudget = 0,
  userProfile = null,
}) {
  if (!allPlayers.length || !userProfile) return [];

  const remainingBudgetM = Math.max(0, Number(remainingBudget || 0) / 1000000);
  if (remainingBudgetM <= 0) return [];

  const groupCounts = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
  const groupOvrTotals = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
  const positionCounts = {};
  const cartIds = new Set(cart.map(player => String(player.Id)));
  const lockedIds = new Set(Object.keys(playerLocks || {}));

  cart.forEach(player => {
    const pos = player.POS_NOMBRE;
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    const group = getPlayerGroup(pos);
    if (group) {
      groupCounts[group]++;
      groupOvrTotals[group] += Number(player.OVR_CALCULADO || 0);
    }
  });

  const groupAvgOvr = {};
  Object.keys(groupCounts).forEach(group => {
    groupAvgOvr[group] = groupCounts[group] > 0
      ? Math.round(groupOvrTotals[group] / groupCounts[group])
      : 0;
  });

  const overallAvg = cart.length > 0
    ? Math.round(cart.reduce((sum, player) => sum + Number(player.OVR_CALCULADO || 0), 0) / cart.length)
    : 0;
  const openSlots = Math.max(1, TARGET_SQUAD_SIZE - cart.length);
  const budgetPerSlot = remainingBudgetM / openSlots;
  const strictCap = Math.max(1.5, Math.min(remainingBudgetM, Math.max(budgetPerSlot * 2.4, remainingBudgetM * 0.16)));
  const emergencyCap = Math.max(strictCap, Math.min(remainingBudgetM, Math.max(budgetPerSlot * 3.3, remainingBudgetM * 0.28)));

  const scored = allPlayers
    .filter(player => {
      const price = Number(player.Precio || 0);
      const group = getPlayerGroup(player.POS_NOMBRE);
      const groupNeed = group ? Math.max(0, (GROUP_TARGETS[group] - groupCounts[group]) / GROUP_TARGETS[group]) : 0;
      if (!group) return false;
      if (cartIds.has(String(player.Id))) return false;
      if (lockedIds.has(String(player.Id))) return false;
      if (price <= 0 || price > remainingBudgetM) return false;
      if (price > strictCap && groupNeed < 0.55 && price > emergencyCap) return false;
      return true;
    })
    .map(player => {
      const pos = player.POS_NOMBRE;
      const group = getPlayerGroup(pos);
      const price = Number(player.Precio || 0);
      const ovr = Number(player.OVR_CALCULADO || 0);
      const groupNeed = group ? Math.max(0, GROUP_TARGETS[group] - groupCounts[group]) : 0;
      const groupNeedRatio = group ? groupNeed / GROUP_TARGETS[group] : 0;
      const groupWeakness = group && groupAvgOvr[group] > 0 && overallAvg > 0
        ? Math.max(0, overallAvg - groupAvgOvr[group])
        : 0;
      const posCount = positionCounts[pos] || 0;
      const priceShare = price / Math.max(remainingBudgetM, 1);
      const slotShare = price / Math.max(budgetPerSlot, 1);
      const valueScore = price > 0 ? Math.min(24, Math.max(0, (ovr - 68) / Math.sqrt(price))) : 0;

      let score = 0;
      score += groupNeedRatio * 48;
      score += Math.min(24, groupWeakness * 4);
      score += Math.max(0, ovr - Math.max(72, overallAvg - 4)) * 1.8;
      score += valueScore;
      if (posCount === 0) score += 18;
      else if (posCount === 1) score += 7;
      else if (posCount >= 3) score -= 24;
      if (slotShare <= 1.05) score += 16;
      else if (slotShare <= 1.6) score += 8;
      else if (priceShare > 0.28 && groupNeedRatio < 0.55) score -= 18;
      if (cart.length < 11 && priceShare > 0.22) score -= 14;
      if (ovr >= 85 && priceShare <= 0.22) score += 10;

      let reason = 'Buen encaje';
      if (groupNeed > 0 && posCount === 0) reason = `Necesitás un ${pos}`;
      else if (groupNeedRatio >= 0.45) reason = `Completa ${GROUP_LABELS[group]}`;
      else if (groupWeakness >= 5) reason = `Sube ${GROUP_LABELS[group]}`;
      else if (slotShare <= 1.05) reason = 'Cuida presupuesto';
      else if (ovr >= overallAvg + 5) reason = 'Salto de calidad';

      const fit = slotShare <= 1.05 ? 'VALOR' : groupNeedRatio >= 0.45 ? 'NECESIDAD' : ovr >= overallAvg + 5 ? 'OVR' : 'FIT';
      const _valueNote = `${priceShare <= 0.01 ? '<1' : Math.round(priceShare * 100)}% del presupuesto`;
      return { ...player, _score: score, _reason: reason, _fit: fit, _group: group, _valueNote };
    })
    .sort((a, b) => b._score - a._score || Number(b.OVR_CALCULADO || 0) - Number(a.OVR_CALCULADO || 0));

  const selected = [];
  const selectedGroups = {};
  const selectedPositions = {};
  for (const player of scored) {
    const groupCount = selectedGroups[player._group] || 0;
    const selectedPosCount = selectedPositions[player.POS_NOMBRE] || 0;
    if (groupCount >= 2) continue;
    if (selectedPosCount >= 1 && selected.length < 4) continue;
    selected.push(player);
    selectedGroups[player._group] = groupCount + 1;
    selectedPositions[player.POS_NOMBRE] = selectedPosCount + 1;
    if (selected.length >= 6) break;
  }
  if (selected.length < 6) {
    for (const player of scored) {
      if (selected.some(item => String(item.Id) === String(player.Id))) continue;
      selected.push(player);
      if (selected.length >= 6) break;
    }
  }

  return selected;
}
