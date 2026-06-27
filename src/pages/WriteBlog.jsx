// src/pages/WriteBlog.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/firebaseConfig';
import {
  collection, addDoc, serverTimestamp, getDocs,
  query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, where
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  HiOutlineCheckCircle, HiOutlineDocumentText,
  HiOutlinePencilAlt, HiOutlineTrash, HiOutlineCollection,
  HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineTemplate,
  HiOutlineShieldExclamation, HiOutlineExclamationCircle,
  HiOutlineInformationCircle, HiOutlinePhotograph, HiOutlineEye
} from 'react-icons/hi';
import { Navigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  validateBlogData,
  generateSlugFromTitle,
  sanitizeSlug,
  checkContentWarnings,
  VALID_CATEGORIES
} from '../utils/blogValidation';

// ✅ REGULAR IMPORT — BlockNote ko kabhi lazy load mat karo
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
// ✅ VALIDATION ALERT
// ============================================
const ValidationAlert = ({ type = 'error', title, messages, onClose }) => {
  const bgColor = type === 'error' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-amber-50 dark:bg-amber-500/10';
  const borderColor = type === 'error' ? 'border-rose-200 dark:border-rose-500/20' : 'border-amber-200 dark:border-amber-500/20';
  const textColor = type === 'error' ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200';
  const titleColor = type === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300';
  const Icon = type === 'error' ? HiOutlineExclamationCircle : HiOutlineInformationCircle;

  return (
    <div className={`mb-6 p-4 ${bgColor} border ${borderColor} rounded-2xl ${textColor} transition-all`}>
      <div className="flex gap-3">
        <Icon size={24} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className={`font-bold ${titleColor} mb-2`}>{title}</h4>
          <ul className="space-y-1 text-sm font-medium">
            {messages.map((msg, i) => (
              <li key={i} className="flex gap-2"><span>•</span><span>{msg}</span></li>
            ))}
          </ul>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-lg font-bold opacity-50 hover:opacity-100 transition-opacity" aria-label="Close alert">✕</button>
        )}
      </div>
    </div>
  );
};

// ============================================
// ✅ ACCESS DENIED
// ============================================
const AccessDenied = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="text-center p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 max-w-md mx-4">
      <HiOutlineShieldExclamation className="mx-auto text-6xl text-rose-500 mb-4" />
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Access Denied</h2>
      <p className="text-slate-500 text-sm">You do not have admin privileges to access Finledger Studio.</p>
    </div>
  </div>
);

// ============================================
// ✅ COVER IMAGE PREVIEW
// ============================================
const CoverImagePreview = ({ url }) => {
  const [error, setError] = useState(false);
  if (!url || error) return null;
  return (
    <div className="mt-3 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
      <img src={url} alt="Cover preview" className="w-full h-40 object-cover" onError={() => setError(true)} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <HiOutlineEye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
      </div>
    </div>
  );
};

// ============================================
// ✅ BLOCKNOTE EDITOR WRAPPER (Same File — No Lazy)
// ============================================
const BlogEditorWrapper = React.forwardRef(({ mode, htmlCode, setHtmlCode, isDarkMode }, ref) => {
  // ✅ useCreateBlockNote hamesha normally call karo, kabhi lazy me nahi
  const editor = useCreateBlockNote();
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    // BlockNote ka editor thoda time leta hai initialize hone me
    const timer = setTimeout(() => {
      if (editor) setEditorReady(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [editor]);

  // Parent component ko methods expose karo
  React.useImperativeHandle(ref, () => ({
    getHTML: async () => {
      try {
        if (mode === 'rich' && editor) {
          return await editor.blocksToHTMLLossy(editor.document);
        }
        return String(htmlCode || '');
      } catch (err) {
        console.error('[Editor] getHTML error:', err);
        return String(htmlCode || '');
      }
    },
    setContent: async (html) => {
      try {
        if (editor && typeof html === 'string') {
          const blocks = await editor.tryParseHTMLToBlocks(html);
          editor.replaceBlocks(editor.document, blocks);
        }
      } catch (err) {
        console.error('[Editor] setContent error:', err);
      }
    },
    clearContent: () => {
      try {
        if (editor) {
          editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
        }
      } catch (err) {
        console.error('[Editor] clearContent error:', err);
      }
    },
    hasContent: () => {
      try {
        if (!editor || !editor.document) return false;
        const doc = editor.document;
        if (!Array.isArray(doc) || doc.length === 0) return false;
        if (doc.length === 1) {
          const first = doc[0];
          if (first.type === 'paragraph') {
            const content = first.content;
            if (!content || !Array.isArray(content) || content.length === 0) return false;
          }
        }
        return true;
      } catch (err) {
        return false;
      }
    }
  }));

  // HTML Mode
  if (mode === 'html') {
    return (
      <textarea
        required
        rows="18"
        value={htmlCode}
        onChange={e => setHtmlCode(e.target.value)}
        className="w-full p-5 rounded-2xl bg-slate-900 text-amber-400 font-mono text-sm border border-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
        placeholder="Paste or write HTML here..."
      />
    );
  }

  // Loading state
  if (!editorReady) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-400 font-bold text-sm">
        <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mr-3" />
        Initializing Editor...
      </div>
    );
  }

  // Rich Mode
  return (
    <div className="bn-wrapper">
      <BlockNoteView editor={editor} theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );
});

