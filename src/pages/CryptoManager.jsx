import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, HiOutlineCheckCircle, HiOutlinePlus, HiOutlineX, 
  HiOutlineTrash, HiOutlinePencil, HiOutlineCloudDownload, HiOutlineRefresh, 
  HiOutlinePhotograph, HiOutlineXCircle, HiOutlineCube, HiOutlineExclamation,
  HiOutlineSun, HiOutlineExternalLink, HiOutlineCollection, HiOutlineSparkles,
  HiOutlineExclamationCircle, HiOutlineInformationCircle, HiOutlineTerminal,
  HiOutlineClock, HiOutlineArrowUp, HiOutlineArrowDown
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
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, duration);
  }, []);
  const removeToast = useCallback((id) => { setToasts(prev => prev.filter(t => t.id !== id)); }, []);
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map((toast, index) => (
          <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${
            toast.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700' :
            toast.type === 'error' ? 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700' :
            toast.type === 'warning' ? 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700' :
            'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
          }`} style={{ zIndex: 10000 + index }}>
            {toast.type === 'success' && <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'warning' && <HiOutlineExclamation className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><HiOutlineX size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => { const context = React.useContext(ToastContext); if (!context) throw new Error('useToast must be used within ToastProvider'); return context; };

// ============================================
// 🚀 PREMIUM CONFIRMATION MODAL
// ============================================

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className={`p-6 ${type === 'danger' ? 'bg-gradient-to-r from-red-600 to-red-500' : type === 'warning' ? 'bg-gradient-to-r from-amber-600 to-amber-500' : 'bg-gradient-to-r from-blue-600 to-blue-500'}`}>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
            {type === 'danger' ? <HiOutlineExclamationCircle className="text-white" size={28} /> : type === 'warning' ? <HiOutlineExclamation className="text-white" size={28} /> : <HiOutlineInformationCircle className="text-white" size={28} />}
          </div>
          <h3 className="text-xl font-black text-white">{title}</h3>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors">{cancelText}</button>
            <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white transition-colors ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : type === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 🚀 CONSTANTS & CONFIG (CLEANED SCAM COINS)
// ============================================

const COINMARKETCAP_API_KEY = import.meta.env.VITE_CMC_API_KEY || '0f7b7c97-bd3e-45fd-9134-8ab57c70e3a8';
const MAX_COINS_TO_DISPLAY = 500; 

const SUPPORTED_NETWORKS = [
  { id: 'solana', name: 'Solana' },
  { id: 'bsc', name: 'BNB Smart Chain' },
  { id: 'eth', name: 'Ethereum' },
  { id: 'polygon_pos', name: 'Polygon POS' },
  { id: 'arbitrum', name: 'Arbitrum One' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' }
];

const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin', logo: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png' }
];

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

const normalizeId = (id) => String(id || '').toLowerCase().trim();

const normalizeSymbol = (symbol) => {
  if (!symbol) return '';
  return symbol.toUpperCase()
    .replace(/[^A-Z0-9]/g, '') 
    .replace(/^WETH$/, 'ETH')
    .replace(/^WBTC$/, 'BTC')
    .replace(/^WMATIC$/, 'MATIC')
    .trim();
};

const normalizeName = (name) => {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/wrapped\s+/i, '')
    .replace(/\s+token$/i, '')
    .replace(/\s+coin$/i, '')
    .trim();
};

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
        const res = { symbol: pair.baseToken.symbol, name: pair.baseToken.name || pair.baseToken.symbol, logoUrl: pair.info?.imageUrl || null, source: 'DexScreener' };
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
    solana: `https://solscan.io/token/${address}`, 
    eth: `https://etherscan.io/token/${address}`,
    bsc: `https://bscscan.com/token/${address}`, 
    polygon_pos: `https://polygonscan.com/token/${address}`,
    arbitrum: `https://arbiscan.io/token/${address}`, 
    optimism: `https://optimistic.etherscan.io/token/${address}`,
    base: `https://basescan.org/token/${address}`
  };
  return explorers[network] || null;
};

// ============================================
// 🚀 API FETCHING FUNCTIONS
// ============================================

const fetchCoinGeckoCoins = async (page = 1, perPage = 250) => {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=1h,24h`;
    const res = await fetchWithRetry(url);
    
    if (res && res.ok) {
      const data = await res.json();
      return data.map(coin => ({
        id: normalizeId(coin.id),
        originalId: coin.id,
        symbol: (coin.symbol || '').toUpperCase(),
        name: coin.name || coin.symbol || '',
        normalizedSymbol: normalizeSymbol(coin.symbol),
        normalizedName: normalizeName(coin.name),
        current_price: coin.current_price || 0,
        image: coin.image || null,
        price_change_percentage_24h: coin.price_change_percentage_24h || 0,
        market_cap: coin.market_cap || 0,
        market_cap_rank: coin.market_cap_rank || 999999,
        total_volume: coin.total_volume || 0,
        source: 'coingecko',
        sourceIcon: '🦎',
        price_accuracy: 'high'
      }));
    }
    return [];
  } catch (err) { return []; }
};

const fetchCoinMarketCapCoins = async (limit = 300) => {
  try {
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${limit}&sort=market_cap&sort_dir=desc&convert=USD`,
      {
        headers: {
          'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    if (res && res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(coin => ({
          id: normalizeId(coin.slug || coin.symbol),
          originalId: coin.slug || coin.symbol,
          symbol: (coin.symbol || '').toUpperCase(),
          name: coin.name || coin.symbol || '',
          normalizedSymbol: normalizeSymbol(coin.symbol),
          normalizedName: normalizeName(coin.name),
          current_price: coin.quote?.USD?.price || 0,
          image: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
          price_change_percentage_24h: coin.quote?.USD?.percent_change_24h || 0,
          market_cap: coin.quote?.USD?.market_cap || 0,
          market_cap_rank: coin.cmc_rank || 999999,
          total_volume: coin.quote?.USD?.volume_24h || 0,
          source: 'coinmarketcap',
          sourceIcon: '📊',
          price_accuracy: 'high'
        }));
      }
    }
    return [];
  } catch (err) { return []; }
};

