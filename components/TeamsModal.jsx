import React, { useState, useMemo, memo } from 'react';
import { X, Search, Users, ExternalLink, ArrowUpDown, DollarSign, Award, Shield, ChevronDown, ChevronsUpDown, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl, getStatAndOvrColorClass } from '../utils/helpers.js';

/* ── Posiciones con paleta unificada del mercado ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308',
};

/* ── Grupos de posiciones tácticas para filtro rápido en orden táctico ── */
const POS_GROUPS = [
  { id: 'TODOS', label: 'Todos', color: '#94a3b8' },
  { id: 'DEF', label: 'DEF', color: '#3b82f6' },
  { id: 'MED', label: 'MED', color: '#22c55e' },
  { id: 'DEL', label: 'DEL', color: '#ef4444' },
  { id: 'PT', label: 'PT', color: '#eab308' },
];

const POS_GROUP_MAP = {
  DEF: ['DFC', 'LI', 'LD', 'CB', 'LB', 'RB', 'CAD', 'CAI'],
  MED: ['MC', 'MCD', 'MO', 'MI', 'MD', 'CM', 'CDM', 'CAM', 'LM', 'RM', 'MVI', 'MVD'],
  DEL: ['DC', 'SD', 'EI', 'ED', 'ST', 'CF', 'LW', 'RW', 'SP'],
  PT: ['PT', 'PO', 'GK'],
};

function getPosCategory(pos) {
  const p = String(pos || '').toUpperCase();
  if (['DFC', 'LI', 'LD', 'CB', 'LB', 'RB', 'CAD', 'CAI'].includes(p)) return 'DEF';
  if (['MC', 'MCD', 'MO', 'MI', 'MD', 'CM', 'CDM', 'CAM', 'LM', 'RM', 'MVI', 'MVD'].includes(p)) return 'MED';
  if (['DC', 'SD', 'EI', 'ED', 'ST', 'CF', 'LW', 'RW', 'SP'].includes(p)) return 'DEL';
  if (['PT', 'PO', 'GK'].includes(p)) return 'PT';
  return 'DEF';
}

const POS_ORDER_WEIGHT = {
  DEF: 1,
  MED: 2,
  DEL: 3,
  PT: 4,
};

const TACTICAL_SECTIONS = [
  { id: 'DEF', label: 'Defensores', color: '#3b82f6' },
  { id: 'MED', label: 'Mediocampistas', color: '#22c55e' },
  { id: 'DEL', label: 'Delanteros', color: '#ef4444' },
  { id: 'PT', label: 'Arqueros', color: '#eab308' },
];

/* ── Umbrales dinámicos de color OVR consistentes con el mercado ── */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#94a3b8';

