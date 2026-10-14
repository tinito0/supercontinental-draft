import React from 'react';
import { Keyboard, Info } from 'lucide-react';
import { BaseModal } from './BaseModal.jsx';

const SHORTCUTS = [
  {
    badgeType: 'single',
    keys: ['M'],
    description: 'Ir a Mercado de pases',
    category: 'Navegación',
  },
  {
    badgeType: 'single',
    keys: ['O'],
    description: 'Ir a Inicio (Overview)',
    category: 'Navegación',
  },
  {
    badgeType: 'single',
    keys: ['T'],
    description: 'Ir a Mi Club (Formación)',
    category: 'Navegación',
  },
  {
    badgeType: 'single',
    keys: ['F'],
    description: 'Abrir filtros de jugadores',
    category: 'Acciones',
  },
  {
    badgeType: 'single',
    keys: ['C'],
    description: 'Alternar Carrito / Mi Club',
    category: 'Acciones',
  },
  {
    badgeType: 'combo',
    keys: ['Ctrl', 'K'],
    description: 'Paleta de comandos rápida',
    category: 'Acciones',
  },
  {
    badgeType: 'alternative',
    primary: ['?'],
    secondary: ['Shift', '/'],
    description: 'Abrir / cerrar esta ayuda',
    category: 'Ayuda',
  },
  {
    badgeType: 'single',
    keys: ['Esc'],
    description: 'Cerrar ventana o modal activo',
    category: 'General',
  },
];

export function KeyboardShortcutsHelp({ isOpen = false, onClose }) {
  if (!isOpen) return null;

  const renderBadge = (keyText) => (
    <kbd
      key={keyText}
      className="bg-white/10 text-white font-mono text-xs px-2 py-1 rounded-lg border border-white/20 shadow-sm min-w-[24px] text-center inline-block"
    >
      {keyText}
    </kbd>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Atajos de teclado"
      subtitle="Navegación y acciones rápidas del sistema"
      icon={Keyboard}
      size="sm"
      className="bg-[#111722] border border-white/10 rounded-2xl max-w-md mx-auto"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] text-slate-400">
            Presiona <kbd className="bg-white/10 text-white font-mono text-[10px] px-1.5 py-0.5 rounded border border-white/20">Esc</kbd> o haz clic afuera
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 transition active:scale-95 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {SHORTCUTS.map((item) => (
            <div
              key={item.description}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-xs sm:text-sm text-slate-300 font-medium">
                {item.description}
              </span>

              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                {item.badgeType === 'single' && item.keys.map(renderBadge)}

                {item.badgeType === 'combo' && (
                  <div className="flex items-center gap-1">
                    {renderBadge(item.keys[0])}
                    <span className="text-slate-400 text-xs font-semibold">+</span>
                    {renderBadge(item.keys[1])}
                  </div>
                )}

                {item.badgeType === 'alternative' && (
                  <div className="flex items-center gap-1">
                    {renderBadge(item.primary[0])}
                    <span className="text-slate-500 text-xs px-0.5">o</span>
                    {renderBadge(item.secondary[0])}
                    <span className="text-slate-400 text-xs font-semibold">+</span>
                    {renderBadge(item.secondary[1])}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs">
          <Info className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
          <p className="leading-relaxed">
            Los atajos están deshabilitados automáticamente mientras escribes en campos de búsqueda o texto.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}

export default KeyboardShortcutsHelp;
