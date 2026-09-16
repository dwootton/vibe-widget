import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const PALETTE = [
  "#d9534f", "#2b7cb6", "#2a9d8f", "#e76f51", "#8a508f", "#f4a261",
  "#457b9d", "#b5179e", "#3a0ca3", "#38b000", "#e63946", "#4361ee"
];

const DT = 0.02;
const T_MAX = 25;

function deriv(theta, omega, c) {
  return [omega, -Math.sin(theta) - c * omega];
}

function integrate(theta0, omega0, c) {
  const n = Math.round(T_MAX / DT);
  const th = new Float64Array(n + 1);
  const om = new Float64Array(n + 1);
  let theta = theta0;
  let omega = omega0;
  th[0] = theta;
  om[0] = omega;
  for (let i = 1; i <= n; i++) {
    const k1 = deriv(theta, omega, c);
    const k2 = deriv(theta + (DT / 2) * k1[0], omega + (DT / 2) * k1[1], c);
    const k3 = deriv(theta + (DT / 2) * k2[0], omega + (DT / 2) * k2[1], c);
    const k4 = deriv(theta + DT * k3[0], omega + DT * k3[1], c);
    theta += (DT / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    omega += (DT / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    th[i] = theta;
    om[i] = omega;
  }
  return { th, om, n };
}

function sampleTrack(track, t) {
  if (!track) return [0, 0];
  const x = Math.max(0, Math.min(T_MAX, t)) / DT;
  const i0 = Math.min(track.n, Math.floor(x));
  const i1 = Math.min(track.n, i0 + 1);
  const f = x - i0;
  return [
    track.th[i0] + (track.th[i1] - track.th[i0]) * f,
    track.om[i0] + (track.om[i1] - track.om[i0]) * f
  ];
}

const MONO = "ui-monospace, SF Mono, Menlo, monospace";
const UI = "system-ui, -apple-system, Inter, Helvetica, sans-serif";

export const DotPicker = ({ React, count, selected, onSelect, disabled }) => {
  const items = [];
  for (let i = 0; i < count; i++) items.push(i);
  return (
    <div style={{ display: "flex", border: count ? "1px solid #d9d9d9" : "none" }}>
      {items.map((i) => {
        const active = i === selected;
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(i)}
            style={{
              font: `400 12px ${MONO}`,
              fontVariantNumeric: "tabular-nums",
              padding: "3px 8px",
              minWidth: 26,
              border: "none",
              borderLeft: i === 0 ? "none" : "1px solid #d9d9d9",
              background: active ? "#111111" : "transparent",
              color: disabled ? "#777777" : active ? "#ffffff" : "#111111",
              cursor: disabled ? "default" : "pointer",
              lineHeight: "16px"
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
};

export const FlatButton = ({ React, label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      font: `400 12px ${UI}`,
      padding: "3px 10px",
      border: "1px solid #d9d9d9",
      background: "transparent",
      color: disabled ? "#777777" : "#111111",
      cursor: disabled ? "default" : "pointer",
      lineHeight: "16px"
    }}
  >
    {label}
  </button>
);

export const Readout = ({ React, t, theta, omega }) => (
  <div
    style={{
      font: `400 13px ${MONO}`,
      fontVariantNumeric: "tabular-nums",
      color: "#111111",
      marginLeft: "auto",
      whiteSpace: "nowrap"
    }}
  >
    {`t = ${t.toFixed(1)} s · θ ${theta.toFixed(2)} · ω ${omega.toFixed(2)}`}
  </div>
);

export default function Widget({ model, React }) {
  const rawPoints = model.get("points");
  const [points, setPoints] = React.useState(
    Array.isArray(rawPoints) ? rawPoints : []
  );
  const rawDamping = model.get("damping");
  const [damping, setDamping] = React.useState(
    typeof rawDamping === "number" ? rawDamping : 0
  );
  const [selected, setSelected] = React.useState(
    Array.isArray(rawPoints) && rawPoints.length ? 0 : -1
  );
  const [playing, setPlaying] = React.useState(false);
  const [readout, setReadout] = React.useState({ t: 0, theta: 0, omega: 0 });

  const mountRef = React.useRef(null);
  const sceneRef = React.useRef(null);
  const tRef = React.useRef(0);
  const trackRef = React.useRef(null);
  const playingRef = React.useRef(false);
  const prevPointsRef = React.useRef(Array.isArray(rawPoints) ? rawPoints : []);

  // subscribe to inputs
  React.useEffect(() => {
    const onPoints = () => {
      const next = model.get("points");
      const arr = Array.isArray(next) ? next : [];
      const prev = prevPointsRef.current || [];
      let changed = -1;
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i] || {};
        const b = prev[i];
        if (!b) { changed = i; break; }
        if (
          Math.abs((a.theta0 || 0) - (b.theta0 || 0)) > 1e-12 ||
          Math.abs((a.omega0 || 0) - (b.omega0 || 0)) > 1e-12
        ) { changed = i; break; }
      }
      prevPointsRef.current = arr;
      setPoints(arr);
      if (arr.length === 0) {
        setSelected(-1);
        setPlaying(false);
        tRef.current = 0;
        return;
      }
      if (changed >= 0) {
        setSelected(changed);
        tRef.current = 0;
        setPlaying(true);
      } else {
        setSelected((s) => (s >= 0 && s < arr.length ? s : arr.length - 1));
      }
    };
    const onDamping = () => {
      const d = model.get("damping");
      setDamping(typeof d === "number" ? d : 0);
    };
    model.on("change:points", onPoints);
    model.on("change:damping", onDamping);
    return () => {
      model.off("change:points", onPoints);
      model.off("change:damping", onDamping);
    };
  }, [model]);

  // keep selection valid
  React.useEffect(() => {
    if (points.length === 0) {
      if (selected !== -1) setSelected(-1);
      return;
    }
    if (selected < 0 || selected >= points.length) setSelected(points.length - 1);
  }, [points, selected]);

  // integrate selected trajectory; damping change keeps current t
  React.useEffect(() => {
    const p = selected >= 0 ? points[selected] : null;
    if (!p) {
      trackRef.current = null;
      setReadout({ t: 0, theta: 0, omega: 0 });
      return;
    }
    trackRef.current = integrate(
      Number(p.theta0) || 0,
      Number(p.omega0) || 0,
      Number(damping) || 0
    );
    const [th, om] = sampleTrack(trackRef.current, tRef.current);
    setReadout({ t: tRef.current, theta: th, omega: om });
  }, [points, selected, damping]);

  React.useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const color = selected >= 0 ? PALETTE[selected % PALETTE.length] : "#777777";

  // three.js scene (built once)
  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth || 720;
    const height = 420;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0xffffff, 1);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = height + "px";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0.6, 1.4, 4.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.2, 0);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 12;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e8e8, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    // ground disk, faint
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 96),
      new THREE.MeshBasicMaterial({
        color: 0xf2f2f2,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      })
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = -1.55;
    scene.add(disk);

    const diskEdge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 96 }, (_, i) => {
          const a = (i / 96) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
        })
      ),
      new THREE.LineBasicMaterial({ color: 0xd9d9d9 })
    );
    diskEdge.rotation.x = 0;
    diskEdge.position.y = -1.55;
    scene.add(diskEdge);

    // pivot
    const pivot = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    scene.add(pivot);

    // arm group: rotates about z, theta = 0 hangs down (-y)
    const arm = new THREE.Group();
    scene.add(arm);

    const L = 1.25;
    const rodMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x777777) });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L, 12), rodMat);
    rod.position.y = -L / 2;
    arm.add(rod);

    const bobMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x777777),
      roughness: 0.55,
      metalness: 0.0
    });
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), bobMat);
    bob.position.y = -L;
    arm.add(bob);

    sceneRef.current = { renderer, scene, camera, controls, arm, rodMat, bobMat };

    let raf = 0;
    let last = performance.now();
    let lastReport = 0;

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (playingRef.current && trackRef.current) {
        tRef.current += dt;
        if (tRef.current >= T_MAX) {
          tRef.current = T_MAX;
          playingRef.current = false;
          setPlaying(false);
        }
      }
      const [th, om] = sampleTrack(trackRef.current, tRef.current);
      // theta grows counter-clockwise seen from front (+z looking toward -z)
      arm.rotation.z = th;
      controls.update();
      renderer.render(scene, camera);

      if (now - lastReport > 60) {
        lastReport = now;
        setReadout({ t: tRef.current, theta: th, omega: om });
      }
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      renderer.setSize(w, height, false);
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // colour of rod and bob follows the selected dot
  React.useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.rodMat.color.set(color);
    s.bobMat.color.set(color);
    return () => {};
  }, [color]);

  const hasPoints = points.length > 0;

  const onSelect = React.useCallback((i) => {
    setSelected(i);
    tRef.current = 0;
    setPlaying(true);
  }, []);

  const onToggle = React.useCallback(() => {
    if (!trackRef.current) return;
    if (tRef.current >= T_MAX) tRef.current = 0;
    setPlaying((p) => !p);
  }, []);

  const onReplay = React.useCallback(() => {
    tRef.current = 0;
    if (trackRef.current) setPlaying(true);
  }, []);

  return (
    <section
      style={{
        padding: 12,
        background: "#ffffff",
        color: "#111111",
        font: `400 12px ${UI}`,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <DotPicker
          React={React}
          count={points.length}
          selected={selected}
          onSelect={onSelect}
          disabled={!hasPoints}
        />
        <FlatButton
          React={React}
          label={playing ? "pause" : "play"}
          onClick={onToggle}
          disabled={!hasPoints}
        />
        <FlatButton
          React={React}
          label="replay"
          onClick={onReplay}
          disabled={!hasPoints}
        />
        <Readout
          React={React}
          t={readout.t}
          theta={readout.theta}
          omega={readout.omega}
        />
      </div>
      <div style={{ borderTop: "1px solid #d9d9d9" }} />
      <div ref={mountRef} style={{ width: "100%", height: 420 }} />
    </section>
  );
}