import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAIVoice } from '../../hooks/useAIVoice';
import { collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { verifyPIN } from '../../utils/cryptoUtils';
import {
  HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePencil,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlineTrendingUp,
  HiOutlineShieldCheck, HiOutlineSparkles, HiOutlineLockClosed,
  HiOutlineExclamationCircle, HiOutlineLightningBolt, HiOutlineCalendar,
  HiOutlineArrowRight, HiOutlineArrowUp, HiOutlineRefresh,
  HiOutlineInformationCircle
} from 'react-icons/hi';
import {
  FaTrophy, FaPiggyBank, FaStar, FaUniversity, FaMoneyBillWave,
  FaLock, FaUnlockAlt, FaWallet, FaFlag, FaBullseye, FaRocket
} from 'react-icons/fa';

// ============================================
// 🚀 MINI TOAST SYSTEM (identical to other modules)
// ============================================
const ToastContext = React.createContext(null);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  };
  const removeToast = id => setToasts(prev => prev.filter(t => t.id !== id));
  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-24 right-4 z-[10000] space-y-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map(toast => (
          <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl backdrop-blur-xl border animate-in slide-in-from-right-4 fade-in duration-300 ${
            toast.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/90 border-green-200 dark:border-green-700' :
            toast.type === 'error' ? 'bg-red-50/95 dark:bg-red-900/90 border-red-200 dark:border-red-700' :
            toast.type === 'warning' ? 'bg-amber-50/95 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700' :
            'bg-blue-50/95 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700'
          }`}>
            {toast.type === 'success' && <HiOutlineCheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <HiOutlineExclamationCircle className="text-red-600 dark:text-red-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'warning' && <HiOutlineExclamationCircle className="text-amber-600 dark:text-amber-400 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <HiOutlineInformationCircle className="text-blue-600 dark:text-blue-400 w-5 h-5 flex-shrink-0" />}
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><HiOutlineX size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
const useToast = () => React.useContext(ToastContext);

// Helpers (unchanged)
const getLocalISOString = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16);
};

// ============================================
// 🧩 EXISTING SUB‑COMPONENTS (completely unchanged)
// ============================================
const MasterProgressCard = ({ totalSaved, totalTarget, overallProgress, currencySymbol, goalsCount }) => (
  // ... (keep exactly as before) ...
  <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-slate-700/50">
    {/* Background decorations */}
    <div className="absolute -right-8 -top-8 opacity-[0.02] dark:opacity-5 pointer-events-none">
      <FaPiggyBank size={300} className="text-white" />
    </div>
    <div className="absolute left-0 bottom-0 opacity-[0.03] dark:opacity-5 pointer-events-none">
      <FaRocket size={200} className="text-white" />
    </div>
    {/* Glow effects */}
    <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
      <div className="flex-1 text-center lg:text-left min-w-0 w-full">
        <div className="flex items-center justify-center lg:justify-start gap-2 mb-3">
          <div className="p-2 bg-yellow-500/20 rounded-xl ring-1 ring-yellow-500/30 shadow-sm shrink-0">
            <FaLock className="text-yellow-400" size={16} />
          </div>
          <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] truncate">Total Locked Savings</p>
        </div>
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter mb-4 truncate break-all" title={`${currencySymbol}${totalSaved.toLocaleString()}`}>
          <span className="text-yellow-400">{currencySymbol}</span>{totalSaved.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}
        </h2>
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
            <FaBullseye className="text-yellow-500 shrink-0" size={12} />
            <span className="truncate max-w-[120px] sm:max-w-none">Target: {currencySymbol}{totalTarget.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
          </span>
          <span className="px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center gap-1.5">
            <HiOutlineLightningBolt className="text-blue-400 shrink-0" size={12}/>{goalsCount} Active Goal{goalsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className="w-full lg:w-80 space-y-3 lg:shrink-0 bg-white/5 backdrop-blur-sm p-5 rounded-[2rem] border border-white/10">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Progress</span>
          <span className="text-sm font-black text-yellow-400">{overallProgress.toFixed(1)}%</span>
        </div>
        <div className="relative">
          <div className="w-full h-3 sm:h-4 bg-slate-900 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
            <div className="h-full bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-1500 ease-out relative overflow-hidden" style={{ width: `${Math.min(overallProgress, 100)}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          {[25, 50, 75, 100].map(milestone => (
            <div key={milestone} className="absolute top-0 bottom-0 w-0.5 bg-white/20" style={{ left: `${milestone}%` }}>
              {overallProgress >= milestone && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.8)]" />}
            </div>
          ))}
        </div>
        <p className="text-[10px] font-bold text-slate-400 text-center lg:text-left pt-2">
          {overallProgress >= 100 ? '🎉 All goals achieved! Amazing work!' : overallProgress >= 75 ? '🚀 Almost there! Keep pushing forward.' : overallProgress >= 50 ? '💪 Halfway to financial freedom!' : overallProgress >= 25 ? '🌱 Great progress! Stay consistent.' : '🎯 Start locking funds to see progress.'}
        </p>
      </div>
    </div>
  </div>
);

