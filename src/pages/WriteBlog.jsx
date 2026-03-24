import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebaseConfig';
import { 
  collection, addDoc, serverTimestamp, getDocs, 
  query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  HiOutlineCheckCircle, HiOutlineCode, HiOutlineDocumentText,
  HiOutlinePencilAlt, HiOutlineTrash, HiOutlineCollection, HiOutlinePlus, HiOutlineViewGrid,
  HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineTemplate
} from 'react-icons/hi';
import { FaTelegramPlane, FaFacebookF, FaYoutube } from 'react-icons/fa';

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const categories = ["Tech & AI", "Crypto Strategies", "Wealth Management", "Platform Updates", "News"];

// 🚀 UPDATED WIDGET TEMPLATES (Added FB & YouTube)
const WIDGET_TYPES = {
  about: { type: 'about', title: 'About Me', name: '', role: '', bio: '', image: '' },
  facebook: { type: 'facebook', title: 'FB Page Like', fbUrl: 'https://www.facebook.com/facebook' }, // 🆕 NAYA
  youtube: { type: 'youtube', title: 'YT Subscribe', channelName: 'Google' }, // 🆕 NAYA
  telegram: { type: 'telegram', title: 'Live Updates', channel: 'bpcryptocraft' },
  html: { type: 'html', title: 'Custom Ad / Banner', content: '' },
  social: { type: 'social', title: 'Follow Us', fb: '', yt: '', linkedin: '', telegram: '' },
  tabs: { type: 'tabs', title: 'Recent & Popular (2-Columns)' },
  tags: { type: 'tags', title: 'Categories / Tags' },
  search: { type: 'search', title: 'Search Blog' },
  newsletter: { type: 'newsletter', title: 'Subscribe' }
};

