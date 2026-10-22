import React, { memo } from 'react';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { BroadcastFrame } from './BroadcastFrame.jsx';

// Tabla de la liga para OBS (escena «tabla», lienzo de 1920×1080) con el marco de la transmisión. Lee las mismas filas
// que LeagueTableView (localData.league); solo muestra, no edita.

const COLUMNS = [
  ['pj', 'PJ'],
  ['pg', 'G'],
  ['gpen', 'GP'],
  ['pp', 'P'],
  ['gf', 'GF'],
  ['gc', 'GC'],
];

export const BroadcastLeagueTable = memo(function BroadcastLeagueTable({ league, getTeamLogo }) {
  const rows = (league || []).filter(team => team.name && team.name !== 'Club...').slice(0, 12);
  return (
    <div className="scl-broadcast scl-stage">
      <BroadcastFrame
        className="scl-table-frame"
        kicker="Supercontinental League"
        title="Tabla de posiciones"
        aside="PG 2 · GPEN 1 · PP 0"
      >
        {rows.length === 0 ? (
          <div className="broadcast-empty">Sin datos cargados</div>
        ) : (
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
                const logo = (getTeamLogo && getTeamLogo(team.name)) || DEFAULT_LOGO;
                const diff = (Number(team.gf) || 0) - (Number(team.gc) || 0);
                return (
                  <tr key={team.id || team.name}>
                    <td className="scl-table-pos">{index + 1}</td>
                    <td className="scl-table-club">
                      <div className="scl-table-team">
                        <img src={logo} alt="" width={40} height={40} onError={event => { event.currentTarget.src = DEFAULT_LOGO; }} />
                        <span title={team.name}>{team.name}</span>
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
        )}
      </BroadcastFrame>
    </div>
  );
});

export default BroadcastLeagueTable;
