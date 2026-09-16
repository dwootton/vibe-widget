import * as THREE from "https://esm.sh/three@0.160.0";
import { OrbitControls } from "https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { LineSegments2 } from "https://esm.sh/three@0.160.0/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "https://esm.sh/three@0.160.0/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "https://esm.sh/three@0.160.0/examples/jsm/lines/LineMaterial.js";

const INK = "#111111";
const GREY = "#777777";
const HAIR = "#d9d9d9";
const FAINT = "#f2f2f2";
const ACCENT = "#d9480f";

const OUT_COLOR = {
  success: "#2b8a3e",
  slip: "#e8590c",
  collision: "#c92a2a",
  unreachable: "#777777",
};
const OUT_ORDER = ["success", "slip", "collision", "unreachable"];

const VIRIDIS = [
  [68, 1, 84], [72, 40, 120], [62, 73, 137], [49, 104, 142], [38, 130, 142],
  [31, 158, 137], [53, 183, 121], [110, 206, 88], [181, 222, 43], [253, 231, 37],
];

function viridis(t) {
  const u = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(u));
  const f = u - i;
  const a = VIRIDIS[i], b = VIRIDIS[i + 1];
  const c = [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function toRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    const arrKeys = keys.filter((k) => Array.isArray(raw[k]));
    if (!arrKeys.length) return [];
    const n = raw[arrKeys[0]].length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const o = {};
      for (const k of arrKeys) o[k] = raw[k][i];
      out[i] = o;
    }
    return out;
  }
  return [];
}

const fmt = (v, d = 3) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));

export const ScoreSlider = ({ React, value, onChange, count, total }) => (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        fontSize: 12,
        color: INK,
      }}
    >
      <span>predicted score ≥</span>
      <span
        style={{
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toFixed(2)}
      </span>
    </div>
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onInput={(e) => onChange(parseFloat(e.target.value))}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", accentColor: INK, margin: "6px 0 2px", display: "block" }}
    />
    <div
      style={{
        fontSize: 12,
        color: GREY,
        fontVariantNumeric: "tabular-nums",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      }}
    >
      showing {count} of {total}
    </div>
  </div>
);

export const OutcomeChips = ({ React, outcomes, counts, active, onToggle }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
    {outcomes.map((o) => {
      const on = active.indexOf(o) >= 0;
      return (
        <button
          key={o}
          onClick={() => onToggle(o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: `1px solid ${on ? INK : HAIR}`,
            background: on ? INK : "transparent",
            color: on ? "#ffffff" : INK,
            padding: "3px 7px",
            font: "400 11px system-ui, -apple-system, Inter, Helvetica, sans-serif",
            cursor: "pointer",
            borderRadius: 0,
            transition: "none",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: OUT_COLOR[o] || GREY,
              display: "inline-block",
            }}
          />
          <span>{o}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", opacity: on ? 0.85 : 1, color: on ? "#ffffff" : GREY }}>
            {counts[o] || 0}
          </span>
        </button>
      );
    })}
  </div>
);

export const ColorBySwitch = ({ React, value, onChange, domain }) => (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        fontSize: 12,
        color: INK,
        marginBottom: 5,
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      }}
    >
      colour by
    </div>
    <div style={{ display: "flex", gap: 4 }}>
      {["outcome", "score"].map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          style={{
            border: `1px solid ${value === k ? INK : HAIR}`,
            background: value === k ? INK : "transparent",
            color: value === k ? "#ffffff" : INK,
            padding: "3px 9px",
            font: "400 11px system-ui, -apple-system, Inter, Helvetica, sans-serif",
            cursor: "pointer",
            borderRadius: 0,
          }}
        >
          {k}
        </button>
      ))}
    </div>
    {value === "score" && domain && (
      <div style={{ marginTop: 7 }}>
        <div style={{ display: "flex", height: 6 }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{ flex: 1, background: viridis(i / 23) }} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            color: GREY,
            fontVariantNumeric: "tabular-nums",
            marginTop: 2,
          }}
        >
          <span>{domain[0].toFixed(2)}</span>
          <span>{domain[1].toFixed(2)}</span>
        </div>
      </div>
    )}
  </div>
);

