import React, { memo, useMemo } from 'react';
import {
  TrendingUp, Users, DollarSign, ArrowRight, Shield,
  Award, Flame, Calendar, Activity, Zap
} from 'lucide-react';
import { DEFAULT_LOGO, DEFAULT_BUDGET } from '../utils/constants.js';
import { formatPriceShort, getStatAndOvrColorClass } from '../utils/helpers.js';

export const OverviewTab = memo(function OverviewTab({
  userProfile,
  remainingBudget,
  ownedCart = [],
  tournamentData,
  allTeams = {},
  setActiveTab,
  onPlayerClick,
  signingToasts = [],
}) {
  const teamName = userProfile?.teamName || 'Mi Equipo';
  const logoUrl = userProfile?.logoUrl || DEFAULT_LOGO;

  // Resolve team logo helper
  const getLogo = (name) => {
    if (!name || !allTeams) return DEFAULT_LOGO;
    const target = name.trim().toLowerCase();
    const foundId = Object.keys(allTeams).find(
      id => allTeams[id]?.teamName?.trim().toLowerCase() === target
    );
    return foundId ? (allTeams[foundId]?.logoUrl || DEFAULT_LOGO) : DEFAULT_LOGO;
  };

  // ── 1. User league standings & table info ──
  const leagueTable = useMemo(() => {
    if (!tournamentData?.league || !Array.isArray(tournamentData.league)) return [];
    return [...tournamentData.league]
      .filter(t => t.name && t.name !== 'Club...')
      .sort((a, b) => {
        const ptsA = Number(a.pts) || 0;
        const ptsB = Number(b.pts) || 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        const dgA = (Number(a.gf) || 0) - (Number(a.gc) || 0);
        const dgB = (Number(b.gf) || 0) - (Number(b.gc) || 0);
        return dgB - dgA;
      });
  }, [tournamentData?.league]);

  const userRankIndex = useMemo(() => {
    if (!teamName || leagueTable.length === 0) return -1;
    return leagueTable.findIndex(t => t.name?.trim().toLowerCase() === teamName.trim().toLowerCase());
  }, [leagueTable, teamName]);

  const userLeagueStats = userRankIndex >= 0 ? leagueTable[userRankIndex] : null;

  // ── 2. User next match / recent match ──
  const userMatches = useMemo(() => {
    if (!tournamentData?.matches || !Array.isArray(tournamentData.matches)) return [];
    const tLower = teamName.trim().toLowerCase();
    return tournamentData.matches.filter(m =>
      m.homeTeam?.trim().toLowerCase() === tLower ||
      m.awayTeam?.trim().toLowerCase() === tLower
    );
  }, [tournamentData?.matches, teamName]);

  const nextMatch = useMemo(() => {
    return userMatches.find(m => m.status !== 'completed') || null;
  }, [userMatches]);

  const lastMatch = useMemo(() => {
    const finished = userMatches.filter(m => m.status === 'completed');
    return finished.length > 0 ? finished[finished.length - 1] : null;
  }, [userMatches]);

  // ── 3. Squad stats & star players ──
  const topPlayers = useMemo(() => {
    if (!ownedCart || ownedCart.length === 0) return [];
    return [...ownedCart]
      .sort((a, b) => (b.OVR_CALCULADO || 0) - (a.OVR_CALCULADO || 0))
      .slice(0, 4);
  }, [ownedCart]);

  const averageOvr = useMemo(() => {
    if (!ownedCart || ownedCart.length === 0) return 0;
    const sum = ownedCart.reduce((acc, p) => acc + (p.OVR_CALCULADO || 0), 0);
    return Math.round(sum / ownedCart.length);
  }, [ownedCart]);

  // Budget calculations
  const initBudget = userProfile?.budget || DEFAULT_BUDGET;
  const currentBudget = typeof remainingBudget === 'number' ? remainingBudget : initBudget;
  const budgetPct = Math.min(100, Math.max(0, (currentBudget / initBudget) * 100));

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">

      {/* ─── HERO COCKPIT SOFASCORE ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1017] via-[#111722] to-[#0c1017] border border-white/[0.08] p-5 sm:p-7 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-[#00b4d8]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Identity */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/[0.03] border border-white/10 p-2.5 flex items-center justify-center shrink-0 shadow-lg">
              <img
                src={logoUrl}
                alt={teamName}
                className="w-full h-full object-contain drop-shadow"
                onError={(e) => { e.target.src = DEFAULT_LOGO; }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#00b4d8]/15 text-[#00b4d8] border border-[#00b4d8]/30">
                  Supercontinental League
                </span>
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                  Temporada 2
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {teamName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Panel central de control y rendimiento de la franquicia
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/30 p-2 sm:p-2.5 rounded-xl border border-white/5">
            {/* Presupuesto */}
            <div className="p-3 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Presupuesto
              </span>
              <div className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums">
                {formatPriceShort(currentBudget / 1000000)}
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            {/* Plantilla */}
            <div className="p-3 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Fichajes
              </span>
              <div className="text-lg sm:text-xl font-black text-white tabular-nums">
                {ownedCart.length}{' '}
                <span className="text-xs text-slate-400 font-normal">jugadores</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 truncate">
                Límite reglamentario
              </div>
            </div>

            {/* Media Equipo */}
            <div className="p-3 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Media Plantel
              </span>
              <div className="text-lg sm:text-xl font-black text-[#00b4d8] tabular-nums">
                {averageOvr > 0 ? averageOvr : '---'}
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                OVR Promedio
              </div>
            </div>

            {/* Posición Tabla */}
            <div className="p-3 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Posición Liga
              </span>
              <div className="text-lg sm:text-xl font-black text-amber-400 tabular-nums">
                {userRankIndex >= 0 ? `#${userRankIndex + 1}` : '---'}
              </div>
              <div className="text-[10px] text-slate-400 mt-2 tabular-nums">
                {userLeagueStats ? `${userLeagueStats.pts} pts (${userLeagueStats.pj} PJ)` : 'Sin clasif.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMNA 1 & 2: PARTIDO EN FOCO & TABLA RESUMEN */}
        <div className="lg:col-span-2 space-y-6">

          {/* PARTIDO EN FOCO (NEXT MATCH CARD) */}
          <div className="rounded-2xl bg-[#0c1017] border border-white/[0.08] p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00b4d8]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  {nextMatch ? 'Próximo Encuentro' : lastMatch ? 'Último Partido Jugado' : 'Agenda de Partidos'}
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {nextMatch?.round || lastMatch?.round || 'Fase Regular'}
              </span>
            </div>

            {nextMatch || lastMatch ? (
              (() => {
                const match = nextMatch || lastMatch;
                const isCompleted = match.status === 'completed';
                const isHome = match.homeTeam?.trim().toLowerCase() === teamName.trim().toLowerCase();
                const isAway = match.awayTeam?.trim().toLowerCase() === teamName.trim().toLowerCase();

                return (
                  <div className="bg-[#111722] rounded-xl p-5 border border-white/[0.06]">
                    <div className="text-center mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isCompleted ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                      }`}>
                        {isCompleted ? 'Finalizado' : 'Próximo Partido'}
                      </span>
                      {match.date && (
                        <span className="text-xs text-slate-400 ml-2 font-medium">
                          {match.date}
                        </span>
                      )}
                    </div>

                    {/* Duelo de Equipos */}
                    <div className="grid grid-cols-7 items-center gap-2 py-3">
                      {/* Local */}
                      <div className="col-span-3 flex flex-col items-center text-center">
                        <div className={`w-14 h-14 rounded-xl p-2 bg-black/40 border flex items-center justify-center mb-2 shadow-md ${
                          isHome ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/20' : 'border-white/10'
                        }`}>
                          <img
                            src={getLogo(match.homeTeam)}
                            alt={match.homeTeam}
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                          />
                        </div>
                        <span className={`text-sm font-bold truncate max-w-[140px] ${isHome ? 'text-[#00b4d8]' : 'text-white'}`}>
                          {match.homeTeam || 'Local'}
                        </span>
                        {isHome && (
                          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            (Tu Equipo)
                          </span>
                        )}
                      </div>

                      {/* Marcador o VS */}
                      <div className="col-span-1 flex flex-col items-center justify-center">
                        {isCompleted ? (
                          <div className="flex items-center gap-2 text-2xl sm:text-3xl font-black text-white tabular-nums">
                            <span>{match.homeScore ?? 0}</span>
                            <span className="text-slate-500 text-lg">-</span>
                            <span>{match.awayScore ?? 0}</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs font-black text-slate-400">
                            VS
                          </div>
                        )}
                      </div>

                      {/* Visitante */}
                      <div className="col-span-3 flex flex-col items-center text-center">
                        <div className={`w-14 h-14 rounded-xl p-2 bg-black/40 border flex items-center justify-center mb-2 shadow-md ${
                          isAway ? 'border-[#00b4d8] ring-2 ring-[#00b4d8]/20' : 'border-white/10'
                        }`}>
                          <img
                            src={getLogo(match.awayTeam)}
                            alt={match.awayTeam}
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                          />
                        </div>
                        <span className={`text-sm font-bold truncate max-w-[140px] ${isAway ? 'text-[#00b4d8]' : 'text-white'}`}>
                          {match.awayTeam || 'Visitante'}
                        </span>
                        {isAway && (
                          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            (Tu Equipo)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-8 text-center bg-[#111722] rounded-xl border border-white/[0.04] text-slate-400 text-sm">
                No hay partidos programados actualmente en el fixture.
              </div>
            )}
          </div>

          {/* TABLA DE POSICIONES REDUCIDA ESTILO SOFASCORE */}
          <div className="rounded-2xl bg-[#0c1017] border border-white/[0.08] p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Clasificación de la Liga
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Top 6
              </span>
            </div>

            {leagueTable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[340px]">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] pb-2">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-3">Club</th>
                      <th className="py-2 px-2 text-center w-10">PJ</th>
                      <th className="py-2 px-2 text-center w-10">DG</th>
                      <th className="py-2 px-3 text-right w-12 text-white font-extrabold">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03] text-xs">
                    {leagueTable.slice(0, 6).map((team, idx) => {
                      const isUser = team.name?.trim().toLowerCase() === teamName.trim().toLowerCase();
                      const isTop4 = idx < 4;
                      const borderClass = isTop4 ? 'border-l-[3px] border-emerald-500' : 'border-l-[3px] border-transparent';
                      const bgClass = isUser ? 'bg-[#00b4d8]/10' : 'hover:bg-white/[0.03]';

                      return (
                        <tr key={team.id || idx} className={`${borderClass} ${bgClass} transition-colors h-10`}>
                          <td className={`text-center font-mono font-bold tabular-nums ${isTop4 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {idx + 1}
                          </td>
                          <td className="px-3 py-1.5 flex items-center gap-2.5">
                            <img
                              src={getLogo(team.name)}
                              alt=""
                              className="w-5 h-5 object-contain shrink-0"
                              onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                            />
                            <span className={`font-semibold truncate max-w-[180px] ${isUser ? 'text-[#00b4d8] font-bold' : 'text-slate-200'}`}>
                              {team.name}
                            </span>
                            {isUser && (
                              <span className="text-[9px] font-extrabold px-1 py-0.2 rounded bg-[#00b4d8]/20 text-[#00b4d8]">
                                TÚ
                              </span>
                            )}
                          </td>
                          <td className="px-2 text-center text-slate-400 tabular-nums">{team.pj}</td>
                          <td className="px-2 text-center text-slate-400 tabular-nums">
                            {(Number(team.gf) || 0) - (Number(team.gc) || 0)}
                          </td>
                          <td className="px-3 text-right font-black text-white tabular-nums">
                            {team.pts}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Aún no hay posiciones registradas para el torneo.
              </div>
            )}
          </div>

        </div>

        {/* COLUMNA 3: JUGADORES CLAVE & ACCIONES RÁPIDAS */}
        <div className="space-y-6">

          {/* FIGURAS DEL EQUIPO */}
          <div className="rounded-2xl bg-[#0c1017] border border-white/[0.08] p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Figuras del Plantel
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('My Team')}
                className="text-xs text-[#00b4d8] hover:text-[#38bdf8] font-semibold transition cursor-pointer"
              >
                Ver táctica →
              </button>
            </div>

            {topPlayers.length > 0 ? (
              <div className="space-y-2.5">
                {topPlayers.map((player) => {
                  const ovrColor = getStatAndOvrColorClass(player.OVR_CALCULADO);

                  return (
                    <div
                      key={player.Id}
                      onClick={() => onPlayerClick?.(player.Id)}
                      className="group flex items-center justify-between p-2.5 rounded-xl bg-[#111722] border border-white/[0.05] hover:border-white/[0.15] cursor-pointer transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={`/fotos_jugadores/${player.Id}.webp`}
                            alt={player.Name}
                            className="w-10 h-10 object-cover rounded-lg bg-black/40"
                            onError={(e) => {
                              e.target.src = `https://placehold.co/40x40/111/444?text=${player.Name.substring(0, 1)}`;
                            }}
                          />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full font-black text-[9px] !text-black shadow ${ovrColor}`}>
                            {player.OVR_CALCULADO}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#00b4d8] transition-colors">
                            {player.Name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="font-bold text-slate-300">{player.POS_NOMBRE}</span>
                            <span>•</span>
                            <span>{player.Age} años</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-bold text-emerald-400 text-xs tabular-nums">
                        {formatPriceShort(player.Precio)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                Aún no tienes jugadores fichados.{' '}
                <button
                  onClick={() => setActiveTab('Marketplace')}
                  className="text-[#00b4d8] font-bold hover:underline block mx-auto mt-2"
                >
                  Explorar Mercado
                </button>
              </div>
            )}
          </div>

          {/* ACCESOS DIRECTOS */}
          <div className="rounded-2xl bg-[#0c1017] border border-white/[0.08] p-5 shadow-lg space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-white/[0.06]">
              Accesos Rápidos
            </h2>

            <button
              onClick={() => setActiveTab('Marketplace')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-[#00b4d8]/15 to-transparent border border-[#00b4d8]/30 hover:border-[#00b4d8]/60 text-white font-bold text-sm transition group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-[#00b4d8]" />
                <span>Mercado de Fichajes</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => setActiveTab('My Team')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#111722] border border-white/[0.06] hover:border-white/[0.15] text-white font-semibold text-sm transition group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Armar Formación 11</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              onClick={() => setActiveTab('Financials')}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#111722] border border-white/[0.06] hover:border-white/[0.15] text-white font-semibold text-sm transition group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Finanzas y Ofertas</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
});
