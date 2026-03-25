
import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, Move } from 'lucide-react';

// Use global mermaid from CDN
declare const mermaid: any;

export const MermaidDiagram = ({ chart }: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let isMounted = true;
    
    const renderDiagram = async () => {
      if (!svgWrapperRef.current || typeof mermaid === 'undefined') return;
      try {
        mermaid.initialize({      
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'dark',
          flowchart: {
            htmlLabels: false,
            useMaxWidth: true,
            padding: 20,
            nodeSpacing: 70,
            rankSpacing: 90,
          },
        });
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (!isMounted) return;

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        
        if (isMounted && svgWrapperRef.current) {
            svgWrapperRef.current.innerHTML = svg;
            const svgEl = svgWrapperRef.current.querySelector('svg');
          
            setTransform({ x: 0, y: 0, scale: 1 });
        }
      } catch (err) {
        if (isMounted && svgWrapperRef.current) {
            console.error("Mermaid error:", err);
            svgWrapperRef.current.innerHTML = `<div style="color:#f87171;font-size:0.75rem;padding:0.5rem;border:1px solid rgba(239,68,68,0.5);border-radius:0.25rem;background:rgba(127,29,29,0.1);font-family:monospace;white-space:pre-wrap">Syntax Error:\n${(err as Error).message}</div>`;
        }
      }
    };
    renderDiagram();
    return () => { isMounted = false; };
  }, [chart]);

  const handleZoom = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(10, prev.scale + delta))
    }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => setIsDragging(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  return (
    <div 
        ref={containerRef} 
        onWheel={handleWheel}
        className={`relative group overflow-hidden flex flex-col justify-center my-4 ${
          isFullscreen 
            ? "fixed inset-0 z-[9999] bg-bg-main p-8" 
            : "bg-bg-sidebar rounded-lg border border-border-color h-[400px] w-full shadow-sm"
        }`}
    >
      {/* Controls Overlay */}
      <div className="absolute top-3 right-3 flex gap-2 z-10 bg-black/60 p-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-lg">
        <button onClick={() => handleZoom(0.2)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Zoom In"><ZoomIn size={16}/></button>
        <button onClick={() => handleZoom(-0.2)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Zoom Out"><ZoomOut size={16}/></button>
        <button onClick={resetView} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title="Reset View"><RefreshCw size={16}/></button>
        <div className="w-px bg-white/20 mx-1" />
        <button onClick={toggleFullscreen} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          {isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
        </button>
      </div>

      {/* Movement Hint */}
      {!isFullscreen && (
          <div className="absolute bottom-2 left-2 text-[10px] text-text-muted flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
              <Move size={12}/> Drag to pan • Ctrl+Scroll to zoom
          </div>
      )}

      <div 
        className={`flex-1 flex items-center justify-center overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          ref={svgWrapperRef}
          className="w-full flex justify-center origin-center"
          style={{ 
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>
    </div>
  );
};
