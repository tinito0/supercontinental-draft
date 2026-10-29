// Tactical states (Inicio de partido / Con pelota / Sin pelota), drag-and-drop on the pitch, advanced
// instructions and their persistence/export.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { FORMATIONS, DEFAULT_TACTICS } from '../utils/constants.js';
import {
  TACTICAL_STATES, PITCH_BOUNDS, normalizeFormationStates, resetForFormation, layoutForState, moveSlot, setFluid,
  copyBaseTo, resetState, serializeFormationStates, exportVariants, clientToPitch, clampPosition, toGameCoords, effectiveState,
} from '../utils/formationStates.js';
import {
  ADVANCED_INSTRUCTIONS, normalizeAdvancedInstructions, toggleInstruction, replaceInstruction, instructionSlots,
} from '../utils/advancedInstructions.js';
import { EDIT_ADVANCED_CODES } from '../pes/formats/pes2021/editLayout.js';
import { generateFormationCsv } from '../utils/pesExport.js';
import { buildSquadSpec, toPitch } from '../pes/draftTransfer.js';
import { Pitch, PitchSlot } from '../components/Pitch.jsx';

const F433 = FORMATIONS['4-3-3'];
const fresh = () => normalizeFormationStates(null, '4-3-3', F433);
const LD = 1; // F433.layout[1] = LD (x 82, y 74)

describe('three independent tactical states', () => {
  it('maps to the game variants in order (base, with ball, without ball)', () => {
    expect(TACTICAL_STATES.map(s => [s.label, s.variant])).toEqual([['Inicio de partido', 0], ['Con pelota', 1], ['Sin pelota', 2]]);
  });

  it('keeps independent positions per state and restores them when switching back', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'base', LD, { x: 80, y: 70 }, F433);
    s = moveSlot(s, 'withBall', LD, { x: 90, y: 40 }, F433);
    s = moveSlot(s, 'withoutBall', LD, { x: 75, y: 80 }, F433);
    const at = id => layoutForState(F433, s, id)[LD];
    expect([at('base').x, at('base').y]).toEqual([80, 70]);
    expect([at('withBall').x, at('withBall').y]).toEqual([90, 40]);
    expect([at('withoutBall').x, at('withoutBall').y]).toEqual([75, 80]);
    // The role follows the zone (utils/positionRules.js): the right back pushed up to midfield plays RMF (MD) there,
    // while Inicio keeps its own role. Other slots are untouched.
    expect(at('withBall').pos).toBe('MD');
    expect(layoutForState(F433, s, 'withBall')[2]).toEqual(F433.layout[2]);
  });

  it('does not mutate the previous state object', () => {
    const s0 = setFluid(fresh(), true);
    const s1 = moveSlot(s0, 'withBall', LD, { x: 90, y: 40 }, F433);
    expect(s0.positions.withBall[LD]).toBeUndefined();
    expect(s1).not.toBe(s0);
  });

  it('fluid off: only Inicio de partido is active; edits go to it and inactive states are kept but not used', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'withBall', LD, { x: 90, y: 40 }, F433);
    s = setFluid(s, false);
    expect(effectiveState(s, 'withBall')).toBe('base');
    expect(layoutForState(F433, s, 'withBall')[LD].y).toBe(74); // shows base, not the stored with-ball spot
    s = moveSlot(s, 'withBall', LD, { x: 60, y: 60 }, F433); // an edit while off lands on base
    expect(s.positions.base[LD]).toEqual({ x: 60, y: 60 });
    expect(s.positions.withBall[LD]).toEqual({ x: 90, y: 40 }); // not destroyed
    expect(layoutForState(F433, setFluid(s, true), 'withBall')[LD]).toMatchObject({ x: 90, y: 40 });
  });

  it('turning fluid on seeds never-edited states from Inicio de partido', () => {
    let s = moveSlot(fresh(), 'base', LD, { x: 70, y: 65 }, F433);
    s = setFluid(s, true);
    expect(s.positions.withBall[LD]).toEqual({ x: 70, y: 65 });
    expect(s.positions.withoutBall[LD]).toEqual({ x: 70, y: 65 });
  });

  it('copies Inicio into a state and resets one state only', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'base', 5, { x: 30, y: 50 }, F433);
    s = moveSlot(s, 'withBall', 5, { x: 10, y: 10 }, F433);
    expect(copyBaseTo(s, 'withBall').positions.withBall[5]).toEqual({ x: 30, y: 50 });
    const r = resetState(s, 'withBall');
    expect(r.positions.withBall).toEqual({});
    expect(r.positions.base[5]).toEqual({ x: 30, y: 50 });
  });

  it('the goalkeeper keeps the formation spot (as the EDIT does)', () => {
    const s = moveSlot(fresh(), 'base', 0, { x: 10, y: 10 }, F433);
    expect(layoutForState(F433, s, 'base')[0]).toEqual(F433.layout[0]);
  });

  it('changing the formation drops the old positions but keeps the fluid switch', () => {
    const s = moveSlot(setFluid(fresh(), true), 'base', LD, { x: 60, y: 60 }, F433);
    const r = resetForFormation(s, '4-4-2');
    const empty = { base: {}, withBall: {}, withoutBall: {} };
    expect(r).toEqual({ formation: '4-4-2', fluid: true, positions: empty, roles: empty, presets: {} });
  });
});

