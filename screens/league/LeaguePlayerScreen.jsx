import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, UserX } from 'lucide-react';
import { Alert } from '../../components/ui/Alert.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Stat } from '../../components/ui/Stat.jsx';
import { PlayerPhoto } from '../../components/league/match/MatchDetailViews.jsx';
import { PlayerMatchLog } from '../../components/league/season/PlayerMatchLog.jsx';
import { playerDisplayName } from '../../components/league/season/SeasonLeaderRow.jsx';
import { useLeagueTeams } from '../../hooks/useLeagueData.js';
import { catalogEntry, useMarketCatalog, useSeasonStats } from '../../hooks/useSeasonStats.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getPosColorClass, getStatAndOvrColorClass } from '../../utils/helpers.js';
import { playerMatchLog, seasonHeat } from '../../utils/seasonStats.js';
import { Heatmap } from '../../components/league/match/Heatmap.jsx';

/* /jugadores/:playerId: la temporada de un jugador con los datos del juego (match_lines de partidos oficiales).
   Cabecera con foto, posición y OVR del catálogo; totales; detalle según sea arquero o de campo; sus partidos. */

const GOALKEEPER_POSITION = 0;
const formatRating = value => value.toFixed(1).replace('.', ',');
const percent = (done, total) => (total ? `${Math.round((done / total) * 100)} %` : '–');

function detailRows(player, isKeeper) {
  if (isKeeper) {
    return [['Vallas invictas', player.cleanSheets], ['Atajadas', player.saves], ['Pases precisos', percent(player.passesCompleted, player.passes)], ['Amarillas', player.yellow], ['Rojas', player.red]];
  }
  return [
    ['Tiros', player.shots], ['Tiros al arco', player.shotsOnTarget], ['Pases precisos', percent(player.passesCompleted, player.passes)],
    ['Duelos ganados', percent(player.tacklesWon, player.tackles)], ['Intercepciones', player.interceptions],
    ['Amarillas', player.yellow], ['Rojas', player.red],
  ];
}

function PlayerHeader({ playerId, player, entry, catalog }) {
  const name = player ? playerDisplayName(player, catalog) : entry?.name || `Jugador ${playerId}`;
  const clubIsDraft = player?.clubKey && !player.clubKey.startsWith('game-');
  return (
    <header className="flex items-center gap-4 sm:gap-6">
      <PlayerPhoto id={playerId} size={96} />
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {entry?.position && <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${getPosColorClass(entry.position)}`}>{entry.position}</span>}
          {entry?.ovr > 0 && <span className={`num rounded-md px-1.5 py-0.5 text-xs font-bold ${getStatAndOvrColorClass(entry.ovr)}`} title="OVR del catálogo">{entry.ovr}</span>}
          {entry?.age > 0 && <span>{entry.age} años</span>}
          {clubIsDraft && <Link to={`/equipos/${player.clubKey}`} className="font-semibold text-accent-soft hover:text-ink">{player.clubName || 'Su club'}</Link>}
          {!clubIsDraft && player?.clubName && <span>{player.clubName}</span>}
        </p>
      </div>
    </header>
  );
}

function SeasonTotals({ player, isKeeper }) {
  const rating = player.rating != null ? formatRating(player.rating) : '–';
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="player-season">
      <h2 id="player-season" className="section-title">Temporada</h2>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Partidos" value={player.apps} hint={`${player.starts} de titular`} />
        <Stat label="Minutos" value={player.minutes} />
        <Stat label="Goles" value={player.goals} />
        <Stat label="Asistencias" value={player.assists} />
        <Stat label="Valoración" value={rating} hint={player.rated ? `promedio en ${player.rated} ${player.rated === 1 ? 'partido' : 'partidos'}` : 'sin valoración'} />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 border-t border-line/10 pt-4 sm:grid-cols-3 lg:grid-cols-4">
        {detailRows(player, isKeeper).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line/10 py-2">
            <dt className="text-sm text-ink-2">{label}</dt>
            <dd className="num whitespace-nowrap font-display text-lg font-bold text-ink">{value}</dd>
          </div>
        ))}
        {player.xg != null && (
          <div className="flex items-baseline justify-between gap-3 border-b border-line/10 py-2">
            <dt className="text-sm text-ink-2" title="Estimación propia según dónde se tiró, no la del juego">xG estimado</dt>
            <dd className="num font-display text-lg font-bold text-ink">{player.xg.toFixed(2).replace('.', ',')}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

/** Mapa de calor de la temporada: los partidos sumados por minutos jugados (utils/seasonStats.js seasonHeat). */
function SeasonHeat({ heat, name }) {
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="player-heat">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="player-heat" className="section-title">Dónde juega</h2>
        <p className="text-sm text-ink-2">{heat.matches} {heat.matches === 1 ? 'partido' : 'partidos'}</p>
      </div>
      <Heatmap cells={heat.cells} cols={heat.cols} rows={heat.rows} label={`Mapa de calor de la temporada de ${name}`} className="mt-4 max-w-2xl" />
    </section>
  );
}

function PlayerSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-4"><div className="skeleton h-24 w-24 rounded-lg" /><div className="skeleton h-10 w-56" /></div>
      <div className="skeleton h-56 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}

export default function LeaguePlayerScreen() {
  const { playerId: rawId } = useParams();
  const playerId = /^\d{1,7}$/.test(String(rawId)) ? Number(rawId) : null;
  const { stats, docs, officialKeys, loading, error } = useSeasonStats();
  const { teamsById } = useLeagueTeams();
  const catalog = useMarketCatalog();
  const player = stats.players.find(p => p.id === playerId) || null;
  const entry = catalogEntry(catalog, playerId);
  const log = useMemo(() => (playerId == null ? [] : playerMatchLog(docs, playerId, { officialKeys })), [docs, playerId, officialKeys]);
  const heat = useMemo(() => (playerId == null ? null : seasonHeat(docs, playerId, { officialKeys })), [docs, playerId, officialKeys]);
  useDocumentTitle(player || entry ? playerDisplayName(player || { id: playerId, name: entry?.name }, catalog) : 'Jugador');
  const isKeeper = player?.position === GOALKEEPER_POSITION || entry?.position === 'PT';

  let content;
  if (error) content = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  else if (loading) content = <PlayerSkeleton />;
  else if (playerId == null || (!player && catalog && !entry)) {
    content = <EmptyState icon={UserX} title="No encontramos este jugador" description="Puede que el enlace esté mal. Buscalo en las estadísticas de la temporada." />;
  } else {
    content = (
      <div className="space-y-6">
        <PlayerHeader playerId={playerId} player={player} entry={entry} catalog={catalog} />
        {player
          ? <SeasonTotals player={player} isKeeper={isKeeper} />
          : <p className="text-sm text-ink-2">Todavía no tiene partidos oficiales con datos del juego esta temporada.</p>}
        {heat && <SeasonHeat heat={heat} name={playerDisplayName(player || { id: playerId, name: entry?.name }, catalog)} />}
        {player && <PlayerMatchLog log={log} teamsById={teamsById} />}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <Link to="/torneo?tab=estadisticas" className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-soft hover:text-ink">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Estadísticas de la temporada
      </Link>
      {content}
    </section>
  );
}
