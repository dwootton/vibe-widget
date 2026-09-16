import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "https://esm.sh/three@0.160.0/examples/jsm/lines/Line2.js";
import { LineMaterial } from "https://esm.sh/three@0.160.0/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "https://esm.sh/three@0.160.0/examples/jsm/lines/LineGeometry.js";

const OUTCOME_COLORS = {
  success: "#2f9e6a",
  slip: "#e2943b",
  collision: "#d0504a",
  unreachable: "#8d8a84",
};
const OUTCOME_ORDER = ["success", "slip", "collision", "unreachable"];

const VIRIDIS = [
  [0.267, 0.005, 0.329],
  [0.283, 0.141, 0.458],
  [0.254, 0.265, 0.53],
  [0.207, 0.372, 0.553],
  [0.164, 0.471, 0.558],
  [0.128, 0.567, 0.551],
  [0.135, 0.659, 0.518],
  [0.267, 0.749, 0.441],
  [0.478, 0.821, 0.318],
  [0.741, 0.873, 0.15],
  [0.993, 0.906, 0.144],
];

function viridis(t) {
  const u = Math.max(0, Math.min(1, t));
  const s = u * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(s));
  const f = s - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function viridisCss(t) {
  const c = viridis(t);
  return `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
}

function toRows(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (!keys.length) return [];
    const first = v[keys[0]];
    if (Array.isArray(first)) {
      const n = first.length;
      const out = [];
      for (let i = 0; i < n; i++) {
        const o = {};
        for (const k of keys) o[k] = v[k][i];
        out.push(o);
      }
      return out;
    }
  }
  return [];
}

export const ScoreSlider = ({ React, value, onChange, count, total }) => {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontFamily: "'Fira Code', ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: "#5d574c",
          marginBottom: 8,
        }}
      >
        predicted score ≥{" "}
        <span style={{ color: "#1c1a17", fontWeight: 700 }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onInput={(e) => onChange(parseFloat(e.target.value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#1c1a17", cursor: "ew-resize" }}
      />
      <div
        style={{
          fontFamily: "'Fira Code', ui-monospace, monospace",
          fontSize: 12,
          color: "#1c1a17",
          marginTop: 6,
        }}
      >
        showing {count} of {total}
      </div>
    </div>
  );
};

export const OutcomeChips = ({ React, counts, active, onToggle }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
    {OUTCOME_ORDER.map((o) => {
      const on = active[o] !== false;
      return (
        <button
          key={o}
          onClick={() => onToggle(o)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 999,
            border: `1px solid ${on ? OUTCOME_COLORS[o] : "#cfc9bd"}`,
            background: on ? OUTCOME_COLORS[o] + "22" : "transparent",
            color: on ? "#1c1a17" : "#7d776c",
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 11,
            cursor: "pointer",
            transition: "all 260ms ease",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: OUTCOME_COLORS[o],
              opacity: on ? 1 : 0.35,
            }}
          />
          {o}
          <span style={{ opacity: 0.75 }}>{counts[o] || 0}</span>
        </button>
      );
    })}
  </div>
);

export const ColourBySwitch = ({ React, mode, onChange }) => (
  <div style={{ marginBottom: 18 }}>
    <div
      style={{
        fontFamily: "'Fira Code', ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: "#5d574c",
        marginBottom: 8,
      }}
    >
      colour by
    </div>
    <div
      style={{
        display: "inline-flex",
        border: "1px solid #cfc9bd",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      {["outcome", "score"].map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "6px 14px",
            border: "none",
            background: mode === m ? "#1c1a17" : "transparent",
            color: mode === m ? "#fdfbf7" : "#3c382f",
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 11,
            cursor: "pointer",
            transition: "background 260ms ease",
          }}
        >
          {m}
        </button>
      ))}
    </div>
    {mode === "score" && (
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${viridisCss(0)}, ${viridisCss(0.25)}, ${viridisCss(
              0.5
            )}, ${viridisCss(0.75)}, ${viridisCss(1)})`,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 10,
            color: "#5d574c",
            marginTop: 3,
          }}
        >
          <span>0.30</span>
          <span>0.99</span>
        </div>
      </div>
    )}
  </div>
);

