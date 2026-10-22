// Popup con QR del overlay de OBS (utils/overlayPopup.js): datos sintéticos.
import qrcode from 'qrcode-generator';
import { buildPopup, normalizePopupUrl, popupRemainingMs, qrSvgPath, POPUP_LIMITS } from '../utils/overlayPopup.js';

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
