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

// Summary attributes of the radar: [short label, full name, catalog key]. Spanish, as in the player list.
const RADAR_KEYS = {
  field: [['TIR', 'Tiro', 'STAT_SHO'], ['PAS', 'Pase', 'STAT_PAS'], ['FÍS', 'Físico', 'STAT_STR'], ['DEF', 'Defensa', 'STAT_DEF'], ['VEL', 'Velocidad', 'STAT_SPD'], ['REG', 'Regate', 'STAT_DRI']],
  gk: [['TIR', 'Tiro', 'STAT_SHO'], ['PAS', 'Pase', 'STAT_PAS'], ['FÍS', 'Físico', 'STAT_STR'], ['ARQ', 'Arquero', 'STAT_GK'], ['VEL', 'Velocidad', 'STAT_SPD'], ['REG', 'Regate', 'STAT_DRI']],
};

const RADAR_OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    r: {
      min: 35,
      max: 100,
      ticks: { display: false },
      pointLabels: { font: { size: 12, weight: '600' }, color: 'rgb(184 194 214)', backdropColor: 'transparent' },
      grid: { color: 'rgba(255, 255, 255, 0.08)', lineWidth: 1 },
      angleLines: { color: 'rgba(255, 255, 255, 0.08)', lineWidth: 1 },
    },
  },
  plugins: { legend: { display: false } },
};

// Age, height and weight describe the player; more is not better, so they get no winner and no quality colour.
const PROFILE_ROWS = [['Edad', 'Age', 'años', 15, 40], ['Altura', 'Height', 'cm', 150, 210], ['Peso', 'Weight', 'kg', 50, 105]];
const WEAK_FOOT_KEYS = new Set(['WeakFootAcc', 'WeakFootUsage']);
const WEAK_FOOT_MAX = 4;

const lastName = name => String(name || '').split(' ').pop();
const skillsOf = player => Object.entries(PLAYER_SKILLS_MAP).filter(([key]) => player[key]).map(([, label]) => label);
const toNumber = value => Number(value) || 0;
const winnerOf = (a, b) => (a > b ? 'A' : b > a ? 'B' : null);
const clampPercent = (value, floor) => Math.min(100, Math.max(floor, value));

/** Stats both players are compared on, with who is better at each one. */
function compareStats(statGroups, playerA, playerB) {
  return Object.values(statGroups).flat().map(key => winnerOf(toNumber(playerA[key]), toNumber(playerB[key])));
}

function StatValue({ value, isWinner, side, tone }) {
  const colour = tone === 'quality' ? getStatAndOvrColorClass(value) : 'bg-overlay text-ink';
  return (
    <span className={`min-w-9 px-1.5 py-0.5 rounded-md font-display num text-sm font-bold text-center ${colour} ${isWinner ? `ring-2 ring-offset-1 ring-offset-raised ${SIDE[side].ring}` : ''}`}>
      {value}
    </span>
  );
}

function Bars({ percentA, percentB, winner }) {
  const dim = side => (winner && winner !== side ? 'opacity-40' : '');
  return (
    <div className="flex items-center gap-1.5 h-1.5" aria-hidden="true">
      <div className="flex-1 bg-white/[0.07] rounded-full h-full overflow-hidden flex justify-end">
        <div className={`h-full rounded-full ${SIDE.A.dot} ${dim('A')}`} style={{ width: `${percentA}%` }} />
      </div>
      <div className="flex-1 bg-white/[0.07] rounded-full h-full overflow-hidden">
        <div className={`h-full rounded-full ${SIDE.B.dot} ${dim('B')}`} style={{ width: `${percentB}%` }} />
      </div>
    </div>
  );
}

/** One attribute; the visual row is hidden from screen readers, which get one sentence instead. */
function StatBarRow({ label, valA, valB, names, isWeakFoot = false }) {
  const numA = toNumber(valA);
  const numB = toNumber(valB);
  const winner = winnerOf(numA, numB);
  const percent = value => (isWeakFoot ? clampPercent((value / WEAK_FOOT_MAX) * 100, 12) : clampPercent(value, 6));
  const verdict = winner ? `Mejor ${winner === 'A' ? names.A : names.B}.` : 'Igualados.';
  return (
    <div className="py-2 border-b border-line/[0.08] last:border-0">
      <p className="sr-only">{`${label}: ${names.A} ${numA}, ${names.B} ${numB}. ${verdict}`}</p>
      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <div className="flex items-center justify-between gap-2 text-sm">
          <StatValue value={numA} isWinner={winner === 'A'} side="A" tone={isWeakFoot ? 'neutral' : 'quality'} />
          <span className="flex-1 text-center font-semibold text-ink-2 truncate text-xs sm:text-sm">{label}</span>
          <StatValue value={numB} isWinner={winner === 'B'} side="B" tone={isWeakFoot ? 'neutral' : 'quality'} />
        </div>
        <Bars percentA={percent(numA)} percentB={percent(numB)} winner={winner} />
      </div>
    </div>
  );
}

