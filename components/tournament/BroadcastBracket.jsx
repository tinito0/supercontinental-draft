import React, { memo, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { useElementSize } from '../../hooks/useElementSize.js';
import { BracketBoard } from './BracketBoard.jsx';
import {
  BROADCAST_METRICS,
  CUP_DEFINITIONS,
  buildBracketColumns,
  buildConnectors,
  buildCupRounds,
  chooseBroadcastLayout,
  getMatchWinner,
  hasScore,
  isMatchCompleted,
} from '../../utils/bracketModel.js';
import './broadcastBracket.css';

const TONE_STROKES = {
  gold: { final: 'rgba(245,158,11,0.75)', base: 'rgba(150,166,200,0.38)' },
  silver: { final: 'rgba(203,213,225,0.8)', base: 'rgba(150,166,200,0.38)' },
};

function TeamRow({ name, score, seed, outcome, getTeamLogo }) {
  const logo = (name && getTeamLogo) ? getTeamLogo(name) : DEFAULT_LOGO;
  const scoreShown = hasScore(score);
  return (
    <div className={`bb-team ${outcome ? `is-${outcome}` : ''}`}>
      {seed !== undefined && <span className="bb-seed">{seed}</span>}
      <img
        className="bb-crest"
        src={logo || DEFAULT_LOGO}
        alt=""
        onError={event => { event.currentTarget.src = DEFAULT_LOGO; }}
      />
      <span className={`bb-name ${name ? '' : 'is-empty'}`} title={name || undefined}>{name || 'A definir'}</span>
      <span className={`bb-score ${scoreShown ? '' : 'is-empty'}`}>{scoreShown ? Number(score) : '–'}</span>
    </div>
  );
}

const BroadcastMatchCard = memo(function BroadcastMatchCard({ entry, cup, getTeamLogo }) {
  const { match } = entry;
  // Solo las rondas sembradas (cuartos de Oro) llevan la columna de siembra.
  const showSeeds = Boolean(entry.seedA || entry.seedB);
  const winner = getMatchWinner(match);
  const completed = isMatchCompleted(match);
  const outcomeFor = side => (winner ? (winner === side ? 'winner' : 'loser') : null);
  const championName = entry.isFinal && winner ? (winner === 'A' ? match.teamA : match.teamB) : '';

  return (
    <div className="bb-slot" data-match-key={entry.key}>
      {entry.isFinal && (
        <div className="bb-final-tag">
          <Trophy className="bb-icon" aria-hidden="true" />
          <span>{cup.finalLabel}</span>
        </div>
      )}
      <div className={`bb-card ${entry.isFinal ? 'is-final' : ''}`}>
        <div className="bb-card-head">
          <span className="bb-card-title">{entry.title}</span>
          <span className={`bb-card-state ${completed ? 'is-done' : ''}`}>{completed ? 'Final' : ''}</span>
        </div>
        <TeamRow name={match.teamA} score={match.scoreA} seed={showSeeds ? entry.seedA : undefined} outcome={outcomeFor('A')} getTeamLogo={getTeamLogo} />
        <TeamRow name={match.teamB} score={match.scoreB} seed={showSeeds ? entry.seedB : undefined} outcome={outcomeFor('B')} getTeamLogo={getTeamLogo} />
      </div>
      {championName && (
        <div className="bb-champion">
          <small>{cup.championLabel}</small>
          <strong>{championName}</strong>
        </div>
      )}
    </div>
  );
});

/**
 * Bracket de Copa de Oro / Copa de Plata para una fuente de navegador de OBS.
 * Ocupa toda la ventana, se dimensiona según el tamaño real medido (no un lienzo fijo escalado) y usa una
 * columna por ronda cuando el espejado dejaría tarjetas demasiado angostas para los nombres: en 16:9 es el
 * caso de las dos copas; el espejado queda para fuentes más anchas (p. ej. ultrawide).
 */
export const BroadcastBracket = memo(function BroadcastBracket({ cupId, bracket, getTeamLogo }) {
  const cup = CUP_DEFINITIONS[cupId];
  const [rootRef, { width, height }] = useElementSize();
  const rounds = useMemo(() => buildCupRounds(cupId, bracket), [cupId, bracket]);

  // El tablero ocupa el ancho del contenedor menos el padding lateral, que también se mide en u.
  const { layout, unit, cardWidth } = chooseBroadcastLayout(rounds, width || 1920, height || 1080);
  const columns = useMemo(() => buildBracketColumns(rounds, layout), [rounds, layout]);
  const connectors = useMemo(() => buildConnectors(columns), [columns]);
  const strokes = TONE_STROKES[cup.tone];

  const allMatches = rounds.flatMap(round => round.matches);
  const played = allMatches.filter(entry => isMatchCompleted(entry.match)).length;
  const finalEntry = rounds.find(round => round.isFinal)?.matches[0];
  const finalWinner = finalEntry ? getMatchWinner(finalEntry.match) : null;
  const champion = finalWinner ? (finalWinner === 'A' ? finalEntry.match.teamA : finalEntry.match.teamB) : '';

  return (
    <div
      ref={rootRef}
      className="bb-root"
      data-tone={cup.tone}
      data-layout={layout}
      style={{ '--u': `${unit}px` }}
      aria-label={`${cup.name} — bracket`}
    >
      <header className="bb-header">
        <div className="bb-brand">
          <img className="bb-logo" src={DEFAULT_LOGO} alt="" />
          <div className="min-w-0">
            <div className="bb-eyebrow">Supercontinental League</div>
            <div className="bb-title">{cup.name}</div>
          </div>
        </div>
        <div className="bb-status">
          <div className="bb-status-label">{champion ? cup.championLabel : 'Partidos jugados'}</div>
          <div className={`bb-status-value ${champion ? 'is-champion' : ''}`}>
            {champion || `${played} / ${allMatches.length}`}
          </div>
        </div>
      </header>

      <BracketBoard
        className="bb-board"
        style={{ justifyContent: 'center' }}
        columns={columns}
        connectors={connectors}
        columnWidth={`${Math.floor(cardWidth)}px`}
        connectorWidth={`${BROADCAST_METRICS.connectorWidth * unit}px`}
        slotPadding={`${Math.round(10 * unit)}px 0`}
        strokeWidth={Math.max(2, 3 * unit)}
        connectorStroke={connector => (connector.toFinal ? strokes.final : strokes.base)}
        renderLabel={column => (
          <div className={`bb-round-label ${column.isFinal ? 'is-final' : ''}`}>{column.label}</div>
        )}
        renderMatch={entry => (
          <BroadcastMatchCard entry={entry} cup={cup} getTeamLogo={getTeamLogo} />
        )}
      />
    </div>
  );
});

export default BroadcastBracket;
