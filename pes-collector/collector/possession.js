// Possession from the probe's `possession` events (S9, docs/PES_MATCH_DATA_RESEARCH.md): two ball-time counters,
// home and away, whose sum is the match-time counter. When the game fills them their share is the screen's number
// (50.62 % → 50 / 50, 46.39 % → 46 / 54; once a point off: 44.23 % → 45 / 55). In some matches the game never
// fills them (both stay 0 while the clock runs) and the real source is not located: possession is then unknown,
// never 0 %.

// The screen's rule as far as it is known (2 of 3 matches): home = trunc(share), away = 100 − home.
// The penalty shootout shows period 5 with the clock held at 90:00 or 120:00, and the counters keep running.
// An in-play penalty also reports period 5, but with the clock of the foul. After the shootout the clock goes back
// to 120:00 in period 4, so everything from its first sample on is left out.
const SHOOTOUT_MINUTES = [90, 120];
// Probe v4 sends the match-time counter read in the same sample: the two counters must add up to it. The first v4
// build read a slot that is 0 in some matches (2026-10-23), so a time of 0 is not a check.
const TIME_TOLERANCE = 2;

function isShootout(c) {
  return Array.isArray(c) && c[0] === 5 && c[2] === 0 && SHOOTOUT_MINUTES.includes(c[1]);
}

/** { home, away } in whole percent plus the raw counters, or null when the game did not measure it. */
export function buildPossession(events) {
  const shootoutAt = events.findIndex(e => isShootout(e.c));
  const played = shootoutAt === -1 ? events : events.slice(0, shootoutAt);
  const last = played.filter(e => e.t === 'possession').at(-1);
  if (!last) return null;
  const total = last.home + last.away;
  if (!(total > 0)) return null;
  if (last.time > 0 && Math.abs(total - last.time) > TIME_TOLERANCE) return null;
  const home = Math.floor((last.home * 100) / total);
  return { home, away: 100 - home, counters: { home: last.home, away: last.away } };
}
