import React, { useMemo, memo } from 'react';
import { Radar } from 'react-chartjs-2';
import '../utils/chartSetup.js';
import { X, Target, Check } from 'lucide-react';
import { STAT_NAMES_MAP, STATS_JUGADOR_CAMPO, STATS_PORTERO, PLAYER_SKILLS_MAP } from '../utils/constants.js';
import { getPosColorClass, getStatAndOvrColorClass, formatPriceShort } from '../utils/helpers.js';
import { BaseModal } from './ui/BaseModal.jsx';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';

// Each side keeps one colour everywhere (radar, winning value, legend, exclusive skills):
// A = crest blue (--c-accent), B = amber (--c-warning). Chart.js needs literal colours, so they mirror index.css.
const SIDE = {
  A: { line: 'rgb(58 102 196)', fill: 'rgba(58, 102, 196, 0.22)', dot: 'bg-accent', ring: 'ring-accent', text: 'text-accent-soft', chip: 'bg-accent/[0.12] text-accent-soft border-accent/30' },
  B: { line: 'rgb(245 158 11)', fill: 'rgba(245, 158, 11, 0.18)', dot: 'bg-warning', ring: 'ring-warning', text: 'text-warning-soft', chip: 'bg-warning/[0.12] text-warning-soft border-warning/30' },
};

const RADAR_KEYS = {
  field: [['SHO', 'STAT_SHO'], ['PAS', 'STAT_PAS'], ['STR', 'STAT_STR'], ['DEF', 'STAT_DEF'], ['SPD', 'STAT_SPD'], ['DRI', 'STAT_DRI']],
  gk: [['SHO', 'STAT_SHO'], ['PAS', 'STAT_PAS'], ['STR', 'STAT_STR'], ['GK', 'STAT_GK'], ['SPD', 'STAT_SPD'], ['DRI', 'STAT_DRI']],
};

const RADAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    r: {
      min: 35,
      max: 100,
      ticks: { display: false },
      pointLabels: { font: { size: 11, weight: '600' }, color: 'rgb(184 194 214)', backdropColor: 'transparent' },
      grid: { color: 'rgba(255, 255, 255, 0.08)', lineWidth: 1 },
      angleLines: { color: 'rgba(255, 255, 255, 0.08)', lineWidth: 1 },
    },
  },
  plugins: { legend: { display: false } },
};

const lastName = name => String(name || '').split(' ').pop();
const skillsOf = player => Object.entries(PLAYER_SKILLS_MAP).filter(([key]) => player[key]).map(([, label]) => label);

/** Bar fill (0–100) for a value; the physical rows use their own realistic ranges. */
function barPercent(label, value, isWeakFoot) {
  if (isWeakFoot) return Math.min(100, Math.max(12, (value / 4) * 100));
  if (label === 'Edad') return Math.min(100, Math.max(15, ((value - 15) / 25) * 100));
  if (label === 'Altura') return Math.min(100, Math.max(15, ((value - 150) / 60) * 100));
  if (label === 'Peso') return Math.min(100, Math.max(15, ((value - 50) / 55) * 100));
  return Math.min(100, Math.max(6, value));
}

function StatValue({ value, isWinner, side }) {
  return (
    <span className={`min-w-9 px-1.5 py-0.5 rounded-md font-display num text-sm font-bold text-center ${getStatAndOvrColorClass(value)} ${isWinner ? `ring-2 ring-offset-1 ring-offset-raised ${SIDE[side].ring}` : ''}`}>
      {value}
    </span>
  );
}

