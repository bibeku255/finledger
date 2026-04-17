import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, 
  HiOutlineCheckCircle, 
  HiOutlinePlus, 
  HiOutlineX, 
  HiOutlineTrash, 
  HiOutlinePencil, 
  HiOutlineCloudDownload, 
  HiOutlineRefresh, 
  HiOutlinePhotograph, 
  HiOutlineXCircle, 
  HiOutlineCube, 
  HiOutlineExclamation,
  HiOutlineSun, 
  HiOutlineExternalLink, 
  HiOutlineCollection, 
  HiOutlineSparkles,
  HiOutlineCheck, 
  HiOutlineExclamationCircle, 
  HiOutlineInformationCircle,
  HiOutlineKey,
  HiOutlineTerminal
} from 'react-icons/hi';
import { FaBitcoin, FaCoins } from 'react-icons/fa';

// ============================================
// 🚀 PREMIUM TOAST NOTIFICATION SYSTEM
// ============================================

const ToastContext = React.createContext(null);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${
              toast.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700' :
              toast.type === 'error' ? 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700' :
              toast.type === 'warning' ? 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700' :
              'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
            }`}
            style={{ zIndex: 10000 + index }}
          >
            {toast.type === 'success' && <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'warning' && <HiOutlineExclamation className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <HiOutlineX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

// ============================================
// 🚀 PREMIUM CONFIRMATION MODAL
// ============================================

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className={`p-6 ${
          type === 'danger' ? 'bg-gradient-to-r from-red-600 to-red-500' :
          type === 'warning' ? 'bg-gradient-to-r from-amber-600 to-amber-500' :
          'bg-gradient-to-r from-blue-600 to-blue-500'
        }`}>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            {type === 'danger' ? <HiOutlineExclamationCircle className="text-white" size={28} /> :
             type === 'warning' ? <HiOutlineExclamation className="text-white" size={28} /> :
             <HiOutlineInformationCircle className="text-white" size={28} />}
          </div>
          <h3 className="text-xl font-black text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white transition-colors ${
                type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 🚀 UTILITY FUNCTIONS
// ============================================

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/<script.*?>.*?<\/script>/gi, '').replace(/[<>]/g, '').replace(/javascript:/gi, '').trim().slice(0, 200);
};

const isSafeUrl = (url) => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
};

// ⚡ ULTRA PRO FIX: ID Normalization Helper
const normalizeId = (id) => String(id || '').toLowerCase().trim();

let jupiterTokenMap = null;

const getCache = (key) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
};

const setCache = (key, data, ttlMinutes) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + (ttlMinutes * 60 * 1000) }));
  } catch (e) { console.warn("Cache quota exceeded"); }
};

const fetchWithRetry = async (url, options = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status !== 429) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (e.name === 'AbortError') throw e; 
      if (i === retries) return null;
    }
  }
  return null; 
};

const getTrustWalletLogo = (network, address) => {
  if (!network || !address) return null;
  const networkMap = { bsc: 'smartchain', eth: 'ethereum', polygon_pos: 'polygon', arbitrum: 'arbitrum', optimism: 'optimism', base: 'base', solana: 'solana' };
  const mapped = networkMap[network];
  if (!mapped) return null;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${mapped}/assets/${address}/logo.png`;
};

const fetchSolanaTokenMetadata = async (mintAddress, signal) => {
  const cacheKey = `meta_sol_${mintAddress}`;
  const cachedMeta = getCache(cacheKey);
  if (cachedMeta) return cachedMeta;

  try {
    if (!jupiterTokenMap || !getCache('jup_all_tokens')) {
      const response = await fetchWithRetry(`https://token.jup.ag/all`, { signal });
      if (response && response.ok) {
        const data = await response.json();
        jupiterTokenMap = new Map(data.map(t => [t.address, t]));
        setCache('jup_all_tokens', true, 60); 
      }
    }
    
    if (jupiterTokenMap) {
      const token = jupiterTokenMap.get(mintAddress);
      if (token) {
        const res = { symbol: token.symbol, name: token.name, logoUrl: token.logoURI || null, source: 'Jupiter' };
        setCache(cacheKey, res, 15);
        return res;
      }
    }
    
    const dexResponse = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, { signal });
    if (dexResponse && dexResponse.ok) {
      const data = await dexResponse.json();
      if (Array.isArray(data.pairs) && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const res = { symbol: pair.baseToken.symbol, name: pair.baseToken.name || pair.baseToken.symbol, logoUrl: null, source: 'DexScreener' };
        setCache(cacheKey, res, 15);
        return res;
      }
    }

    const birdeyeResponse = await fetchWithRetry(`https://public-api.birdeye.so/public/token?address=${mintAddress}`, { headers: { 'x-chain': 'solana' }, signal });
    if (birdeyeResponse && birdeyeResponse.ok) {
      const data = await birdeyeResponse.json();
      if (data.data) {
        const res = { symbol: data.data.symbol, name: data.data.name, logoUrl: data.data.logoURI || null, source: 'Birdeye' };
        setCache(cacheKey, res, 15);
        return res;
      }
    }
    return null;
  } catch (err) {
    if (err.name !== 'AbortError') console.error("Solana metadata fetch failed:", err);
    return null;
  }
};

