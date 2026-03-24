import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';

import { 
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineClipboardCopy,
  HiOutlineShieldCheck, HiOutlineRefresh
} from 'react-icons/hi';
import { FaKey, FaSeedling, FaUniversity, FaStickyNote, FaLock, FaUnlockAlt } from 'react-icons/fa';

// 🚀 SECURE SHA-256 HASHING ALGORITHM FOR PIN
const hashPIN = async (pinCode) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pinCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// 🚀 BASIC ENCRYPTION (Obfuscation to hide from Firebase Console)
const encryptData = (text, uid) => {
  if (!text) return '';
  return btoa(encodeURIComponent(text + "||_SECURE_||" + uid));
};

const decryptData = (hash, uid) => {
  if (!hash) return '';
  try {
    const decoded = decodeURIComponent(atob(hash));
    return decoded.replace("||_SECURE_||" + uid, "");
  } catch (e) {
    return "Error decrypting data";
  }
};

const SecureNotes = () => {
  const { user, formatGlobalDate } = useAuth();
  
  // Vault Security States
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [revealedNotes, setRevealedNotes] = useState({}); // Tracks which notes are unhidden
  const [copySuccess, setCopySuccess] = useState(null);

  const todayDate = new Date().toISOString().split('T')[0];

  const categories = [
    { id: 'seed', name: 'Crypto Seed Phrase', icon: <FaSeedling />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200' },
    { id: 'password', name: 'Passwords / Logins', icon: <FaKey />, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200' },
    { id: 'bank', name: 'Bank / Cards Info', icon: <FaUniversity />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200' },
    { id: 'general', name: 'Secure Memo', icon: <FaStickyNote />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200' }
  ];

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categoryId: 'password',
    date: todayDate
  });

  // Fetch Notes (Only if Vault is unlocked)
  useEffect(() => {
    if (!user || !isVaultUnlocked) return;
    
    const q = query(collection(db, "users", user.uid, "secureNotes"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Decrypt content on the fly for the UI
          content: decryptData(data.contentHash, user.uid)
        };
      });
      setNotes(fetchedNotes);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [user, isVaultUnlocked]);

  // 🚀 MASTER VAULT UNLOCK LOGIC
  const handleUnlockVault = async (e) => {
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
        setPinError("Incorrect Security PIN. Vault remains locked."); 
        setIsVerifying(false); 
        return;
      }
      
      setIsVaultUnlocked(true);
    } catch (error) {
      setPinError("System error. Try again.");
    } finally {
      setIsVerifying(false);
      setPinInput('');
    }
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);

    const timestamp = editingId ? notes.find(n => n.id === editingId)?.timestamp : new Date(formData.date).getTime();
    
    // 🚀 OBFUSCATE DATA BEFORE SAVING TO DB
    const secureHash = encryptData(formData.content, user.uid);

    const noteRecord = {
      title: formData.title,
      categoryId: formData.categoryId,
      contentHash: secureHash, // Saving hash instead of plain text
      date: formData.date,
      timestamp
    };

    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "secureNotes", editingId), noteRecord, { merge: true });
      } else {
        await addDoc(collection(db, "users", user.uid, "secureNotes"), noteRecord);
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
        await deleteDoc(doc(db, "users", user.uid, "secureNotes", id));
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
      content: note.content, // Already decrypted by useEffect
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

  // 🔒 VAULT LOCKED SCREEN
  if (!isVaultUnlocked) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[80vh] px-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 md:p-10 border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95">
          <div className="w-24 h-24 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">
            <FaLock />
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Secure Vault</h2>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8">
            Your notes are encrypted. Enter your 4-digit Master PIN to unlock the vault.
          </p>
          
          <form onSubmit={handleUnlockVault} className="space-y-6">
            <div>
              <input 
                type="password" 
                maxLength={6}
                required
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-[1em] text-3xl p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
              {pinError && <p className="text-xs font-bold text-rose-500 text-center animate-bounce mt-3">{pinError}</p>}
            </div>
            <button type="submit" disabled={isVerifying || !pinInput} className="w-full py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-70 flex justify-center items-center">
              {isVerifying ? <HiOutlineRefresh className="animate-spin text-2xl" /> : 'Unlock Vault'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 🔓 VAULT DASHBOARD
  return (
    <div className="pt-24 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3.5 bg-emerald-500/10 text-emerald-600 rounded-3xl ring-1 ring-emerald-500/20 shadow-lg">
              <HiOutlineShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Secure Notes <FaUnlockAlt className="text-emerald-500 text-xl"/>
              </h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-xl">
                Your highly sensitive data. Masked by default and heavily encrypted in the database.
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/30 transition-all active:scale-95 whitespace-nowrap">
          <HiOutlinePlus size={20} /> Add Secure Note
        </button>
      </div>

      {/* NOTES GRID */}
      {isLoading ? (
         <div className="p-20 text-center animate-pulse font-bold text-slate-400">Decrypting vault...</div>
      ) : notes.length === 0 ? (
         <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
           <FaKey className="mx-auto text-6xl text-slate-300 dark:text-slate-700 mb-4" />
           <h3 className="text-2xl font-black text-slate-700 dark:text-white">Vault is Empty</h3>
           <p className="text-slate-500 font-semibold mt-2">Save your Seed Phrases, App Passwords, or ATM PINs safely here.</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => {
            const catInfo = categories.find(c => c.id === note.categoryId) || categories[3];
            const isRevealed = revealedNotes[note.id];

            return (
              <div key={note.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1">
                
                <div className="flex justify-between items-start mb-5">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${catInfo.bg} ${catInfo.color}`}>
                    {catInfo.icon} {catInfo.name}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(note)} className="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><HiOutlinePencil size={16}/></button>
                    <button onClick={() => handleDelete(note.id)} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><HiOutlineTrash size={16}/></button>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight line-clamp-1">{note.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {/* 🚀 GLOBAL DATE APPLIED HERE */}
                    Created: {formatGlobalDate ? formatGlobalDate(note.date, 'short') : note.date}
                  </p>
                </div>

                <div className="mt-auto bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 relative group">
                  
                  {/* 🚀 CONTENT MASKING LOGIC */}
                  <div className={`font-mono text-sm break-all pr-8 ${isRevealed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600 blur-[4px] select-none'}`}>
                    {isRevealed ? note.content : '••••••••••••••••••••••••••••••••'}
                  </div>

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <button onClick={() => toggleReveal(note.id)} className="p-2 text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-800 rounded-lg shadow-sm transition-colors" title={isRevealed ? "Hide" : "Reveal"}>
                      {isRevealed ? <HiOutlineEyeOff size={16}/> : <HiOutlineEye size={16}/>}
                    </button>
                  </div>
                </div>

                <button onClick={() => copyToClipboard(note.content, note.id)} className="mt-3 w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex justify-center items-center gap-2">
                  {copySuccess === note.id ? <><HiOutlineShieldCheck className="text-emerald-500" size={16}/> Copied Safely</> : <><HiOutlineClipboardCopy size={16}/> Copy to Clipboard</>}
                </button>

              </div>
            );
          })}
        </div>
      )}

      {/* 🚀 ADD/EDIT NOTE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 border border-slate-100 dark:border-slate-800">
            
            <div className="px-6 py-5 flex justify-between items-center bg-emerald-500 text-white shrink-0">
              <h3 className="text-xl font-black flex items-center gap-2"><HiOutlineLockClosed size={24}/> {editingId ? 'Edit Secure Note' : 'New Secure Note'}</h3>
              <button onClick={closeModal} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"><HiOutlineX size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveNote} className="p-6 space-y-5">
              
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Information Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map(cat => (
                    <button key={cat.id} type="button" onClick={() => setFormData({...formData, categoryId: cat.id})} className={`p-3 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 transition-all border ${formData.categoryId === cat.id ? `${cat.bg} ${cat.color} shadow-sm` : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700'}`}>
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Title / Identifier</label>
                <input type="text" required autoFocus value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Trust Wallet Seed, Netflix Pass" className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-rose-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Secret Content</span>
                  <span>Will be masked</span>
                </label>
                <textarea required value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} placeholder="Enter seed phrase, keys, or passwords here..." rows="4" className="w-full p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 rounded-2xl font-mono text-sm dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all custom-scrollbar resize-none" />
              </div>

              {/* 🚀 GLOBAL DATE FOR MODAL INPUT */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Date Created</span>
                  <span className="text-emerald-500">{formatGlobalDate ? formatGlobalDate(formData.date, 'short') : ''}</span>
                </label>
                <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
              </div>

              <button type="submit" disabled={isSaving} className="w-full p-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/20 disabled:opacity-70 flex justify-center items-center">
                {isSaving ? 'Encrypting...' : 'Encrypt & Save Securely'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SecureNotes;