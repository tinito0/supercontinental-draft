/* Error texts shared by hooks/useLeagueData.js and the components that show them (kept apart so components can
   tell the offline case without importing Firebase). */

export const OFFLINE_MESSAGE = 'No hay conexión. Los datos aparecen apenas vuelva.';

/** The offline text already says what happens next, so callers drop their "Recargá la página" line for it. */
export const isOfflineError = error => error === OFFLINE_MESSAGE;
