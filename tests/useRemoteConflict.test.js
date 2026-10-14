import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isDocumentDifferent,
  resolveConflictMessage,
  normalizeValue
} from '../hooks/useRemoteConflict.js';

describe('hooks/useRemoteConflict - Core conflict detection and message formatting', () => {
  describe('normalizeValue', () => {
    it('handles null and undefined', () => {
      expect(normalizeValue(null)).toBeNull();
      expect(normalizeValue(undefined)).toBeNull();
    });

    it('extracts milliseconds from Firestore Timestamps', () => {
      const mockTimestamp = { toMillis: () => 1700000000000 };
      expect(normalizeValue(mockTimestamp)).toBe(1700000000000);
    });

    it('extracts milliseconds from Date objects', () => {
      const date = new Date('2026-01-01T12:00:00Z');
      expect(normalizeValue(date)).toBe(date.getTime());
    });

    it('strips id and private keys from objects', () => {
      const obj = { id: 'player_123', _hidden: true, name: 'Lionel' };
      const normalized = normalizeValue(obj);
      expect(normalized).toEqual({ name: 'Lionel' });
      expect('id' in normalized).toBe(false);
      expect('_hidden' in normalized).toBe(false);
    });
  });

  describe('isDocumentDifferent - Scenario 1: Player locks and signings', () => {
    it('returns false when neither remote nor local has a lock', () => {
      expect(isDocumentDifferent(null, null, false)).toBe(false);
      expect(isDocumentDifferent(null, { lockedBy: null }, false)).toBe(false);
    });

    it('returns true when a free player is locked by another manager', () => {
      const remoteData = { lockedBy: 'team_b', teamName: 'Real Madrid' };
      expect(isDocumentDifferent(remoteData, null, true)).toBe(true);
      expect(isDocumentDifferent(remoteData, { lockedBy: null }, true)).toBe(true);
    });

    it('returns false when remote lock matches local version', () => {
      const localVersion = { lockedBy: 'team_b', teamName: 'Real Madrid' };
      const remoteData = { lockedBy: 'team_b', teamName: 'Real Madrid' };
      expect(isDocumentDifferent(remoteData, localVersion, true)).toBe(false);
    });

    it('returns true when player is bought or locked by a different team', () => {
      const localVersion = { lockedBy: 'team_a', teamName: 'Barcelona' };
      const remoteData = { lockedBy: 'team_b', teamName: 'Real Madrid' };
      expect(isDocumentDifferent(remoteData, localVersion, true)).toBe(true);
    });

    it('returns true when player lock is released remotely', () => {
      const localVersion = { lockedBy: 'team_a', teamName: 'Barcelona' };
      expect(isDocumentDifferent(null, localVersion, false)).toBe(true);
    });
  });

  describe('isDocumentDifferent - Scenario 2: Offers (accepted/rejected/countered)', () => {
    it('returns false when offer status is identical', () => {
      const localOffer = { status: 'pending', offerAmount: 10000000 };
      const remoteOffer = { status: 'pending', offerAmount: 10000000 };
      expect(isDocumentDifferent(remoteOffer, localOffer, true)).toBe(false);
    });

    it('returns true when offer status changes from pending to countered', () => {
      const localOffer = { status: 'pending', offerAmount: 10000000 };
      const remoteOffer = { status: 'countered', offerAmount: 10000000, counterAmount: 12000000 };
      expect(isDocumentDifferent(remoteOffer, localOffer, true)).toBe(true);
    });

    it('returns true when counterAmount changes', () => {
      const localOffer = { status: 'countered', counterAmount: 12000000 };
      const remoteOffer = { status: 'countered', counterAmount: 14000000 };
      expect(isDocumentDifferent(remoteOffer, localOffer, true)).toBe(true);
    });

    it('returns true when offer is accepted or rejected', () => {
      const localOffer = { status: 'pending' };
      expect(isDocumentDifferent({ status: 'accepted' }, localOffer, true)).toBe(true);
      expect(isDocumentDifferent({ status: 'rejected' }, localOffer, true)).toBe(true);
    });

    it('supports string status as lastKnownVersion', () => {
      expect(isDocumentDifferent({ status: 'countered' }, 'pending', true)).toBe(true);
      expect(isDocumentDifferent({ status: 'pending' }, 'pending', true)).toBe(false);
    });
  });

  describe('isDocumentDifferent - Scenario 3: Formations and general versioning', () => {
    it('returns true when formation updatedAt changes', () => {
      const local = { formation: '4-3-3', updatedAt: 1000 };
      const remote = { formation: '4-3-3', updatedAt: 2000 };
      expect(isDocumentDifferent(remote, local, true)).toBe(true);
    });

    it('returns true when numeric version increases', () => {
      expect(isDocumentDifferent({ version: 2 }, 1, true)).toBe(true);
      expect(isDocumentDifferent({ version: 2 }, 2, true)).toBe(false);
      expect(isDocumentDifferent({ version: 2 }, { version: 1 }, true)).toBe(true);
    });
  });

  describe('resolveConflictMessage', () => {
    it('formats player lock message with team name', () => {
      const msg = resolveConflictMessage(
        { lockedBy: 'user_456', teamName: 'Arsenal' },
        null,
        true
      );
      expect(msg).toBe('Este jugador fue fichado por otro manager (Arsenal). Actualiza para ver los cambios.');
    });

    it('formats player lock message without team name', () => {
      const msg = resolveConflictMessage(
        { lockedBy: 'user_456' },
        null,
        true
      );
      expect(msg).toBe('Este jugador fue fichado por otro manager. Actualiza para ver los cambios.');
    });

    it('formats offer countered message', () => {
      const msg = resolveConflictMessage({ status: 'countered' }, { status: 'pending' }, true);
      expect(msg).toBe('Has recibido una contraoferta. Actualiza para ver los cambios.');
    });

    it('formats offer accepted message', () => {
      const msg = resolveConflictMessage({ status: 'accepted' }, { status: 'pending' }, true);
      expect(msg).toBe('La oferta fue aceptada por la otra parte. Actualiza para ver los cambios.');
    });

    it('formats offer rejected message', () => {
      const msg = resolveConflictMessage({ status: 'rejected' }, { status: 'pending' }, true);
      expect(msg).toBe('La oferta fue rechazada por la otra parte. Actualiza para ver los cambios.');
    });

    it('formats formation modification message', () => {
      const msg = resolveConflictMessage({ formation: '4-4-2' }, { formation: '4-3-3' }, true);
      expect(msg).toBe('La alineación fue modificada por otro usuario o en otra sesión. Actualiza para ver los cambios.');
    });

    it('respects customMessage string or callback function', () => {
      const customStr = resolveConflictMessage({}, {}, true, '¡Atención! Cambio detectado.');
      expect(customStr).toBe('¡Atención! Cambio detectado.');

      const customFn = resolveConflictMessage(
        { playerName: 'Messi' },
        {},
        true,
        (rem) => `El jugador ${rem.playerName} fue modificado.`
      );
      expect(customFn).toBe('El jugador Messi fue modificado.');
    });
  });
});
