import React, { useEffect, useState } from 'react';

const enc = new TextEncoder();

/**
 * Text input that becomes an operation on blur or Enter (Escape restores the stored value), like
 * FieldInput. `maxBytes` shows a UTF-8 byte counter: the game stores names as fixed byte budgets.
 * Field (components/ui) clones this element to wire id, aria-describedby and aria-invalid.
 */
export function CommitText({ value, onCommit, maxBytes, maxLength, disabled, modified, transform = v => v, className = '', ...aria }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const bytes = maxBytes ? enc.encode(draft || '').length : 0;
  const commit = () => {
    const next = transform(draft ?? '');
    if (next !== value) onCommit(next);
    else setDraft(value);
  };
  return (
    <div className="relative">
      <input type="text" value={draft ?? ''} disabled={disabled} maxLength={maxLength} {...aria}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') setDraft(value);
        }}
        className={`input w-full ${maxBytes ? 'pr-16' : ''} ${modified ? 'border-accent/50' : ''} ${className}`} />
      {maxBytes > 0 && (
        <span className={`num absolute right-3 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none ${bytes > maxBytes ? 'text-warning-soft' : 'text-ink-3'}`} aria-hidden="true">
          {bytes}/{maxBytes}
        </span>
      )}
    </div>
  );
}
