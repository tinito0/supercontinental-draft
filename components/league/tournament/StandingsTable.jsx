import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { LeagueCrest } from '../match/FixtureRow.jsx';
import { LiveDot, RankMove } from '../RankMove.jsx';
import { useRankShift } from '../../../hooks/useRankShift.js';
import { LEAGUE_POINTS } from '../../../utils/competitionRules.js';

/* Tabla completa de la Supercontinental para la web pública (/torneo): posiciones en el orden oficial
   (tournament.league), zonas de copa marcadas a la izquierda y una leyenda. En el teléfono quedan PJ, DG y PTS;
   desde sm aparecen G, GP, P, GF y GC. */

const GOLD_CUP_PLACES = 8;
const SILVER_CUP_PLACES = 12;

const zoneOf = index => (index < GOLD_CUP_PLACES ? 'oro' : index < SILVER_CUP_PLACES ? 'plata' : null);
const ZONE_BAR = { oro: 'bg-accent', plata: 'bg-ink-3' };

const COLUMNS = [
  { key: 'pj', label: 'PJ', title: 'Partidos jugados', always: true },
  { key: 'pg', label: 'G', title: 'Ganados' },
  { key: 'gpen', label: 'GP', title: 'Ganados por penales' },
  { key: 'pp', label: 'P', title: 'Perdidos' },
  { key: 'gf', label: 'GF', title: 'Goles a favor' },
  { key: 'gc', label: 'GC', title: 'Goles en contra' },
  { key: 'dg', label: 'DG', title: 'Diferencia de gol', always: true },
];

