import React, { useState, useEffect, useCallback, memo, useRef, useMemo, useReducer } from 'react';
import { X, Save, ClipboardList, Move, Share2, Check, Copy, Loader2, Target, Users, Sliders, ArrowLeft, Wand2, LandPlot } from 'lucide-react';
import { writeBatch, addDoc, collection } from 'firebase/firestore';
import { Pitch } from './Pitch.jsx';
import { BaseModal } from './ui/BaseModal.jsx';
import { Tabs } from './ui/Tabs.jsx';
import { Alert } from './ui/Alert.jsx';
import { FORMATIONS, APP_ID, DEFAULT_LOGO, DEFAULT_TACTICS } from '../utils/constants.js';
import { formationReducer, initialFormationState } from '../utils/lineupReducer.js';
import { useStatusSwap } from '../hooks/useStatusSwap.js';
import { SquadSection, SquadRow } from './formation/SquadList.jsx';
import { TeamStrength } from './formation/TeamStrength.jsx';
import { TacticsPanel, RolesPanel } from './formation/StrategyPanels.jsx';
import {
  normalizeFormationStates, resetForFormation, layoutForState, moveSlot, setFluid, copyBaseTo, resetState,
  serializeFormationStates, effectiveState, setSlotRole, applyFormationToState, formationKeyForState, TACTICAL_STATES,
  isGoalkeeperSlot,
  formationSignature,
} from '../utils/formationStates.js';
import { roleUnavailableReason } from '../utils/positionRules.js';
import { normalizeAdvancedInstructions, toggleInstruction, replaceInstruction } from '../utils/advancedInstructions.js';
import { TacticalStateBar } from './formation/TacticalStateBar.jsx';
import { AdvancedInstructionsPanel } from './formation/AdvancedInstructionsPanel.jsx';
import { PositionPicker } from './formation/PositionPicker.jsx';
import { draftUrl } from '../utils/siteRoutes.js';
import { autoLineup } from '../utils/autoLineup.js';

// Wait after the last change before saving on its own (a burst of changes = one write).
const AUTOSAVE_DELAY_MS = 700;

// --- COMPONENTE PRINCIPAL ---

