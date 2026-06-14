import React, { useState } from 'react';
import { HiOutlineMail, HiOutlineChatAlt2, HiOutlinePaperAirplane } from 'react-icons/hi';
import { FaTelegramPlane, FaUsers } from 'react-icons/fa';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // 🚀 FORM SUBMIT LOGIC
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    // 💡 PRO TIP: To actually send emails to vivekpoudel222@gmail.com, 
    // you can use Web3Forms (https://web3forms.com/). It's free and easy!
    // Just replace this simulation with their fetch API code.
    
    // Simulating an API call for the UI
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      
      // Reset success message after 4 seconds
      setTimeout(() => setIsSent(false), 4000);
    }, 1500);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen pt-24 pb-24 animate-in fade-in duration-700">
      
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        
        {/* 🚀 HEADER SECTION */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest mb-6 border border-blue-200 dark:border-blue-800 shadow-sm">
            <HiOutlineChatAlt2 size={16} /> Get In Touch
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter mb-4">
            We'd love to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">hear from you.</span>
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
            Send us a message using the form, or reach out directly via Email or Telegram.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* 🚀 LEFT COLUMN: DIRECT CARDS */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Direct Email Card */}
            <a href="mailto:vivekpoudel222@gmail.com" className="group block bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all"></div>
              <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner group-hover:scale-110 transition-transform">
                <HiOutlineMail />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Email Us</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-4">Drop us an email. We usually reply within a few hours.</p>
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-widest uppercase">vivekpoudel222@gmail.com</span>
            </a>

            {/* Telegram Community Card */}
            <a href="https://t.me/cryptoandexpensestracker" target="_blank" rel="noopener noreferrer" className="group block bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden border border-blue-500/50 text-white">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
              <div className="relative z-10 w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-inner border border-white/20 group-hover:scale-110 transition-transform">
                <FaTelegramPlane />
              </div>
              <h3 className="text-xl font-black mb-2 relative z-10">Telegram Community</h3>
              <p className="text-sm text-blue-100 font-medium mb-4 relative z-10">Join our group for live updates and instant help from other members.</p>
              <span className="text-xs font-black text-white tracking-widest uppercase flex items-center gap-2 relative z-10">Join Chat <FaUsers size={14}/></span>
            </a>

          </div>

          {/* 🚀 RIGHT COLUMN: CONTACT FORM */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-8">Send a Message</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Your Name</label>
                  <input 
                    type="text" required 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium" 
                    placeholder="John Doe" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <input 
                    type="email" required 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium" 
                    placeholder="john@example.com" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Subject</label>
                <input 
                  type="text" required 
                  value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} 
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium" 
                  placeholder="How can we help?" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Message</label>
                <textarea 
                  required rows="5" 
                  value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} 
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all resize-none custom-scrollbar font-medium" 
                  placeholder="Describe your issue or feedback..."
                ></textarea>
              </div>

              <button 
                type="submit" 
                disabled={isSending || isSent}
                className={`w-full p-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  isSent ? 'bg-emerald-500 border-emerald-500 shadow-emerald-500/20' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20'
                } disabled:opacity-80`}
              >
                {isSending ? (
                  <span className="animate-pulse">Sending...</span>
                ) : isSent ? (
                  'Message Sent Successfully! 🎉'
                ) : (
                  <>Send Message <HiOutlinePaperAirplane className="rotate-90" size={18} /></>
                )}
              </button>
            </form>

          </div>

        </div>

      </div>
    </div>
  );
};

export default Contact;