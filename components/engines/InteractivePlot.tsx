
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Play, Pause, Square as StopSquare, RotateCcw, Plus, Trash2, Box, Square } from 'lucide-react';

export const InteractivePlot = ({ configStr, onUpdate }: { configStr: string, onUpdate?: (s: string) => void }) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<any>(null);
  const [params, setParams] = useState<Record<string, any>>({});
  const [expressions, setExpressions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Animation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [animatingParams, setAnimatingParams] = useState<Record<string, boolean>>({});
  const [time, setTime] = useState(0);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    try {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
      
      const initialParams: Record<string, any> = {};
      const initialAnims: Record<string, boolean> = {};
      if (parsed.params && Array.isArray(parsed.params)) {
        parsed.params.forEach((p: any) => { 
          initialParams[p.name] = p.value !== undefined ? p.value : (p.min || 0); 
          initialAnims[p.name] = false;
        });
      }
      setParams(initialParams);
      setAnimatingParams(initialAnims);
      setExpressions(parsed.traces || []);
      setError(null);
    } catch (e) { setError("Invalid JSON: " + (e as Error).message); }
  }, [configStr]);

  const animate = (timestamp: number) => {
    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    
    if (isPlaying) {
      setTime(prev => prev + deltaTime);
    }

    setParams(prev => {
      let hasChanges = false;
      const next = { ...prev };
      
      (config?.params || []).forEach((p: any) => {
        if (animatingParams[p.name] && p.type === 'slider') {
          const range = p.max - p.min;
          const speed = p.animationSpeed || 0.2; // 20% of range per second
          let newVal = (next[p.name] || p.min) + range * speed * deltaTime;
          if (newVal > p.max) newVal = p.min;
          next[p.name] = newVal;
          hasChanges = true;
        }
      });
      
      return hasChanges ? next : prev;
    });

    lastTimeRef.current = timestamp;
    requestRef.current = requestAnimationFrame(animate);
  };

  const isAnyAnimating = isPlaying || Object.values(animatingParams).some(v => v);

  useEffect(() => {
    if (isAnyAnimating) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isAnyAnimating, isPlaying, animatingParams]);

  const handleParamChange = (name: string, value: any) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const toggleParamAnimation = (name: string) => {
    setAnimatingParams(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const stopParamAnimation = (name: string) => {
    setAnimatingParams(prev => ({ ...prev, [name]: false }));
    // Optionally reset to min or initial value
    const pConfig = (config?.params || []).find((p: any) => p.name === name);
    if (pConfig) {
      setParams(prev => ({ ...prev, [name]: pConfig.value !== undefined ? pConfig.value : pConfig.min }));
    }
  };

  const handleExpressionChange = (idx: number, newExpr: string) => {
    const next = [...expressions];
    next[idx] = { ...next[idx], expr: newExpr };
    setExpressions(next);
    
    // If we have onUpdate, we can persist the change back to the markdown
    if (onUpdate && config) {
      const newConfig = { ...config, traces: next };
      onUpdate(JSON.stringify(newConfig, null, 2));
    }
  };

  useEffect(() => {
    if (!config || !window.Plotly || !window.math || !graphRef.current) return;
    try {
      const is3D = config.type === '3d';
      const traces: any[] = [];
      
      const xMin = config.xAxis?.min ?? -10;
      const xMax = config.xAxis?.max ?? 10;
      const yMin = config.yAxis?.min ?? -10;
      const yMax = config.yAxis?.max ?? 10;
      const numPoints = config.xAxis?.points ?? (is3D ? 40 : 100);

      const xStep = (xMax - xMin) / (numPoints - 1);
      const yStep = (yMax - yMin) / (numPoints - 1);
      
      const xData = Array.from({ length: numPoints }, (_, i) => xMin + i * xStep);
      const yData = Array.from({ length: numPoints }, (_, i) => yMin + i * yStep);

      expressions.forEach((traceConfig: any) => {
        if (traceConfig.visible && params[traceConfig.visible] === false) return;
        try {
           const expr = window.math.compile(traceConfig.expr);
           const evalContext = { ...params, t: time, time: time };
           
           if (is3D) {
             // 3D Surface or Scatter
             if (traceConfig.type === 'scatter3d') {
                const zData = xData.map((x, i) => expr.evaluate({ x, y: yData[i], ...evalContext }));
                traces.push({
                  x: xData, y: yData, z: zData,
                  type: 'scatter3d', mode: 'lines',
                  name: traceConfig.name,
                  line: { width: 4, color: traceConfig.color || '#3b82f6' }
                });
             } else {
                // Default to surface
                const zData = yData.map(y => xData.map(x => {
                  try { return expr.evaluate({ x, y, ...evalContext }); } catch { return 0; }
                }));
                traces.push({
                  z: zData, x: xData, y: yData,
                  type: 'surface',
                  name: traceConfig.name,
                  colorscale: traceConfig.colorscale || 'Viridis',
                  showscale: false
                });
             }
           } else {
             // 2D Plot
             const yValues = xData.map(x => {
               try { return expr.evaluate({ x, ...evalContext }); } catch { return 0; }
             });
             traces.push({
               x: xData, y: yValues,
               type: 'scatter', mode: 'lines',
               name: traceConfig.name,
               line: { color: traceConfig.color || '#3b82f6', width: 2, shape: 'spline' }
             });
           }
        } catch (err) { console.error(err); }
      });

      const layout: any = {
        title: { text: config.title, font: { size: 14, color: '#9ca3af' } },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#9ca3af', family: 'Inter, sans-serif' },
        margin: { t: 40, r: 20, b: 40, l: 40 },
        height: is3D ? 450 : 350,
        showlegend: true,
        legend: { orientation: 'h', y: -0.2 },
        hovermode: 'closest'
      };

      if (is3D) {
        layout.scene = {
          xaxis: { title: config.xAxis?.label || 'X', gridcolor: 'rgba(128,128,128,0.1)', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: 'rgba(255,255,255,0.2)' },
          yaxis: { title: config.yAxis?.label || 'Y', gridcolor: 'rgba(128,128,128,0.1)', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: 'rgba(255,255,255,0.2)' },
          zaxis: { title: config.zAxis?.label || 'Z', gridcolor: 'rgba(128,128,128,0.1)', backgroundcolor: 'rgba(0,0,0,0)', zerolinecolor: 'rgba(255,255,255,0.2)' },
          camera: config.camera || { eye: { x: 1.5, y: 1.5, z: 1.5 } }
        };
      } else {
        layout.xaxis = { title: config.xAxis?.label || 'X', gridcolor: 'rgba(128,128,128,0.1)', zerolinecolor: 'rgba(255,255,255,0.2)' };
        layout.yaxis = { title: config.yAxis?.label || 'Y', gridcolor: 'rgba(128,128,128,0.1)', zerolinecolor: 'rgba(255,255,255,0.2)' };
      }

      window.Plotly.react(graphRef.current, traces, layout, { responsive: true, displayModeBar: false });
    } catch (e) { setError("Plot Error: " + (e as Error).message); }
  }, [config, params, expressions, time]);

  if (error) return <div className="text-red-400 text-xs p-4 bg-red-950/10 border border-red-500/50 rounded-xl my-4">{error}</div>;
  if (!config) return null;

  return (
    <div className="w-full border border-white/10 rounded-2xl overflow-hidden bg-gray-950/50 backdrop-blur-sm my-6 shadow-xl group">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {config.type === '3d' ? <Box size={14} className="text-blue-400" /> : <Square size={14} className="text-emerald-400" />}
            <span className="text-[0.7rem] font-bold text-white/50 uppercase tracking-widest">{config.title || 'Interactive Plot'}</span>
          </div>
          
          <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5 border border-white/5">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-1.5 rounded-md transition-all ${isPlaying ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            </button>
            <button 
              onClick={() => { setIsPlaying(false); setTime(0); }}
              className="p-1.5 rounded-md text-white/40 hover:bg-white/5 hover:text-white transition-all"
              title="Stop & Reset"
            >
              <StopSquare size={12} fill="currentColor" />
            </button>
            {time > 0 && (
              <span className="text-[0.6rem] font-mono text-white/30 px-2 select-none">{time.toFixed(1)}s</span>
            )}
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-blue-500/20 text-blue-400' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}
        >
          <Settings size={14} />
        </button>
      </div>

      <div ref={graphRef} className="w-full" />

      {showSettings && (
        <div className="p-4 border-t border-white/5 bg-black/40 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="space-y-2">
            <label className="text-[0.6rem] font-black text-white/30 uppercase tracking-[0.2em]">Expressions</label>
            {expressions.map((t, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={t.expr}
                    onChange={(e) => handleExpressionChange(i, e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#3b82f6' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {config.params && config.params.length > 0 && (
        <div className="p-5 border-t border-white/5 bg-white/[0.02] grid grid-cols-1 sm:grid-cols-2 gap-6">
          {config.params.map((p: any) => (
            <div key={p.name} className="flex flex-col gap-2">
               <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                   <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">{p.label || p.name}</label>
                   {p.type === 'slider' && (
                     <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5 border border-white/5">
                        <button 
                          onClick={() => toggleParamAnimation(p.name)}
                          className={`p-1 rounded transition-all ${animatingParams[p.name] ? 'bg-amber-500/20 text-amber-400' : 'text-white/30 hover:text-white'}`}
                          title={animatingParams[p.name] ? "Pause Parameter" : "Animate Parameter"}
                        >
                          {animatingParams[p.name] ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                        </button>
                        <button 
                          onClick={() => stopParamAnimation(p.name)}
                          className="p-1 text-white/30 hover:text-white transition-all"
                          title="Stop & Reset Parameter"
                        >
                          <StopSquare size={10} fill="currentColor" />
                        </button>
                     </div>
                   )}
                 </div>
                 <span className="text-[0.7rem] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                   {typeof params[p.name] === 'number' ? params[p.name].toFixed(2) : params[p.name]?.toString()}
                 </span>
               </div>
               
               {p.type === 'slider' && (
                 <input 
                   type="range" 
                   min={p.min} 
                   max={p.max} 
                   step={p.step || 0.1} 
                   value={params[p.name] || 0} 
                   onChange={(e) => handleParamChange(p.name, parseFloat(e.target.value))} 
                   className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all" 
                 />
               )}
               
               {p.type === 'number' && (
                 <input 
                   type="number" 
                   value={params[p.name] || 0} 
                   step={p.step || 1} 
                   onChange={(e) => handleParamChange(p.name, parseFloat(e.target.value))} 
                   className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 text-white transition-all" 
                 />
               )}
               
               {p.type === 'checkbox' && (
                 <button 
                   onClick={() => handleParamChange(p.name, !params[p.name])}
                   className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${params[p.name] ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                 >
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider">Toggle {p.name}</span>
                    <div className={`w-3 h-3 rounded-full ${params[p.name] ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/10'}`} />
                 </button>
               )}

               {p.type === 'button' && (
                 <button 
                   onClick={() => {
                     if (p.action === 'reset') {
                       const initial: any = {};
                       (config?.params || []).forEach((param: any) => { initial[param.name] = param.value || 0; });
                       setParams(initial);
                     }
                   }}
                   className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all text-[0.65rem] font-bold uppercase tracking-widest"
                 >
                   {p.action === 'reset' ? <RotateCcw size={12} /> : <Play size={12} />}
                   {p.label || p.name}
                 </button>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