function ProfileRow({ label, valA, valB, unit, min, max, names }) {
  const numA = toNumber(valA);
  const numB = toNumber(valB);
  const percent = value => clampPercent(((value - min) / (max - min)) * 100, 15);
  const value = num => (
    <span className="font-display num text-sm font-bold text-ink">{num}<span className="ml-0.5 font-sans text-[11px] font-medium text-ink-3">{unit}</span></span>
  );
  return (
    <div className="py-2 border-b border-line/[0.08] last:border-0">
      <p className="sr-only">{`${label}: ${names.A} ${numA} ${unit}, ${names.B} ${numB} ${unit}.`}</p>
      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <div className="flex items-center justify-between gap-2">
          {value(numA)}
          <span className="flex-1 text-center font-semibold text-ink-2 truncate text-xs sm:text-sm">{label}</span>
          {value(numB)}
        </div>
        <Bars percentA={percent(numA)} percentB={percent(numB)} winner={null} />
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
          <span className="sr-only">Media </span>{player.OVR_CALCULADO}
        </span>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm sm:text-base font-semibold text-ink leading-tight truncate">{player.Name}</h3>
        <div className={`flex items-center gap-x-2 gap-y-1 mt-1 flex-wrap ${isRight ? 'justify-end' : ''}`}>
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

/** "Mejor en N" per side, so the overall answer is readable before scrolling through every attribute. */
function Tally({ winners, names }) {
  const count = side => winners.filter(w => w === side).length;
  const ties = winners.filter(w => w === null).length;
  const side = key => (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${SIDE[key].dot}`} aria-hidden="true" />
      <span className="text-ink-3">Mejor en</span>
      <span className={`font-display num text-sm font-bold ${SIDE[key].text}`}>{count(key)}</span>
      <span className="sr-only">atributos: {names[key]}</span>
    </span>
  );
  return (
    <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pb-2.5 text-xs">
      {side('A')}
      {ties > 0 && <span className="text-ink-3"><span className="num">{ties}</span> {ties === 1 ? 'igual' : 'iguales'}</span>}
      <span className="flex flex-row-reverse">{side('B')}</span>
    </div>
  );
}

function RadarSummary({ keys, playerA, playerB, names }) {
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-line/[0.08]">
      {keys.map(([short, full, key]) => {
        const valA = toNumber(playerA[key]);
        const valB = toNumber(playerB[key]);
        return (
          <li key={key} className="flex flex-col items-center">
            <span className="sr-only">{`${full}: ${names.A} ${valA}, ${names.B} ${valB}`}</span>
            <span className="text-[11px] font-semibold text-ink-3" aria-hidden="true">{short}</span>
            <span className="font-display num text-sm font-bold" aria-hidden="true">
              <span className={SIDE.A.text}>{valA}</span>
              <span className="text-ink-3 font-medium mx-1">·</span>
              <span className={SIDE.B.text}>{valB}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SkillList({ player, skills, otherSkills, side }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-ink-2">{player.Name} <span className="num text-ink-3">({skills.length})</span></p>
      <ul className="flex flex-wrap gap-1.5">
        {skills.length > 0 ? skills.map(skill => {
          const isShared = otherSkills.includes(skill);
          return (
            <li key={skill} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${isShared ? 'bg-overlay text-ink-2 border-line/20' : SIDE[side].chip}`}>
              {skill}
              {isShared && <><Check className="w-3 h-3" aria-hidden="true" /><span className="sr-only">(en común)</span></>}
            </li>
          );
        }) : <li className="text-xs text-ink-3">Sin habilidades especiales</li>}
      </ul>
    </div>
  );
}