BlogEditorWrapper.displayName = 'BlogEditorWrapper';

// ============================================
// 🚀 ADMIN GUARD (Non-admins ke liye 0kb load)
// ============================================
const WriteBlog = () => {
  const { user, isAdmin } = useAuth();

  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <AccessDenied />;

  return <BlogStudio user={user} />;
};

// ============================================
// 🎨 BLOG STUDIO (Actual Logic)
// ============================================
const BlogStudio = ({ user }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // State
  const [activeTab, setActiveTab] = useState('write');
  const [adminPosts, setAdminPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editCreatedAt, setEditCreatedAt] = useState(null);

  const [formData, setFormData] = useState({
    title: '', excerpt: '', category: categories[0], coverImage: '', tags: ''
  });
  const [editorMode, setEditorMode] = useState('rich');
  const [htmlCode, setHtmlCode] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const editorRef = useRef(null);

  const [widgets, setWidgets] = useState([]);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [contentWarnings, setContentWarnings] = useState([]);
  const [slugPreview, setSlugPreview] = useState('');

  // Slug preview
  useEffect(() => {
    try {
      if (formData.title) {
        setSlugPreview(sanitizeSlug(generateSlugFromTitle(formData.title)));
      } else {
        setSlugPreview('');
      }
    } catch (e) {
      setSlugPreview('');
    }
  }, [formData.title]);

  // ============================================
  // FETCH
  // ============================================
  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setAdminPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('[WriteBlog] Fetch error:', error.code, error.message);
      if (error.code === 'permission-denied') {
        alert('❌ Permission denied loading posts. Check your admin status in Firestore `admins` collection.');
      } else {
        alert('Failed to load posts. Check console.');
      }
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
      console.error('[WriteBlog] Layout fetch error:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'manage') fetchPosts();
    if (activeTab === 'layout') fetchLayoutData();
  }, [activeTab]);

  // ============================================
  // WIDGETS
  // ============================================
  const addWidget = (type) => setWidgets([...widgets, { id: Date.now().toString(), ...WIDGET_TYPES[type] }]);
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
    if (id && field === 'content' && typeof value === 'string') {
      const sanitized = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'img', 'a', 'b', 'i', 'u', 'strong', 'em'],
        ALLOWED_ATTR: ['src', 'href', 'class', 'style', 'alt', 'title']
      });
      setWidgets(widgets.map(w => w.id === id ? { ...w, [field]: sanitized } : w));
    } else {
      setWidgets(widgets.map(w => w.id === id ? { ...w, [field]: value } : w));
    }
  };

  const handleSaveLayout = async (e) => {
    e.preventDefault();
    setIsSavingLayout(true);
    try {
      await setDoc(doc(db, 'settings', 'sidebarLayout'), { widgets: JSON.parse(JSON.stringify(widgets)) });
      setSuccessMessage('✅ Sidebar Widgets saved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[WriteBlog] Save layout error:', error.code, error.message);
      if (error.code === 'permission-denied') {
        alert('❌ Permission denied saving layout. Check your admin status in Firestore `admins` collection.');
      } else {
        alert(`❌ Failed: ${error.message}`);
      }
    } finally {
      setIsSavingLayout(false);
    }
  };

  // ============================================
  // CRUD
  // ============================================
  const handleDelete = async (id, title) => {
    if (!window.confirm(`⚠️ Delete blog: "${title}"?\n\nThis action cannot be undone.`)) return;
    const previousPosts = adminPosts;
    setAdminPosts(adminPosts.filter(post => post.id !== id));
    try {
      await deleteDoc(doc(db, 'blogs', id));
      setSuccessMessage(`✅ "${title}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
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
      setEditCreatedAt(post.createdAt);

      if (post.content) {
        setHtmlCode(post.content);
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.setContent(post.content);
          }
        }, 400);
      }

      setEditorMode('rich');
      setActiveTab('write');
      setValidationErrors([]);
      setValidationWarnings([]);
      setContentWarnings([]);
      await new Promise(r => setTimeout(r, 100));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('[WriteBlog] Edit error:', error);
      alert('Failed to load blog for editing.');
    }
  };

  const resetForm = () => {
    setFormData({ title: '', excerpt: '', category: categories[0], coverImage: '', tags: '' });
    setEditingId(null);
    setEditCreatedAt(null);
    setHtmlCode('');
    setEditorMode('rich');
    setActiveTab('write');
    setValidationErrors([]);
    setValidationWarnings([]);
    setContentWarnings([]);
    setSlugPreview('');
    if (editorRef.current) editorRef.current.clearContent();
  };

  // ============================================
  // SLUG
  // ============================================
  const generateUniqueSlug = async (baseSlug, excludeId = null) => {
    let slug = sanitizeSlug(baseSlug);
    let counter = 1;
    while (counter <= 100) {
      try {
        const q = query(collection(db, 'blogs'), where('slug', '==', slug));
        const result = await getDocs(q);
        const exists = result.docs.some(d => d.id !== excludeId);
        if (!exists) return slug;
        slug = `${sanitizeSlug(baseSlug)}-${counter}`;
        counter++;
      } catch (error) {
        console.error('[WriteBlog] Slug error:', error);
        throw error;
      }
    }
    throw new Error('Could not generate unique slug');
  };

  // ============================================
  // PUBLISH
  // ============================================
  const handlePublish = async (e) => {
    e.preventDefault();
    if (!user) return alert('❌ Must be logged in.');

    setIsPublishing(true);
    setValidationErrors([]);
    setValidationWarnings([]);
    setContentWarnings([]);

    try {
      // 1. Get HTML
      let finalHTML = editorMode === 'rich'
        ? (editorRef.current ? await editorRef.current.getHTML() : '')
        : String(htmlCode || '');

      // 2. Video → iframe
      finalHTML = finalHTML.replace(
        /<video[^>]+src="([^"]+)"[^>]*>.*?<\/video>/gi,
        (match, src) =>
          src.includes('youtube.com') || src.includes('youtu.be')
            ? `<iframe class="w-full aspect-video rounded-xl shadow-xl my-8 border border-slate-200 dark:border-slate-800" src="${src}" frameborder="0" allowfullscreen></iframe>`
            : match
      );

      // 3. Download syntax
      finalHTML = finalHTML.replace(
        /\[DOWNLOAD:\s*(.*?)\s*\|\s*([^\]]+)\]/gi,
        (match, rawUrl, text) => {
          const cleanUrl = rawUrl.replace(/<[^>]+>/g, '').trim();
          const cleanText = text.trim();
          return `<div class="flex flex-col items-center justify-center my-6 w-full not-prose"><a href="${cleanUrl}" target="_blank" class="group relative flex items-center justify-center gap-3 w-full sm:w-[80%] max-w-md px-4 py-4 bg-gradient-to-r from-[#2ecc71] via-[#27ae60] to-[#2980b9] text-white font-black text-sm md:text-base uppercase tracking-widest rounded-sm shadow-lg hover:-translate-y-0.5 transition-all border-b-4 border-[#1c5982] active:border-b-0 active:translate-y-1"><span class="text-yellow-400">⚡</span><span>${cleanText}</span><span class="text-yellow-400">⚡</span></a></div>`;
        }
      );

      // 4. Sanitize
      finalHTML = DOMPurify.sanitize(finalHTML);
      if (!finalHTML || finalHTML === '<p></p>') {
        setIsPublishing(false);
        alert('❌ Content cannot be empty.');
        return;
      }

      // 5. Tags
      const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t !== '');

      // 6. Slug
      const baseSlug = generateSlugFromTitle(formData.title);
      const finalSlug = await generateUniqueSlug(baseSlug, editingId);

      // 7. Data
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

      // 8. Validate
      const validation = validateBlogData(postData);
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setIsPublishing(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (validation.warnings.length > 0) setValidationWarnings(validation.warnings);
      const contentWarns = checkContentWarnings(finalHTML);
      if (contentWarns.length > 0) setContentWarnings(contentWarns);

      // 9. Save
      if (editingId) {
        await updateDoc(doc(db, 'blogs', editingId), {
          ...postData,
          createdAt: editCreatedAt
        });
        setSuccessMessage('✅ Blog Updated Successfully!');
      } else {
        postData.createdAt = serverTimestamp();
        postData.createdBy = user.uid;
        postData.views = 0;
        await addDoc(collection(db, 'blogs'), postData);
        setSuccessMessage('✅ Blog Published Successfully!');
      }

      setTimeout(() => {
        setSuccessMessage('');
        resetForm();
        setActiveTab('manage');
      }, 2000);
    } catch (error) {
      console.error('[WriteBlog] Publish error:', error.code, error.message);
      let userMessage = '❌ Failed to publish blog.';
      if (error.code === 'permission-denied') {
        userMessage = '❌ Permission denied. Your UID is not in the `admins` collection in Firestore. Follow the setup steps.';
      } else if (error.code === 'failed-precondition') {
        userMessage = '❌ Firestore index required. Check console for link.';
      }
      alert(userMessage);
    } finally {
      setIsPublishing(false);
    }
  };

  // ============================================
  // UNSAVED CHANGES WARNING
  // ============================================
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      let hasContent = false;
      try {
        hasContent = editorMode === 'rich'
          ? (editorRef.current ? editorRef.current.hasContent() : false)
          : htmlCode.trim().length > 0;
      } catch (e) {
        hasContent = htmlCode.trim().length > 0;
      }

      if (hasContent && activeTab === 'write' && !successMessage) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Leave anyway?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [htmlCode, editorMode, activeTab, successMessage]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-20 sm:pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Finledger Studio</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Premium Publishing Dashboard.</p>
          </div>
          <div className="flex flex-wrap bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
            {[
              { id: 'write', icon: HiOutlinePencilAlt, label: 'Write' },
              { id: 'manage', icon: HiOutlineCollection, label: 'Manage' },
              { id: 'layout', icon: HiOutlineTemplate, label: 'Layout' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'write' && !editingId) resetForm(); }}
                className={`flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                  activeTab === tab.id
                    ? tab.id === 'layout' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <tab.icon size={18} /> {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* SUCCESS */}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center gap-2 font-bold transition-all">
            <HiOutlineCheckCircle size={24} /> {successMessage}
          </div>
        )}

        {/* VALIDATION */}
        {validationErrors.length > 0 && <ValidationAlert type="error" title="Validation Errors" messages={validationErrors} onClose={() => setValidationErrors([])} />}
        {validationWarnings.length > 0 && <ValidationAlert type="warning" title="Validation Warnings" messages={validationWarnings} onClose={() => setValidationWarnings([])} />}
        {contentWarnings.length > 0 && <ValidationAlert type="warning" title="Content Quality Tips" messages={contentWarnings} onClose={() => setContentWarnings([])} />}

        {/* ========================================
            WRITE TAB
            ======================================== */}
        {activeTab === 'write' && (
          <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 transition-all">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 md:p-10 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <input
                  type="text" required value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-transparent border-none text-slate-900 dark:text-white outline-none font-black text-2xl sm:text-3xl md:text-5xl mb-2 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  placeholder="Post Title..." maxLength={200}
                />
                {slugPreview && (
                  <p className="text-[11px] font-mono text-slate-400 dark:text-slate-600 mb-6 flex items-center gap-2">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">URL:</span>/blogs/{slugPreview}
                  </p>
                )}

                <div className="border-t border-slate-100 dark:border-slate-800/50 pt-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Syntax: [DOWNLOAD: url | text]</span>
                    </p>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                      <button
                        type="button"
                        onClick={async () => {
                          if (editorMode === 'rich' && editorRef.current) {
                            const html = await editorRef.current.getHTML();
                            setHtmlCode(html);
                            setEditorMode('html');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase transition-colors ${editorMode === 'rich' ? 'bg-white dark:bg-slate-700 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >Rich</button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (editorMode === 'html' && editorRef.current) {
                            await editorRef.current.setContent(htmlCode);
                            setEditorMode('rich');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-md font-bold text-[10px] uppercase transition-colors ${editorMode === 'html' ? 'bg-white dark:bg-slate-700 text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >HTML</button>
                    </div>
                  </div>

                  {/* ✅ EDITOR — Same file, no lazy load */}
                  <div className="min-h-[300px] sm:min-h-[400px]">
                    <BlogEditorWrapper
                      ref={editorRef}
                      mode={editorMode}
                      htmlCode={htmlCode}
                      setHtmlCode={setHtmlCode}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 sticky top-24">
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">Category *</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl font-bold outline-none text-sm">
                    {categories.map(cat => (<option key={cat}>{cat}</option>))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    <HiOutlinePhotograph className="inline mr-1" size={14} /> Cover Image URL
                  </label>
                  <input type="url" placeholder="https://example.com/image.jpg" value={formData.coverImage} onChange={e => setFormData({ ...formData, coverImage: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm outline-none" />
                  <CoverImagePreview url={formData.coverImage} />
                </div>

                <div>
                  <label className="flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">
                    <span>Excerpt *</span>
                    <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">{formData.excerpt.length}/500</span>
                  </label>
                  <textarea required rows="3" maxLength={500} placeholder="Brief summary of the post" value={formData.excerpt} onChange={e => setFormData({ ...formData, excerpt: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm resize-none outline-none" />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-2">Tags (comma separated)</label>
                  <input type="text" placeholder="react, javascript, web" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3 sm:p-4 rounded-2xl text-sm outline-none" />
                </div>

                <button type="submit" disabled={isPublishing} className="w-full p-3 sm:p-4 text-white rounded-2xl font-black text-sm uppercase bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-all disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
                  {isPublishing ? '⏳ Publishing...' : editingId ? '✅ Update Post' : '✅ Publish Post'}
                </button>

                {editingId && (
                  <button type="button" onClick={resetForm} className="w-full p-3 sm:p-4 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel Edit</button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* ========================================
            MANAGE TAB
            ======================================== */}
        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
            {isLoadingPosts ? (
              <div className="p-20 text-center">
                <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 font-bold text-sm">Loading posts...</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminPosts.length === 0 && (
                  <div className="p-20 text-center">
                    <HiOutlineDocumentText className="mx-auto text-5xl text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 font-bold mb-2">No posts published yet.</p>
                    <button onClick={() => setActiveTab('write')} className="text-blue-600 font-bold text-sm hover:underline">Write your first post →</button>
                  </div>
                )}
                {adminPosts.map((post) => (
                  <div key={post.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {post.coverImage ? (
                          <img src={post.coverImage} className="w-full h-full object-cover" alt="" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-300">N/A</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{post.category}</span>
                        <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug line-clamp-1 mb-1">{post.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400">/blogs/{post.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button onClick={() => handleEdit(post)} className="p-2 sm:p-3 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 rounded-xl transition-all hover:bg-blue-100 dark:hover:bg-blue-500/20" title="Edit blog"><HiOutlinePencilAlt size={18} /></button>
                      <button onClick={() => handleDelete(post.id, post.title)} className="p-2 sm:p-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-xl transition-all hover:bg-rose-100 dark:hover:bg-rose-500/20" title="Delete blog"><HiOutlineTrash size={18} /></button>
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
          <div className="transition-all">
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 sm:p-6 rounded-[2rem] mb-8">
              <h2 className="text-lg font-black text-amber-800 dark:text-amber-500 mb-2 flex items-center gap-2"><HiOutlineTemplate size={24} /> Dynamic Sidebar Builder</h2>
              <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400">Build your sidebar just like Blogger. Add gadgets and reorder them!</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-900 dark:text-white w-full mb-2">➕ Add a New Gadget:</span>
              <div className="flex flex-wrap gap-2">
                {Object.keys(WIDGET_TYPES).map(type => (
                  <button key={type} type="button" onClick={() => addWidget(type)} className="px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] sm:text-xs font-black uppercase rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm">+ {WIDGET_TYPES[type].title}</button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveLayout} className="space-y-6">
              {widgets.length === 0 && (
                <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                  <HiOutlineTemplate className="mx-auto text-5xl text-slate-300 dark:text-slate-700 mb-4" />
                  <p className="text-slate-500 font-bold">No widgets added yet. Add gadgets above!</p>
                </div>
              )}

              {widgets.map((widget, index) => (
                <div key={widget.id} className="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all hover:border-blue-400">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 md:w-24 flex md:flex-col items-center justify-center gap-3 md:gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
                    <div className="flex md:flex-col gap-2">
                      <button type="button" onClick={() => moveWidget(index, -1)} disabled={index === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"><HiOutlineChevronUp size={16} /></button>
                      <button type="button" onClick={() => moveWidget(index, 1)} disabled={index === widgets.length - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg text-slate-500 disabled:opacity-30 hover:text-blue-600 shadow-sm border border-slate-200 dark:border-slate-600 transition-colors"><HiOutlineChevronDown size={16} /></button>
                    </div>
                    <button type="button" onClick={() => removeWidget(widget.id)} className="p-2 bg-rose-50 dark:bg-rose-500/20 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-colors md:mt-auto"><HiOutlineTrash size={16} /></button>
                  </div>

                  <div className="p-4 sm:p-6 flex-1">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{widget.title} <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded ml-2">{widget.type}</span></h3>
                    </div>

                    {widget.type === 'about' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="text" placeholder="Name" value={widget.name || ''} onChange={e => updateWidget(widget.id, 'name', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="text" placeholder="Role" value={widget.role || ''} onChange={e => updateWidget(widget.id, 'role', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="Image URL" value={widget.image || ''} onChange={e => updateWidget(widget.id, 'image', e.target.value)} className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <textarea placeholder="Short Bio" rows="2" value={widget.bio || ''} onChange={e => updateWidget(widget.id, 'bio', e.target.value)} className="sm:col-span-2 w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none" />
                      </div>
                    )}

                    {widget.type === 'facebook' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <input type="url" placeholder="https://www.facebook.com/yourpage" value={widget.fbUrl || ''} onChange={e => updateWidget(widget.id, 'fbUrl', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    )}

                    {widget.type === 'youtube' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <input type="text" placeholder="Channel Name" value={widget.channelName || ''} onChange={e => updateWidget(widget.id, 'channelName', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    )}

                    {widget.type === 'telegram' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <div className="flex items-center">
                          <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-r-0 text-slate-500 p-3 rounded-l-xl text-sm">t.me/</span>
                          <input type="text" placeholder="bpcryptocraft" value={widget.channel || ''} onChange={e => updateWidget(widget.id, 'channel', e.target.value.replace('https://t.me/', '').replace('t.me/', '').replace('/', ''))} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-r-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono" />
                        </div>
                      </div>
                    )}

                    {widget.type === 'html' && (
                      <div className="space-y-4">
                        <input type="text" placeholder="Widget Title (Optional)" value={widget.title || ''} onChange={e => updateWidget(widget.id, 'title', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" />
                        <textarea placeholder="Paste HTML here..." rows="4" value={widget.content || ''} onChange={e => updateWidget(widget.id, 'content', e.target.value)} className="w-full bg-slate-900 text-amber-400 p-4 rounded-xl text-xs font-mono outline-none border border-slate-800" />
                        <p className="text-xs text-slate-500 dark:text-slate-400">✅ HTML is automatically sanitized</p>
                      </div>
                    )}

                    {widget.type === 'social' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="url" placeholder="Facebook URL" value={widget.fb || ''} onChange={e => updateWidget(widget.id, 'fb', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="YouTube URL" value={widget.yt || ''} onChange={e => updateWidget(widget.id, 'yt', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="LinkedIn URL" value={widget.linkedin || ''} onChange={e => updateWidget(widget.id, 'linkedin', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                        <input type="url" placeholder="Telegram URL" value={widget.telegram || ''} onChange={e => updateWidget(widget.id, 'telegram', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    )}

                    {/* Auto Widgets */}
                    {['tabs', 'tags', 'search', 'newsletter'].includes(widget.type) && (
                      <div className="text-center py-4">
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">✅ Auto-widget: {widget.title}</p>
                        <p className="text-xs text-slate-400 mt-1">No configuration needed. Reorder using arrows.</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {widgets.length > 0 && (
                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={isSavingLayout} className="px-8 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-70 text-white rounded-2xl font-black text-sm uppercase transition-all disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950">
                    {isSavingLayout ? '⏳ Saving Layout...' : '💾 Save Sidebar Layout'}
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