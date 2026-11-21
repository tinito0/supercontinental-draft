import React, { useEffect, useMemo, useState } from 'react';
import { Award, Check, Trophy, UserRoundCheck, Vote } from 'lucide-react';
import { Reveal } from '../../components/landing/Reveal.jsx';
import { SectionHeading } from '../../components/landing/SiteChrome.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { TeamMark } from '../../components/league/match/MatchParts.jsx';
import { LeagueCrest, makeClubLookup } from '../../components/league/match/FixtureRow.jsx';
import { LiveNowPanel, pickLiveMatch } from '../../components/league/match/LiveNowPanel.jsx';
import { useBroadcastOverlay, useClubProfiles, useLeagueTeams, useLiveMatches, SEASON_MATCH_LIMIT, usePoll, usePrediction, useTournament } from '../../hooks/useLeagueData.js';
import { useManagerRound } from '../../hooks/useManagerRound.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { managerWinner, rankManagerOfTournament } from '../../utils/managerOfTournament.js';
import { getMyVote, sendVote } from '../../services/communityService.js';
import { CUP_POLLS, fixtureIsPredictable, managerRanking, pollResults, predictionOutcome, predictionShares } from '../../utils/communityView.js';
import { teamKey } from '../../utils/competitionRules.js';

/* /en-vivo, la página del QR del stream: predicción del partido al aire, voto del MVP del partido en juego y la
   encuesta «¿quién gana la copa?».
   Sin cuenta: un voto por navegador (services/communityService.js → función community-vote). */


