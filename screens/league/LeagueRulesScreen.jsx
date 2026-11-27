import React from 'react';
import { BookOpen } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { useLeagueContent } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { SEASON_RULES_DOC } from '../../utils/leagueContent.js';
import { RuleBody } from '../../components/league/RuleBody.jsx';

const chapterAnchor = index => `capitulo-${index + 1}`;

function RulesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <div key={i} className="space-y-3">
          <div className="skeleton h-6 w-1/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

/** Ordered chapter links; shared by the collapsed phone index and the sticky desktop one. */
function ChapterList({ chapters }) {
  return (
    <ol className="space-y-1">
      {chapters.map((chapter, index) => (
        <li key={chapter.id}>
          <a href={`#${chapterAnchor(index)}`} className="flex min-h-11 items-baseline gap-2 rounded-lg px-2 py-2 text-[15px] text-ink-2 transition-colors hover:bg-white/[0.04] hover:text-ink">
            <span className="num w-6 shrink-0 text-right text-ink-3">{index + 1}.</span> {chapter.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** The season's competition rules, by chapters, written in Administración → Web pública. */
export default function LeagueRulesScreen() {
  useDocumentTitle('Reglamento');
  const { content, loading, error } = useLeagueContent(SEASON_RULES_DOC);
  const chapters = content?.chapters || [];

  let body;
  if (error) body = <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  else if (loading) body = <RulesSkeleton />;
  else if (chapters.length === 0) {
    body = <EmptyState icon={BookOpen} title="El reglamento de la temporada todavía no se cargó" description="Acá vas a encontrar el formato de la competencia y sus reglas." />;
  } else {
    body = (
      <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
        {chapters.length > 1 && (
          <>
            {/* Phones: the index is collapsed so the first rule is not pushed down by up to 40 links. */}
            <details className="panel lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-semibold text-ink">Capítulos ({chapters.length})</summary>
              <nav aria-label="Capítulos del reglamento" className="px-2 pb-2">
                <ChapterList chapters={chapters} />
              </nav>
            </details>
            <nav aria-label="Capítulos del reglamento" className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto">
              <p className="eyebrow mb-3">Capítulos</p>
              <ChapterList chapters={chapters} />
            </nav>
          </>
        )}
        <div className={`space-y-12 ${chapters.length > 1 ? '' : 'lg:col-span-2'}`}>
          {chapters.map((chapter, index) => (
            <article key={chapter.id} id={chapterAnchor(index)} className="scroll-mt-24">
              <h2 className="flex items-baseline gap-3 border-b border-line/[0.14] pb-3 font-display text-2xl font-bold uppercase leading-tight tracking-wide text-ink sm:text-display">
                <span className="num text-accent-soft">{index + 1}.</span> {chapter.title}
              </h2>
              <div className="mt-5">
                <RuleBody body={chapter.body} />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="Reglamento">
          {content?.season ? `${content.season}. Las reglas de la competencia.` : 'Las reglas de la competencia de esta temporada.'}
        </SectionHeading>
      </Reveal>
      {body}
    </section>
  );
}
