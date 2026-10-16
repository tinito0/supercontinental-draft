// Regression tests for the marketplace search and filters: typing must never "press" the clear (X)
// button, close the filters dialog or navigate back.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SearchBar } from '../components/SearchBar.jsx';
import { FiltrosModal } from '../components/FiltrosModal.jsx';
import { getActiveFilterChips, countActiveFilters, isInvertedRange } from '../utils/marketFilters.js';
import { isTyping } from '../hooks/useKeyboardShortcuts.js';

const baseFilters = {
  name: '', ovrMin: '', ovrMax: '', ageMin: '', ageMax: '', priceMin: '', priceMax: '',
  pos: '', foot: '', country: '', region: '', playingStyle: '', grupos: {}, skills: {}, wishlistOnly: false,
};

const searchBar = (filters = baseFilters) => renderToString(React.createElement(SearchBar, {
  filters, setFilters: vi.fn(), resetFilters: vi.fn(), setIsFiltrosModalVisible: vi.fn(),
  sortConfig: { key: 'ovr', direction: 'desc' }, setSortConfig: vi.fn(),
  viewMode: 'grid', setViewMode: vi.fn(), density: 'comfortable', setDensity: vi.fn(), totalCount: 10,
}));

const buttons = html => [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]);

describe('marketplace search bar', () => {
  it('the clear (X) button can never be the form default button (the search is live, no submit button)', () => {
    const html = searchBar({ ...baseFilters, name: 'messi' });
    const clear = buttons(html).find(b => b.includes('Borrar texto de búsqueda'));
    expect(clear).toBeDefined();
    expect(clear).toContain('type="button"');
    // Enter in the search field submits the search form implicitly; no button can be "pressed" by it.
    expect(buttons(html).filter(b => b.includes('type="submit"'))).toHaveLength(0);
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

  it('counts one per chip; the name search and "Solo favoritos" are not counted', () => {
    expect(countActiveFilters(baseFilters)).toBe(0);
    expect(countActiveFilters({ ...baseFilters, ovrMin: '80', pos: 'DC', grupos: { Delanteros: true }, skills: { Rabona: true } })).toBe(4);
    expect(countActiveFilters({ ...baseFilters, ovrMin: '80', ovrMax: '90' })).toBe(1);
    expect(countActiveFilters({ ...baseFilters, name: 'messi', wishlistOnly: true })).toBe(0);
  });

  it('shows stat ranges and skills as chips and counts them (they used to be invisible in the toolbar)', () => {
    const filters = { ...baseFilters, SpeedMin: '85', skills: { Trickster: true } };
    const labels = getActiveFilterChips(filters).map(chip => chip.label);
    expect(labels).toEqual(['Elástico', 'Velocidad 85–99']);
    expect(countActiveFilters(filters)).toBe(2);
    const html = searchBar(filters);
    expect(html).toContain('Velocidad 85–99');
    expect(html).toContain('Limpiar filtros');
  });

  it('each chip clears only its own filter', () => {
    const filters = { ...baseFilters, ageMin: '18', ageMax: '23', pos: 'DC', SpeedMin: '85', SpeedMax: '99' };
    const chips = getActiveFilterChips(filters);
    const afterAge = chips.find(chip => chip.id === 'age').clear(filters);
    expect(afterAge).toMatchObject({ ageMin: '', ageMax: '', pos: 'DC', SpeedMin: '85' });
    const afterSpeed = chips.find(chip => chip.id === 'stat-Speed').clear(filters);
    expect(afterSpeed).toMatchObject({ SpeedMin: '', SpeedMax: '', ageMin: '18' });
  });

  it('never shows the name search as a chip', () => {
    expect(getActiveFilterChips({ ...baseFilters, name: 'messi' })).toEqual([]);
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

  it('lists the active filters in Spanish, as removable chips, and shows the result count', () => {
    expect(getActiveFilterChips({ ...baseFilters, ovrMin: '80', grupos: { Arqueros: true } }).map(chip => chip.label)).toEqual(['OVR 80–99', 'Arqueros']);
    const html = dialog({ ...baseFilters, ovrMin: '80' });
    expect(html).toContain('Quitar filtro OVR 80–99');
    expect(html).toContain('1 filtro activo');
  });

  it('flags an inverted range instead of silently returning nothing', () => {
    expect(isInvertedRange('90', '80')).toBe(true);
    expect(isInvertedRange('80', '90')).toBe(false);
    expect(isInvertedRange('80', '')).toBe(false);
    expect(dialog({ ...baseFilters, ovrMin: '90', ovrMax: '80' })).toContain('El mínimo es mayor que el máximo');
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
