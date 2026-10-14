// Generated fabric maps for the 3D preview and for saving into the kit (<KitFile>_nrm / _srm).
import { normalMapPixels, srmPixels } from '../../../pes/kits/fabricMaps.js';
import { textureFromPixels } from '../../../pes/kits/kitTextures.js';
import { pixelsToCanvas } from './kitDecals.js';

/** Kit texture pixels (RGBA) from its decoded canvas, for the relief of crest/sponsor/stripes. */
export function kitPixels(canvas) {
  if (!canvas) return null;
  const S = Math.min(1024, canvas.width);
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, S, S);
  return { width: S, height: S, pixels: g.getImageData(0, 0, S, S).data };
}

/** Preview-size normal and shine maps as canvases. */
export function fabricPreview(kit, opts, size = 512) {
  const nrm = normalMapPixels({ kit, fabric: opts.fabric, repeat: opts.repeat, fabricStrength: opts.strength, emboss: opts.emboss, size });
  return {
    nrm: pixelsToCanvas(nrm, size, size, { opaque: true }),
    srm: pixelsToCanvas(srmPixels(opts.fabric, 16), 16, 16, { opaque: true }),
  };
}

/** Full-size maps encoded as verified FTEX files for the nrm and srm slots. */
export function fabricTextures(kit, opts) {
  const nrm = normalMapPixels({ kit, fabric: opts.fabric, repeat: opts.repeat, fabricStrength: opts.strength, emboss: opts.emboss, size: 2048 });
  return {
    nrm: textureFromPixels('nrm', nrm, 2048, 2048),
    srm: textureFromPixels('srm', srmPixels(opts.fabric, 1024), 1024, 1024),
  };
}
