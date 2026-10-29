import React, { memo, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { BracketBoard } from './BracketBoard.jsx';
import {
  BROADCAST_METRICS,
  BROADCAST_REFERENCE,
  CUP_DEFINITIONS,
  broadcastCardScale,
  buildBracketColumns,
  buildConnectors,
  buildCupRounds,
  chooseBroadcastLayout,
  getMatchWinner,
  hasScore,
  isMatchCompleted,
  shootoutLabel,
} from '../../utils/bracketModel.js';
import { BroadcastBadge } from '../broadcast/BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from '../broadcast/BroadcastCrest.jsx';
import './broadcastBracket.css';

const TONE_STROKES = {
  gold: { final: 'rgba(217,119,6,0.85)', base: 'rgba(57,67,107,0.35)' },
  silver: { final: 'rgba(85,96,127,0.85)', base: 'rgba(57,67,107,0.35)' },
};

function TeamRow({ name, score, seed, outcome, logo }) {
  const scoreShown = hasScore(score);
  return (
    <div className={`bb-team ${outcome ? `is-${outcome}` : ''}`}>
      {seed !== undefined && <span className="bb-seed">{seed}</span>}
      <BroadcastCrest className="bb-crest" name={name} logo={name ? logo : null} />
      <span className={`bb-name ${name ? '' : 'is-empty'} ${isLongName(name) ? 'is-long-name' : ''}`} title={name || undefined}>{name || 'A definir'}</span>
      <span className={`bb-score ${scoreShown ? '' : 'is-empty'}`}>{scoreShown ? Number(score) : '–'}</span>
    </div>
  );
}

const BroadcastMatchCard = memo(function BroadcastMatchCard({ entry, cup, getTeamLogo, scale }) {
  const { match } = entry;
  // Solo las rondas sembradas (cuartos de Oro) llevan la columna de siembra.
  const showSeeds = Boolean(entry.seedA || entry.seedB);
  const winner = getMatchWinner(match);
  const completed = isMatchCompleted(match);
  const pens = shootoutLabel(match);
  const outcomeFor = side => (winner ? (winner === side ? 'winner' : 'loser') : null);
  const championName = entry.isFinal && winner ? (winner === 'A' ? match.teamA : match.teamB) : '';
  const logoOf = name => (name && getTeamLogo ? getTeamLogo(name) : null);

  return (
    <div className="bb-slot" data-match-key={entry.key} style={{ '--bb-k': scale.toFixed(3) }}>
      {entry.isFinal && (
        <div className="bb-final-tag">
          <Trophy className="bb-icon" aria-hidden="true" />
          <span>{cup.finalLabel}</span>
        </div>
      )}
      <div className={`bb-card ${entry.isFinal ? 'is-final' : ''}`}>
        <div className="bb-card-head">
          <span className="bb-card-title">{entry.title}</span>
          <span className={`bb-card-state ${completed ? 'is-done' : ''}`}>{pens ? `Final · ${pens}` : completed ? 'Final' : ''}</span>
        </div>
        <TeamRow name={match.teamA} score={match.scoreA} seed={showSeeds ? entry.seedA : undefined} outcome={outcomeFor('A')} logo={logoOf(match.teamA)} />
        <TeamRow name={match.teamB} score={match.scoreB} seed={showSeeds ? entry.seedB : undefined} outcome={outcomeFor('B')} logo={logoOf(match.teamB)} />
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
 * Bracket de Copa de Oro / Copa de Plata en el lienzo de 1920×1080 de la transmisión (BroadcastStage lo escala a la
 * fuente real). Una columna por ronda: en 16:9 el espejado dejaría tarjetas demasiado angostas para los nombres.
 * Las tarjetas de cada columna crecen con el lugar que tienen (broadcastCardScale): las semis y la final ya no
 * quedan chicas en el medio de un panel vacío.
 */
export const BroadcastBracket = memo(function BroadcastBracket({ cupId, bracket, getTeamLogo }) {
  const cup = CUP_DEFINITIONS[cupId];
  const rounds = useMemo(() => buildCupRounds(cupId, bracket), [cupId, bracket]);
  const { layout, cardWidth } = chooseBroadcastLayout(rounds, BROADCAST_REFERENCE.width, BROADCAST_REFERENCE.height);
  const columns = useMemo(() => buildBracketColumns(rounds, layout), [rounds, layout]);
  const connectors = useMemo(() => buildConnectors(columns), [columns]);
  const strokes = TONE_STROKES[cup.tone];

  const allMatches = rounds.flatMap(round => round.matches);
  const played = allMatches.filter(entry => isMatchCompleted(entry.match)).length;
  const finalEntry = rounds.find(round => round.isFinal)?.matches[0];
  const finalWinner = finalEntry ? getMatchWinner(finalEntry.match) : null;
  const champion = finalWinner ? (finalWinner === 'A' ? finalEntry.match.teamA : finalEntry.match.teamB) : '';

  return (
    <div className="bb-root" data-tone={cup.tone} data-layout={layout} aria-label={`${cup.name} — bracket`}>
      <div className="bb-frame scl-frame">
        <div className="scl-frame-stripe" aria-hidden="true" />
        <div className="scl-frame-ball" aria-hidden="true" />
        <header className="bb-header">
          <div className="bb-brand">
            <BroadcastBadge />
            <div className="bb-brand-text">
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

        <div className="bb-panel scl-panel">
          <BracketBoard
            className="bb-board"
            style={{ justifyContent: 'center' }}
            columns={columns}
            connectors={connectors}
            columnWidth={`${Math.floor(cardWidth)}px`}
            connectorWidth={`${BROADCAST_METRICS.connectorWidth}px`}
            slotPadding={`${BROADCAST_METRICS.slotPadding}px 0`}
            strokeWidth={3}
            connectorStroke={connector => (connector.toFinal ? strokes.final : strokes.base)}
            renderLabel={column => (
              <div className={`bb-round-label ${column.isFinal ? 'is-final' : ''}`}>{column.label}</div>
            )}
            renderMatch={(entry, column) => (
              <BroadcastMatchCard
                entry={entry}
                cup={cup}
                getTeamLogo={getTeamLogo}
                scale={broadcastCardScale(column.entries.length, cardWidth, { isFinal: column.isFinal })}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
});

export default BroadcastBracket;
