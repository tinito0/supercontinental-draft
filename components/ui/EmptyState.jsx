import React from 'react';

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
    <div
      className={`flex flex-col items-center justify-center min-h-[220px] rounded-2xl bg-[#0c1017]/60 border border-dashed border-white/[0.08] text-center p-8 transition-colors ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-[#111722] border border-white/[0.08] flex items-center justify-center mb-3 shadow-inner">
          <Icon className="w-6 h-6 text-cyan-400/70" aria-hidden="true" />
        </div>
      )}
      {title && (
        <p className="text-sm font-bold text-white tracking-wide">{title}</p>
      )}
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-cyan-500/10 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}

export default EmptyState;
