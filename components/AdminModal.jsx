import React, { useState, memo } from 'react';
import { Settings, Users, Trophy, FileText, MessageSquarePlus } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Tabs } from './ui/Tabs.jsx';
import {
  SuggestionsAdminSection,
  GeneralAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  OverlayAdminSection,
  TournamentBroadcastAdminSection,
} from './admin/index.js';
import { normalizeAdminTab, readStoredAdminTab, storeAdminTab } from '../utils/adminTabs.js';

export {
  SuggestionsAdminSection,
  GeneralAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  OverlayAdminSection,
  TournamentBroadcastAdminSection,
};

const ADMIN_TABS = [
  { id: 'general', label: 'Configuración', icon: Settings },
  { id: 'equipos', label: 'Equipos y usuarios', icon: Users },
  { id: 'torneo', label: 'Torneo y transmisión', icon: Trophy },
  { id: 'templates', label: 'Plantillas', icon: FileText },
  { id: 'suggestions', label: 'Buzón', icon: MessageSquarePlus },
];

export const AdminModal = memo(function AdminModal({
  isVisible,
  isPage,
  onClose,
  tournamentData,
  onUpdateTournament,
  onOpenTournamentModal,
  initialTab,
  ...props
}) {
  // Vuelve a la última sección: abrir el gestor del torneo cierra este modal y antes se volvía a Configuración.
  const [activeTab, setActiveTab] = useState(() => normalizeAdminTab(initialTab || readStoredAdminTab()));
  const changeTab = (tab) => {
    setActiveTab(tab);
    storeAdminTab(tab);
  };

  const tabs = <Tabs tabs={ADMIN_TABS} value={activeTab} onChange={changeTab} label="Secciones de administración" />;
  const section = (
    <>
      {activeTab === 'general' && <GeneralAdminSection {...props} />}
      {activeTab === 'equipos' && <TeamsAdminSection {...props} />}
      {activeTab === 'torneo' && (
        <TournamentBroadcastAdminSection
          tournamentData={tournamentData}
          allTeams={props.allTeams}
          broadcastOverlayData={props.broadcastOverlayData}
          onUpdateBroadcastOverlay={props.onUpdateBroadcastOverlay}
          onOpenTournamentModal={onOpenTournamentModal}
          showStatusMessage={props.showStatusMessage}
        />
      )}
      {activeTab === 'templates' && <TemplateAdminSection {...props} />}
      {activeTab === 'suggestions' && <SuggestionsAdminSection {...props} />}
    </>
  );

  if (!isVisible && !isPage) return null;

  if (isPage) {
    return (
      <Page className="pb-16">
        <PageHeader eyebrow="Gestión" title="Administración" description="Configuración de la liga, equipos y usuarios, torneo y transmisión." />
        {tabs}
        <div>{section}</div>
      </Page>
    );
  }

  return (
    <BaseModal isOpen={true} onClose={onClose} size="xl" title="Administración" icon={Settings}
      className="h-[100dvh] sm:h-[90vh] !max-w-5xl" contentClassName="p-4 sm:p-6 space-y-5">
      {tabs}
      <div>{section}</div>
    </BaseModal>
  );
});

export default AdminModal;
