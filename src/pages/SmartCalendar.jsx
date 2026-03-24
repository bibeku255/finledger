import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO 
} from 'date-fns';
import { 
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCalendar,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCreditCard
} from 'react-icons/hi';
import { FaRobot } from 'react-icons/fa';

// 🚀 REAL DATE CONVERTER ENGINE
import NepaliDate from 'nepali-date-converter';

const SmartCalendar = () => {
  // 🚀 ENGINE CONNECTED: Global Date Formatter
  const { user, dbData, baseCurrency = 'USD', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  const calendarPref = dbData?.settings?.baseCalendar || 'gregorian';

  // 🚀 FIXED: FETCH DATA DIRECTLY FROM NEW MASTER COLLECTIONS
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const eventsMap = {}; 

        // 1. Fetch Incomes
        const incomeSnap = await getDocs(collection(db, "users", user.uid, "incomeLogs"));
        incomeSnap.forEach((doc) => {
          const data = doc.data();
          if (data.date) {
            const dateStr = data.date.split('T')[0];
            if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
            eventsMap[dateStr].push({
              id: doc.id, type: 'income',
              title: data.title || data.category || 'Income', 
              amount: data.finalBaseAmount || data.amount || 0
            });
          }
        });

        // 2. Fetch Expenses
        const expenseSnap = await getDocs(collection(db, "users", user.uid, "expenseLogs"));
        expenseSnap.forEach((doc) => {
          const data = doc.data();
          if (data.date) {
            const dateStr = data.date.split('T')[0];
            if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
            eventsMap[dateStr].push({
              id: doc.id, type: 'expense',
              title: data.title || data.category || 'Expense', 
              amount: data.finalBaseAmount || data.amount || 0
            });
          }
        });

        // 3. Fetch Unpaid Bills Only
        const billsSnap = await getDocs(collection(db, "users", user.uid, "billReminders"));
        billsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.dueDate && !data.isPaid) {
            const dateStr = data.dueDate;
            if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
            eventsMap[dateStr].push({
              id: doc.id, type: 'bill', 
              title: `Bill: ${data.title}`, 
              amount: data.amount || 0
            });
          }
        });

        setEvents(eventsMap);
      } catch (error) {
        console.error("Error fetching calendar data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendarData();
  }, [user]);

  // --- CALENDAR ENGINE LOGIC ---
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const onDateClick = (day) => setSelectedDate(day);

  // 1. FORMAT THE HEADER (e.g., "Falgun 2082")
  const getFormattedMonthYear = (date) => {
    if (calendarPref === 'bikram_sambat') {
      return new NepaliDate(date).format('MMMM YYYY'); 
    }
    if (calendarPref === 'hijri') {
       return new Intl.DateTimeFormat('en-US-u-ca-islamic', { month: 'long', year: 'numeric' }).format(date);
    }
    if (calendarPref === 'jalali') {
       return new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'long', year: 'numeric' }).format(date);
    }
    return format(date, 'MMMM yyyy'); // Default AD
  };

  // 2. FORMAT THE DAY NUMBER (e.g., "23")
  const getDayLabel = (date) => {
    if (calendarPref === 'bikram_sambat') {
      return new NepaliDate(date).getDate();
    }
    if (calendarPref === 'hijri') {
      return new Intl.DateTimeFormat('en-US-u-ca-islamic', { day: 'numeric' }).format(date);
    }
    if (calendarPref === 'jalali') {
      return new Intl.DateTimeFormat('en-US-u-ca-persian', { day: 'numeric' }).format(date);
    }
    return format(date, 'd'); 
  };

  // 3. BUILD THE GRID BOUNDARIES (The Master Logic)
  const getGridBoundaries = () => {
    let monthStartAD, monthEndAD;

    if (calendarPref === 'bikram_sambat') {
      const currentBS = new NepaliDate(currentDate);
      const bsYear = currentBS.getYear();
      const bsMonth = currentBS.getMonth();

      // Get 1st day of BS Month in AD
      const bsStart = new NepaliDate(bsYear, bsMonth, 1);
      const adStart = bsStart.getAD();
      monthStartAD = new Date(adStart.year, adStart.month, adStart.date);

      // Get last day of BS Month in AD
      let nextBsMonth = bsMonth + 1;
      let nextBsYear = bsYear;
      if (nextBsMonth > 11) { nextBsMonth = 0; nextBsYear++; }
      const bsNextStart = new NepaliDate(nextBsYear, nextBsMonth, 1);
      const adNextStart = bsNextStart.getAD();
      const nextMonthStartAD = new Date(adNextStart.year, adNextStart.month, adNextStart.date);
      monthEndAD = addDays(nextMonthStartAD, -1);

    } else {
      // Standard AD Grid (Used for AD, Hijri, Jalali for UI stability)
      monthStartAD = startOfMonth(currentDate);
      monthEndAD = endOfMonth(monthStartAD);
    }

    return {
      startDate: startOfWeek(monthStartAD),
      endDate: endOfWeek(monthEndAD)
    };
  };

  // Check if a day belongs to the currently viewed month
  const isDayInCurrentMonthView = (day) => {
    if (calendarPref === 'bikram_sambat') {
      return new NepaliDate(day).getMonth() === new NepaliDate(currentDate).getMonth();
    }
    return isSameMonth(day, currentDate);
  };

  // --- RENDERERS ---
  const renderHeader = () => (
    <div className="flex justify-between items-center mb-6">
      <button onClick={prevMonth} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:scale-105 transition-all text-slate-600 dark:text-slate-300">
        <HiOutlineChevronLeft size={24} />
      </button>
      <div className="text-center">
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight capitalize">
          {getFormattedMonthYear(currentDate)}
        </h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
          {calendarPref.replace('_', ' ')} System
        </p>
      </div>
      <button onClick={nextMonth} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:scale-105 transition-all text-slate-600 dark:text-slate-300">
        <HiOutlineChevronRight size={24} />
      </button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-black text-[11px] text-slate-400 uppercase tracking-widest py-3">
          {format(addDays(startDate, i), 'EEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-2">{days}</div>;
  };

  const renderCells = () => {
    const { startDate, endDate } = getGridBoundaries();
    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const formattedDateAD = format(day, 'yyyy-MM-dd');
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isDayInCurrentMonthView(day);
        
        const dayEvents = events[formattedDateAD] || [];
        const hasIncome = dayEvents.some(e => e.type === 'income');
        const hasExpense = dayEvents.some(e => e.type === 'expense');
        const hasBill = dayEvents.some(e => e.type === 'bill');

        days.push(
          <div
            key={day}
            onClick={() => onDateClick(parseISO(cloneDay.toISOString()))}
            className={`min-h-[80px] p-2 flex flex-col items-center justify-start border border-slate-100 dark:border-white/5 cursor-pointer transition-all duration-300 relative overflow-hidden group
              ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/30 text-slate-300 dark:text-slate-700 opacity-50' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm'}
              ${isSelected ? '!bg-blue-600 !border-blue-600 !text-white shadow-xl shadow-blue-500/30 scale-[1.05] z-10 rounded-2xl opacity-100' : 'rounded-xl'}
            `}
          >
            <span className={`text-lg font-black ${isSelected ? 'text-white' : ''}`}>
              {getDayLabel(day)}
            </span>
            
            <div className="flex gap-1 mt-auto pb-1">
              {hasIncome && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]'}`}></span>}
              {hasExpense && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]'}`}></span>}
              {hasBill && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]'}`}></span>}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div className="grid grid-cols-7 gap-1 md:gap-2 mb-1 md:mb-2" key={day}>{days}</div>);
      days = [];
    }
    return <div>{rows}</div>;
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedEvents = events[selectedDateStr] || [];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 mt-16 md:mt-0 pb-24 md:pb-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="w-12 h-12 bg-blue-600/10 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
            <HiOutlineCalendar size={28} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Smart Calendar</h1>
          <p className="text-sm font-bold text-slate-500 max-w-lg mt-1">
            Track your financial timeline. Red dots show expenses or dues, green dots show income.
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-blue-500 bg-blue-500/10 px-4 py-2 rounded-full font-black text-xs animate-pulse">
            <FaRobot size={16} /> Syncing Ledgers...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT: CALENDAR GRID */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-white/5">
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        {/* RIGHT: DAILY SUMMARY PANEL */}
        <div className="bg-slate-900 dark:bg-slate-950 p-6 md:p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden h-full min-h-[400px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h3 className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">Activity Log</h3>
            <h2 className="text-2xl font-black text-white tracking-tight mb-8 capitalize">
              {/* 🚀 GLOBAL FORMAT RENDERED SAFELY */}
              {formatGlobalDate ? formatGlobalDate(selectedDate, 'full') : getFormattedMonthYear(selectedDate)}
            </h2>

            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
                <HiOutlineCalendar size={48} className="text-slate-600 mb-4" />
                <p className="text-sm font-bold text-slate-400">No transactions or bills.</p>
                <p className="text-[10px] text-slate-500 mt-1">Take a day off, you earned it!</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {selectedEvents.map((evt, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 
                      ${evt.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 
                        evt.type === 'expense' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}
                    `}>
                      {evt.type === 'income' ? <HiOutlineTrendingUp size={20} /> : 
                       evt.type === 'expense' ? <HiOutlineTrendingDown size={20} /> : <HiOutlineCreditCard size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-sm text-white truncate capitalize">{evt.title}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{evt.type}</p>
                    </div>
                    <div className={`font-black tracking-tight 
                      ${evt.type === 'income' ? 'text-emerald-400' : 
                        evt.type === 'expense' ? 'text-rose-400' : 'text-amber-400'}
                    `}>
                      {evt.type === 'income' ? '+' : '-'}{currencySymbol}{parseFloat(evt.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmartCalendar;