// Fabric presets of the kit relief (pes/kits/fabricMaps.js), ported from PES Editor Rebuilt js/kitmat.js (KMAT).
// Synthetic data: these prove the maths matches Rebuilt's and the encoder accepts the result, not how the game draws it.
import { describe, it, expect } from 'vitest';
import { FABRICS, FABRIC_DEFAULTS, fabricTile, normalMapPixels, srmPixels } from '../../pes/kits/fabricMaps.js';
import { textureFromPixels } from '../../pes/kits/kitTextures.js';

describe('fabric presets (PES Editor Rebuilt KMAT)', () => {
  it('keeps Rebuilt\'s eight fabrics with their shine and roughness, and its studio defaults', () => {
    expect(FABRICS.map(f => [f.k, f.spec, f.rough])).toEqual([
      ['liso', 70, 150], ['malla', 85, 120], ['pique', 65, 165], ['panal', 90, 115],
      ['rayas', 75, 140], ['diagonal', 80, 130], ['jacquard', 95, 110], ['retro', 45, 200],
    ]);
    expect(FABRIC_DEFAULTS).toEqual({ fabric: 'malla', repeat: 48, fabricStrength: 0.5, emboss: 0.5, src: 'color' });
  });

  it('draws the honeycomb with Rebuilt\'s own formula', () => {
    const N = 64, T = Math.PI * 2, t = fabricTile('panal', N);
    for (const [x, y] of [[0, 0], [5, 9], [31, 17], [63, 63]]) {
      const u = x / N, v = y / N, a = (u * 6 * T) / Math.sqrt(3), b = v * 6 * T;
      const z = Math.abs(0.5 + (Math.cos(a + b / 2) + Math.cos(a - b / 2) + Math.cos(b)) / 6 - 0.5) * 2;
      expect(t[y * N + x]).toBeCloseTo(z, 6);
    }
  });

  it('every weave but the honeycomb tiles without a seam', () => {
    // Rebuilt's honeycomb is not periodic on the tile (6/√3 turns): kept as is, since the point is to match Rebuilt.
    for (const { k } of FABRICS.filter(f => f.k !== 'panal')) {
      const N = 64, t = fabricTile(k, N), at = (x, y) => t[y * N + x];
      let inner = 0, seam = 0;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x + 1 < N; x++) inner = Math.max(inner, Math.abs(at(x + 1, y) - at(x, y)), Math.abs(at(y, x + 1) - at(y, x)));
        seam = Math.max(seam, Math.abs(at(0, y) - at(N - 1, y)), Math.abs(at(y, 0) - at(y, N - 1)));
      }
      expect(seam, k).toBeLessThanOrEqual(inner + 1e-9);
    }
  });

  it('a plain fabric without a kit texture is a flat normal map', () => {
    const px = normalMapPixels({ fabric: 'liso', size: 16 });
    for (let i = 0; i < px.length; i += 4) expect([px[i], px[i + 1], px[i + 2], px[i + 3]]).toEqual([128, 128, 0, 255]);
  });

  it('embosses the drawings of the kit texture', () => {
    const W = 32, kit = { width: W, height: W, pixels: new Uint8Array(W * W * 4) };
    for (let y = 0; y < W; y++) for (let x = 16; x < W; x++) kit.pixels.set([255, 255, 255, 255], (y * W + x) * 4); // white right half
    const px = normalMapPixels({ kit, fabric: 'liso', emboss: 1, size: 32 });
    const at = x => px[(10 * W + x) * 4];
    expect(at(4)).toBe(128); // flat area
    expect(at(15)).not.toBe(128); // edge of the drawing
  });

  it('encodes to a verified FTEX for the nrm and srm slots', () => {
    expect(textureFromPixels('nrm', normalMapPixels({ fabric: 'malla', size: 64 }), 64, 64).info).toMatchObject({ format: 'DXT5', width: 64 });
    const srm = srmPixels('malla', 32);
    expect([srm[0], srm[1]]).toEqual([85, 120]);
    expect(textureFromPixels('srm', srm, 32, 32).info).toMatchObject({ format: 'DXT1', width: 32 });
  });

  it('rejects unknown fabrics and non power-of-two sizes', () => {
    expect(() => normalMapPixels({ fabric: 'seda' })).toThrow(expect.objectContaining({ code: 'UNKNOWN_FABRIC' }));
    expect(() => normalMapPixels({ size: 100 })).toThrow(expect.objectContaining({ code: 'FTEX_SIZE' }));
  });
});

describe('saved normal map size', () => {
  it('follows the kit texture: 4096 for a 4K kit, 2048 otherwise', async () => {
    const { savedNrmSize } = await import('../../components/pes/kit3d/fabricPreview.js');
    expect(savedNrmSize(4096)).toBe(4096);
    expect(savedNrmSize(2048)).toBe(2048);
    expect(savedNrmSize(0)).toBe(2048); // no kit texture loaded
  });
});
