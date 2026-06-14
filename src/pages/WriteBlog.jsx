import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebaseConfig';
import {
  collection, addDoc, serverTimestamp, getDocs,
  query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, where
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  HiOutlineCheckCircle, HiOutlineCode, HiOutlineDocumentText,
  HiOutlinePencilAlt, HiOutlineTrash, HiOutlineCollection, HiOutlinePlus, HiOutlineViewGrid,
  HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineTemplate, HiOutlineShieldExclamation,
  HiOutlineExclamationCircle, HiOutlineInformationCircle
} from 'react-icons/hi';
import { FaTelegramPlane, FaFacebookF, FaYoutube } from 'react-icons/fa';
import { Navigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  validateBlogData,
  generateSlugFromTitle,
  sanitizeSlug,
  checkContentWarnings,
  VALID_CATEGORIES
} from '../utils/blogValidation';

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const categories = VALID_CATEGORIES;

const WIDGET_TYPES = {
  about: { type: 'about', title: 'About Me', name: '', role: '', bio: '', image: '' },
  facebook: { type: 'facebook', title: 'FB Page Like', fbUrl: 'https://www.facebook.com/facebook' },
  youtube: { type: 'youtube', title: 'YT Subscribe', channelName: 'Google' },
  telegram: { type: 'telegram', title: 'Live Updates', channel: 'bpcryptocraft' },
  html: { type: 'html', title: 'Custom Ad / Banner', content: '' },
  social: { type: 'social', title: 'Follow Us', fb: '', yt: '', linkedin: '', telegram: '' },
  tabs: { type: 'tabs', title: 'Recent & Popular (2-Columns)' },
  tags: { type: 'tags', title: 'Categories / Tags' },
  search: { type: 'search', title: 'Search Blog' },
  newsletter: { type: 'newsletter', title: 'Subscribe' }
};

