import * as d3 from "https://esm.sh/d3@7";

const ROOM_W = 8, ROOM_D = 5;
const NX = 96, NY = 60;
const GW = NX + 2, GH = NY + 2;
const DX = ROOM_W / NX;
const DY = ROOM_D / NY;
const DT = 1 / 30;
const VENT_W = 0.6;
const SCALE = 112;
const CW = ROOM_W * SCALE, CH = ROOM_D * SCALE;
const NPART = 400;

const INK = "#111111", GREY = "#777777", HAIR = "#d9d9d9", FAINT = "#f2f2f2";
const ACCENT = "#d9480f", SUPPLY = "#1c7ed6", EXHAUST = "#777777";
const FONT = "system-ui, -apple-system, Inter, Helvetica, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";

const IX = (i, j) => i + j * GW;

const LUT = (() => {
  const n = 256, r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = d3.rgb(d3.interpolateViridis(i / (n - 1)));
    r[i] = c.r; g[i] = c.g; b[i] = c.b;
  }
  return { r, g, b };
})();

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function clampFurn(f) {
  const m = 0.02;
  return {
    ...f,
    x: clamp(f.x, f.w / 2 + m, ROOM_W - f.w / 2 - m),
    y: clamp(f.y, f.h / 2 + m, ROOM_D - f.h / 2 - m),
  };
}
const clampVentY = (y) => clamp(y, VENT_W / 2 + 0.08, ROOM_D - VENT_W / 2 - 0.08);

function parseData(raw) {
  if (!raw) return [];
  let rows = raw;
  if (!Array.isArray(raw)) {
    if (Array.isArray(raw.name)) {
      rows = raw.name.map((n, i) => ({ name: n, x: raw.x[i], y: raw.y[i], w: raw.w[i], h: raw.h[i] }));
    } else if (Array.isArray(raw.data)) rows = raw.data;
    else return [];
  }
  return rows.map((r) => clampFurn({ name: String(r.name), x: +r.x, y: +r.y, w: +r.w, h: +r.h }));
}

function createSolver() {
  const n = GW * GH;
  return {
    u: new Float32Array(n), v: new Float32Array(n),
    u0: new Float32Array(n), v0: new Float32Array(n),
    p: new Float32Array(n), div: new Float32Array(n),
    solid: new Uint8Array(n), fixed: new Uint8Array(n),
    speed: new Float32Array(n),
    ventMask: new Uint8Array(GH), exMask: new Uint8Array(GH),
    fan: 0.8, outSpeed: 0.8,
  };
}

function setMask(s, furn) {
  const { solid, u, v } = s;
  for (let j = 1; j <= NY; j++) {
    const y = (j - 0.5) * DY;
    for (let i = 1; i <= NX; i++) {
      const x = (i - 0.5) * DX;
      let hit = 0;
      for (let k = 0; k < furn.length; k++) {
        const f = furn[k];
        if (x > f.x - f.w / 2 && x < f.x + f.w / 2 && y > f.y - f.h / 2 && y < f.y + f.h / 2) { hit = 1; break; }
      }
      const idx = IX(i, j);
      solid[idx] = hit;
      if (hit) { u[idx] = 0; v[idx] = 0; }
    }
  }
}

function setOpenings(s, vy, ey) {
  for (let j = 0; j < GH; j++) { s.ventMask[j] = 0; s.exMask[j] = 0; }
  for (let j = 1; j <= NY; j++) {
    const y = (j - 0.5) * DY;
    s.ventMask[j] = Math.abs(y - vy) <= VENT_W / 2 ? 1 : 0;
    s.exMask[j] = Math.abs(y - ey) <= VENT_W / 2 ? 1 : 0;
  }
}

function applyOpenings(s) {
  const { u, v, solid, ventMask, exMask, fixed } = s;
  fixed.fill(0);
  let nIn = 0, nOut = 0;
  for (let j = 1; j <= NY; j++) {
    if (ventMask[j] && !solid[IX(1, j)]) nIn++;
    if (exMask[j] && !solid[IX(NX, j)]) nOut++;
  }
  const out = nOut > 0 ? (s.fan * nIn) / nOut : 0;
  s.outSpeed = out;
  for (let j = 1; j <= NY; j++) {
    if (ventMask[j] && !solid[IX(1, j)]) {
      const k = IX(1, j); u[k] = s.fan; v[k] = 0; fixed[k] = 1;
      u[IX(0, j)] = s.fan; v[IX(0, j)] = 0;
    }
    if (exMask[j] && !solid[IX(NX, j)]) {
      const k = IX(NX, j); u[k] = out; v[k] = 0; fixed[k] = 1;
      u[IX(GW - 1, j)] = out; v[IX(GW - 1, j)] = 0;
    }
  }
}

