import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, getDocs, where, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineSparkles, HiOutlineChevronDown, HiOutlineClock,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineDownload, 
  HiOutlineDocumentText, HiOutlineTable, HiOutlineLightningBolt, HiOutlineGift,
  HiOutlineShieldCheck, HiOutlineArrowUp, HiOutlineUserGroup
} from 'react-icons/hi';

import { 
  FaBitcoin, FaGift, FaWallet, FaMedal, FaTrophy, FaPiggyBank, 
  FaLeaf, FaExchangeAlt, FaCoins, FaGem, FaChartLine
} from 'react-icons/fa';

const stakingPlatforms = [
  "FaucetPay", "DutchyCorp", "NC Wallet", "CryptoTab", "Binance Earn", 
  "Trust Wallet", "CoinDCX Earn", "KuCoin Earn", "Phantom (Solana)", "Other"
];

const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://assets.coingecko.com/coins/images/13600/large/feyorra.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'pi-network', symbol: 'PI', name: 'Pi Network', logo: 'https://assets.coingecko.com/coins/images/31835/large/pi_network.jpg', fallbackPrice: 36.50, color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'ice-decentralized-future', symbol: 'ICE', name: 'Ice Network', logo: 'https://assets.coingecko.com/coins/images/34311/large/ice.png', fallbackPrice: 0.0035, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'jumptoken', symbol: 'JMPT', name: 'JumpToken', logo: 'https://assets.coingecko.com/coins/images/22397/large/jmpt.png', fallbackPrice: 0.95, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'taraxa', symbol: 'TARA', name: 'Taraxa', logo: 'https://assets.coingecko.com/coins/images/14409/large/taraxa.png', fallbackPrice: 0.0045, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
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
  if (!logoUrl || hasError) return <span className={`w-full h-full flex items-center justify-center font-black text-[10px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-500'} rounded-full`}>{symbol?.toUpperCase()?.substring(0, 2)}</span>;
  return <img src={logoUrl} alt={symbol} className="w-full h-full object-contain p-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm" onError={() => setHasError(true)} />;
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const StakingAndYield = () => {
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [stakes, setStakes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [customUserCoins, setCustomUserCoins] = useState([]); 
  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isMarketSyncing, setIsMarketSyncing] = useState(true);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeClaimStake, setActiveClaimStake] = useState(null);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const localTime = new Date().toISOString().substring(0, 16);
  
  const cryptoSymbols = useMemo(() => selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean), [selectedCryptos]);
  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['USDT', 'BNB', 'FEY', 'BTC'];
  const rewardOptions = Array.from(new Set([...activeCryptos, 'CTC', 'USDT']));

  const [formData, setFormData] = useState({ earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0], poolCoin2: activeCryptos[1] || 'USDT', platform: stakingPlatforms[0], principalAmount: '', poolPrincipal2: '', apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: localTime, entryPrice: '' });
  const [claimData, setClaimData] = useState({ claimCoin: '', amountClaimed: '', platformFeePercent: '10', date: localTime, multipleClaims: [] });

  useEffect(() => { 
    if (!user) return; 
    const q = query(collection(db, "users", user.uid, "stakingLogs"), orderBy("timestamp", "desc")); 
    const unsub = onSnapshot(q, (snap) => { setStakes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setIsLoading(false); }); 
    return () => unsub(); 
  }, [user]);
  
  useEffect(() => { 
    const f = async () => { if (!user) return; const sn = await getDoc(doc(db, "users", user.uid)); if (sn.exists() && sn.data().customCoins) setCustomUserCoins(sn.data().customCoins); }; 
    f(); 
  }, [user]);

  const fullDatabase = useMemo(() => {
    const m = new Map(); defaultCryptoDatabase.forEach(c => m.set(c.symbol.toUpperCase(), c));
    selectedCryptos.forEach(c => { if (typeof c === 'object') m.set(c.symbol.toUpperCase(), c); });
    customUserCoins.forEach(c => { const e = m.get(c.symbol.toUpperCase()); m.set(c.symbol.toUpperCase(), { ...e, ...c, logo: c.logo || e?.logo }); });
    return Array.from(m.values());
  }, [customUserCoins, selectedCryptos]);

  // 🚀 SYNCED 5-LAYER FETCHING ENGINE FOR TRACKING GRID
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

    const coinsToFetch = Array.from(new Set([...activeCryptos, formData.coin, formData.rewardCoin, formData.poolCoin2, ...stakes.flatMap(s => [s.coin, s.rewardCoin, s.poolCoin2])])).filter(Boolean);

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
        priceMap[upperSym] = priceUsd * usdToBase;
      }));
      
      setLivePrices(priceMap);
    }
    setIsMarketSyncing(false);
  }, [stakes, activeCryptos, baseCurrency, formData.coin, formData.rewardCoin, formData.poolCoin2, fullDatabase]);

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

  const getLivePrice = (s) => {
      if(!s || s === 'N/A') return 0;
      const price = livePrices[s?.toUpperCase()];
      return (price !== undefined && !isNaN(price)) ? price : (0.01 * fiatRate); 
  };
  
  const projection = useMemo(() => {
    if (formData.earningType === 'affiliate') return { dailyFiat: 0, monthlyFiat: 0, yearlyFiat: 0 };

    const principal1 = parseFloat(formData.principalAmount) || 0;
    const price1 = getLivePrice(formData.coin);
    let tvlFiat = principal1 * price1;

    if (formData.earningType === 'pool') {
      const principal2 = parseFloat(formData.poolPrincipal2) || 0;
      const price2 = getLivePrice(formData.poolCoin2);
      tvlFiat += (principal2 * price2);
    }

    const apr = parseFloat(formData.apr) || 0;
    const yearlyFiat = (tvlFiat * apr) / 100;
    const dailyFiat = yearlyFiat / 365;

    return { dailyFiat, monthlyFiat: dailyFiat * 30, yearlyFiat };
  }, [formData, livePrices, fiatRate]);

  const analytics = useMemo(() => {
    let tvl = 0, rewards = 0, daily = 0;
    stakes.forEach(s => {
      if (s.earningType !== 'affiliate') { 
        let v = (parseFloat(s.principalAmount)||0) * getLivePrice(s.coin); 
        if (s.earningType === 'pool') v += (parseFloat(s.poolPrincipal2)||0) * getLivePrice(s.poolCoin2); 
        tvl += v; 
        daily += ((v * (parseFloat(s.apr)||0)) / 100) / 365; 
      }
      if (s.claimedHistory) s.claimedHistory.forEach(h => { rewards += (parseFloat(h.amount)||0) * getLivePrice(h.coin); });
    });
    return { totalValueLocked: tvl, totalRewardsClaimedFiat: rewards, totalDailyPassiveIncome: daily };
  }, [stakes, livePrices]);

  const handleDownloadReport = (format) => {
    if (stakes.length === 0) return alert("No streams found.");
    const data = stakes.map(r => ({ startDate: formatGlobalDate ? formatGlobalDate(r.startDate, 'short') : r.startDate, platform: r.platform, type: r.earningType, principal: r.earningType === 'pool' ? `${r.principalAmount} ${r.coin} + ${r.poolPrincipal2} ${r.poolCoin2}` : r.earningType === 'stake' ? `${r.principalAmount} ${r.coin}` : 'N/A', apr: r.earningType === 'affiliate' ? 'Variable' : `${r.apr}%`, harvested: r.claimedHistory ? r.claimedHistory.reduce((a,h) => a + parseFloat(h.amount||0), 0).toFixed(4) : '0' }));
    const cols = [{ header: 'Date', key: 'startDate' }, { header: 'Platform', key: 'platform' }, { header: 'Type', key: 'type' }, { header: 'Principal', key: 'principal' }, { header: 'APR', key: 'apr' }, { header: 'Harvested', key: 'harvested' }];
    if (format === 'pdf') downloadPDFReport(data, cols, 'Yield_Farming', 'Staking Report'); else downloadExcelReport(data, cols, 'Yield_Farming');
  };

  const handleSaveStake = async (e) => { 
    e.preventDefault(); if (!user) return; setIsSaving(true); 
    const d = { 
      earningType: formData.earningType, platform: formData.platform, 
      apr: formData.earningType === 'affiliate' ? 0 : parseFloat(formData.apr), 
      lockPeriod: formData.lockPeriod === 'Custom' ? formData.customLockDays : formData.lockPeriod, 
      startDate: formData.startDate.split('T')[0], timestamp: editingId ? stakes.find(s=>s.id===editingId)?.timestamp : new Date(formData.startDate).getTime(), 
      coin: formData.earningType === 'affiliate' ? 'N/A' : formData.coin, 
      principalAmount: formData.earningType === 'affiliate' ? 0 : parseFloat(formData.principalAmount), 
      rewardCoin: formData.earningType === 'affiliate' ? 'Variable' : formData.earningType === 'pool' ? 'Dual' : formData.rewardCoin 
    }; 
    if (formData.earningType === 'pool') { d.poolCoin2 = formData.poolCoin2; d.poolPrincipal2 = parseFloat(formData.poolPrincipal2); } 
    try { 
      if (editingId) await setDoc(doc(db, "users", user.uid, "stakingLogs", editingId), d, { merge: true }); 
      else await addDoc(collection(db, "users", user.uid, "stakingLogs"), { ...d, claimedHistory: [] }); 
      closeStakeModal(); 
    } catch(e) { alert("Failed"); } finally { setIsSaving(false); } 
  };

  const handleClaimReward = async (e) => { 
    e.preventDefault(); if (!user || !activeClaimStake) return; setIsSaving(true); 
    const fee = parseFloat(claimData.platformFeePercent)||0; const ts = new Date(claimData.date).getTime(); 
    const isAffiliate = activeClaimStake.earningType === 'affiliate';
    const sourceString = isAffiliate ? 'Affiliate Network' : (activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `Staking (${activeClaimStake.apr}%)`);

    try { 
      let claims = activeClaimStake.earningType === 'affiliate' ? claimData.multipleClaims.filter(c=>c.amountClaimed>0&&c.claimCoin) : [{ claimCoin: claimData.claimCoin, amountClaimed: parseFloat(claimData.amountClaimed) }]; 
      for (const c of claims) { 
        const net = c.amountClaimed - (c.amountClaimed*(fee/100)); 
        const pr = getLivePrice(c.claimCoin) / fiatRate; // Convert back to USD for proper logging
        const uid = `YIELD_${ts}_${Math.random().toString(36).slice(2,8)}`; 
        await setDoc(doc(db, "users", user.uid, "stakingLogs", activeClaimStake.id), { claimedHistory: arrayUnion({ amount: net, coin: c.claimCoin, date: claimData.date, timestamp: ts }) }, { merge: true }); 
        await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), { type: 'in', coin: c.claimCoin, quantity: net, platform: activeClaimStake.platform, reason: `${sourceString} Reward`, referenceNo: uid, date: claimData.date, timestamp: ts, stakeId: activeClaimStake.id, isMicroEarn: true, linkId: uid }); 
        await addDoc(collection(db, "users", user.uid, "incomeLogs"), { title: `Yield: ${c.claimCoin}`, category: "Crypto Staking Rewards", vault: 'crypto', subWallet: activeClaimStake.platform, cryptoPlatform: activeClaimStake.platform, asset: c.claimCoin, amount: net, exchangeRate: pr, finalBaseAmount: net*pr*fiatRate, date: claimData.date, timestamp: ts, linkedIncomeId: uid, stakeId: activeClaimStake.id, isMicroEarn: true }); 
      } 
      closeClaimModal(); 
    } catch(e) { alert("Failed"); } finally { setIsSaving(false); } 
  };

  const executeSecureDelete = async (e) => { 
    e.preventDefault(); if (!pinInput.trim()) return setPinError("Enter PIN."); setIsVerifying(true); 
    try { 
      const sn = await getDoc(doc(db, "users", user.uid)); const hp = await hashPIN(pinInput.trim()); const sp = sn.data()?.security?.pinHash || sn.data()?.securityPin || sn.data()?.pin; 
      if (sp && sp !== hp && sp !== pinInput.trim()) { setPinError("Incorrect PIN."); setIsVerifying(false); return; } 
      await deleteDoc(doc(db, "users", user.uid, "stakingLogs", deleteContext.id)); 
      for (const cn of ["cryptoWalletLogs", "incomeLogs"]) { const qs = await getDocs(query(collection(db, "users", user.uid, cn), where("stakeId", "==", deleteContext.id))); qs.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, cn, d.id))); } 
      setDeleteContext(null); 
    } catch(e) { setPinError("Error."); } finally { setIsVerifying(false); } 
  };

  const closeStakeModal = () => { setIsStakeModalOpen(false); setEditingId(null); setFormData({ earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0], poolCoin2: activeCryptos[1]||'USDT', platform: stakingPlatforms[0], principalAmount: '', poolPrincipal2: '', apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: localTime }); };
  const closeClaimModal = () => { setIsClaimModalOpen(false); setActiveClaimStake(null); setClaimData({ claimCoin: '', amountClaimed: '', platformFeePercent: '10', date: localTime, multipleClaims: [] }); };
  const openClaimModalFor = (rec) => { setActiveClaimStake(rec); setClaimData({ claimCoin: rec.earningType==='pool'?rec.coin:(rec.rewardCoin||rec.coin), amountClaimed: '', platformFeePercent: '10', date: localTime, multipleClaims: rec.earningType==='affiliate'?[{ claimCoin: activeCryptos[0]||'BTC', amountClaimed: '' }]:[] }); setIsClaimModalOpen(true); };
  const addClaimRow = () => setClaimData(p=>({...p, multipleClaims:[...p.multipleClaims,{claimCoin:activeCryptos[0],amountClaimed:''}]}));
  const updateClaimRow = (i,f,v) => { const u=[...claimData.multipleClaims]; u[i][f]=v; setClaimData(p=>({...p,multipleClaims:u})); };
  const removeClaimRow = (i) => setClaimData(p=>({...p,multipleClaims:p.multipleClaims.filter((_,j)=>j!==i)}));

  const isAffiliateModeModal = activeClaimStake && activeClaimStake.earningType === 'affiliate';

  return (
    <div className="h-full min-h-screen overflow-y-auto pb-24">
      <div className="pt-8 md:pt-12 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto px-4 md:px-6">
        
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 md:p-8 shadow-2xl border border-slate-700/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(147,51,234,0.1),transparent_70%)]" />
          <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg"><HiOutlineLightningBolt size={24} className="text-white" /></div>
                <div><h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Earn & Farming Vault</h1><p className="text-sm font-medium text-slate-400">Track staking, LP pools & affiliate yields</p></div>
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
              <button onClick={() => setIsStakeModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-purple-500/30 transition-all active:scale-95"><HiOutlinePlus size={18} /> Add Stream</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] shadow-xl border border-slate-700/50 relative overflow-hidden md:col-span-2">
            <div className="absolute right-[-5%] top-[-10%] opacity-5 text-white blur-[2px]"><FaPiggyBank size={250}/></div>
            <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-2 relative z-10 flex items-center gap-1">Total Value Locked (TVL) {isMarketSyncing && <HiOutlineRefresh className="animate-spin text-purple-400" size={10} />}</p>
            <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter relative z-10 break-words">{currencySymbol}{analytics.totalValueLocked.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 relative z-10">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
              <span className="text-xs font-bold text-slate-200">Est. Earning ≈ {currencySymbol}{analytics.totalDailyPassiveIncome.toFixed(2)} / Day</span>
            </div>
          </div>
          <div className="p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
              <HiOutlineGift size={16}/> Total Harvested
            </p>
            <h2 className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
              +{currencySymbol}{analytics.totalRewardsClaimedFiat.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
            <h2 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-widest"><FaLeaf className="text-emerald-500" size={16} /> Active Income Streams</h2>
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12"><HiOutlineRefresh className="animate-spin text-4xl text-purple-500 mb-3" /><p className="text-sm font-black text-slate-500 uppercase tracking-widest">Loading Streams...</p></div>
          ) : stakes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12"><HiOutlineUserGroup className="text-4xl text-slate-300 dark:text-slate-700 mb-3" /><p className="text-sm font-black text-slate-500 uppercase tracking-widest">No streams yet</p><p className="text-xs text-slate-400 mt-1 font-bold">Add a farming stream to track yields</p></div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="p-4 pl-6">Source / Asset Locked</th>
                    <th className="p-4">Terms & Estimation</th>
                    <th className="p-4">Live TVL (Value)</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {stakes.map((rec) => {
                    const isAffiliateRow = rec.earningType === 'affiliate';
                    const isPoolRow = rec.earningType === 'pool';
                    
                    const c1Obj = fullDatabase.find(c => c.symbol === (isAffiliateRow ? 'USDT' : rec.coin).toUpperCase());
                    const logo1 = c1Obj?.logo;

                    let logo2 = null;
                    if (isPoolRow) {
                       const c2Obj = fullDatabase.find(c => c.symbol === rec.poolCoin2.toUpperCase());
                       logo2 = c2Obj?.logo;
                    }
                    
                    let tvlFiat = 0;
                    let dailyEarnFiat = 0;

                    if (!isAffiliateRow) {
                      tvlFiat = (parseFloat(rec.principalAmount) || 0) * getLivePrice(rec.coin);
                      if (isPoolRow) tvlFiat += (parseFloat(rec.poolPrincipal2) || 0) * getLivePrice(rec.poolCoin2);
                      dailyEarnFiat = ((tvlFiat * (parseFloat(rec.apr)||0)) / 100) / 365;
                    }

                    let progress = 0; let daysLeftText = "Flexible";
                    if (rec.lockPeriod && rec.lockPeriod !== 'Flexible') {
                      const start = new Date(rec.startDate);
                      const totalDays = parseInt(rec.lockPeriod);
                      const end = new Date(start); end.setDate(end.getDate() + totalDays);
                      const today = new Date();
                      const daysPassed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
                      progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
                      daysLeftText = progress >= 100 ? "Unlocked" : `${totalDays - daysPassed} Days Left`;
                    }

                    return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-10 flex items-center justify-center shrink-0">
                                 {isAffiliateRow ? <FaExchangeAlt className="text-slate-400" size={16}/> : <LogoRenderer symbol={rec.coin} logoUrl={logo1} />}
                              </div>
                              {isPoolRow && (
                                <div className="w-10 h-10 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 -ml-4 z-0 shrink-0">
                                   <LogoRenderer symbol={rec.poolCoin2} logoUrl={logo2} />
                                </div>
                              )}
                          </div>
                          <div>
                            {isAffiliateRow ? (
                               <p className="font-black text-slate-800 dark:text-white text-sm">Affiliate / Network</p>
                            ) : isPoolRow ? (
                               <p className="font-black text-slate-800 dark:text-white text-sm">{rec.principalAmount} <span className="text-[10px] text-slate-500">{rec.coin}</span> + {rec.poolPrincipal2} <span className="text-[10px] text-slate-500">{rec.poolCoin2}</span></p>
                            ) : (
                               <p className="font-black text-slate-800 dark:text-white text-sm">{rec.principalAmount} <span className="text-[10px] text-slate-500">{rec.coin}</span></p>
                            )}
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">{rec.platform}</p>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                           <div className="flex flex-wrap items-center gap-2">
                             {isAffiliateRow ? (
                               <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/20 shadow-sm">Variable Yield</span>
                             ) : (
                               <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20 shadow-sm">Est. {rec.apr}% APR</span>
                             )}
                             
                             {isPoolRow ? (
                                <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 shadow-sm">LP Rewards</span>
                             ) : isAffiliateRow ? (
                                <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 shadow-sm">Multi-Coin Earning</span>
                             ) : (
                               <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 shadow-sm">
                                 Earns {rec.rewardCoin || rec.coin}
                               </span>
                             )}
                           </div>
                           {!isAffiliateRow && (
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{daysLeftText}</span>
                                 {rec.lockPeriod !== 'Flexible' && (
                                   <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                     <div className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${progress}%` }}></div>
                                   </div>
                                 )}
                               </div>
                           )}
                        </div>
                      </td>

                      <td className="p-4">
                        {isAffiliateRow ? (
                           <p className="font-bold text-slate-400 text-sm">--</p>
                        ) : (
                           <>
                             <p className="font-black text-slate-800 dark:text-white text-sm">{currencySymbol}{tvlFiat.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                             <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase tracking-widest">+ {currencySymbol}{dailyEarnFiat.toFixed(2)} / Day</p>
                           </>
                        )}
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openClaimModalFor(rec)} className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/30">
                            <HiOutlineGift size={14}/> Harvest
                          </button>
                          <button onClick={() => { 
                              setFormData({ earningType: rec.earningType || 'stake', coin: rec.coin, rewardCoin: rec.rewardCoin || rec.coin, poolCoin2: rec.poolCoin2 || '', platform: rec.platform, principalAmount: rec.principalAmount, poolPrincipal2: rec.poolPrincipal2 || '', apr: rec.apr, lockPeriod: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? rec.lockPeriod : 'Custom', customLockDays: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? '' : rec.lockPeriod, startDate: rec.startDate + 'T12:00' }); 
                              setEditingId(rec.id); setIsStakeModalOpen(true); 
                          }} className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 hover:text-blue-500 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 dark:hover:text-blue-400 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={16} /></button>
                          <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-500/30 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 🚀 ADD/EDIT MODAL FULL RESTORE */}
      {isStakeModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 bg-purple-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineLightningBolt size={20}/> {editingId ? 'Edit Stream' : 'Add Farming/Earn Stream'}</h3>
              <button type="button" onClick={closeStakeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveStake} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <button type="button" onClick={() => setFormData({...formData, earningType: 'stake'})} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${formData.earningType === 'stake' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>
                  <span>🏦</span> Single Stake
                </button>
                <button type="button" onClick={() => setFormData({...formData, earningType: 'pool'})} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${formData.earningType === 'pool' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                  <span>⚖️</span> Liquidity Pool
                </button>
                <button type="button" onClick={() => setFormData({...formData, earningType: 'affiliate'})} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 ${formData.earningType === 'affiliate' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  <span>🤝</span> Affiliate/Mine
                </button>
              </div>

              {formData.earningType === 'affiliate' && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl text-[10px] font-bold text-slate-500">
                  <span className="text-emerald-600 font-black">AFFILIATE MODE:</span> Use this to track NC Wallet networks or CryptoTab mining. No locked principal required. You can harvest multiple different coins simultaneously when claiming!
                </div>
              )}

              {formData.earningType === 'pool' && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl text-[10px] font-bold text-slate-500">
                  <span className="text-blue-600 font-black">LIQUIDITY POOL (e.g. FaucetPay BNB/FEY):</span> Stake two assets simultaneously to earn split rewards.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Platform / Exchange</label>
                <div className="relative">
                  <select value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                    {stakingPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                </div>
              </div>

              {formData.earningType !== 'affiliate' && (
                <div className={`p-5 rounded-2xl border ${formData.earningType === 'pool' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50'} space-y-4 shadow-sm`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Base Coin</label>
                      <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">{activeCryptos.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Amount Locked</label>
                      <input type="number" step="any" required value={formData.principalAmount} onChange={(e) => setFormData({...formData, principalAmount: e.target.value})} placeholder="e.g. 100" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                  </div>
                  {formData.earningType === 'pool' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
                      <div>
                        <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Pair Coin</label>
                        <select value={formData.poolCoin2} onChange={(e) => setFormData({...formData, poolCoin2: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700/50 rounded-xl font-bold dark:text-white outline-none cursor-pointer">{activeCryptos.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Amount Locked</label>
                        <input type="number" step="any" required value={formData.poolPrincipal2} onChange={(e) => setFormData({...formData, poolPrincipal2: e.target.value})} placeholder="e.g. 100" className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700/50 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Est. APR (%)</label>
                      <input type="number" step="any" required value={formData.apr} onChange={(e) => setFormData({...formData, apr: e.target.value})} placeholder="e.g. 12.5" className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                    {formData.earningType === 'stake' && (
                      <div>
                        <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Reward Coin</label>
                        <select value={formData.rewardCoin} onChange={(e) => setFormData({...formData, rewardCoin: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">{rewardOptions.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.earningType !== 'affiliate' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Lock Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {['Flexible', '15', '30', '60', 'Custom'].map(l => (
                      <button type="button" key={l} onClick={() => setFormData({...formData, lockPeriod: l})} className={`px-4 py-2 rounded-xl text-xs font-black transition-colors border ${formData.lockPeriod === l ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-500/20 dark:border-purple-500/50 dark:text-purple-400 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>{l !== 'Flexible' && l !== 'Custom' ? `${l}d` : l}</button>
                    ))}
                  </div>
                  {formData.lockPeriod === 'Custom' && <input type="number" required value={formData.customLockDays} onChange={(e) => setFormData({...formData, customLockDays: e.target.value})} placeholder="Enter days..." className="w-full p-4 mt-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 shadow-sm" />}
                </div>
              )}

              <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                   <span>Start Date</span>
                   <span className="text-purple-600 dark:text-purple-400">{formatGlobalDate && formData.startDate ? formatGlobalDate(formData.startDate.split('T')[0], 'short') : ''}</span>
                 </label>
                 {/* 🚀 FIXED: Reverted to datetime-local for accurate timestamp editing */}
                 <input type="datetime-local" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-purple-500/50" />
              </div>

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 disabled:opacity-70 ${formData.earningType === 'stake' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : formData.earningType === 'pool' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'} flex items-center justify-center gap-2`}>
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : (editingId ? 'Update Terms' : `Save Stream`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 FULL CLAIM REWARD MODAL */}
      {isClaimModalOpen && activeClaimStake && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] border border-emerald-100 dark:border-emerald-800/50 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            
            <div className="px-6 py-5 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineGift size={24}/> Harvest Rewards</h3>
              <button type="button" onClick={closeClaimModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleClaimReward} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 mb-1">Claiming yield from</p>
                <p className="text-lg font-black text-slate-800 dark:text-white">
                  {activeClaimStake.earningType === 'affiliate' ? 'Affiliate Network' : activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `${activeClaimStake.principalAmount} ${activeClaimStake.coin}`} on {activeClaimStake.platform}
                </p>
              </div>

              {isAffiliateModeModal ? (
                 <div className="space-y-4">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">Multi-Coin Harvest <button type="button" onClick={addClaimRow} className="text-blue-500 hover:text-blue-600">+ Add Coin</button></label>
                    {claimData.multipleClaims.map((claimRow, idx) => (
                       <div key={idx} className="flex gap-2 relative">
                         <div className="w-1/3">
                            <select value={claimRow.claimCoin} onChange={(e) => updateClaimRow(idx, 'claimCoin', e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer shadow-sm">
                              {activeCryptos.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                         <div className="flex-1 relative">
                            <input type="number" step="any" required value={claimRow.amountClaimed} onChange={(e) => updateClaimRow(idx, 'amountClaimed', e.target.value)} placeholder="0.00" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl font-black text-xl text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 tracking-widest shadow-sm" />
                         </div>
                         {claimData.multipleClaims.length > 1 && (
                            <button type="button" onClick={() => removeClaimRow(idx)} className="absolute -right-2 -top-2 bg-rose-500 text-white rounded-full p-1.5 shadow hover:bg-rose-600 z-10"><HiOutlineX size={14}/></button>
                         )}
                       </div>
                    ))}
                    <button type="button" onClick={addClaimRow} className="w-full py-3 border-2 border-dashed border-emerald-300 text-emerald-600 dark:border-emerald-800 dark:text-emerald-500 font-black text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex justify-center items-center gap-1 transition-colors"><HiOutlinePlus size={14}/> Add Another Coin</button>
                 </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Asset</label>
                    <select required value={claimData.claimCoin} onChange={(e) => setClaimData({...claimData, claimCoin: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer shadow-sm">
                      <option value={activeClaimStake.coin}>{activeClaimStake.coin}</option>
                      {activeClaimStake.earningType === 'pool' && <option value={activeClaimStake.poolCoin2}>{activeClaimStake.poolCoin2}</option>}
                      {activeClaimStake.earningType === 'stake' && activeClaimStake.rewardCoin !== activeClaimStake.coin && <option value={activeClaimStake.rewardCoin}>{activeClaimStake.rewardCoin}</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Yield Amount</label>
                    <input type="number" step="any" required value={claimData.amountClaimed} onChange={(e) => setClaimData({...claimData, amountClaimed: e.target.value})} placeholder="0.0" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl font-black text-xl text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 tracking-widest shadow-sm" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Platform Fee (%)</label>
                  <div className="relative">
                    <input type="number" step="any" required value={claimData.platformFeePercent} onChange={(e) => setClaimData({...claimData, platformFeePercent: e.target.value})} placeholder="e.g. 10" className="w-full p-4 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl font-bold text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/50 shadow-sm pr-10" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-rose-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-1">Harvest Date</label>
                  {/* 🚀 FIXED: Reverted to datetime-local for accurate timestamp editing */}
                  <input type="datetime-local" required value={claimData.date} onChange={(e) => setClaimData({...claimData, date: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm" />
                </div>
              </div>

              {!isAffiliateModeModal && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex justify-between items-center border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net to Wallet:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-lg">
                    {claimData.amountClaimed ? (parseFloat(claimData.amountClaimed) - (parseFloat(claimData.amountClaimed) * ((parseFloat(claimData.platformFeePercent)||0) / 100))).toFixed(6) : '0.00'} <span className="text-[10px]">{claimData.claimCoin}</span>
                  </span>
                </div>
              )}

              <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2">
                <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-lg uppercase tracking-widest transition-all active:scale-95 disabled:opacity-70 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 shrink-0">
                  {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : <HiOutlineShieldCheck size={24} />}
                  Harvest & Auto-Sync
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
              <p className="text-xs font-bold text-slate-500 mt-2">Deleting this record will alter your total TVL tracking history.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">You are permanently deleting a vault entry. Linked Yield Rewards (if any) will also be reversed automatically.</p>
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

export default StakingAndYield;