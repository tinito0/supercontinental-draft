import React, { useState, useEffect, useMemo, useCallback, memo, useRef, Suspense } from 'react';
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, DEFAULT_BUDGET, DEFAULT_LOGO, ADMIN_USER_ID, ADMIN_USER_IDS, APP_ID } from './utils/constants.js';
import { isFranchiseEligible, FRANCHISE_RULE_TEXT } from './supabase/functions/_shared/franchise.js';
import { formatPriceShort, normalizarString, getPosColorClass, getStatAndOvrColorClass, getFlagUrl, getRegionById } from './utils/helpers.js';
import { fetchRawPlayers, buildMarketPlayers } from './utils/playerCatalog.js';
import { LeftSidebar } from './components/LeftSidebar.jsx';
import { TopHeader } from './components/TopHeader.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db, storage, firebaseInitializationError } from './config/firebase.js';
import { LinkGoogleScreen } from './screens/LinkGoogleScreen.jsx';
import { MarketClosedBanner } from './components/MarketClosedBanner.jsx';
import { PendingApprovalScreen } from './screens/PendingApprovalScreen.jsx';
import { isTeamApproved } from './supabase/functions/_shared/membership.js';
import { missedOfferNotifications } from './utils/missedEvents.js';
import { InstallPopup } from './components/InstallPopup.jsx';
import { ToastStack } from './components/ToastStack.jsx';
import { NotificationsPanel } from './components/NotificationsPanel.jsx';
import { BroadcastOverlay, DEFAULT_BROADCAST_OVERLAY } from './components/BroadcastOverlay.jsx';
import { normalizeTournamentView } from './utils/tournamentViews.js';
import { getMatchesWithNewResults } from './components/tournament/tournamentEngine.js';
import { getMentionedTeamIds, hasTransferIntent } from './utils/managerChatUtils.js';
import { makePrefetchable, schedulePrefetchOnIdle } from './utils/prefetch.js';
import { readSessionHint, writeSessionHint } from './utils/sessionHint.js';
import { OverviewTab } from './components/OverviewTab.jsx';
import { useFirebaseData } from './hooks/useFirebaseData.js';
import { useAuth } from './hooks/useAuth.js';
import { usePesAccess } from './hooks/usePesAccess.js';
import { useBudget } from './hooks/useBudget.js';
import { useSquadSync } from './hooks/useSquadSync.js';
import { isMarketOpen as isMarketOpenFor } from './supabase/functions/_shared/market.js';
import { parseOpenTime } from './supabase/functions/_shared/marketTime.js';
import { useKeyboardShortcuts, isTyping } from './hooks/useKeyboardShortcuts.js';
import { hasOpenBaseModal } from './components/ui/BaseModal.jsx';
import { useScrollRestore } from './hooks/useScrollRestore.js';
import { useStoredChoice } from './hooks/useStoredChoice.js';
import { calculateSmartRecommendations } from './utils/recommendations.js';
import { handleListenerError } from './utils/listenerErrorHandler.js';
import { KeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp.jsx';
import { Alert } from './components/ui/Alert.jsx';
import { MarketplaceView } from './components/marketplace/MarketplaceView.jsx';
import { playerPlaceholder } from './utils/playerPlaceholder.js';

// Lazy loading modals and heavy screens
const LoginScreen = React.lazy(() => import('./screens/LoginScreen.jsx').then(m => ({ default: m.LoginScreen })));
const LandingPage = React.lazy(() => import('./screens/LandingPage.jsx').then(m => ({ default: m.LandingPage })));
const AdminModal = React.lazy(() => import('./components/AdminModal.jsx').then(m => ({ default: m.AdminModal })));

// Modals de alta frecuencia de uso: se exponen sus importadores "crudos" para poder
// prefetchearlos (idle-time y/o hover) antes de que el usuario los abra.
const importPlayerModal = () => import('./components/PlayerModal.jsx');
const PlayerModal = React.lazy(() => importPlayerModal().then(m => ({ default: m.PlayerModal })));
const prefetchPlayerModal = makePrefetchable('PlayerModal', importPlayerModal);

const importComparisonModal = () => import('./components/ComparisonModal.jsx');
const ComparisonModal = React.lazy(() => importComparisonModal().then(m => ({ default: m.ComparisonModal })));
const prefetchComparisonModal = makePrefetchable('ComparisonModal', importComparisonModal);

const importFormationModal = () => import('./components/FormationModal.jsx');
const FormationModal = React.lazy(() => importFormationModal().then(m => ({ default: m.FormationModal })));
const prefetchFormationModal = makePrefetchable('FormationModal', importFormationModal);

const TournamentModal = React.lazy(() => import('./components/TournamentModal.jsx').then(m => ({ default: m.TournamentModal })));

const importFiltrosModal = () => import('./components/FiltrosModal.jsx');
const FiltrosModal = React.lazy(() => importFiltrosModal().then(m => ({ default: m.FiltrosModal })));
const prefetchFiltrosModal = makePrefetchable('FiltrosModal', importFiltrosModal);

const TutorialModal = React.lazy(() => import('./components/TutorialModal.jsx').then(m => ({ default: m.TutorialModal })));

const importCartModal = () => import('./components/CartModal.jsx');
const CartModal = React.lazy(() => importCartModal().then(m => ({ default: m.CartModal })));
const prefetchCartModal = makePrefetchable('CartModal', importCartModal);

const importTeamsModal = () => import('./components/TeamsModal.jsx');
const TeamsModal = React.lazy(() => importTeamsModal().then(m => ({ default: m.TeamsModal })));
const prefetchTeamsModal = makePrefetchable('TeamsModal', importTeamsModal);

const SuggestionsModal = React.lazy(() => import('./components/SuggestionsModal.jsx').then(m => ({ default: m.SuggestionsModal })));

const importTransferFeed = () => import('./components/TransferFeed.jsx');
const TransferFeed = React.lazy(() => importTransferFeed().then(m => ({ default: m.TransferFeed })));
const prefetchTransferFeed = makePrefetchable('TransferFeed', importTransferFeed);

const importManagerChat = () => import('./components/ManagerChat.jsx');
const ManagerChat = React.lazy(() => importManagerChat().then(m => ({ default: m.ManagerChat })));
const prefetchManagerChat = makePrefetchable('ManagerChat', importManagerChat);

const ScoutAssignmentsPanel = React.lazy(() => import('./components/ScoutAssignmentsPanel.jsx').then(m => ({ default: m.ScoutAssignmentsPanel })));
const TeamScreen = React.lazy(() => import('./screens/TeamScreen.jsx'));
const FormationViewScreen = React.lazy(() => import('./screens/FormationViewScreen.jsx'));
// Editor PES 2021: chunk separado, solo lo descargan usuarios con rol PES.
const PesWorkspaceScreen = React.lazy(() => import('./screens/PesWorkspaceScreen.jsx'));
const importCommandPalette = () => import('./components/CommandPalette.jsx');
const CommandPalette = React.lazy(() => importCommandPalette().then(m => ({ default: m.CommandPalette })));

import {
  X,
  Trash2,
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';


import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  writeBatch,
  addDoc,
  getDocs,
  serverTimestamp,
  where,
  or,
  query,
  deleteDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { signPlayer as signPlayerOnServer, releasePlayer as releasePlayerOnServer, loadMarketClient } from './services/marketService.js';
const prefetchMarketClient = makePrefetchable('market-client', loadMarketClient);

const initialDetailedStats = Object.values(DETAILED_STAT_KEYS).flat().reduce((acc, stat) => {
  acc[`${stat}Min`] = '';
  acc[`${stat}Max`] = '';
  return acc;
}, {});

const initialFilters = {
  id: '', name: '', pos: '', country: '', region: '',
  ovrMin: '', ovrMax: '', ageMin: '', ageMax: '',
  priceMin: '', priceMax: '',
  grupos: {
    Delanteros: false, Mediocampistas: false, Defensores: false, Arqueros: false,
  },
  playingStyle: '', foot: '',
  skills: Object.keys(PLAYER_SKILLS_MAP).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
  wishlistOnly: false,
  ...initialDetailedStats
};

const initialSort = { key: 'ovr', direction: 'desc' };

function FirebaseError() {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen p-10 font-sans text-lg bg-surface text-ink">
      <h1 className="text-4xl font-bold text-red-500 mb-4">Error de Configuración</h1>
      <p className="text-ink-2 mb-6 text-center">No se pudo conectar a Firebase. Por favor, revisa que tus credenciales sean válidas.</p>
      <pre className="bg-raised p-4 rounded-lg border border-red-700 text-danger-soft overflow-x-auto text-sm max-w-full">
        <strong>Mensaje del error:</strong> {firebaseInitializationError?.message || "Error desconocido."}
      </pre>
    </div>
  );
}

function LoadingScreen({ message, error }) {
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-5">
        <Alert
          tone="danger"
          title="No se pudo conectar"
          className="w-full max-w-md"
          action={<button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Reintentar</button>}
        >
          {error}
        </Alert>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-surface text-ink-2 font-sans text-xl text-center p-5">
      <div className="w-10 h-10 border-4 border-line/20 border-t-accent rounded-full animate-spin mb-5"></div>
      {message || "Cargando..."}
    </div>
  );
}

const InfoPill = memo(function InfoPill({ label, value, colorClass = '', icon }) {
  return (
    <span
      className={`
                bg-overlay text-ink border border-line/20 rounded-full px-3 py-1 text-sm font-medium 
                flex items-center space-x-1 whitespace-nowrap shadow-sm
                ${colorClass}
            `}
    >
      {icon}
      {label && <span className="text-ink-3">{label}:</span>}
      <span className="font-semibold">{value}</span>
    </span>
  );
});

