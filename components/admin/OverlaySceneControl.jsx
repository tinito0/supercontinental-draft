import React, { memo, useState } from 'react';
import { Clapperboard, Copy, EyeOff, Keyboard, Users } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';

// Botonera de escenas del overlay de OBS: cada botón publica al instante (sin «Guardar»), igual que los botones de
// Macro Deck (scl-obs → función overlay-control). Mismo doc: public/data/broadcast/overlay.

export const OBS_SCENES = [
  { id: 'live', label: 'En partido', hint: 'Solo el popup con QR' },
  { id: 'previa', label: 'Previa', hint: 'Los dos equipos' },
  { id: 'descanso', label: 'Entretiempo', hint: 'Equipos y resultado' },
  { id: 'final', label: 'Final', hint: 'Resultado final' },
  { id: 'tabla', label: 'Tabla', hint: 'Posiciones de la liga' },
  { id: 'bracket', label: 'Copa de Oro', hint: 'Llaves' },
  { id: 'repechaje', label: 'Copa de Plata', hint: 'Llaves' },
  { id: 'goleadores', label: 'Goleadores', hint: 'Tabla de goleadores' },
];

const TOGGLES = [
  { field: 'showLowerThird', target: 'lower', label: 'Lower third' },
  { field: 'showTicker', target: 'ticker', label: 'Ticker' },
  { field: 'showScoreboard', target: 'marcador', label: 'Marcador' },
];

// Cuerpos JSON de la función overlay-control (supabase/functions/_shared/overlayControl.js).
const MACRO_DECK_COMMANDS = [
  ...OBS_SCENES.map(scene => ({ label: scene.label, body: { action: 'scene', scene: scene.id } })),
  { label: 'Popup: votá el MVP (45 s)', body: { action: 'popup', preset: 'vota', seconds: 45 } },
  { label: 'Popup: tabla y copas (30 s)', body: { action: 'popup', preset: 'tabla', seconds: 30 } },
  { label: 'Popup: seguí la liga (30 s)', body: { action: 'popup', preset: 'liga', seconds: 30 } },
  { label: 'Ocultar popup', body: { action: 'popup', preset: 'off' } },
  { label: 'Tarjeta: MVP en vivo (20 s)', body: { action: 'card', kind: 'mvp', seconds: 20 } },
  { label: 'Tarjeta: predicción (20 s)', body: { action: 'card', kind: 'prediction', seconds: 20 } },
  { label: 'Tarjeta: ¿quién gana la copa? (20 s)', body: { action: 'card', kind: 'cup', seconds: 20 } },
  { label: 'Ocultar tarjeta', body: { action: 'card', kind: 'off' } },
  { label: 'Automático apagado', body: { action: 'toggle', target: 'auto', value: 'off' } },
  { label: 'Automático prendido', body: { action: 'toggle', target: 'auto', value: 'on' } },
  { label: 'Ticker apagado', body: { action: 'toggle', target: 'ticker', value: 'off' } },
  { label: 'Ticker prendido', body: { action: 'toggle', target: 'ticker', value: 'on' } },
];

// Tarjetas de la comunidad (components/broadcast/CommunityCard.jsx); sin votos no aparecen.
const COMMUNITY_CARDS = [
  { kind: 'mvp', label: 'MVP en vivo', hint: 'Quién va ganando y por cuánto' },
  { kind: 'prediction', label: 'Predicción', hint: 'Local, empate o visitante' },
  { kind: 'cup', label: 'Copa', hint: '¿Quién gana la copa?' },
];
const CARD_SECONDS = 20;

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://<proyecto>.supabase.co';
export const OVERLAY_CONTROL_URL = `${supabaseUrl}/functions/v1/overlay-control`;

function CopyButton({ text, label, onCopied }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(label);
    } catch {
      onCopied('');
    }
  };
  return (
    <button type="button" className="btn btn-ghost btn-sm min-h-11 font-mono max-w-full" onClick={copy} title={`Copiar: ${text}`}>
      <span className="truncate">{text}</span> <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    </button>
  );
}

/** Cómo armar los botones en Macro Deck 3 (acción integrada «Send HTTP Request»). No muestra el token. */
function MacroDeckGuide() {
  const [copied, setCopied] = useState('');
  return (
    <details className="well px-4 py-3">
      <summary className="cursor-pointer min-h-11 flex items-center gap-2 text-sm font-semibold text-ink-2">
        <Keyboard className="w-4 h-4" aria-hidden="true" /> Botones de Macro Deck 3
      </summary>
      <div className="pt-3 space-y-3 text-sm text-ink-3">
        <p>Cada botón usa la acción <span className="text-ink-2 font-semibold">HTTP → Send HTTP Request</span>, con:</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 items-center">
          <dt>Método</dt><dd className="text-ink-2 font-mono">POST</dd>
          <dt>URL</dt><dd className="min-w-0"><CopyButton text={OVERLAY_CONTROL_URL} label="URL" onCopied={setCopied} /></dd>
          <dt>Autenticación</dt>
          <dd>Bearer token: el <code className="text-ink-2">token</code> de <code className="text-ink-2">{'%APPDATA%\\scl-bridge\\config.json'}</code> en esta PC (el mismo del bridge; no lo compartas).</dd>
          <dt>Body</dt><dd>JSON, uno de estos:</dd>
        </dl>
        <ul className="divide-y divide-line/10">
          {MACRO_DECK_COMMANDS.map(command => (
            <li key={command.label} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{command.label}</span>
              <CopyButton text={JSON.stringify(command.body)} label={command.label} onCopied={setCopied} />
            </li>
          ))}
        </ul>
        {copied && <p role="status" className="text-xs text-success-soft">Copiado: {copied}</p>}
        <p className="text-xs">Las escenas de OBS (cámaras, fuentes) se siguen cambiando con el plugin de OBS de Macro Deck. Sin Macro Deck 3: {'pes-collector\\bridge\\scl-obs.cmd'} (docs/MATCH_FEED.md).</p>
      </div>
    </details>
  );
}

