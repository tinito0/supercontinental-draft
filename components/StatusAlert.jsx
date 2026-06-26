import React, { memo } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

export const StatusAlert = memo(function StatusAlert({ type, message, onClose }) {
  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const Icon = type === 'success' ? CheckCircle : AlertTriangle;

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg text-white font-semibold shadow-2xl transition-opacity duration-300 flex items-center z-50 ${bgColor}`}>
      <Icon className="w-5 h-5 mr-2" />
      {message}
      <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white/20">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
});
