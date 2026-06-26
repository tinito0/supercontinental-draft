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

export const tournamentShellClass = 'bg-[#020617] overflow-hidden font-sans relative';
export const tournamentBackdropClass = 'absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e293b] via-[#020617] to-black pointer-events-none';

export const TournamentSectionTitle = memo(function TournamentSectionTitle({ title, subtitle, compact = false }) {
  return (
    <div className={`flex flex-col items-center ${compact ? 'mb-8' : 'mb-8 md:mb-16'} z-20 relative w-full shrink-0`}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[100px] md:h-[150px] bg-blue-600/15 blur-[60px] md:blur-[100px] rounded-full pointer-events-none"></div>
      <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 animate-in fade-in slide-in-from-top-4 duration-700 text-center md:text-left">
        <div className="h-1 w-12 md:w-20 bg-gradient-to-r from-transparent to-blue-500 rounded-full"></div>
        <h2 className={`${compact ? 'text-3xl md:text-5xl' : 'text-4xl md:text-7xl'} font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-2xl`}>{title}</h2>
        <div className="h-1 w-12 md:w-20 bg-gradient-to-l from-transparent to-blue-500 rounded-full"></div>
      </div>
      <p className="text-blue-400 font-bold tracking-[0.5em] md:tracking-[1em] uppercase mt-4 text-[10px] md:text-xs animate-in fade-in duration-1000 pl-2 md:pl-4">{subtitle}</p>
    </div>
  );
});

export const TournamentTabButton = memo(function TournamentTabButton({ id, tabId, label, icon: Icon, activeTab, onClick }) {
  const targetId = id || tabId;
  return (
    <button
      onClick={() => onClick(targetId)}
      className={`flex items-center px-6 py-3 font-bold text-sm uppercase tracking-wider transition-all border-b-2 whitespace-nowrap
        ${activeTab === targetId ? 'border-blue-500 text-blue-400 bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}{label}
    </button>
  );
});

export const TournamentPanel = memo(function TournamentPanel({ title, icon: Icon, accent = 'blue', compact = false, children, className = '' }) {
  const accentClasses = {
    blue: 'from-blue-600/20 text-blue-400',
    yellow: 'from-yellow-600/20 text-yellow-400',
    green: 'from-green-600/20 text-green-400',
    slate: 'from-slate-600/20 text-slate-300',
  };
  const accentClass = accentClasses[accent] || accentClasses.blue;
  return (
    <section className={`bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl ${className}`}>
      {title && (
        <div className={`${compact ? `bg-gradient-to-r ${accentClass} to-transparent p-5` : 'bg-slate-800/50 p-6'} border-b border-slate-700/50 flex items-center gap-4`}>
          {Icon && <Icon className="w-6 h-6" />}
          <h3 className={`${compact ? 'text-2xl' : 'text-4xl pl-2'} font-black text-white italic tracking-wider uppercase`}>{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
});

export const TournamentActionButton = memo(function TournamentActionButton({ children, onClick, disabled, tone = 'blue', className = '' }) {
  const toneClasses = {
    blue: 'bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 border-blue-500/30',
    yellow: 'bg-yellow-600/30 text-yellow-400 hover:bg-yellow-600/50 border-yellow-500/30',
    green: 'bg-green-600 text-white hover:bg-green-500 border-green-500/30',
    slate: 'bg-slate-600/30 text-slate-300 hover:bg-slate-600/50 border-slate-500/30',
    red: 'bg-red-600/30 text-red-300 hover:bg-red-600/50 border-red-500/30',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition border disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone] || toneClasses.blue} ${className}`}
    >
      {children}
    </button>
  );
});

export function TournamentField({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] text-slate-500 block mb-1.5 font-black uppercase tracking-widest">{label}</span>
      {children}
    </label>
  );
}

export const tournamentControlClass = 'w-full bg-black/50 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40';
