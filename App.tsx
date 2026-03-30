
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Download, Upload, Palette, PanelLeft, Edit3, Columns, Eye, X, FileText, Plus, FileDown, ExternalLink,
  Save
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { FileNode, NodeType, AppTheme } from './types';
import { initialNodes } from './initialData';
import { db } from './utils/db';
import { exportProject, importProject } from './src/services/exportService';

const themes: Record<string, AppTheme> = {
  dark: { name: 'Dark', bgMain: '#030712', bgSidebar: '#111827', textMain: '#f3f4f6', textMuted: '#9ca3af', border: '#1f2937', accent: '#3b82f6', hover: 'rgba(255, 255, 255, 0.05)' },
  light: { name: 'Light', bgMain: '#ffffff', bgSidebar: '#f3f4f6', textMain: '#111827', textMuted: '#6b7280', border: '#e5e7eb', accent: '#3b82f6', hover: 'rgba(0, 0, 0, 0.05)' },
  navy: { name: 'Navy', bgMain: '#0a192f', bgSidebar: '#112240', textMain: '#ccd6f6', textMuted: '#8892b0', border: '#233554', accent: '#64ffda', hover: 'rgba(100, 255, 218, 0.1)' },
  dracula: { name: 'Dracula', bgMain: '#282a36', bgSidebar: '#21222c', textMain: '#f8f8f2', textMuted: '#6272a4', border: '#44475a', accent: '#ff79c6', hover: 'rgba(255, 255, 255, 0.1)' },
  frontier: { name: 'Frontier', bgMain: '#020617', bgSidebar: '#0f172a', textMain: '#f8fafc', textMuted: '#94a3b8', border: '#1e293b', accent: '#38bdf8', hover: 'rgba(56, 189, 248, 0.1)' }
};