const fetchCoinCapCoins = async (limit = 100) => {
  try {
    const res = await fetch(`https://api.coincap.io/v2/assets?limit=${limit}`);
    if (res && res.ok) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(coin => ({
          id: normalizeId(coin.id || coin.symbol),
          originalId: coin.id,
          symbol: (coin.symbol || '').toUpperCase(),
          name: coin.name || coin.symbol || '',
          normalizedSymbol: normalizeSymbol(coin.symbol),
          normalizedName: normalizeName(coin.name),
          current_price: parseFloat(coin.priceUsd) || 0,
          image: `https://assets.coincap.io/assets/icons/${coin.symbol?.toLowerCase()}@2x.png`,
          price_change_percentage_24h: parseFloat(coin.changePercent24Hr) || 0,
          market_cap: parseFloat(coin.marketCapUsd) || 0,
          market_cap_rank: parseInt(coin.rank) || 999999,
          total_volume: parseFloat(coin.volumeUsd24Hr) || 0,
          source: 'coincap',
          sourceIcon: '🪙',
          price_accuracy: 'medium'
        }));
      }
    }
    return [];
  } catch (err) { return []; }
};

const deduplicateCoins = (allCoins) => {
  const coinMap = new Map();
  const sortedCoins = allCoins.sort((a, b) => {
    const priorityOrder = { coingecko: 1, coinmarketcap: 2, coincap: 3 };
    const priorityDiff = (priorityOrder[a.source] || 99) - (priorityOrder[b.source] || 99);
    if (priorityDiff !== 0) return priorityDiff;
    return (a.market_cap_rank || 999999) - (b.market_cap_rank || 999999);
  });
  
  sortedCoins.forEach(coin => {
    if (!coin.symbol || coin.symbol === 'UNKNOWN') return;
    const compositeKey = `${coin.normalizedSymbol}_${coin.normalizedName}`;
    let isDuplicate = false;
    
    if (coinMap.has(compositeKey)) isDuplicate = true;
    
    if (!isDuplicate) {
      for (const [key, existing] of coinMap) {
        if (existing.normalizedSymbol === coin.normalizedSymbol && existing.normalizedName !== coin.normalizedName) {
          if ((existing.market_cap_rank || 999999) <= (coin.market_cap_rank || 999999)) {
            isDuplicate = true; break;
          } else { coinMap.delete(key); break; }
        }
      }
    }
    
    if (!isDuplicate) {
      for (const [key, existing] of coinMap) {
        if (existing.normalizedName === coin.normalizedName && existing.normalizedSymbol !== coin.normalizedSymbol) {
          const priorityOrder = { coingecko: 1, coinmarketcap: 2, coincap: 3 };
          if ((priorityOrder[existing.source] || 99) <= (priorityOrder[coin.source] || 99)) {
            isDuplicate = true; break;
          } else { coinMap.delete(key); break; }
        }
      }
    }
    if (!isDuplicate) coinMap.set(compositeKey, coin);
  });
  
  return Array.from(coinMap.values())
    .sort((a, b) => (a.market_cap_rank || 999999) - (b.market_cap_rank || 999999))
    .slice(0, MAX_COINS_TO_DISPLAY);
};

// ============================================
// 🚀 COMPONENTS
// ============================================

