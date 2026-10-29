/**
 * Base and fill of the budget meter in "Plantel y finanzas".
 * The base is the one useBudget already used for "Disponible" (teams/{uid}.budget, which the server changes on
 * transfers); the private profile budget and the default only fill in while the team document is missing.
 * @param {{ base?: number, profileBudget?: number, defaultBudget?: number, remaining?: number, percent?: number }} input
 * @returns {{ base: number, percent: number }} percent of the base still available, clamped to 0..100
 */
export function budgetMeter({ base, profileBudget, defaultBudget, remaining = 0, percent }) {
  const resolvedBase = Number(base) || Number(profileBudget) || Number(defaultBudget) || 0;
  const raw = Number.isFinite(percent)
    ? percent
    : resolvedBase > 0 ? (Number(remaining) / resolvedBase) * 100 : 0;
  return { base: resolvedBase, percent: Math.min(100, Math.max(0, raw)) };
}
