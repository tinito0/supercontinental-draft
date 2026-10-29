import React, { useState, useEffect, useId, useRef } from 'react';
import { ShieldCheck, AlertTriangle, Lock, Search, XCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import { fieldRange } from '../../pes/core/fields.js';
import { Alert } from '../ui/Alert.jsx';
import { useStatusSwap } from '../../hooks/useStatusSwap.js';

// Shared building blocks of the PES editor, on the app design system (docs/DESIGN_SYSTEM.md):
// a region is a panel, groups inside it are separated by hairlines and spacing, not nested cards.

/** "1 archivo", "3 archivos": the word for a count (the number is rendered by the caller). */
export const plural = (n, one, many) => (n === 1 ? one : many);

/** One region of the editor: section title, optional description and actions, content. */
export function Card({ title, description, actions, children, className = '', flush = false }) {
  return (
    <section className={`panel-flat ${flush ? '' : 'p-4 sm:p-5'} ${className}`}>
      {(title || actions) && (
        <header className={`flex flex-wrap items-end justify-between gap-3 ${flush ? 'px-4 pt-4 sm:px-5 sm:pt-5' : ''} mb-4`}>
          <div className="min-w-0">
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="mt-1 text-xs text-ink-3 max-w-[65ch]">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Group inside a region: small uppercase label over its content, separated by a hairline. */
export function Group({ title, aside, children, className = '' }) {
  return (
    <div className={`border-t border-line/[0.08] pt-4 first:border-t-0 first:pt-0 ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          {title && <h3 className="eyebrow">{title}</h3>}
          {aside && <div className="text-xs text-ink-3">{aside}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const BTN = { primary: 'btn-primary', danger: 'btn-danger', ghost: 'btn-secondary', quiet: 'btn-ghost', success: 'btn-success' };

export function Button({ variant = 'ghost', className = '', children, ...props }) {
  return (
    <button type="button" className={`btn btn-sm ${BTN[variant] || BTN.ghost} ${className}`} {...props}>
      {children}
    </button>
  );
}

/**
 * A button for something that cannot be undone: the first click turns it, in place, into the question with
 * «Cancelar» and the confirm button (focus moves to «Cancelar»; Escape cancels and returns to the button).
 * `needsConfirm={false}` runs the action at once. Replaces window.confirm in the editor.
 */
export function ConfirmAction({
  label, question, confirmLabel, onConfirm, icon: Icon, iconOnly = false, needsConfirm = true, disabled, title, className = '',
  variant = 'danger',
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);
  const wasOpen = useRef(false);
  const questionId = useId();

  useEffect(() => {
    if (open) cancelRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button ref={triggerRef} type="button" disabled={disabled} title={title} aria-label={iconOnly ? label : undefined}
        onClick={() => (needsConfirm ? setOpen(true) : onConfirm())}
        className={`btn btn-sm ${iconOnly ? 'btn-ghost btn-icon' : BTN[variant] || BTN.danger} ${className}`}>
        {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
        {!iconOnly && label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={label} aria-describedby={questionId}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
      className="animate-in fade-in basis-full w-full flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-danger/30 bg-danger/[0.07] px-3 py-2">
      <p id={questionId} className="min-w-0 flex-1 basis-56 text-sm text-ink-2">{question}</p>
      <div className="flex gap-2">
        <button ref={cancelRef} type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="btn btn-danger btn-sm" disabled={disabled} onClick={() => { setOpen(false); onConfirm(); }}>
          {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}{confirmLabel}
        </button>
      </div>
    </div>
  );
}

/** <details> with a chevron that flips when it opens. Content appears without animating its height. */
export function Disclosure({ summary, children, className = '', summaryClassName = '' }) {
  return (
    <details className={`disclosure ${className}`}>
      <summary className={`flex items-center gap-1.5 min-h-11 cursor-pointer select-none rounded-md hover:text-ink transition-colors ${summaryClassName}`}>
        <ChevronDown className="disclosure-chevron w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{summary}</span>
      </summary>
      {children}
    </details>
  );
}

const DOT = { slate: 'bg-ink-3', green: 'bg-success', amber: 'bg-warning', red: 'bg-danger', cyan: 'bg-accent', accent: 'bg-accent' };
const TEXT = { slate: 'text-ink-3', green: 'text-success-soft', amber: 'text-warning-soft', red: 'text-danger-soft', cyan: 'text-accent-soft', accent: 'text-accent-soft' };

/**
 * State marker: a dot plus text (state is never told by colour alone). Plain metadata should be plain
 * text, not a Pill.
 */
export function Pill({ tone = 'slate', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${TEXT[tone] || TEXT.slate} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[tone] || DOT.slate}`} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * A state Pill that steps to the next state in place (transitions.dev "Text states swap", `.status-swap`): the old
 * one leaves 4px up, the new one enters from below. Use for one state that changes, e.g. «Todo guardado».
 */
export function StatePill({ tone, children }) {
  const { shown, isLeaving } = useStatusSwap(`${tone}|${children}`);
  if (shown == null) return null;
  const [shownTone, ...text] = shown.split('|');
  return (
    <span key={shown} className="status-swap" data-leaving={isLeaving || undefined}>
      <Pill tone={shownTone}>{text.join('|')}</Pill>
    </span>
  );
}

/** Marks a field whose value differs from the original files. Pops in once when the edit lands. */
export function ModifiedDot() {
  return <span role="img" aria-label="modificado" title="Modificado" className="animate-in fade-in zoom-in-50 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />;
}

const ISSUE = {
  error: { icon: XCircle, className: 'text-danger-soft', label: 'Error' },
  warning: { icon: AlertTriangle, className: 'text-warning-soft', label: 'Advertencia' },
  ok: { icon: CheckCircle2, className: 'text-success-soft', label: 'Listo' },
};

/** One line of a checklist or validation result, with an icon instead of a symbol character. */
export function Issue({ tone = 'error', children, as: Tag = 'p' }) {
  const t = ISSUE[tone] || ISSUE.error;
  const Icon = t.icon;
  return (
    <Tag className={`flex items-start gap-2 ${t.className}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-label={t.label} />
      <span className="min-w-0">{children}</span>
    </Tag>
  );
}

export function ConfidenceBadge({ confidence }) {
  if (confidence === 'verified') return <span title="Verificado con datos reales"><ShieldCheck className="w-3.5 h-3.5 text-success" aria-label="Verificado" /></span>;
  if (confidence === 'structural') return <span title="Evidencia estructural: revisá el resultado en el juego"><AlertTriangle className="w-3.5 h-3.5 text-warning" aria-label="Sin verificar del todo" /></span>;
  return <span title="Significado sin verificar: solo lectura"><Lock className="w-3.5 h-3.5 text-ink-3" aria-label="Solo lectura" /></span>;
}

export function ErrorText({ error, className = '' }) {
  if (!error) return null;
  return <Alert tone="danger" className={className}>{error.message || String(error)}</Alert>;
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

  const title = (
    <span className="flex items-center gap-1.5 min-w-0">
      {field.confidence && <ConfidenceBadge confidence={field.confidence} />}
      <span className="truncate">{label || field.name}</span>
      {modified && <ModifiedDot />}
    </span>
  );

  if (field.kind === 'bool') {
    return (
      <label className={`flex items-center gap-2 min-h-10 text-xs ${modified ? 'text-accent-soft' : 'text-ink-2'} ${locked ? '' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={Boolean(draft)} disabled={locked} onChange={e => { setDraft(e.target.checked); commit(e.target.checked); }} className="w-4 h-4 accent-[rgb(var(--c-accent))]" />
        {title}
      </label>
    );
  }
  return (
    <label className={`flex flex-col gap-1 text-xs ${modified ? 'text-accent-soft' : 'text-ink-2'}`}>
      <span className="flex items-center justify-between gap-2">
        {title}
        {range && <span className="num text-[11px] text-ink-3 shrink-0">{range.min}–{range.max}</span>}
      </span>
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
        className={`input text-sm ${field.kind === 'string' ? '' : 'num'} ${modified ? 'border-accent/50' : ''}`}
      />
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder, label }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        className="input pl-9"
      />
    </div>
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
