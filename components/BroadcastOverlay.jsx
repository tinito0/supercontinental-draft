import React, { memo, useCallback, useMemo } from 'react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { CUP_IDS } from '../utils/bracketModel.js';
import { teamKey } from '../utils/competitionRules.js';
import { buildFixtures, currentRound, formatFixtureDate } from '../utils/leagueFixtures.js';
import { FULLSCREEN_SCENES, MATCH_SCENES, sceneLabel } from '../utils/obsScenes.js';
import { BroadcastFrame } from './broadcast/BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from './broadcast/BroadcastCrest.jsx';
import { BroadcastFixtures } from './broadcast/BroadcastFixtures.jsx';
import { BroadcastLeagueTable } from './broadcast/BroadcastLeagueTable.jsx';
import { OverlayPopup } from './broadcast/OverlayPopup.jsx';
import { CommunityCard } from './broadcast/CommunityCard.jsx';
import { BroadcastMvp, BroadcastPrediction, BroadcastScorers } from './broadcast/BroadcastMatchExtras.jsx';
import { BroadcastBracket } from './tournament/BroadcastBracket.jsx';
import { OverlayErrorBoundary } from './broadcast/OverlayErrorBoundary.jsx';

export const DEFAULT_BROADCAST_OVERLAY = {
  scene: 'live',
  matchId: '',
  homeTeamId: '',
  awayTeamId: '',
  homeTeamName: '',
  awayTeamName: '',
  homeScore: '0',
  awayScore: '0',
  matchStatus: 'EN VIVO',
  clock: '00:00',
  competitionLabel: 'SUPERCONTINENTAL LEAGUE',
  roundLabel: '',
  headline: 'SUPERCONTINENTAL LEAGUE',
  subheadline: 'Transmisión oficial',
  ticker: 'Bienvenidos a la transmisión de la Supercontinental League.',
  showScoreboard: true,
  showLowerThird: true,
  showTicker: true,
};

const MATCH_SCENE_TITLES = { previa: 'Previa', descanso: 'Entretiempo', final: 'Final' };

function teamOf(teamId, teams, fallbackName) {
  const team = teamId && teams?.[teamId] ? teams[teamId] : null;
  return { name: team?.teamName || fallbackName, logoUrl: team?.logoUrl || null };
}

const rankingRows = (list, field) => (list || []).filter(item => item?.name && Number(item[field]) > 0).map(item => ({
  name: item.name,
  team: item.team || '',
  value: Number(item[field]),
}));

/** Goleadores y, si el torneo ya tiene, asistidores al lado (los dos salen de los resultados cargados). */
function LeaderColumns({ tournamentData, getTeamLogo }) {
  const scorers = rankingRows(tournamentData?.topScorers, 'goals');
  const assisters = rankingRows(tournamentData?.topAssisters, 'assists');
  if (!scorers.length) return <div className="broadcast-empty">Todavía no hay goles cargados</div>;
  if (!assisters.length) return <RankingRows rows={scorers} unit={['GOL', 'GOLES']} getTeamLogo={getTeamLogo} />;
  return (
    <div className="broadcast-leader-columns">
      <section><h3 className="broadcast-leader-title">Goles</h3><RankingRows rows={scorers} unit={['GOL', 'GOLES']} getTeamLogo={getTeamLogo} /></section>
      <section><h3 className="broadcast-leader-title">Asistencias</h3><RankingRows rows={assisters} unit={['ASIST.', 'ASIST.']} getTeamLogo={getTeamLogo} /></section>
    </div>
  );
}

