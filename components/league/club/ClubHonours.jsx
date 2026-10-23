import React from 'react';
import { History, Trophy } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { SEASON_STATS, groupHonours } from '../../../utils/leagueContent.js';

/* Pestaña «Palmarés» de la página del club: la vitrina de títulos (de la Supercontinental, nacionales e
   internacionales) y cómo le fue temporada por temporada, con sus números cuando el admin los cargó. */

function TrophyCabinet({ honours }) {
  const groups = groupHonours(honours);
  if (!groups.length) return null;
  return (
    <div className="panel grid grid-cols-1 divide-y divide-line/10 md:grid-cols-3 md:divide-x md:divide-y-0">
      {groups.map(group => (
        <section key={group.id} aria-labelledby={`honours-${group.id}`} className="p-5">
          <div className="flex items-baseline justify-between gap-3 border-b border-line/10 pb-3">
            <h3 id={`honours-${group.id}`} className="font-display text-lg font-bold uppercase tracking-wide text-ink">{group.label}</h3>
            <span className="num font-display text-4xl font-bold leading-none text-ink" aria-label={`${group.total} títulos`}>{group.total}</span>
          </div>
          <ul className="mt-3 space-y-3">
            {group.items.map(item => (
              <li key={item.id} className="flex gap-3">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-accent-soft" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {item.name}
                    {Number(item.count) > 1 && <span className="num ml-1.5 font-normal text-ink-2">×{item.count}</span>}
                  </p>
                  {item.years && <p className="text-sm text-ink-2">{item.years}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CampaignTable({ seasons }) {
  const stats = SEASON_STATS.filter(([key]) => seasons.some(row => row[key] !== '' && row[key] != null));
  return (
    <>
      {/* Escritorio: tabla. Celular: una tarjeta por campaña, sin scroll horizontal. */}
      <div className="panel hidden overflow-hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-line/10 text-sm text-ink-2">
              <th scope="col" className="px-4 py-3 font-semibold">Temporada</th>
              <th scope="col" className="px-4 py-3 font-semibold">Competición</th>
              <th scope="col" className="px-4 py-3 font-semibold">Resultado</th>
              {stats.map(([key, short, long]) => <th key={key} scope="col" className="px-3 py-3 text-center font-semibold" title={long}><abbr title={long} className="no-underline">{short}</abbr></th>)}
            </tr>
          </thead>
          <tbody>
            {seasons.map(row => (
              <tr key={row.id} className="border-t border-line/10">
                <th scope="row" className="num px-4 py-3 font-display text-lg font-bold text-ink">{row.season}</th>
                <td className="px-4 py-3 text-ink">{row.competition || '—'}</td>
                <td className="px-4 py-3 font-semibold text-ink">{row.result}</td>
                {stats.map(([key]) => <td key={key} className="num px-3 py-3 text-center text-ink">{row[key] === '' ? '—' : row[key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {seasons.map(row => (
          <li key={row.id} className="panel p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="num font-display text-xl font-bold text-ink">{row.season}</span>
              <span className="text-right font-semibold text-ink">{row.result}</span>
            </div>
            {row.competition && <p className="text-sm text-ink-2">{row.competition}</p>}
            {stats.length > 0 && (
              <dl className="mt-3 grid grid-cols-6 gap-1 text-center">
                {stats.map(([key, short, long]) => (
                  <div key={key}>
                    <dt className="text-xs font-semibold text-ink-2"><abbr title={long} className="no-underline">{short}</abbr></dt>
                    <dd className="num font-bold text-ink">{row[key] === '' ? '—' : row[key]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * @param {{ profile: object | null, currentSeason?: React.ReactNode }} props currentSeason: la campaña en curso, del torneo
 */
export function ClubHonours({ profile, currentSeason = null }) {
  const honours = profile?.honours || [];
  const seasons = profile?.seasons || [];
  return (
    <div className="space-y-10">
      <section aria-labelledby="club-honours" className="space-y-4">
        <h2 id="club-honours" className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Palmarés</h2>
        {honours.length
          ? <TrophyCabinet honours={honours} />
          : <EmptyState icon={Trophy} title="Todavía no hay títulos cargados" description="Cuando la liga cargue el palmarés del club, sus títulos aparecen acá." />}
      </section>
      {currentSeason}
      <section aria-labelledby="club-seasons" className="space-y-4">
        <h2 id="club-seasons" className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Campañas anteriores</h2>
        {seasons.length
          ? <CampaignTable seasons={seasons} />
          : <EmptyState icon={History} title="Sin campañas anteriores cargadas" description="Acá se ve cómo le fue al club en cada temporada y competición." />}
      </section>
    </div>
  );
}

export default ClubHonours;
