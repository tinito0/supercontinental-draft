import React from 'react';
import { SocialLinks } from './FollowLeague.jsx';
import { LEAGUE_NAME } from './leagueLinks.js';

/* Pieces shared by the two public fronts, so they look the same: the draft landing (screens/LandingPage.jsx)
   and the league site (screens/league/). Styles in landing.css. */

/** Big uppercase section title with an optional one-paragraph intro and an optional link on the right («Ver todo»). */
export function SectionHeading({ id, title, children, as: Tag = 'h2', action = null }) {
  if (action) {
    return (
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 md:mb-8">
        <div className="max-w-[65ch]">
          <Tag id={id} className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink [text-wrap:balance] md:text-4xl">{title}</Tag>
          {children && <p className="mt-3 text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">{children}</p>}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    );
  }
  if (Tag === 'h1') {
    // Título de una página interna: el título grande y una línea que separa el contenido.
    return (
      <div className="mb-8 border-b border-line/10 pb-8 md:mb-10 md:pb-10">
        <h1 id={id} className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-ink [text-wrap:balance] md:text-5xl">{title}</h1>
        {children && <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">{children}</p>}
      </div>
    );
  }
  return (
    <div className="mb-8 max-w-[65ch] md:mb-10">
      <Tag id={id} className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink [text-wrap:balance] md:text-4xl">{title}</Tag>
      {children && <p className="mt-3 text-lg leading-relaxed text-ink-2 [text-wrap:pretty]">{children}</p>}
    </div>
  );
}

/** Fixed translucent header: brand on the left, then whatever the page puts in it. */
export function SiteNav({ brand, children }) {
  return (
    <header className="landing-nav fixed inset-x-0 top-0 z-sticky border-b border-line/10">
      <nav aria-label="Principal" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {brand}
        {children}
      </nav>
    </header>
  );
}

/** Crest + short/long name, the brand shown in the header. */
export function SiteBrand({ shortName, name }) {
  return (
    <>
      <img src="/landing/crest.webp" alt="" width="32" height="32" className="h-8 w-8" />
      <span className="truncate font-display text-lg font-bold uppercase tracking-wide text-ink">
        <span className="sm:hidden">{shortName}</span>
        <span className="hidden sm:inline">{name}</span>
      </span>
    </>
  );
}

/** Footer: crest, name, copyright line and the league's social links. */
export function SiteFooter({ name, children }) {
  return (
    <footer className="border-t border-line/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img src="/landing/crest.webp" alt="" width="24" height="24" loading="lazy" className="h-6 w-6" />
            <span className="font-display font-bold uppercase tracking-wide text-ink">{name}</span>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            © {new Date().getFullYear()} {LEAGUE_NAME}. Una liga de eFootball PES 2021 hecha para disfrutar con amigos.
          </p>
          {children}
        </div>
        <SocialLinks />
      </div>
    </footer>
  );
}