export const SelectionReadout = ({ React, grasp }) => {
  const rows = grasp
    ? [
        ["id", String(grasp.grasp), true],
        ["region", grasp.region, false],
        ["score", fmt(grasp.score, 3), true],
        ["width", fmt(grasp.width, 3), true],
        ["outcome", grasp.outcome, false],
      ]
    : [];
  return (
    <div style={{ borderTop: `1px solid ${HAIR}`, paddingTop: 8 }}>
      {grasp ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map(([k, v, mono]) => (
              <tr key={k} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td
                  style={{
                    font: "400 11px system-ui, -apple-system, Inter, Helvetica, sans-serif",
                    color: GREY,
                    padding: "4px 0",
                    textAlign: "left",
                  }}
                >
                  {k}
                </td>
                <td
                  style={{
                    padding: "4px 0",
                    textAlign: "right",
                    color: k === "outcome" ? OUT_COLOR[v] || INK : INK,
                    fontSize: 13,
                    fontWeight: k === "score" ? 600 : 400,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: mono
                      ? "ui-monospace, SF Mono, Menlo, monospace"
                      : "system-ui, -apple-system, Inter, Helvetica, sans-serif",
                  }}
                >
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ height: 1 }} />
      )}
    </div>
  );
};

export default function Widget({ model, React }) {
  const [ver, setVer] = React.useState(0);

  React.useEffect(() => {
    const h = () => setVer((v) => v + 1);
    model.on("change:data", h);
    model.on("change:cloud", h);
    return () => {
      model.off("change:data", h);
      model.off("change:cloud", h);
    };
  }, [model]);

  const grasps = React.useMemo(() => toRows(model.get("data")), [model, ver]);
  const cloud = React.useMemo(() => toRows(model.get("cloud")), [model, ver]);

  const outcomes = React.useMemo(() => {
    const present = new Set(grasps.map((g) => g.outcome));
    const ordered = OUT_ORDER.filter((o) => present.has(o));
    for (const o of present) if (ordered.indexOf(o) < 0) ordered.push(o);
    return ordered;
  }, [grasps]);

  const counts = React.useMemo(() => {
    const c = {};
    for (const g of grasps) c[g.outcome] = (c[g.outcome] || 0) + 1;
    return c;
  }, [grasps]);

  const scoreDomain = React.useMemo(() => {
    if (!grasps.length) return [0, 1];
    let lo = Infinity, hi = -Infinity;
    for (const g of grasps) {
      if (g.score < lo) lo = g.score;
      if (g.score > hi) hi = g.score;
    }
    return [lo, hi];
  }, [grasps]);

  const [minScore, setMinScore] = React.useState(0.5);
  const [active, setActive] = React.useState(outcomes);
  const [colorBy, setColorBy] = React.useState("outcome");
  const [selected, setSelected] = React.useState(null);

  React.useEffect(() => {
    setActive(outcomes);
  }, [outcomes]);

  const isVisible = React.useCallback(
    (g) => g.score >= minScore - 1e-9 && active.indexOf(g.outcome) >= 0,
    [minScore, active]
  );

  const visible = React.useMemo(() => grasps.filter(isVisible), [grasps, isVisible]);

  React.useEffect(() => {
    if (selected !== null && !visible.some((g) => g.grasp === selected)) setSelected(null);
  }, [visible, selected]);

  React.useEffect(() => {
    model.set("selected", selected);
    model.set("min_score", minScore);
    model.save_changes();
  }, [model, selected, minScore]);

  const selRow = React.useMemo(
    () => grasps.find((g) => g.grasp === selected) || null,
    [grasps, selected]
  );

  const mountRef = React.useRef(null);
  const focusRef = React.useRef(null);
  const apiRef = React.useRef(null);
  const pickCbRef = React.useRef(() => {});

  pickCbRef.current = (id) => setSelected(id);

  // ---- three.js scene: built only from data ----
  React.useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W0 = Math.max(240, mount.clientWidth || 640);
    const H0 = Math.max(240, mount.clientHeight || 536);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W0, H0, false);
    renderer.setClearColor(0xffffff, 1);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(40, W0 / H0, 0.01, 10);
    camera.up.set(0, 0, 1);
    const target = new THREE.Vector3(0, 0, 0.05);
    camera.position.set(0.258, -0.199, 0.181);
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = 0.7;
    controls.minDistance = 0.12;
    controls.maxDistance = 1.2;
    controls.update();

    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    // table plane
    const planeGeo = track(new THREE.PlaneGeometry(0.36, 0.36));
    const planeMat = track(new THREE.MeshBasicMaterial({ color: FAINT }));
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.z = 0;
    scene.add(plane);

    const edgeGeo = track(new THREE.BufferGeometry());
    const h = 0.18;
    edgeGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [-h, -h, 0, h, -h, 0, h, -h, 0, h, h, 0, h, h, 0, -h, h, 0, -h, h, 0, -h, -h, 0],
        3
      )
    );
    const edgeMat = track(new THREE.LineBasicMaterial({ color: HAIR }));
    scene.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // object body cylinder
    const cylGeo = track(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 64, 1, true));
    cylGeo.rotateX(Math.PI / 2);
    const cylMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x777777,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const cyl = new THREE.Mesh(cylGeo, cylMat);
    cyl.position.z = 0.05;
    scene.add(cyl);

    const ringMat = track(new THREE.LineBasicMaterial({ color: HAIR, transparent: true, opacity: 0.9 }));
    for (const zz of [0.0005, 0.1]) {
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(0.04 * Math.cos(a), 0.04 * Math.sin(a), zz));
      }
      const g = track(new THREE.BufferGeometry().setFromPoints(pts));
      scene.add(new THREE.Line(g, ringMat));
    }

    // point cloud
    if (cloud.length) {
      const pos = new Float32Array(cloud.length * 3);
      for (let i = 0; i < cloud.length; i++) {
        pos[i * 3] = +cloud[i].x;
        pos[i * 3 + 1] = +cloud[i].y;
        pos[i * 3 + 2] = +cloud[i].z;
      }
      const pg = track(new THREE.BufferGeometry());
      pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const pm = track(
        new THREE.PointsMaterial({
          color: 0x111111,
          size: 1.8,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.7,
        })
      );
      scene.add(new THREE.Points(pg, pm));
    }

    // grasp glyphs
    const FING = 0.025;
    const APPR = 0.08;
    const entries = [];
    const glyphGroup = new THREE.Group();
    scene.add(glyphGroup);

    for (const g of grasps) {
      const p = new THREE.Vector3(+g.x, +g.y, +g.z);
      const a = new THREE.Vector3(+g.ax, +g.ay, +g.az);
      if (a.lengthSq() < 1e-9) a.set(0, 0, -1);
      a.normalize();
      const c = new THREE.Vector3(+g.cx, +g.cy, +g.cz);
      if (c.lengthSq() < 1e-9) c.set(1, 0, 0);
      c.normalize();
      const half = (+g.width || 0) / 2;

      const t1 = p.clone().addScaledVector(c, half);
      const t2 = p.clone().addScaledVector(c, -half);
      const r1 = t1.clone().addScaledVector(a, -FING);
      const r2 = t2.clone().addScaledVector(a, -FING);
      const palm = p.clone().addScaledVector(a, -FING);

      const segs = [
        [r1, t1],
        [r2, t2],
        [r1, r2],
      ];
      const flat = [];
      for (const [s, e] of segs) flat.push(s.x, s.y, s.z, e.x, e.y, e.z);

      const lgeo = track(new LineSegmentsGeometry());
      lgeo.setPositions(flat);
      const lmat = track(
        new LineMaterial({
          color: new THREE.Color(OUT_COLOR[g.outcome] || GREY).getHex(),
          linewidth: 2,
          worldUnits: false,
          dashed: false,
        })
      );
      lmat.resolution.set(W0, H0);
      const obj = new LineSegments2(lgeo, lmat);
      obj.computeLineDistances();
      obj.frustumCulled = false;
      glyphGroup.add(obj);

      // dashed approach polyline (manual dashes), 8 cm along -a ending at palm
      const dash = [];
      const step = 0.009;
      const on = 0.0055;
      for (let s = 0; s < APPR - 1e-6; s += step) {
        const d0 = Math.min(s + on, APPR);
        const s0 = palm.clone().addScaledVector(a, -(APPR - s));
        const s1 = palm.clone().addScaledVector(a, -(APPR - d0));
        dash.push(s0.x, s0.y, s0.z, s1.x, s1.y, s1.z);
      }

      entries.push({ row: g, obj, mat: lmat, segs, tips: [t1, t2], dash, palm });
    }

    // selection overlay
    const selGroup = new THREE.Group();
    selGroup.visible = false;
    scene.add(selGroup);
    const dashGeo = track(new THREE.BufferGeometry());
    dashGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(300), 3));
    const dashMat = track(new THREE.LineBasicMaterial({ color: ACCENT }));
    const dashLine = new THREE.LineSegments(dashGeo, dashMat);
    dashLine.frustumCulled = false;
    selGroup.add(dashLine);

    const dotGeo = track(new THREE.SphereGeometry(0.0028, 16, 12));
    const dotMat = track(new THREE.MeshBasicMaterial({ color: ACCENT }));
    const dots = [new THREE.Mesh(dotGeo, dotMat), new THREE.Mesh(dotGeo, dotMat)];
    dots.forEach((d) => selGroup.add(d));

    const size = { w: W0, h: H0 };

    const applyState = (st) => {
      for (const e of entries) {
        const g = e.row;
        const vis = g.score >= st.minScore - 1e-9 && st.active.indexOf(g.outcome) >= 0;
        e.obj.visible = vis;
        e.visible = vis;
        const col =
          st.colorBy === "score"
            ? viridis(
                st.domain[1] > st.domain[0]
                  ? (g.score - st.domain[0]) / (st.domain[1] - st.domain[0])
                  : 0.5
              )
            : OUT_COLOR[g.outcome] || GREY;
        e.mat.color.set(col);
        e.mat.linewidth = st.selected === g.grasp ? 4.5 : 2;
      }
      const sel = entries.find((e) => e.row.grasp === st.selected && e.visible);
      if (sel) {
        const arr = dashGeo.attributes.position.array;
        const n = Math.min(sel.dash.length, arr.length);
        for (let i = 0; i < n; i++) arr[i] = sel.dash[i];
        for (let i = n; i < arr.length; i++) arr[i] = sel.dash.length ? sel.dash[n - 1] : 0;
        dashGeo.attributes.position.needsUpdate = true;
        dashGeo.setDrawRange(0, Math.floor(n / 3));
        dots[0].position.copy(sel.tips[0]);
        dots[1].position.copy(sel.tips[1]);
        selGroup.visible = true;
      } else {
        selGroup.visible = false;
      }
    };

    const projectPt = (v) => {
      const p = v.clone().project(camera);
      return [(p.x * 0.5 + 0.5) * size.w, (-p.y * 0.5 + 0.5) * size.h, p.z];
    };

    const distToSeg = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const cx = x1 + t * dx, cy = y1 + t * dy;
      return Math.hypot(px - cx, py - cy);
    };

    const pickAt = (px, py) => {
      let best = null, bestD = 13, bestZ = Infinity;
      for (const e of entries) {
        if (!e.visible) continue;
        for (const [s, t] of e.segs) {
          const A = projectPt(s), B = projectPt(t);
          const d = distToSeg(px, py, A[0], A[1], B[0], B[1]);
          const z = Math.min(A[2], B[2]);
          if (d < bestD - 0.5 || (d < bestD + 0.5 && z < bestZ)) {
            bestD = Math.min(bestD, d);
            bestZ = z;
            best = e.row.grasp;
          }
        }
      }
      return best;
    };

    let downX = 0, downY = 0, moved = false;
    const el = renderer.domElement;
    const onDown = (ev) => {
      downX = ev.clientX;
      downY = ev.clientY;
      moved = false;
      if (focusRef.current) focusRef.current.focus();
    };
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - downX) > 4 || Math.abs(ev.clientY - downY) > 4) moved = true;
    };
    const onUp = (ev) => {
      if (moved) return;
      const r = el.getBoundingClientRect();
      const id = pickAt(ev.clientX - r.left, ev.clientY - r.top);
      pickCbRef.current(id);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);

    const resize = () => {
      const w = Math.max(160, mount.clientWidth);
      const hh = Math.max(160, mount.clientHeight);
      size.w = w;
      size.h = hh;
      renderer.setSize(w, hh, false);
      camera.aspect = w / hh;
      camera.updateProjectionMatrix();
      for (const e of entries) e.mat.resolution.set(w, hh);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    apiRef.current = { applyState };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      controls.dispose();
      for (const d of disposables) {
        if (d && typeof d.dispose === "function") d.dispose();
      }
      scene.traverse((o) => {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      });
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
      apiRef.current = null;
    };
  }, [grasps, cloud]);

  React.useEffect(() => {
    if (apiRef.current) {
      apiRef.current.applyState({ minScore, active, colorBy, selected, domain: scoreDomain });
    }
  }, [minScore, active, colorBy, selected, scoreDomain, grasps, cloud]);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const ordered = visible.slice().sort((a, b) => a.score - b.score || a.grasp - b.grasp);
    if (!ordered.length) return;
    let idx = ordered.findIndex((g) => g.grasp === selected);
    if (idx < 0) idx = e.key === "ArrowUp" ? -1 : ordered.length;
    let n = e.key === "ArrowUp" ? idx + 1 : idx - 1;
    n = Math.max(0, Math.min(ordered.length - 1, n));
    setSelected(ordered[n].grasp);
  };

  return (
    <div
      ref={focusRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        height: 560,
        background: "#ffffff",
        color: INK,
        padding: 12,
        boxSizing: "border-box",
        gap: 0,
        outline: "none",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      }}
    >
      <div ref={mountRef} style={{ flex: "1 1 auto", minWidth: 200, height: "100%", position: "relative" }} />
      <div
        style={{
          flex: "0 0 208px",
          borderLeft: `1px solid ${HAIR}`,
          paddingLeft: 12,
          marginLeft: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ScoreSlider
          React={React}
          value={minScore}
          onChange={setMinScore}
          count={visible.length}
          total={grasps.length}
        />
        <OutcomeChips
          React={React}
          outcomes={outcomes}
          counts={counts}
          active={active}
          onToggle={(o) =>
            setActive((prev) => (prev.indexOf(o) >= 0 ? prev.filter((x) => x !== o) : [...prev, o]))
          }
        />
        <ColorBySwitch React={React} value={colorBy} onChange={setColorBy} domain={scoreDomain} />
        <SelectionReadout React={React} grasp={selRow} />
      </div>
    </div>
  );
}