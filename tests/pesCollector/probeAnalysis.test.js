// Synthetic buffers only: these prove the matching rules, not anything about the game's memory.
import { diffSnapshots, findCounter, parseEvents } from '../../pes-collector/tools/probeAnalysis.js';

function buffer(bytes) {
  return Buffer.from(bytes);
}

describe('diffSnapshots', () => {
  it('reports only the aligned u32 values that changed', () => {
    const before = buffer([1, 0, 0, 0, 7, 0, 0, 0]);
    const after = buffer([1, 0, 0, 0, 9, 0, 0, 0]);
    expect(diffSnapshots(before, after)).toEqual([{ offset: 4, from: 7, to: 9 }]);
  });

  it('compares only the common length', () => {
    expect(diffSnapshots(buffer([1, 2]), buffer([1, 3, 4]), 'u8')).toEqual([{ offset: 1, from: 2, to: 3 }]);
  });
});

describe('findCounter', () => {
  it('finds the offset that holds the expected value in every snapshot', () => {
    const observations = [
      { buffer: buffer([5, 2, 0, 9]), expected: 2 },
      { buffer: buffer([5, 3, 0, 9]), expected: 3 },
      { buffer: buffer([5, 5, 0, 9]), expected: 5 },
    ];
    expect(findCounter(observations, 'u8')).toEqual([1]);
  });

  it('refuses observations that cannot tell a counter from a constant', () => {
    const same = [{ buffer: buffer([2]), expected: 2 }, { buffer: buffer([2]), expected: 2 }];
    expect(() => findCounter(same, 'u8')).toThrow(/different expected values/);
  });
});

describe('parseEvents', () => {
  it('skips blank lines and reports the line of malformed JSON', () => {
    expect(parseEvents('{"t":"a"}\n\n{"t":"b"}\n')).toEqual([{ t: 'a' }, { t: 'b' }]);
    expect(() => parseEvents('{"t":"a"}\nnot json')).toThrow(/line 2/);
  });
});
