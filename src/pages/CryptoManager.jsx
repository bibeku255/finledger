import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  HiOutlineSearch, HiOutlineCheckCircle, HiOutlinePlus, 
  HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCloudDownload, HiOutlineRefresh, HiOutlinePhotograph, HiOutlineLink
} from 'react-icons/hi';
import { FaBitcoin, FaCoins } from 'react-icons/fa';

// 🚀 1. PREMIUM LOGO RENDERER
const LogoRenderer = ({ symbol, customLogo, bg, color }) => {
  const [hasError, setHasError] = useState(false);
  const symbolUpper = (symbol || '').toUpperCase();

  if (!customLogo || hasError) {
    return (
      <span className={`w-full h-full rounded-full flex items-center justify-center font-black text-[10px] sm:text-[11px] ${bg || 'bg-slate-100 dark:bg-slate-800'} ${color || 'text-slate-500 dark:text-slate-300'} shadow-inner border border-slate-200/50 dark:border-slate-700/50`}>
        {symbolUpper?.substring(0, 3)}
      </span>
    );
  }

  return (
    <img 
      src={customLogo} 
      alt={symbolUpper} 
      className="w-full h-full object-contain rounded-full relative z-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm p-[2px]"
      loading="lazy"
      onError={() => setHasError(true)} 
    />
  );
};

// 🚀 2. VERIFIED MASTER DATABASE
const defaultCryptoDatabase = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', logo: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'tether', symbol: 'CTC', name: 'CryptoTab Coin', logo: 'https://assets.coingecko.com/coins/images/11105/large/Creditcoin_logo.png', fallbackPrice: 1.00, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  { id: 'tether', symbol: 'ROX', name: 'Robox (Pegged)', logo: 'https://assets.geckoterminal.com/vdl79ryhkyksbnrtp11hqrpuwmyu', fallbackPrice: 1.00, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png', color: 'text-slate-800 dark:text-white', bg: 'bg-slate-500/10' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', logo: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', logo: 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png', color: 'text-red-600', bg: 'bg-red-600/10' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png', color: 'text-yellow-600', bg: 'bg-yellow-600/10' },
  { id: 'feyorra', symbol: 'FEY', name: 'Feyorra', logo: 'https://assets.coingecko.com/coins/images/13600/large/feyorra.png', fallbackPrice: 0.0091, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'taraxa', symbol: 'TARA', name: 'Taraxa', logo: 'https://assets.coingecko.com/coins/images/14409/large/taraxa.png', fallbackPrice: 0.0045, color: 'text-indigo-500', bg: 'bg-indigo-500/10' }
];

