
import React, { useState, useEffect, useRef } from 'react';
import { balanceEquation } from '../../utils/chemUtils';
import { ArrowRight, FlaskConical, RefreshCw } from 'lucide-react';

// Sub-component for rendering a molecule card
interface MolCardProps {
    formula: string;
    count: number;
    side: 'reactants' | 'products';
    index: number;
    onDragStart: (e: React.DragEvent, side: string, index: number) => void;
}

const MolCard: React.FC<MolCardProps> = ({ 
    formula, 
    count, 
    side, 
    index, 
    onDragStart 
}) => {
    const canvasId = useRef(`mol-canvas-${Math.random().toString(36).substr(2, 9)}`);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const SmiDrawer = (window as any).SmiDrawer || 
                          ((window as any).SmilesDrawer && (window as any).SmilesDrawer.SmiDrawer) ||
                          ((window as any).SmilesDrawer && (window as any).SmilesDrawer.Drawer) ||
                          (window as any).SmilesDrawer;

        if (!SmiDrawer || !canvasRef.current) return;
        
        const style = getComputedStyle(document.body);
        const textColor = style.getPropertyValue('--text-main').trim() || '#ffffff';
        const options = { 
            width: 120, 
            height: 100, 
            padding: 5, 
            bondThickness: 1.0, 
            color: textColor,
            compactDrawing: true
        };
        
        // Simple mapping from formula to SMILES for demo purposes
        const smilesMap: Record<string, string> = {
            "CH4": "C",
            "O2": "O=O",
            "CO2": "O=C=O",
            "H2O": "O",
            "H2": "[H][H]",
            "N2": "N#N",
            "NH3": "N"
        };

        const smiles = smilesMap[formula] || "";

        if(smiles) {
            try {
                const drawer = new SmiDrawer(options);
                if (drawer.draw) {
                    // Use the ID selector to avoid querySelectorAll error with element objects
                    drawer.draw(smiles.trim(), `#${canvasId.current}`, 'dark');
                }
            } catch (e) {
                console.error("MolCard SmilesDrawer Error:", e);
            }
        }
    }, [formula]);

    return (
        <div 
            draggable 
            onDragStart={(e) => onDragStart(e, side, index)}
            style={{ 
                padding: '0.5rem', 
                border: '1px solid var(--border-color)', 
                borderRadius: '0.5rem', 
                background: 'var(--bg-main)',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                cursor: 'grab',
                minWidth: '120px'
            }}
        >
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--accent-color)' }}>{count}</span> {formula}
            </div>
            <canvas 
                id={canvasId.current}
                ref={canvasRef} 
                width={120}
                height={100}
                style={{ width: '120px', height: '100px' }}
            />
        </div>
    );
};

export const ChemicalBalancer = ({ configStr }: { configStr: string }) => {
    const [state, setState] = useState<{reactants: string[], products: string[]}>({ reactants: [], products: [] });
    const [coeffs, setCoeffs] = useState<number[]>([]);
    const [title, setTitle] = useState("Chemical Reaction");

    useEffect(() => {
        try {
            const parsed = JSON.parse(configStr);
            setState({ 
                reactants: parsed.reactants || [], 
                products: parsed.products || [] 
            });
            if(parsed.title) setTitle(parsed.title);
        } catch(e) {}
    }, [configStr]);

    useEffect(() => {
        const calculated = balanceEquation(state.reactants, state.products);
        if (calculated) setCoeffs(calculated);
        else setCoeffs(new Array(state.reactants.length + state.products.length).fill(1));
    }, [state]);

    const handleDragStart = (e: React.DragEvent, side: string, index: number) => {
        e.dataTransfer.setData('molecule', JSON.stringify({ side, index }));
    };

    const handleDrop = (e: React.DragEvent, targetSide: 'reactants' | 'products') => {
        e.preventDefault();
        const data = e.dataTransfer.getData('molecule');
        if (!data) return;
        const { side: sourceSide, index } = JSON.parse(data);

        if (sourceSide === targetSide) return;

        setState(prev => {
            const sourceList = [...(prev as any)[sourceSide]];
            const targetList = [...(prev as any)[targetSide]];
            const [moved] = sourceList.splice(index, 1);
            targetList.push(moved);
            return {
                ...prev,
                [sourceSide]: sourceList,
                [targetSide]: targetList
            };
        });
    };

    return (
        <div className="viz-container">
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FlaskConical size={18} color="var(--accent-color)" />
                {title}
            </h3>
            
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Drag molecules to see the equation balance: 
                <strong style={{ color: 'var(--text-main)', marginLeft: '0.5rem' }}>
                    {state.reactants.map((r, i) => `${coeffs[i] || '?'} ${r}`).join(' + ')} 
                    {' -> '}
                    {state.products.map((p, i) => `${coeffs[state.reactants.length + i] || '?'} ${p}`).join(' + ')}
                </strong>
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {/* Reactants Drop Zone */}
                <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, 'reactants')}
                    style={{ 
                        flex: 1, 
                        minHeight: '150px', 
                        border: '2px dashed var(--border-color)', 
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.1)'
                    }}
                >
                    {state.reactants.map((r, i) => (
                        <MolCard 
                            key={`${r}-${i}-r`} 
                            formula={String(r)} 
                            count={Number(coeffs[i] || 1)} 
                            side="reactants" 
                            index={i} 
                            onDragStart={handleDragStart} 
                        />
                    ))}
                    {state.reactants.length === 0 && <span style={{ margin: 'auto', color: 'var(--text-muted)' }}>Drop Reactants Here</span>}
                </div>

                <ArrowRight size={24} style={{ color: 'var(--text-muted)' }} />

                {/* Products Drop Zone */}
                <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, 'products')}
                    style={{ 
                        flex: 1, 
                        minHeight: '150px', 
                        border: '2px dashed var(--border-color)', 
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.1)'
                    }}
                >
                    {state.products.map((p, i) => (
                        <MolCard 
                            key={`${p}-${i}-p`} 
                            formula={String(p)} 
                            count={Number(coeffs[state.reactants.length + i] || 1)} 
                            side="products" 
                            index={i} 
                            onDragStart={handleDragStart} 
                        />
                    ))}
                    {state.products.length === 0 && <span style={{ margin: 'auto', color: 'var(--text-muted)' }}>Drop Products Here</span>}
                </div>
            </div>
            
            <button onClick={() => setState({ reactants: ["CH4", "O2"], products: ["CO2", "H2O"] })} className="btn" style={{ marginTop: '0.5rem' }}>
                <RefreshCw size={14} /> Reset to Methane Combustion
            </button>
        </div>
    );
};