function StatBarRow({ label, valA, valB, isWeakFoot = false }) {
  const numA = Number(valA) || 0;
  const numB = Number(valB) || 0;
  const winner = numA > numB ? 'A' : numB > numA ? 'B' : null;
  return (
    <div className="py-2 border-b border-line/[0.08] last:border-0 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <StatValue value={numA} isWinner={winner === 'A'} side="A" />
        <span className="flex-1 text-center font-semibold text-ink-2 truncate text-xs sm:text-sm">{label}</span>
        <StatValue value={numB} isWinner={winner === 'B'} side="B" />
      </div>
      <div className="flex items-center gap-1.5 h-1.5" aria-hidden="true">
        <div className="flex-1 bg-white/[0.07] rounded-full h-full overflow-hidden flex justify-end">
          <div className={`h-full rounded-full ${SIDE.A.dot} ${winner === 'A' ? '' : 'opacity-40'}`} style={{ width: `${barPercent(label, numA, isWeakFoot)}%` }} />
        </div>
        <div className="flex-1 bg-white/[0.07] rounded-full h-full overflow-hidden">
          <div className={`h-full rounded-full ${SIDE.B.dot} ${winner === 'B' ? '' : 'opacity-40'}`} style={{ width: `${barPercent(label, numB, isWeakFoot)}%` }} />
        </div>
      </div>
    </div>
  );
}

function PlayerHeader({ player, side, align }) {
  const isRight = align === 'right';
  return (
    <div className={`flex items-center gap-3 flex-1 min-w-0 ${isRight ? 'flex-row-reverse text-right' : ''}`}>
      <div className="relative shrink-0">
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt=""
          width={56}
          height={56}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover object-top bg-raised ring-2 ${SIDE[side].ring}`}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = playerPlaceholder(player.Name?.substring(0, 1) ?? '?'); }}
        />
        <span className={`absolute -bottom-1.5 ${isRight ? '-left-1.5' : '-right-1.5'} min-w-7 h-6 px-1 rounded-md flex items-center justify-center font-display num text-sm font-bold ${getStatAndOvrColorClass(player.OVR_CALCULADO)}`}>
          {player.OVR_CALCULADO}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight truncate">{player.Name}</h3>
        <div className={`flex items-center gap-2 mt-1 flex-wrap ${isRight ? 'justify-end' : ''}`}>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
          <span className="font-display num text-sm font-semibold text-ink">{formatPriceShort(player.Precio)}</span>
          {player.PlayingStyle && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-ink-3">
              <Target className="w-3 h-3" aria-hidden="true" />{player.PlayingStyle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillList({ player, skills, otherSkills, side }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-ink-2">{player.Name} <span className="num text-ink-3">({skills.length})</span></p>
      <div className="flex flex-wrap gap-1.5">
        {skills.length > 0 ? skills.map(skill => {
          const isShared = otherSkills.includes(skill);
          return (
            <span key={skill} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${isShared ? 'bg-overlay text-ink-2 border-line/20' : SIDE[side].chip}`}>
              {skill}{isShared && <Check className="w-3 h-3" aria-label="en común" />}
            </span>
          );
        }) : <span className="text-xs text-ink-3">Sin habilidades especiales</span>}
      </div>
    </div>
  );
}

/**
 * Side-by-side comparison of two marketplace players. The outer component only decides visibility, so the
 * hooks in ComparisonContent always run in the same order (they used to sit after an early return).
 */
export const ComparisonModal = memo(function ComparisonModal({ isVisible, onClose, playerA, playerB }) {
  if (!isVisible || !playerA || !playerB) return null;
  return <ComparisonContent onClose={onClose} playerA={playerA} playerB={playerB} />;
});

