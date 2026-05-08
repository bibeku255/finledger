import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO, isToday 
} from 'date-fns';
import { 
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCalendar,
  HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineCreditCard,
  HiOutlineRefresh, HiOutlineEye, HiOutlineCash, HiOutlineReceiptTax,
  HiOutlineLightningBolt, HiOutlineClock
} from 'react-icons/hi';
import { 
  FaRobot, FaMoneyBillWave, FaCalendarCheck, FaCalendarDay, 
  FaRegCalendarAlt
} from 'react-icons/fa';
import NepaliDate from 'nepali-date-converter';

// ============================================
// 🚀 PREMIUM COMPONENTS
// ============================================

const StatBadge = ({ icon: Icon, label, value, color, bgColor, borderColor }) => (
  <div className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl ${bgColor} border ${borderColor} backdrop-blur-sm`}>
    <div className={`p-2 rounded-xl ${color} bg-white/20 dark:bg-white/10`}>
      <Icon size={16} />
    </div>
    <div>
      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-sm sm:text-base font-black tracking-tight">{value}</p>
    </div>
  </div>
);

const CalendarHeader = ({ currentDate, onPrev, onNext, calendarPref }) => {
  // 🚀 UPGRADED: Handled ALL 4 Calendars natively
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
    return format(date, 'MMMM yyyy');
  };

  const getCalendarName = (pref) => {
    switch(pref) {
      case 'bikram_sambat': return 'Bikram Sambat';
      case 'hijri': return 'Islamic (Hijri)';
      case 'jalali': return 'Persian (Jalali)';
      default: return 'Gregorian';
    }
  };

  return (
    <div className="flex items-center justify-between mb-5 sm:mb-6">
      {/* Month navigation */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button 
          onClick={onPrev} 
          className="p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
          aria-label="Previous month"
        >
          <HiOutlineChevronLeft size={20} />
        </button>
        <button 
          onClick={onNext} 
          className="p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:scale-105 transition-all text-slate-600 dark:text-slate-300 active:scale-95"
          aria-label="Next month"
        >
          <HiOutlineChevronRight size={20} />
        </button>
      </div>
      
      {/* Month title */}
      <div className="text-center flex-1 px-2">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight capitalize truncate">
          {getFormattedMonthYear(currentDate)}
        </h2>
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] mt-0.5">
          {getCalendarName(calendarPref)}
        </p>
      </div>
      
      {/* Today button */}
      <button 
        onClick={() => onPrev && onPrev(currentDate)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl font-black text-xs hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
      >
        <FaCalendarDay size={14} />
        Today
      </button>
      
      {/* Spacer for balance */}
      <div className="w-[76px] sm:hidden" />
    </div>
  );
};

const DayCell = ({ day, isCurrentMonth, isSelected, isToday, events, onSelect, getDayLabel, formatDate }) => {
  const hasIncome = events.some(e => e.type === 'income');
  const hasExpense = events.some(e => e.type === 'expense');
  const hasBill = events.some(e => e.type === 'bill');
  
  const totalIncome = events.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = events.filter(e => e.type === 'expense' || e.type === 'bill').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div
      onClick={() => onSelect(day)}
      className={`relative flex flex-col items-center p-1.5 sm:p-2 cursor-pointer transition-all duration-300 group
        min-h-[60px] sm:min-h-[80px] md:min-h-[90px]
        ${!isCurrentMonth 
          ? 'bg-slate-50/50 dark:bg-slate-900/20 text-slate-300 dark:text-slate-600 opacity-40' 
          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
        }
        ${isSelected 
          ? '!bg-gradient-to-br !from-blue-500 !to-indigo-600 !text-white shadow-xl shadow-blue-500/30 scale-[1.08] z-20 rounded-2xl opacity-100' 
          : 'rounded-xl border border-slate-100 dark:border-slate-800'
        }
        ${isToday && !isSelected ? 'ring-2 ring-blue-400/50 dark:ring-blue-500/30' : ''}
      `}
    >
      {/* Today indicator */}
      {isToday && !isSelected && (
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
      )}
      
      {/* Day number */}
      <span className={`text-xs sm:text-sm md:text-lg font-black leading-none mb-1
        ${isSelected ? 'text-white' : ''}
        ${isToday && !isSelected ? 'text-blue-600 dark:text-blue-400' : ''}
      `}>
        {getDayLabel(day)}
      </span>
      
      {/* Event indicators */}
      {(hasIncome || hasExpense || hasBill) && (
        <div className="flex gap-0.5 sm:gap-1 mt-auto pb-1">
          {hasIncome && (
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-md
              ${isSelected ? 'bg-white' : 'bg-emerald-400 shadow-emerald-500/50'}`} 
            />
          )}
          {hasExpense && (
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-md
              ${isSelected ? 'bg-white' : 'bg-rose-400 shadow-rose-500/50'}`} 
            />
          )}
          {hasBill && (
            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-md
              ${isSelected ? 'bg-white' : 'bg-amber-400 shadow-amber-500/50'}`} 
            />
          )}
        </div>
      )}
      
      {/* Quick total on hover (desktop only) */}
      {(totalIncome > 0 || totalExpense > 0) && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden md:block whitespace-nowrap shadow-xl z-30">
          {totalIncome > 0 && <span className="text-emerald-400">+{totalIncome.toLocaleString()}</span>}
          {totalIncome > 0 && totalExpense > 0 && ' / '}
          {totalExpense > 0 && <span className="text-rose-400">-{totalExpense.toLocaleString()}</span>}
        </div>
      )}
    </div>
  );
};

