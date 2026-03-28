
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export const MoleculeViewer3D = ({ smiles, pdb, cid }: { smiles?: string, pdb?: string, cid?: number }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewerRef.current || !(window as any).$3Dmol) {
      setIsLoading(false);
      return;
    }

    viewerRef.current.innerHTML = '';
    const viewer = (window as any).$3Dmol.createViewer(viewerRef.current, {
      backgroundColor: 'transparent'
    });

    const loadMolecule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (pdb) {
          viewer.addModel(pdb, "pdb");
        } else if (cid) {
          const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`);
          if (!response.ok) throw new Error("Failed to fetch CID from PubChem");
          const sdf = await response.text();
          viewer.addModel(sdf, "sdf");
        } else if (smiles) {
          const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/SDF?record_type=3d`);
          if (response.ok) {
            const sdf = await response.text();
            viewer.addModel(sdf, "sdf");
          } else {
            throw new Error("PubChem failed to resolve SMILES to 3D SDF");
          }
        }

        viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } });
        viewer.zoomTo();
        viewer.render();
        viewer.animate({ loop: 'backAndForth', step: 1 });
      } catch (err) {
        console.error("3Dmol Error:", err);
        setError(err instanceof Error ? err.message : "Failed to load molecule");
      } finally {
        setIsLoading(false);
      }
    };

    loadMolecule();

    return () => {
      viewer.clear();
    };
  }, [smiles, pdb, cid]);

  return (
    <div className="relative w-full h-full min-h-[200px] flex items-center justify-center bg-black/5 rounded-2xl overflow-hidden">
      <div ref={viewerRef} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
          <p className="text-[0.6rem] font-bold text-blue-400 uppercase tracking-widest">Generating 3D Conformer...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-sm p-4 text-center">
          <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
          <p className="text-[0.6rem] font-bold text-red-400 uppercase tracking-widest mb-1">Error Loading Molecule</p>
          <p className="text-[0.55rem] text-red-400/60 font-mono line-clamp-2">{error}</p>
        </div>
      )}
    </div>
  );
};
