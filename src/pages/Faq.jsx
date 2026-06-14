import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineChevronDown, HiOutlineSearch, HiOutlineChatAlt2, HiOutlineQuestionMarkCircle } from 'react-icons/hi';

const faqs = [
  {
    category: "General",
    questions: [
      {
        q: "What exactly is Finledger?",
        a: "Finledger is a unified multi-gateway finance engine. It allows you to track your physical cash, bank balances, crypto portfolios, and daily expenses all in one single, intelligent dashboard. We do not hold your funds; we help you track them."
      },
      {
        q: "Is Finledger a trading or earning platform?",
        a: "No. Finledger is strictly a tracking and analytics tool. You cannot deposit money, trade crypto, or earn interest directly through our app. Any numbers shown are based on the data you log or live market rates fetched for your tracked assets."
      },
      {
        q: "Is it free to use?",
        a: "Yes! The core tracking features, including the unified dashboard, expense tracking, and basic crypto monitoring, are completely free to use."
      }
    ]
  },
  {
    category: "Security & Privacy",
    questions: [
      {
        q: "How secure is my financial data?",
        a: "Extremely secure. We use AES-256 encryption. Your highly sensitive data, such as Seed Phrases saved in Secure Notes, are obfuscated on your device before ever reaching our database."
      },
      {
        q: "What happens if I forget my Master PIN?",
        a: "For your absolute privacy, your Master PIN is one-way hashed. We do not know your PIN and cannot recover it for you. If you lose your Master PIN, any encrypted Secure Notes or locked actions cannot be recovered."
      },
      {
        q: "Can Finledger access my bank accounts or crypto wallets?",
        a: "No. We do not ask for your bank login credentials or your crypto wallet private keys to connect automatically. You manually log your balances or public addresses, keeping you 100% in control."
      }
    ]
  },
  {
    category: "Features & AI",
    questions: [
      {
        q: "Is the AI (J.A.R.V.I.S) providing financial advice?",
        a: "No. J.A.R.V.I.S analyzes the data you input to provide structural suggestions (like rebalancing idle cash) based on mathematical algorithms. It does not predict market movements and should not be taken as licensed financial advice."
      },
      {
        q: "How does the Global Date Sync work?",
        a: "We are one of the first platforms to natively support local calendars. If you set your preference to Bikram Sambat (BS) or Hijri, your entire transaction history, charts, and reports will automatically map to that calendar instead of the standard Gregorian (AD) calendar."
      },
      {
        q: "How are Crypto and Forex prices updated?",
        a: "We use top-tier third-party APIs (like CoinGecko and ExchangeRate-API) to fetch live market prices every few minutes. For custom tokens not listed globally, the system seamlessly falls back to your predefined custom rates."
      }
    ]
  }
];

const Faq = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openQ, setOpenQ] = useState(null); // Stores the index of the currently open question

  const toggleQuestion = (uniqueId) => {
    setOpenQ(openQ === uniqueId ? null : uniqueId);
  };

  // Filter FAQs based on search query
  const filteredFaqs = faqs.map(category => {
    return {
      ...category,
      questions: category.questions.filter(q => 
        q.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    };
  }).filter(category => category.questions.length > 0);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24 animate-in fade-in duration-700">
      
      {/* 🚀 Header & Search Section */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center mb-16">
        <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest mb-6 border border-blue-200 dark:border-blue-800 shadow-sm">
          <HiOutlineQuestionMarkCircle size={16} /> Help Center
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-6">
          Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Questions.</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 font-medium mb-10">
          Everything you need to know about the product, security, and billing.
        </p>

        {/* Live Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
            <HiOutlineSearch size={24} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for answers..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white pl-14 pr-6 py-5 rounded-[2rem] font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm text-lg placeholder:font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* 🚀 FAQ Accordion Section */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 min-h-[400px]">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <HiOutlineSearch className="mx-auto text-6xl text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-2xl font-black text-slate-700 dark:text-white mb-2">No results found</h3>
            <p className="text-slate-500 font-medium">Try adjusting your search query to find what you're looking for.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {filteredFaqs.map((category, catIdx) => (
              <div key={catIdx}>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 pl-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> {category.category}
                </h3>
                
                <div className="space-y-4">
                  {category.questions.map((faq, qIdx) => {
                    const uniqueId = `${catIdx}-${qIdx}`;
                    const isOpen = openQ === uniqueId;

                    return (
                      <div 
                        key={qIdx} 
                        className={`bg-white dark:bg-slate-900 border transition-all duration-300 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md 
                          ${isOpen ? 'border-blue-400 dark:border-blue-500 shadow-blue-500/10' : 'border-slate-200 dark:border-slate-800'}
                        `}
                      >
                        <button 
                          onClick={() => toggleQuestion(uniqueId)} 
                          className="w-full flex items-center justify-between p-6 md:p-8 text-left focus:outline-none"
                        >
                          <span className={`font-black text-lg md:text-xl pr-4 transition-colors ${isOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                            {faq.q}
                          </span>
                          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rotate-180' : 'bg-slate-50 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                            <HiOutlineChevronDown size={20} />
                          </div>
                        </button>
                        
                        <div 
                          className={`px-6 md:px-8 overflow-hidden transition-all duration-500 ease-in-out 
                            ${isOpen ? 'max-h-96 pb-6 md:pb-8 opacity-100' : 'max-h-0 opacity-0'}
                          `}
                        >
                          <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed text-base md:text-lg">
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🚀 Bottom CTA */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-24">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-10 md:p-12 text-center shadow-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-left">
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Still have questions?</h3>
            <p className="text-slate-400 font-medium">Can't find the answer you're looking for? Please chat to our friendly team.</p>
          </div>
          <Link to="/contact" className="shrink-0 w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
            <HiOutlineChatAlt2 size={20} /> Contact Support
          </Link>
        </div>
      </div>

    </div>
  );
};

export default Faq;