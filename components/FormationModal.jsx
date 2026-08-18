import React, { useState, useEffect, useCallback, memo, useRef, useMemo, useReducer } from 'react';
import { X, Save, Image as ImageIcon, ClipboardList, Move, Share2, Check, Copy, Loader2 } from 'lucide-react';
import { writeBatch, addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Pitch } from './Pitch.jsx';
import html2canvas from 'html2canvas';
import { FORMATIONS, APP_ID, DEFAULT_LOGO } from '../utils/constants.js';
import { getPosColorClass, formatPriceShort } from '../utils/helpers.js';

export const FormationPlayerItem = memo(({ player, onClick, isSelected, dorsal, onDorsalChange, isAvailable, onAvailabilityChange, isBench, onBenchChange }) => (
  <div className={`flex items-center space-x-2 p-2 w-full rounded-xl border transition-all duration-200 ${isSelected ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800/40 border-gray-700/50'}`}>
    <button onClick={onClick} className="flex items-center space-x-3 flex-grow text-left">
      <img crossOrigin="anonymous" src={`/fotos_jugadores/${player.Id}.webp`} className="w-10 h-10 object-cover rounded-full bg-gray-900 border border-gray-600" onError={(e) => e.target.src = `https://placehold.co/40x40/374151/e0e0e0?text=${player.Name.substring(0, 1)}`} />
      <div className="min-w-0 flex-grow">
        <div className={`text-sm font-bold truncate ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>{player.Name}</div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-1.5 rounded text-black ${getPosColorClass(player.POS_NOMBRE)}`}>{player.POS_NOMBRE}</span>
          <span className="text-xs text-gray-500">{formatPriceShort(player.Precio)}</span>
        </div>
      </div>
    </button>
    <input
      type="text"
      placeholder="#"
      className="w-10 h-8 bg-black/40 text-center text-white text-sm font-bold rounded border border-gray-600 focus:border-blue-500 outline-none"
      value={dorsal || ''}
      onChange={(e) => onDorsalChange(player.Id, e.target.value)}
      maxLength={2}
    />
    <button type="button" onClick={() => onAvailabilityChange(player.Id, !isAvailable)} className={`min-h-8 rounded px-2 text-[10px] font-black uppercase ${isAvailable ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`} title="Disponibilidad para la próxima fecha">
      {isAvailable ? 'OK' : 'Baja'}
    </button>
    <button type="button" disabled={!isAvailable} onClick={() => onBenchChange(player.Id)} className={`min-h-8 rounded px-2 text-[10px] font-black uppercase disabled:opacity-40 ${isBench ? 'bg-cyan-400 text-slate-950' : 'bg-white/5 text-gray-400'}`} title="Convocar al banco">
      Banco
    </button>
  </div>
));

// --- REDUCER: lineup + holdingPlayer viven juntos y se actualizan en un solo paso puro ---
// (antes: setLineup se llamaba DENTRO del updater de setHoldingPlayer, lo cual es un
// side-effect impuro. React puede re-invocar ese updater más de una vez —siempre pasa
// en Strict Mode— y cada re-invocación volvía a escribir el mismo jugador en el lineup,
// terminando con el mismo playerId pisado en varios slots a la vez).
const initialFormationState = { lineup: {}, holdingPlayer: null };

