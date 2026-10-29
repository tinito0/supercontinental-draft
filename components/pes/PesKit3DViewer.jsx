import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { Tabs } from '../ui/Tabs.jsx';
import { Button } from './PesUi.jsx';
import { getKitValue } from '../../pes/kits/kitConfig.js';
import { parseKitPack, selectKitParts, fitParts } from '../../pes/kits/kitModels.js';
import { resolveKitRender, availableCollars } from '../../pes/kits/kitRenderConfig.js';
import { CollarPicker } from './kit3d/CollarPicker.jsx';
import { KitGL, lightState } from './kit3d/kitRenderer.js';
import { composeKitTexture, fallbackKitTexture } from './kit3d/kitDecals.js';
import { kitPixels, fabricPreview, fabricTextures } from './kit3d/fabricPreview.js';
import { TEXTURE_SLOTS } from '../../pes/kits/kitTextures.js';
import { useKitGL } from './kit3d/useKitGL.js';
import { useKitAssets } from './kit3d/useKitAssets.js';
import { ViewPanel, ShirtPanel, LetteringPanel, FabricPanel, DiagnosticsPanel } from './kit3d/KitViewerPanels.jsx';

let packPromise = null;
/** Garment models (≈1.6 MB), downloaded the first time a kit is shown. */
function loadPack() {
  packPromise ??= fetch('/kit3d/kitpack.bin')
    .then(r => { if (!r.ok) throw new Error(`No se pudieron descargar los modelos 3D (${r.status}).`); return r.arrayBuffer(); })
    .then(b => parseKitPack(new Uint8Array(b)))
    .catch(e => { packPromise = null; throw e; });
  return packPromise;
}

