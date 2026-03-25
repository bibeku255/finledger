import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Added setDoc for safe updates
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineLockClosed, 
  HiOutlineLightningBolt, HiOutlineChevronDown, HiOutlineClock,
  HiOutlineTrendingUp, HiOutlineGift, HiOutlineUserGroup, HiOutlineSparkles,
  HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaBitcoin, FaWallet, FaLeaf, FaPiggyBank, FaCoins, FaExchangeAlt } from 'react-icons/fa';

// 🚀 Database of Platforms
const stakingPlatforms = [
  "FaucetPay", "DutchyCorp", "NC Wallet", "CryptoTab", "Binance Earn", 
  "Trust Wallet", "CoinDCX Earn", "KuCoin Earn", "Phantom (Solana)", "Other"
];

// 🚀 VERIFIED DATABASE (Fallback if AuthContext object is missing logo)
const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', fallbackPrice: 65000, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', fallbackPrice: 3000, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', fallbackPrice: 1.00, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', fallbackPrice: 140, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', fallbackPrice: 500, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png', fallbackPrice: 0.12, color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://cdn.faucetpay.io/coins/fey.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'taraxa', symbol: 'TARA', name: 'Taraxa', logo: 'https://assets.coingecko.com/coins/images/14409/large/taraxa.png', fallbackPrice: 0.0045, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'tether', symbol: 'CTC', name: 'NC Wallet Token', logo: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox', logo: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' }
];

const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const symbolUpper = symbol?.toUpperCase();

  useEffect(() => { setHasError(false); }, [logoUrl]);

  if (!logoUrl || hasError) {
    return (
      <span className={`w-full h-full flex items-center justify-center font-black text-[10px] ${bg || 'bg-slate-800'} ${color || 'text-white'} rounded-full`}>
        {symbolUpper?.substring(0, 2)}
      </span>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={symbolUpper} 
      className="w-full h-full object-contain p-0.5 rounded-full bg-slate-900"
      loading="lazy"
      onError={() => setHasError(true)} 
    />
  );
};

