import React, { useState, useMemo, memo } from 'react';
import { X, Search, Users, ExternalLink, ArrowUpDown, ChevronDown, ChevronsUpDown, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BaseModal } from './ui/BaseModal.jsx';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getFlagUrl, getStatAndOvrColorClass, getPosColorClass } from '../utils/helpers.js';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Stat } from './ui/Stat.jsx';
import { EmptyState } from './ui/EmptyState.jsx';

const POS_GROUPS = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'DEF', label: 'DEF' },
  { id: 'MED', label: 'MED' },
  { id: 'DEL', label: 'DEL' },
  { id: 'PT', label: 'PT' },
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
  { id: 'DEF', label: 'Defensores' },
  { id: 'MED', label: 'Mediocampistas' },
  { id: 'DEL', label: 'Delanteros' },
  { id: 'PT', label: 'Arqueros' },
];

export const TeamsModal = memo(function TeamsModal({
  isPage,
  isVisible,
  onClose,
  allTeams,
  currentUserId,
  isLoading = false,
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

  // Filtrado y ordenamiento de equipos. La lista son los rivales: el club propio queda fuera
  // (los totales de la liga, más abajo, sí lo cuentan).
  const filteredAndSortedTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = currentUserId ? teamStats.filter(team => team.userId !== currentUserId) : teamStats;

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
  }, [teamStats, currentUserId, searchQuery, selectedPosGroup, sortOption]);

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

  const SECTION_DOT = { DEF: 'pos-defensa', MED: 'pos-medio', DEL: 'pos-delantero', PT: 'pos-portero' };
  const filtersActive = Boolean(searchQuery) || selectedPosGroup !== 'TODOS';

  const toolbar = (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative flex-1 min-w-0 lg:max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" aria-hidden="true" />
        <input type="text" placeholder="Buscar por club o jugador…" aria-label="Buscar por club o jugador" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} className="input pl-10 pr-10" />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/10">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <Tabs label="Filtrar por línea" value={selectedPosGroup} onChange={setSelectedPosGroup} className="self-start"
        tabs={POS_GROUPS.map(p => ({ id: p.id, label: p.label }))} />
      <div className="flex items-center gap-2 lg:ml-auto">
        <div className="relative flex-1 sm:flex-none">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none z-[1]" aria-hidden="true" />
          <select value={sortOption} onChange={(e) => setSortOption(e.target.value)} aria-label="Ordenar clubes" className="select pl-9 sm:w-56">
            <option value="spent-desc">Gasto: mayor a menor</option>
            <option value="spent-asc">Gasto: menor a mayor</option>
            <option value="ovr-desc">Media: mayor a menor</option>
            <option value="players-desc">Plantel: más jugadores</option>
            <option value="name-asc">Nombre (A–Z)</option>
          </select>
        </div>
        <button type="button" onClick={toggleAllCollapse} className="btn btn-secondary shrink-0" aria-label={isAllExpanded ? 'Plegar todos los clubes' : 'Desplegar todos los clubes'}>
          <ChevronsUpDown className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">{isAllExpanded ? 'Plegar todo' : 'Desplegar todo'}</span>
        </button>
      </div>
    </div>
  );

  const list = isLoading ? (
    <ul className="space-y-3" role="status" aria-label="Cargando los clubes">
      {Array.from({ length: 5 }, (_, i) => <li key={i} className="skeleton h-[72px] rounded-2xl" />)}
    </ul>
  ) : filteredAndSortedTeams.length === 0 ? (
    filtersActive ? (
      <EmptyState icon={Users} title="No se encontraron clubes" description="Probá con otra búsqueda o quitá el filtro de línea."
        actionLabel="Restablecer filtros" onAction={() => { setSearchQuery(''); setSelectedPosGroup('TODOS'); }} />
    ) : (
      <EmptyState icon={Users} title="Todavía no hay otros clubes" description="Cuando los demás managers armen su club, sus planteles van a aparecer acá." />
    )
  ) : (
    <ul className="space-y-3">
      {filteredAndSortedTeams.map(team => {
        const isCollapsed = !expandedTeamIds.has(team.userId);
        const displayedPlayers = selectedPosGroup === 'TODOS'
          ? team.players
          : team.players.filter(p => (POS_GROUP_MAP[selectedPosGroup] || []).includes(p.POS_NOMBRE));
        const panelId = `rival-${team.userId}`;

        return (
          <li key={team.userId} className="panel-flat overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3">
              <button type="button" aria-expanded={!isCollapsed} aria-controls={panelId}
                aria-label={`${isCollapsed ? 'Desplegar' : 'Plegar'} el plantel de ${team.teamName}`}
                onClick={() => toggleTeamCollapse(team.userId)}
                className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-left min-h-12 rounded-lg">
                <img src={team.logoUrl || DEFAULT_LOGO} alt="" width={40} height={40} className="w-10 h-10 object-contain shrink-0"
                  onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-bold text-ink truncate leading-tight">{team.teamName}</span>
                  <span className="block text-xs text-ink-3 mt-0.5">
                    <span className="num">{selectedPosGroup === 'TODOS' ? team.players.length : `${displayedPlayers.length}/${team.players.length}`}</span> jugadores
                    <span className="sm:hidden"> · <span className="num">{formatPriceShort(team.totalCost)}</span></span>
                  </span>
                </span>
                <span className="hidden sm:block text-right shrink-0">
                  <span className="block eyebrow">Invertido</span>
                  <span className="block font-display num text-lg font-bold text-ink leading-tight">{formatPriceShort(team.totalCost)}</span>
                </span>
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 ${team.avgOvr ? getStatAndOvrColorClass(team.avgOvr) : 'bg-raised text-ink-3'}`}
                  title="Media del plantel">{team.avgOvr || '—'}</span>
                <ChevronDown className={`w-5 h-5 text-ink-3 shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => navigate(`/team/${team.userId}`)} className="btn btn-ghost btn-icon shrink-0"
                aria-label={`Ver el perfil de ${team.teamName}`} title="Ver perfil del club">
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {!isCollapsed && (
              <div id={panelId} className="border-t border-line/[0.08] px-3 sm:px-5 py-4 space-y-5 animate-in fade-in">
                {team.players.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink-3">Este club todavía no fichó jugadores.</p>
                ) : displayedPlayers.length === 0 ? (
                  <p className="py-4 text-center text-sm text-ink-3">No tiene jugadores en la línea elegida.</p>
                ) : (
                  TACTICAL_SECTIONS.map(sec => {
                    const secPlayers = displayedPlayers.filter(p => getPosCategory(p.POS_NOMBRE) === sec.id);
                    if (secPlayers.length === 0) return null;
                    const secTotalValue = secPlayers.reduce((sum, p) => sum + (Number(p.Precio) || 0), 0);
                    const secAvgOvr = Math.round(secPlayers.reduce((sum, p) => sum + (Number(p.OVR_CALCULADO) || 0), 0) / secPlayers.length);

                    return (
                      <section key={sec.id} aria-label={sec.label}>
                        <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-line/[0.07]">
                          <h4 className="eyebrow flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${SECTION_DOT[sec.id]}`} aria-hidden="true" />{sec.label} <span className="num text-ink-3">{secPlayers.length}</span>
                          </h4>
                          <p className="text-xs text-ink-3">
                            Media <span className="num font-semibold text-ink-2">{secAvgOvr}</span>
                            <span className="hidden sm:inline"> · Valor <span className="num font-semibold text-ink-2">{formatPriceShort(secTotalValue)}</span></span>
                          </p>
                        </div>
                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4">
                          {secPlayers.map(player => {
                            const ovr = player.OVR_CALCULADO || 0;
                            const isTopStar = team.players.length > 1 && player.Id === team.topPlayerId;
                            return (
                              <li key={player.Id}>
                                <button type="button" onClick={() => onPlayerClick && onPlayerClick(player)} title={`Ver ficha de ${player.Name}`}
                                  className="group w-full flex items-center gap-3 py-2 min-h-14 text-left rounded-lg -mx-2 px-2 hover:bg-white/[0.03] transition-colors">
                                  <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" width={40} height={40} loading="lazy"
                                    className="w-10 h-10 rounded-lg object-cover object-top bg-raised shrink-0"
                                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-sm font-semibold text-ink group-hover:text-accent-soft transition-colors truncate">{player.Name}</span>
                                      {isTopStar && <Star className="w-3.5 h-3.5 shrink-0 fill-current text-warning-soft" aria-label="Figura del plantel" />}
                                    </span>
                                    <span className="flex items-center gap-2 mt-0.5 text-xs text-ink-3">
                                      <span className={`px-1.5 rounded text-[10px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
                                      <img src={getFlagUrl(player.Country1)} className="w-4 h-3 rounded-[2px] shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} alt="" />
                                      {player.Age ? <span>{player.Age} años</span> : null}
                                      <span className="num">{formatPriceShort(player.Precio)}</span>
                                    </span>
                                  </span>
                                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 ${getStatAndOvrColorClass(ovr)}`}>{ovr}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const summary = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-y border-line/[0.08] py-4">
      <Stat label="Clubes de la liga" value={isLoading ? '—' : leagueSummary.totalTeams} size="sm" />
      <Stat label="Jugadores fichados" value={isLoading ? '—' : leagueSummary.totalSignedPlayers} size="sm" />
      <Stat label="Gasto de la liga" value={isLoading ? '—' : formatPriceShort(leagueSummary.totalSpent)} size="sm" />
      <Stat label="Media de la liga" value={(!isLoading && leagueSummary.leagueAvgOvr) || '—'} size="sm" tone="accent" />
    </div>
  );

  if (isPage) {
    return (
      <Page className="pb-16">
        <PageHeader eyebrow="Mercado" title={title} description={subtitle} />
        {summary}
        {toolbar}
        {list}
      </Page>
    );
  }

  return (
    <BaseModal isOpen={isVisible} onClose={onClose} size="2xl" title={title} subtitle={subtitle} icon={Users}
      className="h-[100dvh] sm:h-[90vh] !max-w-7xl" contentClassName="p-4 sm:p-6 space-y-5">
      {summary}
      {toolbar}
      {list}
    </BaseModal>
  );
});
