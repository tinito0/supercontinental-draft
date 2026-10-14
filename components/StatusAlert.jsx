import React, { memo } from 'react';
import { CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';

export const StatusAlert = memo(function StatusAlert({ type, message, onClose }) {
  const isLoading = type === 'loading';
  const isError = type === 'error';
  const bgColor = isLoading ? 'bg-sky-700' : type === 'success' ? 'bg-green-600' : type === 'warning' ? 'bg-amber-600' : 'bg-red-600';
  const Icon = isLoading ? Loader2 : type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`fixed bottom-4 right-4 max-w-[calc(100vw-2rem)] p-4 rounded-lg text-white font-semibold shadow-2xl transition-opacity duration-300 flex items-center z-[120] ${bgColor}`}
    >
      <Icon className={`w-5 h-5 mr-2 shrink-0 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar alerta"
        className="ml-4 min-w-11 min-h-11 -my-2 flex items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});
