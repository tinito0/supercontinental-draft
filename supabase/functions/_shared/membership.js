// League membership, shared by the market function and the app. Pure.
// A team created by a new sign-in starts with approved: false and cannot sign, make offers or chat until the
// admin approves it (components/admin/TeamsAdminSection.jsx). Teams created before approval existed have no
// `approved` field and count as approved, so no migration is needed. firestore.rules apply the same reading.

/** True unless the team is explicitly waiting for approval. */
export function isTeamApproved(team) {
  return team?.approved !== false;
}

/** Message shown when an unapproved team tries a market action. */
export const PENDING_APPROVAL_MESSAGE = 'Tu equipo todavía no fue aprobado por el administrador de la liga.';
