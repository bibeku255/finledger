// src/pages/tools/SecureNotes.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { verifyPINEnhanced } from '../../utils/securityUtils';           // ✅ Enhanced
import { encryptDataV2, decryptDataV2 } from '../../utils/encryption';    // ✅ V2 with random salt
import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineClipboardCopy,
  HiOutlineShieldCheck, HiOutlineRefresh, HiOutlineSearch, HiOutlineFilter,
  HiOutlineViewGrid, HiOutlineViewList, HiOutlineChevronRight, HiOutlineDotsHorizontal,
  HiOutlineKey, HiOutlineSelector
} from 'react-icons/hi';
import { FaKey, FaSeedling, FaUniversity, FaStickyNote, FaLock, FaUnlockAlt, FaShieldAlt } from 'react-icons/fa';

const SecureNotes = () => {
  const { user, formatGlobalDate } = useAuth();
  
  // Vault Security States
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // ✅ Store the PIN + UID instead of a derived key
  const [vaultCredentials, setVaultCredentials] = useState(null); // { pin, uid }

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [revealedNotes, setRevealedNotes] = useState({});
  const [copySuccess, setCopySuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');

  const todayDate = new Date().toISOString().split('T')[0];

  const categories = [
    { id: 'seed', name: 'Seed Phrase', icon: <FaSeedling />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', badge: 'from-emerald-500 to-teal-500' },
    { id: 'password', name: 'Passwords', icon: <FaKey />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/20', badge: 'from-rose-500 to-pink-500' },
    { id: 'bank', name: 'Bank/Cards', icon: <FaUniversity />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', badge: 'from-blue-500 to-indigo-500' },
    { id: 'general', name: 'Secure Memo', icon: <FaStickyNote />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', badge: 'from-amber-500 to-orange-500' }
  ];

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categoryId: 'password',
    date: todayDate
  });

  // Fetch Notes (Only if Vault unlocked & credentials ready)
  useEffect(() => {
    if (!user || !vaultCredentials) return;
    
    const { pin, uid } = vaultCredentials;
    const q = query(collection(db, "users", uid, "secureNotes"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedNotes = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const decryptedContent = await decryptDataV2(data.contentHash, pin, uid);
          return {
            id: doc.id,
            ...data,
            content: decryptedContent
          };
        })
      );
      setNotes(fetchedNotes);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, vaultCredentials]);

  // 🚀 MASTER VAULT UNLOCK with enhanced security
  const handleUnlockVault = async (e) => {
    e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) return setPinError("Please enter your PIN.");

    setIsVerifying(true);
    setPinError('');

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash;

      const result = await verifyPINEnhanced(pin, storedHash, user.uid);

      if (!result.valid) {
        setPinError(result.message || "Incorrect PIN. Vault remains locked.");
        setIsVerifying(false);
        return;
      }

      // Auto-upgrade old hash if needed
      if (result.upgraded && result.newHash) {
        await setDoc(doc(db, "users", user.uid), 
          { security: { pinHash: result.newHash } }, 
          { merge: true }
        );
      }

      // Store credentials, not the key
      setVaultCredentials({ pin, uid: user.uid });
      setIsVaultUnlocked(true);
    } catch (error) {
      setPinError("System error. Try again.");
    } finally {
      setIsVerifying(false);
      setPinInput('');
    }
  };

  // 🔒 Lock vault manually
  const handleLockVault = () => {
    setVaultCredentials(null);
    setIsVaultUnlocked(false);
    setNotes([]);
    setRevealedNotes({});
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!vaultCredentials) return;
    setIsSaving(true);

    const { pin, uid } = vaultCredentials;
    const timestamp = editingId ? notes.find(n => n.id === editingId)?.timestamp : new Date(formData.date).getTime();
    
    // ✅ Encrypt with per‑note random salt (v2)
    const secureHash = await encryptDataV2(formData.content, pin, uid);

    const noteRecord = {
      title: formData.title,
      categoryId: formData.categoryId,
      contentHash: secureHash,
      date: formData.date,
      timestamp
    };

    try {
      if (editingId) {
        await setDoc(doc(db, "users", uid, "secureNotes", editingId), noteRecord, { merge: true });
      } else {
        await addDoc(collection(db, "users", uid, "secureNotes"), noteRecord);
      }
      closeModal();
    } catch (error) {
      alert("Failed to save secure note.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if(window.confirm("Delete this secure note permanently?")) {
      try {
        await deleteDoc(doc(db, "users", vaultCredentials.uid, "secureNotes", id));
      } catch (error) {
        alert("Failed to delete.");
      }
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const toggleReveal = (id) => {
    setRevealedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openEditModal = (note) => {
    setFormData({
      title: note.title,
      content: note.content,
      categoryId: note.categoryId,
      date: note.date
    });
    setEditingId(note.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ title: '', content: '', categoryId: 'password', date: todayDate });
  };

  // Filter notes based on search and category
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || note.categoryId === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.id] = notes.filter(n => n.categoryId === cat.id).length;
    return acc;
  }, { all: notes.length });

  const getCategoryInfo = (categoryId) => categories.find(c => c.id === categoryId) || categories[3];

  // 🔒 VAULT LOCKED SCREEN
  if (!isVaultUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-full max-w-md">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          
          <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-slate-200/50 dark:border-slate-800/50 text-center animate-in zoom-in-95 duration-500">
            
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-lg opacity-30 animate-pulse"></div>
              <div className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-full flex items-center justify-center ring-4 ring-slate-200 dark:ring-slate-700 shadow-2xl">
                <FaShieldAlt className="text-4xl text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              Secure Vault
            </h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
              Your notes are encrypted. Enter your Master PIN to unlock the vault.
            </p>
            
            <form onSubmit={handleUnlockVault} className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <HiOutlineKey className="text-slate-400" size={20} />
                </div>
                <input 
                  type="password" 
                  maxLength={6}
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  className="w-full text-center tracking-[0.5em] text-2xl px-4 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-300"
                />
              </div>
              
              {pinError && (
                <div className="flex items-center justify-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl">
                  <span className="text-xs font-bold">{pinError}</span>
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isVerifying || !pinInput} 
                className="w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/20 disabled:opacity-70 flex justify-center items-center gap-2 group"
              >
                {isVerifying ? (
                  <HiOutlineRefresh className="animate-spin text-2xl" />
                ) : (
                  <>
                    <FaLock className="group-hover:scale-110 transition-transform" size={16} />
                    Unlock Vault
                  </>
                )}
              </button>
            </form>
            
            <p className="mt-6 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
              🔒 End-to-End Encrypted
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 🔓 VAULT DASHBOARD
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl blur-lg opacity-30"></div>
              <div className="relative p-2.5 sm:p-3.5 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl shadow-lg">
                <HiOutlineShieldCheck size={24} className="sm:w-7 sm:h-7 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Secure Notes
                <FaUnlockAlt className="text-emerald-500 text-base sm:text-lg" />
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl mt-1">
                {filteredNotes.length} encrypted {filteredNotes.length === 1 ? 'note' : 'notes'} stored securely
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleLockVault}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              title="Lock vault immediately"
            >
              <FaLock size={14} />
              Lock
            </button>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 whitespace-nowrap flex-1 sm:flex-initial"
            >
              <HiOutlinePlus size={20} /> Add Secure Note
            </button>
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search notes..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
            
            <div className="flex gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
                  activeFilter === 'all' 
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-lg' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All ({categoryCounts.all})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveFilter(cat.id)}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeFilter === cat.id 
                      ? `bg-gradient-to-r ${cat.badge} text-white shadow-lg` 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.name}</span>
                  <span>({categoryCounts[cat.id] || 0})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* NOTES CONTENT */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
              <HiOutlineRefresh className="animate-spin text-4xl text-emerald-500 relative" />
            </div>
            <p className="text-sm font-bold text-slate-400 animate-pulse">Decrypting vault...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-slate-300 dark:bg-slate-700 rounded-full blur-xl opacity-30"></div>
              <div className="relative w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center ring-4 ring-slate-100 dark:ring-slate-800 shadow-xl">
                <FaKey className="text-3xl sm:text-4xl text-slate-300 dark:text-slate-600" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-700 dark:text-white mb-2">
              {searchTerm || activeFilter !== 'all' ? 'No matching notes' : 'Vault is Empty'}
            </h3>
            <p className="text-sm font-semibold text-slate-500 max-w-md mx-auto">
              {searchTerm || activeFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Save your Seed Phrases, App Passwords, or ATM PINs safely here.'}
            </p>
            {(searchTerm || activeFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setActiveFilter('all'); }}
                className="mt-4 px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredNotes.map((note, index) => {
              const catInfo = getCategoryInfo(note.categoryId);
              const isRevealed = revealedNotes[note.id];

              return (
                <div 
                  key={note.id} 
                  className="group bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${catInfo.badge}`}></div>
                  
                  <div className="flex justify-between items-start mb-4 sm:mb-5 pt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${catInfo.bg} ${catInfo.color} ${catInfo.border}`}>
                      {catInfo.icon} {catInfo.name}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => openEditModal(note)} className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors" title="Edit note"><HiOutlinePencil size={15} /></button>
                      <button onClick={() => handleDelete(note.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Delete note"><HiOutlineTrash size={15} /></button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{note.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {formatGlobalDate ? formatGlobalDate(note.date, 'short') : note.date}
                      </p>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Encrypted</p>
                    </div>
                  </div>

                  <div className="mt-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 relative group/content">
                    <div className={`font-mono text-xs sm:text-sm break-all pr-10 transition-all duration-300 ${
                      isRevealed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 blur-[3px] sm:blur-[4px] select-none'
                    }`}>
                      {isRevealed ? note.content : '••••••••••••••••••••••••••••••••'}
                    </div>
                    <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); toggleReveal(note.id); }} className={`p-2 rounded-xl transition-all shadow-sm ${
                        isRevealed ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                      }`} title={isRevealed ? "Hide content" : "Reveal content"}>
                        {isRevealed ? <HiOutlineEyeOff size={15} /> : <HiOutlineEye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button onClick={() => copyToClipboard(note.content, note.id)} className="mt-3 w-full py-2.5 sm:py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all active:scale-95 flex justify-center items-center gap-2 group/copy">
                    {copySuccess === note.id ? (
                      <>
                        <HiOutlineShieldCheck className="text-emerald-500" size={16} />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <HiOutlineClipboardCopy size={15} className="group-hover/copy:text-blue-500 transition-colors" />
                        <span>Copy to Clipboard</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats Bar */}
        {!isLoading && notes.length > 0 && (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total: {notes.length} notes</span>
                <span className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1"><FaLock size={10} /> Encrypted</span>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">Showing {filteredNotes.length} of {notes.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* 🚀 ADD/EDIT NOTE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal}></div>
          
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 max-h-[90vh]">
            
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black flex items-center gap-2">
                <HiOutlineLockClosed size={22} />
                {editingId ? 'Edit Secure Note' : 'New Secure Note'}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveNote} className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
              
              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Information Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setFormData({...formData, categoryId: cat.id})} className={`p-3 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all border-2 ${
                      formData.categoryId === cat.id ? `${cat.bg} ${cat.color} ${cat.border} shadow-md scale-[1.02]` : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}><span className="text-base">{cat.icon}</span> {cat.name}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Title / Identifier</label>
                <input type="text" required autoFocus value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Trust Wallet Seed, Netflix Pass" className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-rose-500 uppercase tracking-widest ml-1 flex justify-between items-center">
                  <span>Secret Content</span>
                  <span className="text-slate-400 text-[8px]">Encrypted at rest</span>
                </label>
                <textarea required value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} placeholder="Enter seed phrase, keys, or passwords here..." rows="4" className="w-full p-3.5 sm:p-4 bg-rose-50/50 dark:bg-rose-500/5 border-2 border-rose-200 dark:border-rose-900/30 rounded-2xl font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 transition-all custom-scrollbar resize-none" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date Created</span>
                  <span className="text-emerald-500 font-bold">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : formData.date}</span>
                </label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all" />
              </div>

              <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-sm transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl shadow-emerald-500/20 disabled:opacity-70 flex justify-center items-center gap-2 mt-2">
                {isSaving ? (
                  <>
                    <HiOutlineRefresh className="animate-spin" size={20} />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <FaShieldAlt size={16} />
                    Encrypt & Save Securely
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureNotes;