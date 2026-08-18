import React, { useState, useEffect, useMemo, useCallback, memo, useRef, Suspense } from 'react';
import { DETAILED_STAT_KEYS, PLAYER_SKILLS_MAP, DEFAULT_BUDGET, DEFAULT_LOGO, ADMIN_USER_ID, APP_ID } from './utils/constants.js';
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

import {
  X,
  Trash2,
  AlertTriangle,
  ArrowLeftRight,
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


// 2. Hook para manejar datos de Firebase limpiamente (Optimización 5)
function useFirebaseData(userId, isAuthReady, getPrivateCartCollectionRef, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, getPrivateProfileRef, setError, setIsLoading) {
  const [cart, setCart] = useState([]);
  const [playerLocks, setPlayerLocks] = useState({});
  const [allTeams, setAllTeams] = useState({});
  const [userProfile, setUserProfile] = useState(null);

  const handleError = useCallback((context, err) => {
    console.error(`Snapshot error in ${context}:`, err.code, err.message);
    if (err.code === "permission-denied") {
      setIsLoading?.(false);
      setError?.("Sin permisos para cargar los datos: " + context);
    }
  }, [setError, setIsLoading]);

  // NOTE: Transfer proposals listener moved to App component where addNotification is available

  // 4. Carga inicial: Usuarios, Equipos (Públicos), Plantillas, Torneo
  useEffect(() => {
    if (!isAuthReady || !userId) {
      setCart([]);
      setUserProfile(null);
      return;
    }

    const unsubCart = onSnapshot(getPrivateCartCollectionRef(userId),
      (snap) => setCart(snap.docs.map(d => d.data())),
      (err) => handleError("Private Cart", err)
    );

    const unsubProfile = onSnapshot(getPrivateProfileRef(userId),
      (doc) => { if (doc.exists()) setUserProfile(doc.data()); },
      (err) => handleError("Private Profile", err)
    );
    return () => { unsubCart(); unsubProfile(); };
  }, [userId, isAuthReady, getPrivateCartCollectionRef, getPrivateProfileRef, handleError]);

  // Cargar datos públicos (Bloqueos y Equipos)
  useEffect(() => {
    if (!isAuthReady) return;

    const unsubLocks = onSnapshot(getPublicLocksCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setPlayerLocks(data);
      },
      (err) => handleError("Public Locks", err)
    );

    const unsubTeams = onSnapshot(getPublicTeamsCollectionRef(),
      (snap) => {
        const data = {};
        snap.docs.forEach(d => data[d.id] = d.data());
        setAllTeams(data);
      },
      (err) => handleError("Public Teams", err)
    );
    return () => { unsubLocks(); unsubTeams(); };
  }, [isAuthReady, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, handleError]);

  return { cart, playerLocks, allTeams, userProfile };
}

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
    <div className="flex flex-col justify-center items-center min-h-screen p-10 font-sans text-lg bg-gray-900 text-white">
      <h1 className="text-4xl font-bold text-red-500 mb-4">Error de Configuración</h1>
      <p className="text-gray-300 mb-6 text-center">No se pudo conectar a Firebase. Por favor, revisa que tus credenciales sean válidas.</p>
      <pre className="bg-gray-800 p-4 rounded-lg border border-red-700 text-red-300 overflow-x-auto text-sm max-w-full">
        <strong>Mensaje del error:</strong> {firebaseInitializationError?.message || "Error desconocido."}
      </pre>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 text-gray-200 font-sans text-xl text-center p-5">
      <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-5"></div>
      {message || "Cargando..."}
    </div>
  );
}

const InfoPill = memo(function InfoPill({ label, value, colorClass = '', icon }) {
  return (
    <span
      className={`
                bg-gray-700 text-white border border-gray-600 rounded-full px-3 py-1 text-sm font-medium 
                flex items-center space-x-1 whitespace-nowrap shadow-sm
                ${colorClass}
            `}
    >
      {icon}
      {label && <span className="text-gray-400">{label}:</span>}
      <span className="font-semibold">{value}</span>
    </span>
  );
});

