import React from 'react';

const SIZE_MAP = {
  xs: 'w-3.5 h-3.5 border-2',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

const COLOR_MAP = {
  cyan: 'border-accent-soft border-t-transparent', // legacy name: the accent
  accent: 'border-accent-soft border-t-transparent',
  blue: 'border-accent-soft border-t-transparent',
  emerald: 'border-success-soft border-t-transparent',
  amber: 'border-warning-soft border-t-transparent',
  white: 'border-white border-t-transparent',
  current: 'border-current border-t-transparent',
};

export function Spinner({
  size = 'md',
  color = 'cyan',
  label = null,
  center = false,
  className = '',
  ariaLabel = 'Cargando...',
  ...props
}) {
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const colorClass = COLOR_MAP[color] || COLOR_MAP.cyan;

  const spinner = (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-2.5 ${center ? 'justify-center p-6 w-full' : ''} ${className}`}
      {...props}
    >
      <div
        className={`rounded-full animate-spin shrink-0 ${sizeClass} ${colorClass}`}
        aria-hidden="true"
      />
      {label ? (
        <span className="text-xs font-medium text-ink-2">{label}</span>
      ) : (
        <span className="sr-only">{ariaLabel}</span>
      )}
    </div>
  );

  return spinner;
}

export default Spinner;
