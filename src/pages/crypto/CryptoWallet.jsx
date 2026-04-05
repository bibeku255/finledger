import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
// 🚀 FIXED: Changed updateDoc to setDoc for safety
import { collection, addDoc, setDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

// 🚀 IMPORTED REPORT UTILS
import { downloadExcelReport, downloadPDFReport } from '../../utils/reportUtils';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineSearch, HiOutlineRefresh, HiOutlineTrendingUp, HiOutlineTrendingDown,
  HiOutlineLockClosed, HiOutlineExclamationCircle, HiOutlineDownload, HiOutlineUpload,
  HiOutlineSwitchHorizontal, HiOutlineInformationCircle, HiOutlineChevronDown,
  HiOutlineDocumentText, HiOutlineTable
} from 'react-icons/hi';
import { FaBitcoin, FaWallet, FaShieldAlt, FaChartPie, FaBuilding, FaExchangeAlt } from 'react-icons/fa';

// 🚀 EXPANDED: Exchanges, Wallets & Micro-Earn Sites
const allPlatforms = [
  "Binance", "CoinDCX", "WazirX", "ZebPay", "Mudrex", "SunCrypto",
  "Coinbase", "Bybit", "KuCoin", "OKX", "Kraken", "Mexc", "Gate.io",
  "FaucetPay", "Trust Wallet", "MetaMask", "Phantom", "NC Wallet", "Payeer",
  "Ledger (Hardware)", "Trezor (Hardware)",
  "CoinPayU", "Cointiply", "FreeBitcoin", "FireFaucet", "PipeFlare", 
  "GlobalHive", "AdBTC", "Viefaucet", "DutchyCorp", "LarvelFaucet", 
  "Coinpot", "RollerCoin", "Other Wallet/Site"
];

// Fiat constants for the Bridge
const fiatCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "SAR", "JPY", "CNY", "INR", "NPR", "PKR", "BDT"];
const vaultDestinations = [
  { id: 'bankWallet', name: '🏦 Bank Ledger (UPI/Bank)' },
  { id: 'onlineWallet', name: '🌐 Online Wallet (PayPal/E-Wallet)' },
  { id: 'cashWallet', name: '💵 Physical Cash' }
];

// 🚀 SAFE COINS LIST FOR BINANCE FALLBACK (PREVENTS CORS/404)
const BINANCE_SAFE_COINS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX', 'LTC', 'BCH', 'ADA', 'XMR', 'XLM', 'DAI', 'ZEC', 'SHIB', 'SUI', 'TON', 'DOT', 'PEPE', 'NEAR', 'POL', 'ATOM', 'ARB', 'BONK', 'CAKE', 'XTZ', 'FLOKI', 'OP', 'TWT', 'BAT', 'DGB', 'KAVA', 'AVAX', 'MEME', 'DASH'];

