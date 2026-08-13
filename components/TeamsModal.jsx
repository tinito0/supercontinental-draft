import React, { useState, useMemo, memo } from 'react';
import { X, Search, Users, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl } from '../utils/helpers.js';

export const TeamsModal = memo(function TeamsModal({ isPage, isVisible, onClose, allTeams, playerLocks, allPlayers, countryMap, onPlayerClick, title = 'Scouting', subtitle = 'Monitor de fichajes en tiempo real' }) {
  const navigate = useNavigate();
  const posColors = { DC: 'bg-red-700', SD: 'bg-red-700', EI: 'bg-red-700', ED: 'bg-red-700', MC: 'bg-green-800', MCD: 'bg-green-800', MO: 'bg-green-800', MI: 'bg-green-800', MD: 'bg-green-800', DFC: 'bg-blue-800', LI: 'bg-blue-800', LD: 'bg-blue-800', PT: 'bg-yellow-700' };

  const playersByTeam = useMemo(() => {
    const teams = {};
    Object.values(allTeams).forEach(team => { teams[team.userId] = { ...team, players: [] }; });
    Object.entries(playerLocks).forEach(([playerId, lockData]) => {
      const player = allPlayers.find(p => String(p.Id) === String(playerId));
      if (player && teams[lockData.lockedBy]) teams[lockData.lockedBy].players.push(player);
    });
    return Object.values(teams).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [allTeams, playerLocks, allPlayers]);

  const teamStats = useMemo(() => playersByTeam.map(team => {
    const totalCost = team.players.reduce((sum, p) => sum + p.Precio, 0);
    const avgOvr = team.players.length > 0
      ? Math.round(team.players.reduce((sum, p) => sum + p.OVR_CALCULADO, 0) / team.players.length)
      : 0;
    // Ordenar una copia una sola vez acá, en vez de team.players.sort(...) directo en el JSX
    // (eso mutaba el array en cada render, además de recalcular el orden innecesariamente).
    const sortedPlayers = [...team.players].sort((a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO);
    return { ...team, players: sortedPlayers, totalCost, avgOvr };
  }), [playersByTeam]);

  const ovrColor = (v) => v >= 85 ? '#4ade80' : v >= 70 ? '#facc15' : '#fb923c';

  if (!isVisible && !isPage) return null;

  const inner = (
    <div
      className={isPage
        ? "w-full h-full min-h-0 flex flex-col bg-[#0a0a0a]"
        : "bg-[#0f0f0f] sm:rounded-2xl shadow-2xl w-full max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"}
      onClick={e => e.stopPropagation()}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 shrink-0"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }}>
        <div>
          <h2 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-cyan-500" /> {title}
          </h2>
          <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>
        </div>
        {!isPage && (
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-grow min-h-0 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 pb-20 custom-scrollbar">
        {teamStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Sin equipos registrados</p>
          </div>
        ) : (
          teamStats.map(team => (
            <div key={team.userId}
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>

              {/* Team header bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-5 py-4"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
                    <img
                      src={team.logoUrl || DEFAULT_LOGO}
                      alt="Logo"
                      className="w-11 h-11 rounded-xl object-contain relative z-10 bg-black/50 p-1"
                      onError={(e) => e.target.src = DEFAULT_LOGO}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide flex items-center gap-2 flex-wrap">
                      {team.teamName}
                      <button 
                        onClick={(e) => { e.stopPropagation(); navigate(`/team/${team.userId}`); }}
                        className="text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded flex items-center gap-1 transition"
                        title="Ver Perfil Público"
                      >
                        Perfil <ExternalLink size={10} />
                      </button>
                    </h3>
                    <span className="text-[10px] text-gray-600 font-mono">ID: {team.userId.substring(0, 8)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-left sm:text-right">
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-bold">Gasto</p>
                    <p className="text-sm font-black text-emerald-400">{formatPriceShort(team.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-bold">Media</p>
                    <p className={`text-sm font-black`} style={{ color: ovrColor(team.avgOvr) }}>{team.avgOvr || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase font-bold">Plantilla</p>
                    <p className="text-sm font-black text-white/70">{team.players.length}</p>
                  </div>
                </div>
              </div>

              {/* Players grid */}
              {team.players.length === 0 ? (
                <div className="px-5 py-4 text-center">
                  <p className="text-xs text-gray-700 italic">Sin fichajes aún</p>
                </div>
              ) : (
                <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
                  {team.players.map(player => (
                    <div
                      key={player.Id}
                      onClick={() => onPlayerClick && onPlayerClick(player)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer
                        hover:bg-white/[0.04] transition-all group"
                    >
                      <img
                        src={`/fotos_jugadores/${player.Id}.webp`}
                        alt={player.Name}
                        className="w-9 h-9 rounded-lg object-cover bg-[#111] flex-shrink-0"
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/36x36/111/333?text=${player.Name[0]}`; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white/85 truncate leading-tight group-hover:text-white transition">
                          {player.Name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded ${posColors[player.POS_NOMBRE] || 'bg-gray-700'}`}>
                            {player.POS_NOMBRE}
                          </span>
                          <img src={getFlagUrl(player.Country1)} className="w-4 h-3 rounded-[2px] opacity-60" onError={(e) => e.target.style.display = 'none'} alt="" />
                        </div>
                      </div>
                      <span className={`text-base font-black flex-shrink-0`} style={{ color: ovrColor(player.OVR_CALCULADO) }}>
                        {player.OVR_CALCULADO}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (isPage) return inner;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onClose}>
      {inner}
    </div>
  );
});
