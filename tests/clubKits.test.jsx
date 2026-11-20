// Camisetas en la página del club (components/league/club/ClubKits.jsx). Sintético.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClubKits } from '../components/league/club/ClubKits.jsx';

describe('ClubKits', () => {
  it('shows nothing without kits', () => {
    expect(renderToStaticMarkup(<ClubKits profile={{}} teamName="Talleres" />)).toBe('');
  });

  it('shows the first kit large, with a picker when there is more than one', () => {
    const html = renderToStaticMarkup(<ClubKits teamName="Talleres" profile={{ kits: { away: 'https://e.com/2.webp', home: 'https://e.com/1.webp' } }} />);
    expect(html).toContain('src="https://e.com/1.webp"');
    expect(html).toContain('alt="Camiseta titular de Talleres"');
    expect(html).toContain('Suplente');
    expect(html).toContain('role="tab"');
  });

  it('names the only kit instead of a one-option picker', () => {
    const html = renderToStaticMarkup(<ClubKits teamName="Talleres" profile={{ kits: { third: 'https://e.com/3.webp' } }} />);
    expect(html).not.toContain('role="tab"');
    expect(html).toContain('Alternativa');
  });
});
