import React, { memo, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatBudget } from '../utils/helpers.js';
import { Tabs } from './ui/Tabs.jsx';

const tour = (name) => `[data-app-tour="${name}"]`;

// `targets` is tried in order and the first one on screen wins: a sidebar item falls back to the section itself when
// the sidebar is closed (always on mobile). `path` opens that draft section before the step looks for its target.
const GUIDE_CHAPTERS = [
  {
    id: 'basics',
    label: 'Lo básico',
    steps: [
      {
        id: 'menu',
        targets: [tour('menu')],
        title: 'Menú',
        description: 'Abre y cierra el menú con todas las secciones del draft. En el celular es la única forma de cambiar de sección.',
      },
      {
        id: 'team',
        targets: [tour('team')],
        title: 'Tu club',
        description: 'El escudo y el nombre de tu equipo, siempre a la vista mientras recorrés el draft.',
      },
      {
        id: 'budget',
        targets: [tour('budget'), tour('team')],
        title: 'Presupuesto',
        description: 'Lo que te queda para fichar. La barra muestra cuánto del presupuesto inicial sigue libre, y el número se actualiza apenas fichás, liberás o vendés un jugador.',
        showsBudget: true,
      },
      {
        id: 'notifications',
        targets: [tour('notifications')],
        title: 'Notificaciones',
        description: 'Te avisa cuando aceptan, rechazan o contraofertan una oferta tuya, cuando vuelve un ojeador y cuando hay resultados del torneo. El punto rojo marca avisos sin leer.',
      },
      {
        id: 'chat',
        targets: [tour('chat')],
        title: 'Chat de managers',
        description: 'Hablá con los otros managers, mencioná a alguien con @ y arreglá un traspaso antes de mandar la oferta.',
      },
      {
        id: 'transfers',
        targets: [tour('transfers')],
        title: 'Traspasos',
        description: 'Los fichajes, ventas y traspasos de toda la liga, a medida que pasan.',
      },
    ],
  },
  {
    id: 'market',
    label: 'Mercado',
    steps: [
      {
        id: 'search',
        path: '/marketplace',
        targets: [tour('search'), tour('marketplace')],
        title: 'Buscar jugadores',
        description: 'Escribí un nombre y el mercado se filtra al instante. La búsqueda se suma a los filtros y al orden que elijas.',
      },
      {
        id: 'filters',
        path: '/marketplace',
        targets: [tour('filters'), tour('search')],
        title: 'Filtros',
        description: 'Posición, edad, precio, media, nacionalidad, estilo de juego y habilidades. Podés combinar varios a la vez.',
      },
      {
        id: 'sort',
        path: '/marketplace',
        targets: [tour('sort'), tour('search')],
        title: 'Orden',
        description: 'Ordená por media, precio, edad o nombre. Al lado ves cuántos jugadores coinciden con la búsqueda.',
      },
      {
        id: 'view',
        path: '/marketplace',
        targets: [tour('view'), tour('search')],
        title: 'Lista o cuadrícula',
        description: 'La lista entra más jugadores por pantalla; la cuadrícula muestra las cartas. En pantallas grandes elegís cuántas columnas ver.',
      },
      {
        id: 'players',
        path: '/marketplace',
        targets: [tour('players'), tour('marketplace')],
        title: 'Fichar',
        description: 'Tocá un jugador para ver su ficha y ficharlo. Los que tienen candado ya son de otro club: desde la ficha le podés hacer una oferta al dueño.',
      },
    ],
  },
  {
    id: 'club',
    label: 'Tu equipo',
    steps: [
      {
        id: 'my-team',
        path: '/my-team',
        targets: [tour('nav-my-team'), tour('main')],
        title: 'Plantel y finanzas',
        description: 'Tus jugadores, las ofertas recibidas y enviadas, el historial y las finanzas. Una oferta sin respuesta vence a las 48 horas; si te contraofertan, te toca contestar a vos.',
      },
      {
        id: 'tactics',
        path: '/tactics',
        targets: [tour('nav-tactics'), tour('main')],
        title: 'Pizarra táctica',
        description: 'Elegí formación, titulares, suplentes, dorsales e instrucciones de juego. Con el botón de compartir mandás un enlace público a tu táctica.',
      },
      {
        id: 'scouting',
        path: '/scouting',
        targets: [tour('nav-scouting'), tour('main')],
        title: 'Scouting',
        description: 'Mandá ojeadores a buscar jugadores con los criterios que elijas. Cada búsqueda gasta una asignación del mes y el resultado te llega como notificación.',
      },
    ],
  },
  {
    id: 'league',
    label: 'La liga',
    steps: [
      {
        id: 'other-teams',
        path: '/other-teams',
        targets: [tour('nav-other-teams'), tour('main')],
        title: 'Rivales',
        description: 'Los planteles de los demás clubes con la media de cada uno. Entrá a un club para ver sus jugadores y su perfil.',
      },
      {
        id: 'tournament',
        path: '/tournament',
        targets: [tour('nav-tournament'), tour('main')],
        title: 'Torneo',
        description: 'Partidos, grupos, llaves, repechaje y goleadores. Los resultados aparecen a medida que se cargan.',
      },
      {
        id: 'help',
        targets: [tour('help'), tour('menu')],
        title: 'Volver a la guía',
        description: 'Ayuda y reglas, al pie del menú, abre esta guía cuando quieras. Con las pestañas de arriba saltás directo a un capítulo.',
      },
    ],
  },
];

