import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Play } from 'lucide-react';
import { teamCrestUrl } from '../../../utils/teamCrest.js';
import { playerPlaceholder } from '../../../utils/playerPlaceholder.js';
import { getStatAndOvrColorClass } from '../../../utils/helpers.js';
import { FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../../../supabase/functions/_shared/marketConstants.js';
import { FEATURED_VIDEO, STREAM_CHANNEL } from '../../landing/leagueLinks.js';
import { SocialLinks } from '../../landing/FollowLeague.jsx';
import { Alert } from '../../ui/Alert.jsx';
import { isOfflineError } from '../../../utils/leagueDataErrors.js';

/* Las franjas cortas de la portada, debajo de partidos y tabla: clubes como grilla de escudos, los jugadores
   franquicia en una tarjeta y los canales de la liga. Las páginas completas son /equipos y cada club. */

/** Los clubes como escudos: 4 por fila en el teléfono, 6 desde sm. Cada escudo lleva a su club. */
export function ClubCrestGrid({ teams, loading, error = '' }) {
  if (error && !teams.length) {
    return <Alert tone="danger" title={error}>{isOfflineError(error) ? null : 'Recargá la página para intentar de nuevo.'}</Alert>;
  }
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

const FRANCHISE_RULE = `Uno por club, de ${FRANCHISE_MIN_AGE} años o más y con media de ${FRANCHISE_MIN_OVR} a ${FRANCHISE_MAX_OVR}. No gasta presupuesto.`;

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
            <span className="sr-only">Media </span>{player.ovr}
          </span>
        )}
        <img src={teamCrestUrl(team)} alt="" width="24" height="24" loading="lazy" className="absolute bottom-1 right-1 h-6 w-6 object-contain" />
      </span>
      <span className="mt-1.5 line-clamp-2 break-words text-xs font-semibold leading-tight text-ink group-hover:text-accent-soft">{player.name}</span>
      <span className="sr-only">, de {team.teamName}</span>
    </Link>
  );
}

/** Qué es el Jugador Franquicia en una línea, y el de cada club que ya lo eligió. */
export function FranchiseSummary({ teams, franchise, loading, error = '', teamsError = '', headingId }) {
  const failure = error ? 'No se pudieron cargar los jugadores franquicia.' : (teams.length ? '' : teamsError);
  // The offline title already says what happens next; the fixed franchise title needs it in the body.
  const failureBody = isOfflineError(failure) ? null
    : isOfflineError(error) ? 'No hay conexión. Aparecen apenas vuelva.'
      : 'Recargá la página para intentar de nuevo.';
  const entries = teams.filter(team => franchise?.[team.id]).map(team => ({ team, player: franchise[team.id] }));
  return (
    <div className="panel p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id={headingId} className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-ink">Jugadores franquicia</h2>
        {entries.length > 0 && (
          <p className="text-sm text-ink-2"><span className="num font-semibold text-ink">{entries.length}</span> de <span className="num">{teams.length}</span> clubes ya eligieron el suyo</p>
        )}
      </div>
      <p className="mt-3 max-w-[64ch] text-ink-2 [text-wrap:pretty]">
        Cada club elige un referente que nadie le puede sacar en toda la temporada. {FRANCHISE_RULE}
      </p>
      {failure ? (
        <Alert tone="danger" title={failure} className="mt-5">{failureBody}</Alert>
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
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </span>
      </a>
      <div className="flex flex-col justify-center gap-3 rounded-2xl border border-line/10 bg-surface p-4">
        <a href={STREAM_CHANNEL.url} {...external} className="group flex min-h-11 items-center gap-3">
          <img src={STREAM_CHANNEL.logo} alt="" width="24" height="24" className="h-6 w-6 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink group-hover:text-accent-soft">Los partidos en vivo, en {STREAM_CHANNEL.name}<span className="sr-only"> (se abre en otra pestaña)</span></span>
            <span className="block truncate text-sm text-ink-2">{STREAM_CHANNEL.handle}</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
        </a>
        <SocialLinks />
      </div>
    </div>
  );
}
