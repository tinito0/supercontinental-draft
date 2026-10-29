import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { DEFAULT_LOGO } from '../../../utils/constants.js';
import { teamCrestUrl } from '../../../utils/teamCrest.js';
import { photoFrameStyle } from '../../../utils/leagueContent.js';

/* Cabecera de la página del club en la web de la liga: la foto del estadio a todo el ancho (si el admin la cargó),
   el escudo en un cuadrado blanco como en la transmisión, el nombre grande y de dónde es. Sin foto, la superficie
   lisa: nada decorativo. */

function placeLine(profile) {
  const place = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const founded = profile?.founded ? `Fundado en ${profile.founded}` : '';
  return [place, founded].filter(Boolean);
}

/**
 * @param {{ team: object | null, profile: object | null, loading?: boolean, action?: React.ReactNode }} props
 *   action: a control at the end of the title row (the share button)
 */
export function ClubHero({ team, profile, loading = false, action = null }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = !photoFailed && profile?.stadiumPhotoUrl ? profile.stadiumPhotoUrl : '';
  const name = team?.teamName || '';
  const [place, founded] = placeLine(profile);

  return (
    <header className={`club-hero relative isolate overflow-hidden border-b border-line/10 ${photo ? 'club-hero--photo' : ''}`}>
      {photo ? (
        <img src={photo} alt={profile?.stadium ? `Estadio ${profile.stadium}` : ''} className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={photoFrameStyle(profile?.stadiumPhotoFrame)} referrerPolicy="no-referrer" fetchpriority="high" onError={() => setPhotoFailed(true)} />
      ) : null}
      <div className={`mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-8 sm:flex-row sm:items-end sm:gap-7 sm:px-6 sm:pb-10 ${photo ? 'pt-24 sm:pt-40' : 'pt-8 sm:pt-12'}`}>
        {loading && !team ? (
          <>
            <div className="skeleton h-24 w-24 rounded-2xl sm:h-32 sm:w-32" aria-hidden="true" />
            <div className="skeleton h-12 w-2/3" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white p-3 sm:h-32 sm:w-32">
              <img src={teamCrestUrl(team)} alt={`Escudo de ${name}`} onError={event => { if (!event.currentTarget.src.endsWith(DEFAULT_LOGO)) event.currentTarget.src = DEFAULT_LOGO; }} width="112" height="112" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {profile?.nickname && <p className="font-display text-lg font-semibold uppercase tracking-wide text-accent-soft sm:text-xl">«{profile.nickname}»</p>}
              <h1 className="font-display text-[2.75rem] font-bold uppercase leading-[0.9] tracking-tight text-ink [text-wrap:balance] sm:text-7xl">{name}</h1>
              {(place || founded) && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-medium text-ink">
                  {place && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent-soft" aria-hidden="true" />{place}</span>}
                  {founded && <span>{founded}</span>}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </>
        )}
      </div>
    </header>
  );
}

export default ClubHero;
