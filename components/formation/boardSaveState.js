// Pure rules behind hooks/useLineupSave.js and the board's save status (audit PIZ-1, PIZ-4, PIZ-5, T-3).

/** 'idle' (nothing to save), 'pending' (an edit waits for the autosave), 'saving', 'saved', 'error', 'blocked' (bench rule). */
export const SAVE_STATUS = Object.freeze({
  idle: 'idle', pending: 'pending', saving: 'saving', saved: 'saved', error: 'error', blocked: 'blocked',
});

/** The board holds edits the server does not have yet: closing now would lose them. */
export function isBoardDirty(status) {
  return status === SAVE_STATUS.pending || status === SAVE_STATUS.saving
    || status === SAVE_STATUS.error || status === SAVE_STATUS.blocked;
}

const ERROR_COPY = {
  'lineup-invalid': 'El servidor no aceptó esta táctica. Revisá los titulares y volvé a intentar.',
  forbidden: 'No tenés permiso para guardar la táctica de este club.',
  'team-not-found': 'No encontramos tu club. Recargá la página y volvé a intentar.',
  unauthenticated: 'Tu sesión venció. Volvé a iniciar sesión para guardar.',
  'not-configured': 'El guardado no está configurado en este sitio. Avisale al admin.',
  unavailable: 'No se pudo contactar al servidor. Reintentá en unos instantes.',
};

/**
 * Copy for a failed save (a LineupError from services/lineupService.js, or any error). The function's own
 * message is kept where it already says what to do (bench rule, outdated function, a rejection with a reason).
 */
export function lineupSaveErrorMessage(error) {
  const code = error?.code;
  if (code === 'bench-below-minimum' || code === 'function-outdated') return error.message;
  if (ERROR_COPY[code]) return ERROR_COPY[code];
  if (code === 'rejected' && error?.message) return error.message;
  return ERROR_COPY.unavailable;
}

/** A refusal that waits for a different lineup (retrying the same one cannot work). */
export function isBenchBlock(error) {
  return error?.code === 'bench-below-minimum';
}

/** «Sacamos del once a X e Y: ya no son de tu club.», or null when the server kept every starter. */
export function droppedStartersMessage(dropped, cart) {
  if (!Array.isArray(dropped) || dropped.length === 0) return null;
  const names = dropped.map(id => (cart || []).find(p => String(p.Id) === String(id))?.Name || `#${id}`);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `Sacamos del once a ${list}: ya no ${names.length === 1 ? 'es' : 'son'} de tu club.`;
}

/** Moved markers and changed roles stored for one tactical state (what Restablecer, Copiar de Inicio or a new formation replace). */
export function stateEditCount(states, stateId) {
  return Object.keys(states?.positions?.[stateId] || {}).length + Object.keys(states?.roles?.[stateId] || {}).length;
}