export default function App() {
  const nodes = useLiveQuery(() => db.nodes.toArray()) || [];
  const [activeFileId, setActiveFileId] = useState<string | null>('file-intro');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['folder-welcome', 'folder-docs']));
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<{ current: number, total: number } | null>(null);
  const [editorView, setEditorView] = useState<'split' | 'editor' | 'preview'>('split');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };
  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('mathsci-theme');
    return saved ? JSON.parse(saved) : themes.navy;
  });

  const [uiFontSize, setUiFontSize] = useState(() => Number(localStorage.getItem('mathsci-ui-font-size')) || 14);
  const [uiFontFamily, setUiFontFamily] = useState(() => localStorage.getItem('mathsci-ui-font-family') || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
  const [editorFontSize, setEditorFontSize] = useState(() => Number(localStorage.getItem('mathsci-editor-font-size')) || 16);
  const [editorFontFamily, setEditorFontFamily] = useState(() => localStorage.getItem('mathsci-editor-font-family') || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');

  // Initialize DB with initialNodes if empty
  useEffect(() => {
    const initDB = async () => {
      try {
        const count = await db.nodes.count();
        if (count === 0) {
          await db.nodes.bulkPut(initialNodes);
        } else {
          // Check if Cornell template exists, if not add it
          const cornell = await db.nodes.get('template-cornell');
          if (!cornell) {
            await db.nodes.put(initialNodes.find(n => n.id === 'template-cornell')!);
          }
        }
      } catch (err) {
        console.error("Failed to initialize database:", err);
      }
    };
    initDB();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-main', currentTheme.bgMain);
    root.style.setProperty('--bg-sidebar', currentTheme.bgSidebar);
    root.style.setProperty('--bg-toolbar', currentTheme.bgSidebar);
    root.style.setProperty('--text-main', currentTheme.textMain);
    root.style.setProperty('--text-muted', currentTheme.textMuted);
    root.style.setProperty('--border-color', currentTheme.border);
    root.style.setProperty('--accent-color', currentTheme.accent);
    root.style.setProperty('--hover-bg', currentTheme.hover);
    localStorage.setItem('mathsci-theme', JSON.stringify(currentTheme));
  }, [currentTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-font-size', `${uiFontSize}px`);
    root.style.setProperty('--ui-font-family', uiFontFamily);
    root.style.setProperty('--editor-font-size', `${editorFontSize}px`);
    root.style.setProperty('--editor-font-family', editorFontFamily);
    
    localStorage.setItem('mathsci-ui-font-size', uiFontSize.toString());
    localStorage.setItem('mathsci-ui-font-family', uiFontFamily);
    localStorage.setItem('mathsci-editor-font-size', editorFontSize.toString());
    localStorage.setItem('mathsci-editor-font-family', editorFontFamily);
  }, [uiFontSize, uiFontFamily, editorFontSize, editorFontFamily]);

  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingContentRef = useRef<{id: string, content: string} | null>(null);

  const handleUpdateContent = useCallback(async (content: string) => {
    if (!activeFileId) return;
    
    pendingContentRef.current = { id: activeFileId, content };
    
    // Defer setIsSaving to avoid "Cannot update a component while rendering a different component"
    // This often happens when an editor engine flushes changes on unmount during a file switch
    Promise.resolve().then(() => {
      setIsSaving(true);
    });

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (pendingContentRef.current) {
          await db.nodes.update(pendingContentRef.current.id, { content: pendingContentRef.current.content });
          pendingContentRef.current = null;
        }
        setIsSaving(false);
      } catch (err) {
        console.error("Save failed:", err);
        setIsSaving(false);
      }
    }, 500);
  }, [activeFileId]);

  // Flush save when activeFileId changes
  useEffect(() => {
    return () => {
      if (pendingContentRef.current) {
        const { id, content } = pendingContentRef.current;
        db.nodes.update(id, { content });
        pendingContentRef.current = null;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(false);
      }
    };
  }, [activeFileId]);

  const activeFile = useMemo(() => nodes.find(n => n.id === activeFileId), [nodes, activeFileId]);

  const handleExportPDF = () => {
    const element = document.getElementById('markdown-preview');
    if (!element) return notify("Switch to Preview or Split view to export.", "info");
    const filename = (activeFile?.name || 'document') + '.pdf';
    window.html2pdf().set({
      margin: 1, filename, image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: currentTheme.bgMain },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    }).from(element).save();
  };

  const recursiveDelete = async (id: string) => {
    const idsToDelete: string[] = [id];
    const collectIds = async (parentId: string) => {
      const children = await db.nodes.where('parentId').equals(parentId).toArray();
      for (const child of children) {
        idsToDelete.push(child.id);
        await collectIds(child.id);
      }
    };
    await collectIds(id);
    await db.nodes.bulkDelete(idsToDelete);
  };

  const handleExportJSON = async () => {
    try {
      // Flush any pending saves
      if (pendingContentRef.current) {
        await db.nodes.update(pendingContentRef.current.id, { content: pendingContentRef.current.content });
        pendingContentRef.current = null;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        setIsSaving(false);
      }

      setLoadingProgress({ current: 0, total: 100 });
      const json = await exportProject(nodes, (current, total) => {
        setLoadingProgress({ current, total });
      });
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mathsci-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      notify("Project exported successfully!", "success");
    } catch (err) {
      console.error("Export failed:", err);
      notify("Failed to export project.", "error");
    } finally {
      setLoadingProgress(null);
    }
  };

  const handleClearCache = async () => {
    setConfirmation({
      title: "Reset Application",
      message: "This will PERMANENTLY DELETE all your files and reset the application to its initial state. This action cannot be undone. Continue?",
      onConfirm: async () => {
        try {
          await db.delete();
          localStorage.clear();
          sessionStorage.clear();
          
          // Unregister Service Workers
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
            }
          }
          
          window.location.reload();
        } catch (err) {
          console.error("Clear cache failed:", err);
          notify("Failed to reset application.", "error");
          setConfirmation(null);
        }
      },
      onCancel: () => setConfirmation(null)
    });
  };

  // Expose to window for sidebar access
  useEffect(() => {
    (window as any).handleExportJSON = handleExportJSON;
    (window as any).handleClearCache = handleClearCache;
    return () => { 
      delete (window as any).handleExportJSON; 
      delete (window as any).handleClearCache;
    };
  }, [nodes]);

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        
        const nodesToImport = data.files || data.nodes;
        if (!nodesToImport || !Array.isArray(nodesToImport)) {
          throw new Error("Invalid backup file format: file list is missing or invalid.");
        }

        setConfirmation({
          title: "Import Data",
          message: `Found ${nodesToImport.length} items and ${data.blobs?.length || 0} media files in backup. This will PERMANENTLY REPLACE your current data. Continue?`,
          onConfirm: async () => {
            try {
              setLoadingProgress({ current: 0, total: data.blobs?.length || 0 });
              
              // Give UI a chance to show the 0% progress
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Clear and put nodes first in a transaction
              await db.transaction('rw', db.nodes, db.blobs, async () => {
                await db.nodes.clear();
                await db.blobs.clear();
                await db.nodes.bulkPut(nodesToImport);
              });
              
              // Import blobs separately to avoid blocking the transaction
              await importProject(data, (current, total) => {
                setLoadingProgress({ current, total });
              });
              
              e.target.value = '';
              setConfirmation(null);
              notify("Import successful! The app will now reload.", "success");
              setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
              console.error("Import failed:", err);
              notify("Failed to import data: " + (err instanceof Error ? err.message : "Unknown error"), "error");
              setConfirmation(null);
            } finally {
              setLoadingProgress(null);
            }
          },
          onCancel: () => {
            setConfirmation(null);
            e.target.value = '';
          }
        });
        
      } catch (err) {
        console.error("Import failed:", err);
        notify("Failed to import data: " + (err instanceof Error ? err.message : "Unknown error"), "error");
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      notify("Failed to read the file.", "error");
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-bg-main font-sans">
      <div className={`flex flex-col border-r border-border-color bg-bg-sidebar transition-all duration-300 overflow-hidden shrink-0 ${isSidebarOpen ? 'w-[280px]' : 'w-0'}`}>
         <Sidebar 
            nodes={nodes}
            activeFileId={activeFileId}
            expandedFolders={expandedFolders}
            onFileSelect={setActiveFileId}
            onToggleFolder={(id) => setExpandedFolders(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            })}
            onAddFile={async (parentId, content = '', name = 'Untitled', isCornell = false) => {
                try {
                    const id = uuidv4();
                    const newNode: FileNode = { id, parentId, name, type: NodeType.FILE, content, isCornell, createdAt: Date.now() };
                    await db.nodes.add(newNode);
                    setActiveFileId(id);
                    if (parentId) {
                        setExpandedFolders(prev => new Set(prev).add(parentId));
                    }
                } catch (err) {
                    console.error("Failed to add file:", err);
                    notify("Failed to create file. Please try again.", "error");
                }
            }}
            onAddFolder={async (parentId) => {
                try {
                    const id = uuidv4();
                    await db.nodes.add({ id, parentId, name: 'New Folder', type: NodeType.FOLDER, content: '', createdAt: Date.now() });
                    if (parentId) {
                        setExpandedFolders(prev => new Set(prev).add(parentId));
                    }
                } catch (err) {
                    console.error("Failed to add folder:", err);
                    notify("Failed to create folder. Please try again.", "error");
                }
            }}
            onDeleteNode={async (id) => {
                await recursiveDelete(id);
                if (activeFileId === id) setActiveFileId(null);
            }}
            onRenameNode={async (id, name) => {
                await db.nodes.update(id, { name });
            }}
            onMoveNode={async (id, parentId) => {
                await db.nodes.update(id, { parentId });
            }}
            onShowSettings={() => setShowSettings(true)}
         />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-14 bg-bg-toolbar border-b border-border-color flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-md text-text-muted hover:bg-hover-bg hover:text-text-main transition-colors"><PanelLeft size={18} /></button>
                <h1 className="font-bold text-lg text-text-main">MathSci</h1>
                {isSaving && <span className="text-[0.7rem] opacity-50 italic">Saving...</span>}
            </div>
            <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    if (pendingContentRef.current) {
                      await db.nodes.update(pendingContentRef.current.id, { content: pendingContentRef.current.content });
                      pendingContentRef.current = null;
                      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                      setIsSaving(false);
                    }
                  }} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-color bg-transparent text-text-main text-xs font-medium cursor-pointer hover:bg-hover-bg disabled:opacity-30 transition-colors"
                  title="Save current changes immediately"
                  disabled={!isSaving}
                >
                  <Save size={14} /> Save
                </button>
                <button 
                  onClick={() => {
                    if (activeFile) {
                      const blob = new Blob([activeFile.content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeFile.name}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-color bg-transparent text-text-main text-xs font-medium cursor-pointer hover:bg-hover-bg transition-colors"
                  title="Download current file as Markdown"
                >
                  <Download size={14} /> MD
                </button>
                <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-color bg-transparent text-text-main text-xs font-medium cursor-pointer hover:bg-hover-bg transition-colors"><FileDown size={14} /> PDF</button>
                <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-color bg-transparent text-text-main text-xs font-medium cursor-pointer hover:bg-hover-bg transition-colors"><Palette size={14} /> Theme</button>
                <div className="flex bg-slate-900 border border-white/10 rounded-lg p-1 gap-1 shadow-inner">
                   <button onClick={() => setEditorView('editor')} className={`p-1.5 rounded-md transition-all ${editorView === 'editor' ? 'bg-blue-500/20 text-blue-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} title="Editor View"><Edit3 size={16} /></button>
                   <button onClick={() => setEditorView('split')} className={`p-1.5 rounded-md transition-all ${editorView === 'split' ? 'bg-blue-500/20 text-blue-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} title="Split View"><Columns size={16} /></button>
                   <button onClick={() => setEditorView('preview')} className={`p-1.5 rounded-md transition-all ${editorView === 'preview' ? 'bg-blue-500/20 text-blue-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`} title="Preview View"><Eye size={16} /></button>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-hidden">
            {activeFile ? (
                <Editor 
                  key={activeFileId}
                  content={activeFile.content} 
                  fileName={activeFile.name}
                  allNodes={nodes}
                  activeFileId={activeFileId}
                  viewMode={editorView}
                  onChange={handleUpdateContent} 
                  onAddNodes={async (newNodes) => {
                    await db.nodes.bulkPut(newNodes);
                    // Expand all parent folders of new nodes
                    const parents = new Set<string>();
                    newNodes.forEach(n => { if (n.parentId) parents.add(n.parentId); });
                    if (parents.size > 0) {
                      setExpandedFolders(prev => {
                        const next = new Set(prev);
                        parents.forEach(p => next.add(p));
                        return next;
                      });
                    }
                  }}
                  isCornell={activeFile.isCornell}
                />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted text-center p-8">
                  <p>Select a file to edit or create a new one.</p>
              </div>
            )}
        </div>
      </div>

      {showSettings && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowSettings(false)}>
              <div className="w-[90%] max-w-[500px] rounded-xl overflow-hidden bg-slate-950 p-6 max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-white tracking-tight uppercase">Settings</h3>
                    <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X size={20} className="text-white/40 hover:text-white" />
                    </button>
                  </div>

                  <div className="space-y-8">
                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Themes</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(themes).map(([k, t]) => (
                            <button 
                              key={k} 
                              onClick={() => setCurrentTheme(t)} 
                              className={`group relative px-4 py-3 rounded-xl border transition-all duration-300 text-left overflow-hidden ${currentTheme.name === t.name ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                            >
                              <div className="relative z-10">
                                <span className={`text-xs font-bold ${currentTheme.name === t.name ? 'text-blue-400' : 'text-white/70 group-hover:text-white'}`}>{t.name}</span>
                              </div>
                              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundColor: t.bgMain }} />
                            </button>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">UI Typography</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Font Size (px)</label>
                          <input 
                            type="number" 
                            value={uiFontSize} 
                            onChange={(e) => setUiFontSize(Number(e.target.value))}
                            className="w-full bg-white/5 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Font Family</label>
                          <select 
                            value={uiFontFamily} 
                            onChange={(e) => setUiFontFamily(e.target.value)}
                            className="w-full bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 transition-all appearance-none"
                          >
                            <option value='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'>Sans-Serif (Default)</option>
                            <option value='"Inter", sans-serif'>Inter</option>
                            <option value='Georgia, serif'>Serif (Georgia)</option>
                            <option value='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'>Monospace</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Editor Typography</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Font Size (px)</label>
                          <input 
                            type="number" 
                            value={editorFontSize} 
                            onChange={(e) => setEditorFontSize(Number(e.target.value))}
                            className="w-full bg-white/5 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Font Family</label>
                          <select 
                            value={editorFontFamily} 
                            onChange={(e) => setEditorFontFamily(e.target.value)}
                            className="w-full bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500/50 transition-all appearance-none"
                          >
                            <option value='ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'>Monospace (Default)</option>
                            <option value='"Fira Code", monospace'>Fira Code</option>
                            <option value='"JetBrains Mono", monospace'>JetBrains Mono</option>
                            <option value='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'>Sans-Serif</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Backup & Restore</h4>
                      <div className="grid grid-cols-2 gap-3">
                          <button onClick={handleExportJSON} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-bold hover:bg-white/10 hover:text-white transition-all">
                              <Download size={14} /> Export JSON
                          </button>
                          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-bold cursor-pointer hover:bg-white/10 hover:text-white transition-all">
                              <Upload size={14} /> Import JSON
                              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                          </label>
                      </div>
                    </section>

                    <section className="pt-6 border-t border-white/10 space-y-3">
                        <button 
                          onClick={async () => {
                            try {
                              await db.nodes.bulkPut(initialNodes);
                              notify("Initial templates reloaded!", "success");
                            } catch (err) {
                              console.error("Failed to reload templates:", err);
                              notify("Failed to reload templates.", "error");
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-xs font-bold hover:bg-white/10 hover:text-white transition-all"
                        >
                            Reload Initial Templates
                        </button>
                        <button 
                          onClick={handleClearCache}
                          className="w-full px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 text-xs font-bold hover:bg-amber-500/10 transition-all"
                        >
                            Clear Cache & Hard Reload
                        </button>
                        <button 
                          onClick={async () => {
                            try {
                              await db.nodes.clear();
                              await db.blobs.clear();
                              await db.nodes.bulkPut(initialNodes);
                              window.location.reload();
                            } catch (err) {
                              console.error("Failed to reset data:", err);
                              notify("Failed to reset data.", "error");
                            }
                          }}
                          className="w-full px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all"
                        >
                            Reset All Data
                        </button>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">About Developer</h4>
                      <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-sm text-white/60 leading-relaxed">
                        <p className="mb-3">Developed by <strong className="text-white">Gobal Krishnan V</strong></p>
                        <div className="flex flex-col gap-2 text-xs">
                          <span className="flex items-center gap-2">ORCID: <a href="https://orcid.org/0009-0001-3787-2860" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">0009-0001-3787-2860</a></span>
                          <span className="flex items-center gap-2">Email: <a href="mailto:gobalkrishnan.work@gmail.com" className="text-blue-400 hover:text-blue-300 transition-colors">gobalkrishnan.work@gmail.com</a></span>
                          <span className="flex items-center gap-2">Mobile: <a href="tel:+918148729703" className="text-blue-400 hover:text-blue-300 transition-colors">+91 8148729703</a></span>
                          <span className="flex items-center gap-2">GitHub: <a href="https://github.com/engineer-work/" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">engineer-work</a></span>
                        </div>
                        <p className="mt-4 text-[10px] italic opacity-50">
                          Built with Google AI Studio, Gemini, ChatGPT, and DeepSeek.
                        </p>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Career Aspirations</h4>
                      <div className="bg-white/5 p-5 rounded-2xl border border-white/5 text-sm text-white/60 leading-relaxed">
                        <p className="mb-4">
                          My ultimate goal is to contribute to world-class supercomputing and technology companies such as 
                          <strong className="text-white"> Frontier (ORNL)</strong>, 
                          <strong className="text-white"> Google</strong>, 
                          <strong className="text-white"> Amazon</strong>, 
                          <strong className="text-white"> NVIDIA (Omniverse)</strong>, 
                          <strong className="text-white"> Disney</strong>, 
                          and other leading firms in graphics, electronics, and algorithm design.
                        </p>
                        
                        <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-3">🚀 Manual to Get a Job in Top-Tier Tech:</h5>
                        <ul className="space-y-3 text-xs">
                          <li className="flex gap-2"><span className="text-blue-400 font-bold">•</span> Master the Fundamentals: Data Structures, Algorithms, and System Architecture.</li>
                          <li className="flex gap-2"><span className="text-blue-400 font-bold">•</span> Specialized Expertise: HPC, GPU programming (CUDA), or AI/ML frameworks.</li>
                          <li className="flex gap-2"><span className="text-blue-400 font-bold">•</span> Build & Showcase: Develop complex projects that demonstrate real-world problem-solving.</li>
                          <li className="flex gap-2"><span className="text-blue-400 font-bold">•</span> Contribute to Open Source: Engage with communities building the tools used by these giants.</li>
                        </ul>
                      </div>
                    </section>
                  </div>
              </div>
          </div>
      )}

      {/* Progress Overlay */}
      {loadingProgress && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-64 space-y-4">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[0.6rem] font-bold text-purple-400 uppercase tracking-[0.2em]">Processing Data</p>
                <h3 className="text-xl font-light text-white tracking-tight">
                  {loadingProgress.total > 0 
                    ? `Syncing ${loadingProgress.current} / ${loadingProgress.total}`
                    : 'Preparing...'}
                </h3>
              </div>
              <p className="text-[0.6rem] font-mono text-white/40">
                {loadingProgress.total > 0 
                  ? `${Math.round((loadingProgress.current / loadingProgress.total) * 100)}%`
                  : '0%'}
              </p>
            </div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[0.6rem] text-white/30 text-center italic">
              Please do not close the browser during this operation.
            </p>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm">
          <div className="w-[90%] max-w-[500px] rounded-xl bg-bg-sidebar border border-border-color p-6 shadow-2xl">
            <h3 className="mt-0 mb-4 text-lg font-bold text-text-main">{confirmation.title}</h3>
            <p className="text-text-muted text-sm mb-6 leading-relaxed">{confirmation.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 rounded-md border border-border-color bg-transparent text-text-main text-sm font-medium hover:bg-hover-bg transition-colors" 
                onClick={confirmation.onCancel}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 rounded-md bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors" 
                onClick={confirmation.onConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <div 
          className={`fixed bottom-8 right-8 text-white px-5 py-3 rounded-lg shadow-2xl z-[10000] flex items-center gap-3 text-sm font-medium animate-[slideIn_0.3s_ease-out] ${notification.type === 'error' ? 'bg-red-500' : notification.type === 'success' ? 'bg-emerald-500' : 'bg-bg-sidebar'}`}
        >
          {notification.message}
          <button onClick={() => setNotification(null)} className="bg-none border-none text-white cursor-pointer opacity-70 hover:opacity-100 transition-opacity"><X size={16}/></button>
        </div>
      )}
    </div>
  );
}
