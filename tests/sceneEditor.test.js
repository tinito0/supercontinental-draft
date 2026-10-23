// Borrador del editor de escenas de OBS (utils/sceneEditor.js): qué se escribe al guardar o mandar al aire.
import { describe, it, expect } from 'vitest';
import { buildScenePatch, dirtyDraftFields, draftFrom, DRAFT_FIELDS } from '../utils/sceneEditor.js';

const saved = draftFrom({ scene: 'previa', headline: 'SCL', showTicker: true, homeScore: '0', matchId: 'league-1' });

describe('scene editor draft', () => {
  it('keeps only the editable fields: scene, popup and card are not part of the draft', () => {
    const draft = draftFrom({ scene: 'tabla', popup: { visible: true }, card: {}, autoPopup: false, headline: 'X' });
    expect(Object.keys(draft).sort()).toEqual([...DRAFT_FIELDS].sort());
  });

  it('writes nothing when nothing changed and the scene is already on air', () => {
    expect(buildScenePatch(saved, { ...saved, scene: 'previa' }, { scene: 'previa' })).toBeNull();
    expect(buildScenePatch(saved, saved)).toBeNull();
  });

  it('writes only the changed fields, so a scene change made meanwhile (Macro Deck) is not reverted', () => {
    const draft = { ...saved, headline: 'Final de la Copa de Oro' };
    expect(buildScenePatch(draft, { ...saved, scene: 'tabla' })).toEqual({ headline: 'Final de la Copa de Oro' });
  });

  it('adds the scene only when going live with a different scene', () => {
    expect(buildScenePatch(saved, { ...saved, scene: 'previa' }, { scene: 'final' })).toEqual({ scene: 'final' });
    expect(buildScenePatch({ ...saved, homeScore: '2' }, { ...saved, scene: 'final' }, { scene: 'final' })).toEqual({ homeScore: '2' });
  });

  it('compares values as text: 2 and "2" are the same', () => {
    expect(dirtyDraftFields({ ...saved, homeScore: 0 }, saved)).toEqual([]);
  });
});
