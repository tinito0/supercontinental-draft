// confirmAction without a mounted <ConfirmHost />: it must still ask (browser dialog), never act unasked.
// Synthetic: window.confirm is stubbed; the dialog itself is checked in the browser.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { confirmAction } from '../components/ui/ConfirmDialog.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('confirmAction (no host mounted)', () => {
  it('falls back to window.confirm with the title, message and details as plain text', async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
    const result = await confirmAction({ title: '¿Usar este sorteo?', message: 'Se publica al guardar.', details: ['A vs B', 'C vs D'] });
    expect(result).toBe(true);
    expect(confirm).toHaveBeenCalledWith('¿Usar este sorteo?\n\nSe publica al guardar.\n\nA vs B\n\nC vs D');
  });

  it('resolves false when the browser dialog is cancelled', async () => {
    vi.stubGlobal('window', { confirm: () => false });
    await expect(confirmAction({ title: '¿Eliminar el partido?' })).resolves.toBe(false);
  });
});
