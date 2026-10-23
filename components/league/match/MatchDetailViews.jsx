import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { BallIcon } from './BallIcon.jsx';
import { Tabs } from '../../ui/Tabs.jsx';
import { CardMark } from './MatchParts.jsx';

/* Alineaciones y tabla de jugadores del partido (screens/league/LeagueMatchScreen.jsx). Datos: utils/matchCenter.js.
   Las estadísticas de equipo están en MatchStatSections.jsx. */

export function PlayerPhoto({ id, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  // A photo that already failed elsewhere on the page (same URL, cached failure) may never reach React's onError:
  // check it on mount and listen on the element itself too.
  const checkLoaded = img => {
    if (!img) return;
    const check = () => { if (img.complete && img.naturalWidth === 0) setFailed(true); };
    check();
    img.addEventListener('error', () => setFailed(true), { once: true });
    img.addEventListener('load', check, { once: true });
  };
  if (failed) return <span className="shrink-0 rounded-full bg-raised" style={box} aria-hidden="true" />;
  return (
    <img ref={checkLoaded} src={`/fotos_jugadores/${id}.webp`} alt="" width={size} height={size} loading="lazy" style={box}
      className="shrink-0 rounded-full bg-raised object-cover" onError={() => setFailed(true)} />
  );
}

function PlayerMarks({ player }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-ink-3">
      {Array.from({ length: player.goals }, (_, i) => <span key={`g${i}`} role="img" aria-label="Gol" className="inline-flex"><BallIcon className="h-4 w-4" /></span>)}
      {Array.from({ length: player.ownGoals || 0 }, (_, i) => <span key={`o${i}`} role="img" aria-label="Gol en contra" className="inline-flex rounded-full ring-2 ring-danger"><BallIcon className="h-4 w-4" /></span>)}
      {player.assists > 0 && <span title="Asistencias" className="num">A{player.assists > 1 ? player.assists : ''}</span>}
      {player.cards.map((card, i) => <CardMark key={`c${i}`} type={card} />)}
      {player.subbedOff && <span className="flex items-center"><ArrowDown className="h-3.5 w-3.5 text-danger-soft" aria-label="Salió" /><span className="num">{player.subbedOff}</span></span>}
      {player.subbedOn && <span className="flex items-center"><ArrowUp className="h-3.5 w-3.5 text-success-soft" aria-label="Entró" /><span className="num">{player.subbedOn}</span></span>}
    </span>
  );
}

function LineupColumn({ title, lineup }) {
  return (
    <section className="min-w-0" aria-label={title}>
      <h3 className="section-title mb-2 truncate">{title}</h3>
      <ul className="divide-y divide-line/10">
        {lineup.starting.map(player => (
          <li key={player.id} className="flex items-center gap-3 py-2 min-h-11">
            <PlayerPhoto id={player.id} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{player.name}</span>
            <PlayerMarks player={player} />
          </li>
        ))}
      </ul>
      {lineup.substitutes.length > 0 && (
        <>
          <h4 className="eyebrow mt-4 mb-1">Entraron</h4>
          <ul className="divide-y divide-line/10">
            {lineup.substitutes.map(player => (
              <li key={player.id} className="flex items-center gap-3 py-2 min-h-11">
                <PlayerPhoto id={player.id} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{player.name}<span className="block truncate text-xs text-ink-3">por {player.replaced}</span></span>
                <PlayerMarks player={player} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function MatchLineups({ lineups, match }) {
  if (!lineups.home.starting.length && !lineups.away.starting.length) {
    return <p className="panel px-4 py-8 text-center text-sm text-ink-3">Las alineaciones aparecen al arrancar el partido.</p>;
  }
  return (
    <div className="panel grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
      <LineupColumn title={match.home.name} lineup={lineups.home} />
      <LineupColumn title={match.away.name} lineup={lineups.away} />
    </div>
  );
}

const PLAYER_COLUMNS = [
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias' },
  { key: 'shots', label: 'Tiros', title: 'Tiros (al arco)', render: r => `${r.shots} (${r.shotsOnTarget})` },
  { key: 'passes', label: 'Pases', title: 'Pases completados / totales', render: r => `${r.passesCompleted}/${r.passes}` },
  { key: 'dribbles', label: 'Gamb.', title: 'Gambetas logradas / intentadas', render: r => `${r.dribblesCompleted}/${r.dribbles}` },
  { key: 'tacklesWon', label: 'Entr.', title: 'Entradas ganadas' },
  { key: 'interceptions', label: 'Int.', title: 'Intercepciones' },
  { key: 'saves', label: 'Ataj.', title: 'Atajadas' },
];

export function PlayerStatsTable({ rows, match }) {
  const [side, setSide] = useState('home');
  const [sortKey, setSortKey] = useState('goals');
  if (!rows.length) return <p className="panel px-4 py-8 text-center text-sm text-ink-3">Las estadísticas de los jugadores aparecen al arrancar el partido.</p>;
  const visible = rows.filter(row => row.side === side).sort((a, b) => (b[sortKey] - a[sortKey]) || a.name.localeCompare(b.name, 'es'));
  return (
    <div className="panel p-0">
      <div className="p-3">
        <Tabs
          label="Equipo"
          value={side}
          onChange={setSide}
          tabs={[{ id: 'home', label: match.home.name }, { id: 'away', label: match.away.name }]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th scope="col" className="text-left">Jugador</th>
              {PLAYER_COLUMNS.map(column => (
                <th key={column.key} scope="col" className="text-right" aria-sort={sortKey === column.key ? 'descending' : 'none'}>
                  <button type="button" title={column.title} onClick={() => setSortKey(column.key)}
                    className={`min-h-11 px-1 ${sortKey === column.key ? 'text-ink' : ''}`}>
                    {column.label}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.id}>
                <th scope="row" className="text-left font-medium text-ink">
                  <span className="flex items-center gap-2 min-w-0"><PlayerPhoto id={row.id} /><span className="truncate">{row.name}</span></span>
                </th>
                {PLAYER_COLUMNS.map(column => (
                  <td key={column.key} className="num text-right text-ink-2">{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
