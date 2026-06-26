import React, { memo, useEffect } from 'react';
import {
  Trophy, ShoppingCart, ClipboardList, Search, Settings,
  Crown, HelpCircle, MessageSquarePlus, LogOut, X, DollarSign, AlertTriangle, Users
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatBudget } from '../utils/helpers.js';

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

  const navItems = [
    { id: 'Marketplace', label: 'Mercado', icon: ShoppingCart },
    { id: 'My Team', label: 'Mi Equipo', icon: ClipboardList },
    { id: 'Scouting', label: 'Scouting', icon: Search },
    { id: 'Other Teams', label: 'Otros Equipos', icon: Users },
    { id: 'Financials', label: 'Finanzas', icon: DollarSign },
  ];

  // Close sidebar when navigating on mobile
  const handleNavClick = (id) => {
    if (id === 'Torneo') {
      navigate('/torneo');
    } else {
      if (location.pathname !== '/') {
        navigate('/');
      }
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
      {/* ─── Mobile backdrop ─── */}
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
        <div style={{ width: 224 }} className="flex flex-col h-full">

          {/* ─── Branding ─── */}
          <div className="px-6 pt-6 pb-5 flex items-center justify-between">
            <div className="flex flex-col items-start">
              <img src="/logo.webp" alt="SCL Draft Logo" className="w-auto h-10 object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]" />
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1">
                MANAGER
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
          <nav className="flex-1 px-3 mt-4 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
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
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg font-semibold
                    transition-all duration-150 group text-left
                    ${isActive
                      ? 'text-[#00C8FF]'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  style={isActive ? { background: 'rgba(0,200,255,0.12)', borderLeft: '3px solid #00C8FF' } : { borderLeft: '3px solid transparent' }}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors
                    ${isActive ? 'text-[#00C8FF]' : 'text-white/40 group-hover:text-white'}`} />
                  <span className="text-sm tracking-wide whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* ─── Budget Widget ─── */}
          {remainingBudget != null && initialBudget > 0 && (() => {
            const pct = Math.min(100, Math.max(0, (remainingBudget / initialBudget) * 100));
            const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#eab308' : '#ef4444';
            const textColor = pct > 50 ? 'text-emerald-400' : pct > 20 ? 'text-yellow-400' : 'text-red-400';
            const borderColor = pct > 50 ? 'rgba(16,185,129,0.15)' : pct > 20 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
            const remainM = (remainingBudget / 1000000).toFixed(1);
            const initM = (initialBudget / 1000000).toFixed(0);
            return (
              <div className="px-3 mt-4">
                <div
                  data-app-tour="budget"
                  className="rounded-xl p-3"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${borderColor}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em]">Presupuesto</span>
                    {pct <= 20 && <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />}
                  </div>
                  <div className={`text-lg font-black ${textColor} leading-none mb-1`}>
                    ${remainM}M
                  </div>
                  <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-600 font-bold">
                      de ${initM}M iniciales
                    </span>
                    <span className={`text-[10px] font-black ${textColor}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── Footer ─── */}
          <div className="px-3 pb-5 pt-3 mt-auto space-y-0.5">
            <button
              onClick={() => handleNavClick('Torneo')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition group
                ${location.pathname.startsWith('/torneo')
                  ? 'text-[#00C8FF]'
                  : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
                }`}
              style={location.pathname.startsWith('/torneo') ? { background: 'rgba(0,200,255,0.12)', borderLeft: '3px solid #00C8FF' } : { borderLeft: '3px solid transparent' }}
            >
              <Trophy className={`w-4 h-4 flex-shrink-0 transition-colors
                ${location.pathname.startsWith('/torneo') ? 'text-[#00C8FF]' : 'text-white/40 group-hover:text-white'}`} />
              <span className="text-sm font-semibold tracking-wide whitespace-nowrap">Torneo</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNavClick('Admin')}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition group
                  ${location.pathname === '/admin'
                    ? 'text-yellow-400'
                    : 'text-yellow-700 hover:text-yellow-400 hover:bg-white/[0.06]'
                  }`}
                style={location.pathname === '/admin' ? { background: 'rgba(234,179,8,0.12)', borderLeft: '3px solid #eab308' } : { borderLeft: '3px solid transparent' }}
              >
                <Crown className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Admin</span>
              </button>
            )}

            {[
              { label: 'Sugerencias', icon: MessageSquarePlus, onClick: onSuggestionsClick, color: 'text-blue-500/60 group-hover:text-blue-400' },
              { label: 'Ayuda / Reglas', icon: HelpCircle, onClick: onHelpClick, color: 'text-gray-600 group-hover:text-gray-300' },
              { label: 'Cerrar Sesión', icon: LogOut, onClick: onLogout, color: 'text-gray-700 group-hover:text-red-400', hoverBg: 'hover:bg-red-500/10' },
            ].map(({ label, icon: Icon, onClick, color, hoverBg = 'hover:bg-white/[0.04]' }) => (
              <button
                key={label}
                data-app-tour={label === 'Ayuda / Reglas' ? 'help' : undefined}
                onClick={() => handleFooterAction(onClick)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition group ${hoverBg}`}
              >
                <span className="w-0.5 h-4 rounded-full bg-transparent flex-shrink-0" />
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${color}`} />
                <span className="text-xs font-medium text-gray-600 group-hover:text-gray-300 whitespace-nowrap transition-colors">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
});
