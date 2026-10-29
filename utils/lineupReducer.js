// Lineup of the tactics board (components/FormationModal.jsx): which player is in each slot, plus the player
// "in hand" while he is being moved. Both live in one reducer so a placement is one pure step.
// (Before: setLineup ran INSIDE the setHoldingPlayer updater, an impure side effect. React can call that updater
// more than once, always in Strict Mode, and each call wrote the same player again, leaving one playerId in
// several slots.)

export const initialFormationState = { lineup: {}, holdingPlayer: null };

// Besides dropping players no longer in the cart (SANITIZE does that), this enforces uniqueness: if one playerId
// sits in more than one slot (old data saved to Firestore while the duplication bug was live), the first slot in
// numeric order keeps him and the rest are cleared. Without it a corrupted lineup stayed corrupted forever.
export function dedupeLineup(sourceLineup) {
  const seen = new Set();
  const deduped = {};
  const orderedSlots = Object.entries(sourceLineup || {})
    .sort(([a], [b]) => Number(a) - Number(b));
  orderedSlots.forEach(([slotIndex, playerId]) => {
    const id = String(playerId || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped[slotIndex] = id;
  });
  return deduped;
}

export function formationReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { lineup: dedupeLineup(action.payload?.lineup || {}), holdingPlayer: null };

    case 'RESET':
      return { lineup: {}, holdingPlayer: null };

    case 'SANITIZE': {
      const { cart } = action.payload;
      const validIds = new Set((cart || []).map(p => String(p.Id)));
      const cleaned = {};
      Object.entries(state.lineup || {}).forEach(([slotIndex, playerId]) => {
        const id = String(playerId || '');
        if (id && validIds.has(id)) cleaned[slotIndex] = id;
      });
      const deduped = dedupeLineup(cleaned);
      if (JSON.stringify(deduped) === JSON.stringify(state.lineup)) return state; // unchanged: same reference
      return { ...state, lineup: deduped };
    }

    case 'CANCEL_HOLD': {
      const held = state.holdingPlayer;
      if (!held) return state;
      // A player lifted from a slot is out of the lineup while held: put him back if his slot is still free.
      if (held.from === 'slot' && state.lineup[held.fromSlotIndex] == null) {
        return { lineup: dedupeLineup({ ...state.lineup, [held.fromSlotIndex]: String(held.player.Id) }), holdingPlayer: null };
      }
      return { ...state, holdingPlayer: null };
    }

    // The starter in hand goes to the bench: his slot stays empty.
    case 'DROP_HELD':
      return state.holdingPlayer ? { ...state, holdingPlayer: null } : state;

    case 'PICK_FROM_LIST': {
      const { player } = action.payload;
      const held = state.holdingPlayer;
      // A starter in hand and a substitute picked: the substitute takes the starter's slot (a substitution).
      if (held?.from === 'slot' && state.lineup[held.fromSlotIndex] == null && String(held.player.Id) !== String(player.Id)) {
        return { lineup: dedupeLineup({ ...state.lineup, [held.fromSlotIndex]: String(player.Id) }), holdingPlayer: null };
      }
      const holdingPlayer = held?.player.Id === player.Id ? null : { player, from: 'list' };
      return { ...state, holdingPlayer };
    }

    case 'CLICK_SLOT': {
      const { index, cart } = action.payload;
      const curr = state.holdingPlayer;
      const newLineup = { ...state.lineup };
      const playerInSlotId = newLineup[index];
      const playerInSlot = cart.find(p => String(p.Id) === String(playerInSlotId));

      if (curr) {
        const placingId = String(curr.player.Id);

        // Uniqueness: take the player out of any other slot first
        Object.keys(newLineup).forEach(key => {
          if (String(newLineup[key]) === placingId && String(key) !== String(index)) {
            delete newLineup[key];
          }
        });

        newLineup[index] = placingId;

        if (curr.from === 'slot' && String(curr.fromSlotIndex) !== String(index)) {
          // Swap: the displaced player goes back to the slot the held one came from
          if (playerInSlot) newLineup[curr.fromSlotIndex] = String(playerInSlot.Id);
          else delete newLineup[curr.fromSlotIndex];
        }

        return { lineup: newLineup, holdingPlayer: null };
      }

      if (playerInSlot) {
        delete newLineup[index];
        return { lineup: newLineup, holdingPlayer: { player: playerInSlot, from: 'slot', fromSlotIndex: index } };
      }

      return state; // empty slot clicked with nothing in hand: no-op
    }

    default:
      return state;
  }
}