// Botón de una opción de voto: se hunde apenas al tocarlo (feedback inmediato en el celular).
const CHOICE_BUTTON = 'flex items-center justify-center rounded-xl border border-line/[0.16] bg-raised transition-[border-color,background-color,transform] duration-fast ease-out hover:border-accent/60 hover:bg-overlay active:scale-[0.97] disabled:opacity-60';

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
        <span className={`min-w-0 truncate ${isLeader ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
          {label}{isMine && <span className="ml-2 text-sm font-semibold text-accent-soft">· tu voto</span>}
        </span>
        <span className="num font-display text-lg text-ink">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        {/* scaleX y no width: los votos llegan en vivo y la barra se desliza sin recalcular el layout. */}
        <div className={`h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none ${isLeader ? 'bg-accent' : 'bg-ink-2/50'}`}
          style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

/** matchId: el partido al aire, solo si está en el torneo con los dos clubes (si no, no hay nada que predecir). */
function PredictionPanel({ matchId, overlay, teamsById, matches }) {
  const { data: prediction, loading: predictionLoading } = usePrediction(matchId);
  // round: cuántas veces el admin reinició esta votación; el voto recordado de otra ronda no cuenta. null mientras carga:
  // se muestra lo recordado y no se vota hasta saber la ronda.
  const round = predictionLoading ? null : Number(prediction?.resetCount) || 0;
  const [myVote, setMyVote] = useState(() => (matchId ? getMyVote('prediction', matchId, round) : null));
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => { setMyVote(matchId ? getMyVote('prediction', matchId, round) : null); }, [matchId, round]);

  const home = { name: prediction?.homeTeam || overlay?.homeTeamName || teamsById?.[overlay?.homeTeamId]?.teamName || 'Local', draftTeamId: overlay?.homeTeamId || null };
  const away = { name: prediction?.awayTeam || overlay?.awayTeamName || teamsById?.[overlay?.awayTeamId]?.teamName || 'Visitante', draftTeamId: overlay?.awayTeamId || null };
  const isClosed = Boolean(prediction?.closedAt);
  const shares = predictionShares(prediction?.votes);
  const outcome = useMemo(() => predictionOutcome(prediction, matches), [prediction, matches]);
  const resultLabel = { home: `Ganó ${home.name}`, draw: 'Empate en los 90', away: `Ganó ${away.name}` };

  const vote = async choice => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'prediction', matchId, choice }, { round });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('prediction', matchId, round) || choice);
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  return (
    <section className="panel p-5 space-y-4" aria-labelledby="prediction-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="prediction-title" className="section-title flex items-center gap-2"><Vote className="h-5 w-5 text-accent-soft" aria-hidden="true" /> ¿Quién gana?</h2>
        {matchId && <span className="text-sm text-ink-2">{isClosed ? 'Cerrada: ya empezó' : 'Se cierra al empezar'}</span>}
      </div>
      {!matchId ? (
        <p className="text-base text-ink-2">Cuando haya un partido por jugarse vas a poder predecir acá.</p>
      ) : myVote || isClosed ? (
        <div className="space-y-3">
          {outcome && (
            <div className="border-b border-line/10 pb-4" role="status">
              <p className="font-display text-xl font-bold uppercase text-ink">
                Final: {home.name} <span className="num">{outcome.match.home.score}-{outcome.match.away.score}</span> {away.name}
              </p>
              <p className="mt-1 text-base text-ink">
                {resultLabel[outcome.result]}. Acertó el <strong className="num">{outcome.correctPct}%</strong> del público
                {myVote ? (myVote === outcome.result ? ', y vos también.' : '; esta vez no acertaste.') : '.'}
              </p>
            </div>
          )}
          {[['home', home.name], ['draw', 'Empate'], ['away', away.name]].map(([side, label]) => (
            <ShareBar key={side} label={label} pct={shares[side]} isMine={myVote === side} isLeader={shares.leader === side} />
          ))}
          <p className="text-sm text-ink-2"><span className="num">{shares.total}</span> {shares.total === 1 ? 'voto' : 'votos'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3">
          {[['home', home], ['away', away]].map(([side, team]) => (
            <button key={side} type="button" disabled={state.busy || round == null} onClick={() => vote(side)}
              className={`${CHOICE_BUTTON} min-h-24 min-w-0 flex-col gap-2 px-2 py-4 text-center ${side === 'away' ? 'order-3' : ''}`}>
              <TeamMark team={team} teamsById={teamsById} />
              <span className="w-full truncate font-display text-lg font-bold leading-tight text-ink">{team.name}</span>
            </button>
          ))}
          <button type="button" disabled={state.busy || round == null} onClick={() => vote('draw')}
            className={`${CHOICE_BUTTON} order-2 min-h-24 min-w-16 px-3 font-display text-base font-bold text-ink`}>
            Empate
          </button>
        </div>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}

function CupPollPanel({ pollId, label }) {
  const { data: poll, loading: pollLoading } = usePoll(pollId);
  const round = pollLoading ? null : Number(poll?.resetCount) || 0;
  const [myVote, setMyVote] = useState(() => getMyVote('cup', pollId, round));
  const [state, setState] = useState({ busy: false, error: '' });
  const results = useMemo(() => pollResults(poll), [poll]);
  useEffect(() => { setMyVote(getMyVote('cup', pollId, round)); }, [pollId, round]);
  // Cerrada y sin votos no tiene nada que contar (p. ej. la de la temporada anterior antes del sorteo).
  if (!poll?.options?.length || (!poll.open && !results?.total)) return null;

  const vote = async choice => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'cup', pollId, choice }, { round });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('cup', pollId, round) || choice);
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  const isOpen = Boolean(poll.open);
  return (
    <section className="panel p-5 space-y-4" aria-labelledby={`poll-${pollId}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`poll-${pollId}`} className="section-title flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent-soft" aria-hidden="true" /> {poll.title || `¿Quién gana la ${label}?`}
        </h2>
        <span className="shrink-0 text-sm text-ink-2">{isOpen ? 'Encuesta abierta' : 'Encuesta cerrada'}</span>
      </div>
      {myVote || !isOpen ? (
        <div className="space-y-3">
          {results.options.map((option, index) => (
            <ShareBar key={option.id} label={option.name} pct={option.pct} isMine={myVote === option.id} isLeader={index === 0 && option.votes > 0} />
          ))}
          <p className="text-sm text-ink-2"><span className="num">{results.total}</span> {results.total === 1 ? 'voto' : 'votos'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {poll.options.map(option => (
            <button key={option.id} type="button" disabled={state.busy || round == null} onClick={() => vote(option.id)}
              className={`${CHOICE_BUTTON} min-h-11 justify-start px-3 py-2 text-left text-base font-semibold text-ink`}>
              <span className="min-w-0 truncate">{option.name}</span>
            </button>
          ))}
        </div>
      )}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}


/** El manager de un club: el nombre que cargó la administración en la ficha del club (Web pública). */
function useManagerLookup(teams) {
  const { byTeamId } = useClubProfiles();
  return useMemo(() => {
    const byName = new Map(teams.map(team => [teamKey(team.teamName), byTeamId[team.id]?.manager || '']));
    return clubName => byName.get(teamKey(clubName)) || '';
  }, [teams, byTeamId]);
}

/** Qué hizo un club en la fecha, para elegir con el resultado a la vista: «Ganó 2-1 a Talleres». */
function resultLine(fixtures, club) {
  const fixture = fixtures.find(f => f.home === club || f.away === club);
  if (!fixture || fixture.homeScore == null || fixture.awayScore == null || fixture.homeScore === '') return '';
  const isHome = fixture.home === club;
  const own = Number(isHome ? fixture.homeScore : fixture.awayScore);
  const other = Number(isHome ? fixture.awayScore : fixture.homeScore);
  const rival = isHome ? fixture.away : fixture.home;
  if (own > other) return `Ganó ${own}-${other} a ${rival}`;
  if (own < other) return `Perdió ${own}-${other} con ${rival}`;
  return `Empató ${own}-${other} con ${rival}`;
}

