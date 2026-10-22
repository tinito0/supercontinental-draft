import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Pitch } from '../components/Pitch.jsx';
import { FORMATIONS, DEFAULT_LOGO, APP_ID } from '../utils/constants.js';
import { layoutForState, normalizeFormationStates } from '../utils/formationStates.js';
import { Shield, Trophy, Users, ArrowLeft, RefreshCw, WifiOff, Award, TrendingUp, Activity } from 'lucide-react';
import { processPlayersData, formatPriceShort, getStatAndOvrColorClass } from '../utils/helpers.js';
import { fetchRawPlayers } from '../utils/playerCatalog.js';
import { playerPlaceholder } from '../utils/playerPlaceholder.js';
import { teamCrestUrl } from '../utils/teamCrest.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

/* ── Umbrales dinámicos de color OVR consistentes con el mercado ── */
const OVR_COLOR_THRESHOLDS = [
  [90, '#1ec9a4'],
  [85, '#a0dd00'],
  [75, '#ffc400'],
  [65, '#ec7d22'],
];
const OVR_COLOR_DEFAULT = '#94a3b8';

function getOvrColor(ovr) {
  const n = Number(ovr) || 0;
  for (let i = 0; i < OVR_COLOR_THRESHOLDS.length; i++) {
    if (n >= OVR_COLOR_THRESHOLDS[i][0]) return OVR_COLOR_THRESHOLDS[i][1];
  }
  return OVR_COLOR_DEFAULT;
}

/* ── Posiciones con paleta unificada del mercado ── */
const POS_COLOR = {
  DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444',
  MC: '#22c55e', MCD: '#22c55e', MO: '#22c55e', MI: '#22c55e', MD: '#22c55e',
  DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6',
  PT: '#eab308', PO: '#eab308', GK: '#eab308',
};

/* ── Orden táctico de banco: Defensores -> Mediocampistas -> Delanteros -> Arqueros ── */
const POS_RANK = {
  // Defensores (1)
  'DEC': 1, 'LI': 1, 'LD': 1, 'LIB': 1, 'CB': 1, 'LB': 1, 'RB': 1, 'DF': 1, 'DFC': 1,
  // Mediocampistas (2)
  'MCD': 2, 'MC': 2, 'MO': 2, 'MI': 2, 'MD': 2, 'DMF': 2, 'CMF': 2, 'AMF': 2, 'LMF': 2, 'RMF': 2, 'MED': 2,
  // Delanteros (3)
  'DC': 3, 'SP': 3, 'EI': 3, 'ED': 3, 'CF': 3, 'SS': 3, 'LWF': 3, 'RWF': 3, 'DEL': 3, 'SD': 3,
  // Arqueros (4)
  'PT': 4, 'GK': 4, 'ARQ': 4, 'PO': 4,
};

const getPosRank = (pos) => POS_RANK[String(pos || '').toUpperCase()] || 5;

/**
 * Public page of a club. Shared by the draft (/draft/team/:id) and the league site (/equipos/:id), which passes
 * `isLeagueSite` (no draft badge, no own footer) and the club's history as `afterHeader`.
 */
