import React, { useMemo } from 'react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { StoryText } from '../../components/league/StoryText.jsx';
import { HistoryChapters, hasChapterHeadings } from '../../components/league/HistoryChapters.jsx';
import { LEAGUE_NAME } from '../../components/landing/leagueLinks.js';
import { useLeagueContent } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { LEAGUE_HISTORY_DOC, toChapters } from '../../utils/leagueContent.js';

/**
 * How the league started and grew, written in Administración → Web pública. With chapter headings
 * («## 2024 | Los orígenes») it reads as a timeline; without them, as plain paragraphs.
 */
export default function LeagueHistoryScreen() {
  useDocumentTitle('Historia');
  const { content, loading, error } = useLeagueContent(LEAGUE_HISTORY_DOC);
  const chapters = useMemo(() => toChapters(content?.body), [content?.body]);
  const showChapters = !loading && !error && hasChapterHeadings(chapters);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Historia de la liga">
          Cómo surgió la {LEAGUE_NAME} y cómo llegó hasta acá.
        </SectionHeading>
      </Reveal>
      {showChapters ? (
        <HistoryChapters chapters={chapters} />
      ) : (
        <StoryText
          body={content?.body}
          loading={loading}
          error={error}
          emptyTitle="La historia todavía no se cargó"
          emptyDescription="Muy pronto vas a poder leer cómo nació la liga."
        />
      )}
    </section>
  );
}