const hoursLeft = (closesAtMs, now) => (Number.isFinite(closesAtMs) && closesAtMs > now ? Math.ceil((closesAtMs - now) / 3_600_000) : null);

/**
 * Manager de la fecha: el público elige al manager que mejor manejó su equipo en el PES en la última fecha terminada.
 * Abre cuando se carga el último resultado de la fecha y dura 24 h (supabase/functions/_shared/communityVote.js).
 */
function ManagerPanel({ tournament, matches, teams }) {
  const now = useNow();
  const { round, loading } = useManagerRound(tournament, matches);
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const managerOf = useManagerLookup(teams);
  const resetRound = loading ? null : Number(round?.votes?.resetCount) || 0;
  const [selected, setSelected] = useState(null);
  const [myVote, setMyVote] = useState(null);
  const [state, setState] = useState({ busy: false, error: '' });
  useEffect(() => {
    setSelected(null);
    setMyVote(round ? getMyVote('manager', round.roundId, resetRound) : null);
  }, [round?.roundId, resetRound]);

  const ranking = useMemo(() => managerRanking(round?.votes?.votes), [round?.votes]);
  const clubs = useMemo(() => (round ? round.fixtures.flatMap(f => [f.home, f.away]).filter(Boolean) : []), [round]);

  const vote = async () => {
    setState({ busy: true, error: '' });
    const result = await sendVote({ kind: 'manager', roundId: round.roundId, choice: selected }, { round: resetRound });
    if (result.ok || result.alreadyVoted) setMyVote(getMyVote('manager', round.roundId, resetRound) || selected);
    setState({ busy: false, error: result.ok || result.alreadyVoted ? '' : result.error });
  };

  const clubLabel = club => (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center"><LeagueCrest name={club} club={clubOf(club)} size="sm" /></span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{managerOf(club) || club}</span>
        {managerOf(club) && <span className="block truncate text-xs text-ink-2">{club}</span>}
      </span>
    </span>
  );

  let body;
  if (!round) {
    body = <p className="text-base text-ink-2">Cuando termine la primera fecha vas a poder elegir al manager que mejor manejó su equipo.</p>;
  } else if (myVote || !round.open) {
    const winner = !round.open ? managerWinner(round.votes) : null;
    body = ranking.length ? (
      <div className="space-y-4">
        {winner && (
          <div className="flex items-center gap-4 border-b border-line/10 pb-4" role="status">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white p-1.5"><LeagueCrest name={winner.club} club={clubOf(winner.club)} size="lg" /></span>
            <div className="min-w-0">
              <p className="eyebrow">Manager de la {round.title}</p>
              <p className="truncate font-display text-2xl font-bold text-ink">{managerOf(winner.club) || winner.club}</p>
              <p className="text-sm text-ink-2">{managerOf(winner.club) ? `${winner.club} · ` : ''}<span className="num">{ranking[0].pct}%</span> de los votos</p>
            </div>
          </div>
        )}
        <ol className="space-y-3">
          {ranking.map((entry, index) => (
            <li key={entry.club}>
              <ShareBar label={`${index + 1}. ${managerOf(entry.club) ? `${managerOf(entry.club)} (${entry.club})` : entry.club}`} pct={entry.pct} isMine={myVote === entry.club} isLeader={index === 0} />
            </li>
          ))}
        </ol>
      </div>
    ) : <p className="text-base text-ink-2">{round.open ? 'Todavía no hay votos.' : `La ${round.title} cerró sin votos.`}</p>;
  } else {
    body = (
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-3 text-base text-ink-2">¿Quién manejó mejor su equipo en el PES en la {round.title}?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {clubs.map(club => (
              <button key={club} type="button" aria-pressed={selected === club} onClick={() => setSelected(club)}
                className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-[border-color,background-color,transform] duration-fast ease-out active:scale-[0.98] ${selected === club ? 'border-accent bg-accent-deep/60' : 'border-line/[0.16] bg-raised hover:border-line/30'}`}>
                <span className="min-w-0 flex-1">
                  {clubLabel(club)}
                  {resultLine(round.fixtures, club) && <span className="mt-1 block truncate pl-12 text-xs text-ink-3">{resultLine(round.fixtures, club)}</span>}
                </span>
                {selected === club && <Check className="h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="btn btn-primary w-full min-h-11" disabled={!selected || state.busy || resetRound == null} onClick={vote}
          title={!selected ? 'Elegí un manager' : undefined}>
          {state.busy ? 'Votando…' : 'Votar'}
        </button>
      </div>
    );
  }

  const left = round?.open ? hoursLeft(round.window.closesAtMs, now) : null;
  return (
    <section className="panel p-5 space-y-4" aria-labelledby="manager-title">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="manager-title" className="section-title flex items-center gap-2"><UserRoundCheck className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Manager de la fecha</h2>
        {round && (
          <span className="text-sm text-ink-2">
            {round.title} · {round.open ? (left != null ? `cierra en ${left} h` : 'votación abierta') : 'votación cerrada'}
          </span>
        )}
      </div>
      {body}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </section>
  );
}

const MANAGER_OF_TOURNAMENT_ROWS = 5;

/** Manager del torneo: las fechas que ganó cada uno en la votación del público. */
function ManagerOfTournamentPanel({ tournament, matches, teams }) {
  const { round, byRoundId } = useManagerRound(tournament, matches);
  const clubOf = useMemo(() => makeClubLookup(teams), [teams]);
  const managerOf = useManagerLookup(teams);
  const openRoundId = round?.open ? round.roundId : null;
  const ranking = useMemo(() => rankManagerOfTournament(byRoundId, { openRoundId }).slice(0, MANAGER_OF_TOURNAMENT_ROWS), [byRoundId, openRoundId]);
  if (!ranking.length) return null;
  return (
    <section className="panel p-5 space-y-4" aria-labelledby="mot-title">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="mot-title" className="section-title flex items-center gap-2"><Award className="h-5 w-5 text-accent-soft" aria-hidden="true" /> Manager del torneo</h2>
        <span className="text-sm text-ink-2">Fechas ganadas</span>
      </div>
      <ol className="divide-y divide-line/10">
        {ranking.map((entry, index) => (
          <li key={entry.club} className="flex min-h-14 items-center gap-3 py-2">
            <span className={`num w-6 text-center font-display text-lg ${index === 0 ? 'text-accent-soft' : 'text-ink-3'}`}>{index + 1}</span>
            <span className="grid h-9 w-9 shrink-0 place-items-center"><LeagueCrest name={entry.club} club={clubOf(entry.club)} size="sm" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{managerOf(entry.club) || entry.club}</span>
              {managerOf(entry.club) && <span className="block truncate text-sm text-ink-2">{entry.club}</span>}
            </span>
            <span className="text-right">
              <span className="num block font-display text-lg leading-none text-ink">{entry.awards}</span>
              <span className="block text-sm text-ink-2">{entry.awards === 1 ? 'fecha' : 'fechas'}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-ink-2">Un empate en el primer puesto de una fecha no le da la fecha a nadie. Desempata el total de votos.</p>
    </section>
  );
}

export default function LeagueLiveScreen() {
  useDocumentTitle('En vivo');
  const { data: overlay } = useBroadcastOverlay();
  // Toda la temporada, no los últimos 40: la hora de final de cada partido de la fecha abre la votación del manager.
  const { matches, error } = useLiveMatches(SEASON_MATCH_LIMIT);
  const { teams, teamsById } = useLeagueTeams();
  const { tournament, loading: tournamentLoading } = useTournament();
  // El overlay puede seguir apuntando a un partido de otra temporada o a un cruce sin equipos: eso no se vota.
  const predictionMatchId = !tournamentLoading && overlay?.matchId && fixtureIsPredictable(tournament, overlay.matchId) ? overlay.matchId : null;
  const liveMatch = pickLiveMatch(matches);

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <Reveal>
        <SectionHeading as="h1" title="En vivo">
          Seguí el partido en juego, predecí el resultado, elegí al manager de la fecha y quién gana la copa. Sin cuenta: un voto por navegador.
        </SectionHeading>
      </Reveal>
      {error && <Alert tone="danger" title={error} className="mb-4">Recargá la página para intentar de nuevo.</Alert>}
      <div className="space-y-5">
        <LiveNowPanel matches={matches} teamsById={teamsById} />
        {/* Con un partido en juego y nada que predecir, el aviso «cuando haya un partido…» sobra. */}
        {(predictionMatchId || !liveMatch) && <PredictionPanel matchId={predictionMatchId} overlay={overlay} teamsById={teamsById} matches={matches} />}
        <ManagerPanel tournament={tournament} matches={matches} teams={teams} />
        {CUP_POLLS.map(poll => <CupPollPanel key={poll.id} pollId={poll.id} label={poll.label} />)}
        <ManagerOfTournamentPanel tournament={tournament} matches={matches} teams={teams} />
      </div>
      <p className="mt-6 text-sm text-ink-2">
        Los resultados se actualizan solos. La predicción cierra cuando empieza el partido; el manager de la fecha se vota durante las 24 horas siguientes al último partido de la fecha.
      </p>
    </section>
  );
}
