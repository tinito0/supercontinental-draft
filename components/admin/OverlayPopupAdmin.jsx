import React, { memo, useEffect, useRef, useState } from 'react';
import { rebaseOverlayForm } from '../../utils/broadcastMatches.js';
import { EyeOff, QrCode as QrIcon, Send } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { QrCode } from '../broadcast/OverlayPopup.jsx';
import {
  DEFAULT_POPUP, POPUP_LIMITS, POPUP_PRESETS, buildPopup, normalizePopupUrl, popupRemainingMs,
} from '../../utils/overlayPopup.js';

const POSITIONS = [
  { id: 'right', label: 'Derecha' },
  { id: 'left', label: 'Izquierda' },
  { id: 'center', label: 'Centro' },
];

const POPUP_FORM_FIELDS = ['title', 'text', 'url', 'position', 'autoHideSec'];

const siteUrl = path => (typeof window !== 'undefined' ? `${window.location.origin}${path}` : path);

function initialForm(saved) {
  return { ...DEFAULT_POPUP, url: siteUrl(POPUP_PRESETS[0].path), ...(saved || {}) };
}

function useOnAirSeconds(popup) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = popupRemainingMs(popup, now);
  useEffect(() => {
    if (!remaining) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [remaining, now]);
  return remaining;
}

/**
 * Popup con QR para la comunidad (components/broadcast/OverlayPopup.jsx). Se publica al instante en el campo `popup`
 * del doc del overlay, aparte de "Guardar overlay": mostrarlo no guarda otros cambios del formulario.
 * @param {{ savedPopup?: object, onPersist: (patch: object, message: string) => Promise<boolean> }} props
 */
export const OverlayPopupAdmin = memo(function OverlayPopupAdmin({ savedPopup, onPersist }) {
  const [form, setForm] = useState(() => initialForm(savedPopup));
  // Si el popup cambia desde otro lado (Macro Deck, el popup automático, otra pestaña), el formulario toma esos
  // valores salvo en los campos que se están editando. Antes quedaba con los viejos y «Mostrar» los republicaba.
  const baseRef = useRef(initialForm(savedPopup));
  useEffect(() => {
    const base = baseRef.current;
    const next = initialForm(savedPopup);
    baseRef.current = next;
    setForm(prev => rebaseOverlayForm(prev, base, next, POPUP_FORM_FIELDS));
  }, [savedPopup]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remaining = useOnAirSeconds(savedPopup);
  const isOnAir = remaining !== 0;
  const urlCheck = normalizePopupUrl(form.url);

  const update = (field, value) => {
    setError('');
    setForm(prev => ({ ...prev, [field]: value }));
  };
  const applyPreset = preset => {
    setError('');
    setForm(prev => ({ ...prev, title: preset.title, text: preset.text, url: siteUrl(preset.path) }));
  };

  const show = async () => {
    const built = buildPopup({ ...form, visible: true });
    if (!built.ok) {
      setError(built.reason);
      return;
    }
    setBusy(true);
    try {
      await onPersist({ popup: { ...built.popup, shownAt: serverTimestamp() } }, 'Popup al aire en OBS.');
    } finally {
      setBusy(false);
    }
  };

  const hide = async () => {
    setBusy(true);
    try {
      await onPersist({ popup: { ...DEFAULT_POPUP, ...(savedPopup || {}), visible: false } }, 'Popup oculto.');
    } finally {
      setBusy(false);
    }
  };

  const onAirLabel = remaining === null ? 'hasta que lo ocultes' : `${Math.ceil(remaining / 1000)} s más`;

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="overlay-popup-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 id="overlay-popup-title" className="section-title flex items-center gap-2.5">
          <QrIcon className="w-5 h-5 text-accent-soft" aria-hidden="true" /> Popup para la comunidad
        </h3>
        <p className="text-xs text-ink-3" role="status">
          {isOnAir ? <>Al aire · <span className="text-ink-2 font-semibold">{onAirLabel}</span></> : 'No se muestra'}
        </p>
      </div>
      <p className="text-xs text-ink-3">Una tarjeta con un QR sobre la transmisión, para que el público entre a la web desde el celular.</p>

      <div className="flex flex-wrap gap-2">
        {POPUP_PRESETS.map(preset => (
          <button key={preset.id} type="button" className="btn btn-secondary btn-sm min-h-11" onClick={() => applyPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-5">
        <div className="space-y-4 min-w-0">
          <Field label="Título">
            <input type="text" className="input" value={form.title} maxLength={POPUP_LIMITS.TITLE} onChange={event => update('title', event.target.value)} />
          </Field>
          <Field label="Texto">
            <input type="text" className="input" value={form.text} maxLength={POPUP_LIMITS.TEXT} onChange={event => update('text', event.target.value)} />
          </Field>
          <Field label="Enlace del QR">
            <input type="url" className="input" inputMode="url" value={form.url} onChange={event => update('url', event.target.value)} placeholder="https://…" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Posición">
              <select className="select" value={form.position} onChange={event => update('position', event.target.value)}>
                {POSITIONS.map(position => <option key={position.id} value={position.id}>{position.label}</option>)}
              </select>
            </Field>
            <Field label="Segundos en pantalla (0 = fijo)">
              <input type="number" className="input" inputMode="numeric" min={0} max={POPUP_LIMITS.MAX_SECONDS} value={form.autoHideSec} onChange={event => update('autoHideSec', event.target.value)} />
            </Field>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white p-3 rounded-lg">
            {urlCheck.ok
              ? <QrCode url={urlCheck.url} size={168} />
              : <div className="w-[168px] h-[168px] grid place-items-center text-xs text-slate-500 text-center px-3">{urlCheck.reason}</div>}
          </div>
          <p className="text-xs text-ink-3">Probalo con el celular</p>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4 border-t border-line/10">
        <button type="button" className="btn btn-ghost" onClick={hide} disabled={busy || !isOnAir}>
          <EyeOff className="w-4 h-4" aria-hidden="true" /> Ocultar
        </button>
        <button type="button" className="btn btn-primary" onClick={show} disabled={busy || !urlCheck.ok}>
          <Send className="w-4 h-4" aria-hidden="true" /> {isOnAir ? 'Actualizar y volver a mostrar' : 'Mostrar en OBS'}
        </button>
      </div>
    </section>
  );
});

export default OverlayPopupAdmin;
