import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Pitch } from '../components/Pitch.jsx';
import { FORMATIONS, DEFAULT_LOGO, APP_ID } from '../utils/constants.js';
import { Shield, Trophy, Users, ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { processPlayersData } from '../utils/helpers.js';

export default function TeamScreen() {
  const params = useParams();
  const location = useLocation();
  // useParams works inside <Route>, but this component is rendered via pathname check,
  // so extract userId from the URL path as fallback
  const userId = params.userId || location.pathname.split('/team/')[1]?.split('/')[0] || null;
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartPlayers, setCartPlayers] = useState([]);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!userId) {
        setError("No se especificó un ID de equipo.");
        setLoading(false);
        return;
      }

      const teamRef = doc(db, `artifacts/${APP_ID}/public/data/teams`, userId);
      const teamSnap = await getDoc(teamRef);

      if (!teamSnap.exists()) {
        setError("El equipo no existe o no es público.");
        setLoading(false);
        return;
      }

      const data = teamSnap.data();
      setTeamData(data);

      // Fetch the players in the lineup from the main players list
      const lineup = data?.lineup;
      if (lineup && typeof lineup === 'object') {
        const playerIds = Object.values(lineup).filter(v => v != null && v !== '').map(String);
        if (playerIds.length > 0) {
          const resp = await fetch('/jugadores.json');
          const rawPlayers = await resp.json();
          const allPlayers = processPlayersData(rawPlayers || []);
          const filtered = allPlayers.filter(p => playerIds.includes(String(p?.Id)));
          setCartPlayers(filtered);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching team:", err);
      if (err?.code === 'permission-denied') {
        setError("Sin permisos para cargar el equipo.");
      } else if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        setError("Error de conexión. Verificá tu internet e intentá de nuevo.");
      } else {
        setError("Los datos del equipo no están disponibles aún.");
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando Estrategia...</p>
      </div>
    );
  }

  if (error) {
    const isNetworkError = error.includes('conexión');
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center">
        <div className={`w-20 h-20 ${isNetworkError ? 'bg-yellow-500/10' : 'bg-red-500/10'} rounded-full flex items-center justify-center mb-6 border ${isNetworkError ? 'border-yellow-500/20' : 'border-red-500/20'}`}>
          {isNetworkError ? <WifiOff className="w-10 h-10 text-yellow-500" /> : <Shield className="w-10 h-10 text-red-500" />}
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase italic">{error}</h2>
        <div className="flex items-center gap-4 mt-4">
          <button 
            onClick={fetchTeam} 
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold transition bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20 hover:bg-blue-500/20"
          >
            <RefreshCw size={18} /> Reintentar
          </button>
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-400 hover:text-gray-300 font-bold transition">
            <ArrowLeft size={18} /> Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center">
        <Users className="w-16 h-16 text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-400">No se encontraron datos del equipo.</h2>
        <button onClick={() => navigate('/')} className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold transition">
          <ArrowLeft size={18} /> Volver al Inicio
        </button>
      </div>
    );
  }

  const currentFormation = FORMATIONS[teamData?.formation] || FORMATIONS['4-3-3'];
  const validPlayerIds = new Set((cartPlayers || []).map(player => String(player.Id)));
  const publicLineup = Object.fromEntries(
    Object.entries(teamData?.lineup || {}).filter(([, playerId]) => validPlayerIds.has(String(playerId)))
  );
  const publicSlots = Object.fromEntries(
    Object.entries(publicLineup).map(([idx, playerId]) => {
      const slot = currentFormation?.layout?.[Number(idx)];
      const player = cartPlayers.find(p => String(p.Id) === String(playerId));
      return [idx, {
        playerId: String(player.Id),
        name: player.Name,
        pos: slot?.pos || player.POS_NOMBRE,
        ovr: player.OVR_CALCULADO,
        dorsal: teamData?.dorsals?.[playerId] || '',
      }];
    })
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col">
      {/* Header Panel */}
      <div className="bg-[#111114] border-b border-white/5 p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/5 blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gray-900 border-2 border-white/10 p-4 flex items-center justify-center shadow-2xl relative z-10">
              <img 
                src={teamData?.logoUrl || DEFAULT_LOGO} 
                className="w-full h-full object-contain drop-shadow-xl" 
                alt="Logo"
                onError={(e) => e.target.src = DEFAULT_LOGO}
              />
            </div>
          </div>

          <div className="text-center md:text-left flex-grow">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">SCL DRAFT 2026</span>
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Pizarra Pública</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter uppercase leading-none mb-4">
              {teamData?.teamName || 'Equipo'}
            </h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-bold text-gray-300">Formación: <span className="text-white">{teamData?.formation || '4-3-3'}</span></span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <Users className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-gray-300">Titulares: <span className="text-white">{Object.values(teamData?.lineup || {}).filter(Boolean).length}</span></span>
              </div>
            </div>
          </div>

          <div className="shrink-0">
             <button onClick={() => navigate('/')} className="px-6 py-3 bg-white text-black font-black rounded-xl hover:bg-gray-200 transition shadow-lg uppercase text-sm tracking-tight">
               Crear mi Equipo
             </button>
          </div>
        </div>
      </div>

      {/* Main Content: Pitch */}
      <div className="flex-grow flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl rounded-2xl border border-gray-700/50 bg-gray-800/40 overflow-hidden shadow-xl">
          <Pitch 
            formation={currentFormation}
            lineup={publicLineup}
            cart={[]}
            dorsals={teamData?.dorsals || {}}
            isReadOnly={true}
            readOnlySlots={publicSlots}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 border-t border-white/5 text-center bg-black/40">
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">SCL Draft 2026 • Argentina • v1.5.0</p>
      </div>
    </div>
  );
}
