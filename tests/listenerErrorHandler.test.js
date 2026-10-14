import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleListenerError,
  isExpectedDisconnection,
  _resetErrorToastCooldown
} from '../utils/listenerErrorHandler.js';

describe('utils/listenerErrorHandler', () => {
  beforeEach(() => {
    _resetErrorToastCooldown();
    vi.restoreAllMocks();
  });

  describe('isExpectedDisconnection', () => {
    it('returns true when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      expect(isExpectedDisconnection({ code: 'unavailable' })).toBe(true);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
    });

    it('returns true when error code is cancelled', () => {
      expect(isExpectedDisconnection({ code: 'cancelled' })).toBe(true);
    });

    it('returns true when message indicates client is offline', () => {
      expect(isExpectedDisconnection({ message: 'The client is offline' })).toBe(true);
    });

    it('returns false for generic or server errors when online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      expect(isExpectedDisconnection({ code: 'unavailable' })).toBe(false);
      expect(isExpectedDisconnection({ code: 'deadline-exceeded' })).toBe(false);
      expect(isExpectedDisconnection({ code: 'internal' })).toBe(false);
    });
  });

  describe('handleListenerError', () => {
    it('handles permission-denied without showing connection error toast', () => {
      const showNotification = vi.fn();
      const onPermissionDenied = vi.fn();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handleListenerError(
        { code: 'permission-denied', message: 'Missing permissions' },
        'Test Context',
        showNotification,
        { onPermissionDenied }
      );

      expect(onPermissionDenied).toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('ignores expected disconnections silently', () => {
      const showNotification = vi.fn();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleListenerError(
        { code: 'cancelled' },
        'Test Context',
        showNotification
      );

      expect(showNotification).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('shows Spanish error notification for non-permission-denied errors', () => {
      const showNotification = vi.fn();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });

      handleListenerError(
        { code: 'unavailable', message: 'Service unavailable' },
        'Tournament Data',
        showNotification
      );

      expect(errorSpy).toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith(
        'error',
        'Error de conexión con el servidor. Algunos datos pueden no estar actualizados.'
      );
    });

    it('throttles repeated error notifications within cooldown window', () => {
      const showNotification = vi.fn();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });

      // First call -> triggers notification
      handleListenerError({ code: 'unavailable' }, 'Context 1', showNotification);
      expect(showNotification).toHaveBeenCalledTimes(1);

      // Second call immediately -> throttled
      handleListenerError({ code: 'unavailable' }, 'Context 2', showNotification);
      expect(showNotification).toHaveBeenCalledTimes(1);

      // Call with bypassCooldown -> triggers
      handleListenerError({ code: 'unavailable' }, 'Context 3', showNotification, { bypassCooldown: true });
      expect(showNotification).toHaveBeenCalledTimes(2);
    });

    it('supports custom error message', () => {
      const showNotification = vi.fn();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });

      handleListenerError(
        { code: 'resource-exhausted' },
        'Custom Context',
        showNotification,
        { message: 'Mensaje personalizado de error' }
      );

      expect(showNotification).toHaveBeenCalledWith('error', 'Mensaje personalizado de error');
    });
  });
});
