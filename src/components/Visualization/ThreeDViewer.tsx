import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../../store/useStore';

const ThreeDViewer: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { projects, activeProjectId } = useStore();
  const activeProject = projects.find(p => p.id === activeProjectId);
  const components = activeProject?.components || [];

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // PCB Board
    const boardGeometry = new THREE.BoxGeometry(4, 3, 0.1);
    const boardMaterial = new THREE.MeshPhongMaterial({ color: 0x1a4d1a });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    scene.add(board);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10, 0x333333, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Component Meshes
    const componentMeshes: THREE.Mesh[] = [];

    const updateComponents = () => {
      // Remove old meshes
      componentMeshes.forEach(mesh => scene.remove(mesh));
      componentMeshes.length = 0;

      // Add new meshes based on schematic components
      components.forEach((comp, index) => {
        const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const material = new THREE.MeshPhongMaterial({ color: 0x3b82f6 });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Map schematic coordinates to 3D space (simple mapping)
        mesh.position.x = (comp.x / 100) - 2;
        mesh.position.y = -(comp.y / 100) + 1.5;
        mesh.position.z = 0.15;
        
        scene.add(mesh);
        componentMeshes.push(mesh);
      });
    };

    updateComponents();

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [components]);

  return (
    <div ref={mountRef} className="w-full h-full bg-slate-950" />
  );
};

export default ThreeDViewer;
