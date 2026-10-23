import React from 'react';
import { FileText } from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { Alert } from '../../ui/Alert.jsx';

/* Historia del club como capítulos (utils/leagueContent.js clubChapters): a la izquierda la época y el título con un
   borde de acento, a la derecha el relato. El capítulo de cierre va a ancho completo y resaltado.
   Texto plano, nunca HTML. */

function ChapterBody({ paragraphs, className = '' }) {
  return (
    <div className={`space-y-4 text-lg leading-relaxed text-ink ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  );
}

function Chapter({ chapter }) {
  const { era, title, paragraphs } = chapter;
  if (!era && !title) {
    return <section className="panel p-5 sm:p-8"><ChapterBody paragraphs={paragraphs} className="max-w-[68ch]" /></section>;
  }
  return (
    <section className="panel grid grid-cols-1 gap-5 p-5 sm:p-8 md:grid-cols-12 md:gap-8">
      <header className="border-l-4 border-accent pl-4 md:col-span-4">
        {era && <p className="text-sm font-semibold uppercase tracking-wider text-accent-soft">{era}</p>}
        {title && <h3 className="mt-1 font-display text-2xl font-bold uppercase leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">{title}</h3>}
      </header>
      <ChapterBody paragraphs={paragraphs} className="md:col-span-8" />
    </section>
  );
}

function ClosingChapter({ chapter }) {
  const { era, title, paragraphs } = chapter;
  return (
    <section className="panel border-accent/40 bg-gradient-to-r from-accent/15 to-transparent p-6 text-center sm:p-10">
      {era && <p className="text-sm font-semibold uppercase tracking-wider text-accent-soft">{era}</p>}
      {title && <h3 className="mt-1 font-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink sm:text-4xl">{title}</h3>}
      <ChapterBody paragraphs={paragraphs} className="mx-auto mt-4 max-w-[68ch]" />
    </section>
  );
}

export function ClubStory({ chapters, loading, error, emptyTitle, emptyDescription }) {
  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (chapters.length === 0) return <EmptyState icon={FileText} title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="space-y-6">
      {chapters.map((chapter, index) => (
        chapter.closing
          ? <ClosingChapter key={index} chapter={chapter} />
          : <Chapter key={index} chapter={chapter} />
      ))}
    </div>
  );
}

export default ClubStory;
