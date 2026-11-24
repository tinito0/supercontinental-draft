import React from 'react';
import { Contact } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { formatClubMembers } from '../../../utils/leagueContent.js';

/* Pestaña «Socios» de la página del club: cuántos socios tiene, el número que carga el admin en Web pública → Clubes. */

export function ClubMembers({ members, teamName, loading }) {
  if (loading) return <div className="skeleton h-48 rounded-xl" aria-label="Cargando socios" />;
  const count = formatClubMembers(members);
  if (!count) {
    return (
      <EmptyState icon={Contact} title="Este club todavía no cargó sus socios"
        description="Cuando el club sume su cantidad de socios, va a aparecer acá." />
    );
  }

  return (
    <section aria-labelledby="club-members" className="panel flex flex-col items-center gap-2 px-6 py-12 text-center sm:py-16">
      <h2 id="club-members" className="eyebrow">Socios{teamName ? ` de ${teamName}` : ''}</h2>
      <p className="num font-display text-7xl font-bold leading-none tracking-tight text-ink sm:text-8xl">{count}</p>
      <p className="text-lg text-ink-2">{members === 1 ? 'socio' : 'socios'}</p>
    </section>
  );
}
