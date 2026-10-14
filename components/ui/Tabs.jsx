import React, { useRef } from 'react';

/**
 * Segmented tabs (ARIA tablist). Arrow keys move between tabs; the selected tab is the only one in the
 * tab order. `tabs`: [{ id, label, icon?, count?, hidden? }].
 */
export function Tabs({ tabs, value, onChange, label, className = '', size = 'md' }) {
  const refs = useRef({});
  const visible = tabs.filter(t => !t.hidden);
  const move = (from, delta) => {
    const i = visible.findIndex(t => t.id === from);
    const next = visible[(i + delta + visible.length) % visible.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`tab-list max-w-full overflow-x-auto ${className}`}>
      {visible.map(t => {
        const selected = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            ref={el => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(t.id, 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(t.id, -1); }
            }}
            className={`tab ${size === 'lg' ? 'min-h-10 px-4 text-sm' : ''}`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
            <span className="whitespace-nowrap">{t.label}</span>
            {t.count != null && <span className="num text-ink-3 font-medium">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
