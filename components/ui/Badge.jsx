import React from 'react';

// Badges mark a state the user must notice (docs/DESIGN_SYSTEM.md). Metadata is plain text, not a badge.
const VARIANT_MAP = {
  default: 'bg-white/[0.06] text-ink-2 border-line/15',
  primary: 'bg-accent/15 text-accent-soft border-accent/30',
  success: 'bg-success/[0.12] text-success-soft border-success/30',
  warning: 'bg-warning/[0.12] text-warning-soft border-warning/30',
  danger: 'bg-danger/[0.12] text-danger-soft border-danger/30',
  purple: 'bg-accent/15 text-accent-soft border-accent/30', // legacy name: maps to the accent
  outline: 'bg-transparent text-ink-2 border-line/25',
  surface: 'bg-raised text-ink border-line/15',
};

const SIZE_MAP = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded gap-1',
  sm: 'text-[11px] px-2 py-0.5 rounded-md gap-1.5',
  md: 'text-xs px-2.5 py-1 rounded-md gap-1.5',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  icon: Icon,
  dot = false,
  dotColor = 'bg-current',
  className = '',
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center font-semibold border whitespace-nowrap select-none ${VARIANT_MAP[variant] || VARIANT_MAP.default} ${SIZE_MAP[size] || SIZE_MAP.sm} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />}
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