describe('coordinates', () => {
  it('converts pointer positions to pitch percentages at any pitch size', () => {
    for (const rect of [{ left: 0, top: 0, width: 300, height: 400 }, { left: 120, top: 60, width: 750, height: 1000 }]) {
      const p = clientToPitch(rect.left + rect.width * 0.25, rect.top + rect.height * 0.5, rect);
      expect(p).toEqual({ x: 25, y: 50 });
    }
    expect(clientToPitch(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
  });

  it('keeps markers inside the field', () => {
    expect(clientToPitch(-500, 9999, { left: 0, top: 0, width: 300, height: 400 })).toEqual({ x: PITCH_BOUNDS.minX, y: PITCH_BOUNDS.maxY });
    expect(clampPosition({ x: 150, y: -20 })).toEqual({ x: PITCH_BOUNDS.maxX, y: PITCH_BOUNDS.minY });
  });

  it('converts to game coordinates with the same formula as before (pesExport / draftTransfer)', () => {
    expect(toGameCoords({ x: 50, y: 90 })).toEqual([3, 50]);
    expect(toGameCoords({ x: 82, y: 74 })).toEqual([10, 82]);
    expect(toPitch({ x: 50, y: 10 })).toEqual(toGameCoords({ x: 50, y: 10 }));
    // Every position the editor allows is a valid game position.
    for (const y of [PITCH_BOUNDS.minY, PITCH_BOUNDS.maxY]) for (const x of [PITCH_BOUNDS.minX, PITCH_BOUNDS.maxX]) {
      const [d, l] = toGameCoords({ x, y });
      expect(d).toBeGreaterThanOrEqual(3); expect(d).toBeLessThanOrEqual(48);
      expect(l).toBeGreaterThanOrEqual(8); expect(l).toBeLessThanOrEqual(92);
    }
  });
});

describe('persistence and backward compatibility', () => {
  it('round-trips through the stored JSON (switch states, save, reopen)', () => {
    let s = setFluid(fresh(), true);
    s = moveSlot(s, 'withBall', 9, { x: 15.25, y: 20 }, F433);
    const stored = JSON.parse(JSON.stringify(serializeFormationStates(s)));
    const reopened = normalizeFormationStates(stored, '4-3-3', F433);
    expect(reopened.fluid).toBe(true);
    expect(reopened.positions.withBall[9]).toEqual({ x: 15.3, y: 20 });
    expect(layoutForState(F433, reopened, 'withBall')[9]).toMatchObject({ x: 15.3, y: 20 });
  });

  it('legacy teams (no formationStates) get the plain layout and fluid off', () => {
    const s = normalizeFormationStates(undefined, '4-3-3', F433);
    expect(s.fluid).toBe(false);
    expect(exportVariants(F433, s)).toEqual([F433.layout, F433.layout, F433.layout]);
  });

  it('ignores stored data of another formation and malformed entries', () => {
    expect(normalizeFormationStates({ formation: '4-4-2', fluid: true, positions: { base: { 1: { x: 1, y: 1 } } } }, '4-3-3', F433).positions.base).toEqual({});
    const s = normalizeFormationStates({ formation: '4-3-3', positions: { base: { 0: { x: 5, y: 5 }, 1: { x: 'a', y: 3 }, 99: { x: 5, y: 5 }, 2: { x: 500, y: 50 } } } }, '4-3-3', F433);
    expect(s.positions.base).toEqual({ 2: { x: PITCH_BOUNDS.maxX, y: 50 } });
  });
});

describe('advanced instructions', () => {
  it('names exactly the codes the EDIT accepts', () => {
    expect(ADVANCED_INSTRUCTIONS.attack.map(i => i.code)).toEqual(EDIT_ADVANCED_CODES.attack);
    expect(ADVANCED_INSTRUCTIONS.defense.map(i => i.code)).toEqual(EDIT_ADVANCED_CODES.defense);
  });

  it('allows two per side, refuses a third and prevents duplicates', () => {
    let a = normalizeAdvancedInstructions(null);
    a = toggleInstruction(a, 'attack', 1).next;
    a = toggleInstruction(a, 'attack', 6).next;
    const third = toggleInstruction(a, 'attack', 2);
    expect(third.rejected).toBe('full');
    expect(third.next.attack).toEqual([1, 6]);
    expect(toggleInstruction(a, 'attack', 13).rejected).toBe('wrong-side'); // a defensive code in attack
    expect(normalizeAdvancedInstructions({ attack: [1, 1, 6, 2], defense: [5, 13] })).toEqual({ attack: [1, 6], defense: [13] });
  });

  it('deselects and replaces a chosen instruction', () => {
    const a = { attack: [1, 6], defense: [11, 13] };
    expect(toggleInstruction(a, 'attack', 1).next.attack).toEqual([6]);
    expect(replaceInstruction(a, 'attack', 0, 9).attack).toEqual([9, 6]);
    expect(replaceInstruction(a, 'defense', 1, 16).defense).toEqual([11, 16]);
    expect(replaceInstruction({ attack: [1], defense: [] }, 'attack', 1, 2).attack).toEqual([1, 2]);
  });

  it('becomes the four EDIT bytes (attack 1, attack 2, defence 1, defence 2)', () => {
    expect(instructionSlots({ attack: [1, 6], defense: [13] })).toEqual([1, 6, 13, 0]);
    expect(instructionSlots(undefined)).toEqual([0, 0, 0, 0]);
  });
});

describe('export', () => {
  const players = Array.from({ length: 14 }, (_, i) => ({ Id: 1000 + i, Name: `P${i}` }));
  const lineup = Object.fromEntries(players.slice(0, 11).map((p, i) => [i, p.Id]));
  const fluidStates = serializeFormationStates(moveSlot(setFluid(fresh(), true), 'withBall', LD, { x: 90, y: 40 }, F433));

  it('draft transfer: three EDIT variants and the instructions when fluid is on', () => {
    const team = { formation: '4-3-3', players, lineup, dorsals: {}, formationStates: fluidStates, advancedInstructions: { attack: [4], defense: [12, 13] } };
    const { spec } = buildSquadSpec(team, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS });
    expect(spec.variants).toHaveLength(3);
    expect(spec.variants[1].pos).not.toEqual(spec.variants[0].pos);
    expect(spec.variants[2].pos).toEqual(spec.variants[0].pos);
    // Each variant carries its own roles: the right back pushed up with the ball plays RMF (PES role 7) there.
    expect(spec.variants[0].roles).toEqual(spec.formation.roles);
    expect(spec.variants[2].roles).toEqual(spec.formation.roles);
    expect(spec.variants[1].roles[1]).toBe(7);
    expect(spec.variants[1].roles.filter((r, i) => r !== spec.formation.roles[i])).toHaveLength(1);
    expect(spec.advanced).toEqual([4, 0, 12, 13]);
  });

  it('draft transfer: legacy team → same spec as before (one formation, no instructions)', () => {
    const { spec } = buildSquadSpec({ formation: '4-3-3', players, lineup, dorsals: {} }, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS });
    expect(spec.variants).toBeUndefined();
    expect(spec.advanced).toEqual([0, 0, 0, 0]);
    expect(spec.formation.pos[0]).toEqual([3, 52]);
  });

  it('Formation.csv: F1/F2/F3 from the states and FluidS', () => {
    const csv = generateFormationCsv(103, '4-3-3', players.slice(0, 11), {}, players, {}, fluidStates);
    const [head, row] = csv.trim().split('\n').map(l => l.split(';'));
    const col = name => row[head.indexOf(name)];
    expect([col('LocationX2F1S1'), col('LocationY2F1S1')]).toEqual(['10', '82']);
    expect([col('LocationX2F2S1'), col('LocationY2F2S1')]).toEqual(toGameCoords({ x: 90, y: 40 }).map(String));
    expect([col('LocationX2F3S1'), col('LocationY2F3S1')]).toEqual(['10', '82']);
    expect(col('FluidS1')).toBe('1');
    expect(head.length).toBe(row.length);
    const legacy = generateFormationCsv(103, '4-3-3', players.slice(0, 11), {}, players, {});
    expect(legacy.split('\n')[1].split(';')[head.indexOf('FluidS1')]).toBe('0');
  });
});

