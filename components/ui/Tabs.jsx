import React, { useEffect, useRef, useState } from 'react';

/** Whether the list scrolls sideways and still hides tabs past its right edge (1 px of slack for subpixel widths). */
function useHiddenOverflow(listRef) {
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const update = () => setHasMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [listRef]);
  return hasMore;
}

/**
 * Segmented tabs (ARIA tablist). Arrow keys move between tabs; the selected tab is the only one in the
 * tab order. `tabs`: [{ id, label, icon?, count?, hidden? }]. When the tabs don't fit (phones), the list scrolls
 * sideways and fades at the right edge while more tabs are hidden there.
 */
export function Tabs({ tabs, value, onChange, label, className = '', size = 'md' }) {
  const refs = useRef({});
  const listRef = useRef(null);
  const hasMore = useHiddenOverflow(listRef);
  const visible = tabs.filter(t => !t.hidden);

  // The selected tab stays in view, also when it starts past the edge (a shared ?tab= link).
  useEffect(() => {
    const list = listRef.current;
    const tab = refs.current[value];
    if (!list || !tab) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    if (tabBox.right > listBox.right) list.scrollLeft += tabBox.right - listBox.right + 4;
    else if (tabBox.left < listBox.left) list.scrollLeft -= listBox.left - tabBox.left + 4;
  }, [value]);
  const move = (from, delta) => {
    const i = visible.findIndex(t => t.id === from);
    const next = visible[(i + delta + visible.length) % visible.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div ref={listRef} role="tablist" aria-label={label} className={`tab-list max-w-full overflow-x-auto ${hasMore ? 'tab-list--more' : ''} ${className}`}>
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
