import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getTimestampMillis,
  isPresenceActive,
  isPresenceStale,
  FIVE_MINUTES_MS,
  TEN_MINUTES_MS,
} from '../hooks/useOnlinePresence.js';
import { OnlineIndicator } from '../components/ui/OnlineIndicator.jsx';

describe('hooks/useOnlinePresence - Core logic', () => {
  describe('getTimestampMillis', () => {
    it('handles null, undefined and invalid values', () => {
      expect(getTimestampMillis(null)).toBe(0);
      expect(getTimestampMillis(undefined)).toBe(0);
      expect(getTimestampMillis('')).toBe(0);
    });

    it('extracts milliseconds from Firestore Timestamps with toMillis()', () => {
      const ts = { toMillis: () => 1700000000000 };
      expect(getTimestampMillis(ts)).toBe(1700000000000);
    });

    it('extracts milliseconds from Firestore Timestamps with toDate()', () => {
      const d = new Date(1700000000000);
      const ts = { toDate: () => d };
      expect(getTimestampMillis(ts)).toBe(1700000000000);
    });

    it('extracts milliseconds from Date instances', () => {
      const d = new Date('2026-09-24T12:00:00Z');
      expect(getTimestampMillis(d)).toBe(d.getTime());
    });

    it('handles numeric milliseconds directly', () => {
      expect(getTimestampMillis(1690000000000)).toBe(1690000000000);
    });

    it('handles seconds object (Firestore REST format)', () => {
      expect(getTimestampMillis({ seconds: 1700000 })).toBe(1700000000);
    });

    it('handles ISO string timestamps', () => {
      const iso = '2026-09-24T12:00:00.000Z';
      expect(getTimestampMillis(iso)).toBe(Date.parse(iso));
    });
  });

  describe('isPresenceActive', () => {
    const fixedNow = 1700000000000;

    it('returns false when data is null or invalid', () => {
      expect(isPresenceActive(null, fixedNow)).toBe(false);
      expect(isPresenceActive(undefined, fixedNow)).toBe(false);
    });

    it('returns false when online is explicitly false (even if lastSeen is recent)', () => {
      const data = {
        online: false,
        lastSeen: fixedNow - 30 * 1000, // 30 sec ago
      };
      expect(isPresenceActive(data, fixedNow)).toBe(false);
    });

    it('returns true when online is true', () => {
      const data = {
        online: true,
        lastSeen: fixedNow - 60 * 1000,
      };
      expect(isPresenceActive(data, fixedNow)).toBe(true);
    });

    it('returns true when online is true even if timestamp is pending (null)', () => {
      const data = {
        online: true,
        lastSeen: null,
      };
      expect(isPresenceActive(data, fixedNow)).toBe(true);
    });

    it('returns true when lastSeen is within last 5 minutes and not explicitly offline', () => {
      const data = {
        lastSeen: fixedNow - (FIVE_MINUTES_MS - 1000), // 4m 59s ago
      };
      expect(isPresenceActive(data, fixedNow)).toBe(true);
    });

    it('returns false when lastSeen is older than 5 minutes and online is not true', () => {
      const data = {
        lastSeen: fixedNow - (FIVE_MINUTES_MS + 5000), // 5m 5s ago
      };
      expect(isPresenceActive(data, fixedNow)).toBe(false);
    });
  });

  describe('isPresenceStale', () => {
    const fixedNow = 1700000000000;

    it('returns false if lastSeen is missing or invalid', () => {
      expect(isPresenceStale({ online: false }, fixedNow)).toBe(false);
      expect(isPresenceStale(null, fixedNow)).toBe(false);
    });

    it('returns false if lastSeen is within 10 minutes', () => {
      const data = {
        lastSeen: fixedNow - (TEN_MINUTES_MS - 10000), // 9m 50s ago
      };
      expect(isPresenceStale(data, fixedNow)).toBe(false);
    });

    it('returns true if lastSeen is older than 10 minutes', () => {
      const data = {
        lastSeen: fixedNow - (TEN_MINUTES_MS + 1000), // 10m 1s ago
      };
      expect(isPresenceStale(data, fixedNow)).toBe(true);
    });
  });
});

describe('components/ui/OnlineIndicator', () => {
  it('renders default online count (1 online)', () => {
    const html = renderToString(React.createElement(OnlineIndicator));
    expect(html).toContain('1 online');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('renders custom online count (e.g. 3 online)', () => {
    const html = renderToString(React.createElement(OnlineIndicator, { count: 3 }));
    expect(html).toContain('3 online');
    expect(html).toContain('3 managers en línea');
  });

  it('renders via onlineCount prop', () => {
    const html = renderToString(React.createElement(OnlineIndicator, { onlineCount: 5 }));
    expect(html).toContain('5 online');
  });

  it('applies exact specification styling classes', () => {
    const html = renderToString(React.createElement(OnlineIndicator, { count: 2 }));
    expect(html).toContain('bg-emerald-500/10');
    expect(html).toContain('border-emerald-500/20');
    expect(html).toContain('text-emerald-400');
    expect(html).toContain('text-[11px]');
    expect(html).toContain('font-bold');
    expect(html).toContain('px-2.5');
    expect(html).toContain('py-1');
    expect(html).toContain('rounded-full');
  });

  it('contains pulsing green dot animation elements', () => {
    const html = renderToString(React.createElement(OnlineIndicator, { count: 1 }));
    expect(html).toContain('animate-pulse');
    expect(html).toContain('animate-ping');
    expect(html).toContain('bg-emerald-400');
  });
});

describe('components/TopHeader integration', () => {
  it('renders OnlineIndicator inside TopHeader', async () => {
    const { TopHeader } = await import('../components/TopHeader.jsx');
    const html = renderToString(
      React.createElement(TopHeader, {
        userProfile: { teamName: 'Atlético Test', logoUrl: '' },
        onlineCount: 4,
        remainingBudget: 50000000,
        unreadCount: 0,
        unreadChatCount: 0,
      })
    );

    expect(html).toContain('4 online');
    expect(html).toContain('Atlético Test');
    expect(html).toContain('role="status"');
    expect(html).toContain('Presupuesto:');
  });
});

