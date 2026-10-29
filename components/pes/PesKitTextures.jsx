import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Type, Wand2 } from 'lucide-react';
import { Card, Button, Pill, ErrorText } from './PesUi.jsx';
import { getKitValue } from '../../pes/kits/kitConfig.js';
import { TEXTURE_SLOTS, textureFromFile, textureFromPixels, targetFileName } from '../../pes/kits/kitTextures.js';
import { FONT_SLOTS, FONT_WIDTHS, fontLibrary, renderFontSheet, encodeFontSheet, fontFileName, sheetSize } from '../../pes/kits/kitFonts.js';
import { decodeImageFile, loadFontFile } from '../../pes/kits/imageDecode.js';

const EXTS = ['.ftex', '.dds', '.png'];

function slotStatus(kits, teamId, kit, cfg, slot) {
  const base = getKitValue(cfg, slot.key) || '';
  const file = slot.derived ? (base ? base + slot.suffix : '') : base;
  if (!file) return { file, status: 'empty' };
  const dir = kits.configPath(teamId, kit).replace(/config\.txt$/i, '');
  const generated = EXTS.find(ext => kits.assets.has(dir + file + ext));
  if (generated) return { file, status: 'imported', ext: generated };
  const found = EXTS.find(ext => kits.allPaths.has((dir + file + ext).toLowerCase()));
  return found ? { file, status: 'present', ext: found } : { file, status: 'external' };
}

const STATUS = {
  empty: ['slate', 'sin archivo'],
  present: ['green', 'en la carpeta del kit'],
  imported: ['cyan', 'importada (sin exportar)'],
  external: ['amber', 'fuera de la carpeta del kit (livecpk, p. ej. UML_Kits, o CPK)'],
};

function SlotRow({ slot, state, editable, cfg, onImport }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const [tone, text] = STATUS[state.status];

  const handleFile = async file => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const target = targetFileName(slot.slot, getKitValue(cfg, slot.key) || '', slot.derived ? null : name || null);
      const lower = file.name.toLowerCase();
      let tex;
      if (lower.endsWith('.ftex') || lower.endsWith('.dds')) {
        tex = textureFromFile(slot.slot, file.name, new Uint8Array(await file.arrayBuffer()));
      } else {
        const img = await decodeImageFile(file);
        tex = textureFromPixels(slot.slot, img.pixels, img.width, img.height);
      }
      await onImport(slot, target, tex);
      setResult(`${target}${tex.ext} · ${tex.info.format} ${tex.info.width}x${tex.info.height}`);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <li className="border-t border-line/[0.08] py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="w-40 text-ink-2 font-semibold">{slot.label}</span>
        <code className="text-ink-3">{state.file ? `${state.file}${state.ext || ''}` : 'sin nombre'}</code>
        <Pill tone={tone}>{text}</Pill>
        {editable && (
          <>
            {!slot.derived && <input value={name} onChange={e => setName(e.target.value)} placeholder={state.file || 'nombre_archivo'} aria-label={`Nombre de archivo para ${slot.label}`}
              className="w-40 input" />}
            <input ref={inputRef} type="file" accept=".ftex,.dds,.png,.jpg,.jpeg,.webp" hidden onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            <Button disabled={busy} onClick={() => inputRef.current?.click()}><Upload className="w-4 h-4" aria-hidden="true" />{busy ? 'Convirtiendo…' : 'Importar'}</Button>
          </>
        )}
      </div>
      {result && <p className="animate-in fade-in text-xs text-success-soft mt-1" role="status">Importada y verificada: {result}</p>}
      <ErrorText error={error} />
    </li>
  );
}

function FontLibrary({ kits, version, cfg, editable, onAssign }) {
  const lib = useMemo(() => fontLibrary(kits), [kits, version]);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {FONT_SLOTS.map(slot => {
        const current = getKitValue(cfg, slot.key) || '';
        return (
          <label key={slot.kind} className="flex flex-col gap-1 text-xs text-ink-2">{slot.label}
            <select value={current} disabled={!editable} onChange={e => onAssign(slot.key, e.target.value)}
              className="select">
              {slot.kind === 'chest' && <option value="">(sin número en el pecho)</option>}
              {!lib[slot.kind].some(f => f.file === current) && current && <option value={current}>{current}</option>}
              {lib[slot.kind].map(f => (
                <option key={f.file} value={f.file}>{f.file} · {f.usedBy.length} kit(s){f.present ? '' : ' · en CPK'}</option>
              ))}
            </select>
          </label>
        );
      })}
      <p className="sm:col-span-2 text-[11px] text-ink-3">
        Solo se cambia el nombre en el config.txt. El kit-server busca la textura en la carpeta de este kit y luego en los CPK; si la fuente vive en la carpeta de otro equipo, importá el archivo acá.
      </p>
    </div>
  );
}

