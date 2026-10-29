import React, { useState } from 'react';
import { Shirt, FolderX } from 'lucide-react';
import { Card, Pill, ModifiedDot } from '../../PesUi.jsx';
import { Alert } from '../../../ui/Alert.jsx';
import { EmptyState } from '../../../ui/EmptyState.jsx';
import { KIT_EDITABLE_KEYS, COLOR_KEYS, TEXTURE_KEYS, kitPreviewModel } from '../../../../pes/kits/kitConfig.js';
import { PesKitTextures } from '../../PesKitTextures.jsx';
import { PesKit3DViewer } from '../../PesKit3DViewer.jsx';
import { PesAddKit } from '../../PesAddKit.jsx';
import { opKey } from '../../opKeys.js';

const PLAYER_LABELS = { p1: 'Titular', p2: 'Suplente', p3: 'Alternativa', p4: 'Cuarto kit' };

/** Readable name of a kit folder (Sider: p* player kits, g* goalkeeper kits). */
export function kitLabel(kit, category) {
  const leaf = kit.split('/').pop().toLowerCase();
  if (PLAYER_LABELS[leaf]) return PLAYER_LABELS[leaf];
  if (leaf === 'g1') return 'Arquero';
  if (category === 'goalkeeper') return 'Arquero alternativo';
  if (category === 'player') return 'Kit de jugador';
  return 'Otro';
}

/** Colour schematic built only from config.txt values (not a texture render). */
function KitSchematic({ model }) {
  const c = v => (/^#[0-9A-F]{6}$/i.test(v || '') ? v : '#4a5468');
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 150" className="w-36 h-44" role="img" aria-label="Esquema de colores del kit">
        <path d="M35 10 L50 4 Q60 12 70 4 L85 10 L110 30 L98 48 L88 40 L88 92 L32 92 L32 40 L22 48 L10 30 Z" fill={c(model.shirtColor1)} stroke="rgb(var(--c-canvas))" strokeWidth="1.5" />
        <path d="M50 4 Q60 12 70 4 L72 14 Q60 22 48 14 Z" fill={c(model.shirtColor2)} />
        <rect x="32" y="92" width="56" height="8" fill={c(model.undershirtColor)} opacity="0.85" />
        <path d="M32 100 L88 100 L92 124 L64 124 L60 112 L56 124 L28 124 Z" fill={c(model.shortsColor)} stroke="rgb(var(--c-canvas))" strokeWidth="1.5" />
        <rect x="34" y="127" width="14" height="20" rx="2" fill={c(model.socksColor)} />
        <rect x="72" y="127" width="14" height="20" rx="2" fill={c(model.socksColor)} />
      </svg>
      <figcaption className="text-xs text-ink-3 text-center max-w-[12rem]">
        Esquema con los colores del config.txt. No es la textura del kit.
      </figcaption>
      <div className="flex gap-3 text-xs text-ink-3">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block border border-line/30" style={{ background: c(model.menuColor1) }} />UniColor 1</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block border border-line/30" style={{ background: c(model.menuColor2) }} />UniColor 2</span>
      </div>
    </figure>
  );
}

