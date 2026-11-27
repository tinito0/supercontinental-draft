import { useEffect, useState } from 'react';
import { tourCamera, CAMERA_TOUR_STEP_MS } from '../utils/obsAutoScene.js';

/**
 * Which overlay-level scene the remote control source should put on OBS right now: the overlay scene, plus a camera
 * tour through Final (Jugador 1, Jugador 2, then Relator, 12 s each). No cameras in Previa nor after goals
 * (removed 2026-11-26). Returns an overlay scene id or a camera id (utils/obsAutoScene.js obsSceneName).
 * @param {string} scene effective overlay scene
 */
export function useObsDirector(scene) {
  const [tourStart, setTourStart] = useState(() => Date.now());
  const [, tick] = useState(0);

  // A new scene restarts the tour.
  useEffect(() => { setTourStart(Date.now()); }, [scene]);

  // Final tour: re-render on each step until it settles on the commentator.
  useEffect(() => {
    if (!tourCamera(scene, 0)) return undefined;
    const steps = [1, 2].map(step => setTimeout(() => tick(n => n + 1), step * CAMERA_TOUR_STEP_MS - (Date.now() - tourStart)));
    return () => steps.forEach(clearTimeout);
  }, [scene, tourStart]);

  return tourCamera(scene, Date.now() - tourStart) || scene;
}
