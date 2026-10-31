import React, { useEffect, useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ruleTarget } from '../SquadRulesStats.jsx';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { buildTeamRuleRows, BENCH_MIN_AVG_OVR } from '../../utils/squadRules.js';

const COLUMNS = [
  { id: 'squad', label: 'Plantel' },
  { id: 'bench', label: 'Banco' },
  { id: 'locals', label: 'Locales' },
];

const failingRules = row => row.result.rules.filter(rule => rule.applies && !rule.ok);

function ClubName({ row }) {
  return (
    <span className="flex items-center gap-3 min-w-0">
      <img src={row.logoUrl || DEFAULT_LOGO} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0"
        onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
      <span className="font-display text-base font-bold text-ink truncate">{row.teamName}</span>
    </span>
  );
}

/** A rule's figure against its minimum; red with the reason when it fails, a muted note when not measured yet. */
function RuleFigure({ rule }) {
  const isFailing = rule.applies && !rule.ok;
  return (
    <>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-display num text-lg font-bold leading-none ${isFailing ? 'text-danger-soft' : 'text-ink'}`}>{rule.value}</span>
        <span className="text-xs text-ink-3 num whitespace-nowrap">{ruleTarget(rule)}</span>
      </span>
      {(isFailing || !rule.applies) && (
        <span className={`block mt-1 text-xs ${isFailing ? 'text-danger-soft' : 'text-ink-3'}`}>{rule.detail}</span>
      )}
    </>
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
  const rows = useMemo(() => buildTeamRuleRows(allTeams, playerLocks, playersById), [allTeams, playerLocks, playersById]);
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

  const offenders = rows.filter(row => failingRules(row).length > 0).length;
  return (
    <section aria-labelledby="squad-rules-title" className="space-y-4">
      <div>
        <h2 id="squad-rules-title" className="section-title">Reglas del plantel</h2>
        <p className="mt-1 text-sm text-ink-2">
          {offenders === 0
            ? <>Los <span className="num">{rows.length}</span> clubes están en regla.</>
            : <><span className="num font-semibold text-danger-soft">{offenders}</span> de <span className="num">{rows.length}</span> clubes incumplen alguna regla.</>}
          {' '}La pizarra no deja guardar un once con el banco por debajo de {BENCH_MIN_AVG_OVR}; el plantel y los locales se corrigen en el mercado.
        </p>
      </div>

      {/* Phones: a club per row with only what it fails; the full table would scroll sideways. */}
      <ul className="sm:hidden divide-y divide-line/[0.08] border-y border-line/[0.08]">
        {rows.map(row => {
          const broken = failingRules(row);
          return (
            <li key={row.userId} className="py-3">
              <ClubName row={row} />
              <p className={`mt-1.5 pl-11 text-xs ${broken.length ? 'text-danger-soft' : 'text-ink-3'}`}>
                {broken.length
                  ? broken.map(rule => `${rule.label} ${rule.value} ${ruleTarget(rule)}`).join(' · ')
                  : `En regla · ${row.result.rules.map(rule => `${COLUMNS.find(column => column.id === rule.id).label} ${rule.value}`).join(' · ')}`}
              </p>
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