function RankingRows({ rows, unit, getTeamLogo }) {
  return (
    <div className="broadcast-rankings">
      {rows.map((row, index) => (
        <div className="broadcast-ranking-row" key={`${row.name}-${index}`}>
          <span className="broadcast-ranking-pos">{index + 1}</span>
          <div className="broadcast-ranking-name">
            <BroadcastCrest className="broadcast-ranking-crest" name={row.team} logo={getTeamLogo(row.team)} />
            <strong>{row.name}</strong>
            <small>{row.team}</small>
          </div>
          <div className="broadcast-ranking-value">
            <strong>{row.value}</strong>
            <small>{row.value === 1 ? unit[0] : unit[1]}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Previa, entretiempo y final del partido al aire. */
function MatchPanel({ scene, data, home, away, live, fixture }) {
  const showsResult = scene === 'final' || scene === 'descanso';
  // El marcador del juego (bridge) manda; si no hay, el resultado cargado en el torneo; si no, el del admin.
  const score = live?.score
    || (fixture?.score ? fixture.score : null)
    || { home: data.homeScore || 0, away: data.awayScore || 0 };
  const when = fixture ? formatFixtureDate(fixture) : '';
  return (
    <BroadcastFrame
      className="broadcast-panel"
      kicker={[fixture?.competitionLabel || data.competitionLabel, fixture?.roundLabel || data.roundLabel].filter(Boolean).join(' · ')}
      title={MATCH_SCENE_TITLES[scene]}
      aside={scene === 'previa' && when ? when : null}
    >
      <div className="broadcast-versus">
        <div className="broadcast-versus-team">
          <BroadcastCrest className="broadcast-versus-crest" name={home.name} logo={home.logoUrl} />
          <strong className={isLongName(home.name) ? 'is-long-name' : undefined} title={home.name}>{home.name}</strong>
        </div>
        <div className="broadcast-vs">VS</div>
        <div className="broadcast-versus-team away">
          <BroadcastCrest className="broadcast-versus-crest" name={away.name} logo={away.logoUrl} />
          <strong className={isLongName(away.name) ? 'is-long-name' : undefined} title={away.name}>{away.name}</strong>
        </div>
      </div>
      {showsResult && (
        <>
          <div className="broadcast-final-score">{score.home}-{score.away}</div>
          {scene === 'final' && fixture?.pens && <div className="broadcast-final-pens">Penales {fixture.pens.home}-{fixture.pens.away}</div>}
          <BroadcastScorers scorers={live?.scorers} />
        </>
      )}
      {scene === 'previa' && live?.prediction && <BroadcastPrediction shares={live.prediction} />}
      {scene === 'final' && live?.mvp && <BroadcastMvp mvp={live.mvp} />}
    </BroadcastFrame>
  );
}

/**
 * El overlay de OBS: una escena por vez dentro del lienzo de 1920×1080 (BroadcastStage), y encima, en todas las
 * escenas, el popup con QR y la tarjeta de la comunidad. Durante el partido («live») no hay marcador ni rótulos:
 * el juego ya los muestra (pedido del usuario).
 * @param {{ overlayData: object, allTeams: Record<string, object>, tournamentData: object, forcedScene?: string|null,
 *   live?: object, liveMatch?: object|null, overlayLoaded?: boolean }} props
 *   overlayLoaded: false mientras la fuente de OBS espera el doc del overlay (el popup que ya estaba no vuelve a salir).
 */
export const BroadcastOverlay = memo(function BroadcastOverlay({ overlayData, allTeams, tournamentData, forcedScene, live, liveMatch, overlayLoaded = true }) {
  const data = { ...DEFAULT_BROADCAST_OVERLAY, ...(overlayData || {}) };
  const scene = forcedScene || data.scene || 'live';

  const logoByKey = useMemo(() => {
    const map = new Map();
    for (const team of Object.values(allTeams || {})) if (team?.teamName) map.set(teamKey(team.teamName), team.logoUrl || null);
    return map;
  }, [allTeams]);
  const getTeamLogo = useCallback(name => logoByKey.get(teamKey(name)) || null, [logoByKey]);

  const { matchId, liveMatchKey } = data;
  const fixtures = useMemo(
    () => buildFixtures({ tournament: tournamentData, liveMatches: liveMatch ? [liveMatch] : [], overlay: { matchId, liveMatchKey } }),
    [tournamentData, liveMatch, matchId, liveMatchKey],
  );
  const onAirFixture = fixtures.find(fixture => fixture.id === matchId) || null;
  // homeTeamName/awayTeamName vienen del partido elegido en el panel: cubren clubes del torneo sin cuenta.
  const withLogo = team => ({ ...team, logoUrl: team.logoUrl || getTeamLogo(team.name) });
  const home = withLogo(teamOf(data.homeTeamId, allTeams, data.homeTeamName || onAirFixture?.home.name || 'LOCAL'));
  const away = withLogo(teamOf(data.awayTeamId, allTeams, data.awayTeamName || onAirFixture?.away.name || 'VISITANTE'));

  const showChrome = scene !== 'live' && !FULLSCREEN_SCENES.has(scene);
  // La tarjeta va del lado contrario al popup cuando el popup está a la izquierda (antes se pisaban).
  const cardSide = data.popup?.visible && data.popup?.position === 'left' ? 'right' : 'left';

  let content = null;
  if (MATCH_SCENES.has(scene)) content = <MatchPanel scene={scene} data={data} home={home} away={away} live={live} fixture={onAirFixture} />;
  else if (scene === 'tabla') content = <BroadcastLeagueTable league={tournamentData?.league} getTeamLogo={getTeamLogo} />;
  else if (scene === 'bracket' || scene === 'repechaje') {
    content = <BroadcastBracket cupId={scene === 'bracket' ? CUP_IDS.ORO : CUP_IDS.PLATA} bracket={tournamentData?.bracket} getTeamLogo={getTeamLogo} />;
  } else if (scene === 'partidos') content = <BroadcastFixtures round={currentRound(fixtures)} getTeamLogo={getTeamLogo} />;
  else if (scene === 'goleadores') {
    content = (
      <BroadcastFrame className="broadcast-panel" kicker={data.competitionLabel} title={sceneLabel('goleadores')}>
        <LeaderColumns tournamentData={tournamentData} getTeamLogo={getTeamLogo} />
      </BroadcastFrame>
    );
  }

  return (
    <div className="broadcast-overlay-root" data-scene={scene} aria-label="SCL OBS overlay">
      <OverlayErrorBoundary name={`escena ${scene}`} resetKey={tournamentData}>
        {/* La key es solo la escena: la entrada se ve al cambiar de escena, no con cada dato que llega. */}
        {content && <div className="scl-scene" key={scene}>{content}</div>}
      </OverlayErrorBoundary>

      {showChrome && data.showLowerThird && (
        <div className="broadcast-lower">
          <div className="broadcast-brand">
            <img className="broadcast-brand-logo" src={DEFAULT_LOGO} alt="SCL" width={72} height={72} onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
          </div>
          <div className="broadcast-headline">
            <strong>{data.headline}</strong>
            <span>{data.subheadline}</span>
          </div>
        </div>
      )}

      {showChrome && data.showTicker && (
        <div className="broadcast-ticker">
          <div className="broadcast-ticker-label">Último momento</div>
          <div className="broadcast-ticker-text">{data.ticker}</div>
        </div>
      )}

      <OverlayErrorBoundary name="comunidad" resetKey={overlayData}>
        <CommunityCard card={overlayData?.card} live={live} homeName={home.name} awayName={away.name} side={cardSide} loaded={overlayLoaded} />
        <OverlayPopup popup={overlayData?.popup} loaded={overlayLoaded} />
      </OverlayErrorBoundary>
    </div>
  );
});
