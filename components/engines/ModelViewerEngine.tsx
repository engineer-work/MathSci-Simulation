
import React, { useState, useRef, useEffect } from 'react';
import { Upload, RotateCw, RotateCcw, Camera, Sun, Maximize2, Minimize2, Trash2, Settings, Zap, Database, Move, MousePointer2, Footprints, Plane, Play, Pause, Square, ChevronDown, ChevronUp, X, MapPin, Circle, Square as SquareIcon, Triangle, Plus, Info } from 'lucide-react';
import '../../types';
import { db } from '../../utils/db';
import { v4 as uuidv4 } from 'uuid';
import { createPortal } from 'react-dom';

interface Marker {
  id: string;
  position: string;
  normal: string;
  label: string;
  description?: string;
  color: string;
  shape: 'circle' | 'square' | 'triangle' | 'pin';
}

interface ModelConfig {
  internal_block_id: string;
  src: string; // This can be a URL, a blob ID (blob:id), or Base64 (legacy)
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  exposure?: number;
  shadowIntensity?: number;
  shadowSoftness?: number;
  environmentImage?: string;
  poster?: string;
  movementMode?: 'orbital' | 'drag' | 'walk' | 'fly';
  cameraOrbit?: string;
  cameraTarget?: string;
  fieldOfView?: string;
  animationName?: string;
  autoPlay?: boolean;
  height?: number;
  markers?: Marker[];
}

const ModelViewer = 'model-viewer' as any;

// Performance-optimized Blob Manager
const blobCache = new Map<string, string>();