const EventCard = ({ event, currencySymbol }) => {
  const configs = {
    income: { 
      icon: HiOutlineTrendingUp, 
      color: 'text-emerald-600 dark:text-emerald-400', 
      bg: 'bg-emerald-50 dark:bg-emerald-500/10', 
      border: 'border-emerald-200 dark:border-emerald-500/30',
      prefix: '+'
    },
    expense: { 
      icon: HiOutlineTrendingDown, 
      color: 'text-rose-600 dark:text-rose-400', 
      bg: 'bg-rose-50 dark:bg-rose-500/10', 
      border: 'border-rose-200 dark:border-rose-500/30',
      prefix: '-'
    },
    bill: { 
      icon: HiOutlineReceiptTax, 
      color: 'text-amber-600 dark:text-amber-400', 
      bg: 'bg-amber-50 dark:bg-amber-500/10', 
      border: 'border-amber-200 dark:border-amber-500/30',
      prefix: '-'
    }
  };
  
  const config = configs[event.type] || configs.expense;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${config.bg} ${config.border}`}>
      <div className={`p-2.5 rounded-xl ${config.bg} ring-1 ring-current/10`}>
        <Icon size={18} className={config.color} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-white truncate capitalize">
          {event.title}
        </h4>
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {event.type}
        </p>
      </div>
      
      <div className={`font-black text-sm sm:text-base tracking-tight shrink-0 ${config.color}`}>
        {config.prefix}{currencySymbol}{parseFloat(event.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
      </div>
    </div>
  );
};

const EmptyState = ({ date, formatGlobalDate }) => (
  <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center px-4">
    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-4">
      <FaRegCalendarAlt size={28} className="text-slate-400 dark:text-slate-500" />
    </div>
    <p className="text-sm sm:text-base font-black text-slate-500 dark:text-slate-400 mb-1">No Activity</p>
    <p className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 max-w-[200px]">
      {date ? `No transactions or bills for this date.` : 'Select a date to view activity.'}
    </p>
  </div>
);

// ============================================
// 🚀 MAIN COMPONENT
// ============================================

const SmartCalendar = () => {
  const { user, dbData, baseCurrency = 'USD', formatGlobalDate } = useAuth();
  const currencySymbol = baseCurrency === 'INR' ? '₹' : baseCurrency === 'NPR' ? 'रू' : '$';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'

  const calendarPref = dbData?.settings?.baseCalendar || 'gregorian';

  // Fetch events from Firebase
  useEffect(() => {
    const fetchCalendarData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const eventsMap = {}; 

        // Incomes
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

        // Expenses
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

        // Unpaid bills
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

  // Calendar calculations
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedEvents = events[selectedDateStr] || [];

  const selectedTotals = useMemo(() => {
    const income = selectedEvents.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
    const expense = selectedEvents.filter(e => e.type === 'expense' || e.type === 'bill').reduce((s, e) => s + Number(e.amount), 0);
    return { income, expense, net: income - expense };
  }, [selectedEvents]);

  // Header formatter
  const getFormattedMonthYear = (date) => {
    if (calendarPref === 'bikram_sambat') return new NepaliDate(date).format('MMMM YYYY');
    if (calendarPref === 'hijri') {
      return new Intl.DateTimeFormat('en-US-u-ca-islamic', { month: 'long', year: 'numeric' }).format(date);
    }
    if (calendarPref === 'jalali') {
      return new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'long', year: 'numeric' }).format(date);
    }
    return format(date, 'MMMM yyyy');
  };

  // 🚀 UPGRADED: Handled ALL 4 Calendars natively for Grid Numbering
  const getDayLabel = (date) => {
    if (calendarPref === 'bikram_sambat') return new NepaliDate(date).getDate();
    if (calendarPref === 'hijri') {
      return new Intl.DateTimeFormat('en-US-u-ca-islamic', { day: 'numeric' }).format(date);
    }
    if (calendarPref === 'jalali') {
      return new Intl.DateTimeFormat('en-US-u-ca-persian', { day: 'numeric' }).format(date);
    }
    return format(date, 'd'); 
  };

  const isDayInCurrentMonthView = (day) => {
    if (calendarPref === 'bikram_sambat') {
      return new NepaliDate(day).getMonth() === new NepaliDate(currentDate).getMonth();
    }
    if (calendarPref === 'hijri') {
      return new Intl.DateTimeFormat('en-US-u-ca-islamic', { month: 'numeric' }).format(day) === new Intl.DateTimeFormat('en-US-u-ca-islamic', { month: 'numeric' }).format(currentDate);
    }
    if (calendarPref === 'jalali') {
      return new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'numeric' }).format(day) === new Intl.DateTimeFormat('en-US-u-ca-persian', { month: 'numeric' }).format(currentDate);
    }
    return isSameMonth(day, currentDate);
  };

  // Grid boundaries (Base Gregorian boundary ensures 100% correct cross-mapping)
  const getGridBoundaries = () => {
    let monthStartAD, monthEndAD;
    if (calendarPref === 'bikram_sambat') {
      const currentBS = new NepaliDate(currentDate);
      const bsYear = currentBS.getYear();
      const bsMonth = currentBS.getMonth();
      const bsStart = new NepaliDate(bsYear, bsMonth, 1);
      const adStart = bsStart.getAD();
      monthStartAD = new Date(adStart.year, adStart.month, adStart.date);
      
      let nextBsMonth = bsMonth + 1;
      let nextBsYear = bsYear;
      if (nextBsMonth > 11) { nextBsMonth = 0; nextBsYear++; }
      const bsNextStart = new NepaliDate(nextBsYear, nextBsMonth, 1);
      const adNextStart = bsNextStart.getAD();
      monthEndAD = addDays(new Date(adNextStart.year, adNextStart.month, adNextStart.date), -1);
    } else {
      monthStartAD = startOfMonth(currentDate);
      monthEndAD = endOfMonth(monthStartAD);
    }

    return {
      startDate: startOfWeek(monthStartAD, { weekStartsOn: 0 }),
      endDate: endOfWeek(monthEndAD, { weekStartsOn: 0 })
    };
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };
  const onDateClick = (day) => setSelectedDate(day);

  // Render calendar days
  const renderDaysHeader = () => {
    const days = [];
    const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-black text-[9px] sm:text-[10px] md:text-xs text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] py-2 sm:py-3">
          <span className="hidden sm:inline">{format(addDays(startDate, i), 'EEE')}</span>
          <span className="sm:hidden">{format(addDays(startDate, i), 'EEEEE')}</span>
        </div>
      );
    }
    return <div className="grid grid-cols-7 mb-1">{days}</div>;
  };

  const renderCells = () => {
    const { startDate, endDate } = getGridBoundaries();
    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = new Date(day);
        const formattedDateAD = format(day, 'yyyy-MM-dd');
        const dayEvents = events[formattedDateAD] || [];
        
        days.push(
          <DayCell
            key={formattedDateAD}
            day={cloneDay}
            isCurrentMonth={isDayInCurrentMonthView(day)}
            isSelected={isSameDay(day, selectedDate)}
            isToday={isToday(day)}
            events={dayEvents}
            onSelect={onDateClick}
            getDayLabel={getDayLabel}
            formatDate={format}
          />
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-1.5 mb-0.5 sm:mb-1 md:mb-1.5" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div>{rows}</div>;
  };

  // Upcoming events for list view
  const upcomingEvents = useMemo(() => {
    const allEvents = [];
    Object.entries(events).forEach(([date, dateEvents]) => {
      dateEvents.forEach(event => {
        allEvents.push({ ...event, date });
      });
    });
    return allEvents
      .filter(e => new Date(e.date) >= new Date())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 20);
  }, [events]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen pt-16 sm:pt-20 md:pt-24 pb-20 sm:pb-24 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 sm:mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 sm:p-3.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl shadow-blue-500/30 ring-1 ring-white/20">
            <HiOutlineCalendar size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Smart Calendar
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
              Financial timeline with real-time transaction tracking
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-1.5 text-blue-500 bg-blue-500/10 px-3 py-2 rounded-xl font-black text-[10px] sm:text-xs animate-pulse">
              <HiOutlineRefresh className="animate-spin" size={14} />
              <span className="hidden sm:inline">Syncing...</span>
            </div>
          )}
          
          {/* View toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button 
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all
                ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
            >
              Month
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all
                ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500'}`}
            >
              Upcoming
            </button>
          </div>
        </div>
      </div>

      {/* 🚀 CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8 items-start">
        
        {/* LEFT/CENTER: Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-3 sm:p-4 md:p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            {viewMode === 'calendar' ? (
              <>
                <CalendarHeader 
                  currentDate={currentDate}
                  onPrev={prevMonth}
                  onNext={nextMonth}
                  calendarPref={calendarPref}
                />
                {renderDaysHeader()}
                {renderCells()}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Upcoming Events</h3>
                  <span className="text-[10px] font-bold text-slate-400">{upcomingEvents.length} events</span>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {upcomingEvents.length === 0 ? (
                    <EmptyState date={null} formatGlobalDate={formatGlobalDate} />
                  ) : (
                    upcomingEvents.map((event, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <span className="text-[10px] font-black text-slate-400 w-20 shrink-0">
                          {formatGlobalDate ? formatGlobalDate(new Date(event.date), 'short') : event.date}
                        </span>
                        <EventCard event={event} currencySymbol={currencySymbol} />
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Daily Summary Panel */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-4 sm:p-5 md:p-6 lg:p-8 shadow-2xl border border-slate-700/50 relative overflow-hidden sticky top-24">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            {/* Date header */}
            <div className="mb-5 sm:mb-6">
              <h3 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                <HiOutlineEye className="inline mr-1" size={12} />
                Daily Summary
              </h3>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight capitalize">
                {formatGlobalDate ? formatGlobalDate(selectedDate, 'full') : getFormattedMonthYear(selectedDate)}
              </h2>
            </div>

            {/* Stats badges */}
            {selectedEvents.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-5">
                <StatBadge 
                  icon={HiOutlineTrendingUp}
                  label="Income"
                  value={`${currencySymbol}${selectedTotals.income.toLocaleString()}`}
                  color="text-emerald-400"
                  bgColor="bg-emerald-500/10"
                  borderColor="border-emerald-500/20"
                />
                <StatBadge 
                  icon={HiOutlineTrendingDown}
                  label="Expenses"
                  value={`${currencySymbol}${selectedTotals.expense.toLocaleString()}`}
                  color="text-rose-400"
                  bgColor="bg-rose-500/10"
                  borderColor="border-rose-500/20"
                />
                <div className="col-span-2">
                  <StatBadge 
                    icon={HiOutlineCash}
                    label="Net Flow"
                    value={`${selectedTotals.net >= 0 ? '+' : ''}${currencySymbol}${selectedTotals.net.toLocaleString()}`}
                    color={selectedTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                    bgColor={selectedTotals.net >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
                    borderColor={selectedTotals.net >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'}
                  />
                </div>
              </div>
            )}

            {/* Events list */}
            {selectedEvents.length === 0 ? (
              <EmptyState date={selectedDate} formatGlobalDate={formatGlobalDate} />
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-[350px] lg:max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {selectedEvents.map((evt, idx) => (
                  <EventCard key={idx} event={evt} currencySymbol={currencySymbol} />
                ))}
              </div>
            )}
            
            {/* Quick today button */}
            <button 
              onClick={goToToday}
              className="w-full mt-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <FaCalendarDay size={14} />
              Jump to Today
            </button>
          </div>
        </div>

      </div>
      
      {/* 🚀 MOBILE FAB for Today */}
      <button
        onClick={goToToday}
        className="lg:hidden fixed bottom-6 right-4 z-50 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 flex items-center gap-2 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
      >
        <FaCalendarDay size={16} />
        Today
      </button>

    </div>
  );
};

export default SmartCalendar;