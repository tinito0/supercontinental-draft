import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { 
  ChevronRight, Shield, Users, Zap, BarChart2, Trophy, 
  ArrowLeftRight, Target, Lock, Globe, MessageCircle,
  BookOpen, ChevronDown, ExternalLink, Package, Sliders, Radio, Cpu,
  Volume2, VolumeX, Check, Download, Search, Filter, Play, RefreshCw, Layers, CheckCircle2
} from 'lucide-react';
import { APP_NAME } from '../utils/constants.js';

/* ═══════════════════════════════════════════════════════════════════
   SHOWCASE PLAYERS
   ═══════════════════════════════════════════════════════════════════ */
const SHOWCASE_PLAYERS = [
  { id: 110718, name: 'K. MBAPPÉ',         ovr: 91, pos: 'DC',  price: 62.02, posColor: '#ef4444' },
  { id: 110815, name: 'RODRI',             ovr: 91, pos: 'MCD', price: 58.03, posColor: '#10b981' },
  { id: 44383,  name: 'T. COURTOIS',       ovr: 91, pos: 'PT',  price: 45.94, posColor: '#eab308' },
  { id: 133543, name: 'E. HAALAND',        ovr: 90, pos: 'DC',  price: 58.44, posColor: '#ef4444' },
  { id: 117047, name: 'VINÍCIUS JR.',      ovr: 90, pos: 'EI',  price: 58.44, posColor: '#ef4444' },
  { id: 47287,  name: 'H. KANE',           ovr: 90, pos: 'DC',  price: 52.41, posColor: '#ef4444' },
  { id: 132933, name: 'J. BELLINGHAM',     ovr: 89, pos: 'MO',  price: 48.23, posColor: '#10b981' },
  { id: 57123,  name: 'M. SALAH',          ovr: 89, pos: 'ED',  price: 48.13, posColor: '#ef4444' },
  { id: 44840,  name: 'V. VAN DIJK',       ovr: 89, pos: 'DFC', price: 34.72, posColor: '#3b82f6' },
  { id: 108657, name: 'LAUTARO MARTÍNEZ',  ovr: 89, pos: 'DC',  price: 55.01, posColor: '#ef4444' },
  { id: 7511,   name: 'L. MESSI',          ovr: 88, pos: 'SD',  price: 37.53, posColor: '#ef4444' },
  { id: 44379,  name: 'K. DE BRUYNE',      ovr: 88, pos: 'MO',  price: 35.90, posColor: '#10b981' },
];

