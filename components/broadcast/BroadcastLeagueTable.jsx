import React, { memo, useMemo, useRef } from 'react';
import { BroadcastFrame } from './BroadcastFrame.jsx';
import { BroadcastCrest, isLongName } from './BroadcastCrest.jsx';
import { projectLiveTable } from '../../utils/liveTable.js';
import { useRankShift } from '../../hooks/useRankShift.js';

// Tabla de la liga para OBS (escena «tabla», lienzo de 1920×1080) con el marco de la transmisión. Fuera de los
// partidos muestra las filas guardadas del torneo, en el orden oficial (desempates del reglamento). Mientras se juega
// un partido de liga es la tabla en vivo (utils/liveTable.js), igual que en la web: cada gol reordena, las filas se
// deslizan a su puesto y una flecha dice cuántos puestos sube o baja cada club. Solo muestra, no edita.
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
// El deslizamiento usa la curva de la transmisión (docs/DESIGN_SYSTEM.md «OBS overlay»).
const OBS_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function Move({ move }) {
  if (!move) return null;
  const up = move > 0;
  return (
    // <b>, no <span>: `.scl-table-team span` es el nombre del club (mayúsculas, recorte con puntos).
    <b className={`scl-table-move ${up ? 'is-up' : 'is-down'}`} aria-label={`${up ? 'sube' : 'baja'} ${Math.abs(move)}`}>
      <i aria-hidden="true">{up ? '▲' : '▼'}</i>{Math.abs(move)}
    </b>
  );
}

/**
 * @param {{ league: object[], fixtures?: object[], getTeamLogo?: (name: string) => string|null }} props
 *   fixtures: utils/leagueFixtures.buildFixtures, con el partido en vivo vinculado; sin él la tabla es la oficial
 */
export const BroadcastLeagueTable = memo(function BroadcastLeagueTable({ league, fixtures = [], getTeamLogo }) {
  const official = useMemo(() => (league || []).filter(team => team.name && team.name !== 'Club...').slice(0, 12), [league]);
  const live = useMemo(() => projectLiveTable(official, fixtures), [official, fixtures]);
  const rows = live || official;
  const bodyRef = useRef(null);
  useRankShift(bodyRef, rows.map(team => team.id || team.name).join('|'), OBS_EASE);
  return (
    <div className="scl-stage">
      <BroadcastFrame
        className="scl-table-frame"
        kicker="Supercontinental League"
        title={live ? 'Tabla en vivo' : 'Tabla de posiciones'}
        aside={live ? 'Con el marcador de ahora' : 'PG 2 · GPEN 1 · PP 0'}
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
              <tbody ref={bodyRef}>
                {rows.map((team, index) => {
                  const diff = (Number(team.gf) || 0) - (Number(team.gc) || 0);
                  const zone = [index >= GOLD_CUP_PLACES ? 'is-plata' : 'is-oro', index === GOLD_CUP_PLACES ? 'is-zone-break' : '', team.isLive ? 'is-live' : ''].join(' ');
                  return (
                    <tr key={team.id || team.name} data-rank-key={team.id || team.name} className={zone}>
                      <td className="scl-table-pos"><span data-rank-flash>{index + 1}</span></td>
                      <td className="scl-table-club">
                        <div className="scl-table-team">
                          <BroadcastCrest name={team.name} logo={getTeamLogo?.(team.name)} />
                          <span className={isLongName(team.name) ? 'is-long-name' : undefined} title={team.name}>{team.name}</span>
                          {team.isLive && <i className="scl-table-live" aria-label="jugando ahora" />}
                          <Move move={team.move} />
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
                {live && <span className="scl-table-legend-note">Empate: suma recién en los penales</span>}
              </div>
            )}
          </>
        )}
      </BroadcastFrame>
    </div>
  );
});

export default BroadcastLeagueTable;