// ---- Drag and drop on the real Pitch component (React hooks mocked; no DOM needed) ----
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
function hookRuntime() {
  const slots = [];
  let cursor = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const dispatcher = {
    useRef: v => { const i = cursor++; if (!slots[i]) slots[i] = { current: v }; return slots[i]; },
    useState: v => { const i = cursor++; if (!slots[i]) slots[i] = { value: v }; return [slots[i].value, n => { slots[i].value = typeof n === 'function' ? n(slots[i].value) : n; }]; },
    useMemo: (fn, deps) => { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useCallback: (fn, deps) => { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
  };
  return props => {
    cursor = 0;
    const prev = internals.ReactCurrentDispatcher.current;
    internals.ReactCurrentDispatcher.current = dispatcher;
    try { return Pitch.type(props); } finally { internals.ReactCurrentDispatcher.current = prev; }
  };
}

// PitchSlot rendered once with mocked hooks (useCallback, and useState at its initial value).
function PitchSlotRender(props) {
  const prev = internals.ReactCurrentDispatcher.current;
  internals.ReactCurrentDispatcher.current = { useCallback: fn => fn, useState: v => [v, () => {}] };
  try { return PitchSlot.type(props); } finally { internals.ReactCurrentDispatcher.current = prev; }
}
function findElement(node, test) {
  if (!node || typeof node !== 'object') return null;
  if (test(node)) return node;
  for (const c of [].concat(node.props?.children ?? [])) { const hit = findElement(c, test); if (hit) return hit; }
  return null;
}

describe('Pitch drag and drop', () => {
  const RECT = { left: 100, top: 50, width: 300, height: 400 };
  const setup = () => {
    const render = hookRuntime();
    const onSlotMove = vi.fn(), onSlotClick = vi.fn();
    const pitchRef = { current: null };
    const props = { formation: F433, lineup: {}, cart: [], dorsals: {}, onSlotClick, onSlotMove, pitchRef };
    const tree = () => {
      const root = render(props);
      root.ref({ getBoundingClientRect: () => RECT }); // the pitch element's box
      const slotsOf = r => r.props.children.flat().filter(c => c?.props?.index != null);
      return { root, slots: slotsOf(root) };
    };
    const ev = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, type: 'pointermove', currentTarget: { setPointerCapture: vi.fn() }, ...extra });
    return { tree, ev, onSlotMove, onSlotClick, pitchRef };
  };

  it('drags an outfield player and saves the drop position as pitch percentages', () => {
    const { tree, ev, onSlotMove } = setup();
    let { root, slots } = tree();
    expect(slots[LD].props.canMove).toBe(true);
    expect(slots[0].props.canMove).toBe(false); // goalkeeper
    slots[LD].props.onDragStart(ev(346, 346, { type: 'pointerdown' }), LD);
    root.props.onPointerMove(ev(370, 250));
    ({ root, slots } = tree());
    expect(slots[LD].props.isDragging).toBe(true);
    expect([slots[LD].props.x, slots[LD].props.y]).toEqual([90, 50]); // follows the pointer
    expect(onSlotMove).not.toHaveBeenCalled(); // nothing is committed while moving
    root.props.onPointerUp(ev(370, 250, { type: 'pointerup' }));
    expect(onSlotMove).toHaveBeenCalledWith(LD, { x: 90, y: 50 });
  });

  it('a drag does not also select the player, but a plain click still does', () => {
    const { tree, ev, onSlotClick } = setup();
    let { root, slots } = tree();
    slots[LD].props.onDragStart(ev(346, 346, { type: 'pointerdown' }), LD);
    root.props.onPointerMove(ev(300, 300));
    root.props.onPointerUp(ev(300, 300, { type: 'pointerup' }));
    ({ root, slots } = tree());
    slots[LD].props.onSlotClick(LD); // the click the browser sends after the drop
    expect(onSlotClick).not.toHaveBeenCalled();
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000);
    slots[LD].props.onSlotClick(LD);
    expect(onSlotClick).toHaveBeenCalledWith(LD);
    vi.restoreAllMocks();
  });

  it('small jitters are clicks, cancelled drags change nothing, other pointers are ignored', () => {
    const { tree, ev, onSlotMove } = setup();
    let { root, slots } = tree();
    slots[LD].props.onDragStart(ev(346, 346, { type: 'pointerdown' }), LD);
    root.props.onPointerMove(ev(348, 347));
    root.props.onPointerUp(ev(348, 347, { type: 'pointerup' }));
    expect(onSlotMove).not.toHaveBeenCalled();
    ({ root, slots } = tree());
    slots[LD].props.onDragStart(ev(346, 346, { type: 'pointerdown' }), LD);
    root.props.onPointerMove(ev(200, 100, { pointerId: 2 }));
    root.props.onPointerMove(ev(200, 100));
    root.props.onPointerCancel(ev(200, 100, { type: 'pointercancel' }));
    expect(onSlotMove).not.toHaveBeenCalled();
  });

  it('arrow keys move a marker inside the field', () => {
    const { tree, onSlotMove } = setup();
    const { slots } = tree();
    slots[LD].props.onKeyMove(LD, { x: 82 + 50, y: 74 });
    expect(onSlotMove).toHaveBeenCalledWith(LD, { x: PITCH_BOUNDS.maxX, y: 74 });
  });

  it('blocks the browser image drag that would cancel the pointer stream (found in Chrome)', () => {
    const { tree } = setup();
    const { slots } = tree();
    const cart = [{ Id: 1, Name: 'A B', POS_NOMBRE: 'LD', OVR_CALCULADO: 70 }];
    const el = PitchSlotRender({ ...slots[LD].props, lineup: { [LD]: 1 }, cartById: new Map([['1', cart[0]]]) });
    const preventDefault = vi.fn();
    el.props.onDragStart({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    const img = findElement(el, n => n.type === 'img');
    expect(img.props.draggable).toBe(false);
  });

  it('centres markers with the translate property, so the picked-up and drop-target scale classes apply', () => {
    const { tree } = setup();
    const { slots } = tree();
    const cart = [{ Id: 1, Name: 'A B', POS_NOMBRE: 'LD', OVR_CALCULADO: 70 }];
    const el = PitchSlotRender({
      ...slots[LD].props,
      lineup: { [LD]: 1 },
      cartById: new Map([['1', cart[0]]]),
      holdingPlayer: { from: 'slot', fromSlotIndex: LD },
    });
    // An inline transform used to override Tailwind's scale-90 / hover:scale-110 on the same element.
    expect(el.props.style.transform).toBeUndefined();
    expect(el.props.style.translate).toBe('-50% -50%');
    expect(el.props.className).toContain('scale-90');
  });

  it('read-only pitches cannot be dragged', () => {
    const render = hookRuntime();
    const root = render({ formation: F433, lineup: {}, cart: [], isReadOnly: true, onSlotMove: vi.fn() });
    expect(root.props.onPointerMove).toBeUndefined();
    expect(root.props.children.flat().filter(c => c?.props?.index != null).every(s => !s.props.canMove)).toBe(true);
  });
});

describe('formationSignature', () => {
  it('ignores key order, so the echo of a save is recognised as the same board', async () => {
    const { formationSignature } = await import('../utils/formationStates.js');
    const a = { formation: '4-3-3', lineup: { 0: '1', 1: '2' }, tactics: { a: 1, b: 2 } };
    const b = { tactics: { b: 2, a: 1 }, lineup: { 1: '2', 0: '1' }, formation: '4-3-3', unrelated: 'x' };
    expect(formationSignature(a)).toBe(formationSignature(b));
  });

  it('changes when another device moves a player', async () => {
    const { formationSignature } = await import('../utils/formationStates.js');
    expect(formationSignature({ lineup: { 0: '1' } })).not.toBe(formationSignature({ lineup: { 0: '2' } }));
  });
});
