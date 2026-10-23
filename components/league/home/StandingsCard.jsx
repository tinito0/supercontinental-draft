import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { LeagueCrest } from '../match/FixtureRow.jsx';

/* Tabla de la liga en la portada: el orden guardado del torneo (ya con los desempates del reglamento), con las
   zonas de clasificación: 1-8 Copa de Oro, 9-12 Copa de Plata. */

const GOLD_CUP_PLACES = 8;

export function StandingsCard({ tournament, clubOf, loading }) {
  const rows = (tournament?.league || []).filter(row => row?.name && row.name !== 'Club...').slice(0, 12);
  const played = rows.some(row => Number(row.pj) > 0);

  let body;
  if (loading) body = <div className="space-y-2 p-4" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-9 skeleton" />)}</div>;
  else if (!rows.length) body = <div className="p-4"><EmptyState icon={LayoutGrid} title="La tabla todavía no está armada" description="Aparece cuando se cargan los clubes del torneo." /></div>;
  else {
    body = (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Tabla de posiciones de la liga</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wider text-ink-3">
              <th scope="col" className="w-10 py-2 pl-4 text-left font-semibold">#</th>
              <th scope="col" className="py-2 text-left font-semibold">Club</th>
              <th scope="col" className="w-10 py-2 text-center font-semibold"><abbr title="Partidos jugados" className="no-underline">PJ</abbr></th>
              <th scope="col" className="w-12 py-2 text-center font-semibold"><abbr title="Diferencia de gol" className="no-underline">DG</abbr></th>
              <th scope="col" className="w-14 py-2 pr-4 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const diff = (Number(row.gf) || 0) - (Number(row.gc) || 0);
              const isGold = index < GOLD_CUP_PLACES;
              const club = clubOf(row.name);
              return (
                <tr key={row.id || row.name} className={`border-t ${index === GOLD_CUP_PLACES ? 'border-line/30' : 'border-line/10'}`}>
                  <td className="relative py-2 pl-4">
                    <span className={`absolute inset-y-1 left-0 w-1 rounded-r ${isGold ? 'bg-accent' : 'bg-ink-3'}`} aria-hidden="true" />
                    <span className="num font-display text-base font-bold text-ink">{index + 1}</span>
                    <span className="sr-only">{isGold ? ', zona Copa de Oro' : ', zona Copa de Plata'}</span>
                  </td>
                  <td className="max-w-0 py-2">
                    {club ? (
                      <Link to={`/equipos/${club.id}`} className="flex min-w-0 items-center gap-2.5 hover:text-ink">
                        <LeagueCrest name={row.name} club={club} size="sm" />
                        <span className="truncate font-medium text-ink">{row.name}</span>
                      </Link>
                    ) : (
                      <span className="flex min-w-0 items-center gap-2.5">
                        <LeagueCrest name={row.name} club={null} size="sm" />
                        <span className="truncate font-medium text-ink">{row.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="num py-2 text-center text-ink-2">{Number(row.pj) || 0}</td>
                  <td className="num py-2 text-center text-ink-2">{diff > 0 ? `+${diff}` : diff}</td>
                  <td className="num py-2 pr-4 text-right font-display text-base font-bold text-ink">{Number(row.pts) || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/10 px-4 py-3 text-sm text-ink-2">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-1 rounded bg-accent" aria-hidden="true" />1.° a 8.°: Copa de Oro</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-1 rounded bg-ink-3" aria-hidden="true" />9.° a 12.°: Copa de Plata</span>
          {!played && <span>Sin partidos jugados todavía</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h3 className="section-title">Tabla</h3>
        <Link to="/torneo" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
          Tabla completa <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {body}
    </div>
  );
}

export default StandingsCard;