function Legend({ names }) {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-2" aria-hidden="true">
      <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${SIDE.A.dot}`} />{names.A}</span>
      <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${SIDE.B.dot}`} />{names.B}</span>
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
  const radarKeys = isGK ? RADAR_KEYS.gk : RADAR_KEYS.field;
  const names = { A: lastName(playerA.Name), B: lastName(playerB.Name) };

  const radarData = useMemo(() => {
    const dataset = (player, side) => ({
      label: player.Name, data: radarKeys.map(([, , key]) => toNumber(player[key])),
      backgroundColor: SIDE[side].fill, borderColor: SIDE[side].line, borderWidth: 2,
      pointBackgroundColor: SIDE[side].line, pointBorderColor: '#ffffff', pointRadius: 3.5, pointHoverRadius: 5,
    });
    return { labels: radarKeys.map(([short]) => short), datasets: [dataset(playerA, 'A'), dataset(playerB, 'B')] };
  }, [radarKeys, playerA, playerB]);

  const skillsA = useMemo(() => skillsOf(playerA), [playerA]);
  const skillsB = useMemo(() => skillsOf(playerB), [playerB]);
  const winners = useMemo(() => compareStats(statGroups, playerA, playerB), [statGroups, playerA, playerB]);
  const ovrDiff = toNumber(playerA.OVR_CALCULADO) - toNumber(playerB.OVR_CALCULADO);
  const leader = winnerOf(ovrDiff, 0);

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
        <div className="border-b border-line/[0.12] shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 pb-2.5 sm:pb-3">
            <PlayerHeader player={playerA} side="A" align="left" />
            <div className="shrink-0 text-center px-1">
              <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Media</p>
              <p className={`font-display num text-lg font-bold leading-tight ${leader ? SIDE[leader].text : 'text-ink-2'}`}>
                {leader ? `+${Math.abs(ovrDiff)}` : '='}
              </p>
              <p className="text-[11px] text-ink-3 max-w-[5.5rem] truncate">{leader ? names[leader] : 'Igual'}</p>
            </div>
            <PlayerHeader player={playerB} side="B" align="right" />
            <button type="button" onClick={onClose} aria-label="Cerrar comparador" title="Cerrar"
              className="shrink-0 min-w-11 min-h-11 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-white/[0.06] transition-colors">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <Tally winners={winners} names={names} />
        </div>

        {/* Focusable so keyboard users can scroll it: the close button is the dialog's only control. */}
        <div
          className="flex-grow overflow-y-auto overscroll-contain p-4 sm:p-6 custom-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          tabIndex={0}
          role="region"
          aria-label="Detalle de la comparación"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-0 lg:self-start">
              <section className="well p-4" aria-labelledby="compare-radar">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 id="compare-radar" className="section-title text-sm">Resumen</h4>
                  <Legend names={names} />
                </div>
                <div className="relative w-full h-[230px] flex items-center justify-center" aria-hidden="true">
                  <Radar data={radarData} options={RADAR_OPTIONS} />
                </div>
                <RadarSummary keys={radarKeys} playerA={playerA} playerB={playerB} names={names} />
              </section>

              <section className="well p-4" aria-labelledby="compare-profile">
                <h4 id="compare-profile" className="section-title text-center text-sm mb-2">Perfil</h4>
                {PROFILE_ROWS.map(([label, key, unit, min, max]) => (
                  <ProfileRow key={key} label={label} valA={playerA[key]} valB={playerB[key]} unit={unit} min={min} max={max} names={names} />
                ))}
              </section>
            </div>

            {/* Columns instead of a grid: groups of different length used to leave empty space in the shorter card. */}
            <div className="lg:col-span-8 md:columns-2 md:gap-4">
              {Object.entries(statGroups).map(([groupName, statKeys]) => (
                <section key={groupName} className="well p-4 mb-4 break-inside-avoid">
                  <h4 className="section-title text-center text-sm mb-2">{groupName}</h4>
                  {statKeys.map(key => (
                    <StatBarRow key={key} label={STAT_NAMES_MAP[key] || key} valA={playerA[key]} valB={playerB[key]}
                      names={names} isWeakFoot={WEAK_FOOT_KEYS.has(key)} />
                  ))}
                </section>
              ))}
            </div>
          </div>

          <section className="well p-4 mt-0 lg:mt-1" aria-labelledby="compare-skills">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-line/[0.12]">
              <h4 id="compare-skills" className="section-title text-sm">
                Habilidades especiales <span className="num text-ink-3 font-sans font-normal normal-case tracking-normal">({skillsA.length} vs {skillsB.length})</span>
              </h4>
              <Legend names={names} />
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
