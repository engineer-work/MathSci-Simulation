
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import { 
  Play, Maximize2, Minimize2, FileCode, Globe, Palette, 
  Layout
} from 'lucide-react';

// Configure Monaco loader to use a specific version that we cache in sw.js
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
});

interface CodeEditorEngineProps {
  config: {
    js?: string;
    html?: string;
    css?: string;
    internal_block_id: string;
  };
  onUpdate: (newConfig: string) => void;
}

type Tab = 'js' | 'html' | 'css' | 'result';

export const CodeEditorEngine: React.FC<CodeEditorEngineProps> = ({ config, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('js');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<any>(null);
  
  const [jsCode, setJsCode] = useState(config.js || '');
  const [htmlCode, setHtmlCode] = useState(config.html || '');
  const [cssCode, setCssCode] = useState(config.css || '');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasRunOnce = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedConfigRef = useRef(JSON.stringify({
    js: config.js || '',
    html: config.html || '',
    css: config.css || '',
    internal_block_id: config.internal_block_id
  }));

  const save = useCallback(() => {
    const currentConfig = {
      js: jsCode,
      html: htmlCode,
      css: cssCode,
      internal_block_id: config.internal_block_id
    };
    const configStr = JSON.stringify(currentConfig);
    
    if (configStr !== lastSavedConfigRef.current) {
      onUpdate(JSON.stringify(currentConfig, null, 2));
      lastSavedConfigRef.current = configStr;
    }
  }, [jsCode, htmlCode, cssCode, config.internal_block_id, onUpdate]);

  // Auto-save changes back to the parent Markdown content
  useEffect(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      save();
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        save(); // Flush on unmount
      }
    };
  }, [save]);

  useEffect(() => {
    setJsCode(config.js || '');
    setHtmlCode(config.html || '');
    setCssCode(config.css || '');
  }, [config.internal_block_id]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Explicitly enable native clipboard actions
    // Monaco usually handles this, but we ensure the environment allows it
    editor.focus();
  };

  useEffect(() => {
    if (editorRef.current && activeTab !== 'result') {
      editorRef.current.focus();
    }
    if (activeTab === 'result' && !hasRunOnce.current) {
      runCode();
    }
  }, [activeTab]);

  const runCode = () => {
    if (!iframeRef.current) return;
    hasRunOnce.current = true;
    
    const combinedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { background-color: white; color: black; margin: 0; padding: 10px; font-family: sans-serif; }
            ${cssCode}
          </style>
        </head>
        <body>
          ${htmlCode}
          <script>
            (function() {
              try {
                ${jsCode}
              } catch (err) {
                console.error(err);
                document.body.innerHTML += '<div style="color:red; margin-top:20px; border-top:1px solid #ddd; padding-top:10px;"><b>Error:</b> ' + err.message + '</div>';
              }
            })();
          </script>
        </body>
      </html>
    `;
    
    iframeRef.current.srcdoc = combinedHtml;
    
    const updatedConfig = JSON.stringify({
      js: jsCode,
      html: htmlCode,
      css: cssCode,
      internal_block_id: config.internal_block_id
    }, null, 2);
    onUpdate(updatedConfig);
  };

  const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-1 flex items-center gap-1.5 text-[0.75rem] font-semibold transition-all cursor-pointer h-full border-b-2 ${
        activeTab === id 
          ? 'bg-bg-main text-accent-color border-accent-color' 
          : 'bg-transparent text-text-muted border-transparent hover:text-text-main'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className={isFullscreen 
      ? "fixed inset-0 z-[9999] bg-bg-main flex flex-col" 
      : "w-full h-[500px] border border-border-color rounded-lg overflow-hidden flex flex-col my-4 bg-bg-sidebar shadow-sm"
    }>
      <div className="h-10 bg-[#1f2937] flex items-center justify-between px-2 border-b border-border-color shrink-0">
        <div className="flex gap-0.5 h-full items-center">
          <TabButton id="js" label="JS" icon={FileCode} />
          <TabButton id="html" label="HTML" icon={Globe} />
          <TabButton id="css" label="CSS" icon={Palette} />
          <TabButton id="result" label="Result" icon={Layout} />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={runCode}
            className="px-3 py-1 rounded bg-accent-color text-white text-[0.7rem] font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Play size={12} fill="white" /> RUN
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`flex-1 h-full ${activeTab === 'result' ? 'hidden' : 'block'}`}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={activeTab === 'js' ? 'javascript' : activeTab === 'html' ? 'html' : 'css'}
            value={activeTab === 'js' ? jsCode : (activeTab === 'html' ? htmlCode : (activeTab === 'css' ? cssCode : ''))}
            onMount={handleEditorDidMount}
            onChange={(val) => {
              if (activeTab === 'js') setJsCode(val || '');
              else if (activeTab === 'html') setHtmlCode(val || '');
              else if (activeTab === 'css') setCssCode(val || '');
            }}
            options={{
              minimap: { enabled: false }, 
              fontSize: 13, 
              scrollBeyondLastLine: false,
              automaticLayout: true, 
              padding: { top: 10 }, 
              fixedOverflowWidgets: true,
              readOnly: false,
              contextmenu: true,
              copyWithSyntaxHighlighting: true
            }}
          />
        </div>

        <div className={`flex-1 h-full bg-white flex-col ${activeTab === 'result' ? 'flex' : 'hidden'}`}>
          <iframe
            ref={iframeRef}
            title="Preview"
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};
