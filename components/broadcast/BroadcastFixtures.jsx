import React, { memo } from 'react';
import { BroadcastFrame } from './BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from './BroadcastCrest.jsx';
import { formatFixtureDate } from '../../utils/leagueFixtures.js';

// Escena «Fecha» del OBS: los partidos de la fecha o ronda en curso (utils/leagueFixtures.currentRound), con el
// resultado si está cargado, «En vivo» si se está jugando y la fecha/hora si está programado.

const STATUS_TEXT = { live: 'En vivo', nosignal: 'Sin señal', played: 'Jugado', abandoned: 'Suspendido', postponed: 'Postergado' };

function Middle({ fixture }) {
  if (fixture.status === 'finished' && fixture.score) {
    return (
      <div className="scl-fx-score">
        <strong>{fixture.score.home}-{fixture.score.away}</strong>
        {fixture.pens && <small>{fixture.pens.home}-{fixture.pens.away} pen.</small>}
      </div>
    );
  }
  if (fixture.liveScore && ['live', 'nosignal', 'played'].includes(fixture.status)) {
    return (
      <div className={`scl-fx-score is-${fixture.status}`}>
        <strong>{fixture.liveScore.home}-{fixture.liveScore.away}</strong>
        <small>{fixture.status === 'live' ? fixture.minute || 'En vivo' : STATUS_TEXT[fixture.status]}</small>
      </div>
    );
  }
  const when = formatFixtureDate(fixture);
  return (
    <div className="scl-fx-score is-upcoming">
      <strong>{STATUS_TEXT[fixture.status] || 'vs'}</strong>
      {when && <small>{when}</small>}
    </div>
  );
}

export const BroadcastFixtures = memo(function BroadcastFixtures({ round, getTeamLogo }) {
  const fixtures = round?.fixtures || [];
  return (
    <div className="scl-stage">
      <BroadcastFrame className="scl-fx-frame" kicker={round?.competitionLabel || 'Supercontinental League'} title={round?.title || 'Partidos'}>
        {fixtures.length === 0 ? (
          <div className="broadcast-empty">Todavía no hay partidos cargados</div>
        ) : (
          <ol className="scl-fx-list">
            {fixtures.map(fixture => {
              const won = side => fixture.winner === side;
              return (
                <li key={fixture.id} className={`scl-fx-row ${fixture.status === 'live' ? 'is-live' : ''} ${fixture.isOnAir ? 'is-on-air' : ''}`}>
                  <div className={`scl-fx-team ${won('home') ? 'is-winner' : ''}`}>
                    <span className={`scl-fx-name ${isLongName(fixture.home.name) ? 'is-long-name' : ''}`} title={fixture.home.name}>{fixture.home.name}</span>
                    <BroadcastCrest className="scl-fx-crest" name={fixture.home.name} logo={getTeamLogo?.(fixture.home.name)} />
                  </div>
                  <Middle fixture={fixture} />
                  <div className={`scl-fx-team away ${won('away') ? 'is-winner' : ''}`}>
                    <BroadcastCrest className="scl-fx-crest" name={fixture.away.name} logo={getTeamLogo?.(fixture.away.name)} />
                    <span className={`scl-fx-name ${isLongName(fixture.away.name) ? 'is-long-name' : ''}`} title={fixture.away.name}>{fixture.away.name}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </BroadcastFrame>
    </div>
  );
});

export default BroadcastFixtures;
