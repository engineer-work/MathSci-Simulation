import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import SchematicCanvas from '../Canvas/SchematicCanvas';
import ThreeDViewer from '../Visualization/ThreeDViewer';
import HDLEditor from '../Editor/HDLEditor';
import ComponentLibrary from '../Editor/ComponentLibrary';
import PropertiesPanel from '../Editor/PropertiesPanel';
import { 
  Layout, 
  Cpu, 
  Code, 
  Settings, 
  Play, 
  Download, 
  Upload, 
  Layers, 
  Box, 
  Activity,
  ChevronRight,
  Menu,
  X,
  Plus,
  Save,
  FileJson,
  Share2,
  Trash2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Dashboard: React.FC = () => {
  const { 
    projects, 
    activeProjectId, 
    setActiveProjectId, 
    addProject, 
    removeProject,
    simulationStatus,
    startSimulation,
    exportProject,
    importProject
  } = useStore();

  const [activeTab, setActiveTab] = useState<'schematic' | '3d' | 'hdl'>('schematic');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleExport = () => {
    if (!activeProjectId) return;
    const json = exportProject(activeProjectId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      importProject(json);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0 }}
        className="bg-slate-900 border-r border-white/10 flex flex-col overflow-hidden relative"
      >
        <div className="p-6 flex items-center gap-3 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Cpu className="text-white" size={20} />
          </div>
          <h1 className="font-black text-xl tracking-tighter text-white uppercase italic">AetherCAD</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Projects</span>
              <button 
                onClick={() => addProject(`Project ${projects.length + 1}`)}
                className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                  activeProjectId === project.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <Layers size={16} />
                <span className="truncate flex-1 text-left">{project.name}</span>
                {activeProjectId === project.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeProject(project.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 block mb-2">Tools</span>
            <button 
              onClick={() => setActiveTab('schematic')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'schematic' ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <Layout size={16} /> Schematic Editor
            </button>
            <button 
              onClick={() => setActiveTab('3d')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === '3d' ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <Box size={16} /> 3D PCB Viewer
            </button>
            <button 
              onClick={() => setActiveTab('hdl')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                activeTab === 'hdl' ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
            >
              <Code size={16} /> HDL Editor
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2 shrink-0">
          <button onClick={handleExport} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all">
            <FileJson size={14} /> Export Project
          </button>
          <label className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
            <Upload size={14} /> Import Project
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
            >
              {isSidebarOpen ? <Minimize2 size={18} /> : <Menu size={18} />}
            </button>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active:</span>
              <span className="text-sm font-medium text-white">{activeProject?.name || 'No Project Selected'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
              simulationStatus === 'idle' ? "bg-slate-800 text-slate-400 border-white/5" :
              simulationStatus === 'running' ? "bg-blue-500/20 text-blue-400 border-blue-500/20 animate-pulse" :
              "bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
            )}>
              <Activity size={12} />
              {simulationStatus}
            </div>
            <button 
              onClick={() => startSimulation()}
              disabled={simulationStatus === 'running'}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              <Play size={14} fill="currentColor" /> Run Simulation
            </button>
            <button 
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className="p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel (Library) */}
          <AnimatePresence>
            {activeTab === 'schematic' && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="overflow-hidden shrink-0"
              >
                <ComponentLibrary />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Canvas Area */}
          <div className="flex-1 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            <AnimatePresence mode="wait">
              {activeTab === 'schematic' && (
                <motion.div 
                  key="schematic"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="absolute inset-0"
                >
                  <SchematicCanvas />
                </motion.div>
              )}
              {activeTab === '3d' && (
                <motion.div 
                  key="3d"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute inset-0"
                >
                  <ThreeDViewer />
                </motion.div>
              )}
              {activeTab === 'hdl' && (
                <motion.div 
                  key="hdl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                >
                  <HDLEditor />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel (Properties) */}
          <AnimatePresence>
            {isRightPanelOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="overflow-hidden shrink-0"
              >
                <PropertiesPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Bar */}
        <footer className="h-8 bg-slate-900 border-t border-white/10 flex items-center justify-between px-4 text-[10px] font-medium text-slate-500 shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Activity size={10} /> Engine: SPICE-WASM v1.2</span>
            <span className="flex items-center gap-1.5"><Cpu size={10} /> Components: {activeProject?.components.length || 0}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Lat: 12ms</span>
            <span className="text-blue-400">Connected</span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
