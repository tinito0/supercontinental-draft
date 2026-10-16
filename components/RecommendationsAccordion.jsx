import React, { memo, useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { formatPriceShort, formatPriceCompact, getPosColorClass, getStatAndOvrColorClass } from '../utils/helpers.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';
import { Badge } from './ui/Badge.jsx';

const STORAGE_KEY = 'recommendations_expanded';
const SHORT_SCREEN_HEIGHT = 900; // below this the shelf starts collapsed so the market itself is in view
const SCROLL_STEP = 360;

// The one badge per card: why the player fits (utils/recommendations.js → _fit).
const FIT_CONFIG = {
  NECESIDAD: { label: 'Puesto clave', variant: 'warning' },
  VALOR: { label: 'Ganga', variant: 'success' },
  OVR: { label: 'Salto de media', variant: 'primary' },
  FIT: { label: 'Encaje', variant: 'primary' },
};

function readInitialExpanded() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true' || stored === 'false') return stored === 'true';
  } catch {
    // no storage: fall through to the screen-height default
  }
  return typeof window === 'undefined' || window.innerHeight >= SHORT_SCREEN_HEIGHT;
}

export const RecommendationsAccordion = memo(function RecommendationsAccordion({ recommendations, onSelectPlayer }) {
  const [isExpanded, setIsExpanded] = useState(readInitialExpanded);
  const scrollContainerRef = useRef(null);

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // preference only
      }
      return next;
    });
  };

  const scrollShelf = useCallback((direction) => {
    scrollContainerRef.current?.scrollBy({ left: direction === 'left' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });
  }, []);

  if (!recommendations || recommendations.length === 0) return null;

  const bestReason = recommendations[0]?._reason || 'Opciones para tu plantel';

  return (
    <section className="mb-5 rounded-2xl bg-surface border border-line/[0.12]" aria-labelledby="recommendations-title">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Sparkles className="w-4 h-4 text-accent-soft shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="recommendations-title" className="text-sm font-semibold text-ink">
              Recomendados para vos <span className="font-normal text-ink-3">· <span className="num">{recommendations.length}</span></span>
            </h2>
            <p className="text-xs text-ink-3 truncate">{bestReason}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isExpanded && recommendations.length > 3 && (
            <div className="hidden sm:flex items-center gap-1">
              <button type="button" onClick={() => scrollShelf('left')} className="btn btn-ghost btn-icon btn-sm" aria-label="Ver anteriores" title="Ver anteriores">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => scrollShelf('right')} className="btn btn-ghost btn-icon btn-sm" aria-label="Ver siguientes" title="Ver siguientes">
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <button type="button" onClick={toggleExpanded} className="btn btn-secondary btn-sm" aria-expanded={isExpanded} aria-controls="recommendations-shelf">
            {isExpanded ? 'Ocultar' : 'Mostrar'}
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div id="recommendations-shelf" ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto px-4 sm:px-5 pb-4 snap-x custom-scrollbar">
          {recommendations.map(player => {
            const ovr = player.OVR_CALCULADO || 0;
            const fit = FIT_CONFIG[player._fit] || FIT_CONFIG.FIT;
            return (
              <button
                key={`rec-${player.Id}`}
                type="button"
                onClick={() => onSelectPlayer(player.Id)}
                aria-label={`Ver ficha de ${player.Name}, ${fit.label}, media ${ovr}, ${formatPriceShort(player.Precio)}`}
                className="group shrink-0 w-[152px] sm:w-[164px] snap-start rounded-xl border border-line/[0.12] bg-raised hover:border-line/30 hover:bg-overlay transition-colors text-left flex flex-col"
              >
                <div className="relative aspect-square overflow-hidden rounded-t-[11px] bg-overlay">
                  <img
                    src={`/fotos_jugadores/${player.Id}.webp`}
                    alt=""
                    loading="lazy"
                    width={164}
                    height={164}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.substring(0, 2) || '?'); }}
                  />
                  <span className={`absolute left-1.5 top-1.5 min-w-8 h-8 px-1 rounded-md flex items-center justify-center font-display num text-lg font-bold leading-none ${getStatAndOvrColorClass(ovr)}`}>{ovr}</span>
                  <span className={`absolute left-1.5 bottom-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold leading-tight ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
                </div>
                <div className="flex-1 flex flex-col gap-1.5 p-2.5 min-w-0">
                  <span className="text-sm font-semibold text-ink truncate">{player.Name}</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display num text-base font-semibold text-ink">{formatPriceCompact(player.Precio)}</span>
                    <Badge variant={fit.variant} size="sm">{fit.label}</Badge>
                  </div>
                  {player._valueNote && <span className="text-xs text-ink-3">{player._valueNote}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
});