export default function TeamScreen({ isLeagueSite = false, afterHeader = null }) {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // useParams works inside <Route>, but this component is rendered via pathname check,
  // so extract userId from the URL path as fallback
  const userId = params.userId || location.pathname.split('/team/')[1]?.split('/')[0] || null;

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  useDocumentTitle(teamData?.teamName || 'Equipos');
  const [error, setError] = useState(null);
  const [cartPlayers, setCartPlayers] = useState([]);
  const [teamRecord, setTeamRecord] = useState({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [], mvpCount: 0, rival: '—', titles: 0 });
  const [transferHistory, setTransferHistory] = useState([]);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const fetchTeam = useCallback(() => {
    setReloadTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!userId) {
          if (isMounted) {
            setError("No se especificó un ID de equipo.");
            setLoading(false);
          }
          return;
        }

        const teamRef = doc(db, `artifacts/${APP_ID}/public/data/teams`, userId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
          if (isMounted) {
            setError("El equipo no existe o no es público.");
            setLoading(false);
          }
          return;
        }

        const data = teamSnap.data();
        if (isMounted) setTeamData(data);

        // Cargar historial de transferencias
        const transfersSnap = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/transfers`), orderBy('timestamp', 'desc'), limit(100)));
        if (isMounted) {
          setTransferHistory(transfersSnap.docs.map(transferDoc => transferDoc.data())
            .filter(transfer => transfer.teamId === userId || transfer.fromTeamId === userId)
            .slice(0, 6));
        }

        // Cargar datos de torneo oficial
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
        if (isMounted) setTeamRecord(record);

        // Cargar jugadores del plantel: Buscar bloqueos de este equipo en Firestore para obtener la plantilla completa
        let lockedPlayerIds = [];
        try {
          const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
          locksSnap.forEach(docSnap => {
            const lock = docSnap.data();
            if (lock?.lockedBy === userId) {
              lockedPlayerIds.push(String(docSnap.id));
            }
          });
        } catch (locksErr) {
          console.warn("No se pudieron cargar los bloqueos públicos para el equipo:", locksErr);
        }

        const lineupIds = data?.lineup && typeof data.lineup === 'object'
          ? Object.values(data.lineup).filter(v => v != null && v !== '').map(String)
          : [];
        const rosterIds = Array.isArray(data?.roster)
          ? data.roster.map(p => String(p?.Id ?? p?.playerId)).filter(Boolean)
          : [];
        const benchIds = Array.isArray(data?.matchBench)
          ? data.matchBench.map(String).filter(Boolean)
          : [];

        const allTargetIds = Array.from(new Set([...lockedPlayerIds, ...lineupIds, ...rosterIds, ...benchIds]));

        if (allTargetIds.length > 0) {
          const allPlayers = processPlayersData(await fetchRawPlayers());
          const playerMap = new Map();
          allPlayers.forEach(p => {
            if (p && p.Id != null) playerMap.set(String(p.Id), p);
          });

          const squadPlayers = allTargetIds.map(id => playerMap.get(id)).filter(Boolean);

          // Si data.roster tiene datos adicionales o custom stats, mergearlos
          if (Array.isArray(data?.roster) && data.roster.length > 0) {
            const rosterMap = new Map(data.roster.map(p => [String(p?.Id ?? p?.playerId), p]));
            squadPlayers.forEach((p, idx) => {
              const custom = rosterMap.get(String(p.Id));
              if (custom) squadPlayers[idx] = { ...p, ...custom };
            });
          }

          if (isMounted) setCartPlayers(squadPlayers);
        } else if (Array.isArray(data?.roster) && data.roster.length > 0) {
          if (isMounted) setCartPlayers(data.roster.map(player => ({ ...player, Id: player.Id ?? player.playerId })));
        }

        if (isMounted) setLoading(false);
      } catch (err) {
        console.error("Error fetching team:", err);
        if (!isMounted) return;
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

    load();
    return () => { isMounted = false; };
  }, [userId, reloadTrigger]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center space-y-4 text-ink-2">
        <div className="w-10 h-10 border-3 border-accent/20 border-t-accent-soft rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-ink-3">Cargando perfil táctico...</p>
      </div>
    );
  }

  if (error) {
    const isNetworkError = error.includes('conexión');
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center text-ink-2">
        <div className={`w-16 h-16 ${isNetworkError ? 'bg-warning/10 border-warning/20 text-warning-soft' : 'bg-danger/10 border-danger/20 text-danger-soft'} rounded-xl flex items-center justify-center mb-5 border`}>
          {isNetworkError ? <WifiOff className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">{error}</h2>
        <p className="text-sm text-ink-3 max-w-sm mb-6">No se pudieron recuperar los registros oficiales del equipo solicitado.</p>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchTeam} 
            className="flex items-center gap-2 bg-accent hover:bg-accent text-ink font-medium px-4 py-2 rounded-lg transition cursor-pointer text-sm"
          >
            <RefreshCw size={16} /> Reintentar
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 text-ink-2 hover:text-ink font-medium transition px-4 py-2 rounded-lg border border-line/20 hover:bg-raised text-sm cursor-pointer"
          >
            <ArrowLeft size={16} /> Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (!teamData) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center text-ink-2">
        <div className="w-16 h-16 rounded-xl bg-surface border border-line/20 flex items-center justify-center text-ink-3 mb-4">
          <Users className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-ink">No se encontraron datos del equipo</h2>
        <p className="text-sm text-ink-3 mt-1 mb-6">El equipo aún no ha configurado su plantilla pública.</p>
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30 font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al Inicio
        </button>
      </div>
    );
  }

  // The starting formation as the team saved it (moved markers included); legacy teams use the plain layout.
  const formationKey = FORMATIONS[teamData?.formation] ? teamData.formation : '4-3-3';
  const currentFormation = {
    ...FORMATIONS[formationKey],
    layout: layoutForState(FORMATIONS[formationKey], normalizeFormationStates(teamData?.formationStates, formationKey, FORMATIONS[formationKey]), 'base'),
  };
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

  // Titulares oficiales
  const starters = new Set(Object.values(publicLineup).map(String));

  // BANCO AUTOMÁTICO: Todos los jugadores del plantel que no están en el 11 titular
  // Ordenados por posición: Defensores -> Mediocampistas -> Delanteros -> Arqueros, luego por OVR descendente
  const substitutes = cartPlayers
    .filter(player => !starters.has(String(player.Id)))
    .sort((a, b) => {
      const rankA = getPosRank(a.POS_NOMBRE);
      const rankB = getPosRank(b.POS_NOMBRE);
      if (rankA !== rankB) return rankA - rankB;
      return Number(b.OVR_CALCULADO || 0) - Number(a.OVR_CALCULADO || 0);
    });

  const unavailableCount = cartPlayers.filter(player => player.available === false).length;
  const goalDiff = teamRecord.gf - teamRecord.ga;

  return (
    <div className="min-h-screen bg-canvas text-ink-2 flex flex-col selection:bg-accent/30">
      {/* ── HEADER PANEL DE IDENTIDAD ── */}
      <div className="bg-surface/95 border-b border-line/20 px-4 py-6 sm:py-7 relative">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Escudo del equipo */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-raised border border-line/20 p-2.5 flex items-center justify-center shadow-md">
                <img 
                  src={teamCrestUrl(teamData)}
                  width={96}
                  height={96}
                  className="w-full h-full object-contain" 
                  alt={`Escudo de ${teamData?.teamName || 'Equipo'}`}
                  onError={(e) => { e.target.src = DEFAULT_LOGO; }}
                />
              </div>
            </div>

            {/* Metadatos y Nombre */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                {!isLeagueSite && (
                  <span className="bg-accent/10 text-accent border border-accent/20 text-xs font-semibold px-2 py-0.5 rounded">
                    SCL DRAFT 2026
                  </span>
                )}
                <span className="text-ink-3 text-xs font-medium">
                  Ficha oficial de equipo
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-ink leading-tight">
                {teamData?.teamName || 'Equipo'}
              </h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 bg-raised/80 border border-line/15 px-2.5 py-1 rounded-lg text-xs font-medium text-ink-2">
                  <Trophy className="w-3.5 h-3.5 text-warning-soft" />
                  <span>Formación: <strong className="text-ink">{teamData?.formation || '4-3-3'}</strong></span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-raised/80 border border-line/15 px-2.5 py-1 rounded-lg text-xs font-medium text-ink-2">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <span>Titulares: <strong className="text-ink">{Object.values(publicLineup).length}</strong></span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-raised/80 border border-line/15 px-2.5 py-1 rounded-lg text-xs font-medium text-ink-2">
                  <Shield className="w-3.5 h-3.5 text-accent-soft" />
                  <span>Suplentes: <strong className="text-ink">{substitutes.length}</strong></span>
                </span>
                {unavailableCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-danger/10 border border-danger/20 px-2.5 py-1 rounded-lg text-xs font-medium text-danger-soft">
                    <span>Bajas: <strong>{unavailableCount}</strong></span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Botón Volver */}
          <div className="shrink-0 w-full sm:w-auto flex justify-center sm:justify-end">
            <button
              onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-raised hover:bg-overlay text-ink-2 hover:text-ink font-medium rounded-lg border border-line/20 transition text-sm cursor-pointer shadow-xs w-full sm:w-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver atrás</span>
            </button>
          </div>
        </div>
      </div>

      {afterHeader}

      {/* ── FRANJA DE RENDIMIENTO & RÉCORD DEPORTIVO ── */}
      <section className="w-full max-w-6xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-surface p-3 rounded-xl border border-line/20">
          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Partidos</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-ink tabular-nums">{teamRecord.played}</p>
          </div>

          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Balance G-E-P</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-accent tabular-nums">
              {teamRecord.wins}-{teamRecord.draws}-{teamRecord.losses}
            </p>
          </div>

          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Goles (Dif)</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-success-soft tabular-nums">
              {teamRecord.gf}:{teamRecord.ga} <span className="text-xs font-normal text-ink-3">({goalDiff > 0 ? `+${goalDiff}` : goalDiff})</span>
            </p>
          </div>

          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Racha Reciente</p>
            <div className="mt-1 flex items-center justify-center gap-1 min-h-[28px]">
              {teamRecord.form.length > 0 ? (
                teamRecord.form.slice(-5).map((res, i) => (
                  <span
                    key={i}
                    className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center ${
                      res === 'G' ? 'bg-success/20 text-success-soft border border-success/30' :
                      res === 'P' ? 'bg-danger/20 text-danger-soft border border-danger/30' :
                      'bg-overlay/40 text-ink-2 border border-line/15'
                    }`}
                    title={res === 'G' ? 'Victoria' : res === 'P' ? 'Derrota' : 'Empate'}
                  >
                    {res}
                  </span>
                ))
              ) : (
                <span className="text-sm font-medium text-ink-3">—</span>
              )}
            </div>
          </div>

          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Títulos SCL</p>
            <p className="mt-1 text-lg sm:text-xl font-bold text-warning-soft tabular-nums flex items-center justify-center gap-1">
              <Trophy size={16} className="text-warning-soft" />
              {teamRecord.titles}
            </p>
          </div>

          <div className="bg-raised/60 rounded-lg p-3 text-center border border-line/15">
            <p className="text-xs font-medium text-ink-3">Rival Directo</p>
            <p className="mt-1 text-sm font-semibold text-ink-2 truncate" title={teamRecord.rival}>
              {teamRecord.rival || '—'}
            </p>
          </div>
        </div>
      </section>

      {/* ── PIZARRA TÁCTICA DEL 11 INICIAL ── */}
      <main className="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-3xl bg-surface rounded-xl border border-line/20 p-3 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-line/20">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-ink-2">Disposición Táctica Oficial</span>
            </div>
            <span className="text-xs font-medium text-ink-2 bg-raised px-2.5 py-0.5 rounded border border-line/20">
              {teamData?.formation || '4-3-3'}
            </span>
          </div>
          <div className="rounded-lg overflow-hidden bg-slate-950 border border-line/20">
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
      </main>

      {/* ── BANCO DE SUPLENTES (AUTOMÁTICO: ORDENADOS POR POSICIÓN Y OVR) ── */}
      <section className="w-full max-w-6xl mx-auto px-4 pb-8">
        <div className="bg-surface rounded-xl border border-line/20 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-accent" />
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Banco de Suplentes
              </h2>
              <span className="text-xs text-ink-3 font-medium bg-raised px-2 py-0.5 rounded border border-line/20">
                {substitutes.length} jugadores
              </span>
            </div>
            <span className="text-xs text-ink-3 font-normal hidden sm:inline">
              Ordenados por posición (Def, Med, Del, Arq) y OVR
            </span>
          </div>

          {substitutes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {substitutes.map(player => {
                const posColor = POS_COLOR[player.POS_NOMBRE] || '#94a3b8';
                const ovr = player.OVR_CALCULADO || 0;
                const ovrColorClass = getStatAndOvrColorClass(ovr);
                const dorsal = teamData?.dorsals?.[player.Id];
                const isUnavailable = player.available === false;

                return (
                  <div
                    key={player.Id}
                    className={`flex items-center gap-3 rounded-lg p-2.5 bg-raised/60 hover:bg-raised border border-line/15 transition relative ${
                      isUnavailable ? 'opacity-60 bg-red-950/10 border-danger/20' : ''
                    }`}
                  >
                    {/* Foto del suplente con dorsal */}
                    <div className="relative shrink-0">
                      <img
                        src={`/fotos_jugadores/${player.Id}.webp`}
                        alt={player.Name}
                        className="w-11 h-11 rounded-lg object-cover bg-slate-950 border border-line/20"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = playerPlaceholder(player.Name?.[0] || '?');
                        }}
                      />
                      {dorsal && (
                        <span className="absolute -bottom-1 -right-1 bg-slate-950 text-ink text-[10px] font-bold px-1 rounded border border-line/20">
                          #{dorsal}
                        </span>
                      )}
                    </div>

                    {/* Datos del suplente */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-2">
                        {player.Name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="text-[10px] font-bold text-ink px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: posColor }}
                        >
                          {player.POS_NOMBRE || 'DEF'}
                        </span>
                        {player.Precio && (
                          <span className="text-xs font-semibold text-success-soft tabular-nums">
                            {formatPriceShort(player.Precio)}
                          </span>
                        )}
                        {isUnavailable && (
                          <span className="text-[10px] font-semibold text-danger-soft bg-danger/10 px-1 py-0.5 rounded border border-danger/20">
                            Baja
                          </span>
                        )}
                      </div>
                    </div>

                    {/* OVR Pill */}
                    <div className="shrink-0">
                      <span className={`stat-value ${ovrColorClass} w-8 h-8 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center tabular-nums shadow-xs border border-black/25 !text-black shrink-0`}>
                        {ovr || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center bg-raised/30 rounded-lg border border-dashed border-line/20">
              <p className="text-sm text-ink-3 font-medium">No hay suplentes en la plantilla de este equipo.</p>
              <p className="text-xs text-ink-3 mt-1">Todos los jugadores disponibles están asignados al 11 titular.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── HISTORIAL DE MERCADO ── */}
      <section className="w-full max-w-6xl mx-auto px-4 pb-12">
        <div className="bg-surface rounded-xl border border-line/20 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm sm:text-base font-bold text-ink flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success-soft" /> Historial de Mercado
            </h2>
            <span className="text-xs text-ink-3">Últimos movimientos</span>
          </div>

          {transferHistory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {transferHistory.map((transfer, index) => {
                const isSale = transfer.fromTeamId === userId;
                return (
                  <div 
                    key={`${transfer.playerId}-${index}`} 
                    className="flex items-center justify-between gap-3 rounded-lg bg-raised/60 hover:bg-raised border border-line/15 p-2.5 transition"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-2">
                        {transfer.playerName || 'Jugador'}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${isSale ? 'text-warning-soft' : 'text-success-soft'}`}>
                        {isSale ? 'Venta de jugador' : 'Fichaje confirmado'}
                        {transfer.type === 'transfer' ? ' · Entre clubes' : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-ink tabular-nums bg-raised px-2 py-0.5 rounded border border-line/20">
                      ${Number(transfer.price || 0).toFixed(2)}M
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-3 italic py-2">Todavía no hay movimientos de mercado registrados para este club.</p>
          )}
        </div>
      </section>

      {/* ── FOOTER EDITORIAL OFICIAL ── (the league site has its own footer) */}
      {!isLeagueSite && (
        <footer className="mt-auto py-5 border-t border-line/20 text-center bg-slate-950">
          <p className="text-xs text-ink-3 font-normal">
            SCL Draft 2026 • Argentina
          </p>
        </footer>
      )}
    </div>
  );
}
