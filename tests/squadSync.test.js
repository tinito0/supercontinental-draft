// Squad data follows player_locks: cart reconcile, public roster and the export squad. Synthetic data only.
import { describe, it, expect, vi } from 'vitest';
import { buildPublicRoster, isSameRoster, ownedLockEntries, reconcileCart } from '../utils/squadSync.js';

vi.mock('../config/firebase.js', () => ({ db: {} }));
const { buildDraftSquad } = await import('../services/draftTeamsService.js');

const catalog = new Map([
  ['1', { Id: 1, Name: 'Uno', POS_NOMBRE: 'DC', OVR_CALCULADO: 80, Precio: 10 }],
  ['2', { Id: 2, Name: 'Dos', POS_NOMBRE: 'PT', OVR_CALCULADO: 78, Precio: 8 }],
  ['3', { Id: 3, Name: 'Tres', POS_NOMBRE: 'MC', OVR_CALCULADO: 75, Precio: 6 }],
]);
const cartRow = id => ({ ...catalog.get(String(id)), isFranchise: false });

describe('reconcileCart', () => {
  it('adds a player bought in a transfer, with the franchise flag of the lock', () => {
    const plan = reconcileCart({ playerLocks: { 1: { lockedBy: 'me' }, 2: { lockedBy: 'me', isFranchise: true } }, cart: [cartRow(1)], uid: 'me', playerById: catalog });
    expect(plan.toAdd).toEqual([{ playerId: '2', data: { ...catalog.get('2'), isFranchise: true } }]);
    expect(plan.toRemove).toEqual([]);
  });

  it('removes a player sold to another team', () => {
    const plan = reconcileCart({ playerLocks: { 1: { lockedBy: 'other' } }, cart: [cartRow(1)], uid: 'me', playerById: catalog });
    expect(plan.toRemove).toEqual(['1']);
  });

  it('reports, but never deletes, a cart entry without any lock (old data could hold one)', () => {
    const plan = reconcileCart({ playerLocks: {}, cart: [cartRow(3)], uid: 'me', playerById: catalog });
    expect(plan.toRemove).toEqual([]);
    expect(plan.orphans).toEqual(['3']);
  });

  it('changes nothing when cart and locks agree', () => {
    const plan = reconcileCart({ playerLocks: { 1: { lockedBy: 'me' }, 2: { lockedBy: 'other' } }, cart: [cartRow(1)], uid: 'me', playerById: catalog });
    expect(plan).toEqual({ toAdd: [], toRemove: [], orphans: [], missingCatalog: [] });
  });

  it('waits for the catalog instead of writing an incomplete player', () => {
    const plan = reconcileCart({ playerLocks: { 2: { lockedBy: 'me' } }, cart: [], uid: 'me', playerById: new Map() });
    expect(plan).toEqual({ toAdd: [], toRemove: [], orphans: [], missingCatalog: ['2'] });
  });

  it('lists owned locks only', () => {
    expect(ownedLockEntries({ 1: { lockedBy: 'me' }, 2: { lockedBy: 'x' }, 3: null }, 'me')).toEqual([['1', { lockedBy: 'me' }]]);
  });
});

describe('buildPublicRoster / isSameRoster', () => {
  const profile = { dorsals: { 1: '9' }, availability: { 2: false } };

  it('builds the roster from locks with cart or catalog data, dorsals and availability', () => {
    const roster = buildPublicRoster({ playerLocks: { 1: { lockedBy: 'me' }, 2: { lockedBy: 'me' }, 3: { lockedBy: 'x' } }, cart: [cartRow(1)], uid: 'me', playerById: catalog, userProfile: profile });
    expect(roster).toEqual([
      { Id: '1', Name: 'Uno', POS_NOMBRE: 'DC', OVR_CALCULADO: 80, dorsal: '9', available: true },
      { Id: '2', Name: 'Dos', POS_NOMBRE: 'PT', OVR_CALCULADO: 78, dorsal: '', available: false },
    ]);
  });

  it('returns null rather than publishing a partial roster', () => {
    expect(buildPublicRoster({ playerLocks: { 2: { lockedBy: 'me' } }, cart: [], uid: 'me', playerById: new Map(), userProfile: {} })).toBeNull();
  });

  it('treats the same squad as unchanged, so nothing is written', () => {
    const next = buildPublicRoster({ playerLocks: { 1: { lockedBy: 'me' } }, cart: [cartRow(1)], uid: 'me', playerById: catalog, userProfile: profile });
    const storedByServer = [{ Id: 1, Name: 'Uno', POS_NOMBRE: 'DC', OVR_CALCULADO: 80, dorsal: '9' }];
    expect(isSameRoster(storedByServer, next)).toBe(true);
    expect(isSameRoster([...storedByServer].map(p => ({ ...p, dorsal: '10' })), next)).toBe(false);
    expect(isSameRoster(undefined, next)).toBe(false);
  });
});

describe('buildDraftSquad (exports)', () => {
  it('takes the squad from locks, not from cart rows the owner can write', () => {
    const cart = [cartRow(1), cartRow(3)]; // 3 has no lock: forged or stale
    const { players, squadWarnings } = buildDraftSquad([['1', { lockedBy: 't' }], ['2', { lockedBy: 't', isFranchise: true }]], cart, catalog);
    expect(players.map(p => [p.Id, p.isFranchise])).toEqual([[1, false], [2, true]]);
    expect(squadWarnings).toEqual(['Tres: está en el carrito pero no es del equipo; queda fuera.']);
  });

  it('reports a locked player missing from the catalog instead of exporting a blank one', () => {
    const { players, squadWarnings } = buildDraftSquad([['99', { lockedBy: 't' }]], [], catalog);
    expect(players).toEqual([]);
    expect(squadWarnings[0]).toMatch(/99/);
  });
});
