import React, { memo, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react';
import { formatBudget } from '../utils/helpers.js';

const APP_TUTORIAL_STEPS = [
  {
    targetSelector: '[data-app-tour="menu"]',
    title: 'Menu principal',
    description: 'Desde aca abris la navegacion. En mobile lo vas a usar para moverte entre Mercado, Mi Equipo, Scouting, Otros Equipos, Finanzas y Torneo.',
  },
  {
    targetSelector: '[data-app-tour="team"]',
    title: 'Tu club',
    description: 'Aca ves el escudo y nombre de tu equipo. Es tu punto de referencia mientras administras el draft.',
  },
  {
    targetSelector: '[data-app-tour="search"]',
    title: 'Buscar jugadores',
    description: 'Usa esta barra para encontrar jugadores por nombre y combinarla con filtros avanzados.',
  },
  {
    targetSelector: '[data-app-tour="filters"]',
    title: 'Filtros avanzados',
    description: 'Abri filtros para ajustar posicion, edad, precio, media, nacionalidad, estilo y habilidades.',
  },
  {
    targetSelector: '[data-app-tour="sort"]',
    title: 'Orden y resultados',
    description: 'Ordena por media, precio, edad o nombre. Tambien ves cuantos jugadores coinciden con tu busqueda.',
  },
  {
    targetSelector: '[data-app-tour="view"]',
    title: 'Vista del mercado',
    description: 'Cambia entre lista y cuadricula. En cuadricula podes ajustar cuantas columnas ves en pantallas grandes.',
  },
  {
    targetSelector: '[data-app-tour="players"]',
    title: 'Cartas de jugadores',
    description: 'Toca una carta para abrir el perfil, revisar stats y fichar. Si esta bloqueado por otro manager, podes negociar.',
  },
  {
    targetSelector: '[data-app-tour="chat"]',
    title: 'Chat de managers',
    description: 'Usalo para hablar con otros equipos, mencionar managers y coordinar posibles traspasos.',
  },
  {
    targetSelector: '[data-app-tour="transfers"]',
    title: 'Mercado en vivo',
    description: 'Aca se muestran fichajes y movimientos recientes. Se precarga al tocar o pasar por encima para abrir rapido.',
  },
  {
    targetSelector: '[data-app-tour="notifications"]',
    title: 'Notificaciones',
    description: 'El icono de campana avisa resultados de scouting, mensajes importantes y eventos del mercado.',
  },
  {
    targetSelector: '[data-app-tour="help"]',
    title: 'Ayuda y reglas',
    description: 'Volves a abrir esta guia desde Ayuda / Reglas cuando necesites repasar el flujo completo.',
  },
];

function getTooltipStyle(rect) {
  if (!rect) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  if (window.innerWidth < 768) {
    return {
      left: '12px',
      right: '12px',
      bottom: 'calc(14px + env(safe-area-inset-bottom))',
      transform: 'none',
    };
  }

  const tooltipWidth = 360;
  const targetCenter = rect.x + rect.width / 2;
  const belowTop = rect.y + rect.height + 14;
  const aboveTop = rect.y - 230;
  const top = belowTop + 220 < window.innerHeight ? belowTop : Math.max(16, aboveTop);
  const left = Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, targetCenter - tooltipWidth / 2));

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${tooltipWidth}px`,
    transform: 'none',
  };
}

export const TutorialModal = memo(function TutorialModal({ isVisible, onClose, budget }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const steps = useMemo(() => APP_TUTORIAL_STEPS, []);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const updatePosition = () => {
    if (!current) return;
    const target = document.querySelector(current.targetSelector);

    if (!target) {
      setSpotlightRect(null);
      setTooltipStyle(getTooltipStyle(null));
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 10;
    const nextRect = {
      x: Math.max(8, rect.left - padding),
      y: Math.max(8, rect.top - padding),
      width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
    };

    setSpotlightRect(nextRect);
    setTooltipStyle(getTooltipStyle(nextRect));
  };

  useEffect(() => {
    if (isVisible) setStep(0);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !current) return undefined;
    const target = document.querySelector(current.targetSelector);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const frame = requestAnimationFrame(() => {
      window.setTimeout(updatePosition, 240);
    });

    const handleReposition = () => updatePosition();
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleEsc);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [current, isVisible, onClose, step]);

  if (!isVisible || !current) return null;

  const path = spotlightRect
    ? `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${spotlightRect.x} ${spotlightRect.y + 12} Q ${spotlightRect.x} ${spotlightRect.y} ${spotlightRect.x + 12} ${spotlightRect.y} H ${spotlightRect.x + spotlightRect.width - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + 12} V ${spotlightRect.y + spotlightRect.height - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x + spotlightRect.width - 12} ${spotlightRect.y + spotlightRect.height} H ${spotlightRect.x + 12} Q ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height - 12} Z`
    : `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z`;

  return (
    <div className="app-guide-layer" role="dialog" aria-modal="true" aria-label="Guia de la aplicacion">
      <svg className="app-guide-backdrop" width="100%" height="100%" aria-hidden="true">
        <path d={path} fill="rgba(0,0,0,0.74)" fillRule="evenodd" />
      </svg>

      {spotlightRect && (
        <div
          className="app-guide-ring"
          style={{
            left: spotlightRect.x,
            top: spotlightRect.y,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      <div className="app-guide-popover" style={tooltipStyle}>
        <button type="button" onClick={onClose} className="app-guide-close" aria-label="Saltar tutorial">
          <X className="w-4 h-4" />
          <span>Saltar</span>
        </button>

        <div className="flex items-center gap-3 mb-4 pr-20">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-[10px] text-cyan-300 font-black uppercase tracking-widest">Guia del manager</p>
            <p className="text-[11px] text-gray-500 font-bold">{step + 1} / {steps.length}</p>
          </div>
        </div>

        <h3 className="text-lg font-black text-white mb-2">{current.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{current.description}</p>

        {step === 1 && budget && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Tu presupuesto</span>
            <span className="text-xl font-black text-emerald-400">{formatBudget(budget)}</span>
          </div>
        )}

        {!spotlightRect && (
          <p className="mt-3 text-xs text-yellow-200/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            Este elemento no esta visible en esta pantalla. Segui avanzando o abrilo desde el menu cuando quieras probarlo.
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-5 mb-4">
          {steps.map((item, index) => (
            <button
              key={item.targetSelector}
              type="button"
              onClick={() => setStep(index)}
              className={`h-2 rounded-full transition-all ${index === step ? 'w-7 bg-cyan-400' : 'w-2 bg-white/15 hover:bg-white/30'}`}
              aria-label={`Ir al paso ${index + 1}`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep(index => Math.max(0, index - 1))}
            disabled={step === 0}
            className="flex-1 min-h-11 rounded-xl bg-white/[0.06] disabled:opacity-40 text-sm font-black text-white flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) onClose();
              else setStep(index => Math.min(steps.length - 1, index + 1));
            }}
            className="flex-1 min-h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm font-black text-white flex items-center justify-center gap-2"
          >
            {isLast ? <><Check className="w-4 h-4" /> Finalizar</> : <>Siguiente <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
});
