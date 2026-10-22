#!/usr/bin/env node
// Local bridge: follows the newest scl_probe recording while a match is played, writes match summaries and, when
// configured, uploads them to the match-feed Edge Function (docs/MATCH_FEED.md). Usually started by tray.ps1.
//
//   node pes-collector/bridge/bridge.mjs [--config FILE] [--probe-dir DIR] [--out DIR] [--teams FILE] [--once]
//
//   --config     JSON { endpoint, token, probeDir?, teamsFile? } (default %APPDATA%/scl-bridge/config.json).
//                Without endpoint + token nothing is uploaded (local mode).
//   --probe-dir  scl_probe output folder (default E:/eFootball PES 2021/scl_probe)
//   --out        output folder (default <probe-dir>/_bridge):
//                  live.json      match in progress
//                  matches/*.json one file per finished or abandoned match
//                  outbox.json    matchKey → hash of what the server has (survives restarts)
//                  status.json    state for the tray icon
//                  bridge.log     log, rotated at 1 MB
//                  paused         if this file exists, uploading is paused (the tray creates it)
//   names        team and player names from the PES database and the save (config pesdbDir / editFile, default
//                the repo's vendor/ copies), added to every summary as `names`.
//   --teams      JSON { "draftMap": { draftTeamId: gameTeamId }, "names": { draftTeamId: name } }; matches with a
//                team outside it are ignored. Without it every match is kept, marked unassigned.
//   --once       process the newest recording once (and upload what is pending) and exit
//   --parent     PID of tray.ps1: the bridge exits when that process ends
//
// It only reads the probe's files and writes its own folder; the token never leaves config.json except in the
// Authorization header of the upload.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEventLines, splitMatches, summarizeMatch } from '../collector/matchSummary.js';
import { describeStatus, matchFileName, parseTeamMap, pendingUploads, selectMatch } from './bridgeCore.js';
import { createUploader } from './uploader.js';
import { attachNames, buildNameIndex } from './nameIndex.js';

const POLL_MS = 2000;
const SESSION_NAME = /^\d{8}_\d{6}$/;
const LOG_MAX_BYTES = 1024 * 1024;
const MIN_TOKEN_LENGTH = 32;

function parseArgs(argv) {
  const value = flag => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const configFile = value('--config') || join(process.env.APPDATA || '.', 'scl-bridge', 'config.json');
  const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {};
  const probeDir = value('--probe-dir') || config.probeDir || 'E:/eFootball PES 2021/scl_probe';
  return {
    configFile,
    probeDir,
    outDir: value('--out') || join(probeDir, '_bridge'),
    teamsFile: value('--teams') || config.teamsFile,
    pesdbDir: config.pesdbDir || fileURLToPath(new URL('../../vendor/UML_Database/common/etc/pesdb/', import.meta.url)),
    editFile: config.editFile || fileURLToPath(new URL('../../vendor/EDIT00000000', import.meta.url)),
    endpoint: config.endpoint,
    token: config.token,
    once: argv.includes('--once'),
    parentPid: Number(value('--parent')) || null,
  };
}

function newestSession(probeDir) {
  if (!existsSync(probeDir)) return null;
  const sessions = readdirSync(probeDir).filter(name => SESSION_NAME.test(name)).sort();
  return sessions.length ? join(probeDir, sessions[sessions.length - 1]) : null;
}

// Write to a temporary file and rename, so a reader never sees half a file.
function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(tmp, file);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function createLogger(file) {
  return message => {
    const line = `[${new Date().toLocaleString()}] ${message}\n`;
    process.stdout.write(line);
    try {
      if (existsSync(file) && statSync(file).size > LOG_MAX_BYTES) renameSync(file, `${file}.1`);
      appendFileSync(file, line);
    } catch {
      // The console line above is enough when the log file cannot be written.
    }
  };
}

function describe(selected) {
  const name = side => selected.teams[side].name || selected.names?.teams?.[side] || selected.match[`${side}TeamId`];
  return `${name('home')} ${selected.score.home}-${selected.score.away} ${name('away')} [${selected.status}]`;
}

/** Re-reads the session when its file grew; returns the selected summaries (null when unchanged). */
function readSession(sessionDir, teamMap, names, state) {
  const file = join(sessionDir, 'events.ndjson');
  if (!existsSync(file)) return null;
  const size = statSync(file).size;
  if (state.file === file && state.size === size) return null;
  state.file = file;
  state.size = size;
  const summaries = splitMatches(parseEventLines(readFileSync(file, 'utf8'))).map(summarizeMatch);
  return summaries.map(s => selectMatch(s, teamMap)).filter(Boolean).map(s => attachNames(s, names));
}

