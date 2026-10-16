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
