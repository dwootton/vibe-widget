export default function Widget({ model, React }) {
  // ---------------------------------------------------------------- constants
  const ROOM_W = 8, ROOM_D = 5;
  const NX = 96, NY = 60;
  const DX = ROOM_W / NX;               // ~0.0833 m
  const CANVAS_H = 600;
  const SCALE = CANVAS_H / ROOM_D;      // px per metre -> 120
  const CANVAS_W = Math.round(ROOM_W * SCALE); // 960
  const VENT_W = 0.6;
  const N_TRACERS = 400;
  const MAX_SNAPS = 8;

  // ---------------------------------------------------------------- viridis
  const viridis = React.useMemo(() => {
    const stops = [
      [68, 1, 84], [71, 44, 122], [59, 81, 139], [44, 113, 142],
      [33, 144, 141], [39, 173, 129], [92, 200, 99], [170, 220, 50],
      [253, 231, 37]
    ];
    const lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255 * (stops.length - 1);
      const i0 = Math.floor(t), i1 = Math.min(stops.length - 1, i0 + 1);
      const f = t - i0;
      for (let c = 0; c < 3; c++) {
        lut[i * 3 + c] = Math.round(stops[i0][c] * (1 - f) + stops[i1][c] * f);
      }
    }
    return lut;
  }, []);

  const viridisCss = React.useCallback((t) => {
    const i = Math.max(0, Math.min(255, Math.round(t * 255)));
    return `rgb(${viridis[i * 3]},${viridis[i * 3 + 1]},${viridis[i * 3 + 2]})`;
  }, [viridis]);

  // ---------------------------------------------------------------- input data
  const rawData = model.get("data");
  const parseData = React.useCallback((d) => {
    let rows = d;
    if (!rows) rows = [];
    if (!Array.isArray(rows)) {
      // possible dict-of-columns
      if (rows && rows.name && Array.isArray(rows.name)) {
        rows = rows.name.map((n, i) => ({
          name: n, x: rows.x[i], y: rows.y[i], w: rows.w[i], h: rows.h[i]
        }));
      } else rows = [];
    }
    return rows.map((r, i) => ({
      id: `f${i}`,
      name: String(r.name ?? `item ${i}`),
      x: +r.x, y: +r.y, w: +r.w, h: +r.h, rot: 0
    })).filter(r => isFinite(r.x) && isFinite(r.y) && isFinite(r.w) && isFinite(r.h));
  }, []);

  const [furniture, setFurniture] = React.useState(() => parseData(rawData));
  const [fan, setFan] = React.useState(0.8);
  const [threshold, setThreshold] = React.useState(0.05);
  const [ventY, setVentY] = React.useState(1.6);
  const [exhaustY, setExhaustY] = React.useState(3.4);
  const [stalePct, setStalePct] = React.useState(0);
  const [snapshots, setSnapshots] = React.useState([]);
  const [hoverName, setHoverName] = React.useState(null);
  const [showParticles, setShowParticles] = React.useState(true);

  // live refs used by the animation loop / gestures
  const furnRef = React.useRef(furniture);
  const fanRef = React.useRef(fan);
  const thrRef = React.useRef(threshold);
  const ventRef = React.useRef(ventY);
  const exhRef = React.useRef(exhaustY);
  const partsOnRef = React.useRef(showParticles);
  const hoverRef = React.useRef(null);
  const dragRef = React.useRef(null);

  React.useEffect(() => { furnRef.current = furniture; }, [furniture]);
  React.useEffect(() => { fanRef.current = fan; }, [fan]);
  React.useEffect(() => { thrRef.current = threshold; }, [threshold]);
  React.useEffect(() => { ventRef.current = ventY; }, [ventY]);
  React.useEffect(() => { exhRef.current = exhaustY; }, [exhaustY]);
  React.useEffect(() => { partsOnRef.current = showParticles; }, [showParticles]);

  const canvasRef = React.useRef(null);
  const simRef = React.useRef(null);
  const maskDirtyRef = React.useRef(true);
  const stalePctRef = React.useRef(0);

  // ---------------------------------------------------------------- geometry helpers
  const footprint = React.useCallback((f) => {
    const w = f.rot % 2 === 0 ? f.w : f.h;
    const h = f.rot % 2 === 0 ? f.h : f.w;
    return { w, h, x0: f.x - w / 2, y0: f.y - h / 2, x1: f.x + w / 2, y1: f.y + h / 2 };
  }, []);

  const clampToRoom = React.useCallback((f) => {
    const fp = footprint(f);
    const x = Math.min(Math.max(f.x, fp.w / 2), ROOM_W - fp.w / 2);
    const y = Math.min(Math.max(f.y, fp.h / 2), ROOM_D - fp.h / 2);
    return { ...f, x, y };
  }, [footprint]);

  // ---------------------------------------------------------------- solver setup
  React.useEffect(() => {
    const n = NX * NY;
    simRef.current = {
      u: new Float32Array(n), v: new Float32Array(n),
      u0: new Float32Array(n), v0: new Float32Array(n),
      p: new Float32Array(n), div: new Float32Array(n),
      solid: new Uint8Array(n),
      speed: new Float32Array(n),
      px: new Float32Array(N_TRACERS), py: new Float32Array(N_TRACERS),
      plife: new Float32Array(N_TRACERS)
    };
    const s = simRef.current;
    for (let i = 0; i < N_TRACERS; i++) {
      s.px[i] = 0.05 + Math.random() * 0.2;
      s.py[i] = Math.random() * ROOM_D;
      s.plife[i] = Math.random() * 6;
    }
    maskDirtyRef.current = true;
    return () => { simRef.current = null; };
  }, []);

  // ---------------------------------------------------------------- outputs
  const arrangementOf = React.useCallback((list) => list.map(f => {
    const fp = footprint(f);
    return { name: f.name, x: +f.x.toFixed(3), y: +f.y.toFixed(3), w: +fp.w.toFixed(3), h: +fp.h.toFixed(3) };
  }), [footprint]);

  React.useEffect(() => {
    model.set("arrangement", arrangementOf(furniture));
    model.set("stale_pct", 0);
    model.save_changes();
    // eslint-disable-next-line
  }, []);

  React.useEffect(() => {
    model.set("arrangement", arrangementOf(furniture));
    model.save_changes();
  }, [furniture, arrangementOf, model]);

  // push stale pct at a slow cadence
  React.useEffect(() => {
    const id = setInterval(() => {
      const v = +stalePctRef.current.toFixed(1);
      setStalePct(v);
      model.set("stale_pct", v);
      model.save_changes();
    }, 600);
    return () => clearInterval(id);
  }, [model]);

  // input trait subscription
  React.useEffect(() => {
    const handler = () => {
      const next = parseData(model.get("data"));
      setFurniture(next);
      maskDirtyRef.current = true;
    };
    model.on("change:data", handler);
    return () => model.off("change:data", handler);
  }, [model, parseData]);

  // ---------------------------------------------------------------- mask build
  const buildMask = React.useCallback(() => {
    const s = simRef.current; if (!s) return;
    const solid = s.solid;
    solid.fill(0);
    const list = furnRef.current;
    for (const f of list) {
      const fp = footprint(f);
      const i0 = Math.max(0, Math.floor(fp.x0 / DX));
      const i1 = Math.min(NX - 1, Math.ceil(fp.x1 / DX) - 1);
      const j0 = Math.max(0, Math.floor(fp.y0 / DX));
      const j1 = Math.min(NY - 1, Math.ceil(fp.y1 / DX) - 1);
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) solid[j * NX + i] = 1;
    }
    // zero velocity inside solids only (do not reset the field)
    for (let k = 0; k < solid.length; k++) if (solid[k]) { s.u[k] = 0; s.v[k] = 0; }
  }, [footprint]);

  // ---------------------------------------------------------------- the simulation + render loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext("2d");

    // offscreen heat buffer
    const heat = document.createElement("canvas");
    heat.width = NX; heat.height = NY;
    const hctx = heat.getContext("2d");
    const img = hctx.createImageData(NX, NY);

    // hatch pattern for stale cells
    const hatch = document.createElement("canvas");
    hatch.width = 8; hatch.height = 8;
    const hc = hatch.getContext("2d");
    hc.strokeStyle = "rgba(253,251,247,0.55)";
    hc.lineWidth = 1;
    hc.beginPath(); hc.moveTo(0, 8); hc.lineTo(8, 0);
    hc.moveTo(-2, 2); hc.lineTo(2, -2); hc.moveTo(6, 10); hc.lineTo(10, 6);
    hc.stroke();
    const hatchPat = ctx.createPattern(hatch, "repeat");

    let raf = 0, last = performance.now(), acc = 0;
    const STEP = 1 / 30;
    let stopped = false;

    const idx = (i, j) => j * NX + i;

    function setBoundary(field, comp) {
      const s = simRef.current;
      const solid = s.solid;
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const k = idx(i, j);
          if (solid[k]) { field[k] = 0; continue; }
        }
      }
      // walls: no-slip
      for (let i = 0; i < NX; i++) { field[idx(i, 0)] = 0; field[idx(i, NY - 1)] = 0; }
      for (let j = 0; j < NY; j++) { field[idx(0, j)] = 0; field[idx(NX - 1, j)] = 0; }
      // inflow at vent (left wall)
      const vy = ventRef.current;
      const j0 = Math.max(1, Math.floor((vy - VENT_W / 2) / DX));
      const j1 = Math.min(NY - 2, Math.ceil((vy + VENT_W / 2) / DX));
      for (let j = j0; j <= j1; j++) {
        if (comp === "u") { field[idx(0, j)] = fanRef.current; field[idx(1, j)] = fanRef.current; }
        else { field[idx(0, j)] = 0; }
      }
      // outflow at exhaust (right wall) — copy interior
      const ey = exhRef.current;
      const e0 = Math.max(1, Math.floor((ey - VENT_W / 2) / DX));
      const e1 = Math.min(NY - 2, Math.ceil((ey + VENT_W / 2) / DX));
      for (let j = e0; j <= e1; j++) {
        field[idx(NX - 1, j)] = field[idx(NX - 2, j)];
      }
    }

    function advect(dst, src, u, v, dt) {
      const s = simRef.current, solid = s.solid;
      const hdt = dt / DX;
      for (let j = 1; j < NY - 1; j++) {
        for (let i = 1; i < NX - 1; i++) {
          const k = idx(i, j);
          if (solid[k]) { dst[k] = 0; continue; }
          let x = i - hdt * u[k];
          let y = j - hdt * v[k];
          if (x < 0.5) x = 0.5; if (x > NX - 1.5) x = NX - 1.5;
          if (y < 0.5) y = 0.5; if (y > NY - 1.5) y = NY - 1.5;
          const i0 = Math.floor(x), j0 = Math.floor(y);
          const fx = x - i0, fy = y - j0;
          const a = src[idx(i0, j0)], b = src[idx(i0 + 1, j0)];
          const c = src[idx(i0, j0 + 1)], d = src[idx(i0 + 1, j0 + 1)];
          dst[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        }
      }
    }

    function diffuse(field, tmp, visc) {
      const s = simRef.current, solid = s.solid;
      const a = visc;
      const denom = 1 + 4 * a;
      tmp.set(field);
      for (let it = 0; it < 2; it++) {
        for (let j = 1; j < NY - 1; j++) {
          for (let i = 1; i < NX - 1; i++) {
            const k = idx(i, j);
            if (solid[k]) continue;
            const l = solid[k - 1] ? field[k] : field[k - 1];
            const r = solid[k + 1] ? field[k] : field[k + 1];
            const up = solid[k - NX] ? field[k] : field[k - NX];
            const dn = solid[k + NX] ? field[k] : field[k + NX];
            field[k] = (tmp[k] + a * (l + r + up + dn)) / denom;
          }
        }
      }
    }

    function project(iters) {
      const s = simRef.current, solid = s.solid;
      const { u, v, p, div } = s;
      p.fill(0);
      for (let j = 1; j < NY - 1; j++) {
        for (let i = 1; i < NX - 1; i++) {
          const k = idx(i, j);
          if (solid[k]) { div[k] = 0; continue; }
          const ur = solid[k + 1] ? 0 : u[k + 1];
          const ul = solid[k - 1] ? 0 : u[k - 1];
          const vd = solid[k + NX] ? 0 : v[k + NX];
          const vu = solid[k - NX] ? 0 : v[k - NX];
          div[k] = -0.5 * DX * (ur - ul + vd - vu);
        }
      }
      const ey = exhRef.current;
      const e0 = Math.max(1, Math.floor((ey - VENT_W / 2) / DX));
      const e1 = Math.min(NY - 2, Math.ceil((ey + VENT_W / 2) / DX));
      for (let it = 0; it < iters; it++) {
        for (let j = 1; j < NY - 1; j++) {
          for (let i = 1; i < NX - 1; i++) {
            const k = idx(i, j);
            if (solid[k]) continue;
            let sum = 0, cnt = 0;
            if (!solid[k - 1]) { sum += p[k - 1]; cnt++; }
            if (!solid[k + 1]) { sum += p[k + 1]; cnt++; }
            if (!solid[k - NX]) { sum += p[k - NX]; cnt++; }
            if (!solid[k + NX]) { sum += p[k + NX]; cnt++; }
            if (cnt === 0) { p[k] = 0; continue; }
            p[k] = (div[k] + sum) / cnt;
          }
        }
        // pressure outlet: p = 0 at exhaust
        for (let j = e0; j <= e1; j++) { p[idx(NX - 1, j)] = 0; p[idx(NX - 2, j)] *= 0.5; }
      }
      for (let j = 1; j < NY - 1; j++) {
        for (let i = 1; i < NX - 1; i++) {
          const k = idx(i, j);
          if (solid[k]) continue;
          const pr = solid[k + 1] ? p[k] : p[k + 1];
          const pl = solid[k - 1] ? p[k] : p[k - 1];
          const pd = solid[k + NX] ? p[k] : p[k + NX];
          const pu = solid[k - NX] ? p[k] : p[k - NX];
          u[k] -= 0.5 * (pr - pl) / DX;
          v[k] -= 0.5 * (pd - pu) / DX;
        }
      }
    }

    function sampleVel(x, y) {
      const s = simRef.current;
      let gx = x / DX - 0.5, gy = y / DX - 0.5;
      if (gx < 0) gx = 0; if (gx > NX - 1.001) gx = NX - 1.001;
      if (gy < 0) gy = 0; if (gy > NY - 1.001) gy = NY - 1.001;
      const i0 = Math.floor(gx), j0 = Math.floor(gy);
      const fx = gx - i0, fy = gy - j0;
      const k00 = idx(i0, j0), k10 = idx(i0 + 1, j0), k01 = idx(i0, j0 + 1), k11 = idx(i0 + 1, j0 + 1);
      const bu = (s.u[k00] * (1 - fx) + s.u[k10] * fx) * (1 - fy) + (s.u[k01] * (1 - fx) + s.u[k11] * fx) * fy;
      const bv = (s.v[k00] * (1 - fx) + s.v[k10] * fx) * (1 - fy) + (s.v[k01] * (1 - fx) + s.v[k11] * fx) * fy;
      return [bu, bv];
    }

    function respawn(i) {
      const s = simRef.current;
      s.px[i] = 0.04 + Math.random() * 0.06;
      s.py[i] = ventRef.current + (Math.random() - 0.5) * VENT_W * 0.95;
      s.plife[i] = 0;
    }

    function stepParticles(dt) {
      const s = simRef.current, solid = s.solid;
      for (let i = 0; i < N_TRACERS; i++) {
        const [pu, pv] = sampleVel(s.px[i], s.py[i]);
        let nx = s.px[i] + pu * dt;
        let ny = s.py[i] + pv * dt;
        s.plife[i] += dt;
        const gi = Math.min(NX - 1, Math.max(0, Math.floor(nx / DX)));
        const gj = Math.min(NY - 1, Math.max(0, Math.floor(ny / DX)));
        const inSolid = solid[idx(gi, gj)] === 1;
        const spd = Math.hypot(pu, pv);
        if (inSolid || nx < 0.01 || nx > ROOM_W - 0.01 || ny < 0.01 || ny > ROOM_D - 0.01
          || s.plife[i] > 26 || (spd < 0.004 && s.plife[i] > 5)) {
          respawn(i);
        } else { s.px[i] = nx; s.py[i] = ny; }
      }
    }

    function simulate(dt) {
      const s = simRef.current; if (!s) return;
      if (maskDirtyRef.current) { buildMask(); maskDirtyRef.current = false; }
      const { u, v, u0, v0 } = s;
      setBoundary(u, "u"); setBoundary(v, "v");
      u0.set(u); v0.set(v);
      advect(u, u0, u0, v0, dt);
      advect(v, v0, u0, v0, dt);
      setBoundary(u, "u"); setBoundary(v, "v");
      diffuse(u, u0, 0.06); diffuse(v, v0, 0.06);
      setBoundary(u, "u"); setBoundary(v, "v");
      project(24);
      setBoundary(u, "u"); setBoundary(v, "v");
      // damping to keep it stable
      for (let k = 0; k < u.length; k++) { u[k] *= 0.999; v[k] *= 0.999; }
      // speed field + stale fraction
      let stale = 0, free = 0;
      const thr = thrRef.current;
      for (let k = 0; k < u.length; k++) {
        const sp = Math.hypot(u[k], v[k]);
        s.speed[k] = sp;
        if (!s.solid[k]) { free++; if (sp < thr) stale++; }
      }
      stalePctRef.current = free ? (stale / free) * 100 : 0;
      stepParticles(dt);
    }

    function drawHeat() {
      const s = simRef.current;
      const vmax = Math.max(0.25, fanRef.current * 1.15);
      const thr = thrRef.current;
      const d = img.data;
      for (let k = 0; k < NX * NY; k++) {
        const o = k * 4;
        if (s.solid[k]) { d[o] = 236; d[o + 1] = 231; d[o + 2] = 222; d[o + 3] = 255; continue; }
        let t = s.speed[k] / vmax;
        if (t > 1) t = 1; if (t < 0) t = 0;
        t = Math.sqrt(t);
        const ci = Math.round(t * 255) * 3;
        d[o] = viridis[ci]; d[o + 1] = viridis[ci + 1]; d[o + 2] = viridis[ci + 2];
        d[o + 3] = 255;
      }
      hctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heat, 0, 0, CANVAS_W, CANVAS_H);
      // stale hatch overlay
      ctx.save();
      ctx.beginPath();
      const cw = CANVAS_W / NX, ch = CANVAS_H / NY;
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const k = idx(i, j);
          if (s.solid[k]) continue;
          if (s.speed[k] < thr) ctx.rect(i * cw, j * ch, cw + 0.6, ch + 0.6);
        }
      }
      ctx.fillStyle = hatchPat;
      ctx.fill();
      ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }

    function drawParticles() {
      const s = simRef.current;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < N_TRACERS; i++) {
        const [pu, pv] = sampleVel(s.px[i], s.py[i]);
        const sp = Math.hypot(pu, pv);
        const x = s.px[i] * SCALE, y = s.py[i] * SCALE;
        const len = Math.min(16, 4 + sp * 22);
        const a = Math.min(0.95, 0.25 + sp * 1.4);
        const nx = sp > 1e-5 ? pu / sp : 0, ny = sp > 1e-5 ? pv / sp : 0;
        ctx.strokeStyle = `rgba(253,251,247,${a})`;
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(x - nx * len, y - ny * len);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFurniture() {
      const list = furnRef.current;
      ctx.save();
      ctx.font = "600 13px 'Fira Code', ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const f of list) {
        const fp = footprint(f);
        const x = fp.x0 * SCALE, y = fp.y0 * SCALE, w = fp.w * SCALE, h = fp.h * SCALE;
        const active = hoverRef.current === f.id || (dragRef.current && dragRef.current.id === f.id);
        ctx.shadowColor = "rgba(20,18,15,0.35)";
        ctx.shadowBlur = active ? 22 : 10;
        ctx.shadowOffsetY = 3;
        roundRect(ctx, x, y, w, h, 10);
        ctx.fillStyle = active ? "rgba(253,251,247,0.97)" : "rgba(247,243,235,0.92)";
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.lineWidth = active ? 2.4 : 1.4;
        ctx.strokeStyle = active ? "#c2410c" : "#3f3a33";
        ctx.stroke();
        // label
        ctx.fillStyle = "#26221c";
        const label = f.name;
        const tw = ctx.measureText(label).width;
        if (tw < w - 8 && h > 18) {
          ctx.fillText(label, x + w / 2, y + h / 2);
        } else if (h > w && w > 18) {
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.font = "600 10px 'Fira Code', ui-monospace, monospace";
          ctx.fillText(label, x + w / 2, y + h / 2);
          ctx.font = "600 13px 'Fira Code', ui-monospace, monospace";
        }
        // rotate handle (top-right corner)
        const hx = x + w - 9, hy = y + 9;
        ctx.beginPath();
        ctx.arc(hx, hy, 8, 0, Math.PI * 2);
        ctx.fillStyle = active ? "#c2410c" : "#6b625a";
        ctx.fill();
        ctx.strokeStyle = "#fdfbf7"; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(hx, hy, 4.2, -0.4, Math.PI * 1.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hx + 4.2, hy - 2.6);
        ctx.lineTo(hx + 5.6, hy + 1.2);
        ctx.lineTo(hx + 1.6, hy + 0.4);
        ctx.closePath();
        ctx.fillStyle = "#fdfbf7"; ctx.fill();
      }
      ctx.restore();
    }

    function drawVents() {
      const vy = ventRef.current * SCALE, ey = exhRef.current * SCALE;
      const hh = (VENT_W / 2) * SCALE;
      // supply
      ctx.save();
      ctx.fillStyle = "#2563eb";
      roundRect(ctx, 0, vy - hh, 13, hh * 2, 5); ctx.fill();
      ctx.strokeStyle = "rgba(253,251,247,0.85)"; ctx.lineWidth = 1.2;
      for (let i = 1; i <= 3; i++) {
        const yy = vy - hh + (hh * 2 * i) / 4;
        ctx.beginPath(); ctx.moveTo(2, yy); ctx.lineTo(11, yy); ctx.stroke();
      }
      // exhaust
      ctx.fillStyle = "#6b7280";
      roundRect(ctx, CANVAS_W - 13, ey - hh, 13, hh * 2, 5); ctx.fill();
      for (let i = 1; i <= 3; i++) {
        const yy = ey - hh + (hh * 2 * i) / 4;
        ctx.beginPath(); ctx.moveTo(CANVAS_W - 11, yy); ctx.lineTo(CANVAS_W - 2, yy); ctx.stroke();
      }
      // grip dots
      ctx.fillStyle = "rgba(253,251,247,0.9)";
      ctx.beginPath(); ctx.arc(6.5, vy, 2.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(CANVAS_W - 6.5, ey, 2.2, 0, 7); ctx.fill();
      ctx.restore();
    }

    function drawFrame() {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawHeat();
      if (partsOnRef.current) drawParticles();
      drawFurniture();
      drawVents();
      // room border
      ctx.strokeStyle = "#26221c";
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, CANVAS_W - 3, CANVAS_H - 3);
      ctx.restore();
    }

    const tick = (now) => {
      if (stopped) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 3) { simulate(STEP); acc -= STEP; guard++; }
      if (acc > STEP) acc = 0;
      drawFrame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [viridis, buildMask, footprint]);

  // ---------------------------------------------------------------- pointer interaction
  const toRoom = React.useCallback((e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const sx = CANVAS_W / r.width, sy = CANVAS_H / r.height;
    return [((e.clientX - r.left) * sx) / SCALE, ((e.clientY - r.top) * sy) / SCALE];
  }, []);

  const thumbOf = React.useCallback((list, thrVal) => {
    const s = simRef.current;
    const W = 120, H = Math.round(120 * ROOM_D / ROOM_W);
    const c = document.createElement("canvas");
    c.width = W * 2; c.height = H * 2;
    const g = c.getContext("2d");
    g.scale(2, 2);
    g.fillStyle = "#1f2430"; g.fillRect(0, 0, W, H);
    if (s) {
      const vmax = Math.max(0.25, fanRef.current * 1.15);
      const cw = W / NX, ch = H / NY;
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const k = j * NX + i;
          if (s.solid[k]) continue;
          let t = Math.sqrt(Math.min(1, s.speed[k] / vmax));
          const ci = Math.round(t * 255) * 3;
          g.fillStyle = `rgb(${viridis[ci]},${viridis[ci + 1]},${viridis[ci + 2]})`;
          g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
          if (s.speed[k] < thrVal) {
            g.fillStyle = "rgba(253,251,247,0.28)";
            g.fillRect(i * cw, j * ch, cw + 0.5, ch + 0.5);
          }
        }
      }
    }
    const kx = W / ROOM_W, ky = H / ROOM_D;
    for (const f of list) {
      const fp = footprint(f);
      g.fillStyle = "rgba(253,251,247,0.94)";
      g.strokeStyle = "#26221c"; g.lineWidth = 0.7;
      g.fillRect(fp.x0 * kx, fp.y0 * ky, fp.w * kx, fp.h * ky);
      g.strokeRect(fp.x0 * kx, fp.y0 * ky, fp.w * kx, fp.h * ky);
    }
    g.fillStyle = "#2563eb";
    g.fillRect(0, (ventRef.current - VENT_W / 2) * ky, 3, VENT_W * ky);
    g.fillStyle = "#9ca3af";
    g.fillRect(W - 3, (exhRef.current - VENT_W / 2) * ky, 3, VENT_W * ky);
    return c.toDataURL("image/png");
  }, [footprint, viridis]);

  const recordSnapshot = React.useCallback((list) => {
    const pct = +stalePctRef.current.toFixed(1);
    const url = thumbOf(list, thrRef.current);
    setSnapshots(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url, pct,
      layout: list.map(f => ({ ...f })),
      vent: ventRef.current, exhaust: exhRef.current,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    }, ...prev].slice(0, MAX_SNAPS));
  }, [thumbOf]);

  const overlaps = React.useCallback((cand, list) => {
    const a = footprint(cand);
    for (const o of list) {
      if (o.id === cand.id) continue;
      const b = footprint(o);
      if (a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6) return true;
    }
    return false;
  }, [footprint]);

  const onPointerDown = React.useCallback((e) => {
    const [mx, my] = toRoom(e);
    const list = furnRef.current;
    // vent handles
    const nearLeft = mx * SCALE < 20;
    const nearRight = (ROOM_W - mx) * SCALE < 20;
    if (nearLeft && Math.abs(my - ventRef.current) < VENT_W) {
      dragRef.current = { kind: "vent" };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    if (nearRight && Math.abs(my - exhRef.current) < VENT_W) {
      dragRef.current = { kind: "exhaust" };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i];
      const fp = footprint(f);
      const hx = fp.x1 - 9 / SCALE, hy = fp.y0 + 9 / SCALE;
      if (Math.hypot(mx - hx, my - hy) * SCALE < 13) {
        // rotate 90°
        const rotated = clampToRoom({ ...f, rot: (f.rot + 1) % 4 });
        if (!overlaps(rotated, list)) {
          const next = list.map(o => o.id === f.id ? rotated : o);
          furnRef.current = next;
          setFurniture(next);
          maskDirtyRef.current = true;
          setTimeout(() => recordSnapshot(next), 700);
        }
        return;
      }
      if (mx >= fp.x0 && mx <= fp.x1 && my >= fp.y0 && my <= fp.y1) {
        dragRef.current = { kind: "move", id: f.id, dx: mx - f.x, dy: my - f.y, moved: false };
        hoverRef.current = f.id;
        setHoverName(f.name);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        return;
      }
    }
  }, [toRoom, footprint, clampToRoom, overlaps, recordSnapshot]);

  const onPointerMove = React.useCallback((e) => {
    const [mx, my] = toRoom(e);
    const d = dragRef.current;
    if (!d) {
      const list = furnRef.current;
      let hit = null;
      for (let i = list.length - 1; i >= 0; i--) {
        const fp = footprint(list[i]);
        if (mx >= fp.x0 && mx <= fp.x1 && my >= fp.y0 && my <= fp.y1) { hit = list[i]; break; }
      }
      hoverRef.current = hit ? hit.id : null;
      setHoverName(hit ? hit.name : null);
      return;
    }
    if (d.kind === "vent") {
      const y = Math.min(ROOM_D - VENT_W / 2 - 0.1, Math.max(VENT_W / 2 + 0.1, my));
      ventRef.current = y; setVentY(y);
      return;
    }
    if (d.kind === "exhaust") {
      const y = Math.min(ROOM_D - VENT_W / 2 - 0.1, Math.max(VENT_W / 2 + 0.1, my));
      exhRef.current = y; setExhaustY(y);
      return;
    }
    if (d.kind === "move") {
      const list = furnRef.current;
      const f = list.find(o => o.id === d.id);
      if (!f) return;
      let cand = clampToRoom({ ...f, x: mx - d.dx, y: my - d.dy });
      if (overlaps(cand, list)) {
        // try axis-separated moves
        const tryX = clampToRoom({ ...f, x: mx - d.dx });
        const tryY = clampToRoom({ ...f, y: my - d.dy });
        if (!overlaps(tryX, list)) cand = tryX;
        else if (!overlaps(tryY, list)) cand = tryY;
        else return;
      }
      d.moved = true;
      const next = list.map(o => o.id === d.id ? cand : o);
      furnRef.current = next;
      setFurniture(next);
      maskDirtyRef.current = true;
    }
  }, [toRoom, footprint, clampToRoom, overlaps]);

  const onPointerUp = React.useCallback((e) => {
    const d = dragRef.current;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d && d.kind === "move" && d.moved) {
      const snap = furnRef.current.map(f => ({ ...f }));
      setTimeout(() => recordSnapshot(snap), 700);
    }
  }, [recordSnapshot]);

  const restore = React.useCallback((snap) => {
    furnRef.current = snap.layout.map(f => ({ ...f }));
    setFurniture(furnRef.current);
    ventRef.current = snap.vent; setVentY(snap.vent);
    exhRef.current = snap.exhaust; setExhaustY(snap.exhaust);
    maskDirtyRef.current = true;
  }, []);

  const resetLayout = React.useCallback(() => {
    const next = parseData(model.get("data"));
    furnRef.current = next;
    setFurniture(next);
    maskDirtyRef.current = true;
  }, [model, parseData]);

  const bestPct = snapshots.length ? Math.min(...snapshots.map(s => s.pct)) : null;

  // ---------------------------------------------------------------- UI
  return (
    <section style={{
      background: "#fdfbf7", color: "#26221c", padding: "26px 28px 30px",
      fontFamily: "'Fira Code', ui-monospace, SFMono-Regular, monospace",
      borderRadius: 4
    }}>
      <header style={{ maxWidth: 780, marginBottom: 20 }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
          color: "#8a7f70", marginBottom: 8
        }}>Chapter 04 · Room air</div>
        <h1 style={{
          fontFamily: "'Playfair Display', 'Tiempos Headline', Georgia, serif",
          fontWeight: 700, fontSize: 38, lineHeight: 1.05, margin: "0 0 10px",
          letterSpacing: "-0.015em", color: "#1b1813"
        }}>Where the air forgets to go</h1>
        <p style={{
          fontSize: 13.5, lineHeight: 1.65, margin: 0, color: "#4a443b",
          fontFamily: "'Fira Code', ui-monospace, monospace", maxWidth: 680
        }}>
          An 8 × 5 m room, seen from above. Cool air enters through the blue supply vent
          and leaves through the grey exhaust — drag either along its wall. Shove the
          furniture around; the solver never stops, it just re-masks. Every drop is
          archived on the right so you can compare the dead zones.
        </p>
      </header>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ---------------- plan ---------------- */}
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={(e) => { if (!dragRef.current) { hoverRef.current = null; setHoverName(null); } }}
            style={{
              width: CANVAS_W, height: CANVAS_H, display: "block",
              borderRadius: 3, touchAction: "none",
              boxShadow: "0 18px 46px -22px rgba(20,18,15,0.55)",
              cursor: dragRef.current ? "grabbing" : (hoverName ? "grab" : "default")
            }}
          />
          <StaleBadge React={React} pct={stalePct} threshold={threshold} />
          <div style={{
            position: "absolute", bottom: 12, right: 14, fontSize: 10.5,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(253,251,247,0.82)", textShadow: "0 1px 3px rgba(0,0,0,0.7)"
          }}>
            {hoverName ? `▸ ${hoverName}` : "96 × 60 grid · 30 fps · 24 gauss–seidel"}
          </div>
        </div>

        {/* ---------------- controls + legend ---------------- */}
        <div style={{ flex: "1 1 240px", minWidth: 250, maxWidth: 330 }}>
          <FanSlider React={React} value={fan} onChange={setFan} />

          <div style={{ height: 22 }} />

          <SpeedLegend
            React={React}
            threshold={threshold}
            onThreshold={setThreshold}
            vmax={Math.max(0.25, fan * 1.15)}
            colorAt={viridisCss}
          />

          <div style={{ height: 22 }} />

          <div style={{
            borderTop: "1px solid #e4ddd0", paddingTop: 14, display: "flex",
            flexDirection: "column", gap: 10
          }}>
            <ReadoutRow React={React} label="supply y" value={`${ventY.toFixed(2)} m`} />
            <ReadoutRow React={React} label="exhaust y" value={`${exhaustY.toFixed(2)} m`} />
            <ReadoutRow React={React} label="stale floor" value={`${stalePct.toFixed(1)} %`} />
            <ReadoutRow React={React} label="obstacles" value={`${furniture.length}`} />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <GhostButton React={React} onClick={resetLayout} label="reset layout" />
            <GhostButton
              React={React}
              onClick={() => setShowParticles(v => !v)}
              label={showParticles ? "hide tracers" : "show tracers"}
              active={showParticles}
            />
          </div>
        </div>

        {/* ---------------- snapshot strip ---------------- */}
        <SnapshotStrip
          React={React}
          snapshots={snapshots}
          bestPct={bestPct}
          onRestore={restore}
        />
      </div>
    </section>
  );
}

