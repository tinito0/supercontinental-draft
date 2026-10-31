import React, { useMemo } from 'react';
import { ListChecks } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState.jsx';
import { Stat } from '../ui/Stat.jsx';
import { RuleMeter, RuleState, ruleTone } from '../RuleMeter.jsx';
import { ruleTarget } from '../SquadRulesStats.jsx';
import { DEFAULT_LOGO } from '../../utils/constants.js';
import { buildTeamRuleRows, BENCH_MIN_AVG_OVR } from '../../utils/squadRules.js';

const COLUMNS = [
  { id: 'squad', label: 'Plantel' },
  { id: 'bench', label: 'Media del banco' },
  { id: 'locals', label: 'Locales' },
];

const VALUE_TEXT = { ok: 'text-ink', fail: 'text-danger-soft', idle: 'text-ink-2' };

/**
 * Administración → Reglas: every club against the reglamento's squad rules, live from the public teams and the
 * player locks. The bench is read from the lineup each club last saved, so a club that never saved a full XI
 * shows the rule as not measured yet.
 */
export function SquadRulesAdminSection({ allTeams, playerLocks, allPlayers }) {
  const playersById = useMemo(() => new Map((allPlayers || []).map(player => [String(player.Id), player])), [allPlayers]);
  const rows = useMemo(() => buildTeamRuleRows(allTeams, playerLocks, playersById), [allTeams, playerLocks, playersById]);
  const isLoading = !allPlayers?.length;

  if (isLoading) {
    return (
      <div className="space-y-2" role="status" aria-label="Cargando los planteles">
        <div className="skeleton h-16 rounded-lg" />
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState icon={ListChecks} title="Todavía no hay clubes aprobados" description="Cuando apruebes equipos en «Equipos y usuarios», van a aparecer acá con sus reglas." />;
  }

  const passing = rows.filter(row => row.result.ok).length;
  const failingOn = id => rows.filter(row => {
    const rule = row.result.rules.find(item => item.id === id);
    return rule.applies && !rule.ok;
  }).length;

  return (
    <section aria-labelledby="squad-rules-title" className="space-y-6">
      <div>
        <h2 id="squad-rules-title" className="section-title">Reglas del plantel</h2>
        <p className="mt-1 text-sm text-ink-2">
          La pizarra no deja guardar un once con el banco por debajo de {BENCH_MIN_AVG_OVR}; el plantel y los locales se corrigen en el mercado.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 border-y border-line/[0.08] py-5">
        <Stat label="En regla" value={`${passing}/${rows.length}`} tone={passing === rows.length ? 'success' : 'default'} hint="Cumplen las tres" size="sm" />
        <Stat label="Plantel corto" value={failingOn('squad')} tone={failingOn('squad') ? 'danger' : 'default'} hint="Menos de 21 jugadores" size="sm" />
        <Stat label="Banco flojo" value={failingOn('bench')} tone={failingOn('bench') ? 'danger' : 'default'} hint={`Media por debajo de ${BENCH_MIN_AVG_OVR}`} size="sm" />
        <Stat label="Sin cupo local" value={failingOn('locals')} tone={failingOn('locals') ? 'danger' : 'default'} hint="Menos de 7 locales" size="sm" />
      </div>

      <div className="overflow-x-auto">
        <table className="data-table min-w-[44rem]">
          <thead>
            <tr>
              <th scope="col" className="text-left">Club</th>
              {COLUMNS.map(column => <th key={column.id} scope="col" className="text-left">{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.userId}>
                <td className="py-3">
                  <span className="flex items-center gap-3 min-w-0">
                    <img src={row.logoUrl || DEFAULT_LOGO} alt="" width={32} height={32} className="w-8 h-8 object-contain shrink-0"
                      onError={(e) => { e.currentTarget.src = DEFAULT_LOGO; }} />
                    <span className="min-w-0">
                      <span className="block font-display text-base font-bold text-ink truncate">{row.teamName}</span>
                      <span className={`block text-xs ${row.result.ok ? 'text-success-soft' : 'text-ink-3'}`}>
                        {row.result.ok ? 'En regla' : `${row.result.rules.filter(rule => rule.ok).length} de 3 reglas`}
                      </span>
                    </span>
                  </span>
                </td>
                {COLUMNS.map(column => {
                  const rule = row.result.rules.find(item => item.id === column.id);
                  const tone = ruleTone(rule);
                  return (
                    <td key={column.id} className="py-3 align-top">
                      <span className="flex items-baseline gap-1.5">
                        <span className={`font-display num text-xl font-bold leading-none ${VALUE_TEXT[tone]}`}>{rule.value}</span>
                        <span className="text-xs text-ink-3 num">{ruleTarget(rule)}</span>
                      </span>
                      <RuleMeter fill={rule.fill} tick={rule.tick} tone={tone} className="mt-2 w-32 max-w-full" />
                      <RuleState tone={tone} className="mt-1.5">{rule.detail}</RuleState>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SquadRulesAdminSection;