const hex3 = h => { const n = parseInt(String(h || '#888888').replace('#', ''), 16) || 0x888888; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const DEFAULT_VIEW = { yaw: 0, pitch: 0.1, dist: 0 };
const TEXTURED = new Set(['shirt', 'sleeve', 'shorts', 'collar', 'socks']);

/**
 * 3D preview of one kit: textures resolved from the kit-server (workspace → cloud → local folder), names and
 * numbers drawn with the kit's font sheets, config.txt values applied, with a diagnostics tab.
 * @param {{ kits: object, teamId: number, kit: string, cfg: object, version: number, players?: object[],
 *   workspaceId?: string, uid?: string, canShare?: boolean,
 *   onImportTexture?: (slot: object, file: string, tex: object) => Promise<void>,
 *   onSetValues?: (values: Record<string, string>) => Promise<void> }} props
 *   onImportTexture: saves a generated texture into the kit (same path as PesKitTextures import); omitted = read only.
 *   onSetValues: writes config.txt values (kit.set operations); omitted = collars can be previewed but not saved.
 *   canShare: the user may share the kit-server textures found locally (Super Admin, Kit Manager of the team).
 */
export function PesKit3DViewer({ kits, teamId, kit, cfg, version, players = [], workspaceId, uid, canShare, onImportTexture, onSetValues }) {
  const canvasRef = useRef(null);
  const viewRef = useRef({ ...DEFAULT_VIEW });
  const fitRef = useRef(null);
  const { glRef, epoch, error: glError } = useKitGL(canvasRef);
  const [pack, setPack] = useState(null);
  const [packError, setPackError] = useState(null);
  const [tab, setTab] = useState('view');
  const [opts, setOpts] = useState({ sleeve: 'short', socks: 'long', tuck: 'out', captain: false, light: 'estadio-noche', decals: true });
  const [sample, setSample] = useState({ name: 'JUGADOR', number: '10' });
  const [fabric, setFabric] = useState({ mode: 'auto', fabric: 'malla', repeat: 48, strength: 0.5, emboss: 0.6 });
  const [saving, setSaving] = useState(null);
  const [collarPreview, setCollarPreview] = useState(null);
  const [model, setModel] = useState({ base: [], collarNote: null });
  const assets = useKitAssets({ kits, teamId, kit, version, workspaceId, uid, canShare });
  const tex = assets.textures;

  const value = useMemo(() => k => getKitValue(cfg, k), [cfg]);
  const goalkeeper = /^g\d/i.test(String(kit || '').split('/').pop());
  const render = useMemo(() => resolveKitRender(cfg, { sleeve: opts.sleeve, goalkeeper, collarPreview }), [cfg, opts.sleeve, goalkeeper, collarPreview]);
  const collars = useMemo(() => (pack ? availableCollars(pack, cfg) : []), [pack, cfg]);
  const colors = useMemo(() => ({
    shirt: hex3(value('ShirtColor1')), sleeve: hex3(value('ShirtColor1')), collar: hex3(value('ShirtColor2')),
    shorts: hex3(value('ShortsColor')), socks: hex3(value('SocksColor')), undershirt: hex3(value('UndershirtColor') || value('ShirtColor1')),
  }), [value]);
  const scene = useMemo(() => ({ light: opts.light, textured: TEXTURED, colors }), [opts.light, colors]);

  // A previewed collar belongs to the kit on screen.
  useEffect(() => { setCollarPreview(null); setSaving(null); }, [teamId, kit]);

  // Garment models: downloaded once per session, independent of the WebGL context.
  useEffect(() => {
    let alive = true;
    loadPack().then(p => { if (alive) setPack(p); }).catch(e => { if (alive) setPackError(e); });
    return () => { alive = false; };
  }, []);

  const draw = () => {
    const R = glRef.current, fit = fitRef.current, c = canvasRef.current;
    if (!R || !fit || !c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (W && (c.width !== W || c.height !== H)) { c.width = W; c.height = H; }
    const L = lightState(opts.light), V = viewRef.current;
    KitGL.setTex(R, 4, L.env.canvas);
    KitGL.draw(R, {
      fit, yaw: fit.yaw0 + V.yaw, pitch: V.pitch, dist: V.dist, panX: 0, panY: 0, fov: 48, ortho: false, bg: true, bgBlur: 2,
      bump: 1, nrm: true, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, L, textured: TEXTURED, colors,
    });
  };

  // Parts follow config.txt (collar or winter collar, shorts model, tight kit, sleeve limits) and the view options.
  useEffect(() => {
    if (!pack || !glRef.current || !cfg) return;
    const { parts, collar, collarExact } = selectKitParts(pack, value, {
      ...opts, sleeve: render.sleeve, goalkeeper, collar: render.collar, undershirtOnly: render.undershirtOnly,
    });
    KitGL.upload(glRef.current, parts);
    fitRef.current = fitParts(parts);
    const shown = collar ? Number(collar.split('_')[1]) : null;
    setModel({
      base: parts.filter(p => p.k === 'shirt' || p.k === 'sleeve'),
      collarNote: render.collar && !collarExact
        ? (shown ? `No hay modelo del cuello ${render.collar}: se muestra el ${shown}, el más parecido.` : `No hay modelo del cuello ${render.collar}.`)
        : null,
    });
    draw();
  }, [pack, cfg, render, opts.socks, opts.tuck, opts.captain, goalkeeper, epoch]);

  // Relief/shine: the kit's own _nrm/_srm, or maps generated from the chosen fabric (live preview).
  const useGenerated = fabric.mode === 'gen' || (fabric.mode === 'auto' && !tex.nrm);
  const kitPx = useMemo(() => kitPixels(tex.kit?.canvas), [tex]);
  const maps = useMemo(() => {
    if (!useGenerated) return { nrm: tex.nrm?.canvas || null, srm: tex.srm?.canvas || null };
    const generated = fabricPreview(kitPx, fabric);
    // PES 2021 kits ship _srm (shine) but no _nrm: in automatic mode the relief is generated and the kit's shine kept.
    return fabric.mode === 'auto' && tex.srm ? { ...generated, srm: tex.srm.canvas } : generated;
  }, [useGenerated, kitPx, tex, fabric.mode, fabric.fabric, fabric.repeat, fabric.strength, fabric.emboss]);

  const saveFabric = async () => {
    setSaving({ busy: true });
    try {
      const kitFile = String(value('KitFile') || '').trim();
      if (!kitFile) throw new Error('El kit no tiene KitFile: importá primero la textura del kit.');
      const out = fabricTextures(kitPx, fabric);
      for (const slotId of ['nrm', 'srm']) {
        const slot = TEXTURE_SLOTS.find(x => x.slot === slotId);
        await onImportTexture(slot, kitFile + slot.suffix, out[slotId]);
      }
      setSaving({ done: `${kitFile}_nrm.ftex y ${kitFile}_srm.ftex guardados en el kit (sin exportar).` });
    } catch (e) { setSaving({ error: e }); }
  };

  // Kit texture with name/numbers drawn with the kit's font sheets where config.txt puts them.
  const composed = useMemo(() => {
    if (!cfg || typeof document === 'undefined') return { canvas: null, notes: [] };
    const fonts = { name: tex.name?.canvas, name_ex: tex.name_ex?.canvas, back: tex.back?.canvas, chest: tex.chest?.canvas, leg: tex.leg?.canvas };
    return composeKitTexture(tex.kit?.canvas || null, value, fonts, opts.decals ? sample : { name: '', number: '' }, render);
  }, [tex, cfg, value, sample, opts.decals, render]);
  // Collar thumbnails only need the shirt: a texture that does not change while typing a name.
  const plainTexture = useMemo(() => (typeof document === 'undefined' || !cfg ? null : tex.kit?.canvas || fallbackKitTexture(value)), [tex, cfg, value]);

  useEffect(() => {
    const R = glRef.current;
    if (!R || !composed.canvas) return;
    KitGL.setTex(R, 0, composed.canvas);
    KitGL.setTex(R, 1, maps.nrm);
    KitGL.setTex(R, 2, maps.srm);
    KitGL.setTex(R, 3, tex.kit?.gloss || null);
    draw();
  }, [composed, tex, pack, maps, epoch]);

  useEffect(() => { draw(); }, [opts.light]);

  // Camera: drag to turn, wheel / +/- to zoom, arrows, double click resets.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    let drag = null;
    const dist0 = () => viewRef.current.dist || (fitRef.current?.radius || 1) * 2.7;
    const down = e => { drag = { x: e.clientX, y: e.clientY, yaw: viewRef.current.yaw, pitch: viewRef.current.pitch }; c.setPointerCapture(e.pointerId); };
    const move = e => {
      if (!drag) return;
      viewRef.current.yaw = drag.yaw + (e.clientX - drag.x) * 0.011;
      viewRef.current.pitch = Math.max(-1.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.008));
      draw();
    };
    const up = () => { drag = null; };
    const zoom = f => { const r = fitRef.current?.radius || 1; viewRef.current.dist = Math.max(r * 0.35, Math.min(r * 7, dist0() * f)); draw(); };
    const wheel = e => { e.preventDefault(); zoom(1 + Math.sign(e.deltaY) * 0.09); };
    const key = e => {
      const V = viewRef.current, s = e.shiftKey ? 0.3 : 0.12;
      const act = { ArrowLeft: () => { V.yaw -= s; }, ArrowRight: () => { V.yaw += s; }, ArrowUp: () => { V.pitch = Math.min(1.2, V.pitch + s * 0.6); }, ArrowDown: () => { V.pitch = Math.max(-1.2, V.pitch - s * 0.6); }, '+': () => zoom(0.9), '=': () => zoom(0.9), '-': () => zoom(1.1), 0: () => Object.assign(V, DEFAULT_VIEW) }[e.key];
      if (act) { e.preventDefault(); act(); draw(); }
    };
    const reset = () => { Object.assign(viewRef.current, DEFAULT_VIEW); draw(); };
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', wheel, { passive: false });
    c.addEventListener('keydown', key);
    c.addEventListener('dblclick', reset);
    return () => {
      ro.disconnect();
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up); c.removeEventListener('wheel', wheel); c.removeEventListener('keydown', key); c.removeEventListener('dblclick', reset);
    };
  });

  const set = patch => setOpts(o => ({ ...o, ...patch }));
  const saveCollar = async (n, winter) => {
    await onSetValues(winter && cfg.keys.has('WinterCollar') ? { Collar: String(n), WinterCollar: String(n) } : { Collar: String(n) });
  };
  const configNotes = [...render.notes, ...(model.collarNote ? [{ key: 'Collar', level: 'warn', text: model.collarNote }] : []), ...composed.notes];
  const assetProblems = assets.assets.filter(a => (a.status === 'missing' && !a.optional) || a.status === 'error' || a.status === 'invalid').length;
  const warnCount = configNotes.filter(n => n.level === 'warn').length + assetProblems;
  const kitAsset = assets.assets.find(a => a.slot === 'kit');
  const error = glError || packError;

  const tabs = [
    { id: 'view', label: 'Vista' },
    { id: 'shirt', label: 'Camiseta' },
    { id: 'letters', label: 'Letras' },
    { id: 'fabric', label: 'Tela' },
    { id: 'diag', label: 'Diagnóstico', count: warnCount || null },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="space-y-2 lg:sticky lg:top-4 self-start">
        <div className="relative">
          <canvas ref={canvasRef} tabIndex={0} aria-label={`Kit ${kit} en 3D. Arrastrá para girar, rueda o +/− para acercar, flechas para mover, doble clic para volver al frente.`}
            className="w-full aspect-[4/5] max-h-[72vh] rounded-xl bg-canvas cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          {(!pack || assets.loading) && !error && (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-canvas/85 px-2 py-1 text-xs text-ink-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{pack ? 'Buscando texturas…' : 'Cargando modelos 3D…'}
            </span>
          )}
          {error && <p className="absolute inset-x-3 top-3 text-xs text-danger-soft bg-canvas/90 border border-danger/30 rounded-lg p-2" role="alert">{error.message}</p>}
          <Button className="absolute bottom-3 right-3" onClick={() => { Object.assign(viewRef.current, DEFAULT_VIEW); draw(); }} aria-label="Volver al frente">
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        <KitStatusLine kitAsset={kitAsset} loading={assets.loading} warnCount={warnCount} onShowDiagnostics={() => setTab('diag')} />
      </div>

      <div className="min-w-0 space-y-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Opciones de la vista 3D" />
        <div role="tabpanel" aria-label={tabs.find(t => t.id === tab)?.label}>
          {tab === 'view' && <ViewPanel opts={opts} set={set} render={render} goalkeeper={goalkeeper} />}
          {tab === 'shirt' && (
            <ShirtPanel render={render} collarPreview={collarPreview}>
              {pack && (
                <CollarPicker pack={pack} collars={collars} baseParts={model.base} texture={plainTexture} scene={scene}
                  saved={render.savedCollar} preview={collarPreview} onPreview={setCollarPreview} onUse={onSetValues ? saveCollar : undefined} />
              )}
            </ShirtPanel>
          )}
          {tab === 'letters' && (
            <LetteringPanel opts={opts} set={set} sample={sample} setSample={setSample} players={players}
              nameOff={value('Name') === '1'} assets={assets.assets} />
          )}
          {tab === 'fabric' && (
            <FabricPanel fabric={fabric} setFabric={setFabric} hasNrm={Boolean(tex.nrm)} hasSrm={Boolean(tex.srm)} useGenerated={useGenerated}
              canEmboss={Boolean(kitPx)} onSave={onImportTexture ? saveFabric : undefined} saving={saving} />
          )}
          {tab === 'diag' && (
            <DiagnosticsPanel assets={assets.assets} notes={configNotes} local={assets.local} cloud={assets.cloud} share={assets.share}
              canShare={assets.canShare} pendingShare={assets.pendingShare} onShare={assets.shareKit} error={assets.error} />
          )}
        </div>
      </div>
    </div>
  );
}

/** One line under the preview: where the kit texture came from, and how many things need attention. */
function KitStatusLine({ kitAsset, loading, warnCount, onShowDiagnostics }) {
  if (loading || !kitAsset) return null;
  const text = kitAsset.status === 'found'
    ? `Textura ${kitAsset.file} · ${kitAsset.sourceLabel}`
    : kitAsset.status === 'empty' ? 'El kit no tiene KitFile: colores del config.txt' : `Sin ${kitAsset.file}: colores del config.txt`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
      <span className={kitAsset.status === 'found' ? 'text-ink-3' : 'text-warning-soft'}>{text}</span>
      {warnCount > 0 && (
        <button type="button" onClick={onShowDiagnostics} className="flex items-center gap-1 min-h-10 rounded-md text-warning-soft hover:underline underline-offset-2">
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{warnCount} aviso(s) · ver diagnóstico
        </button>
      )}
    </div>
  );
}
