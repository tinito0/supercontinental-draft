import React, { useState, memo } from 'react';
import { X, Settings, Users, Shield, Trophy, FileText, Radio, MessageSquarePlus } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { TournamentTabButton } from './TournamentUI.jsx';
import {
  SuggestionsAdminSection,
  GeneralAdminSection,
  WhitelistAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  OverlayAdminSection,
  TorneoAdminSection,
} from './admin/index.js';

export {
  SuggestionsAdminSection,
  GeneralAdminSection,
  WhitelistAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  OverlayAdminSection,
  TorneoAdminSection,
};

export const AdminModal = memo(function AdminModal({
  isVisible,
  isPage,
  onClose,
  tournamentData,
  onUpdateTournament,
  onOpenTournamentModal,
  ...props
}) {
  const [activeTab, setActiveTab] = useState('general');
  const TabButton = ({ tabId, label, icon: Icon }) => (
    <TournamentTabButton id={tabId} label={label} icon={Icon} activeTab={activeTab} onClick={setActiveTab} />
  );

  const content = (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#0c1017]">
      <div className="flex justify-between items-center p-4 sm:p-5 border-b border-white/[0.08] bg-[#0c1017] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-wide">Panel de Administración</h2>
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 border border-sky-500/25 text-sky-400">
              v2.6.0
            </span>
          </div>
          {!isPage && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Pestañas de administración */}
        <div className="flex border-b border-white/[0.08] bg-[#080c14] px-2 sm:px-4 overflow-x-auto">
          <TabButton tabId="general" label="Config" icon={Settings} />
          <TabButton tabId="equipos" label="Equipos" icon={Shield} />
          <TabButton tabId="users" label="Usuarios" icon={Users} />
          <TabButton tabId="torneo" label="Torneo & OBS" icon={Trophy} />
          <TabButton tabId="templates" label="Plantillas" icon={FileText} />
          <TabButton tabId="overlay" label="Marcador En Vivo" icon={Radio} />
          <TabButton tabId="suggestions" label="Buzón" icon={MessageSquarePlus} />
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar pb-20">
          {activeTab === 'general' && <GeneralAdminSection {...props} />}
          {activeTab === 'equipos' && <TeamsAdminSection {...props} />}
          {activeTab === 'users' && <WhitelistAdminSection {...props} />}
          {activeTab === 'torneo' && (
            <TorneoAdminSection
              tournamentData={tournamentData}
              allTeams={props.allTeams}
              onOpenTournamentModal={onOpenTournamentModal}
              showStatusMessage={props.showStatusMessage}
            />
          )}
          {activeTab === 'templates' && <TemplateAdminSection {...props} />}
          {activeTab === 'overlay' && <OverlayAdminSection {...props} />}
          {activeTab === 'suggestions' && <SuggestionsAdminSection {...props} />}
        </div>
    </div>
  );

  if (!isVisible && !isPage) return null;

  if (isPage) {
    return (
      <div className="w-full h-full flex flex-col animate-in fade-in duration-300 bg-[#06080d]">
        {content}
      </div>
    );
  }

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      size="xl"
      showClose={false}
      className="!p-0 !max-w-5xl !bg-transparent !border-0 !shadow-none"
      contentClassName="!p-0 !overflow-hidden flex flex-col"
    >
      {content}
    </BaseModal>
  );
});

export default AdminModal;
