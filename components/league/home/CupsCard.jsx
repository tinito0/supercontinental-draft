import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Trophy } from 'lucide-react';
import { CUP_DEFINITIONS, CUP_IDS, buildCupRounds, getMatchWinner, isMatchCompleted, shootoutLabel } from '../../../utils/bracketModel.js';
import { LeagueCrest } from '../match/FixtureRow.jsx';

/* Las copas en la portada: la ronda en juego de cada copa (o el campeón), solo cuando ya tienen cruces. */

function cupSummary(cupId, bracket) {
  const rounds = buildCupRounds(cupId, bracket);
  const hasTies = rounds.some(round => round.matches.some(entry => entry.match.teamA || entry.match.teamB));
  if (!hasTies) return null;
  const final = rounds.find(round => round.isFinal)?.matches[0]?.match;
  const finalWinner = final && getMatchWinner(final);
  if (finalWinner) return { champion: finalWinner === 'A' ? final.teamA : final.teamB };
  const current = rounds.find(round => round.matches.some(entry => entry.match.teamA && entry.match.teamB && !isMatchCompleted(entry.match)))
    || rounds.filter(round => round.matches.some(entry => entry.match.teamA || entry.match.teamB)).pop();
  return { round: current, ties: current.matches.filter(entry => entry.match.teamA || entry.match.teamB) };
}

function Tie({ match, clubOf }) {
  const winner = getMatchWinner(match);
  const line = (name, score, side) => (
    <div className="flex min-w-0 items-center gap-2">
      <LeagueCrest name={name} club={clubOf(name)} size="sm" />
      <span className={`min-w-0 flex-1 truncate text-sm ${winner === side ? 'font-semibold text-ink' : winner ? 'text-ink-3' : 'text-ink-2'}`}>{name || 'A definir'}</span>
      <span className="num font-display text-base text-ink">{isMatchCompleted(match) ? Number(score) : ''}</span>
    </div>
  );
  return (
    <li className="space-y-1 py-2.5">
      {line(match.teamA, match.scoreA, 'A')}
      {line(match.teamB, match.scoreB, 'B')}
      {shootoutLabel(match) && <p className="pl-8 text-xs text-ink-3">{shootoutLabel(match)}</p>}
    </li>
  );
}

export function CupsCard({ tournament, clubOf }) {
  const cups = [CUP_IDS.ORO, CUP_IDS.PLATA]
    .map(cupId => ({ cupId, cup: CUP_DEFINITIONS[cupId], summary: cupSummary(cupId, tournament?.bracket) }))
    .filter(item => item.summary);
  if (!cups.length) return null;
  return (
    <div className="panel space-y-5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="section-title">Copas</h3>
        <Link to="/torneo?tab=bracket" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
          Ver cuadros <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {cups.map(({ cupId, cup, summary }) => (
        <section key={cupId} aria-label={cup.name}>
          <p className="eyebrow flex items-center gap-1.5">
            <Trophy className={`h-3.5 w-3.5 ${cupId === CUP_IDS.ORO ? 'text-accent-soft' : 'text-ink-2'}`} aria-hidden="true" />
            {cup.name}{summary.round ? ` · ${summary.round.label}` : ''}
          </p>
          {summary.champion ? (
            <div className="mt-2 flex items-center gap-3">
              <LeagueCrest name={summary.champion} club={clubOf(summary.champion)} size="lg" />
              <div>
                <p className="text-xs text-ink-3">{cup.championLabel}</p>
                <p className="font-display text-2xl font-bold uppercase leading-tight text-ink">{summary.champion}</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line/10">
              {summary.ties.map(entry => <Tie key={entry.key} match={entry.match} clubOf={clubOf} />)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export default CupsCard;
