import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Pitch } from '../components/Pitch.jsx';
import { FORMATIONS, APP_ID } from '../utils/constants.js';
import { layoutForState, normalizeFormationStates } from '../utils/formationStates.js';
import { ArrowLeft, AlertCircle, RotateCw } from 'lucide-react';
import { loadSharedFormation, FormationNotFoundError } from '../services/sharedFormationService.js';

export default function FormationViewScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  // Only the id segment: links pasted from chats can carry a trailing slash or extra path.
  const rawId = location.pathname.replace(/^.*\/tactics\/view\//, '').split('/')[0];
  const formationId = (() => {
    try { return rawId ? decodeURIComponent(rawId) : null; } catch { return rawId || null; }
  })();

  const [formationData, setFormationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!formationId) {
      setError('El enlace no tiene una formación.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Works without an account: the SDK first, and a plain REST read if the browser blocks its channel.
    loadSharedFormation(formationId, {
      readWithSdk: async () => {
        const snap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/shared_formations`, formationId));
        return snap.exists() ? snap.data() : null;
      },
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      appId: APP_ID,
    })
      .then(({ data }) => {
        if (cancelled) return;
        if (data.isPublic === false) setError('Esta formación ya no se comparte.');
        else setFormationData(data);
      })
      .catch(err => {
        if (cancelled) return;
        if (err instanceof FormationNotFoundError) {
          setError('Esta formación no existe o fue borrada. Pedile a su dueño que la vuelva a compartir.');
        } else {
          console.error('Error fetching formation:', err);
          setError('No se pudo conectar con la liga. Revisá la conexión (o desactivá el bloqueador del navegador para este sitio) y reintentá.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [formationId, attempt]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center" role="status">
          <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" aria-hidden="true"></div>
          <p className="text-ink-3 text-xs font-medium">Cargando alineación…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-surface p-8 rounded-2xl border border-line/20 shadow-lg" role="alert">
          <AlertCircle className="w-12 h-12 text-danger-soft mx-auto mb-3" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-ink mb-2">Formación no disponible</h1>
          <p className="text-ink-3 text-sm mb-6">{error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setAttempt(n => n + 1)} className="btn btn-primary">
              <RotateCw className="w-4 h-4" aria-hidden="true" />Reintentar
            </button>
            <button type="button" onClick={() => navigate('/')} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { teamName, logoUrl, formationKey, slots, bench = [], createdAt, formationStates } = formationData;
  const key = FORMATIONS[formationKey] ? formationKey : '4-3-3';
  // Snapshots made after the tactical states existed carry the moved markers of the starting formation.
  const formation = { ...FORMATIONS[key], layout: layoutForState(FORMATIONS[key], normalizeFormationStates(formationStates, key, FORMATIONS[key]), 'base') };
  const validSlots = Object.fromEntries(
    Object.entries(slots || {}).filter(([, slotData]) => {
      const name = String(slotData?.name || '').trim().toLowerCase();
      return slotData?.playerId && slotData?.ovr > 0 && name && name !== 'desconocido';
    })
  );

  // Build a lineup map from slots for the Pitch component
  const lineup = {};
  Object.entries(validSlots).forEach(([idx, slotData]) => {
    lineup[idx] = slotData.playerId;
  });

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-base">
      {/* Header */}
      <div className="border-b border-line/20 bg-surface/90 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center gap-3.5">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-raised text-ink-3 hover:text-ink transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {logoUrl && (
            <img src={logoUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-contain bg-raised p-1 border border-line/20" />
          )}
          <div>
            <h1 className="text-base font-bold text-ink tracking-tight">{teamName || 'Equipo'}</h1>
            <p className="text-xs text-ink-3 font-medium">{formation.name} · Alineación táctica</p>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className=" bg-surface rounded-2xl border border-line/20 overflow-hidden shadow-sm p-2 sm:p-4">
          <Pitch
            formation={formation}
            lineup={lineup}
            cart={[]}
            dorsals={{}}
            holdingPlayer={null}
            onSlotClick={() => {}}
            isReadOnly={true}
            readOnlySlots={validSlots}
          />
        </div>

        <section className="mt-5 rounded-2xl border border-line/20 bg-surface p-4 sm:p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">Banco de Suplentes ({bench.length})</h2>
          {bench.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bench.map(player => (
                <div key={player.playerId} className="flex items-center gap-2.5 rounded-xl border border-line/20 bg-surface/60 p-2.5">
                  <img src={`/fotos_jugadores/${player.playerId}.webp`} alt="" className="h-8 w-8 rounded-full object-cover bg-raised border border-line/20" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink">{player.name}</p>
                    <p className="text-[11px] text-ink-3">{player.pos}{player.dorsal ? ` · #${player.dorsal}` : ''}</p>
                  </div>
                  <span className="text-xs font-bold text-accent-soft tabular-nums">{player.ovr}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-3">Esta formación no tiene suplentes compartidos.</p>}
        </section>

        {/* Info footer */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-ink-3">
            Supercontinental League
            {createdAt && ` · ${new Date(createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      </div>
    </div>
  );
}