function bcVel(s) {
  const { u, v, ventMask, exMask, solid } = s;
  for (let j = 1; j <= NY; j++) {
    if (!(ventMask[j] && !solid[IX(1, j)])) {
      u[IX(0, j)] = -u[IX(1, j)]; v[IX(0, j)] = -v[IX(1, j)];
    }
    if (!(exMask[j] && !solid[IX(NX, j)])) {
      u[IX(GW - 1, j)] = -u[IX(NX, j)]; v[IX(GW - 1, j)] = -v[IX(NX, j)];
    }
  }
  for (let i = 1; i <= NX; i++) {
    u[IX(i, 0)] = -u[IX(i, 1)]; v[IX(i, 0)] = -v[IX(i, 1)];
    u[IX(i, GH - 1)] = -u[IX(i, NY)]; v[IX(i, GH - 1)] = -v[IX(i, NY)];
  }
}

function advect(s) {
  const { u, v, u0, v0, solid } = s;
  const fx = DT / DX, fy = DT / DY;
  for (let j = 1; j <= NY; j++) {
    for (let i = 1; i <= NX; i++) {
      const k = IX(i, j);
      if (solid[k]) { u[k] = 0; v[k] = 0; continue; }
      let x = i - u0[k] * fx, y = j - v0[k] * fy;
      x = clamp(x, 1, NX); y = clamp(y, 1, NY);
      const i0 = Math.floor(x), j0 = Math.floor(y);
      const i1 = Math.min(i0 + 1, NX), j1 = Math.min(j0 + 1, NY);
      const sx = x - i0, sy = y - j0;
      const k00 = IX(i0, j0), k10 = IX(i1, j0), k01 = IX(i0, j1), k11 = IX(i1, j1);
      u[k] = (1 - sy) * ((1 - sx) * u0[k00] + sx * u0[k10]) + sy * ((1 - sx) * u0[k01] + sx * u0[k11]);
      v[k] = (1 - sy) * ((1 - sx) * v0[k00] + sx * v0[k10]) + sy * ((1 - sx) * v0[k01] + sx * v0[k11]);
    }
  }
}

function diffuse(s, K) {
  const { u, v, u0, v0, solid } = s;
  for (let j = 1; j <= NY; j++) {
    for (let i = 1; i <= NX; i++) {
      const k = IX(i, j);
      if (solid[k]) continue;
      let su = 0, sv = 0, n = 0;
      const nb = [k - 1, k + 1, k - GW, k + GW];
      for (let q = 0; q < 4; q++) {
        const m = nb[q];
        if (solid[m]) continue;
        su += u0[m]; sv += v0[m]; n++;
      }
      if (n === 0) continue;
      u[k] = u0[k] + K * (su / n - u0[k]);
      v[k] = v0[k] + K * (sv / n - v0[k]);
    }
  }
}

function pressureGhosts(s) {
  const { p } = s;
  for (let j = 1; j <= NY; j++) { p[IX(0, j)] = p[IX(1, j)]; p[IX(GW - 1, j)] = p[IX(NX, j)]; }
  for (let i = 1; i <= NX; i++) { p[IX(i, 0)] = p[IX(i, 1)]; p[IX(i, GH - 1)] = p[IX(i, NY)]; }
}

