// Client side of the youth draft (utils/youthDraft.js): pool overlay on the catalog, candidate checks, turns.
// Synthetic players only; the rating itself is checked against real data in tests/pes/rating.test.js.
import { describe, it, expect } from 'vitest';
import {
  applyYouthDraft, candidateCheck, editedRating, isEditedOvrInRange, isPoolLocked, nextTeamToPick,
  originalOvrOf, poolEntryFromSheet, publishCheck, unpickedPoolIds,
} from '../utils/youthDraft.js';
import { RATING_FIELDS } from '../pes/rating.js';

const sheet = (overrides = {}) => {
  const values = Object.fromEntries(RATING_FIELDS.map(field => [field, 80]));
  return { ...values, weakFootAcc: 3, registeredPosition: 12, name: 'Promesa', age: 19, ...overrides };
};
const getter = values => field => values[field];

describe('candidateCheck', () => {
  it('accepts a 17–21 year old rated 50 or more in the original game', () => {
    expect(candidateCheck({ Age: 19, OVR_CALCULADO: 56 })).toEqual({ eligible: true, reason: '' });
  });

  it('judges a published prospect by its original rating, not the edited one', () => {
    expect(candidateCheck({ Age: 19, OVR_CALCULADO: 85, OVR_ORIGINAL: 56 }).eligible).toBe(true);
    expect(candidateCheck({ Age: 19, OVR_CALCULADO: 85, OVR_ORIGINAL: 45 }).eligible).toBe(false);
  });

  it('says why a player is refused', () => {
    expect(candidateCheck({ Age: 25, OVR_CALCULADO: 55 }).reason).toMatch(/25 años/);
    expect(candidateCheck(undefined).reason).toMatch(/No está en el mercado/);
  });
});

describe('editedRating and poolEntryFromSheet', () => {
  it('rates the working-copy sheet, and gives null when a field is missing', () => {
    const rating = editedRating(getter(sheet()));
    expect(Number.isInteger(rating)).toBe(true);
    expect(editedRating(getter(sheet({ speed: undefined })))).toBeNull();
  });

  it('publishes catalog column names, the edited OVR and the original one', () => {
    const entry = poolEntryFromSheet({ id: '7000', get: getter(sheet()), appPlayer: { OVR_CALCULADO: 56, Age: 19 }, position: 'DC' });
    expect(entry).toMatchObject({ id: 7000, name: 'Promesa', age: 19, position: 'DC', originalOvr: 56 });
    expect(entry.ovr).toBe(editedRating(getter(sheet())));
    expect(entry.stats).toMatchObject({ BallControl: 80, GKReach: 80, WeakFootAcc: 3 });
    expect(entry.stats).not.toHaveProperty('RegisteredPosition');
  });

  it('marks 84 to 99 as in range', () => {
    expect([83, 84, 86, 87, 99].map(isEditedOvrInRange)).toEqual([false, true, true, true, true]);
  });
});

describe('applyYouthDraft', () => {
  const players = [
    { Id: 7000, Name: 'Promesa', OVR_CALCULADO: 56, Speed: 60, Acceleration: 60, BallControl: 55 },
    { Id: 9000, Name: 'Otro', OVR_CALCULADO: 80 },
  ];
  const draft = { pool: [{ id: 7000, ovr: 85, stats: { Speed: 90, Acceleration: 80 } }] };

  it('lays the edited sheet over pool players and keeps the original OVR', () => {
    const [prospect, other] = applyYouthDraft(players, draft);
    expect(prospect).toMatchObject({ OVR_CALCULADO: 85, OVR_ORIGINAL: 56, Speed: 90, STAT_SPD: 85, BallControl: 55, isYouthProspect: true });
    expect(other).toBe(players[1]);
    expect(players[0].OVR_CALCULADO).toBe(56);
    expect(originalOvrOf(prospect)).toBe(56);
  });

  it('returns the same list without a pool', () => {
    expect(applyYouthDraft(players, null)).toBe(players);
    expect(applyYouthDraft(players, { pool: [] })).toBe(players);
  });
});

describe('turns and publishing', () => {
  const draft = { pool: [{ id: 1 }, { id: 2 }, { id: 3 }], order: ['a', 'b', 'c'], picks: { a: 2 } };

  it('lists the prospects still free and the next club to pick', () => {
    expect(unpickedPoolIds(draft)).toEqual(new Set(['1', '3']));
    expect(nextTeamToPick(draft)).toBe('b');
    expect(nextTeamToPick({ ...draft, picks: { a: 1, b: 2, c: 3 } })).toBeNull();
  });

  it('locks the pool after the first pick', () => {
    expect(isPoolLocked(draft)).toBe(true);
    expect(isPoolLocked({ pool: [] })).toBe(false);
  });

  it('publishes between one prospect per club and 40', () => {
    expect(publishCheck({ validCount: 11, teamCount: 12 }).ok).toBe(false);
    expect(publishCheck({ validCount: 22, teamCount: 12 }).ok).toBe(true);
    expect(publishCheck({ validCount: 41, teamCount: 12 }).reason).toMatch(/máximo es 40/);
  });
});
