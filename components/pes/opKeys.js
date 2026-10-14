// Stable key of "what an operation changes", used to highlight modified fields.
export function opKey(op) {
  const t = op.target || {};
  const id = t.playerId ?? t.assignmentId ?? t.coachId ?? (t.kit != null ? `${t.teamId}/${t.kit}` : t.slot != null ? `${t.teamId}#${t.slot}` : t.teamId);
  return `${op.type}|${id}|${op.field ?? op.key ?? op.slot ?? ''}`;
}

export function modifiedKeys(savedOps, drafts) {
  const keys = new Set();
  for (const op of savedOps) if (op.state !== 'discarded') keys.add(opKey(op));
  for (const op of drafts) keys.add(opKey(op));
  return keys;
}
