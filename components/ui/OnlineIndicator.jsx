import React, { memo } from 'react';

/**
 * OnlineIndicator: Píldora de presencia que muestra el conteo de managers en línea.
 * Incluye un punto verde con sutil animación de pulso y accesibilidad (aria-live='polite').
 */
export const OnlineIndicator = memo(function OnlineIndicator({
  count = 1,
  onlineCount,
  className = '',
  ...props
}) {
  const displayCount = onlineCount !== undefined ? onlineCount : count;
  const safeCount = Math.max(1, Number(displayCount) || 1);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold px-2.5 py-1 rounded-full select-none shrink-0 ${className}`}
      title={`${safeCount} ${safeCount === 1 ? 'manager en línea' : 'managers en línea'}`}
      {...props}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 animate-pulse" />
      </span>
      <span className="tabular-nums">{`${safeCount} online`}</span>
    </div>
  );
});

export default OnlineIndicator;
