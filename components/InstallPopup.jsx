import React, { memo } from 'react';
import { Download } from 'lucide-react';

export const InstallPopup = memo(({ isVisible, onInstall, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-[#0f172a] border border-blue-500/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(59,130,246,0.2)] relative overflow-hidden animate-in slide-in-from-bottom-10 zoom-in-95 duration-500">

        {/* Efectos de Fondo */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-500/20 blur-[50px] rounded-full pointer-events-none"></div>

        {/* Icono */}
        <div className="mb-5 flex justify-center relative z-10">
          <div className="p-4 bg-gradient-to-br from-gray-800 to-black rounded-2xl border border-gray-700 shadow-xl group">
            <Download size={32} className="text-blue-400 group-hover:scale-110 transition-transform duration-300" />
          </div>
        </div>

        {/* Textos */}
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Instalar App</h3>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Añadí <span className="text-blue-300 font-bold">SCL Draft</span> a tu inicio para una experiencia a pantalla completa, sin barras de navegador y más fluida.
        </p>

        {/* Botones */}
        <div className="space-y-3 relative z-10">
          <button
            onClick={onInstall}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/30 active:scale-95 flex items-center justify-center"
          >
            <Download size={18} className="mr-2" /> Instalar Ahora
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-500 text-sm font-bold hover:text-white transition-colors"
          >
            Quizás más tarde
          </button>
        </div>
      </div>
    </div>
  );
});
