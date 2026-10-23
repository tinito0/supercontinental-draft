import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Check, ChevronRight, Star, Trophy, Vote } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { MatchStatus, TeamMark } from '../../components/league/match/MatchParts.jsx';
import { useAllMvpVotes, useBroadcastOverlay, useLeagueTeams, useLiveMatches, useMvpVotes, SEASON_MATCH_LIMIT, usePoll, usePrediction } from '../../hooks/useLeagueData.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { rankPlayerOfTournament } from '../../utils/playerOfTournament.js';
import { getMyVote, sendVote } from '../../services/communityService.js';
import { CUP_POLLS, mvpOptions, mvpRanking, pickMvpMatch, pollResults, predictionShares } from '../../utils/communityView.js';

/* /en-vivo, la página del QR del stream: predicción del partido al aire, voto del MVP del partido en juego y la
   encuesta «¿quién gana la copa?».
   Sin cuenta: un voto por navegador (services/communityService.js → función community-vote). */


// Botón de una opción de voto: se hunde apenas al tocarlo (feedback inmediato en el celular).
const CHOICE_BUTTON = 'flex items-center justify-center rounded-xl border border-line/[0.16] bg-raised transition-[border-color,background-color,transform] duration-150 ease-out hover:border-accent/60 hover:bg-overlay active:scale-[0.97] disabled:opacity-60';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function ShareBar({ label, pct, isMine, isLeader }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={`min-w-0 truncate ${isLeader ? 'font-semibold text-ink' : 'text-ink-2'}`}>
          {label}{isMine && <span className="ml-2 text-xs text-accent-soft">· tu voto</span>}
        </span>
        <span className="num font-display text-lg text-ink">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        {/* scaleX y no width: los votos llegan en vivo y la barra se desliza sin recalcular el layout. */}
        <div className={`h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${isLeader ? 'bg-accent' : 'bg-ink-3/60'}`}
          style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

function PredictionPanel({ overlay, teamsById }) {
  const matchId = overlay?.matchId || null;
  const { data: prediction } = usePrediction(matchId);
  const [myVote, setMyVote] = useState(() => (matchId ? getMyVote('prediction', matchId) : null));
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => { setMyVote(matchId ? getMyVote('prediction', matchId) : null); }, [matchId]);

  const home = { name: prediction?.homeTeam || overlay?.homeTeamName || 'Local', draftTeamId: overlay?.homeTeamId || null };
  const away = { name: prediction?.awayTeam || overlay?.awayTeamName || 'Visitante', draftTeamId: overlay?.awayTeamId || null };
  const isClosed = Boolean(prediction?.closedAt);
  const shares = predictionShares(prediction?.votes);

  const vote = async choice => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'prediction', matchId, choice });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('prediction', matchId) || choice);
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="prediction-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="prediction-title" className="section-title flex items-center gap-2"><Vote className="h-5 w-5 text-accent-soft" aria-hidden="true" /> ¿Quién gana?</h2>
        {matchId && <span className="text-xs text-ink-3">{isClosed ? 'Cerrada: ya empezó' : 'Se cierra al empezar'}</span>}
      </div>
      {!matchId ? (
        <p className="text-sm text-ink-3">Cuando haya un partido por jugarse vas a poder predecir acá.</p>
      ) : myVote || isClosed ? (
        <div className="space-y-3">
          {[['home', home.name], ['draw', 'Empate'], ['away', away.name]].map(([side, label]) => (
            <ShareBar key={side} label={label} pct={shares[side]} isMine={myVote === side} isLeader={shares.leader === side} />
          ))}
          <p className="text-xs text-ink-3"><span className="num">{shares.total}</span> {shares.total === 1 ? 'voto' : 'votos'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3">
          {[['home', home], ['away', away]].map(([side, team]) => (
            <button key={side} type="button" disabled={state.busy} onClick={() => vote(side)}
              className={`${CHOICE_BUTTON} min-h-24 min-w-0 flex-col gap-2 px-2 py-4 text-center ${side === 'away' ? 'order-3' : ''}`}>
              <TeamMark team={team} teamsById={teamsById} />
              <span className="w-full truncate font-display text-lg font-bold leading-tight text-ink">{team.name}</span>
            </button>
          ))}
          <button type="button" disabled={state.busy} onClick={() => vote('draw')}
            className={`${CHOICE_BUTTON} order-2 min-h-24 min-w-16 px-3 font-display text-base font-bold text-ink-2`}>
            Empate
          </button>
        </div>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}

function CupPollPanel({ pollId, label }) {
  const { data: poll } = usePoll(pollId);
  const [myVote, setMyVote] = useState(() => getMyVote('cup', pollId));
  const [state, setState] = useState({ busy: false, error: '' });
  const results = useMemo(() => pollResults(poll), [poll]);
  if (!poll?.options?.length) return null;

  const vote = async choice => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'cup', pollId, choice });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('cup', pollId) || choice);
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  const isOpen = Boolean(poll.open);
  return (
    <section className="panel p-5 space-y-4" aria-labelledby={`poll-${pollId}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`poll-${pollId}`} className="section-title flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent-soft" aria-hidden="true" /> {poll.title || `¿Quién gana la ${label}?`}
        </h2>
        <span className="shrink-0 text-xs text-ink-3">{isOpen ? 'Encuesta abierta' : 'Encuesta cerrada'}</span>
      </div>
      {myVote || !isOpen ? (
        <div className="space-y-3">
          {results.options.map((option, index) => (
            <ShareBar key={option.id} label={option.name} pct={option.pct} isMine={myVote === option.id} isLeader={index === 0 && option.votes > 0} />
          ))}
          <p className="text-xs text-ink-3"><span className="num">{results.total}</span> {results.total === 1 ? 'voto' : 'votos'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {poll.options.map(option => (
            <button key={option.id} type="button" disabled={state.busy} onClick={() => vote(option.id)}
              className={`${CHOICE_BUTTON} min-h-11 justify-start px-3 py-2 text-left text-sm font-semibold text-ink-2 hover:text-ink`}>
              <span className="min-w-0 truncate">{option.name}</span>
            </button>
          ))}
        </div>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}

const PLAYER_OF_TOURNAMENT_ROWS = 5;

/** Jugador del Torneo: quién ganó más veces el MVP de la comunidad (desempata por votos). */
function PlayerOfTournamentPanel({ matches }) {
  const { byMatchKey } = useAllMvpVotes();
  const ranking = useMemo(() => rankPlayerOfTournament(matches, byMatchKey).slice(0, PLAYER_OF_TOURNAMENT_ROWS), [matches, byMatchKey]);
  if (!ranking.length) return null;
  return (
    <section className="panel p-5 space-y-4" aria-labelledby="pot-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pot-title" className="section-title flex items-center gap-2"><Award className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Jugador del Torneo</h2>
        <span className="text-xs text-ink-3">MVP de la comunidad</span>
      </div>
      <ol className="divide-y divide-line/10">
        {ranking.map((entry, index) => (
          <li key={entry.playerId} className="flex min-h-14 items-center gap-3 py-2">
            <span className={`num w-6 text-center font-display text-lg ${index === 0 ? 'text-accent-soft' : 'text-ink-3'}`}>{index + 1}</span>
            <img src={`/fotos_jugadores/${entry.playerId}.webp`} alt="" width={36} height={36} loading="lazy"
              className="h-9 w-9 shrink-0 rounded-full bg-overlay object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{entry.name}</span>
              {entry.team && <span className="block truncate text-xs text-ink-3">{entry.team}</span>}
            </span>
            <span className="text-right">
              <span className="num block font-display text-lg leading-none text-ink">{entry.awards}</span>
              <span className="block text-xs text-ink-3">{entry.awards === 1 ? 'MVP' : 'MVPs'}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-3">Cuenta los partidos terminados que registró el colector. Un empate en el primer puesto no da MVP.</p>
    </section>
  );
}

function MvpPanel({ matches }) {
  const now = useNow();
  const { match, open } = pickMvpMatch(matches, now);
  const { data: votes } = useMvpVotes(match?.key || null);
  const [selected, setSelected] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => {
    setSelected(null);
    setMyVote(match ? getMyVote('mvp', match.key) : null);
  }, [match?.key]);

  const options = useMemo(() => mvpOptions(match?.summary), [match?.summary]);
  const ranking = useMemo(() => mvpRanking(votes?.votes, match?.summary), [votes, match?.summary]);

  const vote = async () => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'mvp', matchKey: match.key, choice: selected });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('mvp', match.key) || String(selected));
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  let body;
  if (!match) {
    body = <p className="text-sm text-ink-3">Cuando haya un partido en juego vas a poder votar al mejor jugador acá.</p>;
  } else if (myVote || !open) {
    body = ranking.length ? (
      <ol className="space-y-3">
        {ranking.map((entry, index) => (
          <li key={entry.id}><ShareBar label={`${index + 1}. ${entry.name}`} pct={entry.pct} isMine={myVote === String(entry.id)} isLeader={index === 0} /></li>
        ))}
      </ol>
    ) : <p className="text-sm text-ink-3">Todavía no hay votos.</p>;
  } else {
    body = (
      <div className="space-y-4">
        {[['home', match.home.name], ['away', match.away.name]].map(([side, teamName]) => (
          <fieldset key={side}>
            <legend className="eyebrow mb-2">{teamName}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options[side].map(player => (
                <button key={player.id} type="button" aria-pressed={selected === player.id} onClick={() => setSelected(player.id)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.98] ${selected === player.id ? 'border-accent bg-accent-deep/60 text-ink' : 'border-line/[0.16] bg-raised text-ink-2 hover:border-line/30'}`}>
                  <img src={`/fotos_jugadores/${player.id}.webp`} alt="" width={28} height={28} loading="lazy"
                    className="h-7 w-7 shrink-0 rounded-full bg-overlay object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
                  <span className="min-w-0 flex-1 truncate">{player.name}</span>
                  {selected === player.id && <Check className="h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="button" className="btn btn-primary w-full min-h-11" disabled={!selected || state.busy} onClick={vote}
          title={!selected ? 'Elegí un jugador' : undefined}>
          {state.busy ? 'Votando…' : 'Votar'}
        </button>
      </div>
    );
  }

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="mvp-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="mvp-title" className="section-title flex items-center gap-2"><Star className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Jugador del partido</h2>
        {match && <span className="text-xs text-ink-3">{open ? 'Votación abierta' : 'Votación cerrada'}</span>}
      </div>
      {match && (
        <Link to={`/partidos/${match.key}`} className="well flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-overlay">
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {match.home.name} <span className="num font-display text-base">{match.home.score}-{match.away.score}</span> {match.away.name}
          </span>
          <MatchStatus status={match.status} className="text-xs" />
          <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden="true" />
        </Link>
      )}
      {body}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}

export default function LeagueLiveScreen() {
  useDocumentTitle('En vivo');
  const { data: overlay } = useBroadcastOverlay();
  // Toda la temporada, no los últimos 40: el Jugador del Torneo suma los MVP de todos los partidos terminados.
  const { matches, error } = useLiveMatches(SEASON_MATCH_LIMIT);
  const { teamsById } = useLeagueTeams();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="En vivo">
          Predecí el resultado, votá al mejor jugador del partido y elegí quién gana la copa. Sin cuenta: un voto por navegador.
        </SectionHeading>
      </Reveal>
      {error && <Alert tone="danger" title={error} className="mb-4">Recargá la página para intentar de nuevo.</Alert>}
      <div className="space-y-5">
        <PredictionPanel overlay={overlay} teamsById={teamsById} />
        <MvpPanel matches={matches} />
        {CUP_POLLS.map(poll => <CupPollPanel key={poll.id} pollId={poll.id} label={poll.label} />)}
        <PlayerOfTournamentPanel matches={matches} />
      </div>
      <p className="mt-6 text-xs text-ink-3">
        Los resultados se actualizan solos. La predicción cierra cuando empieza el partido; el MVP, 15 minutos después del final.
      </p>
    </section>
  );
}
