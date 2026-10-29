import React, { memo } from 'react';
import { BroadcastFrame } from './BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from './BroadcastCrest.jsx';

// Tabla de la liga para OBS (escena «tabla», lienzo de 1920×1080) con el marco de la transmisión. Lee las filas
// guardadas del torneo, que ya están en el orden oficial (desempates del reglamento); solo muestra, no edita.
// Puestos 1-8 a la Copa de Oro y 9-12 a la Copa de Plata (bracketModel.goldCupQuarterFinals / advanceCups).

const COLUMNS = [
  ['pj', 'PJ'],
  ['pg', 'G'],
  ['gpen', 'GP'],
  ['pp', 'P'],
  ['gf', 'GF'],
  ['gc', 'GC'],
];
const GOLD_CUP_PLACES = 8;

export const BroadcastLeagueTable = memo(function BroadcastLeagueTable({ league, getTeamLogo }) {
  const rows = (league || []).filter(team => team.name && team.name !== 'Club...').slice(0, 12);
  return (
    <div className="scl-stage">
      <BroadcastFrame
        className="scl-table-frame"
        kicker="Supercontinental League"
        title="Tabla de posiciones"
        aside="PG 2 · GPEN 1 · PP 0"
      >
        {rows.length === 0 ? (
          <div className="broadcast-empty">Sin datos cargados</div>
        ) : (
          <>
            <table className="scl-table">
              <thead>
                <tr>
                  <th className="scl-table-pos">#</th>
                  <th className="scl-table-club">Club</th>
                  {COLUMNS.map(([key, label]) => <th key={key}>{label}</th>)}
                  <th>DG</th>
                  <th className="scl-table-pts">PTS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((team, index) => {
                  const diff = (Number(team.gf) || 0) - (Number(team.gc) || 0);
                  const zone = [index >= GOLD_CUP_PLACES ? 'is-plata' : 'is-oro', index === GOLD_CUP_PLACES ? 'is-zone-break' : ''].join(' ');
                  return (
                    <tr key={team.id || team.name} className={zone}>
                      <td className="scl-table-pos">{index + 1}</td>
                      <td className="scl-table-club">
                        <div className="scl-table-team">
                          <BroadcastCrest name={team.name} logo={getTeamLogo?.(team.name)} />
                          <span className={isLongName(team.name) ? 'is-long-name' : undefined} title={team.name}>{team.name}</span>
                        </div>
                      </td>
                      {COLUMNS.map(([key]) => <td key={key}>{Number(team[key]) || 0}</td>)}
                      <td>{diff > 0 ? `+${diff}` : diff}</td>
                      <td className="scl-table-pts">{Number(team.pts) || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > GOLD_CUP_PLACES && (
              <div className="scl-table-legend">
                <span><i aria-hidden="true" />1-8 · Copa de Oro</span>
                <span><i className="is-plata" aria-hidden="true" />9-12 · Copa de Plata</span>
              </div>
            )}
          </>
        )}
      </BroadcastFrame>
    </div>
  );
});

export default BroadcastLeagueTable;
