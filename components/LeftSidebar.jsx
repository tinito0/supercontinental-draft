import React, { memo } from 'react';
import {
  LayoutDashboard, Trophy, ShoppingCart, ClipboardList, Search, Users, Shield,
  Crown, HelpCircle, MessageSquarePlus, LogOut, X, Keyboard, Database, Globe,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

// Navigation grouped by what the manager is doing. Paths match app.jsx pathToTab.
const NAV_GROUPS = [
  {
    label: 'Competición',
    items: [
      { id: 'Overview', label: 'Inicio', icon: LayoutDashboard, paths: ['/', '/overview'] },
      { id: 'Tournament', label: 'Torneo', icon: Trophy, paths: ['/tournament'] },
    ],
  },
  {
    label: 'Mi club',
    items: [
      { id: 'My Team', label: 'Plantel y finanzas', icon: ClipboardList, paths: ['/my-team', '/financials'] },
      { id: 'Tactics', label: 'Pizarra táctica', icon: Shield, paths: ['/tactics'] },
      { id: 'Scouting', label: 'Scouting', icon: Search, paths: ['/scouting'] },
    ],
  },
  {
    label: 'Mercado',
    items: [
      { id: 'Marketplace', label: 'Mercado de pases', icon: ShoppingCart, paths: ['/marketplace'] },
      { id: 'Other Teams', label: 'Rivales', icon: Users, paths: ['/other-teams'] },
    ],
  },
];

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      data-app-tour={`nav-${item.id.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative w-full flex items-center gap-3 min-h-11 lg:min-h-10 pl-4 pr-3 rounded-lg text-sm text-left transition-colors
        ${active ? 'bg-accent/[0.14] text-ink font-semibold' : 'text-ink-2 hover:text-ink hover:bg-white/[0.04] font-medium'}`}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent" aria-hidden="true" />}
      <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent-soft' : 'text-ink-3'}`} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export const LeftSidebar = memo(function LeftSidebar({
  setActiveTab,
  isAdmin,
  isLeagueEditor, // editor de la web pública: entra a Administración solo para esos textos
  hasPesAccess, // rol en el editor PES (Super Admin / Admin del Draft / Kit Manager)
  isOpen,
  onClose,
  onSuggestionsClick,
  onHelpClick,
  onShortcutsClick,
  onLogout,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1024;

  const go = (id) => {
    if (id === 'Admin') navigate('/admin');
    else if (id === 'PES') navigate('/pes');
    else setActiveTab(id);
    if (isMobile()) onClose?.();
  };
  const run = (action) => {
    action?.();
    if (isMobile()) onClose?.();
  };

  const groups = [...NAV_GROUPS];
  const tools = [
    hasPesAccess && { id: 'PES', label: 'Editor PES', icon: Database, paths: ['/pes'] },
    isAdmin && { id: 'Admin', label: 'Administración', icon: Crown, paths: ['/admin'] },
    !isAdmin && isLeagueEditor && { id: 'Admin', label: 'Web pública', icon: Globe, paths: ['/admin'] },
  ].filter(Boolean);
  if (tools.length) groups.push({ label: 'Gestión', items: tools });

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside
        data-app-tour="sidebar"
        aria-label="Navegación"
        className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}
      >
        {/* Fixed-width inner column so nothing reflows while the sidebar animates. */}
        <div className="flex flex-col h-full w-[260px] lg:w-[232px] bg-surface border-r border-line/10">
          <div className="flex items-center gap-3 px-4 pt-5 pb-4">
            <img src="/logo.webp" alt="" width={40} height={40} className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0 leading-none">
              <p className="font-display text-[19px] font-bold tracking-wide text-ink uppercase">Supercontinental</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3 mt-1">Draft · Liga SCL</p>
            </div>
            <button type="button" onClick={onClose} className="sidebar-close-btn ml-auto" aria-label="Cerrar menú">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5" aria-label="Secciones">
            {groups.map(group => (
              <div key={group.label}>
                <p className="px-4 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <NavItem key={item.id} item={item} active={item.paths.includes(pathname)} onClick={() => go(item.id)} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="px-3 pt-3 pb-4 border-t border-line/10 space-y-0.5">
            {[
              { label: 'Ayuda y reglas', icon: HelpCircle, onClick: onHelpClick, tour: 'help' },
              { label: 'Sugerencias', icon: MessageSquarePlus, onClick: onSuggestionsClick },
              { label: 'Atajos de teclado', icon: Keyboard, onClick: onShortcutsClick, kbd: '?', desktopOnly: true },
            ].map(({ label, icon: Icon, onClick, tour, kbd, desktopOnly }) => (
              <button
                key={label}
                type="button"
                data-app-tour={tour}
                onClick={() => run(onClick)}
                className={`w-full items-center gap-3 min-h-11 lg:min-h-9 px-4 rounded-lg text-[13px] text-ink-2 hover:text-ink hover:bg-white/[0.04] transition-colors ${desktopOnly ? 'hidden lg:flex' : 'flex'}`}
              >
                <Icon className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="flex-1 text-left">{label}</span>
                {kbd && <kbd className="kbd">{kbd}</kbd>}
              </button>
            ))}
            <button
              type="button"
              onClick={() => run(onLogout)}
              className="w-full flex items-center gap-3 min-h-11 lg:min-h-9 px-4 rounded-lg text-[13px] text-ink-2 hover:text-danger-soft hover:bg-danger/10 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="flex-1 text-left">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});

export default LeftSidebar;
