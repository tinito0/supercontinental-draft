import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), onSnapshot: vi.fn() }));

const { airAlerts } = await import('../components/admin/obs/ObsAirAlerts.jsx');
const { hasLinkedMatch, BroadcastOverlay, NO_MATCH_TEXT } = await import('../components/BroadcastOverlay.jsx');
const { overlayRetryDelay } = await import('../hooks/useOverlayDoc.js');

describe('overlay air alerts (F-18, F-19)', () => {
  it('warns when a match scene is on air without a linked match', () => {
    expect(airAlerts({ overlay: { scene: 'previa' } }).map(a => a.key)).toEqual(['match']);
    expect(airAlerts({ overlay: { scene: 'previa', matchId: 'm1' } })).toEqual([]);
    expect(airAlerts({ overlay: { scene: 'tabla' } })).toEqual([]);
  });

  it('reports a read error first and keeps the match warning', () => {
    expect(airAlerts({ overlay: { scene: 'final' }, readError: true }).map(a => a.key)).toEqual(['read', 'match']);
  });

  it('counts the live bridge match like the air does, and ignores a finished one outside the Final', () => {
    const bridge = { status: 'live', home: { name: 'Boca' }, away: { name: 'River' } };
    expect(airAlerts({ overlay: { scene: 'descanso', liveMatchKey: 'k1' }, liveMatch: bridge })).toEqual([]);
    const finished = { ...bridge, status: 'finished' };
    expect(airAlerts({ overlay: { scene: 'descanso', liveMatchKey: 'k1' }, liveMatch: finished }).map(a => a.key)).toEqual(['match']);
  });
});

describe('hasLinkedMatch', () => {
  it('is false for an empty doc and true for any match reference', () => {
    expect(hasLinkedMatch({ matchId: '', homeTeamName: '' })).toBe(false);
    expect(hasLinkedMatch({ homeTeamName: 'Talleres' })).toBe(true);
  });

  it('ignores a stale bridge key: liveMatchKey is never cleared', () => {
    const finished = { status: 'finished', home: { name: 'Talleres' }, away: { name: 'Belgrano' } };
    expect(hasLinkedMatch({ scene: 'previa', liveMatchKey: 'old' })).toBe(false);
    expect(hasLinkedMatch({ scene: 'previa', liveMatchKey: 'old' }, null, finished)).toBe(false);
    expect(hasLinkedMatch({ scene: 'final', liveMatchKey: 'k' }, null, finished)).toBe(true);
    expect(hasLinkedMatch({ scene: 'descanso', liveMatchKey: 'k' }, null, { ...finished, status: 'live' })).toBe(true);
  });
});

describe('BroadcastOverlay without a match', () => {
  it('does not air LOCAL vs VISITANTE placeholders', () => {
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'previa' }} allTeams={{}} tournamentData={{}} />);
    expect(html).toContain(NO_MATCH_TEXT);
    expect(html).not.toContain('LOCAL');
    expect(html).not.toContain('VISITANTE');
  });

  it('a previa with an old finished bridge match still airs no placeholders', () => {
    const liveMatch = { status: 'finished', home: { name: 'Talleres', score: 2 }, away: { name: 'Belgrano', score: 1 } };
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'previa', liveMatchKey: 'old' }} allTeams={{}} tournamentData={{}} liveMatch={liveMatch} />);
    expect(html).toContain(NO_MATCH_TEXT);
    expect(html).not.toContain('LOCAL');
  });

  it('the bridge Final airs the bridge team names, not placeholders', () => {
    const liveMatch = { status: 'finished', home: { name: 'Talleres', score: 2 }, away: { name: 'Belgrano', score: 1 } };
    const html = renderToStaticMarkup(<BroadcastOverlay overlayData={{ scene: 'final', liveMatchKey: 'k' }} allTeams={{}} tournamentData={{}} liveMatch={liveMatch} />);
    expect(html).toContain('Talleres');
    expect(html).not.toContain('VISITANTE');
  });
});

describe('overlayRetryDelay', () => {
  it('doubles and caps at 30 s', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(overlayRetryDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});
