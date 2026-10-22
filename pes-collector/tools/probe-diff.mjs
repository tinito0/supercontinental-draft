#!/usr/bin/env node
// Offline analysis of an scl_probe session (read-only; never touches the game).
//
//   node pes-collector/tools/probe-diff.mjs list <sessionDir>
//   node pes-collector/tools/probe-diff.mjs diff <sessionDir> <region> <seqA> <seqB> [u8|u16|u32]
//   node pes-collector/tools/probe-diff.mjs find <sessionDir> <region> <seq>=<value> <seq>=<value> ... [u8|u16|u32]
//
// region: mgr, team0, team1, evt, sci, sci2, mis. seq: the snapshot number in events.ndjson.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIDTHS, diffSnapshots, findCounter, parseEvents } from './probeAnalysis.js';

const hex = n => `0x${n.toString(16).toUpperCase()}`;

function loadSnapshots(sessionDir) {
  const events = parseEvents(readFileSync(join(sessionDir, 'events.ndjson'), 'utf8'));
  return new Map(events.filter(e => e.t === 'snapshot').map(e => [e.seq, e]));
}

function regionBuffer(sessionDir, snapshots, seq, region) {
  const snap = snapshots.get(seq);
  if (!snap) throw new Error(`No snapshot ${seq}`);
  const entry = snap.regions?.[region];
  if (!entry) throw new Error(`Snapshot ${seq} has no region "${region}" (it was not readable then)`);
  return readFileSync(join(sessionDir, entry.file));
}

function main([command, sessionDir, ...rest]) {
  if (!command || !sessionDir) {
    console.error('Usage: probe-diff.mjs list|diff|find <sessionDir> ...');
    process.exit(2);
  }
  const snapshots = loadSnapshots(sessionDir);
  if (command === 'list') {
    for (const s of snapshots.values()) {
      console.log(`${String(s.seq).padStart(4)}  ${s.label.padEnd(8)} ${s.clock ?? '--:--'}  ${s.score ?? '-'}  [${Object.keys(s.regions).join(', ')}]`);
    }
    return;
  }
  const width = WIDTHS[rest.at(-1)] ? rest.pop() : 'u32';
  if (command === 'diff') {
    const [region, a, b] = rest;
    const changes = diffSnapshots(
      regionBuffer(sessionDir, snapshots, Number(a), region),
      regionBuffer(sessionDir, snapshots, Number(b), region),
      width,
    );
    for (const c of changes) console.log(`${hex(c.offset).padStart(8)}  ${c.from} -> ${c.to}`);
    console.log(`${changes.length} ${width} values changed`);
    return;
  }
  if (command === 'find') {
    const [region, ...pairs] = rest;
    const observations = pairs.map(pair => {
      const [seq, value] = pair.split('=').map(Number);
      return { buffer: regionBuffer(sessionDir, snapshots, seq, region), expected: value };
    });
    const matches = findCounter(observations, width);
    console.log(matches.length ? matches.map(hex).join('\n') : 'no match');
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
