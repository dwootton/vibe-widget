import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const PLANET_DATA = [
  { name: "MERCURY", color: "#A5A5A5", size: 0.8, distance: 15, speed: 0.04 },
  { name: "VENUS", color: "#E3BB76", size: 1.5, distance: 22, speed: 0.015 },
  { name: "EARTH", color: "#2271B3", size: 1.6, distance: 30, speed: 0.01 },
  { name: "MARS", color: "#E27B58", size: 1.2, distance: 38, speed: 0.008 },
  { name: "JUPITER", color: "#D39C7E", size: 3.5, distance: 55, speed: 0.004 },
  { name: "SATURN", color: "#C5AB6E", size: 3.0, distance: 75, speed: 0.002 },
  { name: "URANUS", color: "#BBE1E4", size: 2.2, distance: 90, speed: 0.001 },
  { name: "NEPTUNE", color: "#6081FF", size: 2.1, distance: 105, speed: 0.0008 },
];

export const PlanetLabel = ({ name, selected }) => (
  <div
    style={{
      position: "absolute",
      bottom: "20px",
      left: "20px",
      padding: "12px 20px",
      background: "rgba(0,0,0,0.8)",
      color: "white",
      borderRadius: "8px",
      borderLeft: `4px solid ${selected ? "#00ffcc" : "#555"}`,
      fontFamily: "system-ui, sans-serif",
      pointerEvents: "none",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    }}
  >
    <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.7 }}>
      Selected Body
    </div>
    <div style={{ fontSize: "20px", fontWeight: "bold" }}>{name}</div>
  </div>
);

export default function SolarSystemWidget({ model, React }) {
  const containerRef = React.useRef(null);
  const [selectedPlanet, setSelectedPlanet] = React.useState("EARTH");

  // Sync state with model
  React.useEffect(() => {
    model.set("selected_planet", selectedPlanet);
    model.save_changes();
  }, [selectedPlanet]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 60, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const sunLight = new THREE.PointLight(0xffffff, 2, 300);
    scene.add(sunLight);
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Sun
    const sunGeo = new THREE.SphereGeometry(6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.userData = { name: "SUN" };
    scene.add(sun);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const posArray = new Float32Array(starCount * 3);
    for(let i=0; i<starCount*3; i++) posArray[i] = (Math.random() - 0.5) * 600;
    starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Planets and Orbits
    const planetMeshes = [];
    const orbitGroups = [];

    PLANET_DATA.forEach((data) => {
      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);
      
      // Orbit Path
      const curve = new THREE.EllipseCurve(0, 0, data.distance, data.distance);
      const points = curve.getPoints(100);
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
      const orbitMat = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.3 });
      const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
      orbitLine.rotation.x = Math.PI / 2;
      scene.add(orbitLine);

      // Planet Mesh
      const geometry = new THREE.SphereGeometry(data.size, 32, 32);
      const material = new THREE.MeshStandardMaterial({ color: data.color });
      const planet = new THREE.Mesh(geometry, material);
      planet.position.x = data.distance;
      planet.userData = { name: data.name };
      
      orbitGroup.add(planet);
      planetMeshes.push(planet);
      orbitGroups.push({ group: orbitGroup, speed: data.speed });
    });

    // Selection Glow
    const glowGeo = new THREE.SphereGeometry(1, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ffcc, 
      transparent: true, 
      opacity: 0.4,
      side: THREE.BackSide 
    });
    const selectionGlow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(selectionGlow);

    // Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([...planetMeshes, sun]);

      if (intersects.length > 0) {
        const name = intersects[0].object.userData.name;
        setSelectedPlanet(name);
      }
    };

    renderer.domElement.addEventListener('click', onClick);

    let frameId;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      orbitGroups.forEach(obj => {
        obj.group.rotation.y += obj.speed;
      });

      // Update Selection Highlight
      const active = [...planetMeshes, sun].find(p => p.userData.name === selectedPlanet);
      if (active) {
        selectionGlow.visible = true;
        const worldPos = new THREE.Vector3();
        active.getWorldPosition(worldPos);
        selectionGlow.position.copy(worldPos);
        const scale = active.geometry.parameters.radius * 1.4;
        selectionGlow.scale.set(scale, scale, scale);
      } else {
        selectionGlow.visible = false;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [selectedPlanet]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "500px",
        background: "#050508",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }}></div>
      <PlanetLabel name={selectedPlanet} selected />
      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          color: "rgba(255,255,255,0.5)",
          fontSize: "11px",
          textAlign: "right",
          pointerEvents: "none",
        }}
      >
        DRAG TO ROTATE<br />
        SCROLL TO ZOOM<br />
        CLICK PLANETS TO SELECT
      </div>
    </div>
  );
}
