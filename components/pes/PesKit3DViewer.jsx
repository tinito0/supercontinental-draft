import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, RotateCcw, Loader2, AlertTriangle, Save } from 'lucide-react';
import { Button, Pill } from './PesUi.jsx';
import { getKitValue } from '../../pes/kits/kitConfig.js';
import { parseKitPack, selectKitParts, fitParts } from '../../pes/kits/kitModels.js';
import { KitGL, LIGHT_PRESETS, lightState } from './kit3d/kitRenderer.js';
import { composeKitTexture } from './kit3d/kitDecals.js';
import { loadKitTextures } from './kit3d/loadKitTextures.js';
import { canPickFolder, pickGameFolder, rememberedGameFolder, readerFromFiles } from './kit3d/gameFolder.js';
import { kitPixels, fabricPreview, fabricTextures } from './kit3d/fabricPreview.js';
import { FABRICS } from '../../pes/kits/fabricMaps.js';
import { TEXTURE_SLOTS } from '../../pes/kits/kitTextures.js';

let packPromise = null;
/** Garment models (≈1.6 MB), downloaded the first time a kit is shown. */
function loadPack() {
  packPromise ??= fetch('/pes/kitpack.bin')
    .then(r => { if (!r.ok) throw new Error(`No se pudieron descargar los modelos 3D (${r.status}).`); return r.arrayBuffer(); })
    .then(b => parseKitPack(new Uint8Array(b)))
    .catch(e => { packPromise = null; throw e; });
  return packPromise;
}

const SLOT_LABEL = { kit: 'Kit', nrm: 'Relieve (nrm)', srm: 'Brillo (srm)', name: 'Letras', back: 'Números espalda', chest: 'Número pecho', leg: 'Número short' };
const hex3 = h => { const n = parseInt(String(h || '#888888').replace('#', ''), 16) || 0x888888; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const DEFAULT_VIEW = { yaw: 0, pitch: 0.1, dist: 0 };

/** Game-folder access (read only): remembered handle, picker, or folder input fallback. */
function useGameFolder() {
  const [folder, setFolder] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { rememberedGameFolder().then(setFolder).catch(() => setFolder(null)); }, []);
  const run = async fn => { setError(null); try { setFolder(await fn()); } catch (e) { if (e?.name !== 'AbortError') setError(e); } };
  return {
    folder, error,
    pick: () => run(pickGameFolder),
    allow: () => run(() => rememberedGameFolder({ prompt: true })),
    fromFiles: files => run(() => readerFromFiles(files)),
  };
}

/**
 * @param {{ onImportTexture?: (slot: object, file: string, tex: object) => Promise<void> }} props
 *   onImportTexture: saves a generated texture into the kit (same path as PesKitTextures import); omitted = read only.
 */
