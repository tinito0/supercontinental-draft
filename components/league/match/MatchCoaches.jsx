import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, UserRound } from 'lucide-react';
import { DEFAULT_LOGO } from '../../../utils/constants.js';
import { teamCrestUrl } from '../../../utils/teamCrest.js';

/* Debajo de la cancha: el director técnico y el mánager de cada club, de su ficha (Administración → Web pública →
   Clubes). Solo aparece cuando al menos un club cargó alguno de los dos. */

function CoachCard({ team, teamId, profile, align }) {
  const people = [
    profile?.coach && { icon: UserRound, label: 'Director técnico', name: profile.coach },
    profile?.manager && { icon: Gamepad2, label: 'Mánager en la liga', name: profile.manager },
  ].filter(Boolean);
  return (
    <div className={`flex min-w-0 flex-col gap-3 ${align === 'right' ? 'sm:items-end sm:text-right' : ''}`}>
      {teamId ? (
        <Link to={`/equipos/${teamId}`} className="inline-flex min-h-11 min-w-0 items-center gap-2 font-display text-lg font-bold uppercase text-ink hover:text-accent-soft">
          <img src={teamCrestUrl(team)} alt="" onError={event => { if (!event.currentTarget.src.endsWith(DEFAULT_LOGO)) event.currentTarget.src = DEFAULT_LOGO; }} width={28} height={28} className="h-7 w-7 shrink-0 object-contain" />
          <span className="truncate">{team?.teamName}</span>
        </Link>
      ) : null}
      {people.length ? people.map(({ icon: Icon, label, name }) => (
        <div key={label} className={`flex items-center gap-3 ${align === 'right' ? 'sm:flex-row-reverse' : ''}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-deep text-accent-soft" aria-hidden="true"><Icon className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{name}</p>
            <p className="text-sm text-accent-soft">{label}</p>
          </div>
        </div>
      )) : <p className="text-sm text-ink-2">Sin cuerpo técnico cargado.</p>}
    </div>
  );
}

/**
 * @param {{ match: object, teamsById: object, profiles: object }} props profiles: useClubProfiles().byTeamId
 */
export function MatchCoaches({ match, teamsById, profiles }) {
  const homeId = match?.home?.draftTeamId || null;
  const awayId = match?.away?.draftTeamId || null;
  const has = id => Boolean(id && (profiles?.[id]?.coach || profiles?.[id]?.manager));
  if (!has(homeId) && !has(awayId)) return null;
  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="match-coaches">
      <h2 id="match-coaches" className="mb-4 text-center font-display text-lg font-bold uppercase tracking-wide text-ink">Cuerpo técnico</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CoachCard team={teamsById?.[homeId]} teamId={homeId} profile={profiles?.[homeId]} align="left" />
        <CoachCard team={teamsById?.[awayId]} teamId={awayId} profile={profiles?.[awayId]} align="right" />
      </div>
    </section>
  );
}

export default MatchCoaches;
