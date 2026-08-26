import React, { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { X, Eye, MinusCircle, DollarSign, Sparkles, Lock, CheckCircle, ChevronRight, PieChart, Shield, Target, Zap, Activity, Trash2, AlertTriangle, Handshake, Crown } from 'lucide-react';
import { Radar, Bar, Doughnut } from 'react-chartjs-2';
import {
  getPosColorClass,
  getStatAndOvrColorClass,
  getPosColor,
  formatPriceShort,
  getFlagUrl
} from '../utils/helpers.js';
import { STATS_JUGADOR_CAMPO, STATS_PORTERO, DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, STAT_NAMES_MAP } from '../utils/constants.js';
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
      <h3 className="text-sm font-black text-gray-400 tracking-widest uppercase mb-4">Posiciones</h3>
      <div className="flex-grow bg-[#0a0a0a]/50 rounded-lg p-3 flex items-center justify-center min-h-[220px] shadow-inner">
        {/* 3-column × 7-row soccer-pitch grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(7, 1fr)',
            gap: '4px',
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
                className="w-8 h-8 flex items-center justify-center rounded text-[10px] font-bold shadow-sm transition-transform hover:scale-110 cursor-default mx-auto"
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
    let labels, dataValues;

    if (isGK) {
      // Arqueros: mismo hexágono que jugadores de campo, pero GK reemplaza a DEF
      labels = ['SHO', 'PAS', 'STR', 'GK', 'SPD', 'DRI'];
      dataValues = [
        player.STAT_SHO,
        player.STAT_PAS,
        player.STAT_STR,
        player.STAT_GK,
        player.STAT_SPD,
        player.STAT_DRI,
      ];
    } else {
      // Campo: SHO, PAS, STR, DEF, SPD, DRI (orden horario del hexágono PES)
      labels = ['SHO', 'PAS', 'STR', 'DEF', 'SPD', 'DRI'];
      dataValues = [
        player.STAT_SHO,
        player.STAT_PAS,
        player.STAT_STR,
        player.STAT_DEF,
        player.STAT_SPD,
        player.STAT_DRI,
      ];
    }

    const data = {
      labels: labels,
      datasets: [
        {
          label: 'Habilidad',
          data: dataValues,
          fill: true,
          backgroundColor: 'rgba(0, 200, 255, 0.15)',
          borderColor: 'rgba(0, 200, 255, 0.8)',
          pointBackgroundColor: 'rgba(0, 200, 255, 0.8)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(0, 200, 255, 0.8)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    };

    const options = {
      responsive: false,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          pointLabels: {
            font: { size: 12 },
            color: "rgba(255,255,255,0.85)",
            backdropColor: 'transparent',
          },
          grid: { color: "rgba(255,255,255,0.1)", lineWidth: 1 },
          angleLines: { color: "rgba(255,255,255,0.1)", lineWidth: 1 }
        }
      },
      plugins: { legend: { display: false } }
    };

    return { data, options };
  }, [player, isGK]);

  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-4">
      <h3 className="text-[10px] font-bold text-gray-400 text-center mb-2 uppercase tracking-widest">Stats</h3>
      <Radar data={data} options={options} width={260} height={260} />
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

  // Helper para crear el vector numérico
  const getVector = (p) => statVectorKeys.map(k => Number(p[k] || 0));

  // Helper matemático: Similitud Coseno
  const cosineSim = (vecA, vecB) => {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    return (magA && magB) ? (dotProduct / (magA * magB)) : 0;
  };

  const targetOvr = Number(targetPlayer.OVR_CALCULADO) || 0;
  const targetPrice = Number(targetPlayer.Precio) || 0;
  const maxPriceDiff = targetPrice * 0.6 + 15;
  const targetPos = targetPlayer.POS_NOMBRE;
  const targetId = targetPlayer.Id;
  const targetVec = getVector(targetPlayer);
  const candidates = [];

  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i];
    if (p.Id === targetId || p.POS_NOMBRE !== targetPos) continue;
    if (Math.abs((Number(p.OVR_CALCULADO) || 0) - targetOvr) > 6) continue;
    if (Math.abs((Number(p.Precio) || 0) - targetPrice) >= maxPriceDiff) continue;
    const similarity = cosineSim(targetVec, getVector(p));
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
      <button onClick={onDismiss} className="absolute top-6 right-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"><X size={24} /></button>
      <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-500" onClick={e => e.stopPropagation()}>
        <div className="relative">
          <div className="absolute inset-0 bg-green-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
          <img src={`/fotos_jugadores/${player.Id}.webp`} alt={player.Name}
            className="w-36 h-36 rounded-full object-cover border-4 border-green-500 shadow-2xl relative z-10"
            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/144x144/111/555?text=${player.Name.substring(0,1)}`; }} />
          <div className={`absolute -bottom-2 -right-2 w-14 h-14 flex items-center justify-center rounded-full font-black text-2xl shadow-lg border-2 border-gray-900 z-20 !text-black ${ovrColorClass}`}>
            {player.OVR_CALCULADO}
          </div>
        </div>
        <div className="text-center">
          <div className="text-6xl font-black text-green-400 tracking-tight drop-shadow-[0_0_30px_rgba(74,222,128,0.6)] mb-2">¡FICHADO!</div>
          <div className="text-3xl font-black text-white uppercase tracking-wider">{player.Name}</div>
          <span className={`inline-block mt-3 px-4 py-1 rounded-full text-sm font-black !text-black ${posColorClass}`}>{player.POS_NOMBRE}</span>
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
    <div className="stat-section p-5 rounded-2xl bg-[#16161a] border border-gray-800 shadow-xl transition-all duration-300 hover:border-gray-600">
      <h4 className="text-xs font-black text-gray-400 tracking-wider uppercase mb-4 pb-3 border-b border-gray-800">
        {title}
      </h4>
      <div className="space-y-2">
        {statKeys.map(key => {
          const value = player[key] || 0;
          let colorClass = '';

          // --- LÓGICA ESPECIAL PARA PIE DÉBIL (Escala 1-4) ---
          if (key === 'WeakFootAcc' || key === 'WeakFootUsage') {
            const valNum = parseInt(value, 10);
            if (valNum === 4) colorClass = 'stat-c-90';       // 4 = Excelente (Verde)
            else if (valNum === 3) colorClass = 'stat-c-80';  // 3 = Bueno (Lima)
            else if (valNum === 2) colorClass = 'stat-c-60';  // 2 = Regular (Naranja/Amarillo)
            else colorClass = 'stat-c-50';                    // 1 (o 0) = Malo (Rojo)
          }
          // --- LÓGICA ESTÁNDAR (Escala 0-100) ---
          else {
            colorClass = getStatAndOvrColorClass(value);
          }

          return (
            <div key={key} className="flex justify-between items-center text-base">
              <span className="text-gray-300">{STAT_NAMES_MAP[key] || key}</span>
              <span className={`stat-value ${colorClass} px-2 py-0.5 rounded font-bold text-lg min-w-[2.5rem] text-center`}>
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
    <div className="stat-section p-5 rounded-2xl bg-[#16161a] border border-gray-800 shadow-xl transition-all duration-300 hover:border-gray-600">
      <h4 className="text-xs font-black text-gray-400 tracking-wider uppercase mb-4 pb-3 border-b border-gray-800">
        Habilidades de Jugador
      </h4>
      <div className="flex flex-wrap gap-2">
        {skills.length > 0 ? (
          skills.map(skill => (
            <span key={skill} className="skill-tag text-xs font-bold px-4 py-1.5 rounded bg-[#111] border border-blue-500/30 text-blue-300 shadow-sm">
              {skill}
            </span>
          ))
        ) : (
          <span className="text-sm text-gray-500 italic">Sin habilidades especiales.</span>
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

  const meetsFranchiseCriteria = player && player.Age >= 31 && player.OVR_CALCULADO >= 83 && player.OVR_CALCULADO <= 89;
  const isEligibleForFranchise = meetsFranchiseCriteria && !userProfile?.franchisePlayerUsed;

  const similarPlayers = useMemo(() => {
    if (!player) return [];
    return getSimilarPlayers(player, allPlayers);
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
        <div className="flex items-center justify-center px-6 py-3 font-bold rounded-xl bg-gray-800 text-gray-400 border border-gray-700 w-full sm:w-auto cursor-not-allowed opacity-70">
          <Eye className="w-5 h-5 mr-2" /> Modo Visitante (Solo Lectura)
        </div>
      );
    }

    const commonClasses = "flex items-center justify-center px-6 py-3 font-bold rounded-xl transition-all shadow-lg transform hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto";

    // Signed by current user -> show release button
    // In my cart
    if (cartStatus === 'IN_MY_CART') {
      if (isFranchisePlayer) {
        return (
          <div className="flex flex-col items-center justify-center px-4 py-2 font-bold rounded-xl bg-purple-900/40 text-purple-400 border border-purple-700/50 w-full sm:w-auto">
            <div className="flex items-center text-[10px] text-purple-400 uppercase tracking-widest mb-0.5">
              <Crown className="w-3 h-3 mr-1" />
              <span>Jugador Franquicia</span>
            </div>
            <span className="text-white text-sm">Intransferible</span>
          </div>
        );
      }
      return (
        <button
          onClick={() => setShowReleaseConfirm(true)}
          className={`${commonClasses} bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white border border-red-500/40 shadow-red-900/30`}
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Eliminar Fichaje
        </button>
      );
    }

    // Locked by another team
    if (cartStatus === 'LOCKED_BY_OTHER') {
      if (isFranchisePlayer) {
        return (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="flex flex-col items-center justify-center px-4 py-2 font-bold rounded-xl bg-gray-800/80 text-gray-400 border border-gray-700 cursor-not-allowed w-full sm:w-auto">
              <div className="flex items-center text-[10px] text-red-400 uppercase tracking-widest mb-0.5">
                <Lock className="w-3 h-3 mr-1" />
                <span>Fichado por</span>
              </div>
              <span className="text-white text-sm">{lockedTeamName || 'Otro equipo'}</span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 font-bold rounded-xl bg-purple-900/40 text-purple-400 border border-purple-700/50 w-full sm:w-auto cursor-not-allowed">
              <div className="flex items-center text-[10px] text-purple-400 uppercase tracking-widest mb-0.5">
                <Crown className="w-3 h-3 mr-1" />
                <span>Jugador Franquicia</span>
              </div>
              <span className="text-white text-sm">Intransferible</span>
            </div>
          </div>
        );
      }
      return (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex flex-col items-center justify-center px-4 py-2 font-bold rounded-xl bg-gray-800/80 text-gray-400 border border-gray-700 cursor-not-allowed w-full sm:w-auto">
            <div className="flex items-center text-[10px] text-red-400 uppercase tracking-widest mb-0.5">
              <Lock className="w-3 h-3 mr-1" />
              <span>Fichado por</span>
            </div>
            <span className="text-white text-sm">{lockedTeamName || 'Otro equipo'}</span>
          </div>
          <button 
            onClick={() => setShowProposalModal(true)}
            className={`${commonClasses} bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-blue-900/30 w-full sm:w-auto`}
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
    const afterColor = budgetAfterPercent <= 20 ? 'text-red-400' : budgetAfterPercent <= 50 ? 'text-yellow-400' : 'text-emerald-400';
    const barColor = budgetAfterPercent > 50 ? '#10b981' : budgetAfterPercent > 20 ? '#eab308' : '#ef4444';

    const isFranchiseMarket = marketStatus?.status === 'FranchiseMarket';

    if (isFranchiseMarket) {
      if (isEligibleForFranchise) {
        return (
          <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleSign(true)}
              disabled={isSigning}
              className={`${commonClasses} ${isSigning ? 'bg-gray-700 text-gray-300 cursor-wait border border-gray-600 hover:-translate-y-0 active:scale-100' : 'bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-500 hover:to-amber-400 text-white shadow-yellow-900/30 border border-yellow-500/30'}`}
              title="Fichar gratis como jugador franquicia"
            >
              {isSigning ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : (
                <Sparkles className="w-5 h-5 mr-1" />
              )}
              <span>{isSigning ? 'Procesando...' : '⭐ Jugador Franquicia ($0)'}</span>
            </button>
          </div>
        );
      } else if (meetsFranchiseCriteria && userProfile?.franchisePlayerUsed) {
        return (
          <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
            <button disabled className={`${commonClasses} bg-gray-800/80 text-gray-500 cursor-not-allowed border border-gray-700 hover:-translate-y-0 active:scale-100`}>
              <Lock className="w-5 h-5 mr-2 text-gray-600" />
              Cupo Utilizado
            </button>
            <span className="text-[10px] text-gray-500 font-bold uppercase text-center max-w-[200px]">
              Ya has fichado a tu Jugador Franquicia esta temporada
            </span>
          </div>
        );
      } else {
        return (
          <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
            <button disabled className={`${commonClasses} bg-gray-800/80 text-gray-500 cursor-not-allowed border border-gray-700 hover:-translate-y-0 active:scale-100`}>
              <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
              Mercado Restringido
            </button>
            <span className="text-[10px] text-gray-500 font-bold uppercase text-center max-w-[200px]">
              El jugador no cumple los requisitos (Edad ≥ 31 y OVR 83-89)
            </span>
          </div>
        );
      }
    }

    // ─── Budget Impact Section ───
    const BudgetImpact = () => (
      <div
        className="w-full rounded-xl p-3.5 mb-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm">💰</span>
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Impacto en tu presupuesto</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Disponible:</span>
            <span className="text-xs font-bold text-white">${currentBudgetM}M</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">Costo fichaje:</span>
            <span className="text-xs font-bold text-red-400">- {formatPriceShort(priceMillions)}</span>
          </div>
          <div className="border-t border-white/[0.06] my-1.5" />
          {canAfford ? (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Te quedarían:</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black ${afterColor}`}>${budgetAfterM}M</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  budgetAfterPercent > 50 ? 'bg-emerald-500/15 text-emerald-400' :
                  budgetAfterPercent > 20 ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {budgetAfterPercent.toFixed(0)}%
                </span>
                {budgetAfterPercent <= 20 && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span className="text-xs font-bold text-red-400">
                Presupuesto insuficiente, te faltan ${missingM}M
              </span>
            </div>
          )}
        </div>
        {canAfford && (
          <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
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
          <button disabled className={`${commonClasses} bg-gray-800/80 text-gray-500 cursor-not-allowed border border-gray-700 hover:-translate-y-0 active:scale-100`}>
            <DollarSign className="w-5 h-5 mr-2 text-gray-600" />
            Presupuesto insuficiente
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
          className={`${commonClasses} ${isSigning ? 'bg-gray-700 text-gray-300 cursor-wait border border-gray-600 hover:-translate-y-0 active:scale-100' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-900/30 border border-green-500/30'}`}
          title={`Fichar por ${formatPriceShort(priceMillions)}`}
        >
          {isSigning ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
          ) : (
            <DollarSign className="w-5 h-5 mr-1" />
          )}
          <span>{isSigning ? 'Procesando...' : <>Fichar <span className="ml-1 opacity-90 font-black">{formatPriceShort(priceMillions)}</span></>}</span>
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
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowReleaseConfirm(false)}>
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
            <h3 className="text-lg font-black text-white">Confirmar liberación</h3>
          </div>
          <p className="text-gray-300 mb-6">¿Seguro que querés liberar a <span className="font-bold text-white">{player.Name}</span>?</p>
          <div className="flex gap-3">
            <button onClick={() => setShowReleaseConfirm(false)} className="flex-1 py-2.5 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-600 transition">Cancelar</button>
            <button onClick={handleRelease} disabled={isReleasing} className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 border border-red-500/50 transition disabled:opacity-50">
              {isReleasing ? 'Liberando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}
    {/* MODIFICADO: p-0 en móvil, p-4 en escritorio. Animación fade-in */}
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div
        // MODIFICADO: h-full en móvil, rounded-none en móvil. Animación zoom + slide
        className="bg-gray-900/95 sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col border-0 sm:border border-gray-700/50 relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Fondo decorativo en el header */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-blue-900/20 to-gray-900 pointer-events-none z-0"></div>

        {/* Botón Cerrar (Más visible en móvil) */}
        <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition backdrop-blur-sm border border-white/10">
          <X size={24} />
        </button>

        {/* Contenido Scrollable */}
        <div className="flex-grow min-h-0 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative z-10 pb-20 sm:pb-8">

          {/* 1. CABECERA DEL JUGADOR - REDISEÑO PES PREMIUM */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-8 border-b border-gray-800 pb-8 pt-4 sm:pt-0">
            <div className="flex items-center gap-6 w-full lg:w-auto">
              {/* FOTO y OVR */}
              <div className="relative group shrink-0">
                <div className="absolute inset-0 bg-cyan-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img
                  src={`/fotos_jugadores/${player.Id}.webp`}
                  alt={player.Name}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-[3px] border-[#16161a] shadow-2xl relative z-10 bg-gradient-to-b from-gray-800 to-gray-900"
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/128x128/111/555?text=${player.Name.substring(0, 1)}`; }}
                />
                <div className={`absolute -bottom-2 -right-2 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full font-black text-xl sm:text-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-gray-900 z-20 !text-black ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>
                  {player.OVR_CALCULADO}
                </div>
              </div>

              {/* DATOS */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{player.Grupo}</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter leading-none mb-3 drop-shadow-md">{player.Name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-4 py-1 rounded shadow-md text-xs font-black tracking-widest !text-black ${posColorClass}`}>
                    {player.POS_NOMBRE}
                  </span>
                  <div className="flex items-center space-x-2">
                    <img src={country1FlagUrl} alt={country1Name} title={country1Name} className="h-5 rounded-sm shadow border border-gray-700" onError={(e) => e.target.style.display = 'none'} />
                    {hasCountry2 && (
                      <img src={country2FlagUrl} alt={country2Name} title={country2Name} className="h-5 rounded-sm shadow border border-gray-700 opacity-90" onError={(e) => e.target.style.display = 'none'} />
                    )}
                  </div>
                  <span className="text-gray-300 text-xs font-bold flex items-center bg-gray-900 px-3 py-1.5 rounded border border-gray-800">
                    {player.Age} años <span className="mx-2 text-gray-700">|</span> {player.Height}cm <span className="mx-2 text-gray-700">|</span> {player.Foot} <span className="mx-2 text-gray-700">|</span> {player.Weight}kg
                  </span>
                </div>
              </div>
            </div>

            {/* BOTÓN FICHAR ALINEADO DERECHA */}
            <div className="flex flex-col items-end gap-2 w-full lg:w-auto shrink-0 mt-4 lg:mt-0">
              {renderActionButton()}
            </div>
          </div>

          {/* 2. INFO DETALLADA Y GRÁFICOS - REDISEÑO PES PREMIUM */}
          <div className="flex flex-col lg:flex-row gap-8 mb-10">

            {/* LADO IZQUIERDO: RADAR Y HEATMAP */}
            <div className="w-full lg:w-[280px] shrink-0 space-y-6 flex flex-col">
              <div className="bg-[#16161a] rounded-2xl p-4 border border-gray-800 shadow-xl relative overflow-hidden group flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <RadarChart player={player} isGK={isGK} />
              </div>

              {!isGK && (
                <div className="bg-[#16161a] rounded-2xl p-4 border border-gray-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <PosicionHeatmap player={player} />
                </div>
              )}
            </div>

            {/* LADO DERECHO: STATS EN GRILLA */}
            <div className="flex-1 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(isGK ? Object.entries(STATS_PORTERO) : Object.entries(STATS_JUGADOR_CAMPO))
                  .filter(([, statKeys]) => statKeys.length > 0)
                  .map(([title, statKeys]) => (
                    <StatSection key={title} title={title} statKeys={statKeys} player={player} />
                  ))}
              </div>
              <SkillsSection player={player} />
            </div>
          </div>

          {/* 3. ALTERNATIVAS SUGERIDAS */}
          <div className="pt-6 border-t border-gray-700/50">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center">
              <Sparkles className="w-5 h-5 text-yellow-400 mr-2" />
              Alternativas Sugeridas (IA)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {similarPlayers.map(simPlayer => {
                const ovr = simPlayer.OVR_CALCULADO;
                let ovrBg = 'bg-gray-500';
                if (ovr >= 90) ovrBg = 'bg-green-500';
                else if (ovr >= 80) ovrBg = 'bg-lime-500';
                else if (ovr >= 70) ovrBg = 'bg-yellow-500';
                else if (ovr >= 60) ovrBg = 'bg-orange-500';
                else ovrBg = 'bg-red-500';

                const pos = simPlayer.POS_NOMBRE;
                let posBg = 'bg-gray-600';
                if (['DC', 'SD', 'EI', 'ED'].includes(pos)) posBg = 'bg-red-500';
                else if (['MC', 'MCD', 'MO', 'MI', 'MD'].includes(pos)) posBg = 'bg-green-600';
                else if (['DFC', 'LI', 'LD'].includes(pos)) posBg = 'bg-blue-500';
                else if (['PT'].includes(pos)) posBg = 'bg-yellow-600';

                return (
                  <div
                    key={simPlayer.Id}
                    onClick={() => { onClose(); onPlayerSwitch(simPlayer); }}
                    className="group bg-gray-800/50 hover:bg-gray-700/80 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all border border-gray-700/50 hover:border-gray-500 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center min-w-0">
                      <img
                        src={`/fotos_jugadores/${simPlayer.Id}.webp`}
                        className="w-10 h-10 rounded-full object-cover mr-3 bg-gray-900 border border-gray-600 group-hover:border-gray-400 transition-colors"
                        onError={(e) => e.target.src = `https://placehold.co/48x48/374151/e0e0e0?text=${simPlayer.Name.substring(0, 1)}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate group-hover:text-blue-300 transition-colors mb-0.5">
                          {simPlayer.Name}
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-gray-900 ${ovrBg}`}>
                            {ovr}
                          </div>
                          <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white tracking-wide ${posBg}`}>
                            {pos}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right pl-2">
                      <div className="text-green-400 font-bold text-xs">
                        {formatPriceShort(simPlayer.Precio)}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {Math.round(simPlayer.similarityScore)}% Sim.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
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
        />
      )}
    </div>
    </>
  );
});

