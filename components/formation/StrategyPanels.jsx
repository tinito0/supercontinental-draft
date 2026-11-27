import React, { memo } from 'react';
import { Crown, Target, Zap, Rocket, Shield, Users, Activity } from 'lucide-react';
import { DEFAULT_TACTICS } from '../../utils/constants.js';

// Team strategy (Preset S1) and set-piece takers of the tactics board (components/FormationModal.jsx). Both are
// exported to PES in Formation.csv.

const ATTACK_FIELDS = [
  { key: 'attackingStyles', label: 'Estilo de ataque', type: 'select', options: [
    { value: 1, label: 'Posesión' },
    { value: 0, label: 'Contraataque' },
  ] },
  { key: 'buildUp', label: 'Construcción', type: 'select', options: [
    { value: 1, label: 'Pase corto' },
    { value: 0, label: 'Pase largo' },
  ] },
  { key: 'attackingArea', label: 'Área de ataque', type: 'select', options: [
    { value: 1, label: 'Centro' },
    { value: 0, label: 'Bandas' },
  ] },
  { key: 'positioning', label: 'Posicionamiento', type: 'select', options: [
    { value: 1, label: 'Flexible' },
    { value: 0, label: 'Mantener formación' },
  ] },
  { key: 'supportRange', label: 'Rango de apoyo', type: 'slider', min: 1, max: 10, minLabel: 'Corto (1)', maxLabel: 'Largo (10)' },
  { key: 'numbersInAttack', label: 'Efectivos en ataque', type: 'select', options: [
    { value: 0, label: 'Pocos' },
    { value: 1, label: 'Medio' },
    { value: 2, label: 'Muchos' },
  ] },
];

const DEFENSE_FIELDS = [
  { key: 'defensiveStyles', label: 'Estilo defensivo', type: 'select', options: [
    { value: 0, label: 'Presión en la frontal' },
    { value: 1, label: 'Defensa total' },
  ] },
  { key: 'containmentArea', label: 'Área de contención', type: 'select', options: [
    { value: 0, label: 'Centro' },
    { value: 1, label: 'Bandas' },
  ] },
  { key: 'pressuring', label: 'Presión', type: 'select', options: [
    { value: 0, label: 'Conservador' },
    { value: 1, label: 'Agresivo' },
  ] },
  { key: 'defensiveLine', label: 'Línea defensiva', type: 'slider', min: 1, max: 10, minLabel: 'Retrasada (1)', maxLabel: 'Adelantada (10)' },
  { key: 'compactness', label: 'Compactación', type: 'slider', min: 1, max: 10, minLabel: 'Abierta (1)', maxLabel: 'Compacta (10)' },
  { key: 'numbersInDefense', label: 'Efectivos en defensa', type: 'select', options: [
    { value: 0, label: 'Pocos' },
    { value: 1, label: 'Medio' },
    { value: 2, label: 'Muchos' },
  ] },
];

