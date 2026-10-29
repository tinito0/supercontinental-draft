// "Desde tu última visita" notifications built from offer histories. Pure, synthetic offers.
import { describe, it, expect } from 'vitest';
import { missedOfferNotifications } from '../utils/missedEvents.js';

const SINCE = Date.parse('2026-10-15T12:00:00Z');
const offer = {
  id: 'o1', playerId: 7, playerName: 'Delantero', senderId: 'me', targetTeamId: 'rival',
  history: [
    { type: 'sent', teamId: 'me', teamName: 'Mío', amount: 10000000, at: '2026-10-15T10:00:00Z' },
    { type: 'countered', teamId: 'rival', teamName: 'Rival', amount: 12000000, at: '2026-10-15T13:00:00Z' },
    { type: 'sent', teamId: 'me', teamName: 'Mío', amount: 11000000, at: '2026-10-15T14:00:00Z' },
    { type: 'accepted', teamId: 'rival', teamName: 'Rival', amount: 11000000, at: '2026-10-15T15:00:00Z' },
  ],
};

describe('missedOfferNotifications', () => {
  it('lists the other club’s moves after the last visit, newest first', () => {
    const items = missedOfferNotifications([offer], 'me', SINCE);
    expect(items.map(item => item.id)).toEqual(['missed-o1-3', 'missed-o1-1']);
    expect(items[0].text).toContain('Delantero ahora está en tu equipo');
    expect(items[1].text).toContain('contraofertó');
    expect(items.every(item => item.read === false)).toBe(true);
  });

  it('says sale to the seller, with the accepted amount', () => {
    const [sale] = missedOfferNotifications([{ ...offer, senderId: 'rival', targetTeamId: 'me',
      history: [{ type: 'accepted', teamId: 'rival', teamName: 'Rival', amount: 11000000, at: '2026-10-15T15:00:00Z' }] }], 'me', SINCE);
    expect(sale.text).toMatch(/Venta confirmada: Delantero se fue por/);
  });

  it('shows nothing on a first visit or for the manager’s own moves', () => {
    expect(missedOfferNotifications([offer], 'me', undefined)).toEqual([]);
    expect(missedOfferNotifications([offer], 'rival', SINCE).map(item => item.id)).toEqual(['missed-o1-2']);
  });
});
