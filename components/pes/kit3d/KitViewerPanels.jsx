import React from 'react';
import { FolderOpen, Save, CloudUpload, CheckCircle2, AlertTriangle, XCircle, Info, CircleDashed } from 'lucide-react';
import { Button } from '../PesUi.jsx';
import { LIGHT_PRESETS } from './kitRenderer.js';
import { FABRICS } from '../../../pes/kits/fabricMaps.js';
import { describeAsset } from '../../../pes/kits/kitAssetResolver.js';

// Side panels of the 3D kit viewer (PesKit3DViewer). Presentational: state lives in the viewer.

const SELECT = 'select min-h-11 sm:min-h-9 text-xs w-full sm:w-44';

/** One labelled control: label on the left, control on the right (stacks on narrow screens). */
function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <span className="text-xs text-ink-2">{label}</span>
        {hint && <p className="text-[11px] text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Mutually exclusive choice as a button group (aria-pressed), for 2–3 short options. */
function Segmented({ label, value, options, onChange, disabled, title }) {
  return (
    <div role="group" aria-label={label} title={title} className="inline-flex rounded-lg border border-line/[0.16] bg-raised p-0.5 self-start sm:self-auto">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} disabled={disabled || o.disabled}
          onClick={() => onChange(o.value)}
          className={`min-h-10 sm:min-h-8 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${value === o.value ? 'bg-accent text-white' : 'text-ink-2 hover:bg-overlay'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 min-h-11 sm:min-h-9 text-xs text-ink-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--c-accent))]" />
      {children}
    </label>
  );
}

const Section = ({ title, children }) => (
  <section className="space-y-3 border-t border-line/[0.08] pt-4 first:border-t-0 first:pt-0">
    {title && <h3 className="eyebrow">{title}</h3>}
    {children}
  </section>
);

export function ViewPanel({ opts, set, render, goalkeeper }) {
  return (
    <div className="space-y-4">
      <Section>
        <Row label="Luz">
          <select className={SELECT} value={opts.light} onChange={e => set({ light: e.target.value })}>
            {Object.entries(LIGHT_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.n}</option>)}
          </select>
        </Row>
        {!goalkeeper && (
          <Row label="Mangas" hint={render.sleeveLimit ? 'SleeveLimits del config.txt fija el largo.' : null}>
            <Segmented label="Mangas" value={render.sleeve} disabled={Boolean(render.sleeveLimit)} onChange={v => set({ sleeve: v })}
              options={[{ value: 'short', label: 'Cortas' }, { value: 'long', label: render.undershirtOnly ? 'Largas (interior)' : 'Largas' }]} />
          </Row>
        )}
        <Row label="Medias">
          <Segmented label="Medias" value={opts.socks} onChange={v => set({ socks: v })}
            options={[{ value: 'long', label: 'Largas' }, { value: 'middle', label: 'Medias' }, { value: 'short', label: 'Cortas' }]} />
        </Row>
        <Row label="Camiseta">
          <Segmented label="Camiseta" value={opts.tuck} onChange={v => set({ tuck: v })}
            options={[{ value: 'out', label: 'Afuera' }, { value: 'in', label: 'Adentro' }]} />
        </Row>
        <Toggle checked={opts.captain} onChange={v => set({ captain: v })}>Cinta de capitán</Toggle>
      </Section>
      <p className="text-[11px] text-ink-3">Arrastrá para girar, rueda o +/− para acercar, flechas para mover, doble clic o 0 para volver al frente.</p>
    </div>
  );
}

const SIDE = { right: 'Derecha', left: 'Izquierda' };

/** Collar (picker passed as children) and the sleeve badge positions of the config. */
export function ShirtPanel({ render, collarPreview, children }) {
  const badges = Object.entries(render.badges || {}).filter(([, b]) => b);
  return (
    <div className="space-y-4">
      <Section title="Cuello">
        <p className="text-xs text-ink-3">
          {render.collar
            ? <>Mostrando el cuello <b className="text-ink num">{render.collar}</b> ({collarPreview ? 'vista previa, sin guardar' : render.collarKey === 'WinterCollar' ? 'WinterCollar, mangas largas' : 'Collar'}).</>
            : 'El config.txt no indica cuello.'}
        </p>
        {children}
      </Section>
      {badges.length > 0 && (
        <Section title={`Parches de manga · mangas ${render.sleeve === 'long' ? 'largas' : 'cortas'}`}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            {badges.map(([side, b]) => (
              <React.Fragment key={side}>
                <dt className="text-ink-3">{SIDE[side]}</dt>
                <dd className="text-ink-2">{b.off ? 'Apagado (X=31, Y=0)' : <span className="num">X {b.x} · Y {b.y}</span>}</dd>
              </React.Fragment>
            ))}
          </dl>
          <p className="text-[11px] text-ink-3">
            El parche es el escudo de la competición (badge-server de Sider), no parte del kit: esta vista lee solo el kit-server,
            así que muestra la posición configurada pero no dibuja el parche.
          </p>
        </Section>
      )}
    </div>
  );
}

const FONT_SLOTS = ['name', 'back', 'chest', 'leg'];

export function LetteringPanel({ opts, set, sample, setSample, players, nameOff, assets }) {
  const fonts = assets.filter(a => FONT_SLOTS.includes(a.slot));
  return (
    <div className="space-y-4">
      <Section>
        <Toggle checked={opts.decals} onChange={v => set({ decals: v })}>Mostrar nombre y número</Toggle>
        {players.length > 0 && (
          <select className="select min-h-11 sm:min-h-9 w-full text-xs" aria-label="Jugador del plantel" value=""
            onChange={e => { const p = players[Number(e.target.value)]; if (p) setSample({ name: p.name, number: String(p.number) }); }}>
            <option value="">Usar un jugador del plantel…</option>
            {players.map((p, i) => <option key={`${p.number}-${p.name}`} value={i}>{p.number} · {p.name}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <label className="flex-1 min-w-0">
            <span className="field-label">Nombre</span>
            <input className="input min-h-11 sm:min-h-9 text-sm" value={sample.name} maxLength={16} onChange={e => setSample(s => ({ ...s, name: e.target.value }))} />
          </label>
          <label className="w-20">
            <span className="field-label">Número</span>
            <input className="input min-h-11 sm:min-h-9 num text-center" inputMode="numeric" value={sample.number} maxLength={2}
              onChange={e => setSample(s => ({ ...s, number: e.target.value.replace(/\D/g, '') }))} />
          </label>
        </div>
        {nameOff && <p className="text-[11px] text-ink-3">Este kit tiene el nombre apagado (Name=1).</p>}
      </Section>
      <Section title="Fuentes del kit">
        <ul className="space-y-1.5">{fonts.map(a => <AssetRow key={a.slot} asset={a} compact />)}</ul>
        <p className="text-[11px] text-ink-3">Las letras y números salen de las hojas del kit (NameFontFile, BackNumbersFile, LegNumbersFile, ChestNumbersFile). La posición es una aproximación de la del juego.</p>
      </Section>
    </div>
  );
}

export function FabricPanel({ fabric, setFabric, hasNrm, hasSrm, useGenerated, canEmboss, onSave, saving }) {
  const slider = (label, key, min, max, step, disabled) => (
    <Row label={label}>
      <input type="range" className="w-full sm:w-44" min={min} max={max} step={step} value={fabric[key]} disabled={disabled}
        aria-label={label} onChange={e => setFabric(f => ({ ...f, [key]: Number(e.target.value) }))} />
    </Row>
  );
  return (
    <div className="space-y-4">
      <Section>
        <Row label="Mapas de relieve y brillo">
          <select className={SELECT} value={fabric.mode} onChange={e => setFabric(f => ({ ...f, mode: e.target.value }))}>
            <option value="auto">{hasNrm ? 'Los del kit' : hasSrm ? 'Relieve generado + brillo del kit' : 'Generados'} (automático)</option>
            <option value="kit" disabled={!hasNrm}>Los del kit (_nrm/_srm)</option>
            <option value="gen">Generar con una tela</option>
          </select>
        </Row>
      </Section>
      {useGenerated && (
        <Section title="Tela generada">
          <Row label="Tela">
            <select className={SELECT} value={fabric.fabric} onChange={e => setFabric(f => ({ ...f, fabric: e.target.value }))}>
              {FABRICS.map(f => <option key={f.k} value={f.k} title={f.d}>{f.n}</option>)}
            </select>
          </Row>
          {slider('Tamaño de la trama', 'repeat', 16, 96, 4)}
          {slider('Relieve de la trama', 'strength', 0, 1, 0.05)}
          {slider('Relieve de escudo y sponsor', 'emboss', 0, 1, 0.05, !canEmboss)}
          {onSave && (
            <Button variant="primary" disabled={saving?.busy} onClick={onSave}>
              <Save className="w-3.5 h-3.5" />{saving?.busy ? 'Generando 2048 px…' : 'Guardar nrm y srm en el kit'}
            </Button>
          )}
          {saving?.done && <p className="text-[11px] text-success-soft">{saving.done}</p>}
          {saving?.error && <p className="text-[11px] text-danger-soft" role="alert">{saving.error.message}</p>}
        </Section>
      )}
      <p className="text-[11px] text-ink-3">PES 2021 usa del kit el brillo (&lt;KitFile&gt;_srm). El relieve generado es solo para la vista previa salvo que lo guardes.</p>
    </div>
  );
}

const LEVEL = {
  ok: { icon: CheckCircle2, className: 'text-success-soft', label: 'Encontrada' },
  info: { icon: Info, className: 'text-ink-3', label: 'Información' },
  warn: { icon: AlertTriangle, className: 'text-warning-soft', label: 'Advertencia' },
  error: { icon: XCircle, className: 'text-danger-soft', label: 'Error' },
};

export function AssetRow({ asset, localAvailable, compact }) {
  const d = describeAsset(asset, { localAvailable });
  const L = LEVEL[d.level];
  const Icon = asset.status === 'empty' ? CircleDashed : L.icon;
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${L.className}`} aria-label={L.label} />
      <div className="min-w-0">
        <span className="text-ink-2">{asset.label}</span>
        {!compact && asset.width && <span className="num text-ink-3"> · {asset.width}×{asset.height} {asset.format}</span>}
        <p className={`text-[11px] break-words ${d.level === 'ok' ? 'text-ink-3' : L.className}`} title={asset.path || undefined}>{d.text}</p>
      </div>
    </li>
  );
}

