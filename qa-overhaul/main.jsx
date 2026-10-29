// QA harness entry: ?view=obs&scene=…&data=… renders an OBS scene at its real size.
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '../index.css';
import { BroadcastStage } from '../components/broadcast/BroadcastStage.jsx';
import { BroadcastOverlay } from '../components/BroadcastOverlay.jsx';
import { scenario, teamsById, parseLive } from './mockData.js';
import { MemoryRouter } from 'react-router-dom';
import LeagueSite from '../screens/league/LeagueSite.jsx';
import { ObsSceneStudio } from '../components/admin/obs/ObsSceneStudio.jsx';

function AdminView() {
  const state = scenario(params.get('data') || 'live');
  const [overlay, setOverlay] = React.useState({ ...state.overlay, scene: params.get('scene') || 'previa', headline: 'SUPERCONTINENTAL LEAGUE', showLowerThird: true, showTicker: true });
  window.__setOverlay = patch => setOverlay(prev => ({ ...prev, ...patch }));
  const onUpdate = async (patch, message) => { (window.__writes ||= []).push({ patch: JSON.parse(JSON.stringify(patch)), message }); setOverlay(prev => ({ ...prev, ...patch })); return true; };
  return <div className="bg-canvas min-h-screen p-6 text-ink"><ObsSceneStudio allTeams={teamsById} tournamentData={state.tournament} broadcastOverlayData={overlay} onUpdateBroadcastOverlay={onUpdate} showStatusMessage={() => {}} /></div>;
}
import '../landing.css';

function SiteView() {
  return <MemoryRouter initialEntries={[params.get('path') || '/']}><LeagueSite /></MemoryRouter>;
}

const params = new URLSearchParams(window.location.search);
const view = params.get('view') || 'obs';

function ObsView() {
  const state = scenario(params.get('data') || 'cups');
  const live = parseLive(state.liveDocs)[0] || null;
  const popup = params.get('popup') ? { visible: true, title: 'Votá al mejor del partido', text: 'Escaneá, predecí y elegí al MVP.', url: 'https://supercont-d62df.web.app/en-vivo', position: params.get('popup'), autoHideSec: 0 } : null;
  document.documentElement.classList.add('obs-source');
  document.body.style.background = params.get('bg') || '#3a5f3a';
  return (
    <BroadcastStage>
      <BroadcastOverlay
        overlayData={{ ...state.overlay, popup, showLowerThird: true, showTicker: true, card: params.get('card') ? { kind: params.get('card'), visible: true, shownAt: Date.now(), autoHideSec: 0 } : null }}
        allTeams={teamsById}
        tournamentData={state.tournament}
        forcedScene={params.get('scene')}
        liveMatch={live}
        live={live ? { score: { home: live.home.score, away: live.away.score }, scorers: { home: [], away: [] }, prediction: { home: 50, draw: 21, away: 29, total: 24, leader: 'home' }, mvpTop: [{ id: 1, name: 'Mauro Quiroga', pct: 46, votes: 11 }, { id: 2, name: 'Leo Benítez', pct: 33, votes: 8 }, { id: 3, name: 'Santi Rey', pct: 21, votes: 5 }], cup: { title: '¿Quién gana la Copa de Oro?', open: true, total: 31, options: [{ id: 'a', name: 'Portland', pct: 42, votes: 13 }, { id: 'b', name: 'Santa Cabeza', pct: 32, votes: 10 }, { id: 'c', name: 'Talleres', pct: 26, votes: 8 }] } } : null}
      />
    </BroadcastStage>
  );
}

const views = { obs: ObsView, site: SiteView, admin: AdminView };
const View = views[view] || ObsView;
ReactDOM.createRoot(document.getElementById('root')).render(<View />);
