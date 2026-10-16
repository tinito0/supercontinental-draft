import React, { memo } from 'react';
import { CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';

// White text needs the -700 shades for green and amber (≈ 5:1); -600 was about 3.3:1.
const TONES = {
  loading: 'bg-accent-deep',
  success: 'bg-green-700',
  warning: 'bg-amber-700',
  error: 'bg-red-600',
};

/** Global feedback message. Positioned and animated by ToastStack. */
export const StatusAlert = memo(function StatusAlert({ type, message, onClose }) {
  const isLoading = type === 'loading';
  const isError = type === 'error';
  const Icon = isLoading ? Loader2 : type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`p-4 rounded-lg text-white font-semibold shadow-2xl flex items-center ${TONES[type] || TONES.error}`}
    >
      <Icon className={`w-5 h-5 mr-2 shrink-0 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span className="flex-1 min-w-0">{message}</span>
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
