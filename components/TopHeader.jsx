import React, { memo } from 'react';
import { Bell, Menu, MessageSquareText, ArrowLeftRight, Keyboard } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort } from '../utils/helpers.js';
import { OnlineIndicator } from './ui/OnlineIndicator.jsx';
import { useOnlinePresence } from '../hooks/useOnlinePresence.js';
import { auth } from '../config/firebase.js';

const iconBtn = 'relative flex items-center justify-center w-11 h-11 rounded-lg text-ink-3 hover:text-ink hover:bg-white/[0.06] transition-colors';

/** Club budget: the one place the remaining budget is shown in the app chrome. */
function BudgetMeter({ remaining, initial }) {
  const pct = initial > 0 ? Math.max(0, Math.min(100, (remaining / initial) * 100)) : null;
  const tone = pct == null || pct > 50 ? 'bg-success' : pct > 20 ? 'bg-warning' : 'bg-danger';
  const text = pct == null || pct > 20 ? 'text-ink' : 'text-danger-soft';
  return (
    <div data-app-tour="budget" className="flex flex-col items-end justify-center min-w-0 px-1 sm:px-2" title={pct != null ? `${pct.toFixed(0)}% del presupuesto inicial` : undefined}>
      <span className="sr-only sm:not-sr-only sm:block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3 leading-none">Presupuesto<span className="sr-only">: </span></span>
      <span className={`font-display num text-lg sm:text-xl font-bold leading-none sm:mt-1 ${text}`}>{formatPriceShort(remaining / 1000000)}</span>
      {pct != null && (
        <span className="mt-1 h-[3px] w-14 sm:w-20 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
          <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}

export const TopHeader = memo(function TopHeader({
  userId,
  userProfile,
  unreadCount,
  unreadChatCount,
  remainingBudget,
  initialBudget,
  onlineCount: propOnlineCount,
  onNotificationClick,
  onChatClick,
  onTransferFeedClick,
  onShortcutsClick,
  onNotificationPrefetch,
  onChatPrefetch,
  onTransferFeedPrefetch,
  isSidebarOpen,
  onToggleSidebar,
}) {
  const effectiveUserId = userId || userProfile?.uid || auth?.currentUser?.uid;
  const presence = useOnlinePresence(propOnlineCount === undefined ? {
    userId: effectiveUserId,
    teamName: userProfile?.teamName,
  } : null);
  const onlineCount = propOnlineCount !== undefined ? propOnlineCount : presence.onlineCount;

  const prefetch = (handler) => ({ onPointerEnter: handler, onFocus: handler, onTouchStart: handler });

  return (
    <header data-app-tour="topbar" className="sticky top-0 z-40 flex items-center gap-1 sm:gap-3 h-14 sm:h-16 px-1.5 sm:px-4 bg-canvas/95 backdrop-blur border-b border-line/10 shrink-0">
      <button
        data-app-tour="menu"
        type="button"
        onClick={onToggleSidebar}
        className={iconBtn}
        aria-label={isSidebarOpen ? 'Cerrar menú lateral' : 'Abrir menú lateral'}
        aria-expanded={isSidebarOpen}
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Club identity */}
      <div data-app-tour="team" className="flex items-center gap-2.5 flex-1 min-w-0">
        <img
          src={userProfile?.logoUrl || DEFAULT_LOGO}
          alt=""
          width={36}
          height={36}
          className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
          onError={(e) => { e.target.src = DEFAULT_LOGO; }}
        />
        <div className="min-w-0 leading-none">
          <p className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Mi club</p>
          <p className="font-display text-base sm:text-lg font-bold text-ink truncate sm:mt-1">
            {userProfile?.teamName || 'Club sin nombre'}
          </p>
        </div>
      </div>

      <div className="hidden md:block"><OnlineIndicator count={onlineCount} /></div>

      {typeof remainingBudget === 'number' && <BudgetMeter remaining={remainingBudget} initial={initialBudget} />}

      <span className="hidden sm:block w-px h-8 bg-line/15 mx-1" aria-hidden="true" />

      <nav className="flex items-center shrink-0" aria-label="Actividad">
        <button
          data-app-tour="chat"
          type="button"
          onClick={onChatClick}
          {...prefetch(onChatPrefetch)}
          className={iconBtn}
          title="Chat de managers"
          aria-label={unreadChatCount > 0 ? `Chat de managers, ${unreadChatCount} mensajes sin leer` : 'Chat de managers'}
        >
          <MessageSquareText className="w-5 h-5" aria-hidden="true" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-accent text-[10px] font-bold num flex items-center justify-center" aria-hidden="true">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        <button
          data-app-tour="transfers"
          type="button"
          onClick={onTransferFeedClick}
          {...prefetch(onTransferFeedPrefetch)}
          className={iconBtn}
          title="Traspasos"
          aria-label="Centro de traspasos"
        >
          <ArrowLeftRight className="w-5 h-5" aria-hidden="true" />
        </button>

        {onShortcutsClick && (
          <button type="button" onClick={onShortcutsClick} className={`${iconBtn} !hidden lg:!flex`} title="Atajos de teclado (?)" aria-label="Atajos de teclado">
            <Keyboard className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <button
          data-app-tour="notifications"
          type="button"
          onClick={onNotificationClick}
          {...prefetch(onNotificationPrefetch)}
          className={iconBtn}
          title="Notificaciones"
          aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-danger ring-2 ring-canvas" aria-hidden="true" />}
        </button>
      </nav>
    </header>
  );
});

export default TopHeader;