// Networks for GeckoTerminal
const SUPPORTED_NETWORKS = [
  { id: 'eth', name: 'Ethereum' },
  { id: 'bsc', name: 'Binance Smart Chain (BSC)' },
  { id: 'solana', name: 'Solana' },
  { id: 'polygon_pos', name: 'Polygon' },
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'base', name: 'Base' },
  { id: 'optimism', name: 'Optimism' }
];

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
  
  // 🚀 NAYA: Fetch Mode Toggle (CoinGecko vs Contract Address)
  const [fetchMode, setFetchMode] = useState('id'); // 'id' or 'contract'

  // 🚀 NAYA: State Object updated with network and contract details
  const [newCoin, setNewCoin] = useState({ 
    apiId: '', 
    network: 'bsc', // Default to BSC
    contractAddress: '',
    symbol: '', 
    name: '', 
    fallbackPrice: '', 
    logoUrl: '' 
  });

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
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false`);
        if (res.ok) setTop250Coins(await res.json());
      } catch (err) { console.warn("Using default registry."); }
      finally { setIsLoading(false); }
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
      } catch(err) { console.error(err); }
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
      coinMap.set(c.symbol.toUpperCase(), { ...c, fallbackPrice: existing?.fallbackPrice || c.fallbackPrice });
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
         // NAYA: Save network and contract address if they exist
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
      network: coin.network || 'bsc',
      contractAddress: coin.contractAddress || '',
      symbol: coin.symbol, 
      name: coin.name,
      fallbackPrice: coin.fallbackPrice || '', 
      logoUrl: coin.logo || '' 
    });
    setIsAddModalOpen(true);
  };

  // 🚀 THE MAGIC: SMART FETCHING ENGINE
  const handleAutoFetchDetails = async () => {
    setIsFetchingData(true);
    
    try {
      if (fetchMode === 'id') {
        if (!newCoin.apiId) { alert("Enter CoinGecko ID"); setIsFetchingData(false); return; }
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${newCoin.apiId.toLowerCase().trim()}`);
        if (res.ok) {
          const data = await res.json();
          setNewCoin(prev => ({
            ...prev, 
            symbol: data.symbol.toUpperCase(), 
            name: data.name,
            fallbackPrice: data.market_data?.current_price?.usd || prev.fallbackPrice,
            logoUrl: data.image?.large || prev.logoUrl
          }));
        } else {
          alert("CoinGecko ID not found.");
        }
      } 
      else if (fetchMode === 'contract') {
        if (!newCoin.contractAddress || !newCoin.network) { alert("Enter Network and Contract Address"); setIsFetchingData(false); return; }
        const address = newCoin.contractAddress.trim();
        const network = newCoin.network;
        
        // Use GeckoTerminal API for Contract Addresses
        const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data.attributes;
          setNewCoin(prev => ({
            ...prev,
            symbol: data.symbol.toUpperCase(),
            name: data.name,
            fallbackPrice: data.price_usd || prev.fallbackPrice,
            logoUrl: data.image_url || prev.logoUrl,
            // Automatically generate a unique ID for our database
            apiId: `custom-${network}-${address.substring(0,6)}`
          }));
        } else {
          alert("Contract not found on GeckoTerminal. You can still enter details manually.");
        }
      }
    } catch (err) { 
      console.error(err);
      alert("Network error. Manual entry allowed."); 
    }
    finally { setIsFetchingData(false); }
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

    const newCoinObj = {
      id: ['ROX', 'CTC'].includes(safeSymbol) ? 'tether' : (safeApiId || safeName.toLowerCase().replace(/\s+/g, '-')),
      symbol: safeSymbol, 
      name: safeName,
      fallbackPrice: parseFloat(newCoin.fallbackPrice) || 0,
      logo: safeLogoUrl !== '' ? safeLogoUrl : null,
      color: 'text-purple-500', bg: 'bg-purple-500/10',
      // NAYA: Save the fetching metadata
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
    } catch (e) { alert("Save failed."); }
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
    } catch (error) { alert("Delete failed."); }
  };

  const filteredCoins = fullDatabase.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 mb-24 pt-24 md:pt-8">
      
      {/* 🌟 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-[-5%] top-[-20%] opacity-5 text-white blur-[2px] pointer-events-none">
           <FaBitcoin size={200}/>
        </div>
        <div className="relative z-10">
          <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.2)]">
            <FaBitcoin size={32} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Portfolio Manager</h1>
          <p className="text-sm font-semibold text-slate-400 max-w-xl">
            Select the digital assets you want to track across your Vaults, Income Streams, and AI Strategy.
          </p>
        </div>
        <button onClick={() => { 
          setModalTitle('Add Custom Token'); 
          setFetchMode('contract'); // Default to contract mode for new tokens (more modern)
          setNewCoin({ apiId: '', network: 'bsc', contractAddress: '', symbol: '', name: '', fallbackPrice: '', logoUrl: '' }); 
          setIsAddModalOpen(true); 
        }} className="relative z-10 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-7 py-4 rounded-2xl font-black text-sm border border-white/10 transition-all active:scale-95 backdrop-blur-sm">
          <HiOutlinePlus size={20} /> Custom Token
        </button>
      </div>

      {/* 🔍 SEARCH */}
      <div className="sticky top-[72px] md:top-4 z-40">
        <div className="relative shadow-xl shadow-slate-200/20 dark:shadow-none rounded-[2rem]">
          <HiOutlineSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input type="text" placeholder="Search 300+ Tokens..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] py-5 pl-16 pr-16 text-sm font-black outline-none dark:text-white focus:ring-4 focus:ring-blue-500/10 transition-all" />
          {isLoading && <HiOutlineRefresh className="absolute right-6 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" size={22} />}
        </div>
      </div>

      {/* 🪙 GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-5">
        {filteredCoins.map((coin) => {
          const isSelected = activeCoins.includes(coin.symbol.toUpperCase());
          return (
            <div key={coin.symbol} onClick={() => toggleCoin(coin.symbol)} role="button" tabIndex={0} className={`group cursor-pointer relative flex flex-col items-center p-6 rounded-[2rem] border transition-all duration-300 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-lg shadow-blue-500/10 scale-[1.02]' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'}`}>
              {isSelected && <div className="absolute top-4 right-4 text-blue-500 bg-white dark:bg-slate-900 rounded-full shadow-sm z-10"><HiOutlineCheckCircle size={22} className="fill-current text-white dark:text-slate-900" /></div>}

              {/* 🛠️ EDIT & DELETE BUTTONS */}
              <div className="absolute top-3 left-3 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-20">
                <div onClick={(e) => handleEditClick(e, coin)} className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full shadow-sm flex items-center justify-center transition-transform active:scale-90" title="Edit Token"><HiOutlinePencil size={14} /></div>
                <div onClick={(e) => handleDeleteToken(e, coin.symbol.toUpperCase())} className="w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full shadow-sm flex items-center justify-center transition-transform active:scale-90" title="Delete Token"><HiOutlineTrash size={14} /></div>
              </div>
              
              <div className={`w-16 h-16 rounded-full mb-4 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-1 ${isSelected ? 'ring-4 ring-blue-500/20' : ''}`}>
                <LogoRenderer symbol={coin.symbol} customLogo={coin.logo} bg={coin.bg} color={coin.color} />
              </div>
              <h3 className={`font-black text-base tracking-tight mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>{coin.symbol}</h3>
              <p className="text-[10px] font-bold text-slate-400 truncate w-full text-center px-2">{coin.name}</p>
            </div>
          );
        })}
      </div>

      {/* 📝 ADD/EDIT TOKEN MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-10 sm:zoom-in-95">
            <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-tight flex items-center gap-2"><FaCoins/> {modalTitle}</h3>
              <button onClick={()=>setIsAddModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handleAddCustomCoin} className="p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              
              {/* 🚀 NAYA: FETCH MODE TOGGLE */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button type="button" onClick={() => setFetchMode('contract')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-colors ${fetchMode === 'contract' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>By Contract</button>
                <button type="button" onClick={() => setFetchMode('id')} className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-colors ${fetchMode === 'id' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>By CG ID</button>
              </div>

              {/* 🚀 NAYA: DYNAMIC FETCHING INPUTS */}
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-200 dark:border-blue-500/20 space-y-4">
                
                {fetchMode === 'contract' ? (
                  <>
                    <select value={newCoin.network} onChange={(e) => setNewCoin({...newCoin, network: e.target.value})} className="w-full bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700 text-sm">
                      {SUPPORTED_NETWORKS.map(net => <option key={net.id} value={net.id}>{net.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Paste Smart Contract Address..." value={newCoin.contractAddress} onChange={(e)=>setNewCoin({...newCoin, contractAddress:e.target.value})} className="flex-1 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-mono text-xs text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700"/>
                      <button type="button" onClick={handleAutoFetchDetails} disabled={isFetchingData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50">
                        {isFetchingData ? <HiOutlineRefresh className="animate-spin" size={18}/> : <HiOutlineCloudDownload size={18}/>}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" placeholder="CoinGecko ID (e.g. bitcoin)" value={newCoin.apiId} onChange={(e)=>setNewCoin({...newCoin, apiId:e.target.value})} className="flex-1 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl font-bold text-sm text-slate-700 dark:text-white outline-none border border-slate-200 dark:border-slate-700"/>
                    <button type="button" onClick={handleAutoFetchDetails} disabled={isFetchingData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50">
                      {isFetchingData ? <HiOutlineRefresh className="animate-spin" size={18}/> : <HiOutlineCloudDownload size={18}/>}
                    </button>
                  </div>
                )}
                
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Symbol</label>
                  <input type="text" required value={newCoin.symbol} onChange={(e)=>setNewCoin({...newCoin, symbol:e.target.value.toUpperCase()})} disabled={modalTitle.includes("Edit")} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"/>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fallback Price ($)</label>
                  <input type="number" step="any" value={newCoin.fallbackPrice} onChange={(e)=>setNewCoin({...newCoin, fallbackPrice:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"/>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input type="text" required value={newCoin.name} onChange={(e)=>setNewCoin({...newCoin, name:e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50"/>
              </div>

              {/* 🚀 IMAGE URL PREVIEW SECTION */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                  <HiOutlinePhotograph /> Token Logo Image URL
                </label>
                <div className="relative flex items-center gap-3">
                  <input 
                    type="url" 
                    value={newCoin.logoUrl} 
                    onChange={(e) => setNewCoin({...newCoin, logoUrl: e.target.value})} 
                    placeholder="https://example.com/logo.png" 
                    className="flex-1 w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 text-xs" 
                  />
                  {newCoin.logoUrl && (
                    <div className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                      <img src={newCoin.logoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>
                <p className="text-[9px] font-bold text-slate-400 pl-1 mt-1">Direct image link (e.g., ends in .png, .jpg or Geckoterminal URL)</p>
              </div>

              <button type="submit" className="w-full p-5 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-blue-600/20 transition-all active:scale-95">
                {modalTitle}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚀 FLOATING PILL SAVE BUTTON */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
        <button 
          onClick={handleSave} 
          disabled={isSaving || activeCoins.length === 0} 
          className="w-full px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-2xl shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-10 flex items-center justify-center gap-3 border border-blue-400/50"
        >
          {isSaving ? (
            <><HiOutlineRefresh className="animate-spin" size={20}/> SYNCING PORTFOLIO...</>
          ) : (
            <><HiOutlineCheckCircle size={20}/> SYNC {activeCoins.length} ASSETS</>
          )}
        </button>
      </div>

    </div>
  );
};

export default CryptoManager;