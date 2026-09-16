import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import * as d3 from "https://esm.sh/d3@7";

// Viridis color helper
function viridisColor(t) {
  const c = d3.interpolateViridis(Math.max(0, Math.min(1, t)));
  return new THREE.Color(c);
}

const OUTCOME_COLORS = {
  success: "#2e7d32",
  slip: "#e65100",
  collision: "#c62828",
  unreachable: "#757575"
};

export const ScoreSlider = ({ value, onChange, min = 0.3, max = 1.0, step = 0.01, count, total }) => (
  <div style={{ marginBottom: "16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
      <label style={{ fontFamily: "Georgia, serif", fontSize: "13px", fontWeight: "600", color: "#222" }}>
        Predicted score ≥
      </label>
      <span style={{ fontFamily: "'Fira Code', monospace", fontSize: "12px", color: "#666" }}>
        {value.toFixed(2)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{
        width: "100%",
        accentColor: "#2b4c7e",
        cursor: "pointer",
        margin: "4px 0"
      }}
    />
    <div style={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", color: "#555", marginTop: "2px" }}>
      showing <strong style={{ color: "#111" }}>{count}</strong> of {total}
    </div>
  </div>
);

export const OutcomeChips = ({ counts, activeMap, onToggle }) => (
  <div style={{ marginBottom: "16px" }}>
    <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", fontWeight: "600", color: "#222", marginBottom: "8px" }}>
      Outcome filter
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {Object.entries(OUTCOME_COLORS).map(([outcome, color]) => {
        const active = activeMap[outcome] !== false;
        const count = counts[outcome] || 0;
        return (
          <button
            key={outcome}
            type="button"
            onClick={() => onToggle(outcome)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 9px",
              borderRadius: "14px",
              border: `1.5px solid ${active ? color : "#ccc"}`,
              background: active ? `${color}18` : "#f5f5f5",
              color: active ? "#111" : "#888",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "'Fira Code', monospace",
              transition: "all 0.15s ease",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: active ? color : "#aaa",
                display: "inline-block"
              }}
            />
            <span style={{ textTransform: "capitalize" }}>{outcome}</span>
            <span style={{ opacity: 0.7, fontSize: "10px" }}>({count})</span>
          </button>
        );
      })}
    </div>
  </div>
);

export const ColorBySwitch = ({ mode, onChange }) => (
  <div style={{ marginBottom: "18px" }}>
    <div style={{ fontFamily: "Georgia, serif", fontSize: "13px", fontWeight: "600", color: "#222", marginBottom: "6px" }}>
      Colour by
    </div>
    <div
      style={{
        display: "flex",
        background: "#ede8df",
        padding: "2px",
        borderRadius: "6px"
      }}
    >
      {["outcome", "score"].map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              flex: 1,
              padding: "5px 10px",
              border: "none",
              borderRadius: "5px",
              background: active ? "#fff" : "transparent",
              color: active ? "#111" : "#666",
              fontWeight: active ? "600" : "400",
              fontFamily: "'Fira Code', monospace",
              fontSize: "11px",
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "background 0.15s ease",
              textTransform: "capitalize"
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
    {mode === "score" && (
      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            height: "10px",
            borderRadius: "4px",
            background: "linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)"
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'Fira Code', monospace",
            fontSize: "10px",
            color: "#666",
            marginTop: "3px"
          }}
        >
          <span>0.30</span>
          <span>score viridis</span>
          <span>1.00</span>
        </div>
      </div>
    )}
  </div>
);

export const GraspInspector = ({ grasp }) => {
  if (!grasp) {
    return (
      <div
        style={{
          padding: "12px",
          background: "#f4f0e8",
          borderRadius: "6px",
          border: "1px dashed #cfc8be",
          color: "#777",
          fontFamily: "Georgia, serif",
          fontSize: "12px",
          fontStyle: "italic",
          lineHeight: "1.5"
        }}
      >
        Click a grasp glyph to inspect approach axis, contacts, and metadata. Use ↑ / ↓ keys to step through candidates.
      </div>
    );
  }

  const outcomeCol = OUTCOME_COLORS[grasp.outcome] || "#444";

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "#fff",
        borderRadius: "8px",
        border: "1px solid #e2ddd3",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
          borderBottom: "1px solid #f0ece3",
          paddingBottom: "6px"
        }}
      >
        <span style={{ fontFamily: "Georgia, serif", fontSize: "14px", fontWeight: "700", color: "#111" }}>
          Grasp #{grasp.grasp}
        </span>
        <span
          style={{
            background: `${outcomeCol}20`,
            color: outcomeCol,
            fontWeight: "700",
            fontFamily: "'Fira Code', monospace",
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "10px",
            textTransform: "uppercase",
            border: `1px solid ${outcomeCol}55`
          }}
        >
          {grasp.outcome}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontFamily: "'Fira Code', monospace", fontSize: "11px" }}>
        <div>
          <span style={{ color: "#777", display: "block", fontSize: "10px" }}>REGION</span>
          <strong style={{ color: "#222" }}>{grasp.region}</strong>
        </div>
        <div>
          <span style={{ color: "#777", display: "block", fontSize: "10px" }}>SCORE</span>
          <strong style={{ color: "#222" }}>{grasp.score.toFixed(3)}</strong>
        </div>
        <div>
          <span style={{ color: "#777", display: "block", fontSize: "10px" }}>WIDTH</span>
          <strong style={{ color: "#222" }}>{(grasp.width * 100).toFixed(1)} cm</strong>
        </div>
        <div>
          <span style={{ color: "#777", display: "block", fontSize: "10px" }}>APPROACH</span>
          <strong style={{ color: "#222" }}>
            [{grasp.ax.toFixed(1)}, {grasp.ay.toFixed(1)}, {grasp.az.toFixed(1)}]
          </strong>
        </div>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  // Sync traits with model
  const cloudData = model.get("cloud") || [];
  const rawGraspData = model.get("data") || [];

  // Parse pandas data frames (could be records or columnar)
  const cloud = React.useMemo(() => {
    if (!cloudData) return [];
    if (Array.isArray(cloudData)) return cloudData;
    if (cloudData.x && Array.isArray(cloudData.x)) {
      const len = cloudData.x.length;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push({ x: cloudData.x[i], y: cloudData.y[i], z: cloudData.z[i] });
      }
      return arr;
    }
    return [];
  }, [cloudData]);

  const grasps = React.useMemo(() => {
    if (!rawGraspData) return [];
    if (Array.isArray(rawGraspData)) return rawGraspData;
    if (rawGraspData.grasp && Array.isArray(rawGraspData.grasp)) {
      const len = rawGraspData.grasp.length;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push({
          grasp: rawGraspData.grasp[i],
          region: rawGraspData.region ? rawGraspData.region[i] : "",
          x: rawGraspData.x[i],
          y: rawGraspData.y[i],
          z: rawGraspData.z[i],
          ax: rawGraspData.ax[i],
          ay: rawGraspData.ay[i],
          az: rawGraspData.az[i],
          width: rawGraspData.width[i],
          score: rawGraspData.score[i],
          outcome: rawGraspData.outcome[i]
        });
      }
      return arr;
    }
    return [];
  }, [rawGraspData]);

  // UI state
  const [minScore, setMinScore] = React.useState(0.5);
  const [selectedId, setSelectedId] = React.useState(null);
  const [colorMode, setColorMode] = React.useState("outcome");
  const [outcomeFilter, setOutcomeFilter] = React.useState({
    success: true,
    slip: true,
    collision: true,
    unreachable: true
  });

  // Keep output synced
  React.useEffect(() => {
    model.set("min_score", minScore);
    model.set("selected", selectedId);
    model.save_changes();
  }, [minScore, selectedId]);

  // DOM & Three refs
  const mountRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const threeStateRef = React.useRef(null);

  // Filtered grasps list (ordered by score descending for keyboard navigation)
  const visibleGrasps = React.useMemo(() => {
    return grasps
      .filter((g) => g.score >= minScore && outcomeFilter[g.outcome] !== false)
      .sort((a, b) => b.score - a.score);
  }, [grasps, minScore, outcomeFilter]);

  const outcomeCounts = React.useMemo(() => {
    const counts = { success: 0, slip: 0, collision: 0, unreachable: 0 };
    grasps.forEach((g) => {
      if (counts[g.outcome] !== undefined) counts[g.outcome]++;
    });
    return counts;
  }, [grasps]);

  const selectedGrasp = React.useMemo(() => {
    if (selectedId === null) return null;
    return grasps.find((g) => g.grasp === selectedId) || null;
  }, [grasps, selectedId]);

  // Keep references inside Three.js scene for imperatively updating visibility & highlight
  const sceneStateRef = React.useRef({
    selectedId: null,
    minScore: 0.5,
    outcomeFilter: { success: true, slip: true, collision: true, unreachable: true },
    colorMode: "outcome",
    visibleGrasps: []
  });

  React.useEffect(() => {
    sceneStateRef.current = {
      selectedId,
      minScore,
      outcomeFilter,
      colorMode,
      visibleGrasps
    };
  }, [selectedId, minScore, outcomeFilter, colorMode, visibleGrasps]);

  // Keyboard navigation for visible grasps (highest score first)
  const handleKeyDown = React.useCallback(
    (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const list = sceneStateRef.current.visibleGrasps;
      if (!list || list.length === 0) return;

      const curId = sceneStateRef.current.selectedId;
      const currentIndex = list.findIndex((g) => g.grasp === curId);

      let nextIndex = 0;
      if (currentIndex === -1) {
        nextIndex = e.key === "ArrowDown" ? 0 : list.length - 1;
      } else {
        if (e.key === "ArrowDown") {
          // next lower score
          nextIndex = (currentIndex + 1) % list.length;
        } else {
          // next higher score
          nextIndex = (currentIndex - 1 + list.length) % list.length;
        }
      }
      setSelectedId(list[nextIndex].grasp);
    },
    []
  );

  // Initialize Three.js scene once
  React.useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 540;
    const height = 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#fbf9f4");

    // Camera setup with Z up
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 10);
    camera.up.set(0, 0, 1);
    camera.position.set(0.24, -0.32, 0.22);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.015, 0.0, 0.05);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0.5, -0.5, 0.8);
    scene.add(dirLight);

    // Table plane at z=0 (light)
    const tableGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const tableMat = new THREE.MeshBasicMaterial({
      color: 0xede8df,
      side: THREE.DoubleSide
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    scene.add(tableMesh);

    // Table grid lines
    const grid = new THREE.GridHelper(0.35, 14, 0xd0c8bb, 0xe2dcce);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.0005;
    scene.add(grid);

    // Cloud points
    let cloudPointsMesh = null;
    if (cloud && cloud.length > 0) {
      const pGeo = new THREE.BufferGeometry();
      const posArr = new Float32Array(cloud.length * 3);
      for (let i = 0; i < cloud.length; i++) {
        posArr[i * 3 + 0] = cloud[i].x;
        posArr[i * 3 + 1] = cloud[i].y;
        posArr[i * 3 + 2] = cloud[i].z;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0x222629,
        size: 0.0028,
        sizeAttenuation: true
      });
      cloudPointsMesh = new THREE.Points(pGeo, pMat);
      scene.add(cloudPointsMesh);
    }

    // Container for grasp glyphs
    const glyphGroup = new THREE.Group();
    scene.add(glyphGroup);

    // Dynamic selection visual group (approach line + contacts)
    const highlightGroup = new THREE.Group();
    scene.add(highlightGroup);

    // Build grasp glyph meshes
    // Gripper glyph geometry: two parallel fingers 'width' apart, length ~2cm (0.02m), crossbar joined at base
    // Local coords:
    // approach is along -Z (pointing forward) or +X? Let's adopt local convention:
    // approach vector pointing INTO object is along local +X or +Z.
    // Let approach = local +Z. Fingers extend from z = -0.015 to z = 0.005 (length 0.02m).
    // Fingers separated along local Y at -width/2 and +width/2.
    // Base crossbar connects (-width/2, z=-0.015) to (+width/2, z=-0.015).
    // Center of gripper grasp center at (0, 0, 0).
    const glyphMap = new Map();
    const raycastMeshes = [];

    grasps.forEach((g) => {
      const gGroup = new THREE.Group();
      gGroup.position.set(g.x, g.y, g.z);

      // Orientation: approach axis a = (ax, ay, az).
      // Normalize approach axis
      const approach = new THREE.Vector3(g.ax, g.ay, g.az).normalize();

      // Find an orthogonal vector for finger separation.
      // Default reference up = (0, 0, 1). If approach is parallel to up, use (1, 0, 0)
      let refUp = new THREE.Vector3(0, 0, 1);
      if (Math.abs(approach.dot(refUp)) > 0.95) {
        refUp = new THREE.Vector3(1, 0, 0);
      }
      const side = new THREE.Vector3().crossVectors(approach, refUp).normalize();
      const up = new THREE.Vector3().crossVectors(side, approach).normalize();

      // Rotation matrix whose local Z is approach, local X is side, local Y is up
      const rotMatrix = new THREE.Matrix4().makeBasis(side, up, approach);
      gGroup.setRotationFromMatrix(rotMatrix);

      const fingerLen = 0.018; // ~2cm
      const halfW = g.width / 2;

      // Gripper geometry: U-shape line segment
      // Left finger tip (x=-halfW, y=0, z=fingerLen/2) -> left base (x=-halfW, y=0, z=-fingerLen/2)
      // Base bar -> right base (x=+halfW, y=0, z=-fingerLen/2)
      // Right finger tip (x=+halfW, y=0, z=fingerLen/2)
      const pts = [
        new THREE.Vector3(-halfW, 0, fingerLen * 0.5),
        new THREE.Vector3(-halfW, 0, -fingerLen * 0.5),
        new THREE.Vector3(halfW, 0, -fingerLen * 0.5),
        new THREE.Vector3(halfW, 0, fingerLen * 0.5)
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);

      const baseColorHex = OUTCOME_COLORS[g.outcome] || "#888888";
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(baseColorHex),
        linewidth: 2
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      gGroup.add(lineMesh);

      // Transparent hit sphere to make clicking easy and robust
      const hitGeo = new THREE.SphereGeometry(Math.max(g.width * 0.65, 0.018), 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { graspId: g.grasp };
      gGroup.add(hitMesh);
      raycastMeshes.push(hitMesh);

      glyphGroup.add(gGroup);

      glyphMap.set(g.grasp, {
        group: gGroup,
        lineMesh,
        lineMat,
        grasp: g,
        side,
        up,
        approach,
        halfW
      });
    });

    threeStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      glyphGroup,
      highlightGroup,
      glyphMap,
      raycastMeshes
    };

    // Raycasting for click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const handlePointerDown = (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      // Ignore drags
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 5) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Only check visible raycast meshes
      const activeHitMeshes = raycastMeshes.filter((m) => {
        const entry = glyphMap.get(m.userData.graspId);
        return entry && entry.group.visible;
      });

      const intersects = raycaster.intersectObjects(activeHitMeshes, false);
      if (intersects.length > 0) {
        const hitId = intersects[0].object.userData.graspId;
        setSelectedId(hitId);
      } else {
        setSelectedId(null);
      }

      // Ensure key listener shell has focus
      if (shellRef.current) {
        shellRef.current.focus();
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("pointerdown", handlePointerDown);
    domEl.addEventListener("pointerup", handlePointerUp);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 540;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    // Animation loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      domEl.removeEventListener("pointerdown", handlePointerDown);
      domEl.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      renderer.dispose();
      if (domEl.parentNode) {
        domEl.parentNode.removeChild(domEl);
      }
      threeStateRef.current = null;
    };
  }, [cloud, grasps]);

  // Imperatively update glyph visibility, coloring, enlargement and highlight decorations
  React.useEffect(() => {
    if (!threeStateRef.current) return;
    const { glyphMap, highlightGroup } = threeStateRef.current;

    // Clear previous highlight marks
    while (highlightGroup.children.length > 0) {
      const obj = highlightGroup.children[0];
      highlightGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    }

    glyphMap.forEach((entry, id) => {
      const g = entry.grasp;
      const visible = g.score >= minScore && outcomeFilter[g.outcome] !== false;
      entry.group.visible = visible;

      if (!visible) {
        entry.group.scale.set(1, 1, 1);
        return;
      }

      const isSelected = id === selectedId;

      // Color calculation
      let colorHex;
      if (colorMode === "score") {
        // Map score 0.3..1.0 to 0..1
        const t = (g.score - 0.3) / (1.0 - 0.3);
        const col = viridisColor(t);
        colorHex = col.getHex();
      } else {
        colorHex = OUTCOME_COLORS[g.outcome] || "#888888";
      }

      entry.lineMat.color.set(colorHex);

      // Enlargement when selected
      if (isSelected) {
        entry.group.scale.set(1.5, 1.5, 1.5);

        // 1. Dashed approach line 10 cm (0.10m) long along approach axis ending at the grasp center
        // Approach axis vector points into the object at (g.x, g.y, g.z).
        // Start = center - approach * 0.10m; End = center
        const approachLen = 0.1;
        const startPt = new THREE.Vector3(
          g.x - entry.approach.x * approachLen,
          g.y - entry.approach.y * approachLen,
          g.z - entry.approach.z * approachLen
        );
        const endPt = new THREE.Vector3(g.x, g.y, g.z);

        const approachGeo = new THREE.BufferGeometry().setFromPoints([startPt, endPt]);
        const approachMat = new THREE.LineDashedMaterial({
          color: 0x111111,
          dashSize: 0.006,
          gapSize: 0.004,
          linewidth: 2
        });
        const approachLine = new THREE.Line(approachGeo, approachMat);
        approachLine.computeLineDistances();
        highlightGroup.add(approachLine);

        // 2. Contact points marked: two spheres at the grasp finger tips/contacts
        // In world coords: center + side * halfW, and center - side * halfW
        // Slightly at the grasp center plane
        const contactRadius = 0.0028;
        const sphereGeo = new THREE.SphereGeometry(contactRadius, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xd32f2f });

        const c1 = new THREE.Mesh(sphereGeo, sphereMat);
        c1.position.set(
          g.x + entry.side.x * entry.halfW,
          g.y + entry.side.y * entry.halfW,
          g.z + entry.side.z * entry.halfW
        );
        highlightGroup.add(c1);

        const c2 = new THREE.Mesh(sphereGeo, sphereMat);
        c2.position.set(
          g.x - entry.side.x * entry.halfW,
          g.y - entry.side.y * entry.halfW,
          g.z - entry.side.z * entry.halfW
        );
        highlightGroup.add(c2);

        // Contact label rings / halo
        const ringGeo = new THREE.RingGeometry(0.0035, 0.005, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xd32f2f, side: THREE.DoubleSide });
        const ring1 = new THREE.Mesh(ringGeo, ringMat);
        ring1.position.copy(c1.position);
        ring1.lookAt(c1.position.clone().add(entry.approach));
        highlightGroup.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo, ringMat);
        ring2.position.copy(c2.position);
        ring2.lookAt(c2.position.clone().add(entry.approach));
        highlightGroup.add(ring2);
      } else {
        entry.group.scale.set(1, 1, 1);
      }
    });
  }, [selectedId, minScore, outcomeFilter, colorMode]);

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#fbf9f4",
        borderRadius: "12px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        overflow: "hidden",
        border: "1px solid #eae5db",
        display: "flex",
        flexDirection: "row",
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        boxSizing: "border-box"
      }}
    >
      {/* 3D Canvas Area */}
      <div
        style={{
          flex: "1 1 60%",
          position: "relative",
          height: "560px",
          background: "#fbf9f4",
          cursor: "grab"
        }}
      >
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* Narrative overlay badge */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 16,
            pointerEvents: "none",
            background: "rgba(253, 251, 247, 0.88)",
            backdropFilter: "blur(4px)",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(220, 214, 203, 0.8)"
          }}
        >
          <div style={{ fontFamily: "Georgia, serif", fontSize: "15px", fontWeight: "700", color: "#1a1a1a" }}>
            3D Grasp Triage
          </div>
          <div style={{ fontFamily: "'Fira Code', monospace", fontSize: "10.5px", color: "#666" }}>
            1,200 pts cloud • 160 candidate grasps • z-up table
          </div>
        </div>

        {/* Quick hint at bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 16,
            pointerEvents: "none",
            fontFamily: "'Fira Code', monospace",
            fontSize: "10px",
            color: "#888",
            background: "rgba(253, 251, 247, 0.75)",
            padding: "3px 8px",
            borderRadius: "4px"
          }}
        >
          Orbit: drag • Zoom: wheel • Step: ↑/↓ keys • Deselect: click canvas
        </div>
      </div>

      {/* Side Control Panel */}
      <div
        style={{
          flex: "0 0 320px",
          width: "320px",
          height: "560px",
          background: "#f7f3ec",
          borderLeft: "1px solid #e7e1d5",
          padding: "20px 18px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflowY: "auto"
        }}
      >
        <div>
          {/* Header */}
          <div style={{ marginBottom: "16px" }}>
            <span
              style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#887f73",
                fontWeight: "600"
              }}
            >
              CANDIDATE EXPLORER
            </span>
            <h3
              style={{
                margin: "4px 0 0 0",
                fontFamily: "Georgia, serif",
                fontSize: "19px",
                fontWeight: "700",
                color: "#1d1d1d"
              }}
            >
              Filter & Inspection
            </h3>
          </div>

          {/* Slider */}
          <ScoreSlider
            value={minScore}
            onChange={(val) => setMinScore(val)}
            min={0.3}
            max={0.97}
            step={0.01}
            count={visibleGrasps.length}
            total={grasps.length || 160}
          />

          {/* Outcome Chips */}
          <OutcomeChips
            counts={outcomeCounts}
            activeMap={outcomeFilter}
            onToggle={(k) =>
              setOutcomeFilter((prev) => ({
                ...prev,
                [k]: !prev[k]
              }))
            }
          />

          {/* Color Switch */}
          <ColorBySwitch mode={colorMode} onChange={(m) => setColorMode(m)} />
        </div>

        {/* Selected grasp inspector details */}
        <div>
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "13px",
              fontWeight: "600",
              color: "#222",
              marginBottom: "6px"
            }}
          >
            Active Candidate
          </div>
          <GraspInspector grasp={selectedGrasp} />
        </div>
      </div>
    </div>
  );
}