function saveLocally(selected, outDir, state, log) {
  for (const match of selected.filter(s => s.status !== 'live')) {
    const target = join(outDir, 'matches', matchFileName(match));
    const text = JSON.stringify(match);
    if (state.written.get(target) === text) continue;
    state.written.set(target, text);
    if (JSON.stringify(readJson(target, null)) === text) continue;
    writeJson(target, match);
    log(`partido guardado: ${describe(match)}`);
  }
  const current = selected[selected.length - 1] || null;
  const liveText = JSON.stringify(current);
  if (liveText !== state.live) {
    writeJson(join(outDir, 'live.json'), { updatedAt: new Date().toISOString(), session: state.file, match: current });
    state.live = liveText;
    // The clock changes every sample; the log only notes a new match, a goal or a status change.
    const headline = current ? describe(current) : null;
    if (current?.status === 'live' && headline !== state.headline) log(`en vivo: ${headline}`);
    state.headline = headline;
  }
  state.current = current;
}

function savedMatches(outDir, names) {
  const dir = join(outDir, 'matches');
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJson(join(dir, f), null)).filter(Boolean)
    .map(match => attachNames(match, names));
}

/** Names for the summaries; without the files the bridge still works and the page shows ids. */
function loadNames({ pesdbDir, editFile }, log) {
  const read = file => (existsSync(file) ? new Uint8Array(readFileSync(file)) : undefined);
  try {
    const names = buildNameIndex({
      teamBin: read(join(pesdbDir, 'Team.bin')),
      playerBin: read(join(pesdbDir, 'Player.bin')),
      editBytes: read(editFile),
    });
    log(`nombres: ${names.teams.size} equipos, ${names.players.size} jugadores`);
    return names;
  } catch (error) {
    log(`nombres: no se pudieron leer (${error.message}); se suben solo los ids`);
    return null;
  }
}

function createUploadSide({ endpoint, token, outDir, log }) {
  if (!endpoint || !token) return null;
  if (token.length < MIN_TOKEN_LENGTH) {
    log(`config.json: el token tiene menos de ${MIN_TOKEN_LENGTH} caracteres; no se sube nada`);
    return null;
  }
  const outboxFile = join(outDir, 'outbox.json');
  const outbox = readJson(outboxFile, {});
  const uploader = createUploader({
    endpoint, token, log, known: outbox,
    onSent: (matchKey, hash, summary) => {
      outbox[matchKey] = hash;
      writeJson(outboxFile, outbox);
      if (summary.status !== 'live') log(`subido: ${describe(summary)}`);
    },
  });
  return { uploader, outbox };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { probeDir, outDir, teamsFile, once } = args;
  mkdirSync(join(outDir, 'matches'), { recursive: true });
  const log = createLogger(join(outDir, 'bridge.log'));
  const teamMap = teamsFile ? parseTeamMap(readJson(teamsFile, { draftMap: {} })) : null;
  const upload = createUploadSide({ ...args, log });
  const names = loadNames(args, log);
  log(`inicio: leyendo ${probeDir}; ${teamMap ? `${teamMap.size} equipos asignados` : 'sin asignación de equipos'}; ${upload ? `subiendo a ${new URL(args.endpoint).host}` : `solo local (sin ${args.configFile})`}`);

  const pausedFile = join(outDir, 'paused');
  const state = { file: null, size: -1, live: undefined, written: new Map(), current: null };
  let statusText = '';
  if (upload) {
    const backlog = pendingUploads(savedMatches(outDir, names), upload.outbox);
    if (backlog.length) log(`${backlog.length} partido(s) guardados sin subir: se suben ahora`);
    for (const match of backlog) await upload.uploader.push(match);
  }

  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const session = newestSession(probeDir);
      const selected = session ? readSession(session, teamMap, names, state) : null;
      if (selected) saveLocally(selected, outDir, state, log);
      const paused = existsSync(pausedFile);
      if (upload && !paused) {
        if (selected) for (const match of selected) await upload.uploader.push(match);
        await upload.uploader.flush();
      }
      const status = describeStatus({ uploading: Boolean(upload), paused, current: state.current, upload: upload?.uploader.status() ?? null });
      const text = JSON.stringify(status);
      if (text !== statusText) {
        writeJson(join(outDir, 'status.json'), { ...status, updatedAt: new Date().toISOString(), pid: process.pid });
        statusText = text;
      }
    } catch (error) {
      log(`error: ${error.message}`);
    } finally {
      busy = false;
    }
  };
  await tick();
  if (once) return;
  setInterval(tick, POLL_MS);
  // Started by tray.ps1: stop when the tray is gone, so no hidden bridge is left running.
  if (args.parentPid) {
    setInterval(() => {
      try {
        process.kill(args.parentPid, 0);
      } catch {
        log('la bandeja se cerró: fin');
        process.exit(0);
      }
    }, POLL_MS);
  }
}

main().catch(error => {
  process.stderr.write(`bridge: ${error.message}\n`);
  process.exit(1);
});
