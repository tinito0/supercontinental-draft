import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import { fieldRange } from '../../pes/core/fields.js';

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-[#0c1017]/80 border border-white/[0.08] p-4 ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 mb-3">
          {title && <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const BTN = {
  primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
  danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30',
  ghost: 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08]',
};

export function Button({ variant = 'ghost', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${BTN[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Pill({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-white/[0.06] text-slate-300',
    green: 'bg-emerald-500/15 text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-300',
    red: 'bg-red-500/15 text-red-300',
    cyan: 'bg-cyan-500/15 text-cyan-300',
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

export function ConfidenceBadge({ confidence }) {
  if (confidence === 'verified') return <span title="Verificado con datos reales"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /></span>;
  if (confidence === 'structural') return <span title="Evidencia estructural: revisá el resultado en el juego"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /></span>;
  return <span title="Significado sin verificar: solo lectura"><Lock className="w-3.5 h-3.5 text-slate-500" /></span>;
}

export function ErrorText({ error }) {
  if (!error) return null;
  return <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error.message || String(error)}</p>;
}

/**
 * Edits one engine field. Commits on blur/Enter; the parent turns the change into an operation.
 * @param {{ field: object, value: any, readOnly?: boolean, onCommit: (value: any) => void, label?: string, modified?: boolean }} props
 */
export function FieldInput({ field, value, readOnly, onCommit, label, modified }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const locked = readOnly || field.confidence === 'unverified' || field.confidence === 'partial';
  const range = field.kind === 'string' ? null : fieldRange(field);

  const commit = next => {
    if (locked) return;
    let v = next;
    if (field.kind === 'bool') v = Boolean(next);
    else if (field.kind !== 'string') v = Number(next);
    if (v !== value) onCommit(v);
  };

  let control;
  if (field.kind === 'bool') {
    control = <input type="checkbox" checked={Boolean(draft)} disabled={locked} onChange={e => { setDraft(e.target.checked); commit(e.target.checked); }} className="accent-cyan-500" />;
  } else {
    control = (
      <input
        type={field.kind === 'string' ? 'text' : 'number'}
        value={draft ?? ''}
        min={range?.min}
        max={range?.max}
        maxLength={field.kind === 'string' ? field.length - 1 : undefined}
        disabled={locked}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={e => { if (e.key === 'Enter') commit(draft); if (e.key === 'Escape') setDraft(value); }}
        className="w-full bg-[#111722] border border-white/[0.08] rounded-md px-2 py-1 text-xs text-white disabled:text-slate-500"
      />
    );
  }
  return (
    <label className={`flex flex-col gap-1 text-[11px] ${modified ? 'text-cyan-300' : 'text-slate-400'}`}>
      <span className="flex items-center gap-1">
        {field.confidence && <ConfidenceBadge confidence={field.confidence} />}
        {label || field.name}
        {range && field.kind !== 'bool' && <span className="text-slate-600">({range.min}–{range.max})</span>}
        {modified && <span className="text-cyan-400">•</span>}
      </span>
      {control}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-[#111722] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500"
    />
  );
}

/** Download helper for exported bytes (app context, not an artifact sandbox). */
export function downloadBytes(bytes, name, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
