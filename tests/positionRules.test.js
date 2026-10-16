// Position eligibility by pitch zone (utils/positionRules.js) and how the tactical states use it
// (utils/formationStates.js): role changes, auto-reassignment when moving, formation presets per state.
// Synthetic data only: the zone table itself comes from the game's EDIT (see the header of positionRules.js).
import { describe, it, expect } from 'vitest';
import { FORMATIONS } from '../utils/constants.js';
import { zoneAt, rolesAt, isRoleAllowedAt, resolveRole, roleUnavailableReason, OUTFIELD_ROLES, ZONE_ROLES } from '../utils/positionRules.js';
import {
  normalizeFormationStates, layoutForState, moveSlot, setFluid, setSlotRole, applyFormationToState, formationKeyForState,
  serializeFormationStates, copyBaseTo, resetState, exportVariants, toGameCoords, isGoalkeeperSlot,
} from '../utils/formationStates.js';

const F433 = FORMATIONS['4-3-3'];
const fresh = (key = '4-3-3') => normalizeFormationStates(null, key, FORMATIONS[key]);
const LD = 1, MCD = 5, MC = 6, DC = 9; // 4-3-3 slots

// A pitch y for a game depth (inverse of toGameCoords' depth, centre of the unit).
const yForDepth = d => 90 - (d - 3) / 0.46;

describe('zones (game depth bands and sides)', () => {
  it('splits the pitch at the band edges of the game data', () => {
    const line = d => zoneAt({ x: 50, y: yForDepth(d) }).line;
    expect([15, 16, 25, 26, 34, 35, 39, 40].map(line)).toEqual(['defense', 'midLow', 'midLow', 'midHigh', 'midHigh', 'attackLow', 'attackLow', 'attackHigh']);
  });

  it('treats a slot as wide 32 units from the centre, the same on both sides', () => {
    expect(zoneAt({ x: 18, y: 74 }).side).toBe('left');
    expect(zoneAt({ x: 19, y: 74 }).side).toBe('center');
    expect(zoneAt({ x: 81, y: 74 }).side).toBe('center');
    expect(zoneAt({ x: 82, y: 74 }).side).toBe('right');
  });

  it('allows the overlaps the game uses and nothing else', () => {
    expect(rolesAt({ x: 50, y: yForDepth(20) })).toEqual(['MCD', 'MC']);
    expect(rolesAt({ x: 50, y: yForDepth(30) })).toEqual(['MO', 'MC']);
    expect(rolesAt({ x: 50, y: yForDepth(43) })).toEqual(['DC', 'SD']);
    expect(rolesAt({ x: 50, y: yForDepth(37) })).toEqual(['SD']);
    expect(rolesAt({ x: 12, y: yForDepth(30) })).toEqual(['MI', 'MC']);
    expect(rolesAt({ x: 88, y: yForDepth(12) })).toEqual(['LD', 'DFC']);
    // No AMF low in midfield, no DMF high, no CF short of the box, no full back in midfield.
    expect(isRoleAllowedAt('MO', { x: 50, y: yForDepth(20) })).toBe(false);
    expect(isRoleAllowedAt('MCD', { x: 50, y: yForDepth(30) })).toBe(false);
    expect(isRoleAllowedAt('DC', { x: 50, y: yForDepth(37) })).toBe(false);
    expect(isRoleAllowedAt('LD', { x: 88, y: yForDepth(20) })).toBe(false);
  });

  it('covers every outfield role somewhere and only known roles', () => {
    const used = new Set(Object.values(ZONE_ROLES).flatMap(sides => Object.values(sides).flat()));
    expect([...used].sort()).toEqual(OUTFIELD_ROLES.map(r => r.id).sort());
  });

  it('puts every slot of every formation inside a zone that allows its role', () => {
    for (const [key, f] of Object.entries(FORMATIONS)) {
      for (const slot of f.layout) {
        if (isGoalkeeperSlot(slot)) continue;
        expect(isRoleAllowedAt(slot.pos, slot), `${key} ${slot.pos} (${slot.x}, ${slot.y})`).toBe(true);
      }
    }
  });
});

