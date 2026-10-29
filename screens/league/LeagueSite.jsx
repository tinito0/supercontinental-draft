import React, { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LeagueLayout } from '../../components/league/LeagueLayout.jsx';

/* Public league site, mounted at the root by main.jsx (the draft lives under /draft, utils/siteRoutes.js).
   Texts (history, club histories, season rules) are written in the draft's Administración → Web pública;
   club pages add the club's history to the draft's public team view (screens/TeamScreen.jsx). */

const LeagueHomeScreen = lazy(() => import('./LeagueHomeScreen.jsx'));
const LeagueHistoryScreen = lazy(() => import('./LeagueHistoryScreen.jsx'));
const LeagueTeamsScreen = lazy(() => import('./LeagueTeamsScreen.jsx'));
const LeagueClubScreen = lazy(() => import('./LeagueClubScreen.jsx'));
const LeagueTournamentScreen = lazy(() => import('./LeagueTournamentScreen.jsx'));
const LeagueMatchesScreen = lazy(() => import('./LeagueMatchesScreen.jsx'));
const LeagueMatchScreen = lazy(() => import('./LeagueMatchScreen.jsx'));
const LeagueLiveScreen = lazy(() => import('./LeagueLiveScreen.jsx'));
const LeagueRulesScreen = lazy(() => import('./LeagueRulesScreen.jsx'));
const LeagueNotFoundScreen = lazy(() => import('./LeagueNotFoundScreen.jsx'));

export default function LeagueSite() {
  return (
    <Routes>
      <Route element={<LeagueLayout />}>
        <Route index element={<LeagueHomeScreen />} />
        <Route path="historia" element={<LeagueHistoryScreen />} />
        <Route path="equipos" element={<LeagueTeamsScreen />} />
        <Route path="equipos/:userId" element={<LeagueClubScreen />} />
        <Route path="torneo" element={<LeagueTournamentScreen />} />
        <Route path="partidos" element={<LeagueMatchesScreen />} />
        <Route path="partidos/:matchKey" element={<LeagueMatchScreen />} />
        <Route path="en-vivo" element={<LeagueLiveScreen />} />
        <Route path="reglamento" element={<LeagueRulesScreen />} />
        <Route path="*" element={<LeagueNotFoundScreen />} />
      </Route>
    </Routes>
  );
}
