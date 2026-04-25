import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineSparkles, HiOutlineChevronDown, HiOutlineClock,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineDownload, 
  HiOutlineDocumentText, HiOutlineTable, HiOutlineShieldCheck,
  HiOutlineStar, HiOutlineFire, HiOutlineLightningBolt
} from 'react-icons/hi';
import { 
  FaBitcoin, FaGift, FaWallet, FaMedal, FaTrophy, FaBuilding,
  FaGem, FaChartLine, FaPiggyBank, FaRocket
} from 'react-icons/fa';

const microEarnPlatforms = [
  "CoinPayU", "FaucetPay", "Cointiply", "FreeBitcoin", "FireFaucet",
  "PipeFlare", "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", 
  "LarvelFaucet", "Coinpot", "Other Faucet"
];

const earningMethodsList = [
  "Direct Faucet", "PTC Ads", "Surveys", "Offerwalls", 
  "Shortlinks", "Lottery / Spin", "Games", "Freelance Micro-Tasks",
  "Staking (Micro)", "Referrals"
];

const popularCryptoWallets = [
  "Binance", "CoinDCX", "WazirX", "Coinbase", "Trust Wallet", 
  "MetaMask", "Phantom", "FaucetPay", "KuCoin", "OKX", "Kraken", "Mexc"
];

const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', logo: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  
  // Custom Verified Micro-Links
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://assets.coingecko.com/coins/images/13600/large/feyorra.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'pi-network', symbol: 'PI', name: 'Pi Network', logo: 'https://assets.coingecko.com/coins/images/31835/large/pi_network.jpg', fallbackPrice: 36.50, color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'ice-decentralized-future', symbol: 'ICE', name: 'Ice Network', logo: 'https://assets.coingecko.com/coins/images/34311/large/ice.png', fallbackPrice: 0.0035, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'jumptoken', symbol: 'JMPT', name: 'JumpToken', logo: 'https://assets.coingecko.com/coins/images/22397/large/jmpt.png', fallbackPrice: 0.95, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'coinex-token', symbol: 'CET', name: 'CoinEx Token', logo: 'https://assets.coingecko.com/coins/images/2538/large/coinex-token.png', fallbackPrice: 0.035, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
  { id: 'tether', symbol: 'CTC', name: 'NC Token', logo: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox', logo: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' }
];

const fetchWithRetry = async (url, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status !== 429) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (i === retries) return null;
    }
  }
  return null; 
};

