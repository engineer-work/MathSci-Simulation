import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface Component {
  id: string;
  type: string;
  x: number;
  y: number;
  properties: Record<string, any>;
}

export interface Wire {
  id: string;
  from: string;
  to: string;
  points: { x: number; y: number }[];
}

export interface Project {
  id: string;
  name: string;
  components: Component[];
  wires: Wire[];
  hdlCode: string;
}

export interface AppState {
  projects: Project[];
  activeProjectId: string | null;
  selectedComponentId: string | null;
  simulationStatus: 'idle' | 'running' | 'complete';
  simulationResults: any;
  
  // Actions
  addProject: (name: string) => void;
  removeProject: (id: string) => void;
  setActiveProjectId: (id: string | null) => void;
  setSelectedComponentId: (id: string | null) => void;
  
  addComponent: (comp: Omit<Component, 'id'>) => void;
  updateComponent: (id: string, updates: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  
  addWire: (wire: Omit<Wire, 'id'>) => void;
  removeWire: (id: string) => void;
  
  updateHDL: (code: string) => void;
  setSimulationStatus: (status: 'idle' | 'running' | 'complete') => void;
  setSimulationResults: (results: any) => void;
  startSimulation: () => void;
  
  exportProject: (id: string) => string;
  importProject: (json: string) => void;
}

const initialProject: Project = {
  id: uuidv4(),
  name: 'Untitled Project',
  components: [],
  wires: [],
  hdlCode: '// Write your Verilog/VHDL here\nmodule top();\nendmodule',
};

export const useStore = create<AppState>((set, get) => ({
  projects: [initialProject],
  activeProjectId: initialProject.id,
  selectedComponentId: null,
  simulationStatus: 'idle',
  simulationResults: null,

  addProject: (name) => set((state) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      components: [],
      wires: [],
      hdlCode: '// Write your Verilog/VHDL here\nmodule top();\nendmodule',
    };
    return { projects: [...state.projects, newProject], activeProjectId: newProject.id };
  }),

  removeProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id),
    activeProjectId: state.activeProjectId === id ? (state.projects[0]?.id || null) : state.activeProjectId
  })),

  setActiveProjectId: (id) => set({ activeProjectId: id }),
  
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),

  addComponent: (comp) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        components: [...p.components, { ...comp, id: uuidv4() }]
      } : p)
    };
  }),

  updateComponent: (id, updates) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        components: p.components.map(c => c.id === id ? { ...c, ...updates } : c)
      } : p)
    };
  }),

  removeComponent: (id) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        components: p.components.filter(c => c.id !== id)
      } : p)
    };
  }),

  addWire: (wire) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        wires: [...p.wires, { ...wire, id: uuidv4() }]
      } : p)
    };
  }),

  removeWire: (id) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        wires: p.wires.filter(w => w.id !== id)
      } : p)
    };
  }),

  updateHDL: (code) => set((state) => {
    if (!state.activeProjectId) return state;
    return {
      projects: state.projects.map(p => p.id === state.activeProjectId ? {
        ...p,
        hdlCode: code
      } : p)
    };
  }),

  setSimulationStatus: (status) => set({ simulationStatus: status }),
  
  setSimulationResults: (results) => set({ simulationResults: results }),

  startSimulation: () => {
    set({ simulationStatus: 'running' });
    // This will be handled by a service or component listening to this status
  },

  exportProject: (id) => {
    const project = get().projects.find(p => p.id === id);
    return JSON.stringify(project || {});
  },

  importProject: (json) => {
    try {
      const project = JSON.parse(json);
      if (project.id) {
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id
        }));
      }
    } catch (e) {
      console.error("Failed to import project:", e);
    }
  }
}));
