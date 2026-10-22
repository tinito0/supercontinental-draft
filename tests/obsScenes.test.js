// Qué escena pide cada URL de OBS (utils/obsScenes.js) y que la lista coincida con la de Macro Deck (overlay-control).
import { describe, it, expect } from 'vitest';
import { OBS_SCENE_IDS, normalizeSceneId, resolveObsRequest } from '../utils/obsScenes.js';
import { OVERLAY_SCENES } from '../supabase/functions/_shared/overlayControl.js';

describe('OBS scenes', () => {
  it('match the scenes the overlay-control function accepts', () => {
    expect([...OBS_SCENE_IDS].sort()).toEqual([...OVERLAY_SCENES].sort());
  });

  it('accepts the old scene names', () => {
    expect(normalizeSceneId('groups')).toBe('tabla');
    expect(normalizeSceneId('LLAVES')).toBe('bracket');
    expect(normalizeSceneId('matches')).toBe('partidos');
    expect(normalizeSceneId('nope')).toBeNull();
  });
});

describe('resolveObsRequest', () => {
  it('the overlay follows the saved scene unless the URL fixes one', () => {
    expect(resolveObsRequest('/overlay', '')).toEqual({ scene: null, transparent: true });
    expect(resolveObsRequest('/overlay', '?scene=tabla')).toEqual({ scene: 'tabla', transparent: true });
    expect(resolveObsRequest('/overlay', '?view=bracket')).toEqual({ scene: 'bracket', transparent: true });
    expect(resolveObsRequest('/overlay', '?scene=cualquiera')).toEqual({ scene: null, transparent: true });
  });

  it('maps the old ?mode=obs tournament views to overlay scenes', () => {
    expect(resolveObsRequest('/torneo', '?mode=obs&view=groups')).toEqual({ scene: 'tabla', transparent: true });
    expect(resolveObsRequest('/', '?mode=obs&view=bracket')).toEqual({ scene: 'bracket', transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=bracket&tournament=copa-plata')).toEqual({ scene: 'repechaje', transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=goleadores')).toEqual({ scene: 'goleadores', transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=matches')).toEqual({ scene: 'partidos', transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs')).toEqual({ scene: 'tabla', transparent: true });
  });

  it('keeps the opaque public table and bracket modes', () => {
    expect(resolveObsRequest('/', '?mode=table')).toEqual({ scene: 'tabla', transparent: false });
    expect(resolveObsRequest('/', '?mode=bracket&tournament=copa-plata')).toEqual({ scene: 'repechaje', transparent: false });
  });

  it('leaves every other draft URL to the draft app', () => {
    expect(resolveObsRequest('/torneo', '')).toBeNull();
    expect(resolveObsRequest('/overview', '?tab=x')).toBeNull();
    expect(resolveObsRequest('/overlayx', '')).toBeNull();
  });
});