describe('resolveRole (moving a slot to another zone)', () => {
  it('keeps the role when the new zone allows it', () => {
    expect(resolveRole('MC', { x: 50, y: yForDepth(20) })).toBe('MC');
    expect(resolveRole('MC', { x: 50, y: yForDepth(30) })).toBe('MC');
  });

  it('moves to the closest allowed role', () => {
    expect(resolveRole('MO', { x: 50, y: yForDepth(20) })).toBe('MC'); // an AMF dragged back is a CMF, not a DMF
    expect(resolveRole('MCD', { x: 50, y: yForDepth(30) })).toBe('MC');
    expect(resolveRole('LD', { x: 88, y: yForDepth(30) })).toBe('MD');
    expect(resolveRole('DC', { x: 50, y: yForDepth(37) })).toBe('SD');
    expect(resolveRole('LI', { x: 50, y: yForDepth(12) })).toBe('DFC');
    expect(resolveRole('DFC', { x: 50, y: yForDepth(43) })).toBe('DC'); // nothing close: the zone default
  });

  it('leaves the goalkeeper and unknown codes alone', () => {
    expect(resolveRole('PT', { x: 50, y: 50 })).toBe('PT');
  });

  it('explains why a role is not available', () => {
    expect(roleUnavailableReason('MC', { x: 50, y: yForDepth(20) })).toBeNull();
    expect(roleUnavailableReason('MO', { x: 50, y: yForDepth(20) })).toBe('MO no está disponible en Mediocampo defensivo · Centro: acá van MCD o MC.');
    expect(roleUnavailableReason('DC', { x: 50, y: yForDepth(37) })).toBe('DC no está disponible en Ataque · Centro: acá va SD.');
  });
});

describe('roles in the tactical states', () => {
  it('a legacy team plays exactly its formation (same layout, same roles)', () => {
    expect(exportVariants(F433, fresh())).toEqual([F433.layout, F433.layout, F433.layout]);
  });

  it('changes a role where the zone allows it, and keeps the coordinates', () => {
    const s = setSlotRole(fresh(), 'base', MC, 'MCD', F433);
    expect(layoutForState(F433, s, 'base')[MC]).toMatchObject({ pos: 'MCD', x: F433.layout[MC].x, y: F433.layout[MC].y });
  });

  it('refuses a role the zone does not allow (returns the same object)', () => {
    const s0 = fresh();
    expect(setSlotRole(s0, 'base', MCD, 'MO', F433)).toBe(s0); // the DMF stands too deep for an AMF
    expect(setSlotRole(s0, 'base', 0, 'DFC', F433)).toBe(s0); // the goalkeeper keeps PT
    expect(setSlotRole(s0, 'base', MC, 'XX', F433)).toBe(s0);
  });

  it('reassigns the role when a move leaves the zone, and gives back the chosen one when it returns', () => {
    let s = setSlotRole(fresh(), 'base', MC, 'MO', F433); // MC at y 42 (depth 25) cannot be MO...
    expect(layoutForState(F433, s, 'base')[MC].pos).toBe('MC');
    s = moveSlot(fresh(), 'base', MC, { x: 68, y: yForDepth(30) }, F433);
    s = setSlotRole(s, 'base', MC, 'MO', F433); // ...higher up it can
    expect(layoutForState(F433, s, 'base')[MC].pos).toBe('MO');
    s = moveSlot(s, 'base', MC, { x: 68, y: yForDepth(20) }, F433);
    expect(layoutForState(F433, s, 'base')[MC].pos).toBe('MC'); // dragged back: closest allowed role
    s = moveSlot(s, 'base', MC, { x: 68, y: yForDepth(31) }, F433);
    expect(layoutForState(F433, s, 'base')[MC].pos).toBe('MO'); // the user's choice comes back
  });

  it('keeps roles per state: a change in Con pelota leaves Inicio and Sin pelota alone', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'withBall', MC, { x: 68, y: yForDepth(30) }, F433);
    s = setSlotRole(s, 'withBall', MC, 'MO', F433);
    expect(layoutForState(F433, s, 'withBall')[MC].pos).toBe('MO');
    expect(layoutForState(F433, s, 'base')[MC].pos).toBe('MC');
    expect(layoutForState(F433, s, 'withoutBall')[MC].pos).toBe('MC');
  });

  it('with fluid off a role change goes to Inicio, like a move', () => {
    const s = setSlotRole(fresh(), 'withBall', MC, 'MCD', F433);
    expect(s.roles.base[MC]).toBe('MCD');
    expect(s.roles.withBall[MC]).toBeUndefined();
  });

  it('copying Inicio and resetting a state carry the roles too', () => {
    let s = setFluid(fresh(), true);
    s = setSlotRole(s, 'base', MC, 'MCD', F433);
    s = setSlotRole(s, 'withBall', MC, 'MC', F433);
    expect(layoutForState(F433, copyBaseTo(s, 'withBall'), 'withBall')[MC].pos).toBe('MCD');
    expect(resetState(s, 'withBall').roles.withBall).toEqual({});
  });

  it('is saved and read back', () => {
    let s = setFluid(fresh(), true);
    s = setSlotRole(s, 'withoutBall', MC, 'MCD', F433);
    const back = normalizeFormationStates(JSON.parse(JSON.stringify(serializeFormationStates(s))), '4-3-3', F433);
    expect(layoutForState(F433, back, 'withoutBall')[MC].pos).toBe('MCD');
  });

  it('drops unknown roles, the goalkeeper slot and roles of another formation when reading', () => {
    const raw = { formation: '4-3-3', positions: {}, roles: { base: { 0: 'DFC', [MC]: 'XX', [MCD]: 'MC' } } };
    expect(normalizeFormationStates(raw, '4-3-3', F433).roles.base).toEqual({ [MCD]: 'MC' });
    expect(normalizeFormationStates({ ...raw, formation: '4-4-2' }, '4-3-3', F433).roles.base).toEqual({});
  });

  it('a stored role that is not allowed where the slot stands is played as the closest allowed one', () => {
    const raw = { formation: '4-3-3', positions: { base: { [MCD]: { x: 50, y: 57 } } }, roles: { base: { [MCD]: 'MO' } } };
    expect(layoutForState(F433, normalizeFormationStates(raw, '4-3-3', F433), 'base')[MCD].pos).toBe('MC');
  });
});

