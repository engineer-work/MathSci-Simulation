
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Plus, Trash2, Info, Maximize2, Minimize2, ZoomIn, ZoomOut, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../utils/db';

interface Annotation {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  label: string;
  color?: string;
  size?: number;
  description?: string;
  shape?: 'circle' | 'square' | 'diamond' | 'triangle';
}

interface ImageAnnotationConfig {
  src: string;
  annotations: Annotation[];
  alt?: string;
  internal_block_id?: string;
}

interface ImageAnnotationEngineProps {
  configStr: string;
  onUpdate?: (newConfigStr: string) => void;
  readOnly?: boolean;
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

const SHAPES = ['circle', 'square', 'diamond', 'triangle'] as const;

export const ImageAnnotationEngine: React.FC<ImageAnnotationEngineProps> = ({ configStr, onUpdate, readOnly = false }) => {
  const [config, setConfig] = useState<ImageAnnotationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAnnoPos, setNewAnnoPos] = useState<{ x: number, y: number } | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [selectedShape, setSelectedShape] = useState<Annotation['shape']>('circle');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (newAnnoPos && cardRef.current && containerRef.current) {
      const card = cardRef.current;
      const container = containerRef.current;
      const cardRect = card.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      let offsetX = 0;
      let offsetY = 0;

      // Check right boundary
      if (cardRect.right > containerRect.right) {
        offsetX = containerRect.right - cardRect.right - 10;
      }
      // Check left boundary
      if (cardRect.left < containerRect.left) {
        offsetX = containerRect.left - cardRect.left + 10;
      }
      // Check bottom boundary
      if (cardRect.bottom > containerRect.bottom) {
        offsetY = containerRect.bottom - cardRect.bottom - 10;
      }
      // Check top boundary
      if (cardRect.top < containerRect.top) {
        offsetY = containerRect.top - cardRect.top + 10;
      }

      if (offsetX !== 0 || offsetY !== 0) {
        card.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
      } else {
        card.style.transform = 'translate(-50%, -50%)';
      }
    }
  }, [newAnnoPos]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const parsed = JSON.parse(configStr);
        if (!parsed.src) throw new Error("Missing 'src' property");
        if (!parsed.annotations) parsed.annotations = [];
        
        // Handle blob-id:
        if (parsed.src.startsWith('blob-id:')) {
          const blobId = parsed.src.replace('blob-id:', '');
          const blobData = await db.blobs.get(blobId);
          if (blobData) {
            const objectUrl = URL.createObjectURL(blobData.data);
            parsed.src = objectUrl;
          }
        }
        
        setConfig(parsed);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON configuration");
      }
    };
    loadConfig();
  }, [configStr]);

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !onUpdate || !containerRef.current) return;
    
    const marker = (e.target as HTMLElement).closest('.annotation-marker');
    if (marker) {
      const idx = parseInt(marker.getAttribute('data-idx') || '-1');
      if (idx !== -1 && config) {
        const anno = config.annotations[idx];
        setEditingIdx(idx);
        setNewAnnoPos({ x: anno.x, y: anno.y });
        setNewLabel(anno.label);
        setNewDesc(anno.description || '');
        setSelectedColor(anno.color || PRESET_COLORS[0].value);
        setSelectedShape(anno.shape || 'circle');
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      return;
    }

    if ((e.target as HTMLElement).closest('.annotation-input-card')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setEditingIdx(null);
    setNewAnnoPos({ x, y });
    setNewLabel('');
    setNewDesc('');
    setSelectedColor(PRESET_COLORS[0].value);
    setSelectedShape('circle');
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleSaveAnnotation = () => {
    if (!config || !newAnnoPos || !newLabel.trim() || !onUpdate) return;
    
    let newAnnos;
    if (editingIdx !== null) {
      newAnnos = [...config.annotations];
      newAnnos[editingIdx] = {
        ...newAnnos[editingIdx],
        label: newLabel.trim(),
        description: newDesc.trim(),
        color: selectedColor,
        shape: selectedShape,
      };
    } else {
      newAnnos = [...config.annotations, {
        x: Math.round(newAnnoPos.x * 100) / 100,
        y: Math.round(newAnnoPos.y * 100) / 100,
        label: newLabel.trim(),
        description: newDesc.trim(),
        color: selectedColor,
        shape: selectedShape,
        size: 16
      }];
    }
    
    const newConfig = { ...config, annotations: newAnnos };
    onUpdate(JSON.stringify(newConfig, null, 2));
    setNewAnnoPos(null);
    setEditingIdx(null);
    setNewLabel('');
    setNewDesc('');
    setSelectedShape('circle');
  };

  const removeAnnotation = (idx: number) => {
    if (readOnly || !config || !onUpdate) return;
    const newAnnos = config.annotations.filter((_, i) => i !== idx);
    const newConfig = { ...config, annotations: newAnnos };
    onUpdate(JSON.stringify(newConfig, null, 2));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config || !onUpdate) return;

    try {
      const blobId = uuidv4();
      await db.blobs.add({
        id: blobId,
        data: file,
        type: file.type,
        name: file.name,
        createdAt: Date.now()
      });

      const newConfig = { ...config, src: `blob-id:${blobId}` };
      onUpdate(JSON.stringify(newConfig, null, 2));
    } catch (err) {
      console.error(err);
      alert('Failed to upload image.');
    }
  };

  if (error) {
    return (
      <div className="p-6 border-2 border-dashed border-red-500/30 bg-red-500/5 text-red-400 rounded-xl my-6 flex flex-col items-center gap-3">
        <X className="w-8 h-8 opacity-50" />
        <div className="text-center">
          <p className="font-bold">Annotation Configuration Error</p>
          <p className="text-xs opacity-70 mt-1">{error}</p>
        </div>
        <pre className="mt-2 text-[10px] bg-black/40 p-3 rounded w-full overflow-x-auto border border-white/5">{configStr}</pre>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className={`my-8 flex flex-col gap-6 ${isFullscreen ? 'fixed inset-0 z-[9999] bg-gray-950 p-8 overflow-y-auto' : ''}`}>
      <div 
        ref={containerRef}
        className={`relative inline-block w-full rounded-3xl border border-white/10 bg-black/20 transition-all duration-700 ${!readOnly ? 'cursor-crosshair hover:border-blue-500/30' : ''}`}
        style={{ lineHeight: 0 }}
        onClick={handleImageClick}
      >
        <div className="overflow-hidden rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
          {!readOnly && (
            <div className="absolute top-4 left-4 z-20 flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => handleImageUpload(e);
                  input.click();
                }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:scale-105"
                title="Change Image"
              >
                <Upload size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md border border-white/10 shadow-2xl transition-all hover:scale-105"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          )}
          <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center', transition: 'transform 0.3s ease-out' }}>
            {config.src ? (
              <img 
                src={config.src} 
                alt={config.alt || "Annotated image"} 
                className="w-full h-auto block select-none"
                referrerPolicy="no-referrer"
                onDragStart={e => e.preventDefault()}
              />
            ) : (
              <div className="w-full aspect-video flex items-center justify-center bg-white/5 text-white/20 uppercase tracking-widest text-[0.6rem] font-bold">
                No Image Source Provided
              </div>
            )}
          
          {!readOnly && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors pointer-events-none" />
          )}

          {/* Existing Annotations */}
          {config.annotations.map((anno, idx) => (
            <div 
              key={idx}
              className="absolute flex flex-col items-center z-10"
              style={{ 
                left: `${anno.x}%`, 
                top: `${anno.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div 
                className="annotation-marker relative group/marker pointer-events-auto cursor-pointer"
                data-idx={idx}
                style={{ width: `${anno.size || 16}px`, height: `${anno.size || 16}px` }}
              >
                <div 
                  className={`absolute inset-0 border-2 border-white shadow-lg transition-all duration-500 
                    ${hoveredIdx === idx ? 'scale-[2.5] opacity-100' : 'scale-100 opacity-80'}
                    ${anno.shape === 'square' ? 'rounded-md' : 
                      anno.shape === 'diamond' ? 'rounded-sm rotate-45' : 
                      anno.shape === 'triangle' ? 'clip-triangle' : 'rounded-full'}
                  `}
                  style={{ backgroundColor: `${anno.color || '#3b82f6'}44` }}
                />
                <div 
                  className={`absolute inset-[20%] bg-white shadow-inner transition-transform duration-500
                    ${anno.shape === 'square' ? 'rounded-sm' : 
                      anno.shape === 'diamond' ? 'rounded-[1px] rotate-45' : 
                      anno.shape === 'triangle' ? 'clip-triangle' : 'rounded-full'}
                  `}
                  style={{ 
                    backgroundColor: anno.color || '#3b82f6', 
                    transform: hoveredIdx === idx ? 
                      (anno.shape === 'diamond' ? 'rotate(45deg) scale(1.2)' : 'scale(1.2)') : 
                      (anno.shape === 'diamond' ? 'rotate(45deg) scale(1)' : 'scale(1)') 
                  }}
                />
                
                <div 
                  className={`absolute inset-0 animate-ping opacity-30
                    ${anno.shape === 'square' ? 'rounded-md' : 
                      anno.shape === 'diamond' ? 'rounded-sm rotate-45' : 
                      anno.shape === 'triangle' ? 'clip-triangle' : 'rounded-full'}
                  `}
                  style={{ backgroundColor: anno.color || '#3b82f6' }}
                />

                {!readOnly && hoveredIdx === idx && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); removeAnnotation(idx); }}
                    className="absolute -top-4 -right-4 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 z-20"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              
              {/* Floating Info Card */}
              <div 
                className={`mt-4 p-3 rounded-2xl border border-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-500 pointer-events-none z-20 min-w-[140px] max-w-[240px] ${hoveredIdx === idx && editingIdx === null ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`}
                style={{ 
                  backgroundColor: `${anno.color || '#3b82f6'}F2`,
                  color: '#fff',
                }}
              >
                <div className="font-bold text-sm leading-tight mb-1">{anno.label}</div>
                {anno.description && (
                  <div className="text-[10px] opacity-90 leading-relaxed font-medium whitespace-normal break-words">{anno.description}</div>
                )}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45" style={{ backgroundColor: `${anno.color || '#3b82f6'}F2` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 flex gap-2 z-40">
          <button 
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 3))}
            className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-black/60 transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button 
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
            className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-black/60 transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white/70 hover:text-white hover:bg-black/60 transition-all"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {/* New Annotation Creation UI */}
        {newAnnoPos && (
          <div 
            ref={cardRef}
            className="absolute z-50 flex flex-col items-center annotation-input-card transition-transform duration-200"
            style={{ 
              left: `${newAnnoPos.x}%`, 
              top: `${newAnnoPos.y}%`, 
              transform: 'translate(-50%, -50%)',
              lineHeight: 'normal' 
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className={`w-8 h-8 border-4 border-white bg-blue-500 shadow-2xl animate-pulse
              ${selectedShape === 'square' ? 'rounded-lg' : 
                selectedShape === 'diamond' ? 'rounded-md rotate-45' : 
                selectedShape === 'triangle' ? 'clip-triangle' : 'rounded-full'}
            `} />
            
            <div className="mt-4 p-5 bg-gray-950/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.6)] flex flex-col gap-4 w-[280px] sm:w-[320px] max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">{editingIdx !== null ? 'Edit Marker' : 'Add Marker'}</span>
                <div className="flex items-center gap-2">
                  {editingIdx !== null && (
                    <button 
                      onClick={() => { removeAnnotation(editingIdx); setNewAnnoPos(null); setEditingIdx(null); }}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 hover:text-red-300"
                      title="Delete Marker"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button onClick={() => { setNewAnnoPos(null); setEditingIdx(null); }} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={16} className="text-white/40 hover:text-white" />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <input 
                  ref={inputRef}
                  type="text" 
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveAnnotation();
                    if (e.key === 'Escape') { setNewAnnoPos(null); setEditingIdx(null); }
                  }}
                  placeholder="Label Title"
                  className="w-full bg-white/10 text-white text-sm px-4 py-3 rounded-xl border border-white/20 outline-none focus:border-blue-500/50 focus:bg-white/20 transition-all placeholder:text-white/40"
                />
                <textarea 
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveAnnotation(); }
                    if (e.key === 'Escape') { setNewAnnoPos(null); setEditingIdx(null); }
                  }}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full bg-white/10 text-white text-xs px-4 py-3 rounded-xl border border-white/20 outline-none focus:border-blue-500/50 focus:bg-white/20 transition-all resize-none placeholder:text-white/40 leading-normal min-h-[60px] max-h-[120px]"
                />
              </div>

              <div className="flex flex-col gap-4 px-1">
                <div className="flex flex-col gap-2">
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Shape</span>
                  <div className="flex gap-3">
                    {SHAPES.map(s => (
                      <button
                        key={s}
                        onClick={() => setSelectedShape(s)}
                        className={`w-6 h-6 border-2 transition-all hover:scale-110 flex items-center justify-center
                          ${selectedShape === s ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 opacity-40'}
                          ${s === 'square' ? 'rounded-md' : 
                            s === 'diamond' ? 'rounded-sm rotate-45' : 
                            s === 'triangle' ? 'clip-triangle' : 'rounded-full'}
                        `}
                      >
                        <div className={`w-2 h-2 bg-current ${s === 'diamond' ? '-rotate-45' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Color</span>
                  <div className="flex gap-2">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setSelectedColor(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-125 ${selectedColor === c.value ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-40'}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSaveAnnotation}
                disabled={!newLabel.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs py-3.5 rounded-xl font-black tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                {editingIdx !== null ? <><Plus size={16} /> UPDATE ANNOTATION</> : <><Plus size={16} /> CREATE ANNOTATION</>}
              </button>
            </div>
          </div>
        )}

        {!readOnly && config.annotations.length === 0 && !newAnnoPos && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 flex items-center gap-4 animate-pulse shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <Plus size={20} className="text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-white font-bold">Interactive Mode</span>
                <span className="text-[10px] text-white/50 uppercase tracking-widest">Click anywhere to annotate</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend */}
      {config.annotations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.annotations.map((anno, idx) => (
            <div 
              key={idx} 
              className={`group relative p-4 rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden ${hoveredIdx === idx ? 'bg-white/10 border-white/30 translate-y-[-4px] shadow-xl' : 'bg-white/5 border-white/5'}`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-start gap-3 relative z-10">
                <div 
                  className={`w-3 h-3 mt-1 shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)]
                    ${anno.shape === 'square' ? 'rounded-sm' : 
                      anno.shape === 'diamond' ? 'rounded-[1px] rotate-45' : 
                      anno.shape === 'triangle' ? 'clip-triangle' : 'rounded-full'}
                  `} 
                  style={{ backgroundColor: anno.color || '#3b82f6' }} 
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-black text-white/90 uppercase tracking-wider truncate">{anno.label}</span>
                  {anno.description && (
                    <p className="text-[10px] text-white/50 leading-relaxed whitespace-normal break-words">{anno.description}</p>
                  )}
                </div>
              </div>
              
              {!readOnly && (
                <button 
                  onClick={(e) => { e.stopPropagation(); removeAnnotation(idx); }}
                  className="absolute top-3 right-3 p-1.5 text-white/0 group-hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Hover Background Glow */}
              <div 
                className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500`}
                style={{ backgroundColor: anno.color || '#3b82f6' }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
