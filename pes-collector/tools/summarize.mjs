#!/usr/bin/env node
// Match summaries from a scl_probe session folder.
//
//   node pes-collector/tools/summarize.mjs "E:/eFootball PES 2021/scl_probe/<session>" [--json]
//
// Without --json it prints a readable report with player names from public/jugadores.json (ids = Player.bin).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEventLines, splitMatches, summarizeMatch } from '../collector/matchSummary.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadNames() {
  try {
    const players = JSON.parse(readFileSync(join(ROOT, 'public', 'jugadores.json'), 'utf8'));
    return new Map((Array.isArray(players) ? players : Object.values(players)).map(p => [Number(p.Id), p.Name]));
  } catch {
    return new Map();
  }
}

function minute(clock) {
  return clock ? `${clock.minute}'` : "?'";
}

function report(summary, names) {
  const name = id => (id == null ? '?' : names.get(id) || `#${id}`);
  const lines = [];
  const { match, score, shootout } = summary;
  lines.push(`Equipos ${match.homeTeamId} vs ${match.awayTeamId}: ${score.home}-${score.away}`
    + `${shootout ? ` (penales ${shootout.home}-${shootout.away})` : ''}  [${summary.status}]`);
  for (const g of summary.goals) {
    const tags = [g.ownGoal && 'en contra', g.penalty && 'penal', g.freeKick && 'tiro libre'].filter(Boolean);
    const assist = g.assistPlayerId ? `, asistencia ${name(g.assistPlayerId)}` : '';
    lines.push(`  Gol ${g.side} ${minute(g.clock)} ${name(g.playerId)}${tags.length ? ` (${tags.join(', ')})` : ''}${assist}`);
  }
  for (const c of summary.cards) lines.push(`  Tarjeta ${c.type} ${c.side} ${minute(c.clock)} ${name(c.playerId)}`);
  for (const s of summary.substitutions) {
    lines.push(`  Cambio ${s.side} ${minute(s.clock)}: sale ${name(s.offId)}, entra ${name(s.onId)}`);
  }
  for (const side of ['home', 'away']) lines.push(`  Equipo ${side}: ${JSON.stringify(summary.teamStats[side])}`);
  for (const w of summary.warnings) lines.push(`  Aviso: ${w}`);
  return lines.join('\n');
}

function main(args) {
  const folder = args.find(a => !a.startsWith('--'));
  if (!folder) {
    process.stderr.write('Usage: summarize.mjs <scl_probe session folder> [--json]\n');
    process.exit(1);
  }
  const summaries = splitMatches(parseEventLines(readFileSync(join(folder, 'events.ndjson'), 'utf8'))).map(summarizeMatch);
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
    return;
  }
  const names = loadNames();
  process.stdout.write(`${summaries.map(s => report(s, names)).join('\n\n')}\n`);
}

main(process.argv.slice(2));
