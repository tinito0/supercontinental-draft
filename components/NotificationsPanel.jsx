import React, { memo, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BadgeDollarSign, Bell, Check, ChevronRight, Info, X } from 'lucide-react';

const TYPE_CONFIG = {
  warning: { icon: AlertTriangle, wrap: 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200 hover:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400' },
  offer: { icon: BadgeDollarSign, wrap: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  transfer: { icon: ArrowRightLeft, wrap: 'bg-purple-500/10 border-purple-500/20 text-purple-900 dark:text-purple-200 hover:bg-purple-500/15', iconColor: 'text-purple-600 dark:text-purple-400' },
  info: { icon: Info, wrap: 'bg-sky-500/10 border-sky-500/20 text-sky-900 dark:text-sky-200 hover:bg-sky-500/15', iconColor: 'text-sky-600 dark:text-sky-400' },
  default: { icon: Bell, wrap: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800', iconColor: 'text-slate-500 dark:text-slate-400' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.default;
}

const NotificationItem = memo(function NotificationItem({ notif, onClick, onDismiss }) {
  const { icon: Icon, wrap, iconColor } = getTypeConfig(notif.type);
  const isUnread = notif.read !== true;
  const isClickable = typeof onClick === 'function';

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onClick(notif) : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(notif); } } : undefined}
      className={`group relative flex items-start gap-2.5 p-3 pr-8 rounded-xl text-sm border transition-all duration-150 ${wrap} ${
        isClickable ? 'cursor-pointer hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500/40' : ''
      }`}
    >
      {isUnread && <span className="absolute top-2.5 left-2 w-2 h-2 rounded-full bg-sky-500" />}

      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />

      <div className="min-w-0 flex-1 pl-1">
        <p className={`text-xs leading-snug ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>{notif.text}</p>
        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/50 dark:border-white/[0.06]">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{notif.time}</span>
          {isClickable && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
              Ver <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {typeof onDismiss === 'function' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(notif); }}
          className="absolute top-2 right-2 min-w-6 min-h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/10 transition"
          title="Descartar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

export const NotificationsPanel = memo(function NotificationsPanel({
  isOpen,
  notifications,
  isLoading = false,
  onClose,
  onClear,
  onNotifClick,
  onDismissOne,
  onMarkAllRead,
}) {
  const unreadCount = notifications.filter(n => n.read !== true).length;
  const [filter, setFilter] = useState('all');
  const visibleNotifications = useMemo(() => notifications.filter(notif => {
    if (filter === 'market') return ['offer', 'transfer'].includes(notif.type) || notif.category === 'transfer';
    if (filter === 'system') return !(['offer', 'transfer'].includes(notif.type) || notif.category === 'transfer');
    return true;
  }), [filter, notifications]);

  const handleItemClick = (notif) => {
    onNotifClick?.(notif);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 w-[25rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
      <div className="flex justify-between items-center p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Notificaciones</h4>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && typeof onMarkAllRead === 'function' && (
            <button
              onClick={onMarkAllRead}
              className="px-2 py-1 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:underline font-medium"
              title="Marcar todas como leídas"
            >
              <Check className="w-3.5 h-3.5" /> Marcar leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={onClear} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium">Borrar todo</button>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 px-3 pt-2.5">
        {[['all', 'Todas'], ['market', 'Mercado'], ['system', 'Sistema']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`min-h-7 rounded-lg px-2.5 text-xs font-semibold transition ${
              filter === id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-3 text-xs text-slate-400 font-medium">
            <div className="w-4 h-4 rounded-full border-2 border-sky-500/30 border-t-sky-500 animate-spin" />
            Cargando notificaciones...
          </div>
        ) : visibleNotifications.length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-8">No hay notificaciones en esta categoría.</p>
        ) : (
          visibleNotifications.map((notif, idx) => (
            <NotificationItem
              key={notif.id || idx}
              notif={notif}
              onClick={onNotifClick ? handleItemClick : undefined}
              onDismiss={onDismissOne}
            />
          ))
        )}
      </div>
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />
    </div>
  );
});
