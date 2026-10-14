import React, { useState, useEffect, memo } from 'react';
import { Lock, LogOut, MessageSquarePlus } from 'lucide-react';

export const MaintenanceScreen = memo(function MaintenanceScreen({ marketStatus, onLogout, onSuggestionsClick }) {
  const [openTime, setOpenTime] = useState(null);

  useEffect(() => {
    if (marketStatus.status === 'scheduled' && marketStatus.openTime) {
      const date = new Date(marketStatus.openTime);
      setOpenTime(date.toLocaleString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }));
    } else {
      setOpenTime(null);
    }
  }, [marketStatus]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-canvas relative overflow-hidden">
      {/* Efecto de fondo: Barras de precaución sutiles */}
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fbbf24 0, #fbbf24 10px, transparent 10px, transparent 20px)' }}></div>

      <div className="w-full max-w-lg p-10 text-center bg-surface/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-warning/20 relative z-10">

        {/* ICONO CENTRAL ANIMADO */}
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse-slow rounded-full"></div>
          <div className="relative bg-raised p-6 rounded-full border border-warning/30 shadow-inner">
            <Lock className="w-16 h-16 text-yellow-500" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-ink mb-2 tracking-tight">Mercado Cerrado</h1>

        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-8 inline-block w-full">
          <p className="text-yellow-200 text-sm font-medium leading-relaxed">
            {openTime
              ? <>El mercado abrirá nuevamente el:<br /><strong className="text-lg text-warning-soft block mt-1">{openTime}</strong></>
              : "El mercado se encuentra en mantenimiento o pausa administrativa. Atento al grupo para novedades."
            }
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onSuggestionsClick}
            className="w-full flex items-center justify-center px-6 py-3.5 bg-raised hover:bg-overlay text-ink font-bold rounded-xl transition border border-line/[0.12] hover:border-white/20 group cursor-pointer"
          >
            <MessageSquarePlus className="w-5 h-5 mr-2 text-accent group-hover:scale-110 transition-transform" />
            Enviar Reporte / Sugerencia
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center px-6 py-3.5 text-ink-3 hover:text-danger-soft font-medium rounded-xl transition hover:bg-danger/10 cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
});