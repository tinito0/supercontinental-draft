import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Pitch } from '../components/Pitch.jsx';
import { FORMATIONS, APP_ID } from '../utils/constants.js';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function FormationViewScreen() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract formationId from pathname since we use location-based routing, not <Route>
  const formationId = location.pathname.replace('/tactics/view/', '').replace(/\/$/, '') || null;

  const [formationData, setFormationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    async function fetchFormation() {
      try {
        const formRef = doc(db, `artifacts/${APP_ID}/public/data/shared_formations`, formationId);
        const formSnap = await getDoc(formRef);

        if (!formSnap.exists() || formSnap.data().isPublic === false) {
          setError("Esta formación no existe o no está disponible.");
          setLoading(false);
          return;
        }

        setFormationData(formSnap.data());
        setLoading(false);
      } catch (err) {
        console.error("Error fetching formation:", err);
        if (!retried) {
          // Retry once before showing error
          setRetried(true);
          setTimeout(fetchFormation, 1500);
        } else {
          setError("No se pudo cargar la formación. Intentá de nuevo más tarde.");
          setLoading(false);
        }
      }
    }

    if (formationId) fetchFormation();
    else { setError("ID de formación no válido."); setLoading(false); }
  }, [formationId, retried]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Cargando formación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-14 h-14 text-red-400/60 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Formación no disponible</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition border border-gray-700"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const { teamName, logoUrl, formationKey, slots, bench = [], createdAt } = formationData;
  const formation = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-black/50 p-1 border border-gray-700" />
          )}
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">{teamName || 'Equipo'}</h1>
            <p className="text-xs text-gray-500 font-medium">{formation.name} · Formación compartida</p>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="max-w-3xl mx-auto p-4 sm:p-8">
        <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 overflow-hidden shadow-xl">
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

        <section className="mt-5 rounded-2xl border border-gray-700/50 bg-gray-800/40 p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-white">Banco de suplentes ({bench.length})</h2>
          {bench.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bench.map(player => (
                <div key={player.playerId} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-2.5">
                  <img src={`/fotos_jugadores/${player.playerId}.webp`} alt="" className="h-9 w-9 rounded-full object-cover bg-gray-900" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{player.name}</p>
                    <p className="text-xs text-gray-500">{player.pos}{player.dorsal ? ` · #${player.dorsal}` : ''}</p>
                  </div>
                  <span className="text-sm font-black text-blue-300">{player.ovr}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Esta formación no tiene suplentes compartidos.</p>}
        </section>

        {/* Info footer */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-600">
            Compartido desde Supercontinental Draft
            {createdAt && ` · ${new Date(createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      </div>
    </div>
  );
}