const GUIDE_STEPS = GUIDE_CHAPTERS.flatMap(chapter => chapter.steps.map((step, index) => ({
  ...step,
  chapterId: chapter.id,
  chapterLabel: chapter.label,
  indexInChapter: index,
  chapterLength: chapter.steps.length,
})));

const CHAPTER_TABS = GUIDE_CHAPTERS.map(({ id, label }) => ({ id, label }));
const SPOTLIGHT_PADDING = 10;
const TARGET_RETRY_MS = 150;
const TARGET_RETRIES = 10;
const SCROLL_SETTLE_MS = 240;
const POPOVER_WIDTH = 360;
const POPOVER_HEIGHT_ESTIMATE = 260;
const SIDE_TARGET_MAX_RIGHT = 280;

function isOnScreen(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth;
}

function findTarget(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && isOnScreen(element)) return element;
  }
  return null;
}

function getSpotlightRect(target) {
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const x = Math.max(8, rect.left - SPOTLIGHT_PADDING);
  const y = Math.max(8, rect.top - SPOTLIGHT_PADDING);
  return {
    x,
    y,
    width: Math.min(window.innerWidth - 8 - x, rect.width + SPOTLIGHT_PADDING * 2),
    height: Math.min(window.innerHeight - 8 - y, rect.height + SPOTLIGHT_PADDING * 2),
  };
}

function getPopoverStyle(rect) {
  if (window.innerWidth < 768) {
    return { left: '12px', right: '12px', bottom: 'calc(14px + env(safe-area-inset-bottom))' };
  }
  if (!rect) {
    return { left: `${(window.innerWidth - POPOVER_WIDTH) / 2}px`, top: `${Math.max(16, (window.innerHeight - POPOVER_HEIGHT_ESTIMATE) / 2)}px`, width: `${POPOVER_WIDTH}px` };
  }

  // A sidebar item is short and sits on the left edge: below it the popover would cover the next items.
  if (rect.x + rect.width < SIDE_TARGET_MAX_RIGHT) {
    const top = Math.min(window.innerHeight - POPOVER_HEIGHT_ESTIMATE - 16, Math.max(16, rect.y - 12));
    return { left: `${rect.x + rect.width + 14}px`, top: `${top}px`, width: `${POPOVER_WIDTH}px` };
  }

  const belowTop = rect.y + rect.height + 14;
  const aboveTop = rect.y - POPOVER_HEIGHT_ESTIMATE - 14;
  const top = belowTop + POPOVER_HEIGHT_ESTIMATE < window.innerHeight ? belowTop : Math.max(16, aboveTop);
  const targetCenter = rect.x + rect.width / 2;
  const left = Math.min(window.innerWidth - POPOVER_WIDTH - 16, Math.max(16, targetCenter - POPOVER_WIDTH / 2));
  return { left: `${left}px`, top: `${top}px`, width: `${POPOVER_WIDTH}px` };
}

function getSpotlightPath(rect) {
  const frame = `M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z`;
  if (!rect) return frame;
  const { x, y, width, height } = rect;
  const r = 12;
  return `${frame} M ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + width - r} Q ${x + width} ${y} ${x + width} ${y + r} V ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} H ${x + r} Q ${x} ${y + height} ${x} ${y + height - r} Z`;
}

