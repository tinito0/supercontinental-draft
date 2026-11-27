// Pure logic behind the board's save status and copy (components/formation/boardSaveState.js). No fixtures.
import {
  SAVE_STATUS, isBoardDirty, lineupSaveErrorMessage, isBenchBlock, droppedStartersMessage, stateEditCount,
} from '../components/formation/boardSaveState.js';

describe('isBoardDirty', () => {
  test('pending, saving, error and blocked hold edits the server does not have', () => {
    expect(isBoardDirty(SAVE_STATUS.pending)).toBe(true);
    expect(isBoardDirty(SAVE_STATUS.saving)).toBe(true);
    expect(isBoardDirty(SAVE_STATUS.error)).toBe(true);
    expect(isBoardDirty(SAVE_STATUS.blocked)).toBe(true);
  });
  test('idle and saved are clean', () => {
    expect(isBoardDirty(SAVE_STATUS.idle)).toBe(false);
    expect(isBoardDirty(SAVE_STATUS.saved)).toBe(false);
    expect(isBoardDirty(undefined)).toBe(false);
  });
});

describe('lineupSaveErrorMessage', () => {
  const err = (code, message = 'server text') => Object.assign(new Error(message), { code });

  test('keeps the function message for the bench rule and an outdated function', () => {
    expect(lineupSaveErrorMessage(err('bench-below-minimum', 'Tu banco promedia 70.'))).toBe('Tu banco promedia 70.');
    expect(lineupSaveErrorMessage(err('function-outdated', 'Actualizá la función.'))).toBe('Actualizá la función.');
  });
  test('uses voseo copy for each known code', () => {
    expect(lineupSaveErrorMessage(err('unauthenticated', 'Debes iniciar sesión.'))).toBe('Tu sesión venció. Volvé a iniciar sesión para guardar.');
    for (const code of ['lineup-invalid', 'forbidden', 'team-not-found', 'not-configured', 'unavailable']) {
      const text = lineupSaveErrorMessage(err(code));
      expect(text).not.toBe('server text');
      expect(text.length).toBeGreaterThan(10);
    }
  });
  test('a rejection with a reason keeps it; anything else reads as unavailable', () => {
    expect(lineupSaveErrorMessage(err('rejected', 'Mercado cerrado.'))).toBe('Mercado cerrado.');
    expect(lineupSaveErrorMessage(new TypeError('fetch failed'))).toBe(lineupSaveErrorMessage(err('unavailable')));
    expect(lineupSaveErrorMessage(null)).toBe(lineupSaveErrorMessage(err('unavailable')));
  });
  test('isBenchBlock only matches the bench rule', () => {
    expect(isBenchBlock(err('bench-below-minimum'))).toBe(true);
    expect(isBenchBlock(err('unavailable'))).toBe(false);
  });
});

describe('droppedStartersMessage', () => {
  const cart = [{ Id: 1, Name: 'Messi' }, { Id: 2, Name: 'Di María' }, { Id: 3, Name: 'Paredes' }];
  test('null when the server kept every starter', () => {
    expect(droppedStartersMessage([], cart)).toBeNull();
    expect(droppedStartersMessage(undefined, cart)).toBeNull();
  });
  test('names one or several dropped starters', () => {
    expect(droppedStartersMessage(['1'], cart)).toBe('Sacamos del once a Messi: ya no es de tu club.');
    expect(droppedStartersMessage(['1', '2', '3'], cart)).toBe('Sacamos del once a Messi, Di María y Paredes: ya no son de tu club.');
  });
  test('falls back to the id for a player no longer in the cart', () => {
    expect(droppedStartersMessage(['99'], cart)).toBe('Sacamos del once a #99: ya no es de tu club.');
  });
});

describe('stateEditCount', () => {
  test('counts moved markers and changed roles of one state', () => {
    const states = { positions: { base: { 0: {}, 3: {} }, withBall: {} }, roles: { base: { 5: 'MCD' } } };
    expect(stateEditCount(states, 'base')).toBe(3);
    expect(stateEditCount(states, 'withBall')).toBe(0);
    expect(stateEditCount(states, 'withoutBall')).toBe(0);
    expect(stateEditCount(undefined, 'base')).toBe(0);
  });
});
