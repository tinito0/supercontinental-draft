import React, { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { BaseModal } from './BaseModal.jsx';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { playerPlaceholder } from '../../utils/playerPlaceholder.js';

// One confirmation at a time, shown by <ConfirmHost /> (mounted once in app.jsx). Replaces window.confirm:
// it can show the player and the amount, speaks the app's voice, and «Cancelar» takes the focus.
let state = { request: null, isOpen: false };
const listeners = new Set();
const setState = (next) => { state = next; listeners.forEach(listener => listener()); };
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => state;

const plainText = (options) => [options.title, options.message, ...(options.details || [])].filter(v => typeof v === 'string').join('\n\n');

/**
 * Asks for confirmation and resolves true (confirmed) or false (cancelled, Escape, backdrop).
 * @param {object} options
 * @param {string} options.title  the question, short: «¿Aceptar la oferta?»
 * @param {React.ReactNode} [options.message]  what happens if confirmed
 * @param {string[]} [options.details]  lines listed under the message (a draw, the matches of a round)
 * @param {{Id, Name, POS_NOMBRE?, OVR_CALCULADO?}} [options.player]  shown with photo, position and OVR
 * @param {string} [options.amount]  shown next to the player in the display face («$18.00M»)
 * @param {string} [options.confirmLabel]  names the action: «Aceptar oferta», never «Sí»
 * @param {'danger'|'primary'} [options.tone]
 * @param {boolean} [options.irreversible]  adds «No se puede deshacer.»
 * @returns {Promise<boolean>}
 */
export function confirmAction(options) {
  // No host mounted (a screen outside the draft shell): fall back to the browser dialog rather than act unasked.
  if (listeners.size === 0) return Promise.resolve(window.confirm(plainText(options)));
  state.request?.resolve(false);
  return new Promise(resolve => setState({ request: { ...options, resolve }, isOpen: true }));
}

function settle(result) {
  if (!state.isOpen) return;
  state.request?.resolve(result);
  setState({ ...state, isOpen: false });
}

function PlayerLine({ player, amount }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-raised px-3 py-2.5">
      <img
        src={`/fotos_jugadores/${player.Id}.webp`}
        alt=""
        width={48}
        height={48}
        className="w-12 h-12 shrink-0 object-cover object-top rounded-lg bg-surface"
        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.substring(0, 2)); }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{player.Name}</p>
        {(player.POS_NOMBRE || player.OVR_CALCULADO) && (
          <div className="flex items-center gap-1.5 mt-1">
            {player.OVR_CALCULADO && <span className={`min-w-7 px-1 rounded font-display num text-sm font-bold text-center ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>{player.OVR_CALCULADO}</span>}
            {player.POS_NOMBRE && <span className={`px-1.5 rounded text-[11px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>}
          </div>
        )}
      </div>
      {amount && <span className="font-display num text-xl font-bold text-ink shrink-0">{amount}</span>}
    </div>
  );
}

export function ConfirmHost() {
  const { request, isOpen } = useSyncExternalStore(subscribe, getSnapshot);
  if (!request) return null;
  const { title, message, details, player, amount, confirmLabel = 'Confirmar', tone = 'danger', irreversible } = request;

  // Portal: the dialog is appended after every other modal, so it sits on top of the sheet that asked.
  return createPortal(
    <BaseModal
      isOpen={isOpen}
      onClose={() => settle(false)}
      size="sm"
      title={title}
      showClose={false}
      footer={(
        <>
          {/* First in the dialog, so it takes the focus: a reflex Enter cancels. */}
          <button type="button" className="btn btn-secondary" onClick={() => settle(false)}>Cancelar</button>
          <button type="button" className={`btn ${tone === 'primary' ? 'btn-primary' : 'btn-danger'}`} onClick={() => settle(true)}>{confirmLabel}</button>
        </>
      )}
    >
      <div className="space-y-3">
        {player && <PlayerLine player={player} amount={amount} />}
        {message && <p className="text-sm text-ink-2 leading-relaxed">{message}</p>}
        {details?.length > 0 && (
          <ul className="text-sm text-ink-2 space-y-1 rounded-xl bg-raised px-3 py-2.5">
            {details.map(line => <li key={line} className="num">{line}</li>)}
          </ul>
        )}
        {irreversible && <p className="text-sm font-semibold text-danger-soft">No se puede deshacer.</p>}
      </div>
    </BaseModal>,
    document.body,
  );
}

export default ConfirmHost;
