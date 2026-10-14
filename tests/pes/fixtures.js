// Test fixtures for the PES engine.
// REAL fixtures: files from the user's PES 2021 install / patch (not committed). Tests that
// need them are skipped when absent. SYNTHETIC fixtures: built here from the verified
// specification only; they prove encoder/decoder symmetry, never game compatibility.
import fs from 'node:fs';
import path from 'node:path';
import { encodeWesys } from '../../pes/core/wesys.js';

const ROOT = path.resolve(__dirname, '../..');
export const PESDB_DIR = path.join(ROOT, 'vendor/UML_Database/common/etc/pesdb');
export const EDIT_FILE = path.join(ROOT, 'vendor/EDIT00000000');
export const KIT_SERVER_DIR = process.env.PES_KIT_SERVER || 'E:/eFootball PES 2021/content/kit-server';

export const hasPesdb = fs.existsSync(path.join(PESDB_DIR, 'Team.bin'));
export const hasEdit = fs.existsSync(EDIT_FILE);
export const hasKitServer = fs.existsSync(path.join(KIT_SERVER_DIR, 'map.txt'));

export function readPesdb(names) {
  const list = names || fs.readdirSync(PESDB_DIR);
  return Object.fromEntries(list.map(n => [n, new Uint8Array(fs.readFileSync(path.join(PESDB_DIR, n)))]));
}

export const readEdit = () => new Uint8Array(fs.readFileSync(EDIT_FILE));

/** Walks the real kit-server (read-only). */
export function readKitServer({ maxConfigs = Infinity } = {}) {
  const texts = new Map();
  const all = new Set();
  let configs = 0;
  (function walk(dir, rel) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { walk(path.join(dir, e.name), r); continue; }
      all.add(r);
      if (/^(map\.txt|order\.ini|gk_order\.ini)$/i.test(e.name) || (/^config\.txt$/i.test(e.name) && rel && configs++ < maxConfigs)) {
        texts.set(r, fs.readFileSync(path.join(dir, e.name), 'utf8'));
      }
    }
  })(KIT_SERVER_DIR, '');
  return { texts, all };
}

// ── SYNTHETIC ────────────────────────────────────────────
/** SYNTHETIC: a WESYS file whose payload is `count` records of `size` bytes with ids at `idOffset`. */
export function syntheticTable({ count, size, idOffset, ids }) {
  const payload = new Uint8Array(count * size);
  const dv = new DataView(payload.buffer);
  for (let i = 0; i < count; i++) dv.setUint32(i * size + idOffset, ids ? ids[i] : i + 1, true);
  return encodeWesys(payload, { compressed: true });
}

/** SYNTHETIC: kit-server config.txt in the format observed in the patch. */
export const SYNTHETIC_KIT_CONFIG = [
  '; synthetic test kit',
  '; shirt parameters',
  'Collar=1                                          ; 1 to 130',
  'TightKit=1                                        ; 0=Off, 1=On',
  'ShirtModel=144                                    ; 144, 151=Semi-long short sleeves, 160, 176=Legacy',
  '',
  '; texture files',
  'KitFile=u9999p1',
  'NameFontFile=test_name',
  'BackNumbersFile=',
  'ChestNumbersFile=',
  'LegNumbersFile=',
  '',
  '; kit colors',
  'ShirtColor1=#D12B2B',
  'UniColor_Color1=#D12B2B',
  'UniColor_Color2=#FFFFFF',
  'Unk_Offset0x1C_Bits0to1=0',
].join('\r\n');

export function syntheticKitServer() {
  const texts = new Map([
    ['map.txt', '# synthetic\r\n9999,\t"Test League\\Test FC"\r\n8888, "Test League\\Other FC"\r\n'],
    ['Test League/Test FC/order.ini', 'p1\r\n'],
    ['Test League/Test FC/gk_order.ini', 'g1\r\n'],
    ['Test League/Test FC/p1/config.txt', SYNTHETIC_KIT_CONFIG],
    ['Test League/Test FC/g1/config.txt', SYNTHETIC_KIT_CONFIG],
    ['Test League/Other FC/p1/config.txt', SYNTHETIC_KIT_CONFIG],
  ]);
  const all = new Set([...texts.keys(), 'Test League/Test FC/p1/test_name.ftex']);
  return { texts, all };
}
