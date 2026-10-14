import React, { memo } from 'react';

/**
 * OnlineIndicator: Píldora de presencia que muestra el conteo de managers en línea.
 * Punto verde fijo (sin animación) y texto; anuncia cambios con aria-live='polite'.
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
      className={`inline-flex items-center gap-2 text-xs font-medium text-ink-2 select-none shrink-0 ${className}`}
      title={`${safeCount} ${safeCount === 1 ? 'manager en línea' : 'managers en línea'}`}
      {...props}
    >
      <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgb(var(--c-success)/0.18)] shrink-0" aria-hidden="true" />
      <span className="num">{`${safeCount} online`}</span>
    </div>
  );
});

export default OnlineIndicator;
