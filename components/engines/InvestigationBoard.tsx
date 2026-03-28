
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Pin, X, Plus, Image as ImageIcon, StickyNote, Link as LinkIcon, Move, Video, Volume2, MousePointer2, Share2, Pencil, Minimize2, Maximize2, Upload, Trash2, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import { MermaidDiagram } from './MermaidDiagram';
import { SmilesDiagram } from './SmilesDiagram';
import { InteractivePlot } from './InteractivePlot';
import { ModelViewerEngine } from './ModelViewerEngine';
import { PhysicsSimulation } from './PhysicsSimulation';

interface BoardItem {
  id: string;
  type: 'note' | 'photo' | 'document' | 'video' | 'audio';
  x: number;
  y: number;
  content?: string;
  src?: string;
  caption?: string;
  color?: string;
  textColor?: string;
  rotation?: number;
  minimized?: boolean;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  color: string;
}

interface InvestigationBoardConfig {
  internal_block_id?: string;
  items: BoardItem[];
  connections: Connection[];
}

interface InvestigationBoardProps {
  configStr: string;
  onUpdate: (newStr: string) => void;
  readOnly?: boolean;
}

export const InvestigationBoard: React.FC<InvestigationBoardProps> = ({ configStr, onUpdate, readOnly }) => {
  const [config, setConfig] = useState<InvestigationBoardConfig>(() => {
    try {
      return JSON.parse(configStr);
    } catch (e) {
      return { items: [], connections: [] };
    }
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingItem, setDraggingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Connection Mode State
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStartId, setConnectionStartId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const handleUpdate = (newConfig: InvestigationBoardConfig) => {
    setConfig(newConfig);
    onUpdate(JSON.stringify(newConfig, null, 2));
  };

  const addItem = (type: BoardItem['type']) => {
    if (readOnly) return;
    const newItem: BoardItem = {
      id: uuidv4(),
      type,
      x: 50 + Math.random() * 100,
      y: 50 + Math.random() * 100,
      rotation: (Math.random() - 0.5) * 10,
      content: type === 'note' ? '# Evidence Note\n- Point 1\n- $E=mc^2$' : '',
      color: type === 'note' ? '#fef08a' : '#ffffff',
      textColor: '#111827', // Default dark text
    };
    handleUpdate({ ...config, items: [...config.items, newItem] });
  };

  const removeItem = (id: string) => {
    if (readOnly) return;
    handleUpdate({
      ...config,
      items: config.items.filter(item => item.id !== id),
      connections: config.connections.filter(c => c.from !== id && c.to !== id)
    });
  };

  const updateItem = (id: string, updates: Partial<BoardItem>) => {
    if (readOnly) return;
    handleUpdate({
      ...config,
      items: config.items.map(item => item.id === id ? { ...item, ...updates } : item)
    });
  };

  const handleFileUpload = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      updateItem(id, { src: base64 });
    };
    reader.readAsDataURL(file);
  };

  const toggleMinimize = (id: string) => {
    const item = config.items.find(i => i.id === id);
    if (item) {
      updateItem(id, { minimized: !item.minimized });
    }
  };

  const handleItemClick = (id: string) => {
    if (readOnly) return;
    
    if (isConnecting) {
      if (!connectionStartId) {
        setConnectionStartId(id);
      } else {
        if (connectionStartId !== id) {
          addConnection(connectionStartId, id);
        }
        setConnectionStartId(null);
        setIsConnecting(false);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (readOnly || isConnecting) return;
    const item = config.items.find(i => i.id === id);
    if (!item) return;

    setDraggingItem(id);
    setDragOffset({
      x: e.clientX - item.x,
      y: e.clientY - item.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingItem || readOnly) return;

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;

    updateItem(draggingItem, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggingItem(null);
  };

  const addConnection = (fromId: string, toId: string) => {
    if (readOnly || fromId === toId) return;
    if (config.connections.some(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId))) return;

    const newConnection: Connection = {
      id: uuidv4(),
      from: fromId,
      to: toId,
      color: '#ef4444'
    };
    handleUpdate({ ...config, connections: [...config.connections, newConnection] });
  };

  const removeConnection = (id: string) => {
    if (readOnly) return;
    handleUpdate({
      ...config,
      connections: config.connections.filter(c => c.id !== id)
    });
  };

  // Render connections as SVG curved paths
  const renderConnections = () => {
    return (
      <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="12"
            markerHeight="12"
            refX="6"
            refY="6"
            orient="auto"
          >
            <path d="M 2 2 L 10 6 L 2 10 Z" fill="#ef4444" />
          </marker>
        </defs>
        {config.connections.map(conn => {
          const from = config.items.find(i => i.id === conn.from);
          const to = config.items.find(i => i.id === conn.to);
          if (!from || !to) return null;

          const getItemCenter = (item: BoardItem) => {
            if (item.minimized) return { x: item.x + 24, y: item.y + 24 };
            switch (item.type) {
              case 'note': return { x: item.x + 100, y: item.y + 100 };
              case 'photo': return { x: item.x + 100, y: item.y + 125 };
              case 'video': return { x: item.x + 120, y: item.y + 90 };
              case 'audio': return { x: item.x + 100, y: item.y + 40 };
              default: return { x: item.x + 100, y: item.y + 100 };
            }
          };

          const start = getItemCenter(from);
          const end = getItemCenter(to);

          // Calculate control point for curve
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 10) return null;

          // Offset control point perpendicular to the line
          const offset = Math.min(dist * 0.2, 60);
          const nx = -dy / dist;
          const ny = dx / dist;
          const cx = midX + nx * offset;
          const cy = midY + ny * offset;

          // Calculate a point at 70% of the curve for a visible arrowhead
          // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)*t*P1 + t^2*P2
          const t = 0.7; // 70% along the path
          const arrowX = Math.pow(1-t, 2) * start.x + 2 * (1-t) * t * cx + Math.pow(t, 2) * end.x;
          const arrowY = Math.pow(1-t, 2) * start.y + 2 * (1-t) * t * cy + Math.pow(t, 2) * end.y;

          // Tangent at t=0.7 for orientation
          // B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
          const tx = 2 * (1-t) * (cx - start.x) + 2 * t * (end.x - cx);
          const ty = 2 * (1-t) * (cy - start.y) + 2 * t * (end.y - cy);
          const angle = Math.atan2(ty, tx) * 180 / Math.PI;

          const pathData = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;

          return (
            <g key={conn.id}>
              <path
                d={pathData}
                fill="none"
                stroke={conn.color}
                strokeWidth="2.5"
                strokeDasharray="8 4"
                className="opacity-80"
              />
              {/* Visible Arrowhead in the middle of the path */}
              <path 
                d="M -6 -4 L 6 0 L -6 4 Z" 
                fill={conn.color}
                transform={`translate(${arrowX}, ${arrowY}) rotate(${angle})`}
                className="opacity-100 shadow-sm"
              />
              <circle cx={start.x} cy={start.y} r="4" fill={conn.color} className="opacity-40" />
            </g>
          );
        })}
      </svg>
    );
  };

  const markdownComponents = useMemo(() => ({
    code({node, inline, className, children, ...props}: any) {
      const match = /language-([\w-]+)/.exec(className || '');
      const rawCodeContent = String(children).replace(/\n$/, '');
      if (!inline) {
        switch (match?.[1]) {
          case 'mermaid': return <MermaidDiagram chart={rawCodeContent} />;
          case 'smiles': return <SmilesDiagram smiles={rawCodeContent} />;
          case 'plot': return <InteractivePlot configStr={rawCodeContent} onUpdate={() => {}} />;
          case 'model': return <ModelViewerEngine configStr={rawCodeContent} onUpdate={() => {}} readOnly={true} />;
          case 'physics': return <PhysicsSimulation configStr={rawCodeContent} />;
        }
      }
      return <code className={className} {...props}>{children}</code>;
    }
  }), []);

  return (
    <div className="my-8 relative group">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Investigation Board</span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsConnecting(!isConnecting)} 
              className={`p-1.5 rounded-md transition-colors ${isConnecting ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-white/60'}`}
              title={isConnecting ? "Cancel Connection" : "Connect Items"}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={() => addItem('note')} className="p-1 hover:bg-white/10 rounded text-white/60" title="Add Note">
              <StickyNote className="w-4 h-4" />
            </button>
            <button onClick={() => addItem('photo')} className="p-1 hover:bg-white/10 rounded text-white/60" title="Add Photo">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button onClick={() => addItem('video')} className="p-1 hover:bg-white/10 rounded text-white/60" title="Add Video">
              <Video className="w-4 h-4" />
            </button>
            <button onClick={() => addItem('audio')} className="p-1 hover:bg-white/10 rounded text-white/60" title="Add Audio">
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div 
        ref={boardRef}
        className={`relative w-full h-[600px] bg-[#3d2b1f] rounded-xl border-8 border-[#2d1b0f] shadow-2xl overflow-hidden ${isConnecting ? 'cursor-cell' : 'cursor-crosshair'}`}
        style={{
          backgroundImage: 'radial-gradient(#4d3b2f 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {renderConnections()}

        {config.items.map(item => (
          <div
            key={item.id}
            className={`absolute select-none group/item ${isConnecting ? 'cursor-pointer' : 'cursor-move'}`}
            style={{
              left: item.x,
              top: item.y,
              transform: `rotate(${item.rotation || 0}deg)`,
              zIndex: draggingItem === item.id ? 100 : 10,
              outline: connectionStartId === item.id ? '2px solid #ef4444' : 'none',
              outlineOffset: '4px'
            }}
            onMouseDown={(e) => handleMouseDown(e, item.id)}
            onClick={() => handleItemClick(item.id)}
          >
            {/* Pin */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
              <div className="w-4 h-4 bg-red-600 rounded-full shadow-md border-2 border-red-400 flex items-center justify-center">
                <div className="w-1 h-1 bg-white/40 rounded-full" />
              </div>
            </div>

            {/* Note */}
            {item.type === 'note' && !item.minimized && (
              <div 
                className="w-[200px] min-h-[200px] p-4 shadow-xl flex flex-col relative group/note"
                style={{ backgroundColor: item.color || '#fef08a', color: item.textColor || '#111827' }}
              >
                <div className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-1">
                  {!readOnly && (
                    <div className="flex gap-1 items-center bg-black/20 p-1 rounded-md">
                      <input 
                        type="color" 
                        value={item.color || '#fef08a'} 
                        onChange={(e) => updateItem(item.id, { color: e.target.value })}
                        className="w-4 h-4 rounded cursor-pointer bg-transparent border-none"
                        title="Background Color"
                      />
                      <input 
                        type="color" 
                        value={item.textColor || '#111827'} 
                        onChange={(e) => updateItem(item.id, { textColor: e.target.value })}
                        className="w-4 h-4 rounded cursor-pointer bg-transparent border-none"
                        title="Text Color"
                      />
                    </div>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(item.id); }}
                    className="p-1 text-gray-500 hover:text-gray-800"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
                {editingNoteId === item.id ? (
                  <textarea
                    autoFocus
                    className="w-full flex-1 bg-transparent border-none outline-none resize-none font-handwriting text-sm leading-tight"
                    style={{ color: item.textColor || '#111827' }}
                    value={item.content}
                    onChange={(e) => updateItem(item.id, { content: e.target.value })}
                    onBlur={() => setEditingNoteId(null)}
                    placeholder="Evidence..."
                    readOnly={readOnly}
                  />
                ) : (
                  <div 
                    className="w-full flex-1 overflow-auto markdown-body prose-sm prose-invert-0"
                    style={{ color: item.textColor || '#111827' }}
                    onDoubleClick={() => !readOnly && setEditingNoteId(item.id)}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeRaw, [rehypeKatex, { trust: true, strict: false }], rehypeHighlight]}
                      components={markdownComponents}
                    >
                      {item.content || ''}
                    </ReactMarkdown>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button onClick={() => setEditingNoteId(item.id)} className="p-1 text-gray-500 hover:text-gray-800">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Photo */}
            {item.type === 'photo' && !item.minimized && (
              <div className="bg-white p-2 pb-8 shadow-2xl w-[200px] relative group/photo">
                <div className="absolute top-1 right-1 opacity-0 group-hover/photo:opacity-100 transition-opacity flex gap-1 z-10">
                  {item.src && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateItem(item.id, { src: undefined }); }}
                      className="p-1 bg-white/80 text-gray-500 hover:text-red-500 rounded-full shadow-sm"
                      title="Clear Image"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(item.id); }}
                    className="p-1 bg-white/80 text-gray-500 hover:text-blue-500 rounded-full shadow-sm"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-full aspect-square bg-gray-200 overflow-hidden relative group/img">
                  {item.src ? (
                    <img src={item.src} alt="Evidence" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-4">
                      <ImageIcon className="w-8 h-8" />
                      {!readOnly && (
                        <div className="flex flex-col gap-2 w-full">
                          <input 
                            type="text" 
                            placeholder="Image URL..."
                            className="text-[10px] w-full p-1 bg-white/50 border border-gray-300 rounded"
                            onBlur={(e) => updateItem(item.id, { src: (e.target as HTMLInputElement).value })}
                          />
                          <label className="flex items-center justify-center gap-1 text-[10px] bg-gray-100 hover:bg-gray-200 p-1 rounded cursor-pointer border border-gray-300">
                            <Upload className="w-3 h-3" />
                            Upload File
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(item.id, e.target.files[0])}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  className="w-full mt-2 text-center text-gray-600 font-handwriting text-xs border-none outline-none bg-transparent"
                  value={item.caption}
                  onChange={(e) => updateItem(item.id, { caption: e.target.value })}
                  placeholder="Caption..."
                  readOnly={readOnly}
                />
              </div>
            )}

            {/* Video */}
            {item.type === 'video' && !item.minimized && (
              <div className="bg-black p-1 shadow-2xl w-[240px] rounded-sm border-4 border-gray-800 relative group/video">
                <div className="absolute top-1 right-1 opacity-0 group-hover/video:opacity-100 transition-opacity flex gap-1 z-10">
                  {item.src && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateItem(item.id, { src: undefined }); }}
                      className="p-1 bg-black/50 text-white/70 hover:text-red-400 rounded-full shadow-sm"
                      title="Clear Video"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(item.id); }}
                    className="p-1 bg-black/50 text-white/70 hover:text-blue-400 rounded-full shadow-sm"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-full aspect-video bg-gray-900 overflow-hidden relative group/vid">
                  {item.src ? (
                    <video src={item.src} controls className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2 p-4">
                      <Video className="w-8 h-8" />
                      {!readOnly && (
                        <div className="flex flex-col gap-2 w-full">
                          <input 
                            type="text" 
                            placeholder="Video URL..."
                            className="text-[10px] w-full p-1 bg-white/10 border border-gray-700 rounded text-white"
                            onBlur={(e) => updateItem(item.id, { src: (e.target as HTMLInputElement).value })}
                          />
                          <label className="flex items-center justify-center gap-1 text-[10px] bg-gray-800 hover:bg-gray-700 p-1 rounded cursor-pointer border border-gray-600 text-gray-300">
                            <Upload className="w-3 h-3" />
                            Upload File
                            <input 
                              type="file" 
                              accept="video/*" 
                              className="hidden" 
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(item.id, e.target.files[0])}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-1 text-[10px] text-gray-400 text-center truncate">{item.caption || 'Video Evidence'}</div>
              </div>
            )}

            {/* Audio */}
            {item.type === 'audio' && !item.minimized && (
              <div className="bg-gray-100 p-3 shadow-2xl w-[200px] rounded-lg border-2 border-gray-300 relative group/audio">
                <div className="absolute top-1 right-1 opacity-0 group-hover/audio:opacity-100 transition-opacity flex gap-1 z-10">
                  {item.src && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateItem(item.id, { src: undefined }); }}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Clear Audio"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(item.id); }}
                    className="p-1 text-gray-400 hover:text-blue-500"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500 rounded-full text-white">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div className="text-[10px] font-bold text-gray-700 truncate">{item.caption || 'Audio Log'}</div>
                </div>
                {item.src ? (
                  <audio src={item.src} controls className="w-full h-8" />
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    {!readOnly && (
                      <>
                        <input 
                          type="text" 
                          placeholder="Audio URL..."
                          className="text-[10px] w-full p-1 bg-white border border-gray-300 rounded"
                          onBlur={(e) => updateItem(item.id, { src: (e.target as HTMLInputElement).value })}
                        />
                        <label className="flex items-center justify-center gap-1 text-[10px] bg-white hover:bg-gray-50 p-1 rounded cursor-pointer border border-gray-300 text-gray-600">
                          <Upload className="w-3 h-3" />
                          Upload File
                          <input 
                            type="file" 
                            accept="audio/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(item.id, e.target.files[0])}
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Minimized Placeholder */}
            {item.minimized && (
              <div 
                className="min-w-[48px] h-12 px-3 rounded-lg shadow-lg flex items-center gap-2 border-2 border-white/20 transition-all hover:scale-105"
                style={{ backgroundColor: item.color || '#fef08a', color: item.textColor || '#111827' }}
              >
                <div className="flex-shrink-0">
                  {item.type === 'note' && <StickyNote className="w-5 h-5" style={{ color: item.textColor || '#111827' }} />}
                  {item.type === 'photo' && <ImageIcon className="w-5 h-5 text-gray-800" />}
                  {item.type === 'video' && <Video className="w-5 h-5 text-gray-800" />}
                  {item.type === 'audio' && <Volume2 className="w-5 h-5 text-gray-800" />}
                </div>
                {(item.caption || item.content) && (
                  <div className="text-[10px] font-bold truncate max-w-[100px]" style={{ color: item.textColor || '#111827' }}>
                    {item.caption || (item.content?.startsWith('#') ? item.content.split('\n')[0].replace('#', '').trim() : item.content?.substring(0, 15))}
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            {!readOnly && (
              <div className="absolute -top-2 -right-2 opacity-0 group-hover/item:opacity-100 transition-opacity flex gap-1 z-30">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(item.id); }}
                  className="p-1 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
                  title={item.minimized ? "Maximize" : "Minimize"}
                >
                  {item.minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                  className="p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-2 text-[10px] text-white/20 italic text-center">
        Drag items to move. Connect them in the data structure below.
      </div>
    </div>
  );
};
