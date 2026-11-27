import { describe, it, expect } from 'vitest';
import { withDirtyFlag, hasUnsavedChanges, mustConfirmLeave, isTeamFormDirty } from '../utils/unsavedGuard.js';

describe('unsaved guard flags', () => {
  it('lists only dirty editors and does not mutate the previous map', () => {
    const a = withDirtyFlag({}, 'obs', true);
    const b = withDirtyFlag(a, 'web', true);
    expect(hasUnsavedChanges(b)).toBe(true);
    expect(a).toEqual({ obs: true });
    expect(withDirtyFlag(withDirtyFlag(b, 'obs', false), 'web', false)).toEqual({});
  });

  it('asks before leaving only when something is dirty and the move is real', () => {
    expect(mustConfirmLeave({}, 'general', 'web')).toBe(false);
    expect(mustConfirmLeave({ x: true }, 'general', 'web')).toBe(true);
    expect(mustConfirmLeave({ x: true }, 'web', 'web')).toBe(false);
    expect(mustConfirmLeave({ x: true })).toBe(true); // closing
  });
});

describe('isTeamFormDirty', () => {
  const team = { teamName: 'Boca', budget: 100, logoUrl: 'a.png', country: 10, manualStats: { w: 1 } };
  const form = { teamName: 'Boca', budget: '100', logoUrl: 'a.png', country: 10, manualStats: { w: 1 } };
  it('is clean when the form matches the team', () => expect(isTeamFormDirty(team, form)).toBe(false));
  it('is dirty after any field changes', () => {
    expect(isTeamFormDirty(team, { ...form, budget: '120' })).toBe(true);
    expect(isTeamFormDirty(team, { ...form, manualStats: { w: 2 } })).toBe(true);
  });
  it('treats a missing country as the default 204', () => {
    expect(isTeamFormDirty({ ...team, country: undefined }, { ...form, country: 204 })).toBe(false);
  });
});
