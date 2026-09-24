import React, { memo } from 'react';
import { Bell, Menu, MessageSquareText, TrendingUp } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort } from '../utils/helpers.js';

export const TopHeader = memo(function TopHeader({
  userProfile,
  unreadCount,
  unreadChatCount,
  remainingBudget,
  onNotificationClick,
  onChatClick,
  onTransferFeedClick,
  onNotificationPrefetch,
  onChatPrefetch,
  onTransferFeedPrefetch,
  onLogout,
  isSidebarOpen,
  onToggleSidebar,
}) {
  const prefetchHandlers = (handler) => ({
    onPointerEnter: handler,
    onFocus: handler,
    onTouchStart: handler,
  });

  return (
    <header data-app-tour="topbar" className="flex items-center py-2.5 sm:py-3 px-3 sm:px-4 bg-[#06080d] border-b border-white/[0.07] z-40 shrink-0 gap-2 sm:gap-4 transition-colors">
      {/* ─── Hamburger toggle ─── */}
      <button
        data-app-tour="menu"
        onClick={onToggleSidebar}
        className="flex items-center justify-center min-w-10 min-h-10 sm:min-w-12 sm:min-h-12 rounded-lg text-slate-400
          hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0 cursor-pointer"
        title={isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ─── Club identity ─── */}
      <div data-app-tour="team" className="flex items-center gap-2.5 sm:gap-3 group cursor-default flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border border-white/10 flex-shrink-0 shadow-sm">
          <img
            src={userProfile?.logoUrl || DEFAULT_LOGO}
            alt="Logo"
            className="w-full h-full object-contain drop-shadow"
            onError={(e) => { e.target.src = DEFAULT_LOGO; }}
          />
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-white truncate
            group-hover:text-[#00b4d8] transition-colors">
            {userProfile?.teamName || 'USUARIO ANÓNIMO'}
          </h1>
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            v2.5.0
          </span>
        </div>
      </div>

      {/* ─── Budget pill (Desktop) ─── */}
      {typeof remainingBudget === 'number' && (
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs">
          <span className="text-slate-400 font-medium">Presupuesto:</span>
          <span className="font-bold text-emerald-400 tabular-nums">
            {formatPriceShort(remainingBudget / 1000000)}
          </span>
        </div>
      )}

      {/* ─── Right actions ─── */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button
          data-app-tour="chat"
          onClick={onChatClick}
          {...prefetchHandlers(onChatPrefetch)}
          className="relative flex items-center justify-center min-w-10 min-h-10 sm:min-w-11 sm:min-h-11 rounded-lg text-slate-400
            hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          title="Chat de Managers"
        >
          <MessageSquareText className="w-5 h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-[#00b4d8] text-[#030712] text-[9px] font-bold rounded-full flex items-center justify-center shadow-sm">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>

        <button
          data-app-tour="transfers"
          onClick={onTransferFeedClick}
          {...prefetchHandlers(onTransferFeedPrefetch)}
          className="flex items-center justify-center min-w-10 min-h-10 sm:min-w-11 sm:min-h-11 rounded-lg text-slate-400
            hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          title="Centro de Traspasos y Mercado"
        >
          <TrendingUp className="w-5 h-5" />
        </button>

        <button
          data-app-tour="notifications"
          onClick={onNotificationClick}
          {...prefetchHandlers(onNotificationPrefetch)}
          className="relative flex items-center justify-center min-w-10 min-h-10 sm:min-w-11 sm:min-h-11 rounded-lg text-slate-400
            hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          title="Notificaciones"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
});
