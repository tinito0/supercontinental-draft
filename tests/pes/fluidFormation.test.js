// Fluid formation (3 variants) and advanced instructions written into the user's real EDIT and base tables.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadEditDatabase, validateSquadSpec } from '../../pes/formats/pes2021/editDatabase.js';
import { loadBinDatabase } from '../../pes/formats/pes2021/binDatabase.js';
import { readTeamTactics, writeTeamTactics, validateTeamTactics } from '../../pes/formats/pes2021/tacticsBin.js';
import { buildSquadSpec } from '../../pes/draftTransfer.js';
import { FORMATIONS, DEFAULT_TACTICS } from '../../utils/constants.js';
import { setFluid, moveSlot, normalizeFormationStates, serializeFormationStates } from '../../utils/formationStates.js';
import { hasEdit, readEdit, hasPesdb, readPesdb } from './fixtures.js';

const F433 = FORMATIONS['4-3-3'];
const fluidStates = () => {
  let s = setFluid(normalizeFormationStates(null, '4-3-3', F433), true);
  s = moveSlot(s, 'withBall', 1, { x: 92, y: 40 }, F433);   // LD pushes up with the ball
  s = moveSlot(s, 'withoutBall', 10, { x: 50, y: 55 }, F433); // DC drops without it
  return serializeFormationStates(s);
};

describe('squad spec validation (variants and instructions)', () => {
  const base = { players: Array.from({ length: 11 }, (_, i) => ({ playerId: i + 1, number: i + 1 })), lineup: Array.from({ length: 11 }, (_, i) => i), captain: 1, takers: Array(9).fill(255), strategy: {} };
  const formation = { roles: [0, 1, 1, 2, 3, 4, 5, 5, 9, 10, 12], pos: Array.from({ length: 11 }, () => [10, 50]) };
  it('accepts valid instruction codes per side and rejects the wrong side, unknown codes and repeats', () => {
    expect(() => validateSquadSpec({ ...base, formation, advanced: [1, 9, 11, 16] })).not.toThrow();
    expect(() => validateSquadSpec({ ...base, formation, advanced: [11, 0, 0, 0] })).toThrow(/ataque/);
    expect(() => validateSquadSpec({ ...base, formation, advanced: [0, 0, 8, 0] })).toThrow(/defensa/);
    expect(() => validateSquadSpec({ ...base, formation, advanced: [2, 2, 0, 0] })).toThrow(/repetida/);
    expect(() => validateSquadSpec({ ...base, formation, advanced: [1, 2] })).toThrow(/4 instrucciones/);
  });
  it('requires three variants, each with its own roles (as in the game data)', () => {
    expect(() => validateSquadSpec({ ...base, formation, variants: [formation, formation] })).toThrow(/3 variantes/);
    expect(() => validateSquadSpec({ ...base, formation, variants: [formation, formation, { ...formation, roles: [0, 1, 1, 2, 3, 4, 5, 5, 9, 10, 11] }] })).not.toThrow();
    expect(() => validateSquadSpec({ ...base, formation, variants: [formation, formation, { ...formation, roles: [0, 1, 1, 2, 3, 4, 5, 5, 9, 10, 13] }] })).toThrow(/puesto inválido/);
    expect(() => validateTeamTactics({ formation, variants: [formation, formation] })).toThrow(/3 variantes/);
  });
});

describe.skipIf(!hasEdit)('real EDIT: Inicio / Con pelota / Sin pelota and instructions', () => {
  let bytes;
  beforeAll(() => { bytes = readEdit(); });

  function chelseaSpec(edit, team) {
    const chelsea = edit.roster(102).map(r => r.playerId);
    const players = chelsea.map(id => ({ Id: id }));
    const lineup = Object.fromEntries(chelsea.slice(0, 11).map((id, i) => [i, id]));
    return buildSquadSpec({ formation: '4-3-3', players, lineup, dorsals: {}, ...team }, { formations: FORMATIONS, defaultTactics: DEFAULT_TACTICS }).spec;
  }

  it('writes three different variants and the four instruction bytes in every plan', () => {
    const edit = loadEditDatabase(bytes);
    const spec = chelseaSpec(edit, { formationStates: fluidStates(), advancedInstructions: { attack: [5, 1], defense: [13] } });
    edit.setSquad(102, spec);
    const t = edit.readTactics(102);
    expect(t.variants[0]).toEqual(spec.formation);
    expect(t.variants[1].pos).not.toEqual(t.variants[0].pos);
    expect(t.variants[2].pos).not.toEqual(t.variants[0].pos);
    // The right back pushed up with the ball plays RMF (role 7) in that variant; the other roles stay.
    expect(t.variants[1].roles[1]).toBe(7);
    expect(t.variants[1].roles.filter((r, i) => r !== t.variants[0].roles[i])).toHaveLength(1);
    expect(t.advanced).toEqual([5, 1, 13, 0]);
  });

  it('with fluid off the three variants are the starting formation and no instruction is set', () => {
    const edit = loadEditDatabase(bytes);
    const spec = chelseaSpec(edit, { formationStates: { ...fluidStates(), fluid: false } });
    edit.setSquad(102, spec);
    const t = edit.readTactics(102);
    expect(t.variants[1]).toEqual(t.variants[0]);
    expect(t.variants[2]).toEqual(t.variants[0]);
    expect(t.advanced).toEqual([0, 0, 0, 0]);
  });
});

describe.skipIf(!hasPesdb)('real base tables: TacticsFormation.bin F1..F3', () => {
  it('writes each variant into its own formation rows', () => {
    const bin = loadBinDatabase(readPesdb(['Team.bin', 'Tactics.bin', 'TacticsFormation.bin']));
    expect(bin.tables.tactics && bin.tables.tacticsFormation).toBeTruthy();
    const teamId = bin.tables.tactics.get(bin.tables.tactics.ids()[0], 'teamId');
    const before = readTeamTactics(bin.tables, teamId)[0];
    const formation = { roles: before.formations[0].map(r => r.role), pos: before.formations[0].map(r => [r.depth, r.lateral]) };
    const moved = { ...formation, pos: formation.pos.map(([d, l], i) => (i === 3 ? [d + 5, l] : [d, l])) };
    writeTeamTactics(bin.tables, teamId, { formation, variants: [formation, moved, formation] });
    const after = readTeamTactics(bin.tables, teamId);
    for (const preset of after) {
      expect(preset.formations[1][3].depth).toBe(formation.pos[3][0] + 5);
      expect(preset.formations[0][3].depth).toBe(formation.pos[3][0]);
      expect(preset.formations[2][3].depth).toBe(formation.pos[3][0]);
    }
  });
});
