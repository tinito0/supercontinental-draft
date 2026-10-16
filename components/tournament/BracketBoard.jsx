import React, { memo } from 'react';

// Grilla del bracket compartida por la vista de la app y la de OBS.
// Cada columna reparte su alto en partes iguales (una por partido) y el partido va centrado en su parte;
// los conectores usan esos mismos centros (utils/bracketModel.js → slotCenter), así siempre coinciden con
// las tarjetas sin importar su alto. Lo que se dibuje encima de una tarjeta (p. ej. el rótulo de la final)
// debe ir en posición absoluta para no correr su centro.
export const BracketBoard = memo(function BracketBoard({
  columns,
  connectors,
  renderMatch,
  renderLabel,
  columnWidth = 'minmax(0, 1fr)',
  connectorWidth = '40px',
  slotPadding = '12px 0',
  connectorStroke = () => 'rgba(255,255,255,0.2)',
  strokeWidth = 2.5,
  className = '',
  style,
}) {
  const template = columns
    .map((_, index) => (index < columns.length - 1 ? `${columnWidth} ${connectorWidth}` : columnWidth))
    .join(' ');
  const hasLabels = typeof renderLabel === 'function';
  const bodyRow = hasLabels ? 2 : 1;

  return (
    <div
      className={className}
      style={{ display: 'grid', gridTemplateColumns: template, gridTemplateRows: hasLabels ? 'auto 1fr' : '1fr', ...style }}
      data-bracket-columns={columns.length}
    >
      {hasLabels && columns.map((column, index) => (
        <div key={`label-${column.id}`} style={{ gridColumn: index * 2 + 1, gridRow: 1 }} className="min-w-0">
          {renderLabel(column)}
        </div>
      ))}

      {columns.map((column, index) => (
        <div
          key={column.id}
          style={{ gridColumn: index * 2 + 1, gridRow: bodyRow }}
          className="flex flex-col min-w-0 min-h-0"
          data-bracket-column={column.id}
        >
          {column.entries.map(entry => (
            <div
              key={entry.key}
              className="flex-1 flex items-center justify-center relative min-w-0 min-h-0"
              style={{ padding: slotPadding }}
              data-bracket-slot={entry.key}
            >
              {renderMatch(entry, column)}
            </div>
          ))}
        </div>
      ))}

      {connectors.map((connector, index) => (
        <div
          key={connector.id}
          style={{ gridColumn: index * 2 + 2, gridRow: bodyRow }}
          className="relative min-w-0"
          aria-hidden="true"
        >
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
            {connector.paths.map(d => (
              <path
                key={d}
                d={d}
                stroke={connectorStroke(connector)}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
});

export default BracketBoard;