export const FormationModal = memo(function FormationModal({ isVisible, isPage, onClose, cart, userProfile, userId, getPrivateProfileRef, getPublicTeamRef, showStatusMessage, db }) {
  const [{ lineup, holdingPlayer }, dispatchFormation] = useReducer(formationReducer, initialFormationState);
  const [dorsals, setDorsals] = useState({});
  const [availability, setAvailability] = useState({});
  const [matchBench, setMatchBench] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(null); // 'saving' | 'saved' | 'error' | null
  const saveIndicatorTimerRef = useRef(null);
  const pendingAutoSaveRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const [mobileTab, setMobileTab] = useState('pitch'); // 'pitch' | 'squad' | 'tactics'
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const pitchRef = useRef(null);
  const shareTimeoutRef = useRef(null);

  const [setPieces, setSetPieces] = useState(() => userProfile?.setPieces ? { ...userProfile.setPieces } : {});
  const [tactics, setTactics] = useState(() => userProfile?.tactics ? { ...DEFAULT_TACTICS, ...userProfile.tactics } : DEFAULT_TACTICS);
  // Inicio de partido / Con pelota / Sin pelota: per-state marker positions (utils/formationStates.js)
  const [formationStates, setFormationStates] = useState(() => {
    const key = userProfile?.formation || '4-3-3';
    return normalizeFormationStates(userProfile?.formationStates, key, FORMATIONS[key]);
  });
  // The team's formation lives in formationStates only (one source of truth: the selector, the pitch and the save
  // can never disagree about which formation the positions belong to).
  const selectedFormation = formationStates.formation;
  const [activeState, setActiveState] = useState('base');
  // "Cambiar posiciones": tapping a marker picks it for a role change instead of picking up the player.
  const [roleMode, setRoleMode] = useState(false);
  const [roleSlot, setRoleSlot] = useState(null);
  const [roleNotice, setRoleNotice] = useState(null);
  const [advanced, setAdvanced] = useState(() => normalizeAdvancedInstructions(userProfile?.advancedInstructions));
  const [sidebarTab, setSidebarTab] = useState('players'); // 'players' | 'roles' | 'tactics'

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      if (saveIndicatorTimerRef.current) clearTimeout(saveIndicatorTimerRef.current);
    };
  }, []);

  // The saved board as it is in the profile document. Applied when the board opens, and again when another
  // device changes it while nothing is pending here (see the effect after the autosave).
  const appliedProfileRef = useRef(null);
  const applyProfile = useCallback((profile) => {
    appliedProfileRef.current = formationSignature(profile);
    const formationKey = profile.formation || '4-3-3';
    setFormationStates(normalizeFormationStates(profile.formationStates, formationKey, FORMATIONS[formationKey]));
    setAdvanced(normalizeAdvancedInstructions(profile.advancedInstructions));
    dispatchFormation({ type: 'LOAD', payload: { lineup: profile.lineup ? { ...profile.lineup } : {} } });
    setDorsals(profile.dorsals ? { ...profile.dorsals } : {});
    setSetPieces(profile.setPieces ? { ...profile.setPieces } : {});
    setTactics(profile.tactics ? { ...DEFAULT_TACTICS, ...profile.tactics } : DEFAULT_TACTICS);
    setAvailability(profile.availability ? { ...profile.availability } : {});
    setMatchBench(Array.isArray(profile.matchBench) ? profile.matchBench.map(String) : []);
  }, []);

  // Cargar datos al abrir la pizarra
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

  // Utilidad pura: resolución robusta de ID para evitar falsos filtros vacíos
  const sanitizeLineup = useCallback((sourceLineup) => {
    if (!sourceLineup || typeof sourceLineup !== 'object') return {};
    const validIds = new Set((cart || []).map(player => String(player.Id ?? player.id ?? player.playerId ?? '')));
    const cleaned = {};
    Object.entries(sourceLineup).forEach(([slotIndex, playerId]) => {
      const id = String(playerId || '');
      if (id && validIds.has(id)) cleaned[slotIndex] = id;
    });
    return cleaned;
  }, [cart]);

  // Roles as played at kick-off (Inicio de partido), which is what the squad list, the set-piece panel and the
  // exports use.
  const kickoffLayout = useMemo(
    () => layoutForState(FORMATIONS[selectedFormation] || FORMATIONS['4-3-3'], formationStates, 'base'),
    [selectedFormation, formationStates],
  );

  const starterPlayers = useMemo(() => {
    const clean = sanitizeLineup(lineup);
    const list = [];
    kickoffLayout.forEach((slot, index) => {
      const pId = clean[index];
      if (pId) {
        const p = (cart || []).find(pl => String(pl.Id ?? pl.id ?? '') === String(pId));
        if (p) {
          list.push({ ...p, slotIndex: index, slotPos: slot.pos });
        }
      }
    });
    return list;
  }, [lineup, kickoffLayout, cart, sanitizeLineup]);

  useEffect(() => {
    if (!cart?.length || (!isVisible && !isPage)) return;
    dispatchFormation({ type: 'SANITIZE', payload: { cart } });
  }, [cart, isVisible, isPage]);

  // Limpieza automática de IDs huérfanos en setPieces si el jugador ya no está en el 11 inicial
  useEffect(() => {
    if (!starterPlayers || starterPlayers.length === 0) return;
    const validStarterIds = new Set(starterPlayers.map(p => String(p.Id ?? p.id ?? '')));
    setSetPieces(prev => {
      let changed = false;
      const cleaned = { ...prev };
      Object.entries(prev).forEach(([role, pId]) => {
        if (pId && !validStarterIds.has(String(pId))) {
          cleaned[role] = '';
          changed = true;
        }
      });
      return changed ? cleaned : prev;
    });
  }, [starterPlayers]);

  const handleSetPieceChange = useCallback((roleKey, playerId) => {
    setSetPieces(prev => {
      const next = { ...prev, [roleKey]: playerId };
      pendingAutoSaveRef.current = true;
      return next;
    });
  }, []);

  const handleTacticsChange = useCallback((tacticsKey, value) => {
    setTactics(prev => {
      const next = { ...prev, [tacticsKey]: value };
      pendingAutoSaveRef.current = true;
      return next;
    });
  }, []);

  // Every edit of a state or instruction is saved right away, like lineup and strategy changes.
  // A starter held in hand is out of the lineup until placed: every edit that autosaves puts him back first
  // (CANCEL_HOLD is batched with the edit, so the save sees the full lineup).
  const handleSlotMove = useCallback((index, position) => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => moveSlot(prev, activeState, index, position, FORMATIONS[selectedFormation] || FORMATIONS['4-3-3']));
  }, [activeState, selectedFormation]);

  const handleFluidChange = useCallback(on => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => setFluid(prev, on));
    setActiveState(on ? 'withBall' : 'base');
  }, []);

  const handleStateSelect = useCallback(id => {
    setActiveState(prev => (effectiveState(formationStates, id) === id ? id : prev));
  }, [formationStates]);

  const handleCopyBase = useCallback(() => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => copyBaseTo(prev, activeState));
  }, [activeState]);

  const handleResetState = useCallback(() => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => resetState(prev, effectiveState(prev, activeState)));
  }, [activeState]);

  // A formation chosen in the left panel applies to the state being edited (Inicio = the team's formation;
  // Con pelota / Sin pelota = only that state). The lineup is kept: the same players move to the new shape.
  const handleFormationChange = useCallback(key => {
    dispatchFormation({ type: 'CANCEL_HOLD' });
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => applyFormationToState(prev, activeState, key, FORMATIONS));
  }, [activeState]);

  const handleRoleModeChange = useCallback(on => {
    setRoleMode(on);
    setRoleSlot(null);
    setRoleNotice(null);
    if (on) dispatchFormation({ type: 'CANCEL_HOLD' }); // a player in hand goes back where he was
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
    const formationDef = FORMATIONS[selectedFormation] || FORMATIONS['4-3-3'];
    const at = layoutForState(formationDef, formationStates, activeState)[roleSlot];
    const reason = roleUnavailableReason(role, at);
    if (reason) { setRoleNotice(reason); return; }
    setRoleNotice(null);
    if (at.pos === role) return;
    pendingAutoSaveRef.current = true;
    setFormationStates(prev => setSlotRole(prev, activeState, roleSlot, role, formationDef));
  }, [roleSlot, selectedFormation, formationStates, activeState]);

  const handleInstructionToggle = useCallback((side, code) => {
    setAdvanced(prev => {
      const { next, rejected } = toggleInstruction(prev, side, code);
      if (!rejected) pendingAutoSaveRef.current = true;
      return rejected ? prev : next;
    });
  }, []);

  const handleInstructionReplace = useCallback((side, index, code) => {
    pendingAutoSaveRef.current = true;
    setAdvanced(prev => replaceInstruction(prev, side, index, code));
  }, []);

  const handleSaveLineup = useCallback(async (overrideLineup, overrideFormation, overrideSetPieces, overrideTactics) => {
    // Determinar si overrideLineup es un objeto lineup real o un SyntheticEvent de React
    const isLineupObject = Boolean(
      overrideLineup &&
      typeof overrideLineup === 'object' &&
      !('nativeEvent' in overrideLineup) &&
      !('target' in overrideLineup) &&
      !('_reactName' in overrideLineup)
    );

    const lineupToSave = isLineupObject ? sanitizeLineup(overrideLineup) : sanitizeLineup(lineup);
    const formationToSave = (overrideFormation && typeof overrideFormation === 'string') ? overrideFormation : selectedFormation;
    
    // Guardar dorsales de TODO el plantel (titulares + suplentes en cart), no solo el 11 inicial
    const allSquadIds = new Set((cart || []).map(player => String(player.Id ?? player.id ?? player.playerId ?? '')));
    const dorsalsToSave = Object.fromEntries(
      Object.entries(dorsals || {}).filter(([playerId]) => allSquadIds.has(String(playerId)))
    );
    const validSavedIds = new Set(Object.values(lineupToSave).map(String));
    const setPiecesToSave = (overrideSetPieces && typeof overrideSetPieces === 'object') ? overrideSetPieces : (setPieces || {});
    const tacticsToSave = (overrideTactics && typeof overrideTactics === 'object') ? overrideTactics : (tactics || DEFAULT_TACTICS);
    
    setIsSaving(true);
    setSaveIndicator('saving');
    try {
      const targetUserId = userId || userProfile?.userId;
      if (!targetUserId) throw new Error('No se pudo identificar el usuario');
      const profileRef = getPrivateProfileRef(targetUserId);
      const publicRef = getPublicTeamRef(targetUserId);

      const batch = writeBatch(db);
      
      // Banco automático: todos los jugadores de la plantilla que no están en el 11 inicial
      const benchToSave = (cart || [])
        .map(player => String(player.Id ?? player.id ?? player.playerId ?? ''))
        .filter(id => id && !validSavedIds.has(id));

      // Positions belong to a formation shape: if the shape differs they are not saved with it.
      const statesToSave = formationStates.formation === formationToSave ? formationStates : resetForFormation(formationStates, formationToSave);
      const saveData = {
        formation: formationToSave,
        lineup: lineupToSave,
        dorsals: dorsalsToSave,
        setPieces: setPiecesToSave,
        tactics: tacticsToSave,
        formationStates: serializeFormationStates(statesToSave),
        advancedInstructions: normalizeAdvancedInstructions(advanced),
        availability,
        matchBench: benchToSave
      };

      // Cada campo se reemplaza entero: con merge:true los mapas anidados se fusionan y una
      // posición, titular o dorsal quitado nunca se borraba del documento.
      const writeOptions = { mergeFields: Object.keys(saveData) };
      batch.set(profileRef, saveData, writeOptions);
      batch.set(publicRef, saveData, writeOptions);

      await batch.commit();
      // What this device saved comes back in the profile snapshot: it is not a remote change.
      appliedProfileRef.current = formationSignature(saveData);
      
      setSaveIndicator('saved');
      if (saveIndicatorTimerRef.current) clearTimeout(saveIndicatorTimerRef.current);
      saveIndicatorTimerRef.current = setTimeout(() => {
        setSaveIndicator(null);
      }, 2500);

      // Notificar solo si fue guardado manual (clic en botón)
      if (!isLineupObject) {
        showStatusMessage?.('success', 'Plantilla guardada.');
        if (!isPage) onClose?.();
      }
    } catch (e) {
      console.error('Error saving lineup:', e);
      setSaveIndicator('error');
      if (saveIndicatorTimerRef.current) clearTimeout(saveIndicatorTimerRef.current);
      saveIndicatorTimerRef.current = setTimeout(() => {
        setSaveIndicator(null);
      }, 6000);
      showStatusMessage?.('error', 'Error al guardar plantilla: ' + (e?.message || ''));
    } finally {
      setIsSaving(false);
    }
  }, [sanitizeLineup, lineup, selectedFormation, dorsals, setPieces, tactics, formationStates, advanced, availability, cart, userProfile, userId, getPrivateProfileRef, getPublicTeamRef, showStatusMessage, db, isPage, onClose]);

  const handleDorsalChange = useCallback((playerId, value) => {
    if (!/^\d*$/.test(value)) return;
    // Pendiente sólo si cambia: una marca sin cambio de estado quedaba colgada y la próxima
    // actualización (p. ej. al cargar el perfil) disparaba una escritura de más.
    setDorsals(prev => {
      if ((prev[playerId] ?? '') === value) return prev;
      pendingAutoSaveRef.current = true;
      return { ...prev, [playerId]: value };
    });
  }, []);

  const handleAvailabilityChange = useCallback((playerId, isAvailable) => {
    setAvailability(prev => {
      if ((prev[playerId] !== false) === isAvailable) return prev;
      pendingAutoSaveRef.current = true;
      return { ...prev, [playerId]: isAvailable };
    });
  }, []);

  const currentFormation = FORMATIONS[selectedFormation];
  // The pitch shows the selected tactical state: the formation's slots at that state's stored positions.
  const shownState = effectiveState(formationStates, activeState);
  const stateFormation = useMemo(() => (currentFormation ? { ...currentFormation, layout: layoutForState(currentFormation, formationStates, shownState) } : currentFormation), [currentFormation, formationStates, shownState]);
  const shownStateLabel = TACTICAL_STATES.find(st => st.id === shownState)?.label;
  // Edits of the shown state (moved markers and changed roles): what "Restablecer" can undo.
  const movedCount = Object.keys(formationStates.positions[shownState] || {}).length + Object.keys(formationStates.roles?.[shownState] || {}).length;
  // Derive available players from assigned slots, enforcing uniqueness
  const assignedIds = useMemo(() => {
    const ids = new Set();
    Object.values(lineup).filter(Boolean).forEach(id => ids.add(String(id)));
    return ids;
  }, [lineup]);
  // Substitutes: the squad minus the starters. A starter in hand stays in his row of «Titulares», not here.
  const heldFromSlotId = holdingPlayer?.from === 'slot' ? String(holdingPlayer.player.Id) : null;
  const availablePlayers = useMemo(() => {
    const list = cart.filter(p => !assignedIds.has(String(p.Id)) && String(p.Id) !== heldFromSlotId);
    return [...list].sort((a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO);
  }, [cart, assignedIds, heldFromSlotId]);

  // The XI in kick-off order for the squad list and the strength bars. The starter in hand keeps his row.
  const starterRows = useMemo(() => kickoffLayout.map((slot, index) => {
    const id = holdingPlayer?.from === 'slot' && holdingPlayer.fromSlotIndex === index ? String(holdingPlayer.player.Id) : lineup[index];
    return { index, role: slot.pos, player: id ? cart.find(p => String(p.Id) === String(id)) : null };
  }), [kickoffLayout, lineup, holdingPlayer, cart]);
  const strengthStarters = useMemo(
    () => starterRows.filter(row => row.player).map(row => ({ pos: row.role, ovr: row.player.OVR_CALCULADO })),
    [starterRows],
  );

  const handlePlayerClick = useCallback((player) => {
    // A starter in hand and a substitute picked: a substitution, saved like a placement on the pitch.
    if (holdingPlayer?.from === 'slot') {
      pendingAutoSaveRef.current = true;
      dispatchFormation({ type: 'PICK_FROM_LIST', payload: { player } });
      return;
    }
    dispatchFormation({ type: 'PICK_FROM_LIST', payload: { player } });
    // Phones: a substitute taken in hand is placed on the pitch, so show it.
    if (holdingPlayer?.player.Id !== player.Id) setMobileTab('pitch');
  }, [holdingPlayer]);

  // The lineup already lacks the starter in hand, so nothing else changes: the tick triggers the autosave.
  const [benchTick, setBenchTick] = useState(0);
  const handleBenchHeld = useCallback(() => {
    pendingAutoSaveRef.current = true;
    dispatchFormation({ type: 'DROP_HELD' });
    setBenchTick(tick => tick + 1);
  }, []);

  // «Armar el once»: fills the empty slots with the best available players; the ones already placed stay. Saved like any placement.
  const handleAutoLineup = useCallback(() => {
    const playable = (cart || []).filter(p => availability[p.Id] !== false);
    const next = autoLineup(kickoffLayout, playable, lineup);
    if (Object.keys(next).length === Object.keys(lineup).length) return;
    pendingAutoSaveRef.current = true;
    dispatchFormation({ type: 'LOAD', payload: { lineup: next } });
  }, [cart, availability, kickoffLayout, lineup]);

  const onSlotClick = useCallback((index) => {
    // Si había un jugador "en mano", este click va a resultar en una colocación:
    // marcamos la intención de auto-guardar ANTES de despachar, y dejamos que un
    // efecto sobre `lineup` dispare el guardado una vez que el reducer ya resolvió
    // el nuevo estado (en vez de anidar setState como antes).
    if (holdingPlayer) pendingAutoSaveRef.current = true;
    dispatchFormation({ type: 'CLICK_SLOT', payload: { index, cart } });
  }, [cart, holdingPlayer]);

  // Auto-guardado tras una colocación, un movimiento, un cambio de pateador/estrategia, dorsal o disponibilidad.
  // Con debounce: una ráfaga de cambios (flechas del teclado, tipear un dorsal) es una sola escritura. Lo que
  // quede pendiente al cerrar la pizarra se guarda al desmontar.
  const autoSaveTimerRef = useRef(null);
  const saveLatestRef = useRef(null);
  useEffect(() => {
    saveLatestRef.current = () => handleSaveLineup(lineup, selectedFormation, setPieces, tactics);
  });
  useEffect(() => {
    if (!pendingAutoSaveRef.current) return;
    pendingAutoSaveRef.current = false;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      saveLatestRef.current?.();
    }, AUTOSAVE_DELAY_MS);
  }, [lineup, selectedFormation, setPieces, tactics, formationStates, advanced, dorsals, availability, benchTick]);
  useEffect(() => () => {
    if (!autoSaveTimerRef.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    saveLatestRef.current?.();
  }, []);
  const handleManualSave = useCallback(() => {
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    handleSaveLineup();
  }, [handleSaveLineup]);

  // Another device (or tab) saved the board: take its version while this one has nothing pending (no autosave
  // waiting, no save in flight, no player in hand). Before, the board loaded once, and the next autosave here
  // overwrote the other device's changes with this stale copy. Our own saves come back identical and are skipped.
  useEffect(() => {
    if (!hasLoadedRef.current || !userProfile) return;
    if (autoSaveTimerRef.current || pendingAutoSaveRef.current || isSaving || holdingPlayer) return;
    if (formationSignature(userProfile) === appliedProfileRef.current) return;
    applyProfile(userProfile);
  }, [userProfile, isSaving, holdingPlayer, applyProfile]);

  // ── Share URL with popover ──
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const sharingRef = useRef(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers / insecure contexts
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        return true;
      } catch { return false; }
    }
  };

  const handleShareURL = async () => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setIsSharing(true);
    try {
      // Build slot data with player names embedded for public view
      const slotsWithNames = {};
      const currentFormation = FORMATIONS[selectedFormation];
      const cleanLineup = sanitizeLineup(lineup);
      if (currentFormation?.layout) {
        layoutForState(currentFormation, formationStates, 'base').forEach((slot, index) => {
          const playerId = cleanLineup[index];
          if (playerId) {
            const player = cart.find(p => String(p.Id) === playerId);
            if (!player?.Name || !player?.OVR_CALCULADO) return;
            slotsWithNames[index] = {
              playerId,
              name: player.Name,
              pos: slot.pos,
              ovr: player.OVR_CALCULADO,
              dorsal: dorsals[playerId] || '',
            };
          }
        });
      }

      const starterIds = new Set(Object.values(slotsWithNames).map(s => String(s.playerId)));
      const bench = (cart || [])
        .filter(p => !starterIds.has(String(p.Id)))
        .sort((a, b) => (Number(b.OVR_CALCULADO) || 0) - (Number(a.OVR_CALCULADO) || 0))
        .map(player => ({
          playerId: String(player.Id),
          name: player.Name,
          pos: player.POS_NOMBRE,
          ovr: player.OVR_CALCULADO,
          dorsal: dorsals[player.Id] || '',
          available: availability[player.Id] !== false,
        }));

      // Create a public formation snapshot in Firestore
      const sharedRef = collection(db, `artifacts/${APP_ID}/public/data/shared_formations`);
      const snap = await addDoc(sharedRef, {
        teamName: userProfile?.teamName || 'Equipo',
        logoUrl: userProfile?.logoUrl || DEFAULT_LOGO,
        formationKey: selectedFormation,
        formationName: currentFormation?.name || selectedFormation,
        formationStates: serializeFormationStates(formationStates.formation === selectedFormation ? formationStates : resetForFormation(formationStates, selectedFormation)),
        slots: slotsWithNames,
        bench,
        isPublic: true,
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.userId || 'unknown',
      });

      const url = draftUrl(`/tactics/view/${snap.id}`);
      setShareUrl(url);

      const ok = await copyToClipboard(url);
      setShareCopied(ok);
      setShowSharePopover(true);

      // Clear previous timeout
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => {
        setShowSharePopover(false);
        setShareCopied(false);
      }, 8000); // Longer timeout so user can see/copy the URL
    } catch (err) {
      console.error('Error al compartir formación:', err);
      showStatusMessage('error', 'Error al generar el enlace público.');
    }
    sharingRef.current = false;
    setIsSharing(false);
  };

  const handleCopyAgain = async () => {
    const ok = await copyToClipboard(shareUrl);
    setShareCopied(ok);
    // Reset auto-close timer
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    shareTimeoutRef.current = setTimeout(() => {
      setShowSharePopover(false);
      setShareCopied(false);
    }, 3000);
  };

  // Close popover on outside click. The desktop and phone layouts are both mounted (one hidden by CSS), so "inside"
  // is any share area, not one ref: a single ref pointed at the hidden copy and a press on "Copiar" closed the popover.
  useEffect(() => {
    if (!showSharePopover) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest?.('[data-share-area]')) {
        setShowSharePopover(false);
        setShareCopied(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSharePopover]);

  // The autosave status swaps in place: «Guardando…» steps to «Guardado automático» instead of blinking.
  const { shown: shownSaveStatus, isLeaving: isSaveStatusLeaving } = useStatusSwap(saveIndicator);

  if (!isVisible && !isPage) return null;

  /* ── Shared sub-components ── */
  const formationSelectLabel = shownState === 'base' ? 'Formación' : `Formación de ${shownStateLabel}`;
  const renderFormationSelect = (id, className = '') => (
    <select id={id} value={formationKeyForState(formationStates, shownState)} onChange={(e) => handleFormationChange(e.target.value)}
      aria-label={formationSelectLabel} className={`select font-semibold ${className}`}>
      {Object.keys(FORMATIONS).map(key => <option key={key} value={key}>{FORMATIONS[key].name}</option>)}
    </select>
  );
  const SharePopover = showSharePopover && (
    <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] lg:left-0 lg:w-auto panel p-3 z-50 animate-in fade-in slide-in-from-top">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          readOnly
          value={shareUrl}
          aria-label="Enlace público de la alineación"
          className="input flex-1 min-h-9 text-xs font-mono select-all"
          onClick={(e) => e.target.select()}
        />
        <button
          onClick={handleCopyAgain}
          type="button"
          className="btn btn-primary btn-sm shrink-0"
        >
          <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar
        </button>
      </div>
      {shareCopied && (
        <div className="flex items-center gap-1.5 text-success-soft text-xs font-semibold" role="status">
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> Enlace copiado al portapapeles
        </div>
      )}
    </div>
  );
  // The share icon turns into a check once the link is copied (enters like a status swap).
  const ShareIcon = (
    <span key={shareCopied ? 'copied' : 'share'} className="status-swap">
      {shareCopied ? <Check className="w-4 h-4 text-success-soft" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
    </span>
  );
  const saveIcon = isSaving ?<Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />;
  const busyTitle = isSaving ? 'Hay una operación en curso' : undefined;

  const ControlsBar = (
    <div className="p-3 lg:p-4 space-y-3 shrink-0 border-b border-line/[0.08]">
      {shownState !== 'base' && (
        <label htmlFor="formation-select" className="field-label">Formación de «{shownStateLabel}»</label>
      )}
      {renderFormationSelect('formation-select')}
      <button onClick={handleManualSave} disabled={isSaving} title={busyTitle}
        type="button" className="btn btn-primary w-full">
        {saveIcon}{isSaving ? 'Guardando…' : 'Guardar alineación'}
      </button>
      <div className="relative" data-share-area>
        <button onClick={handleShareURL} disabled={isSharing} title={isSharing ? 'Hay una operación en curso' : undefined}
          type="button" className="btn btn-secondary w-full">
          {isSharing ? (
            <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Generando…</>
          ) : (
            <>{ShareIcon} {shareCopied ? 'Enlace copiado' : 'Compartir enlace público'}</>
          )}
        </button>
        {SharePopover}
      </div>
    </div>
  );

  // Phones: one row above the pitch, so the pitch starts near the top of the screen. The bench count is on the
  // "Plantel" tab.
  const CompactControlsBar = (
    <div className="px-3 py-2 shrink-0 border-b border-line/[0.08]">
      {shownState !== 'base' && (
        <label htmlFor="formation-select-compact" className="field-label">Formación de «{shownStateLabel}»</label>
      )}
      <div className="flex items-center gap-2">
        {renderFormationSelect('formation-select-compact', 'flex-1 min-w-0')}
        <button onClick={handleManualSave} disabled={isSaving} title={busyTitle} type="button" className="btn btn-primary shrink-0">
          {saveIcon}{isSaving ? 'Guardando…' : 'Guardar'}
        </button>
        <div className="relative shrink-0" data-share-area>
          <button onClick={handleShareURL} disabled={isSharing} type="button" className="btn btn-secondary btn-icon"
            aria-label={shareCopied ? 'Enlace copiado' : 'Compartir enlace público'} title="Compartir enlace público">
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : ShareIcon}
          </button>
          {SharePopover}
        </div>
      </div>
    </div>
  );

  // The private profile keeps the franchise signing (the market function writes franchisePlayerId).
  const isFranchisePlayer = player => player != null && userProfile?.franchisePlayerId != null && String(userProfile.franchisePlayerId) === String(player.Id);
  const heldName = holdingPlayer?.player.Name;
  const holdingText = !holdingPlayer
    ? 'Tocá un jugador para moverlo. Un suplente entra en el puesto que elijas.'
    : holdingPlayer.from === 'slot'
      ? `Moviendo a ${heldName}: tocá otro puesto o un suplente para cambiarlos.`
      : `Moviendo a ${heldName}: tocá un puesto de la cancha o un titular para que entre.`;
  const HoldingBanner = (
    <div className={`px-4 py-2.5 border-b border-line/[0.08] ${holdingPlayer ? 'bg-accent/10' : ''}`}>
      <div role="status">
        <p key={holdingText} className="status-swap items-start gap-2 text-sm font-semibold text-ink">
          {holdingPlayer && <Move className="w-4 h-4 mt-0.5 shrink-0 text-accent-soft" aria-hidden="true" />}
          <span>{holdingText}</span>
        </p>
      </div>
      {holdingPlayer && (
        <div className="mt-2 flex flex-wrap gap-2">
          {holdingPlayer.from === 'slot' && (
            <button type="button" onClick={handleBenchHeld} className="btn btn-secondary btn-sm">Mandar al banco</button>
          )}
          <button type="button" onClick={() => dispatchFormation({ type: 'CANCEL_HOLD' })} className="btn btn-ghost btn-sm">Cancelar</button>
        </div>
      )}
    </div>
  );

  const renderRowControls = player => {
    const isAvailable = availability[player.Id] !== false;
    return (
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          placeholder="#"
          aria-label={`Dorsal de ${player.Name}`}
          inputMode="numeric"
          className="w-11 h-11 bg-surface text-center text-ink font-display text-base font-semibold num rounded-md border border-line/55 focus:border-accent outline-none"
          value={dorsals[player.Id] || ''}
          onChange={(e) => handleDorsalChange(player.Id, e.target.value)}
          maxLength={2}
          title="Dorsal"
        />
        <button
          type="button"
          onClick={() => handleAvailabilityChange(player.Id, !isAvailable)}
          aria-pressed={!isAvailable}
          className={`h-11 min-w-11 px-2 text-xs font-semibold rounded-md border transition-colors ${isAvailable ? 'bg-success/[0.12] text-success-soft border-success/30' : 'bg-danger/[0.12] text-danger-soft border-danger/30'}`}
          title="Disponibilidad para la próxima fecha"
        >
          <span className="sr-only">{player.Name}: </span>{isAvailable ? 'OK' : 'Baja'}
        </button>
      </div>
    );
  };

  // PES game plan: the XI in kick-off order (each row is the same as its marker on the pitch), then the bench.
  const PlayerList = (
    <div className="flex-grow overflow-y-auto px-3 pt-3 lg:px-4 custom-scrollbar pb-20 lg:pb-4">
      <TeamStrength starters={strengthStarters} className="px-1 pb-1" />
      <SquadSection
        title="Titulares"
        count={strengthStarters.length}
        hint={strengthStarters.length === 0 ? 'Armalo solo o tocá un suplente y después su puesto' : 'Puestos al inicio del partido'}
        action={strengthStarters.length < kickoffLayout.length && availablePlayers.length > 0 && !holdingPlayer ? (
          <button type="button" onClick={handleAutoLineup} className={`btn btn-sm ${strengthStarters.length === 0 ? 'btn-primary' : 'btn-secondary'}`}>
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            {strengthStarters.length === 0 ? 'Armar el once' : 'Completar el once'}
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
              showPhoto={false}
              isFranchise={isFranchisePlayer(player)}
              role={role}
              player={player}
              isUnavailable={player ? availability[player.Id] === false : false}
              isSelected={isHeldHere}
              onSelect={() => onSlotClick(index)}
              selectLabel={label}
              disabledReason={!player && !holdingPlayer ? 'Elegí primero un suplente para este puesto' : undefined}
              trailing={player ? renderRowControls(player) : null}
            />
          );
        })}
      </SquadSection>
      <SquadSection title="Suplentes" count={availablePlayers.length} hint="Van al banco automáticamente">
        {availablePlayers.map(player => (
          <SquadRow
            key={player.Id}
            showPhoto={false}
            isFranchise={isFranchisePlayer(player)}
            role={player.POS_NOMBRE}
            player={player}
            isUnavailable={availability[player.Id] === false}
            isSelected={holdingPlayer?.from === 'list' && holdingPlayer.player.Id === player.Id}
            onSelect={() => handlePlayerClick(player)}
            selectLabel={heldFromSlotId ? `Poner a ${player.Name} en lugar de ${heldName}` : `Mover a ${player.Name}`}
            trailing={renderRowControls(player)}
          />
        ))}
      </SquadSection>
      {availablePlayers.length === 0 && <p className="text-ink-3 text-sm text-center py-4">Todos tus jugadores están en la cancha.</p>}
    </div>
  );

  const PitchView = (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <TacticalStateBar active={shownState} fluid={formationStates.fluid} onSelect={handleStateSelect} onFluidChange={handleFluidChange}
        onCopyBase={handleCopyBase} onReset={handleResetState} movedCount={movedCount}
        roleMode={roleMode} onRoleModeChange={handleRoleModeChange} />
      {roleMode && roleSlot != null && stateFormation?.layout?.[roleSlot] && (
        <PositionPicker
          slot={stateFormation.layout[roleSlot]}
          player={cart.find(p => String(p.Id) === String(lineup[roleSlot]))}
          stateLabel={shownStateLabel}
          notice={roleNotice}
          onChange={handleRoleChange}
          onClose={() => { setRoleSlot(null); setRoleNotice(null); }}
        />
      )}
      {roleMode && roleSlot == null && roleNotice && (
        <Alert tone="warning" className="mx-2 lg:mx-4 mt-2">{roleNotice}</Alert>
      )}
      {/* Phones: the pitch takes the full width and the area scrolls (markers need room to be dragged);
          desktop: the pitch fits the available height. */}
      <div className="flex-1 min-h-0 flex items-start lg:items-center justify-center p-2 lg:p-4 overflow-y-auto lg:overflow-hidden">
        <div className="relative w-full max-w-[28rem] lg:max-w-full lg:w-auto lg:h-full" style={{ aspectRatio: '3/4' }}>
          <Pitch
            pitchRef={pitchRef}
            formation={stateFormation}
            lineup={lineup}
            cart={cart}
            holdingPlayer={holdingPlayer}
            dorsals={dorsals}
            onSlotClick={roleMode ? handleRoleSlotClick : onSlotClick}
            onSlotMove={handleSlotMove}
            roleSlot={roleMode ? roleSlot : null}
          />
        </div>
      </div>
    </div>
  );

  const AdvancedSection = (
    <AdvancedInstructionsPanel value={advanced} onToggle={handleInstructionToggle} onReplace={handleInstructionReplace} />
  );

  const content = (
    <div className="flex flex-col h-full relative">

        {/* ── HEADER ── */}
        <div className={`flex flex-wrap justify-between items-center gap-3 shrink-0 border-b border-line/[0.08] ${isPage ? 'pb-4' : 'px-4 lg:px-5 py-3'}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
            {isPage ? (
              <div>
                <p className="eyebrow mb-1">{userProfile?.teamName || 'Mi club'}</p>
                <h1 className="page-title">Pizarra táctica</h1>
              </div>
            ) : (
              <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-accent-soft" aria-hidden="true" />Pizarra táctica
              </h2>
            )}
            <span role="status" className="text-xs font-medium">
              {shownSaveStatus && (
                <span key={shownSaveStatus} data-leaving={isSaveStatusLeaving || undefined} className={`status-swap items-center gap-1.5 ${
                  shownSaveStatus === 'saving' ? 'text-accent-soft' : shownSaveStatus === 'error' ? 'text-danger-soft' : 'text-success-soft'
                }`}>
                  {shownSaveStatus === 'saving' ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />Guardando…</>
                  ) : shownSaveStatus === 'error' ? (
                    <><X className="w-3.5 h-3.5" aria-hidden="true" />No se pudo guardar</>
                  ) : (
                    <><Check className="w-3.5 h-3.5" aria-hidden="true" />Guardado automático</>
                  )}
                </span>
              )}
            </span>
          </div>
          {isPage ? (
            <button type="button" onClick={onClose} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />Plantel y finanzas
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn btn-ghost btn-icon" aria-label="Cerrar pizarra táctica"><X className="w-5 h-5" aria-hidden="true" /></button>
          )}
        </div>

        {/* ── MOBILE TAB SWITCHER (visible only on < lg) ── */}
        <div className="lg:hidden shrink-0 px-3 py-2.5">
          <Tabs className="w-full [&>button]:flex-1 [&>button]:justify-center" label="Secciones de la pizarra" value={mobileTab} onChange={setMobileTab} tabs={[
            { id: 'pitch', label: 'Cancha', icon: LandPlot },
            { id: 'squad', label: 'Plantel', icon: Users, count: cart.length || null },
            { id: 'roles', label: 'Roles', icon: Target },
            { id: 'tactics', label: 'Táctica', icon: Sliders },
          ]} />
        </div>

        {/* ── CONTENT AREA ── */}
        <div className="flex-grow flex overflow-hidden">

          {/* === DESKTOP LAYOUT (lg+): side-by-side === */}
          <div className="hidden lg:flex flex-grow overflow-hidden">
            {/* Left Panel */}
            <div className="w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col h-full overflow-hidden border-r border-line/[0.08]">
              {ControlsBar}

              <div className="px-3 pt-3 shrink-0">
                <Tabs className="w-full [&>button]:flex-1 [&>button]:justify-center" label="Panel lateral" value={sidebarTab} onChange={setSidebarTab} tabs={[
                  { id: 'players', label: 'Plantel', icon: Users },
                  { id: 'roles', label: 'Roles', icon: Target },
                  { id: 'tactics', label: 'Táctica', icon: Sliders },
                ]} />
              </div>

              {sidebarTab === 'players' ? (
                <>
                  {HoldingBanner}
                  {PlayerList}
                </>
              ) : sidebarTab === 'roles' ? (
                <RolesPanel
                  starterPlayers={starterPlayers}
                  setPieces={setPieces}
                  onSetPieceChange={handleSetPieceChange}
                  dorsals={dorsals}
                />
              ) : (
                <TacticsPanel
                  tactics={tactics}
                  onTacticsChange={handleTacticsChange}
                >{AdvancedSection}</TacticsPanel>
              )}
            </div>
            {/* Right Panel: Pitch */}
            {PitchView}
          </div>

          {/* === MOBILE LAYOUT (< lg): tabbed === */}
          <div className="flex lg:hidden flex-col flex-grow overflow-hidden">
            {mobileTab === 'pitch' ? (
              <>
                {CompactControlsBar}
                {holdingPlayer && HoldingBanner}
                {PitchView}
              </>
            ) : mobileTab === 'squad' ? (
              <>
                {HoldingBanner}
                {PlayerList}
              </>
            ) : mobileTab === 'roles' ? (
              <RolesPanel
                starterPlayers={starterPlayers}
                setPieces={setPieces}
                onSetPieceChange={handleSetPieceChange}
                dorsals={dorsals}
              />
            ) : (
              <TacticsPanel
                tactics={tactics}
                onTacticsChange={handleTacticsChange}
              >{AdvancedSection}</TacticsPanel>
            )}
          </div>

        </div>
      </div>
  );

  if (isPage) {
    return (
      <div className="mx-auto w-full max-w-page h-full min-h-[36rem] flex flex-col relative overflow-hidden">
        {content}
      </div>
    );
  }

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      ariaLabel="Pizarra táctica"
      size="2xl"
      showClose={false}
      className="!max-w-7xl !p-0 !bg-surface !h-[100dvh] sm:!h-[90vh]"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      {content}
    </BaseModal>
  );
});
