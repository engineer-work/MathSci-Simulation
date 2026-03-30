import React from 'react';
import { useStore } from '../../store/useStore';
import { X, Settings, Trash2 } from 'lucide-react';

const PropertiesPanel: React.FC = () => {
  const { selectedComponentId, projects, activeProjectId, updateComponent, removeComponent, setSelectedComponentId } = useStore();
  
  const activeProject = projects.find(p => p.id === activeProjectId);
  const components = activeProject?.components || [];
  const selectedComponent = components.find(c => c.id === selectedComponentId);

  if (!selectedComponent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
        <Settings size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Select a component to view its properties</p>
      </div>
    );
  }

  const handlePropertyChange = (key: string, value: any) => {
    updateComponent(selectedComponent.id, {
      properties: {
        ...selectedComponent.properties,
        [key]: value
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Properties</h3>
        <button 
          onClick={() => setSelectedComponentId(null)}
          className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Component Info</label>
          <div className="bg-white/5 p-3 rounded-lg border border-white/5">
            <p className="text-xs text-white font-medium">{selectedComponent.type}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-1">{selectedComponent.id}</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Parameters</label>
          {Object.entries(selectedComponent.properties).map(([key, value]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-400 capitalize">{key}</label>
              <input
                type={typeof value === 'number' ? 'number' : 'text'}
                value={value as string | number}
                onChange={(e) => handlePropertyChange(key, typeof value === 'number' ? parseFloat(e.target.value) : e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-md px-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
              />
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10">
          <button
            onClick={() => {
              removeComponent(selectedComponent.id);
              setSelectedComponentId(null);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all"
          >
            <Trash2 size={14} /> Delete Component
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
