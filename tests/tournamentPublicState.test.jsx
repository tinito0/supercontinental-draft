// Estado público de /draft/torneo (components/tournament/TournamentPublicState.jsx). Render estático, sin red.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TournamentPublicState } from '../components/tournament/TournamentPublicState.jsx';

const render = (status, onRetry = () => {}) => renderToStaticMarkup(<TournamentPublicState status={status} onRetry={onRetry} />);

describe('TournamentPublicState', () => {
  it('loading: announces progress inside a main landmark', () => {
    const html = render('loading');
    expect(html).toContain('<main');
    expect(html).toContain('role="status"');
    expect(html).toContain('Cargando torneo');
    expect(html).not.toContain('text-slate-200');
    expect(html).not.toContain('text-white');
  });

  it('missing: empty state with a way back to the league site', () => {
    const html = render('missing');
    expect(html).toContain('<main');
    expect(html).toContain('Todavía no hay torneo');
    expect(html).toContain('href="/torneo"');
    expect(html).not.toContain('Reintentar');
  });

  it('error: danger alert with cause, next step and retry button', () => {
    const html = render('error');
    expect(html).toContain('<main');
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudo cargar el torneo');
    expect(html).toContain('Reintentar');
  });
});
