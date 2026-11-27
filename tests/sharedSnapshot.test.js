// The board's public snapshot (components/formation/sharedSnapshot.js). Synthetic players, no game files.
import { buildSharedFormation } from '../components/formation/sharedSnapshot.js';
import { FORMATIONS, DEFAULT_LOGO } from '../utils/constants.js';
import { normalizeFormationStates } from '../utils/formationStates.js';

const ALLOWED_KEYS = ['teamName', 'logoUrl', 'formationKey', 'formationName', 'formationStates', 'slots', 'bench', 'isPublic', 'createdAt', 'createdBy'];

function squad(count) {
  return Array.from({ length: count }, (_, i) => ({ Id: 100 + i, Name: `Jugador ${i}`, OVR_CALCULADO: 60 + i, POS_NOMBRE: 'MC' }));
}

describe('buildSharedFormation', () => {
  const states = normalizeFormationStates(undefined, '4-3-3', FORMATIONS['4-3-3']);
  const cart = squad(14);
  const lineup = Object.fromEntries(cart.slice(0, 11).map((p, i) => [String(i), String(p.Id)]));
  const doc = buildSharedFormation({
    formationStates: states, lineup, cart, dorsals: { 100: '1' }, availability: { 112: false },
    teamName: 'Club QA', logoUrl: '', teamId: 'uid-1', now: new Date('2026-11-27T10:00:00Z'),
  });

  test('only writes the fields firestore.rules allow for shared_formations', () => {
    expect(Object.keys(doc).sort()).toEqual([...ALLOWED_KEYS].sort());
    expect(doc.createdBy).toBe('uid-1');
    expect(doc.createdAt).toBe('2026-11-27T10:00:00.000Z');
    expect(doc.logoUrl).toBe(DEFAULT_LOGO);
    expect(doc.formationKey).toBe('4-3-3');
  });

  test('embeds the XI with roles and dorsals, and the bench sorted by OVR with availability', () => {
    expect(Object.keys(doc.slots)).toHaveLength(11);
    expect(doc.slots[0]).toMatchObject({ playerId: '100', name: 'Jugador 0', dorsal: '1' });
    expect(doc.bench.map(p => p.playerId)).toEqual(['113', '112', '111']);
    expect(doc.bench.find(p => p.playerId === '112').available).toBe(false);
  });

  test('a player missing from the squad is left out of the slots', () => {
    const partial = buildSharedFormation({ formationStates: states, lineup: { 0: '999' }, cart, teamId: 'uid-1' });
    expect(partial.slots).toEqual({});
    expect(partial.bench).toHaveLength(14);
    expect(partial.teamName).toBe('Equipo');
  });
});
