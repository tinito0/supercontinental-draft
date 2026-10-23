import React, { memo, useMemo } from 'react';
import { ArrowRight, Users, ShoppingBag, CalendarDays, Trophy } from 'lucide-react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { formatPriceShort, getStatAndOvrColorClass, getPosColorClass } from '../utils/helpers.js';
import { Page } from './ui/Page.jsx';
import { PageHeader, SectionHeader } from './ui/PageHeader.jsx';
import { Stat } from './ui/Stat.jsx';
import { Button } from './ui/Button.jsx';
import { EmptyState } from './ui/EmptyState.jsx';
import { GOLD_CUP_PLACES, LEAGUE_POINTS, LEAGUE_SIZE, teamMatchResult } from '../utils/competitionRules.js';

const sameName = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const goalDiff = t => (Number(t.gf) || 0) - (Number(t.gc) || 0);
const RESULT = {
  V: { label: 'Victoria', className: 'bg-success text-canvas' },
  P: { label: 'Definido por penales', className: 'bg-warning text-canvas' },
  E: { label: 'Empate sin tanda cargada', className: 'bg-raised text-ink-2' },
  D: { label: 'Derrota', className: 'bg-danger text-ink' },
};
const FORM_CHAR = { win: 'V', shootoutWin: 'P', shootoutLoss: 'P', loss: 'D', draw: 'E' };

function Crest({ src, name, className = '' }) {
  return (
    <img src={src || DEFAULT_LOGO} alt={name ? `Escudo de ${name}` : ''} width={40} height={40} loading="lazy"
      className={`object-contain ${className}`} onError={e => { e.currentTarget.src = DEFAULT_LOGO; }} />
  );
}

/** Next (or last) match of the user's club, scoreboard style. */
function MatchFocus({ match, teamName, getLogo }) {
  const completed = match.status === 'completed';
  const side = (name, fallback) => {
    const mine = sameName(name, teamName);
    return (
      <div className="flex flex-col items-center text-center gap-2 min-w-0">
        <Crest src={getLogo(name)} name={name} className={`w-14 h-14 sm:w-16 sm:h-16 ${mine ? '' : 'opacity-90'}`} />
        <span className={`text-sm font-semibold truncate max-w-full ${mine ? 'text-accent-soft' : 'text-ink'}`}>{name || fallback}</span>
        {mine && <span className="text-[11px] text-ink-3 -mt-1.5">Tu club</span>}
      </div>
    );
  };
  return (
    <div>
      <p className="text-center text-xs text-ink-3">
        <span className={completed ? 'text-ink-2' : 'text-accent-soft font-semibold'}>{completed ? 'Finalizado' : 'Próximo partido'}</span>
        {match.round && ` · ${match.round}`}{match.date && ` · ${match.date}`}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 mt-4">
        {side(match.homeTeam, 'Local')}
        {completed ? (
          <p className="font-display num text-4xl sm:text-5xl font-bold text-ink leading-none whitespace-nowrap" aria-label={`Resultado ${match.homeScore ?? 0} a ${match.awayScore ?? 0}`}>
            {match.homeScore ?? 0}<span className="text-ink-3 mx-2">–</span>{match.awayScore ?? 0}
          </p>
        ) : (
          <p className="font-display text-2xl font-bold text-ink-3">VS</p>
        )}
        {side(match.awayTeam, 'Visitante')}
      </div>
    </div>
  );
}

// Same zones as the tournament table (components/tournament/LeagueTableView.jsx): 1-8 Gold Cup, 9-12 Silver Cup.
function StandingRow({ team, position, isUser, getLogo }) {
  const isGold = position <= GOLD_CUP_PLACES;
  return (
    <tr className={`border-l-[3px] ${isGold ? 'border-accent' : 'border-line/20'} ${isUser ? 'bg-accent/10' : ''}`}>
      <td className={`text-center num font-semibold ${isGold ? 'text-accent-soft' : 'text-ink-3'}`}>{position}</td>
      <td>
        <span className="flex items-center gap-2.5 min-w-0">
          <Crest src={getLogo(team.name)} className="w-5 h-5 shrink-0" />
          <span className={`truncate ${isUser ? 'font-semibold text-accent-soft' : 'text-ink'}`}>{team.name}</span>
          {isUser && <span className="sr-only">(tu club)</span>}
        </span>
      </td>
      <td className="text-center num">{Number(team.pj) || 0}</td>
      <td className="text-center num hidden sm:table-cell">{Number(team.pg) || 0}</td>
      <td className="text-center num hidden sm:table-cell">{Number(team.gpen) || 0}</td>
      <td className="text-center num">{goalDiff(team)}</td>
      <td className="text-right num font-display text-base font-bold text-ink">{Number(team.pts) || 0}</td>
    </tr>
  );
}

