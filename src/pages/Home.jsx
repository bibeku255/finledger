import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import {
  HiOutlineSparkles, HiOutlineArrowRight, HiOutlineChevronDown,
  HiOutlineChatAlt2, HiOutlineBell, HiOutlineCash, HiOutlineLockClosed,
  HiOutlineUserGroup, HiOutlineChartPie, HiOutlineLightningBolt
} from 'react-icons/hi';
import {
  FaRobot, FaTelegramPlane, FaYoutube, FaFacebook,
  FaUsers, FaEthereum, FaExchangeAlt
} from 'react-icons/fa';

// ─── FEATURE DATA ────────────────────────────────────────
const keyFeatures = [
  {
    id: 1,
    title: "Fortress Security",
    subtitle: "PBKDF2‑SHA256 + PIN",
    desc: "Every vault is encrypted. Critical actions require PIN verification and explicit confirmation for complete personal control.",
    icon: <HiOutlineLockClosed size={32} />,
    color: "rose",
    gradient: "from-rose-500/20 to-rose-600/20",
    border: "border-rose-500/30",
  },
  {
    id: 2,
    title: "Multi‑Vault Control",
    subtitle: "Cash, Bank & Crypto",
    desc: "Create separate vaults. Move funds between them with one‑tap Capital Shifting for accurate personal tracking.",
    icon: <HiOutlineCash size={32} />,
    color: "emerald",
    gradient: "from-emerald-500/20 to-emerald-600/20",
    border: "border-emerald-500/30",
  },
  {
    id: 3,
    title: "Party Ledger",
    subtitle: "Split income & expenses",
    desc: "Track transactions with individuals or groups. Keep a clean, transparent ledger for every contact.",
    icon: <HiOutlineUserGroup size={32} />,
    color: "blue",
    gradient: "from-blue-500/20 to-blue-600/20",
    border: "border-blue-500/30",
  },
  {
    id: 4,
    title: "Crypto Universe",
    subtitle: "Tracking & Analytics",
    desc: "Manage personal assets, monitor token swaps, and track real-time crypto prices directly in your secure dashboard.",
    icon: <FaEthereum size={28} />,
    color: "purple",
    gradient: "from-purple-500/20 to-purple-600/20",
    border: "border-purple-500/30",
  },
  {
    id: 5,
    title: "AI Advisor J.A.R.V.I.S.",
    subtitle: "Smart Analytics",
    desc: "AI scans your spending and vaults to deliver actionable strategies, rebalancing tips, and risk alerts.",
    icon: <FaRobot size={28} />,
    color: "amber",
    gradient: "from-amber-500/20 to-amber-600/20",
    border: "border-amber-500/30",
  },
  {
    id: 6,
    title: "Multi‑Fiat Alerts",
    subtitle: "Smart Calendar",
    desc: "Track income in local fiat. Set bill alerts and sync dates with the Smart Calendar. Never miss a deadline again.",
    icon: <HiOutlineBell size={32} />,
    color: "cyan",
    gradient: "from-cyan-500/20 to-cyan-600/20",
    border: "border-cyan-500/30",
  }
];

const faqs = [
  { q: "Is this a platform to deposit money?", a: "No. This application is strictly a personal crypto and expense tracking tool built for educational and portfolio management purposes. We do not accept deposits." },
  { q: "How secure is my personal data?", a: "We use AES‑256 for data at rest. Since this is a personal tracking tool, you have full control over your entries and encryptions." },
  { q: "Can I move money between vaults?", a: "Absolutely! Capital Shifting lets you rebalance your cash, bank, and crypto records visually in seconds." },
  { q: "Is the AI Advisor free?", a: "Yes, J.A.R.V.I.S. provides standard portfolio analysis and suggestions for your data." }
];

// ─── ANIMATION VARIANTS ──────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};
const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

