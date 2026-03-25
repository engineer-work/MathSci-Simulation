
import React, { useRef, useEffect, useState } from 'react';
import { Box } from 'lucide-react';

export const SmilesDiagram = ({ smiles }: { smiles: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [view3D, setView3D] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2D Rendering
  useEffect(() => {
    if (!window.SmilesDrawer || !canvasRef.current || view3D) return;
    
    const style = getComputedStyle(document.body);
    const textColor = style.getPropertyValue('--text-main').trim() || '#ffffff';
    const isDark = !textColor.startsWith('#0') && !textColor.startsWith('#3') && !textColor.startsWith('black');

    const options = { width: 400, height: 300, bondThickness: 1.0, color: textColor };
    
    try {
        const drawer = new window.SmilesDrawer.Drawer(options);
        window.SmilesDrawer.parse(smiles.trim(), (tree: any) => {
            drawer.draw(tree, canvasRef.current, isDark ? 'dark' : 'light', false);
            setError(null);
        }, (err: any) => {
            console.error(err);
            setError("Invalid SMILES string");
        });
    } catch (e) {
        console.error(e);
        setError("SmilesDrawer Error");
    }
  }, [smiles, view3D]);

  // 3D Rendering
  useEffect(() => {
    if (!view3D || !container3dRef.current || !window.$3Dmol) return;
    
    const fetchAndRender = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const encoded = encodeURIComponent(smiles.trim());
            const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encoded}/SDF?record_type=3d`);
            if (!response.ok) throw new Error("Could not fetch 3D structure");
            const sdf = await response.text();
            
            if (container3dRef.current) {
                const viewer = window.$3Dmol.createViewer(container3dRef.current, { backgroundColor: 'var(--bg-sidebar)' });
                viewer.addModel(sdf, "sdf");
                viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { radius: 0.4 } });
                viewer.zoomTo();
                viewer.render();
            }
        } catch (e) {
            setError((e as Error).message);
            setView3D(false); // Revert to 2D
        } finally {
            setIsLoading(false);
        }
    };
    fetchAndRender();
  }, [view3D, smiles]);

  if (error) {
      return <div className="text-red-400 text-xs p-2 bg-red-900/10 border border-red-500/50 rounded-md font-mono my-4">{error}: {smiles}</div>;
  }

  return (
    <div className="w-full border border-border-color rounded-lg overflow-hidden bg-bg-sidebar my-4 shadow-sm relative flex justify-center items-center min-h-[300px]">
      <button
        onClick={() => setView3D(!view3D)}
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-3 py-1 text-[0.7rem] font-semibold rounded bg-bg-main text-text-main border border-border-color hover:bg-hover-bg transition-colors opacity-90 cursor-pointer"
      >
        <Box size={14} /> {view3D ? 'View 2D' : 'View 3D'}
      </button>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[5] text-white text-sm font-medium backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Loading 3D...
          </div>
        </div>
      )}

      {view3D ? (
        <div
          ref={container3dRef}
          className="w-full max-w-[600px] h-[400px] rounded-lg overflow-hidden"
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full max-w-[600px] h-[400px] block mx-auto"
        />
      )}
    </div>
  );
};