const fetchSolanaTokenPrice = async (mintAddress, signal) => {
  const cacheKey = `price_sol_${mintAddress}`;
  const cachedPrice = getCache(cacheKey);
  if (cachedPrice) return cachedPrice;

  try {
    const dexResponse = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`, { signal });
    if (dexResponse && dexResponse.ok) {
      const data = await dexResponse.json();
      if (Array.isArray(data.pairs) && data.pairs.length > 0 && data.pairs[0]?.priceUsd) {
        const price = parseFloat(data.pairs[0].priceUsd);
        setCache(cacheKey, price, 5); 
        return price;
      }
    }

    const birdeyeResponse = await fetchWithRetry(`https://public-api.birdeye.so/public/price?address=${mintAddress}`, { headers: { 'x-chain': 'solana' }, signal });
    if (birdeyeResponse && birdeyeResponse.ok) {
      const priceData = await birdeyeResponse.json();
      if (priceData.data?.value) {
        setCache(cacheKey, priceData.data.value, 5);
        return priceData.data.value;
      }
    }
    return 0;
  } catch { return 0; }
};

const generateSolanaLogoUrl = (mintAddress, symbol) => `https://ui-avatars.com/api/?name=${symbol || 'TOKEN'}&background=8B5CF6&color=fff&bold=true&size=64`;

const getFallbackLogo = (symbol, network, address) => {
  const trustWalletUrl = getTrustWalletLogo(network, address);
  if (trustWalletUrl) return trustWalletUrl;
  if (network === 'solana' && address) return generateSolanaLogoUrl(address, symbol);
  return `https://ui-avatars.com/api/?name=${symbol || 'TKN'}&background=3B82F6&color=fff&bold=true&size=64`;
};

