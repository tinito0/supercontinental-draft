// Generated fabric maps for the 3D preview and for saving into the kit (<KitFile>_nrm / _srm). The saved normal map
// matches the kit texture (4096 for a 4096 kit, else Rebuilt's 2048; DXT5) and the shine is Rebuilt's 512 (DXT1). The
// preview normal map is 2048 (Rebuilt previews at 1024, where the weave blurs away; 4096 would stall every slider move).
import { normalMapPixels, srmPixels } from '../../../pes/kits/fabricMaps.js';
import { textureFromPixels } from '../../../pes/kits/kitTextures.js';
import { pixelsToCanvas } from './kitDecals.js';

export const PREVIEW_NRM_SIZE = 2048;
const PREVIEW_SRM_SIZE = 64;
export const SAVED_NRM_SIZES = [2048, 4096];
const SAVED_SRM_SIZE = 512;
const RELIEF_SAMPLE = 1024; // the drawings' relief is read from the source drawn at this size, as in Rebuilt

/**
 * Pixels (RGBA) of the image the drawings' relief comes from: the kit texture, or its gloss canvas. Drawn into an
 * S × S canvas like Rebuilt does, so the browser's smoothing matches.
 */
export function kitPixels(canvas, S = RELIEF_SAMPLE) {
  if (!canvas) return null;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, S, S);
  return { width: S, height: S, pixels: g.getImageData(0, 0, S, S).data };
}

const nrmOptions = (opts, size) => ({ fabric: opts.fabric, repeat: opts.repeat, fabricStrength: opts.fabricStrength, emboss: opts.emboss, size });

/** Preview normal and shine maps as canvases. `relief` = kitPixels of the kit or of its gloss. */
export function fabricPreview(relief, opts) {
  const nrm = normalMapPixels({ kit: relief, ...nrmOptions(opts, PREVIEW_NRM_SIZE) });
  return {
    nrm: pixelsToCanvas(nrm, PREVIEW_NRM_SIZE, PREVIEW_NRM_SIZE, { opaque: true }),
    srm: pixelsToCanvas(srmPixels(opts.fabric, PREVIEW_SRM_SIZE), PREVIEW_SRM_SIZE, PREVIEW_SRM_SIZE, { opaque: true }),
  };
}

/** The normal map size that goes with a kit texture of this width: 4096 for a 4K kit, 2048 otherwise. */
export const savedNrmSize = kitWidth => (kitWidth >= SAVED_NRM_SIZES[1] ? SAVED_NRM_SIZES[1] : SAVED_NRM_SIZES[0]);

/** Full-size maps encoded as verified FTEX files for the nrm and srm slots. */
export function fabricTextures(relief, opts, nrmSize = SAVED_NRM_SIZES[0]) {
  const nrm = normalMapPixels({ kit: relief, ...nrmOptions(opts, nrmSize) });
  return {
    nrm: textureFromPixels('nrm', nrm, nrmSize, nrmSize),
    srm: textureFromPixels('srm', srmPixels(opts.fabric, SAVED_SRM_SIZE), SAVED_SRM_SIZE, SAVED_SRM_SIZE),
  };
}