// ─── COMPONENT ───────────────────────────────────────────
const Home = () => {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const { scrollYProgress } = useScroll();
  
  // Parallax effects for premium feel
  const yHeroBg = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const yImage = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <div className="bg-[#020617] min-h-screen font-sans selection:bg-blue-500/30 overflow-x-hidden text-white">

      {/* 🚀 HERO SECTION */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="relative pt-32 pb-32 md:pt-48 px-4 flex flex-col items-center text-center overflow-hidden"
      >
        <motion.div style={{ y: yHeroBg }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] bg-blue-600/20 blur-[150px] rounded-full" />
          <div className="w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full absolute top-1/4 left-1/4" />
        </motion.div>

        <motion.div variants={fadeInUp} className="relative z-10 max-w-5xl mx-auto">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-md text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] mb-8 border border-slate-700/50 shadow-2xl">
            <HiOutlineSparkles className="text-yellow-400" size={16} />
            Your Personal Financial Engine
          </div>
          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1.1] mb-8">
            Track Your Wealth <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Like a Pro.
            </span>
          </motion.h1>
          <motion.p variants={fadeInUp} className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto mb-10 leading-relaxed">
            Unify your Cash, Bank, and Crypto expenses. Analyze patterns with AI, shift capital visually, and stay in total control.
          </motion.p>
          
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
             {user ? (
               <Link to="/dashboard" className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] flex items-center justify-center gap-3 w-full sm:w-auto">
                 Go to Dashboard <HiOutlineArrowRight size={20} />
               </Link>
             ) : (
               <>
                 <Link to="/signup" className="px-10 py-4 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 w-full sm:w-auto">
                   Start Tracking <HiOutlineArrowRight size={20} />
                 </Link>
                 <Link to="/login" className="px-10 py-4 bg-slate-800/80 backdrop-blur-sm hover:bg-slate-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all border border-slate-700/50 flex items-center justify-center w-full sm:w-auto">
                   Sign In
                 </Link>
               </>
             )}
          </motion.div>

          {/* 🖼️ HERO MOTION GRAPHIC / PICTURE */}
          <motion.div 
            style={{ y: yImage }}
            animate={{ y: [0, -15, 0] }} 
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="relative mx-auto w-full max-w-4xl rounded-3xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-xl p-2 shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
            <img 
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
              alt="Dashboard Preview" 
              className="rounded-2xl w-full h-auto object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-700"
            />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* 🛡️ STATS BANNER */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="border-y border-slate-800/80 bg-slate-900/50 backdrop-blur-xl relative z-20"
      >
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "PBKDF2", label: "Encryption" },
            { value: "0", label: "Data Shared" },
            { value: "100%", label: "Personal Control" },
            { value: "Crypto + Fiat", label: "Unified Tracking" },
          ].map((s, i) => (
            <motion.div key={i} variants={fadeInUp} className="flex flex-col items-center">
              <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-md">
                {s.value}
              </h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 🔥 PREMIUM FEATURES */}
      <motion.section className="py-32 max-w-7xl mx-auto px-4 md:px-8 relative z-20">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
            Everything you need. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">In one place.</span>
          </h2>
          <p className="text-slate-400 font-semibold text-lg">
            From military‑grade security to AI‑driven tracking – replace 10+ apps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {keyFeatures.map((feature) => (
            <motion.div
              key={feature.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              whileHover={{ y: -10, scale: 1.02 }}
              className="p-8 bg-slate-800/20 border border-slate-700/50 backdrop-blur-md rounded-3xl relative overflow-hidden group transition-all duration-500 hover:border-slate-500/50 hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.1)]"
            >
              <div className={`absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br ${feature.gradient} blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-slate-800 border ${feature.border} text-${feature.color}-400 group-hover:scale-110 transition-transform duration-500`}>
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{feature.subtitle}</p>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 🧠 CAPITAL SHIFTING VISUAL SECTION */}
      <motion.section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900/80 border-y border-slate-800/80" />
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">
              Capital Shifting <br/><span className="text-emerald-400">Visualized.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Moving balances between Cash, Bank, and Crypto isn't just a ledger entry anymore. Experience smooth, visual capital shifting that makes managing your personal wealth clear and instant.
            </p>
            <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 group">
              Try Capital Shifting <HiOutlineArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
            className="relative h-[450px] w-full rounded-[3rem] bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="absolute w-40 h-40 bg-emerald-500/10 blur-[60px] rounded-full top-10 right-10" />
            <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 5 }} className="absolute w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full bottom-10 left-10" />
            
            <motion.div 
              whileHover={{ rotateX: 10, rotateY: -10 }}
              style={{ perspective: 1000 }}
              className="relative z-10 bg-slate-800/80 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl border border-slate-600/50 w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400"><HiOutlineCash size={24}/></div>
                  <span className="text-xs font-bold uppercase text-slate-400">Cash Vault</span>
                </div>
                <motion.div animate={{ x: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                  <FaExchangeAlt size={24} className="text-slate-500" />
                </motion.div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-400"><FaEthereum size={24}/></div>
                  <span className="text-xs font-bold uppercase text-slate-400">Crypto Vault</span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: "0%" }} whileInView={{ width: "100%" }} transition={{ duration: 2, repeat: Infinity }}
                  className="h-full bg-gradient-to-r from-emerald-400 to-blue-400"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ❓ FAQ SECTION */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="py-32 max-w-4xl mx-auto px-4 md:px-8"
      >
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Got Questions?</h2>
          <p className="text-slate-400 font-semibold text-lg">Answers straight from the vault.</p>
        </motion.div>

        <motion.div variants={stagger} className="space-y-4 mb-10">
          {faqs.map((faq, idx) => (
            <motion.div key={idx} variants={fadeInUp} className="bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm rounded-[2rem] overflow-hidden transition-all hover:bg-slate-800/50">
              <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full flex items-center justify-between p-6 text-left focus:outline-none group">
                <span className="font-black text-slate-200 text-lg pr-4">{faq.q}</span>
                <motion.span animate={{ rotate: openFaq === idx ? 180 : 0 }} transition={{ duration: 0.3 }} className="text-blue-400 text-2xl shrink-0 bg-blue-500/10 p-2 rounded-full">
                  <HiOutlineChevronDown />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq === idx && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="px-6 overflow-hidden"
                  >
                    <p className="text-slate-400 font-medium leading-relaxed pb-6">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* 🌐 SOCIALS SECTION */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="py-32 bg-slate-900/50 backdrop-blur-md border-t border-slate-800/80"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Join the <span className="text-blue-400">Community.</span>
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-slate-400 font-semibold text-lg mb-16 max-w-2xl mx-auto">
            Stay updated with development, tutorials, and community support.
          </motion.p>
          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FaTelegramPlane, label: "Channel", desc: "Live Updates", href: "https://t.me/bpcryptocraft", color: "sky" },
              { icon: FaUsers, label: "Group Chat", desc: "Community", href: "https://t.me/cryptoandexpensestracker", color: "blue" },
              { icon: FaYoutube, label: "YouTube", desc: "Video Guides", href: "https://youtube.com/@bibekpoudel2642", color: "red" },
              { icon: HiOutlineChatAlt2, label: "Support", desc: "Help Desk", href: "/contact", color: "emerald" },
            ].map((item, i) => (
              <motion.a
                key={i}
                variants={fadeInUp}
                whileHover={{ y: -8, scale: 1.02 }}
                href={item.href}
                target={item.href.startsWith('http') ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="group p-8 bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm rounded-[2.5rem] transition-all duration-300 relative overflow-hidden hover:bg-slate-800/80"
              >
                <div className={`absolute inset-0 bg-gradient-to-br from-${item.color}-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className={`w-16 h-16 bg-${item.color}-500/10 text-${item.color}-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <item.icon />
                  </div>
                  <h3 className="font-black text-white text-xl mb-1">{item.label}</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.desc}</p>
                </div>
              </motion.a>
            ))}
          </motion.div>
          <motion.div variants={fadeInUp} className="mt-12">
            <a href="https://www.facebook.com/share/18PN3Dan77/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest group">
              <FaFacebook size={18} className="text-blue-500 group-hover:scale-110 transition-transform" /> Follow on Facebook
            </a>
          </motion.div>
        </div>
      </motion.section>

      {/* 🚀 CTA SECTION */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="py-32 px-4 md:px-8"
      >
        <motion.div variants={fadeInUp} className="max-w-5xl mx-auto bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-[3rem] p-10 md:p-20 text-center relative overflow-hidden border border-slate-700/50 shadow-[0_0_50px_-15px_rgba(37,99,235,0.3)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <motion.div variants={fadeInUp} className="relative z-10">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }} className="mx-auto text-6xl text-blue-400 mb-6 drop-shadow-lg w-fit">
              <HiOutlineChartPie />
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6">
              Your Ledger. Your Rules.
            </h2>
            <p className="text-blue-200 text-lg md:text-xl font-medium mb-10 max-w-2xl mx-auto">
              Ready to take complete control of your expenses and crypto portfolio?
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link to="/dashboard" className="w-full sm:w-auto px-10 py-5 bg-white text-blue-900 hover:bg-slate-200 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group">
                  Launch Dashboard <HiOutlineArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <Link to="/signup" className="w-full sm:w-auto px-10 py-5 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 group border border-blue-400/50">
                  Start Tracking Now <HiOutlineLightningBolt size={18} className="group-hover:scale-125 transition-transform text-yellow-300" />
                </Link>
              )}
            </div>
          </motion.div>
        </motion.div>
      </motion.section>
    </div>
  );
};

export default Home;