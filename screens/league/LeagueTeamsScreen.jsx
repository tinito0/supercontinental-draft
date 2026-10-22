import React from 'react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { ClubGrid } from '../../components/league/ClubGrid.jsx';
import { useLeagueTeams } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function LeagueTeamsScreen() {
  useDocumentTitle('Equipos');
  const { teams, loading, error } = useLeagueTeams();

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Equipos">
          {loading ? 'Los clubes de la liga.' : `Los ${teams.length} clubes de la liga. Entrá a cada uno para ver su plantel.`}
        </SectionHeading>
      </Reveal>
      <ClubGrid teams={teams} loading={loading} error={error} />
    </section>
  );
}
