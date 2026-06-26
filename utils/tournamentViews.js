export const TOURNAMENT_VIEWS = {
  GROUPS: 'groups',
  BRACKET: 'bracket',
  REPECHAJE: 'repechaje',
  STATS: 'stats',
};

export function normalizeTournamentView(view) {
  if (view === 'table' || view === TOURNAMENT_VIEWS.GROUPS) return TOURNAMENT_VIEWS.GROUPS;
  if (view === TOURNAMENT_VIEWS.BRACKET) return TOURNAMENT_VIEWS.BRACKET;
  if (view === TOURNAMENT_VIEWS.REPECHAJE) return TOURNAMENT_VIEWS.REPECHAJE;
  if (view === 'goleadores' || view === TOURNAMENT_VIEWS.STATS) return TOURNAMENT_VIEWS.STATS;
  return TOURNAMENT_VIEWS.GROUPS;
}