export const TutorialModal = memo(function TutorialModal({ isVisible, onClose, onShowSection, budget }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [isTargetMissing, setIsTargetMissing] = useState(false);
  const nextButtonRef = useRef(null);
  const current = GUIDE_STEPS[stepIndex];
  const isLast = stepIndex === GUIDE_STEPS.length - 1;
  const next = GUIDE_STEPS[stepIndex + 1];
  const opensNextChapter = next && next.chapterId !== current?.chapterId;

  useEffect(() => {
    if (!isVisible) return;
    setStepIndex(0);
    nextButtonRef.current?.focus({ preventScroll: true });
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && current?.path) onShowSection?.(current.path);
  }, [current, isVisible, onShowSection]);

  useEffect(() => {
    if (!isVisible || !current) return undefined;
    let attempts = 0;
    let timer;

    const place = () => {
      const target = findTarget(current.targets);
      setSpotlightRect(getSpotlightRect(target));
      setIsTargetMissing(!target);
    };

    // Sections open lazily, so the target can take a moment to exist after onShowSection navigates.
    const locate = () => {
      const target = findTarget(current.targets);
      if (!target && attempts < TARGET_RETRIES) {
        attempts += 1;
        timer = window.setTimeout(locate, TARGET_RETRY_MS);
        return;
      }
      if (target && target.getBoundingClientRect().height < window.innerHeight / 2) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' });
      }
      timer = window.setTimeout(place, SCROLL_SETTLE_MS);
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };

    locate();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [current, isVisible, onClose]);

  if (!isVisible || !current) return null;

  const goToChapter = (chapterId) => setStepIndex(GUIDE_STEPS.findIndex(step => step.chapterId === chapterId));
  const goNext = () => {
    if (isLast) onClose();
    else setStepIndex(index => index + 1);
  };
  const nextLabel = isLast ? 'Terminar' : opensNextChapter ? next.chapterLabel : 'Siguiente';

  return (
    <div className="guide-layer" role="dialog" aria-modal="true" aria-label="Guía del draft">
      <svg className="guide-backdrop" width="100%" height="100%" aria-hidden="true">
        <path d={getSpotlightPath(spotlightRect)} fill="rgba(0,0,0,0.74)" fillRule="evenodd" />
      </svg>

      {spotlightRect && (
        <div
          className="guide-ring"
          style={{ left: spotlightRect.x, top: spotlightRect.y, width: spotlightRect.width, height: spotlightRect.height }}
        />
      )}

      <div className="guide-popover" style={getPopoverStyle(spotlightRect)}>
        <Tabs tabs={CHAPTER_TABS} value={current.chapterId} onChange={goToChapter} label="Capítulos de la guía" className="guide-chapters" />

        <div key={current.id} className="guide-step" aria-live="polite">
          <div className="flex items-start justify-between gap-2 mt-3 mb-0.5">
            <h3 className="pt-2.5 text-lg font-bold text-ink text-balance">{current.title}</h3>
            <button type="button" onClick={onClose} className="guide-close -mr-2" aria-label="Cerrar la guía">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-sm text-ink-2 leading-relaxed">{current.description}</p>

          {current.showsBudget && budget ? (
            <p className="mt-3 flex items-baseline justify-between gap-3 rounded-lg bg-raised px-3 py-2.5">
              <span className="text-xs font-semibold text-ink-3">Presupuesto inicial</span>
              <span className="font-display num text-lg font-bold text-success-soft">{formatBudget(budget)}</span>
            </p>
          ) : null}

          {isTargetMissing && (
            <p className="mt-3 text-xs text-ink-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
              No aparece en esta pantalla. Podés seguir con la guía y volver a esta sección desde el menú.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-5">
          <span className="num text-xs font-semibold text-ink-3 shrink-0" aria-label={`Paso ${current.indexInChapter + 1} de ${current.chapterLength}`}>
            {current.indexInChapter + 1}/{current.chapterLength}
          </span>
          <button
            type="button"
            onClick={() => setStepIndex(index => Math.max(0, index - 1))}
            disabled={stepIndex === 0}
            className="btn btn-secondary flex-1 min-h-11"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anterior
          </button>
          <button ref={nextButtonRef} type="button" onClick={goNext} className="btn btn-primary flex-1 min-h-11">
            {isLast
              ? <><Check className="w-4 h-4" aria-hidden="true" /> {nextLabel}</>
              : <>{nextLabel} <ChevronRight className="w-4 h-4" aria-hidden="true" /></>}
          </button>
        </div>
      </div>
    </div>
  );
});
