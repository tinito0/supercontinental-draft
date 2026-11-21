import { useEffect, useRef, useState } from 'react';
import { GOAL_CAMERA_DELAY_MS, GOAL_CAMERA_MS, goalCamera, goalSide, tourCamera, CAMERA_TOUR_STEP_MS } from '../utils/obsAutoScene.js';

/**
 * Which overlay-level scene the remote control source should put on OBS right now: the overlay scene, a camera tour
 * through Previa and Final (Jugador 1, Jugador 2, then Relator, 12 s each), and the scorer's camera 5 s after a goal
 * for 8 s while a match is live. Returns an overlay scene id or a camera id (utils/obsAutoScene.js obsSceneName).
 * @param {string} scene effective overlay scene
 * @param {{ home: { score: number }, away: { score: number } } | null} liveMatch the game match on air
 */
export function useObsDirector(scene, liveMatch) {
  const [camera, setCamera] = useState(null);
  const [tourStart, setTourStart] = useState(() => Date.now());
  const [, tick] = useState(0);
  const lastScore = useRef(null);
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // A new scene restarts the tour and drops any goal camera.
  useEffect(() => {
    clearTimers();
    setCamera(null);
    setTourStart(Date.now());
  }, [scene]);

  // Previa/Final tour: re-render on each step until it settles on the commentator.
  useEffect(() => {
    if (!tourCamera(scene, 0)) return undefined;
    const steps = [1, 2].map(step => setTimeout(() => tick(n => n + 1), step * CAMERA_TOUR_STEP_MS - (Date.now() - tourStart)));
    return () => steps.forEach(clearTimeout);
  }, [scene, tourStart]);

  // Goals while live: 5 s for the in-game celebration, then the scorer's camera for 8 s, then back to the game.
  const score = liveMatch ? { home: liveMatch.home?.score ?? 0, away: liveMatch.away?.score ?? 0 } : null;
  const scoreKey = score ? `${score.home}-${score.away}` : '';
  useEffect(() => {
    const previous = lastScore.current;
    lastScore.current = score;
    if (scene !== 'live') return;
    const cam = goalCamera(goalSide(previous, score));
    if (!cam) return;
    clearTimers();
    timers.current.push(setTimeout(() => setCamera(cam), GOAL_CAMERA_DELAY_MS));
    timers.current.push(setTimeout(() => setCamera(null), GOAL_CAMERA_DELAY_MS + GOAL_CAMERA_MS));
  }, [scoreKey, scene]);

  useEffect(() => clearTimers, []);

  return camera || tourCamera(scene, Date.now() - tourStart) || scene;
}
