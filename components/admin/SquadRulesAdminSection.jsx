import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ruleTarget } from '../SquadRulesStats.jsx';
import { Button } from '../ui/Button.jsx';
import { Field } from '../ui/Field.jsx';
import { db } from '../../config/firebase.js';
import { useSquadRulesConfig } from '../../hooks/useSquadRulesConfig.js';
import { APP_ID, DEFAULT_LOGO } from '../../utils/constants.js';
import {
  buildTeamRuleRows, benchMinImpact, benchMinImpactText, missingPlayersNote, summarizeRuleRows,
  SQUAD_MIN_PLAYERS, BENCH_MIN_LIMIT, BENCH_MAX_LIMIT, SQUAD_RULE_LABELS, squadRulesConfigPath,
} from '../../utils/squadRules.js';

const COLUMNS = ['squad', 'bench', 'locals'].map(id => ({ id, label: SQUAD_RULE_LABELS[id].short }));
const shortOf = rule => SQUAD_RULE_LABELS[rule.id].short;
const lowerFirst = text => text.charAt(0).toLowerCase() + text.slice(1);

const failingRules = row => row.result.rules.filter(rule => rule.applies && !rule.ok);
const unmeasuredRules = row => row.result.rules.filter(rule => !rule.applies);

function ClubName({ row }) {
  const missing = missingPlayersNote(row.result.missingCount);
  return (
    <span className="flex items-center gap-3 min-w-0">
      <img src={row.logoUrl || DEFAULT_LOGO} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0"
        onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
      <span className="min-w-0">
        <span className="block font-display text-base font-bold text-ink truncate">{row.teamName}</span>
        {missing && <span className="hidden sm:block text-xs text-warning-soft">{missing}</span>}
      </span>
    </span>
  );
}