const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const StakingAndYield = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter Included
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [stakes, setStakes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [customUserCoins, setCustomUserCoins] = useState([]); // Needed for Contract fetching

  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeClaimStake, setActiveClaimStake] = useState(null);

  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];

  // 🚀 CRASH FIX: Extracting string symbols safely from context objects
  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const activeCryptos = cryptoSymbols.length > 0 ? cryptoSymbols : ['USDT', 'BNB', 'FEY', 'BTC'];
  const rewardOptions = Array.from(new Set([...activeCryptos, 'CTC', 'USDT']));

  // 🚀 ADVANCED STATE FOR ALL MODES
  const [formData, setFormData] = useState({
    earningType: 'stake', // 'stake', 'pool', 'affiliate'
    coin: activeCryptos[0],
    rewardCoin: rewardOptions[0], 
    poolCoin2: activeCryptos.length > 1 ? activeCryptos[1] : 'USDT', // For Liquidity Pools
    platform: stakingPlatforms[0],
    principalAmount: '',
    poolPrincipal2: '', // For Liquidity Pools
    apr: '',
    lockPeriod: 'Flexible', 
    customLockDays: '', // For 55+5 day setups
    startDate: todayDate
  });

  const [claimData, setClaimData] = useState({ 
    claimCoin: '', 
    amountClaimed: '', 
    platformFeePercent: '10', // Default 10% fee common in Faucets
    date: todayDate 
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "stakingLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStakes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Custom User Coins for Contract MetaData
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().customCoins) {
        setCustomUserCoins(userSnap.data().customCoins);
      }
    };
    fetchUserData();
  }, [user]);

  // Master Merge Engine
  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    defaultCryptoDatabase.forEach(c => coinMap.set(c.symbol.toUpperCase(), c));
    
    selectedCryptos.forEach(c => {
       if (typeof c === 'object') coinMap.set(c.symbol.toUpperCase(), c);
    });

    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins, selectedCryptos]);

  // 🚀 REBUILT: HYBRID SMART PRICE FETCHER (Object Safe)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const userBaseRate = fiatData.rates[baseCurrency] || 1;
        setFiatRate(userBaseRate);

        const coinsToFetch = Array.from(new Set([
          ...activeCryptos, formData.coin, formData.rewardCoin, formData.poolCoin2,
          ...stakes.flatMap(s => [s.coin, s.rewardCoin, s.poolCoin2])
        ])).filter(Boolean);
        
        if(coinsToFetch.length === 0) return;

        let cgJson = {};
        let geckoTerminalData = {};
        const normalCoins = [];
        const contractCoins = [];

        coinsToFetch.forEach(sym => {
           const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase());
           if (dbCoin?.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) {
              contractCoins.push(dbCoin);
           } else {
              normalCoins.push(dbCoin?.id || sym.toLowerCase());
           }
        });

        // 1. Fetch Normal Coins (CoinGecko)
        if (normalCoins.length > 0) {
           try {
             const ids = [...new Set(normalCoins)].join(',');
             const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
             if (cgRes.ok) {
                 cgJson = await cgRes.json();
             }
           } catch(e) { console.warn("CoinGecko API Limit Reached"); }
        }

        // 2. Fetch Custom Contract Coins (GeckoTerminal)
        for (const customCoin of contractCoins) {
           try {
              const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
              if (gtRes.ok) {
                 const gtJson = await gtRes.json();
                 geckoTerminalData[customCoin.id] = {
                    usd: parseFloat(gtJson.data.attributes.price_usd)
                 };
              }
           } catch (error) { console.warn(`GeckoTerminal failed for ${customCoin.symbol}`); }
        }

        const priceMap = {};
        
        await Promise.all(coinsToFetch.map(async (sym) => {
          const upperSym = sym.toUpperCase();
          const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || {};
          const searchId = dbCoin.id || sym.toLowerCase();
          
          let priceUsd = null;

          if (dbCoin.fetchMode === 'contract') {
              priceUsd = geckoTerminalData[searchId]?.usd;
          } else {
              priceUsd = cgJson[searchId]?.usd;
          }

          // Binance Fallback
          if (!priceUsd) {
            try {
              const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
              const bRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${bSym}`);
              if (bRes.ok) {
                 const bData = await bRes.json();
                 priceUsd = searchId === 'tether' ? 1.00 : parseFloat(bData.price);
              }
            } catch(e) {}
          }

          if (!priceUsd && dbCoin.fallbackPrice) {
              priceUsd = dbCoin.fallbackPrice;
          }
          
          if(priceUsd) {
             priceMap[upperSym] = priceUsd * userBaseRate;
          }
        }));

        setLivePrices(priceMap);
      } catch (error) {}
    };
    if (!isLoading) {
        fetchLivePrices();
        const interval = setInterval(fetchLivePrices, 60000); // 60s Refresh
        return () => clearInterval(interval);
    }
  }, [isLoading, activeCryptos, baseCurrency, formData.coin, formData.rewardCoin, formData.poolCoin2, stakes, fullDatabase]);

  const getLivePrice = (symbol) => {
      if(!symbol || symbol === 'N/A') return 0;
      const price = livePrices[symbol.toUpperCase()];
      return (price !== undefined && !isNaN(price)) ? price : (0.01 * fiatRate); 
  };

  // 🚀 SMART PROJECTION CALCULATION
  const projection = useMemo(() => {
    if (formData.earningType === 'affiliate') return { dailyFiat: 0, monthlyFiat: 0, yearlyFiat: 0 };

    const principal1 = parseFloat(formData.principalAmount) || 0;
    const price1 = getLivePrice(formData.coin);
    let tvlFiat = principal1 * price1;

    // Add 2nd coin for LP
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
    let totalValueLocked = 0;
    let totalRewardsClaimedFiat = 0;
    let totalDailyPassiveIncome = 0;

    stakes.forEach(s => {
      const isAffiliate = s.earningType === 'affiliate';
      const isPool = s.earningType === 'pool';

      let tvl = 0;
      if (!isAffiliate) {
        tvl = (parseFloat(s.principalAmount) || 0) * getLivePrice(s.coin);
        if (isPool) tvl += (parseFloat(s.poolPrincipal2) || 0) * getLivePrice(s.poolCoin2);
        totalValueLocked += tvl;
        totalDailyPassiveIncome += ((tvl * (parseFloat(s.apr)||0)) / 100) / 365;
      }
      
      if (s.claimedHistory) {
         s.claimedHistory.forEach(h => {
             totalRewardsClaimedFiat += (parseFloat(h.amount) || 0) * getLivePrice(h.coin);
         });
      } else {
         // Legacy fallback
         totalRewardsClaimedFiat += (parseFloat(s.totalClaimed) || 0) * getLivePrice(s.rewardCoin || s.coin);
      }
    });

    return { totalValueLocked, totalRewardsClaimedFiat, totalDailyPassiveIncome };
  }, [stakes, livePrices]);

  // 🚀 REPORT DOWNLOAD LOGIC FOR STAKING (Now includes Global Date)
  const handleDownloadReport = (format) => {
    if (stakes.length === 0) return alert("No active stakes or streams found.");

    const reportData = stakes.map(rec => {
      const isAffiliate = rec.earningType === 'affiliate';
      const isPool = rec.earningType === 'pool';

      let principalText = 'N/A';
      if (isPool) {
         principalText = `${rec.principalAmount} ${rec.coin} + ${rec.poolPrincipal2} ${rec.poolCoin2}`;
      } else if (!isAffiliate) {
         principalText = `${rec.principalAmount} ${rec.coin}`;
      }

      let totalClaimedNative = 0;
      if (rec.claimedHistory) {
         rec.claimedHistory.forEach(h => {
             totalClaimedNative += (parseFloat(h.amount) || 0);
         });
      }

      return {
        // 🚀 GLOBAL DATE IN REPORTS
        startDate: formatGlobalDate && rec.startDate ? formatGlobalDate(rec.startDate, 'short') : (rec.startDate || 'N/A'),
        platform: rec.platform,
        type: isAffiliate ? 'Affiliate/Network' : (isPool ? 'Liquidity Pool' : 'Single Stake'),
        principal: principalText,
        apr: isAffiliate ? 'Variable' : `${rec.apr}%`,
        lockPeriod: rec.lockPeriod,
        totalHarvested: `${totalClaimedNative} ${rec.rewardCoin || rec.coin}`
      };
    });

    const columns = [
      { header: 'Start Date', key: 'startDate' },
      { header: 'Platform', key: 'platform' },
      { header: 'Type', key: 'type' },
      { header: 'Locked Principal', key: 'principal' },
      { header: 'APR', key: 'apr' },
      { header: 'Lock Period', key: 'lockPeriod' },
      { header: 'Total Harvested', key: 'totalHarvested' }
    ];

    const fileName = `Yield_Farming_Report`;
    const reportTitle = `Staking & Yield Farming - Active Streams`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const handleSaveStake = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    const isAffiliate = formData.earningType === 'affiliate';
    const isPool = formData.earningType === 'pool';
    
    const principal = isAffiliate ? 0 : parseFloat(formData.principalAmount);
    const poolPrincipal2 = isPool ? parseFloat(formData.poolPrincipal2) : 0;
    const apr = isAffiliate ? 0 : parseFloat(formData.apr);

    if (!isAffiliate && (isNaN(principal) || principal <= 0 || isNaN(apr) || apr <= 0)) { 
        alert("Principal and APR must be > 0 for standard staking."); 
        setIsSaving(false); return; 
    }

    const timestamp = editingId ? stakes.find(s => s.id === editingId)?.timestamp : new Date(formData.startDate).getTime();

    const stakeData = {
      earningType: formData.earningType,
      platform: formData.platform,
      apr: apr,
      lockPeriod: isAffiliate ? 'Flexible' : (formData.lockPeriod === 'Custom' ? formData.customLockDays : formData.lockPeriod),
      startDate: formData.startDate,
      timestamp,
      
      // Dynamic Data Based on Type
      coin: isAffiliate ? 'N/A' : formData.coin, 
      principalAmount: principal,
      rewardCoin: isAffiliate ? formData.rewardCoin : (isPool ? 'Dual' : formData.rewardCoin),
      
      // LP Specific
      ...(isPool && {
        poolCoin2: formData.poolCoin2,
        poolPrincipal2: poolPrincipal2
      })
    };

    try {
      if (editingId) {
        // 🚀 FIXED: Replaced updateDoc with setDoc for 100% safety
        await setDoc(doc(db, "users", user.uid, "stakingLogs", editingId), stakeData, { merge: true });
      } else {
        stakeData.claimedHistory = [];
        stakeData.totalClaimed = 0; 
        await addDoc(collection(db, "users", user.uid, "stakingLogs"), stakeData);
      }
      closeStakeModal();
    } catch (error) { alert("Failed to save."); } finally { setIsSaving(false); }
  };

  const handleClaimReward = async (e) => {
    e.preventDefault();
    if (!user || !activeClaimStake) return;
    
    const grossQty = parseFloat(claimData.amountClaimed);
    const feePercent = parseFloat(claimData.platformFeePercent) || 0;
    
    if (isNaN(grossQty) || grossQty <= 0) return alert("Claim amount must be > 0");

    setIsSaving(true);
    
    // 🚀 AUTO FEE DEDUCTOR
    const netQty = grossQty - (grossQty * (feePercent / 100));
    
    const timestamp = new Date(claimData.date).getTime();
    const uniqueId = `YIELD_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const currentPriceBase = getLivePrice(claimData.claimCoin);
    const finalFiatValue = netQty * currentPriceBase;
    
    const sourceString = activeClaimStake.earningType === 'affiliate' ? 'Affiliate Network' : (activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `Staking (${activeClaimStake.apr}%)`);

    try {
      const claimRecord = { amount: netQty, coin: claimData.claimCoin, date: claimData.date, timestamp };

      // 🚀 FIXED: Safe arrayUnion update via setDoc
      await setDoc(doc(db, "users", user.uid, "stakingLogs", activeClaimStake.id), {
        claimedHistory: arrayUnion(claimRecord)
      }, { merge: true });

      // Reward instantly added to CryptoWallet
      await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), {
        type: 'in', coin: claimData.claimCoin, quantity: netQty, platform: activeClaimStake.platform,
        reason: `${sourceString} Reward`, referenceNo: uniqueId, date: claimData.date, timestamp,
        isMicroEarn: true, linkedRecordId: uniqueId
      });

      // Reward automatically logged in Dashboard Income
      await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
        title: `${sourceString}: ${claimData.claimCoin}`, category: "Crypto Staking Rewards", vault: 'crypto',
        cryptoPlatform: activeClaimStake.platform, asset: claimData.claimCoin, amount: netQty,
        exchangeRate: currentPriceBase > 0 ? currentPriceBase : 1, finalBaseAmount: finalFiatValue, date: claimData.date, timestamp,
        linkedIncomeId: uniqueId, isMicroEarn: true
      });

      closeClaimModal();
    } catch (error) { 
        console.error(error); 
        alert("Failed to claim reward. Check console for details."); 
    } finally { setIsSaving(false); }
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Enter PIN.");
    setIsVerifying(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect PIN."); setIsVerifying(false); return;
      }
      
      await deleteDoc(doc(db, "users", user.uid, "stakingLogs", deleteContext.id));
      setDeleteContext(null); 
    } catch (error) { setPinError("Error."); } finally { setIsVerifying(false); }
  };

  const closeStakeModal = () => {
    setIsStakeModalOpen(false); setEditingId(null);
    setFormData({ earningType: 'stake', coin: activeCryptos[0], rewardCoin: rewardOptions[0], poolCoin2: activeCryptos[1] || 'USDT', platform: stakingPlatforms[0], principalAmount: '', poolPrincipal2: '', apr: '', lockPeriod: 'Flexible', customLockDays: '', startDate: todayDate });
  };

  const closeClaimModal = () => {
    setIsClaimModalOpen(false); setActiveClaimStake(null);
    setClaimData({ claimCoin: '', amountClaimed: '', platformFeePercent: '10', date: todayDate });
  };

  const openClaimModalFor = (rec) => {
      setActiveClaimStake(rec);
      setClaimData({
          claimCoin: rec.earningType === 'pool' ? rec.coin : (rec.rewardCoin || rec.coin),
          amountClaimed: '', platformFeePercent: '10', date: todayDate
      });
      setIsClaimModalOpen(true);
  };

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-purple-500/10 text-purple-600 rounded-2xl ring-1 ring-purple-500/20">
              <HiOutlineLightningBolt size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Earn & Farming Vault</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Track Liquidity Pools (e.g. FEY/BNB), APY Staking, and Affiliate Networks.
          </p>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
          <div className="relative group">
            <button className="flex items-center gap-1 md:gap-2 p-3 md:p-3.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-2xl font-bold text-xs md:text-sm hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
              <HiOutlineDownload size={18}/> 
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Report</span>
            </button>
            <div className="absolute top-full right-0 md:left-0 md:right-auto mt-2 w-36 md:w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col p-1 z-50">
              <button onClick={() => handleDownloadReport('pdf')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineDocumentText className="text-rose-500" size={16}/> As PDF
              </button>
              <button onClick={() => handleDownloadReport('excel')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] md:text-xs font-bold rounded-lg text-left w-full">
                <HiOutlineTable className="text-emerald-500" size={16}/> As Excel (CSV)
              </button>
            </div>
          </div>

          <button onClick={() => setIsStakeModalOpen(true)} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 md:px-7 py-3 md:py-3.5 rounded-2xl font-black text-xs md:text-sm transition-all active:scale-95 shadow-lg shadow-purple-500/25 whitespace-nowrap">
            <HiOutlinePlus size={20} className="hidden sm:inline" /> 
            <span className="hidden sm:inline">Add Farming Stream</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-xl border border-slate-700/50 relative overflow-hidden md:col-span-2">
          <div className="absolute right-[-5%] top-[-10%] opacity-5 text-white blur-[2px]"><FaPiggyBank size={250}/></div>
          <p className="text-[11px] font-black text-purple-400 uppercase tracking-widest mb-2 relative z-10">Total Value Locked (TVL)</p>
          <h2 className="text-5xl font-black text-white tracking-tighter relative z-10">{currencySymbol}{analytics.totalValueLocked.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 relative z-10">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            <span className="text-xs font-bold text-slate-200">Est. Earning ≈ {currencySymbol}{analytics.totalDailyPassiveIncome.toFixed(2)} / Day</span>
          </div>
        </div>
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
            <HiOutlineGift size={16}/> Total Harvested
          </p>
          <h2 className="text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            +{currencySymbol}{analytics.totalRewardsClaimedFiat.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2"><FaLeaf className="text-emerald-500"/> Active Income Streams</h2>
        </div>
        
        {stakes.length === 0 ? (
           <div className="p-12 text-center">
             <HiOutlineUserGroup className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
             <p className="text-slate-500 font-bold">No active farming or affiliate streams. Add one to track yields!</p>
           </div>
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
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {stakes.map((rec) => {
                  const isAffiliate = rec.earningType === 'affiliate';
                  const isPool = rec.earningType === 'pool';
                  
                  // 🚀 Safe Logo Retrieval from Objects Array
                  const c1Obj = fullDatabase.find(c => c.symbol === (isAffiliate ? rec.rewardCoin : rec.coin).toUpperCase());
                  const logo1 = c1Obj?.logo;

                  let logo2 = null;
                  if (isPool) {
                     const c2Obj = fullDatabase.find(c => c.symbol === rec.poolCoin2.toUpperCase());
                     logo2 = c2Obj?.logo;
                  }
                  
                  let tvlFiat = 0;
                  let dailyEarnFiat = 0;

                  if (!isAffiliate) {
                    tvlFiat = (parseFloat(rec.principalAmount) || 0) * getLivePrice(rec.coin);
                    if (isPool) tvlFiat += (parseFloat(rec.poolPrincipal2) || 0) * getLivePrice(rec.poolCoin2);
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
                  <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 z-10">
                               <LogoRenderer symbol={isAffiliate ? rec.rewardCoin : rec.coin} logoUrl={logo1} />
                            </div>
                            {isPool && (
                              <div className="w-10 h-10 rounded-full overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 -ml-4 z-0">
                                 <LogoRenderer symbol={rec.poolCoin2} logoUrl={logo2} />
                              </div>
                            )}
                        </div>
                        <div>
                          {isAffiliate ? (
                             <p className="font-black text-slate-800 dark:text-white text-sm">Affiliate / Network</p>
                          ) : isPool ? (
                             <p className="font-black text-slate-800 dark:text-white text-sm">{rec.principalAmount} <span className="text-[10px] text-slate-500">{rec.coin}</span> + {rec.poolPrincipal2} <span className="text-[10px] text-slate-500">{rec.poolCoin2}</span></p>
                          ) : (
                             <p className="font-black text-slate-800 dark:text-white text-sm">{rec.principalAmount} <span className="text-[10px] text-slate-500">{rec.coin}</span></p>
                          )}
                          <p className="text-[10px] font-bold text-slate-500 mt-0.5">{rec.platform}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                         <div className="flex flex-wrap items-center gap-2">
                           {isAffiliate ? (
                             <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded">Variable</span>
                           ) : (
                             <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">Est. {rec.apr}% APR</span>
                           )}
                           
                           {isPool ? (
                              <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded">LP Rewards</span>
                           ) : (
                             <span className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded">
                               Earns {rec.rewardCoin || rec.coin}
                             </span>
                           )}
                         </div>
                         {!isAffiliate && (
                             <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{daysLeftText}</span>
                               {rec.lockPeriod !== 'Flexible' && (
                                 <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                   <div className={`h-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${progress}%` }}></div>
                                 </div>
                               )}
                             </div>
                         )}
                      </div>
                    </td>

                    <td className="p-4">
                      {isAffiliate ? (
                         <p className="font-bold text-slate-400 text-sm">--</p>
                      ) : (
                         <>
                           <p className="font-black text-slate-800 dark:text-white text-sm">{currencySymbol}{tvlFiat.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                           <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">+ {currencySymbol}{dailyEarnFiat.toFixed(2)} / Day</p>
                         </>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openClaimModalFor(rec)} className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-1">
                          <HiOutlineGift size={14}/> Harvest
                        </button>
                        <button onClick={() => { 
                            setFormData({ earningType: rec.earningType || 'stake', coin: rec.coin, rewardCoin: rec.rewardCoin || rec.coin, poolCoin2: rec.poolCoin2 || '', platform: rec.platform, principalAmount: rec.principalAmount, poolPrincipal2: rec.poolPrincipal2 || '', apr: rec.apr, lockPeriod: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? rec.lockPeriod : 'Custom', customLockDays: ['Flexible','15','30','60'].includes(rec.lockPeriod) ? '' : rec.lockPeriod, startDate: rec.startDate }); 
                            setEditingId(rec.id); setIsStakeModalOpen(true); 
                        }} className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={16} /></button>
                        <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🚀 ADD/EDIT MODAL */}
      {isStakeModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 bg-purple-600 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><FaExchangeAlt size={20}/> {editingId ? 'Edit Stream' : 'Add Farming/Earn Stream'}</h3>
              <button type="button" onClick={closeStakeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveStake} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* 🚀 3-WAY TYPE TOGGLE */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
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
                  <span className="text-emerald-600 font-black">AFFILIATE MODE:</span> Use this to track NC Wallet networks or CryptoTab mining. No locked principal required. Just harvest rewards when received!
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
                  <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* DYNAMIC ASSET SELECTION */}
              {formData.earningType === 'pool' ? (
                 <div className="grid grid-cols-2 gap-5 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset 1</label>
                      <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none cursor-pointer">
                        {cryptoSymbols.map(c => <option key={`p1-${c}`} value={c}>{c}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.principalAmount} onChange={(e) => setFormData({...formData, principalAmount: e.target.value})} placeholder="Amount 1" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset 2</label>
                      <select value={formData.poolCoin2} onChange={(e) => setFormData({...formData, poolCoin2: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black dark:text-white outline-none cursor-pointer">
                        {cryptoSymbols.map(c => <option key={`p2-${c}`} value={c}>{c}</option>)}
                      </select>
                      <input type="number" step="any" required value={formData.poolPrincipal2} onChange={(e) => setFormData({...formData, poolPrincipal2: e.target.value})} placeholder="Amount 2" className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50" />
                    </div>
                 </div>
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  {formData.earningType === 'stake' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Staked (Holding)</label>
                      <div className="relative">
                        <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none cursor-pointer appearance-none">
                          {cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div className={`space-y-2 ${formData.earningType === 'affiliate' ? 'col-span-2' : ''}`}>
                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Reward Asset (Earning)</label>
                    <div className="relative">
                      <select value={formData.rewardCoin} onChange={(e) => setFormData({...formData, rewardCoin: e.target.value})} className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl font-black text-emerald-600 dark:text-emerald-400 outline-none cursor-pointer appearance-none">
                        {rewardOptions.map(c => <option key={`r-${c}`} value={c}>{c}</option>)}
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* AMOUNTS AND APR FOR NON-AFFILIATE */}
              {formData.earningType !== 'affiliate' && (
                <>
                  <div className="grid grid-cols-2 gap-5">
                    {formData.earningType === 'stake' && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Holding Amount</label>
                        <input type="number" step="any" required value={formData.principalAmount} onChange={(e) => setFormData({...formData, principalAmount: e.target.value})} placeholder="e.g. 0.05" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xl text-purple-600 dark:text-purple-400 outline-none focus:ring-2 focus:ring-purple-500/50 tracking-widest" />
                      </div>
                    )}
                    <div className={`space-y-2 ${formData.earningType === 'pool' ? 'col-span-2' : ''}`}>
                      <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Estimated APR (%)</label>
                      <div className="relative">
                        <input type="number" step="any" required value={formData.apr} onChange={(e) => setFormData({...formData, apr: e.target.value})} placeholder="e.g. 40.45" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl font-black text-xl text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 tracking-widest pr-10" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-emerald-500">%</span>
                      </div>
                    </div>
                  </div>

                  {/* 🚀 AI PROJECTOR */}
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-2xl">
                    <div className="flex justify-between items-center mb-3">
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">🤖 Est. Fiat Projection</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                       <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] font-black text-slate-400 uppercase">Daily</p>
                         <p className="font-bold text-emerald-500 text-xs">+{currencySymbol}{projection.dailyFiat.toFixed(2)}</p>
                       </div>
                       <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] font-black text-slate-400 uppercase">Monthly</p>
                         <p className="font-bold text-emerald-500 text-xs">+{currencySymbol}{projection.monthlyFiat.toFixed(2)}</p>
                       </div>
                       <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                         <p className="text-[9px] font-black text-slate-400 uppercase">Yearly</p>
                         <p className="font-bold text-emerald-500 text-xs">+{currencySymbol}{projection.yearlyFiat.toFixed(2)}</p>
                       </div>
                    </div>
                  </div>

                  {/* CUSTOM LOCK PERIOD */}
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Lock Duration</label>
                      <div className="relative">
                        <select value={formData.lockPeriod} onChange={(e) => setFormData({...formData, lockPeriod: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                          <option value="Flexible">Flexible (Anytime)</option>
                          <option value="15">15 Days</option>
                          <option value="30">30 Days</option>
                          <option value="60">60 Days</option>
                          <option value="Custom">Custom Days...</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      {formData.lockPeriod === 'Custom' && (
                         <input type="number" required value={formData.customLockDays} onChange={(e)=>setFormData({...formData, customLockDays: e.target.value})} placeholder="e.g. 55" className="w-full p-3 mt-2 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-xl font-bold dark:text-white outline-none" />
                      )}
                    </div>
                    {/* 🚀 GLOBAL DATE APPLIED */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                        <span>Start Date</span>
                        <span className="text-purple-600 dark:text-purple-400">{formatGlobalDate ? formatGlobalDate(formData.startDate, 'short') : ''}</span>
                      </label>
                      <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                    </div>
                  </div>
                </>
              )}

              {/* Affiliate Form Date Field Only */}
              {formData.earningType === 'affiliate' && (
                <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                     <span>Join Date</span>
                     <span className="text-emerald-600 dark:text-emerald-400">{formatGlobalDate ? formatGlobalDate(formData.startDate, 'short') : ''}</span>
                   </label>
                   <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
              )}

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl active:scale-95 disabled:opacity-70 ${formData.earningType === 'stake' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : formData.earningType === 'pool' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'} flex items-center justify-center gap-2`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : (editingId ? 'Update Terms' : `Save Stream`)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🎁 CLAIM REWARD MODAL WITH AUTO-FEE DEDUCTION */}
      {isClaimModalOpen && activeClaimStake && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-emerald-100 dark:border-emerald-800/50">
            
            <div className="px-6 py-5 flex justify-between items-center bg-emerald-500 text-white">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineGift size={24}/> Harvest Rewards</h3>
              <button type="button" onClick={closeClaimModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleClaimReward} className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-sm font-bold text-slate-500 mb-1">Claiming yield from</p>
                <p className="text-lg font-black text-slate-800 dark:text-white">
                  {activeClaimStake.earningType === 'affiliate' ? 'Affiliate Network' : activeClaimStake.earningType === 'pool' ? 'Liquidity Pool' : `${activeClaimStake.principalAmount} ${activeClaimStake.coin}`} on {activeClaimStake.platform}
                </p>
              </div>

              {/* Dual Asset Claim Selector for LP */}
              {activeClaimStake.earningType === 'pool' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Which coin are you claiming?</label>
                    <select value={claimData.claimCoin} onChange={(e) => setClaimData({...claimData, claimCoin: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer">
                       <option value={activeClaimStake.coin}>{activeClaimStake.coin}</option>
                       <option value={activeClaimStake.poolCoin2}>{activeClaimStake.poolCoin2}</option>
                    </select>
                  </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Gross Quantity Received</label>
                <div className="relative">
                  <input type="number" step="any" required autoFocus value={claimData.amountClaimed} onChange={(e) => setClaimData({...claimData, amountClaimed: e.target.value})} placeholder="e.g. 0.5" className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl font-black text-2xl text-emerald-600 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/50 text-center tracking-widest" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-emerald-500">{claimData.claimCoin}</span>
                </div>
              </div>

              {/* PLATFORM COMMISSION / FEE */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-rose-500 uppercase tracking-widest ml-1">Platform Fee Deduction (%)</label>
                <div className="relative">
                  <input type="number" step="any" value={claimData.platformFeePercent} onChange={(e) => setClaimData({...claimData, platformFeePercent: e.target.value})} placeholder="e.g. 10" className="w-full p-3 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/50 rounded-xl font-bold text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/50 pr-10" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-rose-500">%</span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 pl-2">App will automatically deduct this from Gross before logging.</p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Net to Wallet:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {claimData.amountClaimed ? (parseFloat(claimData.amountClaimed) - (parseFloat(claimData.amountClaimed) * ((parseFloat(claimData.platformFeePercent)||0) / 100))).toFixed(6) : '0.00'} {claimData.claimCoin}
                </span>
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl active:scale-95 disabled:opacity-70 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 flex items-center justify-center gap-2`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : 'Harvest & Auto-Sync Ledgers'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-3xl mb-4"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">Delete this earning position?</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
              {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce">{pinError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50">Verify & Delete</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StakingAndYield;