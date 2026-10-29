import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Colour picker that previews while the user drags and commits once, when the picker closes.
 * React's onChange follows the native `input` event (every drag step); the native `change` event fires
 * only on commit, so it is listened to directly. `onPreview(hex|null)` lets the header show the colour live.
 */
export function ColourField({ label, value, disabled, modified, describedBy, onPreview, onCommit }) {
  const id = useId();
  const ref = useRef(null);
  const [draft, setDraft] = useState(value);
  const latest = useRef({ value, onCommit, onPreview });
  latest.current = { value, onCommit, onPreview };

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const commit = () => {
      const { value: current, onCommit: commitFn, onPreview: previewFn } = latest.current;
      previewFn?.(null);
      if (el.value.toLowerCase() !== current.toLowerCase()) commitFn(el.value);
    };
    el.addEventListener('change', commit);
    return () => el.removeEventListener('change', commit);
  }, []);

  return (
    <div className="flex items-center gap-3 min-h-11">
      <input ref={ref} id={id} type="color" value={draft} disabled={disabled}
        aria-describedby={describedBy}
        onChange={e => { setDraft(e.target.value); onPreview?.(e.target.value); }}
        className="w-11 h-11 shrink-0 rounded-lg border border-line/[0.16] bg-raised p-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" />
      <label htmlFor={id} className={`text-sm ${modified ? 'text-accent-soft' : 'text-ink-2'}`}>
        <span className="block font-medium">{label}{modified && <span className="sr-only"> (modificado)</span>}</span>
        <span className="num text-xs text-ink-3 uppercase">{draft}</span>
      </label>
    </div>
  );
}
