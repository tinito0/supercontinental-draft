import React, { useState, useEffect, useCallback, memo, useMemo, useReducer, useRef } from 'react';
import { X, ClipboardList, Target, Users, Sliders, ArrowLeft } from 'lucide-react';
import { Pitch } from './Pitch.jsx';
import { BaseModal } from './ui/BaseModal.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Alert } from './ui/Alert.jsx';
import { confirmAction } from './ui/ConfirmDialog.jsx';
import { FORMATIONS, DEFAULT_TACTICS } from '../utils/constants.js';
import { formationReducer, initialFormationState } from '../utils/lineupReducer.js';
import { checkBench, formatAverage } from '../utils/squadRules.js';
import { useSquadRulesConfig } from '../hooks/useSquadRulesConfig.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useLineupSave } from '../hooks/useLineupSave.js';
import { useBoardShare } from '../hooks/useBoardShare.js';
import { useUnsavedGuardHost, UnsavedGuardContext } from '../hooks/useUnsavedGuard.js';
import { LEAVE_CONFIRM } from '../utils/unsavedGuard.js';
import { TacticsPanel, RolesPanel } from './formation/StrategyPanels.jsx';
import { BoardSquadPanel, HoldingBanner } from './formation/BoardSquadPanel.jsx';
import { ShareControl } from './formation/ShareControl.jsx';
import { SaveStatusLine, SaveNowButton, SaveProblem, DirtyReporter } from './formation/SaveStatus.jsx';
import { SAVE_STATUS, isBoardDirty, droppedStartersMessage, stateEditCount } from './formation/boardSaveState.js';
import { buildSharedFormation } from './formation/sharedSnapshot.js';
import {
  normalizeFormationStates, layoutForState, moveSlot, setFluid, copyBaseTo, resetState,
  serializeFormationStates, effectiveState, setSlotRole, applyFormationToState, formationKeyForState, TACTICAL_STATES,
  isGoalkeeperSlot, formationSignature,
} from '../utils/formationStates.js';
import { roleUnavailableReason } from '../utils/positionRules.js';
import { normalizeAdvancedInstructions, toggleInstruction, replaceInstruction } from '../utils/advancedInstructions.js';
import { TacticalStateBar } from './formation/TacticalStateBar.jsx';
import { AdvancedInstructionsPanel } from './formation/AdvancedInstructionsPanel.jsx';
import { PositionPicker } from './formation/PositionPicker.jsx';
import { autoLineup } from '../utils/autoLineup.js';

const playerId = player => String(player?.Id ?? player?.id ?? player?.playerId ?? '');

// The pitch is the largest 3:4 box that fits the area left under the controls, never narrower than 13rem
// (audit PIZ-9: at 360x640 it used to start below the fold).
const PITCH_BOX_STYLE = { aspectRatio: '3 / 4', width: 'max(13rem, min(100cqw, 75cqh))' };

