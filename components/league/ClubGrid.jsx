import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Shield } from 'lucide-react';
import { teamCrestUrl } from '../../utils/teamCrest.js';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';

function ClubGridSkeleton({ count }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-2xl border border-line/10 bg-surface p-4">
          <div className="skeleton h-14 w-14 rounded-xl" />
          <div className="skeleton h-5 flex-1" />
        </li>
      ))}
    </ul>
  );
}

/** Every club with its crest, linking to its page. */
export function ClubGrid({ teams, loading, error }) {
  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  if (loading && teams.length === 0) return <ClubGridSkeleton count={12} />;
  if (teams.length === 0) {
    return <EmptyState icon={Shield} title="Todavía no hay equipos" description="Los clubes aparecen acá cuando la administración los aprueba." />;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(team => (
        <li key={team.id}>
          <Link
            to={`/equipos/${team.id}`}
            className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-line/10 bg-surface p-4 transition-colors hover:border-line/30 hover:bg-raised"
          >
            <img
              src={teamCrestUrl(team)}
              alt=""
              width="56"
              height="56"
              loading="lazy"
              decoding="async"
              className="h-14 w-14 shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1 line-clamp-2 font-display text-xl font-bold uppercase leading-tight text-ink">{team.teamName}</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default ClubGrid;
