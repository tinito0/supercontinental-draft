// When a scheduled market opens. Shared by the market function (UTC runtime) and the app (manager's
// browser), so both compare against the same instant. Pure.

/** The league plays on Argentine time (no daylight saving). Used only for values saved without a zone. */
export const LEAGUE_UTC_OFFSET = '-03:00';

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * config/market.openTime → Date, or null when missing or invalid.
 * New values are ISO instants (GeneralAdminSection saves toISOString()). Older ones were the admin's
 * datetime-local text ('YYYY-MM-DDTHH:mm', no zone): they are read as league time, not as the reader's
 * own zone, which on the server is UTC (it opened 3 h early).
 */
export function parseOpenTime(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const date = new Date(HAS_ZONE.test(text) ? text : `${text.length === 16 ? `${text}:00` : text}${LEAGUE_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
