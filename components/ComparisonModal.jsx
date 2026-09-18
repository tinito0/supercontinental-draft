import React, { useMemo, memo } from 'react';
import { Radar } from 'react-chartjs-2';
import { X, Target } from 'lucide-react';
import { STAT_NAMES_MAP, STATS_JUGADOR_CAMPO, STATS_PORTERO, PLAYER_SKILLS_MAP } from '../utils/constants.js';
import { getPosColorClass, getStatAndOvrColorClass, formatPriceShort } from '../utils/helpers.js';

export const ComparisonModal = memo(function ComparisonModal({ isVisible, onClose, playerA, playerB }) {
  if (!isVisible || !playerA || !playerB) return null;

  const isGK = playerA.Grupo === 'Arqueros' || playerB.Grupo === 'Arqueros';
  const statGroups = isGK ? STATS_PORTERO : STATS_JUGADOR_CAMPO;

  // Hexágono PES en sentido horario: SHO, PAS, STR, DEF/GK, SPD, DRI
  const rawLabels = isGK
    ? ['SHO', 'PAS', 'STR', 'GK', 'SPD', 'DRI']
    : ['SHO', 'PAS', 'STR', 'DEF', 'SPD', 'DRI'];

  const getRadarData = (p) => isGK
    ? [p.STAT_SHO, p.STAT_PAS, p.STAT_STR, p.STAT_GK, p.STAT_SPD, p.STAT_DRI]
    : [p.STAT_SHO, p.STAT_PAS, p.STAT_STR, p.STAT_DEF, p.STAT_SPD, p.STAT_DRI];

  const dataA = getRadarData(playerA);
  const dataB = getRadarData(playerB);

  const radarLabels = rawLabels.map((l, i) => `${dataA[i] ?? 0} ${l} ${dataB[i] ?? 0}`);

  const radarData = useMemo(() => ({
    labels: radarLabels,
    datasets: [
      {
        label: playerA.Name,
        data: dataA,
        backgroundColor: 'rgba(0, 180, 216, 0.20)',
        borderColor: '#00b4d8',
        borderWidth: 2,
        pointBackgroundColor: '#00b4d8',
        pointBorderColor: '#ffffff',
        pointRadius: 3.5,
        pointHoverRadius: 5,
      },
      {
        label: playerB.Name,
        data: dataB,
        backgroundColor: 'rgba(249, 115, 22, 0.20)',
        borderColor: '#f97316',
        borderWidth: 2,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#ffffff',
        pointRadius: 3.5,
        pointHoverRadius: 5,
      }
    ]
  }), [playerA.Name, playerB.Name, dataA, dataB, radarLabels]);

  const radarOptions = useMemo(() => ({
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
  }), []);

  const skillsA = Object.entries(PLAYER_SKILLS_MAP).filter(([k]) => playerA[k]).map(([, v]) => v);
  const skillsB = Object.entries(PLAYER_SKILLS_MAP).filter(([k]) => playerB[k]).map(([, v]) => v);

  const StatBarRow = ({ label, valA, valB, isWeakFoot }) => {
    const numA = Number(valA) || 0;
    const numB = Number(valB) || 0;

    const isAWin = numA > numB;
    const isBWin = numB > numA;

    const colorClassA = getStatAndOvrColorClass(numA);
    const colorClassB = getStatAndOvrColorClass(numB);

    return (
      <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
        {/* Pill Jugador A */}
        <span
          className={`stat-value ${colorClassA} px-2.5 py-0.5 rounded-md font-mono font-bold text-sm min-w-[2.5rem] text-center tabular-nums shrink-0 inline-flex items-center justify-center ${
            isAWin ? 'ring-1 ring-cyan-400/60' : 'opacity-75'
          }`}
        >
          {numA}
        </span>

        {/* Nombre de la estadística */}
        <span className="flex-1 text-center text-sm text-slate-300 truncate px-2">
          {label}
        </span>

        {/* Pill Jugador B */}
        <span
          className={`stat-value ${colorClassB} px-2.5 py-0.5 rounded-md font-mono font-bold text-sm min-w-[2.5rem] text-center tabular-nums shrink-0 inline-flex items-center justify-center ${
            isBWin ? 'ring-1 ring-orange-400/60' : 'opacity-75'
          }`}
        >
          {numB}
        </span>
      </div>
    );
  };

  const ovrDiff = (playerA.OVR_CALCULADO || 0) - (playerB.OVR_CALCULADO || 0);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[60] p-0 sm:p-4" onClick={onClose}>
      <div className="bg-slate-900 sm:rounded-xl shadow-xl w-full max-w-6xl h-[100dvh] sm:max-h-[92vh] flex flex-col border-0 sm:border border-slate-800 overflow-hidden relative" onClick={e => e.stopPropagation()}>

        {/* HEADER DUELO STICKY */}
        <div className="sticky top-0 z-30 bg-slate-900 p-3 sm:p-4 pr-12 sm:pr-4 border-b border-slate-800 flex justify-between items-center shrink-0">

          {/* JUGADOR A */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shadow-sm">
                <img
                  src={`/fotos_jugadores/${playerA.Id}.webp`}
                  alt={playerA.Name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/100x100/111/555?text=${playerA.Name.substring(0, 1)}`; }}
                />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded font-bold text-[10px] sm:text-xs tabular-nums !text-black ${getStatAndOvrColorClass(playerA.OVR_CALCULADO)}`}>
                {playerA.OVR_CALCULADO}
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-bold text-white leading-tight truncate">
                {playerA.Name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded !text-black ${getPosColorClass(playerA.POS_NOMBRE)}`}>
                  {playerA.POS_NOMBRE}
                </span>
                <span className="text-xs font-semibold text-slate-300 tabular-nums">
                  {formatPriceShort(playerA.Precio)}
                </span>
                {playerA.PlayingStyle && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    <Target className="w-3 h-3 text-slate-400" />
                    {playerA.PlayingStyle}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* CENTRO: DUEL BADGE */}
          <div className="flex flex-col items-center justify-center px-2 shrink-0">
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 tabular-nums">
              {ovrDiff > 0 ? `+${ovrDiff} A` : ovrDiff < 0 ? `+${Math.abs(ovrDiff)} B` : 'PARIDAD'}
            </span>
          </div>

          {/* JUGADOR B */}
          <div className="flex items-center gap-3 sm:gap-4 flex-1 justify-end text-right min-w-0">
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-bold text-white leading-tight truncate">
                {playerB.Name}
              </h3>
              <div className="flex items-center gap-2 mt-1 justify-end flex-wrap">
                {playerB.PlayingStyle && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    <Target className="w-3 h-3 text-slate-400" />
                    {playerB.PlayingStyle}
                  </span>
                )}
                <span className="text-xs font-semibold text-slate-300 tabular-nums">
                  {formatPriceShort(playerB.Precio)}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded !text-black ${getPosColorClass(playerB.POS_NOMBRE)}`}>
                  {playerB.POS_NOMBRE}
                </span>
              </div>
            </div>
            <div className="relative shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shadow-sm">
                <img
                  src={`/fotos_jugadores/${playerB.Id}.webp`}
                  alt={playerB.Name}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/100x100/111/555?text=${playerB.Name.substring(0, 1)}`; }}
                />
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded font-bold text-[10px] sm:text-xs tabular-nums !text-black ${getStatAndOvrColorClass(playerB.OVR_CALCULADO)}`}>
                {playerB.OVR_CALCULADO}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-50 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            title="Cerrar"
            aria-label="Cerrar comparador"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENIDO SCROLLABLE */}
        <div className="relative z-10 flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

            {/* COLUMNA IZQUIERDA: RADAR Y FÍSICO */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#111722] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col items-center justify-center">
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-300">Superposición de atributos</span>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {playerA.Name.split(' ').pop()}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {playerB.Name.split(' ').pop()}
                    </span>
                  </div>
                </div>
                <div className="relative w-full h-[245px] flex items-center justify-center">
                  <Radar data={radarData} options={radarOptions} />
                </div>
              </div>

              <div className="bg-[#111722] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm">
                <h4 className="text-xs sm:text-sm font-semibold text-white mb-3 text-center border-b border-slate-800 pb-2">
                  Biometría y Perfil
                </h4>
                <StatBarRow label="Edad" valA={playerA.Age} valB={playerB.Age} isWeakFoot={false} />
                <StatBarRow label="Altura" valA={playerA.Height} valB={playerB.Height} isWeakFoot={false} />
                <StatBarRow label="Peso" valA={playerA.Weight} valB={playerB.Weight} isWeakFoot={false} />
              </div>
            </div>

            {/* COLUMNA DERECHA: GRUPOS DE ATRIBUTOS */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(statGroups).map(([groupName, statKeys]) => (
                  <div key={groupName} className="bg-[#111722] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm transition">
                    <h4 className="text-xs sm:text-sm font-semibold text-white mb-3 text-center border-b border-slate-800 pb-2">
                      {groupName}
                    </h4>
                    {statKeys.map(key => {
                      const isWF = key === 'WeakFootAcc' || key === 'WeakFootUsage';
                      return <StatBarRow key={key} label={STAT_NAMES_MAP[key] || key} valA={playerA[key]} valB={playerB[key]} isWeakFoot={isWF} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── HABILIDADES DE JUGADOR COMPARATIVAS ── */}
          <div className="bg-[#111722] p-4 sm:p-5 rounded-xl border border-slate-800 shadow-sm mt-4">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-800">
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                Habilidades especiales ({skillsA.length} vs {skillsB.length})
              </h4>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500/30 border border-blue-500" /> {playerA.Name.split(' ').pop()}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-500" /> {playerB.Name.split(' ').pop()}</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-700 border border-slate-500" /> Compartidas</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Player A Skills */}
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-300">
                  {playerA.Name} ({skillsA.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skillsA.length > 0 ? (
                    skillsA.map(skill => {
                      const isShared = skillsB.includes(skill);
                      return (
                        <span
                          key={skill}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                            isShared
                              ? 'bg-slate-800/90 text-slate-200 border-slate-700'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                          }`}
                        >
                          {skill} {isShared && '✓'}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-500 italic">Sin habilidades especiales</span>
                  )}
                </div>
              </div>

              {/* Player B Skills */}
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-300">
                  {playerB.Name} ({skillsB.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skillsB.length > 0 ? (
                    skillsB.map(skill => {
                      const isShared = skillsA.includes(skill);
                      return (
                        <span
                          key={skill}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md border ${
                            isShared
                              ? 'bg-slate-800/90 text-slate-200 border-slate-700'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                          }`}
                        >
                          {skill} {isShared && '✓'}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-500 italic">Sin habilidades especiales</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
