// src/pages/BlogEditor.jsx
import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const BlogEditor = forwardRef(({ mode, htmlCode, setHtmlCode, isDarkMode }, ref) => {
  const editor = useCreateBlockNote();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (editor) setReady(true);
  }, [editor]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getHTML: async () => {
      if (mode === 'rich') {
        return await editor.blocksToHTMLLossy(editor.document);
      }
      return htmlCode;
    },
    setContent: async (html) => {
      try {
        const blocks = await editor.tryParseHTMLToBlocks(html);
        editor.replaceBlocks(editor.document, blocks);
      } catch (err) {
        console.error('[BlogEditor] setContent error:', err);
      }
    },
    clearContent: () => {
      editor.replaceBlocks(editor.document, [{ type: "paragraph" }]);
    },
    hasContent: () => {
      if (!editor?.document) return false;
      return editor.document.length > 0 && 
             !(editor.document.length === 1 && editor.document[0].type === 'paragraph' && !editor.document[0].content?.length);
    }
  }));

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

  if (!ready) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-slate-400 font-bold text-sm">
        <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mr-3" />
        Initializing Editor...
      </div>
    );
  }

  return (
    <div className="blocknote-wrapper">
      <BlockNoteView editor={editor} theme={isDarkMode ? 'dark' : 'light'} />
    </div>
  );
});

BlogEditor.displayName = 'BlogEditor';
export default BlogEditor;