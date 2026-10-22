// Partidos de la liga en una sola forma para la web pública, el OBS y el admin. Puro; tests/leagueFixtures.test.js.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Fecha del fixture ('YYYY-MM-DD', día local: sin corrimiento por zona horaria) o null. */
export function fixtureDay(match) {
  const parts = DATE_RE.exec(String(match?.date || ''));
  if (!parts) return null;
  const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(day.getTime()) ? null : day;
}

/** Hora de inicio cargada ('HH:mm') o ''. */
export function fixtureTime(match) {
  return TIME_RE.test(String(match?.time || '')) ? match.time : '';
}

/** «sáb 14/12 · 21:00», «sáb 14/12» o '' si no hay fecha. La hora sola no alcanza para mostrar algo. */
export function formatFixtureDate(match) {
  const day = fixtureDay(match);
  if (!day) return '';
  const label = day.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '');
  const time = fixtureTime(match);
  return time ? `${label} · ${time}` : label;
}
