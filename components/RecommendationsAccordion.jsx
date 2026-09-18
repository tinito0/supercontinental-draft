import React, { memo, useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, DollarSign, Sparkles, Target, Zap, TrendingUp, Eye } from 'lucide-react';
import { formatPriceShort, getFlagUrl } from '../utils/helpers.js';

/* ── Standardized Position accent colors ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

/* ── Standardized OVR color tiers matching PlayerCard ── */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#9ca3af';

function getOvrColor(ovr) {
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (ovr >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

const FIT_CONFIG = {
  NECESIDAD: { label: 'Puesto clave', icon: Target, badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  VALOR: { label: 'Ganga', icon: DollarSign, badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  OVR: { label: 'Salto OVR', icon: TrendingUp, badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  FIT: { label: 'Encaje', icon: Zap, badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
};

export const RecommendationsAccordion = memo(function RecommendationsAccordion({
  recommendations,
  remainingBudget,
  onSelectPlayer
}) {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem('recommendations_expanded') !== 'false';
    } catch {
      return true;
    }
  });

  const scrollContainerRef = useRef(null);

  const toggleExpanded = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem('recommendations_expanded', String(next));
      } catch {}
      return next;
    });
  };

  const handleScroll = useCallback((direction) => {
    if (!scrollContainerRef.current) return;
    const distance = 360;
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth'
    });
  }, []);

  if (!recommendations || recommendations.length === 0) return null;

  const budgetM = remainingBudget ? remainingBudget / 1000000 : 0;
  const bestReason = recommendations[0]?._reason || 'Opciones estratégicas para tu plantel';

  return (
    <section className="mb-6 rounded-2xl bg-[#0c1017] border border-white/[0.08] shadow-xl overflow-hidden relative transition-all duration-300">
      {/* Subtle top cyan ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00b4d8]/40 to-transparent pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0c1017] border-b border-white/[0.06] select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/10 border border-[#00b4d8]/25 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5 text-[#00b4d8]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                Recomendados para vos
              </h3>
              <span className="text-[10px] font-black text-[#00b4d8] bg-[#00b4d8]/10 border border-[#00b4d8]/25 px-2 py-0.5 rounded-full">
                {recommendations.length} disponibles
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {bestReason} <span className="text-slate-600">·</span> Margen disp: <span className="text-emerald-400 font-bold">${budgetM.toFixed(1)}M</span>
            </p>
          </div>
        </div>

        {/* Action controls: carousel arrows + collapse toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isExpanded && recommendations.length > 3 && (
            <div className="hidden sm:flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                className="w-8 h-8 rounded-lg bg-[#111722] border border-white/[0.08] text-slate-400 hover:text-white hover:border-[#00b4d8]/40 flex items-center justify-center transition active:scale-95"
                title="Desplazar a la izquierda"
                aria-label="Ver anteriores"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                className="w-8 h-8 rounded-lg bg-[#111722] border border-white/[0.08] text-slate-400 hover:text-white hover:border-[#00b4d8]/40 flex items-center justify-center transition active:scale-95"
                title="Desplazar a la derecha"
                aria-label="Ver siguientes"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111722] border border-white/[0.08] text-slate-300 hover:text-white hover:border-[#00b4d8]/40 text-xs font-bold transition active:scale-95"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Ocultar' : 'Mostrar'}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#00b4d8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Content Shelf ── */}
      {isExpanded && (
        <div className="p-3 sm:p-5 bg-[#06080d]/80">
          <div
            ref={scrollContainerRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory custom-scrollbar"
            style={{ scrollbarWidth: 'thin' }}
          >
            {recommendations.map(player => {
              const ovr = player.OVR_CALCULADO || 0;
              const ovrColor = getOvrColor(ovr);
              const posColor = POS_COLOR[player.POS_NOMBRE] || '#94a3af';
              const flagUrl = getFlagUrl(player.Country1);
              const fit = FIT_CONFIG[player._fit] || FIT_CONFIG.FIT;
              const FitIcon = fit.icon;

              return (
                <div
                  key={`rec-${player.Id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPlayer(player.Id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPlayer(player.Id); } }}
                  className="group flex-shrink-0 w-[164px] sm:w-[178px] snap-start rounded-xl bg-[#111722] border border-white/[0.08] overflow-hidden text-left cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-[#00b4d8]/60 hover:shadow-[0_12px_24px_rgba(0,180,216,0.15)] active:scale-[0.98] flex flex-col"
                >
                  {/* Top bar: Price & Fit Badge */}
                  <div className="flex items-center justify-between gap-1 px-3 py-2 bg-[#0c1017] border-b border-white/[0.06]">
                    <span className="inline-flex items-center gap-1 min-w-0 font-mono">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-black text-emerald-400 truncate">
                        {formatPriceShort(player.Precio)}
                      </span>
                    </span>

                    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${fit.badgeClass}`}>
                      <FitIcon className="w-2.5 h-2.5" />
                      <span>{fit.label}</span>
                    </span>
                  </div>

                  {/* Player Image & Overlay Banner */}
                  <div className="relative overflow-hidden aspect-[3/2.8] bg-gradient-to-b from-[#151c2a] to-[#0a0e14]">
                    {/* Position radial aura */}
                    <div
                      className="absolute inset-0 opacity-25 pointer-events-none z-[1]"
                      style={{ background: `radial-gradient(ellipse at 50% 60%, ${posColor}40 0%, transparent 70%)` }}
                    />

                    <img
                      src={`/fotos_jugadores/${player.Id}.webp`}
                      alt={player.Name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover z-[2] transition-transform duration-500 ease-out group-hover:scale-105"
                      style={{
                        objectPosition: 'top center',
                        filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))'
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://placehold.co/180x170/111722/e2e8f0?text=${player.Name?.substring(0, 2) || '?'}`;
                      }}
                    />

                    {/* Dark gradient fade */}
                    <div
                      className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
                      style={{ height: '40%', background: 'linear-gradient(to top, #111722 0%, transparent 100%)' }}
                    />

                    {/* Quick View Button on Hover */}
                    <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00b4d8] text-[#030712] font-black text-xs shadow-lg transform translate-y-1 group-hover:translate-y-0 transition-transform">
                        <Eye className="w-3.5 h-3.5" /> Ver Ficha
                      </span>
                    </div>

                    {/* OVR + Flag + Position overlay strip */}
                    <div className="absolute bottom-1.5 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex items-center justify-center rounded-md px-1.5 py-0.5 border"
                          style={{
                            background: `${ovrColor}20`,
                            borderColor: `${ovrColor}60`,
                            boxShadow: `0 2px 6px ${ovrColor}30`
                          }}
                        >
                          <span
                            className="text-base sm:text-lg font-black leading-none"
                            style={{ color: ovrColor }}
                          >
                            {ovr}
                          </span>
                        </div>

                        {flagUrl && (
                          <img
                            src={flagUrl}
                            alt=""
                            className="w-4 h-3 object-cover rounded-[2px] border border-white/20 shadow"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        )}
                      </div>

                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded text-white shadow-sm"
                        style={{ background: posColor }}
                      >
                        {player.POS_NOMBRE}
                      </span>
                    </div>
                  </div>

                  {/* Player Meta Details */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between bg-[#111722]">
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-wide truncate group-hover:text-[#00b4d8] transition-colors">
                        {player.Name}
                      </p>

                      {player._reason && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-slate-300 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded max-w-full">
                          <Target className="w-2.5 h-2.5 text-[#00b4d8] shrink-0" />
                          <span className="truncate">{player._reason}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[9px] text-slate-400 font-semibold">
                      <span>Impacto</span>
                      <span className="text-slate-300 font-bold">{player._valueNote || '< 5%'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
});
