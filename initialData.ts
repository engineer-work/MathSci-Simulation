import { FileNode, NodeType } from './types';

export const CORNELL_TEMPLATE = `# Cues
- [Cue 1]
- [Cue 2]

# Notes
- [Note 1]
- [Note 2]

# Summary
[Write a brief summary of the main points here]
`;

export const initialNodes: FileNode[] = [
  // --- Folders ---
  { id: 'folder-welcome', parentId: null, name: 'Welcome', type: NodeType.FOLDER, content: '', createdAt: Date.now() },
  { id: 'folder-docs', parentId: null, name: 'Features Documentation', type: NodeType.FOLDER, content: '', createdAt: Date.now() },
  { id: 'folder-demos', parentId: null, name: 'Demos', type: NodeType.FOLDER, content: '', createdAt: Date.now() },
  { id: 'folder-templates', parentId: null, name: 'Templates', type: NodeType.FOLDER, content: '', createdAt: Date.now() },

  // --- Welcome File ---
  { id: 'file-intro', parentId: 'folder-welcome', name: 'Intro', type: NodeType.FILE, content: `# Welcome to MathSci Editor 🚀

MathSci is a specialized editor for Mathematics and Science, combining Markdown with powerful simulation engines.

### 📚 Documentation & Features
Check the **Features Documentation** folder for detailed guides on:
- **Markdown Basics**: Formatting text, lists, and tables.
- **Math & Chemistry**: Writing LaTeX equations, Organic Structures, and Chemical Reactions.
- **Diagrams & Charts**: Creating Flowcharts (Mermaid) and Interactive Plots.
- **3D Models**: Visualizing GLB/GLTF assets.
- **Physics**: Interactive 2D physics simulations.

Use the toolbar to insert templates for these features.
 
# Babylon.js Professional Engine
Advanced 3D scene with ArcRotateCamera controls.

\`\`\`ide
{
  "js": "const canvas = document.getElementById('renderCanvas');\\nconst engine = new BABYLON.Engine(canvas, true);\\n\\nconst createScene = function () {\\n    const scene = new BABYLON.Scene(engine);\\n    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.05, 1);\\n\\n    const camera = new BABYLON.ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), scene);\\n    camera.attachControl(canvas, true);\\n\\n    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);\\n    light.intensity = 0.7;\\n\\n    const box = BABYLON.MeshBuilder.CreateBox('box', { size: 4 }, scene);\\n    const mat = new BABYLON.StandardMaterial('mat', scene);\\n    mat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 1);\\n    mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.2);\\n    box.material = mat;\\n\\n    const ground = BABYLON.MeshBuilder.CreateGround('gd', { width: 30, height: 30 }, scene);\\n    return scene;\\n};\\n\\nconst scene = createScene();\\nengine.runRenderLoop(() => scene.render());\\nwindow.addEventListener('resize', () => engine.resize());",
  "html": "<canvas id=\\"renderCanvas\\" style=\\"width:100%;height:100%\\"></canvas>\\n<script src=\\"https://cdn.babylonjs.com/babylon.js\\"></script>",
  "css": "body { margin:0; padding:0; height:100vh; overflow:hidden; background: #000; }",
  "internal_block_id": "ide-babylon-box"
}
\`\`\`

`, createdAt: Date.now() },
  // --- Features Documentation ---
  { id: 'doc-01', parentId: 'folder-docs', name: '01_Markdown_Basics', type: NodeType.FILE, content: `# Markdown Basics

## Image

![Image](https://deep-image.ai/blog/content/images/size/w1600/2022/08/magic-g1db898374_1920.jpg)

## Text Formatting
*   **Bold**: \`**bold**\`
*   *Italic*: \`*italic*\`
*   ~~Strikethrough~~: \`~~strikethrough~~\`

## Lists
1.  Ordered Item 1
2.  Ordered Item 2

*   Unordered Item 1
*   Unordered Item 2
    *   Nested

## Tables
| Syntax | Description |
| :--- | :--- |
| Header | Title |
| Paragraph | Text |

## Check box

- [ ] text 1
- [x] text 1


## Code
Inline \`code\` using backticks.
Block code:
\`\`\`javascript
console.log("Hello World");
\`\`\`
`, createdAt: Date.now() },

{ id: 'doc-02', parentId: 'folder-docs', name: '02_Math_and_Chemistry', type: NodeType.FILE, content: `# Math & Chemistry

## LaTeX Math (KaTeX)
Inline: $E = mc^2$

Block:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Chemical Equations (mhchem)
Use \`\\ce{}\` inside math blocks:
$$
\\ce{CH4 + 2O2 -> CO2 + 2H2O}
$$

### 1. Complete combustion of methane with enthalpy 

$$
\\ce{CH4 + 2O2 -> CO2 + 2H2O \\; \\Delta H = -890.3 kJ/mol}
$$

### 2. Partial oxidation (produces CO)

$$
\\ce{2CH4 + 3O2 -> 2CO + 4H2O}
$$

### 3. Methane chlorination (radical halogenation)

$$
\\ce{CH4 + Cl2 -> CH3Cl + HCl}
$$

### 4. Equilibrium reaction

$$
\\ce{CO + H2O <=> CO2 + H2}
$$

### 5. Combustion in air (with nitrogen)

$$
\\ce{CH4 + 2(O2 + 3.76 N2) -> CO2 + 2H2O + 7.52 N2}
$$


## Organic Molecules (SMILES)
Render structures using SMILES strings:
\`\`\`smiles
c1ccccc1
\`\`\`
`, createdAt: Date.now() },

{ id: 'doc-03', parentId: 'folder-docs', name: '03_Diagrams_and_Charts', type: NodeType.FILE, content: `# Diagrams & Charts

## Mermaid Diagrams (Interactive)
Flowcharts, Sequence diagrams, and more. You can now **drag to pan**, **scroll to zoom**, and enter **fullscreen**.

\`\`\`mermaid
flowchart TD
    A[In this beginner level course,]
    B[our Spring experts guide you]
    C[through building and deploying]
    D[a fully functional,]
    E[secure,]
    F[well-tested RESTful API]
    G[for a hypothetical<br>Family Cash Card application.]
    
    A --> B --> C --> D --> E --> F --> G

\`\`\`

## Interactive Plots
Plot mathematical functions with sliders and 3D support.

### 3D Surface Plot
\`\`\`plot
{
  "internal_block_id": "plot-3d-surface",
  "type": "3d",
  "title": "3D Wave Interference",
  "xAxis": { "label": "X", "min": -5, "max": 5, "points": 40 },
  "yAxis": { "label": "Y", "min": -5, "max": 5 },
  "zAxis": { "label": "Amplitude" },
  "traces": [
    {
      "name": "Interference Pattern",
      "expr": "sin(sqrt(x^2 + y^2) - time)",
      "colorscale": "Viridis"
    }
  ],
  "params": [
    { "name": "time", "label": "Time Phase", "type": "slider", "min": 0, "max": 6.28, "step": 0.1, "value": 0 },
    { "name": "reset", "label": "Reset View", "type": "button", "action": "reset" }
  ]
}
\`\`\`

### 2D Interactive Plot
\`\`\`plot
{
  "internal_block_id": "plot-2d-sine",
  "title": "Dynamic Sine Wave",
  "xAxis": { "label": "X", "min": 0, "max": 10 },
  "yAxis": { "label": "Y" },
  "traces": [
    { "name": "sin(x)", "expr": "amp * sin(x * freq + phase + time)", "color": "#3b82f6" }
  ],
  "params": [
    { "name": "amp", "label": "Amplitude", "type": "slider", "min": 0.1, "max": 2, "value": 1 },
    { "name": "freq", "label": "Frequency", "type": "slider", "min": 0.5, "max": 5, "value": 1 },
    { "name": "phase", "label": "Phase Offset", "type": "slider", "min": 0, "max": 6.28, "value": 0 }
  ]
}
\`\`\`
`, createdAt: Date.now() },

{ id: 'doc-04', parentId: 'folder-docs', name: '04_3D_Models', type: NodeType.FILE, content: 
`
 # 3D Models

Interactive 3D model viewer for GLB and GLTF files. Supports local upload and remote URLs.

## Example: Astronaut
\`\`\`model
{
  "internal_block_id": "astronaut-model",
  "src": "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
  "alt": "A 3D model of an astronaut",
  "autoRotate": true,
  "cameraControls": true,
  "exposure": 1,
  "shadowIntensity": 1,
  "markers": [
    { "id": "m1", "label": "Helmet", "x": 0, "y": 1.7, "z": 0.2, "color": "#3b82f6" },
    { "id": "m2", "label": "Backpack", "x": 0, "y": 1.2, "z": -0.4, "color": "#ef4444" }
  ]
}
\`\`\`

`
  
  
  , createdAt: Date.now() },

{ id: 'doc-05', parentId: 'folder-docs', name: '05_Physics_Engine', type: NodeType.FILE, content: `# Physics Engine

Interactive 2D physics simulations using Matter.js.

## Example: Stack & Ball
\`\`\`physics
{
  "gravity": { "y": 1 },
  "objects": [
    { "type": "circle", "x": 300, "y": 50, "r": 30, "bounciness": 0.9 },
    { "type": "stack", "x": 300, "y": 300, "rows": 6, "cols": 1 }
  ]
}
\`\`\`
`, createdAt: Date.now() },

{ id: 'doc-06', parentId: 'folder-docs', name: '06_Image_Annotation', type: NodeType.FILE, content: `# Interactive Image Annotation 🎨

MathSci allows you to create interactive, labeled image annotations. This is perfect for anatomy, geography, or technical diagrams.

## ✨ Features
- **Click to Add**: Click anywhere on the image to add a marker.
- **Interactive Legend**: Hover over markers or legend items to highlight them.
- **Edit Mode**: Click an existing marker to edit its label, description, or color.
- **Zoom & Fullscreen**: Use the controls in the top-right to inspect details.

## Example: Frontier Supercomputer (ORNL) 🖥️

\`\`\`annotate
{
  "src": "https://thetechrevolutionist.com/wp-content/uploads/2022/06/FRONTIER-ORNL-1.jpg",
  "alt": "Frontier Supercomputer at ORNL",
  "annotations": [
    { "x": 30, "y": 40, "label": "Compute Racks", "color": "#38bdf8", "size": 18, "description": "Contains thousands of AMD EPYC CPUs and Instinct GPUs.", "shape": "square" },
    { "x": 60, "y": 70, "label": "Cooling System", "color": "#ef4444", "size": 16, "description": "Advanced liquid cooling to manage exascale heat.", "shape": "diamond" },
    { "x": 15, "y": 25, "label": "Storage Array", "color": "#10b981", "size": 14, "description": "High-speed Orion storage system.", "shape": "triangle" }
  ]
}
\`\`\`

## Example: Human Eye Anatomy 👁️

\`\`\`annotate
{
  "src": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Schematic_diagram_of_the_human_eye_en.svg/1200px-Schematic_diagram_of_the_human_eye_en.svg.png",
  "alt": "Human Eye Anatomy",
  "annotations": [
    { "x": 25, "y": 50, "label": "Cornea", "color": "#3b82f6", "size": 14, "description": "The transparent front part of the eye that covers the iris and pupil." },
    { "x": 45, "y": 45, "label": "Lens", "color": "#ef4444", "size": 16, "description": "Focuses light onto the retina." },
    { "x": 80, "y": 50, "label": "Retina", "color": "#10b981", "size": 14, "description": "The light-sensitive inner surface of the eye." }
  ]
}
\`\`\`
`, createdAt: Date.now() },
  { id: 'doc-07', parentId: 'folder-docs', name: '07_Sketch_Board', type: NodeType.FILE, content: `# Sketch Board 🎨

Interactive sketching with animation support. Use the **Select** tool to click an element and add a math-based animation.

## Animated Example
\`\`\`sketch
{
  "internal_block_id": "sketch-demo",
  "elements": [
    {
      "id": "rect-1",
      "type": "rect",
      "tool": "pen",
      "x": 100,
      "y": 100,
      "width": 100,
      "height": 100,
      "stroke": "#a855f7",
      "strokeWidth": 2,
      "animation": {
        "property": "x",
        "equation": "100 * sin(t * 2)",
        "enabled": true
      }
    },
    {
      "id": "circle-1",
      "type": "circle",
      "tool": "pen",
      "x": 400,
      "y": 200,
      "radius": 50,
      "stroke": "#3b82f6",
      "strokeWidth": 2,
      "animation": {
        "property": "y",
        "equation": "50 * cos(t * 3)",
        "enabled": true
      }
    }
  ],
  "backgroundColor": "#111111"
}
\`\`\`
`, createdAt: Date.now() },
  { id: 'template-cornell', parentId: 'folder-templates', name: 'Cornell_Note_Template', type: NodeType.FILE, content: CORNELL_TEMPLATE, isCornell: true, createdAt: Date.now() },
  { id: 'demo-webgl', parentId: 'folder-demos', name: 'WebGL_Demo.md', type: NodeType.FILE, content: `# WebGL Demo\n\`\`\`ide\n{\n  "js": "console.log('Hello World');"\n}\n\`\`\``, createdAt: Date.now() }
];
