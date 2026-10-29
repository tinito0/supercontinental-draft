// Comandos de overlay-control (Macro Deck → scl-obs → función): supabase/functions/_shared/overlayControl.js.
import { AUTO_CARD_SECONDS, AUTO_POPUP_SECONDS, buildOverlayCommand, liveOverlayUpdate, OVERLAY_SCENES, POPUP_PRESETS as SERVER_PRESETS } from '../supabase/functions/_shared/overlayControl.js';
import { POPUP_PRESETS } from '../utils/overlayPopup.js';
import { parseObsArgs } from '../pes-collector/bridge/obsCommand.js';

const ctx = { siteUrl: 'https://supercont-d62df.web.app', now: 1_000 };

describe('buildOverlayCommand', () => {
  it('changes only the scene', () => {
    expect(buildOverlayCommand({ action: 'scene', scene: 'previa' }, ctx)).toEqual({ data: { scene: 'previa' }, mask: ['scene'], summary: 'escena previa' });
    expect(() => buildOverlayCommand({ action: 'scene', scene: 'x' }, ctx)).toThrow(/Escena desconocida/);
  });

  it('shows a preset popup with an absolute https link and the server time', () => {
    const { data, mask } = buildOverlayCommand({ action: 'popup', preset: 'tabla', seconds: 45, position: 'left' }, ctx);
    expect(mask).toEqual(['popup']);
    expect(data.popup).toEqual({
      visible: true, title: 'Tabla y copas en vivo', text: 'Escaneá y seguí el torneo desde el celular.',
      url: 'https://supercont-d62df.web.app/torneo', position: 'left', autoHideSec: 45, shownAt: 1_000,
    });
  });

  it('hides the popup touching only its visibility', () => {
    expect(buildOverlayCommand({ action: 'popup', preset: 'off' }, ctx)).toMatchObject({ data: { popup: { visible: false } }, mask: ['popup.visible'] });
  });

  it('rejects unknown presets, durations out of range, toggles and actions', () => {
    expect(() => buildOverlayCommand({ action: 'popup', preset: 'nada' }, ctx)).toThrow(/Popup desconocido/);
    expect(() => buildOverlayCommand({ action: 'popup', preset: 'liga', seconds: 9999 }, ctx)).toThrow(/duración/);
    expect(() => buildOverlayCommand({ action: 'toggle', target: 'logo', value: 'on' }, ctx)).toThrow(/Elemento desconocido/);
    expect(() => buildOverlayCommand({ action: 'toggle', target: 'ticker', value: 'maybe' }, ctx)).toThrow(/on u off/);
    expect(() => buildOverlayCommand({ action: 'borrar' }, ctx)).toThrow(/Acción desconocida/);
    expect(() => buildOverlayCommand(null, ctx)).toThrow(/Falta el comando/);
  });

  it('turns lower third and ticker on and off', () => {
    expect(buildOverlayCommand({ action: 'toggle', target: 'ticker', value: 'off' }, ctx)).toMatchObject({ data: { showTicker: false }, mask: ['showTicker'] });
    expect(buildOverlayCommand({ action: 'toggle', target: 'lower', value: true }, ctx)).toMatchObject({ data: { showLowerThird: true } });
  });

  it('keeps the server presets identical to the admin presets (the function cannot import utils/)', () => {
    const strip = presets => presets.map(({ id, title, text, path }) => ({ id, title, text, path }));
    expect(strip(SERVER_PRESETS)).toEqual(strip(POPUP_PRESETS));
    expect(OVERLAY_SCENES).toContain('live');
  });
});

