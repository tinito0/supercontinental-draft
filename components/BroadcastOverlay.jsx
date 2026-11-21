import React, { memo, useCallback, useMemo } from 'react';
import { DEFAULT_LOGO } from '../utils/constants.js';
import { CUP_IDS } from '../utils/bracketModel.js';
import { teamKey } from '../utils/competitionRules.js';
import { buildFixtures, currentRound } from '../utils/leagueFixtures.js';
import { nextFixture, nextLine, sceneLowerThird } from '../utils/obsLowerThird.js';
import { FULLSCREEN_SCENES, MATCH_SCENES, sceneLabel } from '../utils/obsScenes.js';
import { BroadcastFrame } from './broadcast/BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from './broadcast/BroadcastCrest.jsx';
import { BroadcastFixtures } from './broadcast/BroadcastFixtures.jsx';
import { BroadcastLeagueTable } from './broadcast/BroadcastLeagueTable.jsx';
import { OverlayPopup } from './broadcast/OverlayPopup.jsx';
import { CommunityCard } from './broadcast/CommunityCard.jsx';
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

/**
 * Previa, entretiempo y final: a thin strip at the top with both clubs and the result (or VS), so the commentators'
 * camera keeps the full screen. Goals, the next match and the kickoff go on the lower third (utils/obsLowerThird.js).
 */
function MatchStrip({ scene, data, home, away, live }) {
  const showsResult = scene === 'final' || scene === 'descanso';
  // El marcador del juego (bridge) manda; si no hay, el resultado cargado en el torneo; si no, el del admin.
  const score = live?.score || { home: data.homeScore || 0, away: data.awayScore || 0 };
  return (
    <div className="scl-strip" data-scene={scene}>
      <span className="scl-strip-label">{MATCH_SCENE_TITLES[scene]}</span>
      <div className="scl-strip-team">
        <strong className={isLongName(home.name) ? 'is-long-name' : undefined} title={home.name}>{home.name}</strong>
        <BroadcastCrest className="scl-strip-crest" name={home.name} logo={home.logoUrl} />
      </div>
      <div className="scl-strip-center">{showsResult ? `${score.home}-${score.away}` : 'VS'}</div>
      <div className="scl-strip-team away">
        <BroadcastCrest className="scl-strip-crest" name={away.name} logo={away.logoUrl} />
        <strong className={isLongName(away.name) ? 'is-long-name' : undefined} title={away.name}>{away.name}</strong>
      </div>
    </div>
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
export const BroadcastOverlay = memo(function BroadcastOverlay({ overlayData, allTeams, tournamentData, forcedScene, live, liveMatch, season = null, overlayLoaded = true, etaById = null }) {
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
    // teamsById: sin partido al aire, el juego en vivo se vincula por los clubes del draft (tabla en vivo).
    () => buildFixtures({ tournament: tournamentData, liveMatches: liveMatch ? [liveMatch] : [], overlay: { matchId, liveMatchKey }, teamsById: allTeams || {} })
      .map(fixture => (etaById?.has(fixture.id) ? { ...fixture, etaMs: etaById.get(fixture.id) } : fixture)),
    [tournamentData, liveMatch, matchId, liveMatchKey, allTeams, etaById],
  );
  const onAirFixture = fixtures.find(fixture => fixture.id === matchId) || null;
  // homeTeamName/awayTeamName vienen del partido elegido en el panel: cubren clubes del torneo sin cuenta.
  const withLogo = team => ({ ...team, logoUrl: team.logoUrl || getTeamLogo(team.name) });
  const home = withLogo(teamOf(data.homeTeamId, allTeams, data.homeTeamName || onAirFixture?.home.name || 'LOCAL'));
  const away = withLogo(teamOf(data.awayTeamId, allTeams, data.awayTeamName || onAirFixture?.away.name || 'VISITANTE'));

  const showChrome = scene !== 'live' && !FULLSCREEN_SCENES.has(scene);
  // Previa, entretiempo and final write their own lower third from the match (utils/obsLowerThird.js); the admin's
  // headline and subheadline stay for the other scenes.
  const next = useMemo(() => nextFixture(fixtures, matchId), [fixtures, matchId]);
  const liveScore = live?.score || onAirFixture?.score || null;
  const lower = sceneLowerThird({ scene, home: home.name, away: away.name, score: liveScore, fixture: onAirFixture, scorers: live?.scorers, next })
    || { headline: data.headline, subheadline: data.subheadline };
  // La tarjeta va del lado contrario al popup cuando el popup está a la izquierda (antes se pisaban).
  const cardSide = data.popup?.visible && data.popup?.position === 'left' ? 'right' : 'left';

  let content = null;
  if (MATCH_SCENES.has(scene)) {
    const withScore = live?.score ? live : { ...live, score: onAirFixture?.score || null };
    content = <MatchStrip scene={scene} data={data} home={home} away={away} live={withScore?.score ? withScore : live} />;
  }
  else if (scene === 'tabla') content = <BroadcastLeagueTable league={tournamentData?.league} fixtures={fixtures} getTeamLogo={getTeamLogo} />;
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
            <strong>{lower.headline}</strong>
            {lower.subheadline && <span>{lower.subheadline}</span>}
          </div>
        </div>
      )}

      {/* Between matches the table scene carries the next match on the ticker line (it hides the lower third). */}
      {scene === 'tabla' && next && (
        <div className="broadcast-ticker">
          <div className="broadcast-ticker-label">Siguiente</div>
          <div className="broadcast-ticker-text">{nextLine(next)}</div>
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