const isValidAddress = (address, network) => {
  if (!address) return false;
  if (network === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const getAddressPlaceholder = (network) => network === 'solana' ? 'Solana mint address (base58)' : '0x... (40 hex chars)';

const getExplorerUrl = (network, address) => {
  const explorers = {
    solana: `https://solscan.io/token/${address}`, eth: `https://etherscan.io/token/${address}`,
    bsc: `https://bscscan.com/token/${address}`, polygon_pos: `https://polygonscan.com/token/${address}`,
    arbitrum: `https://arbiscan.io/token/${address}`, optimism: `https://optimistic.etherscan.io/token/${address}`,
    base: `https://basescan.org/token/${address}`
  };
  return explorers[network] || null;
};

// ============================================
// 🚀 PREMIUM COMPONENTS
// ============================================

const LogoRenderer = ({ symbol, customLogo, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(customLogo || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const symbolUpper = (symbol || '').toUpperCase();

  useEffect(() => {
    if (customLogo) {
      setImgSrc(customLogo);
      setHasError(false);
      setIsLoaded(false);
    }
  }, [customLogo]);

  if (!imgSrc || hasError) {
    return (
      <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800'} ${color || 'text-slate-500 dark:text-slate-300'} shadow-inner border-2 border-white/20 dark:border-slate-700/50`}>
        {symbolUpper ? symbolUpper.substring(0, 3) : 'TKN'}
      </span>
    );
  }

  return (
    <div className="relative w-full h-full">
      {!isLoaded && (
        <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
      )}
      <img 
        src={imgSrc} 
        alt={symbolUpper} 
        className={`w-full h-full object-contain rounded-full relative z-10 bg-transparent border-2 border-white/20 dark:border-slate-700 shadow-md p-[2px] transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy" 
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setImgSrc(generateSolanaLogoUrl(null, symbolUpper));
          setHasError(true);
        }} 
      />
    </div>
  );
};

const SkeletonCard = () => (
  <div className="flex flex-col items-center p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 animate-pulse mb-4 shadow-inner" />
    <div className="h-5 w-16 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg mb-2 animate-pulse" />
    <div className="h-3 w-20 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded animate-pulse" />
  </div>
);

const Tooltip = ({ children, text, shortcut }) => (
  <div className="relative group/tooltip">
    {children}
    <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800/95 dark:bg-slate-700/95 backdrop-blur-sm text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-30 shadow-xl border border-slate-600/50 flex items-center gap-2">
      <span>{text}</span>
      {shortcut && (
        <span className="flex items-center gap-0.5 text-[9px] text-slate-300">
          <HiOutlineTerminal size={10} />
          {shortcut}
        </span>
      )}
    </div>
  </div>
);

const RateLimitBanner = ({ onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-amber-50/95 dark:bg-amber-900/90 backdrop-blur-md border border-amber-200 dark:border-amber-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center flex-shrink-0">
          <HiOutlineExclamation className="text-amber-600 dark:text-amber-400 w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">API Rate Limit</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Using cached data. Retrying silently...</p>
        </div>
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-1">
          <HiOutlineX size={18} />
        </button>
      </div>
    </div>
  );
};

const NetworkBadge = ({ network }) => {
  const networkConfig = {
    solana: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'SOL', color: 'text-white' },
    eth: { bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', text: 'ETH', color: 'text-white' },
    bsc: { bg: 'bg-gradient-to-r from-yellow-500 to-orange-500', text: 'BSC', color: 'text-black' },
    polygon_pos: { bg: 'bg-gradient-to-r from-purple-600 to-indigo-600', text: 'MATIC', color: 'text-white' },
    arbitrum: { bg: 'bg-gradient-to-r from-blue-600 to-sky-600', text: 'ARB', color: 'text-white' },
    optimism: { bg: 'bg-gradient-to-r from-red-500 to-orange-500', text: 'OP', color: 'text-white' },
    base: { bg: 'bg-gradient-to-r from-blue-700 to-indigo-700', text: 'BASE', color: 'text-white' }
  };
  const config = networkConfig[network];
  if (!config) return null;
  return (
    <span className={`absolute bottom-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-md ${config.bg} ${config.color} shadow-md ring-1 ring-white/20`}>
      {config.text}
    </span>
  );
};

// ============================================
// 🚀 CONSTANTS & DATA
// ============================================

const SUPPORTED_NETWORKS = [
  { id: 'eth', name: 'Ethereum' }, 
  { id: 'bsc', name: 'Binance Smart Chain' },
  { id: 'solana', name: 'Solana' }, 
  { id: 'polygon_pos', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' }, 
  { id: 'base', name: 'Base' }, 
  { id: 'optimism', name: 'Optimism' }
];

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

const CryptoManagerContent = () => {
  const { user, selectedCryptos = [], updateSelectedCryptos } = useAuth();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('selected');
  const [activeCoins, setActiveCoins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [top250Coins, setTop250Coins] = useState([]);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [hiddenTokens, setHiddenTokens] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Custom Token');
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchStatus, setFetchStatus] = useState('');
  const [showRateLimitBanner, setShowRateLimitBanner] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  const [fetchMode, setFetchMode] = useState('contract');

  const [newCoin, setNewCoin] = useState({
    apiId: '', network: 'solana', contractAddress: '', symbol: '', name: '', fallbackPrice: '', logoUrl: ''
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'warning'
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (!isAddModalOpen) openAddModal();
      }
      if (e.key === 'Escape' && isAddModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

  // ⚡ ULTRA PRO FIX: Normalize Initial Selection & Filter Duplicates
  useEffect(() => {
    if (selectedCryptos && selectedCryptos.length > 0) {
      const identifiers = selectedCryptos.map(c => typeof c === 'string' ? normalizeId(c) : normalizeId(c.id));
      setActiveCoins(Array.from(new Set(identifiers.filter(Boolean))));
    } else {
      setActiveCoins([]);
    }
  }, [selectedCryptos]);

  useEffect(() => {
    let isMounted = true;
    const fetchUserData = async () => {
      if (!user) { if (isMounted) setIsLoading(false); return; }
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && isMounted) {
          const data = userSnap.data();
          if (data.hiddenTokens) setHiddenTokens(data.hiddenTokens);
          if (data.customCoins) setCustomUserCoins(data.customCoins);
        }
      } catch (err) { console.error(err); } finally { if (isMounted) setIsLoading(false); }
    };
    fetchUserData();
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const fetchTop250 = async () => {
      try {
        const cachedData = getCache('finledger_top_coins');
        if (cachedData) { if (isMounted) setTop250Coins(cachedData); return; }

        const res = await fetchWithRetry(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`);
        if (res && res.ok) {
          const data = await res.json();
          if (isMounted) setTop250Coins(data);
          setCache('finledger_top_coins', data, 60);
        }
      } catch (err) { console.error(err); }
    };
    fetchTop250();
    return () => { isMounted = false; };
  }, []);

  // ⚡ ULTRA PRO FIX: Inject missing "Ghost Coins" from selection into fullDatabase
  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    
    top250Coins.forEach(c => {
      if (!c?.id) return;
      const normalizedId = normalizeId(c.id);
      coinMap.set(normalizedId, {
        id: normalizedId, symbol: c.symbol.toUpperCase(), name: c.name, logo: c.image, fallbackPrice: c.current_price,
        bg: 'bg-gradient-to-br from-slate-700 to-slate-800', color: 'text-white', network: null, contractAddress: null
      });
    });

    customUserCoins.forEach(c => {
      const normalizedId = normalizeId(c.id || c.symbol);
      coinMap.set(normalizedId, { 
        id: normalizedId, 
        symbol: c.symbol.toUpperCase(), name: c.name || c.symbol, logo: c.logo || null, fallbackPrice: c.fallbackPrice || 0,
        bg: c.bg || 'bg-gradient-to-br from-purple-500/20 to-pink-500/20', color: c.color || 'text-purple-500', 
        network: c.network || null, contractAddress: c.contractAddress || null
      });
    });

    // Inject active ghost coins missing from DB
    selectedCryptos.forEach(c => {
      if (typeof c === 'object' && c.id) {
        const normalizedId = normalizeId(c.id);
        if (!coinMap.has(normalizedId)) {
          coinMap.set(normalizedId, {
            id: normalizedId, symbol: (c.symbol || '').toUpperCase(), name: c.name || c.symbol, logo: c.logo || null, fallbackPrice: c.fallbackPrice || 0,
            bg: c.bg || 'bg-slate-800', color: c.color || 'text-white', network: c.network || null, contractAddress: c.contractAddress || null
          });
        }
      }
    });

    return Array.from(coinMap.values());
  }, [top250Coins, customUserCoins, selectedCryptos]);

  const coinLookupMap = useMemo(() => {
    const map = new Map();
    fullDatabase.forEach(c => map.set(c.id, c));
    return map;
  }, [fullDatabase]);

  const { displaySelected, displayAvailable } = useMemo(() => {
    const activeSet = new Set(activeCoins);
    const hiddenSet = new Set(hiddenTokens.map(normalizeId));
    const query = debouncedSearch.toLowerCase();
    
    const selected = [];
    const available = [];

    for (const coin of fullDatabase) {
      if (hiddenSet.has(coin.id)) continue;

      if (query && !coin.name.toLowerCase().includes(query) && !coin.symbol.toLowerCase().includes(query)) {
        continue;
      }

      if (activeSet.has(coin.id)) {
        selected.push(coin);
      } else {
        available.push(coin);
      }
    }

    return { displaySelected: selected, displayAvailable: available };
  }, [fullDatabase, debouncedSearch, hiddenTokens, activeCoins]);

  const currentListToDisplay = activeTab === 'selected' ? displaySelected : displayAvailable;

  const toggleCoin = (identifier) => {
    const normId = normalizeId(identifier);
    setActiveCoins((prev) => {
      const isRemoving = prev.includes(normId);
      const newSelection = isRemoving ? prev.filter(c => c !== normId) : [...prev, normId];
      const coin = coinLookupMap.get(normId);
      if (coin && !isRemoving) {
        addToast(`Added ${coin.symbol} to portfolio`, 'success', 2000);
      }
      return newSelection;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const enrichedSelection = activeCoins.map(identifier => {
      const normId = normalizeId(identifier);
      const coinData = coinLookupMap.get(normId) || {};
      return {
        symbol: coinData.symbol || identifier.toUpperCase(), id: normId,
        name: coinData.name || coinData.symbol || identifier, logo: coinData.logo || null, fallbackPrice: coinData.fallbackPrice || 0,
        bg: coinData.bg || 'bg-slate-800', color: coinData.color || 'text-white', network: coinData.network || null, contractAddress: coinData.contractAddress || null
      };
    });

    if (updateSelectedCryptos) await updateSelectedCryptos(enrichedSelection);
    addToast(`Portfolio synced with ${activeCoins.length} asset${activeCoins.length !== 1 ? 's' : ''}`, 'success');
    setIsSaving(false); 
    navigate('/dashboard'); 
  };

  const handleEditClick = (e, coin) => {
    e.stopPropagation();
    setModalTitle(`Edit Token: ${coin.symbol}`);
    setFetchMode(coin.contractAddress ? 'contract' : 'id');
    setNewCoin({
      apiId: coin.id || '', network: coin.network || 'solana', contractAddress: coin.contractAddress || '',
      symbol: coin.symbol, name: coin.name, fallbackPrice: coin.fallbackPrice || '', logoUrl: coin.logo || ''
    });
    setFetchError(null); setFetchStatus(''); setFetchSuccess(false); setIsAddModalOpen(true);
  };

  const handleAutoFetchDetails = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsFetchingData(true); setFetchError(null); setFetchStatus('Fetching token data...'); setFetchSuccess(false);
    const currentNetwork = newCoin.network;
    
    try {
      if (fetchMode === 'id') {
        const searchId = sanitizeInput(newCoin.apiId).toLowerCase();
        if (!searchId) { setFetchError("Enter CoinGecko ID"); setIsFetchingData(false); setFetchStatus(''); return; }

        if (searchId === 'rox' || searchId === 'robox') {
          setNewCoin(prev => ({...prev, symbol: 'ROX', name: 'Robox', fallbackPrice: 0, logoUrl: null, apiId: 'robox-solana'}));
          setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Verified Asset'); setIsFetchingData(false); return;
        }
        
        if (searchId === 'ctc' || searchId === 'cryptotab') {
          setNewCoin(prev => ({...prev, symbol: 'CTC', name: 'CryptoTab Coin', fallbackPrice: 1.00, logoUrl: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', apiId: 'cryptotab-coin'}));
          setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Verified Asset'); setIsFetchingData(false); return;
        }
        
        const cacheKey = `cg_token_${searchId}`;
        const cachedData = getCache(cacheKey);
        
        if (cachedData) {
          setNewCoin(prev => ({ ...prev, ...cachedData }));
          setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Token loaded from cache');
          setIsFetchingData(false); return;
        }

        setFetchStatus('Fetching from CoinGecko...');
        const res = await fetchWithRetry(`https://api.coingecko.com/api/v3/coins/${searchId}`, { signal });
        
        if (!res || !res.ok) {
          if (res?.status === 429) { setFetchError("Rate limit reached. Try again later."); setShowRateLimitBanner(true); } 
          else { setFetchError("CoinGecko ID not found."); }
          setIsFetchingData(false); setFetchStatus(''); return;
        }
        
        const data = await res.json();
        const formattedData = { symbol: data.symbol.toUpperCase(), name: data.name, fallbackPrice: data.market_data?.current_price?.usd || newCoin.fallbackPrice, logoUrl: data.image?.large || newCoin.logoUrl };
        setNewCoin(prev => ({ ...prev, ...formattedData }));
        setCache(cacheKey, formattedData, 60); 
        setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Token found on CoinGecko');

      } else if (fetchMode === 'contract') {
        const address = sanitizeInput(newCoin.contractAddress);
        if (!address || !currentNetwork) { setFetchError("Enter Network and Address"); setIsFetchingData(false); setFetchStatus(''); return; }

        if (currentNetwork === 'solana' && address.startsWith('Rox')) {
          setNewCoin(prev => ({...prev, symbol: 'ROX', name: 'Robox', fallbackPrice: 0, logoUrl: null, apiId: 'robox-solana'}));
          setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Verified Asset'); setIsFetchingData(false); return;
        }
        
        if (!isValidAddress(address, currentNetwork)) {
          setFetchError(currentNetwork === 'solana' ? "Invalid Solana mint address format" : "Invalid contract address format");
          setIsFetchingData(false); setFetchStatus(''); return;
        }
        
        if (currentNetwork === 'solana') {
          setFetchStatus('Searching Solana registries...');
          const solanaMetadata = await fetchSolanaTokenMetadata(address, signal);
          if (solanaMetadata) {
            const price = await fetchSolanaTokenPrice(address, signal);
            setNewCoin(prev => ({ ...prev, symbol: solanaMetadata.symbol.toUpperCase(), name: solanaMetadata.name, fallbackPrice: price || prev.fallbackPrice || 0, logoUrl: solanaMetadata.logoUrl || getFallbackLogo(solanaMetadata.symbol, currentNetwork, address), apiId: `solana-${address.substring(0, 8)}` }));
            setFetchError(null); setFetchSuccess(true); setFetchStatus(`✓ Data Source: ${solanaMetadata.source}`);
          } else {
            const friendlyName = newCoin.name || `Token ${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
            const friendlySymbol = newCoin.symbol || 'TOKEN';
            setNewCoin(prev => ({ ...prev, symbol: prev.symbol || friendlySymbol, name: prev.name || friendlyName, logoUrl: prev.logoUrl || generateSolanaLogoUrl(address, friendlySymbol), apiId: `solana-${address.substring(0, 8)}`, fallbackPrice: prev.fallbackPrice || 0 }));
            setFetchSuccess(false); setFetchStatus('');
            setFetchError(
              <span className="flex items-center gap-1 flex-wrap">
                Token not found in public registries.
                <button type="button" onClick={searchDexScreener} className="underline hover:text-blue-600 dark:hover:text-blue-400 font-bold mr-1">Try DexScreener</button> or
                <button type="button" onClick={() => setFetchError(null)} className="underline hover:text-blue-600 dark:hover:text-blue-400 font-bold ml-1">Fill manually</button>
              </span>
            );
          }
          setIsFetchingData(false); return;
        }
        
        setFetchStatus('Fetching from GeckoTerminal...');
        const fallbackLogo = getFallbackLogo(newCoin.symbol || 'TOKEN', currentNetwork, address);
        const cacheKey = `gt_token_${currentNetwork}_${address}`;
        const cachedData = getCache(cacheKey);

        if (cachedData) {
           setNewCoin(prev => ({ ...prev, ...cachedData }));
           setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Token loaded from cache');
           setIsFetchingData(false); return;
        }

        const res = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${currentNetwork}/tokens/${address}`, { signal });
        
        if (!res || !res.ok) {
          if (res?.status === 429) setFetchError("Rate limit reached. Using fallback data.");
          else setFetchError("Contract not found. You can enter details manually.");
          setNewCoin(prev => ({ ...prev, logoUrl: fallbackLogo }));
          setIsFetchingData(false); setFetchStatus(''); setFetchSuccess(false); return;
        }
        
        const json = await res.json();
        const data = json.data.attributes;
        const formattedData = { symbol: data.symbol.toUpperCase(), name: data.name, fallbackPrice: data.price_usd || newCoin.fallbackPrice, logoUrl: data.image_url || fallbackLogo, apiId: `custom-${currentNetwork}-${address.substring(0,6)}` };
        setNewCoin(prev => ({ ...prev, ...formattedData }));
        setCache(cacheKey, formattedData, 30); 
        setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Data Source: GeckoTerminal');
      }
    } catch (err) {
      if (err.name === 'AbortError') return; 
      setFetchError("Network error. Manual entry allowed."); setFetchSuccess(false);
    } finally {
      setIsFetchingData(false);
      if (currentNetwork !== 'solana') setTimeout(() => setFetchStatus(''), 3000);
    }
  };

  const searchDexScreener = async () => {
    if (!newCoin.contractAddress) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setFetchStatus('Searching DexScreener...'); setIsFetchingData(true);
    try {
      const res = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${newCoin.contractAddress}`, { signal });
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data.pairs) && data.pairs.length > 0) {
          const pair = data.pairs[0];
          setNewCoin(prev => ({ ...prev, symbol: pair.baseToken.symbol.toUpperCase(), name: pair.baseToken.name || prev.name, fallbackPrice: parseFloat(pair.priceUsd) || prev.fallbackPrice }));
          setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Data Source: DexScreener');
        } else { setFetchStatus('Not found on DexScreener'); }
      }
    } catch (e) { if (e.name !== 'AbortError') setFetchStatus('DexScreener search failed'); } 
    finally { setIsFetchingData(false); setTimeout(() => setFetchStatus(''), 3000); }
  };

  const handleAddCustomCoin = async (e) => {
    e.preventDefault();
    if (!user) return;

    const safeSymbol = sanitizeInput(newCoin.symbol).toUpperCase();
    if (!safeSymbol) {
      addToast("Symbol is required!", 'error');
      return;
    }

    const safeName = sanitizeInput(newCoin.name) || `${safeSymbol} Token`;
    const safeLogoUrl = sanitizeInput(newCoin.logoUrl);
    const fallbackVal = parseFloat(newCoin.fallbackPrice) || 0;

    if (safeLogoUrl && !isSafeUrl(safeLogoUrl)) {
      addToast("Invalid Logo URL. Please provide a valid HTTP/HTTPS link.", 'error');
      return;
    }

    let finalNetwork = null;
    let finalContract = null;
    let finalApiId = newCoin.apiId ? sanitizeInput(newCoin.apiId).toLowerCase() : `cg-${safeSymbol.toLowerCase()}`;

    if (fetchMode === 'contract') {
      const rawContract = sanitizeInput(newCoin.contractAddress);
      if (rawContract) {
        if (!isValidAddress(rawContract, newCoin.network)) {
          addToast(newCoin.network === 'solana' ? "Invalid Solana mint address format" : "Invalid contract address format", 'error');
          return;
        }
        finalContract = rawContract; finalNetwork = newCoin.network;
        finalApiId = normalizeId(`${finalNetwork}-${finalContract}`);
      }
    }

    finalApiId = normalizeId(finalApiId);

    const newCoinObj = { id: finalApiId, symbol: safeSymbol, name: safeName, fallbackPrice: fallbackVal, logo: safeLogoUrl !== '' ? safeLogoUrl : null, color: 'text-purple-500', bg: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20', network: finalNetwork, contractAddress: finalContract, fetchMode: fetchMode };

    try {
      const updated = customUserCoins.filter(c => normalizeId(c.id) !== finalApiId);
      updated.push(newCoinObj);
      await setDoc(doc(db, "users", user.uid), { customCoins: updated }, { merge: true });
      setCustomUserCoins(updated);
      
      if (!activeCoins.includes(finalApiId)) setActiveCoins(prev => [...prev, finalApiId]);
      setIsAddModalOpen(false); setSearchQuery(''); 
      setActiveTab('selected');
      addToast(`${safeSymbol} added to portfolio`, 'success');
    } catch (e) {
      addToast("Failed to save custom token", 'error');
    }
  };

  const handleDeleteToken = (coin) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Token',
      message: `Are you sure you want to remove ${coin.symbol} from your portfolio?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const normId = normalizeId(coin.id);
          const isCustom = customUserCoins.find(c => normalizeId(c.id) === normId);
          if (isCustom) {
            const remainingCustoms = customUserCoins.filter(c => normalizeId(c.id) !== normId);
            await setDoc(doc(db, "users", user.uid), { customCoins: remainingCustoms }, { merge: true });
            setCustomUserCoins(remainingCustoms);
          } else {
            const newHidden = Array.from(new Set([...hiddenTokens.map(normalizeId), normId]));
            await setDoc(doc(db, "users", user.uid), { hiddenTokens: newHidden }, { merge: true });
            setHiddenTokens(newHidden);
          }
          setActiveCoins(prev => prev.filter(identifier => identifier !== normId));
          addToast(`${coin.symbol} removed from portfolio`, 'info');
        } catch (error) {
          addToast("Failed to remove token", 'error');
        }
      }
    });
  };

  const handleClearSearch = () => setSearchQuery('');

  const openAddModal = () => {
    setModalTitle('Add Custom Token'); setFetchMode('contract'); 
    setNewCoin({ apiId: '', network: 'solana', contractAddress: '', symbol: '', name: '', fallbackPrice: '', logoUrl: '' }); 
    setFetchError(null); setFetchStatus(''); setFetchSuccess(false); setIsAddModalOpen(true);
  };

  const closeModal = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort(); 
    setIsAddModalOpen(false); setFetchError(null); setFetchStatus(''); setFetchSuccess(false);
  };

  const handleAddressChange = (e) => {
    const val = sanitizeInput(e.target.value);
    setNewCoin(prev => {
      const updates = { contractAddress: val };
      if (val.startsWith('0x')) { if (prev.network === 'solana') updates.network = 'bsc'; } 
      else if (val.length > 30 && !val.startsWith('0x')) { updates.network = 'solana'; }
      return { ...prev, ...updates };
    });
  };

  useEffect(() => { return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0 min-h-screen">
        
        {showRateLimitBanner && <RateLimitBanner onDismiss={() => setShowRateLimitBanner(false)} />}

        {/* Premium Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-700/50 backdrop-blur-sm">
          <div className="absolute right-[-5%] top-[-20%] opacity-[0.03] text-white blur-[2px] pointer-events-none">
             <FaBitcoin size={250}/>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
          <div className="relative z-10">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)] transition-all hover:scale-105 duration-300">
              <FaBitcoin size={32} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-2">Portfolio Manager</h1>
            <p className="text-sm font-semibold text-slate-400 max-w-xl leading-relaxed">
              Build your personalized crypto portfolio. Track your preferred assets across Vaults, Income Streams, and AI Strategies.
            </p>
          </div>
          <button 
            onClick={openAddModal}
            className="relative z-10 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 text-white px-7 py-4 rounded-2xl font-black text-sm border border-blue-400/20 hover:border-blue-400/40 transition-all active:scale-95 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/20 group"
          >
            <HiOutlinePlus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
            Custom Token
            <span className="ml-2 text-[9px] text-slate-400 font-medium hidden lg:inline-flex items-center gap-1">
              <HiOutlineTerminal size={12} />N
            </span>
          </button>
        </div>

        {/* Premium Tabs Navigation */}
        <div className="flex p-1.5 space-x-1 bg-slate-200/40 dark:bg-slate-800/40 backdrop-blur-md rounded-[1.5rem] w-full md:w-fit mx-auto shadow-inner border border-slate-200/50 dark:border-slate-700/50">
          <button 
            onClick={() => setActiveTab('selected')} 
            className={`relative flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'selected' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md scale-100' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-80'
            }`}
          >
            <HiOutlineCollection size={18} />
            My Assets
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
              activeTab === 'selected' 
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' 
                : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
            }`}>
              {displaySelected.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('market')} 
            className={`relative flex-1 md:flex-none px-6 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === 'market' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md scale-100' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-80'
            }`}
          >
            <HiOutlineSparkles size={18} />
            Explore Market
          </button>
        </div>

        {/* Premium Search Bar */}
        <div className="sticky top-[72px] md:top-4 z-40">
          <div className="relative shadow-2xl shadow-slate-200/20 dark:shadow-none rounded-[2rem]">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
              <HiOutlineSearch size={22} />
            </div>
            <input 
              type="text" 
              placeholder={activeTab === 'selected' ? "Search your assets... (⌘K)" : "Search 250+ tokens in market... (⌘K)"}
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-[2rem] py-5 pl-16 pr-16 text-sm font-bold outline-none text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={handleClearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1"
                aria-label="Clear search"
              >
                <HiOutlineXCircle size={20} />
              </button>
            )}
            {isLoading && (
              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <HiOutlineRefresh className="text-blue-500 animate-spin" size={22} />
              </div>
            )}
          </div>
        </div>

        {/* Premium Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={idx} />)
          ) : currentListToDisplay.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 px-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-28 h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                <HiOutlineCube className="w-14 h-14 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-700 dark:text-slate-200 mb-2 text-center">
                {searchQuery ? 'No tokens found' : (activeTab === 'selected' ? 'Your portfolio is empty' : 'Ready to explore')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-8">
                {searchQuery 
                  ? `We couldn't find "${searchQuery}" in ${activeTab === 'selected' ? 'your assets' : 'the market'}.` 
                  : (activeTab === 'selected' ? "Start by adding tokens from the market or create a custom token." : "Browse the market and click on any token to add it to your portfolio.")}
              </p>
              {activeTab === 'selected' && !searchQuery && (
                <button 
                  onClick={() => setActiveTab('market')}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
                >
                  Browse Market
                </button>
              )}
              {activeTab === 'market' && !searchQuery && (
                <button 
                  onClick={openAddModal}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 active:scale-95"
                >
                  Add Custom Token
                </button>
              )}
            </div>
          ) : (
            currentListToDisplay.map((coin) => {
              const isSelected = activeCoins.includes(coin.id);
              return (
                <div 
                  key={coin.id}
                  onClick={() => toggleCoin(coin.id)} 
                  role="button" 
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCoin(coin.id)}
                  className={`group cursor-pointer relative flex flex-col items-center p-6 rounded-[2rem] border transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-400/50 shadow-xl shadow-blue-500/10 scale-[1.02]' 
                      : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xl hover:-translate-y-1'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50" />
                        <HiOutlineCheckCircle size={22} className="relative text-blue-500" />
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute top-3 left-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20">
                    <Tooltip text="Edit Token" shortcut="E">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClick(e, coin); }} 
                        className="w-8 h-8 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        aria-label={`Edit ${coin.symbol}`}
                      >
                        <HiOutlinePencil size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip text="Hide/Delete Token" shortcut="⌫">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteToken(coin); }} 
                        className="w-8 h-8 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/50 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                        aria-label={`Delete ${coin.symbol}`}
                      >
                        <HiOutlineTrash size={14} />
                      </button>
                    </Tooltip>
                  </div>
                  
                  <div className={`w-16 h-16 rounded-full mb-4 flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${isSelected ? 'ring-4 ring-blue-500/20' : ''}`}>
                    <LogoRenderer 
                      symbol={coin.symbol} 
                      customLogo={coin.logo || getFallbackLogo(coin.symbol, coin.network, coin.contractAddress)} 
                      bg={coin.bg} 
                      color={coin.color} 
                    />
                  </div>
                  <h3 className={`font-black text-base tracking-tight mb-0.5 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {coin.symbol}
                  </h3>
                  {coin.network && (
                     <p className="text-[8px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-1">{coin.network}</p>
                  )}
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-400 truncate w-full text-center px-2">{coin.name}</p>
                  
                  {coin.network && <NetworkBadge network={coin.network} />}
                </div>
              );
            })
          )}
        </div>

        {/* Premium Add/Edit Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
              <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex justify-between items-center">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <FaCoins className="text-white/80" /> 
                  {modalTitle}
                </h3>
                <button 
                  onClick={closeModal}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Close modal"
                >
                  <HiOutlineX size={20}/>
                </button>
              </div>
              
              <form onSubmit={handleAddCustomCoin} className="p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                
                {/* Fetch Mode Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <button 
                    type="button" 
                    onClick={() => setFetchMode('contract')} 
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
                      fetchMode === 'contract' 
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    By Contract
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setFetchMode('id')} 
                    className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
                      fetchMode === 'id' 
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    By CG ID
                  </button>
                </div>

                {/* Fetch Section */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 p-5 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4">
                  
                  {fetchMode === 'contract' ? (
                    <>
                      <select 
                        value={newCoin.network} 
                        onChange={(e) => setNewCoin({...newCoin, network: e.target.value})} 
                        className="w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 text-sm cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                      >
                        {SUPPORTED_NETWORKS.map(net => (
                          <option key={net.id} value={net.id}>
                            {net.id === 'solana' && '☀️ '}{net.name}
                          </option>
                        ))}
                      </select>
                      
                      {/* Network hint */}
                      {newCoin.network === 'solana' && (
                        <div className="flex items-center gap-2 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                          <HiOutlineSun size={14} />
                          <span>Solana uses mint addresses (base58 format, 32-44 chars)</span>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder={getAddressPlaceholder(newCoin.network)} 
                          value={newCoin.contractAddress} 
                          onChange={handleAddressChange} 
                          className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-mono text-xs text-slate-900 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                        <button 
                          type="button" 
                          onClick={handleAutoFetchDetails} 
                          disabled={isFetchingData} 
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px] shadow-md"
                          aria-label="Fetch token details"
                        >
                          {isFetchingData ? (
                            <HiOutlineRefresh className="animate-spin" size={18}/>
                          ) : (
                            <HiOutlineCloudDownload size={18}/>
                          )}
                        </button>
                      </div>
                      
                      {/* Explorer link */}
                      {newCoin.contractAddress && isValidAddress(newCoin.contractAddress, newCoin.network) && (
                        <a
                          href={getExplorerUrl(newCoin.network, newCoin.contractAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <HiOutlineExternalLink size={12} />
                          View on {newCoin.network === 'solana' ? 'Solscan' : 'Explorer'}
                        </a>
                      )}
                      
                      {/* Solana alternative sources */}
                      {newCoin.network === 'solana' && newCoin.contractAddress && !isFetchingData && !fetchSuccess && (
                        <div className="pt-2 border-t border-blue-200 dark:border-blue-700/50 mt-2">
                          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2">Token not found? Try alternative sources:</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={searchDexScreener}
                              className="flex-1 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              DexScreener
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFetchError(null);
                                setFetchStatus('');
                              }}
                              className="flex-1 py-2 px-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                            >
                              Enter Manually
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="CoinGecko ID (e.g. bitcoin)" 
                        value={newCoin.apiId} 
                        onChange={(e) => setNewCoin({...newCoin, apiId: e.target.value})} 
                        className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-sm text-slate-900 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      />
                      <button 
                        type="button" 
                        onClick={handleAutoFetchDetails} 
                        disabled={isFetchingData} 
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px] shadow-md"
                        aria-label="Fetch token details"
                      >
                        {isFetchingData ? (
                          <HiOutlineRefresh className="animate-spin" size={18}/>
                        ) : (
                          <HiOutlineCloudDownload size={18}/>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* Status display */}
                  {fetchStatus && (
                    <p className={`text-xs font-medium flex items-center gap-1 mt-2 ${
                      fetchSuccess ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {!fetchSuccess && <HiOutlineRefresh className="animate-spin" size={12} />}
                      {fetchSuccess && <HiOutlineCheckCircle size={12} />}
                      {fetchStatus}
                    </p>
                  )}
                  
                  {/* Error display */}
                  {fetchError && (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-1 mt-2">
                      <HiOutlineExclamation className="flex-shrink-0 mt-0.5" size={14} /> 
                      <span>{fetchError}</span>
                    </p>
                  )}
                  
                </div>

                {/* Manual Entry Fields */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Symbol *</label>
                    <input 
                      type="text" 
                      required 
                      value={newCoin.symbol} 
                      onChange={(e) => setNewCoin({...newCoin, symbol: e.target.value.toUpperCase()})} 
                      disabled={modalTitle.includes("Edit")} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      placeholder="BTC"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Price ($)</label>
                    <input 
                      type="number" 
                      step="any" 
                      min="0"
                      value={newCoin.fallbackPrice} 
                      onChange={(e) => setNewCoin({...newCoin, fallbackPrice: e.target.value})} 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={newCoin.name} 
                    onChange={(e) => setNewCoin({...newCoin, name: e.target.value})} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600"
                    placeholder="Bitcoin"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <HiOutlinePhotograph /> Logo URL
                  </label>
                  <div className="relative flex items-center gap-3">
                    <input 
                      type="url" 
                      value={newCoin.logoUrl} 
                      onChange={(e) => setNewCoin({...newCoin, logoUrl: e.target.value})} 
                      placeholder="https://example.com/logo.png" 
                      className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 text-xs transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                    />
                    {newCoin.logoUrl ? (
                      <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                        <img 
                          src={newCoin.logoUrl} 
                          alt="Preview" 
                          className="w-full h-full object-contain" 
                          onError={(e) => e.target.style.display = 'none'} 
                        />
                      </div>
                    ) : newCoin.symbol && (
                      <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                        <LogoRenderer 
                          symbol={newCoin.symbol} 
                          customLogo={null} 
                          bg="bg-gradient-to-br from-purple-500/20 to-pink-500/20" 
                          color="text-purple-500" 
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-1 mt-1">
                    Leave empty for auto-generated avatar.
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="w-full p-5 mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-600/20 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  {modalTitle.includes('Edit') ? 'Update Token' : 'Add Token to Portfolio'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Premium Floating Save Button */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
          <button 
            onClick={handleSave} 
            disabled={isSaving || activeCoins.length === 0} 
            className={`w-full px-10 py-5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-10 flex items-center justify-center gap-3 border border-blue-400/50 ${
              !isSaving && activeCoins.length > 0 ? 'animate-pulse hover:animate-none' : ''
            }`}
          >
            {isSaving ? (
              <><HiOutlineRefresh className="animate-spin" size={20}/> SYNCING...</>
            ) : (
              <><HiOutlineCheckCircle size={20}/> SAVE {activeCoins.length} ASSET{activeCoins.length !== 1 ? 'S' : ''}</>
            )}
          </button>
        </div>

      </div>

      {/* Premium Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </>
  );
};

// Wrap with ToastProvider
const CryptoManager = () => (
  <ToastProvider>
    <CryptoManagerContent />
  </ToastProvider>
);

export default CryptoManager;