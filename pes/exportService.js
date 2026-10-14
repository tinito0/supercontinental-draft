// ZIP export: validate -> generate -> verify every generated file -> manifest -> zip -> verify zip.
// Nothing is reported as game-tested: the manifest states that compatibility was only
// verified structurally (re-parsing the generated files).
import JSZip from 'jszip';
import { validateWorkspace } from './validator.js';
import { serializeBinDatabase, loadBinDatabase } from './formats/pes2021/binDatabase.js';
import { decryptEdit } from './formats/pes2021/editCrypto.js';
import { parseKitConfig, serializeKitConfig, parseKitOrder } from './kits/kitConfig.js';
import { inspectFtex } from './kits/ftex.js';
import { inspectDds } from './kits/kitTextures.js';
import { sha256Hex } from './core/fields.js';
import { PesError, PesValidationError } from './core/errors.js';

export const PESDB_DIR = 'common/etc/pesdb';
export const EDIT_PATH = 'save/EDIT00000000';

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Re-parses generated files and checks they contain exactly the working-copy data. */
function verifyGenerated(ws, files) {
  const checks = [];
  for (const [path, bytes] of Object.entries(files)) {
    if (path.startsWith(PESDB_DIR + '/')) {
      const name = path.slice(PESDB_DIR.length + 1);
      const reloaded = loadBinDatabase({ [name]: bytes });
      const table = Object.values(reloaded.tables)[0];
      const expected = Object.values(ws.bin.tables).find(t => t.file === name).data;
      if (!same(table.data, expected)) throw new PesError('VERIFY_FAILED', `${name}: el archivo generado no coincide con la copia de trabajo.`);
      checks.push({ path, check: 'reparsed; payload identical to working copy', records: table.count });
    } else if (path === EDIT_PATH) {
      const c = decryptEdit(bytes);
      const orig = ws.edit.container;
      if (!same(c.data, ws.edit.data)) throw new PesError('VERIFY_FAILED', 'EDIT: los datos descifrados del archivo generado no coinciden.');
      if (!same(c.desc, orig.desc) || !same(c.logo, orig.logo) || !same(c.serial, orig.serial)) throw new PesError('VERIFY_FAILED', 'EDIT: cambió la descripción, el logo o el SID.');
      checks.push({ path, check: 'decrypted; data identical to working copy; desc/logo/serial unchanged' });
    } else if (/\.dds$/i.test(path)) {
      const info = inspectDds(bytes);
      checks.push({ path, check: `DDS header valid: ${info.width}x${info.height} ${info.fourCC}` });
    } else if (/(^|\/)(gk_)?order\.ini$/i.test(path)) {
      const text = new TextDecoder().decode(bytes);
      const rel = path.slice('content/kit-server/'.length);
      if (text !== ws.kits.texts.get(rel)) throw new PesError('VERIFY_FAILED', `${path}: el order.ini generado no coincide con la copia de trabajo.`);
      const listed = Object.values(parseKitOrder(text)).flat().length;
      checks.push({ path, check: `order file identical to working copy; ${listed} kit(s) listed` });
    } else if (/\.ftex$/i.test(path)) {
      const info = inspectFtex(bytes);
      checks.push({ path, check: `FTEX parsed: ${info.format} ${info.width}x${info.height}, ${info.mips} mips, all chunks decompress to the expected size` });
    } else {
      const text = new TextDecoder().decode(bytes);
      const cfg = parseKitConfig(text);
      if (serializeKitConfig(cfg) !== text) throw new PesError('VERIFY_FAILED', `${path}: el config.txt generado no se relee igual.`);
      checks.push({ path, check: 'reparsed; round-trips exactly' });
    }
  }
  return checks;
}

/**
 * Builds the export ZIP.
 * @param {object} ws workspace ({ bin, edit, kits })
 * @param {{ workspaceId: string, sources: object[], operations: object[], actor: object }} info
 * @returns {Promise<{ zip: Uint8Array, manifest: object }>}
 */
export async function buildExport(ws, info) {
  const validation = validateWorkspace(ws);
  if (!validation.passed) {
    throw new PesValidationError('VALIDATION_FAILED', `La validación tiene ${validation.errors.length} error(es); no se puede exportar.`, { validation });
  }

  const files = {};
  if (ws.bin) for (const [name, bytes] of Object.entries(serializeBinDatabase(ws.bin))) files[`${PESDB_DIR}/${name}`] = bytes;
  if (ws.edit?.isModified()) files[EDIT_PATH] = ws.edit.serialize();
  if (ws.kits) {
    for (const [path, text] of Object.entries(ws.kits.modifiedFiles())) files[path] = new TextEncoder().encode(text);
    for (const [path, bytes] of Object.entries(ws.kits.assetFiles())) files[path] = bytes;
  }
  if (!Object.keys(files).length) throw new PesValidationError('NOTHING_TO_EXPORT', 'No hay cambios para exportar.');

  const checks = verifyGenerated(ws, files);

  const fileEntries = [];
  for (const [path, bytes] of Object.entries(files)) fileEntries.push({ path, bytes: bytes.length, sha256: await sha256Hex(bytes) });

  const manifest = {
    generator: 'Supercontinental Draft — PES workspace',
    exportedAt: new Date().toISOString(),
    workspaceId: info.workspaceId,
    exportedBy: info.actor?.uid || null,
    targetFormat: 'eFootball PES 2021 SEASON UPDATE (PC): pesdb WESYS BIN, EDIT00000000, Sider kit-server config.txt',
    sources: info.sources,
    files: fileEntries,
    operations: info.operations.length,
    validation: { passed: validation.passed, warnings: validation.warnings.length, preexisting: validation.preexisting.length },
    warnings: validation.warnings.map(w => w.message),
    verification: checks,
    compatibility: {
      gameTested: false,
      statement: 'Archivos verificados estructuralmente (se releen y coinciden con la copia de trabajo). No se probaron dentro del juego.',
      install: {
        pesdb: `Los .bin de ${PESDB_DIR}/ van dentro de un CPK o de una carpeta livecpk de Sider con la misma ruta.`,
        edit: `${EDIT_PATH} reemplaza Documents\\KONAMI\\eFootball PES 2021 SEASON UPDATE\\<id>\\save\\EDIT00000000 (hacé una copia antes).`,
        kits: 'Los config.txt de content/kit-server/ reemplazan los del Parche en la carpeta de Sider.',
      },
    },
  };

  const zip = new JSZip();
  for (const [path, bytes] of Object.entries(files)) zip.file(path, bytes, { binary: true });
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });

  // Integrity: reopen the archive and compare every entry's hash with the manifest.
  const reopened = await JSZip.loadAsync(out, { checkCRC32: true });
  for (const entry of fileEntries) {
    const f = reopened.file(entry.path);
    if (!f) throw new PesError('ZIP_INTEGRITY', `Falta ${entry.path} en el ZIP.`);
    if (await sha256Hex(await f.async('uint8array')) !== entry.sha256) throw new PesError('ZIP_INTEGRITY', `${entry.path} cambió dentro del ZIP.`);
  }
  return { zip: out, manifest };
}
