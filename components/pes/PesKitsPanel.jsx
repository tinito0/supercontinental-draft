import React, { useMemo, useState } from 'react';
import { Shirt } from 'lucide-react';
import { Card, Pill, SearchInput, ErrorText } from './PesUi.jsx';
import { KIT_EDITABLE_KEYS, COLOR_KEYS, TEXTURE_KEYS, kitPreviewModel } from '../../pes/kits/kitConfig.js';
import { PesKitTextures } from './PesKitTextures.jsx';
import { PesKit3DViewer } from './PesKit3DViewer.jsx';
import { PesAddKit } from './PesAddKit.jsx';
import { opKey } from './opKeys.js';

/** Colour schematic built only from config.txt values (not a texture render). */
function KitSchematic({ model }) {
  const c = v => (/^#[0-9A-F]{6}$/i.test(v || '') ? v : '#334155');
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 150" className="w-36 h-44" role="img" aria-label="Esquema de colores del kit">
        <path d="M35 10 L50 4 Q60 12 70 4 L85 10 L110 30 L98 48 L88 40 L88 92 L32 92 L32 40 L22 48 L10 30 Z" fill={c(model.shirtColor1)} stroke="#0f172a" strokeWidth="1.5" />
        <path d="M50 4 Q60 12 70 4 L72 14 Q60 22 48 14 Z" fill={c(model.shirtColor2)} />
        <rect x="32" y="92" width="56" height="8" fill={c(model.undershirtColor)} opacity="0.85" />
        <path d="M32 100 L88 100 L92 124 L64 124 L60 112 L56 124 L28 124 Z" fill={c(model.shortsColor)} stroke="#0f172a" strokeWidth="1.5" />
        <rect x="34" y="127" width="14" height="20" rx="2" fill={c(model.socksColor)} />
        <rect x="72" y="127" width="14" height="20" rx="2" fill={c(model.socksColor)} />
      </svg>
      <figcaption className="text-[10px] text-ink-3 text-center max-w-[12rem]">
        Esquema con los colores del config.txt. No es la textura del kit.
      </figcaption>
      <div className="flex gap-2 text-[10px] text-ink-3">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: c(model.menuColor1) }} />UniColor 1</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-sm inline-block" style={{ background: c(model.menuColor2) }} />UniColor 2</span>
      </div>
    </figure>
  );
}

