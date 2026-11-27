import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, nextTabIndex, tabPanelProps } from '../../components/ui/Tabs.jsx';

const tabs = [{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }, { id: 'c', label: 'Tres', hidden: true }];

describe('nextTabIndex', () => {
  it('moves with arrows and wraps around', () => {
    expect(nextTabIndex('ArrowRight', 1, 2)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 2)).toBe(1);
  });
  it('jumps to the ends with Home and End', () => {
    expect(nextTabIndex('Home', 3, 5)).toBe(0);
    expect(nextTabIndex('End', 0, 5)).toBe(4);
  });
  it('ignores other keys', () => {
    expect(nextTabIndex('Enter', 0, 3)).toBe(-1);
  });
});

describe('Tabs markup', () => {
  it('links tabs and panel when idPrefix is given', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="b" onChange={() => {}} label="Prueba" idPrefix="t" />);
    expect(html).toContain('id="t-tab-a"');
    expect(html).toContain('aria-controls="t-panel-b"');
    expect(html).not.toContain('t-tab-c');
    expect(html).toContain('tabindex="-1"');
    const panel = tabPanelProps('t', 'b');
    expect(panel['aria-labelledby']).toBe('t-tab-b');
    expect(panel.id).toBe('t-panel-b');
  });
  it('omits aria-controls without idPrefix (no panel to point at)', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="a" onChange={() => {}} label="Prueba" />);
    expect(html).not.toContain('aria-controls');
  });
  it('wraps instead of scrolling and keeps 44px for nav tabs', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} value="a" onChange={() => {}} label="Prueba" wrap nav />);
    expect(html).toContain('flex-wrap');
    expect(html).not.toContain('overflow-x-auto');
    expect(html).toContain('min-h-11');
  });
});
