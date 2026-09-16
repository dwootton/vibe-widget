import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const PALETTE = [
  "#d9534f", "#2b7cb6", "#2a9d8f", "#e76f51",
  "#8a508f", "#f4a261", "#457b9d", "#b5179e",
  "#3a0ca3", "#38b000", "#e63946", "#4361ee",
];

const DT = 0.02;
const T_MAX = 25;

function integrate(theta0, omega0, c) {
  const n = Math.round(T_MAX / DT);
  const th = new Float64Array(n + 1);
  const om = new Float64Array(n + 1);
  th[0] = theta0;
  om[0] = omega0;
  const f = (t, o) => [o, -Math.sin(t) - c * o];
  let t = theta0;
  let o = omega0;
  for (let i = 1; i <= n; i++) {
    const k1 = f(t, o);
    const k2 = f(t + (DT / 2) * k1[0], o + (DT / 2) * k1[1]);
    const k3 = f(t + (DT / 2) * k2[0], o + (DT / 2) * k2[1]);
    const k4 = f(t + DT * k3[0], o + DT * k3[1]);
    t = t + (DT / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    o = o + (DT / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    th[i] = t;
    om[i] = o;
  }
  return { th, om, n };
}

function sampleTraj(traj, time) {
  if (!traj) return { theta: 0, omega: 0 };
  const clamped = Math.max(0, Math.min(T_MAX, time));
  const x = clamped / DT;
  const i0 = Math.min(traj.n, Math.floor(x));
  const i1 = Math.min(traj.n, i0 + 1);
  const frac = x - i0;
  return {
    theta: traj.th[i0] + (traj.th[i1] - traj.th[i0]) * frac,
    omega: traj.om[i0] + (traj.om[i1] - traj.om[i0]) * frac,
  };
}

function normalizePoints(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const t = Number(p.theta0);
      const o = Number(p.omega0);
      if (!Number.isFinite(t) || !Number.isFinite(o)) return null;
      return { theta0: t, omega0: o };
    })
    .filter(Boolean);
}

function findChanged(oldPts, newPts) {
  const n = newPts.length;
  const m = oldPts.length;
  const lim = Math.min(n, m);
  for (let i = 0; i < lim; i++) {
    const a = oldPts[i];
    const b = newPts[i];
    if (Math.abs(a.theta0 - b.theta0) > 1e-12 || Math.abs(a.omega0 - b.omega0) > 1e-12) {
      return i;
    }
  }
  if (n > m) return n - 1;
  return null;
}

