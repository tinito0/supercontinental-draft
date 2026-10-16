import React, { useState, useEffect, useMemo, memo } from 'react';
import { RefreshCw, Search, X, ClipboardList, Download, Package, Loader2 } from 'lucide-react';
import { FORMATIONS } from '../../utils/constants.js';
import { layoutForState, normalizeFormationStates } from '../../utils/formationStates.js';
import { loadDraftTeams } from '../../services/draftTeamsService.js';

export const TemplateAdminSection = memo(function TemplateAdminSection({
  showStatusMessage,
}) {
  const [teamsData, setTeamsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. CARGA DE DATOS: el mismo cargador que usa el traspaso al juego (services/draftTeamsService.js),
  // así el CSV y el EDIT exportan exactamente los mismos datos (formación, estados tácticos, instrucciones).
  const fetchData = async () => {
    setIsLoading(true);
    try {
      setTeamsData(await loadDraftTeams());
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error cargando datos de plantillas.');
    }
    setIsLoading(false);
  };

  const [pesExportModalTeam, setPesExportModalTeam] = useState(null);
  const [targetPesTeamId, setTargetPesTeamId] = useState(103);
  const [targetTeamName, setTargetTeamName] = useState('');
  const [targetTeamNationality, setTargetTeamNationality] = useState(204);
  const [targetCoachName, setTargetCoachName] = useState('Director Técnico');
  const [targetCoachNationality, setTargetCoachNationality] = useState(204);
  const [countryOptions, setCountryOptions] = useState([]);
  const [isExportingPes, setIsExportingPes] = useState(false);
  const [exportProgressStatus, setExportProgressStatus] = useState('');
  const [exportPercent, setExportPercent] = useState(null);

  useEffect(() => {
    fetch('/paises.json')
      .then(res => res.json())
      .then(data => {
        const list = Object.entries(data)
          .map(([id, name]) => ({ id: Number(id), name }))
          .filter(c => c.id > 0 && c.name && c.name !== 'N/A')
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountryOptions(list);
      })
      .catch(() => {});
  }, []);

  const handleDownloadPesZip = async () => {
    if (!pesExportModalTeam) return;
    setIsExportingPes(true);
    setExportProgressStatus('Cargando base de datos maestra...');
    setExportPercent(null);
    try {
      // Importación perezosa (lazy) de la utilidad de exportación y la base de 19MB solo al solicitar exportar
      const { exportTeamToPesZip } = await import('../../utils/pesExport.js');
      const result = await exportTeamToPesZip(
        pesExportModalTeam,
        targetPesTeamId,
        targetCoachName,
        targetTeamName,
        targetCoachNationality,
        targetTeamNationality,
        (progress) => {
          if (progress?.percent != null) {
            setExportPercent(progress.percent);
            setExportProgressStatus(`Descargando base de datos (${progress.percent}%)...`);
          } else {
            setExportProgressStatus('Procesando datos de PES...');
          }
        }
      );
      const notes = [];
      if (result.filledSlots?.length > 0) {
        const slots = result.filledSlots.map(f => `${f.pos} → ${f.player.Name || f.player.Id}`).join(', ');
        notes.push(`${result.filledSlots.length} puesto(s) sin titular se completaron con el plantel (${slots})`);
      }
      if (result.missingPlayers?.length > 0) {
        notes.push(`${result.missingPlayers.length} jugador(es) no estaban en el CSV maestro y se exportaron con valores base`);
      }
      if (notes.length > 0) {
        showStatusMessage('warning', `Option File exportado. Nota: ${notes.join('; ')}.`);
      } else {
        showStatusMessage('success', `Option File (${targetTeamName || pesExportModalTeam.name}) exportado correctamente para PES (ID ${targetPesTeamId}).`);
      }
      setPesExportModalTeam(null);
    } catch (err) {
      console.error('Error exportando PES zip:', err);
      showStatusMessage('error', 'Error al generar Option File PES: ' + (err?.message || ''));
    } finally {
      setIsExportingPes(false);
      setExportProgressStatus('');
      setExportPercent(null);
    }
  };

  // 2. Generación de PDF (adaptado a la nueva estructura 'layout')
  // jsPDF + autotable (~400 kB) se cargan al pedir el primer PDF, no al abrir Administración.
  const generatePDF = async (team) => {
    if (!team.players || !Array.isArray(team.players)) {
      showStatusMessage('error', 'Este equipo no tiene datos de jugadores válidos.');
      return;
    }
    let jsPDF;
    let autoTable;
    try {
      [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    } catch (err) {
      console.error(err);
      showStatusMessage('error', 'No se pudo cargar el generador de PDF. Revisá la conexión y probá de nuevo.');
      return;
    }

    const doc = new jsPDF();

    // --- HEADER ---
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(`Reporte de Plantilla: ${team.name}`, 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`ID Equipo: ${team.id}`, 14, 28);

    const formationKey = FORMATIONS[team.formation] ? team.formation : '4-3-3';
    const currentFormation = FORMATIONS[formationKey];
    doc.text(`Esquema Táctico: ${currentFormation.name}`, 14, 34);
    // Roles as played at kick-off, including the ones the manager changed on the tactics board.
    const kickOffLayout = layoutForState(currentFormation, normalizeFormationStates(team.formationStates, formationKey, currentFormation), 'base');

    // --- Procesamiento de alineación ---
    const starters = [];
    const usedPlayerIds = new Set();

    if (currentFormation.layout) {
      kickOffLayout.forEach((slot, index) => {
        const posLabel = slot.pos;
        const playerId = team.lineup[index];

        if (playerId) {
          const player = team.players.find(p => String(p.Id) === String(playerId));
          if (player) {
            starters.push({
              posTactical: posLabel,
              dorsal: team.dorsals[player.Id] || '-',
              name: player.Name,
              id: player.Id,
              naturalPos: player.POS_NOMBRE,
              ovr: player.OVR_CALCULADO,
            });
            usedPlayerIds.add(String(player.Id));
          } else {
            starters.push({ posTactical: posLabel, dorsal: '-', name: '(Vendido/No Disponible)', id: '-', naturalPos: '-', ovr: '-' });
          }
        } else {
          starters.push({ posTactical: posLabel, dorsal: '-', name: '(Posición Vacía)', id: '-', naturalPos: '-', ovr: '-' });
        }
      });
    }

    // --- PROCESAMIENTO DE SUPLENTES ---
    const subs = team.players
      .filter(p => !usedPlayerIds.has(String(p.Id)))
      .map(p => ({
        dorsal: team.dorsals[p.Id] || '-',
        name: p.Name,
        id: p.Id,
        naturalPos: p.POS_NOMBRE,
        ovr: p.OVR_CALCULADO,
      }))
      .sort((a, b) => {
        const dA = parseInt(a.dorsal) || 999;
        const dB = parseInt(b.dorsal) || 999;
        return dA - dB;
      });

    // --- TABLA TITULARES ---
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('11 INICIAL (Posicionamiento en Cancha)', 14, 45);

    autoTable(doc, {
      startY: 50,
      head: [['Rol', '#', 'Jugador', 'ID (Juego)', 'Pos', 'Val']],
      body: starters.map(r => [r.posTactical, r.dorsal, r.name, r.id, r.naturalPos, r.ovr]),
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], halign: 'center' },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
        3: { fontStyle: 'italic', fontSize: 9, cellWidth: 30 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 },
      },
      styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
    });

    // --- TABLA SUPLENTES ---
    let finalY = doc.lastAutoTable.finalY + 15;

    if (finalY > 250) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(12);
    doc.text(`BANQUILLO (${subs.length} Jugadores)`, 14, finalY);

    if (subs.length > 0) {
      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Jugador', 'ID (Juego)', 'Pos', 'Val']],
        body: subs.map(r => [r.dorsal, r.name, r.id, r.naturalPos, r.ovr]),
        theme: 'striped',
        headStyles: { fillColor: [127, 140, 141] },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 15 },
          2: { fontStyle: 'italic', fontSize: 9, cellWidth: 30 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 15 },
        },
        styles: { fontSize: 10, valign: 'middle' },
      });
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text('No hay jugadores en el banquillo.', 14, finalY + 10);
    }

    doc.save(`Plantilla_${team.name.replace(/\s+/g, '_')}_Tactico.pdf`);
  };

  const filteredTeamsData = useMemo(() => {
    if (!searchTerm.trim()) return teamsData;
    const term = searchTerm.toLowerCase().trim();
    return teamsData.filter(t => (t.name && t.name.toLowerCase().includes(term)) || (t.id && t.id.toLowerCase().includes(term)));
  }, [teamsData, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Exportación de plantillas tácticas a PDF y Option File para PES 2021.</p>
        <button onClick={fetchData} className="text-accent text-xs flex items-center hover:underline self-end sm:self-auto">
          <RefreshCw size={12} className="mr-1" /> Recargar Plantillas
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filtrar por club o ID..."
          className="w-full bg-canvas border border-line/[0.12] rounded-xl pl-9 pr-8 py-2.5 text-xs text-ink placeholder-slate-500 outline-none focus:border-accent/50"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink">
            <X size={14} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center p-8">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-ink-3 text-xs">Recopilando datos de todos los equipos...</p>
        </div>
      ) : teamsData.length === 0 ? (
        <div className="text-center p-8 text-ink-3 text-xs border border-dashed border-line/[0.12] rounded-xl">
          No hay datos cargados. Pulsa "Recargar Plantillas".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTeamsData.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-ink-3 text-xs border border-dashed border-line/[0.12] rounded-xl">
              No se encontraron plantillas para "{searchTerm}".
            </div>
          ) : (
            filteredTeamsData.map(team => (
              <div key={team.id} className="bg-surface border border-line/[0.12] rounded-xl p-4 hover:border-accent/30 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-ink text-base">{team.name}</h4>
                    <p className="text-[10px] text-ink-3 font-mono">ID: {team.id.substring(0, 8)}</p>
                  </div>
                  <span className="bg-accent/10 text-accent-soft text-[11px] font-bold px-2 py-0.5 rounded-lg border border-accent/20">
                    {team.players.length} Jugadores
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-3 mb-4">
                  <span className="flex items-center"><ClipboardList size={12} className="mr-1" /> {FORMATIONS[team.formation]?.name || team.formation}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => generatePDF(team)}
                    className="bg-white/[0.04] hover:bg-white/[0.08] text-ink py-2 rounded-xl text-xs font-bold flex items-center justify-center transition border border-line/[0.12] active:scale-95"
                  >
                    <Download size={14} className="mr-1.5" /> PDF Táctico
                  </button>
                  <button
                    onClick={() => {
                      setPesExportModalTeam(team);
                      setTargetPesTeamId(103);
                      setTargetTeamName(team.name || '');
                      setTargetTeamNationality(team.country || 204);
                      setTargetCoachName(team.name ? `DT ${team.name}` : 'Director Técnico');
                      setTargetCoachNationality(204);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    <Package size={14} className="mr-1.5" /> Exportar PES (.zip)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODAL EXPORTAR PES OPTION FILE ── */}
      {pesExportModalTeam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface border border-line/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-line/20">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-accent" />
                <h3 className="text-base font-bold text-ink">Exportar Option File PES</h3>
              </div>
              <button onClick={() => setPesExportModalTeam(null)} className="text-ink-3 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-ink-2 bg-blue-950/40 border border-blue-800/40 p-3 rounded-xl space-y-1">
              <p className="font-bold text-blue-300">Equipo Original: {pesExportModalTeam.name}</p>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Genera un ZIP con <span className="text-accent-soft font-mono">Team.csv</span>, <span className="text-accent-soft font-mono">Roster.csv</span>, <span className="text-accent-soft font-mono">Players.csv</span>, <span className="text-accent-soft font-mono">Coach.csv</span>, <span className="text-accent-soft font-mono">Appearances.csv</span> y <span className="text-accent-soft font-mono">Formation.csv</span> listo para PES 2021.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink-2 mb-1">
                    Nombre del Club en PES
                  </label>
                  <input
                    type="text"
                    value={targetTeamName}
                    onChange={(e) => setTargetTeamName(e.target.value)}
                    maxLength={32}
                    className="w-full bg-black/60 border border-line/20 focus:border-accent rounded-lg px-3 py-2 text-ink text-sm outline-none"
                    placeholder="Ej: Liverpool FC, Boca Juniors, etc."
                  />
                  <span className="text-[10px] text-ink-3">Nombre en PES (máx. 32 car.).</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-2 mb-1">
                    Nacionalidad / País del Club
                  </label>
                  <select
                    value={targetTeamNationality}
                    onChange={(e) => setTargetTeamNationality(Number(e.target.value))}
                    className="w-full bg-black/60 border border-line/20 focus:border-accent rounded-lg px-2.5 py-2 text-ink text-xs outline-none cursor-pointer"
                  >
                    {countryOptions.length > 0 ? (
                      countryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                      ))
                    ) : (
                      <option value={204}>Inglaterra (ID: 204)</option>
                    )}
                  </select>
                  <span className="text-[10px] text-ink-3">País asignado al equipo en Team.csv.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-2 mb-1">
                  ID del Club PES a reemplazar
                </label>
                <input
                  type="number"
                  value={targetPesTeamId}
                  onChange={(e) => setTargetPesTeamId(Number(e.target.value))}
                  className="w-full bg-black/60 border border-line/20 focus:border-accent rounded-lg px-3 py-2 text-ink text-sm font-mono outline-none"
                  placeholder="Ej: 103 (Liverpool), etc."
                />
                <span className="text-[10px] text-ink-3">Ejemplo: 103 para reemplazar Liverpool FC o el ID del club deseado.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-ink-2 mb-1">
                    Nombre del DT
                  </label>
                  <input
                    type="text"
                    value={targetCoachName}
                    onChange={(e) => setTargetCoachName(e.target.value)}
                    className="w-full bg-black/60 border border-line/20 focus:border-accent rounded-lg px-3 py-2 text-ink text-sm outline-none"
                    placeholder="Director Técnico"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-ink-2 mb-1">
                    Nacionalidad del DT
                  </label>
                  <select
                    value={targetCoachNationality}
                    onChange={(e) => setTargetCoachNationality(Number(e.target.value))}
                    className="w-full bg-black/60 border border-line/20 focus:border-accent rounded-lg px-2.5 py-2 text-ink text-xs outline-none cursor-pointer"
                  >
                    {countryOptions.length > 0 ? (
                      countryOptions.map(c => (
                        <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                      ))
                    ) : (
                      <option value={204}>Inglaterra (ID: 204)</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {isExportingPes && (
              <div className="bg-accent-deep/40 border border-accent-deep/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-accent-soft">
                  <span className="flex items-center gap-2 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent shrink-0" />
                    {exportProgressStatus || 'Descargando base de datos...'}
                  </span>
                  {exportPercent !== null && (
                    <span className="font-mono font-bold text-accent-soft">{exportPercent}%</span>
                  )}
                </div>
                {exportPercent !== null && (
                  <div className="w-full bg-accent-deep/80 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-150 ease-out"
                      style={{ width: `${exportPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPesExportModalTeam(null)}
                disabled={isExportingPes}
                className="flex-1 bg-raised hover:bg-overlay disabled:opacity-50 text-ink-2 py-2.5 rounded-xl font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDownloadPesZip}
                disabled={isExportingPes}
                className="btn btn-primary flex-1"
              >
                {isExportingPes ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {exportPercent !== null ? `${exportPercent}%` : 'Procesando...'}</>
                ) : (
                  <><Download className="w-4 h-4" /> Descargar ZIP</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TemplateAdminSection;
