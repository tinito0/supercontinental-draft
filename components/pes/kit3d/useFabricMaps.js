import { useEffect, useMemo, useState } from 'react';
import { FABRIC_DEFAULTS } from '../../../pes/kits/fabricMaps.js';
import { TEXTURE_SLOTS } from '../../../pes/kits/kitTextures.js';
import { fabricPreview, fabricTextures, kitPixels, savedNrmSize } from './fabricPreview.js';

const REGEN_PAUSE_MS = 60; // Rebuilt regenerates the preview 60 ms after the last slider move

/**
 * Relief and shine of the 3D preview, like PES Editor Rebuilt's «Tela y relieve» panel: the kit's own _nrm/_srm, or
 * maps generated from a fabric preset (and saved into the kit on request).
 * @param {{ tex: object, kitFile: string, onImportTexture?: (slot: object, file: string, tex: object) => Promise<void> }} o
 * @returns {{ fabric: object, setFabric: Function, source: 'kit'|'gen', setSource: Function, maps: { nrm, srm },
 *   hasNrm: boolean, save?: () => Promise<void>, saving: object|null }}
 *   source: 'kit' uses the kit's own maps; 'gen' the fabric preset. Default: the kit's when it has a _nrm.
 */
export function useFabricMaps({ tex, kitFile, onImportTexture }) {
  const [fabric, setFabricState] = useState({ ...FABRIC_DEFAULTS });
  const [chosen, setChosen] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(null);
  const hasNrm = Boolean(tex.nrm);
  const source = chosen === 'kit' && hasNrm ? 'kit' : chosen || (hasNrm ? 'kit' : 'gen');

  // Changing the fabric or its sliders switches to the generated maps, as in Rebuilt.
  const setFabric = patch => { setFabricState(f => ({ ...f, ...patch })); setChosen('gen'); setSaving(null); };

  // The drawings' relief comes from the kit colours or from its gloss (alpha), sampled at 1024.
  const reliefCanvas = fabric.src === 'gloss' ? tex.kit?.gloss : tex.kit?.canvas;
  const relief = useMemo(() => (source === 'gen' && typeof document !== 'undefined' ? kitPixels(reliefCanvas) : null), [source, reliefCanvas]);

  useEffect(() => {
    if (source !== 'gen' || typeof document === 'undefined') { setGenerated(null); return undefined; }
    const id = setTimeout(() => setGenerated(fabricPreview(relief, fabric)), REGEN_PAUSE_MS);
    return () => clearTimeout(id);
  }, [source, relief, fabric]);

  const maps = source === 'gen' && generated
    ? generated
    : { nrm: tex.nrm?.canvas || null, srm: tex.srm?.canvas || null };

  // The saved normal map follows the kit texture: 4096 for a 4K kit.
  const nrmSize = savedNrmSize(tex.kit?.width || 0);
  const save = onImportTexture ? async () => {
    setSaving({ busy: true, size: nrmSize });
    try {
      if (!kitFile) throw new Error('El kit no tiene KitFile: importá primero la textura del kit.');
      // yield once so «Armando…» paints before the normal map (up to 4096 px, ~2 s) blocks the page
      await new Promise(resolve => setTimeout(resolve, 30));
      const out = fabricTextures(kitPixels(reliefCanvas), fabric, nrmSize);
      for (const slotId of ['nrm', 'srm']) {
        const slot = TEXTURE_SLOTS.find(x => x.slot === slotId);
        await onImportTexture(slot, kitFile + slot.suffix, out[slotId]);
      }
      setSaving({ done: `${kitFile}_nrm.ftex (${nrmSize}) y ${kitFile}_srm.ftex (512) guardados en el kit (sin exportar).` });
    } catch (e) {
      setSaving({ error: e });
    }
  } : undefined;

  return { fabric, setFabric, source, setSource: setChosen, maps, hasNrm, nrmSize, save, saving };
}