function KitValueInput({ line, readOnly, modified, onCommit }) {
  const [draft, setDraft] = useState(line.value);
  React.useEffect(() => setDraft(line.value), [line.value]);
  const editable = !readOnly && KIT_EDITABLE_KEYS.includes(line.key);
  const commit = v => { if (editable && v !== line.value) onCommit(v); };
  // The colour picker previews while dragging and commits once when it closes (native `change`), like
  // ColourField: React's onChange fires on every drag step and each one created a draft.
  const colourRef = React.useRef(null);
  const commitRef = React.useRef(commit);
  commitRef.current = commit;
  React.useEffect(() => {
    const el = colourRef.current;
    if (!el) return undefined;
    const onNativeChange = () => commitRef.current(el.value.toUpperCase());
    el.addEventListener('change', onNativeChange);
    return () => el.removeEventListener('change', onNativeChange);
  }, [line.key]);
  const base = `w-full input ${modified ? 'border-accent/50' : ''}`;
  let control;
  if (COLOR_KEYS.includes(line.key)) {
    control = (
      <div className="flex gap-2">
        <input ref={colourRef} type="color" value={/^#[0-9A-F]{6}$/i.test(draft) ? draft : '#000000'} disabled={!editable} onChange={e => setDraft(e.target.value.toUpperCase())} aria-label={`${line.key}: color`}
          className="w-11 h-10 shrink-0 rounded-lg border border-line/[0.16] bg-raised p-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" />
        <input value={draft} disabled={!editable} onChange={e => setDraft(e.target.value)} onBlur={() => commit(draft)}
          onKeyDown={e => { if (e.key === 'Enter') commit(draft); if (e.key === 'Escape') setDraft(line.value); }} aria-label={`${line.key}: valor`} className={`${base} num uppercase`} />
      </div>
    );
  } else if (line.constraint?.type === 'enum') {
    control = (
      <select value={draft} disabled={!editable} onChange={e => { setDraft(e.target.value); commit(e.target.value); }} className={`select ${modified ? 'border-accent/50' : ''}`}>
        {!line.constraint.values.map(String).includes(draft) && <option value={draft}>{draft} (fuera de lista)</option>}
        {line.constraint.values.map(v => <option key={v} value={String(v)}>{v}{line.constraint.labels[v] ? `: ${line.constraint.labels[v]}` : ''}</option>)}
      </select>
    );
  } else {
    const isNum = line.constraint?.type === 'range';
    // A cleared number field goes back to its value instead of committing 0.
    const commitNumberOrText = () => (isNum && String(draft).trim() === '' ? setDraft(line.value) : commit(draft));
    control = <input type={isNum ? 'number' : 'text'} min={line.constraint?.min} max={line.constraint?.max} value={draft} disabled={!editable}
      onChange={e => setDraft(e.target.value)} onBlur={commitNumberOrText}
      onKeyDown={e => { if (e.key === 'Enter') commitNumberOrText(); if (e.key === 'Escape') setDraft(line.value); }} className={`${base} ${isNum ? 'num' : ''}`} />;
  }
  return (
    <label className={`flex flex-col gap-1 text-xs ${modified ? 'text-accent-soft' : 'text-ink-2'}`}>
      <span className="flex items-center gap-1.5 min-w-0" title={line.comment}>
        <span className="truncate font-mono">{line.key}</span>
        {modified && <ModifiedDot />}
        {line.constraint?.type === 'range' && <span className="num ml-auto shrink-0 text-ink-3">{line.constraint.min}–{line.constraint.max}</span>}
      </span>
      {control}
    </label>
  );
}

/** Players of a team (EDIT roster, names from the EDIT or Player.bin) for the name/number preview. */
function squadOf(ws, teamId) {
  if (!ws?.edit?.teams.has(teamId)) return [];
  const nameOf = id => (ws.edit.players.has(id) ? ws.edit.readPlayer(id).shirt || ws.edit.readPlayer(id).name
    : ws.bin?.tables.player?.has(id) ? ws.bin.tables.player.get(id, 'shirt') || ws.bin.tables.player.get(id, 'name') : String(id));
  return ws.edit.roster(teamId).map(r => ({ name: nameOf(r.playerId), number: r.number }));
}

/** Splits config lines into the sections marked by "; section" comment lines. */
function sections(cfg) {
  const out = [];
  let cur = { title: 'General', lines: [] };
  for (const l of cfg.lines) {
    if (l.type === 'other' && /^\s*;\s*[a-z]/i.test(l.raw) && !/processed with/i.test(l.raw)) {
      if (cur.lines.length) out.push(cur);
      cur = { title: l.raw.replace(/^\s*;\s*/, ''), lines: [] };
    } else if (l.type === 'kv') cur.lines.push(l);
  }
  if (cur.lines.length) out.push(cur);
  return out;
}

const firstKit = list => (list.find(k => k.category === 'player') || list[0])?.kit ?? null;

/** «Kits»: the team's kit-server kits, 3D view, config.txt values and textures. Mount with key={teamId}. */
export function KitsSection({ pes, teamId, access, onApply }) {
  const { ws, version, modified } = pes;
  const kits = ws.kits;
  const hasFolder = Boolean(kits?.map.has(teamId));
  const kitList = hasFolder ? kits.kitsOf(teamId) : [];
  const [picked, setKit] = useState(() => firstKit(kitList));
  // A kit added and then discarded disappears from the list: fall back instead of showing nothing.
  const kit = kitList.some(k => k.kit === picked) ? picked : firstKit(kitList);
  const [error, setError] = useState(null);

  if (!kits) {
    return <EmptyState icon={Shirt} title="Sin kit-server" description="Cargá la carpeta kit-server del Parche en «Fuentes» para ver y editar los kits." />;
  }
  if (!hasFolder) {
    return <EmptyState icon={FolderX} title="Sin carpeta de kits" description="Este equipo no tiene carpeta en el kit-server: sus kits están dentro de los .cpk del juego." />;
  }

  const cfg = kit ? kits.getConfig(teamId, kit) : null;
  const editable = access.kits;
  const apply = async ops => {
    setError(null);
    try { await onApply(ops); } catch (e) { setError(e); }
  };
  // config.txt values chosen in the 3D view (collar picker): same kit.set operations as the value inputs.
  // Unlike apply(), errors propagate so the picker can show them next to its button.
  const setValues = values => onApply(Object.entries(values).map(([key, value]) => ({ type: 'kit.set', target: { teamId, kit }, key, value })));
  // Same path as the texture import in PesKitTextures: content-addressed asset + kit.texture.set.
  const importTexture = async (slot, file, tex) => {
    const sha = await pes.registerAsset(tex.bytes);
    await onApply([{ type: 'kit.texture.set', target: { teamId, kit }, slot: slot.slot, value: file, ext: tex.ext, asset: { sha256: sha } }]);
  };

  return (
    <div className="space-y-4">
      <Card title="Kits" description={<span className="font-mono">{kits.map.get(teamId)}</span>}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kits del equipo">
          {kitList.map(k => {
            const selected = k.kit === kit;
            return (
              <button key={k.kit} type="button" onClick={() => setKit(k.kit)} aria-pressed={selected}
                className={`flex items-center gap-2 min-h-11 px-3 rounded-lg text-left border transition-colors ${selected ? 'border-accent bg-accent-deep text-ink' : 'border-line/[0.14] text-ink-2 hover:bg-overlay hover:text-ink'}`}>
                <Shirt className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">{kitLabel(k.kit, k.category)}{k.modified && <span className="sr-only"> (modificado)</span>}</span>
                  <span className="num text-[11px] text-ink-3">{k.kit}</span>
                </span>
                {!k.inOrder ? <Pill tone="amber">no está en order.ini</Pill> : k.modified && <Pill tone="accent">modificado</Pill>}
              </button>
            );
          })}
        </div>
        {editable
          ? <div className="mt-3"><PesAddKit kits={kits} teamId={teamId} version={version} onApply={onApply} onCreated={setKit} /></div>
          : <p className="mt-3 field-help">{access.outOfLeague ? 'Fuera de la liga: solo lectura para tu rol.' : 'Solo lectura para tu rol.'}</p>}
      </Card>
      {error && <Alert tone="danger">{error.message || String(error)}</Alert>}
      {cfg && (
        <Card title={`Vista 3D · ${kitLabel(kit, kitList.find(k => k.kit === kit)?.category)}`}>
          <PesKit3DViewer kits={kits} teamId={teamId} kit={kit} cfg={cfg} version={version} players={squadOf(ws, teamId)}
            workspaceId={pes.activeId} uid={pes.actor?.uid} canShare={editable}
            onImportTexture={editable ? importTexture : undefined} onSetValues={editable ? setValues : undefined} />
        </Card>
      )}
      {cfg && (
        <div className="grid gap-4 xl:grid-cols-[1fr_14rem]">
          <div className="space-y-4">
            {sections(cfg).filter(s => !s.lines.every(l => TEXTURE_KEYS.includes(l.key))).map(s => (
              <Card key={s.title} title={s.title}>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {s.lines.filter(l => !TEXTURE_KEYS.includes(l.key)).map(l => (
                    <KitValueInput key={l.key} line={l} readOnly={!editable}
                      modified={modified.has(opKey({ type: 'kit.set', target: { teamId, kit }, key: l.key }))}
                      onCommit={value => apply([{ type: 'kit.set', target: { teamId, kit }, key: l.key, value }])} />
                  ))}
                </div>
              </Card>
            ))}
            <PesKitTextures pes={pes} teamId={teamId} kit={kit} cfg={cfg} editable={editable} onApply={apply} />
          </div>
          <Card title="Colores"><KitSchematic model={kitPreviewModel(cfg)} /></Card>
        </div>
      )}
    </div>
  );
}
