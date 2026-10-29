// Uploads match summaries to the match-feed Edge Function (supabase/functions/match-feed). Keeps only the newest
// state of each match: live updates are paced (minIntervalMs), score or status changes go out at once, failures
// wait with backoff (backoffMs) and the newest state is retried then. `known` (the bridge's outbox) seeds what was
// already uploaded before a restart, so it is not sent again.
import { backoffMs, classifyFailure, hashSummary, matchKeyOf } from './bridgeCore.js';

const DEFAULT_INTERVAL_MS = 3000;

function isUrgent(summary, previous) {
  if (!previous) return true;
  return summary.status !== previous.status
    || summary.score.home !== previous.score.home || summary.score.away !== previous.score.away;
}

export function createUploader({
  endpoint, token, fetchImpl = fetch, now = Date.now, log = () => {}, minIntervalMs = DEFAULT_INTERVAL_MS,
  known = {}, onSent = () => {},
}) {
  const sent = new Map(Object.entries(known).map(([key, hash]) => [key, { hash, summary: null, at: 0 }]));
  const pending = new Map(); // matchKey -> newest summary not uploaded yet
  const health = { lastSentAt: null, lastFailure: null, failures: 0, retryAt: 0 };

  async function send(matchKey, summary) {
    const hash = hashSummary(summary);
    let failure;
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchKey, summary }),
      });
      if (response.ok) {
        sent.set(matchKey, { hash, summary, at: now() });
        if (pending.get(matchKey) === summary) pending.delete(matchKey);
        Object.assign(health, { lastSentAt: now(), lastFailure: null, failures: 0, retryAt: 0 });
        onSent(matchKey, hash, summary);
        return true;
      }
      const body = await response.json().catch(() => ({}));
      failure = { ...classifyFailure({ status: response.status }), status: response.status, detail: body.error || null };
    } catch (error) {
      failure = { ...classifyFailure({ error }), status: null, detail: error.message };
    }
    health.failures += 1;
    health.lastFailure = { ...failure, at: now() };
    health.retryAt = now() + backoffMs(health.failures);
    log(`subida fallida (${failure.status ?? 'red'}): ${failure.detail || failure.message}`);
    return false;
  }

  const waiting = () => health.failures > 0 && now() < health.retryAt;

  function due(matchKey, summary) {
    if (waiting()) return false;
    const last = sent.get(matchKey);
    if (health.failures > 0) return true;
    return isUrgent(summary, last?.summary) || now() - last.at >= minIntervalMs;
  }

  /** Queues the newest state of a match and sends it if it is due. */
  async function push(summary) {
    const matchKey = matchKeyOf(summary);
    if (sent.get(matchKey)?.hash === hashSummary(summary)) {
      pending.delete(matchKey);
      return;
    }
    pending.set(matchKey, summary);
    if (due(matchKey, summary)) await send(matchKey, summary);
  }

  /** Sends every queued state that is due (paced live updates, retries after a failure). */
  async function flush() {
    for (const [matchKey, summary] of [...pending]) {
      if (!due(matchKey, summary)) continue;
      if (!(await send(matchKey, summary))) break;
    }
  }

  /** For status.json: how many matches wait, when the last upload worked, the last failure. */
  function status() {
    return { queued: pending.size, lastSentAt: health.lastSentAt, lastFailure: health.lastFailure, retryAt: health.retryAt || null };
  }

  return { push, flush, status };
}
