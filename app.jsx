import React, { useState, useEffect, useMemo, useCallback, memo, useRef, Suspense } from 'react';
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, DEFAULT_BUDGET, DEFAULT_LOGO, ADMIN_USER_ID, ADMIN_USER_IDS, APP_ID, FRANCHISE_MIN_AGE, FRANCHISE_MIN_OVR, FRANCHISE_MAX_OVR } from './utils/constants.js';
import { formatPriceShort, normalizarString, processPlayersData, getPosColorClass, getStatAndOvrColorClass, getFlagUrl, getRegionById } from './utils/helpers.js';
import { PlayerCard } from './components/PlayerCard.jsx';
import { RecommendationsAccordion } from './components/RecommendationsAccordion.jsx';
import { LeftSidebar } from './components/LeftSidebar.jsx';
import { TopHeader } from './components/TopHeader.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db, storage, firebaseInitializationError } from './config/firebase.js';
import { LinkGoogleScreen } from './screens/LinkGoogleScreen.jsx';
import { MaintenanceScreen } from './screens/MaintenanceScreen.jsx';
import { InstallPopup } from './components/InstallPopup.jsx';
import { StatusAlert } from './components/StatusAlert.jsx';
import { NotificationsPanel } from './components/NotificationsPanel.jsx';
import { SearchBar } from './components/SearchBar.jsx';
import { PlayerListItem } from './components/PlayerListItem.jsx';
import { VirtualizedPlayerList, VirtualizedPlayerGrid } from './components/VirtualizedPlayers.jsx';
import { BroadcastOverlay, DEFAULT_BROADCAST_OVERLAY } from './components/BroadcastOverlay.jsx';
import { normalizeTournamentView } from './utils/tournamentViews.js';
import { getMentionedTeamIds, hasTransferIntent } from './utils/managerChatUtils.js';
import { makePrefetchable, schedulePrefetchOnIdle } from './utils/prefetch.js';
import { OverviewTab } from './components/OverviewTab.jsx';
import { useFirebaseData } from './hooks/useFirebaseData.js';
import { useAuth } from './hooks/useAuth.js';
import { usePesAccess } from './hooks/usePesAccess.js';
import { useBudget } from './hooks/useBudget.js';
import { useHoverPreview } from './hooks/useHoverPreview.js';
import { useKeyboardShortcuts, isTyping } from './hooks/useKeyboardShortcuts.js';
import { useScrollRestore } from './hooks/useScrollRestore.js';
import { calculateSmartRecommendations } from './utils/recommendations.js';
import { handleListenerError } from './utils/listenerErrorHandler.js';
import { PlayerPreview } from './components/ui/PlayerPreview.jsx';
import { KeyboardShortcutsHelp } from './components/ui/KeyboardShortcutsHelp.jsx';
import { PageHeader } from './components/ui/PageHeader.jsx';
import { Alert } from './components/ui/Alert.jsx';
import { EmptyState } from './components/ui/EmptyState.jsx';

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
  Search,
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
  runTransaction,
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

