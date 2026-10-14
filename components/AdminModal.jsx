import React, { useState, memo } from 'react';
import { Settings, Users, Shield, Trophy, FileText, Radio, MessageSquarePlus } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Tabs } from './ui/Tabs.jsx';
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

const ADMIN_TABS = [
  { id: 'general', label: 'Configuración', icon: Settings },
  { id: 'equipos', label: 'Equipos', icon: Shield },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'torneo', label: 'Torneo y OBS', icon: Trophy },
  { id: 'templates', label: 'Plantillas', icon: FileText },
  { id: 'overlay', label: 'Marcador en vivo', icon: Radio },
  { id: 'suggestions', label: 'Buzón', icon: MessageSquarePlus },
];

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

  const tabs = <Tabs tabs={ADMIN_TABS} value={activeTab} onChange={setActiveTab} label="Secciones de administración" />;
  const section = (
    <>
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
    </>
  );

  if (!isVisible && !isPage) return null;

  if (isPage) {
    return (
      <Page className="pb-16">
        <PageHeader eyebrow="Gestión" title="Administración" description="Configuración de la liga, clubes, usuarios, torneo y transmisión." />
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