const WriteBlog = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('write'); 
  const [adminPosts, setAdminPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [editingId, setEditingId] = useState(null); 

  const [formData, setFormData] = useState({ title: '', excerpt: '', category: categories[0], coverImage: '', tags: '' });
  const [editorMode, setEditorMode] = useState('rich'); 
  const [htmlCode, setHtmlCode] = useState(''); 
  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const editor = useCreateBlockNote();

  const [widgets, setWidgets] = useState([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setAdminPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Error:", error); } finally { setIsLoadingPosts(false); }
  };

  const fetchLayoutData = async () => {
    try {
      const layoutDoc = await getDoc(doc(db, 'settings', 'sidebarLayout'));
      if (layoutDoc.exists() && layoutDoc.data().widgets) {
        setWidgets(layoutDoc.data().widgets);
      } else {
        setWidgets([{ id: Date.now().toString(), ...WIDGET_TYPES.search }, { id: (Date.now()+1).toString(), ...WIDGET_TYPES.tabs }]);
      }
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchPosts();
    if (activeTab === 'layout') fetchLayoutData();
  }, [activeTab]);

  const addWidget = (type) => {
    const newWidget = { id: Date.now().toString(), ...WIDGET_TYPES[type] };
    setWidgets([...widgets, newWidget]);
  };

  const removeWidget = (id) => setWidgets(widgets.filter(w => w.id !== id));
  const moveWidget = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === widgets.length - 1)) return;
    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[index + direction];
    newWidgets[index + direction] = temp;
    setWidgets(newWidgets);
  };
  const updateWidget = (id, field, value) => setWidgets(widgets.map(w => w.id === id ? { ...w, [field]: value } : w));

  const handleSaveLayout = async (e) => {
    e.preventDefault();
    setIsSavingLayout(true);
    try {
      const safeWidgets = JSON.parse(JSON.stringify(widgets));
      await setDoc(doc(db, 'settings', 'sidebarLayout'), { widgets: safeWidgets });
      setSuccessMessage('Sidebar Widgets saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) { 
      if (error.code === 'permission-denied') alert("Firebase Permission Denied! Check Rules.");
      else alert(`Failed: ${error.message}`);
    } finally { setIsSavingLayout(false); }
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete "${title}"?`)) {
      await deleteDoc(doc(db, 'blogs', id));
      setAdminPosts(adminPosts.filter(post => post.id !== id));
    }
  };

  const handleEdit = async (post) => {
    setFormData({ title: post.title || '', excerpt: post.excerpt || '', category: post.category || categories[0], coverImage: post.coverImage || '', tags: post.tags ? post.tags.join(', ') : '' });
    setEditingId(post.id);
    if (post.content) {
      setHtmlCode(post.content);
      const blocks = await editor.tryParseHTMLToBlocks(post.content);
      editor.replaceBlocks(editor.document, blocks);
    }
    setEditorMode('rich'); setActiveTab('write'); window.scrollTo(0, 0);
  };

  const resetForm = () => {
    setFormData({ title: '', excerpt: '', category: categories[0], coverImage: '', tags: '' });
    setEditingId(null); setHtmlCode(''); editor.replaceBlocks(editor.document, [{ type: "paragraph" }]); 
    setEditorMode('rich'); setActiveTab('write');
  };

  const handleModeSwitch = async (targetMode) => {
    if (targetMode === 'html' && editorMode === 'rich') {
      const currentHtml = await editor.blocksToHTMLLossy(editor.document);
      setHtmlCode(currentHtml); setEditorMode('html');
    } else if (targetMode === 'rich' && editorMode === 'html') {
      const blocks = await editor.tryParseHTMLToBlocks(htmlCode);
      editor.replaceBlocks(editor.document, blocks); setEditorMode('rich');
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!user) return alert("Must be logged in.");
    setIsPublishing(true);
    try {
      let finalHTML = editorMode === 'rich' ? await editor.blocksToHTMLLossy(editor.document) : htmlCode;
      finalHTML = finalHTML.replace(/<video[^>]+src="([^"]+)"[^>]*>.*?<\/video>/gi, (match, src) => src.includes('youtube.com') || src.includes('youtu.be') ? `<iframe class="w-full aspect-video rounded-xl shadow-xl my-8 border border-slate-200 dark:border-slate-800" src="${src}" frameborder="0" allowfullscreen></iframe>` : match);
      finalHTML = finalHTML.replace(/\[DOWNLOAD:\s*(.*?)\s*\|\s*([^\]]+)\]/gi, (match, rawUrl, text) => `<div class="flex flex-col items-center justify-center my-6 w-full not-prose"><a href="${rawUrl.replace(/<[^>]+>/g, '').trim()}" target="_blank" class="group relative flex items-center justify-center gap-3 w-full sm:w-[80%] max-w-md px-4 py-4 bg-gradient-to-r from-[#2ecc71] via-[#27ae60] to-[#2980b9] text-white font-black text-sm md:text-base uppercase tracking-widest rounded-sm shadow-lg hover:-translate-y-0.5 transition-all border-b-4 border-[#1c5982] active:border-b-0 active:translate-y-1"><span class="text-yellow-400">⚡</span><span>${text.trim()}</span><span class="text-yellow-400">⚡</span></a></div>`);
      if (!finalHTML || finalHTML === '<p></p>') { setIsPublishing(false); return alert("Empty post."); }
      const postData = { title: formData.title, slug: formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''), excerpt: formData.excerpt, category: formData.category, coverImage: formData.coverImage, content: finalHTML, tags: formData.tags.split(',').map(t => t.trim()).filter(t => t !== ''), author: user.displayName || 'Admin', authorEmail: user.email, authorId: user.uid, updatedAt: serverTimestamp() };
      if (editingId) { await updateDoc(doc(db, 'blogs', editingId), postData); setSuccessMessage('Updated!'); } 
      else { postData.views = 0; postData.createdAt = serverTimestamp(); await addDoc(collection(db, 'blogs'), postData); setSuccessMessage('Published!'); }
      setTimeout(() => { setSuccessMessage(''); resetForm(); setActiveTab('manage'); }, 2000);
    } catch (error) { alert("Failed."); } finally { setIsPublishing(false); }
  };

  const isDarkMode = document.documentElement.classList.contains('dark');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Finledger Studio</h1>
            <p className="text-slate-500 font-medium mt-1">Premium Publishing Dashboard.</p>
          </div>
          <div className="flex flex-wrap bg-slate-200 dark:bg-slate-800 p-1 rounded-xl shrink-0 gap-1">
            <button onClick={() => { setActiveTab('write'); if(!editingId) resetForm(); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'write' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}><HiOutlinePencilAlt size={18}/> Write</button>
            <button onClick={() => setActiveTab('manage')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'manage' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500'}`}><HiOutlineCollection size={18} /> Manage</button>
            <button onClick={() => setActiveTab('layout')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'layout' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}><HiOutlineTemplate size={18} /> Dynamic Layout</button>
          </div>
        </div>

        {successMessage && <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center gap-2 font-bold animate-in fade-in"><HiOutlineCheckCircle size={24} /> {successMessage}</div>}

        {/* WRITE TAB */}
        {activeTab === 'write' && (
          <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
             <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-transparent border-none text-slate-900 dark:text-white outline-none font-black text-3xl md:text-5xl mb-6 placeholder:text-slate-300 dark:placeholder:text-slate-700" placeholder="Post Title..." />
                <div className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <div className="flex justify-between gap-4 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase"><span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Syntax: [DOWNLOAD: url | text]</span></p>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <button type="button" onClick={() => handleModeSwitch('rich')} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${editorMode === 'rich' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-500'}`}>Rich</button>
                      <button type="button" onClick={() => handleModeSwitch('html')} className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${editorMode === 'html' ? 'bg-white dark:bg-slate-700 text-amber-600' : 'text-slate-500'}`}>HTML</button>
                    </div>
                  </div>
                  <div className="min-h-[400px]">{editorMode === 'rich' ? <BlockNoteView editor={editor} theme={isDarkMode ? 'dark' : 'light'} /> : <textarea required rows="18" value={htmlCode} onChange={e => setHtmlCode(e.target.value)} className="w-full p-5 rounded-2xl bg-slate-900 text-amber-400 font-mono text-sm border-slate-800 outline-none focus:ring-2 focus:ring-amber-500"></textarea>}</div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 sticky top-24">
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl font-bold outline-none">{categories.map(cat => <option key={cat}>{cat}</option>)}</select>
                <input type="url" placeholder="Cover Image URL" value={formData.coverImage} onChange={e => setFormData({...formData, coverImage: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl text-sm outline-none" />
                <textarea required rows="3" placeholder="Short Excerpt" value={formData.excerpt} onChange={e => setFormData({...formData, excerpt: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl text-sm resize-none outline-none"></textarea>
                <input type="text" placeholder="Tags (comma separated)" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-4 rounded-2xl text-sm outline-none" />
                <button type="submit" disabled={isPublishing} className="w-full p-4 text-white rounded-2xl font-black text-sm uppercase bg-blue-600 hover:bg-blue-700 disabled:opacity-70">{isPublishing ? 'Saving...' : 'Publish Post'}</button>
              </div>
            </div>
          </form>
        )}

        {/* MANAGE POSTS TAB */}
        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
             <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminPosts.length === 0 && <div className="p-20 text-center"><p className="text-slate-500 font-bold mb-4">No posts published yet.</p></div>}
                {adminPosts.map((post) => (
                  <div key={post.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {post.coverImage ? <img src={post.coverImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-300">N/A</div>}
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{post.category}</span>
                        <h4 className="text-base font-black text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1">{post.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleEdit(post)} className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl transition-all hover:bg-blue-100"><HiOutlinePencilAlt size={18} /></button>
                      <button onClick={() => handleDelete(post.id, post.title)} className="p-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-xl transition-all hover:bg-rose-100"><HiOutlineTrash size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* DYNAMIC WIDGET BUILDER TAB */}
        {activeTab === 'layout' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-6 md:p-8 rounded-[2rem] mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-amber-800 dark:text-amber-500 mb-2 flex items-center gap-2"><HiOutlineTemplate size={24} /> Dynamic Sidebar Builder</h2>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Build your sidebar just like Blogger. Drag widgets up or down to reorder!</p>
              </div>
            </div>

            {/* ADD WIDGET BUTTONS */}
            <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-900 dark:text-white w-full mb-2">➕ Add a New Gadget:</span>
              {Object.keys(WIDGET_TYPES).map(type => (
                <button key={type} type="button" onClick={() => addWidget(type)} className="px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm">
                  + {WIDGET_TYPES[type].title}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveLayout} className="space-y-6">
              {widgets.map((widget, index) => (
                <div key={widget.id} className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row relative transition-all hover:border-blue-400">
                  
                  {/* WIDGET CONTROLS */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:w-24 flex md:flex-col items-center justify-center gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                    <div className="flex md:flex-col gap-2">
                      <button type="button" onClick={() => moveWidget(index, -1)} disabled={index === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600"><HiOutlineChevronUp size={16}/></button>
                      <button type="button" onClick={() => moveWidget(index, 1)} disabled={index === widgets.length - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600"><HiOutlineChevronDown size={16}/></button>
                    </div>
                    <button type="button" onClick={() => removeWidget(widget.id)} className="p-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-colors ml-auto md:ml-0"><HiOutlineTrash size={16}/></button>
                  </div>

                  {/* WIDGET FORMS */}
                  <div className="p-6 flex-1">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{widget.title} <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded ml-2">{widget.type}</span></h3>
                    </div>

                    {widget.type === 'about' && (
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Name" value={widget.name || ''} onChange={e => updateWidget(widget.id, 'name', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="text" placeholder="Role" value={widget.role || ''} onChange={e => updateWidget(widget.id, 'role', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="Image URL" value={widget.image || ''} onChange={e => updateWidget(widget.id, 'image', e.target.value)} className="col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <textarea placeholder="Short Bio" rows="2" value={widget.bio || ''} onChange={e => updateWidget(widget.id, 'bio', e.target.value)} className="col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none"></textarea>
                      </div>
                    )}

                    {/* 🚀 NAYA: FACEBOOK WIDGET */}
                    {widget.type === 'facebook' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title (e.g. FB Likes)" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Facebook Page URL</label>
                          <input type="url" placeholder="https://www.facebook.com/yourpage" value={widget.fbUrl || ''} onChange={e => updateWidget(widget.id, 'fbUrl', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        </div>
                      </div>
                    )}

                    {/* 🚀 NAYA: YOUTUBE WIDGET */}
                    {widget.type === 'youtube' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title (e.g. YT Subscribe)" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">YouTube Channel ID or Name (e.g. Google)</label>
                          <input type="text" placeholder="Google" value={widget.channelName || ''} onChange={e => updateWidget(widget.id, 'channelName', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        </div>
                      </div>
                    )}

                    {widget.type === 'telegram' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Telegram Username</label>
                          <div className="flex items-center">
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-r-0 text-slate-500 p-3 rounded-l-xl text-sm">t.me/</span>
                            <input type="text" placeholder="bpcryptocraft" value={widget.channel || ''} onChange={e => updateWidget(widget.id, 'channel', e.target.value.replace('https://t.me/', '').replace('t.me/', '').replace('/', ''))} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-r-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono" />
                          </div>
                        </div>
                      </div>
                    )}

                    {widget.type === 'html' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title (Optional)" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <textarea placeholder='Paste HTML here...' rows="4" value={widget.content || ''} onChange={e => updateWidget(widget.id, 'content', e.target.value)} className="w-full bg-slate-900 text-amber-400 p-4 rounded-xl text-xs font-mono outline-none border border-slate-800 custom-scrollbar"></textarea>
                      </div>
                    )}

                    {widget.type === 'social' && (
                      <div className="grid grid-cols-2 gap-4">
                        <input type="url" placeholder="Facebook URL" value={widget.fb || ''} onChange={e => updateWidget(widget.id, 'fb', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="YouTube URL" value={widget.yt || ''} onChange={e => updateWidget(widget.id, 'yt', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="LinkedIn URL" value={widget.linkedin || ''} onChange={e => updateWidget(widget.id, 'linkedin', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="Telegram URL" value={widget.telegram || ''} onChange={e => updateWidget(widget.id, 'telegram', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    )}

                    {['tabs', 'tags', 'search', 'newsletter'].includes(widget.type) && (
                       <p className="text-xs font-bold text-slate-400">This widget runs automatically. You can drag to reorder or delete it.</p>
                    )}

                  </div>
                </div>
              ))}

              {widgets.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No widgets added. Start building your sidebar!</p>
                </div>
              )}

              {widgets.length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <button type="submit" disabled={isSavingLayout} className="w-full md:w-auto px-10 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:-translate-y-1 transition-all disabled:opacity-70 flex items-center justify-center gap-2">
                    {isSavingLayout ? 'Saving...' : <><HiOutlineCheckCircle size={20}/> Save Layout Settings</>}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default WriteBlog;