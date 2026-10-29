import { describe, it, expect } from 'vitest';
import { formationReducer, initialFormationState } from '../utils/lineupReducer.js';

// Synthetic squad: ids only matter for placement, no game data involved.
const cart = [{ Id: 1, Name: 'Uno' }, { Id: 2, Name: 'Dos' }, { Id: 3, Name: 'Tres' }];
const withLineup = lineup => formationReducer(initialFormationState, { type: 'LOAD', payload: { lineup } });

describe('formationReducer', () => {
  it('LOAD keeps the first slot of a player saved twice', () => {
    expect(withLineup({ 0: '1', 4: '1', 2: '2' }).lineup).toEqual({ 0: '1', 2: '2' });
  });

  it('picking up a starter empties his slot and holds him', () => {
    const state = formationReducer(withLineup({ 0: '1' }), { type: 'CLICK_SLOT', payload: { index: 0, cart } });

    expect(state.lineup).toEqual({});
    expect(state.holdingPlayer).toMatchObject({ from: 'slot', fromSlotIndex: 0 });
  });

  it('with a starter in hand, picking a substitute puts the substitute in that slot', () => {
    const holding = formationReducer(withLineup({ 0: '1' }), { type: 'CLICK_SLOT', payload: { index: 0, cart } });

    const state = formationReducer(holding, { type: 'PICK_FROM_LIST', payload: { player: cart[2] } });

    expect(state.lineup).toEqual({ 0: '3' });
    expect(state.holdingPlayer).toBeNull();
  });

  it('with a substitute in hand, picking another substitute switches the hand', () => {
    const holding = formationReducer(withLineup({}), { type: 'PICK_FROM_LIST', payload: { player: cart[1] } });

    const state = formationReducer(holding, { type: 'PICK_FROM_LIST', payload: { player: cart[2] } });

    expect(state.holdingPlayer).toMatchObject({ from: 'list', player: { Id: 3 } });
  });

  it('DROP_HELD sends the starter in hand to the bench and leaves his slot empty', () => {
    const holding = formationReducer(withLineup({ 0: '1', 1: '2' }), { type: 'CLICK_SLOT', payload: { index: 0, cart } });

    const state = formationReducer(holding, { type: 'DROP_HELD' });

    expect(state.lineup).toEqual({ 1: '2' });
    expect(state.holdingPlayer).toBeNull();
  });

  it('CANCEL_HOLD puts a lifted starter back in his free slot', () => {
    const holding = formationReducer(withLineup({ 0: '1' }), { type: 'CLICK_SLOT', payload: { index: 0, cart } });

    expect(formationReducer(holding, { type: 'CANCEL_HOLD' }).lineup).toEqual({ 0: '1' });
  });

  it('placing a starter on another starter swaps them', () => {
    const holding = formationReducer(withLineup({ 0: '1', 1: '2' }), { type: 'CLICK_SLOT', payload: { index: 0, cart } });

    const state = formationReducer(holding, { type: 'CLICK_SLOT', payload: { index: 1, cart } });

    expect(state.lineup).toEqual({ 0: '2', 1: '1' });
  });
});
