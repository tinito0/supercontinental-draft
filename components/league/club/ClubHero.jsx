import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { teamCrestUrl } from '../../../utils/teamCrest.js';

/* Cabecera de la página del club en la web de la liga: la foto del estadio a todo el ancho (si el admin la cargó),
   el escudo en un cuadrado blanco como en la transmisión, el nombre grande y de dónde es. Sin foto queda la banda
   de la liga con el escudo de fondo, nunca un hueco. */

function placeLine(profile) {
  const place = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const founded = profile?.founded ? `Fundado en ${profile.founded}` : '';
  return [place, founded].filter(Boolean);
}

/**
 * @param {{ team: object | null, profile: object | null, loading?: boolean }} props
 */
export function ClubHero({ team, profile, loading = false }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = !photoFailed && profile?.stadiumPhotoUrl ? profile.stadiumPhotoUrl : '';
  const name = team?.teamName || '';
  const [place, founded] = placeLine(profile);

  return (
    <header className={`club-hero relative isolate overflow-hidden border-b border-line/10 ${photo ? 'club-hero--photo' : ''}`}>
      {photo ? (
        <img src={photo} alt={profile?.stadium ? `Estadio ${profile.stadium}` : ''} className="absolute inset-0 -z-10 h-full w-full object-cover"
          referrerPolicy="no-referrer" fetchpriority="high" onError={() => setPhotoFailed(true)} />
      ) : (
        team && <img src={teamCrestUrl(team)} alt="" aria-hidden="true" className="club-hero__watermark absolute -z-10 object-contain" />
      )}
      <div className="league-band absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-8 pt-24 sm:flex-row sm:items-end sm:gap-7 sm:px-6 sm:pb-10 sm:pt-40">
        {loading && !team ? (
          <>
            <div className="skeleton h-24 w-24 rounded-2xl sm:h-32 sm:w-32" aria-hidden="true" />
            <div className="skeleton h-12 w-2/3" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-white p-3 shadow-lg sm:h-32 sm:w-32">
              <img src={teamCrestUrl(team)} alt={`Escudo de ${name}`} width="112" height="112" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 space-y-2">
              {profile?.nickname && <p className="font-display text-lg font-semibold uppercase tracking-wide text-accent-soft sm:text-xl">«{profile.nickname}»</p>}
              <h1 className="font-display text-[2.75rem] font-bold uppercase leading-[0.9] tracking-tight text-ink [text-wrap:balance] sm:text-7xl">{name}</h1>
              {(place || founded) && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-medium text-ink">
                  {place && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-accent-soft" aria-hidden="true" />{place}</span>}
                  {founded && <span>{founded}</span>}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default ClubHero;