describe('liveOverlayUpdate (match-feed → overlay)', () => {
  const key = '20261022T200000Z_101-1230';
  const live = (period, minute) => ({ matchKey: key, status: 'live', clock: { period, minute, second: 0 } });
  const run = (doc, overlay = {}) => liveOverlayUpdate({ doc, overlay, siteUrl: ctx.siteUrl, now: ctx.now });

  it('links the overlay to the match the bridge is uploading live, once', () => {
    expect(run(live(1, 10)).data.liveMatchKey).toBe(key);
    expect(run(live(1, 11), { liveMatchKey: key })).toBeNull();
  });

  it('shows the MVP popup at half-time (second half clock at 45:00) and only once', () => {
    const update = run(live(2, 45), { liveMatchKey: key, popup: { position: 'left' } });
    expect(update.mask).toEqual(['popup', 'autoPopupDone']);
    expect(update.data.autoPopupDone).toBe(`${key}:half`);
    expect(update.data.popup).toMatchObject({
      visible: true, url: 'https://supercont-d62df.web.app/en-vivo', autoHideSec: AUTO_POPUP_SECONDS, position: 'left', shownAt: ctx.now,
    });
    expect(run(live(2, 50), { liveMatchKey: key, autoPopupDone: `${key}:half` })).toBeNull();
  });

  it('ignores the first-half replay period (5) and the first half itself', () => {
    expect(run(live(5, 46), { liveMatchKey: key })).toBeNull();
    expect(run(live(1, 47), { liveMatchKey: key })).toBeNull();
  });

  it('shows it again at full time, never back to half-time after that', () => {
    const finished = { matchKey: key, status: 'finished', clock: { period: 3, minute: 90, second: 0 } };
    expect(run(finished, { liveMatchKey: key, autoPopupDone: `${key}:half` }).data.autoPopupDone).toBe(`${key}:final`);
    expect(run(finished, { liveMatchKey: key, autoPopupDone: `${key}:final` })).toBeNull();
    expect(run(live(2, 46), { liveMatchKey: key, autoPopupDone: `${key}:final` })).toBeNull();
  });

  it('does not react to an old finished match the bridge re-sends, nor to abandoned matches', () => {
    const old = { matchKey: '20261001T200000Z_1-2', status: 'finished', clock: { period: 3, minute: 90, second: 0 } };
    expect(run(old, { liveMatchKey: key })).toBeNull();
    expect(run({ ...live(1, 30), status: 'abandoned' }, { liveMatchKey: key })).toBeNull();
  });

  it('respects the admin switch: links the match but shows no popup', () => {
    expect(run(live(2, 45), { autoPopup: false })).toEqual({ data: { liveMatchKey: key }, mask: ['liveMatchKey'] });
  });

  it('shows the prediction card when a new match goes live, and the MVP card from minute 70', () => {
    const kickoff = run(live(1, 0));
    expect(kickoff.mask).toEqual(['liveMatchKey', 'card', 'autoCardDone']);
    expect(kickoff.data.card).toEqual({ visible: true, kind: 'prediction', autoHideSec: AUTO_CARD_SECONDS, shownAt: ctx.now });
    expect(run(live(2, 69), { liveMatchKey: key, autoCardDone: `${key}:kickoff`, autoPopupDone: `${key}:half` })).toBeNull();
    const mvp = run(live(2, 70), { liveMatchKey: key, autoCardDone: `${key}:kickoff`, autoPopupDone: `${key}:half` });
    expect(mvp.data).toMatchObject({ card: { kind: 'mvp' }, autoCardDone: `${key}:mvp` });
    expect(run(live(2, 80), { liveMatchKey: key, autoCardDone: `${key}:mvp`, autoPopupDone: `${key}:half` })).toBeNull();
    expect(run(live(1, 0), { autoPopup: false }).mask).toEqual(['liveMatchKey']);
  });

  it('shows and hides a community card on demand', () => {
    expect(buildOverlayCommand({ action: 'card', kind: 'cup', seconds: 25 }, ctx)).toEqual({
      data: { card: { visible: true, kind: 'cup', autoHideSec: 25, shownAt: ctx.now } }, mask: ['card'], summary: 'tarjeta cup',
    });
    expect(buildOverlayCommand({ action: 'card', kind: 'off' }, ctx)).toMatchObject({ data: { card: { visible: false } }, mask: ['card.visible'] });
    expect(() => buildOverlayCommand({ action: 'card', kind: 'tabla' }, ctx)).toThrow(/Tarjeta desconocida/);
  });

  it('turns the automatic popup on and off from Macro Deck', () => {
    expect(buildOverlayCommand({ action: 'toggle', target: 'auto', value: 'off' }, ctx)).toMatchObject({ data: { autoPopup: false }, mask: ['autoPopup'] });
  });
});

describe('parseObsArgs (scl-obs)', () => {
  it('builds community card commands', () => {
    expect(parseObsArgs(['card', 'MVP', '15'])).toEqual({ action: 'card', kind: 'mvp', seconds: 15 });
    expect(parseObsArgs(['card', 'off'])).toEqual({ action: 'card', kind: 'off' });
    expect(() => parseObsArgs(['card', 'mvp', 'x'])).toThrow(/Uso/);
    expect(parseObsArgs(['toggle', 'auto', 'off'])).toEqual({ action: 'toggle', target: 'auto', value: 'off' });
  });

  it('builds the commands Macro Deck buttons send', () => {
    expect(parseObsArgs(['scene', 'Previa'])).toEqual({ action: 'scene', scene: 'previa' });
    expect(parseObsArgs(['popup', 'tabla', '30', 'center'])).toEqual({ action: 'popup', preset: 'tabla', seconds: 30, position: 'center' });
    expect(parseObsArgs(['popup', 'off'])).toEqual({ action: 'popup', preset: 'off' });
    expect(parseObsArgs(['toggle', 'ticker', 'off'])).toEqual({ action: 'toggle', target: 'ticker', value: 'off' });
  });

  it('shows the usage on bad input', () => {
    expect(() => parseObsArgs([])).toThrow(/Uso/);
    expect(() => parseObsArgs(['popup', 'liga', 'mucho'])).toThrow(/Uso/);
    expect(() => parseObsArgs(['toggle', 'ticker'])).toThrow(/Uso/);
    expect(() => parseObsArgs(['volar', 'x'])).toThrow(/Uso/);
  });
});
