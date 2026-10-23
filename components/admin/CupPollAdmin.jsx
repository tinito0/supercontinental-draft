import React, { memo, useEffect, useMemo, useState } from 'react';
import { Lock, Trophy, Unlock } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase.js';
import { APP_ID } from '../../utils/constants.js';
import { usePoll } from '../../hooks/useLeagueData.js';
import { CUP_POLLS, pollResults } from '../../utils/communityView.js';
import { buildPoll, POLL_LIMITS, suggestedPollTeams } from '../../utils/cupPoll.js';
import { Field } from '../ui/Field.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ResetVotesButton } from './ResetVotesButton.jsx';

// Encuestas «¿quién gana la copa?» (public/data/polls/{id}): el admin elige la pregunta y los equipos, y la abre o la
// cierra. Se vota en /en-vivo (función community-vote) y se ve en OBS con la tarjeta «Copa». mergeFields: guardar
// nunca toca los votos.

const pollPath = pollId => `artifacts/${APP_ID}/public/data/polls/${pollId}`;

function PollEditor({ config, tournamentData, showStatusMessage }) {
  const { data: poll } = usePoll(config.id);
  const suggested = useMemo(() => suggestedPollTeams(tournamentData, config.id), [tournamentData, config.id]);
  const results = useMemo(() => pollResults(poll), [poll]);
  const hasVotes = results.total > 0;
  const [title, setTitle] = useState(config.title);
  const [names, setNames] = useState([]);
  const [state, setState] = useState({ busy: false, error: '' });

  // Se recarga solo cuando cambia lo guardado (pregunta u opciones), no con cada voto que llega.
  const savedKey = JSON.stringify([poll?.title, poll?.options, suggested]);
  useEffect(() => {
    setTitle(poll?.title || config.title);
    setNames(poll?.options?.map(option => option.name) || suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, config.title]);

  const toggleName = name => setNames(prev => (prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]));
  const candidates = [...new Set([...suggested, ...names])];

  const save = async open => {
    const built = buildPoll({ title, open, names });
    if (!built.ok) {
      setState({ busy: false, error: built.reason });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      // Con votos, las opciones quedan fijas: solo cambian la pregunta y si está abierta.
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
  return (
    <div className="well p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-lg font-bold text-ink">{config.label}</h4>
        <span className={`text-xs font-semibold ${isOpen ? 'text-success-soft' : 'text-ink-3'}`}>
          {poll ? (isOpen ? 'Abierta' : 'Cerrada') : 'Sin crear'}{hasVotes && ` · ${results.total} ${results.total === 1 ? 'voto' : 'votos'}`}
        </span>
      </div>
      <Field label="Pregunta">
        <input type="text" className="input" value={title} maxLength={POLL_LIMITS.TITLE} onChange={event => setTitle(event.target.value)} />
      </Field>
      <fieldset disabled={hasVotes}>
        <legend className="eyebrow mb-2">Equipos {hasVotes && '(fijos: ya hay votos)'}</legend>
        {candidates.length === 0 ? (
          <p className="text-sm text-ink-3">Todavía no hay equipos en el torneo.</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {candidates.map(name => (
              <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line/[0.16] bg-raised px-3 text-sm text-ink-2">
                <input type="checkbox" checked={names.includes(name)} onChange={() => toggleName(name)} className="h-4 w-4 accent-[rgb(var(--c-accent))]" />
                <span className="min-w-0 truncate">{name}</span>
                {hasVotes && <span className="num ml-auto text-xs text-ink-3">{results.options.find(option => option.name === name)?.pct ?? 0}%</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11" disabled={state.busy} onClick={() => save(true)}>
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
        <h3 id="cup-poll-title" className="section-title flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-accent-soft" aria-hidden="true" /> ¿Quién gana la copa?
        </h3>
        <p className="text-xs text-ink-3">Encuesta para el público en /en-vivo. En OBS se muestra con la tarjeta «Copa».</p>
      </div>
      {CUP_POLLS.map(config => (
        <PollEditor key={config.id} config={config} tournamentData={tournamentData} showStatusMessage={showStatusMessage} />
      ))}
    </section>
  );
});

export default CupPollAdmin;
