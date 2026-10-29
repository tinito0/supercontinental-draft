import React, { memo, useCallback, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { StatusAlert } from './StatusAlert.jsx';
import { useExitAnimation, usePresenceList } from '../hooks/usePresence.js';

// One corner for every transient message: the status alert and the rivals' signings used to be two separate fixed
// boxes in the same spot, so the alert covered the newest signing. Entry and exit are in index.css (.toast).

const ToastFrame = memo(function ToastFrame({ itemKey, isLeaving, onExited, children }) {
  const ref = useRef(null);
  const handleExited = useCallback(() => onExited(itemKey), [onExited, itemKey]);
  useExitAnimation(ref, isLeaving, handleExited);
  return (
    <div
      ref={ref}
      className="toast pointer-events-auto"
      data-closing={isLeaving ? '' : undefined}
      // A leaving toast can no longer be clicked or focused, and is not read again.
      inert={isLeaving ? '' : undefined}
      aria-hidden={isLeaving || undefined}
    >
      {children}
    </div>
  );
});

function SigningToast({ toast, onOpen, onDismiss }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver fichaje: ${toast.teamName} fichó a ${toast.playerName}`}
      onClick={() => onOpen(toast)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(toast);
        }
      }}
      className="cursor-pointer panel hover:border-line/30 transition-colors rounded-xl p-3 flex items-center gap-3 group"
      style={{ borderLeft: `4px solid ${toast.posColor}` }}
    >
      <img
        src={`/fotos_jugadores/${toast.playerId}.webp`}
        alt=""
        width={40}
        height={40}
        className="w-10 h-10 rounded-lg object-cover bg-raised shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-2 leading-snug">
          <span className="font-semibold text-ink">{toast.teamName}</span>{' '}fichó a{' '}
          <span className="font-semibold text-ink">{toast.playerName}</span>
        </p>
        <p className="text-xs text-ink-3 mt-0.5">
          <span className="num">{toast.ovr}</span> OVR · {toast.pos}
        </p>
      </div>
      <span className="text-xs font-semibold text-accent-soft shrink-0">Ver</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.toastId);
        }}
        type="button"
        className="w-8 h-8 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-white/10 shrink-0"
        title="Cerrar aviso"
        aria-label="Cerrar aviso"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Bottom right on desktop; full width at the bottom on phones. Above the player comparison tray while it is open, at
 * every width (on tablets the tray reaches the right corner).
 * The status alert sits last, nearest the corner.
 */
export const ToastStack = memo(function ToastStack({ statusMessage, onCloseStatus, signingToasts, onOpenSigning, onDismissSigning, isAboveTray }) {
  const items = useMemo(() => {
    const list = signingToasts.map(toast => ({ key: toast.toastId, kind: 'signing', toast }));
    if (statusMessage?.text) {
      // One key for every status message: "cargando" turning into "listo" updates in place instead of a second
      // toast entering while the first one leaves.
      list.push({ key: 'status', kind: 'status', ...statusMessage });
    }
    return list;
  }, [signingToasts, statusMessage]);
  const { items: rendered, onExited } = usePresenceList(items);

  if (rendered.length === 0) return null;

  return (
    <div className={`fixed z-toast left-3 right-3 sm:left-auto sm:right-6 sm:w-[380px] flex flex-col gap-3 pointer-events-none pb-[env(safe-area-inset-bottom)] ${isAboveTray ? 'bottom-28' : 'bottom-3 sm:bottom-6'}`}>
      {rendered.map(item => (
        <ToastFrame key={item.key} itemKey={item.key} isLeaving={item.leaving} onExited={onExited}>
          {item.kind === 'status'
            ? <StatusAlert type={item.type} message={item.text} onClose={onCloseStatus} />
            : <SigningToast toast={item.toast} onOpen={onOpenSigning} onDismiss={onDismissSigning} />}
        </ToastFrame>
      ))}
    </div>
  );
});
