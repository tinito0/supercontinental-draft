import React, { useState, memo, lazy, Suspense } from 'react';
import { Settings, Users, Trophy, FileText, MessageSquarePlus, Globe, Vote } from 'lucide-react';
import { BaseModal } from './ui/BaseModal.jsx';
import { Page } from './ui/Page.jsx';
import { PageHeader } from './ui/PageHeader.jsx';
import { Tabs } from './ui/Tabs.jsx';
import {
  SuggestionsAdminSection,
  GeneralAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  ObsSceneStudio,
  TournamentBroadcastAdminSection,
} from './admin/index.js';
import { normalizeAdminTab, readStoredAdminTab, storeAdminTab } from '../utils/adminTabs.js';

export {
  SuggestionsAdminSection,
  GeneralAdminSection,
  TeamsAdminSection,
  TemplateAdminSection,
  ObsSceneStudio,
  TournamentBroadcastAdminSection,
};

// Texts of the public league site; only loaded when that tab opens.
const LeagueContentAdminSection = lazy(() => import('./admin/LeagueContentAdminSection.jsx'));
// Votos del público (predicción, MVP, encuestas de las copas).
const CommunityAdminSection = lazy(() => import('./admin/CommunityAdminSection.jsx'));

const ADMIN_TABS = [
  { id: 'general', label: 'Configuración', icon: Settings },
  { id: 'equipos', label: 'Equipos y usuarios', icon: Users },
  { id: 'torneo', label: 'Torneo y transmisión', icon: Trophy },
  { id: 'comunidad', label: 'Comunidad', icon: Vote },
  { id: 'web', label: 'Web pública', icon: Globe },
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
  allowedTabs,
  ...props
}) {
  // Un editor de la web pública (no admin) recibe allowedTabs={['web']}: ve solo esa sección.
  const visibleTabs = allowedTabs ? ADMIN_TABS.filter(tab => allowedTabs.includes(tab.id)) : ADMIN_TABS;
  const isEditorOnly = Boolean(allowedTabs);
  // Vuelve a la última sección: abrir el gestor del torneo cierra este modal y antes se volvía a Configuración.
  const [storedTab, setActiveTab] = useState(() => normalizeAdminTab(initialTab || readStoredAdminTab()));
  const activeTab = visibleTabs.some(tab => tab.id === storedTab) ? storedTab : visibleTabs[0]?.id;
  const changeTab = (tab) => {
    setActiveTab(tab);
    storeAdminTab(tab);
  };

  const tabs = visibleTabs.length > 1
    ? <Tabs tabs={visibleTabs} value={activeTab} onChange={changeTab} label="Secciones de administración" />
    : null;
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
          onUpdateTournament={onUpdateTournament}
          showStatusMessage={props.showStatusMessage}
        />
      )}
      {activeTab === 'comunidad' && (
        <Suspense fallback={<div className="skeleton h-64 rounded-2xl" aria-label="Cargando" />}>
          <CommunityAdminSection broadcastOverlayData={props.broadcastOverlayData} tournamentData={tournamentData}
            onUpdateBroadcastOverlay={props.onUpdateBroadcastOverlay} showStatusMessage={props.showStatusMessage} />
        </Suspense>
      )}
      {activeTab === 'web' && (
        <Suspense fallback={<div className="skeleton h-64 rounded-2xl" aria-label="Cargando" />}>
          <LeagueContentAdminSection allTeams={props.allTeams} showStatusMessage={props.showStatusMessage} canManageEditors={!isEditorOnly} />
        </Suspense>
      )}
      {activeTab === 'templates' && <TemplateAdminSection {...props} />}
      {activeTab === 'suggestions' && <SuggestionsAdminSection {...props} />}
    </>
  );

  if (!isVisible && !isPage) return null;

  if (isPage) {
    return (
      <Page className="pb-16">
        {isEditorOnly
          ? <PageHeader eyebrow="Gestión" title="Web pública" description="Los textos del sitio de la liga: su historia, la de cada club y el reglamento de la temporada." />
          : <PageHeader eyebrow="Gestión" title="Administración" description="Configuración de la liga, equipos y usuarios, torneo y transmisión, y los textos de la web pública." />}
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
