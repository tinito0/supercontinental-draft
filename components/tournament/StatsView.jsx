import React, { memo } from 'react';
import { Trophy, Star } from 'lucide-react';
import { TournamentSectionTitle } from '../TournamentUI.jsx';
import { playerPlaceholder } from '../../utils/playerPlaceholder.js';

export const StatsView = memo(function StatsView({
  localData,
  isEditing,
  isObsMode,
  getTeamLogo,
  getPlayerPhoto,
  updateStat,
  showTitle = true,
}) {
  return (
    <div className={`flex flex-col items-center w-full ${isObsMode ? 'h-full justify-center scale-100 px-20' : 'max-w-5xl mx-auto py-4 px-4'}`}>
      {showTitle && <TournamentSectionTitle title="LÍDERES INDIVIDUALES" subtitle="ESTADÍSTICAS DEL TORNEO" />}
      <div className={`w-full ${isObsMode ? 'grid grid-cols-2 gap-12 max-w-[1500px] mt-8' : 'grid grid-cols-1 md:grid-cols-2 gap-6 mt-4'}`}>
        {/* GOLEADORES */}
        <div className=" bg-surface rounded-xl border border-line/20 shadow-sm overflow-hidden">
          <div className=" bg-surface/80 px-4 py-3 border-b border-line/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center text-warning-soft">
                <Trophy className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">Máximos Goleadores</h3>
            </div>
            <span className="text-xs text-ink-3 font-medium">Goles</span>
          </div>
          <div className="p-3 space-y-2 divide-y divide-line/[0.08]">
            {!isEditing && !(localData.topScorers || []).some(player => String(player?.name || '').trim()) && <p className="px-2 py-6 text-center text-sm text-ink-2">Todavía no hay goles cargados.</p>}
            {(localData.topScorers || []).map((player, idx) => {
              // Fuera de edición no se muestran los lugares vacíos («—, Sin equipo, 0»).
              if (!isEditing && !String(player?.name || '').trim()) return null;
              const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto?.(player.name));

              return (
                <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-amber-500 text-[#1e1e1e] shadow-sm' : idx === 1 ? ' bg-overlay text-ink-2' : idx === 2 ? 'bg-amber-700/70 text-ink' : ' text-ink-3'}`}>
                      {idx + 1}
                    </div>

                    {/* Foto del jugador con mini escudo del club */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-line/[0.12] shrink-0 shadow-sm">
                      <img
                        src={photoUrl || playerPlaceholder((player.name || '?').substring(0, 1))}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = playerPlaceholder((player.name || '?').substring(0, 1));
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
                          <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topScorers', idx, 'name', e.target.value)} className=" bg-surface text-ink px-2 py-1 mb-1 rounded border border-line/20 text-xs"/>
                          <input placeholder="Club" value={player.team} onChange={e => updateStat('topScorers', idx, 'team', e.target.value)} className=" bg-surface text-ink-3 px-2 py-1 rounded border border-line/20 text-xs"/>
                        </>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-ink truncate">{player.name || '—'}</span>
                          <span className="text-[11px] text-ink-3 truncate">{player.team || 'Sin equipo'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    {isEditing ? (
                      <input type="number" value={player.goals} onChange={e => updateStat('topScorers', idx, 'goals', e.target.value)} className="w-14 bg-accent-deep/40 text-accent-soft text-center font-bold text-base rounded p-1 border border-accent-deep" />
                    ) : (
                      <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-accent-soft tabular-nums">
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
        <div className=" bg-surface rounded-xl border border-line/20 shadow-sm overflow-hidden">
          <div className=" bg-surface/80 px-4 py-3 border-b border-line/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center text-success-soft">
                <Star className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">Máximos Asistidores</h3>
            </div>
            <span className="text-xs text-ink-3 font-medium">Asist</span>
          </div>
          <div className="p-3 space-y-2 divide-y divide-line/[0.08]">
            {!isEditing && !(localData.topAssisters || []).some(player => String(player?.name || '').trim()) && <p className="px-2 py-6 text-center text-sm text-ink-2">Todavía no hay asistencias cargadas.</p>}
            {(localData.topAssisters || []).map((player, idx) => {
              if (!isEditing && !String(player?.name || '').trim()) return null;
              const photoUrl = player.photoUrl || (player.playerId ? `/fotos_jugadores/${player.playerId}.webp` : getPlayerPhoto?.(player.name));

              return (
                <div key={idx} className="flex items-center justify-between pt-2 first:pt-0 hover:bg-white/[0.02] p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${idx === 0 ? 'bg-emerald-500 text-ink shadow-sm' : idx === 1 ? ' bg-overlay text-ink-2' : idx === 2 ? 'bg-emerald-700/70 text-ink' : ' text-ink-3'}`}>
                      {idx + 1}
                    </div>

                    {/* Foto del jugador con mini escudo del club */}
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-line/[0.12] shrink-0 shadow-sm">
                      <img
                        src={photoUrl || playerPlaceholder((player.name || '?').substring(0, 1))}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = playerPlaceholder((player.name || '?').substring(0, 1));
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
                          <input placeholder="Nombre" value={player.name} onChange={e => updateStat('topAssisters', idx, 'name', e.target.value)} className=" bg-surface text-ink px-2 py-1 mb-1 rounded border border-line/20 text-xs"/>
                          <input placeholder="Club" value={player.team} onChange={e => updateStat('topAssisters', idx, 'team', e.target.value)} className=" bg-surface text-ink-3 px-2 py-1 rounded border border-line/20 text-xs"/>
                        </>
                      ) : (
                        <>
                          <span className="text-xs sm:text-sm font-semibold text-ink truncate">{player.name || '—'}</span>
                          <span className="text-[11px] text-ink-3 truncate">{player.team || 'Sin equipo'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    {isEditing ? (
                      <input type="number" value={player.assists} onChange={e => updateStat('topAssisters', idx, 'assists', e.target.value)} className="w-14 bg-emerald-950/40 text-success-soft text-center font-bold text-base rounded p-1 border border-emerald-800" />
                    ) : (
                      <div className="min-w-[32px] text-right font-bold text-sm sm:text-base text-success-soft tabular-nums">
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
