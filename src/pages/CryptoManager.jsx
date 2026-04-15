import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, HiOutlineCheckCircle, HiOutlinePlus, HiOutlineX, 
  HiOutlineTrash, HiOutlinePencil, HiOutlineCloudDownload, HiOutlineRefresh, 
  HiOutlinePhotograph, HiOutlineXCircle, HiOutlineCube, HiOutlineExclamation,
  HiOutlineSun, HiOutlineExternalLink
} from 'react-icons/hi';
import { FaBitcoin, FaCoins } from 'react-icons/fa';

// ============================================
// 🚀 UTILITY FUNCTIONS
// ============================================

const getTrustWalletLogo = (network, address) => {
  if (!network || !address) return null;
  const networkMap = {
    bsc: 'smartchain', eth: 'ethereum', polygon_pos: 'polygon',
    arbitrum: 'arbitrum', optimism: 'optimism', base: 'base', solana: 'solana'
  };
  const mapped = networkMap[network];
  if (!mapped) return null;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${mapped}/assets/${address}/logo.png`;
};

const fetchSolanaTokenMetadata = async (mintAddress) => {
  try {
    const response = await fetch(`https://token.jup.ag/all`);
    if (response.ok) {
      const tokens = await response.json();
      const token = tokens.find(t => t.address === mintAddress);
      if (token) return { symbol: token.symbol, name: token.name, logoUrl: token.logoURI || null, decimals: token.decimals, source: 'jupiter' };
    }
    
    const tokenListResponse = await fetch('https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/src/tokens/solana.tokenlist.json');
    if (tokenListResponse.ok) {
      const tokenList = await tokenListResponse.json();
      const token = tokenList.tokens.find(t => t.address === mintAddress);
      if (token) return { symbol: token.symbol, name: token.name, logoUrl: token.logoURI || null, source: 'tokenlist' };
    }
    
    try {
      const birdeyeResponse = await fetch(`https://public-api.birdeye.so/public/token?address=${mintAddress}`, { headers: { 'x-chain': 'solana' } });
      if (birdeyeResponse.ok) {
        const data = await birdeyeResponse.json();
        if (data.data) return { symbol: data.data.symbol, name: data.data.name, logoUrl: data.data.logoURI || null, source: 'birdeye' };
      }
    } catch {}
    
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      if (dexResponse.ok) {
        const data = await dexResponse.json();
        if (data.pairs?.[0]) {
          const pair = data.pairs[0];
          return { symbol: pair.baseToken.symbol, name: pair.baseToken.name || pair.baseToken.symbol, logoUrl: null, source: 'dexscreener', price: parseFloat(pair.priceUsd) || 0 };
        }
      }
    } catch {}
    
    return null;
  } catch (err) {
    return null;
  }
};

const fetchSolanaTokenPrice = async (mintAddress) => {
  try {
    try {
      const birdeyeResponse = await fetch(`https://public-api.birdeye.so/public/price?address=${mintAddress}`, { headers: { 'x-chain': 'solana' } });
      if (birdeyeResponse.ok) {
        const priceData = await birdeyeResponse.json();
        if (priceData.data?.value) return priceData.data.value;
      }
    } catch {}
    
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      if (dexResponse.ok) {
        const data = await dexResponse.json();
        if (data.pairs?.[0]?.priceUsd) return parseFloat(data.pairs[0].priceUsd);
      }
    } catch {}
    
    return 0;
  } catch {
    return 0;
  }
};

const generateSolanaLogoUrl = (mintAddress, symbol) => `https://ui-avatars.com/api/?name=${symbol || 'TOKEN'}&background=8B5CF6&color=fff&bold=true&size=64`;