// ============================================
// ✅ VALIDATION ALERT COMPONENT
// ============================================
const ValidationAlert = ({ type = 'error', title, messages, onClose }) => {
  const bgColor = type === 'error' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-amber-50 dark:bg-amber-500/10';
  const borderColor = type === 'error' ? 'border-rose-200 dark:border-rose-500/20' : 'border-amber-200 dark:border-amber-500/20';
  const textColor = type === 'error' ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200';
  const titleColor = type === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300';
  const Icon = type === 'error' ? HiOutlineExclamationCircle : HiOutlineInformationCircle;

  return (
    <div className={`mb-6 p-4 ${bgColor} border ${borderColor} rounded-2xl animate-in fade-in ${textColor}`}>
      <div className="flex gap-3">
        <Icon size={24} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className={`font-black ${titleColor} mb-2`}>{title}</h4>
          <ul className="space-y-1 text-sm font-medium">
            {messages.map((msg, i) => (
              <li key={i} className="flex gap-2">
                <span>•</span>
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-lg font-black opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// 🚀 MAIN COMPONENT
// ============================================
const WriteBlog = () => {
  const { user, isAdmin } = useAuth();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // ✅ Admin guard
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800">
          <HiOutlineShieldExclamation className="mx-auto text-6xl text-rose-500 mb-4" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-500">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  // ============================================
  // STATE
  // ============================================
  const [activeTab, setActiveTab] = useState('write');
  const [adminPosts, setAdminPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    category: categories[0],
    coverImage: '',
    tags: ''
  });
  const [editorMode, setEditorMode] = useState('rich');
  const [htmlCode, setHtmlCode] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const editor = useCreateBlockNote();

  const [widgets, setWidgets] = useState([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  // ✅ NEW: Validation errors and warnings
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [contentWarnings, setContentWarnings] = useState([]);

  // ============================================
  // FETCH FUNCTIONS
  // ============================================
  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setAdminPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('[WriteBlog] Error fetching posts:', error);
      alert('Failed to load posts. Check console for details.');
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const fetchLayoutData = async () => {
    try {
      const layoutDoc = await getDoc(doc(db, 'settings', 'sidebarLayout'));
      if (layoutDoc.exists() && layoutDoc.data().widgets) {
        setWidgets(layoutDoc.data().widgets);
      } else {
        setWidgets([
          { id: Date.now().toString(), ...WIDGET_TYPES.search },
          { id: (Date.now() + 1).toString(), ...WIDGET_TYPES.tabs }
        ]);
      }
    } catch (error) {
      console.error('[WriteBlog] Error fetching layout:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchPosts();
    if (activeTab === 'layout') fetchLayoutData();
  }, [activeTab]);

  // ============================================
  // WIDGET FUNCTIONS
  // ============================================
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

  const updateWidget = (id, field, value) => {
    // ✅ Sanitize HTML widget content on input
    if (id && field === 'content' && typeof value === 'string') {
      const sanitized = DOMPurify.sanitize(value, { ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'img', 'a', 'b', 'i', 'u', 'strong', 'em'], ALLOWED_ATTR: ['src', 'href', 'class', 'style', 'alt', 'title'] });
      setWidgets(widgets.map(w => w.id === id ? { ...w, [field]: sanitized } : w));
    } else {
      setWidgets(widgets.map(w => w.id === id ? { ...w, [field]: value } : w));
    }
  };

  const handleSaveLayout = async (e) => {
    e.preventDefault();
    setIsSavingLayout(true);
    try {
      const safeWidgets = JSON.parse(JSON.stringify(widgets));
      await setDoc(doc(db, 'settings', 'sidebarLayout'), { widgets: safeWidgets });
      setSuccessMessage('✅ Sidebar Widgets saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[WriteBlog] Save layout error:', error);
      if (error.code === 'permission-denied') {
        alert('❌ Firebase Permission Denied! Check Firestore Rules.');
      } else {
        alert(`❌ Failed: ${error.message}`);
      }
    } finally {
      setIsSavingLayout(false);
    }
  };

  // ============================================
  // BLOG CRUD FUNCTIONS
  // ============================================
  const handleDelete = async (id, title) => {
    const confirmed = window.confirm(
      `⚠️ Delete blog: "${title}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const previousPosts = adminPosts;

    try {
      // ✅ Optimistic update (remove from UI immediately)
      setAdminPosts(adminPosts.filter(post => post.id !== id));

      // Delete from Firebase
      await deleteDoc(doc(db, 'blogs', id));

      setSuccessMessage(`✅ "${title}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      console.log('[WriteBlog] Blog deleted:', id);
    } catch (error) {
      console.error('[WriteBlog] Delete failed:', error);

      // ✅ Rollback on error
      setAdminPosts(previousPosts);
      alert(`❌ Failed to delete: ${error.message}`);
    }
  };

  const handleEdit = async (post) => {
    try {
      setFormData({
        title: post.title || '',
        excerpt: post.excerpt || '',
        category: post.category || categories[0],
        coverImage: post.coverImage || '',
        tags: post.tags ? post.tags.join(', ') : ''
      });
      setEditingId(post.id);

      if (post.content) {
        setHtmlCode(post.content);

        // ✅ Wait for editor to be ready
        if (editor && editor.document) {
          const blocks = await editor.tryParseHTMLToBlocks(post.content);
          editor.replaceBlocks(editor.document, blocks);
        }
      }

      setEditorMode('rich');
      setActiveTab('write');
      setValidationErrors([]);
      setValidationWarnings([]);

      // ✅ Wait for DOM update
      await new Promise(r => setTimeout(r, 100));
      window.scrollTo(0, 0);
      console.log('[WriteBlog] Editing blog:', post.id);
    } catch (error) {
      console.error('[WriteBlog] Edit error:', error);
      alert('Failed to load blog for editing. Check console.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      excerpt: '',
      category: categories[0],
      coverImage: '',
      tags: ''
    });
    setEditingId(null);
    setHtmlCode('');
    editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
    setEditorMode('rich');
    setActiveTab('write');
    setValidationErrors([]);
    setValidationWarnings([]);
    setContentWarnings([]);
  };

  const handleModeSwitch = async (targetMode) => {
    try {
      if (targetMode === 'html' && editorMode === 'rich') {
        const currentHtml = await editor.blocksToHTMLLossy(editor.document);
        setHtmlCode(currentHtml);
        setEditorMode('html');
      } else if (targetMode === 'rich' && editorMode === 'html') {
        const blocks = await editor.tryParseHTMLToBlocks(htmlCode);
        editor.replaceBlocks(editor.document, blocks);
        setEditorMode('rich');
      }
    } catch (error) {
      console.error('[WriteBlog] Mode switch error:', error);
      alert('Failed to switch editor mode. Check console.');
    }
  };

  // ============================================
  // ✅ GENERATE UNIQUE SLUG
  // ============================================
  const generateUniqueSlug = async (baseSlug, excludeId = null) => {
    let slug = sanitizeSlug(baseSlug);
    let counter = 1;

    while (true) {
      try {
        // Build query
        let q = query(
          collection(db, 'blogs'),
          where('slug', '==', slug)
        );

        const result = await getDocs(q);

        // Check if slug exists
        const exists = result.docs.some(doc => doc.id !== excludeId);

        if (!exists) {
          return slug;
        }

        // Append counter
        slug = `${sanitizeSlug(baseSlug)}-${counter}`;
        counter++;

        // Safety limit
        if (counter > 100) {
          throw new Error('Could not generate unique slug after 100 attempts');
        }
      } catch (error) {
        console.error('[WriteBlog] Slug generation error:', error);
        throw error;
      }
    }
  };

  // ============================================
  // ✅ PUBLISH HANDLER WITH FULL VALIDATION
  // ============================================
  const handlePublish = async (e) => {
    e.preventDefault();

    if (!user) {
      alert('❌ Must be logged in.');
      return;
    }

    setIsPublishing(true);
    setValidationErrors([]);
    setValidationWarnings([]);

    try {
      // 1. Generate final HTML
      let finalHTML = editorMode === 'rich'
        ? await editor.blocksToHTMLLossy(editor.document)
        : htmlCode;

      // 2. Transform video tags to iframes
      finalHTML = finalHTML.replace(
        /<video[^>]+src="([^"]+)"[^>]*>.*?<\/video>/gi,
        (match, src) => src.includes('youtube.com') || src.includes('youtu.be')
          ? `<iframe class="w-full aspect-video rounded-xl shadow-xl my-8 border border-slate-200 dark:border-slate-800" src="${src}" frameborder="0" allowfullscreen></iframe>`
          : match
      );

      // 3. Transform download syntax
      finalHTML = finalHTML.replace(
        /\[DOWNLOAD:\s*(.*?)\s*\|\s*([^\]]+)\]/gi,
        (match, rawUrl, text) => {
          const cleanUrl = rawUrl.replace(/<[^>]+>/g, '').trim();
          const cleanText = text.trim();
          return `<div class="flex flex-col items-center justify-center my-6 w-full not-prose"><a href="${cleanUrl}" target="_blank" class="group relative flex items-center justify-center gap-3 w-full sm:w-[80%] max-w-md px-4 py-4 bg-gradient-to-r from-[#2ecc71] via-[#27ae60] to-[#2980b9] text-white font-black text-sm md:text-base uppercase tracking-widest rounded-sm shadow-lg hover:-translate-y-0.5 transition-all border-b-4 border-[#1c5982] active:border-b-0 active:translate-y-1"><span class="text-yellow-400">⚡</span><span>${cleanText}</span><span class="text-yellow-400">⚡</span></a></div>`;
        }
      );

      // 4. ✅ Sanitize final HTML to prevent XSS
      finalHTML = DOMPurify.sanitize(finalHTML);

      if (!finalHTML || finalHTML === '<p></p>') {
        setIsPublishing(false);
        alert('❌ Content cannot be empty.');
        return;
      }

      // 5. Parse tags
      const tags = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t !== '');

      // 6. Generate slug
      const baseSlug = generateSlugFromTitle(formData.title);
      const finalSlug = await generateUniqueSlug(baseSlug, editingId);

      // 7. Create post data
      const postData = {
        title: formData.title.trim(),
        slug: finalSlug,
        excerpt: formData.excerpt.trim(),
        category: formData.category,
        coverImage: formData.coverImage.trim(),
        content: finalHTML,
        tags: tags,
        author: user.displayName || 'Admin',
        authorEmail: user.email,
        authorId: user.uid,
        status: 'published',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      };

      // 8. ✅ VALIDATE ALL DATA
      const validation = validateBlogData(postData);

      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setIsPublishing(false);
        window.scrollTo(0, 0);
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        setValidationWarnings(validation.warnings);
      }

      // Check content quality warnings
      const contentWarns = checkContentWarnings(finalHTML);
      if (contentWarns.length > 0) {
        setContentWarnings(contentWarns);
      }

      // 9. Save to Firebase
      if (editingId) {
        // ✅ Lock creation metadata
        await updateDoc(doc(db, 'blogs', editingId), {
          ...postData,
          createdAt: (await getDoc(doc(db, 'blogs', editingId))).data().createdAt
        });
        setSuccessMessage('✅ Blog Updated Successfully!');
        console.log('[WriteBlog] Blog updated:', editingId);
      } else {
        // New blog
        postData.createdAt = serverTimestamp();
        postData.createdBy = user.uid;
        postData.views = 0;

        const docRef = await addDoc(collection(db, 'blogs'), postData);
        setSuccessMessage('✅ Blog Published Successfully!');
        console.log('[WriteBlog] Blog published:', docRef.id);
      }

      // Reset form
      setTimeout(() => {
        setSuccessMessage('');
        resetForm();
        setActiveTab('manage');
      }, 2000);
    } catch (error) {
      console.error('[WriteBlog] Publish error:', {
        userId: user.uid,
        blogTitle: formData.title,
        errorCode: error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });

      let userMessage = '❌ Failed to publish blog.';
      if (error.code === 'permission-denied') {
        userMessage = '❌ Permission denied. Check your admin status or Firestore rules.';
      } else if (error.code === 'failed-precondition') {
        userMessage = '❌ Firebase not configured properly. Contact support.';
      } else if (error.message.includes('timeout')) {
        userMessage = '❌ Request timed out. Try again.';
      } else if (error.message.includes('slug')) {
        userMessage = '❌ Error with blog slug. Try a different title.';
      }

      alert(userMessage);
    } finally {
      setIsPublishing(false);
    }
  };

  // ============================================
  // ✅ UNSAVED CHANGES WARNING
  // ============================================
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const currentContent = editorMode === 'rich'
        ? editor?.document?.length > 0
        : htmlCode.trim().length > 0;

      if (currentContent && activeTab === 'write' && !successMessage) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Leave anyway?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formData, htmlCode, editorMode, activeTab, editor, successMessage]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-20 sm:pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Finledger Studio
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Premium Publishing Dashboard.</p>
          </div>
          <div className="flex flex-wrap bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
            <button
              onClick={() => { setActiveTab('write'); if (!editingId) resetForm(); }}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'write'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <HiOutlinePencilAlt size={18} /> Write
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'manage'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <HiOutlineCollection size={18} /> Manage
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                activeTab === 'layout'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <HiOutlineTemplate size={18} /> Layout
            </button>
          </div>
        </div>

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center gap-2 font-bold animate-in fade-in">
            <HiOutlineCheckCircle size={24} /> {successMessage}
          </div>
        )}

        {/* VALIDATION ERRORS */}
        {validationErrors.length > 0 && (
          <ValidationAlert
            type="error"
            title="Validation Errors"
            messages={validationErrors}
            onClose={() => setValidationErrors([])}
          />
        )}

        {/* VALIDATION WARNINGS */}
        {validationWarnings.length > 0 && (
          <ValidationAlert
            type="warning"
            title="Validation Warnings"
            messages={validationWarnings}
            onClose={() => setValidationWarnings([])}
          />
        )}

        {/* CONTENT WARNINGS */}
        {contentWarnings.length > 0 && (
          <ValidationAlert
            type="warning"
            title="Content Quality Tips"
            messages={contentWarnings}
            onClose={() => setContentWarnings([])}
          />
        )}

        {/* ========================================
            WRITE TAB
            ======================================== */}
        {activeTab === 'write' && (
          <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 animate-in fade-in">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-10 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-white outline-none font-black text-2xl sm:text-3xl md:text-5xl mb-6 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  placeholder="Post Title..."
                />
                <div className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                        Syntax: [DOWNLOAD: url | text]
                      </span>
                    </p>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('rich')}
                        className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${
                          editorMode === 'rich'
                            ? 'bg-white dark:bg-slate-700 text-blue-600'
                            : 'text-slate-500'
                        }`}
                      >
                        Rich
                      </button>
                      <button
                        type="button"
                        onClick={() => handleModeSwitch('html')}
                        className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase ${
                          editorMode === 'html'
                            ? 'bg-white dark:bg-slate-700 text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        HTML
                      </button>
                    </div>
                  </div>
                  <div className="min-h-[300px] sm:min-h-[400px]">
                    {editorMode === 'rich' ? (
                      <BlockNoteView editor={editor} theme={isDarkMode ? 'dark' : 'light'} />
                    ) : (
                      <textarea
                        required
                        rows="18"
                        value={htmlCode}
                        onChange={e => setHtmlCode(e.target.value)}
                        className="w-full p-5 rounded-2xl bg-slate-900 text-amber-400 font-mono text-sm border-slate-800 outline-none focus:ring-2 focus:ring-amber-500 border"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 sticky top-24">
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl font-bold outline-none text-sm"
                  >
                    {categories.map(cat => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Cover Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.coverImage}
                    onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Excerpt *
                  </label>
                  <textarea
                    required
                    rows="3"
                    placeholder="Brief summary of the post"
                    value={formData.excerpt}
                    onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm resize-none outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="react, javascript, web"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPublishing}
                  className="w-full p-3 sm:p-4 text-white rounded-2xl font-black text-sm uppercase bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors disabled:cursor-not-allowed"
                >
                  {isPublishing ? '⏳ Publishing...' : '✅ Publish Post'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-full p-3 sm:p-4 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* ========================================
            MANAGE POSTS TAB
            ======================================== */}
        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
            {isLoadingPosts ? (
              <div className="p-20 text-center">
                <p className="text-slate-400 font-bold">Loading posts...</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminPosts.length === 0 && (
                  <div className="p-20 text-center">
                    <p className="text-slate-500 font-bold mb-4">No posts published yet.</p>
                  </div>
                )}
                {adminPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {post.coverImage ? (
                          <img src={post.coverImage} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-300">
                            N/A
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                          {post.category}
                        </span>
                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1">
                          {post.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleEdit(post)}
                        className="p-2 sm:p-3 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl transition-all hover:bg-blue-100 dark:hover:bg-blue-500/20"
                        title="Edit blog"
                      >
                        <HiOutlinePencilAlt size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id, post.title)}
                        className="p-2 sm:p-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-xl transition-all hover:bg-rose-100 dark:hover:bg-rose-500/20"
                        title="Delete blog"
                      >
                        <HiOutlineTrash size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================
            LAYOUT TAB
            ======================================== */}
        {activeTab === 'layout' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 sm:p-6 md:p-8 rounded-[2rem] mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-amber-800 dark:text-amber-500 mb-2 flex items-center gap-2">
                  <HiOutlineTemplate size={24} /> Dynamic Sidebar Builder
                </h2>
                <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">
                  Build your sidebar just like Blogger. Drag widgets up or down to reorder!
                </p>
              </div>
            </div>

            {/* ADD WIDGET BUTTONS */}
            <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-900 dark:text-white w-full mb-2">
                ➕ Add a New Gadget:
              </span>
              <div className="flex flex-wrap gap-2">
                {Object.keys(WIDGET_TYPES).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addWidget(type)}
                    className="px-3 py-2 sm:px-4 sm:py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] sm:text-xs font-black uppercase rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                  >
                    + {WIDGET_TYPES[type].title}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveLayout} className="space-y-6">
              {widgets.map((widget, index) => (
                <div
                  key={widget.id}
                  className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row relative transition-all hover:border-blue-400"
                >
                  {/* WIDGET CONTROLS */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 md:w-24 flex md:flex-col items-center justify-center gap-3 md:gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                    <div className="flex md:flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => moveWidget(index, -1)}
                        disabled={index === 0}
                        className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600"
                      >
                        <HiOutlineChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWidget(index, 1)}
                        disabled={index === widgets.length - 1}
                        className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600"
                      >
                        <HiOutlineChevronDown size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWidget(widget.id)}
                      className="p-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-colors md:mt-auto"
                    >
                      <HiOutlineTrash size={16} />
                    </button>
                  </div>

                  {/* WIDGET FORMS */}
                  <div className="p-4 sm:p-6 flex-1">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                        {widget.title}{' '}
                        <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded ml-2">
                          {widget.type}
                        </span>
                      </h3>
                    </div>

                    {/* About Widget */}
                    {widget.type === 'about' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <input
                          type="text"
                          placeholder="Name"
                          value={widget.name || ''}
                          onChange={e => updateWidget(widget.id, 'name', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Role"
                          value={widget.role || ''}
                          onChange={e => updateWidget(widget.id, 'role', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="url"
                          placeholder="Image URL"
                          value={widget.image || ''}
                          onChange={e => updateWidget(widget.id, 'image', e.target.value)}
                          className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <textarea
                          placeholder="Short Bio"
                          rows="2"
                          value={widget.bio || ''}
                          onChange={e => updateWidget(widget.id, 'bio', e.target.value)}
                          className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none"
                        />
                      </div>
                    )}

                    {/* Facebook Widget */}
                    {widget.type === 'facebook' && (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Widget Title (e.g. FB Likes)"
                          value={widget.title || ''}
                          onChange={e => updateWidget(widget.id, 'title', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                        />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                            Facebook Page URL
                          </label>
                          <input
                            type="url"
                            placeholder="https://www.facebook.com/yourpage"
                            value={widget.fbUrl || ''}
                            onChange={e => updateWidget(widget.id, 'fbUrl', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* YouTube Widget */}
                    {widget.type === 'youtube' && (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Widget Title (e.g. YT Subscribe)"
                          value={widget.title || ''}
                          onChange={e => updateWidget(widget.id, 'title', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                        />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                            YouTube Channel ID or Name
                          </label>
                          <input
                            type="text"
                            placeholder="Google"
                            value={widget.channelName || ''}
                            onChange={e => updateWidget(widget.id, 'channelName', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Telegram Widget */}
                    {widget.type === 'telegram' && (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Widget Title"
                          value={widget.title || ''}
                          onChange={e => updateWidget(widget.id, 'title', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                        />
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                            Telegram Username
                          </label>
                          <div className="flex items-center">
                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-r-0 text-slate-500 p-3 rounded-l-xl text-sm">
                              t.me/
                            </span>
                            <input
                              type="text"
                              placeholder="bpcryptocraft"
                              value={widget.channel || ''}
                              onChange={e =>
                                updateWidget(
                                  widget.id,
                                  'channel',
                                  e.target.value
                                    .replace('https://t.me/', '')
                                    .replace('t.me/', '')
                                    .replace('/', '')
                                )
                              }
                              className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-r-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* HTML Widget */}
                    {widget.type === 'html' && (
                      <div className="space-y-4">
                        <input
                          type="text"
                          placeholder="Widget Title (Optional)"
                          value={widget.title || ''}
                          onChange={e => updateWidget(widget.id, 'title', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                        />
                        <textarea
                          placeholder='Paste HTML here...'
                          rows="4"
                          value={widget.content || ''}
                          onChange={e => updateWidget(widget.id, 'content', e.target.value)}
                          className="w-full bg-slate-900 text-amber-400 p-4 rounded-xl text-xs font-mono outline-none border border-slate-800"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          ✅ HTML is automatically sanitized for security
                        </p>
                      </div>
                    )}

                    {/* Social Widget */}
                    {widget.type === 'social' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <input
                          type="url"
                          placeholder="Facebook URL"
                          value={widget.fb || ''}
                          onChange={e => updateWidget(widget.id, 'fb', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="url"
                          placeholder="YouTube URL"
                          value={widget.yt || ''}
                          onChange={e => updateWidget(widget.id, 'yt', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="url"
                          placeholder="LinkedIn URL"
                          value={widget.linkedin || ''}
                          onChange={e => updateWidget(widget.id, 'linkedin', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                        <input
                          type="url"
                          placeholder="Telegram URL"
                          value={widget.telegram || ''}
                          onChange={e => updateWidget(widget.id, 'telegram', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Auto Widgets */}
                    {['tabs', 'tags', 'search', 'newsletter'].includes(widget.type) && (
                      <p className="text-xs font-bold text-slate-400">
                        This widget runs automatically. You can drag to reorder or delete it.
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {widgets.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/20 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                    No widgets added. Start building your sidebar!
                  </p>
                </div>
              )}

              {widgets.length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={isSavingLayout}
                    className="w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-4 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-amber-500/20 hover:-translate-y-1 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSavingLayout ? '⏳ Saving...' : <><HiOutlineCheckCircle size={20} /> Save Layout Settings</>}
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