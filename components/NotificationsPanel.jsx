import React, { memo, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BadgeDollarSign, Bell, Check, ChevronRight, Info, X } from 'lucide-react';
import { Tabs } from './ui/Tabs.jsx';

const NOTIFICATION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'market', label: 'Mercado' },
  { id: 'system', label: 'Sistema' },
];

const TYPE_CONFIG = {
  warning: { icon: AlertTriangle, wrap: 'bg-warning/10 border-warning/20 text-amber-200 hover:bg-warning/15', iconColor: ' text-warning-soft' },
  offer: { icon: BadgeDollarSign, wrap: 'bg-success/10 border-success/20 text-emerald-200 hover:bg-success/15', iconColor: ' text-success-soft' },
  transfer: { icon: ArrowRightLeft, wrap: 'bg-accent/10 border-accent/20 text-accent-soft hover:bg-accent/15', iconColor: ' text-accent-soft' },
  info: { icon: Info, wrap: 'bg-accent/10 border-accent/20 text-accent-soft hover:bg-accent/15', iconColor: ' text-accent-soft' },
  default: { icon: Bell, wrap: ' bg-raised/60 border-line/15 text-ink-2 hover:bg-raised', iconColor: ' text-ink-3' },
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
      className={`group relative flex items-start gap-2.5 p-3 pr-8 rounded-xl text-sm border transition-colors duration-fast ${wrap} ${
        isClickable ? 'cursor-pointer hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-accent/40' : ''
      }`}
    >
      {isUnread && <span className="absolute top-2.5 left-2 w-2 h-2 rounded-full bg-accent" />}

      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />

      <div className="min-w-0 flex-1 pl-1">
        <p className={`text-xs leading-snug ${isUnread ? 'font-bold text-ink' : 'font-medium text-ink-2'}`}>{notif.text}</p>
        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-line/[0.08]">
          <span className="text-[11px] text-ink-3 font-medium">{notif.time}</span>
          {isClickable && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-accent-soft group-hover:translate-x-0.5 transition-transform">
              Ver <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {typeof onDismiss === 'function' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(notif); }}
          className="absolute top-1 right-1 min-w-10 min-h-10 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-white/10 transition cursor-pointer"
          title="Descartar"
          aria-label="Descartar notificación"
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
    <div
      role="region"
      aria-label="Panel de notificaciones"
      className="absolute top-16 right-4 w-[25rem] max-w-[calc(100vw-2rem)] bg-surface border border-line/20 rounded-2xl shadow-xl z-50 overflow-hidden origin-top-right animate-in fade-in slide-in-from-top-3"
    >
      <div className="flex justify-between items-center p-3.5 border-b border-line/20 bg-surface/60">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-ink text-sm">Notificaciones</h4>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-ink text-[11px] font-bold flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && typeof onMarkAllRead === 'function' && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="px-2 min-h-11 flex items-center gap-1 text-xs text-accent-soft hover:underline font-medium cursor-pointer"
              title="Marcar todas como leídas"
              aria-label="Marcar todas las notificaciones como leídas"
            >
              <Check className="w-3.5 h-3.5" /> Marcar leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="px-2 min-h-11 text-xs text-ink-3 hover:text-ink-2 font-medium cursor-pointer"
              aria-label="Borrar todas las notificaciones"
            >
              Borrar todo
            </button>
          )}
        </div>
      </div>
      <div className="px-3 pt-2.5">
        <Tabs tabs={NOTIFICATION_FILTERS} value={filter} onChange={setFilter} label="Filtrar notificaciones" />
      </div>
      <div
        role="feed"
        aria-label="Lista de notificaciones"
        aria-busy={isLoading}
        className="max-h-[28rem] overflow-y-auto p-3 space-y-2"
      >
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-3 text-xs text-ink-3 font-medium">
            <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent-soft animate-spin" />
            Cargando notificaciones...
          </div>
        ) : visibleNotifications.length === 0 ? (
          <p className="text-ink-3 text-xs text-center py-8">No hay notificaciones en esta categoría.</p>
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
