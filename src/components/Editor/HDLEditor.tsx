import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../../store/useStore';
import { Play, Save, Download, FileCode, Terminal } from 'lucide-react';

const HDLEditor: React.FC = () => {
  const { activeProjectId, projects, updateHDL } = useStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const initialCode = activeProject?.hdlCode || '';
  const [code, setCode] = useState<string>(initialCode);

  const handleSave = () => {
    updateHDL(code);
    console.log("HDL Code saved:", code);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'module.v';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={16} className="text-blue-400" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">HDL Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors" title="Save">
            <Save size={16} />
          </button>
          <button onClick={handleDownload} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors" title="Download">
            <Download size={16} />
          </button>
          <button className="flex items-center gap-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[10px] font-bold transition-all">
            <Play size={12} fill="currentColor" /> Synthesize
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="verilog"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 20 }
          }}
        />
      </div>

      <div className="h-32 border-t border-white/10 bg-slate-950 p-4 flex flex-col shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Terminal size={12} className="text-slate-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Console</span>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1">
          <p className="text-emerald-500/80">[INFO] HDL Editor initialized.</p>
          <p className="text-slate-500">[INFO] Ready for synthesis.</p>
        </div>
      </div>
    </div>
  );
};

export default HDLEditor;