function KitValueInput({ line, readOnly, modified, onCommit }) {
  const [draft, setDraft] = useState(line.value);
  React.useEffect(() => setDraft(line.value), [line.value]);
  const editable = !readOnly && KIT_EDITABLE_KEYS.includes(line.key);
  const commit = v => { if (editable && v !== line.value) onCommit(v); };
  const base = 'w-full input min-h-9';
  let control;
  if (COLOR_KEYS.includes(line.key)) {
    control = (
      <div className="flex gap-1">
        <input type="color" value={/^#[0-9A-F]{6}$/i.test(draft) ? draft : '#000000'} disabled={!editable} onChange={e => { setDraft(e.target.value.toUpperCase()); commit(e.target.value.toUpperCase()); }} className="w-8 h-7 bg-transparent" />
        <input value={draft} disabled={!editable} onChange={e => setDraft(e.target.value)} onBlur={() => commit(draft)} className={base} />
      </div>
    );
  } else if (line.constraint?.type === 'enum') {
    control = (
      <select value={draft} disabled={!editable} onChange={e => { setDraft(e.target.value); commit(e.target.value); }} className="w-full select min-h-9">
        {!line.constraint.values.map(String).includes(draft) && <option value={draft}>{draft} (fuera de lista)</option>}
        {line.constraint.values.map(v => <option key={v} value={String(v)}>{v}{line.constraint.labels[v] ? ` — ${line.constraint.labels[v]}` : ''}</option>)}
      </select>
    );
  } else {
    const isNum = line.constraint?.type === 'range';
    control = <input type={isNum ? 'number' : 'text'} min={line.constraint?.min} max={line.constraint?.max} value={draft} disabled={!editable}
      onChange={e => setDraft(e.target.value)} onBlur={() => commit(draft)} onKeyDown={e => e.key === 'Enter' && commit(draft)} className={base} />;
  }
  return (
    <label className={`flex flex-col gap-1 text-[11px] ${modified ? 'text-accent-soft' : 'text-ink-3'}`}>
      <span title={line.comment}>{line.key}{line.constraint?.type === 'range' && <span className="text-ink-3"> ({line.constraint.min}–{line.constraint.max})</span>}{modified && ' •'}</span>
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

export function PesKitsPanel({ pes, onApply }) {
  const { ws, caps, version, modified, wsDoc } = pes;
  const [q, setQ] = useState('');
  const [teamId, setTeamId] = useState(null);
  const [kit, setKit] = useState(null);
  const [error, setError] = useState(null);
  const kits = ws?.kits;
  const league = wsDoc?.leagueTeamIds || [];
  const canEditTeam = id => caps.has('kit.edit') && (caps.has('workspace.manage') || !league.length || league.includes(id));

  const teams = useMemo(() => {
    if (!kits) return [];
    const nameOf = id => (ws.bin?.tables.team?.has(id) ? ws.bin.tables.team.get(id, 'nameEnglish') : null);
    return kits.teamIds().map(id => ({ id, folder: kits.map.get(id), name: nameOf(id) || kits.map.get(id).split('/').pop() }));
  }, [kits, ws, version]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? teams.filter(t => String(t.id) === s || t.name.toLowerCase().includes(s) || t.folder.toLowerCase().includes(s)) : teams).slice(0, 300);
  }, [teams, q]);

  if (!kits) return <Card><p className="text-xs text-ink-3">Cargá la carpeta kit-server del Parche para editar kits.</p></Card>;

  const kitList = teamId != null ? kits.kitsOf(teamId) : [];
  const players = teamId != null ? squadOf(ws, teamId) : [];
  const cfg = teamId != null && kit ? kits.getConfig(teamId, kit) : null;
  const editable = teamId != null && canEditTeam(teamId);

  const apply = async ops => {
    setError(null);
    try { await onApply(ops); } catch (e) { setError(e); }
  };
  // Same path as the texture import in PesKitTextures: content-addressed asset + kit.texture.set.
  const importTexture = async (slot, file, tex) => {
    const sha = await pes.registerAsset(tex.bytes);
    await onApply([{ type: 'kit.texture.set', target: { teamId, kit }, slot: slot.slot, value: file, ext: tex.ext, asset: { sha256: sha } }]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card title={`Equipos con kits (${teams.length})`}>
        <SearchInput value={q} onChange={setQ} placeholder="Equipo, liga o id" />
        <ul className="mt-2 max-h-[60vh] overflow-y-auto space-y-0.5">
          {filtered.map(t => (
            <li key={t.id}>
              <button type="button" onClick={() => { setTeamId(t.id); setKit(null); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${t.id === teamId ? 'bg-accent/15 text-ink' : 'text-ink-2 hover:bg-white/[0.04]'}`}>
                <span className="text-ink-3 mr-2">{t.id}</span>{t.name}
                {!canEditTeam(t.id) && caps.has('kit.edit') && <Pill>fuera de la liga</Pill>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {teamId == null && <Card><p className="text-xs text-ink-3">Elegí un equipo para ver sus kits.</p></Card>}
        {teamId != null && (
          <Card title={`Kits · ${kits.map.get(teamId)}`}>
            <div className="flex flex-wrap gap-2">
              {kitList.map(k => (
                <button key={k.kit} type="button" onClick={() => setKit(k.kit)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${k.kit === kit ? 'border-accent/60 bg-accent/10 text-ink' : 'border-line/[0.12] text-ink-2 hover:bg-white/[0.04]'}`}>
                  <Shirt className="w-3.5 h-3.5" />{k.kit}
                  <Pill tone={k.category === 'goalkeeper' ? 'amber' : 'slate'}>{k.category === 'goalkeeper' ? 'arquero' : k.category === 'player' ? 'jugador' : 'otro'}</Pill>
                  {!k.inOrder && <Pill>no está en order.ini</Pill>}
                  {k.modified && <span className="text-accent">•</span>}
                </button>
              ))}
            </div>
            {editable && <div className="mt-3"><PesAddKit kits={kits} teamId={teamId} version={version} onApply={onApply} onCreated={setKit} /></div>}
            {!editable && <p className="mt-2 text-[11px] text-ink-3">Solo lectura para tu rol en este equipo.</p>}
          </Card>
        )}
        <ErrorText error={error} />
        {cfg && (
          <Card title={`Vista 3D · ${kit}`}>
            <PesKit3DViewer kits={kits} teamId={teamId} kit={kit} cfg={cfg} version={version} players={players} onImportTexture={editable ? importTexture : undefined} />
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
    </div>
  );
}
