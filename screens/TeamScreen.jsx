import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { Pitch } from '../components/Pitch.jsx';
import { FORMATIONS, DEFAULT_LOGO, APP_ID } from '../utils/constants.js';
import { layoutForState, normalizeFormationStates } from '../utils/formationStates.js';
import { Shield, Users, ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { processPlayersData, formatPriceShort } from '../utils/helpers.js';
import { fetchRawPlayers } from '../utils/playerCatalog.js';
import { teamCrestUrl } from '../utils/teamCrest.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { knockoutWinner, teamMatchResult } from '../utils/competitionRules.js';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Stat } from '../components/ui/Stat.jsx';
import { SquadSection, SquadRow } from '../components/formation/SquadList.jsx';
import { TeamStrength } from '../components/formation/TeamStrength.jsx';
import { franchiseIdsOf } from '../utils/franchisePlayers.js';

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
export default function TeamScreen({ isLeagueSite = false, afterHeader = null, hideHeader = false }) {
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
  const [teamRecord, setTeamRecord] = useState({ played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [], mvpCount: 0, rival: '', titles: 0 });
  const [transferHistory, setTransferHistory] = useState([]);
  // Jugador Franquicia: the market marks his lock (utils/franchisePlayers.js).
  const [franchiseIds, setFranchiseIds] = useState(() => new Set());
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
        const record = { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, form: [], mvpCount: 0, rival: '', titles: Number(data.titles) || 0 };
        if (tournamentSnap.exists() && normalizedTeamName) {
          const tournament = tournamentSnap.data();
          const rivals = {};
          // Solo partidos con marcador válido (antes un marcador vacío contaba 0-0). Un partido definido por penales
          // es empate en los 90' (así lo cuenta el registro del club); la tabla oficial le da el punto al ganador.
          (tournament.matches || []).forEach(match => {
            const outcome = teamMatchResult(data.teamName, match);
            if (!outcome) return;
            const { scored, conceded, opponent: rival } = outcome;
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
          // Ganador de la final de la Copa de Oro, con alargue y penales (antes una final por penales no daba título).
          const finalSide = final ? knockoutWinner(final) : null;
          const finalWinner = finalSide === 'A' ? final.teamA : finalSide === 'B' ? final.teamB : '';
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
        const teamLocks = [];
        try {
          const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
          locksSnap.forEach(docSnap => {
            const lock = docSnap.data();
            if (lock?.lockedBy === userId) {
              lockedPlayerIds.push(String(docSnap.id));
              teamLocks.push({ id: docSnap.id, ...lock });
            }
          });
          if (isMounted) setFranchiseIds(franchiseIdsOf(teamLocks));
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

  const shellHeight = hideHeader ? 'min-h-[40vh]' : 'min-h-screen';

  if (loading) {
    return <TeamScreenSkeleton className={shellHeight} hideHeader={hideHeader} />;
  }

  if (error || !teamData) {
    const isNetworkError = Boolean(error?.includes('conexión'));
    return (
      <div className={`${shellHeight} bg-canvas flex items-center justify-center p-4`}>
        <EmptyState
          icon={isNetworkError ? WifiOff : error ? Shield : Users}
          title={error || 'No se encontraron datos del equipo'}
          description={error ? 'No se pudieron recuperar los registros oficiales del club.' : 'El club todavía no configuró su plantilla pública.'}
          className="w-full max-w-md"
        >
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {error && <Button variant="primary" icon={RefreshCw} onClick={fetchTeam}>Reintentar</Button>}
            <Button icon={ArrowLeft} onClick={() => navigate('/')}>Volver al inicio</Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  // The starting formation as the team saved it (moved markers included); legacy teams use the plain layout.
  const formationKey = FORMATIONS[teamData?.formation] ? teamData.formation : '4-3-3';
  const currentFormation = {
    ...FORMATIONS[formationKey],
    layout: layoutForState(FORMATIONS[formationKey], normalizeFormationStates(teamData?.formationStates, formationKey, FORMATIONS[formationKey]), 'base'),
  };
  const playersById = new Map((cartPlayers || []).map(player => [String(player.Id), player]));
  const publicLineup = Object.fromEntries(
    Object.entries(teamData?.lineup || {}).filter(([, playerId]) => playersById.has(String(playerId)))
  );
  const publicSlots = Object.fromEntries(
    Object.entries(publicLineup).map(([idx, playerId]) => {
      const slot = currentFormation?.layout?.[Number(idx)];
      const player = playersById.get(String(playerId));
      return [idx, {
        playerId: String(player.Id),
        name: player.Name,
        pos: slot?.pos || player.POS_NOMBRE,
        ovr: player.OVR_CALCULADO,
        dorsal: teamData?.dorsals?.[playerId] || '',
      }];
    })
  );

  // The XI in kick-off order, as PES lists it: one row per slot, empty slots included.
  const starterRows = (currentFormation.layout || []).map((slot, index) => ({
    index,
    role: slot.pos,
    player: publicLineup[index] != null ? playersById.get(String(publicLineup[index])) : null,
  }));
  const starters = new Set(Object.values(publicLineup).map(String));
  const strengthStarters = starterRows.filter(row => row.player).map(row => ({ pos: row.role, ovr: row.player.OVR_CALCULADO }));

  // Bench: every squad player outside the XI, by line (defence, midfield, attack, keepers), then by OVR.
  const substitutes = cartPlayers
    .filter(player => !starters.has(String(player.Id)))
    .sort((a, b) => {
      const rankA = getPosRank(a.POS_NOMBRE);
      const rankB = getPosRank(b.POS_NOMBRE);
      if (rankA !== rankB) return rankA - rankB;
      return Number(b.OVR_CALCULADO || 0) - Number(a.OVR_CALCULADO || 0);
    });

  // Availability is saved by the tactics board in the team document; older rosters carry it per player.
  const isUnavailable = player => player.available === false || teamData?.availability?.[player.Id] === false;
  const unavailableCount = cartPlayers.filter(isUnavailable).length;
  const goalDiff = teamRecord.gf - teamRecord.ga;
  const dorsalOf = player => teamData?.dorsals?.[player.Id] || '';
  const recentForm = teamRecord.form.slice(-5);
  const isFranchise = player => franchiseIds.has(String(player.Id));
  const franchisePlayers = cartPlayers.filter(isFranchise);

  return (
    <div className={`${hideHeader ? '' : 'min-h-screen '}bg-canvas text-ink-2 flex flex-col selection:bg-accent/30`}>
      {/* The league site draws its own club header. */}
      {!hideHeader && (
        <header className="bg-surface border-b border-line/[0.12]">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-raised border border-line/[0.12] p-2.5">
              <img
                src={teamCrestUrl(teamData)}
                width={96}
                height={96}
                fetchpriority="high"
                className="w-full h-full object-contain"
                alt={`Escudo de ${teamData?.teamName || 'Equipo'}`}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_LOGO; }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Ficha del club</p>
              <h1 className="mt-1.5 font-display text-[32px] sm:text-[44px] font-bold leading-none text-ink tracking-tight break-words">
                {teamData?.teamName || 'Equipo'}
              </h1>
              <p className="mt-2.5 text-sm text-ink-3">
                <span className="font-display num text-base font-semibold text-ink-2">{teamData?.formation || '4-3-3'}</span>
                <span aria-hidden="true"> · </span>
                <span className="num">{cartPlayers.length}</span> jugadores
                {unavailableCount > 0 && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="font-semibold text-danger-soft"><span className="num">{unavailableCount}</span> {unavailableCount === 1 ? 'baja' : 'bajas'}</span>
                  </>
                )}
              </p>
              {franchisePlayers.length > 0 && (
                <p className="mt-1.5 text-sm">
                  <span className="font-semibold text-crest-soft">Franquicia</span>{' '}
                  <span className="text-ink-2">{franchisePlayers.map(player => player.Name).join(', ')}</span>
                </p>
              )}
            </div>
            <Button icon={ArrowLeft} onClick={handleBack} className="w-full sm:w-auto shrink-0">Volver atrás</Button>
          </div>
        </header>
      )}

      {afterHeader}

      <main className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6 animate-in fade-in">
        {/* Official record: plain numbers in a row, no tiles (docs/DESIGN_SYSTEM.md, principle 1). Draft only:
            the league site's squad tab leaves it out. */}
        {!isLeagueSite && (
        <section aria-labelledby="team-record-title" className="panel-flat px-4 py-5 sm:px-6">
          <h2 id="team-record-title" className="section-title">Récord oficial</h2>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5">
            <Stat label="Partidos" value={teamRecord.played} />
            <Stat label="G-E-P" value={`${teamRecord.wins}-${teamRecord.draws}-${teamRecord.losses}`} />
            <Stat label="Goles" value={`${teamRecord.gf}:${teamRecord.ga}`} hint={`Diferencia ${goalDiff > 0 ? `+${goalDiff}` : goalDiff}`} />
            <div className="min-w-0">
              <p className="eyebrow">Racha</p>
              {recentForm.length > 0 ? (
                <ol className="mt-2 flex gap-1" aria-label="Últimos cinco resultados">
                  {recentForm.map((res, i) => (
                    <li
                      key={i}
                      className={`w-7 h-7 rounded-md flex items-center justify-center font-display text-sm font-bold ${
                        res === 'G' ? 'bg-success/20 text-success-soft' : res === 'P' ? 'bg-danger/20 text-danger-soft' : 'bg-overlay text-ink-2'
                      }`}
                      title={res === 'G' ? 'Victoria' : res === 'P' ? 'Derrota' : 'Empate'}
                    >
                      {res}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-ink-3">Sin partidos</p>
              )}
            </div>
            <Stat label="Títulos SCL" value={teamRecord.titles} tone={teamRecord.titles > 0 ? 'warning' : 'default'} />
            <Stat label="Rival directo" value={<span className="block truncate" title={teamRecord.rival}>{teamRecord.rival || '–'}</span>} size="sm" />
          </div>
        </section>
        )}

        {/* Game plan, as PES lays it out: the squad list with the team strength beside the pitch. */}
        <section aria-labelledby="team-plan-title" className="panel-flat p-3 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h2 id="team-plan-title" className="section-title">Plan de juego</h2>
            <p className="text-sm text-ink-3">
              Formación <span className="font-display num text-base font-bold text-ink">{currentFormation.name || formationKey}</span>
            </p>
          </div>
          {cartPlayers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Plantel sin cargar"
              description="Este club todavía no tiene jugadores. Aparecen acá cuando ficha en el mercado."
              className="mt-4"
            />
          ) : (
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
              <div className="lg:order-2 w-full max-w-md mx-auto lg:sticky lg:top-4">
                <Pitch
                  formation={currentFormation}
                  lineup={publicLineup}
                  cart={[]}
                  dorsals={teamData?.dorsals || {}}
                  isReadOnly={true}
                  readOnlySlots={publicSlots}
                />
              </div>
              <div className="lg:order-1 min-w-0">
                <TeamStrength starters={strengthStarters} className="px-1" />
                <SquadSection title="Titulares" count={strengthStarters.length} hint="Puestos al inicio del partido">
                  {starterRows.map(({ index, role, player }) => (
                    <SquadRow
                      key={index}
                      role={role}
                      player={player}
                      number={player ? dorsalOf(player) : ''}
                      isUnavailable={player ? isUnavailable(player) : false}
                      isFranchise={player ? isFranchise(player) : false}
                    />
                  ))}
                </SquadSection>
                <SquadSection title="Suplentes" count={substitutes.length} hint="Por línea y OVR">
                  {substitutes.map(player => (
                    <SquadRow
                      key={player.Id}
                      role={player.POS_NOMBRE || '–'}
                      player={player}
                      number={dorsalOf(player)}
                      isUnavailable={isUnavailable(player)}
                      isFranchise={isFranchise(player)}
                    />
                  ))}
                </SquadSection>
                {substitutes.length === 0 && (
                  <p className="px-1 py-4 text-sm text-ink-3">Todo el plantel está en el once titular.</p>
                )}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="team-market-title" className="panel-flat p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="team-market-title" className="section-title">Mercado</h2>
            <p className="text-xs text-ink-3">Últimos movimientos</p>
          </div>
          {transferHistory.length > 0 ? (
            <ul className="mt-3 grid md:grid-cols-2 md:gap-x-8">
              {transferHistory.map((transfer, index) => {
                const isSale = transfer.fromTeamId === userId;
                return (
                  <li key={`${transfer.playerId}-${index}`} className="flex items-center justify-between gap-3 min-h-12 py-2 border-b border-line/[0.07]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{transfer.playerName || 'Jugador'}</p>
                      <p className={`text-xs font-medium mt-0.5 ${isSale ? 'text-warning-soft' : 'text-success-soft'}`}>
                        {isSale ? 'Venta' : 'Fichaje'}
                        {transfer.type === 'transfer' ? ' · entre clubes' : ''}
                      </p>
                    </div>
                    <span className="shrink-0 font-display num text-lg font-bold text-ink">
                      {formatPriceShort(Number(transfer.price || 0))}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-3">Todavía no hay movimientos de mercado registrados para este club.</p>
          )}
        </section>
      </main>

      {/* The league site has its own footer. */}
      {!isLeagueSite && (
        <footer className="mt-auto py-5 border-t border-line/[0.12] text-center bg-surface">
          <p className="text-xs text-ink-3">SCL Draft · Argentina</p>
        </footer>
      )}
    </div>
  );
}

/** Loading placeholder shaped like the page: header, record row, squad list beside the pitch. */
function TeamScreenSkeleton({ className, hideHeader }) {
  return (
    <div className={`${className} bg-canvas`} role="status" aria-label="Cargando la ficha del club">
      {!hideHeader && (
        <div className="bg-surface border-b border-line/[0.12]">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-5">
            <div className="skeleton w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-9 w-2/3 max-w-sm" />
              <div className="skeleton h-4 w-40" />
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="panel-flat px-4 py-5 sm:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2"><div className="skeleton h-3 w-16" /><div className="skeleton h-7 w-12" /></div>
          ))}
        </div>
        <div className="panel-flat p-3 sm:p-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="lg:order-2 skeleton w-full max-w-md mx-auto aspect-[3/4] rounded-xl" />
          <div className="lg:order-1 space-y-2">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-11 w-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