const getFallbackLogo = (symbol, network, address) => {
  const trustWalletUrl = getTrustWalletLogo(network, address);
  if (trustWalletUrl) return trustWalletUrl;
  if (network === 'solana' && address) return generateSolanaLogoUrl(address, symbol);
  return `https://ui-avatars.com/api/?name=${symbol}&background=3B82F6&color=fff&bold=true&size=64`;
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
// 🚀 COMPONENTS
// ============================================

const LogoRenderer = ({ symbol, customLogo, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(customLogo);
  const symbolUpper = (symbol || '').toUpperCase();

  useEffect(() => {
    setImgSrc(customLogo);
    setHasError(false);
  }, [customLogo]);

  if (!imgSrc || hasError) {
    return (
      <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-100 dark:bg-slate-800'} ${color || 'text-slate-500 dark:text-slate-300'} shadow-inner border border-slate-200/50 dark:border-slate-700/50`}>
        {symbolUpper?.substring(0, 3)}
      </span>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={symbolUpper} 
      className="w-full h-full object-contain rounded-full relative z-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-[2px]" 
      loading="lazy" 
      onError={() => {
        if (imgSrc === customLogo) setImgSrc(generateSolanaLogoUrl(null, symbolUpper));
        else setHasError(true);
      }} 
    />
  );
};

const SkeletonCard = () => (
  <div className="flex flex-col items-center p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 mb-4" />
    <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
    <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
  </div>
);

const Tooltip = ({ children, text }) => (
  <div className="relative group/tooltip">
    {children}
    <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-30 shadow-lg">
      {text}
    </span>
  </div>
);

const RateLimitBanner = ({ onDismiss }) => (
  <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 shadow-lg animate-in slide-in-from-top-4 duration-300">
    <div className="flex items-start gap-3">
      <HiOutlineExclamation className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">API Rate Limit Reached</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Using cached data. Please try again in a few minutes.</p>
      </div>
      <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"><HiOutlineX size={18} /></button>
    </div>
  </div>
);

const NetworkBadge = ({ network }) => {
  const networkConfig = {
    solana: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'SOL', color: 'text-white' },
    eth: { bg: 'bg-blue-500', text: 'ETH', color: 'text-white' },
    bsc: { bg: 'bg-yellow-500', text: 'BSC', color: 'text-black' },
    polygon_pos: { bg: 'bg-purple-600', text: 'MATIC', color: 'text-white' },
    arbitrum: { bg: 'bg-blue-600', text: 'ARB', color: 'text-white' },
    optimism: { bg: 'bg-red-500', text: 'OP', color: 'text-white' },
    base: { bg: 'bg-blue-700', text: 'BASE', color: 'text-white' }
  };
  const config = networkConfig[network];
  if (!config) return null;
  return (
    <span className={`absolute bottom-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-md ${config.bg} ${config.color} shadow-sm`}>{config.text}</span>
  );
};

// ============================================
// 🚀 CONSTANTS & DATA
// ============================================

const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USDC', logo: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-500/10' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin', logo: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', logo: 'https://assets.coingecko.com/coins/images/975/large/cardano.png', color: 'text-blue-600', bg: 'bg-blue-600/10' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', logo: 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png', color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', logo: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png', color: 'text-orange-600', bg: 'bg-orange-600/10' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', logo: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png', color: 'text-pink-600', bg: 'bg-pink-600/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', logo: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png', color: 'text-blue-600', bg: 'bg-blue-600/10' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', logo: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png', color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', logo: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png', color: 'text-slate-500', bg: 'bg-slate-500/10' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', logo: 'https://assets.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png', color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', logo: 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', logo: 'https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-800/10' },
  { id: 'monero', symbol: 'XMR', name: 'Monero', logo: 'https://assets.coingecko.com/coins/images/69/large/monero_logo.png', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic', logo: 'https://assets.coingecko.com/coins/images/453/large/ethereum-classic-logo.png', color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
  { id: 'tether', symbol: 'CTC', name: 'CryptoTab Coin', logo: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox (Pegged)', logo: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://assets.coingecko.com/coins/images/13600/large/feyorra.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'taraxa', symbol: 'TARA', name: 'Taraxa', logo: 'https://assets.coingecko.com/coins/images/14409/large/taraxa.png', fallbackPrice: 0.0045, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
];

const SUPPORTED_NETWORKS = [
  { id: 'eth', name: 'Ethereum' },
  { id: 'bsc', name: 'Binance Smart Chain (BSC)' },
  { id: 'solana', name: 'Solana' },
  { id: 'polygon_pos', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' }
];

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

const CryptoManager = () => {
  const { user, selectedCryptos = [], updateSelectedCryptos } = useAuth();
  const navigate = useNavigate();

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
    apiId: '',
    network: 'solana', // Changed default to solana for ROX user
    contractAddress: '',
    symbol: '',
    name: '',
    fallbackPrice: '',
    logoUrl: ''
  });

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCryptos && selectedCryptos.length > 0) {
      const symbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol);
      setActiveCoins(symbols);
    } else {
      setActiveCoins([]);
    }
  }, [selectedCryptos]);

  useEffect(() => {
    const fetchTop250 = async () => {
      try {
        const cachedData = localStorage.getItem('finledger_top_coins');
        const cacheTimestamp = localStorage.getItem('finledger_top_coins_timestamp');
        
        if (cachedData && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 43200000) {
          setTop250Coins(JSON.parse(cachedData));
          setIsLoading(false);
          return;
        }

        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`);
        
        if (res.status === 429) {
          setShowRateLimitBanner(true);
          if (cachedData) setTop250Coins(JSON.parse(cachedData));
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          setTop250Coins(data);
          localStorage.setItem('finledger_top_coins', JSON.stringify(data));
          localStorage.setItem('finledger_top_coins_timestamp', Date.now().toString());
        } else if (cachedData) {
          setTop250Coins(JSON.parse(cachedData));
        }
      } catch (err) {
        const cachedData = localStorage.getItem('finledger_top_coins');
        if (cachedData) setTop250Coins(JSON.parse(cachedData));
      } finally {
        setIsLoading(false);
      }
    };
    fetchTop250();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.hiddenTokens) setHiddenTokens(data.hiddenTokens);
          if (data.customCoins) setCustomUserCoins(data.customCoins);
        }
      } catch (err) {
        console.error("Failed to fetch user crypto data:", err);
      }
    };
    fetchUserData();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();

    top250Coins.forEach(c => {
      coinMap.set(c.symbol.toUpperCase(), {
        id: c.id, symbol: c.symbol.toUpperCase(), name: c.name,
        logo: c.image, fallbackPrice: c.current_price,
        bg: 'bg-slate-800', color: 'text-white'
      });
    });

    defaultCryptoDatabase.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { 
        ...c, 
        fallbackPrice: existing?.fallbackPrice || c.fallbackPrice,
        network: c.network || null,
        contractAddress: c.contractAddress || null
      });
    });

    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      if (existing) {
        coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, fallbackPrice: c.fallbackPrice || existing.fallbackPrice });
      } else {
        coinMap.set(c.symbol.toUpperCase(), c);
      }
    });

    hiddenTokens.forEach(sym => { coinMap.delete(sym.toUpperCase()); });
    return Array.from(coinMap.values());
  }, [top250Coins, customUserCoins, hiddenTokens]);

  const filteredCoins = useMemo(() => {
    return fullDatabase.filter(c => 
      c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
      c.symbol.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [fullDatabase, debouncedSearch]);

  const toggleCoin = (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    setActiveCoins((prev) => prev.includes(upperSymbol) ? prev.filter(c => c !== upperSymbol) : [...prev, upperSymbol]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const enrichedSelection = activeCoins.map(sym => {
      const coinData = fullDatabase.find(c => c.symbol.toUpperCase() === sym) || {};
      return {
        symbol: sym,
        id: coinData.id || sym.toLowerCase(),
        name: coinData.name || sym,
        logo: coinData.logo || null,
        fallbackPrice: coinData.fallbackPrice || 0,
        bg: coinData.bg || 'bg-slate-800',
        color: coinData.color || 'text-white',
        network: coinData.network || null,
        contractAddress: coinData.contractAddress || null
      };
    });

    if (updateSelectedCryptos) await updateSelectedCryptos(enrichedSelection);
    setTimeout(() => { setIsSaving(false); navigate('/dashboard'); }, 500);
  };

  const handleEditClick = (e, coin) => {
    e.stopPropagation();
    setModalTitle(`Edit Token: ${coin.symbol}`);
    setFetchMode(coin.contractAddress ? 'contract' : 'id');
    setNewCoin({
      apiId: coin.id || '',
      network: coin.network || 'solana',
      contractAddress: coin.contractAddress || '',
      symbol: coin.symbol,
      name: coin.name,
      fallbackPrice: coin.fallbackPrice || '',
      logoUrl: coin.logo || ''
    });
    setFetchError(null);
    setFetchStatus('');
    setFetchSuccess(false);
    setIsAddModalOpen(true);
  };

  // 🚀 THE MAGIC: SMART FETCHING ENGINE (WITH NC WALLET INTERCEPTOR)
  const handleAutoFetchDetails = async () => {
    setIsFetchingData(true);
    setFetchError(null);
    setFetchStatus('Fetching token data...');
    setFetchSuccess(false);
    
    try {
      if (fetchMode === 'id') {
        const searchId = newCoin.apiId.toLowerCase().trim();
        if (!searchId) { 
          setFetchError("Enter CoinGecko ID"); 
          setIsFetchingData(false); 
          setFetchStatus('');
          return; 
        }

        // 🚀 SMART INTERCEPT: NC WALLET TOKENS BY ID
        if (searchId === 'rox' || searchId === 'robox') {
          setNewCoin(prev => ({
            ...prev,
            symbol: 'ROX',
            name: 'Robox (NC Wallet)',
            fallbackPrice: 1.00,
            logoUrl: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu',
            apiId: 'tether' // Peg to Tether pricing internally
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Verified NC Wallet Asset');
          setIsFetchingData(false);
          return;
        }
        
        if (searchId === 'ctc' || searchId === 'cryptotab') {
          setNewCoin(prev => ({
            ...prev,
            symbol: 'CTC',
            name: 'CryptoTab Coin',
            fallbackPrice: 1.00,
            logoUrl: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png',
            apiId: 'tether'
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Verified NC Wallet Asset');
          setIsFetchingData(false);
          return;
        }
        
        setFetchStatus('Fetching from CoinGecko...');
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${searchId}`);
        
        if (res.status === 429) {
          setFetchError("Rate limit reached. Try again later.");
          setShowRateLimitBanner(true);
          setIsFetchingData(false);
          setFetchStatus('');
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          setNewCoin(prev => ({
            ...prev,
            symbol: data.symbol.toUpperCase(),
            name: data.name,
            fallbackPrice: data.market_data?.current_price?.usd || prev.fallbackPrice,
            logoUrl: data.image?.large || prev.logoUrl
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Token found on CoinGecko');
        } else {
          setFetchError("CoinGecko ID not found.");
        }
      } else if (fetchMode === 'contract') {
        const address = newCoin.contractAddress.trim();
        const network = newCoin.network;
        
        if (!address || !network) { 
          setFetchError("Enter Network and Address"); 
          setIsFetchingData(false); 
          setFetchStatus('');
          return; 
        }

        // 🚀 SMART INTERCEPT: NC WALLET TOKENS BY CONTRACT
        if (network === 'solana' && address.startsWith('Rox')) {
          setNewCoin(prev => ({
            ...prev,
            symbol: 'ROX',
            name: 'Robox (NC Wallet)',
            fallbackPrice: 1.00,
            logoUrl: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu',
            apiId: 'tether' // Peg to Tether pricing internally
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Verified NC Wallet Asset');
          setIsFetchingData(false);
          return;
        }
        
        // Validate address
        if (!isValidAddress(address, network)) {
          setFetchError(network === 'solana' 
            ? "Invalid Solana mint address (base58 format, 32-44 chars)" 
            : "Invalid contract address format (should be 0x...40 hex chars)");
          setIsFetchingData(false);
          setFetchStatus('');
          return;
        }
        
        // ============================================
        // SOLANA-SPECIFIC HANDLING
        // ============================================
        if (network === 'solana') {
          setFetchStatus('Searching Solana token registries...');
          const solanaMetadata = await fetchSolanaTokenMetadata(address);
          
          if (solanaMetadata) {
            const price = await fetchSolanaTokenPrice(address);
            
            setNewCoin(prev => ({
              ...prev,
              symbol: solanaMetadata.symbol.toUpperCase(),
              name: solanaMetadata.name,
              fallbackPrice: price || prev.fallbackPrice || 0,
              logoUrl: solanaMetadata.logoUrl || getFallbackLogo(solanaMetadata.symbol, network, address),
              apiId: `solana-${address.substring(0, 8)}`
            }));
            
            setFetchError(null);
            setFetchSuccess(true);
            setFetchStatus(`✓ Found in ${solanaMetadata.source}`);
          } else {
            // Token NOT found - smart fallback
            const existingSymbol = newCoin.symbol || '';
            const existingName = newCoin.name || '';
            
            const friendlyName = existingName || `Token ${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
            const friendlySymbol = existingSymbol || 'TOKEN';
            const generatedLogo = generateSolanaLogoUrl(address, friendlySymbol);
            
            setNewCoin(prev => ({
              ...prev,
              symbol: prev.symbol || friendlySymbol,
              name: prev.name || friendlyName,
              logoUrl: prev.logoUrl || generatedLogo,
              apiId: `solana-${address.substring(0, 8)}`,
              fallbackPrice: prev.fallbackPrice || 0
            }));
            
            setFetchSuccess(false);
            setFetchStatus('');
            setFetchError(
              <span className="flex items-center gap-1 flex-wrap">
                Token not found in public registries.
                <button 
                  type="button"
                  onClick={() => setFetchError(null)}
                  className="underline hover:text-blue-600 dark:hover:text-blue-400 font-bold"
                >
                  Fill manually
                </button>
              </span>
            );
          }
          
          setIsFetchingData(false);
          return;
        }
        
        // ============================================
        // EVM CHAIN HANDLING
        // ============================================
        setFetchStatus('Fetching from GeckoTerminal...');
        const fallbackLogo = getFallbackLogo(newCoin.symbol || 'TOKEN', network, address);

        const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}`);
        
        if (res.status === 429) {
          setFetchError("Rate limit reached. Using fallback data.");
          setNewCoin(prev => ({ ...prev, logoUrl: fallbackLogo }));
          setIsFetchingData(false);
          setFetchStatus('');
          return;
        }
        
        if (res.ok) {
          const json = await res.json();
          const data = json.data.attributes;
          setNewCoin(prev => ({
            ...prev,
            symbol: data.symbol.toUpperCase(),
            name: data.name,
            fallbackPrice: data.price_usd || prev.fallbackPrice,
            logoUrl: data.image_url || fallbackLogo, 
            apiId: `custom-${network}-${address.substring(0,6)}`
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Token found on GeckoTerminal');
        } else {
          setNewCoin(prev => ({ ...prev, logoUrl: fallbackLogo }));
          setFetchError("Contract not found. You can enter details manually.");
          setFetchSuccess(false);
        }
      }
    } catch (err) {
      console.error(err);
      setFetchError("Network error. Manual entry allowed.");
      setFetchSuccess(false);
    } finally {
      setIsFetchingData(false);
      if (fetchMode !== 'solana') {
        setTimeout(() => setFetchStatus(''), 3000);
      }
    }
  };

  const searchDexScreener = async () => {
    if (!newCoin.contractAddress) return;
    
    setFetchStatus('Searching DexScreener...');
    setIsFetchingData(true);
    
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${newCoin.contractAddress}`);
      if (res.ok) {
        const data = await res.json();
        if (data.pairs?.[0]) {
          const pair = data.pairs[0];
          setNewCoin(prev => ({
            ...prev,
            symbol: pair.baseToken.symbol.toUpperCase(),
            name: pair.baseToken.name || prev.name,
            fallbackPrice: parseFloat(pair.priceUsd) || prev.fallbackPrice
          }));
          setFetchError(null);
          setFetchSuccess(true);
          setFetchStatus('✓ Found on DexScreener');
        } else {
          setFetchStatus('Not found on DexScreener');
        }
      }
    } catch {
      setFetchStatus('DexScreener search failed');
    } finally {
      setIsFetchingData(false);
      setTimeout(() => setFetchStatus(''), 3000);
    }
  };

  const handleAddCustomCoin = async (e) => {
    e.preventDefault();
    if (!user) return;
    const safeSymbol = (newCoin.symbol || '').toUpperCase().trim();
    if (!safeSymbol) return alert("Symbol is required!");

    const safeApiId = (newCoin.apiId || '').trim().toLowerCase();
    const safeName = (newCoin.name || '').trim();
    const safeLogoUrl = (newCoin.logoUrl || '').trim();
    const safeContract = (newCoin.contractAddress || '').trim();

    if (fetchMode === 'contract' && safeContract && !isValidAddress(safeContract, newCoin.network)) {
      alert(newCoin.network === 'solana' 
        ? "Invalid Solana mint address format" 
        : "Invalid contract address format");
      return;
    }

    const newCoinObj = {
      // Priority: Hardcoded API ID for Pegs -> Generated API ID -> Formatted Name
      id: ['ROX', 'CTC'].includes(safeSymbol) ? 'tether' : (safeApiId || `${newCoin.network}-${safeContract.substring(0, 8)}` || safeName.toLowerCase().replace(/\s+/g, '-')),
      symbol: safeSymbol,
      name: safeName,
      fallbackPrice: parseFloat(newCoin.fallbackPrice) || 0,
      logo: safeLogoUrl !== '' ? safeLogoUrl : null,
      color: 'text-purple-500', 
      bg: 'bg-purple-500/10',
      network: fetchMode === 'contract' ? newCoin.network : null,
      contractAddress: fetchMode === 'contract' ? safeContract : null,
      fetchMode: fetchMode
    };

    try {
      const updated = customUserCoins.filter(c => c.symbol.toUpperCase() !== safeSymbol);
      updated.push(newCoinObj);
      await setDoc(doc(db, "users", user.uid), { customCoins: updated }, { merge: true });
      setCustomUserCoins(updated);
      if (!activeCoins.includes(safeSymbol)) setActiveCoins(prev => [...prev, safeSymbol]);
      setIsAddModalOpen(false);
    } catch (e) {
      alert("Save failed.");
    }
  };

  const handleDeleteToken = async (e, coinSymbol) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to completely remove ${coinSymbol}?`)) return;
    try {
      const isCustom = customUserCoins.find(c => c.symbol.toUpperCase() === coinSymbol);
      if (isCustom) {
        const remainingCustoms = customUserCoins.filter(c => c.symbol.toUpperCase() !== coinSymbol);
        await setDoc(doc(db, "users", user.uid), { customCoins: remainingCustoms }, { merge: true });
        setCustomUserCoins(remainingCustoms);
      } else {
        await setDoc(doc(db, "users", user.uid), { hiddenTokens: arrayUnion(coinSymbol) }, { merge: true });
        setHiddenTokens(prev => [...prev, coinSymbol]);
      }
      setActiveCoins(prev => prev.filter(c => c !== coinSymbol));
    } catch (error) {
      alert("Delete failed.");
    }
  };

  const handleClearSearch = () => setSearchQuery('');

  const openAddModal = () => {
    setModalTitle('Add Custom Token'); 
    setFetchMode('contract'); 
    setNewCoin({ apiId: '', network: 'solana', contractAddress: '', symbol: '', name: '', fallbackPrice: '', logoUrl: '' }); 
    setFetchError(null);
    setFetchStatus('');
    setFetchSuccess(false);
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setFetchError(null);
    setFetchStatus('');
    setFetchSuccess(false);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {showRateLimitBanner && (
        <RateLimitBanner onDismiss={() => setShowRateLimitBanner(false)} />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-700/50 backdrop-blur-sm">
        <div className="absolute right-[-5%] top-[-20%] opacity-5 text-white blur-[2px] pointer-events-none">
           <FaBitcoin size={200}/>
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)] transition-all hover:scale-105">
            <FaBitcoin size={32} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Portfolio Manager</h1>
          <p className="text-sm font-semibold text-slate-400 max-w-xl leading-relaxed">
            Select the digital assets you want to track across your Vaults, Income Streams, and AI Strategy.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="relative z-10 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-7 py-4 rounded-2xl font-black text-sm border border-white/10 transition-all active:scale-95 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/20 group"
        >
          <HiOutlinePlus size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
          Custom Token
        </button>
      </div>

      {/* Search */}
      <div className="sticky top-[72px] md:top-4 z-40">
        <div className="relative shadow-xl shadow-slate-200/20 dark:shadow-none rounded-[2rem]">
          <HiOutlineSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input 
            type="text" 
            placeholder="Search 250+ Tokens..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] py-5 pl-16 pr-16 text-sm font-bold outline-none dark:text-white focus:ring-4 focus:ring-blue-500/20 transition-all placeholder:font-medium"
          />
          {searchQuery && (
            <button 
              onClick={handleClearSearch}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
              aria-label="Clear search"
            >
              <HiOutlineXCircle size={20} />
            </button>
          )}
          {isLoading && <HiOutlineRefresh className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={22} />}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
        {isLoading ? (
          Array.from({ length: 12 }).map((_, idx) => <SkeletonCard key={idx} />)
        ) : filteredCoins.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <HiOutlineCube className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-black text-slate-700 dark:text-slate-300 mb-2">No tokens found</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
              {searchQuery ? `No results for "${searchQuery}". Try a different search term.` : "No tokens available. Try adding a custom token."}
            </p>
          </div>
        ) : (
          filteredCoins.map((coin) => {
            const isSelected = activeCoins.includes(coin.symbol.toUpperCase());
            return (
              <div 
                key={`${coin.symbol}-${coin.id}`}
                onClick={() => toggleCoin(coin.symbol)} 
                role="button" 
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCoin(coin.symbol)}
                className={`group cursor-pointer relative flex flex-col items-center p-6 rounded-[2rem] border transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 ${
                  isSelected 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-lg shadow-blue-500/10 scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl hover:-translate-y-1'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 text-blue-500 bg-white dark:bg-slate-900 rounded-full shadow-sm z-10">
                    <HiOutlineCheckCircle size={22} className="fill-current text-white dark:text-slate-900" />
                  </div>
                )}
                
                <div className="absolute top-3 left-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20">
                  <Tooltip text="Edit Token">
                    <button 
                      onClick={(e) => handleEditClick(e, coin)} 
                      className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      aria-label={`Edit ${coin.symbol}`}
                    >
                      <HiOutlinePencil size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete Token">
                    <button 
                      onClick={(e) => handleDeleteToken(e, coin.symbol.toUpperCase())} 
                      className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full shadow-sm flex items-center justify-center transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
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
                <h3 className={`font-black text-base tracking-tight mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>
                  {coin.symbol}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 truncate w-full text-center px-2">{coin.name}</p>
                
                {coin.network && <NetworkBadge network={coin.network} />}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex justify-between items-center">
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
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button 
                  type="button" 
                  onClick={() => setFetchMode('contract')} 
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
                    fetchMode === 'contract' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  By Contract
                </button>
                <button 
                  type="button" 
                  onClick={() => setFetchMode('id')} 
                  className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-200 ${
                    fetchMode === 'id' 
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-md' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  By CG ID
                </button>
              </div>

              {/* Fetch Section */}
              <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4">
                
                {fetchMode === 'contract' ? (
                  <>
                    <select 
                      value={newCoin.network} 
                      onChange={(e) => setNewCoin({...newCoin, network: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700 text-sm cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-shadow"
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
                        onChange={(e)=>setNewCoin({...newCoin, contractAddress:e.target.value})} 
                        className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-mono text-xs text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                      />
                      <button 
                        type="button" 
                        onClick={handleAutoFetchDetails} 
                        disabled={isFetchingData} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px]"
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
                      <div className="pt-2 border-t border-blue-200 dark:border-blue-700/30">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2">Token not found? Try alternative sources:</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={searchDexScreener}
                            className="flex-1 py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
                      className="flex-1 w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-sm text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                    />
                    <button 
                      type="button" 
                      onClick={handleAutoFetchDetails} 
                      disabled={isFetchingData} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/50 flex items-center justify-center min-w-[60px]"
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
                  <p className={`text-xs font-medium flex items-center gap-1 ${
                    fetchSuccess ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                  }`}>
                    {!fetchSuccess && <HiOutlineRefresh className="animate-spin" size={12} />}
                    {fetchSuccess && <HiOutlineCheckCircle size={12} />}
                    {fetchStatus}
                  </p>
                )}
                
                {/* Error display */}
                {fetchError && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <HiOutlineExclamation className="flex-shrink-0 mt-0.5" size={14} /> 
                    <span>{fetchError}</span>
                  </p>
                )}
                
              </div>

              {/* Manual Entry Fields */}
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol *</label>
                  <input 
                    type="text" 
                    required 
                    value={newCoin.symbol} 
                    onChange={(e) => setNewCoin({...newCoin, symbol: e.target.value.toUpperCase()})} 
                    disabled={modalTitle.includes("Edit")} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 transition-shadow"
                    placeholder="BTC"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fallback Price ($)</label>
                  <input 
                    type="number" 
                    step="any" 
                    min="0"
                    value={newCoin.fallbackPrice} 
                    onChange={(e) => setNewCoin({...newCoin, fallbackPrice: e.target.value})} 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newCoin.name} 
                  onChange={(e) => setNewCoin({...newCoin, name: e.target.value})} 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  placeholder="Bitcoin"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                  <HiOutlinePhotograph /> Token Logo URL
                </label>
                <div className="relative flex items-center gap-3">
                  <input 
                    type="url" 
                    value={newCoin.logoUrl} 
                    onChange={(e) => setNewCoin({...newCoin, logoUrl: e.target.value})} 
                    placeholder="https://example.com/logo.png" 
                    className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 text-xs transition-shadow" 
                  />
                  {newCoin.logoUrl && (
                    <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                      <img 
                        src={newCoin.logoUrl} 
                        alt="Preview" 
                        className="w-full h-full object-contain" 
                        onError={(e) => e.target.style.display = 'none'} 
                      />
                    </div>
                  )}
                  {!newCoin.logoUrl && newCoin.symbol && (
                    <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                      <LogoRenderer 
                        symbol={newCoin.symbol} 
                        customLogo={null} 
                        bg="bg-purple-500/10" 
                        color="text-purple-500" 
                      />
                    </div>
                  )}
                </div>
                <p className="text-[9px] font-bold text-slate-400 pl-1 mt-1">
                  Direct image URL. Leave empty for auto-generated avatar.
                </p>
              </div>

              <button 
                type="submit" 
                className="w-full p-5 mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-600/20 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {modalTitle.includes('Edit') ? 'Update Token' : 'Add Token to Portfolio'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Save Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
        <button 
          onClick={handleSave} 
          disabled={isSaving || activeCoins.length === 0} 
          className={`w-full px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-10 flex items-center justify-center gap-3 border border-blue-400/50 ${
            !isSaving && activeCoins.length > 0 ? 'animate-pulse hover:animate-none' : ''
          }`}
        >
          {isSaving ? (
            <><HiOutlineRefresh className="animate-spin" size={20}/> SYNCING PORTFOLIO...</>
          ) : (
            <><HiOutlineCheckCircle size={20}/> SAVE {activeCoins.length} ASSET{activeCoins.length !== 1 ? 'S' : ''}</>
          )}
        </button>
      </div>

    </div>
  );
};

export default CryptoManager;