const MiniPlayerCard = memo(function MiniPlayerCard({ player, countryMap, onRemove, onCardClick }) {
  const ovrColorClass = getStatAndOvrColorClass(player.OVR_CALCULADO);
  const posClass = getPosColorClass(player.POS_NOMBRE);
  const countryFlagUrl = getFlagUrl(player.Country1);

  return (
    <div className="flex items-center p-2 bg-raised rounded-lg space-x-2 border border-line/20">
      <button
        onClick={onCardClick}
        disabled={!onCardClick}
        className="flex items-center space-x-2 flex-grow min-w-0 text-left transition disabled:cursor-default rounded-lg hover:enabled:bg-overlay p-1 -m-1"
      >
        <img
          src={`/fotos_jugadores/${player.Id}.webp`}
          alt={player.Name}
          loading="lazy"
          className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-full flex-shrink-0"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = playerPlaceholder(player.Name.substring(0, 1));
          }}
        />
        <div className="flex-grow min-w-0">
          <div className="flex items-center space-x-2">
            <img src={countryFlagUrl} alt="" className="w-4 h-3 rounded-sm" onError={(e) => { e.target.style.display = 'none'; }} />
            <span className="text-sm font-semibold text-ink truncate">{player.Name}</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full font-bold text-xs ${ovrColorClass}`}>
              {player.OVR_CALCULADO}
            </span>
            <span className={`text-xs font-bold text-slate-900 px-2 py-0.5 rounded-full ${posClass}`}>
              {player.POS_NOMBRE}
            </span>
          </div>
        </div>
        <span className="text-xs sm:text-sm font-bold text-success-soft w-16 text-right flex-shrink-0 pr-2">
          {formatPriceShort(player.Precio)}
        </span>
      </button>
      {onRemove && (
        <button onClick={onRemove} className="text-danger-soft hover:text-red-500 transition p-1 rounded-full hover:bg-red-900/30 flex-shrink-0">
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

// ── Route mapping constants (module scope, never recreated) ──
const pathToTab = {
  '/': 'Overview',
  '/overview': 'Overview',
  '/marketplace': 'Marketplace',
  '/my-team': 'My Team',
  '/scouting': 'Scouting',
  '/other-teams': 'Other Teams',
  '/financials': 'My Team',
  '/admin': 'Admin',
  '/tactics': 'Tactics',
  '/pes': 'PES',
  '/tournament': 'Tournament',
};
const tabToPath = {
  'Overview': '/overview',
  'Marketplace': '/marketplace',
  'My Team': '/my-team',
  'Tactics': '/tactics',
  'Scouting': '/scouting',
  'Other Teams': '/other-teams',
  'Admin': '/admin',
  'PES': '/pes',
  'Tournament': '/tournament',
};

const ALL_DETAILED_STAT_KEYS = Object.values(DETAILED_STAT_KEYS).flat();

function App() {
  const navigate = useNavigate();
  const location = useLocation();  // Derive "activeTab" from current URL path for backward compat with all existing code
  // pathToTab and tabToPath moved to module scope — see above App()
  const modalRoute = location.pathname.startsWith('/modal/') ? location.pathname.replace('/modal/', '') : '';
  const currentTabPath = location.pathname.startsWith('/modal/')
    ? (location.state?.from || (modalRoute === 'formation' ? '/my-team' : '/overview'))
    : location.pathname;
  const activeTab = pathToTab[currentTabPath] ?? 'Overview';

  // setActiveTab is a drop-in replacement that navigates to route
  // tabToPath at module scope — see above App()
  const setActiveTab = (tab) => navigate(tabToPath[tab] ?? '/overview');


  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Default closed on mobile, respect localStorage on desktop
    if (window.innerWidth < 1024) return false;
    return localStorage.getItem('sidebarOpen') !== 'false';
  });

  useEffect(() => {
    // Only persist sidebar state on desktop
    if (window.innerWidth >= 1024) {
      localStorage.setItem('sidebarOpen', isSidebarOpen);
    }
  }, [isSidebarOpen]);

  const openModalRoute = useCallback((modalName) => {
    const from = location.pathname.startsWith('/modal/') ? (location.state?.from || '/overview') : location.pathname;
    navigate(`/modal/${modalName}`, { state: { from } });
  }, [location.pathname, location.state, navigate]);

  const closeModalRoute = useCallback((setter) => {
    setter?.(false);
    if (location.pathname.startsWith('/modal/')) {
      const fallback = modalRoute === 'formation' ? '/my-team' : '/overview';
      navigate(location.state?.from || fallback, { replace: true });
    }
  }, [location.pathname, location.state, modalRoute, navigate]);

  const [allPlayers, setAllPlayers] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [hasLoadedPlayerDatabase, setHasLoadedPlayerDatabase] = useState(false);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [playersLoadError, setPlayersLoadError] = useState('');
  const [countriesLoadError, setCountriesLoadError] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  // Vista del mercado ('grid' | 'list') y densidad de la cuadrícula ('comfortable' | 'compact'): preferencia
  // de este navegador. Las columnas salen del ancho real de la lista (utils/marketGrid.js).
  const [viewMode, setViewMode] = useStoredChoice('market_view', ['grid', 'list']);
  const [gridDensity, setGridDensity] = useStoredChoice('market_density', ['comfortable', 'compact']);
  const [isLoading, setIsLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState(null);
  const [broadcastOverlayData, setBroadcastOverlayData] = useState(DEFAULT_BROADCAST_OVERLAY);
  const [isTournamentModalVisible, setIsTournamentModalVisible] = useState(false);
  const getTournamentDocRef = useCallback(() => doc(db, `artifacts/${APP_ID}/public/data/tournament/official`), []);
  const searchParams = useMemo(() => (
    new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  ), [location.search]);
  const rawMode = searchParams.get('mode');
  const viewParam = searchParams.get('view');
  const tournamentParam = searchParams.get('tournament'); // e.g. 'copa-plata'
  const isObsMode = rawMode === 'obs';
  const isPublicView = rawMode === 'table' || rawMode === 'bracket';
  const isSpecialMode = isObsMode || isPublicView;
  const targetView = normalizeTournamentView(viewParam || (rawMode === 'table' ? 'groups' : rawMode === 'bracket' ? 'bracket' : 'groups'));
  const initialTab = normalizeTournamentView(searchParams.get('tab') || 'groups');
  const clubTab = ['players', 'offers', 'sent', 'history', 'stats'].includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'players';
  const [signingToasts, setSigningToasts] = useState([]);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [isFiltrosModalVisible, setIsFiltrosModalVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [cartInitialTab, setCartInitialTab] = useState('players');
  const [isTeamsModalVisible, setIsTeamsModalVisible] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [isSuggestionsModalVisible, setIsSuggestionsModalVisible] = useState(false);
  const [isFormationModalVisible, setIsFormationModalVisible] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const { saveScroll: saveMarketplaceScroll, restoreScroll: restoreMarketplaceScroll } = useScrollRestore('#main-content');

  const handleOpenPlayerModal = useCallback((playerOrId) => {
    saveMarketplaceScroll();
    const id = typeof playerOrId === 'object' && playerOrId !== null ? playerOrId.Id : playerOrId;
    setSelectedPlayerId(id ? String(id) : null);
  }, [saveMarketplaceScroll]);

  const handleClosePlayerModal = useCallback(() => {
    setSelectedPlayerId(null);
    restoreMarketplaceScroll();
  }, [restoreMarketplaceScroll]);

  // Restaura automáticamente el scroll del marketplace si el modal de jugador se cierra
  const prevSelectedPlayerIdRef = useRef(selectedPlayerId);
  useEffect(() => {
    if (prevSelectedPlayerIdRef.current && !selectedPlayerId) {
      restoreMarketplaceScroll();
    }
    prevSelectedPlayerIdRef.current = selectedPlayerId;
  }, [selectedPlayerId, restoreMarketplaceScroll]);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const statusMessageTimeoutRef = useRef(null);
  const showStatusMessage = useCallback((type, text) => {
    if (statusMessageTimeoutRef.current) clearTimeout(statusMessageTimeoutRef.current);
    setStatusMessage({ type, text });
    if (type !== 'loading') {
      statusMessageTimeoutRef.current = setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
    }
  }, []);
  useEffect(() => () => {
    if (statusMessageTimeoutRef.current) clearTimeout(statusMessageTimeoutRef.current);
  }, []);
  const closeStatusMessage = useCallback(() => setStatusMessage({ type: '', text: '' }), []);
  const dismissSigningToast = useCallback(toastId => {
    setSigningToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);
  const [compareList, setCompareList] = useState([]);
  const [isComparisonModalVisible, setIsComparisonModalVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const normalizedCountryNamesById = useMemo(() => {
    const entries = Object.entries(countryMap).map(([id, name]) => [id, normalizarString(name || '')]);
    return Object.fromEntries(entries);
  }, [countryMap]);

  const [filters, setFilters] = useState(initialFilters);
  const [debouncedName, setDebouncedName] = useState(initialFilters.name);
  const [sortConfig, setSortConfig] = useState(initialSort);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [isManagerChatVisible, setIsManagerChatVisible] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const toggleCart = useCallback(() => {
    if (modalRoute === 'cart' || isCartVisible) {
      setCartInitialTab('players');
      closeModalRoute(setIsCartVisible);
    } else {
      openModalRoute('cart');
    }
  }, [modalRoute, isCartVisible, closeModalRoute, openModalRoute]);

  const openFilters = useCallback(() => {
    if (modalRoute === 'filters' || isFiltrosModalVisible) {
      closeModalRoute(setIsFiltrosModalVisible);
    } else {
      openModalRoute('filters');
    }
  }, [modalRoute, isFiltrosModalVisible, closeModalRoute, openModalRoute]);

  const { isHelpOpen: isShortcutsHelpOpen, setIsHelpOpen: setIsShortcutsHelpOpen } = useKeyboardShortcuts({
    setActiveTab,
    openModalRoute,
    toggleCart,
    openFilters,
  });

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [shouldPrefetchTransfers, setShouldPrefetchTransfers] = useState(false);
  const [areNotificationsWarmed, setAreNotificationsWarmed] = useState(false);
  const [activityFeed, setActivityFeed] = useState([]);
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [offerHistory, setOfferHistory] = useState([]);
  const prevLocksRef = useRef(null);
  const getPrivateProfileRef = useCallback((uid) => doc(db, `artifacts/${APP_ID}/users/${uid}/profile`, "data"), []);
  const getSavedFiltersCollectionRef = useCallback((uid) => collection(db, `artifacts/${APP_ID}/users/${uid}/saved_filters`), []);
  const getPublicTeamRef = useCallback((uid) => doc(db, `artifacts/${APP_ID}/public/data/teams`, uid), []);
  const getPrivateCartCollectionRef = useCallback((uid) => collection(db, `artifacts/${APP_ID}/users/${uid}/cart`), []);
  const getPrivateCartDocRef = useCallback((uid, playerId) => doc(db, `artifacts/${APP_ID}/users/${uid}/cart`, String(playerId)), []);
  const getPublicLocksCollectionRef = useCallback(() => collection(db, `artifacts/${APP_ID}/public/data/player_locks`), []);
  const getPublicTeamsCollectionRef = useCallback(() => collection(db, `artifacts/${APP_ID}/public/data/teams`), []);
  const getMarketStatusDocRef = useCallback(() => doc(db, `artifacts/${APP_ID}/public/data/config`, 'market'), []);
  const getBroadcastOverlayDocRef = useCallback(() => doc(db, `artifacts/${APP_ID}/public/data/broadcast`, 'overlay'), []);
  const getSuggestionsCollectionRef = useCallback(() => collection(db, `artifacts/${APP_ID}/public/data/suggestions`), []);
  const getManagerChatCollectionRef = useCallback(() => collection(db, `artifacts/${APP_ID}/public/data/manager_chat`), []);

  const [appError, setAppError] = useState(null);

  // Hook desacoplado de Autenticación, Roles y Mercado (Fase 2)
  const {
    user,
    userId,
    isAdmin,
    isAuthReady,
    needsGoogleLinking,
    setNeedsGoogleLinking,
    authError,
    setAuthError,
    marketStatus,
    setMarketStatus,
    handleLogout: authLogout,
  } = useAuth({
    auth,
    db,
    getPrivateProfileRef,
    getPublicTeamRef,
    getMarketStatusDocRef,
    firebaseInitializationError,
    setAppError,
    setIsLoading,
    showNotification: showStatusMessage,
  });

  // Rol en el editor PES (null = sin acceso: el usuario solo usa el mercado y el resto de la app).
  const hasPesAccess = usePesAccess(userId, isAdmin);

  const handleLogout = useCallback(async () => {
    try {
      await authLogout();
    } finally {
      navigate('/', { replace: true });
    }
  }, [authLogout, navigate]);

  const chatInitializedRef = useRef(false);
  const [isTransferFeedVisible, setIsTransferFeedVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Router-level redirects: keep public routes clean and return logged-out users to landing.
  useEffect(() => {
    if (isAuthReady) writeSessionHint(Boolean(user));
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady) return;

    if (location.pathname === '/financials') {
      navigate('/my-team?tab=stats', { replace: true });
      return;
    }

    const isPublicAuthRoute = location.pathname === '/' || location.pathname === '/login';
    const isPublicStandaloneRoute =
      isPublicAuthRoute ||
      isSpecialMode ||
      location.pathname.startsWith('/overlay') ||
      location.pathname.startsWith('/team/') ||
      location.pathname.startsWith('/tactics/view/') ||
      location.pathname.startsWith('/torneo');

    if (user && isPublicAuthRoute) {
      navigate('/overview', { replace: true });
      return;
    }

    if (!user && !isPublicStandaloneRoute) {
      navigate('/', { replace: true });
    }
  }, [isAuthReady, isSpecialMode, location.pathname, navigate, user]);




  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // ¡AQUÍ ESTÁ LA MAGIA! Mostramos el popup automáticamente
      setShowInstallPopup(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Escape key global listener for accessible modal closing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Typing in a filter or search field must never close the view or navigate away:
        // the first Escape only leaves the field.
        if (isTyping(e.target)) return;
        // An open BaseModal owns Escape (components/ui/BaseModal.jsx): its onClose may ask to keep unsaved
        // changes, and closing the route here as well ignored a cancelled confirmation.
        if (hasOpenBaseModal()) return;
        if (isShortcutsHelpOpen) {
          setIsShortcutsHelpOpen(false);
        } else if (isNotificationPanelOpen) {
          setIsNotificationPanelOpen(false);
        } else if (selectedPlayerId) {
          handleClosePlayerModal();
        } else if (isComparisonModalVisible) {
          setIsComparisonModalVisible(false);
        } else if (location.pathname.startsWith('/modal/')) {
          closeModalRoute();
        } else if (isSidebarOpen && isMobileViewport) {
          setIsSidebarOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShortcutsHelpOpen, isNotificationPanelOpen, selectedPlayerId, handleClosePlayerModal, isComparisonModalVisible, location.pathname, closeModalRoute, isSidebarOpen, isMobileViewport]);

  // Network connection status detection (Audit section 12, 13, 20)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showStatusMessage('success', 'Conexión restablecida con el servidor.');
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showStatusMessage]);

  useEffect(() => {
    setDebouncedName(filters.name);
  }, [filters.name]);

  // Prefetch de los modals más usados (Jugador, Comparador, Carrito, Otros Equipos,
  // Formación, Filtros) durante tiempo idle del browser, una vez que ya cargó lo
  // crítico (base de jugadores). Así, cuando el usuario realmente hace click, el
  // chunk ya está en caché y Suspense resuelve casi al instante en vez de mostrar
  // el spinner de carga. Respeta ahorro de datos / conexión lenta (ver utils/prefetch.js).
  useEffect(() => {
    if (!hasLoadedPlayerDatabase) return;
    return schedulePrefetchOnIdle([
      prefetchPlayerModal,
      prefetchComparisonModal,
      prefetchCartModal,
      prefetchTeamsModal,
      prefetchFormationModal,
      prefetchFiltrosModal,
      prefetchMarketClient,
    ]);
  }, [hasLoadedPlayerDatabase]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallPopup(false); // Cerrar popup si acepta
    }
  };

  const handleToggleCompare = useCallback((player) => {
    setCompareList(prev => {
      // 1. Si ya está en la lista, lo sacamos (toggle off)
      const exists = prev.find(p => p.Id === player.Id);
      if (exists) {
        return prev.filter(p => p.Id !== player.Id);
      }

      // 2. Si ya hay 2, no dejamos agregar más (pero no abrimos modal)
      if (prev.length >= 2) {
        showStatusMessage('error', 'Ya tienes 2 jugadores seleccionados. Elimina uno primero.');
        return prev;
      }

      // 3. Agregamos el nuevo jugador
      const newList = [...prev, player];

      // CAMBIO IMPORTANTE:
      // Si llegamos a 2, solo avisamos, NO abrimos el modal automáticamente.
      if (newList.length === 2) {
        openModalRoute('compare');
        showStatusMessage('success', 'Listo para comparar. Pulsa el botón "Comparar" abajo.');
        // setIsComparisonModalVisible(true); <--- LÍNEA ELIMINADA
      }

      return newList;
    });
  }, [openModalRoute, showStatusMessage]);

  const handleRemoveCompareItem = useCallback((playerId) => {
    setCompareList(prev => prev.filter(p => p.Id !== playerId));
  }, []);


  const { cart, isCartSynced, playerLocks, isLocksLoaded, isLocksSynced, allTeams, isTeamsLoaded, userProfile } = useFirebaseData(
    userId, isAuthReady, getPrivateCartCollectionRef, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, getPrivateProfileRef, setAppError, setIsLoading, showStatusMessage);

  const playerById = useMemo(() => {
    const map = new Map();
    allPlayers.forEach((player) => {
      map.set(String(player.Id), player);
    });
    return map;
  }, [allPlayers]);

  // player_locks manda: el carrito privado, el presupuesto del perfil y la plantilla pública se alinean con él.
  const { needsCatalog: squadNeedsCatalog } = useSquadSync({
    userId, userProfile, cart, isCartSynced, playerLocks, isLocksSynced, allTeams, playerById,
    getPrivateCartDocRef, getPrivateProfileRef, getPublicTeamRef,
  });

  // Mercado programado: re-renderizar en el momento de apertura (antes la pantalla de mantenimiento
  // seguía hasta que otra cosa cambiara). setTimeout acepta hasta ~24,8 días; más lejos, se reprograma.
  const [, setMarketClock] = useState(0);
  const scheduledOpenAt = marketStatus?.status === 'scheduled' ? parseOpenTime(marketStatus.openTime)?.getTime() : null;
  useEffect(() => {
    if (!scheduledOpenAt) return undefined;
    const wait = scheduledOpenAt - Date.now();
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setMarketClock(tick => tick + 1), Math.min(wait + 500, 2147483000));
    return () => clearTimeout(timer);
  }, [scheduledOpenAt]);
  // Same rule as the server (supabase/functions/_shared/market.js). A closed market used to replace the whole app
  // with a maintenance screen; now everything stays usable and only signing, offers and releases wait for it.
  const isMarketOpen = isMarketOpenFor(marketStatus, allTeams?.[userId], isAdmin);
  const shouldLoadPlayerDatabase = useMemo(() => {
    if (isSpecialMode || location.pathname.startsWith('/overlay') || location.pathname.startsWith('/team/') || location.pathname.startsWith('/tactics/view/')) {
      return false;
    }
    if (location.pathname === '/' || location.pathname === '/login') return false;
    const tabsThatNeedPlayers = new Set(['Marketplace', 'My Team', 'Tactics', 'Scouting', 'Other Teams']);
    const modalsThatNeedPlayers = new Set(['filters', 'cart', 'teams', 'compare']);
    return tabsThatNeedPlayers.has(activeTab) || modalsThatNeedPlayers.has(modalRoute) || Boolean(selectedPlayerId) || compareList.length > 0
      || squadNeedsCatalog;
  }, [activeTab, compareList.length, isSpecialMode, location.pathname, modalRoute, selectedPlayerId, squadNeedsCatalog]);

  const dismissedNotifIdsRef = useRef(new Set(
    (() => {
      try {
        return JSON.parse(sessionStorage.getItem('dismissed_notif_ids') || '[]');
      } catch {
        return [];
      }
    })()
  ));

  const addNotification = useCallback((notification) => {
    const id = notification.id || `${notification.category || notification.type || 'notif'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (dismissedNotifIdsRef.current.has(id)) return;

    setNotifications(prev => {
      if (prev.some(n => n.id === id)) return prev;
      return [{ ...notification, id, read: notification.read === true, createdAt: notification.createdAt || new Date().toISOString() }, ...prev].slice(0, 40);
    });
  }, []);

  const handleNotificationClick = useCallback((notification) => {
    if (!notification) return;

    // 1. Marcar como leída
    setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));

    // 2. Jugador específico
    if (notification.playerId) {
      handleOpenPlayerModal(notification.playerId);
      return;
    }

    // 3. Pestaña específica de Gestión de Equipo (CartModal)
    if (notification.targetTab) {
      if (['offers', 'sent', 'history', 'players'].includes(notification.targetTab)) {
        navigate(`/my-team?tab=${notification.targetTab}`);
        return;
      }
    }

    // 4. Ofertas y traspasos
    if (['offer', 'proposal'].includes(notification.type) || notification.category === 'offer' || notification.category === 'proposal') {
      const isSent = notification.isSent || notification.status === 'countered';
      navigate(`/my-team?tab=${isSent ? 'sent' : 'offers'}`);
      return;
    }

    if (notification.type === 'transfer' || notification.category === 'transfer') {
      if (notification.targetModal === 'cart' || notification.action === 'cart') {
        navigate('/my-team?tab=history');
      } else {
        openModalRoute('transfers');
      }
      return;
    }

    // 5. Modal específico
    if (notification.targetModal) {
      openModalRoute(notification.targetModal);
      return;
    }

    // 6. Chat de Managers
    if (notification.category === 'chat' || notification.type === 'chat') {
      openModalRoute('chat');
      return;
    }

    // 7. Torneo y Partidos
    if (notification.category === 'tournament' || notification.type === 'tournament' || notification.type === 'match_result') {
      // The tournament tab, for everyone: /modal/tournament is the admin editor and rendered nothing for managers.
      navigate('/tournament');
      return;
    }

    // 8. Alertas del sistema
    if (notification.id === 'system-low-budget' || notification.category === 'finance') {
      navigate('/my-team?tab=stats');
      return;
    }

    if (notification.id === 'system-market-closed') {
      navigate('/marketplace');
      return;
    }

    // 9. Ruta personalizada
    if (notification.targetPath) {
      navigate(notification.targetPath);
      return;
    }

    // 10. Fallback contextual
    if (notification.time === 'Traspaso' || String(notification.time || '').includes('Oferta') || String(notification.text || '').includes('TRASPASO')) {
      navigate('/my-team?tab=offers');
      return;
    }
  }, [navigate, openModalRoute]);

  const handleToastClick = useCallback((toast) => {
    if (!toast) return;
    if (toast.playerId) {
      handleOpenPlayerModal(toast.playerId);
    } else {
      openModalRoute('transfers');
    }
  }, [handleOpenPlayerModal, openModalRoute]);

  // 3. CARGA DE DATOS OPTIMIZADA (CORREGIDO)
  const retryPlayerCatalog = useCallback(() => {
    setPlayersLoadError('');
    setCountriesLoadError('');
    setAllPlayers([]);
    setCountryMap({});
    setHasLoadedPlayerDatabase(false);
    setCatalogReloadKey(previous => previous + 1);
  }, []);

  useEffect(() => {
    if (!shouldLoadPlayerDatabase || hasLoadedPlayerDatabase) return;
    let isCancelled = false;

    // Catálogo compacto (utils/playerCatalog.js): ~9 MB en vez de ~60 MB y una sola pasada para filtrar
    // glitcheados y normalizar (mismo filtro que el catálogo del servidor, scripts/build-market-catalog.mjs).
    fetchRawPlayers()
      .then((data) => {
        if (isCancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('El catálogo no contiene jugadores.');
        }
        setPlayersLoadError('');
        setAllPlayers(buildMarketPlayers(data));
        setHasLoadedPlayerDatabase(true);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Error cargando jugadores.json:", err);
        setAllPlayers([]);
        setPlayersLoadError('No se pudo cargar la base de jugadores. Revisá tu conexión e intentá nuevamente.');
      });

    fetch('/paises.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Países no disponibles (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        setCountriesLoadError('');
        setCountryMap(data);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Error cargando paises.json:", err);
        setCountryMap({});
        setCountriesLoadError('No se pudieron cargar los países. Algunas banderas/filtros pueden verse limitados.');
      });

    return () => { isCancelled = true; };
  }, [catalogReloadKey, hasLoadedPlayerDatabase, shouldLoadPlayerDatabase]);



  useEffect(() => {

    const unsubTournament = onSnapshot(getTournamentDocRef(),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setTournamentData(docSnapshot.data());
        }
      },
      (error) => {
        handleListenerError(error, "Tournament Data", showStatusMessage, {
          onPermissionDenied: () => {
            setIsLoading(false);
            setAppError("Sin permisos para cargar Tournament Data");
          }
        });
      }
    );
    return () => unsubTournament();
  }, [getTournamentDocRef, showStatusMessage]);

  useEffect(() => {
    const unsubscribeBroadcast = onSnapshot(getBroadcastOverlayDocRef(),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setBroadcastOverlayData({ ...DEFAULT_BROADCAST_OVERLAY, ...docSnapshot.data() });
        } else {
          setBroadcastOverlayData(DEFAULT_BROADCAST_OVERLAY);
        }
      },
      (error) => {
        handleListenerError(error, "Broadcast Overlay", showStatusMessage);
      }
    );
    return () => unsubscribeBroadcast();
  }, [getBroadcastOverlayDocRef, showStatusMessage]);




  // Devuelve si se guardó: TournamentModal solo sale del modo edición cuando es true.
  const handleUpdateTournament = async (newData) => {
    if (!isAdmin) return false;
    try {
      // Torneo y noticias en un solo batch: antes, si fallaba una noticia, el torneo quedaba guardado, el
      // aviso decía que no, y al reintentar ya no había resultados "nuevos", así que la noticia no salía nunca.
      const batch = writeBatch(db);
      // mergeFields reemplaza cada campo de nivel superior entero (bracket, league, matches…): con merge: true
      // los mapas se fusionan en profundidad y una clave borrada en el editor nunca se borraba en Firestore.
      batch.set(getTournamentDocRef(), newData, { mergeFields: Object.keys(newData) });
      // Noticias solo de resultados nuevos o corregidos; antes cada guardado republicaba todos los partidos.
      const changedResults = getMatchesWithNewResults(tournamentData?.matches, newData.matches);
      changedResults.forEach(match => batch.set(
        doc(db, `artifacts/${APP_ID}/public/data/news`, `match-${match.id}`),
        {
          type: 'match_result',
          matchId: match.id,
          round: match.round || 'Partido de torneo',
          homeTeam: match.homeTeam || 'Local',
          awayTeam: match.awayTeam || 'Visitante',
          homeScore: Number(match.homeScore) || 0,
          awayScore: Number(match.awayScore) || 0,
          mvp: match.mvp || '',
          publishedAt: serverTimestamp(),
        },
        { merge: true }
      ));
      await batch.commit();
      showStatusMessage('success', 'Torneo actualizado correctamente.');
      return true;
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'No se pudo guardar el torneo. Tus cambios siguen en pantalla; probá de nuevo.');
      return false;
    }
  };

  // Devuelve si se guardó. `successMessage` permite un aviso específico (p. ej. "partido al aire").
  const handleUpdateBroadcastOverlay = async (newData, successMessage = 'Overlay OBS actualizado.') => {
    if (!isAdmin) return false;
    try {
      await setDoc(getBroadcastOverlayDocRef(), newData, { merge: true });
      showStatusMessage('success', successMessage);
      return true;
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al guardar overlay OBS.');
      return false;
    }
  };

  // Tournament components moved to ./components/TournamentModal.jsx





  // --- OPTIMIZACIÓN 2: Filtros con useMemo (Automático) ---
  // Reemplaza a 'applyFilters' y 'filteredPlayers' state
  const filteredPlayers = useMemo(() => {
    let players = allPlayers;
    const f = filters;
    const gruposSeleccionados = Object.keys(f.grupos).filter(k => f.grupos[k]);
    const selectedSkills = Object.keys(f.skills).filter(skill => f.skills[skill]);
    const normalizedCountry = normalizarString(f.country);

    // Usamos el nombre con debounce para que no filtre en cada letra
    const searchName = normalizarString(debouncedName);

    if (f.wishlistOnly) {
      const wishlist = userProfile?.wishlist || [];
      players = players.filter(p => wishlist.includes(p.Id));
    }

    const matchMin = (val, min) => min === "" || val >= parseInt(min, 10);
    const matchMax = (val, max) => max === "" || val <= parseInt(max, 10);

    // Pre-calcular filtros de stats detalladas activas una sola vez
    const activeDetailedStatFilters = [];
    for (let i = 0; i < ALL_DETAILED_STAT_KEYS.length; i++) {
      const k = ALL_DETAILED_STAT_KEYS[i];
      const min = f[`${k}Min`];
      const max = f[`${k}Max`];
      if ((min !== "" && min !== undefined) || (max !== "" && max !== undefined)) {
        activeDetailedStatFilters.push({
          key: k,
          minVal: min !== "" && min !== undefined ? parseInt(min, 10) : -Infinity,
          maxVal: max !== "" && max !== undefined ? parseInt(max, 10) : Infinity,
        });
      }
    }
    const hasDetailedFilters = activeDetailedStatFilters.length > 0;

    players = players.filter(p => {
      if (marketStatus.status === 'FranchiseMarket') {
        if (!isFranchiseEligible(p)) return false;
      }

      if (f.region) {
        const pRegion = getRegionById(p.Country1);
        if (pRegion !== f.region) return false;
      }

      const country1Name = normalizedCountryNamesById[p.Country1] || "";
      const country2Name = normalizedCountryNamesById[p.Country2] || "";

      const matchBasic =
        matchMin(p.OVR_CALCULADO, f.ovrMin) && matchMax(p.OVR_CALCULADO, f.ovrMax) &&
        matchMin(p.Age, f.ageMin) && matchMax(p.Age, f.ageMax) &&
        matchMin(p.Precio, f.priceMin) && matchMax(p.Precio, f.priceMax) &&
        (f.id === "" || String(p.Id).includes(f.id)) &&
        (searchName === "" || (p.searchableName && p.searchableName.includes(searchName))) &&
        (f.pos === "" || p.POS_NOMBRE === f.pos) &&
        (f.country === "" || country1Name.includes(normalizedCountry) || country2Name.includes(normalizedCountry)) &&
        (gruposSeleccionados.length === 0 || gruposSeleccionados.includes(p.Grupo)) &&
        (f.playingStyle === "" || p.PlayingStyle === f.playingStyle) &&
        (f.foot === "" || p.Foot === f.foot) &&
        (selectedSkills.length === 0 || selectedSkills.every(skill => p[skill]));

      if (!matchBasic) return false;

      if (hasDetailedFilters) {
        for (let i = 0; i < activeDetailedStatFilters.length; i++) {
          const filter = activeDetailedStatFilters[i];
          const val = p[filter.key] || 0;
          if (val < filter.minVal || val > filter.maxVal) return false;
        }
      }

      return true;
    });

    // Ordenamiento integrado optimizado sin switches dentro del comparator
    const sorted = [...players];
    const { key, direction } = sortConfig;
    const isAsc = direction === 'asc';

    if (key === 'precio') {
      sorted.sort(isAsc ? (a, b) => a.Precio - b.Precio : (a, b) => b.Precio - a.Precio);
    } else if (key === 'edad') {
      sorted.sort(isAsc ? (a, b) => a.Age - b.Age : (a, b) => b.Age - a.Age);
    } else if (key === 'nombre') {
      sorted.sort(isAsc
        ? (a, b) => (a.searchableName || '').localeCompare(b.searchableName || '')
        : (a, b) => (b.searchableName || '').localeCompare(a.searchableName || ''));
    } else {
      sorted.sort(isAsc ? (a, b) => a.OVR_CALCULADO - b.OVR_CALCULADO : (a, b) => b.OVR_CALCULADO - a.OVR_CALCULADO);
    }

    return sorted;
  }, [allPlayers, filters, sortConfig, normalizedCountryNamesById, userProfile?.wishlist, marketStatus, debouncedName]);

  const resetFilters = useCallback(() => {
    setFilters(prev => ({ ...initialFilters, name: prev.name }));
  }, []);

  // Un documento privado atrasado no debe mantener a un jugador vendido en la UI
  // ni descontar su valor del presupuesto mientras se completa la limpieza.
  const ownedCart = useMemo(() => {
    if (!userId || !playerLocks) return cart;
    return cart.filter(player => {
      const lock = playerLocks[String(player.Id)];
      return !lock || !lock.lockedBy || lock.lockedBy === userId;
    });
  }, [cart, playerLocks, userId]);

  // Precio en millones para el presupuesto: el del catálogo (igual que el servidor) si ya cargó; si no, el
  // que quedó en la copia del carrito.
  const priceOfPlayer = useCallback((playerId) => {
    if (allPlayers.length) return playerById.get(String(playerId))?.Precio ?? 0;
    return cart.find(player => String(player.Id) === String(playerId))?.Precio ?? 0;
  }, [allPlayers.length, playerById, cart]);

  // Hook desacoplado de Finanzas y Presupuesto (Fase 2)
  const {
    budgetBase,
    totalCartCost,
    committedInOffers,
    remainingBudget,
    budgetPercent,
    showBudgetAlert,
    setShowBudgetAlert,
  } = useBudget({
    userProfile,
    baseBudget: allTeams?.[userId]?.budget,
    playerLocks,
    userId,
    sentOffers,
    priceOf: priceOfPlayer,
    pricesKnown: !squadNeedsCatalog,
  });

  const wishlistSet = useMemo(() => {
    return new Set(userProfile?.wishlist || []);
  }, [userProfile?.wishlist]);

  const comparingIdsSet = useMemo(() => {
    return new Set(compareList.map(player => player.Id));
  }, [compareList]);


  // --- ACTIVITY FEED: Detectar fichajes en tiempo real ---
  const isLocksInitializedRef = useRef(false);
  const seenSigningsRef = useRef(new Set());
  useEffect(() => {
    if (!isLocksLoaded || !playerLocks || !allPlayers || allPlayers.length === 0) return;
    const prev = prevLocksRef.current;
    if (!isLocksInitializedRef.current || prev === null) {
      // Primera carga real, solo guardar referencia sin emitir alertas retroactivas
      prevLocksRef.current = { ...playerLocks };
      Object.entries(playerLocks).forEach(([pId, lock]) => {
        seenSigningsRef.current.add(`${pId}-${lock.lockedBy || 'locked'}`);
      });
      isLocksInitializedRef.current = true;
      return;
    }
    const newEvents = [];
    // Detectar NUEVOS fichajes (locks que no existían antes)
    Object.entries(playerLocks).forEach(([playerId, lockData]) => {
      const lockKey = `${playerId}-${lockData.lockedBy || 'locked'}`;
      if (!prev[playerId] && !seenSigningsRef.current.has(lockKey)) {
        seenSigningsRef.current.add(lockKey);
        const player = playerById.get(String(playerId));
        if (player) {
          const toastId = `toast-${playerId}-${lockData.lockedBy || Date.now()}`;
          const posColors = { DC: '#ef4444', SD: '#ef4444', EI: '#ef4444', ED: '#ef4444', MC: '#10b981', MCD: '#10b981', MO: '#10b981', MI: '#10b981', MD: '#10b981', DFC: '#3b82f6', LI: '#3b82f6', LD: '#3b82f6', PT: '#eab308' };
          const posColorHex = posColors[player.POS_NOMBRE] || '#6b7280';

          newEvents.push({
            id: toastId,
            type: 'signing',
            playerName: player.Name,
            teamName: lockData.teamName || 'Equipo',
            ovr: player.OVR_CALCULADO,
            pos: player.POS_NOMBRE,
            price: player.Precio,
            timestamp: new Date(),
          });

          // Mostrar toast interactivo solo si lo fichó un rival
          if (lockData.lockedBy && lockData.lockedBy !== userId) {
            setSigningToasts(prevToasts => [
              {
                toastId,
                playerId: player.Id,
                playerName: player.Name,
                teamName: lockData.teamName || 'Equipo',
                ovr: player.OVR_CALCULADO,
                pos: player.POS_NOMBRE,
                posColor: posColorHex,
              },
              ...prevToasts.filter(t => t.toastId !== toastId)
            ].slice(0, 2));

            setTimeout(() => {
              setSigningToasts(prevToasts => prevToasts.filter(t => t.toastId !== toastId));
            }, 4000);

            // Si lo fichó un rival, agregamos notificación con ID determinístico
            addNotification({
              id: `signing-${playerId}-${lockData.lockedBy}`,
              category: 'transfer',
              type: 'transfer',
              playerId: player.Id,
              text: `${lockData.teamName || 'Un rival'} fichó a ${player.Name} (${player.OVR_CALCULADO} OVR) por ${formatPriceShort(player.Precio)}.`,
              time: 'Fichaje en vivo',
              targetModal: 'transfers',
            });
          }
        }
      }
    });
    // Detectar LIBERACIONES (locks que ya no existen)
    Object.entries(prev).forEach(([playerId, lockData]) => {
      if (!playerLocks[playerId]) {
        const player = playerById.get(String(playerId));
        if (player) {
          newEvents.push({
            id: `${playerId}-${Date.now()}-release`,
            type: 'release',
            playerName: player.Name,
            teamName: lockData.teamName || 'Equipo',
            ovr: player.OVR_CALCULADO,
            pos: player.POS_NOMBRE,
            timestamp: new Date(),
          });
        }
      }
    });
    if (newEvents.length > 0) {
      setActivityFeed(prev => [...newEvents, ...prev].slice(0, 30)); // Keep last 30
    }
    prevLocksRef.current = { ...playerLocks };
  }, [isLocksLoaded, playerLocks, allPlayers, playerById, userId, addNotification]);

  // Transfer proposals listener — listens for incoming trade offers
  const offersInitializedRef = useRef(false);
  useEffect(() => {
    if (!userId) {
      offersInitializedRef.current = false;
      return;
    }
    const q = query(
      collection(db, `artifacts/${APP_ID}/public/data/offers`),
      or(
        where("targetTeamId", "==", userId),
        where("senderId", "==", userId)
      )
    );
    const unsub = onSnapshot(q,
      (snap) => {
        const incoming = [];
        const sent = [];
        const history = [];
        snap.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          if (data.status === 'pending' || data.status === 'countered') {
            if ((data.targetTeamId === userId && data.status === 'pending') || (data.senderId === userId && data.status === 'countered')) {
              incoming.push(data);
            }
            if ((data.senderId === userId && data.status === 'pending') || (data.targetTeamId === userId && data.status === 'countered')) {
              sent.push(data);
            }
          } else if (['accepted', 'rejected', 'withdrawn'].includes(data.status)) {
            history.push(data);
          }
        });
        setIncomingOffers(incoming);
        setSentOffers(sent);
        setOfferHistory(history);

        // Evitar disparar notificaciones para ofertas preexistentes al conectar
        if (!offersInitializedRef.current) {
          offersInitializedRef.current = true;
          return;
        }

        snap.docChanges().forEach(change => {
          const data = change.doc.data();
          if (change.type === 'added') {
            if ((data.targetTeamId === userId && data.status === 'pending') || (data.senderId === userId && data.status === 'countered')) {
              addNotification({
                id: `offer-incoming-${change.doc.id}`,
                category: 'transfer',
                type: 'offer',
                offerId: change.doc.id,
                playerId: data.playerId,
                targetTab: 'offers',
                text: `Oferta de traspaso: ${data.senderTeamName || 'Un rival'} ofrece ${formatPriceShort((data.status === 'countered' ? data.counterAmount : data.offerAmount) / 1000000)} por ${data.playerName}.${data.message ? ` "${data.message}"` : ''}`,
                time: 'Oferta recibida',
                read: false,
              });
            }
          }
          if (change.type === 'modified') {
            // Notify sender when their offer is rejected
            if (data.status === 'rejected' && data.senderId === userId) {
              addNotification({
                id: `offer-rejected-${change.doc.id}`,
                category: 'transfer',
                type: 'warning',
                offerId: change.doc.id,
                playerId: data.playerId,
                targetTab: 'sent',
                text: `${data.rejectedBy || 'Un rival'} rechazó tu oferta por ${data.playerName}.`,
                time: 'Oferta rechazada',
                read: false,
              });
            }
            // Notify seller when their offer is accepted
            if (data.status === 'accepted' && data.targetTeamId === userId) {
              addNotification({
                id: `transfer-sale-${change.doc.id}`,
                category: 'transfer',
                type: 'transfer',
                offerId: change.doc.id,
                playerId: data.playerId,
                targetTab: 'history',
                // The accepted amount is the last history entry (market function): counterAmount stays from an
                // earlier counter after a new offer, so `counterAmount || offerAmount` showed a stale price.
                text: `Venta confirmada: ${data.playerName} fue transferido a ${data.senderTeamName || 'otro equipo'} por ${formatPriceShort((data.history?.at(-1)?.amount ?? data.offerAmount ?? 0) / 1000000)}.`,
                time: 'Traspaso completado',
                read: false,
              });
            }
            // Notify buyer when their offer is accepted
            if (data.status === 'accepted' && data.senderId === userId) {
              addNotification({
                id: `transfer-bought-${change.doc.id}`,
                category: 'transfer',
                type: 'offer',
                offerId: change.doc.id,
                playerId: data.playerId,
                targetTab: 'players',
                text: `Traspaso aceptado: ${data.playerName} ahora está en tu equipo.`,
                time: 'Fichaje exitoso',
                read: false,
              });
            }
            // Notify when counter-offer received
            if (data.status === 'countered' && data.senderId === userId) {
              addNotification({
                id: `offer-counter-${change.doc.id}`,
                category: 'transfer',
                type: 'offer',
                offerId: change.doc.id,
                playerId: data.playerId,
                targetTab: 'sent',
                text: `${data.counterBy || 'Un rival'} te envió una contraoferta de ${formatPriceShort((data.counterAmount || 0) / 1000000)} por ${data.playerName}.`,
                time: 'Contraoferta recibida',
                read: false,
              });
            }
          }
        });
      },
      (error) => {
        handleListenerError(error, "Offers", showStatusMessage);
      }
    );
    return () => unsub();
  }, [userId, addNotification, showStatusMessage]);

  // "Desde tu última visita": the live notifications above skip the first snapshot, so what the other clubs did
  // while this manager was away was never shown. Once offers and profile are loaded, it is rebuilt from the
  // offers' history after profile.lastSeenAt (utils/missedEvents.js); opening the panel moves lastSeenAt.
  const missedShownRef = useRef(false);
  useEffect(() => {
    if (missedShownRef.current || !userId || !userProfile || !offersInitializedRef.current) return;
    missedShownRef.current = true;
    const byId = new Map([...incomingOffers, ...sentOffers, ...offerHistory].map(offer => [offer.id, offer]));
    missedOfferNotifications([...byId.values()], userId, Number(userProfile.lastSeenAt))
      .reverse() // addNotification puts each one first: oldest first leaves the newest on top
      .forEach(addNotification);
  }, [userId, userProfile, incomingOffers, sentOffers, offerHistory, addNotification]);
  useEffect(() => {
    if (!isNotificationPanelOpen || !userId) return;
    setDoc(getPrivateProfileRef(userId), { lastSeenAt: Date.now() }, { merge: true })
      .catch(error => console.error('No se pudo guardar la última visita:', error));
  }, [isNotificationPanelOpen, userId, getPrivateProfileRef]);

  useEffect(() => {
    if (!userProfile) return;

    const systemNotifs = [];

    // Alerta 1: Presupuesto Bajo (Menos de 10M) - solo si no fue descartada
    if (remainingBudget < 10000000 && remainingBudget > 0 && !dismissedNotifIdsRef.current.has('system-low-budget')) {
      systemNotifs.push({
        id: 'system-low-budget',
        category: 'system',
        type: 'warning',
        text: 'Tu presupuesto es bajo: quedan menos de $10M.',
        time: 'Finanzas',
      });
    }

    // Alerta 2: Mercado Cerrado - solo si no fue descartada
    if (marketStatus.status === 'closed' && !dismissedNotifIdsRef.current.has('system-market-closed')) {
      systemNotifs.push({
        id: 'system-market-closed',
        category: 'system',
        type: 'info',
        text: 'El mercado está cerrado actualmente.',
        time: 'Info',
      });
    }

    setNotifications(prev => {
      const prevReadMap = new Map(prev.map(n => [n.id, n.read]));
      const updatedSystem = systemNotifs.map(n => ({
        ...n,
        read: prevReadMap.has(n.id) ? prevReadMap.get(n.id) : false
      }));
      const nonSystem = prev.filter(notif => notif.category !== 'system');
      return [...updatedSystem, ...nonSystem].slice(0, 40);
    });
  }, [remainingBudget, marketStatus.status, userProfile]);

  useEffect(() => {
    if (!isAuthReady || !userId) {
      setChatMessages([]);
      chatInitializedRef.current = false;
      return;
    }

    const chatQuery = query(getManagerChatCollectionRef(), orderBy('createdAt', 'desc'), limit(80));
    const unsub = onSnapshot(chatQuery,
      (snap) => {
        const messages = snap.docs
          .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
          .reverse();
        setChatMessages(messages);

        if (!chatInitializedRef.current) {
          chatInitializedRef.current = true;
          return;
        }

        snap.docChanges().forEach(change => {
          if (change.type !== 'added') return;
          const message = { id: change.doc.id, ...change.doc.data() };
          if (message.senderId === userId) return;

          const mentionedMe = Array.isArray(message.mentionedTeamIds) && message.mentionedTeamIds.includes(userId);
          if (!mentionedMe && !message.transferIntent) return;

          const type = message.transferIntent ? 'warning' : 'info';
          const label = message.transferIntent ? 'Chat / Traspaso' : 'Chat';
          const prefix = mentionedMe ? `${message.senderTeamName || 'Un manager'} te menciono` : `${message.senderTeamName || 'Un manager'} hablo de traspasos`;
          addNotification({
            id: `chat-${message.id}`,
            category: 'chat',
            type,
            text: `${prefix}: "${String(message.text || '').slice(0, 110)}${String(message.text || '').length > 110 ? '...' : ''}"`,
            time: label
          });
          setUnreadChatCount(prev => prev + 1);
        });
      },
      (error) => {
        handleListenerError(error, "Manager Chat", showStatusMessage);
      }
    );

    return () => unsub();
  }, [isAuthReady, userId, getManagerChatCollectionRef, addNotification, showStatusMessage]);

  useEffect(() => {
    if (isManagerChatVisible || modalRoute === 'chat') setUnreadChatCount(0);
  }, [isManagerChatVisible, modalRoute]);

  const handleSendChatMessage = useCallback(async (text, gifUrl = '') => {
    if (!userId || !userProfile) return false;
    try {
      const mentionedTeamIds = getMentionedTeamIds(text, allTeams, userId);
      await addDoc(getManagerChatCollectionRef(), {
        text,
        gifUrl,
        senderId: userId,
        senderTeamName: userProfile.teamName || 'Manager',
        senderLogoUrl: userProfile.logoUrl || DEFAULT_LOGO,
        mentionedTeamIds,
        transferIntent: hasTransferIntent(text),
        createdAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error('Error sending manager chat message:', error);
      showStatusMessage('error', 'No se pudo enviar el mensaje.');
      return false;
    }
  }, [userId, userProfile, allTeams, getManagerChatCollectionRef, showStatusMessage]);

  const toggleWishlist = useCallback(async (playerId) => {
    if (!userId || !userProfile) return;
    try {
      const currentWishlist = userProfile.wishlist || [];
      const isWishlisted = currentWishlist.includes(playerId);
      const newWishlist = isWishlisted
        ? currentWishlist.filter(id => id !== playerId)
        : [...currentWishlist, playerId];

      const profileRef = getPrivateProfileRef(userId);
      await setDoc(profileRef, { wishlist: newWishlist }, { merge: true });
    } catch (error) {
      console.error('Error al actualizar wishlist:', error);
      showStatusMessage('error', 'Error al actualizar favoritos.');
    }
  }, [userId, userProfile, getPrivateProfileRef, showStatusMessage]);

  const handleAddToCart = useCallback(async (player, isFranchise = false) => {
    if (!userId || !userProfile) {
      showStatusMessage('error', 'Debes iniciar sesión para fichar jugadores.');
      return false;
    }
    if (!isMarketOpen) {
      showStatusMessage('error', 'El mercado está cerrado.');
      return false;
    }
    if (!isFranchise && marketStatus && marketStatus.status === 'FranchiseMarket') {
      showStatusMessage('error', 'Solo se permiten fichajes de Jugadores Franquicia en este momento.');
      return false;
    }
    if (isFranchise) {
      if (userProfile.franchisePlayerUsed) {
        showStatusMessage('error', 'Ya has utilizado tu ficha de Jugador Franquicia esta temporada.');
        return false;
      }
      if (!isFranchiseEligible(player)) {
        showStatusMessage('error', `El jugador no cumple los requisitos de Jugador Franquicia (${FRANCHISE_RULE_TEXT}).`);
        return false;
      }
    }

    const playerCost = isFranchise ? 0 : player.Precio * 1000000;

    if (!isFranchise && remainingBudget < playerCost) {
      showStatusMessage('error', 'No tienes presupuesto suficiente (incluyendo ofertas comprometidas).');
      return false;
    }
    if (playerLocks[player.Id]) {
      showStatusMessage('error', 'Este jugador ya está bloqueado por otro equipo.');
      return false;
    }

    showStatusMessage('loading', `Fichando a ${player.Name}...`);

    try {
      // El servidor valida precio, presupuesto, mercado y franquicia, y escribe lock, perfil y feed.
      await signPlayerOnServer({ playerId: player.Id, isFranchise: Boolean(isFranchise) });
    } catch (e) {
      console.error('Error al fichar: ', e);
      showStatusMessage('error', e?.message || 'No se pudo añadir al jugador.');
      return false;
    }

    // La copia privada del carrito la crea useSquadSync cuando llega el lock: escribirla antes la dejaría
    // sin lock un instante y la sincronización la borraría.
    showStatusMessage('success', `¡${player.Name} fichado exitosamente!`);
    return true;
  }, [userId, userProfile, remainingBudget, playerLocks, marketStatus, isMarketOpen, showStatusMessage]);

  const handleRemoveFromCart = useCallback(async (player, { confirmed: alreadyConfirmed = false } = {}) => {
    if (!userId || !player) return;
    if (!isMarketOpen) {
      showStatusMessage('error', 'El mercado está cerrado: los jugadores se liberan cuando abra.');
      return;
    }

    const confirmed = alreadyConfirmed || window.confirm(`¿Estás seguro de que deseas liberar a ${player.Name || 'este jugador'} de tu equipo? Su bloqueo quedará disponible para otros managers.`);
    if (!confirmed) return;

    try {
      showStatusMessage('loading', `Liberando a ${player.Name}...`);
      // El servidor borra lock, carrito, el fichaje del feed y la plantilla pública, y cierra las ofertas
      // abiertas por el jugador (antes quedaban reteniendo el dinero de los compradores).
      await releasePlayerOnServer({ playerId: player.Id });
      showStatusMessage('success', `${player.Name} eliminado de tu equipo.`);
    } catch (e) {
      console.error('Error al liberar al jugador: ', e);
      showStatusMessage('error', e?.message || 'No se pudo liberar al jugador.');
    }
  }, [userId, isMarketOpen, showStatusMessage]);

  const handleOpenPlayerFromCart = (player) => {
    handleOpenPlayerModal(player.Id);
    setIsCartVisible(false);
  };


  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return allPlayers.find(p => String(p.Id) === String(selectedPlayerId));
  }, [selectedPlayerId, allPlayers]);

  const uniquePositions = useMemo(() => {
    const posSet = new Set(allPlayers.map(p => p.POS_NOMBRE));
    return Array.from(posSet).sort();
  }, [allPlayers]);

  const sortedCountries = useMemo(() => {
    return Object.entries(countryMap)
      .filter(([id, name]) => id !== "0")
      .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB));
  }, [countryMap]);


  const uniquePlayingStyles = useMemo(() => {
    const styleSet = new Set(allPlayers.map(p => p.PlayingStyle).filter(Boolean));
    return Array.from(styleSet).sort();
  }, [allPlayers]);


  // ── SMART RECOMMENDATION ENGINE ──
  // NOTE: `recommendations` removed — was dead code (never used in JSX).
  // Only `smartRecommendations` below is used.

  const [smartRecommendations, setSmartRecommendations] = useState([]);

  useEffect(() => {
    if (activeTab !== 'Marketplace' || !allPlayers.length || !userProfile) {
      setSmartRecommendations([]);
      return;
    }

    // Schedule calculation in idle time so main render thread is not blocked
    const calculate = () => {
      const recs = calculateSmartRecommendations({
        allPlayers,
        cart,
        playerLocks,
        remainingBudget,
        userProfile,
      });
      setSmartRecommendations(recs);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(calculate, { timeout: 400 });
      return () => window.cancelIdleCallback(idleId);
    } else {
      const timerId = setTimeout(calculate, 50);
      return () => clearTimeout(timerId);
    }
  }, [activeTab, allPlayers, cart, playerLocks, remainingBudget, userProfile]);

  if (isSpecialMode) {
    // OBS Goleadores view
    if (viewParam === 'goleadores' && !isObsMode) {
      if (!tournamentData)
        return <div role="status" className="min-h-screen bg-transparent flex items-center justify-center gap-2 text-white font-bold tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Cargando...</div>;
      const scorers = tournamentData.topScorers || [];
      return (
        <div className={`min-h-screen ${isObsMode ? 'bg-transparent' : 'bg-canvas'} p-8 font-sans`}>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-8 text-center drop-shadow-2xl">MÁXIMOS GOLEADORES</h2>
          <div className="max-w-[800px] mx-auto space-y-4">
            {scorers.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface/80 p-5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center font-black text-2xl text-slate-400">{idx + 1}</div>
                  <div>
                    <div className="text-2xl font-black text-white uppercase">{p.name || '---'}</div>
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">{p.team || '---'}</div>
                  </div>
                </div>
                <div className="text-5xl font-black text-blue-400">{p.goals || 0}</div>
              </div>
            ))}
          </div>
          {isObsMode && <style>{`body, html { background: transparent !important; }`}</style>}
        </div>
      );
    }

    // Copa de Plata OBS: /?mode=obs&view=bracket&tournament=copa-plata
    const effectiveTab = tournamentParam === 'copa-plata' ? 'repechaje' : targetView;

    if (!tournamentData)
      return <div role="status" className="min-h-screen bg-black flex items-center justify-center gap-2 text-white font-bold tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Cargando SCL Data...</div>;

    return (
      <div className={`min-h-screen ${isObsMode ? 'bg-transparent' : 'bg-canvas'}`}>
        <Suspense fallback={null}>
          <TournamentModal
            isVisible={true}
            onClose={() => { }}
            tournamentData={tournamentData}
            isAdmin={false}
            onUpdateTournament={() => { }}
            allTeams={allTeams}
            allPlayers={allPlayers}
            initialTab={effectiveTab}
            userTeamName={userProfile?.teamName}
            isBroadcast={isObsMode}
          />
        </Suspense>
        <style>{`
            .lucide-x, .border-b button { display: none !important; } 
            .flex.border-b.border-slate-700 { display: none !important; }
            ${isObsMode ? 'body, html { background: transparent !important; }' : ''}
        `}</style>
      </div>
    );
  }

  // /torneo?mode=obs no llega acá: el bloque isSpecialMode de arriba ya resuelve todo ?mode=obs.
  if (location.pathname.startsWith('/torneo')) {
    if (!isAuthReady) {
      return <LoadingScreen message="Cargando torneo..." />;
    }

    if (!tournamentData)
      return <div role="status" className="min-h-screen bg-canvas flex items-center justify-center gap-2 text-white font-bold tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Cargando Torneo...</div>;

    return (
      <div className="min-h-screen bg-canvas text-slate-200">
        <Suspense fallback={<LoadingScreen message="Cargando torneo..." />}>
          <TournamentModal
            isVisible={true}
            onClose={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/marketplace');
              }
            }}
            tournamentData={tournamentData}
            isAdmin={isAdmin}
            onUpdateTournament={handleUpdateTournament}
            allTeams={allTeams}
            allPlayers={allPlayers}
            initialTab={initialTab}
            isPage={true}
            userTeamName={userProfile?.teamName}
          />
        </Suspense>
      </div>
    );
  }

  if (firebaseInitializationError) {
    return <FirebaseError />;
  }

  if (location.pathname.startsWith('/team/')) {
    return <Suspense fallback={<LoadingScreen message="Cargando vista..." />}><TeamScreen /></Suspense>;
  }

  if (location.pathname.startsWith('/tactics/view/')) {
    return <Suspense fallback={<LoadingScreen message="Cargando vista..." />}><FormationViewScreen /></Suspense>;
  }

  const isPublicAuthRoute = location.pathname === '/' || location.pathname === '/login';

  // Landing y login se dibujan sin esperar a Firebase Auth cuando no había sesión (utils/sessionHint.js).
  if (isPublicAuthRoute && (isAuthReady || !readSessionHint())) {
    if (user) return <LoadingScreen message="Entrando..." />;
    return (
      <Suspense fallback={<LoadingScreen message={location.pathname === '/' ? "Cargando inicio..." : "Cargando login..."} />}>
        {location.pathname === '/' ? (
          <LandingPage onEnter={() => navigate('/login')} />
        ) : (
          <LoginScreen
            auth={auth}
            db={db}
            externalError={authError}
            onBackToLanding={() => navigate('/')}
          />
        )}
      </Suspense>
    );
  }

  if (!isAuthReady) {
    return <LoadingScreen message="Conectando al servidor..." />;
  }

  if (location.pathname.startsWith('/overlay')) {
    const overlayScene = searchParams.get('scene') || viewParam || broadcastOverlayData.scene || 'live';
    const tournamentOverlayTabs = {
      tabla: 'groups',
      table: 'groups',
      groups: 'groups',
      llaves: 'bracket',
      bracket: 'bracket',
      repechaje: 'repechaje',
    };
    const tournamentOverlayTab = tournamentOverlayTabs[overlayScene];

    if (tournamentOverlayTab) {
      if (!tournamentData) {
        return <div role="status" className="min-h-screen bg-transparent flex items-center justify-center gap-2 text-white font-bold tracking-widest uppercase"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />Cargando torneo...</div>;
      }

      return (
        <div className="min-h-screen bg-transparent">
          <Suspense fallback={null}>
            <TournamentModal
              isVisible={true}
              onClose={() => { }}
              tournamentData={tournamentData}
              isAdmin={false}
              onUpdateTournament={() => { }}
              allTeams={allTeams}
              allPlayers={allPlayers}
              initialTab={tournamentOverlayTab}
              userTeamName={userProfile?.teamName}
              isBroadcast={true}
            />
          </Suspense>
          <style>{`body, html { background: transparent !important; }`}</style>
        </div>
      );
    }

    return (
      <BroadcastOverlay
        overlayData={broadcastOverlayData}
        allTeams={allTeams}
        tournamentData={tournamentData}
        forcedScene={overlayScene}
      />
    );
  }


  if (!user) {
    return <LoadingScreen message="Volviendo al inicio..." />;
  }

  if (isLoading || marketStatus.status === 'loading') {
    return <LoadingScreen message="Conectando al servidor..." error={appError} />;
  }

  if (needsGoogleLinking) {
    return <LinkGoogleScreen auth={auth} db={db} user={user} onLinked={() => setNeedsGoogleLinking(false)} />;
  }

  if (!userProfile) {
    return <LoadingScreen message="Cargando perfil de usuario..." error={appError} />;
  }

  // A new account waits for the admin (supabase/functions/_shared/membership.js). The team listener updates
  // allTeams when it is approved, which lets the app through without a reload.
  if (!isAdmin && allTeams?.[userId] && !isTeamApproved(allTeams[userId])) {
    return <PendingApprovalScreen teamName={userProfile?.teamName} onLogout={handleLogout} />;
  }

  return (
    <>
      {/* ── OFFLINE STATUS BANNER ── */}
      {!isOnline && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-0 left-0 right-0 z-[999] bg-danger text-ink px-4 py-2 text-sm font-semibold flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Sin conexión a internet. Los cambios no se sincronizarán hasta restablecer la red.</span>
          </div>
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.onLine) {
                setIsOnline(true);
                showStatusMessage('success', 'Conexión verificada.');
              } else {
                showStatusMessage('error', 'Aún sin conexión a internet.');
              }
            }}
            type="button"
            className="btn btn-sm bg-white/20 hover:bg-white/30 text-ink shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-on-accent focus:font-semibold">Saltar al contenido</a>
      <div className="flex h-[100dvh] w-full bg-canvas text-ink overflow-hidden font-sans">

        {/* SIDEBAR — ancho 0 cuando cerrada, 224px cuando abierta */}
        <LeftSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          hasPesAccess={hasPesAccess}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onHelpClick={() => openModalRoute('tutorial')}
          onShortcutsClick={() => setIsShortcutsHelpOpen(true)}
          onSuggestionsClick={() => openModalRoute('suggestions')}
          onLogout={handleLogout}
          remainingBudget={remainingBudget}
          initialBudget={userProfile?.budget}
        />

        <div className="flex-1 flex flex-col overflow-hidden relative bg-canvas transition-colors">
          {/* TOP HEADER con hamburger */}
          <TopHeader
            userId={userId}
            userProfile={userProfile}
            unreadCount={notifications.filter(notification => notification.read !== true).length}
            unreadChatCount={unreadChatCount}
            remainingBudget={remainingBudget}
            initialBudget={userProfile?.budget}
            onNotificationClick={() => {
              setAreNotificationsWarmed(true);
              setIsNotificationPanelOpen(!isNotificationPanelOpen);
            }}
            onChatClick={() => openModalRoute('chat')}
            onTransferFeedClick={() => {
              setShouldPrefetchTransfers(true);
              openModalRoute('transfers');
            }}
            onShortcutsClick={() => setIsShortcutsHelpOpen(true)}
            onNotificationPrefetch={() => setAreNotificationsWarmed(true)}
            onChatPrefetch={prefetchManagerChat}
            onTransferFeedPrefetch={() => { prefetchTransferFeed(); setShouldPrefetchTransfers(true); }}
            onLogout={handleLogout}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          />

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-hidden w-full flex relative">

            {/* CENTER VIEW - MARKETPLACE MULTIPLEXING */}
            <main data-app-tour="main" className={`flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 flex flex-col bg-canvas ${compareList.length > 0 ? 'pb-32 lg:pb-32' : ''}`} id="main-content" tabIndex={-1}>
              {!isMarketOpen && <MarketClosedBanner marketStatus={marketStatus} />}
              {/* VISTA RESUMEN / INICIO (SOFASCORE STYLE) */}
              {activeTab === 'Overview' && (
                <div className="animate-in fade-in">
                  <OverviewTab
                    userProfile={userProfile}
                    remainingBudget={remainingBudget}
                    ownedCart={ownedCart}
                    tournamentData={tournamentData}
                    allTeams={allTeams}
                    setActiveTab={setActiveTab}
                    onPlayerClick={handleOpenPlayerModal}
                    signingToasts={signingToasts}
                    isLoading={isLoading || tournamentData === null}
                  />
                </div>
              )}

              <MarketplaceView
                isActive={activeTab === 'Marketplace'}
                isMobileViewport={isMobileViewport}
                filters={filters}
                setFilters={setFilters}
                resetFilters={resetFilters}
                onClearSearchAndFilters={() => setFilters(initialFilters)}
                onOpenFilters={() => openModalRoute('filters')}
                sortConfig={sortConfig}
                setSortConfig={setSortConfig}
                viewMode={viewMode}
                setViewMode={setViewMode}
                density={gridDensity}
                setDensity={setGridDensity}
                players={filteredPlayers}
                isCatalogLoading={!hasLoadedPlayerDatabase && allPlayers.length === 0}
                playersLoadError={playersLoadError}
                countriesLoadError={countriesLoadError}
                onRetryCatalog={retryPlayerCatalog}
                budgetPercent={budgetPercent}
                recommendations={smartRecommendations}
                showBudgetExhausted={remainingBudget > 0 && remainingBudget < 1000000 && allPlayers.length > 0 && smartRecommendations.length === 0}
                isFranchiseMarket={marketStatus.status === 'FranchiseMarket'}
                hasUsedFranchise={Boolean(userProfile?.franchisePlayerUsed)}
                franchisePlayerName={userProfile?.franchisePlayerId ? playerById.get(String(userProfile.franchisePlayerId))?.Name : null}
                playerLocks={playerLocks}
                userId={userId}
                allTeams={allTeams}
                wishlistSet={wishlistSet}
                comparingIdsSet={comparingIdsSet}
                onSelectPlayer={handleOpenPlayerModal}
                onToggleWishlist={toggleWishlist}
                onCompare={handleToggleCompare}
              />


              {/* VISTAS MODULARES EN LUGAR DE PLACEHOLDERS */}
              <Suspense fallback={null}>
                {activeTab === 'My Team' && (
                  <div className="animate-in fade-in h-full w-full">
                    <CartModal
                      isVisible={true}
                      onClose={() => setActiveTab('Overview')}
                      cart={ownedCart}
                      initialTab={clubTab}
                      onRemoveFromCart={handleRemoveFromCart}
                      isMarketOpen={isMarketOpen}
                      userProfile={userProfile}
                      userId={userId}
                      isSquadLoading={!isCartSynced && ownedCart.length === 0}
                      budgetBase={budgetBase}
                      budgetPercent={budgetPercent}
                      totalCartCost={totalCartCost}
                      remainingBudget={remainingBudget}
                      committedInOffers={committedInOffers}
                      incomingOffers={incomingOffers}
                      sentOffers={sentOffers}
                      offerHistory={offerHistory}
                      countryMap={countryMap}
                      onPlayerClick={handleOpenPlayerFromCart}
                      allPlayers={allPlayers}
                      allTeams={allTeams}
                      onOpenTactics={() => navigate('/tactics')}
                      showStatusMessage={showStatusMessage}
                      isPage={true}
                    />
                  </div>
                )}
                {activeTab === 'Tactics' && (
                  <div className="animate-in fade-in h-full w-full">
                    <FormationModal
                      isVisible={true}
                      onClose={() => navigate('/my-team')}
                      cart={ownedCart}
                      userProfile={userProfile}
                      userId={userId}
                      getPrivateProfileRef={getPrivateProfileRef}
                      getPublicTeamRef={getPublicTeamRef}
                      showStatusMessage={showStatusMessage}
                      db={db}
                      isPage={true}
                    />
                  </div>
                )}
                {activeTab === 'Scouting' && (
                  <div className="animate-in fade-in h-full w-full">
                    <ScoutAssignmentsPanel
                      db={db}
                      userId={userId}
                      isAdmin={isAdmin}
                      userProfile={userProfile}
                      allPlayers={allPlayers}
                      playerLocks={playerLocks}
                      countryMap={countryMap}
                      remainingBudget={remainingBudget}
                      wishlistSet={wishlistSet}
                      onAddToWatchlist={toggleWishlist}
                      onPlayerClick={(player) => {
                        handleOpenPlayerModal(player.Id);
                      }}
                      addNotification={addNotification}
                      showStatusMessage={showStatusMessage}
                    />
                  </div>
                )}
                {activeTab === 'Other Teams' && (
                  <div className="animate-in fade-in h-full w-full">
                    <TeamsModal
                      isVisible={true}
                      onClose={() => setActiveTab('Marketplace')}
                      allTeams={allTeams}
                      currentUserId={userId}
                      isLoading={!isTeamsLoaded || !isLocksLoaded || !hasLoadedPlayerDatabase}
                      playerLocks={playerLocks}
                      allPlayers={allPlayers}
                      countryMap={countryMap}
                      onPlayerClick={(player) => {
                        handleOpenPlayerModal(player.Id);
                      }}
                      isPage={true}
                      title="Rivales"
                      subtitle="Planteles e inversión de los otros clubes de la liga."
                    />
                  </div>
                )}
                {activeTab === 'PES' && hasPesAccess && (
                  <div className="animate-in fade-in h-full w-full overflow-y-auto">
                    <Suspense fallback={null}>
                      <PesWorkspaceScreen userId={userId} isAdmin={isAdmin} allTeams={allTeams} appPlayers={allPlayers} />
                    </Suspense>
                  </div>
                )}
                {activeTab === 'Tournament' && (
                  <div className="h-full w-full">
                    <TournamentModal
                      isPage={true}
                      isVisible={true}
                      tournamentData={tournamentData}
                      isAdmin={isAdmin}
                      onUpdateTournament={handleUpdateTournament}
                      allTeams={allTeams}
                      allPlayers={allPlayers}
                      userTeamName={userProfile?.teamName}
                    />
                  </div>
                )}
                {activeTab === 'Admin' && isAdmin && (
                  <div className="animate-in fade-in h-full w-full">
                    <AdminModal
                      isVisible={true}
                      isPage={true}
                      onClose={() => setActiveTab('Overview')}
                      getPublicTeamsCollectionRef={getPublicTeamsCollectionRef}
                      getPrivateProfileRef={getPrivateProfileRef}
                      getPublicTeamRef={getPublicTeamRef}
                      getMarketStatusDocRef={getMarketStatusDocRef}
                      getBroadcastOverlayDocRef={getBroadcastOverlayDocRef}
                      broadcastOverlayData={broadcastOverlayData}
                      onUpdateBroadcastOverlay={handleUpdateBroadcastOverlay}
                      getSuggestionsCollectionRef={getSuggestionsCollectionRef}
                      getPublicLocksCollectionRef={getPublicLocksCollectionRef}
                      allTeams={allTeams}
                      playerLocks={playerLocks}
                      allPlayers={allPlayers}
                      storage={storage}
                      db={db}
                      showStatusMessage={showStatusMessage}
                      tournamentData={tournamentData}
                      onUpdateTournament={handleUpdateTournament}
                      onOpenTournamentModal={() => setIsTournamentModalVisible(true)}
                    />
                  </div>
                )}
              </Suspense>
            </main> {/* End scrollable center pane */}

            {/* RIGHT SIDEBAR - ACTIVITY PANEL */}
          </div> {/* End flex-1 row */}
        </div> {/* End flex-1 col */}
      </div> {/* End h-screen */}
      {compareList.length > 0 && (
        <div className="fixed bottom-3 left-3 right-3 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50" role="region" aria-label="Comparador de jugadores">
          {/* The entry animation sits on the panel: on the wrapper its transform replaced the -translate-x-1/2
              centring for the first 180 ms, so the tray slid in sideways. */}
          <div className="panel flex items-center justify-between gap-3 sm:gap-5 p-3 sm:pl-4 sm:pr-3 animate-in slide-in-from-bottom">
            <div className="flex items-center gap-3">
              {[0, 1].map(slot => {
                const p = compareList[slot];
                if (!p) {
                  return (
                    <span key={slot} className="w-14 h-14 rounded-xl border-2 border-dashed border-line/25 flex items-center justify-center text-ink-3 text-xs text-center leading-tight px-1">
                      Elegí otro
                    </span>
                  );
                }
                return (
                  <div key={p.Id} className="relative animate-in zoom-in-90">
                    <img src={`/fotos_jugadores/${p.Id}.webp`} alt="" width={56} height={56}
                      className="w-14 h-14 rounded-xl object-cover object-top bg-raised border border-line/15"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded font-display num text-xs font-bold ${getStatAndOvrColorClass(p.OVR_CALCULADO)}`}>
                      {p.OVR_CALCULADO}
                    </span>
                    <button type="button" onClick={() => handleRemoveCompareItem(p.Id)} aria-label={`Quitar a ${p.Name} del comparador`}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-overlay border border-line/25 text-ink-2 hover:text-ink flex items-center justify-center">
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-sm font-semibold text-ink truncate max-w-[14rem]">{compareList.map(p => p.Name).join(' vs ')}</p>
              <p className="text-xs text-ink-3">{compareList.length < 2 ? 'Elegí un segundo jugador para comparar.' : 'Listos para comparar.'}</p>
            </div>
            <button type="button" disabled={compareList.length < 2} onClick={() => openModalRoute('compare')} className="btn btn-primary min-h-11">
              <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />Comparar
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
      <ComparisonModal
        isVisible={Boolean((isComparisonModalVisible || modalRoute === 'compare') && compareList[0] && compareList[1])}
        onClose={() => closeModalRoute(setIsComparisonModalVisible)}
        playerA={compareList[0]}
        playerB={compareList[1]}
      />
      <TutorialModal
        isVisible={isTutorialVisible || modalRoute === 'tutorial'}
        onClose={() => closeModalRoute(setIsTutorialVisible)}
        budget={userProfile?.budget || DEFAULT_BUDGET}
      />

      <FiltrosModal
        isVisible={isFiltrosModalVisible || modalRoute === 'filters'}
        onClose={() => closeModalRoute(setIsFiltrosModalVisible)}
        filters={filters}
        setFilters={setFilters}
        resetFilters={resetFilters}
        uniquePositions={uniquePositions}
        sortedCountries={sortedCountries}
        uniquePlayingStyles={uniquePlayingStyles}
        // PROPS NUEVAS:
        userId={userId}
        getSavedFiltersCollectionRef={getSavedFiltersCollectionRef}
        showStatusMessage={showStatusMessage}
        resultCount={filteredPlayers.length}
      />

      <PlayerModal
        player={selectedPlayer}
        countryMap={countryMap}
        onClose={handleClosePlayerModal}
        onAddToCart={handleAddToCart}
        cartStatus={
          selectedPlayer ?
            (playerLocks[selectedPlayer.Id] ?
              (playerLocks[selectedPlayer.Id].lockedBy === userId ? 'IN_MY_CART' : 'LOCKED_BY_OTHER')
              : 'AVAILABLE')
            : 'NONE'
        }
        lockedTeamName={
          (selectedPlayer && playerLocks[selectedPlayer.Id]) ? playerLocks[selectedPlayer.Id].teamName : null
        }
        targetTeamId={
          (selectedPlayer && playerLocks[selectedPlayer.Id]) ? playerLocks[selectedPlayer.Id].lockedBy : null
        }
        userId={userId}
        userProfile={userProfile}
        remainingBudget={remainingBudget}
        isInMyCart={selectedPlayer && ownedCart.some(p => p.Id === selectedPlayer.Id)}
        isFranchisePlayer={selectedPlayer && playerLocks[selectedPlayer.Id]?.isFranchise}
        onRemoveFromCart={handleRemoveFromCart}
        allPlayers={allPlayers}
        onPlayerSwitch={(p) => setSelectedPlayerId(p.Id)}
        marketStatus={marketStatus}
        isMarketOpen={isMarketOpen}
      />
      {(isCartVisible || modalRoute === 'cart') && (
        <CartModal
          isVisible={true}
          isPage={false}
          initialTab={cartInitialTab}
          onClose={() => {
            setCartInitialTab('players');
            closeModalRoute(setIsCartVisible);
          }}
          cart={ownedCart}
          onRemoveFromCart={handleRemoveFromCart}
          isMarketOpen={isMarketOpen}
          userProfile={userProfile}
          userId={userId}
          isSquadLoading={!isCartSynced && ownedCart.length === 0}
          budgetBase={budgetBase}
          budgetPercent={budgetPercent}
          totalCartCost={totalCartCost}
          remainingBudget={remainingBudget}
          committedInOffers={committedInOffers}
          incomingOffers={incomingOffers}
          sentOffers={sentOffers}
          offerHistory={offerHistory}
          countryMap={countryMap}
          onPlayerClick={handleOpenPlayerFromCart}
          allPlayers={allPlayers}
          allTeams={allTeams}
          showStatusMessage={showStatusMessage}
        />
      )}
      <TeamsModal
        isVisible={isTeamsModalVisible || modalRoute === 'teams'}
        onClose={() => closeModalRoute(setIsTeamsModalVisible)}
        allTeams={allTeams}
        currentUserId={userId}
        isLoading={!isTeamsLoaded || !isLocksLoaded || !hasLoadedPlayerDatabase}
        playerLocks={playerLocks}
        allPlayers={allPlayers}
        countryMap={countryMap}
        onPlayerClick={(player) => {
          handleOpenPlayerModal(player); // 1. Abre el perfil del jugador
          closeModalRoute(setIsTeamsModalVisible);
        }}
      />
      {(isAdminModalVisible || modalRoute === 'admin') && isAdmin && (
        <AdminModal
          isVisible={true}
          isPage={false}
          onClose={() => closeModalRoute(setIsAdminModalVisible)}
          getPublicTeamsCollectionRef={getPublicTeamsCollectionRef}
          getPrivateProfileRef={getPrivateProfileRef}
          getPublicTeamRef={getPublicTeamRef}
          getMarketStatusDocRef={getMarketStatusDocRef}
          getBroadcastOverlayDocRef={getBroadcastOverlayDocRef}
          broadcastOverlayData={broadcastOverlayData}
          onUpdateBroadcastOverlay={handleUpdateBroadcastOverlay}
          getSuggestionsCollectionRef={getSuggestionsCollectionRef}
          getPublicLocksCollectionRef={getPublicLocksCollectionRef}
          allTeams={allTeams}
          playerLocks={playerLocks}
          allPlayers={allPlayers}
          storage={storage}
          db={db}
          showStatusMessage={showStatusMessage}
          tournamentData={tournamentData}
          onUpdateTournament={handleUpdateTournament}
          onOpenTournamentModal={() => {
            setIsAdminModalVisible(false);
            setIsTournamentModalVisible(true);
          }}
        />
      )}
      {(isTournamentModalVisible || modalRoute === 'tournament') && isAdmin && (
        <TournamentModal
          isVisible={true}
          onClose={() => closeModalRoute(setIsTournamentModalVisible)}
          tournamentData={tournamentData}
          isAdmin={isAdmin}
          onUpdateTournament={handleUpdateTournament}
          allTeams={allTeams}
          allPlayers={allPlayers}
          userTeamName={userProfile?.teamName}
        />
      )}

      <SuggestionsModal
        isVisible={isSuggestionsModalVisible || modalRoute === 'suggestions'}
        onClose={() => closeModalRoute(setIsSuggestionsModalVisible)}
        teamName={userProfile?.teamName}
        userId={userId}
        getSuggestionsCollectionRef={getSuggestionsCollectionRef}
        showStatusMessage={showStatusMessage}
      />

      {(isFormationModalVisible || modalRoute === 'formation') && (
        <FormationModal
          isVisible={true}
          onClose={() => closeModalRoute(setIsFormationModalVisible)}
          cart={ownedCart}
          userProfile={userProfile}
          userId={userId}
          getPrivateProfileRef={getPrivateProfileRef}
          getPublicTeamRef={getPublicTeamRef}
          showStatusMessage={showStatusMessage}
          db={db}
        />
      )}

      <TransferFeed
        db={db}
        isVisible={isTransferFeedVisible || modalRoute === 'transfers'}
        shouldPrefetch={shouldPrefetchTransfers}
        onClose={() => closeModalRoute(setIsTransferFeedVisible)}
        playerLocks={playerLocks}
        allTeams={allTeams}
      />

      <ManagerChat
        isVisible={isManagerChatVisible || modalRoute === 'chat'}
        onClose={() => closeModalRoute(setIsManagerChatVisible)}
        messages={chatMessages}
        allTeams={allTeams}
        userId={userId}
        userProfile={userProfile}
        onSendMessage={handleSendChatMessage}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        allPlayers={allPlayers}
        onSelectPlayer={(id) => handleOpenPlayerModal(id)}
        setActiveTab={setActiveTab}
        openModalRoute={openModalRoute}
      />

      <KeyboardShortcutsHelp
        isOpen={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
      </Suspense>

      <InstallPopup
        isVisible={showInstallPopup && !!installPrompt}
        onInstall={handleInstallClick}
        onClose={() => setShowInstallPopup(false)}
      />
      <NotificationsPanel
        isOpen={isNotificationPanelOpen}
        notifications={notifications}
        isLoading={!areNotificationsWarmed && notifications.length === 0}
        onClose={() => setIsNotificationPanelOpen(false)}
        onClear={() => {
          notifications.forEach(n => dismissedNotifIdsRef.current.add(n.id));
          try {
            sessionStorage.setItem('dismissed_notif_ids', JSON.stringify(Array.from(dismissedNotifIdsRef.current).slice(-100)));
          } catch {}
          setNotifications([]);
        }}
        onDismissOne={(notification) => {
          dismissedNotifIdsRef.current.add(notification.id);
          try {
            sessionStorage.setItem('dismissed_notif_ids', JSON.stringify(Array.from(dismissedNotifIdsRef.current).slice(-100)));
          } catch {}
          setNotifications(prev => prev.filter(item => item.id !== notification.id));
        }}
        onMarkAllRead={() => setNotifications(prev => prev.map(item => ({ ...item, read: true })))}
        onNotifClick={handleNotificationClick}
      />

      {/* BUDGET ALERT MODAL */}
      {showBudgetAlert && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="budget-alert-title" className="fixed inset-0 z-modal flex items-end sm:items-center justify-center sm:p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowBudgetAlert(false)}>
          <div className="panel w-full sm:max-w-sm p-6 rounded-b-none sm:rounded-2xl animate-in slide-in-from-bottom sm:zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-xl bg-warning/[0.14] flex items-center justify-center text-warning-soft shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </span>
              <h2 id="budget-alert-title" className="font-display text-xl font-bold text-ink">Presupuesto casi agotado</h2>
            </div>
            <p className="text-sm text-ink-2">Te quedan</p>
            <p className="font-display num text-4xl font-bold text-warning-soft leading-tight mb-5">${(remainingBudget / 1000000).toFixed(1)}M</p>
            <button type="button" onClick={() => setShowBudgetAlert(false)} className="btn btn-primary w-full min-h-12">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* TOASTS — global feedback and rivals' signings, one stack */}
      <ToastStack
        statusMessage={statusMessage}
        onCloseStatus={closeStatusMessage}
        signingToasts={signingToasts}
        onOpenSigning={handleToastClick}
        onDismissSigning={dismissSigningToast}
        isAboveTray={compareList.length > 0}
      />
    </>
  );
}

export default firebaseInitializationError ? FirebaseError : App; 
