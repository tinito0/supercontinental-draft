---
target: pagina publica de la liga
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\open\\Documents\\PROGRAMA SUPER2\\screens\\league"
timestamp: 2026-10-29T06-54-52Z
slug: screens-league
---
Method: dual-agent (A: design review · B: detector + browser)
Data state: live Firestore, pre-season (no fixtures, empty rules/history, all-zero table). Match screen and /en-vivo not seen with content.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Pre-season table shows ranks 1-12 + Oro/Plata zone bars on alphabetical zero rows |
| 2 | Match System / Real World | 3 | "Los franquicia de esta temporada" (LeagueHomeScreen.jsx:150); "Fechas suizas" unexplained |
| 3 | User Control and Freedom | 3 | URL-backed tabs, 404 with way back |
| 4 | Consistency and Standards | 2 | Boxed chapter cards w/ accent stripe, nav backdrop-blur, 350ms reveal vs DS |
| 5 | Error Prevention | 3 | Read-only surface |
| 6 | Recognition Rather Than Recall | 3 | Torneo tabs clipped at 390px with no scroll cue |
| 7 | Flexibility and Efficiency | n/a | Persuade/Read surface |
| 8 | Aesthetic and Minimalist Design | 2 | Mobile home ~7.6 screens; four stacked "nothing yet" blocks; socials twice |
| 9 | Error Recovery | 3 | Alert everywhere, generic copy, no retry button |
| 10 | Help and Documentation | n/a | /reglamento stands in (empty live) |
| Total | | 22/32 | Acceptable (69%) |

## Design Specificity
Mostly authored (crest ring, franchise rule block, club chapters, Copa zones, Rioplatense copy) inside a generic sports-SaaS shell. On mobile the crest ring is hidden (hidden md:block) so the phone hero loses identity.
Detector: CLI 1 finding (side-tab, LeagueLayout.jsx:24, mobile nav active marker: false positive). Browser: dark-glow on every route (false positive: value-flash keyframe in index.css, nothing glows at rest); nested-cards on / (real: dashed EmptyState inside MatchCentre card, MatchCentre.jsx:71). No overflow, no console errors, 0 contrast failures, 1 h1 per route.

## Priority Issues
1. [P1] Pre-season the table and facts look invented: ranks + zone bars on zero rows (StandingsCard), hardcoded "4 Fechas suizas / 2 Copas", teamsCount || 12 (LeagueHomeScreen.jsx:81-83). Fix: no ranks/zones until played; derive facts from tournament or drop; remove || 12. -> clarify / harden
2. [P1] Home promises empty content: rules row links to empty /reglamento, history empty, empty match tabs, zero table. Fix: hide rules row/history when empty; one pre-season line instead of two empty tabs. -> onboard / distill
3. [P1] Mobile hero has no focal object and no primary CTA (crest ring hidden md:block; both CTAs ghost). Fix: compact crest strip on mobile; one btn-primary. -> layout / bolder
4. [P2] White screen before JS: index.html has theme-color but no dark background on html/body; throttled run showed >6s white. Fix: inline style html,body{background:#080b14}. -> optimize
5. [P2] Club page: no share action; unknown id renders empty h1 + default crest; no-photo hero is a blank pt-40 slab. Fix: Compartir (navigator.share/copy), not-found state, smaller padding without photo. -> harden

## Persona Red Flags
Jordan: four "nothing yet" blocks; "Fechas suizas" unexplained; "En vivo" leads to a page meaningless without a live match.
Riley: long club names truncated in mobile torneo table; unknown club id -> empty h1; 404 has no h1.
Casey: white flash on slow network; standings club links 24px tall; torneo tabs clipped.
Manager sharing club: no share button, flat hero without photo, dashed empty franchise box as only sidebar.

## Minor
- Decorative left stripes (chapter cards, FixtureRow.jsx:146, FeaturedMatch.jsx:467).
- ink-2/ink-3 lifted near-white in .landing-root (landing.css:90-93) is deliberate; it flattens meta vs body, recover hierarchy with size/weight rather than reverting.
- Tabs measured 32px in headless desktop pointer; index.css pointer:coarse makes them 44px on phones (false positive).
- Match screen 6 tabs; comment cites SofaScore.
- Lavender franchise accent not documented in DESIGN_SYSTEM.md.

## Questions
- If the league is pre-season most of the time, why is the home built around a match centre and table instead of clubs and their stories?
- Would Torneo + Partidos merge into "Temporada", with "En vivo" only while a match is live?
- The franchise rule is the league's differentiator; why is it third on the home and absent from the mobile hero?
