// Pure helpers for analysing scl_probe snapshots (pes-collector/sider/scl_probe.lua). No I/O here, so the
// matching rules can be tested; the CLI (probe-diff.mjs) reads the files.

export const WIDTHS = { u8: 1, u16: 2, u32: 4 };

export function readUnsigned(buffer, offset, width) {
  if (width === 'u8') return buffer.readUInt8(offset);
  if (width === 'u16') return buffer.readUInt16LE(offset);
  if (width === 'u32') return buffer.readUInt32LE(offset);
  throw new Error(`Unknown width: ${width}`);
}

/** Offsets (aligned to the width) whose value differs between two snapshots of the same region. */
export function diffSnapshots(before, after, width = 'u32') {
  const size = WIDTHS[width];
  const length = Math.min(before.length, after.length);
  const changes = [];
  for (let offset = 0; offset + size <= length; offset += size) {
    const from = readUnsigned(before, offset, width);
    const to = readUnsigned(after, offset, width);
    if (from !== to) changes.push({ offset, from, to });
  }
  return changes;
}

/**
 * Offsets whose value equals the expected value in every given snapshot.
 * observations: [{ buffer, expected }]. Needs at least two observations with different expected values,
 * otherwise any constant matches and the result means nothing.
 */
export function findCounter(observations, width = 'u32') {
  const distinct = new Set(observations.map(o => o.expected));
  if (observations.length < 2 || distinct.size < 2) {
    throw new Error('Need at least two observations with different expected values.');
  }
  const size = WIDTHS[width];
  const length = Math.min(...observations.map(o => o.buffer.length));
  const matches = [];
  for (let offset = 0; offset + size <= length; offset += 1) {
    if (observations.every(o => readUnsigned(o.buffer, offset, width) === o.expected)) matches.push(offset);
  }
  return matches;
}

/** Parses events.ndjson text, skipping blank lines; a malformed line throws with its line number. */
export function parseEvents(text) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      throw new Error(`events.ndjson line ${index + 1} is not valid JSON`);
    }
  });
}
