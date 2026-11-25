import { useEffect, useMemo, useState } from 'react';
import { FABRIC_DEFAULTS } from '../../../pes/kits/fabricMaps.js';
import { NRM_FROM_SRM_DEFAULTS } from '../../../pes/kits/nrmFromSrm.js';
import { TEXTURE_SLOTS } from '../../../pes/kits/kitTextures.js';
import { downloadBytes } from '../PesUi.jsx';
import { fabricPreview, fabricTextures, kitPixels, savedNrmSize, srmNormalPreview, srmNormalTexture } from './fabricPreview.js';

const REGEN_PAUSE_MS = 60; // Rebuilt regenerates the preview 60 ms after the last slider move
const SRM_REGEN_PAUSE_MS = 150; // the srm relief blurs the whole map: wait a bit longer between slider moves

/**
 * Relief and shine of the 3D preview, like PES Editor Rebuilt's «Tela y relieve» panel: the kit's own _nrm/_srm,
 * maps generated from a fabric preset, or a normal map generated from the kit's _srm (nrm_from_srm.py); the generated
 * ones can be saved into the kit or downloaded.
 * @param {{ tex: object, kitFile: string, onImportTexture?: (slot: object, file: string, tex: object) => Promise<void> }} o
 * @returns {{ fabric: object, setFabric: Function, srmOpts: object, setSrmOpts: Function, source: 'kit'|'gen'|'srm',
 *   setSource: Function, maps: { nrm, srm }, hasNrm: boolean, hasSrm: boolean, nrmSize: number,
 *   save?: () => Promise<void>, saving: object|null, download: () => Promise<void>, downloading: object|null }}
 *   source: 'kit' the kit's own maps; 'gen' the fabric preset; 'srm' a normal map from the kit's _srm (its shine map
 *   stays the kit's). Default: the kit's when it has a _nrm.
 */
export function useFabricMaps({ tex, kitFile, onImportTexture }) {
  const [fabric, setFabricState] = useState({ ...FABRIC_DEFAULTS });
  // useColor: add the kit texture's brightness (nrm_from_srm.py --color), on by default here.
  const [srmOpts, setSrmState] = useState({ ...NRM_FROM_SRM_DEFAULTS, useColor: true });
  const [chosen, setChosen] = useState(null);
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const hasNrm = Boolean(tex.nrm);
  const srmCanvas = tex.srm?.canvas || null;
  const hasSrm = Boolean(srmCanvas);
  const source = (chosen === 'kit' && !hasNrm) || (chosen === 'srm' && !hasSrm) ? 'gen' : chosen || (hasNrm ? 'kit' : 'gen');

  const clearStatus = () => { setSaving(null); setDownloading(null); };
  // Changing the fabric or its sliders switches to the generated maps, as in Rebuilt.
  const setFabric = patch => { setFabricState(f => ({ ...f, ...patch })); setChosen('gen'); clearStatus(); };
  const setSrmOpts = patch => { setSrmState(o => ({ ...o, ...patch })); setChosen('srm'); clearStatus(); };
  const setSource = s => { setChosen(s); clearStatus(); };

  // The drawings' relief comes from the kit colours or from its gloss (alpha), sampled at 1024.
  const reliefCanvas = fabric.src === 'gloss' ? tex.kit?.gloss : tex.kit?.canvas;
  const relief = useMemo(() => (source === 'gen' && typeof document !== 'undefined' ? kitPixels(reliefCanvas) : null), [source, reliefCanvas]);

  useEffect(() => {
    if (source === 'kit' || typeof document === 'undefined') { setGenerated(null); return undefined; }
    const id = source === 'srm'
      ? setTimeout(() => setGenerated({ nrm: srmNormalPreview(srmCanvas, tex.kit?.canvas, srmOpts), srm: srmCanvas }), SRM_REGEN_PAUSE_MS)
      : setTimeout(() => setGenerated(fabricPreview(relief, fabric)), REGEN_PAUSE_MS);
    return () => clearTimeout(id);
  }, [source, relief, fabric, srmCanvas, srmOpts, tex.kit]);

  const maps = source !== 'kit' && generated
    ? generated
    : { nrm: tex.nrm?.canvas || null, srm: srmCanvas };

  // Fabric preset: the saved normal map follows the kit texture (4096 for a 4K kit). From the _srm: the srm's size,
  // as nrm_from_srm.py does.
  const nrmSize = source === 'srm' ? srmNormalSize(srmCanvas) : savedNrmSize(tex.kit?.width || 0);
  // yield once so «Armando…» paints before the normal map (up to 4096 px, a few seconds) blocks the page
  const build = async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    if (source === 'srm') return { nrm: srmNormalTexture(srmCanvas, tex.kit?.canvas, srmOpts, nrmSize) };
    return fabricTextures(kitPixels(reliefCanvas), fabric, nrmSize);
  };

  // The generated _nrm as a file. kserv.lua only maps KitFile and KitFile_srm, so the game does not load a _nrm left
  // in a kit-server folder (tools/NRM_FROM_SRM.md): the file is for testing or for a cpk.
  const download = async () => {
    setDownloading({ busy: true, size: nrmSize });
    try {
      if (source === 'srm' ? !srmCanvas : !tex.kit?.canvas) throw new Error('Las texturas del kit todavía no cargaron.');
      const name = `${kitFile || 'kit'}_nrm.ftex`;
      downloadBytes((await build()).nrm.bytes, name, 'application/octet-stream');
      setDownloading({ done: `${name} (${nrmSize} px) descargado. Ojo: el kit-server no carga _nrm por kit; kserv.lua solo cambia la textura y el _srm.` });
    } catch (e) {
      setDownloading({ error: e });
    }
  };

  const save = onImportTexture ? async () => {
    setSaving({ busy: true, size: nrmSize });
    try {
      if (!kitFile) throw new Error('El kit no tiene KitFile: importá primero la textura del kit.');
      const out = await build();
      // From the _srm only the normal map is new: the kit keeps its own shine map.
      const slots = source === 'srm' ? ['nrm'] : ['nrm', 'srm'];
      for (const slotId of slots) {
        const slot = TEXTURE_SLOTS.find(x => x.slot === slotId);
        await onImportTexture(slot, kitFile + slot.suffix, out[slotId]);
      }
      setSaving({ done: source === 'srm'
        ? `${kitFile}_nrm.ftex (${nrmSize}) guardado en el kit (sin exportar).`
        : `${kitFile}_nrm.ftex (${nrmSize}) y ${kitFile}_srm.ftex (512) guardados en el kit (sin exportar).` });
    } catch (e) {
      setSaving({ error: e });
    }
  } : undefined;

  return { fabric, setFabric, srmOpts, setSrmOpts, source, setSource, maps, hasNrm, hasSrm, nrmSize, save, saving, download, downloading };
}

const MAX_SRM_NRM = 4096;
/** Side of a normal map made from this srm: the srm's own (power of two), at most 4096. */
function srmNormalSize(canvas) {
  const w = canvas?.width || 0;
  let n = 4;
  while (n * 2 <= Math.min(w, MAX_SRM_NRM)) n *= 2;
  return n;
}
