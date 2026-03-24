import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase/firebaseConfig';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc 
} from 'firebase/firestore';

import { 
  HiOutlineChatAlt2, HiOutlinePlus, HiOutlinePaperAirplane, 
  HiOutlineTicket, HiOutlineCheckCircle, HiOutlineClock
} from 'react-icons/hi';
import { FaRobot, FaUserCircle } from 'react-icons/fa';

const Support = () => {
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const chatEndRef = useRef(null);

  // 1️⃣ FETCH USER'S TICKETS
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "supportTickets"), 
      where("userId", "==", user.uid), 
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // 2️⃣ FETCH MESSAGES FOR ACTIVE TICKET
  useEffect(() => {
    if (!activeTicket) return;
    const q = query(
      collection(db, "supportTickets", activeTicket.id, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [activeTicket]);

  // 🚀 EMAIL NOTIFICATION TRIGGER (Pseudo-code for EmailJS / Backend)
  const notifyAdminViaEmail = async (subject, messageText) => {
    // 💡 NOTE: To make this work, create a free account on EmailJS.com
    // and replace this fetch with emailjs.send()
    /*
      emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
        admin_email: "vivekpoudel222@gmail.com",
        user_email: user.email,
        subject: subject,
        message: messageText
      }, "YOUR_PUBLIC_KEY");
    */
    console.log(`Email sent to vivekpoudel222@gmail.com: New Ticket - ${subject}`);
  };

  // 3️⃣ CREATE NEW TICKET
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim() || !user) return;
    setIsSending(true);

    try {
      // Create Ticket Document
      const ticketRef = await addDoc(collection(db, "supportTickets"), {
        userId: user.uid,
        userEmail: user.email,
        subject: newSubject,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add First Message to Subcollection
      await addDoc(collection(db, "supportTickets", ticketRef.id, "messages"), {
        sender: 'user',
        text: newMessage,
        timestamp: serverTimestamp()
      });

      // Trigger Email to Admin
      notifyAdminViaEmail(`New Support Ticket: ${newSubject}`, newMessage);

      setNewSubject('');
      setNewMessage('');
      setIsCreating(false);
      setActiveTicket({ id: ticketRef.id, subject: newSubject, status: 'open' });
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("Failed to submit ticket.");
    } finally {
      setIsSending(false);
    }
  };

  // 4️⃣ SEND CHAT MESSAGE
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeTicket || !user) return;
    
    const textToSend = chatInput;
    setChatInput(''); // Clear input immediately for UX

    try {
      await addDoc(collection(db, "supportTickets", activeTicket.id, "messages"), {
        sender: 'user',
        text: textToSend,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, "supportTickets", activeTicket.id), {
        updatedAt: serverTimestamp()
      });

      // Trigger Email Notification for Reply
      notifyAdminViaEmail(`Reply on Ticket: ${activeTicket.subject}`, textToSend);

    } catch (error) {
      console.error("Error sending message:", error);
      setChatInput(textToSend); // Revert on fail
    }
  };

  return (
    <div className="pt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-7xl mx-auto px-4 md:px-8 h-[calc(100vh-20px)] flex flex-col">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl ring-1 ring-blue-500/20 shadow-sm">
              <HiOutlineChatAlt2 size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Support Center</h1>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Open a ticket and chat directly with our team.</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => { setActiveTicket(null); setIsCreating(true); }}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95"
        >
          <HiOutlinePlus size={20} /> New Ticket
        </button>
      </div>

      {/* 🚀 MAIN CONTENT AREA (GRID) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
        
        {/* LEFT COLUMN: TICKET LIST */}
        <div className="lg:col-span-1 flex flex-col h-full overflow-hidden border-r border-slate-100 dark:border-slate-800 pr-0 lg:pr-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-2">Your Tickets</h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {tickets.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 mt-4">
                <HiOutlineTicket className="mx-auto text-4xl text-slate-300 dark:text-slate-600 mb-2"/>
                <p className="text-xs font-bold text-slate-500">No active tickets.</p>
              </div>
            ) : (
              tickets.map(ticket => (
                <button 
                  key={ticket.id}
                  onClick={() => { setIsCreating(false); setActiveTicket(ticket); }}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${activeTicket?.id === ticket.id ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 shadow-sm' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${ticket.status === 'closed' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <h4 className={`font-bold text-sm truncate ${activeTicket?.id === ticket.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {ticket.subject}
                  </h4>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CHAT INTERFACE OR CREATE FORM */}
        <div className="lg:col-span-2 flex flex-col h-full overflow-hidden relative">
          
          {isCreating ? (
            /* --- CREATE NEW TICKET FORM --- */
            <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in zoom-in-95">
              <div className="max-w-xl mx-auto">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center text-2xl mb-6">
                  <HiOutlineTicket />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">How can we help?</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">Our support team will reply to your registered email and inside this chat.</p>
                
                <form onSubmit={handleCreateTicket} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Subject</label>
                    <input 
                      type="text" 
                      required 
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="e.g., Cannot connect wallet" 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Message</label>
                    <textarea 
                      required 
                      rows="5"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Describe your issue..." 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all resize-none custom-scrollbar" 
                    />
                  </div>
                  <button type="submit" disabled={isSending} className="w-full p-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-70 flex justify-center items-center">
                    {isSending ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </form>
              </div>
            </div>
          ) : activeTicket ? (
            /* --- CHAT HISTORY INTERFACE --- */
            <div className="flex flex-col h-full w-full">
              {/* Chat Header */}
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0 px-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white line-clamp-1">{activeTicket.subject}</h3>
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-1">
                  Ticket ID: #{activeTicket.id.slice(0,6).toUpperCase()}
                </p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      
                      {/* Avatar */}
                      <div className="shrink-0 mt-auto">
                        {msg.sender === 'user' ? (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500"><FaUserCircle size={20}/></div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center"><FaRobot size={16}/></div>
                        )}
                      </div>

                      {/* Bubble */}
                      <div className={`p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-sm shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-700 shadow-sm'}`}>
                        <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                      </div>

                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              {activeTicket.status === 'closed' ? (
                <div className="p-4 mt-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center shrink-0">
                  <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1"><HiOutlineCheckCircle/> This ticket has been closed.</p>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="pt-4 shrink-0 px-2 relative">
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your reply..." 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white pl-5 pr-16 py-4 rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder:text-slate-400"
                  />
                  <button 
                    type="submit" 
                    disabled={!chatInput.trim()}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                  >
                    <HiOutlinePaperAirplane size={20} className="rotate-90" />
                  </button>
                </form>
              )}

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center opacity-60">
              <HiOutlineChatAlt2 size={64} className="mb-4 text-slate-300 dark:text-slate-700"/>
              <p className="font-bold">Select a ticket to view history</p>
              <p className="text-xs mt-1">Or create a new one to reach support.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Support;