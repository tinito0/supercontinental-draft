import React, { memo, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BadgeDollarSign, Bell, Check, Info, X } from 'lucide-react';

const TYPE_CONFIG = {
  warning: { icon: AlertTriangle, wrap: 'bg-yellow-900/20 border-yellow-800 text-yellow-200', iconColor: 'text-yellow-400' },
  offer: { icon: BadgeDollarSign, wrap: 'bg-emerald-900/20 border-emerald-800 text-emerald-200', iconColor: 'text-emerald-400' },
  transfer: { icon: ArrowRightLeft, wrap: 'bg-purple-900/20 border-purple-800 text-purple-200', iconColor: 'text-purple-300' },
  info: { icon: Info, wrap: 'bg-blue-900/20 border-blue-800 text-blue-200', iconColor: 'text-blue-300' },
  default: { icon: Bell, wrap: 'bg-gray-700/50 border-gray-600 text-gray-300', iconColor: 'text-gray-400' },
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
      className={`group relative flex items-start gap-2 p-2 pr-7 rounded-lg text-sm border transition-colors ${wrap} ${
        isClickable ? 'cursor-pointer hover:brightness-125 focus:outline-none focus:ring-1 focus:ring-white/30' : ''
      }`}
    >
      {isUnread && <span className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.25)]" />}

      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />

      <div className="min-w-0 flex-1">
        <p className={isUnread ? 'font-bold' : 'font-medium opacity-80'}>{notif.text}</p>
        <span className="block text-[10px] text-gray-500 mt-1 text-right">{notif.time}</span>
      </div>

      {typeof onDismiss === 'function' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(notif); }}
          className="absolute top-1.5 right-1.5 min-w-6 min-h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
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
    <div className="absolute top-16 right-4 w-[25rem] max-w-[calc(100vw-2rem)] bg-[#10131a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-5">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-900/50">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-white text-sm">Notificaciones</h4>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[10px] font-black flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && typeof onMarkAllRead === 'function' && (
            <button
              onClick={onMarkAllRead}
              className="min-h-11 px-2 flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
              title="Marcar todas como leídas"
            >
              <Check className="w-3.5 h-3.5" /> Marcar leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={onClear} className="min-h-11 px-2 text-xs text-blue-400 hover:text-blue-300">Borrar todo</button>
          )}
        </div>
      </div>
      <div className="flex gap-2 px-3 pt-3">
        {[['all', 'Todas'], ['market', 'Mercado'], ['system', 'Sistema']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`min-h-8 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wide transition ${filter === id ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{label}</button>
        ))}
      </div>
      <div className="max-h-[28rem] overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-3 text-xs text-gray-500 font-bold">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
            Cargando notificaciones...
          </div>
        ) : visibleNotifications.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-8">No hay noticias en esta categoría.</p>
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
