import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FaTwitter, FaDiscord, FaLinkedin, FaGithub, FaCheckCircle
} from 'react-icons/fa';
import { HiOutlineMail, HiOutlineExclamationCircle } from 'react-icons/hi';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig'; // ✅ Aapka existing file

import logo from '../../assets/logo.svg'; 

// ✅ EMAILJS CONFIG (Replace with your actual keys)
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const Footer = () => {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. ✅ CHECK DUPLICATE (Aapka existing firebase/db.js use kar rahe)
      const q = query(collection(db, 'subscribers'), where('email', '==', email.toLowerCase().trim()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setErrorMessage('You are already subscribed! 🎉');
        setEmail('');
        setIsSubmitting(false);
        setTimeout(() => setErrorMessage(''), 4000);
        return;
      }

      // 2. ✅ SAVE TO FIRESTORE (Aapka existing pattern)
      await addDoc(collection(db, 'subscribers'), {
        email: email.toLowerCase().trim(),
        subscribedAt: serverTimestamp(),
        source: 'footer'
      });

      // 3. ✅ SEND WELCOME EMAIL (EmailJS - No backend!)
      await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          user_email: email.toLowerCase().trim(),
          to_name: email.split('@')[0],
          message: 'Welcome to Finledger Newsletter! 🚀'
        },
        EMAILJS_PUBLIC_KEY
      );

      console.log("✅ Subscribed & Email sent:", email);
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 5000);

    } catch (error) {
      console.error('❌ Subscription error:', error);
      
      // Firestore error
      if (error.code === 'permission-denied') {
        setErrorMessage('Security rules not updated for subscribers.');
      } 
      // EmailJS error
      else if (error.status === 400 || error.text) {
        setErrorMessage('Email service error. Please try again.');
      }
      else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="bg-slate-950 pt-16 md:pt-20 pb-8 md:pb-10 border-t border-slate-900 relative overflow-hidden">
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full md:w-[800px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        
        {/* 🚀 NEWSLETTER SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8 mb-12 md:mb-16 shadow-2xl">
          <div className="w-full lg:max-w-xl text-center lg:text-left">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
              Stay ahead of the market.
            </h3>
            <p className="text-sm md:text-base text-slate-400 font-medium">
              Subscribe to our newsletter for the latest blogs, crypto strategies, and platform updates.
            </p>
          </div>
          
          <form onSubmit={handleSubscribe} className="w-full lg:w-auto flex-1 max-w-md relative mt-2 lg:mt-0">
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0">
              <div className="hidden sm:block absolute left-4 text-slate-500 z-10">
                <HiOutlineMail size={20} />
              </div>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMessage(''); }}
                placeholder="Enter your email address" 
                disabled={isSubmitting}
                className="w-full bg-slate-950 border border-slate-800 text-white px-4 sm:pl-12 sm:pr-36 py-3.5 md:py-4 rounded-xl sm:rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder:text-slate-600 text-sm md:text-base disabled:opacity-50"
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`sm:absolute sm:right-2 sm:top-2 sm:bottom-2 w-full sm:w-auto px-5 py-3.5 sm:py-0 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 sm:mt-0 ${
                  isSubscribed 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-70 disabled:cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : isSubscribed ? (
                  <>
                    <FaCheckCircle size={14} /> Subscribed!
                  </>
                ) : (
                  'Subscribe'
                )}
              </button>
            </div>
            
            {errorMessage && (
              <p className="absolute -bottom-6 left-0 sm:left-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1 w-full sm:w-auto mt-1 sm:mt-0">
                <HiOutlineExclamationCircle size={12} /> {errorMessage}
              </p>
            )}
            {isSubscribed && !errorMessage && (
              <p className="absolute -bottom-6 left-0 sm:left-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest w-full sm:w-auto mt-1 sm:mt-0">
                Welcome aboard! Check your inbox. 🚀
              </p>
            )}
          </form>
        </div>

        {/* 🚀 LINKS GRID */}
        <div className="flex flex-col lg:grid lg:grid-cols-4 gap-10 md:gap-12 lg:gap-8 mb-12 md:mb-16">
          
          <div className="lg:col-span-1 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Link to="/" className="flex items-center gap-3 mb-4 md:mb-6">
              <img src={logo} alt="Finledger Logo" className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-slate-700 shadow-lg bg-slate-800 p-0.5" />
              <span className="text-xl md:text-2xl font-black text-white tracking-tighter">Finledger</span>
            </Link>
            <p className="text-xs md:text-sm text-slate-400 font-medium leading-relaxed mb-6 max-w-sm lg:max-w-none">
              The ultimate multi-gateway finance engine. Track your fiat, manage your crypto, and optimize your wealth with AI.
            </p>
            <div className="flex gap-3 justify-center lg:justify-start">
              <a href="#" className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all"><FaTwitter size={16} className="md:text-lg" /></a>
              <a href="#" className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"><FaDiscord size={16} className="md:text-lg" /></a>
              <a href="#" className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-600/50 hover:bg-blue-600/10 transition-all"><FaLinkedin size={16} className="md:text-lg" /></a>
              <a href="#" className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-all"><FaGithub size={16} className="md:text-lg" /></a>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:col-span-3 gap-8">
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] md:text-xs mb-4 md:mb-6">Platform</h4>
              <ul className="space-y-3 md:space-y-4">
                <li><Link to="/services" className="text-slate-400 hover:text-blue-400 font-medium transition-colors text-xs md:text-sm">Features & Services</Link></li>
                <li><Link to="/dashboard/crypto/wallet" className="text-slate-400 hover:text-blue-400 font-medium transition-colors text-xs md:text-sm">Crypto Engine</Link></li>
                <li><Link to="/dashboard/tools/converter" className="text-slate-400 hover:text-blue-400 font-medium transition-colors text-xs md:text-sm">Live Forex Converter</Link></li>
                <li><Link to="/dashboard/strategy" className="text-slate-400 hover:text-blue-400 font-medium transition-colors text-xs md:text-sm">AI Strategy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] md:text-xs mb-4 md:mb-6">Company</h4>
              <ul className="space-y-3 md:space-y-4">
                <li><Link to="/about" className="text-slate-400 hover:text-emerald-400 font-medium transition-colors text-xs md:text-sm">About Us</Link></li>
                <li><Link to="/blogs" className="text-slate-400 hover:text-emerald-400 font-medium transition-colors text-xs md:text-sm">Latest Blogs</Link></li>
                <li><Link to="/faq" className="text-slate-400 hover:text-emerald-400 font-medium transition-colors text-xs md:text-sm">Help & FAQ</Link></li>
                <li><Link to="/contact" className="text-slate-400 hover:text-emerald-400 font-medium transition-colors text-xs md:text-sm">Contact Support</Link></li>
              </ul>
            </div>
            <div className="col-span-2 md:col-span-1 mt-4 md:mt-0">
              <h4 className="text-white font-black uppercase tracking-widest text-[10px] md:text-xs mb-4 md:mb-6">Legal</h4>
              <ul className="space-y-3 md:space-y-4">
                <li><Link to="/privacy" className="text-slate-400 hover:text-white font-medium transition-colors text-xs md:text-sm">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-slate-400 hover:text-white font-medium transition-colors text-xs md:text-sm">Terms of Service</Link></li>
                <li><Link to="/disclaimer" className="text-slate-400 hover:text-white font-medium transition-colors text-xs md:text-sm">Disclaimer</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* 🚀 COPYRIGHT */}
        <div className="border-t border-slate-800 pt-6 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest text-center md:text-left">
            &copy; {new Date().getFullYear()} Finledger OS. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-slate-600 text-[10px] md:text-xs font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></span> Systems Operational
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;