const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  useEffect(() => { setHasError(false); }, [logoUrl]);
  if (!logoUrl || hasError) return <span className={`w-full h-full flex items-center justify-center font-black text-[10px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-600 dark:text-white'} rounded-full`}>{symbol?.toUpperCase()?.substring(0, 3)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain rounded-full bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-sm" onError={() => setHasError(true)} />;
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 FIXED: Local Device Timezone Generator
const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

// Premium Platform Leaderboard Card
const LeaderboardCard = ({ stat, currencySymbol }) => {
  const medals = ['🥇', '🥈', '🥉'];
  const isTop3 = stat.rank <= 3;
  
  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] p-5 bg-white dark:bg-slate-900 border shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col ${
      isTop3 ? 'border-yellow-300 dark:border-yellow-600 hover:border-yellow-400 dark:hover:border-yellow-500' : 'border-slate-200 dark:border-slate-800'
    }`}>
      {isTop3 && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-yellow-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      <div className="absolute -right-3 -bottom-3 text-7xl opacity-[0.04] dark:opacity-5 font-black italic select-none">#{stat.rank}</div>
      
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isTop3 && <span className="text-2xl drop-shadow-md">{medals[stat.rank - 1]}</span>}
            <h4 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">{stat.platform}</h4>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest ${isTop3 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            Rank {stat.rank}
          </span>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 mb-4 border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Earned Value</p>
            <p className={`font-black text-xl truncate ${isTop3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
              {currencySymbol}{stat.totalLiveValue.toLocaleString(undefined, {maximumFractionDigits: 2, minimumFractionDigits: 2})}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Withdrawals</p>
            <p className="font-black text-blue-600 dark:text-blue-400 text-xl">{stat.withdrawCount} <span className="text-[10px] text-slate-500">Times</span></p>
          </div>
        </div>
        
        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FaCoins/> Mined Assets</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(stat.coins).map(coin => (
               <span key={coin} className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                 {coin}
               </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MicroEarn = () => {
  const { user, baseCurrency = 'INR', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const availableCryptos = useMemo(() => {
    const customSymbols = selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
    return Array.from(new Set(["USDT", ...customSymbols])).map(s => s.toUpperCase());
  }, [selectedCryptos]);

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isMarketSyncing, setIsMarketSyncing] = useState(true);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomWallet, setIsCustomWallet] = useState(false);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const localTime = getLocalISOString();
  
  const [formData, setFormData] = useState({
    platform: microEarnPlatforms[0], methods: [], destinationWallet: popularCryptoWallets[0],
    coin: availableCryptos.length > 0 ? availableCryptos[0] : 'USDT', withdrawnAmount: '', receivedAmount: '', date: localTime, linkedRecordId: '', entryPrice: ''
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "microEarnLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => { setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchUserData = async () => { if (!user) return; const userSnap = await getDoc(doc(db, "users", user.uid)); if (userSnap.exists() && userSnap.data().customCoins) setCustomUserCoins(userSnap.data().customCoins); };
    fetchUserData();
  }, [user]);

  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    defaultCryptoDatabase.forEach(c => coinMap.set(c.symbol.toUpperCase(), c));
    selectedCryptos.forEach(c => { if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => { const existing = coinMap.get(c.symbol.toUpperCase()); coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo }); });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  const fetchMarketData = useCallback(async () => {
    setIsMarketSyncing(true);
    let usdToBase = 1;

    try {
      const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes && forexRes.ok) {
        const forexJson = await forexRes.json();
        usdToBase = parseFloat(forexJson.rates[baseCurrency]) || 1;
        setFiatRate(usdToBase);
      }
    } catch (error) { console.warn("Forex API Error."); }

    const coinsToFetch = Array.from(new Set([...transactions.map(t => t.coin), ...availableCryptos]));

    if (coinsToFetch.length > 0) {
      let cgJson = {};
      const normalCoins = [];
      const contractCoins = [];

      coinsToFetch.forEach(sym => {
        const upperSym = sym.toUpperCase();
        const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || { symbol: upperSym, id: sym.toLowerCase() };
        
        if (['ROX', 'CTC', 'HSH'].includes(upperSym)) {
           // Handled manually later
        } else if (dbCoin.fetchMode === 'contract' && dbCoin.contractAddress) {
           contractCoins.push(dbCoin);
        } else {
           normalCoins.push(dbCoin.id || dbCoin.symbol.toLowerCase());
        }
      });

      try {
        if (normalCoins.length > 0) {
          const uniqueIds = [...new Set(normalCoins)].join(',');
          const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${uniqueIds}&vs_currencies=usd`);
          if (cgRes && cgRes.ok) cgJson = await cgRes.json();
        }
      } catch (error) {}

      const priceMap = {};
      
      await Promise.all(coinsToFetch.map(async (sym) => {
        const upperSym = sym.toUpperCase();
        const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || { symbol: upperSym, id: sym.toLowerCase() };
        const searchId = dbCoin.id || upperSym.toLowerCase();
        const fallback = dbCoin.fallbackPrice ? parseFloat(dbCoin.fallbackPrice) : 0;
        
        let priceUsd = 0;

        if (['ROX', 'CTC'].includes(upperSym)) priceUsd = fallback > 0 ? fallback : 1.00;
        else if (upperSym === 'HSH') priceUsd = fallback > 0 ? fallback : 0.0001; 
        else if (dbCoin.fetchMode === 'contract' && dbCoin.contractAddress) {
          try {
            const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${dbCoin.contractAddress}`);
            if (dexRes && dexRes.ok) {
              const dexData = await dexRes.json();
              if (dexData.pairs?.length > 0) priceUsd = parseFloat(dexData.pairs[0].priceUsd);
            }
          } catch(e) {}
        } 
        else {
          priceUsd = cgJson[searchId]?.usd || 0;
        }

        if (!priceUsd && BINANCE_SAFE_COINS.includes(upperSym)) {
          try {
            const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
            if (bRes.ok) {
              const bData = await bRes.json();
              priceUsd = parseFloat(bData.price);
            }
          } catch(e) {}
        }

        if (!priceUsd && fallback > 0) priceUsd = fallback;
        priceMap[upperSym] = { priceUSD: priceUsd };
      }));
      
      setLivePrices(priceMap);
    }
    setIsMarketSyncing(false);
  }, [transactions, availableCryptos, baseCurrency, fullDatabase]);

  useEffect(() => {
    if (!isLoading && fullDatabase.length > 0) { 
      fetchMarketData(); 
      const interval = setInterval(fetchMarketData, 60000); 
      return () => clearInterval(interval); 
    }
  }, [isLoading, fullDatabase, fetchMarketData]);

  const fetchLivePriceForForm = async () => {
    if (!formData.coin) return;
    setIsFetchingLive(true);
    let usdToBase = 1;
    try {
      const forexRes = await fetchWithRetry('https://api.exchangerate-api.com/v4/latest/USD');
      if (forexRes && forexRes.ok) usdToBase = parseFloat((await forexRes.json()).rates[baseCurrency]) || 1;
      
      const upperSym = formData.coin.toUpperCase();
      const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || { symbol: upperSym, id: formData.coin.toLowerCase() };
      const searchId = dbCoin.id || upperSym.toLowerCase();
      const fallback = dbCoin.fallbackPrice ? parseFloat(dbCoin.fallbackPrice) : 0;
      
      let priceInUsd = 0;
      if (['ROX', 'CTC'].includes(upperSym)) priceInUsd = fallback > 0 ? fallback : 1.00;
      else if (dbCoin.fetchMode === 'contract' && dbCoin.contractAddress) {
        const dexRes = await fetchWithRetry(`https://api.dexscreener.com/latest/dex/tokens/${dbCoin.contractAddress}`);
        if (dexRes && dexRes.ok) { const dexData = await dexRes.json(); if (dexData.pairs?.length > 0) priceInUsd = parseFloat(dexData.pairs[0].priceUsd); }
      } else {
        const cgRes = await fetchWithRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${searchId}&vs_currencies=usd`);
        if (cgRes && cgRes.ok) { const cgJson = await cgRes.json(); priceInUsd = cgJson[searchId]?.usd || 0; }
      }

      if (!priceInUsd) {
        const bRes = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${upperSym}USDT`);
        if (bRes && bRes.ok) priceInUsd = parseFloat((await bRes.json()).price);
      }

      if (!priceInUsd && fallback > 0) priceInUsd = fallback;
      
      if (priceInUsd) setFormData(prev => ({ ...prev, entryPrice: (priceInUsd * usdToBase).toFixed(6).replace(/\.?0+$/, '') }));
    } catch (error) { 
      alert("Network Error! Could not fetch live price."); 
    } finally { setIsFetchingLive(false); }
  };

  const platformRankings = useMemo(() => {
    const stats = {};
    transactions.forEach(t => {
      const plat = t.platform;
      if (!stats[plat]) stats[plat] = { platform: plat, totalLiveValue: 0, withdrawCount: 0, coins: new Set(), coinQuantities: {} };
      const rQty = parseFloat(t.receivedAmount) || 0;
      stats[plat].withdrawCount += 1;
      stats[plat].coins.add(t.coin.toUpperCase());
      stats[plat].coinQuantities[t.coin.toUpperCase()] = (stats[plat].coinQuantities[t.coin.toUpperCase()] || 0) + rQty;
    });
    Object.values(stats).forEach(stat => {
      let val = 0;
      Object.entries(stat.coinQuantities).forEach(([coinSymbol, qty]) => { val += (qty * (livePrices[coinSymbol]?.priceUSD || 0) * fiatRate); });
      stat.totalLiveValue = val;
    });
    const sorted = Object.values(stats).sort((a, b) => b.totalLiveValue - a.totalLiveValue);
    return sorted.map((stat, index) => {
      return { ...stat, rank: index + 1, coinsList: Array.from(stat.coins).join(', ') };
    });
  }, [transactions, livePrices, fiatRate]);

  const totalVaultValueBase = platformRankings.reduce((total, stat) => total + stat.totalLiveValue, 0);

  const analyticsData = useMemo(() => {
    const platformGroups = {};
    const processed = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    processed.forEach(t => {
      const plat = t.platform;
      if (!platformGroups[plat]) platformGroups[plat] = { lastDate: null };
      let daysSinceLast = null;
      if (platformGroups[plat].lastDate) daysSinceLast = Math.ceil(Math.abs(new Date(t.date) - new Date(platformGroups[plat].lastDate)) / (1000 * 60 * 60 * 24));
      platformGroups[plat].lastDate = t.date;
      const coinPriceUSD = livePrices[t.coin.toUpperCase()]?.priceUSD || 0;
      const currentLiveBaseAmount = (parseFloat(t.receivedAmount) || 0) * coinPriceUSD * fiatRate;
      t.daysSinceLast = daysSinceLast;
      t.currentLiveBaseAmount = currentLiveBaseAmount;
    });
    return processed.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, livePrices, fiatRate]);

  const handleDownloadReport = (format) => {
    const filtered = analyticsData.filter(t => t.coin.toLowerCase().includes(searchTerm.toLowerCase()) || t.platform?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (filtered.length === 0) return alert("No records found.");
    const reportData = filtered.map(rec => ({
      date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
      platform: rec.platform,
      coin: rec.coin,
      received: `${rec.receivedAmount} ${rec.coin}`,
      liveValue: `${currencySymbol}${(rec.currentLiveBaseAmount || 0).toFixed(2)}`
    }));
    const columns = [{ header: 'Date', key: 'date' }, { header: 'Platform', key: 'platform' }, { header: 'Coin', key: 'coin' }, { header: 'Received', key: 'received' }, { header: 'Live Value', key: 'liveValue' }];
    if (format === 'pdf') downloadPDFReport(reportData, columns, 'Micro_Earn', 'Micro Earn Report');
    else downloadExcelReport(reportData, columns, 'Micro_Earn');
  };

  const handleMethodToggle = (method) => {
    setFormData(prev => ({ ...prev, methods: prev.methods.includes(method) ? prev.methods.filter(m => m !== method) : [...prev.methods, method] }));
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault(); if (!user) return;
    const wQty = parseFloat(formData.withdrawnAmount); const rQty = parseFloat(formData.receivedAmount);
    if (wQty <= 0 || rQty <= 0) return alert("Amounts must be greater than zero.");
    if (!formData.platform.trim()) return alert("Please enter a website/platform name!");
    if (formData.methods.length === 0) return alert("Please select at least one earning method.");
    
    setIsSaving(true);
    const timestamp = editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime();
    const formattedDate = new Date(formData.date).toISOString().split('T')[0];
    const uniqueId = formData.linkedRecordId || `MICRO_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    const currentPriceUSD = livePrices[formData.coin.toUpperCase()]?.priceUSD || 0;
    const effectiveExchangeRate = currentPriceUSD * fiatRate;
    const finalBaseValue = rQty * effectiveExchangeRate;
    
    const microRecord = { 
      platform: formData.platform, methods: formData.methods, destinationWallet: formData.destinationWallet, 
      coin: formData.coin, withdrawnAmount: wQty, receivedAmount: rQty, fee: wQty - rQty, 
      earnedBaseValue: finalBaseValue, date: formData.date, timestamp, linkedRecordId: uniqueId 
    };
    
    const cryptoRecord = { 
      type: 'in', coin: formData.coin, quantity: rQty, platform: formData.destinationWallet, 
      reason: `Withdrawal: ${formData.platform}`, referenceNo: uniqueId, date: formData.date.split('T')[0], 
      timestamp, isMicroEarn: true, linkId: uniqueId 
    };
    
    const incomeRecord = { 
      title: `Yield: ${formData.platform}`, category: "Crypto APR / Yield", vault: 'crypto', 
      subWallet: formData.destinationWallet, cryptoPlatform: formData.destinationWallet, asset: formData.coin, 
      amount: rQty, exchangeRate: effectiveExchangeRate, finalBaseAmount: finalBaseValue, 
      date: formData.date.split('T')[0], timestamp, linkId: uniqueId, isSplit: false 
    };
    
    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "microEarnLogs", editingId), microRecord, { merge: true });
        
        const cQ = query(collection(db, "users", user.uid, "cryptoWalletLogs"), where("linkId", "==", uniqueId));
        const cSnap = await getDocs(cQ);
        if (!cSnap.empty) await setDoc(doc(db, "users", user.uid, "cryptoWalletLogs", cSnap.docs[0].id), cryptoRecord, { merge: true });
        else await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), cryptoRecord);

        const iQ = query(collection(db, "users", user.uid, "incomeLogs"), where("linkId", "==", uniqueId));
        const iSnap = await getDocs(iQ);
        if (!iSnap.empty) await setDoc(doc(db, "users", user.uid, "incomeLogs", iSnap.docs[0].id), incomeRecord, { merge: true });
        else await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
      } else {
        await addDoc(collection(db, "users", user.uid, "microEarnLogs"), microRecord);
        await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), cryptoRecord);
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), incomeRecord);
      }
      closeModal();
    } catch (error) { alert("Failed to save transaction."); } finally { setIsSaving(false); }
  };

  const handleEdit = (rec) => { 
    setIsCustomPlatform(!microEarnPlatforms.includes(rec.platform)); 
    setIsCustomWallet(!popularCryptoWallets.includes(rec.destinationWallet)); 
    setFormData({ 
      platform: rec.platform, methods: rec.methods || [], destinationWallet: rec.destinationWallet, 
      coin: rec.coin, withdrawnAmount: rec.withdrawnAmount, receivedAmount: rec.receivedAmount, 
      date: rec.date, linkedRecordId: rec.linkedRecordId || '', entryPrice: ''
    }); 
    setEditingId(rec.id); 
    setIsModalOpen(true); 
  };
  
  const initiateDelete = (rec) => { setDeleteContext(rec); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault(); 
    if (!pinInput.trim()) return setPinError("Please enter your PIN."); 
    setIsVerifying(true);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid)); const userData = userSnap.data();
      const hashedInput = await hashPIN(pinInput.trim()); const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin;
      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) { setPinError("Incorrect PIN."); setIsVerifying(false); return; }
      
      await deleteDoc(doc(db, "users", user.uid, "microEarnLogs", deleteContext.id));
      
      if (deleteContext.linkedRecordId) { 
        for (const colName of ["cryptoWalletLogs", "incomeLogs"]) { 
          const q = query(collection(db, "users", user.uid, colName), where("linkId", "==", deleteContext.linkedRecordId));
          const snap = await getDocs(q); 
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, colName, d.id))); 
        } 
      }
      setDeleteContext(null);
    } catch (error) { setPinError("Verification failed."); } finally { setIsVerifying(false); }
  };

  const openModal = () => { 
    setEditingId(null); setIsCustomPlatform(false); setIsCustomWallet(false); 
    setFormData({ platform: microEarnPlatforms[0], methods: [], destinationWallet: popularCryptoWallets[0], coin: availableCryptos[0] || 'USDT', withdrawnAmount: '', receivedAmount: '', date: getLocalISOString(), linkedRecordId: '', entryPrice: '' }); 
    setIsModalOpen(true); 
  };
  
  const closeModal = () => setIsModalOpen(false);

  const filteredLogs = analyticsData.filter(t => t.coin.toLowerCase().includes(searchTerm.toLowerCase()) || t.platform?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(234,179,8,0.15),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg"><FaTrophy size={24} className="text-white" /></div>
                <div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Website Rankings</h1><p className="text-sm font-medium text-slate-400">Smart leaderboard for micro-earn platforms</p></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative group hidden sm:block">
                <button className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-widest backdrop-blur-sm transition-all border border-white/10"><HiOutlineDownload size={16} /> Report</button>
                <div className="absolute top-full right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
                  <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg"><HiOutlineDocumentText className="text-rose-400" size={16}/> PDF</button>
                  <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg"><HiOutlineTable className="text-emerald-400" size={16}/> Excel</button>
                </div>
              </div>
              <button onClick={openModal} className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/30 transition-all active:scale-95"><HiOutlinePlus size={18} /> Log Withdrawal</button>
            </div>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Yield</p><p className="text-sm md:text-lg font-black text-white truncate">{currencySymbol}{totalVaultValueBase.toLocaleString(undefined, {maximumFractionDigits: 0})}</p></div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Platforms Tracked</p><p className="text-sm md:text-lg font-black text-white truncate">{platformRankings.length}</p></div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Withdrawals</p><p className="text-sm md:text-lg font-black text-white truncate">{transactions.length}</p></div>
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><FaMedal className="text-yellow-500" /> Live Platform Leaderboard</h3>
          {platformRankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800"><FaTrophy className="text-4xl text-slate-300 dark:text-slate-700 mb-3" /><p className="text-sm font-black text-slate-500 uppercase tracking-widest">No data yet</p><p className="text-xs text-slate-400 mt-1 font-bold">Log your first withdrawal</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {platformRankings.map((stat) => <LeaderboardCard key={stat.platform} stat={stat} currencySymbol={currencySymbol} />)}
            </div>
          )}
        </div>

        {/* Search & Table */}
        <div className="relative"><HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Search by platform or coin..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all shadow-sm" /></div>

        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                <tr><th className="p-4 pl-6 whitespace-nowrap">Platform</th><th className="p-4 whitespace-nowrap">Methods</th><th className="p-4 whitespace-nowrap">Frequency</th><th className="p-4 text-right whitespace-nowrap">Live Value</th><th className="p-4 text-right whitespace-nowrap">Received</th><th className="p-4 pr-6 text-right whitespace-nowrap">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr><td colSpan={6} className="p-10 text-center"><HiOutlineRefresh className="animate-spin mx-auto text-2xl text-yellow-500" /></td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-slate-500 font-bold">No records found</td></tr>
                ) : filteredLogs.map((rec) => {
                  const coinObj = fullDatabase.find(c => c.symbol.toUpperCase() === rec.coin.toUpperCase());
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="p-4 pl-6 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0"><LogoRenderer symbol={rec.coin} apiImage={null} logoUrl={coinObj?.logo} bg={coinObj?.bg} color={coinObj?.color} /></div>
                          <div className="min-w-0"><p className="font-black dark:text-white text-sm truncate">{rec.platform}</p><p className="text-[9px] font-bold text-slate-500 mt-0.5">{formatGlobalDate && rec.date ? formatGlobalDate(rec.date.split('T')[0], 'short') : rec.date}</p></div>
                        </div>
                      </td>
                      <td className="p-4 min-w-[150px]"><div className="flex flex-wrap gap-1">{(rec.methods || []).map((m, i) => <span key={i} className="text-[8px] px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-bold rounded border border-yellow-200/50 dark:border-yellow-500/20">{m}</span>)}</div></td>
                      <td className="p-4">{rec.daysSinceLast !== null ? <p className={`text-xs font-black ${rec.daysSinceLast > 15 ? 'text-rose-500' : 'text-emerald-500'}`}>{rec.daysSinceLast} days</p> : <span className="text-xs font-bold text-slate-400">First Time</span>}</td>
                      <td className="p-4 text-right"><p className="text-sm font-black text-slate-800 dark:text-white">{currencySymbol}{(rec.currentLiveBaseAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></td>
                      <td className="p-4 text-right"><p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">+{rec.receivedAmount} <span className="text-[10px] text-slate-500">{rec.coin}</span></p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">To {rec.destinationWallet}</p></td>
                      <td className="p-4 pr-6"><div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEdit(rec)} className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-500 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={14}/></button><button onClick={() => initiateDelete(rec)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-500/30 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={14}/></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🚀 UPGRADED ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] border border-slate-300 dark:border-slate-700 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            
            <div className="px-6 py-5 bg-gradient-to-r from-yellow-500 to-amber-600 text-white flex justify-between items-center sticky top-0 z-10 shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><FaTrophy size={18}/> {editingId ? 'Edit Record' : 'Log Withdrawal'}</h3>
              <button onClick={closeModal} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20} /></button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Earning Platform (Source)</label>
                {isCustomPlatform ? (
                  <div className="flex gap-2">
                    <input type="text" autoFocus required value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} placeholder="Platform name..." className="flex-1 p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold dark:text-white outline-none shadow-sm" />
                    <button type="button" onClick={() => { setIsCustomPlatform(false); setFormData({...formData, platform: microEarnPlatforms[0]}); }} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 border border-slate-300 dark:border-slate-700"><HiOutlineX size={20} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><FaBuilding size={16}/></div>
                    <select required value={microEarnPlatforms.includes(formData.platform) ? formData.platform : 'CUSTOM'} onChange={(e) => { if(e.target.value==='CUSTOM'){ setIsCustomPlatform(true); setFormData({...formData, platform: ''}); } else { setFormData({...formData, platform: e.target.value}); } }} className="w-full pl-12 pr-10 py-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold dark:text-white outline-none cursor-pointer appearance-none shadow-sm">
                      {microEarnPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="CUSTOM" className="font-black text-amber-600">✨ Add Custom Source</option>
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Earning Methods Used</label>
                <div className="flex flex-wrap gap-2">
                  {earningMethodsList.map(method => (
                    <button type="button" key={method} onClick={() => handleMethodToggle(method)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${formData.methods.includes(method) ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-400 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset (Coin)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                      <LogoRenderer symbol={formData.coin} logoUrl={fullDatabase.find(c=>c.symbol===formData.coin)?.logo} bg={fullDatabase.find(c=>c.symbol===formData.coin)?.bg} color={fullDatabase.find(c=>c.symbol===formData.coin)?.color} />
                    </div>
                    <select required disabled={editingId} value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none shadow-sm cursor-pointer disabled:opacity-50">
                      {availableCryptos.length > 0 ? availableCryptos.map(c => {
                        const dbCoin = fullDatabase.find(x => x.symbol === c) || {};
                        return <option key={c} value={c}>{dbCoin.name || c} ({c})</option>;
                      }) : <option value="USDT">USDT (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                  {/* Live Price Display */}
                  <div className="mt-1.5 ml-2">
                    <p className="text-[9px] font-bold text-slate-500">Live Price: <span className="text-slate-700 dark:text-slate-300">${(livePrices[formData.coin]?.priceUSD || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</span></p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Destination Wallet</label>
                  {isCustomWallet ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus required value={formData.destinationWallet} onChange={(e) => setFormData({...formData, destinationWallet: e.target.value})} placeholder="Wallet name..." className="flex-1 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none shadow-sm" />
                      <button type="button" onClick={() => { setIsCustomWallet(false); setFormData({...formData, destinationWallet: popularCryptoWallets[0]}); }} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 border border-slate-300 dark:border-slate-700"><HiOutlineX size={20} /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"><FaWallet size={16}/></div>
                      <select required value={popularCryptoWallets.includes(formData.destinationWallet) ? formData.destinationWallet : 'CUSTOM'} onChange={(e) => { if(e.target.value==='CUSTOM'){ setIsCustomWallet(true); setFormData({...formData, destinationWallet: ''}); } else { setFormData({...formData, destinationWallet: e.target.value}); } }} className="w-full pl-12 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer appearance-none shadow-sm">
                        {popularCryptoWallets.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="CUSTOM" className="font-black text-emerald-600">✨ Custom Wallet</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 rounded-2xl">
                <div>
                  <label className="text-[10px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest ml-1">Total Withdrawn</label>
                  <input type="number" step="any" required value={formData.withdrawnAmount} onChange={(e) => setFormData({...formData, withdrawnAmount: e.target.value})} placeholder="e.g. 50" className="w-full p-4 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/50 rounded-xl font-black text-lg dark:text-white outline-none focus:ring-2 focus:ring-amber-500/50 shadow-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest ml-1">Actually Received (Net)</label>
                  <input type="number" step="any" required value={formData.receivedAmount} onChange={(e) => setFormData({...formData, receivedAmount: e.target.value})} placeholder="e.g. 48.5" className="w-full p-4 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/50 rounded-xl font-black text-lg text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm" />
                </div>
                <div className="sm:col-span-2 pt-2 border-t border-amber-200/50 dark:border-amber-800/50">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Calculated Fee: {Math.max(0, (parseFloat(formData.withdrawnAmount) || 0) - (parseFloat(formData.receivedAmount) || 0)).toFixed(6).replace(/\.?0+$/, '')} {formData.coin}</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1"><FaCoins/> Entry Price ({currencySymbol})</label>
                  <button type="button" onClick={fetchLivePriceForForm} disabled={isFetchingLive} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50 hover:bg-blue-700 transition-colors shadow-sm">
                    <HiOutlineRefresh className={isFetchingLive ? "animate-spin" : ""} size={14} /> Fetch Live
                  </button>
                </div>
                <input type="number" step="any" required value={formData.entryPrice} onChange={(e) => setFormData({...formData, entryPrice: e.target.value})} placeholder="Average buy price..." className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700/50 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date & Time</span>
                  <span className="text-amber-600 dark:text-amber-400">{formatGlobalDate && formData.date ? formatGlobalDate(formData.date.split('T')[0], 'short') : ''}</span>
                </label>
                <input type="datetime-local" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-amber-500/50" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest bg-gradient-to-r from-yellow-500 to-amber-600 shadow-xl shadow-yellow-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-xl" /> : <HiOutlineShieldCheck size={20} />}
                  {isSaving ? 'Processing...' : (editingId ? 'Update Record' : 'Save Withdrawal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-200 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200 dark:border-rose-500/30"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-xs font-bold text-slate-500 mt-2">Deleting this record will alter your total {deleteContext.coin} tracking history.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">You are permanently deleting <span className="font-black">{deleteContext.receivedAmount} {deleteContext.coin}</span> received from {deleteContext.platform}. Linked Vault & Income records will also be reversed automatically.</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Security PIN</label>
                <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="••••••" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm" />
                {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-2">{pinError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-sm">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-lg shadow-rose-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : null} Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MicroEarn;