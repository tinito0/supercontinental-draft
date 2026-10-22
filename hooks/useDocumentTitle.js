import { useEffect } from 'react';
import { LEAGUE_NAME } from '../components/landing/leagueLinks.js';

/** "<page> · SuperContinental League" for the league site's pages (the league name alone on the home page). */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${LEAGUE_NAME}` : LEAGUE_NAME;
  }, [title]);
}