function NoteList({ notes }) {
  return (
    <ul className="space-y-1.5">
      {notes.map(n => {
        const L = LEVEL[n.level === 'warn' ? 'warn' : 'info'];
        const Icon = L.icon;
        return (
          <li key={`${n.key}-${n.text}`} className={`flex items-start gap-2 text-[11px] ${L.className}`}>
            <Icon className="w-3.5 h-3.5 mt-px shrink-0" aria-label={L.label} /><span className="min-w-0">{n.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Texture sources and status, the "share" action, config.txt notes. */
export function DiagnosticsPanel({ assets, notes, local, cloud, share, canShare, pendingShare, onShare, error }) {
  const localAvailable = Boolean(local.folder?.read && local.folder.kind !== 'unknown');
  const warnings = notes.filter(n => n.level === 'warn');
  const infos = notes.filter(n => n.level !== 'warn');
  const sharedCount = cloud.files ? Object.keys(cloud.files).length : 0;
  return (
    <div className="space-y-4">
      <Section title="Texturas del kit">
        {error && <p className="text-[11px] text-danger-soft" role="alert">{error.message}</p>}
        <ul className="space-y-2">{assets.map(a => <AssetRow key={a.slot} asset={a} localAvailable={localAvailable} />)}</ul>
        <p className="text-[11px] text-ink-3">
          Orden de búsqueda: texturas importadas en el espacio → compartidas en la nube{sharedCount ? ` (${sharedCount} de este equipo)` : ''} → la carpeta del kit en esta PC.
          Solo se lee el kit-server, como hace kserv.lua con la carpeta de cada kit; las texturas de los livecpk no se buscan.
        </p>
        {cloud.error && <p className="text-[11px] text-warning-soft">No se pudo leer la lista de texturas compartidas: {cloud.error.message}</p>}
      </Section>

      <Section title="Carpeta en esta PC">
        <FolderControls local={local} />
        {canShare && (
          <div className="space-y-1.5">
            <Button variant="primary" disabled={share?.busy} onClick={onShare}>
              <CloudUpload className="w-3.5 h-3.5" />{share?.busy ? 'Subiendo…' : `Compartir ${pendingShare.length} textura(s) de este kit`}
            </Button>
            <p className="text-[11px] text-ink-3">Sube a la nube del espacio los .ftex encontrados en tu carpeta para que el resto los vea sin abrir la suya. No se suben solas.</p>
          </div>
        )}
        {share?.done && <p className="text-[11px] text-success-soft">{share.done}</p>}
        {share?.error && <p className="text-[11px] text-danger-soft" role="alert">{share.error.message}</p>}
      </Section>

      {notes.length > 0 && (
        <Section title="config.txt en la vista">
          {warnings.length > 0 ? <NoteList notes={warnings} /> : <p className="text-[11px] text-ink-3">Sin advertencias.</p>}
          {infos.length > 0 && (
            <details className="text-[11px] text-ink-3">
              <summary className="cursor-pointer min-h-9 flex items-center">Detalles ({infos.length})</summary>
              <div className="pt-1"><NoteList notes={infos} /></div>
            </details>
          )}
        </Section>
      )}
    </div>
  );
}

function FolderControls({ local }) {
  const { folder, error } = local;
  return (
    <div className="space-y-1.5">
      {folder?.read && folder.kind !== 'unknown' && (
        <p className="text-[11px] text-ink-3">Leyendo <b className="text-ink-2">{folder.name}</b> ({folder.kind === 'game' ? 'carpeta del juego' : 'carpeta kit-server'}). Solo lectura: nada se sube sin tu permiso.</p>
      )}
      {folder?.pending && <Button onClick={local.allow}><FolderOpen className="w-3.5 h-3.5" />Permitir leer «{folder.name}»</Button>}
      {local.canPick ? (
        <Button onClick={local.pick}><FolderOpen className="w-3.5 h-3.5" />{folder?.read ? 'Cambiar carpeta' : 'Abrir carpeta del juego o del kit-server'}</Button>
      ) : (
        <label className="block text-[11px] text-ink-3">Elegí la carpeta del kit-server (content/kit-server):
          <input type="file" webkitdirectory="" multiple className="mt-1 block w-full text-[11px]" onChange={e => e.target.files?.length && local.fromFiles(e.target.files)} />
        </label>
      )}
      {error && <p className="text-[11px] text-danger-soft" role="alert">{error.message}</p>}
    </div>
  );
}
