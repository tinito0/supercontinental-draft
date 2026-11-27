import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));

const { BroadcastLeagueTable } = await import('../components/broadcast/BroadcastLeagueTable.jsx');
const { airAlerts } = await import('../components/admin/obs/ObsAirAlerts.jsx');

const league = [{ id: 't1', name: 'Talleres', pj: 2, pg: 2, gpen: 0, pp: 0, gf: 4, gc: 1, pts: 4 }];

// Contrast ratio between two sRGB hex colours (WCAG 2.x).
function contrast(hexA, hexB) {
  const lum = hex => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('OBS overlay copy and accessibility (F-60, F-62, F-72)', () => {
  it('labels the table aside with the real points rule', () => {
    const html = renderToStaticMarkup(<BroadcastLeagueTable league={league} />);
    expect(html).toContain('2 pts por victoria');
    expect(html).not.toContain('GPEN');
  });

  it('keeps no aria-label on generic elements in the table', () => {
    const html = renderToStaticMarkup(<BroadcastLeagueTable league={league} />);
    expect(html).not.toContain('aria-label="jugando ahora"');
  });
});

describe('operator hints for empty on-air scenes (F-83)', () => {
  it('explains where to load an empty table', () => {
    const alerts = airAlerts({ overlay: { scene: 'tabla' }, tournament: { league: [] } });
    expect(alerts.map(a => a.key)).toEqual(['table']);
    expect(alerts[0].text).toContain('Administración → Torneo');
  });

  it('explains where to load goals for an empty scorers scene', () => {
    const alerts = airAlerts({ overlay: { scene: 'goleadores' }, tournament: { topScorers: [] } });
    expect(alerts.map(a => a.key)).toEqual(['scorers']);
  });

  it('stays silent when the tournament data is not known yet', () => {
    expect(airAlerts({ overlay: { scene: 'tabla' } })).toEqual([]);
  });

  it('stays silent when the table has rows', () => {
    expect(airAlerts({ overlay: { scene: 'tabla' }, tournament: { league: league } })).toEqual([]);
  });
});

describe('control page status contrast (F-61)', () => {
  it('white text on the #04173a plate passes WCAG AA for normal text', () => {
    expect(contrast('#ffffff', '#04173a')).toBeGreaterThanOrEqual(4.5);
  });
});
