import React, { memo, useEffect, useMemo, useState } from 'react';
import { Lock, Trophy, Unlock } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import { APP_ID } from '../../utils/constants.js';
import { usePoll } from '../../hooks/useLeagueData.js';
import { CUP_POLLS, pollResults } from '../../utils/communityView.js';
import { buildPoll, cupPollTeams, POLL_LIMITS, pollMatchesTeams } from '../../utils/cupPoll.js';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ResetVotesButton } from './ResetVotesButton.jsx';

// Encuestas «¿quién gana la copa?» (public/data/polls/{id}): los equipos salen de las llaves de esa copa (utils/cupPoll.js
// cupPollTeams) y se habilita cuando se conocen los cruces; el admin elige la pregunta y la abre o la cierra. Se vota en /en-vivo (función community-vote) y se ve en OBS con la tarjeta «Copa». mergeFields: guardar
// nunca toca los votos.

const pollPath = pollId => `artifacts/${APP_ID}/public/data/polls/${pollId}`;

function PollEditor({ config, tournamentData, showStatusMessage }) {
  const { data: poll } = usePoll(config.id);
  const cup = useMemo(() => cupPollTeams(tournamentData, config.id), [tournamentData, config.id]);
  const results = useMemo(() => pollResults(poll), [poll]);
  const hasVotes = results.total > 0;
  const [title, setTitle] = useState(config.title);
  const [state, setState] = useState({ busy: false, error: '' });
  // Opciones guardadas que no son los equipos de la copa (p. ej. una encuesta abierta antes de armar las llaves).
  const outdated = Boolean(poll?.options?.length) && cup.ready && !pollMatchesTeams(poll, cup.teams);

  useEffect(() => {
    setTitle(poll?.title || config.title);
  }, [poll?.title, config.title]);

  const save = async open => {
    if (open && !cup.ready) {
      setState({ busy: false, error: cup.reason });
      return;
    }
    const built = buildPoll({ title, open, names: cup.ready ? cup.teams : (poll?.options || []).map(option => option.name) });
    if (!built.ok) {
      setState({ busy: false, error: built.reason });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      // Con votos, las opciones quedan fijas: solo cambian la pregunta y si está abierta (para cambiarlas, reiniciar).
      const fields = hasVotes ? ['title', 'open', 'updatedAt'] : ['title', 'open', 'options', 'updatedAt'];
      await setDoc(doc(db, pollPath(config.id)), { ...built.poll, updatedAt: serverTimestamp() }, { mergeFields: fields });
      showStatusMessage?.('success', `${config.label}: encuesta ${open ? 'abierta' : 'cerrada'}.`);
      setState({ busy: false, error: '' });
    } catch (error) {
      console.error('[CupPollAdmin]', error);
      setState({ busy: false, error: 'No se pudo guardar la encuesta.' });
    }
  };

  const isOpen = Boolean(poll?.open);
  const shown = hasVotes ? results.options.map(option => option.name) : cup.teams;
  return (
    <div className="well p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{config.label}</h3>
        <span className={`text-sm font-semibold ${isOpen ? 'text-success-soft' : 'text-ink-2'}`}>
          {poll ? (isOpen ? 'Abierta' : 'Cerrada') : 'Sin crear'}{hasVotes && ` · ${results.total} ${results.total === 1 ? 'voto' : 'votos'}`}
        </span>
      </div>
      <Field label="Pregunta">
        <input type="text" className="input" value={title} maxLength={POLL_LIMITS.TITLE} onChange={event => setTitle(event.target.value)} />
      </Field>
      {!cup.ready && !hasVotes ? (
        <p className="text-sm text-ink-2">{cup.reason}</p>
      ) : (
        <div>
          <p className="eyebrow mb-2">Equipos ({shown.length}){!hasVotes && ' · salen de las llaves de la copa'}</p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {shown.map(name => (
              <li key={name} className="flex min-h-11 items-center gap-3 rounded-lg border border-line/[0.16] bg-raised px-3 text-sm text-ink">
                <span className="min-w-0 truncate">{name}</span>
                {hasVotes && <span className="num ml-auto text-ink-2">{results.options.find(option => option.name === name)?.pct ?? 0}%</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {outdated && (
        <Alert tone="warning" title="Los equipos no coinciden con la copa">
          {hasVotes ? 'Ya tiene votos: reiniciá los votos y después guardá para actualizar los equipos.' : 'Guardá para actualizar los equipos con los de las llaves.'}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11" disabled={state.busy || (!cup.ready && !isOpen)} onClick={() => save(true)}>
          <Unlock className="h-4 w-4" aria-hidden="true" /> {isOpen ? 'Guardar' : 'Abrir encuesta'}
        </button>
        {isOpen && (
          <button type="button" className="btn btn-ghost min-h-11" disabled={state.busy} onClick={() => save(false)}>
            <Lock className="h-4 w-4" aria-hidden="true" /> Cerrar
          </button>
        )}
        {hasVotes && <ResetVotesButton kind="cup" target={config.id} label={`la encuesta ${config.label}`} total={results.total} showStatusMessage={showStatusMessage} />}
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </div>
  );
}

/** @param {{ tournamentData: object, showStatusMessage?: (tone: string, message: string) => void }} props */
export const CupPollAdmin = memo(function CupPollAdmin({ tournamentData, showStatusMessage }) {
  return (
    <section className="panel p-5 space-y-4" aria-labelledby="cup-poll-title">
      <div className="flex flex-col gap-1">
        <h2 id="cup-poll-title" className="section-title flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-accent-soft" aria-hidden="true" /> ¿Quién gana la copa?
        </h2>
        <p className="text-xs text-ink-3">Encuesta para el público en /en-vivo. En OBS se muestra con la tarjeta «Copa».</p>
      </div>
      {CUP_POLLS.map(config => (
        <PollEditor key={config.id} config={config} tournamentData={tournamentData} showStatusMessage={showStatusMessage} />
      ))}
    </section>
  );
});

export default CupPollAdmin;
