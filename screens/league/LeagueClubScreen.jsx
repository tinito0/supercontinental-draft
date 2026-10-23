import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Trophy, Users } from 'lucide-react';
import TeamScreen from '../TeamScreen.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { ClubStory } from '../../components/league/club/ClubStory.jsx';
import { ClubHero } from '../../components/league/club/ClubHero.jsx';
import { ClubFacts } from '../../components/league/club/ClubFacts.jsx';
import { ClubHonours } from '../../components/league/club/ClubHonours.jsx';
import { ClubSeasonCard, clubStanding } from '../../components/league/club/ClubSeasonCard.jsx';
import { useLeagueContent, useLeagueTeams, useTournament } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { clubChapters, clubStoryDocId, hasClubProfile } from '../../utils/leagueContent.js';

/* Un club en la web de la liga: cabecera con su estadio, la ficha (estadio, DT, presidente, mánager) y tres pestañas:
   el club (historia), palmarés (títulos y campañas anteriores) y plantel (el plantel y la campaña del draft).
   La pestaña vive en la URL (?tab=), así se puede compartir. */

const TABS = [
  { id: 'club', label: 'El club', icon: BookOpen },
  { id: 'palmares', label: 'Palmarés', icon: Trophy },
  { id: 'plantel', label: 'Plantel', icon: Users },
];

export default function LeagueClubScreen() {
  const { userId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(item => item.id === params.get('tab')) ? params.get('tab') : 'club';
  const { content, loading, error } = useLeagueContent(userId ? clubStoryDocId(userId) : null);
  const { teamsById, loading: teamsLoading } = useLeagueTeams();
  const { tournament } = useTournament();
  const team = teamsById?.[userId] || null;
  const profile = content?.profile || null;
  const chapters = useMemo(() => clubChapters(content), [content]);
  const standing = useMemo(() => clubStanding(tournament, team?.teamName), [tournament, team?.teamName]);
  useDocumentTitle(team?.teamName || 'Equipos');

  const setTab = next => setParams(next === 'club' ? {} : { tab: next }, { replace: true });

  return (
    <article>
      <ClubHero team={team} profile={profile} loading={teamsLoading || loading} />
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {hasClubProfile(profile) && <ClubFacts profile={profile} />}
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Secciones del club" />

        {tab === 'club' && (
          <div role="tabpanel" aria-label="El club" className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-labelledby="club-history" className="space-y-4">
              <h2 id="club-history" className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Historia del club</h2>
              <ClubStory
                chapters={chapters}
                loading={loading}
                error={error}
                emptyTitle="La historia de este club todavía no se cargó"
                emptyDescription="Mientras tanto, mirá su palmarés y su plantel en las otras pestañas."
              />
            </section>
            <div className="space-y-4">
              <ClubSeasonCard standing={standing} />
            </div>
          </div>
        )}
        {tab === 'palmares' && (
          <div role="tabpanel" aria-label="Palmarés">
            <ClubHonours profile={profile} currentSeason={<ClubSeasonCard standing={standing} title="Temporada en curso" />} />
          </div>
        )}
        {tab === 'plantel' && (
          <div role="tabpanel" aria-label="Plantel" className="-mx-4 sm:-mx-6">
            <TeamScreen isLeagueSite hideHeader />
          </div>
        )}
      </div>
    </article>
  );
}