const MiniPlayerCard = memo(function MiniPlayerCard({ player, countryMap, onRemove, onCardClick }) {
  const ovrColorClass = getStatAndOvrColorClass(player.OVR_CALCULADO);
  const posClass = getPosColorClass(player.POS_NOMBRE);
  const countryFlagUrl = getFlagUrl(player.Country1);

  return (
    <div className="flex items-center p-2 bg-gray-800 rounded-lg space-x-2 border border-gray-700">
      <button
        onClick={onCardClick}
        disabled={!onCardClick}
        className="flex items-center space-x-2 flex-grow min-w-0 text-left transition disabled:cursor-default rounded-lg hover:enabled:bg-gray-700 p-1 -m-1"
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
            <span className="text-sm font-semibold text-white truncate">{player.Name}</span>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <span className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full font-bold text-xs ${ovrColorClass}`}>
              {player.OVR_CALCULADO}
            </span>
            <span className={`text-xs font-bold text-gray-900 px-2 py-0.5 rounded-full ${posClass}`}>
              {player.POS_NOMBRE}
            </span>
          </div>
        </div>
        <span className="text-xs sm:text-sm font-bold text-green-400 w-16 text-right flex-shrink-0 pr-2">
          {formatPriceShort(player.Precio)}
        </span>
      </button>
      {onRemove && (
        <button onClick={onRemove} className="text-red-400 hover:text-red-500 transition p-1 rounded-full hover:bg-red-900/30 flex-shrink-0">
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
});

function App() {
  const navigate = useNavigate();
  const location = useLocation();  // Derive "activeTab" from current URL path for backward compat with all existing code
  const pathToTab = {
    '/marketplace': 'Marketplace',
    '/my-team': 'My Team',
    '/scouting': 'Scouting',
    '/other-teams': 'Other Teams',
    '/financials': 'Financials',
    '/torneo': 'Torneo',
    '/admin': 'Admin',
    '/tactics': 'My Team',
  };
  const modalRoute = location.pathname.startsWith('/modal/') ? location.pathname.replace('/modal/', '') : '';
  const modalBackgroundTab = modalRoute === 'compare' || modalRoute === 'tutorial' || modalRoute === 'filters'
    ? 'Marketplace'
    : 'My Team';
  const activeTab = pathToTab[location.pathname] ?? modalBackgroundTab;

  // setActiveTab is a drop-in replacement that navigates to route
  const tabToPath = {
    'Marketplace': '/marketplace',
    'My Team': '/my-team',
    'Scouting': '/scouting',
    'Other Teams': '/other-teams',
    'Financials': '/financials',
    'Torneo': '/torneo',
    'Admin': '/admin',
  };
  const setActiveTab = (tab) => navigate(tabToPath[tab] ?? '/marketplace');

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
    const from = location.pathname.startsWith('/modal/') ? '/marketplace' : location.pathname;
    navigate(`/modal/${modalName}`, { state: { from } });
  }, [location.pathname, navigate]);

  const closeModalRoute = useCallback((setter) => {
    setter?.(false);
    if (location.pathname.startsWith('/modal/')) {
      navigate(location.state?.from || '/my-team', { replace: true });
    }
  }, [location.pathname, location.state, navigate]);

  const [allPlayers, setAllPlayers] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [hasLoadedPlayerDatabase, setHasLoadedPlayerDatabase] = useState(false);
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
  const [signingToasts, setSigningToasts] = useState([]);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [isFiltrosModalVisible, setIsFiltrosModalVisible] = useState(false);
  const [isCartVisible, setIsCartVisible] = useState(false);
  const [isTeamsModalVisible, setIsTeamsModalVisible] = useState(false);
  const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
  const [isSuggestionsModalVisible, setIsSuggestionsModalVisible] = useState(false);
  const [isFormationModalVisible, setIsFormationModalVisible] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
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
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [shouldPrefetchTransfers, setShouldPrefetchTransfers] = useState(false);
  const [areNotificationsWarmed, setAreNotificationsWarmed] = useState(false);
  const [activityFeed, setActivityFeed] = useState([]);
  const [incomingOffers, setIncomingOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [offerHistory, setOfferHistory] = useState([]);
  const prevLocksRef = useRef(null);
  const chatInitializedRef = useRef(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isTransferFeedVisible, setIsTransferFeedVisible] = useState(false);
  const [needsGoogleLinking, setNeedsGoogleLinking] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appError, setAppError] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ status: 'loading', openTime: null });

  // Router-level redirects: keep public routes clean and return logged-out users to landing.
  useEffect(() => {
    if (!isAuthReady) return;

    const isPublicAuthRoute = location.pathname === '/' || location.pathname === '/login';
    const isPublicStandaloneRoute =
      isPublicAuthRoute ||
      isSpecialMode ||
      location.pathname.startsWith('/overlay') ||
      location.pathname.startsWith('/team/') ||
      location.pathname.startsWith('/tactics/view/') ||
      location.pathname.startsWith('/torneo');

    if (user && isPublicAuthRoute) {
      navigate('/marketplace', { replace: true });
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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedName(filters.name);
    }, 250);
    return () => clearTimeout(timeoutId);
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
        showStatusMessage('success', 'Listo para comparar. Pulsa el botón "Comparar" abajo.');
        // setIsComparisonModalVisible(true); <--- LÍNEA ELIMINADA
      }

      return newList;
    });
  }, []);

  const handleRemoveCompareItem = useCallback((playerId) => {
    setCompareList(prev => prev.filter(p => p.Id !== playerId));
  }, []);


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
  const { cart, playerLocks, allTeams, userProfile } = useFirebaseData(
    userId, isAuthReady, getPrivateCartCollectionRef, getPublicLocksCollectionRef, getPublicTeamsCollectionRef, getPrivateProfileRef, setAppError, setIsLoading);
  const shouldLoadPlayerDatabase = useMemo(() => {
    if (isSpecialMode || location.pathname.startsWith('/overlay') || location.pathname.startsWith('/team/') || location.pathname.startsWith('/tactics/view/')) {
      return false;
    }
    if (location.pathname === '/' || location.pathname === '/login') return false;
    const tabsThatNeedPlayers = new Set(['Marketplace', 'Scouting', 'Other Teams', 'Financials']);
    const modalsThatNeedPlayers = new Set(['filters', 'cart', 'teams', 'compare']);
    return tabsThatNeedPlayers.has(activeTab) || modalsThatNeedPlayers.has(modalRoute) || Boolean(selectedPlayerId) || compareList.length > 0;
  }, [activeTab, compareList.length, isSpecialMode, location.pathname, modalRoute, selectedPlayerId]);

  const addNotification = useCallback((notification) => {
    const id = notification.id || `${notification.category || notification.type || 'notif'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => {
      if (prev.some(n => n.id === id)) return prev;
      return [{ ...notification, id, read: notification.read === true, createdAt: notification.createdAt || new Date().toISOString() }, ...prev].slice(0, 40);
    });
  }, []);

  // 3. CARGA DE DATOS OPTIMIZADA (CORREGIDO)
  useEffect(() => {
    if (!shouldLoadPlayerDatabase || hasLoadedPlayerDatabase) return;
    let isCancelled = false;

    fetch('/jugadores.json')
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
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
      .then((res) => res.json())
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
  }, [hasLoadedPlayerDatabase, shouldLoadPlayerDatabase]);

  useEffect(() => {
    if (firebaseInitializationError) {
      setIsLoading(false);
      return;
    }

    const statusRef = getMarketStatusDocRef();

    const unsubscribeMarket = onSnapshot(statusRef,
      (doc) => {
        if (doc.exists()) {
          setMarketStatus(doc.data());
        } else {
          setMarketStatus({ status: 'closed', openTime: null });
        }
      },
      (error) => {
        console.error("Snapshot error in Market Status:", error.code);
        if (error.code === "permission-denied") {
          setIsLoading(false);
          setAppError("Sin permisos para cargar Market Status");
        }
      }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Block all processing during active migration
      if (sessionStorage.getItem('isMigrating') === 'true') {
        return;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        const uid = firebaseUser.uid;
        setUserId(uid);

        setIsAdmin(uid === ADMIN_USER_ID);

        const profileRef = getPrivateProfileRef(uid);
        const publicTeamRef = getPublicTeamRef(uid);
        const profileSnap = await getDoc(profileRef);

        let profileData;

        // Verificar si el inicio de sesión actual fue con Google o Password
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const isGoogleSignIn = idTokenResult.signInProvider === 'google.com';

        if (!profileSnap.exists()) {
          if (isGoogleSignIn) {
            // Rechazamos inicio de sesión con Google si no hay perfil (cuenta no asociada/migrada)
            await signOut(auth);
            setAuthError("Esta cuenta de Google no tiene un equipo asociado. Si tenés una cuenta antigua, hacé click en 'Migrar cuenta antigua' para vincularla.");
            setIsAuthReady(true);
            setIsLoading(false);
            return;
          }

          profileData = {
            teamName: `Equipo ${uid.substring(0, 5)}`,
            budget: DEFAULT_BUDGET,
            userId: uid,
            logoUrl: DEFAULT_LOGO,
            formation: '4-3-3',
            lineup: {},
            wishlist: [],
            providers: [idTokenResult.signInProvider]
          };

          const batch = writeBatch(db);
          batch.set(profileRef, profileData);
          batch.set(publicTeamRef, {
            teamName: profileData.teamName,
            userId: uid,
            logoUrl: profileData.logoUrl,
            budget: profileData.budget,
            inWhitelist: false
          });
          await batch.commit();

        } else {
          profileData = profileSnap.data();

          if (!isGoogleSignIn) {
            // Logueado con email/password u otro
            if (profileData.providers?.includes('google.com')) {
              // ESTE USUARIO YA MIGRÓ! 
              await signOut(auth);
              setAuthError("Esta cuenta ya ha sido migrada. Por favor, ingresa directamente con el botón 'Ingresar con Google'.");
              setIsAuthReady(true);
              setIsLoading(false);
              return;
            } else {
              setNeedsGoogleLinking(true);
              setAuthError(null);
            }
          } else {
            // Logueado con Google
            if (!profileData.providers?.includes('google.com')) {
              // El usuario tiene perfil pero nunca hizo el flujo de migración.
              // Rechazamos el acceso para forzar la migración guiada.
              await signOut(auth);
              setAuthError("Para ingresar con Google, primero debés migrar tu cuenta. Hacé clic en 'Migrar cuenta antigua'.");
              setIsAuthReady(true);
              setIsLoading(false);
              return;
            }
            setNeedsGoogleLinking(false);
            setAuthError(null);
          }

          const publicTeamSnap = await getDoc(publicTeamRef);
          if (!publicTeamSnap.exists() || publicTeamSnap.data().budget !== profileData.budget) {
            await setDoc(publicTeamRef, {
              teamName: profileData.teamName,
              userId: uid,
              logoUrl: profileData.logoUrl || DEFAULT_LOGO,
              budget: profileData.budget,
              inWhitelist: publicTeamSnap.exists() ? publicTeamSnap.data().inWhitelist : false
            }, { merge: true });
          }
        }

        setIsAuthReady(true);
        setIsLoading(false);

      } else {
        setUser(null);
        setUserId(null);
        setIsAdmin(false);
        setIsAuthReady(true);
        setIsLoading(false);
        // NO reseteamos authError aquí porque queremos que se vea al volver al LoginScreen
      }
    });

    const initialSignIn = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          if (!auth.currentUser) {
          }
        }
      } catch (error) {
        console.warn("Error al intentar auto-login con token.", error);
      }
    };
    if (!auth.currentUser) {
      initialSignIn();
    }

    return () => {
      unsubscribeAuth();
      unsubscribeMarket();
    };
  }, [firebaseInitializationError, getMarketStatusDocRef, getPrivateProfileRef, getPublicTeamRef]);
  useEffect(() => {
    if (isAdmin) {
      window.runManualMigration = async () => {
        const currentUid = "ZTX1NMKAWHcass2BVzzaADc5NPu1";
        const googleUid = "JeB3Bo9CuXNj8kCvz84zKW6eq752";
        console.log("Iniciando migración manual de", currentUid, "a", googleUid);
        try {
          const oldProfileRef = doc(db, `artifacts/${APP_ID}/users/${currentUid}/profile`, "data");
          const newProfileRef = doc(db, `artifacts/${APP_ID}/users/${googleUid}/profile`, "data");
          const oldProfileSnap = await getDoc(oldProfileRef);
          if (oldProfileSnap.exists()) {
            await setDoc(newProfileRef, {
              ...oldProfileSnap.data(),
              providers: ["google.com"],
              migratedFrom: currentUid,
              migratedAt: new Date().toISOString()
            }, { merge: true });
          }

          const cartSnap = await getDocs(collection(db, `artifacts/${APP_ID}/users/${currentUid}/cart`));
          const batch = writeBatch(db);
          cartSnap.docs.forEach(cartDoc => {
            batch.set(
              doc(db, `artifacts/${APP_ID}/users/${googleUid}/cart/${cartDoc.id}`),
              cartDoc.data()
            );
            batch.delete(cartDoc.ref);
          });
          await batch.commit();

          const locksSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/player_locks`));
          const lockBatch = writeBatch(db);
          locksSnap.docs.forEach(lockDoc => {
            if (lockDoc.data().lockedBy === currentUid) {
              lockBatch.update(lockDoc.ref, { lockedBy: googleUid });
            }
          });
          await lockBatch.commit();

          const oldTeamRef = doc(db, `artifacts/${APP_ID}/public/data/teams/${currentUid}`);
          const newTeamRef = doc(db, `artifacts/${APP_ID}/public/data/teams/${googleUid}`);
          const oldTeamSnap = await getDoc(oldTeamRef);
          if (oldTeamSnap.exists()) {
            await setDoc(newTeamRef, {
              ...oldTeamSnap.data(),
              userId: googleUid
            });
            await deleteDoc(oldTeamRef);
          }

          const offersSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/offers`));
          const offerBatch = writeBatch(db);
          let hasOfferChanges = false;
          offersSnap.docs.forEach(offerDoc => {
            const data = offerDoc.data();
            let updateData = {};
            if (data.senderId === currentUid) updateData.senderId = googleUid;
            if (data.targetTeamId === currentUid) updateData.targetTeamId = googleUid;
            if (Object.keys(updateData).length > 0) {
              offerBatch.update(offerDoc.ref, updateData);
              hasOfferChanges = true;
            }
          });
          if (hasOfferChanges) await offerBatch.commit();

          const transfersSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/transfers`));
          const transferBatch = writeBatch(db);
          let hasTransferChanges = false;
          transfersSnap.docs.forEach(transferDoc => {
            const data = transferDoc.data();
            let updateData = {};
            if (data.teamId === currentUid) updateData.teamId = googleUid;
            if (data.fromTeamId === currentUid) updateData.fromTeamId = googleUid;
            if (Object.keys(updateData).length > 0) {
              transferBatch.update(transferDoc.ref, updateData);
              hasTransferChanges = true;
            }
          });
          if (hasTransferChanges) await transferBatch.commit();

          await deleteDoc(oldProfileRef);
          console.log("MIGRACIÓN MANUAL COMPLETADA!");
          alert("MIGRACIÓN COMPLETADA: LOURINHA FC");
        } catch (e) {
          console.error("Error en migración manual:", e);
          alert("Error: " + e.message);
        }
      };
      console.log("Admin: window.runManualMigration() is ready");
    }
  }, [isAdmin, db]);

  useEffect(() => {

    const unsubTournament = onSnapshot(getTournamentDocRef(),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setTournamentData(docSnapshot.data());
        }
      },
      (error) => {
        console.error("Snapshot error in Tournament Data:", error.code);
        if (error.code === "permission-denied") {
          setIsLoading(false);
          setAppError("Sin permisos para cargar Tournament Data");
        }
      }
    );
    return () => unsubTournament();
  }, [getTournamentDocRef]);

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
        console.error("Snapshot error in Broadcast Overlay:", error.code);
      }
    );
    return () => unsubscribeBroadcast();
  }, [getBroadcastOverlayDocRef]);

  const showStatusMessage = useCallback((type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage({ type: '', text: '' }), 3000);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut(auth);
    navigate('/', { replace: true });
  }, [navigate]);

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

    players = players.filter(p => {
      if (marketStatus.status === 'FranchiseMarket') {
        const isFranchiseEligible = p.Age >= 31 && p.OVR_CALCULADO >= 83 && p.OVR_CALCULADO <= 89;
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
        // CORRECCIÓN AQUÍ: Usar p.searchableName en vez de p.Name_lower
        (searchName === "" || (p.searchableName && p.searchableName.includes(searchName))) &&
        (f.pos === "" || p.POS_NOMBRE === f.pos) &&
        (f.country === "" || country1Name.includes(normalizedCountry) || country2Name.includes(normalizedCountry)) &&
        (gruposSeleccionados.length === 0 || gruposSeleccionados.includes(p.Grupo)) &&
        (f.playingStyle === "" || p.PlayingStyle === f.playingStyle) &&
        (f.foot === "" || p.Foot === f.foot) &&
        (selectedSkills.length === 0 || selectedSkills.every(skill => p[skill]));

      if (!matchBasic) return false;

      const matchDetailedStats = Object.values(DETAILED_STAT_KEYS).flat().every(statKey => {
        const val = p[statKey] || 0;
        return matchMin(val, f[`${statKey}Min`]) && matchMax(val, f[`${statKey}Max`]);
      });

      return matchDetailedStats;
    });

    // Ordenamiento integrado — sort a copy to avoid mutating the filtered array
    const sorted = [...players];
    sorted.sort((a, b) => {
      let valA, valB;
      switch (sortConfig.key) {
        case 'precio': valA = a.Precio; valB = b.Precio; break;
        case 'edad': valA = a.Age; valB = b.Age; break;
        case 'nombre': valA = a.searchableName; valB = b.searchableName; break;
        default: valA = a.OVR_CALCULADO; valB = b.OVR_CALCULADO; break;
      }
      if (sortConfig.direction === 'asc') return valA < valB ? -1 : 1;
      else return valA > valB ? -1 : 1;
    });

    return sorted;
  }, [allPlayers, filters, sortConfig, normalizedCountryNamesById, userProfile?.wishlist, marketStatus, debouncedName]);

  // Mantener una función "applyFilters" vacía por si algún componente hijo la pide
  const applyFilters = useCallback(() => { }, []);

  // Mensaje de contador
  useEffect(() => {
    if (filteredPlayers.length === 0) setContadorMsg("No se encontraron jugadores.");
    else setContadorMsg(`Mostrando ${filteredPlayers.length} de ${allPlayers.length} jugadores.`);
  }, [filteredPlayers.length, allPlayers.length]);

  const resetFilters = useCallback(() => {
    setFilters(prev => ({ ...initialFilters, name: prev.name }));
  }, []);

  const totalCartCost = useMemo(() => {
    return cart.reduce((total, player) => {
      const isFranchise = player.isFranchise || (userProfile?.franchisePlayerId === player.Id);
      return total + (isFranchise ? 0 : player.Precio * 1000000);
    }, 0);
  }, [cart, userProfile]);

  const remainingBudget = useMemo(() => {
    if (!userProfile) return 0;
    return userProfile.budget - totalCartCost;
  }, [userProfile, totalCartCost]);

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
  useEffect(() => {
    if (!playerLocks || !allPlayers || allPlayers.length === 0) return;
    const prev = prevLocksRef.current;
    if (prev === null) {
      // Primera carga, solo guardar referencia
      prevLocksRef.current = { ...playerLocks };
      return;
    }
    const newEvents = [];
    // Detectar NUEVOS fichajes (locks que no existían antes)
    Object.entries(playerLocks).forEach(([playerId, lockData]) => {
      if (!prev[playerId]) {
        const player = playerById.get(String(playerId));
        if (player) {
          newEvents.push({
            id: `${playerId}-${Date.now()}`,
            type: 'signing',
            playerName: player.Name,
            teamName: lockData.teamName || 'Equipo',
            ovr: player.OVR_CALCULADO,
            pos: player.POS_NOMBRE,
            price: player.Precio,
            timestamp: new Date(),
          });
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
  }, [playerLocks, allPlayers, playerById]);

  // Transfer proposals listener — listens for incoming trade offers
  useEffect(() => {
    if (!userId) return;
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

        snap.docChanges().forEach(change => {
          const data = change.doc.data();
          if (change.type === 'added') {
            if ((data.targetTeamId === userId && data.status === 'pending') || (data.senderId === userId && data.status === 'countered')) {
              setNotifications(prev => [{
                type: 'info',
                text: `🤝 TRASPASO: ${data.senderTeamName} ofrece ${formatPriceShort((data.status === 'countered' ? data.counterAmount : data.offerAmount) / 1000000)} por ${data.playerName}.${data.message ? ` Mensaje: "${data.message}"` : ''}`,
                time: 'Traspaso'
              }, ...prev]);
            }
          }
          if (change.type === 'modified') {
            // Notify sender when their offer is rejected
            if (data.status === 'rejected' && data.senderId === userId) {
              setNotifications(prev => [{
                type: 'warning',
                text: `❌ ${data.rejectedBy || 'Un equipo'} rechazó tu oferta por ${data.playerName}.`,
                time: 'Traspaso'
              }, ...prev]);
            }
            // Notify sender when their offer is accepted
            if (data.status === 'accepted' && data.targetTeamId === userId) {
              setNotifications(prev => [{
                id: `transfer-sale-${change.doc.id}`,
                type: 'transfer',
                category: 'transfer',
                text: `Venta confirmada: ${data.playerName} fue transferido por ${formatPriceShort((data.counterAmount || data.offerAmount || 0) / 1000000)}.`,
                time: 'Mercado',
                read: false,
              }, ...prev]);
            }
            if (data.status === 'accepted' && data.senderId === userId) {
              setNotifications(prev => [{
                type: 'info',
                text: `✅ ¡Traspaso aceptado! ${data.playerName} ahora es tuyo.`,
                time: 'Traspaso'
              }, ...prev]);
            }
            // Notify when counter-offer received
            if (data.status === 'countered' && data.senderId === userId) {
              setNotifications(prev => [{
                type: 'info',
                text: `🔄 ${data.counterBy || 'Un equipo'} te envió una contraoferta de ${formatPriceShort((data.counterAmount || 0) / 1000000)} por ${data.playerName}.`,
                time: 'Traspaso'
              }, ...prev]);
            }
          }
        });
      },
      (error) => {
        console.error("Snapshot error in Offers:", error.code);
      }
    );
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userProfile) return;

    const systemNotifs = [];

    // Alerta 1: Presupuesto Bajo (Menos de 10M)
    if (remainingBudget < 10000000 && remainingBudget > 0) {
      systemNotifs.push({
        id: 'system-low-budget',
        category: 'system',
        type: 'warning',
        text: '⚠️ ¡Cuidado! Tu presupuesto es bajo (<10M).',
        time: 'Finanzas'
      });
    }

    // Alerta 2: Mercado Cerrado
    if (marketStatus.status === 'closed') {
      systemNotifs.push({
        id: 'system-market-closed',
        category: 'system',
        type: 'info',
        text: '🔒 El mercado está cerrado actualmente.',
        time: 'Info'
      });
    }

    // Solo actualizamos si la cantidad cambió para evitar bucles
    setNotifications(prev => [
      ...systemNotifs,
      ...prev.filter(notif => notif.category !== 'system')
    ].slice(0, 40));
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
        console.error("Snapshot error in Manager Chat:", error.code);
      }
    );

    return () => unsub();
  }, [isAuthReady, userId, getManagerChatCollectionRef, addNotification]);

  useEffect(() => {
    if (isManagerChatVisible) setUnreadChatCount(0);
  }, [isManagerChatVisible]);

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

    const playerCost = isFranchise ? 0 : player.Precio * 1000000;

    if (!isFranchise && remainingBudget < playerCost) {
      showStatusMessage('error', 'No tienes presupuesto suficiente.');
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

          transaction.set(lockRef, {
            lockedBy: userId,
            teamName: userProfile.teamName,
            lockedAt: new Date().toISOString(),
            isFranchise: isFranchise || false
          });

          transaction.set(cartRef, { ...player, isFranchise: isFranchise || false });

          if (isFranchise) {
            const profileRef = getPrivateProfileRef(userId);
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
    if (!userId) return;

    const lockRef = getPublicLockDocRef(player.Id);
    const cartRef = getPrivateCartDocRef(userId, player.Id);

    try {
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
  }, [userId, getPublicLockDocRef, getPrivateCartDocRef]);

  const handleOpenPlayerFromCart = (player) => {
    setSelectedPlayerId(player.Id);
    setIsCartVisible(false);
  };


  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return allPlayers.find(p => p.Id === selectedPlayerId);
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

  // ── BUDGET ALERT STATE ──
  const [showBudgetAlert, setShowBudgetAlert] = useState(false);
  const budgetPercent = useMemo(() => {
    if (!userProfile?.budget) return 100;
    return (remainingBudget / userProfile.budget) * 100;
  }, [remainingBudget, userProfile?.budget]);

  // Show budget alert modal when signing pushes below 20%
  const prevBudgetPercentRef = useRef(100);
  useEffect(() => {
    if (prevBudgetPercentRef.current > 20 && budgetPercent <= 20 && budgetPercent > 0) {
      setShowBudgetAlert(true);
    }
    prevBudgetPercentRef.current = budgetPercent;
  }, [budgetPercent]);

  // ── SMART RECOMMENDATION ENGINE ──
  const recommendations = useMemo(() => {
    if (!allPlayers.length || !userProfile) return [];

    // Position groups
    const posGroups = {
      PT: ['PT'],
      DEF: ['DFC', 'LD', 'LI'],
      MED: ['MC', 'MCD', 'MO', 'MD', 'MI'],
      DEL: ['DC', 'SD', 'ED', 'EI'],
    };

    // Count players per group from cart
    const groupCounts = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
    const groupOvrTotals = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
    const positionCounts = {};

    cart.forEach(p => {
      const pos = p.POS_NOMBRE;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      for (const [group, positions] of Object.entries(posGroups)) {
        if (positions.includes(pos)) {
          groupCounts[group]++;
          groupOvrTotals[group] += (p.OVR_CALCULADO || 0);
          break;
        }
      }
    });

    // Calculate average OVR per group
    const groupAvgOvr = {};
    for (const group of Object.keys(groupCounts)) {
      groupAvgOvr[group] = groupCounts[group] > 0
        ? Math.round(groupOvrTotals[group] / groupCounts[group])
        : 0;
    }

    // Find weakest group
    const overallAvg = cart.length > 0
      ? Math.round(cart.reduce((s, p) => s + (p.OVR_CALCULADO || 0), 0) / cart.length)
      : 0;

    // Missing positions (groups with 0 or 1 player)
    const missingGroups = Object.entries(groupCounts)
      .filter(([, count]) => count <= 1)
      .map(([group]) => group);

    // Weak groups (avg OVR significantly below overall)
    const weakGroups = Object.entries(groupAvgOvr)
      .filter(([, avg]) => avg > 0 && avg < overallAvg - 5)
      .map(([group]) => group);

    // Budget cap: 35% of remaining
    const maxPrice = remainingBudget > 0 ? (remainingBudget * 0.35) / 1000000 : 0;

    if (maxPrice <= 0) return [];

    // Score each available player
    const cartIds = new Set(cart.map(p => String(p.Id)));
    const lockedIds = new Set(Object.keys(playerLocks));

    const scored = allPlayers
      .filter(p => {
        if (cartIds.has(String(p.Id))) return false; // Already in cart
        if (lockedIds.has(String(p.Id))) return false; // Locked by someone
        if (p.Precio > maxPrice) return false; // Too expensive
        if (p.Precio <= 0) return false; // Free/invalid
        return true;
      })
      .map(p => {
        let score = 0;
        let reason = '';
        const pos = p.POS_NOMBRE;

        // Find player's group
        let playerGroup = null;
        for (const [group, positions] of Object.entries(posGroups)) {
          if (positions.includes(pos)) { playerGroup = group; break; }
        }

        // +40 if fills a missing position
        if (playerGroup && missingGroups.includes(playerGroup)) {
          score += 40;
          reason = `Necesitás un ${pos}`;
        }

        // +15 if fills a weak group
        if (playerGroup && weakGroups.includes(playerGroup) && !reason) {
          score += 15;
          reason = `Refuerzo para ${playerGroup === 'DEF' ? 'defensa' : playerGroup === 'MED' ? 'mediocampo' : playerGroup === 'DEL' ? 'ataque' : 'portería'}`;
        }

        // OVR bonuses
        if (p.OVR_CALCULADO >= 85) { score += 30; if (!reason) reason = 'Mejor OVR disponible'; }
        else if (p.OVR_CALCULADO >= 80) { score += 20; if (!reason) reason = 'Alta calidad'; }

        // Budget value bonus
        if (p.Precio * 1000000 <= remainingBudget * 0.2) {
          score += 10;
          if (!reason) reason = 'Gran valor';
        }

        // Penalty if position is already stacked
        const posCount = positionCounts[pos] || 0;
        if (posCount >= 3) score -= 20;

        if (!reason) reason = 'Buen fichaje';

        return { ...p, _score: score, _reason: reason };
      })
      .sort((a, b) => b._score - a._score || b.OVR_CALCULADO - a.OVR_CALCULADO)
      .slice(0, 6);

    return scored;
  }, [allPlayers, cart, playerLocks, remainingBudget, userProfile]);

  const smartRecommendations = useMemo(() => {
    if (!allPlayers.length || !userProfile) return [];

    const posGroups = {
      PT: ['PT'],
      DEF: ['DFC', 'LD', 'LI'],
      MED: ['MC', 'MCD', 'MO', 'MD', 'MI'],
      DEL: ['DC', 'SD', 'ED', 'EI'],
    };
    const groupLabels = { PT: 'arco', DEF: 'defensa', MED: 'mediocampo', DEL: 'ataque' };
    const groupTargets = { PT: 2, DEF: 7, MED: 7, DEL: 5 };
    const targetSquadSize = 21;
    const remainingBudgetM = Math.max(0, Number(remainingBudget || 0) / 1000000);
    if (remainingBudgetM <= 0) return [];

    const getPlayerGroup = (pos) => {
      for (const [group, positions] of Object.entries(posGroups)) {
        if (positions.includes(pos)) return group;
      }
      return null;
    };

    const groupCounts = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
    const groupOvrTotals = { PT: 0, DEF: 0, MED: 0, DEL: 0 };
    const positionCounts = {};
    const cartIds = new Set(cart.map(player => String(player.Id)));
    const lockedIds = new Set(Object.keys(playerLocks || {}));

    cart.forEach(player => {
      const pos = player.POS_NOMBRE;
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      const group = getPlayerGroup(pos);
      if (group) {
        groupCounts[group]++;
        groupOvrTotals[group] += Number(player.OVR_CALCULADO || 0);
      }
    });

    const groupAvgOvr = {};
    Object.keys(groupCounts).forEach(group => {
      groupAvgOvr[group] = groupCounts[group] > 0
        ? Math.round(groupOvrTotals[group] / groupCounts[group])
        : 0;
    });

    const overallAvg = cart.length > 0
      ? Math.round(cart.reduce((sum, player) => sum + Number(player.OVR_CALCULADO || 0), 0) / cart.length)
      : 0;
    const openSlots = Math.max(1, targetSquadSize - cart.length);
    const budgetPerSlot = remainingBudgetM / openSlots;
    const strictCap = Math.max(1.5, Math.min(remainingBudgetM, Math.max(budgetPerSlot * 2.4, remainingBudgetM * 0.16)));
    const emergencyCap = Math.max(strictCap, Math.min(remainingBudgetM, Math.max(budgetPerSlot * 3.3, remainingBudgetM * 0.28)));

    const scored = allPlayers
      .filter(player => {
        const price = Number(player.Precio || 0);
        const group = getPlayerGroup(player.POS_NOMBRE);
        const groupNeed = group ? Math.max(0, (groupTargets[group] - groupCounts[group]) / groupTargets[group]) : 0;
        if (!group) return false;
        if (cartIds.has(String(player.Id))) return false;
        if (lockedIds.has(String(player.Id))) return false;
        if (price <= 0 || price > remainingBudgetM) return false;
        if (price > strictCap && groupNeed < 0.55 && price > emergencyCap) return false;
        return true;
      })
      .map(player => {
        const pos = player.POS_NOMBRE;
        const group = getPlayerGroup(pos);
        const price = Number(player.Precio || 0);
        const ovr = Number(player.OVR_CALCULADO || 0);
        const groupNeed = group ? Math.max(0, groupTargets[group] - groupCounts[group]) : 0;
        const groupNeedRatio = group ? groupNeed / groupTargets[group] : 0;
        const groupWeakness = group && groupAvgOvr[group] > 0 && overallAvg > 0
          ? Math.max(0, overallAvg - groupAvgOvr[group])
          : 0;
        const posCount = positionCounts[pos] || 0;
        const priceShare = price / Math.max(remainingBudgetM, 1);
        const slotShare = price / Math.max(budgetPerSlot, 1);
        const valueScore = price > 0 ? Math.min(24, Math.max(0, (ovr - 68) / Math.sqrt(price))) : 0;

        let score = 0;
        score += groupNeedRatio * 48;
        score += Math.min(24, groupWeakness * 4);
        score += Math.max(0, ovr - Math.max(72, overallAvg - 4)) * 1.8;
        score += valueScore;
        if (posCount === 0) score += 18;
        else if (posCount === 1) score += 7;
        else if (posCount >= 3) score -= 24;
        if (slotShare <= 1.05) score += 16;
        else if (slotShare <= 1.6) score += 8;
        else if (priceShare > 0.28 && groupNeedRatio < 0.55) score -= 18;
        if (cart.length < 11 && priceShare > 0.22) score -= 14;
        if (ovr >= 85 && priceShare <= 0.22) score += 10;

        let reason = 'Buen encaje';
        if (groupNeed > 0 && posCount === 0) reason = `Necesitás un ${pos}`;
        else if (groupNeedRatio >= 0.45) reason = `Completa ${groupLabels[group]}`;
        else if (groupWeakness >= 5) reason = `Sube ${groupLabels[group]}`;
        else if (slotShare <= 1.05) reason = 'Cuida presupuesto';
        else if (ovr >= overallAvg + 5) reason = 'Salto de calidad';

        const fit = slotShare <= 1.05 ? 'VALOR' : groupNeedRatio >= 0.45 ? 'NECESIDAD' : ovr >= overallAvg + 5 ? 'OVR' : 'FIT';
        const _valueNote = `${priceShare <= 0.01 ? '<1' : Math.round(priceShare * 100)}% del presupuesto`;
        return { ...player, _score: score, _reason: reason, _fit: fit, _group: group, _valueNote };
      })
      .sort((a, b) => b._score - a._score || Number(b.OVR_CALCULADO || 0) - Number(a.OVR_CALCULADO || 0));

    const selected = [];
    const selectedGroups = {};
    const selectedPositions = {};
    for (const player of scored) {
      const groupCount = selectedGroups[player._group] || 0;
      const selectedPosCount = selectedPositions[player.POS_NOMBRE] || 0;
      if (groupCount >= 2) continue;
      if (selectedPosCount >= 1 && selected.length < 4) continue;
      selected.push(player);
      selectedGroups[player._group] = groupCount + 1;
      selectedPositions[player.POS_NOMBRE] = selectedPosCount + 1;
      if (selected.length >= 6) break;
    }
    if (selected.length < 6) {
      for (const player of scored) {
        if (selected.some(item => String(item.Id) === String(player.Id))) continue;
        selected.push(player);
        if (selected.length >= 6) break;
      }
    }

    return selected;
  }, [allPlayers, cart, playerLocks, remainingBudget, userProfile]);

  if (isSpecialMode) {
    // OBS Goleadores view
    if (viewParam === 'goleadores' && !isObsMode) {
      if (!tournamentData)
        return <div className="min-h-screen bg-transparent flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando...</div>;
      const scorers = tournamentData.topScorers || [];
      return (
        <div className={`min-h-screen ${isObsMode ? 'bg-transparent' : 'bg-[#0a0a0a]'} p-8 font-sans`}>
          <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase mb-8 text-center drop-shadow-2xl">MÁXIMOS GOLEADORES</h2>
          <div className="max-w-[800px] mx-auto space-y-4">
            {scorers.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#0f172a]/80 p-5 rounded-2xl border border-white/10">
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
      <div className={`min-h-screen ${isObsMode ? 'bg-transparent' : 'bg-[#0a0a0a]'}`}>
        <Suspense fallback={null}>
          <TournamentModal
            isVisible={true}
            onClose={() => { }}
            tournamentData={tournamentData}
            isAdmin={false}
            onUpdateTournament={() => { }}
            allTeams={allTeams}
            initialTab={effectiveTab}
            userTeamName={userProfile?.teamName}
          />
        </Suspense>
        <style>{`
            .lucide-x, .border-b button { display: none !important; } 
            .flex.border-b.border-gray-700 { display: none !important; }
            ${isObsMode ? 'body, html { background: transparent !important; }' : ''}
        `}</style>
      </div>
    );
  }

  if (location.pathname.startsWith('/torneo')) {
    if (!tournamentData)
      return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white font-bold tracking-widest uppercase animate-pulse">Cargando Torneo...</div>;

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-200">
        <Suspense fallback={<LoadingScreen message="Cargando torneo..." />}>
          <TournamentModal
            isVisible={true}
            onClose={() => { window.location.href = '/'; }}
            tournamentData={tournamentData}
            isAdmin={isAdmin}
            onUpdateTournament={handleUpdateTournament}
            allTeams={allTeams}
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
              initialTab={tournamentOverlayTab}
              userTeamName={userProfile?.teamName}
            />
          </Suspense>
          <style>{`
            body, html { background: transparent !important; }
            .lucide-x, .border-b button { display: none !important; }
            .flex.border-b.border-gray-700 { display: none !important; }
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
      <div className="flex h-[100dvh] w-full bg-[#0a0a0a] text-gray-200 overflow-hidden font-sans">

        {/* SIDEBAR — ancho 0 cuando cerrada, 224px cuando abierta */}
        <LeftSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onHelpClick={() => openModalRoute('tutorial')}
          onSuggestionsClick={() => openModalRoute('suggestions')}
          onLogout={handleLogout}
          remainingBudget={remainingBudget}
          initialBudget={userProfile?.budget}
        />

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* TOP HEADER con hamburger */}
          <TopHeader
            userProfile={userProfile}
            unreadCount={notifications.filter(notification => notification.read !== true).length}
            unreadChatCount={unreadChatCount}
            onNotificationClick={() => {
              setAreNotificationsWarmed(true);
              setIsNotificationPanelOpen(!isNotificationPanelOpen);
            }}
            onChatClick={() => openModalRoute('chat')}
            onTransferFeedClick={() => {
              setShouldPrefetchTransfers(true);
              openModalRoute('transfers');
            }}
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
            <div data-app-tour="main" className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-8 flex flex-col" style={{ scrollbarColor: '#333 transparent' }} id="main-content">
              {/* Render content based on active tab, for now Marketplace is the main functional view */}
              <div data-app-tour="marketplace" className={activeTab === 'Marketplace' ? 'flex-1 min-h-0 flex flex-col' : 'hidden'}>

                {/* Header fijo: no scrollea con la lista — la lista tiene su propio scroll interno (virtualizado) */}
                <div className="shrink-0">
                <SearchBar
                  filters={filters}
                  setFilters={setFilters}
                  applyFilters={applyFilters}
                  setIsFiltrosModalVisible={(value) => value ? openModalRoute('filters') : closeModalRoute(setIsFiltrosModalVisible)}
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  gridColumns={gridColumns}
                  setGridColumns={setGridColumns}
                  resultCount={filteredPlayers.length}
                  totalCount={allPlayers.length}
                />

                {(playersLoadError || countriesLoadError) && (
                  <div className="mb-4 space-y-2">
                    {playersLoadError && (
                      <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold">
                        {playersLoadError}
                      </div>
                    )}
                    {countriesLoadError && (
                      <div className="px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm font-semibold">
                        {countriesLoadError}
                      </div>
                    )}
                  </div>
                )}

                {/* ── BUDGET WARNING BANNER ── */}
                {budgetPercent <= 20 && budgetPercent > 0 && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border transition-colors duration-300 ${budgetPercent <= 10
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                    }`}>
                    <span className="text-lg">⚠️</span>
                    <span className="text-sm font-bold">
                      Te queda poco presupuesto: ${(remainingBudget / 1000000).toFixed(1)}M disponibles
                    </span>
                  </div>
                )}

                {smartRecommendations.length > 0 && (
                  <RecommendationsAccordion
                    recommendations={smartRecommendations}
                    remainingBudget={remainingBudget}
                    onSelectPlayer={setSelectedPlayerId}
                  />
                )}
                {remainingBudget > 0 && remainingBudget < 1000000 && allPlayers.length > 0 && smartRecommendations.length === 0 && (
                  <div className="mb-6 text-center py-4 px-6 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-sm text-gray-400 font-bold">Tu presupuesto no alcanza para más fichajes</p>
                  </div>
                )}
                </div>
                {/* Fin del header fijo */}

                <div className="flex-1 min-h-0 mt-1" data-app-tour="players" id="player-list">
                {viewMode === 'list' ? (
                  <VirtualizedPlayerList
                    players={filteredPlayers}
                    playerLocks={playerLocks}
                    userId={userId}
                    allTeams={allTeams}
                    countryMap={countryMap}
                    wishlistSet={wishlistSet}
                    comparingIdsSet={comparingIdsSet}
                    onSelectPlayer={setSelectedPlayerId}
                    onToggleWishlist={toggleWishlist}
                    onCompare={handleToggleCompare}
                    overscanCount={isMobileViewport ? 3 : 6}
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
                    onSelectPlayer={setSelectedPlayerId}
                    onToggleWishlist={toggleWishlist}
                    onCompare={handleToggleCompare}
                    overscanCount={isMobileViewport ? 1 : 2}
                    cardMaxHeight={gridCardMaxHeight}
                  />
                )}
                </div>
              </div> {/* End Marketplace Container*/}


              {/* VISTAS MODULARES EN LUGAR DE PLACEHOLDERS */}
              <Suspense fallback={null}>
                {activeTab === 'Torneo' && (
                  <TournamentModal
                    isVisible={true}
                    onClose={() => setActiveTab('Marketplace')}
                    tournamentData={tournamentData}
                    isAdmin={isAdmin}
                    onUpdateTournament={handleUpdateTournament}
                    allTeams={allTeams}
                    isPage={true}
                    userTeamName={userProfile?.teamName}
                  />
                )}
                {activeTab === 'My Team' && (
                  <FormationModal
                    isVisible={true}
                    onClose={() => setActiveTab('Marketplace')}
                    cart={cart}
                    userProfile={userProfile}
                    getPrivateProfileRef={getPrivateProfileRef}
                    getPublicTeamRef={getPublicTeamRef}
                    showStatusMessage={showStatusMessage}
                    db={db}
                    isPage={true}
                  />
                )}
                {activeTab === 'Scouting' && (
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
                      setSelectedPlayerId(player.Id);
                    }}
                    addNotification={addNotification}
                    showStatusMessage={showStatusMessage}
                  />
                )}
                {activeTab === 'Other Teams' && (
                  <TeamsModal
                    isVisible={true}
                    onClose={() => setActiveTab('Marketplace')}
                    allTeams={allTeams}
                    playerLocks={playerLocks}
                    allPlayers={allPlayers}
                    countryMap={countryMap}
                    onPlayerClick={(player) => {
                      setSelectedPlayerId(player.Id);
                    }}
                    isPage={true}
                    title="Otros Equipos"
                    subtitle="Monitor de planteles rivales"
                  />
                )}
                {activeTab === 'Financials' && (
                  <CartModal
                    isVisible={true}
                    onClose={() => setActiveTab('Marketplace')}
                    cart={cart}
                    onRemoveFromCart={handleRemoveFromCart}
                    userProfile={userProfile}
                    totalCartCost={totalCartCost}
                    remainingBudget={remainingBudget}
                    incomingOffers={incomingOffers}
                    sentOffers={sentOffers}
                    offerHistory={offerHistory}
                    countryMap={countryMap}
                    onPlayerClick={handleOpenPlayerFromCart}
                    isPage={true}
                    allPlayers={allPlayers}
                    allTeams={allTeams}
                  />
                )}
                {activeTab === 'Admin' && isAdmin && (
                  <AdminModal
                    isVisible={true}
                    onClose={() => setActiveTab('Marketplace')}
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
                    storage={storage}
                    db={db}
                    showStatusMessage={showStatusMessage}
                  />
                )}
              </Suspense>
            </div> {/* End scrollable center pane */}

            {/* RIGHT SIDEBAR - ACTIVITY PANEL */}
          </div> {/* End flex-1 row */}
        </div> {/* End flex-1 col */}
      </div> {/* End h-screen */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">

          {/* CONTENEDOR PRINCIPAL CON ESTILO PREMIUM */}
          <div className="flex items-center gap-6 bg-gray-900/90 backdrop-blur-xl border border-blue-500/40 p-4 pr-6 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.3)]">

            {/* ÁREA DE JUGADORES */}
            <div className="flex items-center gap-4">

              {/* JUGADOR 1 */}
              <div className="relative group">
                <img
                  src={`/fotos_jugadores/${compareList[0].Id}.webp`}
                  className="w-16 h-16 rounded-full border-2 border-blue-400 object-cover shadow-lg shadow-blue-500/20 bg-gray-800"
                  onError={(e) => e.target.src = `https://placehold.co/64x64/374151/e0e0e0?text=${compareList[0].Name.substring(0, 1)}`}
                />
                <button
                  onClick={() => handleRemoveCompareItem(compareList[0].Id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full hover:scale-110 transition shadow-sm border-2 border-gray-900"
                  title="Quitar"
                >
                  <X size={12} />
                </button>
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-600 text-white whitespace-nowrap shadow-sm">
                  {compareList[0].OVR_CALCULADO}
                </div>
              </div>

              {/* SEPARADOR "VS" */}
              <div className="flex flex-col items-center justify-center">
                <div className="text-xs font-black text-gray-500 italic bg-gray-800/50 px-2 py-1 rounded">VS</div>
              </div>

              {/* JUGADOR 2 (O PLACEHOLDER) */}
              {compareList[1] ? (
                <div className="relative group animate-in zoom-in-50 duration-300">
                  <img
                    src={`/fotos_jugadores/${compareList[1].Id}.webp`}
                    className="w-16 h-16 rounded-full border-2 border-red-400 object-cover shadow-lg shadow-red-500/20 bg-gray-800"
                    onError={(e) => e.target.src = `https://placehold.co/64x64/374151/e0e0e0?text=${compareList[1].Name.substring(0, 1)}`}
                  />
                  <button
                    onClick={() => handleRemoveCompareItem(compareList[1].Id)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full hover:scale-110 transition shadow-sm border-2 border-gray-900"
                    title="Quitar"
                  >
                    <X size={12} />
                  </button>
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-600 text-white whitespace-nowrap shadow-sm">
                    {compareList[1].OVR_CALCULADO}
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center bg-gray-800/50">
                  <span className="text-2xl text-gray-600 font-bold">?</span>
                </div>
              )}
            </div>

            {/* DIVISOR VERTICAL */}
            <div className="h-10 w-px bg-gray-700 mx-2"></div>

            {/* BOTÓN DE ACCIÓN GRANDE */}
            <button
              disabled={compareList.length < 2}
              onClick={() => openModalRoute('compare')}
              className={`
                        flex items-center px-6 py-3 rounded-xl font-bold text-white shadow-xl transition-all transform
                        ${compareList.length < 2
                  ? 'bg-gray-700 cursor-not-allowed opacity-50 grayscale'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-105 hover:shadow-blue-500/40'
                }
                    `}
            >
              <ArrowLeftRight className="w-5 h-5 mr-2" />
              {compareList.length < 2 ? 'Elige otro...' : 'COMPARAR'}
            </button>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
      <ComparisonModal
        isVisible={isComparisonModalVisible || modalRoute === 'compare'}
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
        onClose={() => setSelectedPlayerId(null)}
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
        isInMyCart={selectedPlayer && cart.some(p => p.Id === selectedPlayer.Id)}
        isFranchisePlayer={selectedPlayer && playerLocks[selectedPlayer.Id]?.isFranchise}
        onRemoveFromCart={handleRemoveFromCart}
        allPlayers={allPlayers}
        onPlayerSwitch={(p) => setSelectedPlayerId(p.Id)}
        marketStatus={marketStatus}
      />
      {(isCartVisible || modalRoute === 'cart') && (
        <CartModal
          isVisible={true}
          onClose={() => closeModalRoute(setIsCartVisible)}
          cart={cart}
          onRemoveFromCart={handleRemoveFromCart}
          userProfile={userProfile}
          totalCartCost={totalCartCost}
          remainingBudget={remainingBudget}
          incomingOffers={incomingOffers}
          sentOffers={sentOffers}
          offerHistory={offerHistory}
          countryMap={countryMap}
          onPlayerClick={handleOpenPlayerFromCart}
          allPlayers={allPlayers}
          allTeams={allTeams}
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
          setSelectedPlayerId(player.Id); // 1. Abre el perfil del jugador
          closeModalRoute(setIsTeamsModalVisible);
        }}
      />
      {(isAdminModalVisible || modalRoute === 'admin') && isAdmin && (
        <AdminModal
          isVisible={true}
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
          storage={storage}
          db={db}
          showStatusMessage={showStatusMessage}
        />
      )}
      {(isTournamentModalVisible || modalRoute === 'tournament') && (
        <TournamentModal
          isVisible={true}
          onClose={() => closeModalRoute(setIsTournamentModalVisible)}
          tournamentData={tournamentData}
          isAdmin={isAdmin}
          onUpdateTournament={handleUpdateTournament}
          allTeams={allTeams}
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
        onClear={() => setNotifications([])}
        onDismissOne={(notification) => setNotifications(prev => prev.filter(item => item.id !== notification.id))}
        onMarkAllRead={() => setNotifications(prev => prev.map(item => ({ ...item, read: true })))}
        onNotifClick={(notification) => {
          setNotifications(prev => prev.map(item => item.id === notification.id ? { ...item, read: true } : item));
          if (['offer', 'transfer'].includes(notification.type) || notification.category === 'transfer') {
            openModalRoute('cart');
          }
        }}
      />

      {/* BUDGET ALERT MODAL */}
      {showBudgetAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowBudgetAlert(false)}>
          <div className="bg-gray-900 border border-orange-500/30 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-black text-white">¡Atención!</h3>
            </div>
            <p className="text-gray-300 text-sm mb-2">Tu presupuesto está casi agotado.</p>
            <p className="text-2xl font-black text-orange-400 mb-4">
              Presupuesto restante: ${(remainingBudget / 1000000).toFixed(1)}M
            </p>
            <button
              onClick={() => setShowBudgetAlert(false)}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-xl transition-colors uppercase tracking-wider text-sm"
            >
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
      <div className="fixed bottom-6 right-6 z-[80] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: '380px' }}>
        {signingToasts.map(toast => (
          <div
            key={toast.toastId}
            className="pointer-events-auto bg-gray-900/95 backdrop-blur-xl border border-gray-700/60 rounded-xl p-4 shadow-2xl animate-in slide-in-from-right-10 fade-in duration-400 flex items-center gap-3"
            style={{ borderLeft: `4px solid ${toast.posColor}` }}
          >
            <div className="text-lg">🔒</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-200 leading-snug">
                <span className="font-black text-white">{toast.teamName}</span>{' '}fichó a{' '}
                <span className="font-bold text-white">{toast.playerName}</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                {toast.ovr} OVR · {toast.pos}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  // Keep a compact, public squad snapshot so the public team board can show
  // both the XI and the substitutes without exposing the private cart.
  useEffect(() => {
    if (!userId || !userProfile) return;

    const roster = cart.map(player => ({
      Id: String(player.Id),
      Name: player.Name || 'Jugador',
      POS_NOMBRE: player.POS_NOMBRE || '',
      OVR_CALCULADO: Number(player.OVR_CALCULADO) || 0,
      dorsal: userProfile.dorsals?.[player.Id] || '',
      available: userProfile.availability?.[player.Id] !== false,
    }));

    setDoc(getPublicTeamRef(userId), { roster, rosterUpdatedAt: new Date().toISOString() }, { merge: true })
      .catch(error => console.error('Error sincronizando plantilla pública:', error));
  }, [cart, getPublicTeamRef, userId, userProfile]);
}

export default firebaseInitializationError ? FirebaseError : App; 
