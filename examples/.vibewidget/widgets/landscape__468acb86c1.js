import * as THREE from 'https://esm.sh/three@0.160.1';
import { OrbitControls } from 'https://esm.sh/three@0.160.1/examples/jsm/controls/OrbitControls';

/**
 * Helper to convert hex string to THREE.Color
 */
const hexToColor = (hex) => new THREE.Color(hex);

/**
 * TerrainViewer Component
 * Renders a 3D terrain based on a heightmap array.
 */
export const TerrainViewer = ({ model, React }) => {
  const containerRef = React.useRef(null);
  const rendererRef = React.useRef(null);
  const requestRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const terrainMeshRef = React.useRef(null);

  const updateTerrain = (hm) => {
    const mesh = terrainMeshRef.current;
    if (!mesh) return;

    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);

    const getFallbackHeight = (i) => {
      const x = i % 64;
      const z = Math.floor(i / 64);
      return 0.30 + 0.22 * Math.sin(x / 9) * Math.sin(z / 9)
             + 0.12 * Math.sin(x / 4 + 1.2) * Math.cos(z / 5);
    };

    for (let i = 0; i < count; i++) {
      let h = (hm && hm[i] !== undefined) ? hm[i] : getFallbackHeight(i);
      
      // Set Vertex Height
      posAttr.setY(i, h * 40);

      // Determine Color Band
      let color;
      if (h < 0.12) color = hexToColor('#1a3a6b');      // deep water
      else if (h < 0.18) color = hexToColor('#2d6a9f'); // shallow
      else if (h < 0.40) color = hexToColor('#3a7d44'); // lowland
      else if (h < 0.60) color = hexToColor('#6b8e23'); // highland
      else if (h < 0.80) color = hexToColor('#8b7355'); // rock
      else color = hexToColor('#f0f0f0');               // snow

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  React.useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = 500;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
    camera.position.set(0, 45, 90);
    camera.lookAt(0, 5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xfff4e0, 1.2);
    directional.position.set(60, 100, 40);
    scene.add(directional);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 5, 0);

    // --- Terrain Mesh ---
    const geometry = new THREE.PlaneGeometry(100, 100, 63, 63);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ 
      vertexColors: true, 
      roughness: 0.85 
    });
    const terrain = new THREE.Mesh(geometry, material);
    scene.add(terrain);
    terrainMeshRef.current = terrain;

    // --- Water Plane ---
    const waterGeo = new THREE.PlaneGeometry(104, 104);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x006994,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 6;
    scene.add(water);

    // --- Initial Data ---
    updateTerrain(model.get('heightmap'));

    // --- Resize Handling ---
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(containerRef.current);

    // --- Animation Loop ---
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);

    // --- Model Listeners ---
    const handleChange = () => updateTerrain(model.get('heightmap'));
    model.on('change:heightmap', handleChange);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
      model.off('change:heightmap', handleChange);
      
      // Dispose resources
      geometry.dispose();
      material.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '500px', 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        background: '#000'
      }} 
    />
  );
};

export default function Widget({ model, React }) {
  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#333' }}>3D Terrain Explorer</h3>
        <span style={{ fontSize: '12px', color: '#666' }}>Orbit: Left Click | Zoom: Scroll | Pan: Right Click</span>
      </div>
      <TerrainViewer model={model} React={React} />
    </div>
  );
}