import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, ErrorText } from './PesUi.jsx';

/**
 * Adds a kit to a team as a copy of one of its kits; the new folder (p<n>/g<n>) is listed in
 * order.ini / gk_order.ini under the chosen section. New textures are imported afterwards.
 */
export function PesAddKit({ kits, teamId, version, onApply, onCreated }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('player');
  const [from, setFrom] = useState('');
  const [section, setSection] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const templates = useMemo(() => kits.kitsOf(teamId).filter(k => k.category === category), [kits, teamId, category, version]);
  const sections = useMemo(() => Object.keys(kits.orderSections(teamId, category)).filter(s => s !== 'default' || kits.orderSections(teamId, category).default.length), [kits, teamId, category, version]);
  const name = kits.nextKitName(teamId, category);
  const source = templates.some(t => t.kit === from) ? from : templates[0]?.kit || '';
  const target = sections.includes(section) ? section : sections[0] || 'default';

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      await onApply([{ type: 'kit.add', target: { teamId }, value: { kit: name, from: source, section: target } }]);
      setOpen(false);
      onCreated?.(name);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />Agregar kit</Button>;
  const sel = 'input min-h-9';
  return (
    <div className="mt-3 rounded-lg border border-line/[0.12] p-3 space-y-2 text-xs text-ink-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">Tipo
          <select className={sel} value={category} onChange={e => { setCategory(e.target.value); setFrom(''); setSection(''); }}>
            <option value="player">Jugador (order.ini)</option>
            <option value="goalkeeper">Arquero (gk_order.ini)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">Copiar de
          <select className={sel} value={source} onChange={e => setFrom(e.target.value)} disabled={!templates.length}>
            {templates.map(t => <option key={t.kit} value={t.kit}>{t.kit}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Sección del orden
          <select className={sel} value={target} onChange={e => setSection(e.target.value)}>
            {(sections.length ? sections : ['default']).map(s => <option key={s} value={s}>{s === 'default' ? '(sin sección)' : `[${s}]`}</option>)}
          </select>
        </label>
        <span className="pb-1">Carpeta nueva: <b className="text-ink">{name}</b></span>
      </div>
      <p className="text-[11px] text-ink-3">
        Se copian los valores del config.txt (incluidos los nombres de textura). Después importá la textura propia del kit nuevo con otro nombre en «Texturas del kit»;
        si no, comparte las del kit copiado.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" disabled={busy || !source} onClick={add}><Plus className="w-3.5 h-3.5" />{busy ? 'Agregando…' : `Crear ${name}`}</Button>
        <Button onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {!templates.length && <p className="text-[11px] text-warning-soft">El equipo no tiene kits de este tipo para copiar.</p>}
      <ErrorText error={error} />
    </div>
  );
}
