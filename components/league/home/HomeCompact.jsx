import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Play } from 'lucide-react';
import { teamCrestUrl } from '../../../utils/teamCrest.js';
import { playerPlaceholder } from '../../../utils/playerPlaceholder.js';
import { getStatAndOvrColorClass } from '../../../utils/helpers.js';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../../../supabase/functions/_shared/marketConstants.js';
import { FEATURED_VIDEO, STREAM_CHANNEL } from '../../landing/leagueLinks.js';
import { SocialLinks } from '../../landing/FollowLeague.jsx';

/* Las franjas cortas de la portada, debajo de partidos y tabla: clubes como grilla de escudos, los jugadores
   franquicia en una tarjeta y los canales de la liga. Las páginas completas son /equipos y cada club. */

/** Los clubes como escudos: 4 por fila en el teléfono, 6 desde sm. Cada escudo lleva a su club. */
export function ClubCrestGrid({ teams, loading }) {
  if (loading && !teams.length) {
    return (
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => <li key={i} className="skeleton aspect-square rounded-2xl" />)}
      </ul>
    );
  }
  if (!teams.length) return <p className="text-ink-2">Los clubes aparecen acá cuando la administración los aprueba.</p>;
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
      {teams.map(team => (
        <li key={team.id} className="min-w-0">
          <Link
            to={`/equipos/${team.id}`}
            className="group flex h-full flex-col items-center gap-2 rounded-2xl border border-line/10 bg-surface px-1.5 pb-2.5 pt-3 text-center transition-[background-color,border-color] duration-fast hover:border-line/30 hover:bg-raised"
          >
            <img src={teamCrestUrl(team)} alt="" width="56" height="56" loading="lazy" decoding="async" className="h-11 w-11 object-contain sm:h-14 sm:w-14" />
            <span className="line-clamp-2 w-full break-words text-xs font-semibold leading-tight text-ink-2 group-hover:text-ink sm:text-sm">{team.teamName}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const FRANCHISE_RULES = [
  '1 por club',
  `${FRANCHISE_MIN_AGE}+ años`,
  `OVR ${FRANCHISE_MIN_OVR} a ${FRANCHISE_MAX_OVR}`,
  'gratis',
  'fijo toda la temporada',
];

/** El jugador franquicia de un club, en chico: foto con OVR, nombre y escudo. */
function FranchiseTile({ team, player }) {
  return (
    <Link to={`/equipos/${team.id}`} className="group block min-w-0">
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-raised ring-1 ring-crest/50">
        <img
          src={`/fotos_jugadores/${player.playerId}.webp`}
          alt=""
          width="120"
          height="120"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.name?.[0] || '?'); }}
        />
        {player.ovr && (
          <span className={`absolute left-1 top-1 grid h-6 min-w-[1.75rem] place-items-center rounded px-1 font-display text-sm font-bold num ${getStatAndOvrColorClass(player.ovr)}`}>
            <span className="sr-only">OVR </span>{player.ovr}
          </span>
        )}
        <img src={teamCrestUrl(team)} alt="" width="24" height="24" loading="lazy" className="absolute bottom-1 right-1 h-6 w-6 object-contain" />
      </span>
      <span className="mt-1.5 block truncate text-xs font-semibold text-ink group-hover:text-accent-soft">{player.name}</span>
      <span className="sr-only">, de {team.teamName}</span>
    </Link>
  );
}

/** Qué es el Jugador Franquicia en una línea, y el de cada club que ya lo eligió. */
export function FranchiseSummary({ teams, franchise, loading, error = '', headingId }) {
  const entries = teams.filter(team => franchise?.[team.id]).map(team => ({ team, player: franchise[team.id] }));
  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="eyebrow text-crest-soft">La regla de la casa</p>
          <h2 id={headingId} className="mt-1 font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Jugadores franquicia</h2>
        </div>
        {entries.length > 0 && (
          <p className="text-sm text-ink-2"><span className="num font-semibold text-ink">{entries.length}</span> de <span className="num">{teams.length}</span> clubes ya eligieron el suyo</p>
        )}
      </div>
      <p className="mt-3 max-w-[60ch] text-ink-2 [text-wrap:pretty]">
        Cada club elige un referente que nadie le puede sacar en toda la temporada.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5" aria-label="Reglas del jugador franquicia">
        {FRANCHISE_RULES.map(rule => (
          <li key={rule} className="rounded-md border border-crest/30 px-2 py-1 text-xs font-semibold text-crest-soft">{rule}</li>
        ))}
      </ul>
      {error ? (
        <p className="mt-5 text-sm text-warning-soft">No se pudieron cargar los jugadores franquicia. Recargá la página para intentar de nuevo.</p>
      ) : !loading && !entries.length ? (
        <p className="mt-5 text-sm text-ink-2">Ningún club eligió el suyo todavía: cada uno lo ficha en el Mercado Franquicia y aparece acá.</p>
      ) : loading && !entries.length ? (
        <ul className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton aspect-square rounded-xl" />)}
        </ul>
      ) : entries.length > 0 && (
        <ul className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-12">
          {entries.map(({ team, player }) => <li key={team.id} className="min-w-0"><FranchiseTile team={team} player={player} /></li>)}
        </ul>
      )}
    </div>
  );
}

const external = { target: '_blank', rel: 'noopener noreferrer' };

/** El último video, el canal de los streams y las redes, en una sola franja. */
export function FollowCompact() {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] sm:gap-4">
      <a href={FEATURED_VIDEO.url} {...external} className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-line/10 bg-surface p-2 pr-4 transition-colors hover:border-line/30">
        <span className="relative w-32 shrink-0 overflow-hidden rounded-xl bg-raised sm:w-40">
          <img src={FEATURED_VIDEO.thumbnail} alt="" width="320" height="180" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent transition-colors group-hover:bg-accent-hover">
              <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
            </span>
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-3">Último video</span>
          <span className="line-clamp-2 font-display text-lg font-bold uppercase leading-tight text-ink">{FEATURED_VIDEO.title}</span>
        </span>
      </a>
      <div className="flex flex-col justify-center gap-3 rounded-2xl border border-line/10 bg-surface p-4">
        <a href={STREAM_CHANNEL.url} {...external} className="group flex min-h-11 items-center gap-3">
          <img src={STREAM_CHANNEL.logo} alt="" width="24" height="24" className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink group-hover:text-accent-soft">Los partidos en vivo, en {STREAM_CHANNEL.name}</span>
            <span className="block truncate text-sm text-ink-2">{STREAM_CHANNEL.handle}</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
        </a>
        <SocialLinks />
      </div>
    </div>
  );
}
