// Builds a working workspace from stored sources + persisted operations.
// Pure orchestration: no React, no Firestore (the caller passes stores in).
import { loadBinDatabase, BIN_TABLES, PASSTHROUGH_FILES } from './formats/pes2021/binDatabase.js';
import { loadEditDatabase } from './formats/pes2021/editDatabase.js';
import { KitWorkspace, toKitServerRelative } from './kits/kitWorkspace.js';
import { replayOperations } from './operations.js';
import { sha256Hex } from './core/fields.js';
import { PesFormatError } from './core/errors.js';
import { sourceSha } from './storage/sourceArchive.js';

const KNOWN_BIN = new Set([...Object.values(BIN_TABLES).map(t => t.file), ...PASSTHROUGH_FILES].map(f => f.toLowerCase()));
const KIT_TEXT = /\/(config\.txt|order\.ini|gk_order\.ini)$|(^|\/)map\.txt$/i;

const pathOf = f => (f.webkitRelativePath || f.relativePath || f.name).replace(/\\/g, '/');

/**
 * Classifies user-selected files into source kinds.
 * @param {{ name: string, webkitRelativePath?: string, arrayBuffer: Function, text: Function }[]} files
 */
export function classifyFiles(files) {
  const out = { pesdb: [], edit: [], kits: [], ignored: [] };
  for (const f of files) {
    const p = pathOf(f);
    const name = p.split('/').pop();
    if (/(^|\/)kit-server\//i.test(p) || /^map\.txt$/i.test(name) && /kit/i.test(p)) out.kits.push(f);
    else if (/^EDIT\d{8}$/i.test(name)) out.edit.push(f);
    else if (KNOWN_BIN.has(name.toLowerCase())) out.pesdb.push(f);
    else out.ignored.push(p);
  }
  if (out.edit.length > 1) throw new PesFormatError('MULTIPLE_EDIT', 'Elegí un solo archivo EDIT.');
  return out;
}

/**
 * Reads classified files into source records ready for IndexedDB.
 * pesdb: { kind, files: { name: bytes } }  edit: { kind, bytes }  kits: { kind, texts, allPaths }
 * Each record gets a sha256 that identifies exactly that content.
 */
export async function readSources(classified) {
  const sources = [];
  if (classified.pesdb.length) {
    const files = {};
    const hashes = {};
    for (const f of classified.pesdb) {
      const name = pathOf(f).split('/').pop();
      files[name] = new Uint8Array(await f.arrayBuffer());
      hashes[name] = await sha256Hex(files[name]);
    }
    loadBinDatabase(files); // validate before accepting
    const sha256 = await sourceSha({ kind: 'pesdb', files });
    sources.push({ kind: 'pesdb', sha256, record: { kind: 'pesdb', files }, summary: { kind: 'pesdb', sha256, files: hashes } });
  }
  if (classified.edit.length) {
    const bytes = new Uint8Array(await classified.edit[0].arrayBuffer());
    loadEditDatabase(bytes);
    const sha256 = await sourceSha({ kind: 'edit', bytes });
    sources.push({ kind: 'edit', sha256, record: { kind: 'edit', bytes }, summary: { kind: 'edit', sha256, name: classified.edit[0].name, size: bytes.length } });
  }
  if (classified.kits.length) {
    const texts = [];
    const allPaths = [];
    for (const f of classified.kits) {
      const rel = toKitServerRelative(pathOf(f));
      allPaths.push(rel);
      if (KIT_TEXT.test('/' + rel)) texts.push([rel, await f.text()]);
    }
    texts.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const ws = new KitWorkspace(new Map(texts), new Set(allPaths));
    const sha256 = await sourceSha({ kind: 'kits', texts });
    sources.push({ kind: 'kits', sha256, record: { kind: 'kits', texts, allPaths }, summary: { kind: 'kits', sha256, configs: ws.configs.size, teams: ws.map.size } });
  }
  return sources;
}

/**
 * Builds the workspace object the engine operates on.
 * @param {object[]} sourceRecords records from IndexedDB (see readSources)
 * @param {{ leagueTeamIds?: number[] }} meta
 * @param {Map<string, Uint8Array>} assetStore generated textures by sha256
 */
export function buildWorkspace(sourceRecords, meta = {}, assetStore = new Map()) {
  const ws = { meta, assetStore };
  for (const r of sourceRecords) {
    if (r.kind === 'pesdb') ws.bin = loadBinDatabase(r.files);
    else if (r.kind === 'edit') ws.edit = loadEditDatabase(r.bytes);
    else if (r.kind === 'kits') ws.kits = new KitWorkspace(new Map(r.texts), new Set(r.allPaths));
  }
  return ws;
}

/** Applies saved (non-discarded) operations, then local drafts. Returns replay failures. */
export function restoreWorkingCopy(ws, savedOps, draftOps) {
  const active = savedOps.filter(op => op.state !== 'discarded');
  return {
    saved: replayOperations(ws, active),
    drafts: replayOperations(ws, draftOps),
  };
}
