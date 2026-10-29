import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, User, Zap, ArrowRight } from 'lucide-react';
import { getPosColorClass, getStatAndOvrColorClass } from '../utils/helpers.js';
import { useModalDialog } from '../hooks/useModalDialog.js';

export function CommandPalette({
  isOpen,
  onClose,
  allPlayers,
  onSelectPlayer,
  setActiveTab,
  openModalRoute
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const quickActions = useMemo(() => [
    { id: 'action-market', title: 'Ir al Mercado', icon: <Zap className="w-4 h-4" />, action: () => setActiveTab('market') },
    { id: 'action-club', title: 'Ir a Mi Club', icon: <Zap className="w-4 h-4" />, action: () => setActiveTab('my_club') },
    { id: 'action-formation', title: 'Ir a Formación', icon: <Zap className="w-4 h-4" />, action: () => openModalRoute('formation') },
    { id: 'action-tournament', title: 'Ver Torneo', icon: <Zap className="w-4 h-4" />, action: () => setActiveTab('Tournament') },
    { id: 'action-filters', title: 'Abrir Filtros', icon: <Zap className="w-4 h-4" />, action: () => openModalRoute('filters') },
    { id: 'action-chat', title: 'Chat de Managers', icon: <Zap className="w-4 h-4" />, action: () => openModalRoute('chat') }
  ], [setActiveTab, openModalRoute]);

  const filteredItems = useMemo(() => {
    const term = debouncedTerm.toLowerCase().trim();
    if (!term) return [];

    const matchedActions = quickActions.filter(action =>
      action.title.toLowerCase().includes(term)
    ).map(a => ({ ...a, type: 'action' }));

    const matchedPlayers = allPlayers
      .filter(p => p.Name && p.Name.toLowerCase().includes(term))
      .slice(0, 8)
      .map(p => ({ ...p, type: 'player' }));

    return [...matchedPlayers, ...matchedActions];
  }, [debouncedTerm, allPlayers, quickActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        if (selected.type === 'action') {
          selected.action();
          onClose();
        } else if (selected.type === 'player') {
          onSelectPlayer(selected.Id);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const panelRef = useRef(null);
  useModalDialog(panelRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/60 p-4 pt-[20vh]"
      onClick={onClose}
    >
      <div 
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar jugadores y acciones"
        tabIndex={-1}
        className="bg-raised border border-line/[0.12] rounded-2xl max-w-xl mx-auto shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-line/[0.12] relative">
          <Search className="w-5 h-5 text-ink-3 mr-3" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-lg text-ink placeholder:text-ink-3"
            placeholder="Buscar jugadores, acciones…"
            aria-label="Buscar jugadores y acciones"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex items-center gap-1 ml-3 px-2 py-1 rounded bg-white/5 border border-line/[0.12]">
            <span className="text-xs text-ink-3 font-medium">Ctrl K</span>
          </div>
        </div>

        {filteredItems.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              if (item.type === 'action') {
                return (
                  <div
                    key={item.id}
                    className={`flex items-center px-3 py-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/5'}`}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/[0.14] text-accent-soft flex items-center justify-center mr-3">
                      {item.icon}
                    </div>
                    <span className="text-ink flex-1">{item.title}</span>
                    <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-ink' : 'text-ink-3'}`} />
                  </div>
                );
              }

              // Player item
              return (
                <div
                  key={item.Id}
                  className={`flex items-center px-3 py-2 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/5'}`}
                  onClick={() => {
                    onSelectPlayer(item.Id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mr-3">
                    <User className="w-4 h-4 text-ink-2" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="text-ink text-sm font-medium">{item.Name}</span>
                    <span className="text-ink-3 text-xs">{item.Country1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPosColorClass(item.POS_NOMBRE)}`}>
                      {item.POS_NOMBRE}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatAndOvrColorClass(item.OVR_CALCULADO)}`}>
                      {item.OVR_CALCULADO}
                    </span>
                    <span className="text-success-soft font-medium text-sm ml-2">
                      ${(item.Precio || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {debouncedTerm && filteredItems.length === 0 && (
          <div className="p-8 text-center text-ink-3">
            No se encontraron resultados para "{debouncedTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