/* =============================== standalone parts =============================== */

export const StaleBadge = ({ React, pct = 0, threshold = 0.05 }) => (
  <div style={{
    position: "absolute", top: 14, left: 14,
    background: "rgba(253,251,247,0.94)", color: "#1b1813",
    border: "1px solid rgba(38,34,28,0.18)",
    borderRadius: 3, padding: "8px 12px",
    boxShadow: "0 8px 22px -12px rgba(20,18,15,0.7)",
    fontFamily: "'Fira Code', ui-monospace, monospace",
    transition: "all 800ms cubic-bezier(.22,.61,.36,1)"
  }}>
    <div style={{
      fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a7f70"
    }}>stale air</div>
    <div style={{
      fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24,
      fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.01em"
    }}>
      {pct.toFixed(0)} % <span style={{ fontSize: 12, fontWeight: 400, color: "#4a443b" }}>of floor</span>
    </div>
    <div style={{ fontSize: 9.5, color: "#6b625a", marginTop: 2 }}>
      below {threshold.toFixed(3)} m/s
    </div>
  </div>
);

export const FanSlider = ({ React, value = 0.8, onChange = () => {} }) => (
  <div style={{ fontFamily: "'Fira Code', ui-monospace, monospace" }}>
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b625a"
    }}>
      <span>fan speed</span>
      <span style={{
        fontFamily: "'Playfair Display', Georgia, serif", fontSize: 19,
        color: "#1b1813", letterSpacing: 0
      }}>{value.toFixed(2)} <span style={{ fontSize: 11 }}>m/s</span></span>
    </div>
    <input
      type="range" min={0.2} max={1.5} step={0.01} value={value}
      onInput={(e) => onChange(+e.target.value)}
      onChange={(e) => onChange(+e.target.value)}
      style={{ width: "100%", marginTop: 8, accentColor: "#c2410c", height: 22 }}
    />
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#8a7f70" }}>
      <span>0.20</span><span>1.50</span>
    </div>
  </div>
);

