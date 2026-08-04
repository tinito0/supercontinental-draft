import React, { memo } from 'react';
import { Bell, Menu, MessageSquareText, TrendingUp } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';

export const TopHeader = memo(function TopHeader({
  userProfile,
  unreadCount,
  unreadChatCount,
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
    <header data-app-tour="topbar" className="flex items-center py-3 px-4 bg-[#0a0a0a] z-40 shrink-0 gap-4"
      style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04)' }}
    >
      {/* ─── Hamburger toggle ─── */}
      <button
        data-app-tour="menu"
        onClick={onToggleSidebar}
        className="flex items-center justify-center min-w-12 min-h-12 rounded-lg text-gray-500
          hover:text-white hover:bg-white/[0.06] transition-all flex-shrink-0"
        title={isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ─── Club identity ─── */}
      <div data-app-tour="team" className="flex items-center gap-3 group cursor-default flex-1 min-w-0">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.04] flex-shrink-0">
          <img
            src={userProfile?.logoUrl || DEFAULT_LOGO}
            alt="Logo"
            className="w-full h-full object-contain drop-shadow"
            onError={(e) => { e.target.src = DEFAULT_LOGO; }}
          />
        </div>
        <h1 className="text-base font-black text-white/90 italic tracking-widest uppercase truncate
          group-hover:text-cyan-50 transition-colors">
          {userProfile?.teamName || 'USUARIO ANÓNIMO'}
        </h1>
      </div>

      {/* ─── Right actions ─── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          data-app-tour="chat"
          onClick={onChatClick}
          {...prefetchHandlers(onChatPrefetch)}
          className="relative flex items-center justify-center min-w-12 min-h-12 rounded-lg text-gray-500
            hover:text-white hover:bg-white/[0.06] transition-all"
          title="Chat de Managers"
        >
          <MessageSquareText className="w-5 h-5" />
          {unreadChatCount > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-cyan-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </button>
        <button
          data-app-tour="transfers"
          onClick={onTransferFeedClick}
          {...prefetchHandlers(onTransferFeedPrefetch)}
          className="flex items-center justify-center min-w-12 min-h-12 rounded-lg text-gray-500
            hover:text-white hover:bg-white/[0.06] transition-all"
          title="Noticias y Mercado"
        >
          <TrendingUp className="w-5 h-5" />
        </button>
        <button
          data-app-tour="notifications"
          onClick={onNotificationClick}
          {...prefetchHandlers(onNotificationPrefetch)}
          className="relative flex items-center justify-center min-w-12 min-h-12 rounded-lg text-gray-500
            hover:text-white hover:bg-white/[0.06] transition-all"
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
