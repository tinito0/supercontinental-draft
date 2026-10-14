import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { encodeFtex } from '../../pes/kits/ftex.js';
import { decodeFtex, decodeDds } from '../../pes/kits/textureDecode.js';
import { hasKitServer, KIT_SERVER_DIR } from './fixtures.js';

function gradient(W, H) {
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4;
    px[p] = (x * 255) / (W - 1); px[p + 1] = (y * 255) / (H - 1); px[p + 2] = 128; px[p + 3] = x < W / 2 ? 255 : 64;
  }
  return px;
}

describe('texture decoding (synthetic)', () => {
  it('decodes a DXT5 FTEX written by the encoder back to close pixels', () => {
    const W = 64, H = 32, px = gradient(W, H);
    const out = decodeFtex(encodeFtex(px, W, H), { maxWidth: 64 });
    expect([out.width, out.height, out.format]).toEqual([64, 32, 'DXT5']);
    let worst = 0;
    for (let i = 0; i < px.length; i++) worst = Math.max(worst, Math.abs(px[i] - out.pixels[i]));
    expect(worst).toBeLessThan(24); // DXT is lossy; a gradient stays within a few steps
  });

  it('picks a smaller mip when asked', () => {
    const out = decodeFtex(encodeFtex(gradient(64, 64), 64, 64), { maxWidth: 16 });
    expect([out.width, out.height]).toEqual([16, 16]);
  });

  it('decodes an uncompressed BGRA DDS', () => {
    const W = 4, H = 4, b = new Uint8Array(128 + W * H * 4), dv = new DataView(b.buffer);
    b.set([0x44, 0x44, 0x53, 0x20]);
    dv.setUint32(4, 124, true); dv.setUint32(12, H, true); dv.setUint32(16, W, true); dv.setUint32(28, 1, true);
    dv.setUint32(80, 0x41, true); dv.setUint32(88, 32, true); dv.setUint32(92, 0x00ff0000, true);
    for (let i = 0; i < W * H; i++) b.set([10, 20, 30, 255], 128 + i * 4); // B, G, R, A
    expect(Array.from(decodeDds(b).pixels.subarray(0, 4))).toEqual([30, 20, 10, 255]);
  });

  it('rejects a file that is not a DDS', () => {
    expect(() => decodeDds(new Uint8Array(200))).toThrow(expect.objectContaining({ code: 'NOT_DDS' }));
  });
});

describe.skipIf(!hasKitServer)('real patch textures (read-only)', () => {
  it('decodes a BC7 font sheet of the patch', () => {
    const f = path.join(KIT_SERVER_DIR, '2. Bundesliga/Bochum/p1/u4128p1_name.ftex');
    if (!fs.existsSync(f)) return;
    const out = decodeFtex(new Uint8Array(fs.readFileSync(f)), { maxWidth: 2048 });
    expect([out.width, out.height, out.format]).toEqual([2048, 512, 'BC7']);
    let opaque = 0;
    for (let i = 3; i < out.pixels.length; i += 4) if (out.pixels[i] > 24) opaque++;
    // Glyphs cover part of the sheet, the rest is transparent.
    expect(opaque).toBeGreaterThan(out.width * out.height * 0.02);
    expect(opaque).toBeLessThan(out.width * out.height * 0.9);
  });
});