export const SpeedLegend = ({ React, threshold = 0.05, onThreshold = () => {}, vmax = 0.92, colorAt }) => {
  const barRef = React.useRef(null);
  const dragging = React.useRef(false);
  const W = 100; // percent-based
  const fallback = (t) => `hsl(${260 - 200 * t},65%,${25 + 45 * t}%)`;
  const col = colorAt || fallback;

  const fromEvent = React.useCallback((e) => {
    const el = barRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    f = Math.max(0, Math.min(1, f));
    const t = f * f * vmax; // inverse of sqrt display mapping
    onThreshold(Math.max(0.005, Math.min(vmax * 0.9, t)));
  }, [onThreshold, vmax]);

  React.useEffect(() => {
    const move = (e) => { if (dragging.current) { e.preventDefault(); fromEvent(e); } };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [fromEvent]);

  const stops = [];
  for (let i = 0; i <= 10; i++) stops.push(`${col(i / 10)} ${i * 10}%`);
  const pos = Math.sqrt(Math.max(0, Math.min(1, threshold / vmax))) * 100;

  return (
    <div style={{ fontFamily: "'Fira Code', ui-monospace, monospace" }}>
      <div style={{
        fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "#6b625a", marginBottom: 8
      }}>speed · drag the stale line</div>
      <div
        ref={barRef}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); fromEvent(e); }}
        style={{
          position: "relative", height: 34, borderRadius: 3, cursor: "ew-resize",
          background: `linear-gradient(90deg, ${stops.join(",")})`,
          border: "1px solid rgba(38,34,28,0.25)", touchAction: "none"
        }}
      >
        <div style={{
          position: "absolute", left: `${pos}%`, top: -7, bottom: -7,
          width: 14, marginLeft: -7, cursor: "ew-resize"
        }}>
          <div style={{
            position: "absolute", left: 6, top: 0, bottom: 0, width: 2,
            background: "#fdfbf7", boxShadow: "0 0 0 1px rgba(20,18,15,0.75)"
          }} />
          <div style={{
            position: "absolute", left: 1, top: -8, width: 12, height: 12,
            background: "#c2410c", border: "1.5px solid #fdfbf7", borderRadius: 2,
            transform: "rotate(45deg)"
          }} />
        </div>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pos}%`,
          background: "repeating-linear-gradient(45deg, rgba(253,251,247,0.45) 0 2px, transparent 2px 5px)",
          borderRight: "1px solid rgba(253,251,247,0.6)", pointerEvents: "none"
        }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 6,
        fontSize: 9.5, color: "#6b625a"
      }}>
        <span>0</span>
        <span style={{ color: "#c2410c", fontWeight: 700 }}>
          threshold {threshold.toFixed(3)} m/s
        </span>
        <span>{vmax.toFixed(2)}</span>
      </div>
    </div>
  );
};

export const ReadoutRow = ({ React, label = "", value = "" }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    fontFamily: "'Fira Code', ui-monospace, monospace", fontSize: 11.5
  }}>
    <span style={{ color: "#6b625a", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10 }}>
      {label}
    </span>
    <span style={{ color: "#1b1813", fontWeight: 700 }}>{value}</span>
  </div>
);

export const GhostButton = ({ React, label = "", onClick = () => {}, active = false }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: "'Fira Code', ui-monospace, monospace",
        fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase",
        padding: "7px 12px", borderRadius: 2, cursor: "pointer",
        background: hov ? "#26221c" : (active ? "#efe8da" : "transparent"),
        color: hov ? "#fdfbf7" : "#26221c",
        border: "1px solid #26221c",
        transition: "background 300ms ease, color 300ms ease"
      }}
    >{label}</button>
  );
};

export const SnapshotStrip = ({ React, snapshots = [], bestPct = null, onRestore = () => {} }) => (
  <div style={{
    flex: "0 0 158px", width: 158, fontFamily: "'Fira Code', ui-monospace, monospace"
  }}>
    <div style={{
      fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase",
      color: "#6b625a", marginBottom: 10, borderBottom: "1px solid #e4ddd0", paddingBottom: 6
    }}>
      log · newest first
    </div>
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      maxHeight: 560, overflowY: "auto", paddingRight: 2
    }}>
      {snapshots.length === 0 && (
        <div style={{ fontSize: 11, color: "#8a7f70", lineHeight: 1.6 }}>
          Drop a piece of furniture to archive the layout here.
        </div>
      )}
      {snapshots.map((s) => {
        const best = bestPct != null && Math.abs(s.pct - bestPct) < 1e-9;
        return (
          <button
            key={s.id}
            onClick={() => onRestore(s)}
            title={`restore · ${s.pct.toFixed(1)} % stale`}
            style={{
              padding: 0, border: best ? "2px solid #c2410c" : "1px solid #d8d0c2",
              background: "#fdfbf7", borderRadius: 3, cursor: "pointer",
              textAlign: "left", overflow: "hidden", display: "block", width: "100%",
              boxShadow: "0 6px 16px -12px rgba(20,18,15,0.8)",
              transition: "transform 800ms cubic-bezier(.22,.61,.36,1)"
            }}
          >
            <img src={s.url} alt="" style={{ width: "100%", display: "block" }} />
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "5px 6px 6px"
            }}>
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 15, fontWeight: 700, color: "#1b1813"
              }}>{s.pct.toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: "#8a7f70" }}>
                {best ? "★ best" : s.time}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);