function ComparisonContent({ onClose, playerA, playerB }) {
  const isGK = playerA.Grupo === 'Arqueros' || playerB.Grupo === 'Arqueros';
  const statGroups = isGK ? STATS_PORTERO : STATS_JUGADOR_CAMPO;

  const radarData = useMemo(() => {
    const keys = isGK ? RADAR_KEYS.gk : RADAR_KEYS.field;
    const dataA = keys.map(([, key]) => playerA[key] ?? 0);
    const dataB = keys.map(([, key]) => playerB[key] ?? 0);
    const dataset = (player, data, side) => ({
      label: player.Name, data, backgroundColor: SIDE[side].fill, borderColor: SIDE[side].line, borderWidth: 2,
      pointBackgroundColor: SIDE[side].line, pointBorderColor: '#ffffff', pointRadius: 3.5, pointHoverRadius: 5,
    });
    return {
      labels: keys.map(([label], i) => `${dataA[i]} ${label} ${dataB[i]}`),
      datasets: [dataset(playerA, dataA, 'A'), dataset(playerB, dataB, 'B')],
    };
  }, [isGK, playerA, playerB]);

  const skillsA = useMemo(() => skillsOf(playerA), [playerA]);
  const skillsB = useMemo(() => skillsOf(playerB), [playerB]);
  const ovrDiff = (playerA.OVR_CALCULADO || 0) - (playerB.OVR_CALCULADO || 0);
  const leader = ovrDiff > 0 ? 'A' : ovrDiff < 0 ? 'B' : null;

  const legend = (
    <div className="flex items-center gap-3 text-xs text-ink-2">
      <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${SIDE.A.dot}`} aria-hidden="true" />{lastName(playerA.Name)}</span>
      <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${SIDE.B.dot}`} aria-hidden="true" />{lastName(playerB.Name)}</span>
    </div>
  );

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      size="2xl"
      showClose={false}
      ariaLabel={`Comparación: ${playerA.Name} contra ${playerB.Name}`}
      className="!p-0 h-[92dvh] sm:h-[90dvh]"
      contentClassName="!p-0 !overflow-hidden flex flex-col h-full min-h-0"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-b border-line/[0.12] shrink-0">
          <PlayerHeader player={playerA} side="A" align="left" />
          <div className="shrink-0 text-center px-1">
            <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Media</p>
            <p className={`font-display num text-lg font-bold leading-tight ${leader ? SIDE[leader].text : 'text-ink-2'}`}>
              {leader ? `+${Math.abs(ovrDiff)}` : '='}
            </p>
            <p className="text-[11px] text-ink-3 max-w-[5.5rem] truncate">
              {leader ? lastName((leader === 'A' ? playerA : playerB).Name) : 'Igual'}
            </p>
          </div>
          <PlayerHeader player={playerB} side="B" align="right" />
          <button type="button" onClick={onClose} aria-label="Cerrar comparador" title="Cerrar"
            className="shrink-0 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/[0.06] transition-colors">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto overscroll-contain p-4 sm:p-6 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className="lg:col-span-4 space-y-4">
              <section className="well p-4" aria-labelledby="compare-radar">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 id="compare-radar" className="text-xs font-semibold text-ink-2">Atributos generales</h4>
                  {legend}
                </div>
                <div className="relative w-full h-[245px] flex items-center justify-center">
                  <Radar data={radarData} options={RADAR_OPTIONS} aria-label={`Radar de atributos de ${playerA.Name} y ${playerB.Name}`} role="img" />
                </div>
              </section>

              <section className="well p-4" aria-labelledby="compare-physical">
                <h4 id="compare-physical" className="section-title text-center text-sm mb-2">Físico</h4>
                <StatBarRow label="Edad" valA={playerA.Age} valB={playerB.Age} />
                <StatBarRow label="Altura" valA={playerA.Height} valB={playerB.Height} />
                <StatBarRow label="Peso" valA={playerA.Weight} valB={playerB.Weight} />
              </section>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
              {Object.entries(statGroups).map(([groupName, statKeys]) => (
                <section key={groupName} className="well p-4">
                  <h4 className="section-title text-center text-sm mb-2">{groupName}</h4>
                  {statKeys.map(key => (
                    <StatBarRow key={key} label={STAT_NAMES_MAP[key] || key} valA={playerA[key]} valB={playerB[key]}
                      isWeakFoot={key === 'WeakFootAcc' || key === 'WeakFootUsage'} />
                  ))}
                </section>
              ))}
            </div>
          </div>

          <section className="well p-4 mt-4" aria-labelledby="compare-skills">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-line/[0.12]">
              <h4 id="compare-skills" className="text-sm font-semibold text-ink">
                Habilidades especiales <span className="num text-ink-3 font-normal">({skillsA.length} vs {skillsB.length})</span>
              </h4>
              {legend}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkillList player={playerA} skills={skillsA} otherSkills={skillsB} side="A" />
              <SkillList player={playerB} skills={skillsB} otherSkills={skillsA} side="B" />
            </div>
          </section>
        </div>
      </div>
    </BaseModal>
  );
}
