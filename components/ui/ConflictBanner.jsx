import React, { memo } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

/**
 * Componente de banner para avisar sobre conflictos o cambios remotos.
 * Utiliza tokens de diseño del proyecto (--app-warning, --app-warning-muted) y soporte para lectores de pantalla.
 *
 * @param {Object} props
 * @param {string} props.message - Mensaje descriptivo del conflicto
 * @param {() => void} [props.onRefresh] - Acción para recargar los datos
 * @param {() => void} [props.onDismiss] - Acción para descartar el aviso
 * @param {string} [props.refreshLabel='Actualizar'] - Etiqueta del botón de actualización
 * @param {string} [props.dismissLabel='Descartar'] - Etiqueta / aria-label del botón de descarte
 * @param {boolean} [props.isRefreshing=false] - Indica si la recarga está en curso
 * @param {string} [props.className=''] - Clases adicionales de estilo
 * @param {boolean} [props.visible=true] - Control de visibilidad del banner
 */
export const ConflictBanner = memo(function ConflictBanner({
  message,
  onRefresh,
  onDismiss,
  refreshLabel = 'Actualizar',
  dismissLabel = 'Descartar',
  isRefreshing = false,
  className = '',
  visible = true,
}) {
  if (!visible || !message) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${className}`}
      style={{
        backgroundColor: 'var(--app-warning-muted, rgba(245, 158, 11, 0.15))',
        borderColor: 'rgba(245, 158, 11, 0.35)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-amber-500/30"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: 'var(--app-warning, #f59e0b)',
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" aria-hidden="true" />
        </div>
        <p className="text-xs sm:text-sm font-semibold text-amber-100 leading-snug break-words">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={isRefreshing ? 'Hay una operación en curso' : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 active:scale-95 border border-amber-500/40 text-amber-100 font-black text-xs uppercase tracking-wider transition duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
            aria-label={refreshLabel}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{refreshLabel}</span>
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-amber-300/80 hover:text-amber-100 hover:bg-amber-500/20 active:scale-95 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
            aria-label={dismissLabel}
            title={dismissLabel}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
});

export default ConflictBanner;