/**
 * @param {{ saved: object, overlay?: object, onPersist: (patch: object, message: string) => Promise<boolean> }} props
 *   overlay: el doc completo (popup y tarjeta automáticos, tarjeta al aire)
 */
export const OverlaySceneControl = memo(function OverlaySceneControl({ saved, overlay, onPersist }) {
  const [busy, setBusy] = useState('');
  const isAuto = overlay?.autoPopup !== false;
  const run = async (key, patch, message) => {
    setBusy(key);
    try {
      await onPersist(patch, message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="overlay-scenes-title">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 id="overlay-scenes-title" className="section-title flex items-center gap-2.5">
          <Clapperboard className="w-5 h-5 text-accent-soft" aria-hidden="true" /> Escena en OBS
        </h3>
        <p className="text-xs text-ink-3">Cada botón cambia OBS al instante.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Escena del overlay">
        {OBS_SCENES.map(scene => {
          const isActive = (saved.scene || 'live') === scene.id;
          return (
            <button
              key={scene.id}
              type="button"
              aria-pressed={isActive}
              disabled={Boolean(busy)}
              onClick={() => !isActive && run(scene.id, { scene: scene.id }, `OBS: ${scene.label}.`)}
              className={`min-h-16 rounded-xl border px-3 py-2 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.97] ${isActive
                ? 'bg-accent-deep/70 border-accent text-ink'
                : 'bg-raised border-line/[0.16] text-ink-2 hover:border-line/40'}`}
            >
              <span className="flex items-center gap-2 font-display text-base font-bold">
                {isActive && <span className="w-2 h-2 rounded-full bg-success-soft" aria-hidden="true" />}
                {scene.label}
              </span>
              <span className="block text-xs text-ink-3 mt-0.5">{busy === scene.id ? 'Cambiando…' : scene.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TOGGLES.map(toggle => {
          const isOn = Boolean(saved[toggle.field]);
          return (
            <label key={toggle.field} className={`flex items-center justify-between min-h-11 rounded-lg border px-4 cursor-pointer transition-colors ${isOn ? 'bg-accent-deep/60 border-accent/60 text-ink' : 'bg-raised border-line/[0.16] text-ink-2 hover:border-line/30'}`}>
              <span className="text-sm font-semibold">{toggle.label}</span>
              <input
                type="checkbox"
                aria-label={`Mostrar ${toggle.label.toLowerCase()} en OBS`}
                checked={isOn}
                disabled={Boolean(busy)}
                onChange={event => run(toggle.field, { [toggle.field]: event.target.checked }, `${toggle.label}: ${event.target.checked ? 'visible' : 'oculto'}.`)}
                className="h-4 w-4 accent-[rgb(var(--c-accent))]"
              />
            </label>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">En la escena «En partido» no se muestra nada de esto: el juego ya tiene marcador y reloj.</p>

      <div className="space-y-2" role="group" aria-labelledby="overlay-cards-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="overlay-cards-title" className="eyebrow flex items-center gap-2"><Users className="h-4 w-4" aria-hidden="true" /> Tarjetas de la comunidad</h4>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={isAuto}
              disabled={Boolean(busy)}
              onChange={event => run('auto', { autoPopup: event.target.checked }, `Automático ${event.target.checked ? 'prendido' : 'apagado'}.`)}
              className="h-4 w-4 accent-[rgb(var(--c-accent))]"
            />
            Automático
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          {COMMUNITY_CARDS.map(card => (
            <button key={card.kind} type="button" disabled={Boolean(busy)}
              onClick={() => run(`card-${card.kind}`, { card: { visible: true, kind: card.kind, autoHideSec: CARD_SECONDS, shownAt: serverTimestamp() } }, `OBS: tarjeta ${card.label} (${CARD_SECONDS} s).`)}
              className="min-h-14 rounded-xl border border-line/[0.16] bg-raised px-3 py-2 text-left text-ink-2 transition-[border-color,transform] duration-150 ease-out hover:border-line/40 active:scale-[0.97]">
              <span className="block font-display text-base font-bold text-ink">{card.label}</span>
              <span className="block text-xs text-ink-3">{busy === `card-${card.kind}` ? 'Mostrando…' : card.hint}</span>
            </button>
          ))}
          <button type="button" disabled={Boolean(busy) || !overlay?.card?.visible}
            onClick={() => run('card-off', { card: { ...(overlay?.card || {}), visible: false } }, 'Tarjeta oculta.')}
            className="btn btn-ghost min-h-14">
            <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar
          </button>
        </div>
        <p className="text-xs text-ink-3">
          Automático: el popup «Votá el MVP» sale en el entretiempo y al final, la predicción al arrancar y el MVP en vivo desde el minuto 70. Sin votos, la tarjeta no aparece.
        </p>
      </div>

      <MacroDeckGuide />
    </section>
  );
});

export default OverlaySceneControl;
