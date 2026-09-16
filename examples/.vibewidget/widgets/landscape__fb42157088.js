import * as THREE from 'https://esm.sh/three@0.160.1';
import { OrbitControls } from 'https://esm.sh/three@0.160.1/examples/jsm/controls/OrbitControls';

export default function TerrainViewer({ model, React }) {
  const containerRef = React.useRef(null);
  const rendererRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const cameraRef = React.useRef(null);
  const controlsRef = React.useRef(null);
  const terrainMeshRef = React.useRef(null);

  const updateTerrain = React.useCallback((hm) => {
    if (!terrainMeshRef.current) return;
    const mesh = terrainMeshRef.current;
    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    
    // Fallback hill formula
    const getFallbackHeight = (i) => {
      const x = i % 64;
      const y = Math.floor(i / 64);
      return 0.30 + 0.22 * Math.sin(x / 9) * Math.sin(y / 9)
             + 0.12 * Math.sin(x / 4 + 1.2) * Math.cos(y / 5);
    };

    const colors = [];
    const color = new THREE.Color();

    for (let i = 0; i < 4096; i++) {
      const h = (hm && hm[i] !== undefined) ? hm[i] : getFallbackHeight(i);
      
      // Update Y Position
      posAttr.setY(i, h * 40);

      // Height-based coloring
      if (h < 0.12) color.set('#1a3a6b');      // deep water
      else if (h < 0.18) color.set('#2d6a9f'); // shallow
      else if (h < 0.40) color.set('#3a7d44'); // lowland
      else if (h < 0.60) color.set('#6b8e23'); // highland
      else if (h < 0.80) color.set('#8b7355'); // rock
      else color.set('#f0f0f0');               // snow

      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(containerRef.current.clientWidth, 480);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, containerRef.current.clientWidth / 480, 0.1, 2000);
    camera.position.set(0, 45, 90);
    camera.lookAt(0, 5, 0);
    cameraRef.current = camera;

    // 3. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 5, 0);
    controlsRef.current = controls;

    // 4. Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xfff4e0, 1.2);
    directional.position.set(60, 100, 40);
    scene.add(directional);

    // 5. Terrain Mesh
    const terrainGeo = new THREE.PlaneGeometry(100, 100, 63, 63);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({ 
      vertexColors: true, 
      roughness: 0.85 
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // 6. Water Plane
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

    // 7. Initial Terrain Generation
    updateTerrain(model.get('heightmap'));

    // 8. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width } = entries[0].contentRect;
      const height = 480;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(containerRef.current);

    // 9. Reactivity & Animation
    const handleHeightmapChange = () => {
      updateTerrain(model.get('heightmap'));
    };
    model.on('change:heightmap', handleHeightmapChange);

    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      model.off('change:heightmap', handleHeightmapChange);
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      waterGeo.dispose();
      waterMat.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [model, updateTerrain]);

  return (
    <div 
      ref={containerRef} 
      className="terrain-viewer-container" 
      style={{ 
        width: '100%', 
        height: '480px', 
        overflow: 'hidden', 
        borderRadius: '8px',
        background: '#000'
      }} 
    />
  );
}