function getOvrColor(ovr) {
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (ovr >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

export const TeamsModal = memo(function TeamsModal({
  isPage,
  isVisible,
  onClose,
  allTeams,
  playerLocks,
  allPlayers,
  countryMap,
  onPlayerClick,
  title = 'Otros Equipos',
  subtitle = 'Monitor de planteles rivales y mercado de la liga'
}) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('spent-desc');
  const [selectedPosGroup, setSelectedPosGroup] = useState('TODOS');
  const [expandedTeamIds, setExpandedTeamIds] = useState(new Set());

  // 1. O(1) player lookup Map (optimización crítica: reemplaza O(L * N) .find por mapa hash directo)
  const playerMap = useMemo(() => {
    const map = new Map();
    (allPlayers || []).forEach(p => {
      if (p && p.Id != null) {
        map.set(String(p.Id), p);
      }
    });
    return map;
  }, [allPlayers]);

  const playersByTeam = useMemo(() => {
    const teams = {};
    Object.values(allTeams || {}).forEach(team => {
      teams[team.userId] = { ...team, players: [] };
    });
    Object.entries(playerLocks || {}).forEach(([playerId, lockData]) => {
      const player = playerMap.get(String(playerId));
      if (player && teams[lockData.lockedBy]) {
        teams[lockData.lockedBy].players.push(player);
      }
    });
    return Object.values(teams);
  }, [allTeams, playerLocks, playerMap]);

  const teamStats = useMemo(() => {
    return playersByTeam.map(team => {
      const totalCost = team.players.reduce((sum, p) => sum + (Number(p.Precio) || 0), 0);
      const avgOvr = team.players.length > 0
        ? Math.round(team.players.reduce((sum, p) => sum + (Number(p.OVR_CALCULADO) || 0), 0) / team.players.length)
        : 0;
      // Orden jerárquico solicitado: Defensores -> Mediocampistas -> Delanteros -> Arqueros, y sub-orden por OVR desc
      const sortedPlayers = [...team.players].sort((a, b) => {
        const catA = getPosCategory(a.POS_NOMBRE);
        const catB = getPosCategory(b.POS_NOMBRE);
        const weightA = POS_ORDER_WEIGHT[catA] || 99;
        const weightB = POS_ORDER_WEIGHT[catB] || 99;
        if (weightA !== weightB) return weightA - weightB;
        return (Number(b.OVR_CALCULADO) || 0) - (Number(a.OVR_CALCULADO) || 0);
      });
      const topPlayerId = [...team.players].sort((a, b) => (Number(b.OVR_CALCULADO) || 0) - (Number(a.OVR_CALCULADO) || 0))[0]?.Id;
      return { ...team, players: sortedPlayers, totalCost, avgOvr, topPlayerId };
    });
  }, [playersByTeam]);

  // Filtrado y ordenamiento de equipos
  const filteredAndSortedTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = teamStats;

    if (query) {
      result = result.filter(team => {
        const matchesTeamName = team.teamName?.toLowerCase().includes(query);
        const matchesPlayer = team.players.some(p => p.Name?.toLowerCase().includes(query));
        return matchesTeamName || matchesPlayer;
      });
    }

    if (selectedPosGroup !== 'TODOS') {
      const allowed = POS_GROUP_MAP[selectedPosGroup] || [];
      result = result.filter(team => team.players.some(p => allowed.includes(p.POS_NOMBRE)));
    }

    return [...result].sort((a, b) => {
      if (sortOption === 'spent-desc') return b.totalCost - a.totalCost;
      if (sortOption === 'spent-asc') return a.totalCost - b.totalCost;
      if (sortOption === 'ovr-desc') return b.avgOvr - a.avgOvr;
      if (sortOption === 'players-desc') return b.players.length - a.players.length;
      return (a.teamName || '').localeCompare(b.teamName || '');
    });
  }, [teamStats, searchQuery, selectedPosGroup, sortOption]);

  // Handlers para colapsar/expandir acordeón
  const toggleTeamCollapse = (teamId) => {
    setExpandedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const isAllExpanded = filteredAndSortedTeams.length > 0 && expandedTeamIds.size >= filteredAndSortedTeams.length;

  const toggleAllCollapse = () => {
    if (isAllExpanded) {
      setExpandedTeamIds(new Set());
    } else {
      setExpandedTeamIds(new Set(filteredAndSortedTeams.map(t => t.userId)));
    }
  };

  // Totales globales para KPIs superiores
  const leagueSummary = useMemo(() => {
    const totalTeams = teamStats.length;
    const totalSignedPlayers = teamStats.reduce((acc, t) => acc + t.players.length, 0);
    const totalSpent = teamStats.reduce((acc, t) => acc + t.totalCost, 0);
    const leagueAvgOvr = totalSignedPlayers > 0
      ? Math.round(teamStats.reduce((acc, t) => acc + (t.avgOvr * t.players.length), 0) / totalSignedPlayers)
      : 0;
    return { totalTeams, totalSignedPlayers, totalSpent, leagueAvgOvr };
  }, [teamStats]);

  if (!isVisible && !isPage) return null;

  const inner = (
    <div
      className={isPage
        ? "w-full h-full min-h-0 flex flex-col bg-[#06080d] text-slate-200"
        : "bg-[#0c1017] border border-white/[0.08] sm:rounded-2xl shadow-2xl w-full max-w-7xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 text-slate-200"}
      onClick={e => e.stopPropagation()}
    >
      {/* ── HEADER SUPERIOR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 shrink-0 bg-[#0c1017] border-b border-white/[0.08]">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#00b4d8]" /> {title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {!isPage && (
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── CONTENEDOR CON SCROLL (Toolbar incluida en el scroll para mobile) ── */}
      <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar">
        {/* ── BARRA DE HERRAMIENTAS & FILTROS TIPO MERCADO ── */}
        <div className="px-4 sm:px-6 py-3 bg-[#0c1017] border-b border-white/[0.08] flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 sm:sticky sm:top-0 sm:z-10">
          {/* Input de Búsqueda y Filtros de Posición */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
            {/* Input de Búsqueda */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por equipo o jugador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 pl-10 pr-4 py-2.5 bg-[#111722] text-white rounded-xl text-sm outline-none border border-white/[0.08] focus:border-cyan-500 placeholder:text-slate-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Filtro Táctico por Posición - Swipeable en mobile */}
            <div className="w-full sm:w-auto flex items-center gap-1 bg-[#111722] p-1 rounded-xl border border-white/[0.08] overflow-x-auto no-scrollbar shrink-0">
              {POS_GROUPS.map(pos => {
                const isActive = selectedPosGroup === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setSelectedPosGroup(pos.id)}
                    className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs font-black rounded-lg transition-all cursor-pointer select-none whitespace-nowrap min-h-[38px] flex items-center justify-center ${
                      isActive
                        ? 'bg-white/10 text-white shadow-sm border border-white/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={isActive && pos.id !== 'TODOS' ? { color: pos.color } : {}}
                  >
                    {pos.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de Orden, Toggle Acordeón y Resumen */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botón de Expandir / Colapsar Todo */}
            <button
              type="button"
              onClick={toggleAllCollapse}
              className="min-h-11 px-3 py-2 bg-[#111722] text-slate-300 hover:text-white rounded-xl text-xs sm:text-sm font-semibold border border-white/[0.08] hover:border-white/[0.16] flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
              title={isAllExpanded ? 'Colapsar todos los equipos' : 'Expandir todos los equipos'}
            >
              <ChevronsUpDown className="w-4 h-4 text-slate-400" />
              <span>{isAllExpanded ? 'Colapsar todo' : 'Expandir todo'}</span>
            </button>

            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="appearance-none min-h-11 pl-9 pr-8 py-2.5 bg-[#111722] text-slate-200 rounded-xl text-xs sm:text-sm font-semibold border border-white/[0.08] focus:border-cyan-500 outline-none cursor-pointer"
              >
                <option value="spent-desc">Gasto (Mayor a Menor)</option>
                <option value="spent-asc">Gasto (Menor a Mayor)</option>
                <option value="ovr-desc">Media OVR (Mayor a Menor)</option>
                <option value="players-desc">Plantilla (Mayor a Menor)</option>
                <option value="name-asc">Nombre de Equipo (A-Z)</option>
              </select>
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Quick Metrics Pills (Conservados compactos) */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="px-3 py-2 bg-[#111722] border border-white/[0.08] rounded-xl flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#00b4d8]" />
                <strong className="text-white">{filteredAndSortedTeams.length}</strong> Equipos
              </span>
              <span className="px-3 py-2 bg-[#111722] border border-white/[0.08] rounded-xl flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Gasto total: <strong className="text-emerald-400">{formatPriceShort(leagueSummary.totalSpent)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ── LISTADO DE EQUIPOS (ACORDEÓN) ── */}
        <div className="px-4 sm:px-6 py-4 space-y-4 pb-20">
        {filteredAndSortedTeams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1017] p-12 text-center flex flex-col items-center justify-center">
            <Users className="w-12 h-12 mb-3 text-slate-600" />
            <p className="text-base font-bold text-slate-300">No se encontraron equipos</p>
            <p className="text-xs text-slate-500 mt-1">Prueba con otro término de búsqueda o limpia el filtro de posición.</p>
            {(searchQuery || selectedPosGroup !== 'TODOS') && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedPosGroup('TODOS'); }}
                className="mt-4 px-4 py-2 bg-[#111722] hover:bg-[#161f2e] border border-white/10 rounded-xl text-xs font-bold text-[#00b4d8] transition cursor-pointer"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        ) : (
          filteredAndSortedTeams.map(team => {
            const isCollapsed = !expandedTeamIds.has(team.userId);
            const displayedPlayers = selectedPosGroup === 'TODOS'
              ? team.players
              : team.players.filter(p => (POS_GROUP_MAP[selectedPosGroup] || []).includes(p.POS_NOMBRE));

            return (
              <div
                key={team.userId}
                className="rounded-2xl overflow-hidden bg-[#0c1017] border border-white/[0.08] hover:border-white/[0.16] transition-all shadow-md"
              >
                {/* Team header bar (clickable para acordeón) */}
                <div
                  onClick={() => toggleTeamCollapse(team.userId)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-[#111722]/90 hover:bg-[#131b28] border-b border-white/[0.06] cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#090d16] border border-white/10 p-1.5 flex items-center justify-center shrink-0">
                      <img
                        src={team.logoUrl || DEFAULT_LOGO}
                        alt={`Escudo de ${team.teamName}`}
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                          {team.teamName}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/team/${team.userId}`); }}
                          className="text-xs font-bold bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white border border-white/[0.08] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                          title="Ver Perfil Oficial del Equipo"
                        >
                          Perfil <ExternalLink size={12} />
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">ID: {team.userId?.substring(0, 8)}</span>
                    </div>
                  </div>

                  {/* Métricas del Equipo y Chevron */}
                  <div className="flex items-center gap-3 sm:gap-5 justify-between sm:justify-end shrink-0">
                    <div className="flex items-center gap-3 sm:gap-5 bg-[#090d16]/80 px-4 py-2 rounded-xl border border-white/[0.06]">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Inversión</p>
                        <p className="text-sm font-black text-emerald-400 font-mono tabular-nums">{formatPriceShort(team.totalCost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Media OVR</p>
                        <p
                          className="text-sm font-black font-mono px-2 py-0.5 rounded-md inline-block tabular-nums"
                          style={{ color: getOvrColor(team.avgOvr), backgroundColor: 'rgba(255,255,255,0.06)' }}
                        >
                          {team.avgOvr || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Plantilla</p>
                        <p className="text-sm font-black text-slate-200 font-mono">
                          {selectedPosGroup === 'TODOS' ? `${team.players.length} jug.` : `${displayedPlayers.length} / ${team.players.length}`}
                        </p>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-white/[0.04] text-slate-400 hover:text-white transition">
                      <ChevronDown
                        className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180 text-cyan-400'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Contenido Desplegable de Jugadores */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-5 space-y-5 bg-[#090d15]/60">
                    {team.players.length === 0 ? (
                      <div className="py-8 text-center bg-[#111722]/30 rounded-xl border border-dashed border-white/[0.06]">
                        <p className="text-xs text-slate-400 font-medium">Este equipo aún no ha fichado jugadores en el mercado.</p>
                      </div>
                    ) : displayedPlayers.length === 0 ? (
                      <div className="py-8 text-center bg-[#111722]/30 rounded-xl border border-dashed border-white/[0.06]">
                        <p className="text-xs text-slate-400 font-medium">
                          No hay jugadores registrados en la demarcación seleccionada ({selectedPosGroup}).
                        </p>
                      </div>
                    ) : (
                      TACTICAL_SECTIONS.map(sec => {
                        const secPlayers = displayedPlayers.filter(p => getPosCategory(p.POS_NOMBRE) === sec.id);
                        if (secPlayers.length === 0) return null;

                        const secTotalValue = secPlayers.reduce((sum, p) => sum + (Number(p.Precio) || 0), 0);
                        const secAvgOvr = Math.round(secPlayers.reduce((sum, p) => sum + (Number(p.OVR_CALCULADO) || 0), 0) / secPlayers.length);

                        return (
                          <div key={sec.id} className="space-y-2.5">
                            {/* Cabecera de Demarcación Táctica Profesional */}
                            <div className="flex items-center justify-between px-1 py-1 border-b border-white/[0.06]">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                  {sec.label}
                                </h4>
                                <span className="text-xs font-mono font-bold text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                                  {secPlayers.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                                <span>Media: <strong className="text-white">{secAvgOvr}</strong></span>
                                <span className="hidden sm:inline">Valor: <strong className="text-emerald-400">{formatPriceShort(secTotalValue)}</strong></span>
                              </div>
                            </div>

                            {/* Roster Sheet de Jugadores (Sin rebotes IA, diseño fútbol profesional Transfermarkt/SofaScore) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                              {secPlayers.map(player => {
                                const posColor = POS_COLOR[player.POS_NOMBRE] || '#94a3b8';
                                const ovr = player.OVR_CALCULADO || 0;
                                const isTopStar = team.players.length > 1 && player.Id === team.topPlayerId;
                                const ovrColorClass = getStatAndOvrColorClass(ovr);

                                return (
                                  <div
                                    key={player.Id}
                                    onClick={() => onPlayerClick && onPlayerClick(player)}
                                    className="flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-[#111722]/80 hover:bg-[#162030] border border-white/[0.06] hover:border-white/[0.14] transition-colors cursor-pointer group shadow-xs"
                                    title={`Ver ficha técnica de ${player.Name}`}
                                  >
                                    {/* Izquierda: Foto y Datos */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className="relative shrink-0">
                                        <img
                                          src={`/fotos_jugadores/${player.Id}.webp`}
                                          alt={player.Name}
                                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover bg-black/60 border border-white/10"
                                          onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = `https://placehold.co/44x44/111/444?text=${player.Name?.[0] || '?'}`;
                                          }}
                                        />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                                            {player.Name}
                                          </p>
                                          {isTopStar && (
                                            <span
                                              className="text-[10px] font-black text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 flex items-center gap-1 shrink-0"
                                              title="Jugador estrella del plantel"
                                            >
                                              <Star size={10} className="fill-amber-300 text-amber-300" />
                                              <span className="hidden sm:inline">Figura</span>
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-1">
                                          <span
                                            className="text-[10px] font-black text-slate-950 px-1.5 py-0.5 rounded font-mono"
                                            style={{ backgroundColor: posColor }}
                                          >
                                            {player.POS_NOMBRE}
                                          </span>
                                          <img
                                            src={getFlagUrl(player.Country1)}
                                            className="w-4 h-3 rounded-[2px] opacity-85 shrink-0"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                            alt=""
                                          />
                                          {player.Age && (
                                            <span className="text-xs text-slate-400 font-mono">
                                              {player.Age}a
                                            </span>
                                          )}
                                          {player.Foot && (
                                            <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                                              • {player.Foot}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Derecha: Precio y Píldora OVR */}
                                    <div className="flex items-center gap-2.5 shrink-0">
                                      <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono tabular-nums">
                                        {formatPriceShort(player.Precio)}
                                      </span>
                                      <span className={`stat-value ${ovrColorClass} w-8 h-8 sm:w-9 sm:h-9 rounded-lg font-mono font-black text-xs sm:text-sm flex items-center justify-center tabular-nums shadow-sm border border-black/25 !text-black`}>
                                        {ovr}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );

  if (isPage) return inner;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onClose}
    >
      {inner}
    </div>
  );
});