function StandingsSkeleton() {
  return (
    <div className="space-y-2 p-4" aria-hidden="true">
      {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-9" />)}
    </div>
  );
}

export const OverviewTab = memo(function OverviewTab({
  userProfile,
  remainingBudget: _remainingBudget, // the remaining budget is shown only in the top header
  ownedCart = [],
  tournamentData,
  allTeams = {},
  setActiveTab,
  onPlayerClick,
  signingToasts = [],
  isLoading = false,
}) {
  const teamName = userProfile?.teamName || 'Mi Equipo';
  const logoUrl = userProfile?.logoUrl || DEFAULT_LOGO;
  const tournamentLoading = isLoading || tournamentData === null;

  const logoByName = useMemo(() => {
    const m = new Map();
    for (const t of Object.values(allTeams || {})) if (t?.teamName) m.set(t.teamName.trim().toLowerCase(), t.logoUrl || DEFAULT_LOGO);
    return m;
  }, [allTeams]);
  const getLogo = name => logoByName.get((name || '').trim().toLowerCase()) || DEFAULT_LOGO;

  const leagueTable = useMemo(() => {
    if (!Array.isArray(tournamentData?.league)) return [];
    return tournamentData.league
      // El orden guardado ya es el oficial (desempates del reglamento y orden manual del admin): no se reordena acá.
      .filter(t => t.name && t.name !== 'Club...')
      .slice(0, LEAGUE_SIZE);
  }, [tournamentData?.league]);

  const userRankIndex = useMemo(() => leagueTable.findIndex(t => sameName(t.name, teamName)), [leagueTable, teamName]);
  const userLeagueStats = userRankIndex >= 0 ? leagueTable[userRankIndex] : null;

  const userMatches = useMemo(() => {
    if (!Array.isArray(tournamentData?.matches)) return [];
    return tournamentData.matches.filter(m => sameName(m.homeTeam, teamName) || sameName(m.awayTeam, teamName));
  }, [tournamentData?.matches, teamName]);

  const finished = useMemo(() => userMatches.filter(m => m.status === 'completed'), [userMatches]);
  const nextMatch = useMemo(() => userMatches.find(m => m.status !== 'completed') || null, [userMatches]);
  const lastMatch = finished.length ? finished[finished.length - 1] : null;

  const recentForm = useMemo(() => finished
    .map(m => teamMatchResult(teamName, m))
    .filter(Boolean)
    .slice(-5)
    .map(({ result }) => FORM_CHAR[result]), [finished, teamName]);

  const topPlayers = useMemo(() => [...ownedCart].sort((a, b) => (b.OVR_CALCULADO || 0) - (a.OVR_CALCULADO || 0)).slice(0, 5), [ownedCart]);
  const averageOvr = useMemo(() => (ownedCart.length ? Math.round(ownedCart.reduce((acc, p) => acc + (p.OVR_CALCULADO || 0), 0) / ownedCart.length) : 0), [ownedCart]);
  const lastSigning = signingToasts.length ? signingToasts[signingToasts.length - 1]?.playerName : null;
  const match = nextMatch || lastMatch;

  return (
    <Page className="pb-10">
      <PageHeader
        eyebrow="Supercontinental League"
        title={(
          <span className="flex items-center gap-3 sm:gap-4">
            <Crest src={logoUrl} name={teamName} className="w-11 h-11 sm:w-14 sm:h-14 shrink-0" />
            <span className="min-w-0 truncate">{teamName}</span>
          </span>
        )}
        description={lastSigning ? `Último fichaje: ${lastSigning}.` : undefined}
        actions={(
          <>
            <Button variant="secondary" icon={Users} onClick={() => setActiveTab('My Team')}>Mi plantel</Button>
            <Button variant="primary" iconRight={ArrowRight} onClick={() => setActiveTab('Marketplace')}>Ir al mercado</Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 border-y border-line/[0.08] py-5">
        <Stat label="Jugadores" value={ownedCart.length} hint="en el plantel" />
        <Stat label="Media del plantel" value={averageOvr || '—'} tone="accent" hint="OVR promedio" />
        <Stat label="Posición" value={userRankIndex >= 0 ? `${userRankIndex + 1}.º` : '—'}
          hint={userLeagueStats ? `${userLeagueStats.pts} pts · ${userLeagueStats.pj} PJ` : 'Sin clasificación'} />
        <div className="min-w-0">
          <p className="eyebrow">Forma</p>
          {recentForm.length ? (
            <ol className="flex items-center gap-1.5 mt-2" aria-label="Últimos resultados, del más viejo al más reciente">
              {recentForm.map((r, i) => (
                <li key={i} title={RESULT[r].label} aria-label={RESULT[r].label}
                  className={`w-7 h-7 rounded-md flex items-center justify-center font-display text-sm font-bold ${RESULT[r].className}`}>{r}</li>
              ))}
            </ol>
          ) : <p className="font-display text-[28px] font-bold leading-none mt-1.5 text-ink-3">—</p>}
          <p className="mt-1 text-xs text-ink-3">Últimos 5 partidos</p>
        </div>
      </div>

      {ownedCart.length === 0 && !isLoading && (
        <EmptyState icon={ShoppingBag} title="Tu plantel está vacío"
          description="Entrá al mercado para fichar jugadores, elegir a tu jugador franquicia y completar el once."
          actionLabel="Ir al mercado" onAction={() => setActiveTab('Marketplace')} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <section className="panel p-5 sm:p-6" aria-labelledby="overview-match">
            <SectionHeader as="h2" title={<span id="overview-match">{nextMatch ? 'Próximo partido' : lastMatch ? 'Último partido' : 'Partidos'}</span>}
              actions={<Button size="sm" variant="ghost" icon={CalendarDays} onClick={() => setActiveTab('Tournament')}>Fixture</Button>} />
            <div className="mt-5">
              {tournamentLoading ? (
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6" aria-hidden="true">
                  <div className="skeleton h-24" /><div className="skeleton h-10 w-16" /><div className="skeleton h-24" />
                </div>
              ) : match ? (
                <MatchFocus match={match} teamName={teamName} getLogo={getLogo} />
              ) : (
                <p className="py-6 text-center text-sm text-ink-3">Todavía no hay partidos de tu club en el fixture.</p>
              )}
            </div>
          </section>

          <section className="panel-flat overflow-hidden" aria-labelledby="overview-table">
            <div className="px-5 pt-5 sm:px-6">
              <SectionHeader title={<span id="overview-table">Clasificación</span>}
                actions={<Button size="sm" variant="ghost" icon={Trophy} onClick={() => setActiveTab('Tournament')}>Tabla completa</Button>} />
            </div>
            {tournamentLoading ? <StandingsSkeleton /> : leagueTable.length > 0 ? (
              <div className="overflow-x-auto mt-3">
                <table className="data-table table-fixed [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3 sm:[&_th]:px-3">
                  <caption className="sr-only">Tabla de la liga, en el orden oficial del torneo</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-10 !text-center">#</th>
                      <th scope="col">Club</th>
                      <th scope="col" className="w-12 !text-center">PJ</th>
                      <th scope="col" className="w-12 !text-center hidden sm:table-cell"><abbr title="Ganados en los 90'" className="no-underline">G</abbr></th>
                      <th scope="col" className="w-12 !text-center hidden sm:table-cell"><abbr title="Ganados por penales" className="no-underline">GP</abbr></th>
                      <th scope="col" className="w-12 !text-center">DG</th>
                      <th scope="col" className="w-14 !text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueTable.map((team, idx) => (
                      <StandingRow key={team.id || team.name} team={team} position={idx + 1} isUser={sameName(team.name, teamName)} getLogo={getLogo} />
                    ))}
                  </tbody>
                </table>
                <p className="px-5 sm:px-6 py-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 border-t border-line/[0.08]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-accent" aria-hidden="true" />1-{GOLD_CUP_PLACES}: Copa de Oro</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-line/40" aria-hidden="true" />{GOLD_CUP_PLACES + 1}-{LEAGUE_SIZE}: Copa de Plata</span>
                  <span>Victoria {LEAGUE_POINTS.REGULATION_WIN} pts · por penales {LEAGUE_POINTS.SHOOTOUT_WIN} · derrota {LEAGUE_POINTS.LOSS}</span>
                </p>
              </div>
            ) : (
              <p className="px-6 py-8 text-center text-sm text-ink-3">Todavía no hay posiciones registradas.</p>
            )}
          </section>
        </div>

        <section className="panel-flat p-5 sm:p-6 self-start min-w-0" aria-labelledby="overview-stars">
          <SectionHeader title={<span id="overview-stars">Figuras del plantel</span>}
            actions={<Button size="sm" variant="ghost" onClick={() => setActiveTab('My Team')}>Ver plantel</Button>} />
          {isLoading ? (
            <div className="mt-4 space-y-3" aria-hidden="true">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12" />)}</div>
          ) : topPlayers.length > 0 ? (
            <ul className="mt-3 divide-y divide-line/[0.07]">
              {topPlayers.map(player => (
                <li key={player.Id}>
                  <button type="button" onClick={() => onPlayerClick?.(player.Id)}
                    aria-label={`Ver perfil de ${player.Name}, ${player.POS_NOMBRE}, OVR ${player.OVR_CALCULADO}`}
                    className="group w-full flex items-center gap-3 py-2.5 min-h-14 text-left rounded-lg transition-colors hover:bg-white/[0.03] -mx-2 px-2">
                    <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" width={40} height={40} loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover object-top bg-raised shrink-0"
                      onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent-soft transition-colors">{player.Name}</span>
                      <span className="flex items-center gap-2 text-xs text-ink-3 mt-0.5">
                        <span className={`px-1.5 rounded text-[10px] font-bold ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
                        {player.Age > 0 && <span>{player.Age} años</span>}
                        <span className="num">{formatPriceShort(player.Precio)}</span>
                      </span>
                    </span>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center font-display num text-base font-bold shrink-0 ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>
                      {player.OVR_CALCULADO}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ink-3">Todavía no fichaste jugadores.</p>
          )}
        </section>
      </div>
    </Page>
  );
});
