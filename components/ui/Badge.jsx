import React from 'react';

const VARIANT_MAP = {
  default: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
  primary: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  outline: 'bg-transparent text-slate-300 border-white/20',
  surface: 'bg-[#0c1017] text-slate-200 border-white/[0.08] shadow-sm',
};

const SIZE_MAP = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded-md gap-1',
  sm: 'text-xs px-2.5 py-0.5 rounded-lg gap-1.5',
  md: 'text-sm px-3 py-1 rounded-xl gap-2',
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
  const variantClass = VARIANT_MAP[variant] || VARIANT_MAP.default;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide border font-mono select-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