export const GraspReadout = ({ React, grasp }) => {
  const mono = { fontFamily: "'Fira Code', ui-monospace, monospace", fontSize: 12 };
  if (!grasp) {
    return (
      <div
        style={{
          ...mono,
          color: "#5d574c",
          borderTop: "1px solid #e2dcd0",
          paddingTop: 12,
          lineHeight: 1.6,
        }}
      >
        no grasp selected — click a gripper glyph, or focus the scene and use ↑ / ↓ to step through
        candidates in score order.
      </div>
    );
  }
  const rows = [
    ["id", grasp.grasp],
    ["region", grasp.region],
    ["score", grasp.score.toFixed(3)],
    ["width", (grasp.width * 100).toFixed(1) + " cm"],
    ["outcome", grasp.outcome],
  ];
  return (
    <div style={{ borderTop: "1px solid #e2dcd0", paddingTop: 12 }}>
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 20,
          color: "#1c1a17",
          marginBottom: 8,
        }}
      >
        grasp #{grasp.grasp}
      </div>
      <table style={{ ...mono, borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td
                style={{
                  color: "#5d574c",
                  padding: "3px 8px 3px 0",
                  textTransform: "uppercase",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                }}
              >
                {k}
              </td>
              <td
                style={{
                  color: k === "outcome" ? OUTCOME_COLORS[v] || "#1c1a17" : "#1c1a17",
                  fontWeight: 700,
                  padding: "3px 0",
                }}
              >
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function Widget({ model, React }) {
  const cloud = React.useMemo(() => toRows(model.get("cloud")), []);
  const grasps = React.useMemo(() => toRows(model.get("data")), []);

  const [minScore, setMinScore] = React.useState(0.5);
  const [active, setActive] = React.useState({
    success: true,
    slip: true,
    collision: true,
    unreachable: true,
  });
  const [colourBy, setColourBy] = React.useState("outcome");
  const [selected, setSelected] = React.useState(null);

  const hostRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const stateRef = React.useRef({ minScore: 0.5, active: {}, colourBy: "outcome", selected: null });

  const counts = React.useMemo(() => {
    const c = {};
    for (const g of grasps) c[g.outcome] = (c[g.outcome] || 0) + 1;
    return c;
  }, [grasps]);

  const scoreExtent = React.useMemo(() => {
    let lo = Infinity,
      hi = -Infinity;
    for (const g of grasps) {
      if (g.score < lo) lo = g.score;
      if (g.score > hi) hi = g.score;
    }
    if (!isFinite(lo)) return [0, 1];
    return [lo, hi === lo ? lo + 1 : hi];
  }, [grasps]);

  const visible = React.useMemo(
    () => grasps.filter((g) => g.score >= minScore - 1e-9 && active[g.outcome] !== false),
    [grasps, minScore, active]
  );

  const visibleSorted = React.useMemo(
    () => visible.slice().sort((a, b) => b.score - a.score),
    [visible]
  );

  const selectedGrasp = React.useMemo(
    () => grasps.find((g) => g.grasp === selected) || null,
    [grasps, selected]
  );

  // ---- outputs ----
  React.useEffect(() => {
    model.set("selected", null);
    model.set("min_score", 0.5);
    model.save_changes();
  }, []);

  React.useEffect(() => {
    model.set("selected", selected);
    model.save_changes();
  }, [selected]);

  React.useEffect(() => {
    model.set("min_score", minScore);
    model.save_changes();
  }, [minScore]);

  // ---- three.js scene (built only from data + layout) ----
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(320, host.clientWidth || 720);
    const height = 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = height + "px";
    renderer.domElement.style.outline = "none";
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#fdfbf7");

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 20);
    camera.up.set(0, 0, 1);
    // 35 cm away, looking slightly down at the object
    const target = new THREE.Vector3(0, 0, 0.05);
    const dist = 0.35;
    const elev = THREE.MathUtils.degToRad(22);
    const azi = THREE.MathUtils.degToRad(-58);
    camera.position.set(
      target.x + dist * Math.cos(elev) * Math.cos(azi),
      target.y + dist * Math.cos(elev) * Math.sin(azi),
      target.z + dist * Math.sin(elev)
    );
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.12;
    controls.maxDistance = 1.2;
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(0.2, -0.3, 0.5);
    scene.add(dir);

    // ---- table plane at z = 0 ----
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshStandardMaterial({
        color: 0xf3eee3,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
      })
    );
    table.position.z = -0.0005;
    scene.add(table);

    const grid = new THREE.GridHelper(0.6, 24, 0xd9d2c4, 0xe7e1d5);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.0002;
    scene.add(grid);

    // ---- object point cloud ----
    const pcGeom = new THREE.BufferGeometry();
    const pos = new Float32Array(cloud.length * 3);
    cloud.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
    });
    pcGeom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pcMat = new THREE.PointsMaterial({
      color: 0x241f1a,
      size: 0.0016,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pcGeom, pcMat);
    scene.add(points);

    // ---- faint translucent cylinder (r=4cm, h=10cm) ----
    const cylGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 64, 1, true);
    const cylMat = new THREE.MeshStandardMaterial({
      color: 0xb9a9c9,
      transparent: true,
      opacity: 0.18,
      roughness: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cyl = new THREE.Mesh(cylGeom, cylMat);
    cyl.rotation.x = Math.PI / 2;
    cyl.position.set(0, 0, 0.05);
    scene.add(cyl);

    const capMat = new THREE.MeshStandardMaterial({
      color: 0xb9a9c9,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.04, 64), capMat);
    cap.position.set(0, 0, 0.1);
    scene.add(cap);

    // ---- grasp glyphs ----
    const res = new THREE.Vector2(width, height);
    const glyphGroup = new THREE.Group();
    scene.add(glyphGroup);

    const FINGER = 0.025;
    const glyphs = [];

    const norm = (vx, vy, vz) => {
      const L = Math.hypot(vx, vy, vz) || 1;
      return [vx / L, vy / L, vz / L];
    };

    grasps.forEach((g) => {
      const a = norm(g.ax, g.ay, g.az);
      let c = norm(g.cx, g.cy, g.cz);
      const half = g.width / 2;

      // fingertips
      const t1 = [g.x + c[0] * half, g.y + c[1] * half, g.z + c[2] * half];
      const t2 = [g.x - c[0] * half, g.y - c[1] * half, g.z - c[2] * half];
      // finger roots: back along -approach by FINGER
      const r1 = [t1[0] - a[0] * FINGER, t1[1] - a[1] * FINGER, t1[2] - a[2] * FINGER];
      const r2 = [t2[0] - a[0] * FINGER, t2[1] - a[1] * FINGER, t2[2] - a[2] * FINGER];
      const palmMid = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2, (r1[2] + r2[2]) / 2];

      const pts = [
        t1[0], t1[1], t1[2],
        r1[0], r1[1], r1[2],
        r2[0], r2[1], r2[2],
        t2[0], t2[1], t2[2],
      ];

      const geom = new LineGeometry();
      geom.setPositions(pts);
      const mat = new LineMaterial({
        color: new THREE.Color(OUTCOME_COLORS[g.outcome] || "#555"),
        linewidth: 2,
        transparent: true,
        opacity: 0.95,
        dashed: false,
        resolution: res,
      });
      const line = new Line2(geom, mat);
      line.computeLineDistances();
      line.userData.graspId = g.grasp;
      glyphGroup.add(line);

      // invisible fat pick proxy (tube-ish) for reliable raycasting
      const pickGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(t1[0], t1[1], t1[2]),
        new THREE.Vector3(r1[0], r1[1], r1[2]),
        new THREE.Vector3(r2[0], r2[1], r2[2]),
        new THREE.Vector3(t2[0], t2[1], t2[2]),
      ]);
      const pick = new THREE.Line(
        pickGeom,
        new THREE.LineBasicMaterial({ visible: false })
      );
      pick.userData.graspId = g.grasp;
      glyphGroup.add(pick);

      glyphs.push({
        g,
        line,
        mat,
        pick,
        a,
        c,
        t1,
        t2,
        palmMid,
      });
    });

    // ---- selection decorations ----
    const selGroup = new THREE.Group();
    scene.add(selGroup);

    const approachMat = new LineMaterial({
      color: new THREE.Color("#1c1a17"),
      linewidth: 2,
      dashed: true,
      dashSize: 0.006,
      gapSize: 0.004,
      transparent: true,
      opacity: 0.9,
      resolution: res,
    });
    const approachGeom = new LineGeometry();
    approachGeom.setPositions([0, 0, 0, 0, 0, 0.001]);
    const approachLine = new Line2(approachGeom, approachMat);
    approachLine.visible = false;
    selGroup.add(approachLine);

    const contactMat = new THREE.MeshBasicMaterial({ color: 0x1c1a17 });
    const contactGeom = new THREE.SphereGeometry(0.0035, 16, 12);
    const contactA = new THREE.Mesh(contactGeom, contactMat);
    const contactB = new THREE.Mesh(contactGeom, contactMat);
    const ringGeom = new THREE.RingGeometry(0.0045, 0.0065, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfdfbf7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ringA = new THREE.Mesh(ringGeom, ringMat);
    const ringB = new THREE.Mesh(ringGeom, ringMat);
    [contactA, contactB, ringA, ringB].forEach((m) => {
      m.visible = false;
      selGroup.add(m);
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.008 };
    raycaster.params.Points = { threshold: 0.004 };

    const applyStyles = () => {
      const st = stateRef.current;
      const [lo, hi] = st.scoreExtent || [0, 1]; // extent is computed after the first style pass
      for (const gl of glyphs) {
        const g = gl.g;
        const vis = g.score >= st.minScore - 1e-9 && st.active[g.outcome] !== false;
        gl.line.visible = vis;
        gl.pick.visible = false;
        gl.pick.userData.visibleForPick = vis;
        const isSel = st.selected === g.grasp;
        if (st.colourBy === "score") {
          const t = (g.score - lo) / (hi - lo);
          const c = viridis(t);
          gl.mat.color.setRGB(c[0], c[1], c[2]);
        } else {
          gl.mat.color.set(OUTCOME_COLORS[g.outcome] || "#555");
        }
        gl.mat.linewidth = isSel ? 6 : 2;
        gl.mat.opacity = st.selected == null ? 0.95 : isSel ? 1 : 0.45;
        gl.mat.needsUpdate = true;
      }

      const sel = glyphs.find((gl) => gl.g.grasp === st.selected && gl.line.visible);
      if (sel) {
        const { a, palmMid, t1, t2 } = sel;
        const L = 0.08;
        const start = [
          palmMid[0] - a[0] * L,
          palmMid[1] - a[1] * L,
          palmMid[2] - a[2] * L,
        ];
        approachGeom.setPositions([
          start[0], start[1], start[2],
          palmMid[0], palmMid[1], palmMid[2],
        ]);
        approachLine.geometry = approachGeom;
        approachLine.computeLineDistances();
        approachLine.visible = true;
        contactA.position.set(t1[0], t1[1], t1[2]);
        contactB.position.set(t2[0], t2[1], t2[2]);
        ringA.position.copy(contactA.position);
        ringB.position.copy(contactB.position);
        ringA.lookAt(camera.position);
        ringB.lookAt(camera.position);
        [contactA, contactB, ringA, ringB].forEach((m) => (m.visible = true));
      } else {
        approachLine.visible = false;
        [contactA, contactB, ringA, ringB].forEach((m) => (m.visible = false));
      }
    };

    const pickAt = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const candidates = glyphs.filter((gl) => gl.line.visible).map((gl) => gl.pick);
      candidates.forEach((p) => (p.visible = true));
      const hits = raycaster.intersectObjects(candidates, false);
      candidates.forEach((p) => (p.visible = false));
      if (hits.length) return hits[0].object.userData.graspId;
      return null;
    };

    let downPt = null;
    const onPointerDown = (e) => {
      downPt = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e) => {
      renderer.domElement.focus();
      if (!downPt) return;
      const moved = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
      downPt = null;
      if (moved > 5) return;
      const id = pickAt(e.clientX, e.clientY);
      const cb = sceneRef.current && sceneRef.current.onSelect;
      if (cb) cb(id);
    };

    const onKeyDown = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const cb = sceneRef.current && sceneRef.current.onStep;
      if (cb) cb(e.key === "ArrowUp" ? -1 : 1);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update();
      if (ringA.visible) {
        ringA.lookAt(camera.position);
        ringB.lookAt(camera.position);
      }
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = Math.max(320, host.clientWidth || width);
      renderer.setSize(w, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = height + "px";
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      res.set(w, height);
      glyphs.forEach((gl) => gl.mat.resolution.set(w, height));
      approachMat.resolution.set(w, height);
    });
    ro.observe(host);

    sceneRef.current = { applyStyles, onSelect: null, onStep: null, dom: renderer.domElement };
    applyStyles();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("keydown", onKeyDown);
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      approachGeom.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [cloud, grasps]);

  // keep imperative state mirror + restyle (never rebuilds the scene)
  React.useEffect(() => {
    stateRef.current = { minScore, active, colourBy, selected, scoreExtent };
    if (sceneRef.current) sceneRef.current.applyStyles();
  }, [minScore, active, colourBy, selected, scoreExtent]);

  // wire callbacks that need fresh React state
  React.useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.onSelect = (id) => setSelected(id == null ? null : id);
    s.onStep = (delta) => {
      const list = visibleSorted;
      if (!list.length) return;
      const idx = list.findIndex((g) => g.grasp === selected);
      let next;
      if (idx === -1) next = delta > 0 ? 0 : list.length - 1;
      else next = Math.min(list.length - 1, Math.max(0, idx + delta));
      setSelected(list[next].grasp);
    };
    return () => {
      if (sceneRef.current) {
        sceneRef.current.onSelect = null;
        sceneRef.current.onStep = null;
      }
    };
  }, [visibleSorted, selected]);

  // drop selection if it becomes hidden
  React.useEffect(() => {
    if (selected == null) return;
    if (!visible.some((g) => g.grasp === selected)) setSelected(null);
  }, [visible, selected]);

  const toggle = React.useCallback((o) => {
    setActive((prev) => ({ ...prev, [o]: prev[o] === false }));
  }, []);

  const stepFromPanel = (delta) => {
    const list = visibleSorted;
    if (!list.length) return;
    const idx = list.findIndex((g) => g.grasp === selected);
    let next;
    if (idx === -1) next = delta > 0 ? 0 : list.length - 1;
    else next = Math.min(list.length - 1, Math.max(0, idx + delta));
    setSelected(list[next].grasp);
    if (sceneRef.current) sceneRef.current.dom.focus();
  };

  return (
    <section
      style={{
        background: "#fdfbf7",
        color: "#1c1a17",
        padding: "28px 26px 32px",
        fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, monospace",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8a8272",
            marginBottom: 6,
          }}
        >
          chapter iv · manipulation
        </div>
        <h2
          style={{
            fontFamily: "'Playfair Display', 'Tiempos Headline', Georgia, serif",
            fontSize: 38,
            lineHeight: 1.05,
            margin: "0 0 10px",
            fontWeight: 700,
            letterSpacing: "-0.015em",
          }}
        >
          One hundred and forty ways to pick up a mug.
        </h2>
        <p
          style={{
            maxWidth: 640,
            fontSize: 13.5,
            lineHeight: 1.7,
            color: "#3c382f",
            margin: "0 0 22px",
          }}
        >
          Each little clip below is a parallel-jaw grasp: two fingertips straddling the point the
          planner chose, a palm bar behind them, and an approach that dives in from outside. Drag to
          orbit. Scrub the score threshold to see which candidates survive confidence.
        </p>

        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 480px",
              minWidth: 320,
              border: "1px solid #e7e1d5",
              borderRadius: 4,
              overflow: "hidden",
              background: "#fdfbf7",
            }}
          >
            <div ref={hostRef} style={{ width: "100%", height: 560 }} />
          </div>

          <aside
            style={{
              flex: "0 1 278px",
              minWidth: 250,
              maxWidth: 320,
            }}
          >
            <ScoreSlider
              React={React}
              value={minScore}
              onChange={setMinScore}
              count={visible.length}
              total={grasps.length}
            />
            <OutcomeChips React={React} counts={counts} active={active} onToggle={toggle} />
            <ColourBySwitch React={React} mode={colourBy} onChange={setColourBy} />

            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              <button
                onClick={() => stepFromPanel(-1)}
                style={stepBtn}
                title="previous (higher score)"
              >
                ↑ higher
              </button>
              <button onClick={() => stepFromPanel(1)} style={stepBtn} title="next (lower score)">
                ↓ lower
              </button>
              <button
                onClick={() => setSelected(null)}
                style={{ ...stepBtn, borderColor: "#e0d9cb", color: "#5d574c" }}
              >
                clear
              </button>
            </div>

            <GraspReadout React={React} grasp={selectedGrasp} />
          </aside>
        </div>
      </div>
    </section>
  );
}

const stepBtn = {
  flex: 1,
  padding: "7px 8px",
  borderRadius: 3,
  border: "1px solid #cfc9bd",
  background: "transparent",
  color: "#1c1a17",
  fontFamily: "'Fira Code', ui-monospace, monospace",
  fontSize: 11,
  cursor: "pointer",
};