function FontGenerator({ editable, onImport }) {
  const [family, setFamily] = useState(null);
  const [opts, setOpts] = useState({ fill: '#FFFFFF', outline: 0, outlineColor: '#000000', weight: 700, italic: false, widthScale: 1 });
  const [kind, setKind] = useState('name');
  const [width, setWidth] = useState(2048);
  const [base, setBase] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const preview = useRef(null);

  useEffect(() => {
    if (!family || !preview.current) return;
    const [W, H] = sheetSize(kind, width);
    const c = preview.current;
    c.width = W; c.height = H;
    renderFontSheet(c.getContext('2d', { willReadFrequently: true }), kind, { ...opts, family });
  }, [family, opts, kind, width]);

  const loadFont = async file => {
    setError(null);
    try { setFamily(await loadFontFile(file)); setBase(file.name.replace(/\.[^.]+$/, '')); } catch (e) { setError(new Error(`No se pudo cargar la fuente: ${e.message}`)); }
  };

  const generate = async () => {
    setError(null);
    setDone(null);
    setBusy(true);
    try {
      const c = preview.current;
      const pixels = renderFontSheet(c.getContext('2d', { willReadFrequently: true }), kind, { ...opts, family });
      const { bytes, info } = encodeFontSheet(new Uint8Array(pixels.buffer), kind, width);
      const slot = TEXTURE_SLOTS.find(s => s.slot === kind);
      const name = fontFileName(base || 'fuente', kind);
      await onImport(slot, name, { bytes, ext: '.ftex', info });
      setDone(`${name}.ftex · ${info.format} ${info.width}x${info.height}`);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  const input = 'input';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 text-xs text-ink-2">
        <label className="flex flex-col gap-1">Fuente (.ttf/.otf/.woff)
          <input type="file" accept=".ttf,.otf,.woff,.woff2" disabled={!editable} onChange={e => e.target.files[0] && loadFont(e.target.files[0])} className="text-xs text-ink-2" />
        </label>
        <label className="flex flex-col gap-1">Hoja
          <select value={kind} onChange={e => setKind(e.target.value)} className="select">{FONT_SLOTS.map(s => <option key={s.kind} value={s.kind}>{s.label}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">Ancho
          <select value={width} onChange={e => setWidth(Number(e.target.value))} className="select">{FONT_WIDTHS.map(w => <option key={w} value={w}>{w}x{w / FONT_SLOTS.find(s => s.kind === kind).aspect}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1">Relleno<input type="color" value={opts.fill} onChange={e => set('fill', e.target.value)} className="w-11 h-10 rounded-lg border border-line/[0.16] bg-raised p-1 cursor-pointer" /></label>
        <label className="flex flex-col gap-1">Borde<input type="number" min={0} max={20} value={opts.outline} onChange={e => set('outline', Number(e.target.value))} className={`${input} w-16`} /></label>
        <label className="flex flex-col gap-1">Color borde<input type="color" value={opts.outlineColor} onChange={e => set('outlineColor', e.target.value)} className="w-11 h-10 rounded-lg border border-line/[0.16] bg-raised p-1 cursor-pointer" /></label>
        <label className="flex flex-col gap-1">Peso
          <select value={opts.weight} onChange={e => set('weight', Number(e.target.value))} className="select">{[400, 500, 600, 700, 800, 900].map(w => <option key={w}>{w}</option>)}</select>
        </label>
        <label className="flex items-center gap-2 min-h-10 cursor-pointer"><input type="checkbox" checked={opts.italic} onChange={e => set('italic', e.target.checked)} className="w-4 h-4 accent-[rgb(var(--c-accent))]" />Itálica</label>
        <label className="flex flex-col gap-1">Ancho de letra<input type="range" min={0.6} max={1.2} step={0.05} value={opts.widthScale} onChange={e => set('widthScale', Number(e.target.value))} /></label>
        <label className="flex flex-col gap-1">Nombre base<input value={base} onChange={e => setBase(e.target.value)} className={`${input} w-32`} /></label>
      </div>
      {family ? (
        <div className="rounded-lg bg-[repeating-conic-gradient(rgb(var(--c-raised))_0%_25%,rgb(var(--c-canvas))_0%_50%)] [background-size:16px_16px] p-2 overflow-x-auto">
          <canvas ref={preview} className="w-full h-auto" aria-label="Vista previa de la hoja de fuente" />
        </div>
      ) : <p className="text-xs text-ink-3">Cargá una fuente para ver la hoja que se va a generar (las casillas siguen las plantillas de Letters/Numbers Template).</p>}
      <Button variant="primary" disabled={!family || !editable || busy} onClick={generate}><Wand2 className="w-4 h-4" aria-hidden="true" />{busy ? 'Generando…' : 'Generar y aplicar a este kit'}</Button>
      {done && <p className="animate-in fade-in text-xs text-success-soft" role="status">Generada y verificada: {done}. Se exporta junto al config.txt.</p>}
      <ErrorText error={error} />
    </div>
  );
}

export function PesKitTextures({ pes, teamId, kit, cfg, editable, onApply }) {
  const { ws, version } = pes;
  const kits = ws.kits;

  const importTexture = async (slot, file, tex) => {
    const sha = await pes.registerAsset(tex.bytes);
    await onApply([{ type: 'kit.texture.set', target: { teamId, kit }, slot: slot.slot, value: file, ext: tex.ext, asset: { sha256: sha } }]);
  };
  const assignFont = (key, file) => onApply([{ type: 'kit.set', target: { teamId, kit }, key, value: file }]);

  return (
    <>
      <Card title="Texturas del kit">
        <ul>
          {TEXTURE_SLOTS.map(slot => (
            <SlotRow key={slot.slot} slot={slot} state={slotStatus(kits, teamId, kit, cfg, slot)} editable={editable} cfg={cfg} onImport={importTexture} />
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-ink-3">
          .ftex y .dds se guardan tal cual (se verifica su estructura). PNG/JPG/WebP se convierten a FTEX DXT5 en potencia de 2; las hojas de fuente deben tener proporción 4:1 (letras) u 8:1 (números). Las texturas no se prueban dentro del juego.
        </p>
      </Card>
      <Card title={<span className="flex items-center gap-1.5"><Type className="w-4 h-4" aria-hidden="true" />Fuentes del Parche</span>}>
        <FontLibrary kits={kits} version={version} cfg={cfg} editable={editable} onAssign={assignFont} />
      </Card>
      <Card title="Generar fuente desde un archivo de fuente">
        <FontGenerator editable={editable} onImport={importTexture} />
      </Card>
    </>
  );
}
