import React, { memo } from 'react';
import { Trophy, Star } from 'lucide-react';
import { TournamentSectionTitle } from '../TournamentUI.jsx';

export const StatsView = memo(function StatsView({
  localData,
  isEditing,
  isObsMode,
  getTeamLogo,
  getPlayerPhoto,
  updateStat,
}) {
  return (
    <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-center scale-100 px-20' : 'max-w-5xl mx-auto py-4 px-4'}`}>
      <TournamentSectionTitle title="LÍDERES INDIVIDUALES" subtitle="ESTADÍSTICAS DEL TORNEO" />
      <div className={`w-full ${isObsMode ? 'grid grid-cols-2 gap-12 max-w-[1500px] mt-8' : 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-4'}`}>
        {/* GOLEADORES */}
        <div className="bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Máximos Goleadores</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Goles</span>
          </div>
          <div className="p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
            {localData.topScorers.map((player, idx) => {
              const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto?.(player.name));

              return (
                <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-amber-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-amber-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                      {idx + 1}
                    </div>

                    {/* Foto del jugador con mini escudo del club */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-sm">
                      <img
                        src={photoUrl || `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`;
                        }}
                      />
                      {player.team && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 p-0.5 border border-white/20 flex items-center justify-center">
                          <img src={getTeamLogo(player.team)} width={14} height={14} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} alt="" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      {isEditing ? (
                        <>
                          <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topScorers', idx, 'name', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 mb-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                          <input placeholder="Club" value={player.team} onChange={e => updateStat('topScorers', idx, 'team', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                        </>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name || '—'}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{player.team || 'Sin equipo'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    {isEditing ? (
                      <input type="number" value={player.goals} onChange={e => updateStat('topScorers', idx, 'goals', e.target.value)} className="w-14 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 text-center font-bold text-base rounded p-1 border border-sky-300 dark:border-sky-800" />
                    ) : (
                      <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-sky-600 dark:text-sky-400 tabular-nums">
                        {player.goals || 0}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ASISTIDORES */}
        <div className="bg-white dark:bg-[#0c1017] rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Star className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">Máximos Asistidores</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Asist</span>
          </div>
          <div className="p-3 space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">
            {localData.topAssisters.map((player, idx) => {
              const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto?.(player.name));

              return (
                <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-emerald-500 text-white shadow-sm' : idx === 1 ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : idx === 2 ? 'bg-emerald-700/70 text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                      {idx + 1}
                    </div>

                    {/* Foto del jugador con mini escudo del club */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-sm">
                      <img
                        src={photoUrl || `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `https://placehold.co/32x32/111/555?text=${(player.name || '?').substring(0, 1)}`;
                        }}
                      />
                      {player.team && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-black/70 p-0.5 border border-white/20 flex items-center justify-center">
                          <img src={getTeamLogo(player.team)} width={14} height={14} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} alt="" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      {isEditing ? (
                        <>
                          <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topAssisters', idx, 'name', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white px-2 py-1 mb-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                          <input placeholder="Club" value={player.team} onChange={e => updateStat('topAssisters', idx, 'team', e.target.value)} className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"/>
                        </>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">{player.name || '—'}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{player.team || 'Sin equipo'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    {isEditing ? (
                      <input type="number" value={player.assists} onChange={e => updateStat('topAssisters', idx, 'assists', e.target.value)} className="w-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-center font-bold text-base rounded p-1 border border-emerald-300 dark:border-emerald-800" />
                    ) : (
                      <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {player.assists || 0}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

export default StatsView;