/** Antes del primer partido el orden de tournament.league es solo el de carga: clubes inscriptos, sin puestos ni zonas. */
function Entrants({ rows, clubOf }) {
  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden p-0">
        <h2 className="section-title px-4 pt-4">Clubes inscriptos</h2>
        <ul className="mt-2 grid grid-cols-1 gap-x-6 px-4 sm:grid-cols-2">
          {rows.map(row => {
            const club = clubOf(row.name);
            const name = (
              <>
                <LeagueCrest name={row.name} club={club} size="md" />
                <span className="truncate font-semibold text-ink">{row.name}</span>
              </>
            );
            return (
              <li key={row.id || row.name} className="min-w-0 border-t border-line/10">
                {club?.id
                  ? <Link to={`/equipos/${club.id}`} className="flex min-h-12 min-w-0 items-center gap-3 hover:[&>span]:text-accent-soft">{name}</Link>
                  : <span className="flex min-h-12 min-w-0 items-center gap-3">{name}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-sm text-ink-2">
        La tabla arranca con el primer partido. Del 1.° al {GOLD_CUP_PLACES}.° van a la Copa de Oro; del {GOLD_CUP_PLACES + 1}.° al {SILVER_CUP_PLACES}.°, a la Copa de Plata.
        Ganado en los 90: {LEAGUE_POINTS.REGULATION_WIN} pts · ganado por penales: {LEAGUE_POINTS.SHOOTOUT_WIN} pt · perdido: {LEAGUE_POINTS.LOSS}.
      </p>
    </div>
  );
}

/** En la tabla en vivo, debajo del puesto: punto rojo si el club está jugando y cuántos puestos sube o baja. */
function LiveMarks({ row }) {
  // Every row of a live table keeps this line, empty or not, so rows don't change height as clubs move.
  return (
    <span className="mt-1 flex h-3.5 items-center justify-center gap-1">
      {row.isLive && <LiveDot pendingShootout={row.pendingShootout} />}
      <RankMove move={row.move} />
    </span>
  );
}

/**
 * @param {{ rows: Array<object>, clubOf: (name: string) => object | null, isLive?: boolean }} props
 *   rows: tournament.league, o la proyección de utils/liveTable.js con isLive
 */
export function StandingsTable({ rows, clubOf, isLive = false }) {
  const bodyRef = useRef(null);
  useRankShift(bodyRef, rows.map(row => row.id || row.name).join('|'));
  if (!rows.some(row => Number(row.pj) > 0)) return <Entrants rows={rows} clubOf={clubOf} />;
  return (
    <div className="space-y-3">
      {isLive && (
        <p className="flex items-baseline gap-2 text-sm text-ink-2" role="status">
          <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-danger animate-pulse" aria-hidden="true" />
          <span><strong className="font-semibold text-danger-soft">Tabla en vivo:</strong> suma los partidos que se están jugando con el marcador de ahora. Un empate no suma puntos hasta los penales.</span>
        </p>
      )}
      <div className="panel overflow-hidden">
        <table className="w-full text-left">
          <caption className="sr-only">Tabla de posiciones de la SuperContinental League</caption>
          <thead>
            <tr className="border-b border-line/10 text-sm text-ink-2">
              <th scope="col" className="w-12 py-3 pl-4 pr-2 text-center font-semibold">#</th>
              <th scope="col" className="py-3 pr-2 font-semibold">Club</th>
              {COLUMNS.map(col => (
                <th key={col.key} scope="col" className={`w-11 px-1 py-3 text-center font-semibold ${col.always ? '' : 'hidden sm:table-cell'}`}>
                  <abbr title={col.title} className="no-underline">{col.label}</abbr>
                </th>
              ))}
              <th scope="col" className="w-14 py-3 pl-1 pr-4 text-center font-bold text-ink"><abbr title="Puntos" className="no-underline">PTS</abbr></th>
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {rows.map((row, index) => {
              const zone = zoneOf(index);
              const club = clubOf(row.name);
              const gf = Number(row.gf) || 0;
              const gc = Number(row.gc) || 0;
              const values = { pj: Number(row.pj) || 0, pg: Number(row.pg) || 0, gpen: Number(row.gpen) || 0, pp: Number(row.pp) || 0, gf, gc, dg: gf - gc > 0 ? `+${gf - gc}` : gf - gc };
              const name = (
                <span className="flex min-w-0 items-center gap-3">
                  <LeagueCrest name={row.name} club={club} size="md" />
                  <span className="club-name line-clamp-2 break-words font-semibold leading-tight text-ink">{row.name}</span>
                </span>
              );
              return (
                <tr key={row.id || row.name} data-rank-key={row.id || row.name} className={`border-t ${index === GOLD_CUP_PLACES || index === SILVER_CUP_PLACES ? 'border-line/30' : 'border-line/10'}`}>
                  <td className="relative py-3 pl-4 pr-2 text-center">
                    {zone && <span className={`absolute inset-y-1 left-0 w-1 rounded-r ${ZONE_BAR[zone]}`} aria-hidden="true" />}
                    <span data-rank-flash className="num inline-block font-display text-lg font-bold text-ink">{index + 1}</span>
                    {isLive && <LiveMarks row={row} />}
                    {zone && <span className="sr-only">{zone === 'oro' ? ', zona Copa de Oro' : ', zona Copa de Plata'}</span>}
                  </td>
                  <td className="max-w-0 py-2 pr-2">
                    {club?.id ? <Link to={`/equipos/${club.id}`} className="block min-h-11 py-1.5 hover:[&_.club-name]:text-accent-soft">{name}</Link> : name}
                  </td>
                  {COLUMNS.map(col => (
                    <td key={col.key} className={`num px-1 py-3 text-center text-ink ${col.always ? '' : 'hidden sm:table-cell'}`}>{values[col.key]}</td>
                  ))}
                  <td className="num py-3 pl-1 pr-4 text-center font-display text-xl font-bold text-ink">{Number(row.pts) || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2" aria-label="Referencias">
        <li className="flex items-center gap-2"><span className="h-3 w-1 rounded bg-accent" aria-hidden="true" />1.° a 8.°: Copa de Oro</li>
        <li className="flex items-center gap-2"><span className="h-3 w-1 rounded bg-ink-3" aria-hidden="true" />9.° a 12.°: Copa de Plata</li>
        <li>Ganado en los 90: {LEAGUE_POINTS.REGULATION_WIN} pts · ganado por penales (GP): {LEAGUE_POINTS.SHOOTOUT_WIN} pt · perdido: {LEAGUE_POINTS.LOSS}</li>
        <li className="w-full text-ink-3">Abreviaturas: PJ partidos jugados · G ganados · GP ganados por penales · P perdidos · GF goles a favor · GC goles en contra · DG diferencia de gol · PTS puntos</li>
      </ul>
    </div>
  );
}

export default StandingsTable;