function StrategyField({ field, value, onChange }) {
  return (
    <div className="py-3 space-y-2 border-b border-line/[0.07] last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-2">{field.label}</span>
        {field.type === 'slider' && <span className="font-display num text-base font-bold text-ink">{value ?? field.min}</span>}
      </div>
      {field.type === 'select' ? (
        <select
          aria-label={field.label}
          value={value ?? field.options[0].value}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
          className="select min-h-9 text-sm"
        >
          {field.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : (
        <div className="space-y-1 pt-1">
          <input
            type="range"
            aria-label={field.label}
            min={field.min}
            max={field.max}
            value={value ?? field.min}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            className="range"
          />
          <div className="flex justify-between text-2xs text-ink-3 px-0.5">
            <span>{field.minLabel}</span>
            <span>{field.maxLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StrategyGroup({ title, icon: Icon, fields, tactics, onChange, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="eyebrow flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" aria-hidden="true" />{title}</h3>
      <div>
        {fields.map(field => <StrategyField key={field.key} field={field} value={tactics[field.key]} onChange={onChange} />)}
      </div>
    </div>
  );
}

export const TacticsPanel = memo(function TacticsPanel({ tactics, onTacticsChange, children }) {
  const currentTactics = { ...DEFAULT_TACTICS, ...(tactics || {}) };
  return (
    <div className="flex-grow overflow-y-auto p-3 lg:p-4 custom-scrollbar space-y-4 pb-20 lg:pb-4">
      <p className="text-xs text-ink-3 leading-relaxed mb-1">
        Así juega tu equipo en PES. Se guarda en <span className="text-ink-2 font-mono">Formation.csv</span>.
      </p>
      <StrategyGroup title="Ataque" icon={Zap} fields={ATTACK_FIELDS} tactics={currentTactics} onChange={onTacticsChange} />
      <StrategyGroup title="Defensa" icon={Shield} fields={DEFENSE_FIELDS} tactics={currentTactics} onChange={onTacticsChange}
        className="pt-4 border-t border-line/[0.08]" />
      {children}
    </div>
  );
});

const isTrue = value => value === true || String(value) === 'True';

function formatRolePlayerOption(player, roleKey, dorsals = {}) {
  const d = dorsals[player.Id] ? `#${dorsals[player.Id]} ` : '';
  const name = player.Name;
  const pos = player.slotPos || player.POS_NOMBRE;
  const isLeftFooted = String(player.Foot).toLowerCase() === 'izquierdo' || isTrue(player.Foot);
  const footLabel = isLeftFooted ? 'Izq' : 'Der';

  const pk = player.PlaceKicking ?? '-';
  const curl = player.Curl ?? '-';
  const kp = player.KickingPower ?? '-';
  const head = player.Heading ?? '-';
  const jump = player.Jump ?? '-';
  const height = player.Height ? `${player.Height}cm` : '';
  const ovr = player.OVR_CALCULADO ?? '-';

  switch (roleKey) {
    case 'captain':
      return `${pos} ${d}${name} (${isTrue(player.Captaincy) ? 'Capitanía · ' : ''}OVR: ${ovr})`;
    case 'shortFK':
      return `${pos} ${d}${name} (BP: ${pk} · Efecto: ${curl})`;
    case 'longFK':
      return `${pos} ${d}${name} (BP: ${pk} · Potencia: ${kp})`;
    case 'leftCorner':
    case 'rightCorner':
    case 'secondKicker':
      return `${pos} ${d}${name} (BP: ${pk} · Efecto: ${curl} · ${footLabel})`;
    case 'penalty':
      return `${pos} ${d}${name} (${isTrue(player.PenaltySpecialist) ? 'Especialista en penales · ' : ''}BP: ${pk})`;
    case 'header1':
    case 'header2':
    case 'header3':
      return `${pos} ${d}${name} (${isTrue(player.HeadingSpecial) ? 'Cabeceador · ' : ''}Cab: ${head} · Salto: ${jump}${height ? ' · ' + height : ''})`;
    default:
      return `${pos} ${d}${name} (OVR: ${ovr})`;
  }
}

const ROLE_CONFIGS = [
  { key: 'captain', label: 'Capitán', icon: Crown, statLabel: 'Habilidad de capitanía · Media' },
  { key: 'shortFK', label: 'Tiro libre corto', icon: Target, statLabel: 'Balón parado · Efecto' },
  { key: 'longFK', label: 'Tiro libre largo', icon: Rocket, statLabel: 'Balón parado · Potencia' },
  { key: 'leftCorner', label: 'Córner izquierdo', icon: Target, statLabel: 'Balón parado · Efecto · Pie' },
  { key: 'rightCorner', label: 'Córner derecho', icon: Target, statLabel: 'Balón parado · Efecto · Pie' },
  { key: 'penalty', label: 'Penales', icon: Shield, statLabel: 'Balón parado' },
  { key: 'secondKicker', label: 'Segundo tirador', icon: Users, statLabel: 'Balón parado · Efecto · Pie' },
  { key: 'header1', label: 'Rematador al cabeceo 1', icon: Activity, statLabel: 'Cabeceo · Salto · Altura' },
  { key: 'header2', label: 'Rematador al cabeceo 2', icon: Activity, statLabel: 'Cabeceo · Salto · Altura' },
  { key: 'header3', label: 'Rematador al cabeceo 3', icon: Activity, statLabel: 'Cabeceo · Salto · Altura' },
];

export const RolesPanel = memo(function RolesPanel({ starterPlayers, setPieces, onSetPieceChange, dorsals }) {
  if (!starterPlayers || starterPlayers.length === 0) {
    return (
      <div className="p-6 text-center text-ink-3 text-sm">
        Poné jugadores titulares en la cancha para poder asignar los roles de balón parado y capitanía.
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-3 lg:p-4 custom-scrollbar pb-20 lg:pb-4">
      <p className="text-xs text-ink-3 leading-relaxed mb-1">
        Quién patea las pelotas paradas y quién es el capitán. Se guarda en <span className="text-ink-2 font-mono">Formation.csv</span>.
      </p>
      {ROLE_CONFIGS.map(({ key, label, icon: Icon, statLabel }) => (
        <div key={key} className="py-3 space-y-2 border-b border-line/[0.07] last:border-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
              <Icon className="w-3.5 h-3.5 text-ink-3" aria-hidden="true" />
              {label}
            </span>
            <span className="text-2xs text-ink-3">{statLabel}</span>
          </div>
          <select
            aria-label={label}
            value={setPieces[key] || ''}
            onChange={(e) => onSetPieceChange(key, e.target.value)}
            className="select min-h-9 text-sm"
          >
            <option value="">Automático</option>
            {starterPlayers.map((player) => (
              <option key={player.Id} value={player.Id}>{formatRolePlayerOption(player, key, dorsals)}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
});
