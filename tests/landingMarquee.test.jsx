import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerMarquee } from '../components/landing/PlayerMarquee.jsx';
import { readFileSync } from 'node:fs';

describe('PlayerMarquee', () => {
  it('offers a pause button whose label carries the state', () => {
    const html = renderToStaticMarkup(<PlayerMarquee />);
    expect(html).toContain('Pausar la marquesina');
    // The label changes with the state, so aria-pressed would announce it twice.
    expect(html).not.toContain('aria-pressed');
    expect(html).toContain('min-h-11');
  });
});

describe('landing.css', () => {
  it('has no backdrop-filter', () => {
    expect(readFileSync('landing.css', 'utf8')).not.toMatch(/backdrop-filter/);
  });
});
