import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useStore } from '../../store/useStore';

const SchematicCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvas = useRef<fabric.Canvas | null>(null);
  const { projects, activeProjectId, setSelectedComponentId, updateComponent } = useStore();

  const activeProject = projects.find(p => p.id === activeProjectId);
  const components = activeProject?.components || [];

  useEffect(() => {
    if (!canvasRef.current) return;

    fabricCanvas.current = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 280 - (240 + 300),
      height: window.innerHeight - 64 - 32,
      backgroundColor: 'transparent',
    });

    const handleResize = () => {
      if (fabricCanvas.current) {
        fabricCanvas.current.setDimensions({
          width: window.innerWidth - 280 - (240 + 300),
          height: window.innerHeight - 64 - 32,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    fabricCanvas.current.on('selection:created', (e: any) => {
      const selected = e.selected?.[0];
      if (selected && (selected as any).data?.id) {
        setSelectedComponentId((selected as any).data.id);
      }
    });

    fabricCanvas.current.on('selection:updated', (e: any) => {
      const selected = e.selected?.[0];
      if (selected && (selected as any).data?.id) {
        setSelectedComponentId((selected as any).data.id);
      }
    });

    fabricCanvas.current.on('selection:cleared', () => {
      setSelectedComponentId(null);
    });

    fabricCanvas.current.on('object:moving', (e: any) => {
      const obj = e.target;
      if (obj && (obj as any).data?.id) {
        updateComponent((obj as any).data.id, {
          x: obj.left || 0,
          y: obj.top || 0
        });
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      fabricCanvas.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvas.current) return;

    const currentObjects = fabricCanvas.current.getObjects();
    const componentIds = components.map(c => c.id);
    
    currentObjects.forEach(obj => {
      if ((obj as any).data?.id && !componentIds.includes((obj as any).data.id)) {
        fabricCanvas.current?.remove(obj);
      }
    });

    components.forEach(comp => {
      const existingObj = currentObjects.find(obj => (obj as any).data?.id === comp.id);
      
      if (existingObj) {
        existingObj.set({
          left: comp.x,
          top: comp.y
        });
        existingObj.setCoords();
      } else {
        const rect = new fabric.Rect({
          left: comp.x,
          top: comp.y,
          width: 40,
          height: 40,
          fill: '#3b82f6',
          stroke: '#ffffff',
          strokeWidth: 2,
          rx: 4,
          ry: 4,
        });
        (rect as any).data = { id: comp.id, type: comp.type };

        const text = new fabric.IText(comp.type, {
          fontSize: 12,
          fill: '#ffffff',
          originX: 'center',
          originY: 'center',
          left: comp.x + 20,
          top: comp.y + 20,
          selectable: false,
          evented: false
        });

        const group = new fabric.Group([rect, text], {
          left: comp.x,
          top: comp.y,
        });
        (group as any).data = { id: comp.id, type: comp.type };

        fabricCanvas.current?.add(group);
      }
    });

    fabricCanvas.current.renderAll();
  }, [components]);

  return (
    <div className="w-full h-full overflow-hidden">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default SchematicCanvas;
