import React from 'react';

/** Empty result / nothing yet: says what happened and what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  children,
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center min-h-[200px] rounded-2xl border border-dashed border-line/15 px-6 py-10 ${className}`}>
      {Icon && <Icon className="w-8 h-8 text-ink-3 mb-3" aria-hidden="true" />}
      {title && <p className="font-display text-lg font-bold text-ink">{title}</p>}
      {description && <p className="text-sm text-ink-2 mt-1 max-w-[46ch]">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn btn-primary mt-5">
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}

export default EmptyState;
