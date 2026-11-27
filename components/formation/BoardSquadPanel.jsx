import React from 'react';
import { Move, Wand2, Users } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState.jsx';
import { SquadSection, SquadRow } from './SquadList.jsx';
import { TeamStrength } from './TeamStrength.jsx';
import { BenchRule } from './BenchRule.jsx';

/** What a tap does now: pick a player, or where the player in hand can go. */
export function HoldingBanner({ holdingPlayer, onBench, onCancel }) {
  const heldName = holdingPlayer?.player.Name;
  const text = !holdingPlayer
    ? 'Tocá un jugador para moverlo. Un suplente entra en el puesto que elijas.'
    : holdingPlayer.from === 'slot'
      ? `Moviendo a ${heldName}: tocá otro puesto o un suplente para cambiarlos.`
      : `Moviendo a ${heldName}: tocá un puesto de la cancha o un titular para que entre.`;
  return (
    <div className={`px-4 py-2.5 border-b border-line/[0.08] ${holdingPlayer ? 'bg-accent/10' : ''}`}>
      <div role="status">
        <p key={text} className="status-swap items-start gap-2 text-sm font-semibold text-ink">
          {holdingPlayer && <Move className="w-4 h-4 mt-0.5 shrink-0 text-accent-soft" aria-hidden="true" />}
          <span>{text}</span>
        </p>
      </div>
      {holdingPlayer && (
        <div className="mt-2 flex flex-wrap gap-2">
          {holdingPlayer.from === 'slot' && (
            <button type="button" onClick={onBench} className="btn btn-secondary btn-sm">Mandar al banco</button>
          )}
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancelar</button>
        </div>
      )}
    </div>
  );
}

function RowControls({ player, dorsal, isAvailable, onDorsalChange, onAvailabilityChange }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="text"
        placeholder="#"
        aria-label={`Dorsal de ${player.Name}`}
        inputMode="numeric"
        className="w-11 h-11 bg-surface text-center text-ink font-display text-base font-semibold num rounded-md border border-line/55 focus:border-accent outline-none"
        value={dorsal || ''}
        onChange={e => onDorsalChange(player.Id, e.target.value)}
        maxLength={2}
        title="Dorsal"
      />
      <button
        type="button"
        onClick={() => onAvailabilityChange(player.Id, !isAvailable)}
        aria-pressed={!isAvailable}
        className={`h-11 min-w-11 px-2 text-xs font-semibold rounded-md border transition-colors ${isAvailable ? 'bg-success/[0.12] text-success-soft border-success/30' : 'bg-danger/[0.12] text-danger-soft border-danger/30'}`}
        title="Disponibilidad para la próxima fecha"
      >
        <span className="sr-only">{player.Name}: </span>{isAvailable ? 'OK' : 'Baja'}
      </button>
    </div>
  );
}

/**
 * PES game plan: the XI in kick-off order (each row is the same as its marker on the pitch), then the bench.
 * With no players yet it points to the Mercado instead (audit PIZ-3).
 */
export function BoardSquadPanel({
  cart, starterRows, substitutes, strengthStarters, bench, holdingPlayer, slotCount, dorsals, availability,
  isFranchise, onSlotClick, onPlayerClick, onAutoLineup, onDorsalChange, onAvailabilityChange, onOpenMarket,
}) {
  if (cart.length === 0) {
    return (
      <div className="flex-grow overflow-y-auto px-3 py-6 lg:px-4">
        <EmptyState
          icon={Users}
          title="Todavía no tenés jugadores"
          description="Fichá en el Mercado y tus jugadores aparecen acá para armar el once."
          actionLabel={onOpenMarket ? 'Ir al Mercado' : undefined}
          onAction={onOpenMarket}
        />
      </div>
    );
  }
  const heldName = holdingPlayer?.player.Name;
  const heldFromSlotId = holdingPlayer?.from === 'slot' ? String(holdingPlayer.player.Id) : null;
  const controls = player => (
    <RowControls player={player} dorsal={dorsals[player.Id]} isAvailable={availability[player.Id] !== false}
      onDorsalChange={onDorsalChange} onAvailabilityChange={onAvailabilityChange} />
  );
  const starterCount = strengthStarters.length;
  return (
    <div className="flex-grow overflow-y-auto px-3 pt-3 lg:px-4 custom-scrollbar pb-20 lg:pb-4">
      <TeamStrength starters={strengthStarters} className="px-1 pb-1" />
      <BenchRule check={bench} className="px-1 pt-2 pb-1" />
      <SquadSection
        title="Titulares"
        count={starterCount}
        hint={starterCount === 0 ? 'Armalo solo o tocá un suplente y después su puesto' : 'Puestos al inicio del partido'}
        action={starterCount < slotCount && substitutes.length > 0 && !holdingPlayer ? (
          <button type="button" onClick={onAutoLineup} className={`btn btn-sm ${starterCount === 0 ? 'btn-primary' : 'btn-secondary'}`}>
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            {starterCount === 0 ? 'Armar el once' : 'Completar el once'}
          </button>
        ) : null}
      >
        {starterRows.map(({ index, role, player }) => {
          const isHeldHere = holdingPlayer?.from === 'slot' && holdingPlayer.fromSlotIndex === index;
          const label = holdingPlayer && !isHeldHere
            ? `Poner a ${heldName} de ${role}${player ? ` en lugar de ${player.Name}` : ''}`
            : player ? `${isHeldHere ? 'Soltar' : 'Mover'} a ${player.Name} (${role})` : undefined;
          return (
            <SquadRow
              key={index}
              isToggle
              showPhoto={false}
              isFranchise={isFranchise(player)}
              role={role}
              player={player}
              isUnavailable={player ? availability[player.Id] === false : false}
              isSelected={isHeldHere}
              onSelect={() => onSlotClick(index)}
              selectLabel={label}
              disabledReason={!player && !holdingPlayer ? 'Elegí primero un suplente para este puesto' : undefined}
              trailing={player ? controls(player) : null}
            />
          );
        })}
      </SquadSection>
      <SquadSection title="Suplentes" count={substitutes.length} hint="Van al banco automáticamente">
        {substitutes.map(player => (
          <SquadRow
            key={player.Id}
            isToggle
            showPhoto={false}
            isFranchise={isFranchise(player)}
            role={player.POS_NOMBRE}
            player={player}
            isUnavailable={availability[player.Id] === false}
            isSelected={holdingPlayer?.from === 'list' && holdingPlayer.player.Id === player.Id}
            onSelect={() => onPlayerClick(player)}
            selectLabel={heldFromSlotId ? `Poner a ${player.Name} en lugar de ${heldName}` : `Mover a ${player.Name}`}
            trailing={controls(player)}
          />
        ))}
      </SquadSection>
      {substitutes.length === 0 && (
        <p className="text-ink-3 text-sm text-center py-4">Todos tus jugadores están en la cancha.</p>
      )}
    </div>
  );
}