/* Formations data for Interactive Tactical Board */
const FORMATIONS_DATA = {
  '4-3-3': {
    name: '4-3-3 Ofensiva',
    style: 'Posesión y presión alta',
    players: [
      { id: 44383,  name: 'Courtois',   pos: 'PT',  ovr: 91, x: 50, y: 88 },
      { id: 44840,  name: 'Van Dijk',   pos: 'DFC', ovr: 89, x: 34, y: 72 },
      { id: 108657, name: 'Rüdiger',    pos: 'DFC', ovr: 87, x: 66, y: 72 },
      { id: 110815, name: 'Rodri',      pos: 'MCD', ovr: 91, x: 50, y: 56 },
      { id: 44379,  name: 'De Bruyne',  pos: 'MC',  ovr: 88, x: 30, y: 44 },
      { id: 132933, name: 'Bellingham', pos: 'MO',  ovr: 89, x: 70, y: 44 },
      { id: 117047, name: 'Vinícius',   pos: 'EI',  ovr: 90, x: 18, y: 24 },
      { id: 57123,  name: 'Salah',      pos: 'ED',  ovr: 89, x: 82, y: 24 },
      { id: 133543, name: 'Haaland',    pos: 'DC',  ovr: 90, x: 50, y: 16 },
    ],
    tactics: {
      attackStyle: 'Posesión',
      buildup: 'Pase corto',
      attackArea: 'Por el centro',
      defLine: '8 / 10',
      pressure: 'Agresiva en campo rival',
      corners: 'K. De Bruyne',
      freekicks: 'L. Messi',
      penalties: 'H. Kane'
    }
  },
  '4-2-3-1': {
    name: '4-2-3-1 Control',
    style: 'Equilibrio y transición rápida',
    players: [
      { id: 44383,  name: 'Courtois',   pos: 'PT',  ovr: 91, x: 50, y: 88 },
      { id: 44840,  name: 'Van Dijk',   pos: 'DFC', ovr: 89, x: 35, y: 74 },
      { id: 108657, name: 'Rüdiger',    pos: 'DFC', ovr: 87, x: 65, y: 74 },
      { id: 110815, name: 'Rodri',      pos: 'MCD', ovr: 91, x: 36, y: 58 },
      { id: 44379,  name: 'De Bruyne',  pos: 'MC',  ovr: 88, x: 64, y: 58 },
      { id: 132933, name: 'Bellingham', pos: 'MO',  ovr: 89, x: 50, y: 38 },
      { id: 117047, name: 'Vinícius',   pos: 'EI',  ovr: 90, x: 20, y: 34 },
      { id: 57123,  name: 'Salah',      pos: 'ED',  ovr: 89, x: 80, y: 34 },
      { id: 110718, name: 'Mbappé',     pos: 'DC',  ovr: 91, x: 50, y: 16 },
    ],
    tactics: {
      attackStyle: 'Contraataque',
      buildup: 'Pase largo y desmarque',
      attackArea: 'Por bandas',
      defLine: '6 / 10',
      pressure: 'Contención en bloque medio',
      corners: 'M. Salah',
      freekicks: 'K. De Bruyne',
      penalties: 'K. Mbappé'
    }
  },
  '3-5-2': {
    name: '3-5-2 Contragolpe',
    style: 'Densidad central y doble punta',
    players: [
      { id: 44383,  name: 'Courtois',   pos: 'PT',  ovr: 91, x: 50, y: 88 },
      { id: 44840,  name: 'Van Dijk',   pos: 'DFC', ovr: 89, x: 50, y: 74 },
      { id: 108657, name: 'Rüdiger',    pos: 'DFC', ovr: 87, x: 28, y: 72 },
      { id: 110815, name: 'Saliba',     pos: 'DFC', ovr: 87, x: 72, y: 72 },
      { id: 44379,  name: 'De Bruyne',  pos: 'MC',  ovr: 88, x: 36, y: 52 },
      { id: 132933, name: 'Bellingham', pos: 'MO',  ovr: 89, x: 64, y: 52 },
      { id: 117047, name: 'Vinícius',   pos: 'MI',  ovr: 90, x: 16, y: 44 },
      { id: 57123,  name: 'Salah',      pos: 'MD',  ovr: 89, x: 84, y: 44 },
      { id: 133543, name: 'Haaland',    pos: 'DC',  ovr: 90, x: 38, y: 18 },
      { id: 110718, name: 'Mbappé',     pos: 'DC',  ovr: 91, x: 62, y: 18 },
    ],
    tactics: {
      attackStyle: 'Contraataque fluido',
      buildup: 'Directo y vertical',
      attackArea: 'Mixta',
      defLine: '5 / 10',
      pressure: 'Intensiva tras pérdida',
      corners: 'K. De Bruyne',
      freekicks: 'L. Messi',
      penalties: 'E. Haaland'
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════
   MINI PLAYER CARD — authentic sports card design
   ═══════════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ player }) {
  function getOvrClass(ovr) {
    if (ovr >= 90) return 'ovr-gold';
    if (ovr >= 85) return 'ovr-silver';
    return 'ovr-bronze';
  }

  return (
    <div className="landing-card">
      <div className="landing-card__photo-wrap">
        <img
          src={`/fotos_jugadores/${player.id}.webp`}
          alt={player.name}
          className="landing-card__photo"
          loading="lazy"
          decoding="async"
          width="190"
          height="220"
          onError={e => { 
            e.target.onerror = null; 
            e.target.src = `https://placehold.co/200x240/10141e/ffffff?text=${player.name.substring(0, 2)}`; 
          }}
        />
        <div className="landing-card__fade" />
        <div className="landing-card__meta-bar">
          <div className={`landing-card__ovr-badge ${getOvrClass(player.ovr)}`}>
            <span>{player.ovr}</span>
          </div>
          <span className="landing-card__pos" style={{ borderColor: player.posColor, color: '#fff' }}>
            {player.pos}
          </span>
        </div>
      </div>
      <div className="landing-card__bottom">
        <h4 className="landing-card__name" title={player.name}>{player.name}</h4>
        <div className="landing-card__price-row">
          <span className="landing-card__price-label">VALOR MERCADO</span>
          <span className="landing-card__price">${player.price.toFixed(2)}M</span>
        </div>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   SCROLL REVEAL HELPER
   ═══════════════════════════════════════════════════════════════════ */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { 
        setVisible(true); 
        observer.disconnect(); 
      }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INTERACTIVE WEB MODEL SHOWCASE (SIMULATOR)
   ═══════════════════════════════════════════════════════════════════ */
function WebAppModel() {
  const [activeTab, setActiveTab] = useState('pitch'); // 'pitch' | 'market' | 'export'
  const [selectedFormation, setSelectedFormation] = useState('4-3-3');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [simulatedBudget, setSimulatedBudget] = useState(87.98);
  const [signedPlayers, setSignedPlayers] = useState([110718]); // Mbappé signed by default
  const [exportStep, setExportStep] = useState('ready'); // 'ready' | 'generating' | 'done'

  // Current formation data
  const currentFormation = FORMATIONS_DATA[selectedFormation] || FORMATIONS_DATA['4-3-3'];

  // Market simulation list
  const marketPlayers = useMemo(() => [
    { id: 110718, name: 'K. Mbappé', pos: 'DC', ovr: 91, price: 62.02, club: 'Real Madrid' },
    { id: 110815, name: 'Rodri', pos: 'MCD', ovr: 91, price: 58.03, club: 'Man City' },
    { id: 44383,  name: 'T. Courtois', pos: 'PT', ovr: 91, price: 45.94, club: 'Real Madrid' },
    { id: 133543, name: 'E. Haaland', pos: 'DC', ovr: 90, price: 58.44, club: 'Man City' },
    { id: 132933, name: 'J. Bellingham', pos: 'MO', ovr: 89, price: 48.23, club: 'Real Madrid' },
    { id: 44840,  name: 'V. Van Dijk', pos: 'DFC', ovr: 89, price: 34.72, club: 'Liverpool' },
  ], []);

  const filteredMarket = useMemo(() => {
    if (marketFilter === 'ALL') return marketPlayers;
    if (marketFilter === 'FW') return marketPlayers.filter(p => ['DC', 'EI', 'ED'].includes(p.pos));
    if (marketFilter === 'MF') return marketPlayers.filter(p => ['MCD', 'MC', 'MO'].includes(p.pos));
    if (marketFilter === 'DF') return marketPlayers.filter(p => ['DFC', 'LI', 'LD'].includes(p.pos));
    if (marketFilter === 'GK') return marketPlayers.filter(p => p.pos === 'PT');
    return marketPlayers;
  }, [marketPlayers, marketFilter]);

  const toggleSignPlayer = (player) => {
    const isSigned = signedPlayers.includes(player.id);
    if (isSigned) {
      setSignedPlayers(prev => prev.filter(id => id !== player.id));
      setSimulatedBudget(prev => +(prev + player.price).toFixed(2));
    } else {
      if (simulatedBudget >= player.price) {
        setSignedPlayers(prev => [...prev, player.id]);
        setSimulatedBudget(prev => +(prev - player.price).toFixed(2));
      }
    }
  };

  const handleSimulateExport = () => {
    setExportStep('generating');
    setTimeout(() => {
      setExportStep('done');
      setTimeout(() => setExportStep('ready'), 3500);
    }, 1200);
  };

  return (
    <div className="web-model">
      {/* App Shell Top Header Preview */}
      <div className="web-model__shell-header">
        <div className="web-model__shell-controls">
          <span className="web-model__shell-dot web-model__shell-dot--red" />
          <span className="web-model__shell-dot web-model__shell-dot--yellow" />
          <span className="web-model__shell-dot web-model__shell-dot--green" />
          <span className="web-model__shell-url">supercontinental.app / draft-workspace</span>
        </div>

        {/* Navigation Tabs */}
        <div className="web-model__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pitch'}
            onClick={() => setActiveTab('pitch')}
            className={`web-model__tab ${activeTab === 'pitch' ? 'is-active' : ''}`}
          >
            <Sliders className="w-4 h-4" />
            <span>Pizarra Táctica S1</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'market'}
            onClick={() => setActiveTab('market')}
            className={`web-model__tab ${activeTab === 'market' ? 'is-active' : ''}`}
          >
            <Zap className="w-4 h-4" />
            <span>Mercado en Vivo</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'export'}
            onClick={() => setActiveTab('export')}
            className={`web-model__tab ${activeTab === 'export' ? 'is-active' : ''}`}
          >
            <Package className="w-4 h-4" />
            <span>Option File PES 2021</span>
          </button>
        </div>
      </div>

      {/* App Body Content */}
      <div className="web-model__body">
        {/* ─── TAB 1: PIZARRA TÁCTICA ─── */}
        {activeTab === 'pitch' && (
          <div className="web-model__pitch-view">
            {/* Left: Tactical Pitch Board */}
            <div className="web-model__pitch-col">
              <div className="web-model__pitch-controls">
                <span className="web-model__label">Formación Activa:</span>
                <div className="web-model__formation-btns">
                  {Object.keys(FORMATIONS_DATA).map(fKey => (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => setSelectedFormation(fKey)}
                      className={`web-model__pill-btn ${selectedFormation === fKey ? 'is-selected' : ''}`}
                    >
                      {fKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pitch Canvas Simulation */}
              <div className="web-model__pitch-canvas">
                {/* Turf Grass & Lines */}
                <div className="web-model__pitch-line web-model__pitch-line--box-top" />
                <div className="web-model__pitch-line web-model__pitch-line--box-bottom" />
                <div className="web-model__pitch-line web-model__pitch-line--halfway" />
                <div className="web-model__pitch-line web-model__pitch-line--center-circle" />

                {/* Tactical Player Nodes on Field */}
                {currentFormation.players.map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    className="web-model__pitch-player"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    title={`${p.name} (${p.pos} · ${p.ovr})`}
                  >
                    <div className="web-model__player-disc">
                      <img
                        src={`/fotos_jugadores/${p.id}.webp`}
                        alt=""
                        className="web-model__player-photo"
                        onError={e => {
                          e.target.onerror = null;
                          e.target.src = `https://placehold.co/80x80/0f141d/ffffff?text=${p.name.substring(0, 2)}`;
                        }}
                      />
                      <span className="web-model__player-pos-badge">{p.pos}</span>
                    </div>
                    <span className="web-model__player-name-tag">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Tactics S1 Parameters Panel */}
            <div className="web-model__tactics-col">
              <div className="web-model__panel-header">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h4>Estrategia S1 (Preset Oficial)</h4>
              </div>

              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Estilo de Ataque</span>
                <span className="web-model__tactic-val">{currentFormation.tactics.attackStyle}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Construcción</span>
                <span className="web-model__tactic-val">{currentFormation.tactics.buildup}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Zona de Ataque</span>
                <span className="web-model__tactic-val">{currentFormation.tactics.attackArea}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Línea Defensiva</span>
                <span className="web-model__tactic-val">{currentFormation.tactics.defLine}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Tipo de Presión</span>
                <span className="web-model__tactic-val">{currentFormation.tactics.pressure}</span>
              </div>

              <div className="web-model__divider" />

              <div className="web-model__panel-header">
                <Target className="w-4 h-4 text-amber-400" />
                <h4>Lanzadores Asignados PES</h4>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Tiros Libres</span>
                <span className="web-model__tactic-val text-amber-300">{currentFormation.tactics.freekicks}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Penales</span>
                <span className="web-model__tactic-val text-amber-300">{currentFormation.tactics.penalties}</span>
              </div>
              <div className="web-model__tactic-item">
                <span className="web-model__tactic-label">Saques de Esquina</span>
                <span className="web-model__tactic-val text-amber-300">{currentFormation.tactics.corners}</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: MERCADO EN VIVO ─── */}
        {activeTab === 'market' && (
          <div className="web-model__market-view">
            {/* Market Status Bar */}
            <div className="web-model__market-status-bar">
              <div className="web-model__budget-pill">
                <span className="web-model__budget-lbl">Presupuesto Restante:</span>
                <span className="web-model__budget-num">${simulatedBudget.toFixed(2)}M</span>
              </div>
              <div className="web-model__market-filters">
                {[
                  { key: 'ALL', label: 'Todos' },
                  { key: 'FW', label: 'Delanteros' },
                  { key: 'MF', label: 'Medios' },
                  { key: 'DF', label: 'Defensas' },
                  { key: 'GK', label: 'Porteros' },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setMarketFilter(f.key)}
                    className={`web-model__filter-chip ${marketFilter === f.key ? 'is-selected' : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Market Players Grid */}
            <div className="web-model__market-grid">
              {filteredMarket.map(p => {
                const isSigned = signedPlayers.includes(p.id);
                return (
                  <div key={p.id} className={`web-model__market-item ${isSigned ? 'is-signed' : ''}`}>
                    <img
                      src={`/fotos_jugadores/${p.id}.webp`}
                      alt={p.name}
                      className="web-model__market-thumb"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = `https://placehold.co/60x60/10141e/ffffff?text=${p.name.substring(0, 2)}`;
                      }}
                    />
                    <div className="web-model__market-info">
                      <div className="web-model__market-name-row">
                        <span className="web-model__market-name">{p.name}</span>
                        <span className="web-model__market-ovr">{p.ovr}</span>
                      </div>
                      <div className="web-model__market-sub-row">
                        <span className="web-model__market-pos">{p.pos}</span>
                        <span className="web-model__market-price">${p.price.toFixed(2)}M</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSignPlayer(p)}
                      className={`web-model__action-btn ${isSigned ? 'is-danger' : 'is-primary'}`}
                    >
                      {isSigned ? 'Liberar' : 'Fichar'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB 3: OPTION FILE EXPORT ─── */}
        {activeTab === 'export' && (
          <div className="web-model__export-view">
            <div className="web-model__export-meta">
              <h4>Ecosistema de Archivos para Editor EJOGC327 (PES 2021)</h4>
              <p>Generación automática de tablas relacionales CSV listas para importar sin pasos manuales.</p>
            </div>

            <div className="web-model__files-grid">
              {[
                { name: 'Formation.csv', desc: 'Coordenadas X/Y de los 11 titulares, suplentes y Preset S1.' },
                { name: 'Roster.csv', desc: 'Fichas de 23 jugadores vinculados al equipo y dorsales oficiales.' },
                { name: 'Players.csv', desc: 'Estadísticas, habilidades especiales y posiciones adaptadas al motor PES.' },
                { name: 'Appearances.csv', desc: 'Identificadores de rostros, accesorios y botines.' },
                { name: 'Team.csv', desc: 'Nombre, director técnico, ID de club y colores institucionales.' }
              ].map(f => (
                <div key={f.name} className="web-model__file-card">
                  <div className="web-model__file-header">
                    <Package className="w-4 h-4 text-cyan-400" />
                    <span className="web-model__file-name">{f.name}</span>
                    <span className="web-model__file-badge">CSV VÁLIDO</span>
                  </div>
                  <p className="web-model__file-desc">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="web-model__export-action-bar">
              <button
                type="button"
                onClick={handleSimulateExport}
                disabled={exportStep === 'generating'}
                className="web-model__download-btn"
              >
                {exportStep === 'generating' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Empaquetando CSVs...</span>
                  </>
                ) : exportStep === 'done' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>¡Paquete Option File Listo (.ZIP)!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Generar y Descargar Option File (.ZIP)</span>
                  </>
                )}
              </button>
              <span className="web-model__export-compat">Compatibilidad comprobada con PES 2021 Season Update (PC / PS4 / PS5)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export function LandingPage({ onEnter }) {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Toggle video audio
  const handleToggleAudio = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  // Duplicate cards for seamless infinite scroll
  const carouselCards = useMemo(() => [...SHOWCASE_PLAYERS, ...SHOWCASE_PLAYERS], []);

  return (
    <div className="landing-root">
      {/* ═══════════ TOP NAVIGATION ═══════════ */}
      <header className="landing-nav">
        <div className="landing-nav__inner">
          <div className="landing-nav__brand">
            <img src="/logo.webp" alt="SCL" className="landing-nav__logo" width="34" height="34" />
            <div className="landing-nav__titles">
              <span className="landing-nav__title">{APP_NAME}</span>
              <span className="landing-nav__subtitle">LIGA MASTER PES 2021</span>
            </div>
          </div>

          <div className="landing-nav__links">
            <a href="#modelo-web" className="landing-nav__link">Plataforma Web</a>
            <a href="#pilares" className="landing-nav__link">Pilares</a>
            <a href="#reglamento" className="landing-nav__link">Reglamento</a>
            <a href="#comunidad" className="landing-nav__link">Comunidad</a>
          </div>

          <div className="landing-nav__right">
            <div className="landing-nav__status">
              <span className="landing-nav__status-dot" />
              <span className="landing-nav__status-text">MERCADO ACTIVO</span>
            </div>

            <button onClick={onEnter} className="landing-nav__btn">
              <span>Ingresar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════ HERO SECTION WITH VIDEO BACKGROUND ═══════════ */}
      <section className="landing-hero">
        {/* Ambient Video Background */}
        <div className="landing-hero__video-wrap">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            preload="auto"
            onLoadedData={() => setVideoLoaded(true)}
            className={`landing-hero__video ${videoLoaded ? 'is-loaded' : ''}`}
          >
            <source src="/intro.mp4" type="video/mp4" />
          </video>
          <div className="landing-hero__vignette" />
        </div>

        {/* Audio Toggle Button */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className="landing-hero__audio-btn"
          aria-label={isMuted ? "Activar sonido del video" : "Silenciar video"}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-gray-300" />
              <span>Activar sonido</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-emerald-300">Sonido activo</span>
            </>
          )}
        </button>

        {/* Hero Content */}
        <div className="landing-hero__content">
          <div className="landing-hero__tagline">
            TEMPORADA OFICIAL · PES 2021 SEASON UPDATE
          </div>

          <h1 className="landing-hero__title">
            GESTIÓN TÁCTICA Y MERCADO EN TIEMPO REAL
          </h1>

          <p className="landing-hero__desc">
            Diseñá tu plantilla, dominá las finanzas sin solapamientos, configurá tu estrategia S1 y exportá directamente a PES 2021.
          </p>

          <div className="landing-hero__actions">
            <button onClick={onEnter} className="landing-hero__cta-primary">
              <span>Ingresar a la Plataforma</span>
              <ChevronRight className="w-5 h-5" />
            </button>
            <a href="#modelo-web" className="landing-hero__cta-secondary">
              Explorar el Modelo Web
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <a href="#modelo-web" className="landing-hero__scroll" aria-label="Ir al simulador de la plataforma">
          <ChevronDown className="w-5 h-5" />
        </a>
      </section>

      {/* ═══════════ INTERACTIVE WEB MODEL (SHOWCASE) ═══════════ */}
      <section id="modelo-web" className="landing-section">
        <Reveal>
          <div className="landing-section__header">
            <h2 className="landing-section__title">La Plataforma en Acción</h2>
            <p className="landing-section__desc">
              Interactuá con el modelo de las tres herramientas clave utilizadas por cada manager en la liga.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <WebAppModel />
        </Reveal>
      </section>

      {/* ═══════════ PLAYER SHOWCASE CAROUSEL ═══════════ */}
      <section className="landing-section landing-showcase">
        <Reveal>
          <div className="landing-section__header">
            <h2 className="landing-section__title">Figuras del Mercado</h2>
            <p className="landing-section__desc">
              Más de 1.000 jugadores clasificados con valoraciones y atributos extraídos del motor oficial de PES 2021.
            </p>
          </div>
        </Reveal>

        <div className="landing-carousel">
          <div className="landing-carousel__track">
            {carouselCards.map((player, i) => (
              <MiniCard key={`${player.id}-${i}`} player={player} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 3 PLATFORM PILLARS ═══════════ */}
      <section id="pilares" className="landing-section">
        <Reveal>
          <div className="landing-section__header">
            <h2 className="landing-section__title">Pilares de Competición</h2>
            <p className="landing-section__desc">
              Un entorno cerrado y sincronizado para garantizar seriedad deportiva y máxima inmersión.
            </p>
          </div>
        </Reveal>

        <div className="landing-pillars">
          {/* Pilar 1 */}
          <Reveal delay={100} className="landing-pillar">
            <div className="landing-pillar__icon-wrap">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="landing-pillar__title">Mercado y Finanzas en Vivo</h3>
            <p className="landing-pillar__desc">
              Presupuestos auditados en la nube. Al fichar un jugador, queda bloqueado inmediatamente para el resto de los rivales sin duplicaciones.
            </p>
            <ul className="landing-pillar__features">
              <li><CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /> Sincronización instantánea en Firebase</li>
              <li><CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /> Centro de traspasos e intercambios formales</li>
              <li><CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /> Ficha de Jugador Franquicia por temporada</li>
            </ul>
          </Reveal>

          {/* Pilar 2 */}
          <Reveal delay={200} className="landing-pillar">
            <div className="landing-pillar__icon-wrap">
              <Sliders className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="landing-pillar__title">Pizarra Táctica y Preset S1</h3>
            <p className="landing-pillar__desc">
              Definí tu 11 titular, convocados y estrategia completa (posesión, contraataque, líneas defensivas, presión y contención).
            </p>
            <ul className="landing-pillar__features">
              <li><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Posicionamiento táctico en campo interactivo</li>
              <li><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Asignación de lanzadores de tiros libres y penales</li>
              <li><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Criterio guiado por atributos reales de PES</li>
            </ul>
          </Reveal>

          {/* Pilar 3 */}
          <Reveal delay={300} className="landing-pillar">
            <div className="landing-pillar__icon-wrap">
              <Package className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="landing-pillar__title">Option File y Transmisión</h3>
            <p className="landing-pillar__desc">
              Exportá un archivo ZIP con CSVs listos para importar en el editor EJOGC327 y disputar los partidos en PC o consola.
            </p>
            <ul className="landing-pillar__features">
              <li><CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" /> Formation.csv, Roster.csv, Team.csv y más</li>
              <li><CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" /> Overlays limpios listos para OBS Studio</li>
              <li><CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" /> IA Scout para encontrar sustitutos y gemelos</li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ TOURNAMENT RULES ═══════════ */}
      <section id="reglamento" className="landing-section">
        <Reveal>
          <div className="landing-section__header">
            <h2 className="landing-section__title">Reglamento del Draft</h2>
            <p className="landing-section__desc">
              Pautas claras para asegurar paridad deportiva, transparencia y dinamismo económico.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="landing-rules-grid">
            {[
              {
                title: 'Presupuesto Asignado',
                desc: 'Cada manager comienza con un presupuesto oficial fijado por la administración. No se permiten balances negativos.'
              },
              {
                title: 'Bloqueo Inmediato',
                desc: 'El mercado opera en tiempo real: cuando fichás a un jugador, se bloquea al instante para los demás competidores.'
              },
              {
                title: 'Ventas al 100%',
                desc: 'Podés liberar un jugador en cualquier momento y recuperar el 100% de su valor para reinvertir en el mercado.'
              },
              {
                title: 'Centro de Traspasos',
                desc: 'Proponé intercambios formales de jugadores, acuerdos económicos o contraofertas directas con otros managers.'
              },
              {
                title: 'Jugador Franquicia',
                desc: 'Disponés de una ficha especial de jugador franquicia protegida que podés utilizar durante toda la temporada.'
              },
              {
                title: 'Alineaciones Obligatorias',
                desc: 'Todo equipo debe tener guardado su 11 titular, suplentes y estrategia S1 antes de la disputa de cada fecha.'
              }
            ].map(rule => (
              <div key={rule.title} className="landing-rule-card">
                <h3 className="landing-rule-card__title">{rule.title}</h3>
                <p className="landing-rule-card__desc">{rule.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════════ COMMUNITY CHANNELS ═══════════ */}
      <section id="comunidad" className="landing-section">
        <Reveal>
          <div className="landing-section__header">
            <h2 className="landing-section__title">Canales de Coordinación</h2>
            <p className="landing-section__desc">
              Mantenete comunicado con la organización y los otros managers para coordinar fechas y anuncios.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="landing-community-grid">
            <a
              href="https://chat.whatsapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-community-card landing-community-card--whatsapp"
            >
              <div className="landing-community-card__icon">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="landing-community-card__info">
                <h4>Grupo de WhatsApp</h4>
                <p>Anuncios oficiales, altas de mercado y coordinación de fechas.</p>
              </div>
              <ExternalLink className="landing-community-card__arrow" />
            </a>

            <a
              href="https://discord.gg"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-community-card landing-community-card--discord"
            >
              <div className="landing-community-card__icon">
                <Globe className="w-6 h-6" />
              </div>
              <div className="landing-community-card__info">
                <h4>Servidor de Discord</h4>
                <p>Salas de transmisión en vivo, soporte técnico y canales de debate.</p>
              </div>
              <ExternalLink className="landing-community-card__arrow" />
            </a>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ FINAL CALL TO ACTION ═══════════ */}
      <section className="landing-cta-banner">
        <div className="landing-cta-banner__inner">
          <img src="/logo.webp" alt="SCL" className="landing-cta-banner__logo" width="68" height="68" />
          <h2 className="landing-cta-banner__title">¿Listo para armar tu plantilla?</h2>
          <p className="landing-cta-banner__desc">
            Accedé a la plataforma, definí tu esquema táctico y competí en la Supercontinental.
          </p>
          <button onClick={onEnter} className="landing-hero__cta-primary">
            <span>Ingresar al Draft</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <img src="/logo.webp" alt="SCL" width="22" height="22" />
            <span>{APP_NAME}</span>
          </div>
          <p className="landing-footer__copy">
            © {new Date().getFullYear()} {APP_NAME}. Plataforma de gestión para PES 2021 Season Update.
          </p>
        </div>
      </footer>
    </div>
  );
}
