import React, { memo, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Copy, EyeOff, Keyboard, Users } from 'lucide-react';
import { serverTimestamp } from 'firebase/firestore';
import { OBS_SCENES } from '../../utils/obsScenes.js';
import { useLiveMatch, useMvpVotes, usePoll, usePrediction } from '../../hooks/useLeagueData.js';
import { useNow } from '../../hooks/useNow.js';
import { buildOverlayLive, communityCardStatus } from '../../utils/overlayLive.js';
import { timedRemainingMs } from '../../utils/overlayPopup.js';
import { CUP_POLLS } from '../../utils/communityView.js';

// Capa de la comunidad sobre el overlay de OBS (tarjetas y popup automático) y la guía de Macro Deck. Esto se publica
// al instante, como los botones de Macro Deck (función overlay-control): no pasa por el borrador del editor de
// escenas (components/admin/obs/ObsSceneStudio.jsx). Mismo doc: public/data/broadcast/overlay.

export { OBS_SCENES };

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
 * Tarjetas de la comunidad y la llave «Automático». Publican al instante.
 * @param {{ overlay?: object, onPersist: (patch: object, message: string) => Promise<boolean> }} props
 */
/** Los mismos datos que dibuja el overlay (BroadcastOverlayLive): para saber si cada tarjeta se va a ver. */
function useCardStatus(overlay) {
  const liveMatchKey = overlay?.liveMatchKey || null;
  const { match } = useLiveMatch(liveMatchKey);
  const { data: prediction } = usePrediction(overlay?.matchId || null);
  const { data: mvpVotes } = useMvpVotes(liveMatchKey);
  const { data: oroPoll } = usePoll(CUP_POLLS[0].id);
  const { data: plataPoll } = usePoll(CUP_POLLS[1].id);
  return useMemo(() => communityCardStatus(
    buildOverlayLive({ match: liveMatchKey ? match : null, prediction, mvpVotes, polls: [oroPoll, plataPoll] }),
    overlay,
  ), [liveMatchKey, match, prediction, mvpVotes, oroPoll, plataPoll, overlay]);
}

export const CommunityLayerControl = memo(function CommunityLayerControl({ overlay, onPersist }) {
  const [busy, setBusy] = useState('');
  const status = useCardStatus(overlay);
  const now = useNow(1000);
  const onAir = overlay?.card?.visible ? timedRemainingMs(overlay.card, now) : 0;
  const onAirCard = onAir !== 0 ? COMMUNITY_CARDS.find(card => card.kind === overlay?.card?.kind) : null;
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
        {COMMUNITY_CARDS.map(card => {
          // Sin votos la tarjeta no se dibuja en OBS (CommunityCard): el botón lo dice y no publica a ciegas.
          const { ready, note } = status[card.kind];
          const StatusIcon = ready ? CircleCheck : CircleAlert;
          return (
            <button key={card.kind} type="button" disabled={Boolean(busy) || !ready}
              title={ready ? undefined : `No se va a ver en OBS: ${note.toLowerCase()}.`}
              onClick={() => run(`card-${card.kind}`, { card: { visible: true, kind: card.kind, autoHideSec: CARD_SECONDS, shownAt: serverTimestamp() } }, `OBS: tarjeta ${card.label} (${CARD_SECONDS} s).`)}
              className="min-h-14 rounded-xl border border-line/[0.16] bg-raised px-3 py-2 text-left text-ink-2 transition-[border-color,transform] duration-150 ease-out hover:border-line/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:border-line/[0.16] disabled:active:scale-100">
              <span className={`block font-display text-base font-bold ${ready ? 'text-ink' : 'text-ink-2'}`}>{card.label}</span>
              <span className={`mt-0.5 flex items-center gap-1.5 text-sm ${ready ? 'text-success-soft' : 'text-warning-soft'}`}>
                <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {busy === `card-${card.kind}` ? 'Mostrando…' : note}
              </span>
            </button>
          );
        })}
        <button type="button" disabled={Boolean(busy) || !overlay?.card?.visible}
          onClick={() => run('card-off', { card: { ...(overlay?.card || {}), visible: false } }, 'Tarjeta oculta.')}
          className="btn btn-ghost min-h-14">
          <EyeOff className="h-4 w-4" aria-hidden="true" /> Ocultar
        </button>
      </div>
      <p className="text-sm text-ink" role="status">
        {onAirCard
          ? <>En OBS ahora: <strong>{onAirCard.label}</strong>{onAir ? <> · se oculta en <span className="num">{Math.ceil(onAir / 1000)}</span> s</> : null}</>
          : 'Ninguna tarjeta en pantalla.'}
      </p>
      <p className="text-sm text-ink-2">
        Automático: el popup «Votá el MVP» sale en el entretiempo y al final, la predicción al arrancar y el MVP en vivo desde el minuto 70. Una tarjeta sin votos no aparece: los votos llegan desde /en-vivo.
      </p>
    </div>
  );
});

export { MacroDeckGuide };

export default CommunityLayerControl;
