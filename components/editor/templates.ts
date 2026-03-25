
import { v4 as uuidv4 } from 'uuid';

export const getIdeTemplate = () => {
  const id = `ide-${uuidv4()}`;
  return `\`\`\`ide
{
  "js": "// Write your JavaScript here",
  "html": "<div id=\\"app\\">\\n  <h1>Hello IDE</h1>\\n</div>",
  "css": "body { margin: 1rem; font-family: sans-serif; }\\n#app { color: #3b82f6; }",
  "internal_block_id": "${id}"
}
\`\`\``;
};

export const PLOT_TEMPLATE = `\`\`\`plot
{
  "title": "Interactive Function",
  "xAxis": { "min": 0, "max": 10, "points": 100, "label": "Time (s)" },
  "yAxis": { "label": "Amplitude" },
  "params": [
    { "name": "freq", "label": "Frequency", "type": "slider", "min": 0.5, "max": 5, "step": 0.1, "value": 1 },
    { "name": "amp", "label": "Amplitude", "type": "slider", "min": 0.1, "max": 2, "step": 0.1, "value": 1 }
  ],
  "traces": [
    { "name": "Sine Wave", "expr": "amp * sin(x * freq)" }
  ]
}
\`\`\``;

export const PHYSICS_TEMPLATE = `\`\`\`physics
{
  "width": 600,
  "height": 400,
  "gravity": { "x": 0, "y": 1 },
  "objects": [
    { "type": "circle", "x": 300, "y": 100, "r": 30, "bounciness": 0.9, "color": "#ef4444" },
    { "type": "stack", "x": 300, "y": 300, "rows": 5, "cols": 5, "boxSize": 20 }
  ]
}
\`\`\``;

export const REACTION_TEMPLATE = `\`\`\`chemical-reaction
{
  "title": "Combustion of Methane",
  "reactants": ["CH4", "O2"],
  "products": ["CO2", "H2O"]
}
\`\`\``;

export const getAnnotateTemplate = (src: string = 'https://picsum.photos/seed/anatomy/800/600') => {
  const id = `anno-${uuidv4()}`;
  return `\`\`\`annotate
{
  "src": "${src}",
  "alt": "Annotated Image",
  "annotations": [],
  "internal_block_id": "${id}"
}
\`\`\``;
};

export const getSketchTemplate = () => {
  const id = `sketch-${uuidv4()}`;
  return `\`\`\`sketch
{
  "internal_block_id": "${id}",
  "elements": [],
  "backgroundColor": "#111111"
}
\`\`\``;
};
