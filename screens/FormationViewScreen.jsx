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
      <div className="min-h-screen bg-slate-50 dark:bg-[#06080d] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Cargando alineación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#06080d] flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white dark:bg-[#0c1017] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Formación no disponible</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition"
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#06080d] text-slate-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0c1017]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center gap-3.5">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {logoUrl && (
            <img src={logoUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" />
          )}
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{teamName || 'Equipo'}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formation.name} · Alineación táctica</p>
          </div>
        </div>
      </div>

      {/* Pitch */}
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-[#0c1017] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-2 sm:p-4">
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

        <section className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1017] p-4 sm:p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Banco de Suplentes ({bench.length})</h2>
          {bench.length ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bench.map(player => (
                <div key={player.playerId} className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5">
                  <img src={`/fotos_jugadores/${player.playerId}.webp`} alt="" className="h-8 w-8 rounded-full object-cover bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{player.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{player.pos}{player.dorsal ? ` · #${player.dorsal}` : ''}</p>
                  </div>
                  <span className="text-xs font-bold text-sky-600 dark:text-sky-400 tabular-nums">{player.ovr}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400">Esta formación no tiene suplentes compartidos.</p>}
        </section>

        {/* Info footer */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-400">
            Supercontinental League
            {createdAt && ` · ${new Date(createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      </div>
    </div>
  );
}
