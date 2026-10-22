import React from 'react';
import { useParams } from 'react-router-dom';
import TeamScreen from '../TeamScreen.jsx';
import { StoryText } from '../../components/league/StoryText.jsx';
import { useLeagueContent } from '../../hooks/useLeagueData.js';
import { clubStoryDocId } from '../../utils/leagueContent.js';

/** A club on the league site: its history (Administración → Web pública), then its squad and campaign. */
export default function LeagueClubScreen() {
  const { userId } = useParams();
  const { content, loading, error } = useLeagueContent(userId ? clubStoryDocId(userId) : null);

  const history = (
    <section aria-labelledby="club-history" className="border-b border-line/10">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h2 id="club-history" className="mb-5 font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">
          Historia del club
        </h2>
        <StoryText
          body={content?.body}
          loading={loading}
          error={error}
          emptyTitle="La historia de este club todavía no se cargó"
          emptyDescription="Mientras tanto, mirá su plantel y su campaña en el torneo."
        />
      </div>
    </section>
  );

  return <TeamScreen isLeagueSite afterHeader={history} />;
}
