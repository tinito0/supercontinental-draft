// Qué escena pide cada URL de OBS (utils/obsScenes.js) y que la lista coincida con la de Macro Deck (overlay-control).
import { describe, it, expect } from 'vitest';
import { OBS_SCENE_IDS, normalizeSceneId, resolveObsRequest, sceneForSource, sourcesShowingOnAir } from '../utils/obsScenes.js';
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
    expect(resolveObsRequest('/overlay', '')).toEqual({ scene: null, follow: null, transparent: true });
    expect(resolveObsRequest('/overlay', '?scene=tabla')).toEqual({ scene: 'tabla', follow: null, transparent: true });
    expect(resolveObsRequest('/overlay', '?view=bracket')).toEqual({ scene: 'bracket', follow: null, transparent: true });
    expect(resolveObsRequest('/overlay', '?scene=cualquiera')).toEqual({ scene: null, follow: null, transparent: true });
  });

  it('maps the old ?mode=obs tournament views to overlay scenes', () => {
    expect(resolveObsRequest('/torneo', '?mode=obs&view=groups')).toEqual({ scene: 'tabla', follow: null, transparent: true });
    expect(resolveObsRequest('/', '?mode=obs&view=bracket')).toEqual({ scene: 'bracket', follow: null, transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=bracket&tournament=copa-plata')).toEqual({ scene: 'repechaje', follow: null, transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=goleadores')).toEqual({ scene: 'goleadores', follow: null, transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs&view=matches')).toEqual({ scene: 'partidos', follow: null, transparent: true });
    expect(resolveObsRequest('/torneo', '?mode=obs')).toEqual({ scene: 'tabla', follow: null, transparent: true });
  });

  it('keeps the opaque public table and bracket modes', () => {
    expect(resolveObsRequest('/', '?mode=table')).toEqual({ scene: 'tabla', follow: null, transparent: false });
    expect(resolveObsRequest('/', '?mode=bracket&tournament=copa-plata')).toEqual({ scene: 'repechaje', follow: null, transparent: false });
  });

  it('leaves every other draft URL to the draft app', () => {
    expect(resolveObsRequest('/torneo', '')).toBeNull();
    expect(resolveObsRequest('/overview', '?tab=x')).toBeNull();
    expect(resolveObsRequest('/overlayx', '')).toBeNull();
  });
});

describe('sceneForSource', () => {
  const partido = resolveObsRequest('/overlay', '?follow=partido');

  it('reads ?follow=partido, which a fixed ?scene= overrides', () => {
    expect(partido).toEqual({ scene: null, follow: 'partido', transparent: true });
    expect(resolveObsRequest('/overlay', '?follow=PARTIDO').follow).toBe('partido');
    expect(resolveObsRequest('/overlay', '?follow=torneo').follow).toBeNull();
    expect(resolveObsRequest('/overlay', '?scene=tabla&follow=partido')).toEqual({ scene: 'tabla', follow: null, transparent: true });
  });

  it('the match source follows the match scenes and stays clean during tournament scenes', () => {
    expect(sceneForSource(partido, 'final')).toBe('final');
    expect(sceneForSource(partido, 'previa')).toBe('previa');
    expect(sceneForSource(partido, 'tabla')).toBe('live');
    expect(sceneForSource(partido, undefined)).toBe('live');
  });

  it('a fixed source ignores the scene on air; the general source shows it', () => {
    expect(sceneForSource({ scene: 'live', follow: null }, 'final')).toBe('live');
    expect(sceneForSource({ scene: null, follow: null }, 'tabla')).toBe('tabla');
    expect(sceneForSource({ scene: null, follow: null }, 'nope')).toBe('live');
  });

  it('says which sources show each scene when it goes on air', () => {
    expect(sourcesShowingOnAir('final')).toEqual(['partido', 'general', 'final']);
    expect(sourcesShowingOnAir('tabla')).toEqual(['general', 'tabla']);
    expect(sourcesShowingOnAir('live')).toEqual(['partido', 'general', 'live']);
  });
});
