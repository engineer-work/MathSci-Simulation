import React from 'react';
import { useStore } from '../../store/useStore';
import { Search, Grid, List, Box, Cpu, Zap, Activity, Layers, Activity as Waveform } from 'lucide-react';

const ComponentLibrary: React.FC = () => {
  const { addComponent } = useStore();

  const primitives = [
    { id: 'resistor', name: 'Resistor', type: 'R', icon: <Zap size={16} />, properties: { value: 1000, tolerance: 5 } },
    { id: 'capacitor', name: 'Capacitor', type: 'C', icon: <Layers size={16} />, properties: { value: 1e-6, voltage: 16 } },
    { id: 'inductor', name: 'Inductor', type: 'L', icon: <Activity size={16} />, properties: { value: 1e-3, current: 1 } },
    { id: 'diode', name: 'Diode', type: 'D', icon: <Box size={16} />, properties: { model: '1N4148' } },
    { id: 'bjt', name: 'BJT Transistor', type: 'Q', icon: <Cpu size={16} />, properties: { model: '2N2222' } },
    { id: 'mosfet', name: 'MOSFET', type: 'M', icon: <Cpu size={16} />, properties: { model: 'IRF540' } },
    { id: 'opamp', name: 'Op-Amp', type: 'U', icon: <Waveform size={16} />, properties: { model: 'LM741' } },
  ];

  const handleAddComponent = (primitive: any) => {
    addComponent({
      type: primitive.type,
      x: 100,
      y: 100,
      properties: { ...primitive.properties }
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-white/10">
      <div className="p-4 border-b border-white/10">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Library</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search components..."
            className="w-full bg-slate-800 border border-white/10 rounded-md pl-9 pr-3 py-2 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primitives</label>
          <div className="grid grid-cols-2 gap-2">
            {primitives.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAddComponent(p)}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all group"
              >
                <div className="text-slate-400 group-hover:text-blue-400 transition-colors">
                  {p.icon}
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-white font-medium text-center">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Modules</label>
          <div className="p-4 rounded-lg border border-dashed border-white/10 text-center">
            <p className="text-[10px] text-slate-500 italic">No modules found</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentLibrary;