// Además de sacar jugadores que ya no están en el cart (eso ya lo hacía SANITIZE),
// esto fuerza unicidad: si el mismo playerId aparece en más de un slot (rastro de
// datos viejos, de ANTES de que existiera este reducer, guardados en Firestore
// mientras el bug de duplicación seguía activo), se queda con la PRIMERA
// aparición (por índice de slot, orden numérico) y limpia el resto. Sin esto,
// cargar un lineup ya corrompido lo seguía mostrando corrompido para siempre,
// aunque el bug que lo causó ya esté arreglado.
function dedupeLineup(sourceLineup) {
  const seen = new Set();
  const deduped = {};
  const orderedSlots = Object.entries(sourceLineup || {})
    .sort(([a], [b]) => Number(a) - Number(b));
  orderedSlots.forEach(([slotIndex, playerId]) => {
    const id = String(playerId || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    deduped[slotIndex] = id;
  });
  return deduped;
}

function formationReducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { lineup: dedupeLineup(action.payload?.lineup || {}), holdingPlayer: null };

    case 'RESET':
      return { lineup: {}, holdingPlayer: null };

    case 'SANITIZE': {
      const { cart } = action.payload;
      const validIds = new Set((cart || []).map(p => String(p.Id)));
      const cleaned = {};
      Object.entries(state.lineup || {}).forEach(([slotIndex, playerId]) => {
        const id = String(playerId || '');
        if (id && validIds.has(id)) cleaned[slotIndex] = id;
      });
      const deduped = dedupeLineup(cleaned);
      if (JSON.stringify(deduped) === JSON.stringify(state.lineup)) return state; // sin cambios, misma referencia
      return { ...state, lineup: deduped };
    }

    case 'PICK_FROM_LIST': {
      const { player } = action.payload;
      const holdingPlayer = state.holdingPlayer?.player.Id === player.Id ? null : { player, from: 'list' };
      return { ...state, holdingPlayer };
    }

    case 'CLICK_SLOT': {
      const { index, cart } = action.payload;
      const curr = state.holdingPlayer;
      const newLineup = { ...state.lineup };
      const playerInSlotId = newLineup[index];
      const playerInSlot = cart.find(p => String(p.Id) === String(playerInSlotId));

      if (curr) {
        const placingId = String(curr.player.Id);

        // UNICIDAD: sacar al jugador de cualquier otro slot primero
        Object.keys(newLineup).forEach(key => {
          if (String(newLineup[key]) === placingId && String(key) !== String(index)) {
            delete newLineup[key];
          }
        });

        // Colocar al jugador que se estaba sosteniendo en este slot
        newLineup[index] = placingId;

        if (curr.from === 'slot' && String(curr.fromSlotIndex) !== String(index)) {
          // Swap: el jugador desplazado vuelve al slot de origen
          if (playerInSlot) newLineup[curr.fromSlotIndex] = String(playerInSlot.Id);
          else delete newLineup[curr.fromSlotIndex];
        }

        return { lineup: newLineup, holdingPlayer: null };
      }

      if (playerInSlot) {
        // Levantar jugador del slot
        delete newLineup[index];
        return { lineup: newLineup, holdingPlayer: { player: playerInSlot, from: 'slot', fromSlotIndex: index } };
      }

      return state; // click en slot vacío sin nada en mano: no-op
    }

    default:
      return state;
  }
}

// --- COMPONENTE PRINCIPAL ---

