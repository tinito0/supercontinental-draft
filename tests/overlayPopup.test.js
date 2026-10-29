// Popup con QR del overlay de OBS (utils/overlayPopup.js): datos sintéticos.
import qrcode from 'qrcode-generator';
import { buildPopup, currentSiteUrl, nextArrival, normalizePopupUrl, popupRemainingMs, qrSvgPath, timedRemainingMs, POPUP_LIMITS } from '../utils/overlayPopup.js';
import { SITE_URL } from '../utils/sharePages.js';

describe('currentSiteUrl', () => {
  it('moves links on the old Firebase hosts to the current site, keeping path and query', () => {
    expect(currentSiteUrl('https://supercont-d62df.web.app/en-vivo')).toBe(`${SITE_URL}/en-vivo`);
    expect(currentSiteUrl('https://supercont-d62df.firebaseapp.com/torneo?x=1#t')).toBe(`${SITE_URL}/torneo?x=1#t`);
  });

  it('leaves other links and garbage untouched', () => {
    expect(currentSiteUrl('https://example.com/torneo')).toBe('https://example.com/torneo');
    expect(currentSiteUrl('not a url')).toBe('not a url');
    expect(currentSiteUrl('')).toBe('');
  });

  it('normalizePopupUrl stores the current site for an old-host link', () => {
    expect(normalizePopupUrl('https://supercont-d62df.web.app/')).toEqual({ ok: true, url: `${SITE_URL}/` });
  });
});

const form = extra => ({ visible: true, title: 'Seguí la liga', text: 'Escaneá', url: 'https://example.com/torneo', position: 'right', autoHideSec: 30, ...extra });

describe('normalizePopupUrl', () => {
  it('accepts https links and normalises them', () => {
    expect(normalizePopupUrl('  https://Example.com/torneo ')).toEqual({ ok: true, url: 'https://example.com/torneo' });
  });

  it('refuses other schemes, credentials, garbage and over-long links', () => {
    expect(normalizePopupUrl('http://example.com').ok).toBe(false);
    expect(normalizePopupUrl('javascript:alert(1)').ok).toBe(false);
    expect(normalizePopupUrl('https://user:pw@example.com').ok).toBe(false);
    expect(normalizePopupUrl('example.com').ok).toBe(false);
    expect(normalizePopupUrl('').ok).toBe(false);
    expect(normalizePopupUrl(`https://example.com/${'a'.repeat(POPUP_LIMITS.URL)}`).ok).toBe(false);
  });
});

describe('buildPopup', () => {
  it('builds the stored popup, clipping long texts and defaulting an unknown position', () => {
    const result = buildPopup(form({ title: `  ${'T'.repeat(80)}  `, position: 'top' }));
    expect(result.ok).toBe(true);
    expect(result.popup.title).toHaveLength(POPUP_LIMITS.TITLE);
    expect(result.popup).toMatchObject({ visible: true, url: 'https://example.com/torneo', position: 'right', autoHideSec: 30 });
  });

  it('allows 0 seconds (until hidden) and refuses durations out of range or a missing title', () => {
    expect(buildPopup(form({ autoHideSec: 0 })).popup.autoHideSec).toBe(0);
    expect(buildPopup(form({ autoHideSec: 2 })).ok).toBe(false);
    expect(buildPopup(form({ autoHideSec: 'x' })).ok).toBe(false);
    expect(buildPopup(form({ title: '   ' })).ok).toBe(false);
  });
});

describe('popupRemainingMs', () => {
  const popup = { visible: true, url: 'https://example.com', autoHideSec: 30, shownAt: 1_000_000 };

  it('counts down from shownAt and stops at zero', () => {
    expect(popupRemainingMs(popup, 1_010_000)).toBe(20_000);
    expect(popupRemainingMs(popup, 1_040_000)).toBe(0);
  });

  it('reads Firestore timestamps and treats a pending server timestamp as just shown', () => {
    expect(popupRemainingMs({ ...popup, shownAt: { toMillis: () => 1_000_000 } }, 1_005_000)).toBe(25_000);
    expect(popupRemainingMs({ ...popup, shownAt: null }, 5)).toBe(30_000);
  });

  it('has no limit with 0 seconds and is hidden when not visible', () => {
    expect(popupRemainingMs({ ...popup, autoHideSec: 0 }, 9e12)).toBeNull();
    expect(popupRemainingMs({ ...popup, visible: false }, 1_000_000)).toBe(0);
    expect(popupRemainingMs(undefined, 0)).toBe(0);
  });
});

describe('qrSvgPath', () => {
  it('draws exactly the dark modules of the QR, inside a 4-module quiet zone', () => {
    const url = 'https://example.com/torneo';
    const { size, path } = qrSvgPath(url);
    const qr = qrcode(0, 'M');
    qr.addData(url, 'Byte');
    qr.make();
    const count = qr.getModuleCount();
    expect(size).toBe(count + 8);
    let dark = 0;
    for (let r = 0; r < count; r += 1) for (let c = 0; c < count; c += 1) if (qr.isDark(r, c)) dark += 1;
    expect(path.split('M').length - 1).toBe(dark);
    // The top-left finder pattern starts at the margin.
    expect(path.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});

describe('popup timing with a drifting OBS clock', () => {
  it('never keeps an item longer than its duration when the local clock is behind', () => {
    const item = { visible: true, autoHideSec: 30, shownAt: 1_000_000 + 120_000 };
    expect(timedRemainingMs(item, 1_000_000)).toBe(30_000);
  });

  it('the first data a source receives trusts shownAt, so a refresh does not replay an old popup', () => {
    const empty = { key: null, at: null, seen: false };
    expect(nextArrival(empty, '1000', 5000)).toEqual({ key: '1000', at: null, seen: true });
  });

  it('while the overlay doc loads nothing counts as new; once loaded, an empty doc makes the next popup new', () => {
    const start = { key: null, at: null, seen: false };
    expect(nextArrival(start, null, 5000, false)).toBe(start);
    const loadedEmpty = nextArrival(start, null, 5000, true);
    expect(loadedEmpty).toEqual({ key: null, at: null, seen: true });
    expect(nextArrival(loadedEmpty, '1000', 8000)).toEqual({ key: '1000', at: 8000, seen: true });
  });

  it('a shownAt in the future at load can only be a slow clock: it counts from now', () => {
    expect(nextArrival({ key: null, at: null, seen: false }, '9000', 5000)).toEqual({ key: '9000', at: 5000, seen: true });
  });

  it('a popup shown while the source is open counts from its arrival', () => {
    const loaded = { key: '1000', at: null, seen: true };
    expect(nextArrival(loaded, '9999999', 5000)).toEqual({ key: '9999999', at: 5000, seen: true });
    expect(nextArrival({ key: null, at: null, seen: true }, '42', 7000)).toEqual({ key: '42', at: 7000, seen: true });
  });

  it('a pending serverTimestamp that resolves keeps the same start', () => {
    const pending = { key: 'pending', at: 5000, seen: true };
    expect(nextArrival(pending, '123', 9000)).toEqual({ key: '123', at: 5000, seen: true });
  });

  it('returns the same state when nothing changed (no re-render loop)', () => {
    const state = { key: '1', at: 3, seen: true };
    expect(nextArrival(state, '1', 99)).toBe(state);
  });
});
