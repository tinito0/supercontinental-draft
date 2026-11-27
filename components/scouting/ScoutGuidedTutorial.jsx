import React, { useEffect, useRef, useState } from 'react';
import { scrollBehavior } from '../../utils/scrollBehavior.js';

export const SCOUT_TUTORIAL_STEPS = [
  {
    targetSelector: '[data-scout-target="scout-picker"]',
    title: 'Elegir ojeador',
    description: 'Acá elegís quién sale a buscar. Fefe Farfan es el más preciso; los otros vuelven antes pero tienen más margen de error.',
  },
  {
    targetSelector: '[data-scout-target="position"]',
    title: 'Zona del campo',
    description: 'Podés buscar cualquier posición o enfocarte en delanteros, mediocampistas, defensores o arqueros.',
  },
  {
    targetSelector: '[data-scout-target="specific-position"]',
    title: 'Posición específica',
    description: 'Si querés hilar fino, marcá una o varias posiciones puntuales según aptitud. Si no marcás ninguna, busca en toda la línea.',
  },
  {
    targetSelector: '[data-scout-target="area"]',
    title: 'Zona de búsqueda',
    description: 'Filtrá por país o región para buscar talentos de una zona concreta.',
  },
  {
    targetSelector: '[data-scout-target="attention"]',
    title: 'Aspecto principal',
    description: 'Decidí si el ojeador prioriza la valoración general, una habilidad puntual o promesas jóvenes.',
  },
  {
    targetSelector: '[data-scout-target="budget"]',
    title: 'Presupuesto',
    description: 'Si elegís tenerlo en cuenta, el ojeador intenta respetar tu presupuesto disponible o el máximo que cargues.',
  },
  {
    targetSelector: '[data-scout-target="attributes"]',
    title: 'Atributos',
    description: 'Podés pedir hasta dos atributos, por ejemplo Velocidad 80 y Definición 75.',
  },
  {
    targetSelector: '[data-scout-target="submit"]',
    title: 'Enviar ojeador',
    description: 'Cuando esté todo listo, mandás la asignación. Se descuenta del cupo mensual y los resultados llegan cuando termina el tiempo.',
  },
];

export function ScoutGuidedTutorial({ steps, isOpen, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const activeStep = steps[stepIndex];
  const nextButtonRef = useRef(null);

  const updatePosition = () => {
    if (!activeStep) return;
    const target = document.querySelector(activeStep.targetSelector);
    if (!target) {
      setSpotlightRect(null);
      setTooltipStyle({
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      });
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

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setTooltipStyle({
        left: '12px',
        right: '12px',
        bottom: 'calc(14px + env(safe-area-inset-bottom))',
        transform: 'none',
      });
      return;
    }

    const tooltipWidth = 340;
    const belowTop = nextRect.y + nextRect.height + 14;
    const aboveTop = nextRect.y - 220;
    const top = belowTop + 210 < window.innerHeight ? belowTop : Math.max(16, aboveTop);
    const left = Math.min(window.innerWidth - tooltipWidth - 16, Math.max(16, nextRect.x + nextRect.width / 2 - tooltipWidth / 2));
    setTooltipStyle({ left: `${left}px`, top: `${top}px`, width: `${tooltipWidth}px`, transform: 'none' });
  };

  useEffect(() => {
    if (!isOpen || !activeStep) return undefined;
    const target = document.querySelector(activeStep.targetSelector);
    target?.scrollIntoView({ behavior: scrollBehavior(), block: 'center', inline: 'nearest' });
    const frame = requestAnimationFrame(() => {
      window.setTimeout(updatePosition, 240);
    });
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [activeStep, isOpen, stepIndex]);

  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) nextButtonRef.current?.focus({ preventScroll: true });
  }, [isOpen, stepIndex]);

  if (!isOpen || !activeStep) return null;

  const isLast = stepIndex === steps.length - 1;
  const path = spotlightRect
    ? `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${spotlightRect.x} ${spotlightRect.y + 12} Q ${spotlightRect.x} ${spotlightRect.y} ${spotlightRect.x + 12} ${spotlightRect.y} H ${spotlightRect.x + spotlightRect.width - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + 12} V ${spotlightRect.y + spotlightRect.height - 12} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x + spotlightRect.width - 12} ${spotlightRect.y + spotlightRect.height} H ${spotlightRect.x + 12} Q ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height - 12} Z`
    : `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z`;

  return (
    <div className="guide-layer" role="dialog" aria-modal="true" aria-label="Tutorial de scouting">
      <svg className="guide-backdrop" width="100%" height="100%" aria-hidden="true">
        <path d={path} fill="rgba(0,0,0,0.72)" fillRule="evenodd" />
      </svg>
      {spotlightRect && (
        <div
          className="guide-ring"
          style={{
            left: spotlightRect.x,
            top: spotlightRect.y,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}
      <div className="guide-popover" style={tooltipStyle}>
        <button type="button" onClick={onClose} className="guide-close">Saltar</button>
        <div className="eyebrow mb-2">
          Paso {stepIndex + 1} de {steps.length}
        </div>
        <h3 className="font-display text-lg font-bold text-ink mb-2">{activeStep.title}</h3>
        <p className="text-sm text-ink-2 leading-relaxed">{activeStep.description}</p>
        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setStepIndex(index => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            title={stepIndex === 0 ? 'Este es el primer paso' : undefined}
            className="btn btn-secondary min-h-11"
          >
            Anterior
          </button>
          <button
            type="button"
            ref={nextButtonRef}
            onClick={() => {
              if (isLast) onClose();
              else setStepIndex(index => Math.min(steps.length - 1, index + 1));
            }}
            className="btn btn-primary min-h-11"
          >
            {isLast ? 'Finalizar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
