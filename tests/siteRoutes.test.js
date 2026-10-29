import { describe, it, expect } from 'vitest';
import { DRAFT_BASE, isDraftPath, normalizeDraftPath, legacyDraftRedirect, draftUrl } from '../utils/siteRoutes.js';

describe('isDraftPath', () => {
  it('matches /draft and paths below it, in any case', () => {
    expect(isDraftPath('/draft')).toBe(true);
    expect(isDraftPath('/draft/')).toBe(true);
    expect(isDraftPath('/draft/overview')).toBe(true);
    expect(isDraftPath('/DRAFT')).toBe(true);
    expect(isDraftPath('/Draft/login')).toBe(true);
  });

  it('does not match the league site or look-alike paths', () => {
    expect(isDraftPath('/')).toBe(false);
    expect(isDraftPath('/equipos')).toBe(false);
    expect(isDraftPath('/drafts')).toBe(false);
    expect(isDraftPath('/draftee/x')).toBe(false);
    expect(isDraftPath('')).toBe(false);
  });
});

describe('normalizeDraftPath', () => {
  it('lowercases only the /draft prefix', () => {
    expect(normalizeDraftPath('/DRAFT')).toBe('/draft');
    expect(normalizeDraftPath('/DRAFT/team/AbC123')).toBe('/draft/team/AbC123');
  });

  it('leaves other paths unchanged', () => {
    expect(normalizeDraftPath('/Equipos')).toBe('/Equipos');
  });
});

describe('legacyDraftRedirect', () => {
  it('sends the old OBS query modes to the draft, keeping the query', () => {
    expect(legacyDraftRedirect({ pathname: '/', search: '?mode=obs' })).toBe('/draft/?mode=obs');
    expect(legacyDraftRedirect({ pathname: '/torneo', search: '?mode=obs&view=groups' }))
      .toBe('/draft/torneo?mode=obs&view=groups');
  });

  it('keeps league URLs on the league site', () => {
    expect(legacyDraftRedirect({ pathname: '/', search: '' })).toBeNull();
    expect(legacyDraftRedirect({ pathname: '/torneo', search: '?view=groups' })).toBeNull();
    expect(legacyDraftRedirect({ pathname: '/equipos', search: '?mode=obs' })).toBeNull();
  });
});

describe('draftUrl', () => {
  it('builds an absolute URL under the draft base', () => {
    expect(draftUrl('/tactics/view/x1', 'https://scl.app')).toBe(`https://scl.app${DRAFT_BASE}/tactics/view/x1`);
    expect(draftUrl('torneo?mode=obs', 'https://scl.app')).toBe('https://scl.app/draft/torneo?mode=obs');
  });
});
