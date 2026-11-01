// Loads a shared lineup for the public view (/draft/tactics/view/:id), which people open without an account.
// The Firestore SDK reaches the server over a long-lived channel that some browsers break (Brave shields, content
// blockers, captive networks): getDoc then fails with «client is offline» and the page showed «Formación no
// disponible» although the document was there. If the SDK fails or stalls, the same document is read with one plain
// HTTPS request to the Firestore REST API (shared_formations is world-readable in firestore.rules).
import { decodeFields } from '../supabase/functions/_shared/firestoreValues.js';

const SDK_TIMEOUT_MS = 6000;

export class FormationNotFoundError extends Error {}

/** REST URL of a shared formation document. */
export function sharedFormationUrl({ projectId, apiKey, appId, formationId }) {
  const path = `artifacts/${encodeURIComponent(appId)}/public/data/shared_formations/${encodeURIComponent(formationId)}`;
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?key=${encodeURIComponent(apiKey)}`;
}

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Firestore no respondió en ${ms / 1000} s`)), ms)),
]);

/**
 * @param {string} formationId
 * @param {{ readWithSdk: () => Promise<object|null>, projectId: string, apiKey: string, appId: string,
 *   fetchImpl?: typeof fetch, sdkTimeoutMs?: number }} deps readWithSdk resolves the data, or null when missing
 * @returns {Promise<{ data: object, source: 'sdk'|'rest' }>} throws FormationNotFoundError when it does not exist
 */
export async function loadSharedFormation(formationId, { readWithSdk, projectId, apiKey, appId, fetchImpl = fetch, sdkTimeoutMs = SDK_TIMEOUT_MS }) {
  let sdkError = null;
  try {
    const data = await withTimeout(readWithSdk(), sdkTimeoutMs);
    if (data == null) throw new FormationNotFoundError('missing');
    return { data, source: 'sdk' };
  } catch (err) {
    if (err instanceof FormationNotFoundError) throw err;
    sdkError = err;
  }

  if (!projectId || !apiKey) throw sdkError;
  const response = await fetchImpl(sharedFormationUrl({ projectId, apiKey, appId, formationId }));
  if (response.status === 404) throw new FormationNotFoundError('missing');
  if (!response.ok) {
    const restError = new Error(`Firestore REST ${response.status}`);
    restError.cause = sdkError;
    throw restError;
  }
  const body = await response.json();
  return { data: decodeFields(body.fields), source: 'rest' };
}
