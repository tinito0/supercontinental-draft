import { FORMATIONS, DEFAULT_LOGO } from '../../utils/constants.js';
import { layoutForState, serializeFormationStates } from '../../utils/formationStates.js';

/**
 * The public copy of a board (shared_formations/{teamId}, read by screens/FormationViewScreen.jsx): the XI with
 * names embedded, then the bench by OVR. `lineup` must already be sanitized against the squad.
 */
export function buildSharedFormation({ formationStates, lineup, cart, dorsals = {}, availability = {}, teamName, logoUrl, teamId, now = new Date() }) {
  const formationKey = formationStates.formation;
  const formation = FORMATIONS[formationKey];
  const squad = cart || [];
  const slots = {};
  if (formation?.layout) {
    layoutForState(formation, formationStates, 'base').forEach((slot, index) => {
      const playerId = lineup[index];
      const player = playerId && squad.find(p => String(p.Id) === String(playerId));
      if (!player?.Name || !player?.OVR_CALCULADO) return;
      slots[index] = { playerId: String(playerId), name: player.Name, pos: slot.pos, ovr: player.OVR_CALCULADO, dorsal: dorsals[playerId] || '' };
    });
  }
  const starterIds = new Set(Object.values(slots).map(s => s.playerId));
  const bench = squad
    .filter(p => !starterIds.has(String(p.Id)))
    .sort((a, b) => (Number(b.OVR_CALCULADO) || 0) - (Number(a.OVR_CALCULADO) || 0))
    .map(player => ({
      playerId: String(player.Id),
      name: player.Name,
      pos: player.POS_NOMBRE,
      ovr: player.OVR_CALCULADO,
      dorsal: dorsals[player.Id] || '',
      available: availability[player.Id] !== false,
    }));
  return {
    teamName: teamName || 'Equipo',
    logoUrl: logoUrl || DEFAULT_LOGO,
    formationKey,
    formationName: formation?.name || formationKey,
    formationStates: serializeFormationStates(formationStates),
    slots,
    bench,
    isPublic: true,
    createdAt: now.toISOString(),
    createdBy: teamId,
  };
}
