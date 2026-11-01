// Public lineup view: falls back to the Firestore REST API when the SDK channel is blocked (synthetic responses).
import { loadSharedFormation, sharedFormationUrl, FormationNotFoundError } from '../services/sharedFormationService.js';

const deps = extra => ({ projectId: 'proj', apiKey: 'key', appId: 'app', sdkTimeoutMs: 50, ...extra });
const restBody = { fields: { teamName: { stringValue: 'Portland Rovers' }, formationKey: { stringValue: '4-3-3' }, isPublic: { booleanValue: true } } };
const okFetch = body => async () => ({ ok: true, status: 200, json: async () => body });

describe('loadSharedFormation', () => {
  test('uses the SDK when it answers', async () => {
    const fetchImpl = vi.fn();
    const result = await loadSharedFormation('f1', deps({ readWithSdk: async () => ({ teamName: 'A' }), fetchImpl }));
    expect(result).toEqual({ data: { teamName: 'A' }, source: 'sdk' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a missing document is reported as such, without a REST call', async () => {
    const fetchImpl = vi.fn();
    await expect(loadSharedFormation('f1', deps({ readWithSdk: async () => null, fetchImpl }))).rejects.toBeInstanceOf(FormationNotFoundError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('falls back to REST when the SDK fails (blocked channel, «client is offline»)', async () => {
    const result = await loadSharedFormation('f1', deps({
      readWithSdk: async () => { throw new Error('Failed to get document because the client is offline.'); },
      fetchImpl: okFetch(restBody),
    }));
    expect(result.source).toBe('rest');
    expect(result.data).toEqual({ teamName: 'Portland Rovers', formationKey: '4-3-3', isPublic: true });
  });

  test('falls back to REST when the SDK hangs', async () => {
    const result = await loadSharedFormation('f1', deps({ readWithSdk: () => new Promise(() => {}), fetchImpl: okFetch(restBody) }));
    expect(result.source).toBe('rest');
  });

  test('a REST 404 means the formation does not exist', async () => {
    await expect(loadSharedFormation('f1', deps({
      readWithSdk: async () => { throw new Error('offline'); },
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }))).rejects.toBeInstanceOf(FormationNotFoundError);
  });

  test('builds the public document URL', () => {
    expect(sharedFormationUrl({ projectId: 'p', apiKey: 'k', appId: 'a', formationId: 'x y' }))
      .toBe('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/artifacts/a/public/data/shared_formations/x%20y?key=k');
  });
});
