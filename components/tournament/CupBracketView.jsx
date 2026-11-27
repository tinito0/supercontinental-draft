import React, { memo, useMemo, useState } from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import { TournamentSectionTitle } from '../TournamentUI.jsx';
import { MatchCard } from './MatchCard.jsx';
import { BracketBoard } from './BracketBoard.jsx';
import { useElementSize } from '../../hooks/useElementSize.js';
import { CUP_DEFINITIONS, buildCupRounds, buildBracketColumns, buildConnectors } from '../../utils/bracketModel.js';

// Medidas de la vista de la app (la de OBS vive en BroadcastBracket.jsx).
const APP_CARD_WIDTH = 248;
const APP_CONNECTOR_WIDTH = 40;

const TONE_STYLES = {
  gold: {
    finalStroke: 'rgba(147,176,242,0.55)',
    pill: 'bg-accent/15 border-accent-soft/40 text-accent-soft',
    pillIcon: 'text-accent-soft',
  },
  silver: {
    finalStroke: 'rgba(148,163,184,0.65)',
    pill: 'bg-raised border-line/20 text-ink-2',
    pillIcon: 'text-ink-3',
  },
};

function boardWidth(columnCount) {
  return columnCount * APP_CARD_WIDTH + (columnCount - 1) * APP_CONNECTOR_WIDTH;
}

/** Bracket editable de una copa (Oro o Plata) dentro de la app. */
export const CupBracketView = memo(function CupBracketView({
  cupId,
  localData,
  isEditing,
  getTeamLogo,
  updateGeneric,
  showTitle = true,
}) {
  const cup = CUP_DEFINITIONS[cupId];
  const tone = TONE_STYLES[cup.tone];
  const [containerRef, { width }] = useElementSize();
  const rounds = useMemo(() => buildCupRounds(cupId, localData?.bracket), [cupId, localData?.bracket]);

  // Espejado (las dos alas hacia la final) si entra completo; si no, una columna por ronda.
  // Si tampoco entra (celular), el bracket se desplaza dentro de su propio contenedor.
  const mirroredColumns = useMemo(() => buildBracketColumns(rounds, 'mirrored'), [rounds]);
  const layout = width >= boardWidth(mirroredColumns.length) ? 'mirrored' : 'linear';
  const columns = useMemo(
    () => (layout === 'mirrored' ? mirroredColumns : buildBracketColumns(rounds, 'linear')),
    [layout, mirroredColumns, rounds],
  );
  const connectors = useMemo(() => buildConnectors(columns), [columns]);

  // Aviso de que el cuadro sigue a la derecha: solo mientras no entra en pantalla y no se llegó a la final.
  const [reachedEnd, setReachedEnd] = useState(false);
  const overflows = width > 0 && width < boardWidth(columns.length);
  const handleScroll = event => {
    const el = event.currentTarget;
    setReachedEnd(el.scrollWidth - el.clientWidth - el.scrollLeft <= 24);
  };

  return (
    <div className="flex flex-col items-center py-4 w-full">
      {showTitle && <TournamentSectionTitle title="SuperContinental League" subtitle={cup.subtitle.toUpperCase()} />}
      {/* Con teclado también se desplaza (tabIndex): en el teléfono el cuadro es más ancho que la pantalla. */}
      <div ref={containerRef} onScroll={handleScroll} className="w-full overflow-x-auto custom-scrollbar pb-6 focus-visible:outline-2 focus-visible:outline-accent-soft" tabIndex={0} role="region" aria-label={`Cuadro de la ${cup.name}`}>
        <BracketBoard
          className="w-max mx-auto pt-2"
          columns={columns}
          connectors={connectors}
          columnWidth={`${APP_CARD_WIDTH}px`}
          connectorWidth={`${APP_CONNECTOR_WIDTH}px`}
          slotPadding="14px 0"
          connectorStroke={connector => (connector.toFinal ? tone.finalStroke : 'rgba(255,255,255,0.2)')}
          renderLabel={column => (
            <p className={`text-center text-xs font-semibold uppercase tracking-wider pb-1 ${column.isFinal ? 'text-ink-2' : 'text-ink-3'}`}>
              {column.label}
            </p>
          )}
          renderMatch={entry => (
            <div className="relative w-full flex justify-center">
              {entry.isFinal && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 flex items-center gap-2 px-3.5 py-1 rounded-md border text-xs font-bold uppercase tracking-wider whitespace-nowrap ${tone.pill}`}>
                  <Trophy className={`w-4 h-4 ${tone.pillIcon}`} aria-hidden="true" />
                  <span>{cup.finalLabel}</span>
                </div>
              )}
              <MatchCard
                match={entry.match}
                stage={entry.roundId}
                path={entry.path}
                index={entry.index}
                isFinal={entry.isFinal}
                seedA={entry.seedA || undefined}
                seedB={entry.seedB || undefined}
                titleOverride={entry.isFinal ? cup.championLabel.toUpperCase() : entry.title.toUpperCase()}
                isEditing={isEditing}
                updateMatch={updateGeneric}
                getTeamLogo={getTeamLogo}
              />
            </div>
          )}
        />
      </div>
      {overflows && !reachedEnd && (
        <p className="flex min-h-6 items-center gap-1.5 text-sm font-medium text-ink-2">
          Deslizá para ver la final <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </p>
      )}
    </div>
  );
});

export default CupBracketView;
