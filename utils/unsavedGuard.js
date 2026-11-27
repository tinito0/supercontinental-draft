// Pure rules behind hooks/useUnsavedGuard.js: which editors hold unsaved work, and what to ask before leaving.

/** Returns a new map of dirty flags with `id` set (a clean editor is removed, so the map only lists dirty ones). */
export function withDirtyFlag(flags, id, isDirty) {
  const next = { ...flags };
  if (isDirty) next[id] = true;
  else delete next[id];
  return next;
}

export function hasUnsavedChanges(flags) {
  return Object.keys(flags || {}).length > 0;
}

/** Whether a change of section or a close must stop and ask first. `targetId === currentId` is not a move. */
export function mustConfirmLeave(flags, currentId, targetId) {
  if (targetId !== undefined && targetId === currentId) return false;
  return hasUnsavedChanges(flags);
}

export const LEAVE_CONFIRM = Object.freeze({
  title: '¿Salir sin guardar?',
  message: 'Hiciste cambios que todavía no guardaste. Si salís ahora, se pierden.',
  confirmLabel: 'Salir sin guardar',
  cancelLabel: 'Seguir editando',
});

/** Whether the club edit form differs from the team it was opened with (budget compared as text, as the form holds it). */
export function isTeamFormDirty(team, form) {
  if (!team || !form) return false;
  const norm = value => JSON.stringify(value ?? {});
  return (form.teamName ?? '') !== (team.teamName ?? '')
    || String(form.budget ?? '') !== String(team.budget ?? '')
    || (form.logoUrl ?? '') !== (team.logoUrl ?? '')
    || Number(form.country) !== Number(team.country || 204)
    || norm(form.manualStats) !== norm(team.manualStats);
}