export const ModelViewerEngine = ({ 
  configStr, 
  onUpdate,
  readOnly = false 
}: { 
  configStr: string; 
  onUpdate: (newStr: string) => void;
  readOnly?: boolean;
}) => {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMarkerMode, setIsMarkerMode] = useState(false);
  const [isPrecisionMode, setIsPrecisionMode] = useState(true);
  const [previewMarker, setPreviewMarker] = useState<{ position: string, normal: string } | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [perfStats, setPerfStats] = useState<{ size: number, saved: number } | null>(null);
  const [availableAnimations, setAvailableAnimations] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(configStr);
      setConfig(parsed);
    } catch (e) {
      console.error("Failed to parse model config", e);
    }
  }, [configStr]);

  // Resolve source (URL or Blob ID)
  useEffect(() => {
    if (!config?.src) return;

    const resolve = async () => {
      if (!config.src) return;

      if (config.src.startsWith('blob-id:')) {
        const id = config.src.replace('blob-id:', '');
        
        // Check cache first
        if (blobCache.has(id)) {
          setResolvedSrc(blobCache.get(id)!);
          return;
        }

        setIsLoading(true);
        try {
          const blobData = await db.blobs.get(id);
          if (blobData) {
            const url = URL.createObjectURL(blobData.data);
            blobCache.set(id, url);
            setResolvedSrc(url);
            setPerfStats({ 
              size: blobData.data.size, 
              saved: Math.round(blobData.data.size * 0.33)
            });
          } else {
            console.error("Model blob not found in DB:", id);
            setResolvedSrc(null);
          }
        } catch (err) {
          console.error("Failed to load model blob from IndexedDB", err);
          setResolvedSrc(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        // It's already a URL or a blob: URL
        setResolvedSrc(config.src);
        setPerfStats(null);
      }
    };

    resolve();
  }, [config?.src]);

  const updateConfig = (updates: Partial<ModelConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate(JSON.stringify(newConfig, null, 2));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const id = uuidv4();
      // Store in IndexedDB (Performance Expert: Zero Base64 overhead)
      await db.blobs.add({
        id,
        data: file,
        name: file.name,
        type: file.type,
        createdAt: Date.now()
      });

      updateConfig({ src: `blob-id:${id}`, alt: file.name, animationName: undefined });
    } catch (err) {
      console.error("Failed to store file in IndexedDB", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Animation loading
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleLoad = () => {
      console.log("Model loaded successfully:", viewer.src);
      const animations = viewer.availableAnimations || [];
      setAvailableAnimations(animations);
      if (animations.length > 0 && !config?.animationName) {
        // Don't auto-set to avoid unexpected behavior, but we could
      }
    };

    const handleError = (error: any) => {
      console.error("Model failed to load:", error);
      setIsLoading(false);
      // If it failed to load, maybe the URL is invalid or expired
      if (config?.src.startsWith('blob-id:')) {
        const id = config.src.replace('blob-id:', '');
        blobCache.delete(id); // Clear cache so it retries on next mount
      }
    };

    viewer.addEventListener('load', handleLoad);
    viewer.addEventListener('error', handleError);
    return () => {
      viewer.removeEventListener('load', handleLoad);
      viewer.removeEventListener('error', handleError);
    };
  }, [resolvedSrc]);

  // Handle Walk/Fly keyboard controls
  useEffect(() => {
    if (!viewerRef.current || config?.movementMode === 'orbital' || config?.movementMode === 'drag') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      // Simple walk/fly simulation by adjusting camera orbit/target
      const orbit = viewer.getCameraOrbit();
      const target = viewer.getCameraTarget();
      
      let { theta, phi, radius } = orbit;
      let { x, y, z } = target;

      const step = config?.movementMode === 'fly' ? 0.5 : 0.2;

      switch(e.key.toLowerCase()) {
        case 'w': z -= step; break;
        case 's': z += step; break;
        case 'a': x -= step; break;
        case 'd': x += step; break;
        case 'q': y += step; break;
        case 'e': y -= step; break;
        case 'arrowup': phi -= 0.1; break;
        case 'arrowdown': phi += 0.1; break;
        case 'arrowleft': theta -= 0.1; break;
        case 'arrowright': theta += 0.1; break;
      }

      viewer.cameraTarget = `${x}m ${y}m ${z}m`;
      viewer.cameraOrbit = `${theta}rad ${phi}rad ${radius}m`;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config?.movementMode]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMarkerMode || !viewerRef.current || readOnly) {
      if (previewMarker) setPreviewMarker(null);
      return;
    }

    const viewer = viewerRef.current;
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = viewer.positionAndNormalFromPoint(x, y);
    if (hit) {
      setPreviewMarker({
        position: `${hit.position.x} ${hit.position.y} ${hit.position.z}`,
        normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`
      });
    } else {
      setPreviewMarker(null);
    }
  };

  const handleModelClick = (e: React.MouseEvent) => {
    if (!isMarkerMode || !viewerRef.current || readOnly) return;

    const viewer = viewerRef.current;
    const rect = viewer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = viewer.positionAndNormalFromPoint(x, y);
    if (hit) {
      const newMarker: Marker = {
        id: uuidv4(),
        position: `${hit.position.x} ${hit.position.y} ${hit.position.z}`,
        normal: `${hit.normal.x} ${hit.normal.y} ${hit.normal.z}`,
        label: 'New Marker',
        color: '#a855f7', // purple-500
        shape: 'pin'
      };

      const markers = [...(config?.markers || []), newMarker];
      updateConfig({ markers });
      setActiveMarkerId(newMarker.id);
      setShowSettings(true);
      setIsMarkerMode(false); // Exit mode after placement
      setPreviewMarker(null);
    }
  };

  const deleteMarker = (id: string) => {
    const markers = (config?.markers || []).filter(m => m.id !== id);
    updateConfig({ markers });
    if (activeMarkerId === id) setActiveMarkerId(null);
  };

  const updateMarker = (id: string, updates: Partial<Marker>) => {
    const markers = (config?.markers || []).map(m => m.id === id ? { ...m, ...updates } : m);
    updateConfig({ markers });
  };

  if (!config) return <div className="p-4 text-red-400 bg-red-900/10 border border-red-500/50 rounded-xl">Invalid Model Configuration</div>;

  const ViewerContent = (isFull: boolean) => (
    <div 
      className={`relative w-full bg-black/40 overflow-visible transition-all duration-300 ${isMinimized && !isFull ? 'h-0 opacity-0' : ''} ${isMarkerMode ? 'cursor-crosshair' : ''}`} 
      style={{ 
        height: isFull ? '100%' : (isMinimized ? '0px' : (config.height ? `${config.height}px` : '400px')),
        minHeight: isFull || isMinimized ? '0' : '200px'
      }}
      onClick={handleModelClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPreviewMarker(null)}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-[0.6rem] font-bold text-purple-400 uppercase tracking-widest">Loading Binary Data...</p>
        </div>
      ) : resolvedSrc ? (
        <ModelViewer
          ref={viewerRef}
          src={resolvedSrc}
          alt={config.alt || "3D Model"}
          auto-rotate={config.autoRotate ? "" : undefined}
          camera-controls={config.cameraControls !== false ? "" : undefined}
          exposure={config.exposure ?? 1}
          shadow-intensity={config.shadowIntensity ?? 1}
          shadow-softness={config.shadowSoftness ?? 1}
          environment-image={config.environmentImage || "neutral"}
          poster={null}
          loading="eager"
          reveal="auto"
          touch-action="none"
          camera-orbit={config.cameraOrbit}
          camera-target={config.cameraTarget}
          field-of-view={config.fieldOfView}
          animation-name={config.animationName && availableAnimations.includes(config.animationName) ? config.animationName : undefined}
          autoplay={(config.autoPlay !== false && availableAnimations.length > 0) ? "" : undefined}
          interaction-prompt="auto"
          interaction-prompt-style="wiggle"
          interpolation-decay="200"
          style={{ 
            width: '100%', 
            height: '100%', 
            display: 'block', 
            '--poster-color': 'transparent',
            '--progress-bar-color': 'transparent'
          }}
          referrerpolicy="no-referrer"
        >
          {previewMarker && isMarkerMode && (
            <div
              slot="hotspot-preview"
              data-position={previewMarker.position}
              data-normal={previewMarker.normal}
              className="pointer-events-none"
            >
              {/* The "Ray" / Normal Line */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1px] h-20 bg-gradient-to-t from-purple-500 to-transparent animate-pulse" />
              
              {/* The Reticle */}
              <div className="relative flex items-center justify-center">
                <div className="w-4 h-4 border border-purple-500 rounded-full animate-ping absolute" />
                <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                
                {/* Precision Info */}
                <div className="absolute left-6 top-0 bg-black/80 backdrop-blur-md border border-purple-500/30 rounded px-2 py-1 whitespace-nowrap">
                  <div className="text-[0.5rem] font-mono text-purple-400 uppercase leading-none mb-1">Surface Hit</div>
                  <div className="text-[0.6rem] font-mono text-white leading-none">
                    {previewMarker.position.split(' ').map(n => parseFloat(n).toFixed(3)).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(config.markers || []).map((marker) => (
            <button
              key={marker.id}
              slot={`hotspot-${marker.id}`}
              data-position={marker.position}
              data-normal={marker.normal}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMarkerId(marker.id);
                setShowSettings(true);
              }}
              className="group/marker relative flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
            >
              <div 
                className={`flex items-center justify-center shadow-lg transition-all ${
                  marker.shape === 'circle' ? 'rounded-full w-6 h-6' :
                  marker.shape === 'square' ? 'rounded-md w-6 h-6' :
                  marker.shape === 'triangle' ? 'w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px]' :
                  'w-8 h-8' // pin
                }`}
                style={{ 
                  backgroundColor: marker.shape === 'triangle' ? 'transparent' : marker.color,
                  borderBottomColor: marker.shape === 'triangle' ? marker.color : undefined
                }}
              >
                {marker.shape === 'pin' && <MapPin size={16} className="text-white" />}
                {marker.shape === 'circle' && <Circle size={12} className="text-white fill-white" />}
                {marker.shape === 'square' && <SquareIcon size={12} className="text-white fill-white" />}
              </div>
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10 rounded text-[0.6rem] text-white whitespace-nowrap opacity-0 group-marker/marker:opacity-100 transition-opacity pointer-events-none z-50">
                {marker.label}
              </div>
            </button>
          ))}
        </ModelViewer>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-white/20 gap-4">
          <Maximize2 size={48} strokeWidth={1} />
          <p className="text-xs font-medium uppercase tracking-widest">No Model Loaded</p>
          {!readOnly && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 text-[0.65rem] font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all"
            >
              Upload GLB/GLTF
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full border border-white/10 rounded-2xl bg-gray-950/50 backdrop-blur-sm my-6 shadow-xl group flex flex-col overflow-visible">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 hover:text-white transition-all"
            title={isMinimized ? "Show Viewer" : "Hide Viewer"}
          >
            {isMinimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMarkerMode(!isMarkerMode)}
              className={`p-1.5 rounded-lg transition-all ${isMarkerMode ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}
              title={isMarkerMode ? "Exit Marker Mode" : "Add Markers (Click on Model)"}
            >
              <Plus size={14} />
            </button>
            <Maximize2 size={14} className="text-purple-400" />
            <span className="text-[0.7rem] font-bold text-white/50 uppercase tracking-widest">3D Model Viewer</span>
            {perfStats && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <Zap size={10} className="text-emerald-400" />
                <span className="text-[0.6rem] font-mono text-emerald-400">
                  {(perfStats.size / 1024 / 1024).toFixed(1)}MB Optimized
                </span>
              </div>
            )}
            {config.movementMode && config.movementMode !== 'orbital' && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <Move size={10} className="text-blue-400" />
                <span className="text-[0.6rem] font-mono text-blue-400 uppercase">
                  {config.movementMode} Mode (WASD)
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`p-1.5 rounded-lg transition-all ${isLoading ? 'animate-pulse text-purple-400' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}
                title="Upload Model (GLB/GLTF)"
                disabled={isLoading}
              >
                <Upload size={14} />
              </button>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-all ${showSettings ? 'bg-purple-500/20 text-purple-400' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}
                title="Settings"
              >
                <Settings size={14} />
              </button>
            </>
          )}
          <button 
            onClick={() => setIsMaximized(true)}
            className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 hover:text-white transition-all"
            title="Maximize Full Screen"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {ViewerContent(false)}

      {isMaximized && createPortal(
        <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
            <div className="flex items-center gap-3">
              <Maximize2 size={18} className="text-purple-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Full Screen Viewer</h3>
            </div>
            <button 
              onClick={() => setIsMaximized(false)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 relative bg-black">
            {ViewerContent(true)}
          </div>
          {availableAnimations.length > 0 && (
            <div className="p-6 border-t border-white/5 bg-white/5 flex items-center justify-center gap-4">
              <button 
                onClick={() => viewerRef.current?.play()}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-all"
              >
                <Play size={16} fill="currentColor" /> Play
              </button>
              <button 
                onClick={() => viewerRef.current?.pause()}
                className="flex items-center gap-2 px-6 py-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 font-bold uppercase tracking-widest hover:bg-amber-500/30 transition-all"
              >
                <Pause size={16} fill="currentColor" /> Pause
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {showSettings && !readOnly && (
        <div className="p-5 border-t border-white/5 bg-white/[0.02] grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-top duration-200">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Model Source</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={config.src.startsWith('blob-id:') ? 'Optimized Local Storage' : config.src}
                  onChange={(e) => updateConfig({ src: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-white transition-all"
                />
                {config.src.startsWith('blob-id:') && (
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400" title="Binary Storage Active">
                    <Database size={14} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Animation</label>
              <div className="flex items-center gap-2">
                <select
                  value={config.animationName || ''}
                  onChange={(e) => updateConfig({ animationName: e.target.value || undefined })}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 text-black transition-all appearance-none"
                >
                  <option value="" className="text-black">No Animation</option>
                  {availableAnimations.map(anim => (
                    <option key={anim} value={anim} className="text-black">{anim}</option>
                  ))}
                </select>
                <button 
                  onClick={() => updateConfig({ autoPlay: !config.autoPlay })}
                  className={`p-2 rounded-lg border transition-all ${config.autoPlay !== false ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                  title="Auto Play"
                >
                  <RotateCw size={14} className={config.autoPlay !== false ? 'animate-spin-slow' : ''} />
                </button>
              </div>
              
              {availableAnimations.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    onClick={() => viewerRef.current?.play()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-[0.6rem] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                    title="Play Animation"
                  >
                    <Play size={12} fill="currentColor" /> Play
                  </button>
                  <button 
                    onClick={() => viewerRef.current?.pause()}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-[0.6rem] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                    title="Pause Animation"
                  >
                    <Pause size={12} fill="currentColor" /> Pause
                  </button>
                  <button 
                    onClick={() => {
                      if (viewerRef.current) {
                        viewerRef.current.pause();
                        viewerRef.current.currentTime = 0;
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-[0.6rem] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                    title="Stop Animation"
                  >
                    <Square size={12} fill="currentColor" /> Stop
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Movement Mode</label>
              <div className="flex grid grid-cols-4 gap-2">
                {[
                  { id: 'orbital', icon: RotateCw, label: 'Orbit' },
                  { id: 'drag', icon: MousePointer2, label: 'Drag' },
                  { id: 'walk', icon: Footprints, label: 'Walk' },
                  { id: 'fly', icon: Plane, label: 'Fly' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateConfig({ movementMode: mode.id as any })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${config.movementMode === mode.id || (!config.movementMode && mode.id === 'orbital') ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                  >
                    <mode.icon size={14} />
                    <span className="text-[0.5rem] font-bold uppercase">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Visuals</label>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[0.6rem] text-white/30 uppercase">
                    <span>Exposure</span>
                    <span>{(config.exposure ?? 1).toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" value={config.exposure ?? 1}
                    onChange={(e) => updateConfig({ exposure: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[0.6rem] text-white/30 uppercase">
                    <span>Shadow</span>
                    <span>{(config.shadowIntensity ?? 1).toFixed(1)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="2" step="0.1" value={config.shadowIntensity ?? 1}
                    onChange={(e) => updateConfig({ shadowIntensity: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[0.6rem] text-white/30 uppercase">
                    <span>Height</span>
                    <span>{config.height || 400}px</span>
                  </div>
                  <input 
                    type="range" min="200" max="800" step="10" value={config.height || 400}
                    onChange={(e) => updateConfig({ height: parseInt(e.target.value) })}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Auto Rotate</label>
              <button 
                onClick={() => updateConfig({ autoRotate: !config.autoRotate })}
                className={`w-8 h-4 rounded-full transition-all relative ${config.autoRotate ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${config.autoRotate ? 'left-4.5' : 'left-0.5'}`} />
              </button>
            </div>

            <button 
              onClick={() => {
                if (viewerRef.current) {
                  viewerRef.current.cameraOrbit = 'auto auto auto';
                  viewerRef.current.cameraTarget = 'auto auto auto';
                  viewerRef.current.fieldOfView = 'auto';
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white/60 text-[0.65rem] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
            >
              <RotateCcw size={12} /> Reset Camera
            </button>
          </div>

          <div className="space-y-4 border-l border-white/5 pl-6">
            <div className="flex items-center justify-between">
              <label className="text-[0.65rem] font-bold text-white/40 uppercase tracking-widest">Markers</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsPrecisionMode(!isPrecisionMode)}
                  className={`p-1 rounded transition-all ${isPrecisionMode ? 'text-purple-400' : 'text-white/20'}`}
                  title="Precision Ray Mode"
                >
                  <Zap size={12} />
                </button>
                <button 
                  onClick={() => setIsMarkerMode(!isMarkerMode)}
                  className={`px-2 py-1 rounded-md text-[0.6rem] font-bold uppercase transition-all ${isMarkerMode ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}
                >
                  {isMarkerMode ? 'Mode: Active' : 'Add Marker'}
                </button>
              </div>
            </div>

            {isMarkerMode && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl animate-pulse">
                <p className="text-[0.6rem] text-purple-400 font-bold uppercase text-center">
                  Click on the model surface to place a marker
                </p>
              </div>
            )}

            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {(config.markers || []).length === 0 ? (
                <div className="text-center py-4 text-[0.65rem] text-white/20 italic">No markers added</div>
              ) : (
                (config.markers || []).map(marker => (
                  <div 
                    key={marker.id}
                    className={`p-3 rounded-xl border transition-all ${activeMarkerId === marker.id ? 'bg-purple-500/10 border-purple-500/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                    onClick={() => setActiveMarkerId(marker.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: marker.color }} />
                        <span className="text-[0.7rem] font-bold text-white truncate max-w-[100px]">{marker.label}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteMarker(marker.id); }}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    
                    {activeMarkerId === marker.id && (
                      <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-200">
                        <input 
                          type="text" value={marker.label}
                          onChange={(e) => updateMarker(marker.id, { label: e.target.value })}
                          className="w-full px-2 py-1 text-[0.65rem] bg-black/20 border border-white/10 rounded focus:outline-none focus:border-purple-500/50 text-white"
                          placeholder="Label"
                        />
                        <textarea 
                          value={marker.description || ''}
                          onChange={(e) => updateMarker(marker.id, { description: e.target.value })}
                          className="w-full px-2 py-1 text-[0.65rem] bg-black/20 border border-white/10 rounded focus:outline-none focus:border-purple-500/50 text-white h-12 resize-none"
                          placeholder="Description..."
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'].map(c => (
                              <button 
                                key={c} onClick={() => updateMarker(marker.id, { color: c })}
                                className={`w-4 h-4 rounded-full border ${marker.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-1">
                            {[
                              { id: 'pin', icon: MapPin },
                              { id: 'circle', icon: Circle },
                              { id: 'square', icon: SquareIcon },
                              { id: 'triangle', icon: Triangle }
                            ].map(s => (
                              <button 
                                key={s.id} onClick={() => updateMarker(marker.id, { shape: s.id as any })}
                                className={`p-1 rounded border ${marker.shape === s.id ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/30'}`}
                              >
                                <s.icon size={10} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".glb,.gltf" 
        className="hidden" 
      />
    </div>
  );
};
