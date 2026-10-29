// Editor de la web pública (no admin): Administración muestra solo «Web pública». Las escrituras las limitan
// firestore.rules (tests/rules/leagueContentRules.test.js); esto cubre lo que ve en pantalla.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../config/firebase.js', () => ({ db: {}, auth: { currentUser: null }, storage: {} }));

const { AdminModal } = await import('../components/AdminModal.jsx');

describe('AdminModal for a public-site editor', () => {
  it('shows only the Web pública section, without the admin tabs', () => {
    const html = renderToStaticMarkup(<AdminModal isPage isVisible allowedTabs={['web']} initialTab="general" allTeams={{}} />);
    expect(html).toContain('Web pública');
    expect(html).not.toContain('Configuración');
    expect(html).not.toContain('Torneo y transmisión');
    expect(html).not.toContain('Equipos y usuarios');
  });

  it('an admin still gets every section', () => {
    const html = renderToStaticMarkup(<AdminModal isPage isVisible initialTab="web" allTeams={{}} />);
    for (const label of ['Configuración', 'Equipos y usuarios', 'Torneo y transmisión', 'Web pública', 'Plantillas', 'Buzón']) {
      expect(html).toContain(label);
    }
  });
});
