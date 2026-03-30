
import React, { useRef, useEffect, useState } from 'react';
import { Box, RotateCw, AlertCircle, Maximize2 } from 'lucide-react';

export const SmilesDiagram = ({ smiles }: { smiles: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [view3D, setView3D] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2D Rendering
  useEffect(() => {
    if (!canvasRef.current || view3D) return;
    
    let isMounted = true;
    const render2D = () => {
      if (!isMounted) return;
      
      const SmilesDrawer = (window as any).SmilesDrawer || (window as any).SmiDrawer;
      if (!SmilesDrawer) {
        setTimeout(render2D, 100);
        return;
      }

      const options = { 
        width: 600, 
        height: 400, 
        bondThickness: 1.5,
        terminalCarbons: true,
        explicitHydrogens: false,
        compactDrawing: true
      };
      
      try {
          // In version 2.x, SmiDrawer might be the main export or a property
          const SmiDrawer = SmilesDrawer.SmiDrawer || SmilesDrawer.Drawer || SmilesDrawer;
          if (typeof SmiDrawer !== 'function') {
              throw new Error("SmilesDrawer constructor not found");
          }
          
          const drawer = new SmiDrawer(options);
          
          // Determine theme based on background
          const theme = 'dark';
          
          if (canvasRef.current) {
            drawer.draw(smiles.trim(), canvasRef.current, theme);
            setError(null);
          }
      } catch (e) {
          console.error("SmilesDrawer Error:", e);
          setError("Failed to render 2D structure");
      }
    };

    render2D();
    return () => { isMounted = false; };
  }, [smiles, view3D]);

  // 3D Rendering
  useEffect(() => {
    if (!view3D || !container3dRef.current) return;
    
    let isMounted = true;
    const render3D = async () => {
        const $3Dmol = (window as any).$3Dmol;
        if (!$3Dmol) {
            if (isMounted) setTimeout(render3D, 100);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const encoded = encodeURIComponent(smiles.trim());
            // Try to get 3D SDF from PubChem
            const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encoded}/SDF?record_type=3d`);
            
            let sdf = '';
            if (response.ok) {
                sdf = await response.text();
                // Check if we got a valid SDF or an error message
                if (sdf.includes("Status: 404") || sdf.includes("Error") || sdf.length < 100) {
                    throw new Error("3D structure not found");
                }
            } else {
                throw new Error("Could not fetch 3D structure");
            }
            
            if (container3dRef.current && isMounted) {
                container3dRef.current.innerHTML = '';
                const viewer = $3Dmol.createViewer(container3dRef.current, { 
                    backgroundColor: '#111827', 
                });
                viewer.addModel(sdf, "sdf");
                viewer.setStyle({}, { stick: { radius: 0.2 }, sphere: { radius: 0.5 } });
                viewer.zoomTo();
                viewer.render();
                
                // Ensure interaction is enabled
                viewer.setClickable(true);
            }
        } catch (e) {
            console.error("3Dmol Error:", e);
            // Fallback to 2D if 3D fails
            if (isMounted) {
                setError("3D structure unavailable for this molecule");
                setTimeout(() => {
                    if (isMounted) setView3D(false);
                }, 2000);
            }
        } finally {
            if (isMounted) setIsLoading(false);
        }
    };
    render3D();
    return () => { isMounted = false; };
  }, [view3D, smiles]);

  return (
    <div className="w-full border border-border-color rounded-xl overflow-hidden bg-bg-sidebar my-6 shadow-lg relative group min-h-[400px]">
      {/* Header / Toolbar */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setView3D(!view3D)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
            view3D 
              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' 
              : 'bg-bg-main border-border-color text-text-main hover:bg-hover-bg'
          }`}
        >
          <Box size={14} /> {view3D ? '2D View' : '3D View'}
        </button>
      </div>

      {/* Status Badges */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${view3D ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
              {view3D ? '3D Model' : '2D Structure'}
          </div>
      </div>

      {/* Error State */}
      {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-sidebar/90 z-30 p-6 text-center">
              <div className="flex flex-col items-center gap-3 max-w-xs">
                  <AlertCircle className="text-red-500 w-8 h-8" />
                  <p className="text-sm font-medium text-text-main">{error}</p>
                  <button 
                    onClick={() => { setError(null); setView3D(false); }}
                    className="mt-2 px-4 py-1.5 bg-bg-main border border-border-color rounded-lg text-xs font-bold hover:bg-hover-bg cursor-pointer"
                  >
                      Try 2D View
                  </button>
              </div>
          </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-sidebar/60 z-10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Generating 3D...</span>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex justify-center items-center h-[400px] p-4">
        {view3D ? (
          <div
            ref={container3dRef}
            className="w-full h-full rounded-lg cursor-move"
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto block"
            style={{ width: '600px', height: '400px' }}
          />
        )}
      </div>
      
      {/* Footer Info */}
      <div className="px-4 py-2 bg-bg-main/50 border-t border-border-color flex justify-between items-center">
          <code className="text-[10px] text-text-muted truncate max-w-[70%] font-mono">{smiles}</code>
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
              {view3D ? 'Interactive 3D' : 'Static 2D'}
          </div>
      </div>
    </div>
  );
};


