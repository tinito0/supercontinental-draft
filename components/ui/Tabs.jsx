import React, { useEffect, useId, useRef, useState } from 'react';

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

/** Index of the tab a key moves to (arrows wrap around, Home/End jump to the ends), or -1 for any other key. */
export function nextTabIndex(key, current, count) {
  if (!count) return -1;
  if (key === 'ArrowRight') return (current + 1) % count;
  if (key === 'ArrowLeft') return (current - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return -1;
}

/** DOM id of a tab button and of the panel it controls, for callers that render the panel themselves. */
export const tabDomId = (idPrefix, id) => `${idPrefix}-tab-${id}`;
export const panelDomId = (idPrefix, id) => `${idPrefix}-panel-${id}`;
/** Props for the panel of the selected tab; pair with `idPrefix` on <Tabs>. */
export const tabPanelProps = (idPrefix, id) => ({
  role: 'tabpanel',
  id: panelDomId(idPrefix, id),
  'aria-labelledby': tabDomId(idPrefix, id),
  tabIndex: 0,
});

/**
 * Segmented tabs (ARIA tablist). Arrow keys, Home and End move between tabs; the selected tab is the only one in
 * the tab order. `tabs`: [{ id, label, icon?, count?, hidden? }]. When the tabs don't fit (phones), the list scrolls
 * sideways and fades at the right edge while more tabs are hidden there; `wrap` lays them out in rows instead.
 * `idPrefix` links each tab to its panel (aria-controls): render the selected panel with `tabPanelProps(idPrefix, value)`.
 * `nav` keeps tabs 44px tall also with a mouse, for tabs that are the page's main navigation.
 */
export function Tabs({ tabs, value, onChange, label, className = '', size = 'md', idPrefix, wrap = false, nav = false }) {
  const autoPrefix = useId();
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
  const move = (from, key) => {
    const next = visible[nextTabIndex(key, visible.findIndex(t => t.id === from), visible.length)];
    if (!next) return;
    onChange(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div ref={listRef} role="tablist" aria-label={label} className={`tab-list max-w-full ${wrap ? 'flex-wrap' : 'overflow-x-auto'} ${hasMore ? 'tab-list--more' : ''} ${className}`}>
      {visible.map(t => {
        const selected = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            ref={el => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={tabDomId(idPrefix || autoPrefix, t.id)}
            aria-controls={idPrefix ? panelDomId(idPrefix, t.id) : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => {
              if (nextTabIndex(e.key, 0, 2) < 0) return;
              e.preventDefault();
              move(t.id, e.key);
            }}
            className={`tab ${size === 'lg' ? `${nav ? 'min-h-11' : 'min-h-10'} px-4 text-sm` : nav ? 'min-h-11' : ''}`}
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
