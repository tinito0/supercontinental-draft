import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
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
  const [teamRecord, setTeamRecord] = useState({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [], mvpCount: 0, rival: '—', titles: 0 });
  const [transferHistory, setTransferHistory] = useState([]);

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

      const transfersSnap = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/transfers`), orderBy('timestamp', 'desc'), limit(100)));
      setTransferHistory(transfersSnap.docs.map(transferDoc => transferDoc.data())
        .filter(transfer => transfer.teamId === userId || transfer.fromTeamId === userId)
        .slice(0, 6));

      const tournamentSnap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/tournament`, 'official'));
      const normalizedTeamName = String(data.teamName || '').trim().toLowerCase();
      const record = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [], mvpCount: 0, rival: '—', titles: Number(data.titles) || 0 };
      if (tournamentSnap.exists() && normalizedTeamName) {
        const tournament = tournamentSnap.data();
        const rivals = {};
        (tournament.matches || []).filter(match => match.status === 'completed').forEach(match => {
          const isHome = String(match.homeTeam || '').trim().toLowerCase() === normalizedTeamName;
          const isAway = String(match.awayTeam || '').trim().toLowerCase() === normalizedTeamName;
          if (!isHome && !isAway) return;
          const scored = Number(isHome ? match.homeScore : match.awayScore) || 0;
          const conceded = Number(isHome ? match.awayScore : match.homeScore) || 0;
          const rival = isHome ? match.awayTeam : match.homeTeam;
          if (rival) rivals[rival] = (rivals[rival] || 0) + 1;
          record.played += 1;
          record.gf += scored;
          record.ga += conceded;
          if (scored > conceded) { record.wins += 1; record.form.push('G'); }
          else if (scored < conceded) { record.losses += 1; record.form.push('P'); }
          else { record.draws += 1; record.form.push('E'); }
          if (match.mvp) record.mvpCount += 1;
        });
        const mostFrequentRival = Object.entries(rivals).sort(([, a], [, b]) => b - a)[0];
        if (mostFrequentRival) record.rival = mostFrequentRival[0];
        const final = tournament.bracket?.final;
        const finalWinner = Number(final?.scoreA) > Number(final?.scoreB) ? final?.teamA : Number(final?.scoreB) > Number(final?.scoreA) ? final?.teamB : '';
        if (String(finalWinner || '').trim().toLowerCase() === normalizedTeamName) record.titles += 1;
      }
      const manualStats = data.manualStats || {};
      ['played', 'wins', 'draws', 'losses', 'gf', 'ga', 'titles'].forEach(field => {
        if (manualStats[field] !== '' && manualStats[field] !== undefined && manualStats[field] !== null) {
          const value = Number(manualStats[field]);
          if (Number.isFinite(value)) record[field] = Math.max(0, value);
        }
      });
      if (String(manualStats.rival || '').trim()) record.rival = String(manualStats.rival).trim();
      setTeamRecord(record);

      // New public snapshots include the full squad. Older snapshots fall back
      // to the starting XI so shared links created before this update still work.
      if (Array.isArray(data?.roster)) {
        setCartPlayers(data.roster.map(player => ({ ...player, Id: player.Id ?? player.playerId })));
        setLoading(false);
        return;
      }

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
  const starters = new Set(Object.values(publicLineup).map(String));
  const substitutes = cartPlayers
    .filter(player => !starters.has(String(player.Id)))
    .sort((a, b) => Number(a.OVR_CALCULADO || 0) - Number(b.OVR_CALCULADO || 0));
  const matchBenchIds = new Set((teamData?.matchBench || []).map(String));
  const calledBench = substitutes.filter(player => matchBenchIds.has(String(player.Id)));
  const reserves = substitutes.filter(player => !matchBenchIds.has(String(player.Id)));
  const unavailableCount = cartPlayers.filter(player => player.available === false).length;

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
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <Users className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-gray-300">Banco: <span className="text-white">{calledBench.length}/7</span></span>
              </div>
              {unavailableCount > 0 && <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20"><span className="text-xs font-bold text-red-300">Bajas: {unavailableCount}</span></div>}
            </div>
          </div>

          <div className="shrink-0">
             <button onClick={() => navigate('/')} className="px-6 py-3 bg-white text-black font-black rounded-xl hover:bg-gray-200 transition shadow-lg uppercase text-sm tracking-tight">
               Crear mi Equipo
             </button>
          </div>
        </div>
      </div>

      <section className="w-full max-w-5xl mx-auto px-4 pt-2 sm:px-8">
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-gray-700/50 bg-gray-800/40 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Partidos', teamRecord.played, 'text-white'],
            ['Récord', `${teamRecord.wins}-${teamRecord.draws}-${teamRecord.losses}`, 'text-cyan-300'],
            ['Goles', `${teamRecord.gf}:${teamRecord.ga}`, 'text-emerald-300'],
            ['Racha', teamRecord.form.slice(-5).join(' · ') || '—', 'text-yellow-300'],
            ['Títulos', teamRecord.titles, 'text-violet-300'],
            ['Rivalidad', teamRecord.rival, 'text-orange-300'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl bg-black/20 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
              <p className={`mt-1 text-xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

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

      <section className="w-full max-w-5xl mx-auto px-4 pb-10 sm:px-8">
        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-black uppercase tracking-tight">Banco de suplentes</h2>
            <span className="text-xs text-gray-500 font-bold">({calledBench.length}/7)</span>
          </div>
          {calledBench.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {calledBench.map(player => (
                <article key={player.Id} className={`flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 ${player.available === false ? 'opacity-50' : ''}`}>
                  <img src={`/fotos_jugadores/${player.Id}.webp`} alt="" className="h-11 w-11 rounded-full object-cover bg-gray-900" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{player.Name}</p>
                    <p className="text-xs font-bold text-gray-500">{player.POS_NOMBRE || 'Jugador'}{player.dorsal ? ` · #${player.dorsal}` : ''}{player.available === false ? ' · Baja' : ''}</p>
                  </div>
                  <span className="rounded-lg bg-blue-500/15 px-2 py-1 text-sm font-black text-blue-300">{player.OVR_CALCULADO || '-'}</span>
                </article>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">No hay suplentes cargados todavía.</p>}
        </div>
      </section>

      {reserves.length > 0 && (
        <section className="w-full max-w-5xl mx-auto px-4 pb-10 sm:px-8">
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/25 p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-gray-300">Reservas ({reserves.length})</h2>
            <div className="flex flex-wrap gap-2">{reserves.map(player => <span key={player.Id} className="rounded-lg bg-black/20 px-2 py-1 text-xs font-bold text-gray-400">{player.Name}{player.available === false ? ' · Baja' : ''}</span>)}</div>
          </div>
        </section>
      )}

      <section className="w-full max-w-5xl mx-auto px-4 pb-10 sm:px-8">
        <div className="rounded-2xl border border-gray-700/50 bg-gray-800/40 p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-white">Historial de mercado</h2>
          {transferHistory.length ? <div className="space-y-2">
            {transferHistory.map((transfer, index) => {
              const isSale = transfer.fromTeamId === userId;
              return <div key={`${transfer.playerId}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{transfer.playerName || 'Jugador'}</p><p className={`text-[10px] font-black uppercase ${isSale ? 'text-orange-300' : 'text-emerald-300'}`}>{isSale ? 'Venta' : 'Fichaje'}{transfer.type === 'transfer' ? ' entre equipos' : ''}</p></div>
                <span className="shrink-0 text-sm font-black text-white">${Number(transfer.price || 0).toFixed(2)}M</span>
              </div>;
            })}
          </div> : <p className="text-sm text-gray-500">Todavía no hay movimientos registrados.</p>}
        </div>
      </section>

      {/* Footer */}
      <div className="p-8 border-t border-white/5 text-center bg-black/40">
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">SCL Draft 2026 • Argentina • v1.5.0</p>
      </div>
    </div>
  );
}
