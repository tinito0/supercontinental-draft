// Administración → Reglas needs the player catalog, which the app only downloads for the market tabs.
// Guards the wiring that made the tab load forever (2026-10-31): the section asks for it, the app listens.
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('player catalog request from Administración → Reglas', () => {
  test('the section requests the catalog when it has no players', () => {
    const section = read('components/admin/SquadRulesAdminSection.jsx');
    expect(section).toMatch(/if \(!hasPlayers\) onRequestCatalog\?\.\(\)/);
  });

  test('the admin modal forwards the request and the app loads the catalog for it', () => {
    expect(read('components/AdminModal.jsx')).toContain('onRequestCatalog={props.onRequestCatalog}');
    const app = read('app.jsx');
    expect(app.match(/onRequestCatalog=\{requestPlayerCatalog\}/g)).toHaveLength(2);
    expect(app).toContain('|| squadNeedsCatalog || isCatalogRequested;');
  });
});
