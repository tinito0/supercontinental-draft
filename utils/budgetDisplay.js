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

/** At or below this share of the base the budget counts as running low (the budget alert's threshold, hooks/useBudget.js). */
export const LOW_BUDGET_PERCENT = 20;

/**
 * One tone for the same number wherever it shows (header meter, "Disponible" in Finanzas): warning from 20% down,
 * danger once nothing is left, crest blue otherwise. An unknown percent (no base yet) stays neutral.
 * @param {number|null|undefined} percent share of the base still available, 0..100
 * @returns {'accent'|'warning'|'danger'}
 */
export function budgetTone(percent) {
  if (!Number.isFinite(percent)) return 'accent';
  if (percent <= 0) return 'danger';
  return percent <= LOW_BUDGET_PERCENT ? 'warning' : 'accent';
}

/** Tailwind classes per tone: `bar` fills the meter, `text` colours the figure when the tone carries a warning. */
export const BUDGET_TONE_CLASSES = Object.freeze({
  accent: { bar: 'bg-accent', text: 'text-ink' },
  warning: { bar: 'bg-warning', text: 'text-warning-soft' },
  danger: { bar: 'bg-danger', text: 'text-danger-soft' },
});
