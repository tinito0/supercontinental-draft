import React from 'react';

/* League history by chapters (utils/leagueContent.js toChapters): the era as a large figure in its own column, the
   title and the story beside it, one rule between chapters. The closing chapter («##!») sits on a tinted panel so the
   page ends on what comes next. Plain text, never HTML. */

function Paragraphs({ paragraphs, className = '' }) {
  return (
    <div className={`max-w-[65ch] space-y-4 text-lg leading-relaxed text-ink ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">{paragraph}</p>
      ))}
    </div>
  );
}

function Era({ era }) {
  if (!era) return null;
  return (
    <p className="font-display num text-5xl font-bold leading-none tracking-tight text-accent-soft md:sticky md:top-24 md:text-6xl">
      {era}
    </p>
  );
}

function Chapter({ chapter }) {
  const { era, title, paragraphs } = chapter;
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-line/[0.08] py-10 md:grid-cols-[11rem_1fr] md:gap-10 md:py-14">
      <div><Era era={era} /></div>
      <div>
        {title && (
          <h2 className="mb-5 font-display text-2xl font-bold uppercase leading-tight tracking-tight text-ink [overflow-wrap:anywhere] [text-wrap:balance] sm:text-3xl">
            {title}
          </h2>
        )}
        <Paragraphs paragraphs={paragraphs} />
      </div>
    </section>
  );
}

function ClosingChapter({ chapter }) {
  const { era, title, paragraphs } = chapter;
  return (
    <section className="mt-6 rounded-2xl border border-accent/30 bg-accent-deep/40 p-6 sm:p-10 md:grid md:grid-cols-[11rem_1fr] md:gap-10">
      <div><Era era={era} /></div>
      <div className="mt-4 md:mt-0">
        {title && (
          <h2 className="mb-4 font-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink [overflow-wrap:anywhere] [text-wrap:balance] sm:text-4xl">
            {title}
          </h2>
        )}
        <Paragraphs paragraphs={paragraphs} className="text-xl" />
      </div>
    </section>
  );
}

/** True when the text uses chapter headings («## 2024 | Título»); otherwise it stays as plain paragraphs. */
export function hasChapterHeadings(chapters) {
  return chapters.some(chapter => chapter.era || chapter.title);
}

export function HistoryChapters({ chapters }) {
  return (
    <div className="mt-4">
      {chapters.map((chapter, index) => (
        chapter.closing
          ? <ClosingChapter key={index} chapter={chapter} />
          : <Chapter key={index} chapter={chapter} />
      ))}
    </div>
  );
}

export default HistoryChapters;
