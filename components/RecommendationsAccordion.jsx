import React, { memo, useState } from 'react';
import { ChevronDown, DollarSign, Sparkles, Target } from 'lucide-react';
import { formatPriceShort, getFlagUrl } from '../utils/helpers.js';

const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

function getOvrColor(ovr) {
  if (ovr >= 90) return '#facc15';
  if (ovr >= 85) return '#4ade80';
  if (ovr >= 75) return '#a3e635';
  if (ovr >= 65) return '#38bdf8';
  return '#9ca3af';
}

export const RecommendationsAccordion = memo(function RecommendationsAccordion({ recommendations, remainingBudget, onSelectPlayer }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!recommendations || recommendations.length === 0) return null;

  const budgetM = remainingBudget ? remainingBudget / 1000000 : 0;
  const bestReason = recommendations[0]?._reason || 'Opciones útiles para tu plantel';

  return (
    <section className="mb-6 rounded-xl bg-[#0d1114] overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 bg-[#101417] hover:bg-white/[0.045] transition-colors"
      >
        <div className="min-w-0 flex items-center gap-3 text-left">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
            <Sparkles className="w-4 h-4 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-gray-300 tracking-[0.14em] uppercase">Recomendados para vos</span>
              <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]">
                {recommendations.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{bestReason} · Presupuesto ${budgetM.toFixed(1)}M</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[430px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="px-3 sm:px-4 py-3 bg-black/10">
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
            {recommendations.map(player => {
              const ovr = player.OVR_CALCULADO || 0;
              const ovrColor = getOvrColor(ovr);
              const posColor = POS_COLOR[player.POS_NOMBRE] || '#9ca3af';
              const flagUrl = getFlagUrl(player.Country1);

              return (
                <button
                  key={`rec-${player.Id}`}
                  type="button"
                  onClick={() => onSelectPlayer(player.Id)}
                  className="group flex-shrink-0 w-[148px] sm:w-[158px] rounded-xl bg-black/25 overflow-hidden text-left shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)] transition hover:-translate-y-0.5 hover:bg-white/[0.045] hover:shadow-[inset_0_0_0_1px_rgba(52,211,153,0.22)] active:scale-[0.98]"
                >
                  <div
                    className="flex items-center justify-between gap-1 px-2.5 py-2"
                    style={{
                      background: 'linear-gradient(180deg, rgba(16,185,129,0.11) 0%, rgba(0,0,0,0.12) 100%)',
                      borderBottom: '1px solid rgba(16,185,129,0.12)',
                    }}
                  >
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <DollarSign className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span className="text-sm font-black text-emerald-300 truncate">{formatPriceShort(player.Precio)}</span>
                    </span>
                    {player._fit && (
                      <span className="text-[9px] font-black text-cyan-200 bg-cyan-500/10 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(34,211,238,0.12)]">
                        {player._fit}
                      </span>
                    )}
                  </div>

                  <div
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: '3 / 2.85',
                      background: 'linear-gradient(168deg, #1a1a1f 0%, #0c0c0e 100%)',
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-35 pointer-events-none z-[1]"
                      style={{ background: `radial-gradient(ellipse at 50% 70%, ${posColor}30 0%, transparent 65%)` }}
                    />

                    <img
                      src={`/fotos_jugadores/${player.Id}.webp`}
                      alt={player.Name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover z-[2] transition-transform duration-300 ease group-hover:scale-[1.035]"
                      style={{
                        filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.6))',
                        objectPosition: 'top center',
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://placehold.co/160x150/111/333?text=${player.Name?.substring(0, 2) || '?'}`;
                      }}
                    />

                    <div
                      className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
                      style={{ height: '35%', background: 'linear-gradient(to top, rgba(12, 12, 14, 0.7) 0%, transparent 100%)' }}
                    />

                    <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-1.5 px-2 py-1.5 pointer-events-none">
                      <div
                        className="flex items-center justify-center rounded-md px-1.5 py-0.5 flex-shrink-0"
                        style={{ background: `${ovrColor}22`, border: `1.5px solid ${ovrColor}60`, backdropFilter: 'blur(6px)' }}
                      >
                        <span
                          className="text-xl font-black leading-none"
                          style={{ color: ovrColor, textShadow: '0 2px 8px rgba(0,0,0,0.8)', letterSpacing: 0 }}
                        >
                          {ovr}
                        </span>
                      </div>

                      <img
                        src={flagUrl}
                        alt=""
                        className="w-[18px] h-[13px] object-cover rounded-[2px] flex-shrink-0"
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />

                      <span
                        className="text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-[5px] flex-shrink-0 ml-auto text-white"
                        style={{ background: posColor, boxShadow: `0 2px 8px ${posColor}50` }}
                      >
                        {player.POS_NOMBRE}
                      </span>
                    </div>
                  </div>

                  <div className="px-2.5 py-2 bg-black/35">
                    <p className="text-[11px] font-black text-white uppercase tracking-wide truncate leading-tight">
                      {player.Name}
                    </p>
                    {player._reason && (
                      <span className="mt-1 inline-flex items-center gap-1 max-w-full text-[9px] font-bold text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded shadow-[inset_0_0_0_1px_rgba(59,130,246,0.10)]">
                        <Target className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{player._reason}</span>
                      </span>
                    )}
                    {player._valueNote && (
                      <span className="block mt-1 text-[9px] font-bold text-gray-500 truncate">
                        {player._valueNote}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});
