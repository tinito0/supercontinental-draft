import React, { useState, useMemo, useCallback, memo } from 'react';
import { Radar } from 'react-chartjs-2';
import { X } from 'lucide-react';
import { STAT_NAMES_MAP, STATS_JUGADOR_CAMPO, STATS_PORTERO, PLAYER_SKILLS_MAP } from '../utils/constants.js';
import { getPosColorClass, getStatAndOvrColorClass, formatPriceShort } from '../utils/helpers.js';

export const ComparisonModal = memo(function ComparisonModal({ isVisible, onClose, playerA, playerB }) {
  if (!isVisible || !playerA || !playerB) return null;

  const isGK = playerA.Grupo === 'Arqueros' || playerB.Grupo === 'Arqueros';

  const statGroups = isGK ? STATS_PORTERO : STATS_JUGADOR_CAMPO;
  const radarLabels = isGK
    ? ['Porteria', 'Físico', 'Pase', 'Técnica']
    : ['Ataque', 'Técnica', 'Pase', 'Físico', 'Velocidad', 'Defensa'];

  const calculateGkAvg = (p) => {
    const sum = Number(p.GKAwareness || 0) + Number(p.GKCatching || 0) + Number(p.GKClearing || 0) + Number(p.GKReflexes || 0) + Number(p.GKReach || 0);
    return Math.round(sum / 5);
  };

  const getRadarData = (p) => isGK
    ? [calculateGkAvg(p), p.STAT_Fisico, p.STAT_Pase, p.STAT_Tecnica]
    : [p.STAT_Ataque, p.STAT_Tecnica, p.STAT_Pase, p.STAT_Fisico, p.STAT_Velocidad, p.STAT_Defensa];

  const radarData = {
    labels: radarLabels,
    datasets: [
      {
        label: playerA.Name,
        data: getRadarData(playerA),
        backgroundColor: 'rgba(0, 150, 255, 0.3)',
        borderColor: 'rgb(0, 150, 255)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(0, 150, 255)',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: playerB.Name,
        data: getRadarData(playerB),
        backgroundColor: 'rgba(255, 50, 50, 0.3)',
        borderColor: 'rgb(255, 50, 50)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(255, 50, 50)',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const radarOptions = {
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

  const skillsA = Object.entries(PLAYER_SKILLS_MAP).filter(([k]) => playerA[k]).map(([, v]) => v);
  const skillsB = Object.entries(PLAYER_SKILLS_MAP).filter(([k]) => playerB[k]).map(([, v]) => v);

  const StatBarRow = ({ label, valA, valB, isWeakFoot }) => {
    const numA = Number(valA) || 0;
    const numB = Number(valB) || 0;
    const maxVal = isWeakFoot ? 4 : 99;
    const pctA = Math.min((numA / maxVal) * 100, 100);
    const pctB = Math.min((numB / maxVal) * 100, 100);

    let colorTextA = 'text-gray-500 font-medium';
    let colorTextB = 'text-gray-500 font-medium';
    let colorBarA = 'bg-gray-700';
    let colorBarB = 'bg-gray-700';
    let glowA = '';
    let glowB = '';

    if (numA > numB) {
      colorTextA = 'text-blue-400 font-black scale-110';
      colorBarA = 'bg-blue-500';
      glowA = 'shadow-[0_0_10px_rgba(59,130,246,0.5)]';
    } else if (numB > numA) {
      colorTextB = 'text-red-400 font-black scale-110';
      colorBarB = 'bg-red-500';
      glowB = 'shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    } else {
      colorTextA = 'text-yellow-400 font-bold';
      colorTextB = 'text-yellow-400 font-bold';
      colorBarA = 'bg-yellow-500';
      colorBarB = 'bg-yellow-500';
    }

    return (
      <div className="mb-3 group">
        <div className="flex justify-between items-end mb-1.5 text-sm relative">
          <span className={`w-12 text-left text-lg transition-all duration-300 ${colorTextA} z-10`}>{numA}</span>
          <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 group-hover:text-gray-400 transition-colors bg-gray-900 px-2 z-20">{label}</span>
          <div className="absolute bottom-2 left-14 right-14 h-px bg-gray-800/50 z-0"></div>
          <span className={`w-12 text-right text-lg transition-all duration-300 ${colorTextB} z-10`}>{numB}</span>
        </div>
        <div className="flex items-center h-2.5 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/30">
          <div className="flex-1 flex justify-end h-full"><div style={{ width: `${pctA}%` }} className={`h-full rounded-l-full transition-all duration-500 ${colorBarA} ${glowA}`}></div></div>
          <div className="w-0.5 h-full bg-gray-900 z-10"></div>
          <div className="flex-1 flex justify-start h-full"><div style={{ width: `${pctB}%` }} className={`h-full rounded-r-full transition-all duration-500 ${colorBarB} ${glowB}`}></div></div>
        </div>
      </div>
    );
  };

  return (
    // MODIFICADO: p-0 en móvil
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-[#0a0a0a]/95 sm:rounded-2xl shadow-2xl w-full max-w-6xl h-[100dvh] sm:max-h-[90vh] flex flex-col border-0 sm:border border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={e => e.stopPropagation()}>

        {/* HEADER DUELO */}
        <div className="relative bg-[#111114]/95 p-4 sm:p-6 border-b border-white/10 flex justify-between items-center shrink-0">

          {/* JUGADOR A (AZUL) */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1">
            <div className="relative">
              <img src={`/fotos_jugadores/${playerA.Id}.webp`} className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl object-cover border border-cyan-400/40 shadow-lg shadow-cyan-900/20 bg-gray-900" onError={(e) => e.target.src = `https://placehold.co/100x100/374151/e0e0e0`} />
              <div className={`absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-full font-black text-[10px] sm:text-sm shadow-md ring-2 sm:ring-4 ring-gray-900 !text-black ${getStatAndOvrColorClass(playerA.OVR_CALCULADO)}`}>
                {playerA.OVR_CALCULADO}
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-2xl font-black text-white leading-none tracking-tight truncate uppercase italic">{playerA.Name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-black ${getPosColorClass(playerA.POS_NOMBRE)}`}>{playerA.POS_NOMBRE}</span>
                <span className="text-xs sm:text-sm font-bold text-cyan-400">{formatPriceShort(playerA.Precio)}</span>
              </div>
            </div>
          </div>

          {/* VS CENTRAL */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
              <div className="text-xl sm:text-4xl font-black text-white/80 italic tracking-tighter drop-shadow-sm">
              VS
            </div>
          </div>

          {/* JUGADOR B (ROJO) */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end text-right">
            <div className="min-w-0">
              <h3 className="text-sm sm:text-2xl font-black text-white leading-none tracking-tight truncate uppercase italic">{playerB.Name}</h3>
              <div className="flex items-center gap-2 mt-1 justify-end">
                <span className="text-xs sm:text-sm font-bold text-red-400">{formatPriceShort(playerB.Precio)}</span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-black ${getPosColorClass(playerB.POS_NOMBRE)}`}>{playerB.POS_NOMBRE}</span>
              </div>
            </div>
            <div className="relative">
              <img src={`/fotos_jugadores/${playerB.Id}.webp`} className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl object-cover border border-red-400/40 shadow-lg shadow-red-900/20 bg-gray-900" onError={(e) => e.target.src = `https://placehold.co/100x100/374151/e0e0e0`} />
              <div className={`absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-full font-black text-[10px] sm:text-sm shadow-md ring-2 sm:ring-4 ring-gray-900 !text-black ${getStatAndOvrColorClass(playerB.OVR_CALCULADO)}`}>
                {playerB.OVR_CALCULADO}
              </div>
            </div>
          </div>

          <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-white p-2 rounded-lg hover:bg-white/[0.06] transition z-50">
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-[#0a0a0a] pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white/[0.03] p-4 rounded-xl border border-white/[0.06] shadow-inner backdrop-blur-sm flex flex-col items-center justify-center">
                <Radar data={radarData} options={radarOptions} width={260} height={260} />
                <div className="flex justify-center items-center mt-3 gap-4 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-3 h-3 rounded-full bg-[rgba(0,150,255,0.3)] border border-[rgb(0,150,255)]"></span>
                    {playerA.Name.split(' ').pop()}
                  </div>
                  <div className="flex items-center gap-1.5 text-red-400">
                    <span className="w-3 h-3 rounded-full bg-[rgba(255,50,50,0.3)] border border-[rgb(255,50,50)]"></span>
                    {playerB.Name.split(' ').pop()}
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.03] p-5 rounded-xl border border-white/[0.06]">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 text-center border-b border-gray-700/50 pb-2">Físico</h4>
                <StatBarRow label="Edad" valA={playerA.Age} valB={playerB.Age} isWeakFoot={false} />
                <StatBarRow label="Altura" valA={playerA.Height} valB={playerB.Height} isWeakFoot={false} />
                <StatBarRow label="Peso" valA={playerA.Weight} valB={playerB.Weight} isWeakFoot={false} />
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(statGroups).map(([groupName, statKeys]) => (
                  <div key={groupName} className="bg-white/[0.03] p-5 rounded-xl border border-white/[0.06] shadow-sm hover:border-white/[0.12] transition">
                    <h4 className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-5 text-center border-b border-blue-500/20 pb-2">{groupName}</h4>
                    {statKeys.map(key => {
                      const isWF = key === 'WeakFootAcc' || key === 'WeakFootUsage';
                      return <StatBarRow key={key} label={STAT_NAMES_MAP[key] || key} valA={playerA[key]} valB={playerB[key]} isWeakFoot={isWF} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── HABILIDADES DE JUGADOR ── */}
          <div className="bg-white/[0.03] p-5 sm:p-6 rounded-xl border border-white/[0.06] shadow-sm mt-6">
             <h4 className="text-sm font-black text-gray-400 tracking-wider uppercase mb-5 pb-3 border-b border-gray-700/50 text-center">
               Habilidades de Jugador
             </h4>
             <div className="flex flex-col md:flex-row relative">
               {/* Left Player */}
               <div className="flex-1 flex flex-col items-center md:items-end md:pr-10 mb-6 md:mb-0">
                  <h5 className="text-xs font-bold text-blue-400 mb-3 uppercase">{playerA.Name}</h5>
                  {skillsA.length > 0 ? (
                    <div className="flex flex-wrap justify-center md:justify-end gap-2">
                       {skillsA.map(skill => {
                          const isShared = skillsB.includes(skill);
                          const bg = isShared ? 'bg-yellow-500/20' : 'bg-blue-500/20';
                          const text = isShared ? 'text-yellow-400' : 'text-blue-300';
                          const border = isShared ? 'border-yellow-500/30' : 'border-blue-500/30';
                          return <span key={skill} className={`text-xs font-bold px-3 py-1.5 rounded border shadow-sm ${bg} ${text} ${border}`}>{skill}</span>;
                       })}
                    </div>
                  ) : <span className="text-sm text-gray-500 italic">Sin habilidades especiales</span>}
               </div>

               {/* Center VS */}
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center justify-center">
                  <div className="w-px h-16 bg-gray-700"></div>
                  <span className="absolute bg-gray-900 px-2 text-xs font-black text-gray-500">VS</span>
               </div>

               {/* Right Player */}
               <div className="flex-1 flex flex-col items-center md:items-start md:pl-10">
                  <h5 className="text-xs font-bold text-red-400 mb-3 uppercase">{playerB.Name}</h5>
                  {skillsB.length > 0 ? (
                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                       {skillsB.map(skill => {
                          const isShared = skillsA.includes(skill);
                          const bg = isShared ? 'bg-yellow-500/20' : 'bg-red-500/20';
                          const text = isShared ? 'text-yellow-400' : 'text-red-300';
                          const border = isShared ? 'border-yellow-500/30' : 'border-red-500/30';
                          return <span key={skill} className={`text-xs font-bold px-3 py-1.5 rounded border shadow-sm ${bg} ${text} ${border}`}>{skill}</span>;
                       })}
                    </div>
                  ) : <span className="text-sm text-gray-500 italic">Sin habilidades especiales</span>}
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
});
