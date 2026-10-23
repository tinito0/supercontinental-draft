#!/usr/bin/env node
// Signatures of one team's saved game plan, for the live memory search of formation_scan.py
// (docs/PES_MATCH_DATA_RESEARCH.md S12+). Reads the save only.
//
//   node pes-collector/tools/formationPlan.mjs <teamId> [--edit FILE] [--session DIR] > plan.json
//
//   --edit     EDIT00000000 (default: $PES_EDIT_FILE). Use the save the game writes:
//              Documents\KONAMI\eFootball PES 2021 SEASON UPDATE\<id>\save\EDIT00000000 (the vendor/ copy is stale)
//   --session  scl_probe session folder: adds the MATCH_INFO squad and the pitch-slot squad indices of the
//              team's first `lineup` event, if the team played there
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEditDatabase } from '../../pes/formats/pes2021/editDatabase.js';
import { EDIT_TACTICS } from '../../pes/formats/pes2021/editLayout.js';
import { parseEventLines } from '../collector/matchSummary.js';

const value = flag => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const hex = bytes => Buffer.from(bytes).toString('hex');

function sessionSquad(dir, teamId) {
  const file = join(dir, 'events.ndjson');
  if (!existsSync(file)) return null;
  const events = parseEventLines(readFileSync(file, 'utf8'));
  const session = events.find(e => e.t === 'session');
  const side = session?.home_team === teamId ? 0 : session?.away_team === teamId ? 1 : null;
  if (side == null) return null;
  const appeared = events.find(e => e.t === 'stats_appeared');
  const lineup = events.find(e => e.t === 'lineup' && e.side === side);
  return { side, mis: session.mis ?? null, squad: appeared?.[side ? 'squad_away' : 'squad_home'] ?? null, slots: lineup?.slots ?? null };
}

const teamId = Number(process.argv[2]);
if (!Number.isInteger(teamId)) {
  console.error('usage: node formationPlan.mjs <teamId> [--edit FILE] [--session DIR]');
  process.exit(2);
}
const editFile = value('--edit') || process.env.PES_EDIT_FILE;
if (!editFile) {
  console.error('Pass --edit FILE or set PES_EDIT_FILE to the EDIT00000000 the game uses.');
  process.exit(2);
}
const edit = loadEditDatabase(new Uint8Array(readFileSync(editFile)));
const roster = edit.roster(teamId);
const tactics = edit.readTactics(teamId);
const { tacticsBase } = edit.team(teamId);
const planStart = tacticsBase + EDIT_TACTICS.planBase;
const bySlot = new Map(roster.map(entry => [entry.slot, entry]));
const variants = Array.from({ length: EDIT_TACTICS.variants }, (_, v) => {
  const start = planStart + v * EDIT_TACTICS.variantSize;
  return hex(edit.data.subarray(start, start + EDIT_TACTICS.variantSize));
});

console.log(JSON.stringify({
  teamId,
  editFile,
  lineup: tactics.order.slice(0, 11).map(slot => bySlot.get(slot)?.playerId ?? null),
  order: tactics.order,
  roster,
  roles: tactics.formation.roles,
  pos: tactics.formation.pos,
  variants,
  plan: hex(edit.data.subarray(planStart, planStart + EDIT_TACTICS.planSize)),
  strategy: tactics.strategy,
  session: value('--session') ? sessionSquad(value('--session'), teamId) : null,
}, null, 1));
