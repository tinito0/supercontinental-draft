// screens/LoginScreen.jsx: each Firebase auth code gets its own message with a next step.
import { describe, it, expect } from 'vitest';
import { authErrorMessage } from '../screens/LoginScreen.jsx';

const FALLBACK = 'fallback';

describe('authErrorMessage', () => {
  it('explains an offline attempt and what to do', () => {
    expect(authErrorMessage('auth/network-request-failed', FALLBACK)).toMatch(/Sin conexión\. Revisá tu internet/);
  });

  it('tells the user to wait or reset the password after too many attempts', () => {
    expect(authErrorMessage('auth/too-many-requests', FALLBACK)).toMatch(/Esperá unos minutos o restablecé/);
  });

  it('maps the wrong-credential codes to the same message that points to password reset', () => {
    const message = authErrorMessage('auth/wrong-password', FALLBACK);
    expect(message).toMatch(/Olvidaste tu contraseña/);
    expect(authErrorMessage('auth/invalid-credential', FALLBACK)).toBe(message);
    expect(authErrorMessage('auth/user-not-found', FALLBACK)).toBe(message);
  });

  it('explains a closed Google popup and a blocked one', () => {
    expect(authErrorMessage('auth/popup-closed-by-user', FALLBACK)).toMatch(/Cancelaste/);
    expect(authErrorMessage('auth/popup-blocked', FALLBACK)).toMatch(/bloqueó la ventana de Google/);
  });

  it('returns the flow fallback for any other code', () => {
    expect(authErrorMessage('auth/user-disabled', FALLBACK)).toBe(FALLBACK);
    expect(authErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('keeps em dashes out of the copy', () => {
    for (const code of ['auth/network-request-failed', 'auth/too-many-requests', 'auth/wrong-password', 'auth/popup-closed-by-user', 'auth/popup-blocked']) {
      expect(authErrorMessage(code, FALLBACK)).not.toContain('—');
    }
  });
});
