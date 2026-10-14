// Regression tests for the marketplace search and filters: typing must never "press" the clear (X)
// button, close the filters dialog or navigate back.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SearchBar, countActiveFilters } from '../components/SearchBar.jsx';
import { FiltrosModal, getActiveFilters } from '../components/FiltrosModal.jsx';
import { isTyping } from '../hooks/useKeyboardShortcuts.js';

const baseFilters = {
  name: '', ovrMin: '', ovrMax: '', ageMin: '', ageMax: '', priceMin: '', priceMax: '',
  pos: '', foot: '', country: '', region: '', playingStyle: '', grupos: {}, skills: {}, wishlistOnly: false,
};

const searchBar = (filters = baseFilters) => renderToString(React.createElement(SearchBar, {
  filters, setFilters: vi.fn(), resetFilters: vi.fn(), setIsFiltrosModalVisible: vi.fn(),
  sortConfig: { key: 'ovr', direction: 'desc' }, setSortConfig: vi.fn(),
  viewMode: 'grid', setViewMode: vi.fn(), gridColumns: 4, setGridColumns: vi.fn(), resultCount: 10, totalCount: 10,
}));

const buttons = html => [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]);

describe('marketplace search bar', () => {
  it('the clear (X) button can never be the form default button', () => {
    const html = searchBar({ ...baseFilters, name: 'messi' });
    const clear = buttons(html).find(b => b.includes('Borrar texto de búsqueda'));
    expect(clear).toBeDefined();
    expect(clear).toContain('type="button"');
    // Enter submits through the only submit button, "Buscar".
    const submits = buttons(html).filter(b => b.includes('type="submit"'));
    expect(submits).toHaveLength(1);
    expect(html.indexOf('type="submit"')).toBeGreaterThan(-1);
  });

  it('every other control declares type="button" (no accidental submit or navigation)', () => {
    const html = searchBar({ ...baseFilters, name: 'messi', pos: 'DC', wishlistOnly: true });
    for (const b of buttons(html)) expect(b).toMatch(/type="(button|submit)"/);
  });

  it('shows removable chips for active filters, without emoji', () => {
    const html = searchBar({ ...baseFilters, pos: 'DC', wishlistOnly: true });
    expect(html).toContain('Posición DC');
    expect(html).toContain('Solo favoritos');
    expect(html).not.toMatch(/⭐/);
  });

  it('counts active filters the same way as before the redesign', () => {
    expect(countActiveFilters(baseFilters)).toBe(0);
    expect(countActiveFilters({ ...baseFilters, ovrMin: '80', pos: 'DC', grupos: { Delanteros: true }, skills: { Rabona: true } })).toBe(4);
    // The name search is a search, not a filter.
    expect(countActiveFilters({ ...baseFilters, name: 'messi' })).toBe(0);
  });
});

describe('filters dialog', () => {
  const dialog = (filters = baseFilters) => renderToString(React.createElement(FiltrosModal, {
    isVisible: true, onClose: vi.fn(), filters, setFilters: vi.fn(), applyFilters: vi.fn(), resetFilters: vi.fn(),
    uniquePositions: ['DC', 'PT'], sortedCountries: [['144', 'Argentina']], uniquePlayingStyles: ['Cazagoles'],
    userId: null, getSavedFiltersCollectionRef: vi.fn(), showStatusMessage: vi.fn(),
  }));

  it('renders no submit buttons and no form: typing or Enter cannot close it', () => {
    const html = dialog({ ...baseFilters, country: 'Argentina' });
    expect(html).not.toContain('<form');
    for (const b of buttons(html)) expect(b).toContain('type="button"');
  });

  it('lists the active filters in Spanish', () => {
    expect(getActiveFilters({ ...baseFilters, ovrMin: '80', grupos: { Arqueros: true } })).toEqual(['OVR mín: 80', 'Arqueros']);
  });
});

describe('Escape while typing', () => {
  it('treats inputs, textareas, selects and editable content as typing', () => {
    expect(isTyping({ tagName: 'INPUT' })).toBe(true);
    expect(isTyping({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTyping({ tagName: 'SELECT' })).toBe(true);
    expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTyping({ tagName: 'BUTTON' })).toBe(false);
  });
});
