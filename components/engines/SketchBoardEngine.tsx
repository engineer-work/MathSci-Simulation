
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Circle, Text as KonvaText, Transformer } from 'react-konva';
import { 
  Pencil, 
  Eraser, 
  Square, 
  Circle as CircleIcon, 
  Type, 
  Undo, 
  Redo, 
  Download, 
  Upload, 
  Trash2, 
  Settings,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Palette,
  Minus,
  Brush,
  Save,
  FileJson,
  Image as ImageIcon,
  X,
  MousePointer2,
  Play,
  Pause
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';

interface SketchAnimation {
  property: 'x' | 'y' | 'rotation' | 'opacity' | 'scaleX' | 'scaleY' | 'radius' | 'width' | 'height';
  equation: string;
  enabled: boolean;
}

interface SketchElement {
  id: string;
  type: 'line' | 'rect' | 'circle' | 'text';
  tool: 'pen' | 'pencil' | 'eraser' | 'brush' | 'rect' | 'circle' | 'text' | 'select';
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  opacity?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  animation?: SketchAnimation;
  physics?: {
    isStatic?: boolean;
    restitution?: number;
    friction?: number;
    density?: number;
    velocity?: { x: number; y: number };
    angularVelocity?: number;
    enabled?: boolean;
  };
}

interface SketchConstraint {
  id: string;
  bodyAId: string;
  bodyBId?: string; // If null, pinned to world
  pointA?: { x: number; y: number };
  pointB?: { x: number; y: number };
  length?: number;
  stiffness?: number;
  damping?: number;
  label?: string;
}

interface SketchConfig {
  internal_block_id: string;
  elements: SketchElement[];
  constraints?: SketchConstraint[];
  width?: number;
  height?: number;
  backgroundColor?: string;
  blobId?: string; // For saving a high-res snapshot
  physicsEnabled?: boolean;
  gravity?: { x: number; y: number };
}

export const SketchBoardEngine = ({ 
  configStr, 
  onUpdate,
  readOnly = false 
}: { 
  configStr: string; 
  onUpdate: (newStr: string) => void;
  readOnly?: boolean;
}) => {
  const [config, setConfig] = useState<SketchConfig | null>(null);
  const [elements, setElements] = useState<SketchElement[]>([]);
  const [tool, setTool] = useState<'select' | 'pen' | 'pencil' | 'eraser' | 'brush' | 'rect' | 'circle' | 'text'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<SketchElement[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Modal states
  const [modal, setModal] = useState<{
    type: 'confirm' | 'prompt';
    title: string;
    message: string;
    value?: string;
    onConfirm: (val?: string) => void;
  } | null>(null);

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const engineRef = useRef<any>(null);
  const bodiesRef = useRef<{ [key: string]: any }>({});
  const physicsRequestRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();

    return () => observer.disconnect();
  }, [isMaximized, isMinimized]);

  useEffect(() => {
    if (isAnimating) {
      const start = Date.now();
      const animate = () => {
        setTime((Date.now() - start) / 1000);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isAnimating]);

  // Physics Engine Setup
  useEffect(() => {
    if (!config?.physicsEnabled || readOnly) {
      if (engineRef.current) {
        const { Engine, World } = (window as any).Matter;
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
        engineRef.current = null;
      }
      return;
    }

    const { Engine, World, Bodies, Composite, Body, Constraint } = (window as any).Matter;
    if (!Engine) return;

    if (!engineRef.current) {
      engineRef.current = Engine.create();
    }

    const engine = engineRef.current;
    engine.world.gravity.x = config.gravity?.x ?? 0;
    engine.world.gravity.y = config.gravity?.y ?? 1;

    World.clear(engine.world, false);
    bodiesRef.current = {};

    const newBodies: any[] = [];
    const bodiesMap = new Map<string, any>();

    elements.forEach(el => {
      if (!el.physics?.enabled && !el.physics?.isStatic) return;

      let body;
      const options = {
        isStatic: el.physics?.isStatic || false,
        restitution: el.physics?.restitution ?? 0,
        friction: el.physics?.friction ?? 0.1,
        density: el.physics?.density ?? 0.001,
        label: el.id
      };

      if (el.type === 'rect') {
        body = Bodies.rectangle((el.x || 0) + (el.width || 0) / 2, (el.y || 0) + (el.height || 0) / 2, el.width || 10, el.height || 10, options);
      } else if (el.type === 'circle') {
        body = Bodies.circle(el.x || 0, el.y || 0, el.radius || 10, options);
      }

      if (body) {
        if (el.physics?.velocity) {
          Body.setVelocity(body, el.physics.velocity);
        }
        if (el.physics?.angularVelocity) {
          Body.setAngularVelocity(body, el.physics.angularVelocity);
        }
        bodiesRef.current[el.id] = body;
        bodiesMap.set(el.id, body);
        newBodies.push(body);
      }
    });

    Composite.add(engine.world, newBodies);

    // Add constraints
    if (config.constraints) {
      (config.constraints || []).forEach(c => {
        const bodyA = bodiesMap.get(c.bodyAId);
        const bodyB = c.bodyBId ? bodiesMap.get(c.bodyBId) : null;

        if (bodyA || bodyB) {
          const constraint = Constraint.create({
            bodyA: bodyA,
            bodyB: bodyB,
            pointA: c.pointA,
            pointB: c.pointB,
            length: c.length,
            stiffness: c.stiffness ?? 0.1,
            damping: c.damping ?? 0.1
          });
          Composite.add(engine.world, constraint);
        }
      });
    }

    const step = () => {
      Engine.update(engine, 1000 / 60);
      
      setElements(prev => prev.map(el => {
        const body = bodiesRef.current[el.id];
        if (body && !body.isStatic) {
          if (el.type === 'rect') {
            return {
              ...el,
              x: body.position.x - (el.width || 0) / 2,
              y: body.position.y - (el.height || 0) / 2,
              rotation: (body.angle * 180) / Math.PI
            };
          } else if (el.type === 'circle') {
            return {
              ...el,
              x: body.position.x,
              y: body.position.y,
              rotation: (body.angle * 180) / Math.PI
            };
          }
        }
        return el;
      }));

      physicsRequestRef.current = requestAnimationFrame(step);
    };

    physicsRequestRef.current = requestAnimationFrame(step);

    return () => {
      if (physicsRequestRef.current) cancelAnimationFrame(physicsRequestRef.current);
    };
  }, [config?.physicsEnabled, config?.gravity, readOnly, elements.length]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
      setElements(parsed.elements || []);
    } catch (e) {
      console.error("Failed to parse sketch config", e);
    }
  }, [configStr]);

  const updateConfig = useCallback((updates: Partial<SketchConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate(JSON.stringify(newConfig, null, 2));
  }, [config, onUpdate]);

  const handleMouseDown = (e: any) => {
    if (readOnly) return;
    
    // If clicking on an empty area and in select mode, deselect
    if (tool === 'select' && e.target === e.target.getStage()) {
      setSelectedId(null);
      return;
    }

    if (tool === 'select' || tool === 'text') return;
    
    const pos = e.target.getStage().getPointerPosition();
    setIsDrawing(true);
    
    let newElement: SketchElement;
    
    if (['pen', 'pencil', 'eraser', 'brush'].includes(tool)) {
      newElement = {
        id: uuidv4(),
        type: 'line',
        tool: tool as any,
        points: [pos.x, pos.y],
        stroke: tool === 'eraser' ? (config?.backgroundColor || '#000000') : color,
        strokeWidth: tool === 'brush' ? strokeWidth * 3 : strokeWidth,
        opacity: tool === 'pencil' ? 0.5 : 1,
      };
    } else if (tool === 'rect') {
      newElement = {
        id: uuidv4(),
        type: 'rect',
        tool: 'pen',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: color,
        strokeWidth: strokeWidth,
      };
    } else if (tool === 'circle') {
      newElement = {
        id: uuidv4(),
        type: 'circle',
        tool: 'pen',
        x: pos.x,
        y: pos.y,
        radius: 0,
        stroke: color,
        strokeWidth: strokeWidth,
      };
    } else {
      return;
    }

    setElements([...elements, newElement]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || readOnly) return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastElement = elements[elements.length - 1];
    
    if (!lastElement) return;

    const newElements = [...elements];
    const current = { ...lastElement };

    if (current.type === 'line') {
      current.points = [...(current.points || []), point.x, point.y];
    } else if (current.type === 'rect') {
      current.width = point.x - (current.x || 0);
      current.height = point.y - (current.y || 0);
    } else if (current.type === 'circle') {
      const dx = point.x - (current.x || 0);
      const dy = point.y - (current.y || 0);
      current.radius = Math.sqrt(dx * dx + dy * dy);
    }

    newElements[newElements.length - 1] = current;
    setElements(newElements);
  };

  const handleMouseUp = () => {
    if (readOnly) return;
    setIsDrawing(false);
    
    // Add to history for undo/redo
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push([...elements]);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
    
    updateConfig({ elements });
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      const prev = history[historyStep - 1];
      setElements(prev);
      setHistoryStep(historyStep - 1);
      updateConfig({ elements: prev });
    } else if (historyStep === 0) {
      setElements([]);
      setHistoryStep(-1);
      updateConfig({ elements: [] });
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const next = history[historyStep + 1];
      setElements(next);
      setHistoryStep(historyStep + 1);
      updateConfig({ elements: next });
    }
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = `sketch-${config?.internal_block_id || 'board'}.png`;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setModal({
      type: 'confirm',
      title: 'Clear Canvas',
      message: 'Are you sure you want to clear everything? This cannot be undone.',
      onConfirm: () => {
        setElements([]);
        updateConfig({ elements: [] });
        setHistory([]);
        setHistoryStep(-1);
        setModal(null);
      }
    });
  };

  const handleTextClick = (e: any) => {
    if (tool !== 'text' || readOnly) return;
    const pos = e.target.getStage().getPointerPosition();
    
    setModal({
      type: 'prompt',
      title: 'Add Text',
      message: 'Enter the text you want to add:',
      value: '',
      onConfirm: (text) => {
        if (text) {
          const newElement: SketchElement = {
            id: uuidv4(),
            type: 'text',
            tool: 'pen',
            x: pos.x,
            y: pos.y,
            text: text,
            stroke: color,
            strokeWidth: 1,
          };
          const newElements = [...elements, newElement];
          setElements(newElements);
          updateConfig({ elements: newElements });
        }
        setModal(null);
      }
    });
  };

  const getAnimatedValue = (el: SketchElement, prop: string, baseValue: number) => {
    if (!el.animation || !el.animation.enabled || el.animation.property !== prop) return baseValue;
    try {
      const scope = {
        t: time,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        abs: Math.abs,
        sqrt: Math.sqrt,
        pow: Math.pow,
        PI: Math.PI,
        random: Math.random,
      };
      
      let result: number;
      
      // Use mathjs if available for safer and more powerful evaluation
      if ((window as any).math) {
        result = (window as any).math.evaluate(el.animation.equation, scope);
      } else {
        const func = new Function(...Object.keys(scope), `return ${el.animation.equation}`);
        result = func(...Object.values(scope));
      }
      
      if (typeof result === 'number' && !isNaN(result)) {
        if (prop === 'opacity') return Math.max(0, Math.min(1, result));
        return baseValue + result;
      }
    } catch (e) {
      // Silently fail for bad equations
    }
    return baseValue;
  };

  const applyPreset = (presetName: string) => {
    let newElements: SketchElement[] = [];
    let newConstraints: SketchConstraint[] = [];
    let newGravity = { x: 0, y: 1 };

    if (presetName === 'pendulum') {
      const anchorId = uuidv4();
      const ballId = uuidv4();
      newElements = [
        {
          id: anchorId,
          type: 'circle',
          tool: 'rect',
          x: 400,
          y: 100,
          radius: 5,
          stroke: '#ffffff',
          strokeWidth: 2,
          fill: '#ffffff',
          physics: { enabled: true, isStatic: true }
        },
        {
          id: ballId,
          type: 'circle',
          tool: 'circle',
          x: 600,
          y: 100,
          radius: 20,
          stroke: '#3b82f6',
          strokeWidth: 2,
          fill: '#3b82f6',
          physics: { enabled: true, restitution: 0.9 }
        }
      ];
      newConstraints = [
        {
          id: uuidv4(),
          bodyAId: anchorId,
          bodyBId: ballId,
          length: 200,
          stiffness: 0.9
        }
      ];
    } else if (presetName === 'newtons-cradle') {
      for (let i = 0; i < 5; i++) {
        const anchorId = uuidv4();
        const ballId = uuidv4();
        newElements.push(
          {
            id: anchorId,
            type: 'circle',
            tool: 'rect',
            x: 300 + i * 42,
            y: 100,
            radius: 5,
            stroke: '#ffffff',
            strokeWidth: 2,
            fill: '#ffffff',
            physics: { enabled: true, isStatic: true }
          },
          {
            id: ballId,
            type: 'circle',
            tool: 'circle',
            x: 300 + i * 42 + (i === 0 ? -100 : 0),
            y: 100 + (i === 0 ? -50 : 0),
            radius: 20,
            stroke: '#3b82f6',
            strokeWidth: 2,
            fill: '#3b82f6',
            physics: { enabled: true, restitution: 1, friction: 0 }
          }
        );
        newConstraints.push({
          id: uuidv4(),
          bodyAId: anchorId,
          bodyBId: ballId,
          length: 200,
          stiffness: 1
        });
      }
    }

    setElements(newElements);
    updateConfig({ elements: newElements, constraints: newConstraints, gravity: newGravity, physicsEnabled: true });
  };

  if (!config) return null;

  return (
    <div className={`flex flex-col border border-white/10 rounded-2xl overflow-hidden bg-[#0a0a0a] shadow-2xl transition-all duration-500 ${isMaximized ? 'fixed inset-0 z-50 m-0 rounded-none' : 'my-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Pencil className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-widest">Sketch Board</h3>
            <p className="text-[0.6rem] text-white/40 font-mono">
              {elements.length} Elements | {tool.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button 
                onClick={handleUndo}
                disabled={historyStep < 0}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                title="Undo"
              >
                <Undo className="w-4 h-4 text-white" />
              </button>
              <button 
                onClick={handleRedo}
                disabled={historyStep >= history.length - 1}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                title="Redo"
              >
                <Redo className="w-4 h-4 text-white" />
              </button>
              <div className="w-[1px] h-4 bg-white/10 mx-1" />
            </>
          )}
          <button 
            onClick={handleExport}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Export as Image"
          >
            <Download className="w-4 h-4 text-white" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/10 text-white'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {!isMinimized && !readOnly && (
        <div className="flex items-center gap-1 px-4 py-2 bg-white/5 border-b border-white/10 overflow-x-auto no-scrollbar">
          {[
            { id: 'select', icon: MousePointer2, label: 'Select' },
            { id: 'pen', icon: Pencil, label: 'Pen' },
            { id: 'pencil', icon: Minus, label: 'Pencil' },
            { id: 'brush', icon: Brush, label: 'Brush' },
            { id: 'eraser', icon: Eraser, label: 'Eraser' },
            { id: 'rect', icon: Square, label: 'Rectangle' },
            { id: 'circle', icon: CircleIcon, label: 'Circle' },
            { id: 'text', icon: Type, label: 'Text' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap ${tool === t.id ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-white/60 hover:bg-white/10'}`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
          
          <div className="w-[1px] h-6 bg-white/10 mx-2 shrink-0" />
          
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setIsAnimating(!isAnimating)}
              className={`p-2 rounded-lg transition-colors ${isAnimating ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}
              title={isAnimating ? "Pause Animation" : "Play Animation"}
            >
              {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button 
              onClick={() => setTime(0)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white/40 rounded-lg transition-colors"
              title="Reset Animation Time"
            >
              <Undo className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
              <Palette className="w-3.5 h-3.5 text-white/40" />
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)}
                className="w-5 h-5 bg-transparent border-none cursor-pointer"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
              <span className="text-[0.6rem] font-mono text-white/40">SIZE</span>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={strokeWidth} 
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-[0.6rem] font-mono text-white/60 w-4">{strokeWidth}</span>
            </div>
          </div>

          <button 
            onClick={handleClear}
            className="ml-auto p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className={`relative flex-1 bg-[#111] overflow-hidden transition-all duration-300 ${isMinimized ? 'h-0' : 'h-[500px]'}`}
        style={{ height: isMaximized ? 'calc(100vh - 100px)' : (isMinimized ? '0' : '500px') }}
      >
        <Stage
          width={dimensions.width}
          height={dimensions.height}
          ref={stageRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleTextClick}
          className="cursor-crosshair"
        >
          <Layer>
            {/* Render Constraints */}
            {config.constraints?.map(c => {
              const elA = elements.find(e => e.id === c.bodyAId);
              const elB = c.bodyBId ? elements.find(e => e.id === c.bodyBId) : null;
              
              if (!elA) return null;
              
              const startX = elA.type === 'circle' ? elA.x! : elA.x! + (elA.width || 0) / 2;
              const startY = elA.type === 'circle' ? elA.y! : elA.y! + (elA.height || 0) / 2;
              
              let endX = c.pointB?.x ?? 0;
              let endY = c.pointB?.y ?? 0;
              
              if (elB) {
                endX = elB.type === 'circle' ? elB.x! : elB.x! + (elB.width || 0) / 2;
                endY = elB.type === 'circle' ? elB.y! : elB.y! + (elB.height || 0) / 2;
              }
              
              return (
                <Line
                  key={c.id}
                  points={[startX, startY, endX, endY]}
                  stroke="#ffffff"
                  strokeWidth={1}
                  dash={[5, 5]}
                  opacity={0.3}
                />
              );
            })}

            {elements.map((el, i) => {
              const x = getAnimatedValue(el, 'x', el.x || 0);
              const y = getAnimatedValue(el, 'y', el.y || 0);
              const rotation = getAnimatedValue(el, 'rotation', el.rotation || 0);
              const opacity = getAnimatedValue(el, 'opacity', el.opacity || 1);
              const scaleX = getAnimatedValue(el, 'scaleX', el.scaleX || 1);
              const scaleY = getAnimatedValue(el, 'scaleY', el.scaleY || 1);

              if (el.type === 'line') {
                return (
                  <Line
                    key={el.id}
                    points={el.points}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    opacity={opacity}
                    x={x}
                    y={y}
                    rotation={rotation}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    onClick={() => {
                      if (tool === 'select') {
                        setSelectedId(el.id);
                        setShowSettings(true);
                      }
                    }}
                    draggable={tool === 'select'}
                    onDragEnd={(e) => {
                      const newElements = elements.map(item => 
                        item.id === el.id 
                          ? { ...item, x: e.target.x(), y: e.target.y() }
                          : item
                      );
                      setElements(newElements);
                      updateConfig({ elements: newElements });
                    }}
                    globalCompositeOperation={
                      el.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                  />
                );
              } else if (el.type === 'rect') {
                const width = getAnimatedValue(el, 'width', el.width || 0);
                const height = getAnimatedValue(el, 'height', el.height || 0);
                return (
                  <Rect
                    key={el.id}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    rotation={rotation}
                    opacity={opacity}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    onClick={() => {
                      if (tool === 'select') {
                        setSelectedId(el.id);
                        setShowSettings(true);
                      }
                    }}
                    draggable={tool === 'select'}
                    onDragEnd={(e) => {
                      const newElements = elements.map(item => 
                        item.id === el.id 
                          ? { ...item, x: e.target.x(), y: e.target.y() }
                          : item
                      );
                      setElements(newElements);
                      updateConfig({ elements: newElements });
                    }}
                  />
                );
              } else if (el.type === 'circle') {
                const radius = getAnimatedValue(el, 'radius', el.radius || 0);
                return (
                  <Circle
                    key={el.id}
                    x={x}
                    y={y}
                    radius={radius}
                    stroke={el.stroke}
                    strokeWidth={el.strokeWidth}
                    rotation={rotation}
                    opacity={opacity}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    onClick={() => {
                      if (tool === 'select') {
                        setSelectedId(el.id);
                        setShowSettings(true);
                      }
                    }}
                    draggable={tool === 'select'}
                    onDragEnd={(e) => {
                      const newElements = elements.map(item => 
                        item.id === el.id 
                          ? { ...item, x: e.target.x(), y: e.target.y() }
                          : item
                      );
                      setElements(newElements);
                      updateConfig({ elements: newElements });
                    }}
                  />
                );
              } else if (el.type === 'text') {
                return (
                  <KonvaText
                    key={el.id}
                    x={x}
                    y={y}
                    text={el.text}
                    fill={el.stroke}
                    fontSize={20 + strokeWidth}
                    rotation={rotation}
                    opacity={opacity}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    onClick={() => {
                      if (tool === 'select') {
                        setSelectedId(el.id);
                        setShowSettings(true);
                      }
                    }}
                    draggable={tool === 'select'}
                    onDragEnd={(e) => {
                      const newElements = elements.map(item => 
                        item.id === el.id 
                          ? { ...item, x: e.target.x(), y: e.target.y() }
                          : item
                      );
                      setElements(newElements);
                      updateConfig({ elements: newElements });
                    }}
                  />
                );
              }
              return null;
            })}
          </Layer>
        </Stage>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute top-4 right-4 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl z-10 animate-in fade-in slide-in-from-right-4 max-h-[90%] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[0.7rem] font-bold text-white uppercase tracking-widest">Board Settings</h4>
              <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="pt-4 border-t border-white/5">
                <label className="text-[0.6rem] text-white/40 uppercase tracking-widest block mb-2">Physics Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => applyPreset('pendulum')}
                    className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[0.6rem] font-bold text-white uppercase tracking-widest transition-all"
                  >
                    Pendulum
                  </button>
                  <button 
                    onClick={() => applyPreset('newtons-cradle')}
                    className="py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[0.6rem] font-bold text-white uppercase tracking-widest transition-all"
                  >
                    Newton's Cradle
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[0.6rem] text-white/40 uppercase tracking-widest block mb-2">Background</label>
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                  <input 
                    type="color" 
                    value={config.backgroundColor || '#111111'} 
                    onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
                    className="w-6 h-6 bg-transparent border-none cursor-pointer"
                  />
                  <span className="text-[0.65rem] font-mono text-white/60 uppercase">{config.backgroundColor || '#111111'}</span>
                </div>
              </div>

              {selectedId ? (
                <div className="pt-4 border-t border-white/5">
                  <label className="text-[0.6rem] text-white/40 uppercase tracking-widest block mb-2">Animation Editor</label>
                  {(() => {
                    const el = elements.find(e => e.id === selectedId);
                    if (!el) return null;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[0.6rem] text-white/60">Enabled</span>
                          <input 
                            type="checkbox" 
                            checked={el.animation?.enabled || false}
                            onChange={(e) => {
                              const newElements = elements.map(item => 
                                item.id === selectedId 
                                  ? { ...item, animation: { ...(item.animation || { property: 'x', equation: '50 * sin(t * 2)', enabled: true }), enabled: e.target.checked } }
                                  : item
                              );
                              setElements(newElements);
                              updateConfig({ elements: newElements });
                            }}
                            className="w-4 h-4 accent-purple-500"
                          />
                        </div>
                        
                        <div>
                          <span className="text-[0.6rem] text-white/40 block mb-1">Property</span>
                          <select 
                            value={el.animation?.property || 'x'}
                            onChange={(e) => {
                              const newElements = elements.map(item => 
                                item.id === selectedId 
                                  ? { ...item, animation: { ...(item.animation || { property: 'x', equation: '50 * sin(t * 2)', enabled: true }), property: e.target.value as any } }
                                  : item
                              );
                              setElements(newElements);
                              updateConfig({ elements: newElements });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[0.65rem] text-white"
                          >
                            {['x', 'y', 'rotation', 'opacity', 'scaleX', 'scaleY', 'radius', 'width', 'height'].map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <span className="text-[0.6rem] text-white/40 block mb-1">Equation (t = time)</span>
                          <input 
                            type="text"
                            value={el.animation?.equation || '50 * sin(t * 2)'}
                            onChange={(e) => {
                              const newElements = elements.map(item => 
                                item.id === selectedId 
                                  ? { ...item, animation: { ...(item.animation || { property: 'x', equation: '50 * sin(t * 2)', enabled: true }), equation: e.target.value } }
                                  : item
                              );
                              setElements(newElements);
                              updateConfig({ elements: newElements });
                            }}
                            placeholder="e.g. 50 * sin(t * 2)"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[0.65rem] text-white font-mono"
                          />
                        </div>

                        <button 
                          onClick={() => {
                            const newElements = elements.filter(item => item.id !== selectedId);
                            setElements(newElements);
                            updateConfig({ elements: newElements });
                            setSelectedId(null);
                          }}
                          className="w-full py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-[0.6rem] text-red-400 uppercase tracking-widest mb-2"
                        >
                          Delete Element
                        </button>

                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[0.6rem] text-white/60 uppercase tracking-widest">Physics</span>
                            <input 
                              type="checkbox" 
                              checked={el.physics?.enabled || false}
                              onChange={(e) => {
                                const newElements = elements.map(item => 
                                  item.id === selectedId 
                                    ? { ...item, physics: { ...(item.physics || { restitution: 0.5, friction: 0.1, enabled: true }), enabled: e.target.checked } }
                                    : item
                                );
                                setElements(newElements);
                                updateConfig({ elements: newElements });
                              }}
                              className="w-4 h-4 accent-blue-500"
                            />
                          </div>
                          {el.physics?.enabled && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[0.6rem] text-white/40">Static</span>
                                <input 
                                  type="checkbox" 
                                  checked={el.physics?.isStatic || false}
                                  onChange={(e) => {
                                    const newElements = elements.map(item => 
                                      item.id === selectedId 
                                        ? { ...item, physics: { ...item.physics!, isStatic: e.target.checked } }
                                        : item
                                    );
                                    setElements(newElements);
                                    updateConfig({ elements: newElements });
                                  }}
                                  className="w-4 h-4 accent-blue-500"
                                />
                              </div>
                              <div>
                                <span className="text-[0.6rem] text-white/40 block mb-1">Restitution: {el.physics?.restitution ?? 0.5}</span>
                                <input 
                                  type="range" min="0" max="1" step="0.1"
                                  value={el.physics?.restitution ?? 0.5}
                                  onChange={(e) => {
                                    const newElements = elements.map(item => 
                                      item.id === selectedId 
                                        ? { ...item, physics: { ...item.physics!, restitution: parseFloat(e.target.value) } }
                                        : item
                                    );
                                    setElements(newElements);
                                    updateConfig({ elements: newElements });
                                  }}
                                  className="w-full accent-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <button 
                          onClick={() => setSelectedId(null)}
                          className="w-full py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[0.6rem] text-white/60 uppercase tracking-widest mt-2"
                        >
                          Deselect Element
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.6rem] text-white/60 uppercase tracking-widest">Global Physics</span>
                    <input 
                      type="checkbox" 
                      checked={config?.physicsEnabled || false}
                      onChange={(e) => updateConfig({ physicsEnabled: e.target.checked })}
                      className="w-4 h-4 accent-blue-500"
                    />
                  </div>
                  {config?.physicsEnabled && (
                    <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10">
                      <div>
                        <span className="text-[0.6rem] text-white/40 block mb-1">Gravity Y: {config?.gravity?.y ?? 1}</span>
                        <input 
                          type="range" min="-2" max="2" step="0.1"
                          value={config?.gravity?.y ?? 1}
                          onChange={(e) => updateConfig({ gravity: { ...(config?.gravity || { x: 0 }), y: parseFloat(e.target.value) } })}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                  )}
                  <div className="pt-4 border-t border-white/5 text-center py-4">
                    <p className="text-[0.6rem] text-white/30 uppercase tracking-widest">Select an element to animate or enable physics</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5">
                <button 
                  onClick={() => {
                    const json = JSON.stringify(config);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `sketch-${config.internal_block_id}.json`;
                    link.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[0.65rem] font-bold text-white uppercase tracking-widest transition-all mb-2"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Export JSON
                </button>
                
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-[0.65rem] font-bold text-purple-400 uppercase tracking-widest transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import JSON
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const text = await file.text();
                      try {
                        const parsed = JSON.parse(text);
                        setElements(parsed.elements || []);
                        updateConfig({ elements: parsed.elements || [] });
                      } catch (err) {
                        alert('Invalid JSON file');
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-bold text-white mb-2">{modal.title}</h4>
            <p className="text-xs text-white/60 mb-6">{modal.message}</p>
            
            {modal.type === 'prompt' && (
              <input 
                type="text" 
                autoFocus
                value={modal.value}
                onChange={(e) => setModal({ ...modal, value: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && modal.onConfirm(modal.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white mb-6 focus:outline-none focus:border-purple-500 transition-colors"
              />
            )}

            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setModal(null)}
                className="px-4 py-2 text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => modal.onConfirm(modal.value)}
                className="px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20"
              >
                {modal.type === 'confirm' ? 'Confirm' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
