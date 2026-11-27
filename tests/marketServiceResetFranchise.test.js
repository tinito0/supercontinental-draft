// services/marketService.js resetFranchise: an older deployed `market` function answers "Acción desconocida.";
// the app must show that the function needs a redeploy, never fall back to deleting the lock from the browser.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../config/firebase.js', () => ({ auth: { currentUser: { getIdToken: async () => 'token' } } }));
vi.mock('../config/supabase.js', () => ({ supabase: { functions: { invoke } }, supabaseConfigured: true }));

const { resetFranchise } = await import('../services/marketService.js');

beforeEach(() => invoke.mockReset());

describe('resetFranchise client', () => {
  it('sends the admin action with the team id and returns the result', async () => {
    invoke.mockResolvedValue({ data: { ok: true, result: { teamId: 'club', playerId: 7511, lock: 'released' } } });
    await expect(resetFranchise({ teamId: 'club' })).resolves.toEqual({ teamId: 'club', playerId: 7511, lock: 'released' });
    expect(invoke).toHaveBeenCalledWith('market', expect.objectContaining({ body: { action: 'resetFranchise', teamId: 'club' } }));
  });

  it('turns an unknown-action reply into a redeploy message', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ ok: false, error: 'Acción desconocida.' }) } } });
    await expect(resetFranchise({ teamId: 'club' })).rejects.toThrow('hay que volver a publicar la función market');
  });

  it('passes other server errors through unchanged', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ ok: false, error: 'Solo el administrador puede resetear la franquicia de un club.' }) } } });
    await expect(resetFranchise({ teamId: 'club' })).rejects.toThrow('Solo el administrador');
  });
});
