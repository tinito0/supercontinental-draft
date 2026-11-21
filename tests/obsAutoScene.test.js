// Synthetic overlay docs: the automatic move to the table after a final, and the OBS scene each overlay scene maps to.
import { AUTO_TABLE_AFTER_MS } from '../supabase/functions/_shared/overlayControl.js';
import { autoTableActive, BETWEEN_MATCHES_POPUP_SECONDS, CAMERA_TOUR_STEP_MS, effectiveOverlay, goalCamera, goalSide, obsSceneName, tourCamera } from '../utils/obsAutoScene.js';
import { resolveObsRequest } from '../utils/obsScenes.js';

const at = 1_000_000;
const site = 'https://example.app';

describe('effectiveOverlay', () => {
  it('keeps «Final» for two minutes, then shows the table with the QR once', () => {
    const overlay = { scene: 'final', autoFinalAt: at };
    expect(effectiveOverlay(overlay, at + AUTO_TABLE_AFTER_MS - 1, site)).toBe(overlay);
    const later = effectiveOverlay(overlay, at + AUTO_TABLE_AFTER_MS, site);
    expect(later.scene).toBe('tabla');
    expect(later.popup).toMatchObject({ visible: true, url: `${site}/en-vivo`, autoHideSec: BETWEEN_MATCHES_POPUP_SECONDS, shownAt: at + AUTO_TABLE_AFTER_MS });
  });

  it('leaves a final put by hand, the admin switches, and a newer popup alone', () => {
    expect(autoTableActive({ scene: 'final' }, at * 10)).toBe(false);
    expect(autoTableActive({ scene: 'final', autoFinalAt: at, autoScenes: false }, at * 10)).toBe(false);
    expect(autoTableActive({ scene: 'previa', autoFinalAt: at }, at * 10)).toBe(false);
    expect(effectiveOverlay({ scene: 'final', autoFinalAt: at, autoPopup: false }, at * 10, site).popup).toBeUndefined();
    const manual = { visible: true, shownAt: at * 9 };
    expect(effectiveOverlay({ scene: 'final', autoFinalAt: at, popup: manual }, at * 10, site).popup).toBe(manual);
  });
});

describe('obsSceneName', () => {
  it('maps match scenes to the game scene and the rest to their own, with renames', () => {
    expect(obsSceneName('final')).toBe('SCL Partido');
    expect(obsSceneName('live', { partido: 'Juego' })).toBe('Juego');
    expect(obsSceneName('tabla', { tabla: '  ' })).toBe('SCL Tabla');
    expect(obsSceneName('goleadores', { goleadores: 'Goles' })).toBe('Goles');
  });
});

it('reads the control source from the overlay URL', () => {
  expect(resolveObsRequest('/overlay', '?control=obs')).toMatchObject({ control: true });
  expect(resolveObsRequest('/overlay', '?follow=partido')).toMatchObject({ control: false, follow: 'partido' });
});

describe('cameras', () => {
  it('tells which side scored, and ignores resets and double changes', () => {
    expect(goalSide({ home: 0, away: 0 }, { home: 1, away: 0 })).toBe('home');
    expect(goalSide({ home: 1, away: 0 }, { home: 1, away: 1 })).toBe('away');
    expect(goalSide({ home: 2, away: 1 }, { home: 0, away: 0 })).toBeNull();
    expect(goalSide({ home: 0, away: 0 }, { home: 1, away: 1 })).toBeNull();
    expect(goalSide(null, { home: 1, away: 0 })).toBeNull();
    expect(goalCamera('home')).toBe('jugador1');
    expect(goalCamera('away')).toBe('jugador2');
  });

  it('tours Previa and Final once, 12 s per camera, and stays on the commentator', () => {
    expect(tourCamera('previa', 0)).toBe('jugador1');
    expect(tourCamera('final', CAMERA_TOUR_STEP_MS)).toBe('jugador2');
    expect(tourCamera('final', CAMERA_TOUR_STEP_MS * 2)).toBe('relator');
    expect(tourCamera('previa', CAMERA_TOUR_STEP_MS * 20)).toBe('relator');
    expect(tourCamera('live', 0)).toBeNull();
    expect(obsSceneName('relator', { relator: 'Cam Relator' })).toBe('Cam Relator');
    expect(obsSceneName('jugador1')).toBe('SCL Jugador 1');
  });
});