function project(s, iters) {
  const { u, v, p, div, solid, fixed } = s;
  for (let j = 1; j <= NY; j++) {
    for (let i = 1; i <= NX; i++) {
      const k = IX(i, j);
      if (solid[k]) { div[k] = 0; p[k] = 0; continue; }
      div[k] = (u[k + 1] - u[k - 1]) / (2 * DX) + (v[k + GW] - v[k - GW]) / (2 * DY);
    }
  }
  const h2 = DX * DX;
  for (let it = 0; it < iters; it++) {
    pressureGhosts(s);
    for (let j = 1; j <= NY; j++) {
      for (let i = 1; i <= NX; i++) {
        const k = IX(i, j);
        if (solid[k]) continue;
        let sum = 0, n = 0;
        if (!solid[k - 1]) { sum += p[k - 1]; n++; }
        if (!solid[k + 1]) { sum += p[k + 1]; n++; }
        if (!solid[k - GW]) { sum += p[k - GW]; n++; }
        if (!solid[k + GW]) { sum += p[k + GW]; n++; }
        if (n === 0) { p[k] = 0; continue; }
        p[k] = (sum - h2 * div[k]) / n;
      }
    }
  }
  pressureGhosts(s);
  for (let j = 1; j <= NY; j++) {
    for (let i = 1; i <= NX; i++) {
      const k = IX(i, j);
      if (solid[k] || fixed[k]) continue;
      const pl = solid[k - 1] ? p[k] : p[k - 1];
      const pr = solid[k + 1] ? p[k] : p[k + 1];
      const pd = solid[k - GW] ? p[k] : p[k - GW];
      const pup = solid[k + GW] ? p[k] : p[k + GW];
      u[k] = clamp(u[k] - (pr - pl) / (2 * DX), -6, 6);
      v[k] = clamp(v[k] - (pup - pd) / (2 * DY), -6, 6);
    }
  }
}

function step(s) {
  applyOpenings(s); bcVel(s);
  s.u0.set(s.u); s.v0.set(s.v);
  advect(s);
  applyOpenings(s); bcVel(s);
  s.u0.set(s.u); s.v0.set(s.v);
  diffuse(s, 0.16);
  applyOpenings(s); bcVel(s);
  project(s, 24);
  applyOpenings(s); bcVel(s);
  const { u, v, speed, solid } = s;
  for (let j = 1; j <= NY; j++) {
    for (let i = 1; i <= NX; i++) {
      const k = IX(i, j);
      speed[k] = solid[k] ? 0 : Math.hypot(u[k], v[k]);
    }
  }
}

function sampleVel(s, x, y) {
  let gi = clamp(x / DX + 0.5, 1, NX), gj = clamp(y / DY + 0.5, 1, NY);
  const i0 = Math.floor(gi), j0 = Math.floor(gj);
  const i1 = Math.min(i0 + 1, NX), j1 = Math.min(j0 + 1, NY);
  const sx = gi - i0, sy = gj - j0;
  const k00 = IX(i0, j0), k10 = IX(i1, j0), k01 = IX(i0, j1), k11 = IX(i1, j1);
  const uu = (1 - sy) * ((1 - sx) * s.u[k00] + sx * s.u[k10]) + sy * ((1 - sx) * s.u[k01] + sx * s.u[k11]);
  const vv = (1 - sy) * ((1 - sx) * s.v[k00] + sx * s.v[k10]) + sy * ((1 - sx) * s.v[k01] + sx * s.v[k11]);
  return [uu, vv];
}

function solidAt(s, x, y) {
  const i = clamp(Math.round(x / DX + 0.5), 1, NX), j = clamp(Math.round(y / DY + 0.5), 1, NY);
  return s.solid[IX(i, j)] === 1;
}

function drawThumb(furn, vy, ey) {
  const W = 120, sc = (W - 8) / ROOM_W, H = Math.round(ROOM_D * sc + 8), dpr = 2;
  const c = document.createElement("canvas");
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext("2d");
  g.scale(dpr, dpr);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.lineWidth = 1;
  g.strokeStyle = HAIR;
  g.strokeRect(4.5, 4.5, ROOM_W * sc - 1, ROOM_D * sc - 1);
  g.lineWidth = 0.75;
  for (const f of furn) {
    const x = 4 + (f.x - f.w / 2) * sc, y = 4 + (f.y - f.h / 2) * sc;
    g.fillStyle = FAINT; g.strokeStyle = INK;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, f.w * sc, f.h * sc, 2);
    else g.rect(x, y, f.w * sc, f.h * sc);
    g.fill(); g.stroke();
  }
  g.lineWidth = 2.5;
  g.strokeStyle = SUPPLY;
  g.beginPath();
  g.moveTo(5, 4 + (vy - VENT_W / 2) * sc); g.lineTo(5, 4 + (vy + VENT_W / 2) * sc); g.stroke();
  g.strokeStyle = EXHAUST;
  g.beginPath();
  g.moveTo(4 + ROOM_W * sc - 1, 4 + (ey - VENT_W / 2) * sc);
  g.lineTo(4 + ROOM_W * sc - 1, 4 + (ey + VENT_W / 2) * sc); g.stroke();
  return { url: c.toDataURL("image/png"), w: W, h: H };
}