const LogoRenderer = ({ symbol, customLogo, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(customLogo || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const symbolUpper = (symbol || '').toUpperCase();

  useEffect(() => {
    if (customLogo) { setImgSrc(customLogo); setHasError(false); setIsLoaded(false); }
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
      {!isLoaded && <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />}
      <img 
        src={imgSrc} 
        alt={symbolUpper} 
        className={`w-full h-full object-contain rounded-full relative z-10 bg-transparent border-2 border-white/20 dark:border-slate-700 shadow-md p-[2px] transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy" 
        onLoad={() => setIsLoaded(true)}
        onError={() => { setImgSrc(generateSolanaLogoUrl(null, symbolUpper)); setHasError(true); }} 
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
      {shortcut && <span className="flex items-center gap-0.5 text-[9px] text-slate-300"><HiOutlineTerminal size={10} />{shortcut}</span>}
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
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">One of the sources is rate limited. Using data from other sources...</p>
        </div>
        <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-1"><HiOutlineX size={18} /></button>
      </div>
    </div>
  );
};

const SourceBadge = ({ source, sourceIcon }) => {
  const colors = {
    coingecko: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400',
    coinmarketcap: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    coincap: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    custom: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
  };
  return (
    <span className={`absolute top-1 right-1 text-[8px] px-1 py-0.5 rounded-md font-black ${colors[source] || 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
      {sourceIcon}
    </span>
  );
};

const PriceBadge = ({ price, change24h }) => {
  const isPositive = change24h >= 0;
  if (!price && price !== 0) return null;
  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-16px)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg py-1 px-2 opacity-0 group-hover/card:opacity-100 transition-all duration-300 shadow-lg border border-slate-200/50 dark:border-slate-700/50 z-10">
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 leading-tight">
            ${typeof price === 'number' ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '0.00'}
          </span>
          {change24h !== 0 && (
            <span className={`text-[9px] font-bold flex items-center gap-0.5 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <HiOutlineArrowUp size={10} /> : <HiOutlineArrowDown size={10} />}
              {Math.abs(change24h).toFixed(2)}%
            </span>
          )}
        </div>
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
// 🚀 MAIN COMPONENT
// ============================================

const CryptoManagerContent = () => {
  const { user, selectedCryptos = [], updateSelectedCryptos } = useAuth();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('market');
  const [activeCoins, setActiveCoins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [topCoins, setTopCoins] = useState([]);
  const [customUserCoins, setCustomUserCoins] = useState([]);
  const [hiddenTokens, setHiddenTokens] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [dataSources, setDataSources] = useState({ coingecko: false, coinmarketcap: false, coincap: false });
  const [fetchProgress, setFetchProgress] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Add Custom Token');
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchStatus, setFetchStatus] = useState('');
  const [showRateLimitBanner, setShowRateLimitBanner] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  const [fetchMode, setFetchMode] = useState('contract');
  const [editingOriginalId, setEditingOriginalId] = useState(null);

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
    if (selectedCryptos && selectedCryptos.length > 0 && activeCoins.length === 0) {
      const identifiers = selectedCryptos.map(c => typeof c === 'string' ? normalizeId(c) : normalizeId(c.id || c.symbol));
      setActiveCoins(Array.from(new Set(identifiers.filter(Boolean))));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCryptos]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); document.querySelector('input[type="text"]')?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); if (!isAddModalOpen) openAddModal(); }
      if (e.key === 'Escape' && isAddModalOpen) { closeModal(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

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
      } catch (err) {} finally { if (isMounted) setIsLoading(false); }
    };
    fetchUserData();
    return () => { isMounted = false; };
  }, [user]);

  // Fetch the Top 500 Market Coins
  useEffect(() => {
    let isMounted = true;
    const fetchAllCoins = async () => {
      setFetchProgress('Checking cache...');
      const cachedData = getCache('finledger_top_coins_v4');
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 200) { 
        if (isMounted) {
          setTopCoins(cachedData);
          setDataSources({ coingecko: true, coinmarketcap: true, coincap: true });
          setFetchProgress(`Loaded ${cachedData.length} coins from cache`);
          setTimeout(() => setFetchProgress(''), 2000);
        }
        return; 
      }

      let allCoins = [];
      const sources = { coingecko: false, coinmarketcap: false, coincap: false };
      
      try {
        setFetchProgress('Fetching from CoinGecko (Page 1)...');
        const cgCoins1 = await fetchCoinGeckoCoins(1, 250);
        if (cgCoins1.length > 0) { allCoins = [...allCoins, ...cgCoins1]; sources.coingecko = true; }
        
        setFetchProgress('Fetching from CoinGecko (Page 2)...');
        const cgCoins2 = await fetchCoinGeckoCoins(2, 250);
        if (cgCoins2.length > 0) { allCoins = [...allCoins, ...cgCoins2]; }
        
        setFetchProgress('Fetching from CoinMarketCap...');
        const cmcCoins = await fetchCoinMarketCapCoins(300);
        if (cmcCoins.length > 0) { allCoins = [...allCoins, ...cmcCoins]; sources.coinmarketcap = true; }
        
        setFetchProgress('Fetching from CoinCap...');
        const ccCoins = await fetchCoinCapCoins(100);
        if (ccCoins.length > 0) { allCoins = [...allCoins, ...ccCoins]; sources.coincap = true; }
        
        setFetchProgress(`Deduplicating ${allCoins.length} coins...`);
        const uniqueCoins = deduplicateCoins(allCoins);
        
        if (isMounted) {
          setTopCoins(uniqueCoins);
          setDataSources(sources);
          setCache('finledger_top_coins_v4', uniqueCoins, 120);
          setFetchProgress(`✅ ${uniqueCoins.length} unique coins`);
          setTimeout(() => setFetchProgress(''), 5000);
        }
      } catch (err) {
        setFetchProgress('Some sources failed');
        if (allCoins.length > 0 && isMounted) setTopCoins(deduplicateCoins(allCoins));
      }
    };
    fetchAllCoins();
    return () => { isMounted = false; };
  }, []);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    
    topCoins.forEach(c => {
      if (!c?.id || !c?.symbol) return;
      coinMap.set(c.id, {
        id: c.id, symbol: c.symbol, name: c.name || c.symbol, logo: c.image || null, fallbackPrice: c.current_price || 0,
        priceChange24h: c.price_change_percentage_24h || 0, marketCapRank: c.market_cap_rank, bg: 'bg-gradient-to-br from-slate-700 to-slate-800',
        color: 'text-white', network: null, contractAddress: null, source: c.source || 'unknown', sourceIcon: c.sourceIcon || ''
      });
    });

    customUserCoins.forEach(c => {
      const normalizedId = normalizeId(c.id || c.symbol);
      if (!coinMap.has(normalizedId)) {
        coinMap.set(normalizedId, {
          id: normalizedId, symbol: c.symbol?.toUpperCase() || '???', name: c.name || c.symbol || 'Custom', logo: c.logo || null,
          fallbackPrice: c.fallbackPrice || 0, priceChange24h: 0, marketCapRank: 999999, bg: c.bg || 'bg-gradient-to-br from-purple-500/20 to-pink-500/20',
          color: c.color || 'text-purple-500', network: c.network || null, contractAddress: c.contractAddress || null, source: 'custom', sourceIcon: '⭐',
          fetchMode: c.fetchMode || (c.contractAddress ? 'contract' : 'id')
        });
      }
    });

    selectedCryptos?.forEach(c => {
      if (!c) return;
      const normalizedId = normalizeId(typeof c === 'string' ? c : c.id || c.symbol);
      if (!coinMap.has(normalizedId)) {
        coinMap.set(normalizedId, {
          id: normalizedId, symbol: (typeof c === 'string' ? c : c.symbol)?.toUpperCase() || '???', name: typeof c === 'string' ? c : (c.name || c.symbol || 'Unknown'),
          logo: typeof c === 'string' ? null : c.logo, fallbackPrice: typeof c === 'string' ? 0 : (c.fallbackPrice || 0), priceChange24h: 0, marketCapRank: 999999,
          bg: 'bg-gradient-to-br from-slate-700 to-slate-800', color: 'text-white', network: typeof c === 'string' ? null : c.network, contractAddress: typeof c === 'string' ? null : c.contractAddress, source: 'saved', sourceIcon: '💾',
          fetchMode: (typeof c !== 'string' && c.contractAddress) ? 'contract' : 'id'
        });
      }
    });

    return Array.from(coinMap.values());
  }, [topCoins, customUserCoins, selectedCryptos]);

  // 🚀 FIXED: True 5-Layer Live Fetch Engine for CryptoManager Grid
  useEffect(() => {
    if (activeCoins.length === 0) return;
    let isMounted = true;

    const updatePrices = async () => {
      const coinsToUpdate = activeCoins.filter(id => !getCache(`price_live_${id}`));
      if (coinsToUpdate.length === 0) return;

      try {
        let cgJson = {};
        const normalCoins = [];
        const contractCoins = [];

        coinsToUpdate.forEach(id => {
          const dbCoin = fullDatabase.find(c => c.id === id) || { id, symbol: id.toUpperCase() };
          if (dbCoin.fetchMode === 'contract' && dbCoin.contractAddress) {
             contractCoins.push(dbCoin);
          } else {
             normalCoins.push(id);
          }
        });

        // 1. CoinGecko (Layer 1)
        if (normalCoins.length > 0) {
          const batches = [];
          for (let i = 0; i < normalCoins.length; i += 50) batches.push(normalCoins.slice(i, i + 50));
          for (const batch of batches) {
            const res = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${batch.join(',')}&vs_currencies=usd&include_24hr_change=true`);
            if (res && res.ok) {
              const data = await res.json();
              cgJson = { ...cgJson, ...data };
            }
          }
        }

        // 2 & 3. GeckoTerminal & DexScreener (Layer 2 & 3)
        let customApiJson = {};
        await Promise.all(contractCoins.map(async (coin) => {
          try {
              const network = coin.network || 'bsc';
              const gtRes = await fetchWithRetry(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${coin.contractAddress}`);
              if (gtRes && gtRes.ok) {
                  const gtData = await gtRes.json();
                  customApiJson[coin.id] = {
                      usd: parseFloat(gtData?.data?.attributes?.price_usd || 0),
                      usd_24h_change: parseFloat(gtData?.data?.attributes?.price_change_percentage?.h24 || 0)
                  };
              } else {
                  const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${coin.contractAddress}`);
                  if (dexRes && dexRes.ok) {
                      const dexData = await dexRes.json();
                      if (dexData.pairs?.length > 0) {
                          customApiJson[coin.id] = {
                              usd: parseFloat(dexData.pairs[0].priceUsd || 0),
                              usd_24h_change: parseFloat(dexData.pairs[0].priceChange?.h24 || 0)
                          };
                      }
                  }
              }
          } catch(e) {}
        }));

        if (isMounted) {
          const newPrices = {};
          
          await Promise.all(coinsToUpdate.map(async (id) => {
            const dbCoin = fullDatabase.find(c => c.id === id) || { id, symbol: id.toUpperCase() };
            const upperSym = dbCoin.symbol.toUpperCase();
            
            let price = 0;
            let change = 0;

            if (customApiJson[id] && customApiJson[id].usd > 0) {
              price = customApiJson[id].usd;
              change = customApiJson[id].usd_24h_change;
            } else if (cgJson[id] && cgJson[id].usd > 0) {
              price = cgJson[id].usd;
              change = cgJson[id].usd_24h_change;
            } else if (BINANCE_SAFE_COINS.includes(upperSym)) {
              // 4. Binance Rescue (Layer 4)
              try {
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${upperSym}USDT`);
                if (bRes.ok) {
                  const bData = await bRes.json();
                  price = parseFloat(bData.lastPrice);
                  change = parseFloat(bData.priceChangePercent);
                }
              } catch(e) {}
            }

            if (price > 0) {
              newPrices[id] = { usd: price, usd_24h_change: change };
              setCache(`price_live_${id}`, { usd: price, usd_24h_change: change }, 0.5); // Cache for 30s
            }
          }));

          setLivePrices(prev => ({ ...prev, ...newPrices }));
        }
      } catch (err) {}
    };

    updatePrices();
    const interval = setInterval(updatePrices, 60000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [activeCoins, fullDatabase]);

  const { displaySelected, displayAvailable } = useMemo(() => {
    const activeSet = new Set(activeCoins);
    const hiddenSet = new Set(hiddenTokens.map(normalizeId));
    const query = debouncedSearch.toLowerCase().trim();
    
    const selected = [];
    const available = [];

    for (const coin of fullDatabase) {
      if (hiddenSet.has(coin.id)) continue;
      if (query) {
        const symbolMatch = coin.symbol.toLowerCase().includes(query);
        const nameMatch = coin.name.toLowerCase().includes(query);
        if (!symbolMatch && !nameMatch) continue;
      }
      if (activeSet.has(coin.id)) selected.push(coin);
      else available.push(coin);
    }

    selected.sort((a, b) => (a.marketCapRank || 999999) - (b.marketCapRank || 999999));
    available.sort((a, b) => (a.marketCapRank || 999999) - (b.marketCapRank || 999999));

    return { displaySelected: selected, displayAvailable: available };
  }, [fullDatabase, debouncedSearch, hiddenTokens, activeCoins]);

  const currentListToDisplay = activeTab === 'selected' ? displaySelected : displayAvailable;

  const toggleCoin = useCallback((identifier) => {
    const normId = normalizeId(identifier);
    setActiveCoins((prev) => {
      const isRemoving = prev.includes(normId);
      const newSelection = isRemoving ? prev.filter(c => c !== normId) : [...prev, normId];
      
      if (!isRemoving && hiddenTokens.includes(normId)) {
        const newHidden = hiddenTokens.filter(id => id !== normId);
        setHiddenTokens(newHidden);
        if (user) setDoc(doc(db, "users", user.uid), { hiddenTokens: newHidden }, { merge: true });
      }

      const coin = fullDatabase.find(c => c.id === normId);
      if (coin && !isRemoving) addToast(`➕ ${coin.symbol} added to selection`, 'success', 2000);
      return newSelection;
    });
  }, [fullDatabase, hiddenTokens, user, addToast]);

  const syncContextPortfolio = useCallback(async (coinsList, addedCoin = null) => {
    if (!updateSelectedCryptos) return;
    const enrichedSelection = coinsList.map(identifier => {
      const normId = normalizeId(identifier);
      if (addedCoin && normId === addedCoin.id) return addedCoin;

      const coinData = fullDatabase.find(c => c.id === normId) || {};
      const livePrice = livePrices[normId];
      return {
        id: normId, symbol: coinData.symbol || identifier.toUpperCase(), name: coinData.name || coinData.symbol || identifier,
        logo: coinData.logo || null, fallbackPrice: coinData.fallbackPrice || 0, currentPrice: livePrice?.usd || coinData.fallbackPrice || 0,
        priceChange24h: livePrice?.usd_24h_change || coinData.priceChange24h || 0, lastUpdated: new Date().toISOString(), network: coinData.network || null,
        contractAddress: coinData.contractAddress || null, source: coinData.source || 'unknown'
      };
    });
    await updateSelectedCryptos(enrichedSelection);
  }, [fullDatabase, livePrices, updateSelectedCryptos]);

  const handleSave = useCallback(async () => {
    if (activeCoins.length === 0) { addToast('Please select at least one asset', 'warning'); return; }
    setIsSaving(true);
    
    try {
      await syncContextPortfolio(activeCoins);
      addToast(`✅ Portfolio saved with ${activeCoins.length} assets`, 'success');
      setTimeout(() => navigate('/dashboard'), 600);
    } catch (error) { 
      addToast('Failed to save portfolio. Please try again.', 'error'); 
    } 
    finally { setIsSaving(false); }
  }, [activeCoins, syncContextPortfolio, addToast, navigate]);

  const loadSavedPortfolio = useCallback(() => {
    if (!selectedCryptos?.length) { addToast('No saved portfolio found', 'info'); return; }
    const identifiers = selectedCryptos.map(c => typeof c === 'string' ? normalizeId(c) : normalizeId(c.id || c.symbol));
    setActiveCoins(Array.from(new Set(identifiers.filter(Boolean))));
    setActiveTab('selected');
    addToast(`📂 Restored ${identifiers.length} assets`, 'success');
  }, [selectedCryptos, addToast]);

  const handleEditClick = (e, coin) => {
    e.stopPropagation();
    setModalTitle(`Edit Token: ${coin.symbol}`);
    setEditingOriginalId(coin.id); 
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
          if (res?.status === 429) { setFetchError("Rate limit reached. Try again in a minute."); setShowRateLimitBanner(true); } 
          else { setFetchError("CoinGecko ID not found. Check spelling or try Contract mode."); }
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

        if (!isValidAddress(address, currentNetwork)) {
          setFetchError(currentNetwork === 'solana' ? "Invalid Solana mint address format (32-44 base58 chars)" : "Invalid contract address (0x... 40 hex chars)");
          setIsFetchingData(false); setFetchStatus(''); return;
        }
        
        if (currentNetwork === 'solana') {
          setFetchStatus('Searching Solana registries...');
          const solanaMetadata = await fetchSolanaTokenMetadata(address, signal);
          
          if (solanaMetadata) {
            const price = await fetchSolanaTokenPrice(address, signal);
            setNewCoin(prev => ({
              ...prev, symbol: solanaMetadata.symbol.toUpperCase(), name: solanaMetadata.name, fallbackPrice: price || prev.fallbackPrice || 0,
              logoUrl: solanaMetadata.logoUrl || getFallbackLogo(solanaMetadata.symbol, currentNetwork, address), apiId: `sol-${address.substring(0, 8)}`
            }));
            setFetchError(null); setFetchSuccess(true); setFetchStatus(`✓ Data: ${solanaMetadata.source}`);
          } else {
            const friendlySymbol = newCoin.symbol || 'TOKEN';
            setNewCoin(prev => ({
              ...prev, symbol: prev.symbol || friendlySymbol, name: prev.name || `Token ${address.substring(0, 4)}...${address.slice(-4)}`,
              logoUrl: prev.logoUrl || generateSolanaLogoUrl(address, friendlySymbol), apiId: `sol-${address.substring(0, 8)}`, fallbackPrice: prev.fallbackPrice || 0
            }));
            setFetchError('Token not found in public registries. Enter details manually.');
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
          if (res?.status === 429) { setFetchError("Rate limit reached."); } else { setFetchError("Contract not found. Enter details manually."); }
          setNewCoin(prev => ({ ...prev, logoUrl: fallbackLogo }));
          setIsFetchingData(false); setFetchStatus(''); return;
        }
        
        const json = await res.json();
        const data = json.data.attributes;
        const formattedData = { symbol: data.symbol.toUpperCase(), name: data.name, fallbackPrice: data.price_usd || newCoin.fallbackPrice, logoUrl: data.image_url || fallbackLogo, apiId: `${currentNetwork}-${address.substring(0,6)}` };
        setNewCoin(prev => ({ ...prev, ...formattedData }));
        setCache(cacheKey, formattedData, 30); 
        setFetchError(null); setFetchSuccess(true); setFetchStatus('✓ Data: GeckoTerminal');
      }
    } catch (err) {
      if (err.name === 'AbortError') return; 
      setFetchError("Network error. Enter details manually."); 
    } finally {
      setIsFetchingData(false);
      if (currentNetwork !== 'solana') { setTimeout(() => setFetchStatus(''), 3000); }
    }
  };

  const handleAddCustomCoin = async (e) => {
    e.preventDefault();
    if (!user) return;

    const safeSymbol = sanitizeInput(newCoin.symbol).toUpperCase();
    if (!safeSymbol) { addToast("Symbol is required!", 'error'); return; }

    const safeName = sanitizeInput(newCoin.name) || `${safeSymbol} Token`;
    const safeLogoUrl = sanitizeInput(newCoin.logoUrl);
    const fallbackVal = parseFloat(newCoin.fallbackPrice) || 0;

    if (safeLogoUrl && !isSafeUrl(safeLogoUrl)) { addToast("Invalid Logo URL. Use valid HTTP/HTTPS link.", 'error'); return; }

    let finalNetwork = null;
    let finalContract = null;
    let finalId;

    if (fetchMode === 'contract') {
      const rawContract = sanitizeInput(newCoin.contractAddress);
      if (rawContract) {
        if (!isValidAddress(rawContract, newCoin.network)) { addToast(newCoin.network === 'solana' ? "Invalid Solana mint address" : "Invalid contract address", 'error'); return; }
        finalContract = rawContract; finalNetwork = newCoin.network;
        finalId = normalizeId(`${finalNetwork}-${finalContract}`);
      } else { finalId = normalizeId(newCoin.apiId || `custom-${safeSymbol.toLowerCase()}`); }
    } else { finalId = normalizeId(newCoin.apiId || `custom-${safeSymbol.toLowerCase()}`); }

    const isEditing = editingOriginalId && editingOriginalId !== finalId;
    const isHidden = hiddenTokens.includes(finalId);

    if (isHidden) {
      const newHidden = hiddenTokens.filter(id => id !== finalId);
      setHiddenTokens(newHidden);
      await setDoc(doc(db, "users", user.uid), { hiddenTokens: newHidden }, { merge: true });
      
      let newActiveCoins = [...activeCoins];
      if (!newActiveCoins.includes(finalId)) newActiveCoins.push(finalId);
      setActiveCoins(newActiveCoins);
      
      await syncContextPortfolio(newActiveCoins);
      addToast(`♻️ ${safeSymbol} restored from recycle bin!`, 'success');
      closeModal();
      return; 
    }

    if (!editingOriginalId || isEditing) {
      if (activeCoins.includes(finalId)) { 
        addToast(`⚠️ ${safeSymbol} already in your selection!`, 'warning'); 
        return; 
      }
      
      const existsInDB = fullDatabase.find(c => c.id === finalId);
      if (existsInDB && !isEditing) {
        const newActiveCoins = [...activeCoins, finalId];
        setActiveCoins(newActiveCoins);
        await syncContextPortfolio(newActiveCoins);
        addToast(`✅ ${safeSymbol} found in database & added to selection!`, 'success');
        closeModal();
        return;
      }
    }

    const newCoinObj = {
      id: finalId, symbol: safeSymbol, name: safeName, fallbackPrice: fallbackVal, logo: safeLogoUrl || null,
      color: 'text-purple-500', bg: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20', network: finalNetwork, contractAddress: finalContract, fetchMode: fetchMode
    };

    try {
      const updated = customUserCoins.filter(c => normalizeId(c.id) !== (editingOriginalId || finalId));
      updated.push(newCoinObj);
      await setDoc(doc(db, "users", user.uid), { customCoins: updated }, { merge: true });
      setCustomUserCoins(updated);
      
      let newActiveCoins = [...activeCoins];
      if (editingOriginalId && editingOriginalId !== finalId) {
        newActiveCoins = newActiveCoins.filter(id => id !== editingOriginalId);
        newActiveCoins.push(finalId);
      } else if (!newActiveCoins.includes(finalId)) {
        newActiveCoins.push(finalId);
      }
      setActiveCoins(newActiveCoins);

      const coinForSync = {
        id: finalId, symbol: safeSymbol, name: safeName, logo: safeLogoUrl || null,
        fallbackPrice: fallbackVal, currentPrice: fallbackVal, priceChange24h: 0,
        lastUpdated: new Date().toISOString(), network: finalNetwork, contractAddress: finalContract, source: 'custom'
      };
      await syncContextPortfolio(newActiveCoins, coinForSync);

      setIsAddModalOpen(false); setSearchQuery(''); setActiveTab('selected');
      addToast(`${safeSymbol} ${editingOriginalId ? 'updated' : 'added & saved to portfolio'} successfully`, 'success');
    } catch (e) { addToast("Failed to save custom token", 'error'); }
  };

  const handleDeleteToken = useCallback((coin) => {
    setConfirmModal({
      isOpen: true, title: 'Remove Token', message: `Remove ${coin.symbol} from your portfolio?`, type: 'danger',
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
          
          const newActiveCoins = activeCoins.filter(identifier => identifier !== normId);
          setActiveCoins(newActiveCoins);
          
          await syncContextPortfolio(newActiveCoins);

          addToast(`${coin.symbol} removed`, 'info');
        } catch (error) { addToast("Failed to remove token", 'error'); }
      }
    });
  }, [customUserCoins, hiddenTokens, user, activeCoins, syncContextPortfolio, addToast]);

  const openAddModal = useCallback(() => {
    setModalTitle('Add Custom Token'); setEditingOriginalId(null); setFetchMode('contract');
    setNewCoin({ apiId: '', network: 'solana', contractAddress: '', symbol: '', name: '', fallbackPrice: '', logoUrl: '' });
    setFetchError(null); setFetchStatus(''); setFetchSuccess(false); setIsAddModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsAddModalOpen(false); setFetchError(null); setFetchStatus(''); setFetchSuccess(false); setEditingOriginalId(null);
  }, []);

  const handleAddressChange = useCallback((e) => {
    const val = sanitizeInput(e.target.value);
    setNewCoin(prev => {
      const updates = { contractAddress: val };
      if (val.startsWith('0x')) { if (prev.network === 'solana') updates.network = 'bsc'; } 
      else if (val.length > 30 && !val.startsWith('0x')) { updates.network = 'solana'; }
      return { ...prev, ...updates };
    });
  }, []);

  const handleClearSearch = useCallback(() => setSearchQuery(''), []);

  useEffect(() => { return () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }; }, []);

  return (
    <>
      <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0 min-h-screen">
        
        {showRateLimitBanner && <RateLimitBanner onDismiss={() => setShowRateLimitBanner(false)} />}

        {/* 🚀 FIXED HEADER FOR MOBILE */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50 backdrop-blur-sm">
          <div className="absolute right-[-5%] top-[-20%] opacity-[0.03] text-white blur-[2px] pointer-events-none"><FaBitcoin size={250}/></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
          <div className="relative z-10">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)] transition-all hover:scale-105 duration-300">
              <FaBitcoin size={28} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">Portfolio Manager</h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-400 max-w-xl leading-relaxed">
              {topCoins.length > 0 ? `${topCoins.length}+ coins from CoinGecko & CoinMarketCap • Real-time prices` : 'Building your crypto portfolio. Select from top coins or add custom tokens.'}
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {dataSources.coingecko && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-lime-500/10 text-lime-400 border border-lime-500/30 flex items-center gap-1">🦎 CoinGecko</span>}
              {dataSources.coinmarketcap && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">📊 CoinMarketCap</span>}
              {dataSources.coincap && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">🪙 CoinCap</span>}
            </div>
          </div>
          <button onClick={openAddModal} className="w-full md:w-auto relative z-10 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 hover:from-blue-600/30 hover:to-cyan-600/30 text-white px-7 py-4 rounded-2xl font-black text-sm border border-blue-400/20 hover:border-blue-400/40 transition-all active:scale-95 backdrop-blur-sm shadow-sm mt-2 md:mt-0">
            <HiOutlinePlus size={20} /> Custom Token
          </button>
        </div>

        {fetchProgress && (
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700/50 rounded-2xl p-4 flex items-center gap-3">
            {fetchProgress.includes('✅') ? <HiOutlineCheckCircle className="text-green-500 w-5 h-5" /> : <HiOutlineRefresh className="animate-spin text-blue-500 w-5 h-5" />}
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fetchProgress}</span>
          </div>
        )}

        {/* 🚀 FIXED: Mobile Flex Toggle Layout */}
        <div className="flex w-full md:w-fit mx-auto p-1.5 space-x-1 bg-slate-200/40 dark:bg-slate-800/40 backdrop-blur-md rounded-[1.5rem] shadow-inner border border-slate-200/50 dark:border-slate-700/50">
          <button onClick={() => setActiveTab('selected')} className={`flex-1 flex flex-col sm:flex-row items-center justify-center px-4 sm:px-6 py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 gap-1 sm:gap-2 ${activeTab === 'selected' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md scale-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-80'}`}>
            <div className="flex items-center gap-1.5"><HiOutlineCollection size={16} /> <span className="truncate">My Selection</span></div>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'selected' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>{displaySelected.length}</span>
          </button>
          <button onClick={() => setActiveTab('market')} className={`flex-1 flex flex-col sm:flex-row items-center justify-center px-4 sm:px-6 py-3 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all duration-300 gap-1 sm:gap-2 ${activeTab === 'market' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md scale-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 scale-95 opacity-80'}`}>
            <div className="flex items-center gap-1.5"><HiOutlineSparkles size={16} /> <span className="truncate">Explore Market</span></div>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'market' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>{displayAvailable.length}</span>
          </button>
        </div>

        <div className="sticky top-[72px] md:top-4 z-40">
          <div className="relative shadow-2xl shadow-slate-200/20 dark:shadow-none rounded-[2rem]">
            <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"><HiOutlineSearch size={20} className="sm:w-[22px] sm:h-[22px]" /></div>
            <input type="text" placeholder={`Search ${topCoins.length}+ coins by name or symbol...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-[2rem] py-4 sm:py-5 pl-14 sm:pl-16 pr-14 sm:pr-16 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm" />
            {searchQuery && <button onClick={handleClearSearch} className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1"><HiOutlineXCircle size={20} /></button>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-5">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={idx} />)
          ) : currentListToDisplay.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 sm:py-20 px-4 animate-in fade-in zoom-in-95 duration-300 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
              <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mb-6 shadow-inner"><HiOutlineCube className="w-10 h-10 sm:w-14 sm:h-14 text-slate-400 dark:text-slate-500" /></div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-700 dark:text-slate-200 mb-2 text-center">{searchQuery ? 'No coins found' : (activeTab === 'selected' ? 'No coins selected' : 'Start exploring!')}</h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm mb-8 px-4">{searchQuery ? `Nothing matches "${searchQuery}" in ${activeTab === 'selected' ? 'your selection' : 'the market'}.` : (activeTab === 'selected' ? "Select coins from the Explore Market tab or add custom tokens." : `Browse ${topCoins.length}+ coins and click to add them to your selection.`)}</p>
              {activeTab === 'selected' && !searchQuery && <button onClick={() => setActiveTab('market')} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95 text-sm sm:text-base">Explore Market</button>}
              {activeTab === 'market' && !searchQuery && <button onClick={openAddModal} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 active:scale-95 text-sm sm:text-base">Add Custom Token</button>}
            </div>
          ) : (
            currentListToDisplay.map((coin) => {
              const isSelected = activeCoins.includes(coin.id);
              const livePrice = livePrices[coin.id];
              const currentPrice = livePrice?.usd || coin.fallbackPrice;
              const change24h = livePrice?.usd_24h_change || coin.priceChange24h || 0;
              
              return (
                <div key={coin.id} onClick={() => toggleCoin(coin.id)} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCoin(coin.id)} className={`group/card cursor-pointer relative flex flex-col items-center p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 overflow-hidden ${isSelected ? 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-400/50 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xl hover:-translate-y-1'}`}>
                  
                  {isSelected && <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10"><div className="relative"><div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50" /><HiOutlineCheckCircle size={20} className="sm:w-[22px] sm:h-[22px] relative text-blue-500" /></div></div>}
                  
                  <SourceBadge source={coin.source} sourceIcon={coin.sourceIcon} />
                  {coin.marketCapRank && coin.marketCapRank < 999999 && <span className="absolute top-1 left-1 text-[7px] sm:text-[8px] font-black text-slate-400 dark:text-slate-500">#{coin.marketCapRank}</span>}
                  
                  {/* 🚀 FIXED: Mobile Flex Overlap Issue inside Card */}
                  <div className="absolute bottom-2 left-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity duration-300 z-20">
                    <Tooltip text="Edit"><button onClick={(e) => { e.stopPropagation(); handleEditClick(e, coin); }} className="w-6 h-6 sm:w-7 sm:h-7 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90"><HiOutlinePencil size={10} className="sm:w-3 sm:h-3" /></button></Tooltip>
                    <Tooltip text="Remove"><button onClick={(e) => { e.stopPropagation(); handleDeleteToken(coin); }} className="w-6 h-6 sm:w-7 sm:h-7 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/50 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90"><HiOutlineTrash size={10} className="sm:w-3 sm:h-3" /></button></Tooltip>
                  </div>
                  
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full mb-3 sm:mb-4 flex items-center justify-center transition-all duration-500 group-hover/card:scale-110 group-hover/card:-translate-y-1 ${isSelected ? 'ring-4 ring-blue-500/20' : ''}`}>
                    <LogoRenderer symbol={coin.symbol} customLogo={coin.logo || getFallbackLogo(coin.symbol, coin.network, coin.contractAddress)} bg={coin.bg} color={coin.color} />
                  </div>
                  <h3 className={`font-black text-sm sm:text-base tracking-tight mb-0.5 w-full text-center truncate px-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>{coin.symbol}</h3>
                  {coin.network && <span className="text-[7px] sm:text-[8px] font-black tracking-widest px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase mb-1">{coin.network}</span>}
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-400 truncate w-full text-center px-1 pb-4 sm:pb-0">{coin.name}</p>
                  
                  {currentPrice > 0 && <PriceBadge price={currentPrice} change24h={change24h} symbol={coin.symbol} />}
                </div>
              );
            })
          )}
        </div>

        {activeCoins.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
            <button onClick={handleSave} disabled={isSaving} className={`w-full px-6 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white rounded-full font-black text-xs sm:text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3 border border-blue-400/50 ${!isSaving ? 'animate-pulse hover:animate-none' : ''}`}>
              {isSaving ? <><HiOutlineRefresh className="animate-spin" size={18}/> SAVING...</> : <><HiOutlineCheckCircle size={18}/> SAVE {activeCoins.length} ASSET{activeCoins.length !== 1 ? 'S' : ''}</>}
            </button>
          </div>
        )}

        {isAddModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
              <div className="px-6 py-5 sm:px-8 sm:py-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex justify-between items-center">
                <h3 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <FaCoins className="text-white/80" /> 
                  {modalTitle}
                </h3>
                <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                  <HiOutlineX size={20}/>
                </button>
              </div>
              
              <form onSubmit={handleAddCustomCoin} className="p-6 sm:p-8 space-y-5 sm:space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                  <button type="button" onClick={() => setFetchMode('contract')} className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${fetchMode === 'contract' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>By Contract</button>
                  <button type="button" onClick={() => setFetchMode('id')} className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${fetchMode === 'id' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>By CG ID</button>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 p-4 sm:p-5 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4">
                  {fetchMode === 'contract' ? (
                    <>
                      <select value={newCoin.network} onChange={(e) => setNewCoin({...newCoin, network: e.target.value})} className="w-full bg-white dark:bg-slate-800 px-4 py-3 sm:py-3.5 rounded-xl font-bold text-slate-700 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 text-[11px] sm:text-sm cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-shadow">
                        {SUPPORTED_NETWORKS.map(net => (
                          <option key={net.id} value={net.id}>{net.id === 'solana' && '☀️ '}{net.name}</option>
                        ))}
                      </select>
                      
                      {newCoin.network === 'solana' && (
                        <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                          <HiOutlineSun size={14} className="shrink-0" /> <span>Solana uses mint addresses (base58 format, 32-44 chars)</span>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input type="text" placeholder={getAddressPlaceholder(newCoin.network)} value={newCoin.contractAddress} onChange={handleAddressChange} className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 sm:py-3.5 rounded-xl font-mono text-[10px] sm:text-xs text-slate-900 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                        <button type="button" onClick={handleAutoFetchDetails} disabled={isFetchingData} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3 sm:py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px] shadow-md">
                          {isFetchingData ? <HiOutlineRefresh className="animate-spin" size={16}/> : <><HiOutlineCloudDownload size={16} className="mr-1 sm:hidden"/> <span className="sm:hidden">Fetch</span> <HiOutlineCloudDownload size={16} className="hidden sm:block"/></>}
                        </button>
                      </div>
                      
                      {newCoin.contractAddress && isValidAddress(newCoin.contractAddress, newCoin.network) && (
                        <a href={getExplorerUrl(newCoin.network, newCoin.contractAddress)} target="_blank" rel="noopener noreferrer" className="text-[9px] sm:text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                          <HiOutlineExternalLink size={12} /> View on {newCoin.network === 'solana' ? 'Solscan' : 'Explorer'}
                        </a>
                      )}
                      
                      {newCoin.network === 'solana' && newCoin.contractAddress && !isFetchingData && !fetchSuccess && (
                        <div className="pt-2 border-t border-blue-200 dark:border-blue-700/50 mt-2">
                          <p className="text-[9px] sm:text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2">Token not found? Try alternative sources:</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setFetchError(null); setFetchStatus(''); }} className="flex-1 py-2 px-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg text-[9px] sm:text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">Enter Manually</button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input type="text" placeholder="CoinGecko ID (e.g. bitcoin)" value={newCoin.apiId} onChange={(e) => setNewCoin({...newCoin, apiId: e.target.value})} className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-400 dark:placeholder:text-slate-500" />
                      <button type="button" onClick={handleAutoFetchDetails} disabled={isFetchingData} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-5 py-3 sm:py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px] shadow-md">
                        {isFetchingData ? <HiOutlineRefresh className="animate-spin" size={16}/> : <><HiOutlineCloudDownload size={16} className="mr-1 sm:hidden"/> <span className="sm:hidden">Fetch</span> <HiOutlineCloudDownload size={16} className="hidden sm:block"/></>}
                      </button>
                    </div>
                  )}
                  
                  {fetchStatus && (
                    <p className={`text-[10px] sm:text-xs font-medium flex items-center gap-1 mt-2 ${fetchSuccess ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {!fetchSuccess && <HiOutlineRefresh className="animate-spin" size={12} />}
                      {fetchSuccess && <HiOutlineCheckCircle size={12} />}
                      {fetchStatus}
                    </p>
                  )}
                  
                  {fetchError && (
                    <p className="text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-1 mt-2">
                      <HiOutlineExclamation className="flex-shrink-0 mt-0.5" size={14} /> <span>{fetchError}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Symbol *</label>
                    <input type="text" required value={newCoin.symbol} onChange={(e) => setNewCoin({...newCoin, symbol: e.target.value.toUpperCase()})} disabled={modalTitle.includes("Edit")} className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder="BTC" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Price ($)</label>
                    <input type="number" step="any" min="0" value={newCoin.fallbackPrice} onChange={(e) => setNewCoin({...newCoin, fallbackPrice: e.target.value})} className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder="0.00" />
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Full Name *</label>
                  <input type="text" required value={newCoin.name} onChange={(e) => setNewCoin({...newCoin, name: e.target.value})} className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600" placeholder="Bitcoin" />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><HiOutlinePhotograph /> Logo URL</label>
                  <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <input type="url" value={newCoin.logoUrl} onChange={(e) => setNewCoin({...newCoin, logoUrl: e.target.value})} placeholder="https://example.com/logo.png" className="w-full flex-1 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 text-[10px] sm:text-xs transition-shadow placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {newCoin.logoUrl ? (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                          <img src={newCoin.logoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                        </div>
                      ) : newCoin.symbol && (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                          <LogoRenderer symbol={newCoin.symbol} customLogo={null} bg="bg-gradient-to-br from-purple-500/20 to-pink-500/20" color="text-purple-500" />
                        </div>
                      )}
                      <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 sm:hidden">Leave empty for auto-generated avatar.</p>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-1 mt-1 hidden sm:block">Leave empty for auto-generated avatar.</p>
                </div>

                <button type="submit" className="w-full p-4 sm:p-5 mt-2 sm:mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-2xl sm:rounded-[2rem] font-black text-sm sm:text-lg shadow-xl shadow-blue-600/20 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
                  {modalTitle.includes('Edit') ? 'Update Token' : 'Add Token to Portfolio'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} type={confirmModal.type} />
    </>
  );
};

const CryptoManager = () => (
  <ToastProvider>
    <CryptoManagerContent />
  </ToastProvider>
);

export default CryptoManager;