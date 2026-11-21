// The OBS lower third for the match scenes, written from the match instead of by hand: «Previa: A vs B», the result at
// half time, and at full time the next match of the round with its (estimated) kickoff. Pure; tests/obsLowerThird.test.js.

import { formatFixtureDate } from './leagueFixtures.js';
import { formatEta, scheduledMs } from './matchEta.js';

const when = fixture => (fixture?.etaMs ? formatEta(fixture.etaMs) : formatFixtureDate(fixture));

/** The round's next match to play after the one on air: the earliest pending one by estimated or scheduled time. */
export function nextFixture(fixtures = [], onAirId = '') {
  const onAir = fixtures.find(fixture => fixture.id === onAirId) || null;
  const round = onAir ? `${onAir.competition}|${onAir.roundLabel}` : null;
  const pending = fixtures
    .filter(fixture => fixture.status === 'scheduled' && fixture.id !== onAirId && fixture.home?.name && fixture.away?.name)
    .filter(fixture => !round || `${fixture.competition}|${fixture.roundLabel}` === round);
  const time = fixture => fixture.etaMs ?? scheduledMs(fixture) ?? Infinity;
  return pending.sort((a, b) => time(a) - time(b) || (a.order ?? 0) - (b.order ?? 0))[0] || null;
}

/** «Talleres vs Lourinhã · aprox. 21:48» */
export function nextLine(fixture) {
  return [`${fixture.home.name} vs ${fixture.away.name}`, when(fixture)].filter(Boolean).join(' · ');
}

function scorerLine(scorers) {
  const goals = [...(scorers?.home || []), ...(scorers?.away || [])];
  return goals.map(goal => [goal.name, goal.minute, goal.tag].filter(Boolean).join(' ')).join(' · ');
}

/**
 * @returns {null | { headline: string, subheadline: string }} null for scenes that keep the admin's texts
 */
export function sceneLowerThird({ scene, home, away, score, fixture, scorers, next }) {
  const result = score ? `${home} ${score.home}-${score.away} ${away}` : `${home} vs ${away}`;
  const round = [fixture?.competitionLabel, fixture?.roundLabel].filter(Boolean).join(' · ');
  if (scene === 'previa') {
    return { headline: `Previa: ${home} vs ${away}`, subheadline: [round, fixture && when(fixture)].filter(Boolean).join(' · ') };
  }
  if (scene === 'descanso') return { headline: `Entretiempo: ${result}`, subheadline: scorerLine(scorers) || round };
  if (scene === 'final') {
    if (next) return { headline: `Siguiente partido: ${next.home.name} vs ${next.away.name}`, subheadline: [when(next), `Final: ${result}`].filter(Boolean).join(' · ') };
    return { headline: `Final: ${result}`, subheadline: scorerLine(scorers) || round };
  }
  return null;
}
