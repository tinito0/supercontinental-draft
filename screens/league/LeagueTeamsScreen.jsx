import React from 'react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { ClubGrid } from '../../components/league/ClubGrid.jsx';
import { useClubProfiles, useFranchisePlayers, useLeagueTeams } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function LeagueTeamsScreen() {
  useDocumentTitle('Equipos');
  const { teams, loading, error } = useLeagueTeams();
  const { byTeamId, error: profilesError } = useClubProfiles();
  const { byTeamId: franchise, error: franchiseError } = useFranchisePlayers();
  const extrasError = [profilesError, franchiseError].filter(Boolean);
  const intro = loading || error
    ? 'Los clubes de la liga.'
    : `Los ${teams.length} clubes de la liga. Entrá a cada uno para ver su estadio, su historia, sus títulos y su plantel.`;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Equipos">
          {intro}
        </SectionHeading>
      </Reveal>
      {extrasError.length > 0 && !error && (
        <Alert tone="warning" title={extrasError.join(' ')} className="mb-4">Los clubes se ven igual, pero sin esos datos. Recargá la página para intentar de nuevo.</Alert>
      )}
      <ClubGrid teams={teams} loading={loading} error={error} profiles={byTeamId} franchise={franchise} />
    </section>
  );
}