const GoalCard = ({ goal, currencySymbol, onEdit, onDelete, onFund, onRelease, formatGlobalDate }) => {
  // ... (exactly as before) ...
  const progress = (goal.currentSaved / goal.targetAmount) * 100;
  const remaining = Math.max(0, goal.targetAmount - (goal.currentSaved || 0));
  const isDone = goal.status === 'achieved' || progress >= 100;

  const aiMessages = {
    complete: { text: "🎉 Goal Achieved! You did it!", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30" },
    nearComplete: { text: `Almost there! ${currencySymbol}${remaining.toLocaleString()} to go. 🚀`, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-200 dark:border-blue-500/30" },
    halfway: { text: "🔥 Halfway there! Keep the momentum.", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/30" },
    started: { text: "📈 Great start! Consistency is key.", color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-500/10", border: "border-purple-200 dark:border-purple-500/30" },
    empty: { text: "🎯 Ready to start saving!", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700" }
  };
  const aiMsg = isDone ? aiMessages.complete : progress >= 80 ? aiMessages.nearComplete : progress >= 50 ? aiMessages.halfway : progress > 0 ? aiMessages.started : aiMessages.empty;

  return (
    <div className={`group relative p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border transition-all duration-500 hover:-translate-y-2 hover:shadow-xl overflow-hidden flex flex-col h-full
      ${isDone ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 border-emerald-300 dark:border-emerald-500/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 shadow-sm'}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDone ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : progress > 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
      <div className={`absolute -bottom-8 -right-8 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isDone ? 'bg-emerald-500' : progress > 50 ? 'bg-yellow-500' : 'bg-blue-500'}`} />
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3.5 rounded-2xl ring-1 transition-transform group-hover:scale-110 duration-300 shrink-0
            ${isDone ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-500/30' : 'bg-amber-50 dark:bg-amber-500/10 text-yellow-500 ring-amber-200 dark:ring-amber-500/30'}`}>
            {isDone ? <HiOutlineCheckCircle size={24} /> : <FaTrophy size={20} />}
          </div>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 shadow-sm">
            <button onClick={(e) => { e.stopPropagation(); onEdit(goal); }} className="p-2.5 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-700 transition-colors active:scale-90"><HiOutlinePencil size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(goal); }} className="p-2.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 transition-colors active:scale-90"><HiOutlineTrash size={15} /></button>
          </div>
        </div>
        <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white leading-tight mb-2 line-clamp-2 break-words">{goal.title}</h3>
        {goal.deadline && (
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-4">
            <HiOutlineCalendar size={14} className="shrink-0" /> Target: {formatGlobalDate ? formatGlobalDate(goal.deadline.split('T')[0], 'short') : goal.deadline.split('T')[0]}
          </p>
        )}
        <div className="mt-auto space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Saved</p>
              <span className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900 dark:text-white truncate block" title={`${currencySymbol}${(goal.currentSaved || 0).toLocaleString()}`}>
                {currencySymbol}{(goal.currentSaved || 0).toLocaleString(undefined, {maximumFractionDigits:0})}
              </span>
            </div>
            <div className="sm:text-right shrink-0">
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Target</p>
              <span className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400">
                {currencySymbol}{goal.targetAmount.toLocaleString(undefined, {maximumFractionDigits:0})}
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 sm:h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner relative">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${isDone ? 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gradient-to-r from-yellow-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`} style={{ width: `${Math.min(progress, 100)}%` }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          <div className={`p-3 rounded-xl text-[10px] font-bold border ${aiMsg.bg} ${aiMsg.color} ${aiMsg.border}`}>
            <div className="flex items-start gap-1.5">
              <HiOutlineSparkles size={14} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{aiMsg.text}</span>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 pt-2">
            <button onClick={(e) => { e.stopPropagation(); onFund(goal); }} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm">
              <FaLock size={12} /> Lock
            </button>
            {goal.currentSaved > 0 && (
              <button onClick={(e) => { e.stopPropagation(); onRelease(goal); }} className="flex-1 py-3.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-500/30 shadow-sm">
                <FaUnlockAlt size={12} /> Release
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const VaultSelector = ({ selected, onChange, exclude = [] }) => {
  // ... (unchanged)
  const vaults = [
    { id: 'bank', icon: FaUniversity, label: 'Bank', color: 'blue' },
    { id: 'online', icon: FaWallet, label: 'Online', color: 'purple' },
    { id: 'cash', icon: FaMoneyBillWave, label: 'Cash', color: 'emerald' },
  ].filter(v => !exclude.includes(v.id));

  return (
    <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {vaults.map(v => (
        <button key={v.id} type="button" onClick={() => onChange(v.id)} className={`py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-xl transition-all flex flex-col items-center gap-1.5 ${selected === v.id ? `bg-white dark:bg-slate-700 shadow-sm text-${v.color}-600 dark:text-${v.color}-400 scale-105 border border-slate-200 dark:border-slate-600` : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'}`}>
          <v.icon size={18} /> {v.label}
        </button>
      ))}
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, icon: Icon, color, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[60px] md:pt-[120px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[calc(100dvh-4rem)] sm:max-h-[85vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
        <div className={`px-6 sm:px-8 py-5 flex justify-between items-center shrink-0 bg-gradient-to-r ${color}`}>
          <h3 className="text-lg sm:text-xl font-black flex items-center gap-2 text-white"><Icon size={20} /> {title}</h3>
          <button type="button" onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors text-white"><HiOutlineX size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const DeleteModal = ({ context, onClose, onSubmit, pinInput, setPinInput, pinError, isVerifying, currencySymbol }) => {
  if (!context) return null;
  return (
    <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 pt-[100px] md:pt-[120px] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 border border-rose-200 dark:border-rose-800 relative overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:zoom-in-95">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-pink-500" />
        <div className="flex flex-col items-center text-center mb-6 shrink-0">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4 ring-1 ring-rose-200 dark:ring-rose-500/30"><HiOutlineLockClosed size={28} /></div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Security Verification</h3>
          <div className="mt-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl text-left w-full shadow-sm">
            <p className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-400 flex items-start gap-1.5">
              <HiOutlineExclamationCircle size={16} className="shrink-0 mt-0.5" />
              <span>This will permanently delete this goal. {context.currentSaved > 0 && <span className="font-black"> {currencySymbol}{context.currentSaved.toLocaleString()} will be auto-refunded to your Bank Vault.</span>}</span>
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pb-2">
          <div>
            <label className="text-[10px] sm:text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center block mb-2">Enter Security PIN</label>
            <input type="password" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value)} className="w-full text-center tracking-[0.5em] text-xl sm:text-2xl p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-all shadow-sm" placeholder="••••" />
            {pinError && <p className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 text-center mt-2 animate-bounce">{pinError}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 rounded-xl font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-xs sm:text-sm shadow-sm active:scale-95">Cancel</button>
            <button type="submit" disabled={isVerifying || !pinInput} className="flex-1 py-3.5 rounded-xl font-black text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 transition-colors disabled:opacity-50 shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2 text-xs sm:text-sm active:scale-95">
              {isVerifying ? <HiOutlineRefresh className="animate-spin" size={18} /> : <HiOutlineTrash size={18} />} {isVerifying ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// 🚀 MAIN CONTENT COMPONENT
// ============================================
const GoalsContent = () => {
  const { user, baseCurrency = 'INR', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';
  const { speak } = useAIVoice();
  const { addToast } = useToast();

  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);

  const [deleteContext, setDeleteContext] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const localTimeStr = getLocalISOString();

  const [formData, setFormData] = useState({ title: '', targetAmount: '', deadline: localTimeStr });
  const [fundData, setFundData] = useState({ amount: '', sourceVault: 'bank', subWallet: '', date: localTimeStr });
  const [existingVaultNames, setExistingVaultNames] = useState([]);

  useEffect(() => {
    if (!user) return;
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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "savingsGoals"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (err) => {
      addToast('Failed to load goals.', 'error');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, addToast]);

  const totalTarget = useMemo(() => goals.reduce((acc, g) => acc + Number(g.targetAmount), 0), [goals]);
  const totalSaved = useMemo(() => goals.reduce((acc, g) => acc + Number(g.currentSaved || 0), 0), [goals]);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const activeGoalsCount = goals.filter(g => g.status !== 'achieved').length;

  const handleSaveGoal = async (e) => {
    e.preventDefault(); if (!user) return; setIsProcessing(true);
    const goalRecord = {
      title: formData.title.trim(), targetAmount: parseFloat(formData.targetAmount),
      deadline: formData.deadline || null, timestamp: editingId ? goals.find(g => g.id === editingId)?.timestamp : new Date(formData.deadline || new Date()).getTime(),
      currentSaved: editingId ? goals.find(g => g.id === editingId)?.currentSaved : 0, status: 'active'
    };
    try {
      if (editingId) {
        await setDoc(doc(db, "users", user.uid, "savingsGoals", editingId), goalRecord, { merge: true });
        addToast('Goal updated!', 'success');
      } else {
        await addDoc(collection(db, "users", user.uid, "savingsGoals"), goalRecord);
        addToast('New goal created!', 'success');
      }
      setIsModalOpen(false);
    } catch (error) {
      addToast("Failed to save goal.", "error");
    } finally { setIsProcessing(false); }
  };

  const handleAddFunds = async (e) => {
    e.preventDefault(); if (!user || !activeGoal) return;
    const addAmount = parseFloat(fundData.amount);
    if (addAmount <= 0) { addToast("Amount must be greater than zero.", "warning"); return; }
    if ((fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && !fundData.subWallet.trim()) {
      addToast("Please specify the exact Vault Name.", "warning");
      return;
    }

    setIsProcessing(true);
    const oldSavedAmount = activeGoal.currentSaved || 0;
    const newSavedAmount = oldSavedAmount + addAmount;
    const target = activeGoal.targetAmount;
    const oldProgress = (oldSavedAmount / target) * 100;
    const newProgress = (newSavedAmount / target) * 100;
    const isCompleted = newSavedAmount >= target;
    const timestamp = new Date(fundData.date).getTime();
    const lockId = `LOCK_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      await setDoc(doc(db, "users", user.uid, "savingsGoals", activeGoal.id), { currentSaved: newSavedAmount, status: isCompleted ? 'achieved' : 'active' }, { merge: true });
      const vaultCollection = fundData.sourceVault === 'bank' ? 'bankWallet' : fundData.sourceVault === 'online' ? 'onlineWallet' : 'cashWallet';
      const formattedDate = fundData.date.split('T')[0];

      const vaultRecord = {
        title: `Locked for Goal: ${activeGoal.title}`, type: 'out', date: formattedDate, timestamp, currency: baseCurrency, foreignAmount: addAmount, exchangeRate: 1, finalBaseAmount: addAmount, fee: 0, isGoalLock: true, linkedExpenseId: lockId, walletName: fundData.subWallet.trim() || 'Savings Lock', bankName: fundData.subWallet.trim() || 'Savings Lock', transferType: 'Investment/Savings', goalId: activeGoal.id
      };
      await addDoc(collection(db, "users", user.uid, vaultCollection), vaultRecord);

      await addDoc(collection(db, "users", user.uid, "expenseLogs"), {
        title: `Goal Contribution: ${activeGoal.title}`, category: "Investments & Interest", vault: fundData.sourceVault, subWallet: (fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') ? fundData.subWallet.trim() : '', asset: baseCurrency, amount: addAmount, exchangeRate: 1, finalBaseAmount: addAmount, date: formattedDate, timestamp, linkedExpenseId: lockId, goalId: activeGoal.id, isSplit: false
      });

      let milestoneMsg = "";
      if (oldProgress < 100 && newProgress >= 100) milestoneMsg = `Congratulations! You achieved: ${activeGoal.title}!`;
      else if (oldProgress < 75 && newProgress >= 75) milestoneMsg = `75% of ${activeGoal.title} complete!`;
      else if (oldProgress < 50 && newProgress >= 50) milestoneMsg = `Halfway: ${activeGoal.title}!`;
      else if (oldProgress < 25 && newProgress >= 25) milestoneMsg = `25% milestone: ${activeGoal.title}!`;

      if (milestoneMsg) {
        if (speak) speak(milestoneMsg);
        await addDoc(collection(db, "users", user.uid, "notifications"), { title: "Goal Milestone!", message: milestoneMsg, type: "goal_milestone", isRead: false, timestamp: new Date().getTime(), link: "/dashboard/goals" });
        addToast(milestoneMsg, 'success');
      } else {
        addToast(`Locked ${currencySymbol}${addAmount.toLocaleString()} for "${activeGoal.title}"`, 'success');
      }

      setIsFundModalOpen(false); setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: getLocalISOString() });
    } catch (error) {
      addToast("Failed to lock funds.", "error");
    } finally { setIsProcessing(false); }
  };

  const handleReleaseFunds = async (e) => {
    e.preventDefault(); if (!user || !activeGoal) return;
    const releaseAmount = parseFloat(fundData.amount);
    if (releaseAmount <= 0) { addToast("Amount must be greater than zero.", "warning"); return; }
    if (releaseAmount > (activeGoal.currentSaved || 0)) {
      addToast(`Insufficient balance. Available: ${currencySymbol}${activeGoal.currentSaved.toLocaleString()}`, "error");
      return;
    }
    if ((fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && !fundData.subWallet.trim()) {
      addToast("Please specify the receiving Vault Name.", "warning");
      return;
    }

    setIsProcessing(true);
    const newSavedAmount = (activeGoal.currentSaved || 0) - releaseAmount;
    const isCompleted = newSavedAmount >= activeGoal.targetAmount;
    const timestamp = new Date(fundData.date).getTime();
    const formattedDate = fundData.date.split('T')[0];
    const releaseId = `RELEASE_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    try {
      await setDoc(doc(db, "users", user.uid, "savingsGoals", activeGoal.id), { currentSaved: newSavedAmount, status: isCompleted ? 'achieved' : 'active' }, { merge: true });
      const vaultCollection = fundData.sourceVault === 'bank' ? 'bankWallet' : fundData.sourceVault === 'online' ? 'onlineWallet' : 'cashWallet';

      await addDoc(collection(db, "users", user.uid, vaultCollection), {
        title: `Released from Goal: ${activeGoal.title}`, type: 'in', date: formattedDate, timestamp, currency: baseCurrency, foreignAmount: releaseAmount, exchangeRate: 1, finalBaseAmount: releaseAmount, fee: 0, isGoalLock: true, linkedIncomeId: releaseId, walletName: fundData.subWallet.trim() || 'Savings Unlock', bankName: fundData.subWallet.trim() || 'Savings Unlock', transferType: 'Refund/Reversal', goalId: activeGoal.id
      });

      await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
        title: `Goal Funds Released: ${activeGoal.title}`, category: "Other Income", vault: fundData.sourceVault, subWallet: (fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') ? fundData.subWallet.trim() : '', asset: baseCurrency, amount: releaseAmount, exchangeRate: 1, finalBaseAmount: releaseAmount, date: formattedDate, timestamp, linkedIncomeId: releaseId, goalId: activeGoal.id
      });

      addToast(`Released ${currencySymbol}${releaseAmount.toLocaleString()} from "${activeGoal.title}"`, 'success');
      setIsReleaseModalOpen(false); setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: getLocalISOString() });
    } catch (error) {
      addToast("Failed to release funds.", "error");
    } finally { setIsProcessing(false); }
  };

  const initiateSecureDelete = (goal) => { setDeleteContext(goal); setPinInput(''); setPinError(''); };

  const executeSecureDelete = async (e) => {
    e.preventDefault();
    if (!pinInput.trim()) return setPinError("PIN required.");
    setIsVerifying(true);
    setPinError('');
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const storedHash = userDoc.data()?.security?.pinHash || userDoc.data()?.securityPin || userDoc.data()?.pin;
      const { valid, newHash } = await verifyPIN(pinInput.trim(), storedHash, user.uid);

      if (!valid) {
        setPinError("Incorrect PIN!");
        setIsVerifying(false);
        return;
      }

      if (newHash) {
        await setDoc(doc(db, "users", user.uid), { security: { pinHash: newHash } }, { merge: true });
      }

      const currentSavedAmount = deleteContext.currentSaved || 0;
      await deleteDoc(doc(db, "users", user.uid, "savingsGoals", deleteContext.id));

      if (currentSavedAmount > 0) {
        const timestamp = new Date().getTime();
        const refundId = `REFUND_CANCEL_${timestamp}`;
        const formattedDate = new Date().toISOString().split('T')[0];

        await addDoc(collection(db, "users", user.uid, "bankWallet"), {
          title: `Goal Refund: ${deleteContext.title}`, type: 'in', date: formattedDate, timestamp, currency: baseCurrency, foreignAmount: currentSavedAmount, exchangeRate: 1, finalBaseAmount: currentSavedAmount, fee: 0, isGoalLock: true, linkedIncomeId: refundId, walletName: 'Auto Refund', transferType: 'Refund/Reversal'
        });

        await addDoc(collection(db, "users", user.uid, "incomeLogs"), {
          title: `Goal Refund: ${deleteContext.title}`, category: "Other Income", vault: "bank", asset: baseCurrency, amount: currentSavedAmount, exchangeRate: 1, finalBaseAmount: currentSavedAmount, date: formattedDate, timestamp, linkedIncomeId: refundId,
        });
      }

      for (let q of [{ col: "expenseLogs", field: "goalId" }, { col: "incomeLogs", field: "goalId" }, { col: "bankWallet", field: "goalId" }, { col: "cashWallet", field: "goalId" }, { col: "onlineWallet", field: "goalId" }]) {
        const snaps = await getDocs(query(collection(db, "users", user.uid, q.col), where(q.field, "==", deleteContext.id)));
        snaps.forEach(async (d) => await deleteDoc(doc(db, "users", user.uid, q.col, d.id)));
      }

      addToast(`Goal "${deleteContext.title}" deleted and funds refunded.`, 'info');
      setDeleteContext(null);
    } catch (error) {
      setPinError("System error during deletion.");
    } finally {
      setIsVerifying(false);
    }
  };

  const openEditModal = (goal) => {
    let editDateStr = goal.deadline || getLocalISOString();
    if(editDateStr.length === 10) editDateStr += 'T12:00';
    setFormData({ title: goal.title, targetAmount: goal.targetAmount, deadline: editDateStr });
    setEditingId(goal.id); setIsModalOpen(true);
  };

  const openFundModal = (goal) => { setActiveGoal(goal); setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: getLocalISOString() }); setIsFundModalOpen(true); };
  const openReleaseModal = (goal) => { setActiveGoal(goal); setFundData({ amount: '', sourceVault: 'bank', subWallet: existingVaultNames[0] || '', date: getLocalISOString() }); setIsReleaseModalOpen(true); };

  return (
    <div className="pt-20 sm:pt-24 space-y-6 sm:space-y-8 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(234,179,8,0.15),transparent_70%)]" />
        <div className="absolute right-[-5%] top-[-10%] opacity-[0.03] text-white blur-[2px] pointer-events-none"><FaTrophy size={200}/></div>
        <div className="flex items-center gap-4 sm:gap-5 relative z-10">
          <div className="p-3.5 sm:p-4 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-2xl sm:rounded-[1.5rem] shadow-xl shadow-yellow-500/30 ring-1 ring-white/20 shrink-0">
            <FaTrophy size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Savings Goals</h1>
            <p className="text-[11px] sm:text-sm font-semibold text-slate-400 mt-1 max-w-lg">Set targets, lock funds securely, and watch your wealth grow</p>
          </div>
        </div>
        <button onClick={() => { setEditingId(null); setFormData({title:'', targetAmount:'', deadline: getLocalISOString()}); setIsModalOpen(true); }} className="w-full lg:w-auto relative z-10 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-yellow-500/30 transition-all active:scale-95 whitespace-nowrap mt-2 lg:mt-0">
          <HiOutlinePlus size={20} className="shrink-0"/> Create Goal
        </button>
      </div>

      {/* Master Progress Card */}
      <MasterProgressCard totalSaved={totalSaved} totalTarget={totalTarget} overallProgress={overallProgress} currencySymbol={currencySymbol} goalsCount={activeGoalsCount} />

      {/* Goals Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {[1,2,3].map(i => <div key={i} className="h-96 bg-slate-200 dark:bg-slate-800 rounded-[2.5rem] animate-pulse shadow-sm" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16 sm:py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm px-4">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-yellow-100 dark:border-yellow-800/50">
            <FaBullseye className="w-12 h-12 sm:w-14 sm:h-14 text-yellow-500" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">No Goals Yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold max-w-md mx-auto mb-8 leading-relaxed">
            Create your first savings target — Emergency Fund, Dream Vacation, New Gadget... Start securing your future today.
          </p>
          <button onClick={() => { setEditingId(null); setFormData({title:'', targetAmount:'', deadline: getLocalISOString()}); setIsModalOpen(true); }} className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-yellow-500/30 hover:shadow-yellow-500/40 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto">
            <HiOutlinePlus size={20} /> Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {goals.map(goal => (
            <GoalCard key={goal.id} goal={goal} currencySymbol={currencySymbol} onEdit={openEditModal} onDelete={initiateSecureDelete} onFund={openFundModal} onRelease={openReleaseModal} formatGlobalDate={formatGlobalDate} />
          ))}
        </div>
      )}

      {/* Modals – all unchanged except alerts replaced and toasts added */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Goal' : 'New Savings Goal'} icon={editingId ? HiOutlinePencil : FaBullseye} color="from-yellow-500 to-amber-600">
        <form onSubmit={handleSaveGoal} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Goal Name</label>
            <input type="text" required autoFocus value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g. Dream Vacation..." className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors placeholder:text-slate-400 shadow-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Target Amount ({currencySymbol})</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">{currencySymbol}</span>
              <input type="number" step="any" required value={formData.targetAmount} onChange={(e) => setFormData({...formData, targetAmount: e.target.value})} placeholder="0" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors shadow-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
              <span>Target Date</span>
              {formData.deadline && <span className="text-yellow-600 dark:text-yellow-500">{formatGlobalDate ? formatGlobalDate(formData.deadline.split('T')[0], 'short') : ''}</span>}
            </label>
            <input type="datetime-local" required value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500/50 transition-colors cursor-pointer shadow-sm" />
          </div>
          <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
            <button type="submit" disabled={isProcessing} className="w-full py-4 sm:py-5 rounded-2xl font-black text-white text-lg sm:text-xl transition-all active:scale-95 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 shadow-xl shadow-yellow-500/30 disabled:opacity-70 flex items-center justify-center gap-2 shrink-0">
              {isProcessing ? <HiOutlineRefresh className="animate-spin" size={24} /> : editingId ? <HiOutlinePencil size={20} /> : <FaRocket size={20} />}
              {isProcessing ? 'Saving...' : editingId ? 'Update Goal' : 'Launch Goal'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isFundModalOpen} onClose={() => setIsFundModalOpen(false)} title="Lock Funds" icon={FaLock} color="from-emerald-500 to-teal-600">
        <form onSubmit={handleAddFunds} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Locking for</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight line-clamp-1">{activeGoal?.title}</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-500 mt-1">Needs {currencySymbol}{(activeGoal?.targetAmount - (activeGoal?.currentSaved || 0)).toLocaleString(undefined, {maximumFractionDigits:0})} more</p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Source Vault</label>
            <VaultSelector selected={fundData.sourceVault} onChange={(v) => setFundData({...fundData, sourceVault: v})} />
          </div>
          {(fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && (
            <div className="space-y-2 animate-in fade-in zoom-in-95">
              <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">{fundData.sourceVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
              <input type="text" list="fund-vaults" required value={fundData.subWallet} onChange={(e) => setFundData({...fundData, subWallet: e.target.value})} placeholder={fundData.sourceVault === 'bank' ? "e.g. HDFC, SBI" : "e.g. Paytm, PayPal"} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-blue-300 dark:border-blue-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm placeholder-slate-400" />
              <datalist id="fund-vaults">{existingVaultNames.map(b => <option key={b} value={b} />)}</datalist>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">{currencySymbol}</span>
              <input type="number" step="any" required autoFocus value={fundData.amount} onChange={(e) => setFundData({...fundData, amount: e.target.value})} placeholder="0" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-3xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors shadow-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
              <span>Date</span><span className="text-emerald-600 dark:text-emerald-500">{formatGlobalDate ? formatGlobalDate(fundData.date.split('T')[0], 'short') : ''}</span>
            </label>
            <input type="datetime-local" required value={fundData.date} onChange={(e) => setFundData({...fundData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer transition-colors shadow-sm" />
          </div>
          <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
            <button type="submit" disabled={isProcessing} className="w-full py-4 sm:py-5 rounded-2xl font-black text-white text-lg uppercase tracking-widest transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl shadow-emerald-500/30 disabled:opacity-70 flex items-center justify-center gap-2 shrink-0">
              {isProcessing ? <HiOutlineRefresh className="animate-spin" size={24} /> : <FaLock size={18} />}
              {isProcessing ? 'Locking...' : 'Lock & Deduct from Vault'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isReleaseModalOpen} onClose={() => setIsReleaseModalOpen(false)} title="Release Funds" icon={FaUnlockAlt} color="from-rose-500 to-pink-600">
        <form onSubmit={handleReleaseFunds} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="text-center bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Withdrawing from</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight line-clamp-1">{activeGoal?.title}</p>
            <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-500 mt-1">Available: {currencySymbol}{(activeGoal?.currentSaved || 0).toLocaleString()}</p>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Send Funds To</label>
            <VaultSelector selected={fundData.sourceVault} onChange={(v) => setFundData({...fundData, sourceVault: v})} />
          </div>
          {(fundData.sourceVault === 'bank' || fundData.sourceVault === 'online') && (
            <div className="space-y-2 animate-in fade-in zoom-in-95">
              <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">{fundData.sourceVault === 'bank' ? 'Bank Name' : 'Wallet Name'}</label>
              <input type="text" list="release-vaults" required value={fundData.subWallet} onChange={(e) => setFundData({...fundData, subWallet: e.target.value})} placeholder={fundData.sourceVault === 'bank' ? "e.g. HDFC, SBI" : "e.g. Paytm, PayPal"} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-blue-300 dark:border-blue-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm placeholder-slate-400" />
              <datalist id="release-vaults">{existingVaultNames.map(b => <option key={b} value={b} />)}</datalist>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Amount</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">{currencySymbol}</span>
              <input type="number" step="any" required autoFocus value={fundData.amount} onChange={(e) => setFundData({...fundData, amount: e.target.value})} placeholder="0" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-black text-3xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 transition-colors shadow-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
              <span>Date</span><span className="text-rose-600 dark:text-rose-500">{formatGlobalDate ? formatGlobalDate(fundData.date.split('T')[0], 'short') : ''}</span>
            </label>
            <input type="datetime-local" required value={fundData.date} onChange={(e) => setFundData({...fundData, date: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer transition-colors shadow-sm" />
          </div>
          <div className="sticky bottom-0 pt-2 pb-1 bg-white dark:bg-slate-900 mt-2 z-10">
            <button type="submit" disabled={isProcessing} className="w-full py-4 sm:py-5 rounded-2xl font-black text-white text-lg uppercase tracking-widest transition-all active:scale-95 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-xl shadow-rose-500/30 disabled:opacity-70 flex items-center justify-center gap-2 shrink-0">
              {isProcessing ? <HiOutlineRefresh className="animate-spin" size={24} /> : <FaUnlockAlt size={18} />}
              {isProcessing ? 'Releasing...' : 'Release & Auto-Refund'}
            </button>
          </div>
        </form>
      </Modal>

      <DeleteModal context={deleteContext} onClose={() => setDeleteContext(null)} onSubmit={executeSecureDelete} pinInput={pinInput} setPinInput={setPinInput} pinError={pinError} isVerifying={isVerifying} currencySymbol={currencySymbol} />
    </div>
  );
};

const Goals = () => (
  <ToastProvider>
    <GoalsContent />
  </ToastProvider>
);

export default Goals;