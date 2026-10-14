import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { X, Eye, MinusCircle, DollarSign, Sparkles, Lock, CheckCircle, ChevronRight, PieChart, Shield, Target, Zap, Activity, Trash2, AlertTriangle, Handshake, Crown } from 'lucide-react';
import { Radar, Bar, Doughnut } from 'react-chartjs-2';
import { BaseModal } from './ui/BaseModal.jsx';
import {
  getPosColorClass,
  getStatAndOvrColorClass,
  getPosColor,
  formatPriceShort,
  getFlagUrl
} from '../utils/helpers.js';
import { STATS_JUGADOR_CAMPO, STATS_PORTERO, DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, STAT_NAMES_MAP, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from '../utils/constants.js';
import { TransferProposalModal } from './TransferProposalModal.jsx';

const POSITIONS_LAYOUT = [
  { pos: 'DC',  col: 2, row: 1 },
  { pos: 'EI',  col: 1, row: 2 },
  { pos: 'SD',  col: 2, row: 2 },
  { pos: 'ED',  col: 3, row: 2 },
  { pos: 'MO',  col: 2, row: 3 },
  { pos: 'MI',  col: 1, row: 4 },
  { pos: 'MC',  col: 2, row: 4 },
  { pos: 'MD',  col: 3, row: 4 },
  { pos: 'MCD', col: 2, row: 5 },
  { pos: 'LI',  col: 1, row: 6 },
  { pos: 'DFC', col: 2, row: 6 },
  { pos: 'LD',  col: 3, row: 6 },
  { pos: 'PT',  col: 2, row: 7 },
];

const PosicionHeatmap = memo(function PosicionHeatmap({ player }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-ink-2">Mapa de posiciones</h3>
        <span className="text-xs text-ink-3 font-medium">Aptitud en campo</span>
      </div>
      <div className="flex-grow bg-canvas rounded-xl p-3 flex items-center justify-center min-h-[220px] border border-line/15">
        {/* 3-column × 7-row soccer-pitch grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: '5px',
            padding: '8px',
            width: '100%',
            maxWidth: '160px',
          }}
        >
          {POSITIONS_LAYOUT.map(({ pos, col, row }) => {
            const aptPropertyName = `Aptitude${pos}`;
            const aptValue = Number(player[aptPropertyName] || 0);
            const { bgColor, textColor } = getPosColor(aptValue);

            return (
              <div
                key={pos}
                style={{
                  gridColumn: col,
                  gridRow: row,
                  backgroundColor: bgColor,
                  color: textColor,
                }}
                className="w-8 h-8 flex items-center justify-center rounded text-xs font-bold shadow-xs mx-auto"
                title={`Aptitud ${pos}: ${aptValue || 'N/A'}`}
              >
                {pos}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const RadarChart = memo(function RadarChart({ player, isGK }) {

  const { data, options } = useMemo(() => {
    const rawLabels = isGK
      ? ['SHO', 'PAS', 'STR', 'GK', 'SPD', 'DRI']
      : ['SHO', 'PAS', 'STR', 'DEF', 'SPD', 'DRI'];

    const dataValues = isGK
      ? [
          player.STAT_SHO,
          player.STAT_PAS,
          player.STAT_STR,
          player.STAT_GK,
          player.STAT_SPD,
          player.STAT_DRI,
        ]
      : [
          player.STAT_SHO,
          player.STAT_PAS,
          player.STAT_STR,
          player.STAT_DEF,
          player.STAT_SPD,
          player.STAT_DRI,
        ];

    const labels = rawLabels.map((l, i) => `${l} ${dataValues[i] ?? 0}`);

    const data = {
      labels: labels,
      datasets: [
        {
          label: 'Habilidad',
          data: dataValues,
          fill: true,
          backgroundColor: 'rgba(58, 102, 196, 0.22)',
          borderColor: '#3a66c4',
          pointBackgroundColor: '#3a66c4',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#3a66c4',
          borderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 5,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 35,
          max: 100,
          ticks: {
            display: false,
          },
          pointLabels: {
            font: { size: 10, weight: '600' },
            color: "rgba(226, 232, 240, 0.85)",
            backdropColor: 'transparent',
          },
          grid: { color: "rgba(255, 255, 255, 0.08)", lineWidth: 1 },
          angleLines: { color: "rgba(255, 255, 255, 0.08)", lineWidth: 1 }
        }
      },
      plugins: { legend: { display: false } }
    };

    return { data, options };
  }, [player, isGK]);

  return (
    <div className="flex flex-col items-center justify-center w-full pt-1 pb-1">
      <div className="w-full flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-ink-2">Perfil de atributos</h3>
        <span className="text-xs text-ink-3 font-medium">Hexágono</span>
      </div>
      <div
        className="relative w-full h-[245px] flex items-center justify-center"
        role="img"
        aria-label={`Gráfico de radar de atributos para ${player?.Name || 'jugador'}`}
      >
        <Radar data={data} options={options} />
        <span className="sr-only">
          Atributos principales: Disparo {player.STAT_SHO ?? 0}, Pase {player.STAT_PAS ?? 0}, Físico {player.STAT_STR ?? 0}, {isGK ? `Portero ${player.STAT_GK ?? 0}` : `Defensa ${player.STAT_DEF ?? 0}`}, Velocidad {player.STAT_SPD ?? 0}, Regate {player.STAT_DRI ?? 0}.
        </span>
      </div>
    </div>
  );
});

export const getSimilarPlayers = (targetPlayer, allPlayers, limit = 4) => {
  if (!targetPlayer || !allPlayers) return [];

  // 1. Definir qué stats definen el "vector" SEGÚN LA POSICIÓN
  let statVectorKeys = [];
  const pos = targetPlayer.POS_NOMBRE;

  // Detectar si es portero o defensor para usar las stats correctas
  if (pos === 'PT') {
    // ARQUEROS: Solo stats de portero + físico relevante
    statVectorKeys = [
      'GKAwareness', 'GKCatching', 'GKClearing', 'GKReflexes', 'GKReach',
      'Jump', 'PhysicalContact'
    ];
  }
  else if (['DFC', 'LI', 'LD'].includes(pos)) {
    // DEFENSORES: Defensa, físico y velocidad. Quitamos tiro y regate.
    statVectorKeys = [
      'DefensiveAwareness', 'BallWinning', 'Aggression', 'PhysicalContact',
      'Heading', 'Jump', 'Speed', 'Acceleration', 'Stamina', 'LowPass'
    ];
  }
  else if (['MCD', 'MC'].includes(pos)) {
    // MEDIOCAMPISTAS PUROS: Balance entre defensa y pase
    statVectorKeys = [
      'LowPass', 'LoftedPass', 'BallControl', 'TightPossession',
      'DefensiveAwareness', 'BallWinning', 'Stamina', 'Balance', 'PhysicalContact'
    ];
  }
  else {
    // DELANTEROS Y OFENSIVOS (MO, EXT, DC): Ataque, técnica y velocidad
    statVectorKeys = [
      'OffensiveAwareness', 'BallControl', 'Dribbling', 'TightPossession',
      'Finishing', 'LowPass', 'Speed', 'Acceleration', 'Balance', 'KickingPower', 'Stamina'
    ];
  }

  const numKeys = statVectorKeys.length;
  const targetVec = new Float32Array(numKeys);
  let targetMagSq = 0;
  for (let k = 0; k < numKeys; k++) {
    const val = Number(targetPlayer[statVectorKeys[k]] || 0);
    targetVec[k] = val;
    targetMagSq += val * val;
  }
  const targetMag = Math.sqrt(targetMagSq);
  if (!targetMag) return [];

  const targetOvr = Number(targetPlayer.OVR_CALCULADO) || 0;
  const targetPrice = Number(targetPlayer.Precio) || 0;
  const maxPriceDiff = targetPrice * 0.6 + 15;
  const targetPos = targetPlayer.POS_NOMBRE;
  const targetId = targetPlayer.Id;
  const candidates = [];

  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i];
    if (p.Id === targetId || p.POS_NOMBRE !== targetPos) continue;
    const pOvr = Number(p.OVR_CALCULADO) || 0;
    if (Math.abs(pOvr - targetOvr) > 6) continue;
    const pPrice = Number(p.Precio) || 0;
    if (Math.abs(pPrice - targetPrice) >= maxPriceDiff) continue;

    let dotProduct = 0;
    let magBSq = 0;
    for (let k = 0; k < numKeys; k++) {
      const valB = Number(p[statVectorKeys[k]] || 0);
      dotProduct += targetVec[k] * valB;
      magBSq += valB * valB;
    }
    const magB = Math.sqrt(magBSq);
    const similarity = (magB > 0) ? (dotProduct / (targetMag * magB)) : 0;
    candidates.push({ ...p, similarityScore: similarity * 100 });
  }

  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  return candidates.slice(0, limit);
};

const CelebrationPopup = memo(function CelebrationPopup({ player, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const posColorClass = getPosColorClass(player.POS_NOMBRE);
  const ovrColorClass = getStatAndOvrColorClass(player.OVR_CALCULADO);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-300" onClick={onDismiss}>
      <button onClick={onDismiss} className="absolute top-6 right-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-ink transition"><X size={24} /></button>
      <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-500" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
          <img src={`/fotos_jugadores/${player.Id}.webp`} alt={player.Name}
            className="w-36 h-36 rounded-full object-cover border-4 border-green-500 shadow-2xl relative z-10"
            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/144x144/111/555?text=${player.Name.substring(0,1)}`; }} />
          <div className={`absolute -bottom-2 -right-2 w-14 h-14 flex items-center justify-center rounded-full font-bold text-2xl shadow-lg border-2 border-slate-900 z-20 !text-black ${ovrColorClass}`}>
            {player.OVR_CALCULADO}
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-6xl font-bold text-success-soft tracking-tight mb-2">¡Fichado!</div>
          <div className="text-3xl font-bold text-ink uppercase tracking-wider">{player.Name}</div>
          <span className={`inline-block mt-3 px-4 py-1 rounded-full text-sm font-bold !text-black ${posColorClass}`}>{player.POS_NOMBRE}</span>
        </div>
        {/* Confetti particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({length: 30}).map((_, i) => (
            <div key={i} className="absolute rounded-full" style={{
              width: `${4 + Math.random() * 8}px`, height: `${4 + Math.random() * 8}px`,
              background: ['#4ade80','#facc15','#60a5fa','#f472b6','#a78bfa','#fb923c'][i % 6],
              left: `${Math.random() * 100}%`, top: `-5%`,
              animation: `confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 0.5}s ease-in forwards`,
            }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(\${360 + Math.random()*360}deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

const StatSection = memo(function StatSection({ title, statKeys, player }) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-raised border border-line/[0.12]">
      <h4 className="text-sm font-bold text-ink tracking-wide uppercase mb-3 pb-2 border-b border-line/[0.12]">
        {title}
      </h4>
      <div className="space-y-1">
        {statKeys.map(key => {
          const value = player[key] || 0;
          let colorClass = '';

          if (key === 'WeakFootAcc' || key === 'WeakFootUsage') {
            const valNum = parseInt(value, 10);
            if (valNum === 4) colorClass = 'stat-c-90';
            else if (valNum === 3) colorClass = 'stat-c-80';
            else if (valNum === 2) colorClass = 'stat-c-60';
            else colorClass = 'stat-c-50';
          } else {
            colorClass = getStatAndOvrColorClass(value);
          }

          return (
            <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
              <span className="text-sm text-ink-2 truncate flex-1">
                {STAT_NAMES_MAP[key] || key}
              </span>
              <span className={`stat-value ${colorClass} px-2.5 py-0.5 rounded-md font-mono font-bold text-sm min-w-[2.5rem] text-center tabular-nums inline-flex items-center justify-center`}>
                {value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SkillsSection = memo(function SkillsSection({ player }) {
  const skills = Object.entries(PLAYER_SKILLS_MAP)
    .filter(([colName]) => player[colName])
    .map(([, displayName]) => displayName);

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-raised border border-line/20 shadow-sm">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-line/20">
        <h4 className="text-xs sm:text-sm font-semibold text-ink">
          Habilidades del jugador
        </h4>
        <span className="text-xs text-ink-3 font-medium bg-raised px-2.5 py-0.5 rounded">
          {skills.length} activas
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.length > 0 ? (
          skills.map(skill => (
            <span key={skill} className="text-xs font-medium px-3 py-1 rounded-md bg-raised/80 border border-line/15 text-ink-2">
              {skill}
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-3 italic py-1">Sin habilidades especiales registradas.</span>
        )}
      </div>
    </div>
  );
});

export const PlayerModal = memo(function PlayerModal({
  player,
  countryMap,
  onClose,
  onAddToCart,
  cartStatus,
  lockedTeamName,
  targetTeamId,
  userId,
  userProfile,
  remainingBudget,
  isInMyCart,
  onRemoveFromCart,
  allPlayers,
  onPlayerSwitch,
  onSearchSimilar,
  isVisitor,
  marketStatus,
  isFranchisePlayer
}) {
  const [isSigning, setIsSigning] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  // Reset states when player changes
  useEffect(() => {
    setIsSigning(false);
    setShowCelebration(false);
    setShowReleaseConfirm(false);
    setIsReleasing(false);
    setShowProposalModal(false);
  }, [player?.Id]);

  const meetsFranchiseCriteria = player && player.Age >= FRANCHISE_MIN_AGE && player.OVR_CALCULADO >= FRANCHISE_MIN_OVR && player.OVR_CALCULADO <= FRANCHISE_MAX_OVR;
  const isEligibleForFranchise = meetsFranchiseCriteria && !userProfile?.franchisePlayerUsed;

  const [similarPlayers, setSimilarPlayers] = useState([]);

  useEffect(() => {
    if (!player || !allPlayers?.length) {
      setSimilarPlayers([]);
      return;
    }
    const timer = setTimeout(() => {
      setSimilarPlayers(getSimilarPlayers(player, allPlayers));
    }, 16);
    return () => clearTimeout(timer);
  }, [player?.Id, allPlayers]);

  const handleDismissCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  if (!player) return null;

  const isGK = player.Grupo === 'Arqueros';
  const posColorClass = getPosColorClass(player.POS_NOMBRE);

  const country1FlagUrl = getFlagUrl(player.Country1);
  const country1Name = countryMap[player.Country1] || 'Desconocido';

  const c2 = player.Country2;
  const hasCountry2 = Boolean(c2 && c2 !== 0 && String(c2) !== "0" && String(c2) !== String(player.Country1));
  const country2FlagUrl = hasCountry2 ? getFlagUrl(c2) : null;
  const country2Name = hasCountry2 ? (countryMap[c2] || '') : '';

  const handleSign = async (isFranchise = false) => {
    setIsSigning(true);
    const success = await onAddToCart(player, isFranchise);
    if (success) {
      setShowCelebration(true);
    }
    setIsSigning(false);
  };

  const handleRelease = async () => {
    setIsReleasing(true);
    try {
      await onRemoveFromCart(player);
    } catch (e) { console.error(e); }
    setIsReleasing(false);
    setShowReleaseConfirm(false);
  };

  const renderActionButton = () => {
    if (isVisitor) {
      return (
        <div className="flex items-center justify-center px-6 py-3 font-bold rounded-xl bg-raised text-ink-3 border border-line/20 w-full sm:w-auto cursor-not-allowed opacity-70" aria-disabled="true" title="Modo Visitante (Solo Lectura)">
          <Eye className="w-5 h-5 mr-2" /> Modo Visitante (Solo Lectura)
        </div>
      );
    }

    const commonClasses = "flex items-center justify-center px-5 py-2.5 font-semibold rounded-lg transition-colors w-full sm:w-auto text-sm cursor-pointer";

    // Signed by current user -> show release button
    // In my cart
    if (cartStatus === 'IN_MY_CART') {
      if (isFranchisePlayer) {
        return (
          <div className="flex flex-col items-center justify-center px-4 py-2 font-semibold rounded-lg bg-accent/[0.08] text-accent-soft border border-accent/30 w-full sm:w-auto">
            <div className="flex items-center text-xs text-accent-soft mb-0.5 font-medium">
              <Crown className="w-3.5 h-3.5 mr-1" />
              <span>Jugador Franquicia</span>
            </div>
            <span className="text-ink text-sm font-semibold">Intransferible</span>
          </div>
        );
      }
      return (
        <button
          onClick={() => setShowReleaseConfirm(true)}
          className={`${commonClasses} bg-rose-600 hover:bg-rose-500 text-ink`}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Eliminar Fichaje
        </button>
      );
    }

    // Locked by another team
    if (cartStatus === 'LOCKED_BY_OTHER') {
      if (isFranchisePlayer) {
        return (
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-raised text-ink-3 border border-line/[0.12] cursor-not-allowed w-full sm:w-auto" aria-disabled="true" title="Este jugador ya fue fichado por otro manager">
              <div className="flex items-center text-[10px] text-danger-soft uppercase tracking-wider mb-0.5 font-semibold">
                <Lock className="w-3 h-3 mr-1" />
                <span>Fichado por</span>
              </div>
              <span className="text-ink text-sm font-bold">{lockedTeamName || 'Otro equipo'}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-accent/[0.08] text-accent-soft border border-accent/30 w-full sm:w-auto cursor-not-allowed" aria-disabled="true" title="Jugador Franquicia">
              <div className="flex items-center text-[10px] text-accent-soft uppercase tracking-wider mb-0.5 font-semibold">
                <Crown className="w-3 h-3 mr-1" />
                <span>Jugador Franquicia</span>
              </div>
              <span className="text-ink text-sm font-bold">Intransferible</span>
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-raised text-ink-3 border border-line/[0.12] cursor-not-allowed w-full sm:w-auto" aria-disabled="true" title="Este jugador ya fue fichado por otro manager">
            <div className="flex items-center text-[10px] text-danger-soft uppercase tracking-wider mb-0.5 font-semibold">
              <Lock className="w-3 h-3 mr-1" />
              <span>Fichado por</span>
            </div>
            <span className="text-ink text-sm font-bold">{lockedTeamName || 'Otro equipo'}</span>
          </div>
          <button 
            onClick={() => setShowProposalModal(true)}
            className={`${commonClasses} bg-blue-600 hover:bg-blue-500 text-ink w-full sm:w-auto`}
          >
            <Handshake className="w-4 h-4 mr-2" /> Traspaso
          </button>
        </div>
      );
    }

    // Available
    const priceMillions = player.Precio;
    const priceFull = priceMillions * 1000000;
    const canAfford = remainingBudget >= priceFull;
    const budgetAfter = remainingBudget - priceFull;
    const budgetAfterM = (budgetAfter / 1000000).toFixed(1);
    const currentBudgetM = (remainingBudget / 1000000).toFixed(1);
    const missingM = ((priceFull - remainingBudget) / 1000000).toFixed(1);
    const initialBudget = userProfile?.budget || remainingBudget;
    const budgetAfterPercent = canAfford ? Math.min(100, Math.max(0, (budgetAfter / initialBudget) * 100)) : 0;
    const afterColor = budgetAfterPercent <= 20 ? 'text-danger-soft' : budgetAfterPercent <= 50 ? 'text-warning-soft' : 'text-success-soft';
    const barColor = budgetAfterPercent > 50 ? '#10b981' : budgetAfterPercent > 20 ? '#eab308' : '#f43f5e';

    const isFranchiseMarket = marketStatus?.status === 'FranchiseMarket';

    if (isFranchiseMarket) {
      if (isEligibleForFranchise) {
        return (
          <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleSign(true)}
              disabled={isSigning}
              className={`${commonClasses} ${isSigning ? 'bg-overlay text-ink-2 cursor-wait' : 'bg-amber-600 hover:bg-amber-500 text-ink'}`}
              title={isSigning ? 'Hay una operación en curso' : "Fichar gratis como jugador franquicia"}
            >
              {isSigning ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : (
                <Sparkles className="w-4 h-4 mr-1.5" />
              )}
              <span>{isSigning ? 'Procesando...' : 'Jugador Franquicia ($0)'}</span>
            </button>
          </div>
        );
      } else if (meetsFranchiseCriteria && userProfile?.franchisePlayerUsed) {
        return (
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <button disabled title="Ya has fichado a tu Jugador Franquicia esta temporada" className={`${commonClasses} bg-raised/80 text-ink-3 cursor-not-allowed border border-line/20`}>
              <Lock className="w-4 h-4 mr-2 text-ink-3" />
              Cupo Utilizado
            </button>
            <span className="text-xs text-ink-3 text-center max-w-[200px]">
              Ya has fichado a tu Jugador Franquicia esta temporada
            </span>
          </div>
        );
      } else {
        return (
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <button disabled title="El jugador no cumple los requisitos de franquicia" className={`${commonClasses} bg-raised/80 text-ink-3 cursor-not-allowed border border-line/20`}>
              <DollarSign className="w-4 h-4 mr-2 text-ink-3" />
              Mercado Restringido
            </button>
            <span className="text-xs text-ink-3 text-center max-w-[200px]">
              El jugador no cumple los requisitos (Edad ≥ {FRANCHISE_MIN_AGE} y OVR {FRANCHISE_MIN_OVR}-{FRANCHISE_MAX_OVR})
            </span>
          </div>
        );
      }
    }

    // ─── Budget Impact Section ───
    const BudgetImpact = () => (
      <div className="w-full rounded-xl p-3 mb-2.5 bg-raised border border-line/20 shadow-sm">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-line/15">
          <span className="text-xs font-semibold text-ink-2">Impacto presupuestario</span>
          <span className="text-xs font-semibold text-ink-3 tabular-nums">${currentBudgetM}M disp.</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center text-ink-3">
            <span>Costo de fichaje:</span>
            <span className="font-semibold text-danger-soft tabular-nums">- {formatPriceShort(priceMillions)}</span>
          </div>
          {canAfford ? (
            <div className="flex justify-between items-center pt-1.5 border-t border-line/15">
              <span className="text-ink-3">Restante estimado:</span>
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold tabular-nums ${afterColor}`}>${budgetAfterM}M</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  budgetAfterPercent > 50 ? 'bg-success/15 text-success-soft' :
                  budgetAfterPercent > 20 ? 'bg-warning/15 text-warning-soft' :
                  'bg-danger/15 text-danger-soft'
                }`}>
                  {budgetAfterPercent.toFixed(0)}%
                </span>
                {budgetAfterPercent <= 20 && <AlertTriangle className="w-3 h-3 text-danger-soft" />}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-danger-soft pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-semibold">
                Faltan ${missingM}M para completar
              </span>
            </div>
          )}
        </div>
        {canAfford && (
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${budgetAfterPercent}%`, background: barColor }}
            />
          </div>
        )}
      </div>
    );

    if (!canAfford) {
      return (
        <div className="flex flex-col items-center gap-0 w-full sm:w-auto">
          <BudgetImpact />
          <button disabled title="No tienes presupuesto suficiente para esta acción" className={`${commonClasses} bg-raised/80 text-ink-3 cursor-not-allowed border border-line/20`}>
            <DollarSign className="w-4 h-4 mr-1.5 text-ink-3" />
            Presupuesto Insuficiente
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-0 w-full sm:w-auto">
        <BudgetImpact />
        <button
          onClick={() => handleSign(false)}
          disabled={isSigning}
          className={`${commonClasses} ${isSigning ? 'bg-overlay text-ink-2 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 text-ink'}`}
          title={isSigning ? 'Hay una operación en curso' : `FICHAR por ${formatPriceShort(priceMillions)}`}
        >
          {isSigning ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
          ) : (
            <DollarSign className="w-4 h-4 mr-1" />
          )}
          <span>{isSigning ? 'Procesando...' : <>FICHAR <span className="ml-1 font-semibold opacity-90 tabular-nums">{formatPriceShort(priceMillions)}</span></>}</span>
        </button>
      </div>
    );
  };

  return (
    <>
    {/* Celebration Popup */}
    {showCelebration && <CelebrationPopup player={player} onDismiss={handleDismissCelebration} />}
    {/* Release Confirmation */}
    {showReleaseConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowReleaseConfirm(false)}>
        <div className="bg-raised border border-white/[0.1] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-danger/15 flex items-center justify-center border border-danger/20"><AlertTriangle className="w-5 h-5 text-danger-soft" /></div>
            <h3 className="text-base font-bold text-ink">Confirmar liberación</h3>
          </div>
          <p className="text-sm text-ink-2 mb-5">¿Seguro que querés liberar a <span className="font-bold text-ink">{player.Name}</span>?</p>
          <div className="flex gap-2.5">
            <button onClick={() => setShowReleaseConfirm(false)} className="flex-1 py-2 rounded-xl text-xs font-bold text-ink-2 bg-white/[0.06] hover:bg-white/[0.1] border border-line/[0.12] transition">Cancelar</button>
            <button onClick={handleRelease} disabled={isReleasing} title={isReleasing ? 'Hay una operación en curso' : undefined} className="flex-1 py-2 rounded-xl text-xs font-bold text-ink bg-red-600 hover:bg-red-500 border border-red-400/30 transition disabled:opacity-50">
              {isReleasing ? 'Liberando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}

    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="2xl"
      showClose={false}
      className="!p-0 !bg-surface !max-w-6xl"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      <div className="flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] relative">
        {/* Botón Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 p-2 rounded-lg bg-raised/80 hover:bg-overlay text-ink-3 hover:text-ink border border-line/20 transition-colors"
          aria-label="Cerrar modal"
        >
          <X size={20} />
        </button>

        {/* Contenido Scrollable */}
        <div className="flex-grow min-h-0 overflow-y-auto p-4 sm:p-7 custom-scrollbar relative z-10 pb-20 sm:pb-6">

          {/* 1. CABECERA DEL JUGADOR - SCOUTING BROADCAST */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-7 border-b border-line/20 pb-6 pt-2 sm:pt-0">
            <div className="flex items-center gap-5 sm:gap-6 w-full lg:w-auto">
              {/* FOTO y OVR */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-line/20 bg-raised shadow-md relative z-10">
                  <img
                    src={`/fotos_jugadores/${player.Id}.webp`}
                    alt={player.Name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/128x128/111/555?text=${player.Name.substring(0, 1)}`; }}
                  />
                </div>
                <div className={`absolute -bottom-2 -right-2 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-lg font-bold text-lg sm:text-xl border-2 border-slate-900 shadow-md z-20 tabular-nums !text-black ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>
                  {player.OVR_CALCULADO}
                </div>
              </div>

              {/* DATOS DE IDENTIDAD */}
              <div className="flex flex-col justify-center min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-medium text-ink-3">{player.Grupo}</span>
                  {player.PlayingStyle && (
                    <>
                      <span className="text-ink-3 text-xs">•</span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 bg-raised px-2.5 py-0.5 rounded-md border border-line/20">
                        <Target className="w-3 h-3 text-ink-3" />
                        {player.PlayingStyle}
                      </span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight leading-tight mb-2 truncate">
                  {player.Name}
                </h1>

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold !text-black ${posColorClass}`}>
                    {player.POS_NOMBRE}
                  </span>

                  <div className="flex items-center space-x-1.5 bg-raised border border-line/20 px-2.5 py-1 rounded-md">
                    <img src={country1FlagUrl} alt={country1Name} title={country1Name} className="h-4 w-5 object-cover rounded-sm" onError={(e) => e.target.style.display = 'none'} />
                    {hasCountry2 && (
                      <img src={country2FlagUrl} alt={country2Name} title={country2Name} className="h-4 w-5 object-cover rounded-sm opacity-80" onError={(e) => e.target.style.display = 'none'} />
                    )}
                    <span className="text-xs text-ink-2 font-medium ml-1">{country1Name}</span>
                  </div>

                  <span className="text-ink-2 text-xs font-medium flex items-center bg-raised px-3 py-1 rounded-md border border-line/20 tabular-nums">
                    {player.Age} años <span className="mx-2 text-ink-3">·</span> {player.Height} cm <span className="mx-2 text-ink-3">·</span> {player.Foot} <span className="mx-2 text-ink-3">·</span> {player.Weight} kg
                  </span>
                </div>
              </div>
            </div>

            {/* ACCIONES Y PRESUPUESTO */}
            <div className="flex flex-col items-stretch lg:items-end gap-2 w-full lg:w-auto shrink-0 mt-3 lg:mt-0">
              {renderActionButton()}
            </div>
          </div>

          {/* 2. INFO DETALLADA Y GRÁFICOS */}
          <div className="flex flex-col lg:flex-row gap-6 mb-8">

            {/* LADO IZQUIERDO: RADAR Y HEATMAP */}
            <div className="w-full lg:w-[280px] shrink-0 space-y-4 flex flex-col">
              <div className="bg-raised rounded-xl p-4 border border-line/[0.12] shadow-sm flex items-center justify-center">
                <RadarChart player={player} isGK={isGK} />
              </div>

              {!isGK && (
                <div className="bg-raised rounded-xl p-4 border border-line/[0.12] shadow-sm">
                  <PosicionHeatmap player={player} />
                </div>
              )}
            </div>

            {/* LADO DERECHO: STATS EN GRILLA */}
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(isGK ? Object.entries(STATS_PORTERO) : Object.entries(STATS_JUGADOR_CAMPO))
                  .filter(([, statKeys]) => statKeys.length > 0)
                  .map(([title, statKeys]) => (
                    <StatSection key={title} title={title} statKeys={statKeys} player={player} />
                  ))}
              </div>
              <SkillsSection player={player} />
            </div>
          </div>

          {/* 3. PERFILES SIMILARES */}
          <div className="pt-5 border-t border-line/20">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-ink">
                Jugadores de perfil similar
              </h3>
              <span className="text-xs text-ink-3 font-medium">
                Misma posición y valoración cercana
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {similarPlayers.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-raised rounded-xl p-3 border border-line/15 animate-pulse h-[106px] flex flex-col justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-raised" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-20 rounded bg-raised" />
                        <div className="h-2.5 w-12 rounded bg-raised" />
                      </div>
                    </div>
                    <div className="h-3 w-16 rounded bg-raised" />
                  </div>
                ))
              ) : (
                similarPlayers.map(simPlayer => {
                  const ovrDiff = (simPlayer.OVR_CALCULADO || 0) - (player.OVR_CALCULADO || 0);

                  return (
                    <div
                      key={simPlayer.Id}
                      onClick={() => { onClose(); onPlayerSwitch(simPlayer); }}
                      className="group bg-raised hover:bg-[#151d2c] rounded-xl p-3 border border-line/20 hover:border-line/20 transition-colors cursor-pointer shadow-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="relative shrink-0">
                          <img
                            src={`/fotos_jugadores/${simPlayer.Id}.webp`}
                            alt={simPlayer.Name}
                            className="w-10 h-10 rounded-lg object-cover bg-canvas border border-line/20 transition-colors"
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/48x48/111/555?text=${simPlayer.Name.substring(0, 1)}`; }}
                          />
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold tabular-nums !text-black ${getStatAndOvrColorClass(simPlayer.OVR_CALCULADO)}`}>
                            {simPlayer.OVR_CALCULADO}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-ink-2 truncate group-hover:text-ink transition-colors">
                            {simPlayer.Name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold !text-black ${getPosColorClass(simPlayer.POS_NOMBRE)}`}>
                              {simPlayer.POS_NOMBRE}
                            </span>
                            <span className="text-xs text-ink-3">
                              {simPlayer.Age} años
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-line/15 flex items-center justify-between text-xs">
                        <div className="text-success-soft font-semibold tabular-nums">
                          {formatPriceShort(simPlayer.Precio)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-medium px-1 rounded ${ovrDiff > 0 ? 'text-success-soft bg-success/10' : ovrDiff < 0 ? 'text-ink-3 bg-white/[0.04]' : 'text-ink-3'}`}>
                            {ovrDiff > 0 ? `+${ovrDiff}` : ovrDiff === 0 ? '=' : ovrDiff} OVR
                          </span>
                          <span className="text-xs text-ink-3 font-medium tabular-nums">
                            {Math.round(simPlayer.similarityScore)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
      {showProposalModal && (
        <TransferProposalModal
          isVisible={showProposalModal}
          onClose={() => setShowProposalModal(false)}
          player={player}
          targetTeamName={lockedTeamName}
          targetTeamId={targetTeamId}
          senderId={userId}
          senderTeamName={userProfile?.teamName}
          senderTeamLogo={userProfile?.logoUrl}
          remainingBudget={remainingBudget}
        />
      )}
    </>
  );
});