export const FormationModal = memo(function FormationModal({ isVisible, isPage, onClose, cart, userProfile, getPrivateProfileRef, getPublicTeamRef, showStatusMessage, db }) {
  const [selectedFormation, setSelectedFormation] = useState('4-3-3');
  const [{ lineup, holdingPlayer }, dispatchFormation] = useReducer(formationReducer, initialFormationState);
  const [dorsals, setDorsals] = useState({});
  const [availability, setAvailability] = useState({});
  const [matchBench, setMatchBench] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const pendingAutoSaveRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [mobileTab, setMobileTab] = useState('pitch'); // 'pitch' | 'squad'
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const pitchRef = useRef(null);
  const sharePopoverRef = useRef(null);
  const shareTimeoutRef = useRef(null);

  useEffect(() => {
    // Load from userProfile when opening from any context (isVisible OR isPage)
    if (isVisible || isPage) {
      setSelectedFormation(userProfile?.formation || '4-3-3');
      const rawLineup = userProfile?.lineup ? { ...userProfile.lineup } : {};
      // Solo se marca para auto-guardar si el cart ya cargó — si todavía está vacío
      // (ej. la pizarra se abre antes de que llegue el snapshot de Firestore),
      // guardar ahora borraría el lineup entero (sanitizeLineup filtra contra un
      // cart vacío = todo inválido). El efecto de SANITIZE ya reintenta esto solo
      // cuando el cart efectivamente tenga datos.
      if (cart.length > 0 && JSON.stringify(dedupeLineup(rawLineup)) !== JSON.stringify(rawLineup)) {
        pendingAutoSaveRef.current = true;
      }
      dispatchFormation({ type: 'LOAD', payload: { lineup: rawLineup } });
      setDorsals(userProfile?.dorsals ? { ...userProfile.dorsals } : {});
      setAvailability(userProfile?.availability ? { ...userProfile.availability } : {});
      setMatchBench(Array.isArray(userProfile?.matchBench) ? userProfile.matchBench.map(String) : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.formation, userProfile?.lineup, userProfile?.dorsals, isVisible, isPage]);

  // Utilidad pura: no depende de closures sobre el estado del reducer, recibe todo por parámetro.
  const sanitizeLineup = useCallback((sourceLineup) => {
    const validIds = new Set((cart || []).map(player => String(player.Id)));
    const cleaned = {};
    Object.entries(sourceLineup || {}).forEach(([slotIndex, playerId]) => {
      const id = String(playerId || '');
      if (id && validIds.has(id)) cleaned[slotIndex] = id;
    });
    return cleaned;
  }, [cart]);

  useEffect(() => {
    if (!cart.length || (!isVisible && !isPage)) return;
    // Antes de despachar, se chequea acá (no dentro del reducer, que tiene que
    // quedar puro) si la sanitización + deduplicación va a cambiar algo respecto
    // al lineup actual. Si cambia, es porque había datos corruptos (viejos, de
    // antes de este reducer) o jugadores que salieron del cart — en ese caso se
    // marca para auto-guardar, así la corrección queda persistida en Firestore
    // y no vuelve a aparecer la próxima vez que se abra la pizarra.
    const cleaned = sanitizeLineup(lineup);
    const deduped = dedupeLineup(cleaned);
    if (JSON.stringify(deduped) !== JSON.stringify(lineup)) {
      pendingAutoSaveRef.current = true;
    }
    dispatchFormation({ type: 'SANITIZE', payload: { cart } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, isVisible, isPage]);

  const handleSaveLineup = async (overrideLineup, overrideFormation) => {
    // Check if called directly from onClick (React passes the event object)
    const isEvent = overrideLineup && overrideLineup.nativeEvent;
    const lineupToSave = sanitizeLineup((overrideLineup && !isEvent) ? overrideLineup : lineup);
    const formationToSave = (overrideFormation && typeof overrideFormation === 'string') ? overrideFormation : selectedFormation;
    const validSavedIds = new Set(Object.values(lineupToSave).map(String));
    const dorsalsToSave = Object.fromEntries(
      Object.entries(dorsals || {}).filter(([playerId]) => validSavedIds.has(String(playerId)))
    );
    
    setIsSaving(true);
    try {
      if (!userProfile?.userId) throw new Error('No userId');
      const profileRef = getPrivateProfileRef(userProfile.userId);
      const publicRef = getPublicTeamRef(userProfile.userId);

      const batch = writeBatch(db);
      
      const benchToSave = matchBench.filter(playerId => !validSavedIds.has(String(playerId)) && (cart || []).some(player => String(player.Id) === String(playerId))).slice(0, 7);
      const saveData = {
        formation: formationToSave,
        lineup: lineupToSave,
        dorsals: dorsalsToSave,
        availability,
        matchBench: benchToSave
      };

      batch.set(profileRef, saveData, { merge: true });
      batch.set(publicRef, saveData, { merge: true });

      await batch.commit();
      
      // Show message only if it's a manual save (from button click or no override)
      if (!overrideLineup || isEvent) {
        showStatusMessage('success', 'Plantilla guardada.');
        if (!isPage) onClose?.();
      }
    } catch (e) {
      console.error('Error saving lineup:', e);
      showStatusMessage('error', 'Error al guardar plantilla.');
    }
    setIsSaving(false);
  };

  const handleDorsalChange = useCallback((playerId, value) => {
    if (!/^\d*$/.test(value)) return;
    setDorsals(prev => ({ ...prev, [playerId]: value }));
  }, []);

  const handleAvailabilityChange = useCallback((playerId, isAvailable) => {
    setAvailability(prev => ({ ...prev, [playerId]: isAvailable }));
    if (!isAvailable) setMatchBench(prev => prev.filter(id => String(id) !== String(playerId)));
  }, []);

  const handleBenchChange = useCallback((playerId) => {
    setMatchBench(prev => {
      const id = String(playerId);
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (prev.length >= 7) {
        showStatusMessage('warning', 'El banco admite hasta 7 suplentes.');
        return prev;
      }
      return [...prev, id];
    });
  }, [showStatusMessage]);

  const handleDownloadImage = async () => {
    if (!pitchRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(pitchRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#1a3a2a',
        scale: 2,
        ignoreElements: (el) => el.classList && el.classList.contains("no-export")
      });
      const fileName = `formacion-${userProfile?.teamName || 'equipo'}`;

      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Canvas blob is null after CORS fix - canvas is tainted");
          showStatusMessage('error', 'Error al generar la imagen. Intenta de nuevo.');
          setIsCapturing(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        showStatusMessage('success', 'Imagen descargada.');
        setIsCapturing(false);
      }, "image/png");
    } catch (error) {
      console.error('Error al exportar imagen con html2canvas:', error);
      showStatusMessage('error', 'Error al exportar la imagen.');
      setIsCapturing(false);
    }
  };

  const currentFormation = FORMATIONS[selectedFormation];
  // Derive available players from assigned slots — enforce uniqueness
  const assignedIds = useMemo(() => {
    const ids = new Set();
    Object.values(lineup).filter(Boolean).forEach(id => ids.add(String(id)));
    return ids;
  }, [lineup]);
  const availablePlayers = useMemo(() => {
    const list = cart.filter(p => !assignedIds.has(String(p.Id)) || (holdingPlayer?.from === 'slot' && String(p.Id) === String(holdingPlayer.player.Id)));
    return [...list].sort((a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO);
  }, [cart, assignedIds, holdingPlayer]);

  const handlePlayerClick = useCallback((player) => {
    dispatchFormation({ type: 'PICK_FROM_LIST', payload: { player } });
    // Auto switch to pitch view on mobile after selecting a player
    setMobileTab('pitch');
  }, []);

  const onSlotClick = useCallback((index) => {
    // Si había un jugador "en mano", este click va a resultar en una colocación:
    // marcamos la intención de auto-guardar ANTES de despachar, y dejamos que un
    // efecto sobre `lineup` dispare el guardado una vez que el reducer ya resolvió
    // el nuevo estado (en vez de anidar setState como antes).
    if (holdingPlayer) pendingAutoSaveRef.current = true;
    dispatchFormation({ type: 'CLICK_SLOT', payload: { index, cart } });
  }, [cart, holdingPlayer]);

  // Auto-guardado tras una colocación (reemplaza el setTimeout que vivía dentro del setState anidado)
  useEffect(() => {
    if (!pendingAutoSaveRef.current) return;
    pendingAutoSaveRef.current = false;
    handleSaveLineup(lineup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup]);

  // ── Share URL with popover ──
  const [shareUrl, setShareUrl] = useState('');
  const [isSharing, setIsSharing] = useState(false);

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
    setIsSharing(true);
    try {
      // Build slot data with player names embedded for public view
      const slotsWithNames = {};
      const currentFormation = FORMATIONS[selectedFormation];
      const cleanLineup = sanitizeLineup(lineup);
      if (currentFormation?.layout) {
        currentFormation.layout.forEach((slot, index) => {
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

      const starterIds = new Set(Object.values(cleanLineup).map(String));
      const bench = cart
        .filter(player => !starterIds.has(String(player.Id)))
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
        slots: slotsWithNames,
        bench,
        isPublic: true,
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.userId || 'unknown',
      });

      const url = `${window.location.origin}/tactics/view/${snap.id}`;
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

  // Close popover on outside click
  useEffect(() => {
    if (!showSharePopover) return;
    const handleClickOutside = (e) => {
      if (sharePopoverRef.current && !sharePopoverRef.current.contains(e.target)) {
        setShowSharePopover(false);
        setShareCopied(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSharePopover]);

  if (!isVisible && !isPage) return null;

  /* ── Shared sub-components ── */
  const ControlsBar = (
    <div className="p-3 lg:p-4 space-y-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <select value={selectedFormation} onChange={(e) => { setSelectedFormation(e.target.value); dispatchFormation({ type: 'RESET' }); }}
        className="w-full bg-white/[0.05] text-white rounded-lg px-3 py-2.5 font-bold outline-none text-sm cursor-pointer"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        {Object.keys(FORMATIONS).map(key => <option key={key} value={key}>{FORMATIONS[key].name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={handleSaveLineup} disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg py-2 flex items-center justify-center gap-1.5 transition">
          <Save className="w-3.5 h-3.5" />Guardar
        </button>
        <button onClick={handleDownloadImage} disabled={isCapturing}
          className="bg-white/[0.05] hover:bg-white/[0.1] text-white text-sm font-bold rounded-lg py-2 flex items-center justify-center gap-1.5 transition"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <ImageIcon className="w-3.5 h-3.5" />Exportar
        </button>
      </div>
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-center text-[10px] font-black uppercase tracking-wide text-cyan-300">
        Convocados al banco: {matchBench.length}/7 · El resto queda como reserva
      </div>
      <div className="relative" ref={sharePopoverRef}>
        <button onClick={handleShareURL} disabled={isSharing}
          className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm font-bold rounded-lg py-2.5 flex items-center justify-center gap-2 transition border border-blue-500/20 disabled:opacity-50">
          {isSharing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
          ) : (
            <><Share2 className="w-4 h-4" /> {shareCopied ? '¡Enlace Copiado!' : 'Compartir URL Pública'}</>
          )}
        </button>

        {/* ── Share Popover ── */}
        {showSharePopover && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-gray-800 border border-gray-600/50 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/40 text-gray-300 text-xs font-mono px-3 py-2 rounded-lg border border-gray-700 outline-none select-all"
                onClick={(e) => e.target.select()}
              />
              <button
                onClick={handleCopyAgain}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shrink-0 active:scale-95"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
            </div>
            {shareCopied && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <Check className="w-3.5 h-3.5" /> Enlace copiado al portapapeles
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const HoldingBanner = (
    <div className={`px-4 py-2.5 ${holdingPlayer ? 'bg-blue-900/20' : ''}`}
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <h3 className="text-sm font-bold text-white">{holdingPlayer ? <><Move className="w-4 h-4 inline mr-2 animate-bounce" /> Moviendo a: {holdingPlayer.player.Name}</> : "Selecciona un jugador..."}</h3>
    </div>
  );

  const PlayerList = (
    <div className="flex-grow overflow-y-auto p-3 lg:p-4 custom-scrollbar space-y-2 bg-gray-900/20 pb-20 lg:pb-4">
      {availablePlayers.map(player => (
        <FormationPlayerItem key={player.Id} player={player} onClick={() => handlePlayerClick(player)} isSelected={holdingPlayer?.from === 'list' && holdingPlayer.player.Id === player.Id} dorsal={dorsals[player.Id]} onDorsalChange={handleDorsalChange} isAvailable={availability[player.Id] !== false} onAvailabilityChange={handleAvailabilityChange} isBench={matchBench.includes(String(player.Id))} onBenchChange={handleBenchChange} />
      ))}
      {availablePlayers.length === 0 && <p className="text-gray-500 text-sm italic text-center py-4">Todos tus jugadores están en la cancha.</p>}
    </div>
  );

  const PitchView = (
    <div className="flex-1 flex items-center justify-center p-2 lg:p-4 overflow-hidden bg-[#050505]">
      <div style={{ aspectRatio: '3/4', height: '100%', maxHeight: '100%', maxWidth: '100%', position: 'relative' }}>
        <Pitch
          pitchRef={pitchRef}
          formation={currentFormation}
          lineup={lineup}
          cart={cart}
          holdingPlayer={holdingPlayer}
          dorsals={dorsals}
          onSlotClick={onSlotClick}
        />
      </div>
    </div>
  );

  return (
    <div className={isPage ? "w-full h-full flex flex-col animate-in fade-in duration-300" : "fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4 animate-in fade-in duration-300"} onClick={!isPage ? onClose : undefined}>
      <div className={isPage ? "w-full h-full flex flex-col relative overflow-hidden" : "bg-gray-900/95 sm:rounded-2xl shadow-2xl w-full max-w-7xl h-full sm:h-[90vh] flex flex-col border-0 sm:border border-gray-700/50 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"} onClick={!isPage ? (e => e.stopPropagation()) : undefined}>

        {/* ── HEADER ── */}
        <div className="flex justify-between items-center px-4 lg:px-5 py-3 shrink-0"
          style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-5 h-5 text-cyan-500" />
            <h2 className="text-base font-black text-white">Pizarra Táctica</h2>
          </div>
          {!isPage && <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition"><X size={18} /></button>}
        </div>

        {/* ── MOBILE TAB SWITCHER (visible only on < lg) ── */}
        <div className="flex lg:hidden shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setMobileTab('pitch')}
            className={`flex-1 py-2.5 text-sm font-bold text-center transition-all ${
              mobileTab === 'pitch'
                ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            🏟️ Cancha
          </button>
          <button
            onClick={() => setMobileTab('squad')}
            className={`flex-1 py-2.5 text-sm font-bold text-center transition-all relative ${
              mobileTab === 'squad'
                ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            👥 Jugadores
            {availablePlayers.length > 0 && (
              <span className="ml-1.5 bg-gray-700 text-gray-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {availablePlayers.length}
              </span>
            )}
          </button>
        </div>

        {/* ── CONTENT AREA ── */}
        <div className="flex-grow flex overflow-hidden">

          {/* === DESKTOP LAYOUT (lg+): side-by-side === */}
          <div className="hidden lg:flex flex-grow overflow-hidden">
            {/* Left Panel */}
            <div className="w-[280px] flex-shrink-0 flex flex-col h-full overflow-hidden"
              style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              {ControlsBar}
              {HoldingBanner}
              {PlayerList}
            </div>
            {/* Right Panel: Pitch */}
            {PitchView}
          </div>

          {/* === MOBILE LAYOUT (< lg): tabbed === */}
          <div className="flex lg:hidden flex-col flex-grow overflow-hidden">
            {mobileTab === 'pitch' ? (
              <>
                {/* Compact controls above pitch on mobile */}
                {ControlsBar}
                {holdingPlayer && HoldingBanner}
                {PitchView}
              </>
            ) : (
              <>
                {HoldingBanner}
                {PlayerList}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
});
