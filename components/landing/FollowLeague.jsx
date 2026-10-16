import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { FEATURED_VIDEO, STREAM_CHANNEL, SOCIAL_LINKS, LEAGUE_NAME } from './leagueLinks.js';

const external = { target: '_blank', rel: 'noopener noreferrer' };

/** Social logos as 44px links. Shared by this section and the footer. */
export function SocialLinks({ className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {SOCIAL_LINKS.map(s => (
        <li key={s.name}>
          <a
            href={s.url}
            {...external}
            aria-label={`${LEAGUE_NAME} en ${s.name}`}
            title={s.name}
            className="grid h-11 w-11 place-items-center rounded-lg border border-line/[0.16] bg-raised transition-colors hover:border-line/30 hover:bg-overlay"
          >
            <img src={s.logo} alt="" width="20" height="20" className="h-5 w-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The league's public channels (from its Linktree): the latest video, the stream and the socials. */
export function FollowLeague() {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {/* The thumbnail already carries its own title art, so the caption sits below it, not on top. */}
      <a
        href={FEATURED_VIDEO.url}
        {...external}
        className="group flex flex-col overflow-hidden rounded-2xl border border-line/10 bg-surface transition-colors hover:border-line/30 md:col-span-3"
      >
        <div className="overflow-hidden bg-raised">
          <img
            src={FEATURED_VIDEO.thumbnail}
            alt={`Miniatura del video ${FEATURED_VIDEO.title}`}
            width="960"
            height="540"
            loading="lazy"
            decoding="async"
            className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        </div>
        <div className="flex flex-1 items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <p className="font-display text-2xl font-bold uppercase leading-tight text-ink">{FEATURED_VIDEO.title}</p>
            <p className="text-sm text-ink-2">Mirala completa en YouTube</p>
          </div>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-colors group-hover:bg-accent-hover" aria-hidden="true">
            <Play className="h-5 w-5 translate-x-px" fill="currentColor" />
          </span>
        </div>
      </a>

      <div className="grid gap-4 md:col-span-2">
        <a
          href={STREAM_CHANNEL.url}
          {...external}
          className="group flex flex-col justify-between gap-6 rounded-2xl border border-line/10 bg-accent-deep p-5 transition-colors hover:border-accent/50"
        >
          <div className="flex items-center justify-between">
            <img src={STREAM_CHANNEL.logo} alt="" width="28" height="28" className="h-7 w-7" />
            <ExternalLink className="h-4 w-4 text-ink-3 transition-colors group-hover:text-ink" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold uppercase text-ink">Partidos en vivo</p>
            <p className="text-sm text-ink-2">Los streams de la liga, en {STREAM_CHANNEL.handle}</p>
          </div>
        </a>

        <div className="flex flex-col justify-between gap-6 rounded-2xl border border-line/10 bg-surface p-5">
          <div>
            <p className="font-display text-2xl font-bold uppercase text-ink">Redes</p>
            <p className="text-sm text-ink-2">Resúmenes, goles y novedades.</p>
          </div>
          <SocialLinks />
        </div>
      </div>
    </div>
  );
}

export default FollowLeague;