// 🚀 1. STRICT LOGO RENDERER (Synced with CryptoManager)
const LogoRenderer = ({ symbol, logoUrl, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const symbolUpper = symbol?.toUpperCase();

  useEffect(() => { setHasError(false); }, [logoUrl]);

  if (!logoUrl || hasError) {
    return (
      <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-200 dark:bg-slate-700'} ${color || 'text-slate-600 dark:text-white'} shadow-inner border border-black/5 dark:border-white/5`}>
        {symbolUpper?.substring(0, 3)}
      </span>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={symbolUpper} 
      className="w-full h-full object-contain rounded-full relative z-10 bg-white dark:bg-slate-800"
      loading="lazy"
      onError={() => setHasError(true)} 
    />
  );
};

// 🚀 2. VERIFIED DATABASE
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
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin', logo: 'https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'pepe', symbol: 'PEPE', name: 'Pepe', logo: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', logo: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png', color: 'text-slate-400', bg: 'bg-slate-400/10' },
  { id: 'optimism', symbol: 'OP', name: 'Optimism', logo: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png', color: 'text-red-500', bg: 'bg-red-500/10' },
  
  // Custom Verified Micro-Links
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://assets.coingecko.com/coins/images/13600/large/feyorra.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'pi-network', symbol: 'PI', name: 'Pi Network', logo: 'https://assets.coingecko.com/coins/images/31835/large/pi_network.jpg', fallbackPrice: 36.50, color: 'text-purple-600', bg: 'bg-purple-600/10' },
  { id: 'ice-decentralized-future', symbol: 'ICE', name: 'Ice Network', logo: 'https://assets.coingecko.com/coins/images/34311/large/ice.png', fallbackPrice: 0.0035, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'jumptoken', symbol: 'JMPT', name: 'JumpToken', logo: 'https://assets.coingecko.com/coins/images/22397/large/jmpt.png', fallbackPrice: 0.95, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'taraxa', symbol: 'TARA', name: 'Taraxa', logo: 'https://assets.coingecko.com/coins/images/14409/large/taraxa.png', fallbackPrice: 0.0045, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
  { id: 'coinex-token', symbol: 'CET', name: 'CoinEx Token', logo: 'https://assets.coingecko.com/coins/images/2538/large/coinex-token.png', fallbackPrice: 0.035, color: 'text-emerald-600', bg: 'bg-emerald-600/10' },
  { id: 'xyo-network', symbol: 'XYO', name: 'XYO Network', logo: 'https://assets.coingecko.com/coins/images/3216/large/xyo_network_logo.png', fallbackPrice: 0.007, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'xspace', symbol: 'XSPACE', name: 'XSPACE', logo: 'https://assets.coingecko.com/coins/images/20265/large/xspace.png', fallbackPrice: 0.0001, color: 'text-purple-500', bg: 'bg-purple-500/10' }, 
  { id: 'bananas31', symbol: 'BANANAS31', name: 'Bananas31', logo: 'https://assets.coingecko.com/coins/images/34118/large/bananas31.png', fallbackPrice: 0.01, color: 'text-yellow-500', bg: 'bg-yellow-500/10' }, 
  { id: 'faucetpay-lottery', symbol: 'FLT', name: 'FaucetPay Lottery', logo: 'https://cdn.faucetpay.io/coins/flt.png', fallbackPrice: 0.05, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'marco', symbol: 'MARCO', name: 'Marco', logo: 'https://assets.coingecko.com/coins/images/34407/large/marco.png', fallbackPrice: 0.15, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'tether', symbol: 'CTC', name: 'NC Wallet Token', logo: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox', logo: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' }
];

// 🚀 PROPER HASHING FUNCTION FOR SECURE DELETE
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const CryptoWallet = () => {
  // 🚀 FIXED: Context se objects aayenge, safe extraction yahan karenge
  const { user, baseCurrency = 'USD', selectedCryptos = [], formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [livePrices, setLivePrices] = useState({});
  const [fiatRate, setFiatRate] = useState(1);
  const [isMarketSyncing, setIsMarketSyncing] = useState(true);

  // USER CUSTOM COINS STATE (To sync logos)
  const [customUserCoins, setCustomUserCoins] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  const [transactionType, setTransactionType] = useState('in');
  
  const [isBridging, setIsBridging] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);

  const [isCustomPlatform, setIsCustomPlatform] = useState(false);
  const [isCustomFrom, setIsCustomFrom] = useState(false);
  const [isCustomTo, setIsCustomTo] = useState(false);
  
  const [deleteContext, setDeleteContext] = useState(null); 
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const todayDate = new Date().toISOString().split('T')[0];
  
  // 🚀 CRASH FIX: Array of Strings dynamically generated for Dropdowns
  const cryptoSymbols = useMemo(() => {
    return selectedCryptos.map(c => typeof c === 'string' ? c : c.symbol).filter(Boolean);
  }, [selectedCryptos]);

  const [formData, setFormData] = useState({
    coin: cryptoSymbols[0] || 'USDT',
    quantity: '',
    platform: allPlatforms[0], 
    fromPlatform: 'FaucetPay', 
    toPlatform: 'Binance',
    networkFee: '', 
    reason: '',
    referenceNo: '',
    date: todayDate,
    fiatAmount: '', fiatFee: '', fiatCurrency: baseCurrency, fiatExchangeRate: 1, destinationVault: 'bankWallet', destinationVaultName: ''
  });

  // 🚀 FETCH EXISTING BANKS/WALLETS FOR AUTO-SUGGEST (Bridging)
  const [existingVaultNames, setExistingVaultNames] = useState([]);
  useEffect(() => {
     if(!user) return;
     const fetchVaults = async () => {
        const qBank = query(collection(db, "users", user.uid, "bankWallet"));
        const snapBank = await getDocs(qBank);
        const qOnline = query(collection(db, "users", user.uid, "onlineWallet"));
        const snapOnline = await getDocs(qOnline);
        
        const names = new Set();
        snapBank.docs.forEach(d => { if(d.data().bankName) names.add(d.data().bankName) });
        snapOnline.docs.forEach(d => { if(d.data().walletName) names.add(d.data().walletName) });
        setExistingVaultNames(Array.from(names));
     };
     fetchVaults();
  }, [user]);

  // Fetch Wallet Transactions
  useEffect(() => {
    if (!user) return;
    const cryptoRef = collection(db, "users", user.uid, "cryptoWalletLogs");
    const q = query(cryptoRef, orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Custom User Coins for Logo Mapping
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

  // THE MASTER MERGE ENGINE (Ensures wallet has same custom icons as manager)
  const fullDatabase = useMemo(() => {
    const coinMap = new Map();
    defaultCryptoDatabase.forEach(c => coinMap.set(c.symbol.toUpperCase(), c));
    customUserCoins.forEach(c => {
      const existing = coinMap.get(c.symbol.toUpperCase());
      coinMap.set(c.symbol.toUpperCase(), { ...existing, ...c, logo: c.logo || existing?.logo });
    });
    return Array.from(coinMap.values());
  }, [customUserCoins]);

  const holdings = useMemo(() => {
    const vault = {};
    transactions.forEach(t => {
      if (!vault[t.coin]) vault[t.coin] = { total: 0, platforms: {} };
      
      const qty = parseFloat(t.quantity) || 0;
      const fee = parseFloat(t.networkFee) || 0;

      if (t.type === 'in') {
        vault[t.coin].total += qty;
        vault[t.coin].platforms[t.platform] = (vault[t.coin].platforms[t.platform] || 0) + qty;
      } 
      else if (t.type === 'out') {
        vault[t.coin].total -= qty;
        vault[t.coin].platforms[t.platform] = (vault[t.coin].platforms[t.platform] || 0) - qty;
      } 
      else if (t.type === 'transfer') {
        vault[t.coin].platforms[t.fromPlatform] = (vault[t.coin].platforms[t.fromPlatform] || 0) - qty;
        vault[t.coin].platforms[t.toPlatform] = (vault[t.coin].platforms[t.toPlatform] || 0) + (qty - fee);
        vault[t.coin].total -= fee;
      }
    });

    Object.keys(vault).forEach(coin => {
      Object.keys(vault[coin].platforms).forEach(plat => {
        if (vault[coin].platforms[plat] <= 0.00000001) delete vault[coin].platforms[plat];
      });
      if (vault[coin].total <= 0.00000001) delete vault[coin];
    });

    return vault;
  }, [transactions]);

  // 🚀 REBUILT: HYBRID SMART FETCHING ENGINE (CG + GeckoTerminal)
  useEffect(() => {
    const fetchLivePrices = async () => {
      setIsMarketSyncing(true);
      try {
        const fiatRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const fiatData = await fiatRes.json();
        const userBaseRate = fiatData.rates[baseCurrency] || 1;
        setFiatRate(userBaseRate);

        const coinsToFetch = Array.from(new Set([...Object.keys(holdings), ...cryptoSymbols, 'USDT']));
        
        if (coinsToFetch.length > 0) {
          
          let cgJson = {};
          let geckoTerminalData = {};
          const normalCoins = [];
          const contractCoins = [];

          // Sort coins based on fetchMode
          coinsToFetch.forEach(sym => {
             const dbCoin = fullDatabase.find(c => c.symbol === sym.toUpperCase());
             if (dbCoin?.fetchMode === 'contract' && dbCoin.network && dbCoin.contractAddress) {
                contractCoins.push(dbCoin);
             } else {
                normalCoins.push(dbCoin?.id || sym.toLowerCase());
             }
          });

          // Fetch Normal Coins (CoinGecko)
          if (normalCoins.length > 0) {
             const ids = normalCoins.join(',');
             try {
                const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false`);
                if (cgRes.ok) {
                    cgJson = await cgRes.json();
                }
             } catch(e) { console.warn("CoinGecko API Limit Reached"); }
          }

          // Fetch Custom Contract Coins (GeckoTerminal)
          for (const customCoin of contractCoins) {
             try {
                const gtRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/${customCoin.network}/tokens/${customCoin.contractAddress}`);
                if (gtRes.ok) {
                   const gtJson = await gtRes.json();
                   geckoTerminalData[customCoin.id] = {
                      current_price: parseFloat(gtJson.data.attributes.price_usd),
                      price_change_percentage_24h: 0 // GT doesn't always provide simple 24h change here
                   };
                }
             } catch (error) { console.warn(`GeckoTerminal failed for ${customCoin.symbol}`); }
          }

          // Combine results into priceMap
          const priceMap = {};
          
          await Promise.all(coinsToFetch.map(async (sym) => {
            const upperSym = sym.toUpperCase();
            const dbCoin = fullDatabase.find(c => c.symbol === upperSym) || {};
            const searchId = dbCoin.id || sym.toLowerCase();
            
            let liveData = null;
            if (dbCoin.fetchMode === 'contract') {
                liveData = geckoTerminalData[searchId];
            } else {
                liveData = cgJson.length > 0 ? cgJson.find(c => c.id === searchId) : null;
            }
            
            // Fallback Binance (Safe coins only)
            if(!liveData || !liveData.current_price) {
               try {
                 if(BINANCE_SAFE_COINS.includes(upperSym)) {
                    const bSym = searchId === 'tether' ? 'BTCUSDT' : `${upperSym}USDT`;
                    const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSym}`);
                    if (bRes.ok) {
                      const bData = await bRes.json();
                      liveData = {
                        current_price: searchId === 'tether' ? 1.00 : parseFloat(bData.lastPrice),
                        price_change_percentage_24h: searchId === 'tether' ? 0.01 : parseFloat(bData.priceChangePercent)
                      };
                    }
                 }
               } catch(e) {}
            }

            priceMap[upperSym] = {
              priceUSD: liveData?.current_price || dbCoin.fallbackPrice || 0,
              change: liveData?.price_change_percentage_24h || 0
            };
          }));
          
          setLivePrices(priceMap);
        }
      } catch (error) { console.error("Crypto Sync Error"); } finally { setIsMarketSyncing(false); }
    };

    if (!isLoading && fullDatabase.length > 0) {
        fetchLivePrices();
        const interval = setInterval(fetchLivePrices, 60000); // Also auto-refresh every minute
        return () => clearInterval(interval);
    }
  }, [isLoading, holdings, cryptoSymbols, baseCurrency, fullDatabase]);

  const totalVaultValue = useMemo(() => {
    return Object.entries(holdings).reduce((total, [coin, data]) => {
      const priceUSD = livePrices[coin.toUpperCase()]?.priceUSD || 0;
      return total + (data.total * priceUSD * fiatRate);
    }, 0);
  }, [holdings, livePrices, fiatRate]);

  // 🚀 REPORT DOWNLOAD LOGIC FOR CRYPTO VAULT
  const handleDownloadReport = (format) => {
    if (transactions.length === 0) return alert("No records found to download.");

    // Format Data securely with Global Date
    const reportData = transactions.map(rec => {
      const cleanReason = (rec.reason || 'N/A').replace(/(\r\n|\n|\r)/gm, " ");
      
      let actionType = 'Deposit (+)';
      if (rec.type === 'out') actionType = 'Withdraw/Sell (-)';
      if (rec.type === 'transfer') actionType = 'Internal Transfer (↔)';

      let platformText = rec.platform || 'N/A';
      if (rec.type === 'transfer') {
         platformText = `${rec.fromPlatform} ➔ ${rec.toPlatform}`;
      }

      let netQuantityText = `${rec.type === 'out' ? '-' : '+'}${rec.quantity} ${rec.coin}`;
      if (rec.type === 'transfer') {
         netQuantityText = `${rec.quantity} ${rec.coin}`; // Net amount moved
      }

      return {
        // 🚀 GLOBAL DATE IN REPORTS
        date: formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date,
        type: actionType,
        coin: rec.coin,
        quantity: netQuantityText,
        platform: platformText,
        fee: rec.type === 'transfer' && rec.networkFee > 0 ? `${rec.networkFee} ${rec.coin}` : '0',
        note: cleanReason
      };
    });

    const columns = [
      { header: 'Date', key: 'date' },
      { header: 'Action', key: 'type' },
      { header: 'Asset', key: 'coin' },
      { header: 'Quantity', key: 'quantity' },
      { header: 'Platform / Route', key: 'platform' },
      { header: 'Network Fee', key: 'fee' },
      { header: 'Note / Ref', key: 'note' }
    ];

    const fileName = `Crypto_Ledger_Report`;
    const reportTitle = `Digital Asset Vault - Complete Ledger`;

    if (format === 'pdf') {
      downloadPDFReport(reportData, columns, fileName, reportTitle);
    } else {
      downloadExcelReport(reportData, columns, fileName);
    }
  };

  const fetchFiatLiveRate = async () => {
    if (formData.fiatCurrency === baseCurrency) return;
    setIsFetchingRate(true);
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${formData.fiatCurrency}`);
      const data = await res.json();
      if (data.rates[baseCurrency]) setFormData(prev => ({ ...prev, fiatExchangeRate: data.rates[baseCurrency].toFixed(4) }));
    } catch (error) { alert("Failed to fetch fiat exchange rate."); } finally { setIsFetchingRate(false); }
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const qty = parseFloat(formData.quantity);
    const fee = parseFloat(formData.networkFee) || 0;

    if (qty <= 0) return alert("Quantity must be greater than zero.");
    if (transactionType !== 'transfer' && !formData.platform.trim()) return alert("Please enter a wallet name!");

    // 🚀 Require exact bank/wallet name when bridging out to fiat
    if (transactionType === 'out' && isBridging && !editingId) {
       if ((formData.destinationVault === 'bankWallet' || formData.destinationVault === 'onlineWallet') && !formData.destinationVaultName.trim()) {
           return alert("Please specify the exact Bank or Wallet Name to receive fiat funds.");
       }
    }

    if (!editingId) {
      if (transactionType === 'out') {
        const platBal = holdings[formData.coin]?.platforms[formData.platform] || 0;
        if (qty > platBal) return alert(`Insufficient Funds in ${formData.platform}! Available: ${platBal} ${formData.coin}`);
      }
      if (transactionType === 'transfer') {
        const platBal = holdings[formData.coin]?.platforms[formData.fromPlatform] || 0;
        if (qty > platBal) return alert(`Insufficient Funds! You only have ${platBal} ${formData.coin}.`);
        if (fee >= qty) return alert(`Fee cannot be equal or greater than the transfer quantity!`);
        if (formData.fromPlatform.toLowerCase() === formData.toPlatform.toLowerCase()) return alert("Cannot transfer to the same wallet.");
      }
    }

    setIsSaving(true);
    const timestamp = editingId ? transactions.find(t => t.id === editingId)?.timestamp : new Date(formData.date).getTime();
    
    const recordData = {
      type: transactionType, coin: formData.coin, quantity: qty, date: formData.date, timestamp: timestamp, referenceNo: formData.referenceNo || ''
    };

    if (transactionType === 'transfer') {
      recordData.fromPlatform = formData.fromPlatform; recordData.toPlatform = formData.toPlatform;
      recordData.networkFee = fee; recordData.reason = formData.reason || `Shifted ${formData.coin}`;
    } else {
      recordData.platform = formData.platform; recordData.reason = formData.reason || (transactionType === 'in' ? 'Deposit' : 'Withdrawal');
    }

    try {
      let cryptoRecordId = editingId;

      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "cryptoWalletLogs", editingId), recordData, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, "users", user.uid, "cryptoWalletLogs"), recordData);
        cryptoRecordId = docRef.id;
      }

      // OFF-RAMP LOGIC (Sell Crypto -> Send to Fiat Bank)
      if (transactionType === 'out' && isBridging && !editingId) {
        const grossFiat = parseFloat(formData.fiatAmount) || 0;
        const fiatFee = parseFloat(formData.fiatFee) || 0;
        const exRate = parseFloat(formData.fiatExchangeRate) || 1;
        
        let fiatRecord = {
          title: `Sold ${qty} ${formData.coin} (From ${formData.platform})`, type: 'in', date: formData.date, timestamp: timestamp,
          currency: formData.fiatCurrency, linkedCryptoId: cryptoRecordId 
        };

        if (formData.destinationVault === 'bankWallet') {
          const vaultFeeBase = fiatFee * exRate; 
          const finalBase = (grossFiat * exRate) - vaultFeeBase;
          fiatRecord.foreignAmount = grossFiat; fiatRecord.exchangeRate = exRate; fiatRecord.fee = vaultFeeBase; 
          fiatRecord.finalBaseAmount = finalBase; fiatRecord.bankName = formData.destinationVaultName.trim() || 'Bank';
          fiatRecord.transferType = 'Crypto Sell'; fiatRecord.isP2P = true;
        } else if (formData.destinationVault === 'onlineWallet') {
          const netFiat = grossFiat - fiatFee; const finalBase = netFiat * exRate;
          fiatRecord.foreignAmount = grossFiat; fiatRecord.fee = fiatFee; fiatRecord.netForeignAmount = netFiat;
          fiatRecord.exchangeRate = exRate; fiatRecord.finalBaseAmount = finalBase; fiatRecord.walletName = formData.destinationVaultName.trim() || 'E-Wallet';
          fiatRecord.walletCategory = 'Fiat Wallet';
        } else if (formData.destinationVault === 'cashWallet') {
          const netFiat = grossFiat - fiatFee; const finalBase = netFiat * exRate;
          fiatRecord.foreignAmount = netFiat; fiatRecord.fee = 0; fiatRecord.exchangeRate = exRate; fiatRecord.finalBaseAmount = finalBase;
        }
        await addDoc(collection(db, "users", user.uid, formData.destinationVault), fiatRecord);
      }

      closeModal();
    } catch (error) { alert("System Error: Failed to process transaction."); } finally { setIsSaving(false); }
  };

  const handleEdit = (rec) => {
    setTransactionType(rec.type); setIsBridging(false); 
    if (rec.type === 'transfer') {
      setIsCustomFrom(!allPlatforms.includes(rec.fromPlatform)); setIsCustomTo(!allPlatforms.includes(rec.toPlatform));
    } else {
      setIsCustomPlatform(!allPlatforms.includes(rec.platform));
    }
    setFormData({
      coin: rec.coin, quantity: rec.quantity, platform: rec.platform || allPlatforms[0],
      fromPlatform: rec.fromPlatform || 'FaucetPay', toPlatform: rec.toPlatform || 'Binance',
      networkFee: rec.networkFee || '', reason: rec.reason || '', referenceNo: rec.referenceNo || '', date: rec.date,
      fiatAmount: '', fiatFee: '', fiatCurrency: baseCurrency, fiatExchangeRate: 1, destinationVault: 'bankWallet', destinationVaultName: existingVaultNames[0] || ''
    });
    setEditingId(rec.id); setIsModalOpen(true);
  };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("Please enter your PIN.");
    setIsVerifying(true);
    setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      
      const hashedInput = await hashPIN(pinInput.trim());
      const storedPin = userData?.security?.pinHash || userData?.securityPin || userData?.pin; 

      if (storedPin && storedPin.toString() !== hashedInput && storedPin.toString() !== pinInput.trim()) {
        setPinError("Incorrect Security PIN. Deletion blocked."); 
        setIsVerifying(false); 
        return;
      }
      
      // 1. Delete Master Crypto Record
      await deleteDoc(doc(db, "users", user.uid, "cryptoWalletLogs", deleteContext.id));
      
      // 2. Cascade Delete Bridged Fiat Records (If this was a Sell/Withdraw)
      const linkedVaults = ['bankWallet', 'onlineWallet', 'cashWallet'];
      for (const vault of linkedVaults) {
          const q = query(collection(db, "users", user.uid, vault), where("linkedCryptoId", "==", deleteContext.id));
          const snap = await getDocs(q);
          snap.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, vault, d.id)));
      }

      setDeleteContext(null); 
    } catch (error) { setPinError("Verification failed."); } finally { setIsVerifying(false); }
  };

  const openModal = (type) => {
    setTransactionType(type); setEditingId(null); setIsBridging(false);
    setFormData(prev => ({ 
      ...prev, quantity: '', reason: '', referenceNo: '', networkFee: '', platform: allPlatforms[0], fromPlatform: 'FaucetPay', toPlatform: 'Binance',
      destinationVaultName: existingVaultNames[0] || '' 
    }));
    setIsCustomPlatform(false); setIsCustomFrom(false); setIsCustomTo(false); setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const filteredLedger = transactions.filter(t => 
    t.coin.toLowerCase().includes(searchTerm.toLowerCase()) || t.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.platform?.toLowerCase().includes(searchTerm.toLowerCase()) || t.fromPlatform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-orange-500/10 text-orange-500 rounded-2xl ring-1 ring-orange-500/20">
              <FaBitcoin size={26} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Crypto Engine</h1>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
            Track multi-wallet holdings, handle cross-border arbitrage, and seamlessly off-ramp to Fiat Vaults.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* 🚀 DOWNLOAD REPORT DROPDOWN */}
          <div className="relative group">
            <button className="flex items-center gap-1 md:gap-2 p-3 md:p-3 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 rounded-xl font-black text-xs transition-all active:scale-95 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
              <HiOutlineDownload size={18}/> 
              <span className="hidden sm:inline">Download Report</span>
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

          <button onClick={() => openModal('transfer')} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-500/10 dark:text-blue-400 px-4 md:px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 border border-blue-200 dark:border-blue-500/20">
            <HiOutlineSwitchHorizontal size={18} /> Transfer
          </button>
          <button onClick={() => openModal('out')} className="flex items-center gap-2 bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white dark:bg-rose-500/10 dark:text-rose-400 px-4 md:px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 border border-rose-200 dark:border-rose-500/20">
            <HiOutlineUpload size={18} /> Sell
          </button>
          <button onClick={() => openModal('in')} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 md:px-6 py-3 rounded-xl font-black text-xs transition-all active:scale-95 shadow-lg shadow-orange-500/25">
            <HiOutlineDownload size={18} /> Deposit
          </button>
        </div>
      </div>

      {/* MASTER VAULT VALUE CARD */}
      <div className="p-8 md:p-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute -right-10 -top-10 opacity-5 text-white blur-[2px]"><FaShieldAlt size={250} /></div>
        <div className="relative z-10">
          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isMarketSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span> Total Crypto Net Worth
          </p>
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
            <span className="text-orange-500 mr-2">{currencySymbol}</span>{totalVaultValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
        </div>
        <div className="relative z-10 bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-md text-right">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Active Assets</p>
           <p className="text-3xl font-black text-white">{Object.keys(holdings).length}</p>
        </div>
      </div>

      {/* WALLET-WISE HOLDINGS GRID */}
      <div>
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
          <FaChartPie /> Multi-Platform Balances
        </h3>
        {Object.keys(holdings).length === 0 ? (
           <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
             <FaWallet className="mx-auto text-5xl text-slate-200 dark:text-slate-800 mb-4" />
             <p className="text-slate-500 font-bold">Your crypto vault is empty. Deposit assets to start tracking.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Object.entries(holdings).sort((a, b) => b[1].total - a[1].total).map(([coin, data]) => {
              const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === coin.toUpperCase()) || {};
              const liveData = livePrices[coin.toUpperCase()] || {};
              const livePriceBase = (liveData.priceUSD || dbCoin.fallbackPrice || 0) * fiatRate;
              const totalValBase = data.total * livePriceBase;

              return (
                <div key={coin} className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm hover:border-orange-500/50 transition-colors group flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <LogoRenderer symbol={coin} logoUrl={dbCoin.logo} bg={dbCoin.bg} color={dbCoin.color} />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white uppercase text-lg tracking-tight">{coin}</h4>
                        <p className={`text-xs font-black mt-0.5 flex items-center gap-1 ${liveData.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {liveData.change >= 0 ? <HiOutlineTrendingUp/> : <HiOutlineTrendingDown/>}{Math.abs(liveData.change || 0).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight break-all">
                        {data.total % 1 !== 0 ? data.total.toFixed(8).replace(/\.?0+$/, '') : data.total}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">
                        ≈ {currencySymbol}{totalValBase.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FaBuilding/> Storage Allocation</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(data.platforms).map(([plat, qty]) => (
                        <div key={plat} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold">
                          <span className="text-slate-500 dark:text-slate-400">{plat}:</span>
                          <span className="text-slate-800 dark:text-white">{qty % 1 !== 0 ? qty.toFixed(6).replace(/\.?0+$/, '') : qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LEDGER SEARCH & TABLE */}
      <div className="flex gap-4 bg-white dark:bg-slate-900 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
          <input type="text" placeholder="Search transactions by coin, platform or reason..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-4 py-4 bg-transparent font-bold text-slate-700 dark:text-white outline-none" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">On-Chain Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 pl-6 w-12 text-center">Type</th>
                <th className="p-4">Coin & Event</th>
                <th className="p-4">Platform Details</th>
                <th className="p-4 text-right">Quantity Flow</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {filteredLedger.map((rec) => {
                const dbCoin = fullDatabase.find(c => c.symbol.toUpperCase() === rec.coin.toUpperCase()) || {};

                return (
                <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="p-4 pl-6 text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg shrink-0 ${rec.type === 'in' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' : rec.type === 'out' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'}`}>
                      {rec.type === 'in' ? <HiOutlineDownload /> : rec.type === 'out' ? <HiOutlineUpload /> : <HiOutlineSwitchHorizontal />}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 p-1 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                        <LogoRenderer symbol={rec.coin} logoUrl={dbCoin.logo} bg={dbCoin.bg} color={dbCoin.color} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white text-sm uppercase">{rec.coin}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5 capitalize">{rec.reason}</p>
                        {/* 🚀 GLOBAL DATE INTEGRATION */}
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {formatGlobalDate ? formatGlobalDate(rec.date, 'full') : rec.date}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    {rec.type === 'transfer' ? (
                      <div>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1"><span className="text-rose-500"><HiOutlineUpload/></span> {rec.fromPlatform}</p>
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1"><span className="text-emerald-500"><HiOutlineDownload/></span> {rec.toPlatform}</p>
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 inline-flex"><FaWallet/> {rec.platform}</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <p className={`text-lg font-black tracking-tight ${rec.type === 'in' ? 'text-emerald-600 dark:text-emerald-400' : rec.type === 'out' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {rec.type === 'in' ? '+' : rec.type === 'out' ? '-' : '↔'}{rec.quantity}
                    </p>
                    {rec.type === 'transfer' && rec.networkFee > 0 && <p className="text-[9px] font-bold text-rose-500 mt-1">Fee: -{rec.networkFee} | Net: {(rec.quantity - rec.networkFee).toFixed(8).replace(/\.?0+$/, '')}</p>}
                  </td>
                  <td className="p-4 pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(rec)} className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm"><HiOutlinePencil size={18} /></button>
                      <button onClick={() => { setDeleteContext(rec); setPinInput(''); setPinError(''); }} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 hover:bg-rose-100 rounded-xl transition-all shadow-sm"><HiOutlineTrash size={18} /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🚀 FIXED MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className={`px-6 sm:px-8 py-5 flex justify-between items-center transition-colors duration-300 text-white shrink-0 ${transactionType === 'in' ? 'bg-orange-500' : transactionType === 'out' ? 'bg-rose-500' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3">
                {transactionType === 'in' ? <HiOutlineDownload size={24} /> : transactionType === 'out' ? <HiOutlineUpload size={24} /> : <HiOutlineSwitchHorizontal size={24} />}
                <h3 className="text-xl font-black">{editingId ? 'Edit Record' : transactionType === 'in' ? 'Deposit Crypto' : transactionType === 'out' ? 'Withdraw Crypto' : 'Internal Transfer'}</h3>
              </div>
              <button onClick={closeModal} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {!editingId && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex gap-3 items-start">
                  <HiOutlineInformationCircle size={24} className={`shrink-0 ${transactionType === 'in' ? 'text-orange-500' : transactionType === 'out' ? 'text-rose-500' : 'text-blue-500'}`} />
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {transactionType === 'in' && <p><strong className="text-orange-500 font-black tracking-wide">WHEN TO USE:</strong> Add new coins to your vault.</p>}
                    {transactionType === 'out' && <p><strong className="text-rose-500 font-black tracking-wide">WHEN TO USE:</strong> Deduct coins from your vault. You can also auto-sync the proceeds to your Fiat Bank Wallet below.</p>}
                    {transactionType === 'transfer' && <p><strong className="text-blue-500 font-black tracking-wide">WHEN TO USE:</strong> Moving funds between your own apps (e.g., FaucetPay to CoinDCX). Only network fees are deducted.</p>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Asset</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                      <LogoRenderer symbol={formData.coin} logoUrl={fullDatabase.find(c=>c.symbol===formData.coin)?.logo} bg={fullDatabase.find(c=>c.symbol===formData.coin)?.bg} color={fullDatabase.find(c=>c.symbol===formData.coin)?.color} />
                    </div>
                    <select value={formData.coin} onChange={(e) => setFormData({...formData, coin: e.target.value})} className="w-full pl-14 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none cursor-pointer appearance-none">
                      {cryptoSymbols.length > 0 ? cryptoSymbols.map(c => <option key={c} value={c}>{c}</option>) : <option value="BTC">BTC (Default)</option>}
                    </select>
                    <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">Quantity {transactionType === 'out' && !editingId && <span className="text-rose-500">Max: {holdings[formData.coin]?.platforms[formData.platform] || 0}</span>}</label>
                  <input type="number" step="any" required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} placeholder="e.g. 100" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-2xl dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50 tracking-widest" />
                </div>
              </div>

              {transactionType === 'transfer' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1 flex justify-between">From Wallet {!editingId && <span className="text-slate-500">Max: {holdings[formData.coin]?.platforms[formData.fromPlatform] || 0}</span>}</label>
                    {isCustomFrom ? (
                      <div className="flex gap-2">
                        <input type="text" autoFocus required placeholder="Type wallet name..." value={formData.fromPlatform} onChange={(e)=>setFormData({...formData, fromPlatform: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl font-bold dark:text-white outline-none" />
                        <button type="button" onClick={()=>{setIsCustomFrom(false); setFormData({...formData, fromPlatform: allPlatforms[13]});}} className="p-4 bg-white dark:bg-slate-800 rounded-xl text-slate-500"><HiOutlineX/></button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none"><FaWallet/></div>
                        <select value={allPlatforms.includes(formData.fromPlatform) ? formData.fromPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setIsCustomFrom(true); setFormData({...formData, fromPlatform: ''}); } else { setFormData({...formData, fromPlatform: e.target.value}); } }} className="w-full pl-11 pr-10 py-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                          {allPlatforms.map(p => <option key={`from-${p}`} value={p}>{p}</option>)}
                          <option value="CUSTOM" className="font-black text-blue-600">✨ Add Custom</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">To Wallet</label>
                    {isCustomTo ? (
                      <div className="flex gap-2">
                        <input type="text" autoFocus required placeholder="Wallet name..." value={formData.toPlatform} onChange={(e)=>setFormData({...formData, toPlatform: e.target.value})} className="w-full p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl font-bold dark:text-white outline-none" />
                        <button type="button" onClick={()=>{setIsCustomTo(false); setFormData({...formData, toPlatform: allPlatforms[0]});}} className="p-4 bg-white dark:bg-slate-800 rounded-xl text-slate-500"><HiOutlineX/></button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"><FaWallet/></div>
                        <select value={allPlatforms.includes(formData.toPlatform) ? formData.toPlatform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setIsCustomTo(true); setFormData({...formData, toPlatform: ''}); } else { setFormData({...formData, toPlatform: e.target.value}); } }} className="w-full pl-11 pr-10 py-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                          {allPlatforms.map(p => <option key={`to-${p}`} value={p}>{p}</option>)}
                          <option value="CUSTOM" className="font-black text-blue-600">✨ Add Custom</option>
                        </select>
                        <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">Platform / Storage {transactionType === 'out' && !editingId && <span className="text-rose-500">Max: {holdings[formData.coin]?.platforms[formData.platform] || 0}</span>}</label>
                  {isCustomPlatform ? (
                    <div className="flex gap-2">
                      <input type="text" autoFocus required placeholder="Type custom wallet name..." value={formData.platform} onChange={(e)=>setFormData({...formData, platform: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-orange-500/50" />
                      <button type="button" onClick={()=>{setIsCustomPlatform(false); setFormData({...formData, platform: allPlatforms[0]});}} className="px-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500"><HiOutlineX size={20}/></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><FaBuilding size={16}/></div>
                      <select value={allPlatforms.includes(formData.platform) ? formData.platform : 'CUSTOM'} onChange={(e) => { if(e.target.value === 'CUSTOM'){ setIsCustomPlatform(true); setFormData({...formData, platform: ''}); } else { setFormData({...formData, platform: e.target.value}); } }} className="w-full pl-12 pr-10 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none cursor-pointer appearance-none">
                        {allPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="CUSTOM" className="font-black text-orange-500">✨ Add Custom Wallet</option>
                      </select>
                      <HiOutlineChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                    </div>
                  )}
                </div>
              )}

              {transactionType === 'out' && !editingId && (
                <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${isBridging ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-400' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700'}`}>
                  <label className="flex items-start gap-4 cursor-pointer">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input type="checkbox" checked={isBridging} onChange={(e) => setIsBridging(e.target.checked)} className="sr-only" />
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isBridging ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isBridging && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <div>
                      <p className={`font-black flex items-center gap-2 ${isBridging ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}><FaExchangeAlt /> Sell for Fiat Currency</p>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1">Automatically log the cash/bank deposit for this sale.</p>
                    </div>
                  </label>
                  {isBridging && (
                    <div className="mt-5 pt-5 border-t border-emerald-200 dark:border-emerald-800/50 space-y-5 animate-in fade-in zoom-in-95">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">Gross Fiat Received</label>
                          <input type="number" step="any" required={isBridging} value={formData.fiatAmount} onChange={(e) => setFormData({...formData, fiatAmount: e.target.value})} placeholder="e.g. 10039" className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-xl font-bold dark:text-white outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Currency</label>
                          <select value={formData.fiatCurrency} onChange={(e) => { setFormData({...formData, fiatCurrency: e.target.value}); if(e.target.value !== baseCurrency) fetchFiatLiveRate(); }} className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                            {fiatCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      {formData.fiatCurrency !== baseCurrency && (
                        <div className="col-span-2 p-4 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><FaExchangeAlt /> Conversion to {baseCurrency}</label>
                            <button type="button" onClick={fetchFiatLiveRate} disabled={isFetchingRate} className="text-[10px] font-black bg-emerald-600 text-white px-2 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1"><HiOutlineRefresh className={isFetchingRate ? 'animate-spin' : ''} /> {isFetchingRate ? 'Fetching...' : 'Get Live Rate'}</button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-500">1 {formData.fiatCurrency} = </span>
                            <input type="number" step="any" required value={formData.fiatExchangeRate} onChange={(e) => setFormData({...formData, fiatExchangeRate: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-lg font-bold dark:text-white outline-none" />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Tax / Gateway Fee</label>
                          <input type="number" step="any" value={formData.fiatFee} onChange={(e) => setFormData({...formData, fiatFee: e.target.value})} placeholder={`in ${formData.fiatCurrency}`} className="w-full p-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-xl font-bold dark:text-white outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destination Vault</label>
                          <select value={formData.destinationVault} onChange={(e) => setFormData({...formData, destinationVault: e.target.value, destinationVaultName: existingVaultNames[0] || ''})} className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-xl font-bold dark:text-white outline-none cursor-pointer">
                            {vaultDestinations.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      {formData.destinationVault !== 'cashWallet' && (
                        <div className="space-y-2 animate-in fade-in">
                          <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Account / Wallet Name</label>
                          <input type="text" list="crypto-fiat-vaults" required={isBridging && formData.destinationVault !== 'cashWallet'} value={formData.destinationVaultName} onChange={(e) => setFormData({...formData, destinationVaultName: e.target.value})} placeholder="e.g. SBI, PayPal" className="w-full p-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                          <datalist id="crypto-fiat-vaults">
                             {existingVaultNames.map(b => <option key={b} value={b} />)}
                          </datalist>
                        </div>
                      )}

                      <div className="p-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex justify-between items-center">
                         <div className="flex flex-col">
                             <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Net Fiat Added:</span>
                         </div>
                         <div className="text-right">
                             <span className="block text-lg font-black text-emerald-700 dark:text-emerald-400">
                               {formData.fiatCurrency} {Math.max(0, (parseFloat(formData.fiatAmount) || 0) - (parseFloat(formData.fiatFee) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                             </span>
                             {formData.fiatCurrency !== baseCurrency && (
                               <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-500">
                                 ≈ {baseCurrency} {(Math.max(0, (parseFloat(formData.fiatAmount) || 0) - (parseFloat(formData.fiatFee) || 0)) * (parseFloat(formData.fiatExchangeRate) || 1)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                               </span>
                             )}
                         </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {transactionType === 'transfer' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-rose-500 uppercase tracking-widest ml-1">Network Fee (Paid in {formData.coin})</label>
                  <input type="number" step="any" value={formData.networkFee} onChange={(e) => setFormData({...formData, networkFee: e.target.value})} placeholder={`e.g. 0.0001 ${formData.coin}`} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-rose-200 dark:border-rose-900/50 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
              )}

              {transactionType !== 'transfer' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Reason / Note</label>
                  <input type="text" required value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} placeholder={transactionType === 'in' ? 'e.g. Purchased via CoinDCX' : 'e.g. Sold for INR'} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">TxHash (Opt)</label>
                  <input type="text" value={formData.referenceNo} onChange={(e) => setFormData({...formData, referenceNo: e.target.value})} placeholder="0x..." className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
                {/* 🚀 GLOBAL DATE IN MODAL UI */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex justify-between ml-1">
                    <span>Date</span>
                    <span className="text-orange-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                  </label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className={`w-full p-4 rounded-2xl font-black text-white text-lg transition-all shadow-xl flex items-center justify-center gap-2 shrink-0 ${isSaving ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'} ${transactionType === 'in' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : transactionType === 'out' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
                {isSaving ? <HiOutlineRefresh className="animate-spin text-2xl" /> : null}
                {isSaving ? 'Processing...' : (editingId ? 'Update Record' : transactionType === 'in' ? 'Confirm Deposit' : transactionType === 'out' ? 'Confirm Deduction' : 'Execute Transfer')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🔐 DELETE SECURITY MODAL */}
      {deleteContext && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-8 border border-rose-100 dark:border-rose-900/50 relative overflow-hidden max-h-[calc(100dvh-6rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 dark:bg-rose-500/20 rounded-full flex items-center justify-center text-3xl mb-4"><HiOutlineLockClosed /></div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Security Check</h3>
              <p className="text-sm font-bold text-slate-500 mt-2">Deleting this record will alter your total {deleteContext.coin} holdings.</p>
            </div>
            <form onSubmit={executeSecureDelete} className="space-y-4">
              <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="ENTER PIN" className="w-full text-center tracking-[0.5em] text-2xl p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50" />
              {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce">{pinError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setDeleteContext(null)} className="flex-1 p-4 rounded-2xl font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 p-4 rounded-2xl font-black text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50">Verify</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CryptoWallet;