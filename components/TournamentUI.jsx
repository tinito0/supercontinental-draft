import React, { memo } from 'react';

export const TOURNAMENT_THEME = {
  page: '#020617',
  panel: '#0f172a',
  panelRaised: '#1e293b',
  panelHeader: 'rgba(30,41,59,0.5)',
  text: '#f8fafc',
  muted: '#94a3b8',
  blue: '#3b82f6',
  blueGlow: 'rgba(37,99,235,0.15)',
  sky: '#38bdf8',
  slateBorder: 'rgba(51,65,85,0.5)',
  slateConnector: 'rgba(71,85,105,0.5)',
};

export const tournamentShellClass = 'bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white overflow-hidden font-sans relative transition-colors';
export const tournamentBackdropClass = 'absolute inset-0 bg-slate-100/50 dark:bg-[#020617] pointer-events-none';

export const TournamentSectionTitle = memo(function TournamentSectionTitle({ title, subtitle, compact = false }) {
  return (
    <div className={`flex flex-col items-center ${compact ? 'mb-3 sm:mb-5' : 'mb-5 sm:mb-7'} z-20 relative w-full shrink-0 text-center px-4`}>
      <h2 className={`${compact ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl'} font-bold text-slate-900 dark:text-white tracking-tight`}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-sky-600 dark:text-sky-400 font-medium text-xs sm:text-sm mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
});

export const TournamentTabButton = memo(function TournamentTabButton({ id, tabId, label, icon: Icon, activeTab, onClick }) {
  const targetId = id || tabId;
  const isActive = activeTab === targetId;
  return (
    <button
      type="button"
      onClick={() => onClick(targetId)}
      className={`flex items-center px-3 sm:px-4 py-2 font-semibold text-xs sm:text-sm transition-all rounded-lg whitespace-nowrap cursor-pointer
        ${isActive
          ? 'bg-sky-600 dark:bg-sky-600 text-white shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
        }`}
    >
      {Icon && <Icon className="w-4 h-4 mr-1.5" />}{label}
    </button>
  );
});

export const TournamentPanel = memo(function TournamentPanel({ title, icon: Icon, accent = 'blue', compact = false, children, className = '' }) {
  return (
    <section className={`bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl ${className}`}>
      {title && (
        <div className={`${compact ? 'bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5' : 'bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5'} border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5`}>
          {Icon && <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
          <h3 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-slate-900 dark:text-white tracking-normal`}>{title}</h3>
        </div>
      )}
      <div className="p-3 sm:p-5">{children}</div>
    </section>
  );
});

export const TournamentActionButton = memo(function TournamentActionButton({ children, onClick, disabled, tone = 'blue', className = '' }) {
  const toneClasses = {
    blue: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 border-sky-500/30',
    yellow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-amber-500/30',
    green: 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500/30',
    slate: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700',
    red: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 border-rose-500/30',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-4 py-2 rounded-xl font-bold text-xs transition border disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone] || toneClasses.blue} ${className}`}
    >
      {children}
    </button>
  );
});

export function TournamentField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1.5 font-semibold">{label}</span>
      {children}
    </label>
  );
}

export const tournamentControlClass = 'w-full bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40';

