import React from 'react';
import { ArrowLeft, Replace } from 'lucide-react';
import { TeamBadge, TeamColourBand } from './TeamBadge.jsx';

/** Identity of the open team: badge, name, metadata line, colour band and team-level actions. */
export function TeamHeader({ teamId, headingId, identity, colours, meta, accessNote, saved, onBack, onReplace }) {
  return (
    <header className="panel-flat overflow-hidden">
      <TeamColourBand colours={colours} />
      <div className="p-4 sm:p-5">
        {onBack && (
          <button type="button" onClick={onBack} className="btn btn-ghost btn-sm -ml-2 mb-3">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />Equipos
          </button>
        )}
        <div className="flex flex-wrap items-start gap-4">
          <TeamBadge abbr={identity.abbr} colours={colours} size="lg" />
          <div className="min-w-[12rem] flex-1">
            <h2 id={headingId} tabIndex={-1} className="outline-none font-display text-2xl sm:text-3xl font-bold text-ink leading-tight [text-wrap:balance]">
              {identity.name || '(sin nombre)'}
              {identity.abbr && <span className="num ml-2 text-lg sm:text-xl font-semibold text-ink-3">{identity.abbr}</span>}
            </h2>
            <p className="mt-1 text-sm text-ink-3">
              <span className="num">{teamId}</span>
              {meta.map(m => <React.Fragment key={m}> · {m}</React.Fragment>)}
            </p>
            <p className="mt-1 text-xs text-ink-3">{accessNote || saved}</p>
          </div>
          {onReplace && (
            <button type="button" onClick={onReplace} className="btn btn-danger btn-sm">
              <Replace className="w-4 h-4" aria-hidden="true" />Reemplazar equipo
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