function LoadingScreen({ message }) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-surface text-ink-2 font-sans text-xl text-center p-5">
      <div className="w-10 h-10 border-4 border-line/20 border-t-blue-500 rounded-full animate-spin mb-5"></div>
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
            e.target.src = `https://placehold.co/40x40/374151/e0e0e0?text=${player.Name.substring(0, 1)}`;
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

  const hoverPreview = useHoverPreview(400);

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
  const [contadorMsg, setContadorMsg] = useState("Cargando jugadores...");
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  // Franja de celular chico (<=480px) — `.market-player-card-shell` en index.css
  // tiene una CUARTA regla responsive específica para esta franja (achica la card
  // a un tope de 154px), separada de la base "mobile" (238px) que cubre 481-767px.
  const [isSmallMobileViewport, setIsSmallMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 480;
  });
  // Se usa junto con isMobileViewport para calcular cuántas columnas le pasamos al
  // Grid virtualizado — replica los mismos breakpoints (md=768, xl=1280) que antes
  // tenía `gridColumnClass` en Tailwind, pero como número (react-window lo necesita).
  const [isXlViewport, setIsXlViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1280;
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' o 'list'
  const [gridColumns, setGridColumns] = useState(6);
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
  const getPublicLockDocRef = useCallback((playerId) => doc(db, `artifacts/${APP_ID}/public/data/player_locks`, String(playerId)), []);
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
      setIsSmallMobileViewport(window.innerWidth <= 480);
      setIsXlViewport(window.innerWidth >= 1280);
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


  const { cart, playerLocks, isLocksLoaded, allTeams, userProfile } = useFirebaseData(
    userId, isAuthReady, getPrivateCartCollectionRef, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, getPrivateProfileRef, setAppError, setIsLoading, showStatusMessage);
  const shouldLoadPlayerDatabase = useMemo(() => {
    if (isSpecialMode || location.pathname.startsWith('/overlay') || location.pathname.startsWith('/team/') || location.pathname.startsWith('/tactics/view/')) {
      return false;
    }
    if (location.pathname === '/' || location.pathname === '/login') return false;
    const tabsThatNeedPlayers = new Set(['Marketplace', 'My Team', 'Tactics', 'Scouting', 'Other Teams']);
    const modalsThatNeedPlayers = new Set(['filters', 'cart', 'teams', 'compare']);
    return tabsThatNeedPlayers.has(activeTab) || modalsThatNeedPlayers.has(modalRoute) || Boolean(selectedPlayerId) || compareList.length > 0;
  }, [activeTab, compareList.length, isSpecialMode, location.pathname, modalRoute, selectedPlayerId]);

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
      openModalRoute('tournament');
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
    setContadorMsg('Reintentando cargar jugadores...');
    setCatalogReloadKey(previous => previous + 1);
  }, []);

  useEffect(() => {
    if (!shouldLoadPlayerDatabase || hasLoadedPlayerDatabase) return;
    let isCancelled = false;

    fetch('/jugadores.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Catálogo no disponible (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('El catálogo no contiene jugadores.');
        }
        setPlayersLoadError('');
        // PASO 1: Primero limpiamos los jugadores con bugs (stats imposibles) usando la data cruda
        const cleanPlayers = data.filter(p => {
          const statsDeCampo = ['Finishing', 'DefensiveAwareness', 'Speed', 'BallControl', 'LowPass'];
          // Verificamos si tiene stats "glitcheadas" (todo 80 o todo 40)
          const esBug80 = statsDeCampo.every(key => Number(p[key]) === 80);
          const esBug40 = statsDeCampo.every(key => Number(p[key]) === 40);

          // Si es un bug, lo sacamos (return false)
          if (esBug80 || esBug40) return false;
          return true;
        });

        // PASO 2: AHORA procesamos los datos limpios para agregar 'searchableName' y arreglar números
        // Esto es vital para que la búsqueda y los filtros funcionen en el celular
        const optimizedData = processPlayersData(cleanPlayers);

        // PASO 3: Guardamos la versión final UNA SOLA VEZ
        setAllPlayers(optimizedData);
        setContadorMsg("Usa los filtros para encontrar jugadores.");
        setHasLoadedPlayerDatabase(true);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("Error cargando jugadores.json:", err);
        setAllPlayers([]);
        setPlayersLoadError('No se pudo cargar la base de jugadores. Revisá tu conexión e intentá nuevamente.');
        setContadorMsg("No se pudieron cargar jugadores.");
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




  const handleUpdateTournament = async (newData) => {
    if (!isAdmin) return;
    try {
      await setDoc(getTournamentDocRef(), newData, { merge: true });
      const completedMatches = (newData.matches || []).filter(match => match.status === 'completed' && match.id);
      await Promise.all(completedMatches.map(match => setDoc(
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
      )));
      showStatusMessage('success', 'Torneo actualizado correctamente.');
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al guardar datos del torneo.');
    }
  };

  const handleUpdateBroadcastOverlay = async (newData) => {
    if (!isAdmin) return;
    try {
      await setDoc(getBroadcastOverlayDocRef(), newData, { merge: true });
      showStatusMessage('success', 'Overlay OBS actualizado.');
    } catch (e) {
      console.error(e);
      showStatusMessage('error', 'Error al guardar overlay OBS.');
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
        const isFranchiseEligible = p.Age >= FRANCHISE_MIN_AGE && p.OVR_CALCULADO >= FRANCHISE_MIN_OVR && p.OVR_CALCULADO <= FRANCHISE_MAX_OVR;
        if (!isFranchiseEligible) return false;
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

  const pageSize = isMobileViewport ? 16 : 64;
  const [displayCount, setDisplayCount] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 16 : 48));

  // Reset displayCount on filter, search or sort change
  useEffect(() => {
    setDisplayCount(pageSize);
  }, [filters, debouncedName, sortConfig, pageSize]);

  const visiblePlayers = useMemo(() => {
    return filteredPlayers.slice(0, displayCount);
  }, [filteredPlayers, displayCount]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => {
      if (prev >= filteredPlayers.length) return prev;
      return Math.min(prev + (isMobileViewport ? 16 : 64), filteredPlayers.length);
    });
  }, [isMobileViewport, filteredPlayers.length]);

  const mobileSentinelRef = useRef(null);

  useEffect(() => {
    if (!isMobileViewport || visiblePlayers.length >= filteredPlayers.length) return;
    const sentinel = mobileSentinelRef.current;

    // Usar IntersectionObserver nativo de alta eficiencia con umbral suave
    if (sentinel && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      }, { rootMargin: '120px' });
      observer.observe(sentinel);
      return () => observer.disconnect();
    }

    // Fallback optimizado con requestAnimationFrame solo si IntersectionObserver no existe
    let ticking = false;
    const scrollContainer = document.getElementById('main-content') || window;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const el = document.getElementById('main-content');
          if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 600) {
            handleLoadMore();
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isMobileViewport, visiblePlayers.length, filteredPlayers.length, handleLoadMore]);

  // Mantener una función "applyFilters" vacía por si algún componente hijo la pide
  const applyFilters = useCallback(() => { }, []);

  // Mensaje de contador
  useEffect(() => {
    if (filteredPlayers.length === 0) setContadorMsg("No se encontraron jugadores.");
    else if (visiblePlayers.length < filteredPlayers.length) {
      setContadorMsg(`Mostrando ${visiblePlayers.length} de ${filteredPlayers.length} encontrados (${allPlayers.length} total).`);
    } else {
      setContadorMsg(`Mostrando ${filteredPlayers.length} de ${allPlayers.length} jugadores.`);
    }
  }, [visiblePlayers.length, filteredPlayers.length, allPlayers.length]);

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

  // Hook desacoplado de Finanzas y Presupuesto (Fase 2)
  const {
    totalCartCost,
    committedInOffers,
    remainingBudget,
    budgetPercent,
    showBudgetAlert,
    setShowBudgetAlert,
  } = useBudget({
    userProfile,
    ownedCart,
    userId,
    sentOffers,
  });

  const playerById = useMemo(() => {
    const map = new Map();
    allPlayers.forEach((player) => {
      map.set(String(player.Id), player);
    });
    return map;
  }, [allPlayers]);

  const wishlistSet = useMemo(() => {
    return new Set(userProfile?.wishlist || []);
  }, [userProfile?.wishlist]);

  const comparingIdsSet = useMemo(() => {
    return new Set(compareList.map(player => player.Id));
  }, [compareList]);

  // Antes esto devolvía una clase de Tailwind (para un <div className="grid ...">).
  // Ahora el Grid virtualizado necesita el número de columnas directamente — se
  // replican los mismos breakpoints (md=768, xl=1280) que tenía la clase original.
  const gridColumnCount = useMemo(() => {
    switch (gridColumns) {
      case 2: return 2;
      case 3: return 3;
      case 4: return isMobileViewport ? 3 : 4;
      default: return isXlViewport ? 6 : isMobileViewport ? 3 : 4;
    }
  }, [gridColumns, isMobileViewport, isXlViewport]);

  // El alto de `.market-player-card-shell` en index.css cambia en 4 franjas (no 3
  // como se asumió la primera vez) — esto le dice al Grid virtualizado qué tope usar
  // en cada caso, para que la fila no le quede corta (recorta la card) ni de más
  // (deja un hueco vacío entre filas, que es justo lo que pasaba en celulares chicos:
  // ahí la card real mide hasta 154px pero la fila se calculaba con 238px).
  const gridCardMaxHeight = useMemo(() => {
    if (isXlViewport) return 278;        // >=1280px
    if (!isMobileViewport) return 252;   // 768-1279px (md)
    if (isSmallMobileViewport) return 154; // <=480px
    return 238;                          // 481-767px (mobile base)
  }, [isMobileViewport, isSmallMobileViewport, isXlViewport]);

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
                text: `Venta confirmada: ${data.playerName} fue transferido a ${data.senderTeamName || 'otro equipo'} por ${formatPriceShort((data.counterAmount || data.offerAmount || 0) / 1000000)}.`,
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
    if (!isFranchise && marketStatus && marketStatus.status === 'FranchiseMarket') {
      showStatusMessage('error', 'Solo se permiten fichajes de Jugadores Franquicia en este momento.');
      return false;
    }
    if (isFranchise) {
      if (userProfile.franchisePlayerUsed) {
        showStatusMessage('error', 'Ya has utilizado tu ficha de Jugador Franquicia esta temporada.');
        return false;
      }
      const isFranchiseEligible = player.Age >= FRANCHISE_MIN_AGE && player.OVR_CALCULADO >= FRANCHISE_MIN_OVR && player.OVR_CALCULADO <= FRANCHISE_MAX_OVR;
      if (!isFranchiseEligible) {
        showStatusMessage('error', `El jugador no cumple los requisitos de Jugador Franquicia (Edad ≥ ${FRANCHISE_MIN_AGE} y OVR ${FRANCHISE_MIN_OVR}-${FRANCHISE_MAX_OVR}).`);
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

    const lockRef = getPublicLockDocRef(player.Id);
    const cartRef = getPrivateCartDocRef(userId, player.Id);

    let attempts = 0;
    const maxAttempts = 3;
    let lastError;
    showStatusMessage('loading', `Fichando a ${player.Name}...`);

    while (attempts < maxAttempts) {
      try {
        await runTransaction(db, async (transaction) => {
          const lockSnap = await transaction.get(lockRef);
          if (lockSnap.exists()) {
            const lockData = lockSnap.data();
            if (lockData.lockedBy !== userId) {
              throw new Error(`Jugador bloqueado por ${lockData.teamName}.`);
            }
          }

          const profileRef = isFranchise ? getPrivateProfileRef(userId) : null;
          if (isFranchise) {
            const profileSnap = await transaction.get(profileRef);
            if (profileSnap.exists() && profileSnap.data().franchisePlayerUsed) {
              throw new Error('Ya has utilizado tu ficha de Jugador Franquicia esta temporada.');
            }
          }

          transaction.set(lockRef, {
            lockedBy: userId,
            teamName: userProfile.teamName,
            lockedAt: new Date().toISOString(),
            isFranchise: isFranchise || false
          });

          transaction.set(cartRef, { ...player, isFranchise: isFranchise || false });

          if (isFranchise) {
            transaction.update(profileRef, {
              franchisePlayerUsed: true,
              franchisePlayerId: player.Id
            });
          }

          // Registrar en Feed de Fichajes
          const transferRef = doc(collection(db, `artifacts/${APP_ID}/public/data/transfers`));
          transaction.set(transferRef, {
            playerId: player.Id,
            playerName: player.Name,
            teamId: userId,
            teamName: userProfile.teamName,
            price: isFranchise ? 0 : player.Precio,
            isFranchise: isFranchise || false,
            timestamp: serverTimestamp()
          });
        });

        showStatusMessage('success', `¡${player.Name} fichado exitosamente!`);
        return true;

      } catch (e) {
        lastError = e;
        if (e.code === 'permission-denied') {
          console.warn(`Permiso denegado al intentar fichar. Reintentando (${attempts + 1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          attempts++;
        } else {
          break; // Break if it's not a permission error
        }
      }
    }

    console.error("Error en la transacción de compra: ", lastError);
    const errorMessage = lastError.code === 'permission-denied'
      ? 'Error de permisos con el servidor al fichar. Reintenta en unos instantes.'
      : (lastError.message || 'No se pudo añadir al jugador.');
    showStatusMessage('error', errorMessage);
    return false;
  }, [userId, userProfile, remainingBudget, playerLocks, getPublicLockDocRef, getPrivateCartDocRef, db, showStatusMessage]);

  const handleRemoveFromCart = useCallback(async (player) => {
    if (!userId || !player) return;

    const confirmed = window.confirm(`¿Estás seguro de que deseas liberar a ${player.Name || 'este jugador'} de tu equipo? Su bloqueo quedará disponible para otros managers.`);
    if (!confirmed) return;

    const lockRef = getPublicLockDocRef(player.Id);
    const cartRef = getPrivateCartDocRef(userId, player.Id);

    try {
      showStatusMessage('loading', `Liberando a ${player.Name}...`);
      const batch = writeBatch(db);
      batch.delete(lockRef);
      batch.delete(cartRef);
      await batch.commit();

      // Also remove from transfer feed so it disappears for everyone
      try {
        const transfersRef = collection(db, `artifacts/${APP_ID}/public/data/transfers`);
        const q = query(transfersRef, where('playerId', '==', player.Id), where('teamId', '==', userId));
        const snap = await getDocs(q);
        const deleteBatch = writeBatch(db);
        snap.docs.forEach(d => deleteBatch.delete(d.ref));
        if (!snap.empty) await deleteBatch.commit();
      } catch (feedErr) {
        // Non-critical — feed cleanup failure shouldn't block release
        console.warn('Transfer feed cleanup failed:', feedErr);
      }

      showStatusMessage('success', `${player.Name} eliminado de tu equipo.`);
    } catch (e) {
      console.error("Error al eliminar del carrito: ", e);
      showStatusMessage('error', 'No se pudo eliminar al jugador.');
    }
  }, [userId, getPublicLockDocRef, getPrivateCartDocRef, showStatusMessage]);

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
        return <div className="min-h-screen bg-transparent flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando...</div>;
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
      return <div className="min-h-screen bg-black flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando SCL Data...</div>;

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

  if (location.pathname.startsWith('/torneo')) {
    if (isObsMode) {
      if (!tournamentData)
        return <div className="min-h-screen bg-transparent flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando Torneo...</div>;

      return (
        <div className="min-h-screen bg-canvas text-slate-200">
          <Suspense fallback={<LoadingScreen message="Cargando torneo..." />}>
            <TournamentModal
              isVisible={true}
              onClose={() => { navigate('/marketplace'); }}
              tournamentData={tournamentData}
              isAdmin={false}
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

    if (!isAuthReady) {
      return <LoadingScreen message="Cargando torneo..." />;
    }

    if (!tournamentData)
      return <div className="min-h-screen bg-canvas flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando Torneo...</div>;

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
        return <div className="min-h-screen bg-transparent flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando torneo...</div>;
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
            />
          </Suspense>
          <style>{`
            body, html { background: transparent !important; }
            .lucide-x, .border-b button { display: none !important; }
            .flex.border-b.border-slate-700 { display: none !important; }
          `}</style>
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

  if (isPublicAuthRoute) {
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

  if (!user) {
    return <LoadingScreen message="Volviendo al inicio..." />;
  }

  if (isLoading || marketStatus.status === 'loading') {
    return <LoadingScreen message="Conectando al servidor..." />;
  }

  if (needsGoogleLinking) {
    return <LinkGoogleScreen auth={auth} db={db} user={user} onLinked={() => setNeedsGoogleLinking(false)} />;
  }

  if (!userProfile) {
    return <LoadingScreen message="Cargando perfil de usuario..." />;
  }

  const isMarketOpen = () => {
    if (isAdmin) return true;

    const team = allTeams[userId];
    if (team?.inWhitelist) return true;

    if (marketStatus.status === 'open' || marketStatus.status === 'FranchiseMarket') return true;
    if (marketStatus.status === 'scheduled' && marketStatus.openTime) {
      return new Date() > new Date(marketStatus.openTime);
    }
    return false;
  };

  if (!isMarketOpen()) {
    return (
      <>
        <MaintenanceScreen
          marketStatus={marketStatus}
          onLogout={handleLogout}
          onSuggestionsClick={() => openModalRoute('suggestions')}
        />
        <Suspense fallback={null}>
        <SuggestionsModal
          isVisible={isSuggestionsModalVisible}
          onClose={() => setIsSuggestionsModalVisible(false)}
          teamName={userProfile?.teamName || "Usuario Anónimo"}
          userId={userId}
          getSuggestionsCollectionRef={getSuggestionsCollectionRef}
          showStatusMessage={showStatusMessage}
        />
        </Suspense>
      </>
    );
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
            <main data-app-tour="main" className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7 flex flex-col bg-canvas" id="main-content" tabIndex={-1}>
              {/* VISTA RESUMEN / INICIO (SOFASCORE STYLE) */}
              {activeTab === 'Overview' && (
                <div className="animate-in fade-in duration-200">
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

              {/* Render content based on active tab, for now Marketplace is the main functional view */}
              <div data-app-tour="marketplace" className={`${activeTab === 'Marketplace' ? (isMobileViewport ? 'flex flex-col' : 'flex-1 min-h-0 flex flex-col') : 'hidden'} animate-in fade-in duration-200`}>

                {/* Header superior */}
                <div className="shrink-0">
                <PageHeader eyebrow="Mercado" title="Mercado de pases" className="mb-5"
                  description="Buscá, compará y fichá jugadores. Los que tienen candado ya están en el carrito de otro club." />
                <SearchBar
                  filters={filters}
                  setFilters={setFilters}
                  resetFilters={resetFilters}
                  setIsFiltrosModalVisible={(value) => value ? openModalRoute('filters') : closeModalRoute(setIsFiltrosModalVisible)}
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  gridColumns={gridColumns}
                  setGridColumns={setGridColumns}
                  resultCount={isMobileViewport ? visiblePlayers.length : filteredPlayers.length}
                  totalCount={filteredPlayers.length}
                />

                {(playersLoadError || countriesLoadError) && (
                  <div className="mb-4 space-y-2">
                    {playersLoadError && (
                      <Alert tone="danger" title="No se pudo cargar la base de jugadores"
                        action={<button type="button" onClick={retryPlayerCatalog} className="btn btn-danger btn-sm">Reintentar</button>}>
                        {playersLoadError}
                      </Alert>
                    )}
                    {countriesLoadError && <Alert tone="warning">{countriesLoadError}</Alert>}
                  </div>
                )}

                {/* ── BUDGET WARNING BANNER ── */}
                {budgetPercent <= 20 && budgetPercent > 0 && (
                  <Alert tone={budgetPercent <= 10 ? 'danger' : 'warning'} className="mb-4">
                    Te queda menos del <span className="num">{budgetPercent <= 10 ? 10 : 20}%</span> del presupuesto: el saldo exacto está arriba, junto al escudo.
                  </Alert>
                )}

                {smartRecommendations.length > 0 && (
                  <RecommendationsAccordion
                    recommendations={smartRecommendations}
                    remainingBudget={remainingBudget}
                    onSelectPlayer={handleOpenPlayerModal}
                  />
                )}
                {remainingBudget > 0 && remainingBudget < 1000000 && allPlayers.length > 0 && smartRecommendations.length === 0 && (
                  <Alert tone="info" title="Tu presupuesto no alcanza para más fichajes" className="mb-5">
                    Liberá jugadores o negociá ventas desde «Plantel y finanzas» para ampliar el saldo.
                  </Alert>
                )}
                </div>
                {/* Fin del header */}

                <div className={isMobileViewport ? "mt-1 flex flex-col" : "flex-1 min-h-0 mt-1 flex flex-col"} data-app-tour="players" id="player-list">
                  {!hasLoadedPlayerDatabase && allPlayers.length === 0 ? (
                    <div className="space-y-4 my-4" role="status" aria-label="Cargando jugadores">
                      <p className="text-xs text-ink-3">Cargando la base de datos de PES 2021…</p>
                      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" aria-hidden="true">
                        {[...Array(12)].map((_, i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}
                      </div>
                    </div>
                  ) : filteredPlayers.length === 0 ? (
                    <EmptyState icon={Search} title="No se encontraron jugadores" className="my-6"
                      description="Ningún jugador coincide con los filtros o la búsqueda actual.">
                      <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                        <button type="button" onClick={() => { resetFilters(); setFilters(initialFilters); }} className="btn btn-primary">
                          Restablecer filtros
                        </button>
                        <button type="button" onClick={() => openModalRoute('filters')} className="btn btn-secondary">
                          Ajustar filtros
                        </button>
                      </div>
                    </EmptyState>
                  ) : isMobileViewport ? (
                    <div className={viewMode === 'list'
                      ? 'space-y-2.5'
                      : `grid gap-3 sm:gap-4 ${
                          gridColumns === 2
                            ? 'grid-cols-2'
                            : gridColumns === 3
                              ? 'grid-cols-3'
                              : gridColumns === 4
                                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6'
                        }`
                    }>
                      {visiblePlayers.map(player => {
                        const isLocked = Boolean(playerLocks[player.Id] && playerLocks[player.Id]?.lockedBy !== userId);
                        const isInMyCart = Boolean(playerLocks[player.Id]?.lockedBy === userId);
                        const lockedTeam = isLocked && allTeams ? allTeams[playerLocks[player.Id]?.lockedBy] : null;

                        return viewMode === 'list' ? (
                          <div key={player.Id} className="player-list-item-shell">
                            <PlayerListItem
                              player={player}
                              countryMap={countryMap}
                              onSelectPlayer={handleOpenPlayerModal}
                              isInMyCart={isInMyCart}
                              isLockedByOther={isLocked}
                              lockedTeamName={isLocked ? playerLocks[player.Id]?.teamName : null}
                              lockedTeamLogo={lockedTeam ? lockedTeam.logoUrl : null}
                              isWishlisted={wishlistSet.has(player.Id)}
                              onToggleWishlist={toggleWishlist}
                              onCompare={handleToggleCompare}
                              isComparing={comparingIdsSet.has(player.Id)}
                            />
                          </div>
                        ) : (
                          <div key={player.Id} className="market-player-card-shell">
                            <PlayerCard
                              player={player}
                              countryMap={countryMap}
                              onSelectPlayer={handleOpenPlayerModal}
                              isInMyCart={isInMyCart}
                              isLockedByOther={isLocked}
                              lockedTeamName={isLocked ? playerLocks[player.Id]?.teamName : null}
                              lockedTeamLogo={lockedTeam ? lockedTeam.logoUrl : null}
                              isWishlisted={wishlistSet.has(player.Id)}
                              onToggleWishlist={toggleWishlist}
                              onCompare={handleToggleCompare}
                              isComparing={comparingIdsSet.has(player.Id)}
                            />
                          </div>
                        );
                      })}
                      {visiblePlayers.length < filteredPlayers.length && (
                        <div className="col-span-full py-4 flex flex-col items-center justify-center gap-2">
                          <div ref={mobileSentinelRef} className="h-6 w-full pointer-events-none" />
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            className="btn btn-secondary"
                          >
                            Cargar más jugadores <span className="num text-ink-3">({visiblePlayers.length} de {filteredPlayers.length})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0">
                      {viewMode === 'list' ? (
                        <VirtualizedPlayerList
                          players={filteredPlayers}
                          playerLocks={playerLocks}
                          userId={userId}
                          allTeams={allTeams}
                          countryMap={countryMap}
                          wishlistSet={wishlistSet}
                          comparingIdsSet={comparingIdsSet}
                          onSelectPlayer={handleOpenPlayerModal}
                          onToggleWishlist={toggleWishlist}
                          onCompare={handleToggleCompare}
                          overscanCount={6}
                          onPlayerMouseEnter={!isMobileViewport ? hoverPreview.show : undefined}
                          onPlayerMouseLeave={!isMobileViewport ? hoverPreview.hide : undefined}
                        />
                      ) : (
                        <VirtualizedPlayerGrid
                          players={filteredPlayers}
                          columnCount={gridColumnCount}
                          playerLocks={playerLocks}
                          userId={userId}
                          allTeams={allTeams}
                          countryMap={countryMap}
                          wishlistSet={wishlistSet}
                          comparingIdsSet={comparingIdsSet}
                          onSelectPlayer={handleOpenPlayerModal}
                          onToggleWishlist={toggleWishlist}
                          onCompare={handleToggleCompare}
                          overscanCount={2}
                          cardMaxHeight={gridCardMaxHeight}
                          onPlayerMouseEnter={!isMobileViewport ? hoverPreview.show : undefined}
                          onPlayerMouseLeave={!isMobileViewport ? hoverPreview.hide : undefined}
                        />
                      )}
                    </div>
                  )}
                </div>
                {!isMobileViewport && (
                  <PlayerPreview
                    player={hoverPreview.player}
                    isVisible={hoverPreview.isVisible}
                    position={hoverPreview.position}
                    onOpenProfile={handleOpenPlayerModal}
                  />
                )}
              </div> {/* End Marketplace Container*/}


              {/* VISTAS MODULARES EN LUGAR DE PLACEHOLDERS */}
              <Suspense fallback={null}>
                {activeTab === 'My Team' && (
                  <div className="animate-in fade-in duration-200 h-full w-full">
                    <CartModal
                      isVisible={true}
                      onClose={() => setActiveTab('Overview')}
                      cart={ownedCart}
                      initialTab={clubTab}
                      onRemoveFromCart={handleRemoveFromCart}
                      userProfile={userProfile}
                      userId={userId}
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
                  <div className="animate-in fade-in duration-200 h-full w-full">
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
                  <div className="animate-in fade-in duration-200 h-full w-full">
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
                  <div className="animate-in fade-in duration-200 h-full w-full">
                    <TeamsModal
                      isVisible={true}
                      onClose={() => setActiveTab('Marketplace')}
                      allTeams={allTeams}
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
                  <div className="animate-in fade-in duration-200 h-full w-full overflow-y-auto">
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
                  <div className="animate-in fade-in duration-200 h-full w-full">
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
        <div className="fixed bottom-3 left-3 right-3 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 animate-in slide-in-from-bottom" role="region" aria-label="Comparador de jugadores">
          <div className="panel flex items-center justify-between gap-3 sm:gap-5 p-3 sm:pl-4 sm:pr-3">
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
                  <div key={p.Id} className="relative">
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
        applyFilters={applyFilters}
        resetFilters={resetFilters}
        uniquePositions={uniquePositions}
        sortedCountries={sortedCountries}
        uniquePlayingStyles={uniquePlayingStyles}
        // PROPS NUEVAS:
        userId={userId}
        getSavedFiltersCollectionRef={getSavedFiltersCollectionRef}
        showStatusMessage={showStatusMessage}
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
          userProfile={userProfile}
          userId={userId}
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
          cart={cart}
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
        onSelectPlayer={(id) => {
          handleOpenPlayerModal(id);
          openModalRoute('player');
        }}
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

      {/* STATUS ALERT — global feedback messages */}
      {statusMessage.text && (
        <StatusAlert
          type={statusMessage.type}
          message={statusMessage.text}
          onClose={() => setStatusMessage({ type: '', text: '' })}
        />
      )}

      {/* SIGNING TOASTS — live transfer activity */}
      <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: '380px' }}>
        {signingToasts.map(toast => (
          <div
            key={toast.toastId}
            role="button"
            tabIndex={0}
            aria-label={`Ver fichaje: ${toast.teamName} fichó a ${toast.playerName}`}
            onClick={() => handleToastClick(toast)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToastClick(toast);
              }
            }}
            className="pointer-events-auto cursor-pointer panel hover:border-line/30 transition-colors rounded-xl p-3 flex items-center gap-3 group animate-in slide-in-from-right"
            style={{ borderLeft: `4px solid ${toast.posColor}` }}
          >
            <img
              src={`/fotos_jugadores/${toast.playerId}.webp`}
              alt=""
              width={40}
              height={40}
              className="w-10 h-10 rounded-lg object-cover bg-raised shrink-0"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-2 leading-snug">
                <span className="font-semibold text-ink">{toast.teamName}</span>{' '}fichó a{' '}
                <span className="font-semibold text-ink">{toast.playerName}</span>
              </p>
              <p className="text-xs text-ink-3 mt-0.5">
                <span className="num">{toast.ovr}</span> OVR · {toast.pos}
              </p>
            </div>
            <span className="text-xs font-semibold text-accent-soft shrink-0">Ver</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSigningToasts(prev => prev.filter(t => t.toastId !== toast.toastId));
              }}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-white/10 shrink-0"
              title="Cerrar aviso"
              aria-label="Cerrar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </>
  );

  // Auto-sync: Sincronizar cart privado cuando playerLocks asigna o quita jugadores (ej. traspasos aceptados)
  useEffect(() => {
    if (!userId || !playerLocks) return;

    // 1. Si un jugador está bloqueado por este usuario pero aún no está en su cart privado, añadirlo
    // (Requiere allPlayers para datos completos del jugador)
    if (allPlayers?.length) {
      Object.entries(playerLocks).forEach(([playerId, lock]) => {
        if (lock.lockedBy === userId && !cart.some(p => String(p.Id) === String(playerId))) {
          const fullPlayer = playerById.get(String(playerId));
          if (fullPlayer) {
            setDoc(getPrivateCartDocRef(userId, playerId), { ...fullPlayer, isFranchise: Boolean(lock.isFranchise) })
              .catch(err => console.error('Error auto-sync agregando a cart:', err));
          }
        }
      });
    }

    // 2. Si un jugador está en el cart privado pero playerLocks indica que pertenece a otro usuario, removerlo
    // (NO requiere allPlayers — funciona siempre que haya locks y cart)
    cart.forEach(p => {
      const lock = playerLocks[String(p.Id)];
      if (lock && lock.lockedBy && lock.lockedBy !== userId) {
        deleteDoc(getPrivateCartDocRef(userId, p.Id))
          .catch(err => console.error('Error auto-sync removiendo de cart:', err));
      }
    });

    // 3. Sincronizar presupuesto de perfil si difiere del presupuesto público (actualizado por traspasos)
    // (NO requiere allPlayers)
    const publicBudget = Number(allTeams?.[userId]?.budget);
    const privateBudget = Number(userProfile?.budget);
    if (!isNaN(publicBudget) && userProfile && publicBudget !== privateBudget) {
      setDoc(getPrivateProfileRef(userId), { budget: publicBudget }, { merge: true })
        .catch(err => console.error('Error auto-sync actualizando presupuesto de perfil:', err));
    }
  }, [playerLocks, cart, allTeams, userProfile, userId, allPlayers, playerById, getPrivateCartDocRef, getPrivateProfileRef]);

  // Keep a compact, public squad snapshot so the public team board can show
  // both the XI and the substitutes without exposing the private cart.
  // IMPORTANT: roster = union(cart, playerLocks owned by userId) to avoid
  // overwriting a roster that was just updated by a transfer transaction
  // before the private cart auto-sync had a chance to propagate.
  useEffect(() => {
    if (!userId || !userProfile) return;

    const cartIds = new Set(cart.map(p => String(p.Id)));

    // Include players locked by this user that are not yet in the local cart
    // (race window between transaction commit and cart onSnapshot delivery)
    const lockedNotInCart = playerLocks
      ? Object.entries(playerLocks)
          .filter(([pid, lock]) => lock.lockedBy === userId && !cartIds.has(String(pid)))
          .map(([pid, lock]) => {
            const p = playerById?.get(String(pid));
            return p ? {
              Id: String(p.Id),
              Name: p.Name || 'Jugador',
              POS_NOMBRE: p.POS_NOMBRE || '',
              OVR_CALCULADO: Number(p.OVR_CALCULADO) || 0,
              dorsal: userProfile.dorsals?.[pid] || '',
              available: userProfile.availability?.[pid] !== false,
            } : null;
          })
          .filter(Boolean)
      : [];

    // Only include cart players still owned by this user according to playerLocks
    // (Prevents overwriting a clean roster written by a transfer transaction)
    const ownedCartPlayers = cart.filter(player => {
      const lock = playerLocks?.[String(player.Id)];
      // Keep if: no lock info, no lockedBy, or lockedBy is this user
      return !lock || !lock.lockedBy || lock.lockedBy === userId;
    });

    const roster = [
      ...ownedCartPlayers.map(player => ({
        Id: String(player.Id),
        Name: player.Name || 'Jugador',
        POS_NOMBRE: player.POS_NOMBRE || '',
        OVR_CALCULADO: Number(player.OVR_CALCULADO) || 0,
        dorsal: userProfile.dorsals?.[player.Id] || '',
        available: userProfile.availability?.[player.Id] !== false,
      })),
      ...lockedNotInCart,
    ];

    setDoc(getPublicTeamRef(userId), { roster, rosterUpdatedAt: new Date().toISOString() }, { merge: true })
      .catch(error => console.error('Error sincronizando plantilla pública:', error));
  }, [cart, playerLocks, playerById, getPublicTeamRef, userId, userProfile]);
}

export default firebaseInitializationError ? FirebaseError : App; 
