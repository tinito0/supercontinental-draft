import React, { memo } from 'react';

export const NotificationsPanel = memo(function NotificationsPanel({ isOpen, notifications, isLoading = false, onClose, onClear }) {
  if (!isOpen) return null;
  return (
    <div className="absolute top-16 right-4 w-80 max-w-[calc(100vw-2rem)] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-5">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-900/50">
        <h4 className="font-bold text-white text-sm">Notificaciones</h4>
        {notifications.length > 0 && (
          <button onClick={onClear} className="min-h-11 px-2 text-xs text-blue-400 hover:text-blue-300">Borrar todo</button>
        )}
      </div>
      <div className="max-h-64 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-3 text-xs text-gray-500 font-bold">
            <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
            Cargando notificaciones...
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-4">No tenes nuevas notificaciones.</p>
        ) : (
          notifications.map((notif, idx) => (
            <div key={notif.id || idx} className={`p-2 rounded-lg text-sm border ${notif.type === 'warning' ? 'bg-yellow-900/20 border-yellow-800 text-yellow-200' : 'bg-gray-700/50 border-gray-600 text-gray-300'}`}>
              {notif.text}
              <span className="block text-[10px] text-gray-500 mt-1 text-right">{notif.time}</span>
            </div>
          ))
        )}
      </div>
      <div className="fixed inset-0 z-[-1]" onClick={onClose} />
    </div>
  );
});