export const FormationModal = memo(function FormationModal({ isVisible, isPage, onClose, onOpenMarket, cart, userProfile, userId, showStatusMessage, db }) {
  const [{ lineup, holdingPlayer }, dispatchFormation] = useReducer(formationReducer, initialFormationState);
  const { benchMin } = useSquadRulesConfig();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const guard = useUnsavedGuardHost();
  const teamId = userId || userProfile?.userId;
  const [dorsals, setDorsals] = useState({});
  const [availability, setAvailability] = useState({});
  const hasLoadedRef = useRef(false);
  const [mobileTab, setMobileTab] = useState(() => (cart?.length ? 'pitch' : 'squad'));
  const [setPieces, setSetPieces] = useState(() => (userProfile?.setPieces ? { ...userProfile.setPieces } : {}));
  const [tactics, setTactics] = useState(() => (userProfile?.tactics ? { ...DEFAULT_TACTICS, ...userProfile.tactics } : DEFAULT_TACTICS));
  // Inicio de partido / Con pelota / Sin pelota: per-state marker positions (utils/formationStates.js)
  const [formationStates, setFormationStates] = useState(() => {
    const key = userProfile?.formation || '4-3-3';
    return normalizeFormationStates(userProfile?.formationStates, key, FORMATIONS[key]);
  });
  // The team's formation lives in formationStates only, so the selector, the pitch and the save always agree.
  const selectedFormation = formationStates.formation;
  const formationDef = FORMATIONS[selectedFormation] || FORMATIONS['4-3-3'];
  const [activeState, setActiveState] = useState('base');
  // "Cambiar posiciones": tapping a marker picks it for a role change instead of picking up the player.
  const [roleMode, setRoleMode] = useState(false);
  const [roleSlot, setRoleSlot] = useState(null);
  const [roleNotice, setRoleNotice] = useState(null);
  const [advanced, setAdvanced] = useState(() => normalizeAdvancedInstructions(userProfile?.advancedInstructions));
  const [sidebarTab, setSidebarTab] = useState('players');
  const [benchTick, setBenchTick] = useState(0);

  // The saved board as it is in the profile document. Applied when the board opens, and again when another
  // device changes it while nothing is pending here (see the effect after the save hook).
  const appliedProfileRef = useRef(null);
  const applyProfile = useCallback(profile => {
    appliedProfileRef.current = formationSignature(profile);
    const formationKey = profile.formation || '4-3-3';
    setFormationStates(normalizeFormationStates(profile.formationStates, formationKey, FORMATIONS[formationKey]));
    setAdvanced(normalizeAdvancedInstructions(profile.advancedInstructions));
    dispatchFormation({ type: 'LOAD', payload: { lineup: profile.lineup ? { ...profile.lineup } : {} } });
    setDorsals(profile.dorsals ? { ...profile.dorsals } : {});
    setSetPieces(profile.setPieces ? { ...profile.setPieces } : {});
    setTactics(profile.tactics ? { ...DEFAULT_TACTICS, ...profile.tactics } : DEFAULT_TACTICS);
    setAvailability(profile.availability ? { ...profile.availability } : {});
  }, []);

  useEffect(() => {
    if (!isVisible && !isPage) {
      hasLoadedRef.current = false;
      return;
    }
    if (!hasLoadedRef.current && userProfile) {
      hasLoadedRef.current = true;
      setActiveState('base');
      applyProfile(userProfile);
    }
  }, [isVisible, isPage, userProfile, applyProfile]);

  // Only ids still in the squad (robust to the several id spellings in old data).
  const sanitizeLineup = useCallback(sourceLineup => {
    if (!sourceLineup || typeof sourceLineup !== 'object') return {};
    const validIds = new Set((cart || []).map(playerId));
    return Object.fromEntries(Object.entries(sourceLineup).filter(([, id]) => id && validIds.has(String(id))).map(([slot, id]) => [slot, String(id)]));
  }, [cart]);

  // Roles as played at kick-off (Inicio de partido): the squad list, the set-piece panel and the exports use them.
  const kickoffLayout = useMemo(() => layoutForState(formationDef, formationStates, 'base'), [formationDef, formationStates]);

  const starterPlayers = useMemo(() => {
    const clean = sanitizeLineup(lineup);
    return kickoffLayout.flatMap((slot, index) => {
      const player = clean[index] && (cart || []).find(pl => playerId(pl) === clean[index]);
      return player ? [{ ...player, slotIndex: index, slotPos: slot.pos }] : [];
    });
  }, [lineup, kickoffLayout, cart, sanitizeLineup]);

  useEffect(() => {
    if (!cart?.length || (!isVisible && !isPage)) return;
    dispatchFormation({ type: 'SANITIZE', payload: { cart } });
  }, [cart, isVisible, isPage]);

  // A taker who left the XI is cleared from the set pieces.
  useEffect(() => {
    if (!starterPlayers.length) return;
    const validStarterIds = new Set(starterPlayers.map(playerId));
    setSetPieces(prev => {
      const stale = Object.entries(prev).filter(([, id]) => id && !validStarterIds.has(String(id)));
      return stale.length ? { ...prev, ...Object.fromEntries(stale.map(([role]) => [role, ''])) } : prev;
    });
  }, [starterPlayers]);

  // ── Saving (audit REG-1, PIZ-1, PIZ-5): through the market function, never with matchBench ──
  const buildPayload = () => {
    const squadIds = new Set((cart || []).map(playerId));
    return {
      lineup: sanitizeLineup(lineup),
      formation: selectedFormation,
      dorsals: Object.fromEntries(Object.entries(dorsals || {}).filter(([id]) => squadIds.has(String(id)))),
      setPieces: setPieces || {},
      tactics: tactics || DEFAULT_TACTICS,
      formationStates: serializeFormationStates(formationStates),
      advancedInstructions: normalizeAdvancedInstructions(advanced),
      availability,
    };
  };
  const handleSaved = useCallback(result => {
    // What this device saved comes back in the profile snapshot: it is not a remote change.
    appliedProfileRef.current = formationSignature(result.saved);
    const notice = droppedStartersMessage(result.dropped, cart);
    if (!notice) return;
    const dropped = new Set(result.dropped.map(String));
    dispatchFormation({ type: 'SANITIZE', payload: { cart: (cart || []).filter(p => !dropped.has(playerId(p))) } });
    showStatusMessage?.('error', notice);
  }, [cart, showStatusMessage]);
  const save = useLineupSave({
    buildPayload, cart, benchMin, showStatusMessage, onSaved: handleSaved,
    changeDeps: [lineup, formationStates, setPieces, tactics, advanced, dorsals, availability, benchTick],
  });
  const { markPending, isBusy, status: saveStatus } = save;

  // Another device (or tab) saved the board: take its version while nothing here is unsaved or in hand.
  // Our own saves come back identical and are skipped.
  useEffect(() => {
    if (!hasLoadedRef.current || !userProfile) return;
    if (isBusy() || holdingPlayer || isBoardDirty(saveStatus)) return;
    if (formationSignature(userProfile) === appliedProfileRef.current) return;
    applyProfile(userProfile);
  }, [userProfile, saveStatus, holdingPlayer, applyProfile, isBusy]);

  // ── Public link (audit PIZ-8, PIZ-10): it shows the saved board, so it saves first ──
  const share = useBoardShare({
    db, teamId, showStatusMessage, beforeShare: save.flush,
    buildSnapshot: () => buildSharedFormation({
      formationStates, lineup: sanitizeLineup(lineup), cart, dorsals, availability,
      teamName: userProfile?.teamName, logoUrl: userProfile?.logoUrl, teamId,
    }),
  });

  // ── Edits. A starter held in hand is out of the lineup until placed: each edit puts him back first. ──
  const editStates = useCallback(update => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    markPending();
    setFormationStates(update);
  }, [markPending]);

  const shownState = effectiveState(formationStates, activeState);
  const shownStateLabel = TACTICAL_STATES.find(st => st.id === shownState)?.label;
  const movedCount = stateEditCount(formationStates, shownState);

  // Restablecer, Copiar de Inicio and a new formation replace what was arranged in the shown state: ask first (PIZ-4).
  const confirmReplace = useCallback(async (title, message, confirmLabel) => {
    if (movedCount === 0) return true;
    return confirmAction({ title, message, confirmLabel, cancelLabel: 'Cancelar', tone: 'danger' });
  }, [movedCount]);

  const handleSetPieceChange = useCallback((roleKey, id) => {
    markPending();
    setSetPieces(prev => ({ ...prev, [roleKey]: id }));
  }, [markPending]);
  const handleTacticsChange = useCallback((key, value) => {
    markPending();
    setTactics(prev => ({ ...prev, [key]: value }));
  }, [markPending]);
  const handleSlotMove = useCallback((index, position) => {
    editStates(prev => moveSlot(prev, activeState, index, position, formationDef));
  }, [editStates, activeState, formationDef]);
  const previewSlotRole = useCallback((index, position) => (
    layoutForState(formationDef, moveSlot(formationStates, activeState, index, position, formationDef), activeState)[index]?.pos
  ), [formationStates, activeState, formationDef]);
  const handleFluidChange = useCallback(on => {
    editStates(prev => setFluid(prev, on));
    setActiveState(on ? 'withBall' : 'base');
  }, [editStates]);
  const handleStateSelect = useCallback(id => {
    setActiveState(prev => (effectiveState(formationStates, id) === id ? id : prev));
  }, [formationStates]);
  const handleCopyBase = useCallback(async () => {
    const ok = await confirmReplace(`¿Copiar Inicio en «${shownStateLabel}»?`,
      `Las posiciones y roles que acomodaste en «${shownStateLabel}» se reemplazan por los de Inicio de partido.`, 'Copiar de Inicio');
    if (ok) editStates(prev => copyBaseTo(prev, activeState));
  }, [confirmReplace, shownStateLabel, editStates, activeState]);
  const handleResetState = useCallback(async () => {
    const ok = await confirmReplace(`¿Restablecer «${shownStateLabel}»?`,
      `Se borran las posiciones y roles que acomodaste en «${shownStateLabel}» y vuelve la formación tal cual.`, 'Restablecer');
    if (ok) editStates(prev => resetState(prev, effectiveState(prev, activeState)));
  }, [confirmReplace, shownStateLabel, editStates, activeState]);
  // A formation chosen applies to the state being edited (Inicio = the team's formation). The players stay.
  const handleFormationChange = useCallback(async key => {
    const ok = await confirmReplace(`¿Cambiar a ${FORMATIONS[key]?.name || key}?`,
      `Las posiciones y roles que acomodaste en «${shownStateLabel}» se reemplazan por los de la nueva formación. Los titulares quedan.`, 'Cambiar formación');
    if (ok) editStates(prev => applyFormationToState(prev, activeState, key, FORMATIONS));
  }, [confirmReplace, shownStateLabel, editStates, activeState]);

  const handleRoleModeChange = useCallback(on => {
    setRoleMode(on);
    setRoleSlot(null);
    setRoleNotice(null);
    if (on) dispatchFormation({ type: 'CANCEL_HOLD' });
  }, []);
  const handleRoleSlotClick = useCallback(index => {
    const slot = FORMATIONS[selectedFormation]?.layout?.[index];
    if (!slot) return;
    if (isGoalkeeperSlot(slot)) {
      setRoleSlot(null);
      setRoleNotice('El arquero siempre juega de PT: su posición no cambia.');
      return;
    }
    setRoleNotice(null);
    setRoleSlot(prev => (prev === index ? null : index));
  }, [selectedFormation]);
  const handleRoleChange = useCallback(role => {
    if (roleSlot == null) return;
    const at = layoutForState(formationDef, formationStates, activeState)[roleSlot];
    const reason = roleUnavailableReason(role, at);
    if (reason) { setRoleNotice(reason); return; }
    setRoleNotice(null);
    if (at.pos === role) return;
    markPending();
    setFormationStates(prev => setSlotRole(prev, activeState, roleSlot, role, formationDef));
  }, [roleSlot, formationDef, formationStates, activeState, markPending]);

  const handleInstructionToggle = useCallback((side, code) => {
    const { rejected } = toggleInstruction(advanced, side, code);
    if (rejected) return;
    markPending();
    setAdvanced(prev => toggleInstruction(prev, side, code).next);
  }, [advanced, markPending]);
  const handleInstructionReplace = useCallback((side, index, code) => {
    markPending();
    setAdvanced(prev => replaceInstruction(prev, side, index, code));
  }, [markPending]);

  const handleDorsalChange = useCallback((id, value) => {
    if (!/^\d*$/.test(value) || (dorsals[id] ?? '') === value) return;
    markPending();
    setDorsals(prev => ({ ...prev, [id]: value }));
  }, [dorsals, markPending]);
  const handleAvailabilityChange = useCallback((id, isAvailable) => {
    if ((availability[id] !== false) === isAvailable) return;
    markPending();
    setAvailability(prev => ({ ...prev, [id]: isAvailable }));
  }, [availability, markPending]);

  const stateFormation = useMemo(() => ({ ...formationDef, layout: layoutForState(formationDef, formationStates, shownState) }), [formationDef, formationStates, shownState]);
  const assignedIds = useMemo(() => new Set(Object.values(lineup).filter(Boolean).map(String)), [lineup]);
  // Substitutes: the squad minus the starters. A starter in hand stays in his row of «Titulares», not here.
  const heldFromSlotId = holdingPlayer?.from === 'slot' ? String(holdingPlayer.player.Id) : null;
  const substitutes = useMemo(() => cart
    .filter(p => !assignedIds.has(String(p.Id)) && String(p.Id) !== heldFromSlotId)
    .sort((a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO), [cart, assignedIds, heldFromSlotId]);
  const starterRows = useMemo(() => kickoffLayout.map((slot, index) => {
    const id = holdingPlayer?.from === 'slot' && holdingPlayer.fromSlotIndex === index ? String(holdingPlayer.player.Id) : lineup[index];
    return { index, role: slot.pos, player: id ? cart.find(p => String(p.Id) === String(id)) : null };
  }), [kickoffLayout, lineup, holdingPlayer, cart]);
  const strengthStarters = useMemo(() => starterRows.filter(row => row.player).map(row => ({ pos: row.role, ovr: row.player.OVR_CALCULADO })), [starterRows]);
  // The bench rule for the lineup on the board right now (the saved one may be older).
  const currentBench = useMemo(() => checkBench(cart || [], sanitizeLineup(lineup), { benchMin }), [cart, lineup, sanitizeLineup, benchMin]);

  const handlePlayerClick = useCallback(player => {
    // A starter in hand and a substitute picked: a substitution, saved like a placement on the pitch.
    if (holdingPlayer?.from === 'slot') markPending();
    dispatchFormation({ type: 'PICK_FROM_LIST', payload: { player } });
    // Phones: a substitute taken in hand is placed on the pitch, so show it.
    if (holdingPlayer?.from !== 'slot' && holdingPlayer?.player.Id !== player.Id) setMobileTab('pitch');
  }, [holdingPlayer, markPending]);
  // The lineup already lacks the starter in hand, so nothing else changes: the tick starts the autosave.
  const handleBenchHeld = useCallback(() => {
    markPending();
    dispatchFormation({ type: 'DROP_HELD' });
    setBenchTick(tick => tick + 1);
  }, [markPending]);
  // «Armar el once»: fills the empty slots with the best available players; the ones already placed stay.
  const handleAutoLineup = useCallback(() => {
    const next = autoLineup(kickoffLayout, (cart || []).filter(p => availability[p.Id] !== false), lineup);
    if (Object.keys(next).length === Object.keys(lineup).length) return;
    markPending();
    dispatchFormation({ type: 'LOAD', payload: { lineup: next } });
  }, [cart, availability, kickoffLayout, lineup, markPending]);
  const onSlotClick = useCallback(index => {
    if (holdingPlayer) markPending();
    dispatchFormation({ type: 'CLICK_SLOT', payload: { index, cart } });
  }, [cart, holdingPlayer, markPending]);

  // Closing saves what is pending (T-3, PIZ-5). If it still is not saved, ask before losing it.
  const requestClose = useCallback(async () => {
    if (!(await save.flush())) {
      const confirmed = currentBench.applies && !currentBench.ok
        ? await confirmAction({
          title: '¿Cerrar sin guardar el once?',
          message: `Tu banco promedia ${formatAverage(currentBench.average)} y el mínimo es ${currentBench.min}, así que este once no se guarda. Si cerrás, queda la última alineación válida.`,
          confirmLabel: 'Cerrar sin guardar', cancelLabel: LEAVE_CONFIRM.cancelLabel, tone: 'danger',
        })
        : await confirmAction({ ...LEAVE_CONFIRM, tone: 'danger' });
      if (!confirmed) return;
    }
    onClose?.();
  }, [save, currentBench, onClose]);

  if (!isVisible && !isPage) return null;

  const isFranchise = player => player != null && userProfile?.franchisePlayerId != null && String(userProfile.franchisePlayerId) === String(player.Id);
  const holdingBanner = (
    <HoldingBanner holdingPlayer={holdingPlayer} onBench={handleBenchHeld} onCancel={() => dispatchFormation({ type: 'CANCEL_HOLD' })} />
  );
  const squadPanel = (
    <BoardSquadPanel cart={cart} starterRows={starterRows} substitutes={substitutes} strengthStarters={strengthStarters}
      bench={currentBench} holdingPlayer={holdingPlayer} slotCount={kickoffLayout.length} dorsals={dorsals} availability={availability}
      isFranchise={isFranchise} onSlotClick={onSlotClick} onPlayerClick={handlePlayerClick} onAutoLineup={handleAutoLineup}
      onDorsalChange={handleDorsalChange} onAvailabilityChange={handleAvailabilityChange} onOpenMarket={onOpenMarket} />
  );
  const rolesPanel = <RolesPanel starterPlayers={starterPlayers} setPieces={setPieces} onSetPieceChange={handleSetPieceChange} dorsals={dorsals} />;
  const strategyPanel = (
    <TacticsPanel tactics={tactics} onTacticsChange={handleTacticsChange}>
      <AdvancedInstructionsPanel value={advanced} onToggle={handleInstructionToggle} onReplace={handleInstructionReplace} />
    </TacticsPanel>
  );

  const formationLabel = shownState === 'base' ? 'Formación' : `Formación de «${shownStateLabel}»`;
  const formationBar = (
    <div className="px-3 py-2 lg:p-4 shrink-0 border-b border-line/[0.08]">
      {shownState !== 'base' && <label htmlFor="formation-select" className="field-label">{formationLabel}</label>}
      <select id="formation-select" value={formationKeyForState(formationStates, shownState)} onChange={e => handleFormationChange(e.target.value)}
        aria-label={formationLabel} className="select font-semibold w-full">
        {Object.keys(FORMATIONS).map(key => <option key={key} value={key}>{FORMATIONS[key].name}</option>)}
      </select>
    </div>
  );

  const pitchView = (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TacticalStateBar active={shownState} fluid={formationStates.fluid} onSelect={handleStateSelect} onFluidChange={handleFluidChange}
        onCopyBase={handleCopyBase} onReset={handleResetState} movedCount={movedCount}
        roleMode={roleMode} onRoleModeChange={handleRoleModeChange} />
      {roleMode && roleSlot != null && stateFormation.layout?.[roleSlot] && (
        <PositionPicker
          slot={stateFormation.layout[roleSlot]}
          player={cart.find(p => String(p.Id) === String(lineup[roleSlot]))}
          stateLabel={shownStateLabel}
          notice={roleNotice}
          onChange={handleRoleChange}
          onClose={() => { setRoleSlot(null); setRoleNotice(null); }}
        />
      )}
      {roleMode && roleSlot == null && roleNotice && <Alert tone="warning" className="mx-2 lg:mx-4 mt-2">{roleNotice}</Alert>}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 lg:p-4">
        <div className="h-full flex items-start justify-center [container-type:size]">
          <div className="relative max-w-[28rem] lg:max-w-full" style={PITCH_BOX_STYLE}>
            <Pitch
              formation={stateFormation}
              lineup={lineup}
              cart={cart}
              holdingPlayer={holdingPlayer}
              dorsals={dorsals}
              onSlotClick={roleMode ? handleRoleSlotClick : onSlotClick}
              onSlotMove={handleSlotMove}
              previewRole={previewSlotRole}
              roleSlot={roleMode ? roleSlot : null}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // One layout is mounted at a time (PIZ-2): two copies of the board doubled every control for screen readers.
  const desktopLayout = (
    <div className="flex flex-grow overflow-hidden">
      <div className="w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col h-full overflow-hidden border-r border-line/[0.08]">
        {formationBar}
        <div className="px-3 pt-3 shrink-0">
          <Tabs className="w-full [&>button]:flex-1 [&>button]:justify-center" label="Panel lateral" value={sidebarTab} onChange={setSidebarTab} tabs={[
            { id: 'players', label: 'Plantel', icon: Users },
            { id: 'roles', label: 'Roles', icon: Target },
            { id: 'tactics', label: 'Estrategia', icon: Sliders },
          ]} />
        </div>
        {sidebarTab === 'players' ? <>{holdingBanner}{squadPanel}</> : sidebarTab === 'roles' ? rolesPanel : strategyPanel}
      </div>
      {pitchView}
    </div>
  );
  const mobilePanels = {
    pitch: <>{formationBar}{holdingPlayer && holdingBanner}{pitchView}</>,
    squad: <>{cart.length > 0 && holdingBanner}{squadPanel}</>,
    roles: rolesPanel,
    tactics: strategyPanel,
  };
  const mobileLayout = (
    <div className="flex flex-col flex-grow overflow-hidden">
      <div className="shrink-0 px-3 py-2">
        <Tabs className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2" label="Secciones de la táctica" value={mobileTab} onChange={setMobileTab} tabs={[
          { id: 'pitch', label: 'Cancha' },
          { id: 'squad', label: 'Plantel', count: cart.length || null },
          { id: 'roles', label: 'Roles' },
          { id: 'tactics', label: 'Estrategia' },
        ]} />
      </div>
      {mobilePanels[mobileTab]}
    </div>
  );

  const closeButton = isPage ? (
    <button type="button" onClick={requestClose} className="btn btn-secondary btn-icon sm:w-auto sm:px-4" aria-label="Volver a Plantel y finanzas">
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Plantel y finanzas</span>
    </button>
  ) : (
    <button type="button" onClick={requestClose} className="btn btn-ghost btn-icon" aria-label="Cerrar táctica"><X className="w-5 h-5" aria-hidden="true" /></button>
  );

  const content = (
    <UnsavedGuardContext.Provider value={guard.value}>
      <DirtyReporter isDirty={isBoardDirty(saveStatus)} />
      <div className="flex flex-col h-full relative">
        <div className={`relative flex justify-between items-start gap-3 shrink-0 border-b border-line/[0.08] ${isPage ? 'pb-3' : 'px-4 lg:px-5 py-3'}`}>
          <div className="min-w-0">
            {isPage ? (
              <>
                <p className="eyebrow mb-1 truncate">{userProfile?.teamName || 'Mi club'}</p>
                <h1 className="page-title">Táctica</h1>
              </>
            ) : (
              <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-accent-soft" aria-hidden="true" />Táctica
              </h2>
            )}
            <SaveStatusLine status={saveStatus} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SaveNowButton status={saveStatus} onSave={() => save.saveNow()} />
            <ShareControl share={share} />
            {closeButton}
          </div>
        </div>
        <SaveProblem problem={save.problem} onRetry={() => save.saveNow()} isSaving={saveStatus === SAVE_STATUS.saving}
          className={`shrink-0 mt-2 ${isPage ? '' : 'mx-3 lg:mx-4'}`} />
        <div className="flex-grow flex overflow-hidden">{isDesktop ? desktopLayout : mobileLayout}</div>
      </div>
    </UnsavedGuardContext.Provider>
  );

  if (isPage) {
    return <div className="mx-auto w-full max-w-page h-full min-h-[36rem] flex flex-col relative overflow-hidden">{content}</div>;
  }
  return (
    <BaseModal
      isOpen={true}
      onClose={requestClose}
      ariaLabel="Táctica"
      size="2xl"
      showClose={false}
      className="!max-w-7xl !p-0 !bg-surface !h-[100dvh] sm:!h-[90vh]"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      {content}
    </BaseModal>
  );
});
