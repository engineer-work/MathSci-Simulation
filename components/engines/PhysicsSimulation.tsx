
import React, { useRef, useEffect, useState } from 'react';
import { drawArrow, getStyles } from '../../utils/physicsUtils';

export const PhysicsSimulation = ({ configStr }: { configStr: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailsRef = useRef<Record<number, {x: number, y: number}[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.Matter || !canvasRef.current || !containerRef.current) return;
    let engine: any, render: any, runner: any;
    trailsRef.current = {};

    const { Engine, Render, Runner, World, Bodies, Mouse, MouseConstraint, Composite, Events, Body } = window.Matter;

    try {
        const config = JSON.parse(configStr);
        engine = Engine.create();
        if (config.gravity) { engine.world.gravity.x = config.gravity.x || 0; engine.world.gravity.y = config.gravity.y !== undefined ? config.gravity.y : 1; }
        if (config.vectorMode) { engine.world.gravity.y = 0; engine.world.gravity.x = 0; }

        const styles = getStyles();
        const width = config.width || 600;
        const height = config.height || 400;

        render = Render.create({
            element: containerRef.current, engine: engine, canvas: canvasRef.current,
            options: { width, height, background: styles.bgColor, wireframes: false, showAngleIndicator: false }
        });

        // Setup Objects
        const bodies: any[] = [];
        const wallOpts = { isStatic: true, render: { fillStyle: styles.borderColor } };
        bodies.push(Bodies.rectangle(width/2, height + 25, width, 50, wallOpts), Bodies.rectangle(width/2, -25, width, 50, wallOpts));
        bodies.push(Bodies.rectangle(width + 25, height/2, 50, height, wallOpts), Bodies.rectangle(-25, height/2, 50, height, wallOpts));

        if (config.objects) {
            config.objects.forEach((obj: any) => {
                const opts = { isStatic: obj.isStatic, restitution: obj.bounciness||0.5, friction: obj.friction||0.1, frictionAir: obj.frictionAir||0.01, render: { fillStyle: obj.color||styles.accentColor } };
                if (obj.type === 'circle') bodies.push(Bodies.circle(obj.x, obj.y, obj.r, opts));
                else if (obj.type === 'rectangle') bodies.push(Bodies.rectangle(obj.x, obj.y, obj.w, obj.h, opts));
                else if (obj.type === 'stack') {
                    const stack = Composite.add(engine.world, Composite.create());
                    for(let i=0; i<(obj.rows||5); i++) for(let j=0; j<(obj.cols||5); j++) {
                        Composite.add(stack, Bodies.rectangle(obj.x + j*(obj.boxSize||30), obj.y - i*(obj.boxSize||30), obj.boxSize||30, obj.boxSize||30, {...opts, render: { fillStyle: j%2===0?styles.accentColor:styles.textColor }}));
                    }
                }
            });
        }
        
        const vectorHeads: Record<string, any> = {};
        if (config.vectorMode && config.vectors) {
             config.vectors.forEach((v: any) => {
                  let vx = v.initial ? v.initial.x : 50, vy = v.initial ? v.initial.y : -50;
                  if (v.magnitude !== undefined && v.angle !== undefined) {
                      const rad = (v.angle * Math.PI) / 180; vx = v.magnitude * Math.cos(rad); vy = -v.magnitude * Math.sin(rad); 
                  }
                  const origin = v.origin || {x: width/2, y: height/2};
                  const head = Bodies.circle(origin.x + vx, origin.y + vy, 10, { isVectorHandle: true, frictionAir: 0.1, render: { fillStyle: v.color||styles.accentColor } });
                  vectorHeads[v.id] = head; bodies.push(head);
             });
        }
        Composite.add(engine.world, bodies);

        Events.on(render, 'afterRender', () => {
            const ctx = render.context;
            if (config.grid) {
                ctx.beginPath(); ctx.strokeStyle = '#334155'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
                for(let x=0; x<=width; x+=config.grid.spacing||50) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
                for(let y=0; y<=height; y+=config.grid.spacing||50) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
                ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (config.axes) {
                const origin = config.axes.origin || {x: width/2, y: height/2};
                drawArrow(ctx, 0, origin.y, width, origin.y, styles.mutedColor, 'x', false, 2);
                drawArrow(ctx, origin.x, height, origin.x, 0, styles.mutedColor, 'y', false, 2);
            }
            if (config.vectorMode && config.vectors) {
                config.vectors.forEach((v: any) => {
                    const head = vectorHeads[v.id]; if(!head) return;
                    const origin = v.origin || {x: width/2, y: height/2};
                    drawArrow(ctx, origin.x, origin.y, head.position.x, head.position.y, v.color||styles.accentColor, v.label);
                    if (v.showComponents) {
                        drawArrow(ctx, origin.x, origin.y, head.position.x, origin.y, '#ef4444', '', false, 2);
                        drawArrow(ctx, origin.x, origin.y, origin.x, head.position.y, '#10b981', '', false, 2);
                    }
                });
                if (config.operations) {
                     config.operations.forEach((op: any) => {
                         if (op.type === 'scale' && vectorHeads[op.source]) {
                             const src = vectorHeads[op.source];
                             const origin = config.vectors.find((v:any) => v.id===op.source)?.origin || {x: width/2, y: height/2};
                             const start = op.offset ? {x: origin.x+op.offset.x, y: origin.y+op.offset.y} : origin;
                             const dx = src.position.x - origin.x, dy = src.position.y - origin.y;
                             drawArrow(ctx, start.x, start.y, start.x + dx*op.factor, start.y + dy*op.factor, op.color, op.label);
                         } else if ((op.type === 'add' || op.type === 'subtract') && vectorHeads[op.sources[0]] && vectorHeads[op.sources[1]]) {
                             const v1 = vectorHeads[op.sources[0]].position, v2 = vectorHeads[op.sources[1]].position;
                             const o = {x: width/2, y: height/2};
                             const res = op.type==='add' ? {x: (v1.x-o.x)+(v2.x-o.x), y: (v1.y-o.y)+(v2.y-o.y)} : {x: (v1.x-o.x)-(v2.x-o.x), y: (v1.y-o.y)-(v2.y-o.y)};
                             drawArrow(ctx, o.x, o.y, o.x+res.x, o.y+res.y, op.color, op.label);
                         }
                     });
                }
            }
        });

        const mouse = Mouse.create(render.canvas);
        Composite.add(engine.world, MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false }}}));
        render.mouse = mouse;

        Render.run(render); runner = Runner.create(); Runner.run(runner, engine);
        setError(null);
    } catch (e) { console.error(e); setError("Config Error: " + (e as Error).message); }

    return () => { if(render) { Render.stop(render); render.canvas.remove(); } if(runner) Runner.stop(runner); };
  }, [configStr]);

  if (error) return (
    <div className="text-red-400 text-xs p-2 bg-red-900/10 border border-red-500/50 rounded-md font-mono my-4">
      {error}
    </div>
  );

  return (
    <div className="w-full border border-border-color rounded-lg overflow-hidden bg-bg-sidebar my-4 shadow-sm flex justify-center p-4 relative">
      <div ref={containerRef}>
        <canvas ref={canvasRef} className="max-w-full h-auto rounded shadow-inner" />
      </div>
    </div>
  );
};
