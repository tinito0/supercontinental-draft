// Celebrations stored as 0 or 1 belong to the owner's celebration mod and are never changed.
// SYNTHETIC: the rule itself. REAL (npm run test:real): the EDIT refuses to change such a celebration.
import { isModCelebration } from '../../pes/formats/pes2021/editLayout.js';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { hasEdit, readEdit } from './fixtures.js';

describe('mod celebrations', () => {
  it('flags only gc1/gc2 at 0 or 1', () => {
    expect([0, 1, 2, 249].map(v => isModCelebration('gc1', v))).toEqual([true, true, false, false]);
    expect(isModCelebration('gc2', 0)).toBe(true);
    expect(isModCelebration('mo_pk', 1)).toBe(false);
  });

  it.skipIf(!hasEdit)('the EDIT refuses to change one', () => {
    const edit = loadEditDatabase(readEdit());
    const id = [...edit.players.keys()].find(pid => isModCelebration('gc1', edit.readPlayer(pid).gc1) || isModCelebration('gc2', edit.readPlayer(pid).gc2));
    if (id == null) return;
    const field = isModCelebration('gc1', edit.readPlayer(id).gc1) ? 'gc1' : 'gc2';
    expect(() => edit.setPlayerField(id, field, 200)).toThrow(/mod de festejos/);
  });
});