/** A rule's figure against its minimum; red with the reason when it fails, «Sin medir» and why when it cannot be measured yet. */
function RuleFigure({ rule }) {
  const isFailing = rule.applies && !rule.ok;
  return (
    <>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-display num text-lg font-bold leading-none ${isFailing ? 'text-danger-soft' : rule.applies ? 'text-ink' : 'text-ink-3'}`}>{rule.value}</span>
        <span className="text-xs text-ink-3 num whitespace-nowrap">{ruleTarget(rule)}</span>
      </span>
      {isFailing && <span className="block mt-1 text-xs text-danger-soft">{rule.detail}</span>}
      {!rule.applies && <span className="block mt-1 text-xs text-ink-3">Sin medir: {lowerFirst(rule.detail)}</span>}
    </>
  );
}

/** The phone line of a club: what it fails, what is not measured, what is missing, or that it is in order. */
function mobileStatus(row) {
  const broken = failingRules(row);
  const unmeasured = unmeasuredRules(row);
  const missing = missingPlayersNote(row.result.missingCount);
  const parts = broken.map(rule => `${rule.label} ${rule.value} ${ruleTarget(rule)}`);
  if (unmeasured.length) parts.push(`Sin medir · ${unmeasured.map(rule => `${shortOf(rule)} (${lowerFirst(rule.detail)})`).join(' · ')}`);
  if (!broken.length && !unmeasured.length) parts.push(`En regla · ${row.result.rules.map(rule => `${shortOf(rule)} ${rule.value}`).join(' · ')}`);
  if (missing) parts.push(missing);
  return { text: parts.join(' · '), tone: broken.length ? 'text-danger-soft' : 'text-ink-3' };
}

/** «4 de 5 clubes incumplen alguna regla. 0 en regla · 1 sin medir.»: the three counts add up to the clubs on the board. */
function summaryText({ total, failing, unmeasured, compliant }) {
  const standing = [`${compliant} en regla`, unmeasured > 0 && `${unmeasured} sin medir`].filter(Boolean).join(' · ');
  return failing > 0 ? `${failing} de ${total} clubes incumplen alguna regla. ${standing}.` : `${total} clubes: ${standing}.`;
}

/** The bench minimum as typed: a whole number inside the allowed range, or null. */
export function parseBenchMinInput(text) {
  const trimmed = String(text).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= BENCH_MIN_LIMIT && value <= BENCH_MAX_LIMIT ? value : null;
}

/**
 * Editor of the bench's minimum average OVR (public/data/config/squadRules, admin-only write in the rules). While the
 * typed value differs from the saved one it says which clubs would change status, from the rows on the board.
 */
function BenchMinEditor({ benchMin, rows }) {
  const [draft, setDraft] = useState(String(benchMin));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null); // { tone: 'success' | 'danger', text }
  const savedRef = useRef(benchMin);

  // Follow the saved value live, but never overwrite a number the admin is typing.
  useEffect(() => {
    setDraft(current => (current === String(savedRef.current) ? String(benchMin) : current));
    savedRef.current = benchMin;
  }, [benchMin]);

  const parsed = parseBenchMinInput(draft);
  const error = parsed == null ? `Poné un número entero entre ${BENCH_MIN_LIMIT} y ${BENCH_MAX_LIMIT}.` : '';
  const isUnchanged = parsed === benchMin;
  const preview = useMemo(
    () => (parsed == null || isUnchanged ? null : benchMinImpact(rows, benchMin, parsed)),
    [rows, benchMin, parsed, isUnchanged],
  );

  const save = async () => {
    if (parsed == null || isSaving) return;
    if (!db) {
      setStatus({ tone: 'danger', text: 'Sin conexión con el servidor: no se pudo guardar el mínimo del banco.' });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      await setDoc(doc(db, squadRulesConfigPath(APP_ID)), { benchMinAvgOvr: parsed }, { mergeFields: ['benchMinAvgOvr'] });
      setStatus({ tone: 'success', text: `Mínimo del banco guardado: ${parsed}.` });
    } catch (err) {
      console.error('Mínimo del banco:', err);
      setStatus({ tone: 'danger', text: 'No se pudo guardar el mínimo del banco. Revisá tu conexión y probá de nuevo.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={SQUAD_RULE_LABELS.bench.long} help={`${SQUAD_RULE_LABELS.bench.description} Entre ${BENCH_MIN_LIMIT} y ${BENCH_MAX_LIMIT}.`}
          error={draft !== '' && error} className="w-full sm:w-72">
          <input className="input num min-h-11" type="text" inputMode="numeric" autoComplete="off" value={draft}
            onChange={(event) => { setDraft(event.target.value); setStatus(null); }} />
        </Field>
        <Button type="submit" variant="primary" className="min-h-11" loading={isSaving} disabled={isUnchanged || parsed == null}>Guardar</Button>
      </div>
      {preview && (
        <p role="status" className={`text-sm ${preview.stopMeeting.length ? 'text-warning-soft' : 'text-ink-2'}`}>
          {benchMinImpactText(parsed, preview)} Todavía no se guardó.
        </p>
      )}
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
    </form>
  );
}

/**
 * Administración → Reglas: every club against the reglamento's squad rules, live from the public teams and the
 * player locks. The bench is read from the lineup each club last saved, so a club that never saved a full XI
 * shows the rule as not measured yet. Clubs that fail something come first.
 * The app downloads the player catalog only for the market tabs, so this tab asks for it (onRequestCatalog) when it
 * opens; without that it waited forever on the skeleton.
 */
export function SquadRulesAdminSection({ allTeams, playerLocks, allPlayers, onRequestCatalog, loadError = '', onRetry }) {
  const playersById = useMemo(() => new Map((allPlayers || []).map(player => [String(player.Id), player])), [allPlayers]);
  const { benchMin } = useSquadRulesConfig();
  const rows = useMemo(() => buildTeamRuleRows(allTeams, playerLocks, playersById, { benchMin }), [allTeams, playerLocks, playersById, benchMin]);
  const hasPlayers = Boolean(allPlayers?.length);

  useEffect(() => {
    if (!hasPlayers) onRequestCatalog?.();
  }, [hasPlayers, onRequestCatalog]);

  if (!hasPlayers && loadError) {
    return (
      <Alert tone="danger" title="No se pudieron cargar los planteles"
        action={onRetry && <button type="button" onClick={onRetry} className="btn btn-secondary btn-sm min-h-11">Reintentar</button>}>
        {loadError}
      </Alert>
    );
  }
  const isLoading = !hasPlayers;

  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Cargando los planteles">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon={ListChecks} title="Todavía no hay clubes aprobados" description="Cuando apruebes equipos en «Equipos y usuarios», van a aparecer acá con sus reglas." />;
  }

  const summary = summarizeRuleRows(rows);
  return (
    <section aria-labelledby="squad-rules-title" className="space-y-4">
      <div>
        <h2 id="squad-rules-title" className="section-title">Reglas del plantel</h2>
        <p className="mt-1 text-sm text-ink-2">
          {summaryText(summary)}
        </p>
        <p className="mt-1 text-sm text-ink-2">
          Con {SQUAD_MIN_PLAYERS} jugadores o más y el once completo, la táctica no guarda un banco por debajo de {benchMin}. El plantel y los locales se corrigen en el mercado.
        </p>
      </div>

      <BenchMinEditor benchMin={benchMin} rows={rows} />

      {/* Phones: a club per row with only what it fails; the full table would scroll sideways. */}
      <ul className="sm:hidden divide-y divide-line/[0.08] border-y border-line/[0.08]">
        {rows.map(row => {
          const status = mobileStatus(row);
          return (
            <li key={row.userId} className="py-3">
              <ClubName row={row} />
              <p className={`mt-1.5 pl-11 text-xs ${status.tone}`}>{status.text}</p>
            </li>
          );
        })}
      </ul>

      <div className="hidden sm:block overflow-x-auto">
        <table className="data-table min-w-[36rem]">
          <thead>
            <tr>
              <th scope="col" className="text-left">Club</th>
              {COLUMNS.map(column => <th key={column.id} scope="col" className="text-left">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.userId}>
                <td className="py-3"><ClubName row={row} /></td>
                {COLUMNS.map(column => (
                  <td key={column.id} className="py-3 align-top">
                    <RuleFigure rule={row.result.rules.find(item => item.id === column.id)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SquadRulesAdminSection;