describe('choosing a formation from the left panel (applyFormationToState)', () => {
  it('fluid off: the team formation changes and the states start from the new shape', () => {
    const s = applyFormationToState(moveSlot(fresh(), 'base', LD, { x: 80, y: 60 }, F433), 'base', '4-4-2', FORMATIONS);
    expect(s.formation).toBe('4-4-2');
    expect(s.positions.base).toEqual({});
  });

  it('fluid on, editing Con pelota: only that state takes the preset; Inicio and Sin pelota do not change', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'withoutBall', DC, { x: 50, y: 50 }, F433);
    const before = { base: layoutForState(F433, s, 'base'), withoutBall: layoutForState(F433, s, 'withoutBall') };
    const r = applyFormationToState(s, 'withBall', '3-4-3', FORMATIONS);
    expect(r.formation).toBe('4-3-3');
    expect(layoutForState(F433, r, 'base')).toEqual(before.base);
    expect(layoutForState(F433, r, 'withoutBall')).toEqual(before.withoutBall);
    const withBall = layoutForState(F433, r, 'withBall');
    FORMATIONS['3-4-3'].layout.forEach((slot, i) => {
      if (isGoalkeeperSlot(slot)) return;
      expect(withBall[i]).toMatchObject({ x: slot.x, y: slot.y, pos: slot.pos });
    });
    expect(formationKeyForState(r, 'withBall')).toBe('3-4-3');
    expect(formationKeyForState(r, 'base')).toBe('4-3-3');
  });

  it('fluid on, editing Inicio: the formation changes but Con pelota and Sin pelota keep exactly what they had', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'withBall', LD, { x: 88, y: 40 }, F433);
    s = setSlotRole(s, 'withoutBall', MC, 'MCD', F433);
    const before = ['withBall', 'withoutBall'].map(id => layoutForState(F433, s, id));
    const r = applyFormationToState(s, 'base', '4-4-2', FORMATIONS);
    const F442 = FORMATIONS['4-4-2'];
    expect(r.formation).toBe('4-4-2');
    expect(layoutForState(F442, r, 'base')).toEqual(F442.layout);
    ['withBall', 'withoutBall'].forEach((id, k) => {
      layoutForState(F442, r, id).forEach((slot, i) => {
        if (isGoalkeeperSlot(slot)) return;
        expect(slot).toMatchObject({ x: before[k][i].x, y: before[k][i].y, pos: before[k][i].pos });
      });
    });
    expect(formationKeyForState(r, 'withBall')).toBe('4-3-3');
  });

  it('choosing the current formation for Inicio changes nothing', () => {
    const s = moveSlot(fresh(), 'base', LD, { x: 80, y: 60 }, F433);
    expect(applyFormationToState(s, 'base', '4-3-3', FORMATIONS)).toBe(s);
  });

  it('ignores an unknown formation', () => {
    const s = fresh();
    expect(applyFormationToState(s, 'base', 'nope', FORMATIONS)).toBe(s);
  });

  it('exports the per-state roles of a preset applied to Con pelota', () => {
    const s = applyFormationToState(setFluid(fresh(), true), 'withBall', '3-4-3', FORMATIONS);
    const [, withBall] = exportVariants(F433, s);
    expect(withBall[LD].pos).toBe(FORMATIONS['3-4-3'].layout[LD].pos);
    expect(toGameCoords(withBall[LD])).toEqual(toGameCoords(FORMATIONS['3-4-3'].layout[LD]));
  });
});