export const SegmentedPicker = ({ React, count, value, onChange, disabled, colorFor }) => {
  const items = [];
  for (let i = 0; i < count; i++) items.push(i);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background: "#efe9dd",
        border: "1px solid #d8cfbe",
      }}
    >
      {items.length === 0 && (
        <span
          style={{
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 11,
            color: "#6b6254",
            padding: "5px 10px",
          }}
        >
          no dots
        </span>
      )}
      {items.map((i) => {
        const active = i === value;
        const col = colorFor ? colorFor(i) : PALETTE[i % PALETTE.length];
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange && onChange(i)}
            style={{
              minWidth: 30,
              padding: "5px 8px",
              border: active ? `1px solid ${col}` : "1px solid transparent",
              borderRadius: 7,
              background: active ? "#fdfbf7" : "transparent",
              color: active ? col : "#4a4437",
              fontFamily: "'Fira Code', ui-monospace, monospace",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.45 : 1,
              boxShadow: active ? "0 1px 4px rgba(60,50,30,0.16)" : "none",
              transition: "background 220ms ease, color 220ms ease",
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
};

export const TransportButton = ({ React, label, onClick, disabled, primary }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "7px 16px",
      borderRadius: 999,
      border: primary ? "1px solid #26221b" : "1px solid #cfc5b2",
      background: primary ? "#26221b" : "#fdfbf7",
      color: primary ? "#fdfbf7" : "#3a3529",
      fontFamily: "'Fira Code', ui-monospace, monospace",
      fontSize: 12,
      letterSpacing: "0.04em",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      transition: "background 240ms ease, color 240ms ease, opacity 240ms ease",
    }}
  >
    {label}
  </button>
);

export const Readout = ({ React, t, theta, omega, color }) => {
  const fmt = (v) => (v < 0 ? v.toFixed(2) : v.toFixed(2));
  return (
    <div
      style={{
        fontFamily: "'Fira Code', ui-monospace, monospace",
        fontSize: 13,
        color: "#2b2720",
        background: "#fdfbf7",
        border: "1px solid #e0d8c7",
        borderRadius: 8,
        padding: "6px 12px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: color || "#2b2720", fontWeight: 700 }}>t = {t.toFixed(1)} s</span>
      <span style={{ color: "#9a9182" }}> · </span>
      <span>θ {fmt(theta)}</span>
      <span style={{ color: "#9a9182" }}> · </span>
      <span>ω {fmt(omega)}</span>
    </div>
  );
};

export default function Widget({ model, React }) {
  const rawPoints = model.get("points");
  const rawDamping = model.get("damping");

  const [points, setPoints] = React.useState(() => normalizePoints(rawPoints));
  const [damping, setDamping] = React.useState(() =>
    Number.isFinite(Number(rawDamping)) ? Number(rawDamping) : 0.2
  );
  const [selected, setSelected] = React.useState(() => (normalizePoints(rawPoints).length ? 0 : -1));
  const [playing, setPlaying] = React.useState(true);
  const [readout, setReadout] = React.useState({ t: 0, theta: 0, omega: 0 });

  const mountRef = React.useRef(null);
  const timeRef = React.useRef(0);
  const playingRef = React.useRef(true);
  const trajRef = React.useRef(null);
  const colorRef = React.useRef(PALETTE[0]);
  const threeRef = React.useRef(null);

  playingRef.current = playing;

  // ---- input subscriptions -------------------------------------------------
  React.useEffect(() => {
    const onPoints = () => {
      const next = normalizePoints(model.get("points"));
      setPoints((prev) => {
        const changed = findChanged(prev, next);
        if (next.length === 0) {
          setSelected(-1);
        } else if (changed !== null) {
          setSelected(changed);
          timeRef.current = 0;
          setPlaying(true);
        } else {
          setSelected((s) => (s >= next.length || s < 0 ? next.length - 1 : s));
        }
        return next;
      });
    };
    const onDamping = () => {
      const v = Number(model.get("damping"));
      setDamping(Number.isFinite(v) ? v : 0);
    };
    model.on("change:points", onPoints);
    model.on("change:damping", onDamping);
    return () => {
      model.off("change:points", onPoints);
      model.off("change:damping", onDamping);
    };
  }, [model]);

  // ---- trajectory for selected dot ---------------------------------------
  const traj = React.useMemo(() => {
    if (selected < 0 || selected >= points.length) return null;
    const p = points[selected];
    return integrate(p.theta0, p.omega0, damping);
  }, [points, selected, damping]);

  const activeColor = selected >= 0 ? PALETTE[selected % PALETTE.length] : "#6b6254";

  React.useEffect(() => {
    trajRef.current = traj;
    colorRef.current = activeColor;
    if (!traj) {
      timeRef.current = 0;
      setReadout({ t: 0, theta: 0, omega: 0 });
    } else {
      const s = sampleTraj(traj, timeRef.current);
      setReadout({ t: timeRef.current, theta: s.theta, omega: s.omega });
    }
    const scene = threeRef.current;
    if (scene) scene.setColor(activeColor);
  }, [traj, activeColor]);

  // selection change (user click) -> restart from 0? spec: only on points change.
  // keep time as-is when user picks a dot, but ensure within bounds
  React.useEffect(() => {
    if (selected >= 0 && timeRef.current > T_MAX) timeRef.current = T_MAX;
  }, [selected]);

  // ---- three.js scene -----------------------------------------------------
  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 720;
    const height = 420;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = height + "px";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.borderRadius = "14px";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#fdfbf7");

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0.9, 1.5, 4.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, -0.35, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 14;
    controls.update();

    scene.add(new THREE.HemisphereLight("#ffffff", "#d8cfbe", 0.95));
    const dir = new THREE.DirectionalLight("#ffffff", 0.85);
    dir.position.set(2.4, 4.2, 3.2);
    scene.add(dir);
    const fill = new THREE.DirectionalLight("#ffe9c9", 0.3);
    fill.position.set(-3, 1.5, -2.5);
    scene.add(fill);

    // ground disk (faint)
    const groundGeo = new THREE.CircleGeometry(2.6, 96);
    const groundMat = new THREE.MeshBasicMaterial({
      color: "#e7dfcd",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.55;
    scene.add(ground);

    const ringGeo = new THREE.RingGeometry(2.58, 2.62, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#cdc2ac",
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.549;
    scene.add(ring);

    // pivot
    const pivotGeo = new THREE.SphereGeometry(0.075, 32, 24);
    const pivotMat = new THREE.MeshStandardMaterial({
      color: "#26221b",
      roughness: 0.5,
      metalness: 0.2,
    });
    const pivot = new THREE.Mesh(pivotGeo, pivotMat);
    scene.add(pivot);

    const bracketGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 16);
    const bracket = new THREE.Mesh(bracketGeo, pivotMat);
    bracket.position.set(0, 0.25, 0);
    scene.add(bracket);

    // pendulum group rotates about Z at origin
    const arm = new THREE.Group();
    scene.add(arm);

    const L = 1.25;
    const rodMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[0]),
      roughness: 0.45,
      metalness: 0.1,
    });
    const rodGeo = new THREE.CylinderGeometry(0.016, 0.016, L, 20);
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(0, -L / 2, 0);
    arm.add(rod);

    const bobMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[0]),
      roughness: 0.32,
      metalness: 0.18,
    });
    const bobGeo = new THREE.SphereGeometry(0.17, 40, 30);
    const bob = new THREE.Mesh(bobGeo, bobMat);
    bob.position.set(0, -L, 0);
    arm.add(bob);

    // trail of the bob
    const TRAIL = 200;
    const trailPos = new Float32Array(TRAIL * 3);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(PALETTE[0]),
      transparent: true,
      opacity: 0.35,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    let trailCount = 0;

    const resetTrail = () => {
      trailCount = 0;
      trailGeo.setDrawRange(0, 0);
    };

    const pushTrail = (x, y) => {
      if (trailCount < TRAIL) {
        trailPos[trailCount * 3] = x;
        trailPos[trailCount * 3 + 1] = y;
        trailPos[trailCount * 3 + 2] = 0;
        trailCount++;
      } else {
        trailPos.copyWithin(0, 3);
        trailPos[(TRAIL - 1) * 3] = x;
        trailPos[(TRAIL - 1) * 3 + 1] = y;
        trailPos[(TRAIL - 1) * 3 + 2] = 0;
      }
      trailGeo.setDrawRange(0, trailCount);
      trailGeo.attributes.position.needsUpdate = true;
    };

    threeRef.current = {
      setColor: (hex) => {
        rodMat.color.set(hex);
        bobMat.color.set(hex);
        trailMat.color.set(hex);
      },
      resetTrail,
    };

    let raf = 0;
    let last = performance.now();
    let lastReport = 0;
    let lastKey = "";

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dtReal = Math.min(0.08, (now - last) / 1000);
      last = now;

      const tr = trajRef.current;
      if (tr) {
        const key = tr.th[0] + "|" + tr.om[0];
        if (key !== lastKey) {
          lastKey = key;
          resetTrail();
        }
        if (playingRef.current && timeRef.current < T_MAX) {
          timeRef.current = Math.min(T_MAX, timeRef.current + dtReal);
          if (timeRef.current >= T_MAX) setPlaying(false);
        }
        const s = sampleTraj(tr, timeRef.current);
        // theta = 0 hangs down; grows counter-clockwise seen from front (+z looking -z)
        arm.rotation.z = s.theta;
        const bx = L * Math.sin(s.theta) * -1;
        const by = -L * Math.cos(s.theta);
        pushTrail(bx, by);
        if (now - lastReport > 60) {
          lastReport = now;
          setReadout({ t: timeRef.current, theta: s.theta, omega: s.omega });
        }
      } else {
        arm.rotation.z = 0;
        if (trailCount !== 0) resetTrail();
      }

      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      renderer.setSize(w, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = height + "px";
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      threeRef.current = null;
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const disabled = points.length === 0 || selected < 0;

  const handlePick = React.useCallback((i) => {
    setSelected(i);
    timeRef.current = 0;
    if (threeRef.current) threeRef.current.resetTrail();
    setPlaying(true);
  }, []);

  const handlePlayPause = React.useCallback(() => {
    setPlaying((p) => {
      if (!p && timeRef.current >= T_MAX) timeRef.current = 0;
      return !p;
    });
  }, []);

  const handleReplay = React.useCallback(() => {
    timeRef.current = 0;
    if (threeRef.current) threeRef.current.resetTrail();
    setPlaying(true);
  }, []);

  return (
    <section
      style={{
        background: "#fdfbf7",
        padding: "26px 28px 30px",
        color: "#26221b",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8a7f6b",
          }}
        >
          phase portrait · replay
        </p>
        <h2
          style={{
            margin: "0 0 4px",
            fontFamily: "'Playfair Display', 'Tiempos Headline', Georgia, serif",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            lineHeight: 1.1,
          }}
        >
          The pendulum, in three dimensions
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "#5c5445",
            maxWidth: 620,
          }}
        >
          Each numbered dot in the portrait is an initial condition. Here it is integrated again —
          RK4, dt&nbsp;0.02, twenty-five seconds of θ″ = −sin θ − {damping.toFixed(2)}&thinsp;θ′ —
          and played back in real time. Drag to orbit.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <SegmentedPicker
            React={React}
            count={points.length}
            value={selected}
            onChange={handlePick}
            disabled={points.length === 0}
            colorFor={(i) => PALETTE[i % PALETTE.length]}
          />
          <TransportButton
            React={React}
            label={playing ? "❙❙  pause" : "▶  play"}
            onClick={handlePlayPause}
            disabled={disabled}
            primary
          />
          <TransportButton
            React={React}
            label="↺  replay"
            onClick={handleReplay}
            disabled={disabled}
          />
          <div style={{ flex: "1 1 auto" }} />
          <Readout
            React={React}
            t={readout.t}
            theta={readout.theta}
            omega={readout.omega}
            color={activeColor}
          />
        </div>

        <div
          ref={mountRef}
          style={{
            width: "100%",
            height: 420,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid #e6dece",
            boxShadow: "0 10px 30px rgba(60,50,30,0.07)",
            background: "#fdfbf7",
          }}
        />

        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontFamily: "'Fira Code', ui-monospace, monospace",
            fontSize: 11,
            color: "#8a7f6b",
          }}
        >
          <span>
            {points.length === 0
              ? "no points — bob at rest"
              : `dot ${selected + 1} of ${points.length} · θ₀ ${points[selected] ? points[selected].theta0.toFixed(2) : "—"} · ω₀ ${
                  points[selected] ? points[selected].omega0.toFixed(2) : "—"
                }`}
          </span>
          <span>{readout.t >= T_MAX ? "end of run · 25.0 s" : "real-time playback"}</span>
        </div>
      </div>
    </section>
  );
}