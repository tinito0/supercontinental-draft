// What the season reset (components/admin/GeneralAdminSection.jsx) writes for each club. Pure, so it is tested
// without Firestore. Collections that are deleted whole (locks, offers, transfers, news, shared formations, offer
// messages, carts, scout data) are listed by the component.
import { DEFAULT_TACTICS } from './constants.js';

/** Formation and squad fields that start empty each season, on both the private profile and the public team. */
const SEASON_FORMATION_FIELDS = () => ({
  lineup: {},
  dorsals: {},
  formation: '4-3-3',
  setPieces: {},
  tactics: DEFAULT_TACTICS,
  availability: {},
  matchBench: [],
});

/**
 * Private profile: the franchise slot comes back. Budget, team name, logo and admin flags stay.
 */
export function profileResetData() {
  return {
    ...SEASON_FORMATION_FIELDS(),
    franchisePlayerUsed: false,
    franchisePlayerId: null,
  };
}

/**
 * Public team: the public roster is emptied too. Before, it kept last season's players, so the public team page
 * (screens/TeamScreen.jsx reads it) and other views showed them until that manager opened the app again.
 */
export function teamResetData(now = new Date()) {
  return {
    ...SEASON_FORMATION_FIELDS(),
    roster: [],
    rosterUpdatedAt: now.toISOString(),
  };
}

/**
 * The reset deletes every player lock, so it must not run while managers can sign: a signing that lands halfway
 * would survive or vanish depending on timing. Only a closed market qualifies (scheduled or franchise market can
 * open or sign during the reset).
 */
export function canResetSeason(marketStatus) {
  return marketStatus?.status === 'closed';
}
