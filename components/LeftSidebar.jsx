import React, { memo, useEffect } from 'react';
import {
  Trophy, ShoppingCart, ClipboardList, Search, Settings,
  Crown, HelpCircle, MessageSquarePlus, LogOut, X, DollarSign, AlertTriangle, Users,
  Sun, Moon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatBudget } from '../utils/helpers.js';
import { useTheme } from '../hooks/useTheme.js';

export const LeftSidebar = memo(function LeftSidebar({
  activeTab,
  setActiveTab,
  isAdmin,
  isOpen,        // true = visible
  onClose,       // close callback for mobile backdrop tap
  onSuggestionsClick,
  onHelpClick,
  onLogout,
  remainingBudget,
  initialBudget,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { id: 'Marketplace', label: 'Mercado', icon: ShoppingCart },
    { id: 'My Team', label: 'Plantilla', icon: ClipboardList },
    { id: 'Financials', label: 'Finanzas', icon: DollarSign },
    { id: 'Scouting', label: 'Scouting', icon: Search },
    { id: 'Other Teams', label: 'Otros Equipos', icon: Users },
  ];

  // Close sidebar when navigating on mobile
  const handleNavClick = (id) => {
    if (id === 'Admin') {
      navigate('/admin');
    } else {
      setActiveTab(id);
    }
    if (window.innerWidth < 1024 && onClose) onClose();
  };

  const handleFooterAction = (action) => {
    action?.();
    if (window.innerWidth < 1024 && onClose) onClose();
  };

  return (
    <>
      {/* ─── Backdrop (mobile only) ─── */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        data-app-tour="sidebar"
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
        style={{ '--sidebar-w': '224px' }}
      >
        {/* Inner wrapper — fixed width so content doesn't reflow during animation */}
        <div style={{ width: 224 }} className="flex flex-col h-full bg-white dark:bg-[#080b11] text-slate-800 dark:text-white transition-colors">

          {/* ─── Branding ─── */}
          <div className="px-6 pt-6 pb-5 flex items-center justify-between">
            <div className="flex flex-col items-start">
              <img src="/logo.webp" alt="SCL Draft Logo" className="w-auto h-10 object-contain drop-shadow" />
              <span className="text-[10px] text-sky-600 dark:text-[#00b4d8] font-bold uppercase tracking-[0.2em] mt-1">
                SUPERCONTINENTAL
              </span>
            </div>
            {/* Close button visible only on mobile */}
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ─── Nav ─── */}
          <nav className="flex-1 px-3 mt-2 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const pathMap = { 'Marketplace': '/marketplace', 'Torneo': '/torneo', 'My Team': '/my-team', 'Scouting': '/scouting', 'Other Teams': '/other-teams', 'Financials': '/financials' };
              const isActive = id === 'Torneo'
                ? location.pathname.startsWith('/torneo')
                : location.pathname === (pathMap[id] || '/');
              return (
                <button
                  data-app-tour={`nav-${id.toLowerCase().replace(/\s+/g, '-')}`}
                  key={id}
                  onClick={() => handleNavClick(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold
                    transition-all duration-150 group text-left cursor-pointer
                    ${isActive
                      ? 'text-sky-600 dark:text-[#00b4d8]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }`}
                  style={isActive ? { background: isDark ? 'rgba(0,180,216,0.12)' : 'rgba(2,132,199,0.1)', borderLeft: `3px solid ${isDark ? '#00b4d8' : '#0284c7'}` } : { borderLeft: '3px solid transparent' }}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors
                    ${isActive ? (isDark ? 'text-[#00b4d8]' : 'text-sky-600') : 'text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
                  <span className="text-sm tracking-wide whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* ─── Budget Widget ─── */}
          {remainingBudget != null && initialBudget > 0 && (() => {
            const pct = Math.min(100, Math.max(0, (remainingBudget / initialBudget) * 100));
            const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#eab308' : '#ef4444';
            const textColor = pct > 50 ? 'text-emerald-600 dark:text-emerald-400' : pct > 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
            const remainM = (remainingBudget / 1000000).toFixed(1);
            const initM = (initialBudget / 1000000).toFixed(0);
            return (
              <div className="px-3 mt-4">
                <div
                  data-app-tour="budget"
                  className="rounded-xl p-3.5 bg-slate-100 dark:bg-[#0c1017] border border-slate-200 dark:border-white/[0.08]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em]">Presupuesto</span>
                    {pct <= 20 && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />}
                  </div>
                  <div className={`text-lg font-black ${textColor} leading-none mb-2 tabular-nums`}>
                    ${remainM}M
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-black/50 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      de ${initM}M iniciales
                    </span>
                    <span className={`text-[10px] font-bold ${textColor}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── Footer ─── */}
          <div className="px-3 pb-5 pt-3 mt-auto space-y-0.5 border-t border-slate-200 dark:border-white/[0.06]">
            {isAdmin && (
              <button
                onClick={() => handleNavClick('Admin')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition group cursor-pointer
                  ${location.pathname === '/admin'
                    ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/15'
                    : 'text-yellow-600 dark:text-yellow-500/80 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-500/10 dark:hover:bg-white/[0.05]'
                  }`}
                style={location.pathname === '/admin' ? { borderLeft: '3px solid #eab308' } : { borderLeft: '3px solid transparent' }}
              >
                <Crown className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Panel Admin</span>
              </button>
            )}

            {/* Switch Theme Item */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition group cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04]"
              title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              <span className="w-0.5 h-3 rounded-full bg-transparent flex-shrink-0" />
              {isDark ? (
                <Sun className="w-4 h-4 flex-shrink-0 text-amber-400 transition-colors" />
              ) : (
                <Moon className="w-4 h-4 flex-shrink-0 text-slate-700 transition-colors" />
              )}
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 whitespace-nowrap transition-colors">
                {isDark ? 'Tema Claro' : 'Tema Oscuro'}
              </span>
            </button>

            {[
              { label: 'Sugerencias', icon: MessageSquarePlus, onClick: onSuggestionsClick, color: 'text-cyan-600 dark:text-cyan-400/80 group-hover:text-cyan-700 dark:group-hover:text-cyan-300' },
              { label: 'Ayuda / Reglas', icon: HelpCircle, onClick: onHelpClick, color: 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200' },
              { label: 'Cerrar Sesión', icon: LogOut, onClick: onLogout, color: 'text-slate-500 group-hover:text-red-500', hoverBg: 'hover:bg-red-500/10' },
            ].map(({ label, icon: Icon, onClick, color, hoverBg = 'hover:bg-slate-100 dark:hover:bg-white/[0.04]' }) => (
              <button
                key={label}
                data-app-tour={label === 'Ayuda / Reglas' ? 'help' : undefined}
                onClick={() => handleFooterAction(onClick)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition group cursor-pointer ${hoverBg}`}
              >
                <span className="w-0.5 h-3 rounded-full bg-transparent flex-shrink-0" />
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${color}`} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 whitespace-nowrap transition-colors">{label}</span>
              </button>
            ))}

            {/* Version Badge */}
            <div className="px-3 pt-3 pb-1 flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-white/[0.04] mt-2">
              <span>SCL Draft</span>
              <span className="text-sky-600 dark:text-[#00b4d8] bg-sky-500/10 dark:bg-[#00b4d8]/10 px-1.5 py-0.5 rounded border border-sky-500/20 dark:border-[#00b4d8]/20 font-bold">
                v2.5.0
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