export function PesKit3DViewer({ kits, teamId, kit, cfg, version, players = [], onImportTexture }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const viewRef = useRef({ ...DEFAULT_VIEW });
  const fitRef = useRef(null);
  const [pack, setPack] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null });
  const [opts, setOpts] = useState({ sleeve: 'short', socks: 'long', tuck: 'out', captain: false, light: 'estadio-noche', decals: true });
  const [sample, setSample] = useState({ name: 'JUGADOR', number: '10' });
  const [fabric, setFabric] = useState({ mode: 'auto', fabric: 'malla', repeat: 48, strength: 0.5, emboss: 0.6 });
  const [saving, setSaving] = useState(null);
  const [tex, setTex] = useState({ textures: {}, files: {}, errors: [], loading: false });
  const game = useGameFolder();
  const value = useMemo(() => k => getKitValue(cfg, k), [cfg]);
  const goalkeeper = /^g\d/i.test(String(kit || '').split('/').pop());

  // WebGL context + garment models.
  useEffect(() => {
    const R = KitGL.make(canvasRef.current);
    if (!R) { setStatus({ loading: false, error: new Error('Tu navegador no tiene WebGL: no se puede mostrar el kit en 3D.') }); return undefined; }
    glRef.current = R;
    let alive = true;
    loadPack().then(p => { if (alive) { setPack(p); setStatus({ loading: false, error: null }); } })
      .catch(e => alive && setStatus({ loading: false, error: e }));
    return () => { alive = false; glRef.current = null; R.gl.getExtension('WEBGL_lose_context')?.loseContext(); };
  }, []);

  // Textures of the kit (workspace first, then the game folder).
  useEffect(() => {
    let alive = true;
    setTex(t => ({ ...t, loading: true }));
    loadKitTextures({ kits, teamId, kit, reader: game.folder?.read ? game.folder : null })
      .then(r => alive && setTex({ ...r, loading: false }))
      .catch(e => alive && setTex({ textures: {}, files: {}, errors: [e.message], loading: false }));
    return () => { alive = false; };
  }, [kits, teamId, kit, game.folder, version]);

  const draw = () => {
    const R = glRef.current, fit = fitRef.current, c = canvasRef.current;
    if (!R || !fit || !c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (W && (c.width !== W || c.height !== H)) { c.width = W; c.height = H; }
    const L = lightState(opts.light), V = viewRef.current;
    KitGL.setTex(R, 4, L.env.canvas);
    KitGL.draw(R, {
      fit, yaw: fit.yaw0 + V.yaw, pitch: V.pitch, dist: V.dist, panX: 0, panY: 0, fov: 48, ortho: false, bg: true, bgBlur: 2,
      bump: 1, nrm: true, glossK: 1, debug: 0, defSpec: 0.3, defRough: 0.6, L,
      textured: new Set(['shirt', 'sleeve', 'shorts', 'collar', 'socks']),
      colors: { shirt: hex3(value('ShirtColor1')), sleeve: hex3(value('ShirtColor1')), collar: hex3(value('ShirtColor2')), shorts: hex3(value('ShortsColor')), socks: hex3(value('SocksColor')) },
    });
  };

  // Parts follow config.txt (collar, shorts model, tight kit) and the view options.
  useEffect(() => {
    if (!pack || !glRef.current || !cfg) return;
    const { parts } = selectKitParts(pack, value, { ...opts, goalkeeper });
    KitGL.upload(glRef.current, parts);
    fitRef.current = fitParts(parts);
    draw();
  }, [pack, cfg, opts.sleeve, opts.socks, opts.tuck, opts.captain, goalkeeper]);

  // Relief/shine: the kit's own _nrm/_srm, or maps generated from the chosen fabric (live preview).
  const useGenerated = fabric.mode === 'gen' || (fabric.mode === 'auto' && !tex.textures.nrm);
  const kitPx = useMemo(() => kitPixels(tex.textures.kit?.canvas), [tex]);
  const maps = useMemo(() => {
    if (!useGenerated) return { nrm: tex.textures.nrm?.canvas || null, srm: tex.textures.srm?.canvas || null };
    return fabricPreview(kitPx, fabric);
  }, [useGenerated, kitPx, tex, fabric.fabric, fabric.repeat, fabric.strength, fabric.emboss]);

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

  // Kit texture with name/numbers + relief/shine maps.
  useEffect(() => {
    const R = glRef.current;
    if (!R || !cfg) return;
    const t = tex.textures;
    const fonts = { name: t.name?.canvas, back: t.back?.canvas, chest: t.chest?.canvas, leg: t.leg?.canvas };
    KitGL.setTex(R, 0, composeKitTexture(t.kit?.canvas || null, value, fonts, opts.decals ? sample : { name: '', number: '' }));
    KitGL.setTex(R, 1, maps.nrm);
    KitGL.setTex(R, 2, maps.srm);
    KitGL.setTex(R, 3, t.kit?.gloss || null);
    draw();
  }, [tex, cfg, sample, opts.decals, pack, maps]);

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
  const sel = 'bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white';
  const t = tex.textures;
  const found = Object.entries(tex.files || {}).filter(([, f]) => f);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="relative self-start">
        <canvas ref={canvasRef} tabIndex={0} aria-label={`Kit ${kit} en 3D. Arrastrá para girar, rueda o +/− para acercar, flechas para mover, doble clic para volver al frente.`}
          className="w-full aspect-[4/5] max-h-[560px] rounded-xl bg-[#0b0f16] cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400" />
        {(status.loading || tex.loading) && <span className="absolute top-2 left-2 flex items-center gap-1 text-[11px] text-slate-300"><Loader2 className="w-3.5 h-3.5 animate-spin" />Cargando…</span>}
        {status.error && <p className="absolute inset-x-2 top-2 text-xs text-red-300 bg-black/60 rounded p-2" role="alert">{status.error.message}</p>}
        <Button className="absolute bottom-2 right-2" onClick={() => { Object.assign(viewRef.current, DEFAULT_VIEW); draw(); }} aria-label="Volver al frente"><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="space-y-3 text-xs text-slate-300">
        <fieldset className="space-y-2">
          <legend className="font-bold text-slate-200 mb-1">Vista</legend>
          <label className="flex items-center justify-between gap-2">Luz
            <select className={sel} value={opts.light} onChange={e => set({ light: e.target.value })}>
              {Object.entries(LIGHT_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.n}</option>)}
            </select>
          </label>
          {!goalkeeper && (
            <label className="flex items-center justify-between gap-2">Mangas
              <select className={sel} value={opts.sleeve} onChange={e => set({ sleeve: e.target.value })}><option value="short">Cortas</option><option value="long">Largas</option></select>
            </label>
          )}
          <label className="flex items-center justify-between gap-2">Medias
            <select className={sel} value={opts.socks} onChange={e => set({ socks: e.target.value })}><option value="long">Largas</option><option value="middle">Medias</option><option value="short">Cortas</option></select>
          </label>
          <label className="flex items-center justify-between gap-2">Camiseta
            <select className={sel} value={opts.tuck} onChange={e => set({ tuck: e.target.value })}><option value="out">Afuera</option><option value="in">Adentro</option></select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={opts.captain} onChange={e => set({ captain: e.target.checked })} />Cinta de capitán</label>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold text-slate-200 mb-1">Nombre y número</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={opts.decals} onChange={e => set({ decals: e.target.checked })} />Mostrar con las fuentes del kit</label>
          {players.length > 0 && (
            <select className={`${sel} w-full`} aria-label="Jugador del plantel" value="" onChange={e => { const p = players[Number(e.target.value)]; if (p) setSample({ name: p.name, number: String(p.number) }); }}>
              <option value="">Usar un jugador del plantel…</option>
              {players.map((p, i) => <option key={`${p.number}-${p.name}`} value={i}>{p.number} · {p.name}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <input className={`${sel} flex-1 min-w-0`} aria-label="Nombre en la espalda" value={sample.name} maxLength={16} onChange={e => setSample(s => ({ ...s, name: e.target.value }))} />
            <input className={`${sel} w-14`} aria-label="Número" inputMode="numeric" value={sample.number} maxLength={2} onChange={e => setSample(s => ({ ...s, number: e.target.value.replace(/\D/g, '') }))} />
          </div>
          {value('Name') === '1' && <p className="text-[11px] text-slate-500">Este kit tiene el nombre apagado (Name=1).</p>}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-bold text-slate-200 mb-1">Tela (relieve y brillo)</legend>
          <label className="flex items-center justify-between gap-2">Mapas
            <select className={sel} value={fabric.mode} onChange={e => setFabric(f => ({ ...f, mode: e.target.value }))}>
              <option value="auto">{tex.textures.nrm ? 'Los del kit' : 'Generados'} (automático)</option>
              <option value="kit" disabled={!tex.textures.nrm}>Los del kit (_nrm/_srm)</option>
              <option value="gen">Generar con una tela</option>
            </select>
          </label>
          {useGenerated && (
            <>
              <label className="flex items-center justify-between gap-2">Tela
                <select className={sel} value={fabric.fabric} onChange={e => setFabric(f => ({ ...f, fabric: e.target.value }))}>
                  {FABRICS.map(f => <option key={f.k} value={f.k} title={f.d}>{f.n}</option>)}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">Tamaño de la trama
                <input type="range" min={16} max={96} step={4} value={fabric.repeat} onChange={e => setFabric(f => ({ ...f, repeat: Number(e.target.value) }))} />
              </label>
              <label className="flex items-center justify-between gap-2">Relieve de la trama
                <input type="range" min={0} max={1} step={0.05} value={fabric.strength} onChange={e => setFabric(f => ({ ...f, strength: Number(e.target.value) }))} />
              </label>
              <label className="flex items-center justify-between gap-2">Relieve de escudo y sponsor
                <input type="range" min={0} max={1} step={0.05} value={fabric.emboss} disabled={!kitPx} onChange={e => setFabric(f => ({ ...f, emboss: Number(e.target.value) }))} />
              </label>
              {onImportTexture && (
                <Button variant="primary" disabled={saving?.busy} onClick={saveFabric}><Save className="w-3.5 h-3.5" />{saving?.busy ? 'Generando 2048 px…' : 'Guardar nrm y srm en el kit'}</Button>
              )}
              {saving?.done && <p className="text-[11px] text-emerald-300">{saving.done}</p>}
              {saving?.error && <p className="text-[11px] text-red-300" role="alert">{saving.error.message}</p>}
            </>
          )}
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="font-bold text-slate-200 mb-1">Texturas</legend>
          {found.map(([slot, file]) => (
            <p key={slot} className="flex items-center justify-between gap-2">
              <span className="truncate" title={t[slot]?.path || file}>{SLOT_LABEL[slot]}: <span className="text-slate-500">{file}</span></span>
              {t[slot] ? <Pill tone="green">{t[slot].source === 'workspace' ? 'subida' : 'del juego'}</Pill> : <Pill tone="amber">no encontrada</Pill>}
            </p>
          ))}
          {!t.kit && <p className="text-[11px] text-slate-500">Sin la textura del kit se usan los colores del config.txt.</p>}
          {tex.errors.map(e => <p key={e} className="flex gap-1 text-[11px] text-amber-300"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{e}</p>)}
          <GameFolderControls game={game} />
        </fieldset>
      </div>
    </div>
  );
}

function GameFolderControls({ game }) {
  const { folder, error } = game;
  return (
    <div className="pt-1 space-y-1.5">
      {folder?.read && <p className="text-[11px] text-slate-400">Carpeta del juego: <b>{folder.name}</b>{folder.hasSiderIni ? ` · ${folder.roots.length} carpetas livecpk` : ''}</p>}
      {folder?.pending && <Button onClick={game.allow}><FolderOpen className="w-3.5 h-3.5" />Permitir leer «{folder.name}»</Button>}
      {canPickFolder() ? (
        <Button onClick={game.pick}><FolderOpen className="w-3.5 h-3.5" />{folder?.read ? 'Cambiar carpeta del juego' : 'Abrir carpeta de PES 2021'}</Button>
      ) : (
        <label className="block text-[11px] text-slate-400">Elegí la carpeta de texturas (…/texture/#windx11):
          <input type="file" webkitdirectory="" multiple className="mt-1 block w-full text-[11px]" onChange={e => e.target.files?.length && game.fromFiles(e.target.files)} />
        </label>
      )}
      <p className="text-[11px] text-slate-500">Las texturas se leen desde tu PC, solo para la vista previa; no se suben ni se modifican.</p>
      {error && <p className="text-[11px] text-red-300" role="alert">{error.message}</p>}
    </div>
  );
}