export const FanSlider = ({ React, value, onChange }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 8, font: `400 11px ${FONT}`, color: GREY }}>
    <span>fan</span>
    <input
      type="range" min={0.2} max={1.5} step={0.05} value={value}
      onInput={(e) => onChange(+e.target.value)}
      onChange={(e) => onChange(+e.target.value)}
      style={{ width: 128, accentColor: INK }}
    />
    <span style={{ font: `400 12px ${MONO}`, color: INK, fontVariantNumeric: "tabular-nums" }}>
      {value.toFixed(2)} m/s
    </span>
  </label>
);

export const SpeedLegend = ({ React, vmax, value, onChange }) => {
  const BW = 156, BH = 10;
  const svgRef = React.useRef(null);
  const dragRef = React.useRef(false);
  const idRef = React.useRef("vg" + Math.random().toString(36).slice(2, 8));
  const stops = React.useMemo(() => {
    const out = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      out.push({ o: `${(t * 100).toFixed(0)}%`, c: d3.interpolateViridis(t) });
    }
    return out;
  }, []);
  const pos = Math.sqrt(clamp(value / vmax, 0, 1)) * BW;
  const setFromEvent = (e) => {
    const node = svgRef.current;
    if (!node) return;
    const [mx] = d3.pointer(e, node);
    const t = clamp((mx - 1) / BW, 0, 1);
    onChange(+(t * t * vmax).toFixed(3));
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg
        ref={svgRef} width={BW + 2} height={30} style={{ touchAction: "none", cursor: "ew-resize" }}
        onPointerDown={(e) => {
          e.preventDefault();
          dragRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromEvent(e);
        }}
        onPointerMove={(e) => { if (dragRef.current) setFromEvent(e); }}
        onPointerUp={() => { dragRef.current = false; }}
        onPointerCancel={() => { dragRef.current = false; }}
      >
        <defs>
          <linearGradient id={idRef.current} x1="0" x2="1" y1="0" y2="0">
            {stops.map((s) => <stop key={s.o} offset={s.o} stopColor={s.c} />)}
          </linearGradient>
        </defs>
        <rect x={1} y={4} width={BW} height={BH} fill={`url(#${idRef.current})`} />
        <rect x={1} y={4} width={BW} height={BH} fill="none" stroke={HAIR} strokeWidth={1} />
        <line x1={1 + pos} x2={1 + pos} y1={1} y2={17} stroke="#ffffff" strokeWidth={3} />
        <line x1={1 + pos} x2={1 + pos} y1={1} y2={17} stroke={ACCENT} strokeWidth={1.5} />
        <circle cx={1 + pos} cy={21} r={3.5} fill={ACCENT} stroke="#ffffff" strokeWidth={1.5} />
        <rect x={1 + pos - 8} y={0} width={16} height={30} fill="transparent" />
        <text x={0} y={27} style={{ font: `400 11px ${MONO}`, fill: GREY }}>0</text>
        <text x={BW + 2} y={27} textAnchor="end" style={{ font: `400 11px ${MONO}`, fill: GREY }}>
          {vmax.toFixed(2)}
        </text>
      </svg>
      <span style={{ font: `400 12px ${MONO}`, color: INK, fontVariantNumeric: "tabular-nums" }}>
        {value.toFixed(2)} m/s
      </span>
    </div>
  );
};

