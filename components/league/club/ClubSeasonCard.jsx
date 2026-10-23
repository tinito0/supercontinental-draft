import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/* La campaña en curso del club en la Supercontinental, leída de la tabla oficial del torneo (tournament.league).
   Se muestra solo cuando el club ya jugó. */

const GOLD_CUP_PLACES = 8;
const SILVER_CUP_PLACES = 12;

/** Posición y números del club en la tabla, o null si no figura o no jugó. */
export function clubStanding(tournament, teamName) {
  const key = String(teamName || '').trim().toLowerCase();
  if (!key) return null;
  const rows = (tournament?.league || []).filter(row => row?.name && row.name !== 'Club...');
  const index = rows.findIndex(row => String(row.name).trim().toLowerCase() === key);
  if (index === -1 || !(Number(rows[index].pj) > 0)) return null;
  const row = rows[index];
  const gf = Number(row.gf) || 0;
  const gc = Number(row.gc) || 0;
  return {
    position: index + 1,
    teams: rows.length,
    zone: index < GOLD_CUP_PLACES ? 'Zona Copa de Oro' : index < SILVER_CUP_PLACES ? 'Zona Copa de Plata' : '',
    stats: [['PTS', Number(row.pts) || 0], ['PJ', Number(row.pj) || 0], ['G', Number(row.pg) || 0], ['P', Number(row.pp) || 0], ['GF', gf], ['GC', gc], ['DG', gf - gc > 0 ? `+${gf - gc}` : gf - gc]],
  };
}

export function ClubSeasonCard({ standing, title = 'Esta temporada' }) {
  if (!standing) return null;
  return (
    <section aria-labelledby="club-current" className="panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="club-current" className="font-display text-lg font-bold uppercase tracking-wide text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-2">Supercontinental League · Fase suiza</p>
        </div>
        <p className="text-right">
          <span className="num font-display text-5xl font-bold leading-none text-ink">{standing.position}°</span>
          <span className="block text-sm font-medium text-ink-2">de {standing.teams}{standing.zone ? ` · ${standing.zone}` : ''}</span>
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-7 gap-1 border-t border-line/10 pt-4 text-center">
        {standing.stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-ink-2">{label}</dt>
            <dd className="num font-display text-xl font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <Link to="/torneo" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-soft hover:text-ink">
        Ver la tabla completa <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export default ClubSeasonCard;
