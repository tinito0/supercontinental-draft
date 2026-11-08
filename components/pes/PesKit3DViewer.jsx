import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, AlertTriangle, Minus, Plus } from 'lucide-react';
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
import { DEFAULT_VIEW, useKitCamera } from './kit3d/useKitCamera.js';
import { LETTERING, applyDraft, decalCenter, hitLettering, nudgeSize, stepsForTarget, stepsOf } from './kit3d/letteringEdit.js';

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
  // Name and numbers moved on the model, not saved yet: { NameY: 12, … } (only keys present in config.txt).
  const [draft, setDraft] = useState({});
  const [selected, setSelected] = useState(null);
  const [letterSave, setLetterSave] = useState(null);
  const neckRef = useRef(0);
  const assets = useKitAssets({ kits, teamId, kit, version, workspaceId, uid, canShare });
  const tex = assets.textures;

  const value = useMemo(() => k => getKitValue(cfg, k), [cfg]);
  const goalkeeper = /^g\d/i.test(String(kit || '').split('/').pop());
  const shownCfg = useMemo(() => (cfg ? applyDraft(cfg, draft) : cfg), [cfg, draft]);
  const render = useMemo(() => resolveKitRender(shownCfg, { sleeve: opts.sleeve, goalkeeper, collarPreview }), [shownCfg, opts.sleeve, goalkeeper, collarPreview]);
  const savedSteps = useMemo(() => stepsOf(resolveKitRender(cfg, { sleeve: opts.sleeve, goalkeeper })), [cfg, opts.sleeve, goalkeeper]);
  const collars = useMemo(() => (pack ? availableCollars(pack, cfg) : []), [pack, cfg]);
  const colors = useMemo(() => ({
    shirt: hex3(value('ShirtColor1')), sleeve: hex3(value('ShirtColor1')), collar: hex3(value('ShirtColor2')),
    shorts: hex3(value('ShortsColor')), socks: hex3(value('SocksColor')), undershirt: hex3(value('UndershirtColor') || value('ShirtColor1')),
  }), [value]);
  const scene = useMemo(() => ({ light: opts.light, textured: TEXTURED, colors }), [opts.light, colors]);

  // A previewed collar belongs to the kit on screen.
  useEffect(() => { setCollarPreview(null); setSaving(null); setDraft({}); setSelected(null); setLetterSave(null); }, [teamId, kit]);

  // Garment models: downloaded once per session, independent of the WebGL context.
  useEffect(() => {
    let alive = true;
    loadPack().then(p => { if (alive) setPack(p); }).catch(e => { if (alive) setPackError(e); });
    return () => { alive = false; };
  }, []);

  const sceneArgs = () => {
    const L = lightState(opts.light), V = viewRef.current, fit = fitRef.current;
    return {
      fit, yaw: fit.yaw0 + V.yaw, pitch: V.pitch, dist: V.dist, panX: V.panX, panY: V.panY, fov: 48, ortho: false, bg: true, bgBlur: 2,
      bump: 1, nrm: true, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, L, textured: TEXTURED, colors,
    };
  };
  const draw = () => {
    const R = glRef.current, fit = fitRef.current, c = canvasRef.current;
    if (!R || !fit || !c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (W && (c.width !== W || c.height !== H)) { c.width = W; c.height = H; }
    const sc = sceneArgs();
    KitGL.setTex(R, 4, sc.L.env.canvas);
    KitGL.draw(R, sc);
  };
  /** Kit texture coordinate under the pointer (draws the pick pass, then the normal frame again). */
  const pickAt = e => {
    const R = glRef.current, c = canvasRef.current;
    if (!R || !fitRef.current || !c) return null;
    const b = c.getBoundingClientRect();
    const uv = KitGL.pick(R, sceneArgs(), (e.clientX - b.left) * (c.width / b.width), (e.clientY - b.top) * (c.height / b.height));
    draw();
    return uv;
  };

  // Parts follow config.txt (collar or winter collar, shorts model, tight kit, sleeve limits) and the view options.
  useEffect(() => {
    if (!pack || !glRef.current || !cfg) return;
    const { parts, collar, collarExact } = selectKitParts(pack, value, {
      ...opts, sleeve: render.sleeve, goalkeeper, collar: render.collar, undershirtOnly: render.undershirtOnly,
    });
    KitGL.upload(glRef.current, parts);
    fitRef.current = fitParts(parts);
    // Height of the neck opening above the centre of the kit, for the «Cuello» view.
    let top = -Infinity;
    for (const p of parts) if (p.k === 'collar' || p.k === 'shirt') for (const me of p.m.meshes) for (let i = 1; i < me.pos.length; i += 3) top = Math.max(top, me.pos[i]);
    neckRef.current = Number.isFinite(top) ? top - fitRef.current.center[1] : 0;
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
    return composeKitTexture(tex.kit?.canvas || null, value, fonts, opts.decals ? sample : { name: '', number: '' }, render, 1024, { highlight: selected });
  }, [tex, cfg, value, sample, opts.decals, render, selected]);
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

  // Lettering on the model: with the «Letras» tab open, a left drag that starts on the name or a number moves it
  // (texture coordinate under the pointer → closest config.txt steps); the wheel over the selected one resizes it.
  const letterMode = tab === 'letters' && opts.decals;
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const canEdit = key => Boolean(cfg?.keys.has(key));
  const shownSteps = useMemo(() => stepsOf(render), [render]);
  // Draft entries equal to the saved value are dropped, so «Guardar» only appears when something changed.
  const mergeDraft = changes => setDraft(d => {
    const next = { ...d, ...changes };
    for (const k of Object.keys(next)) if (next[k] === savedSteps[k]) delete next[k];
    return next;
  });
  const resize = (group, dir) => mergeDraft(nudgeSize(shownSteps, group, dir));
  const intercept = {
    down: e => {
      if (!letterMode) return false;
      const uv = pickAt(e), group = hitLettering(composed.regions, uv);
      if (!group) return false;
      setSelected(group);
      setLetterSave(null);
      dragRef.current = { group, uv, center: decalCenter(shownSteps, group), steps: shownSteps };
      return true;
    },
    move: e => {
      const d = dragRef.current;
      if (!d || frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        const uv = pickAt(e);
        if (!uv) return;
        const target = [d.center[0] + uv[0] - d.uv[0], d.center[1] + uv[1] - d.uv[1]];
        mergeDraft(stepsForTarget(d.steps, d.group, target, canEdit));
      });
    },
    up: () => { dragRef.current = null; },
    wheel: e => {
      if (!letterMode || !selected) return false;
      if (hitLettering(composed.regions, pickAt(e)) !== selected) return false;
      resize(selected, e.deltaY < 0 ? 1 : -1);
      return true;
    },
    hover: e => {
      if (!letterMode || frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        const c = canvasRef.current;
        if (c) c.style.cursor = hitLettering(composed.regions, pickAt(e)) ? 'move' : '';
      });
    },
  };
  const { glideTo } = useKitCamera(canvasRef, { viewRef, fitRef, draw, intercept });
  useEffect(() => { if (!letterMode && canvasRef.current) canvasRef.current.style.cursor = ''; }, [letterMode]);
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const VIEWS = [
    { id: 'front', label: 'Frente', to: DEFAULT_VIEW },
    { id: 'back', label: 'Espalda', to: { yaw: Math.PI, pitch: 0.1 } },
    { id: 'collar', label: 'Cuello', to: () => {
      const r = fitRef.current?.radius || 1, pitch = 0.55, y = neckRef.current - r * 0.08;
      return { pitch, dist: r * 1.05, panY: y * Math.cos(pitch) };
    } },
  ];
  const saveLettering = async () => {
    setLetterSave({ busy: true });
    try {
      await onSetValues(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, String(v)])));
      setDraft({});
      setLetterSave({ done: 'Posición guardada en el kit (sin exportar).' });
    } catch (e) { setLetterSave({ error: e }); }
  };

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
          <canvas ref={canvasRef} tabIndex={0}
            aria-label={`Kit ${kit} en 3D. Clic izquierdo para girar, clic derecho para mover, rueda o +/− para acercar, flechas para girar, 0 o doble clic para volver al frente.`}
            className="w-full aspect-[4/5] max-h-[72vh] rounded-xl bg-canvas touch-none select-none cursor-grab data-[drag=turn]:cursor-grabbing data-[drag=pan]:cursor-move focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          {(!pack || assets.loading) && !error && (
            <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-canvas/85 px-2 py-1 text-xs text-ink-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />{pack ? 'Buscando texturas…' : 'Cargando modelos 3D…'}
            </span>
          )}
          {error && <p className="absolute inset-x-3 top-3 text-xs text-danger-soft bg-canvas/90 border border-danger/30 rounded-lg p-2" role="alert">{error.message}</p>}
          <div className="absolute bottom-3 right-3 flex rounded-lg bg-canvas/85 p-0.5 backdrop-blur-sm" role="group" aria-label="Vistas">
            {VIEWS.map(v => (
              <button key={v.id} type="button" onClick={() => glideTo(typeof v.to === 'function' ? v.to() : v.to)}
                className="min-h-10 px-3 rounded-md text-xs font-semibold text-ink-2 hover:text-ink hover:bg-overlay transition-colors">
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {(selected || Object.keys(draft).length > 0) && (
          <LetteringBar group={selected} steps={shownSteps} canEdit={canEdit} dirty={Object.keys(draft).length > 0}
            onResize={dir => selected && resize(selected, dir)} onDiscard={() => { setDraft({}); setSelected(null); setLetterSave(null); }}
            onSave={onSetValues ? saveLettering : undefined} saving={letterSave} />
        )}
        <p className="text-[11px] text-ink-3">
          {letterMode
            ? 'Arrastrá el nombre o un número sobre la camiseta para moverlo; con la rueda encima, o con − y +, cambiás el tamaño.'
            : 'Clic izquierdo: girar · Clic derecho: mover · Rueda: acercar donde apuntás · Doble clic: frente'}
        </p>
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

/**
 * Bar under the preview while moving the name or a number: what is selected, its size, and saving. Nothing is written
 * to config.txt until «Guardar posición» (same as the collar picker).
 */
function LetteringBar({ group, steps, canEdit, dirty, onResize, onDiscard, onSave, saving }) {
  const info = group ? LETTERING[group] : null;
  const sizeKey = info?.size;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-raised border border-line/[0.12] px-3 py-2 animate-in fade-in" role="group" aria-label="Mover nombre y números">
      {info && (
        <>
          <span className="text-xs font-semibold text-ink">{info.label}</span>
          {canEdit(sizeKey) && (
            <span className="flex items-center gap-1 text-xs text-ink-3">
              Tamaño
              <button type="button" onClick={() => onResize(-1)} aria-label="Más chico" className="min-h-9 min-w-9 grid place-items-center rounded-md hover:bg-overlay text-ink-2"><Minus className="w-3.5 h-3.5" aria-hidden="true" /></button>
              <span className="num text-ink w-5 text-center">{steps[sizeKey]}</span>
              <button type="button" onClick={() => onResize(1)} aria-label="Más grande" className="min-h-9 min-w-9 grid place-items-center rounded-md hover:bg-overlay text-ink-2"><Plus className="w-3.5 h-3.5" aria-hidden="true" /></button>
            </span>
          )}
        </>
      )}
      <span className="ml-auto flex items-center gap-2">
        {saving?.error && <span className="text-xs text-danger-soft" role="alert">{saving.error.message}</span>}
        {saving?.done && !dirty && <span className="text-xs text-success-soft">{saving.done}</span>}
        {dirty && <Button onClick={onDiscard}>Descartar</Button>}
        {dirty && onSave && <Button variant="primary" onClick={onSave} disabled={saving?.busy}>{saving?.busy ? 'Guardando…' : 'Guardar posición'}</Button>}
        {dirty && !onSave && <span className="text-[11px] text-ink-3">Solo vista previa: no tenés permiso para editar este kit.</span>}
      </span>
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