export const SnapshotStrip = ({ React, items, bestId, selectedId, onSelect, height }) => (
  <div style={{ width: 132, height, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
    {items.map((it) => (
      <div
        key={it.id}
        onClick={() => onSelect(it)}
        style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}
      >
        <img
          src={it.url} width={120} height={it.h}
          style={{
            display: "block",
            border: `1px solid ${it.id === selectedId ? ACCENT : HAIR}`,
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 120 }}>
          <svg width={10} height={10} style={{ opacity: it.id === bestId ? 1 : 0 }}>
            <path
              d="M5 0.4 L6.2 3.5 L9.6 3.7 L6.9 5.8 L7.9 9.1 L5 7.2 L2.1 9.1 L3.1 5.8 L0.4 3.7 L3.8 3.5 Z"
              fill={ACCENT}
            />
          </svg>
          <span style={{ font: `400 12px ${MONO}`, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {it.pct.toFixed(0)} %
          </span>
        </div>
      </div>
    ))}
  </div>
);

export default function Widget({ model, React }) {
  const [furn, setFurn] = React.useState(() => parseData(model.get("data")));
  const [ventY, setVentY] = React.useState(1.6);
  const [exhY, setExhY] = React.useState(3.4);
  const [fan, setFan] = React.useState(0.8);
  const [thr, setThr] = React.useState(0.05);
  const [stalePct, setStalePct] = React.useState(0);
  const [snaps, setSnaps] = React.useState([]);
  const [selSnap, setSelSnap] = React.useState(null);
  const [activeIdx, setActiveIdx] = React.useState(-1);

  const canvasRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const solverRef = React.useRef(null);
  const partRef = React.useRef(null);
  const furnRef = React.useRef(furn);
  const ventRef = React.useRef({ vy: ventY, ey: exhY });
  const fanRef = React.useRef(fan);
  const thrRef = React.useRef(thr);
  const pctRef = React.useRef(0);
  const dragRef = React.useRef(null);
  const timerRef = React.useRef(null);

  if (!solverRef.current) solverRef.current = createSolver();
  if (!partRef.current) {
    partRef.current = {
      x: new Float32Array(NPART), y: new Float32Array(NPART), life: new Float32Array(NPART),
    };
    for (let i = 0; i < NPART; i++) {
      partRef.current.x[i] = Math.random() * ROOM_W;
      partRef.current.y[i] = Math.random() * ROOM_D;
      partRef.current.life[i] = Math.random() * 8;
    }
  }

  React.useEffect(() => { furnRef.current = furn; return () => {}; }, [furn]);
  React.useEffect(() => { ventRef.current = { vy: ventY, ey: exhY }; return () => {}; }, [ventY, exhY]);
  React.useEffect(() => { fanRef.current = fan; return () => {}; }, [fan]);
  React.useEffect(() => { thrRef.current = thr; return () => {}; }, [thr]);
  React.useEffect(() => { if (thr > fan) setThr(+(fan * 0.5).toFixed(3)); return () => {}; }, [fan, thr]);

  React.useEffect(() => {
    model.set("arrangement", furn.map((f) => ({
      name: f.name,
      x: +f.x.toFixed(2), y: +f.y.toFixed(2), w: +f.w.toFixed(2), h: +f.h.toFixed(2),
    })));
    model.set("stale_pct", +stalePct.toFixed(1));
    model.save_changes();
    return () => {};
  }, [furn, stalePct]);

  React.useEffect(() => {
    const onData = () => { setFurn(parseData(model.get("data"))); setSnaps([]); setSelSnap(null); };
    model.on("change:data", onData);
    return () => model.off("change:data", onData);
  }, [model]);

  const captureSnapshot = React.useCallback(() => {
    const t = drawThumb(furnRef.current, ventRef.current.vy, ventRef.current.ey);
    const item = {
      id: "s" + Date.now() + Math.random().toString(36).slice(2, 5),
      url: t.url, h: t.h, pct: pctRef.current,
      layout: {
        furn: furnRef.current.map((f) => ({ ...f })),
        vy: ventRef.current.vy, ey: ventRef.current.ey,
      },
    };
    setSnaps((prev) => [item, ...prev].slice(0, 8));
  }, []);

  const scheduleSnapshot = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; captureSnapshot(); }, 900);
  }, [captureSnapshot]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  React.useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || !svgRef.current) return;
      const [mx, my] = d3.pointer(e, svgRef.current);
      const x = mx / SCALE, y = my / SCALE;
      d.moved = true;
      if (d.type === "furn") {
        setFurn((prev) => prev.map((f, i) => (i === d.idx ? clampFurn({ ...f, x: x + d.ox, y: y + d.oy }) : f)));
      } else if (d.type === "vent") setVentY(clampVentY(y));
      else if (d.type === "exh") setExhY(clampVentY(y));
    };
    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setActiveIdx(-1);
      if (d && d.type === "furn" && d.moved) scheduleSnapshot();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [scheduleSnapshot]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const field = document.createElement("canvas");
    field.width = NX; field.height = NY;
    const fctx = field.getContext("2d");
    const img = fctx.createImageData(NX, NY);

    const hc = document.createElement("canvas");
    hc.width = 6; hc.height = 6;
    const hctx = hc.getContext("2d");
    hctx.strokeStyle = "rgba(255,255,255,0.65)";
    hctx.lineWidth = 1;
    hctx.beginPath(); hctx.moveTo(0, 6); hctx.lineTo(6, 0); hctx.stroke();
    const hatch = ctx.createPattern(hc, "repeat");

    const s = solverRef.current;
    const P = partRef.current;
    let raf = 0, last = 0, frame = 0;

    const respawn = (i) => {
      const vy = ventRef.current.vy;
      P.x[i] = 0.05 + Math.random() * 0.18;
      P.y[i] = clamp(vy + (Math.random() - 0.5) * VENT_W * 0.9, 0.05, ROOM_D - 0.05);
      P.life[i] = 0;
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 31) return;
      last = now;

      s.fan = fanRef.current;
      setMask(s, furnRef.current);
      setOpenings(s, ventRef.current.vy, ventRef.current.ey);
      step(s);

      for (let i = 0; i < NPART; i++) {
        const [uu, vv] = sampleVel(s, P.x[i], P.y[i]);
        P.x[i] += uu * DT; P.y[i] += vv * DT;
        P.life[i] += DT;
        if (
          P.x[i] < 0.01 || P.x[i] > ROOM_W - 0.01 || P.y[i] < 0.01 || P.y[i] > ROOM_D - 0.01 ||
          P.life[i] > 10 || solidAt(s, P.x[i], P.y[i])
        ) respawn(i);
      }

      const thrV = thrRef.current;
      const vmax = Math.max(fanRef.current, 1e-6);
      let fluid = 0, staleN = 0;
      const d = img.data;
      for (let j = 1; j <= NY; j++) {
        for (let i = 1; i <= NX; i++) {
          const k = IX(i, j);
          const o = ((j - 1) * NX + (i - 1)) * 4;
          if (s.solid[k]) {
            d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 255;
            continue;
          }
          fluid++;
          const sp = s.speed[k];
          if (sp < thrV) staleN++;
          const t = Math.sqrt(clamp(sp / vmax, 0, 1));
          const ci = Math.round(t * 255);
          d[o] = LUT.r[ci]; d[o + 1] = LUT.g[ci]; d[o + 2] = LUT.b[ci]; d[o + 3] = 255;
        }
      }
      const pct = fluid > 0 ? (staleN / fluid) * 100 : 0;
      pctRef.current = pct;
      frame++;
      if (frame % 12 === 0) setStalePct(pct);

      fctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, CW, CH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(field, 0, 0, CW, CH);

      const cellW = CW / NX, cellH = CH / NY;
      ctx.beginPath();
      for (let j = 1; j <= NY; j++) {
        let runStart = -1;
        for (let i = 1; i <= NX + 1; i++) {
          const k = IX(i, j);
          const isStale = i <= NX && !s.solid[k] && s.speed[k] < thrV;
          if (isStale && runStart < 0) runStart = i;
          if (!isStale && runStart >= 0) {
            ctx.rect((runStart - 1) * cellW, (j - 1) * cellH, (i - runStart) * cellW, cellH);
            runStart = -1;
          }
        }
      }
      ctx.fillStyle = hatch;
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < NPART; i++) {
        ctx.fillRect(P.x[i] * SCALE - 0.7, P.y[i] * SCALE - 0.7, 1.4, 1.4);
      }
      return undefined;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bestId = React.useMemo(() => {
    if (!snaps.length) return null;
    let b = snaps[0];
    for (const s of snaps) if (s.pct < b.pct) b = s;
    return b.id;
  }, [snaps]);

  const restore = (it) => {
    setFurn(it.layout.furn.map((f) => ({ ...f })));
    setVentY(it.layout.vy);
    setExhY(it.layout.ey);
    setSelSnap(it.id);
  };

  const rotate = (idx) => {
    setFurn((prev) => prev.map((f, i) => (i === idx ? clampFurn({ ...f, w: f.h, h: f.w }) : f)));
    scheduleSnapshot();
  };

  return (
    <div style={{ padding: 12, background: "#ffffff", color: INK, font: `400 12px ${FONT}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ font: `400 13px ${FONT}`, color: INK }}>
          stale air:{" "}
          <span style={{ fontWeight: 600, font: `600 14px ${MONO}`, fontVariantNumeric: "tabular-nums" }}>
            {stalePct.toFixed(0)}
          </span>{" "}
          % of floor
        </div>
        <FanSlider React={React} value={fan} onChange={setFan} />
        <SpeedLegend React={React} vmax={fan} value={Math.min(thr, fan)} onChange={setThr} />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ position: "relative", width: CW, height: CH, flex: "0 0 auto" }}>
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", left: 0, top: 0, width: CW, height: CH, display: "block" }}
          />
          <svg
            ref={svgRef} width={CW} height={CH}
            style={{ position: "absolute", left: 0, top: 0, touchAction: "none" }}
          >
            <rect x={0.5} y={0.5} width={CW - 1} height={CH - 1} fill="none" stroke={INK} strokeWidth={1} />

            {furn.map((f, idx) => {
              const px = (f.x - f.w / 2) * SCALE, py = (f.y - f.h / 2) * SCALE;
              const pw = f.w * SCALE, ph = f.h * SCALE;
              const vertical = ph > pw * 1.6;
              return (
                <g key={f.name}>
                  <rect
                    x={px} y={py} width={pw} height={ph} rx={4} ry={4}
                    fill="#ffffff" stroke={idx === activeIdx ? ACCENT : INK}
                    strokeWidth={idx === activeIdx ? 1.5 : 1}
                    style={{ cursor: "move" }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const [mx, my] = d3.pointer(e, svgRef.current);
                      dragRef.current = {
                        type: "furn", idx, moved: false,
                        ox: f.x - mx / SCALE, oy: f.y - my / SCALE,
                      };
                      setActiveIdx(idx);
                    }}
                  />
                  <text
                    x={px + pw / 2} y={py + ph / 2}
                    textAnchor="middle" dominantBaseline="central"
                    transform={vertical ? `rotate(-90 ${px + pw / 2} ${py + ph / 2})` : undefined}
                    style={{ font: `400 11px ${FONT}`, fill: INK, pointerEvents: "none", userSelect: "none" }}
                  >
                    {f.name}
                  </text>
                  <g style={{ cursor: "pointer" }} onPointerDown={(e) => { e.preventDefault(); rotate(idx); }}>
                    <rect x={px + pw - 14} y={py + 1} width={16} height={16} fill="transparent" />
                    <rect
                      x={px + pw - 9.5} y={py + 4.5} width={7} height={7}
                      fill={INK} stroke="#ffffff" strokeWidth={1.5}
                    />
                  </g>
                </g>
              );
            })}

            <g
              style={{ cursor: "ns-resize" }}
              onPointerDown={(e) => { e.preventDefault(); dragRef.current = { type: "vent", moved: false }; }}
            >
              <rect x={0} y={(ventY - VENT_W / 2) * SCALE - 8} width={18} height={VENT_W * SCALE + 16} fill="transparent" />
              <line
                x1={2} x2={2} y1={(ventY - VENT_W / 2) * SCALE} y2={(ventY + VENT_W / 2) * SCALE}
                stroke={SUPPLY} strokeWidth={4}
              />
              <circle cx={8} cy={ventY * SCALE} r={3.5} fill={SUPPLY} stroke="#ffffff" strokeWidth={1.5} />
            </g>

            <g
              style={{ cursor: "ns-resize" }}
              onPointerDown={(e) => { e.preventDefault(); dragRef.current = { type: "exh", moved: false }; }}
            >
              <rect x={CW - 18} y={(exhY - VENT_W / 2) * SCALE - 8} width={18} height={VENT_W * SCALE + 16} fill="transparent" />
              <line
                x1={CW - 2} x2={CW - 2} y1={(exhY - VENT_W / 2) * SCALE} y2={(exhY + VENT_W / 2) * SCALE}
                stroke={EXHAUST} strokeWidth={4}
              />
              <circle cx={CW - 8} cy={exhY * SCALE} r={3.5} fill={EXHAUST} stroke="#ffffff" strokeWidth={1.5} />
            </g>
          </svg>
        </div>

        <div style={{ borderLeft: `1px solid ${HAIR}`, paddingLeft: 12, flex: "0 0 auto" }}>
          <SnapshotStrip
            React={React} items={snaps} bestId={bestId} selectedId={selSnap}
            onSelect={restore} height={CH}
          />
        </div>
      </div>
    </div>
  );
}