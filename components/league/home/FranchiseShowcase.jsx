import React from 'react';
import { Alert } from '../../ui/Alert.jsx';
import { EmptyState } from '../../ui/EmptyState.jsx';
import { FranchisePlayerCard } from '../FranchisePlayerCard.jsx';

/* «Jugadores franquicia» de la portada: el jugador franquicia de cada club, en el orden de la grilla de clubes. Es una
   de las marcas de la liga, por eso tiene su propia franja. Solo datos reales: un club que todavía no fichó el suyo
   no aparece. */

function ShowcaseSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-line/10 bg-surface">
          <div className="skeleton aspect-square rounded-none" />
          <div className="space-y-2 p-3"><div className="skeleton h-5 w-3/4" /><div className="skeleton h-4 w-1/2" /></div>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {{ teams: Array<object>, franchise: Record<string, object>, loading: boolean, error: string }} props
 */
export function FranchiseShowcase({ teams, franchise, loading, error }) {
  if (error) return <Alert tone="danger" title={error}>Recargá la página para intentar de nuevo.</Alert>;
  const entries = teams.filter(team => franchise[team.id]).map(team => ({ team, player: franchise[team.id] }));
  if (loading && entries.length === 0) return <ShowcaseSkeleton />;
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay jugadores franquicia"
        description="Cada club ficha el suyo en el mercado. Aparecen acá en cuanto lo eligen."
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {entries.map(({ team, player }) => (
        <li key={team.id} className="min-w-0">
          <FranchisePlayerCard player={player} team={team} className="h-full" />
        </li>
      ))}
    </ul>
  );
}

export default FranchiseShowcase;
