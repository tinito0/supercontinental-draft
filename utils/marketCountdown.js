// Countdown text for the scheduled market opening (components/MarketClosedBanner.jsx). Pure.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = n => String(n).padStart(2, '0');

/**
 * "2 d 03:14:05" above a day, "03:14:05" below it, '' once the time has passed.
 * @param {number} msLeft milliseconds until the opening
 */
export function formatCountdown(msLeft) {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return '';
  const days = Math.floor(msLeft / DAY);
  const hours = Math.floor((msLeft % DAY) / HOUR);
  const minutes = Math.floor((msLeft % HOUR) / MINUTE);
  const seconds = Math.floor((msLeft % MINUTE) / SECOND);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} d ${clock}` : clock;
}

/** Short time left for an offer's turn: "31 h", "45 min", "menos de 1 min". */
export function formatTimeLeft(msLeft) {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return '';
  if (msLeft >= HOUR) return `${Math.floor(msLeft / HOUR)} h`;
  if (msLeft >= MINUTE) return `${Math.floor(msLeft / MINUTE)} min`;
  return 'menos de 1 min';
}
