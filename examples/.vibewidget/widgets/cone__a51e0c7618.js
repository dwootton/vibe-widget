import * as L from "https://esm.sh/leaflet@1.9.4";
import * as d3 from "https://esm.sh/d3@7";

const INK = "#111111";
const GREY = "#777777";
const HAIR = "#d9d9d9";
const ACCENT = "#d9480f";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace";
const FONT = "system-ui, -apple-system, Inter, Helvetica, sans-serif";

const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const TILE_ATTR = "Esri, HERE, Garmin, OpenStreetMap contributors";

const ENCODINGS = ["cone", "spaghetti", "density", "hops", "bands"];

function haversineKm(lon1, lat1, lon2, lat2) {
  const R = 6371.0088;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function quantileSorted(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function ensureLeafletCss() {
  const id = "leaflet-css-1-9-4";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

/* ---------- derived ensemble model ---------- */

function buildEnsemble(rows) {
  const byMember = new Map();
  for (const r of rows) {
    const m = +r.member;
    if (!byMember.has(m)) byMember.set(m, []);
    byMember.get(m).push({ t: +r.t_h, lon: +r.lon, lat: +r.lat });
  }
  const members = [];
  for (const [id, pts] of [...byMember.entries()].sort((a, b) => a[0] - b[0])) {
    pts.sort((a, b) => a.t - b.t);
    members.push({ id, pts });
  }
  const times = [...new Set(rows.map((r) => +r.t_h))].sort((a, b) => a - b);

  // mean track + cone radius (67th pct of member distance from mean)
  const mean = times.map((t) => {
    let sx = 0,
      sy = 0,
      n = 0;
    for (const m of members) {
      const p = m.pts.find((q) => q.t === t);
      if (p) {
        sx += p.lon;
        sy += p.lat;
        n++;
      }
    }
    return { t, lon: sx / n, lat: sy / n };
  });
  const cone = mean.map((mu) => {
    const ds = [];
    for (const m of members) {
      const p = m.pts.find((q) => q.t === mu.t);
      if (p) ds.push(haversineKm(mu.lon, mu.lat, p.lon, p.lat));
    }
    ds.sort((a, b) => a - b);
    return { t: mu.t, r_km: quantileSorted(ds, 0.67) };
  });

  // split groups by end latitude
  const endNorth = new Map();
  for (const m of members) {
    const last = m.pts[m.pts.length - 1];
    endNorth.set(m.id, last.lat > 28);
  }

  const bandFor = (want) =>
    times.map((t) => {
      const lons = [];
      const lats = [];
      for (const m of members) {
        if (endNorth.get(m.id) !== want) continue;
        const p = m.pts.find((q) => q.t === t);
        if (p) {
          lons.push(p.lon);
          lats.push(p.lat);
        }
      }
      lons.sort((a, b) => a - b);
      lats.sort((a, b) => a - b);
      return {
        t,
        n: lons.length,
        lon50: [quantileSorted(lons, 0.25), quantileSorted(lons, 0.75)],
        lat50: [quantileSorted(lats, 0.25), quantileSorted(lats, 0.75)],
        lon90: [quantileSorted(lons, 0.05), quantileSorted(lons, 0.95)],
        lat90: [quantileSorted(lats, 0.05), quantileSorted(lats, 0.95)],
        lonMid: quantileSorted(lons, 0.5),
        latMid: quantileSorted(lats, 0.5),
      };
    });

  const bandsNorth = bandFor(true).filter((d) => d.n >= 3);
  const bandsSouth = bandFor(false).filter((d) => d.n >= 3);

  const posByTime = new Map(
    times.map((t) => [
      t,
      members
        .map((m) => {
          const p = m.pts.find((q) => q.t === t);
          return p ? { id: m.id, lon: p.lon, lat: p.lat } : null;
        })
        .filter(Boolean),
    ])
  );

  return {
    members,
    times,
    mean,
    cone,
    bandsNorth,
    bandsSouth,
    posByTime,
    endNorth,
  };
}

/* segment-aware min distance from point to a member polyline (great-circle approx via densify) */
function memberMinDistances(members, lon, lat) {
  const out = [];
  for (const m of members) {
    let best = Infinity;
    const pts = m.pts;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const d0 = haversineKm(lon, lat, a.lon, a.lat);
      if (d0 < best) best = d0;
      if (i < pts.length - 1) {
        const b = pts[i + 1];
        for (let k = 1; k < 5; k++) {
          const f = k / 5;
          const d = haversineKm(lon, lat, a.lon + (b.lon - a.lon) * f, a.lat + (b.lat - a.lat) * f);
          if (d < best) best = d;
        }
      }
    }
    out.push({ id: m.id, d: best });
  }
  return out;
}

/* cumulative first-approach distance by hour (min distance among points up to t) */
function cumulativeHit(members, times, lon, lat, radiusKm) {
  const perMemberByT = members.map((m) => {
    let run = Infinity;
    const arr = [];
    for (let i = 0; i < m.pts.length; i++) {
      const a = m.pts[i];
      let d = haversineKm(lon, lat, a.lon, a.lat);
      if (i > 0) {
        const p = m.pts[i - 1];
        for (let k = 1; k < 5; k++) {
          const f = k / 5;
          const dd = haversineKm(lon, lat, p.lon + (a.lon - p.lon) * f, p.lat + (a.lat - p.lat) * f);
          if (dd < d) d = dd;
        }
      }
      run = Math.min(run, d);
      arr.push({ t: a.t, minD: run });
    }
    return arr;
  });
  return times.map((t) => {
    let hit = 0;
    for (const arr of perMemberByT) {
      const rec = arr.find((r) => r.t === t);
      if (rec && rec.minD <= radiusKm) hit++;
    }
    return { t, p: hit / Math.max(1, members.length) };
  });
}

/* ---------- standalone components ---------- */

export const EncodingSwitch = ({ React, value, options = ENCODINGS, onChange }) => (
  <div style={{ display: "flex", gap: 0 }}>
    {options.map((o) => {
      const active = o === value;
      return (
        <button
          key={o}
          onClick={() => onChange && onChange(o)}
          style={{
            font: `400 12px ${FONT}`,
            color: active ? "#ffffff" : INK,
            background: active ? INK : "transparent",
            border: `1px solid ${active ? INK : HAIR}`,
            marginLeft: -1,
            padding: "4px 9px",
            cursor: "pointer",
            borderRadius: 0,
            transition: "none",
          }}
        >
          {o}
        </button>
      );
    })}
  </div>
);

export const ValueRow = ({ React, label, value, emphasis = false }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 12,
      borderBottom: `1px solid ${HAIR}`,
      padding: "5px 0",
    }}
  >
    <span style={{ font: `400 11px ${FONT}`, color: GREY }}>{label}</span>
    <span
      style={{
        font: `${emphasis ? 600 : 400} 13px ${MONO}`,
        color: emphasis ? ACCENT : INK,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  </div>
);

export const StripChart = ({ React, series = [], width = 640, height = 92, marker = null, radiusKm = 80 }) => {
  const ref = React.useRef(null);
  const markRef = React.useRef(null);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const m = { top: 10, right: 10, bottom: 20, left: 34 };
    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block");
    const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
    const iw = width - m.left - m.right;
    const ih = height - m.top - m.bottom;

    const x = d3.scaleLinear().domain([0, 120]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

    g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickValues([0, 24, 48, 72, 96, 120]).tickSize(3))
      .call((s) => {
        s.select(".domain").attr("stroke", HAIR);
        s.selectAll("line").attr("stroke", HAIR);
        s.selectAll("text").attr("fill", INK).style("font", `400 10px ${MONO}`);
      });

    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .tickValues([0, 0.5, 1])
          .tickFormat(d3.format(".0%"))
          .tickSize(3)
      )
      .call((s) => {
        s.select(".domain").attr("stroke", HAIR);
        s.selectAll("line").attr("stroke", HAIR);
        s.selectAll("text").attr("fill", INK).style("font", `400 10px ${MONO}`);
      });

    g.append("line")
      .attr("x1", 0)
      .attr("x2", iw)
      .attr("y1", y(0.5))
      .attr("y2", y(0.5))
      .attr("stroke", HAIR)
      .attr("stroke-width", 1);

    const area = d3
      .area()
      .x((d) => x(d.t))
      .y0(y(0))
      .y1((d) => y(d.p));
    const line = d3
      .line()
      .x((d) => x(d.t))
      .y((d) => y(d.p));

    g.append("path").datum(series).attr("fill", ACCENT).attr("fill-opacity", 0.12).attr("d", area);
    g.append("path")
      .datum(series)
      .attr("fill", "none")
      .attr("stroke", ACCENT)
      .attr("stroke-width", 1.5)
      .attr("d", line);

    const mk = g
      .append("line")
      .attr("y1", 0)
      .attr("y2", ih)
      .attr("stroke", INK)
      .attr("stroke-width", 1)
      .style("display", "none");
    markRef.current = { mk, x };

    return () => {
      markRef.current = null;
      svg.remove();
    };
  }, [series, width, height, radiusKm]);

  React.useEffect(() => {
    const st = markRef.current;
    if (!st) return;
    if (marker == null) st.mk.style("display", "none");
    else st.mk.style("display", null).attr("x1", st.x(marker)).attr("x2", st.x(marker));
  }, [marker, series, width, height]);

  return <div ref={ref} />;
};

export const TimeSlider = ({ React, t, times = [], playing, onT, onToggle }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <button
      onClick={onToggle}
      style={{
        width: 26,
        height: 22,
        border: `1px solid ${playing ? INK : HAIR}`,
        background: playing ? INK : "transparent",
        color: playing ? "#fff" : INK,
        cursor: "pointer",
        borderRadius: 0,
        font: `400 11px ${FONT}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      <svg width="9" height="9" viewBox="0 0 9 9">
        {playing ? (
          <g fill={playing ? "#fff" : INK}>
            <rect x="1" y="1" width="2.6" height="7" />
            <rect x="5.4" y="1" width="2.6" height="7" />
          </g>
        ) : (
          <path d="M1 0.8 L8 4.5 L1 8.2 Z" fill={INK} />
        )}
      </svg>
    </button>
    <input
      type="range"
      min={0}
      max={120}
      step={5}
      value={t}
      onChange={(e) => onT && onT(+e.target.value)}
      style={{ flex: 1, accentColor: INK, height: 18 }}
    />
    <span
      style={{
        font: `400 12px ${MONO}`,
        color: INK,
        fontVariantNumeric: "tabular-nums",
        minWidth: 42,
        textAlign: "right",
      }}
    >
      {String(t).padStart(3, " ")} h
    </span>
  </div>
);

/* ---------- main widget ---------- */

export default function Widget({ model, React }) {
  const rows = model.get("data") || [];
  const [townRows, setTownRows] = React.useState(() => model.get("towns") || []);
  const [rowsState, setRowsState] = React.useState(rows);

  const [encoding, setEncoding] = React.useState("cone");
  const [t, setT] = React.useState(48);
  const [playing, setPlaying] = React.useState(false);
  const [town, setTown] = React.useState({ lon: -95.37, lat: 29.76 });
  const [radiusKm, setRadiusKm] = React.useState(80);
  const [hopMember, setHopMember] = React.useState(null);
  const [mapW, setMapW] = React.useState(680);

  const mapHostRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const layersRef = React.useRef({});
  const townRef = React.useRef(town);
  const radiusRef = React.useRef(radiusKm);

  React.useEffect(() => {
    const onData = () => setRowsState(model.get("data") || []);
    const onTowns = () => setTownRows(model.get("towns") || []);
    model.on("change:data", onData);
    model.on("change:towns", onTowns);
    return () => {
      model.off("change:data", onData);
      model.off("change:towns", onTowns);
    };
  }, [model]);

  const ens = React.useMemo(() => buildEnsemble(rowsState || []), [rowsState]);

  /* hit stats */
  const hitStats = React.useMemo(() => {
    if (!ens.members.length) return { p_hit: 0, cum: [], inCone: 0 };
    const dists = memberMinDistances(ens.members, town.lon, town.lat);
    const p_hit = dists.filter((d) => d.d <= radiusKm).length / ens.members.length;
    const cum = cumulativeHit(ens.members, ens.times, town.lon, town.lat, radiusKm);
    // members inside cone at 96h
    const mu = ens.mean.find((m) => m.t === 96);
    const cr = ens.cone.find((c) => c.t === 96);
    let inCone = 0;
    if (mu && cr) {
      const pos = ens.posByTime.get(96) || [];
      inCone =
        pos.filter((p) => haversineKm(mu.lon, mu.lat, p.lon, p.lat) <= cr.r_km).length /
        Math.max(1, pos.length);
    }
    return { p_hit, cum, inCone };
  }, [ens, town, radiusKm]);

  /* outputs */
  React.useEffect(() => {
    model.set({
      encoding,
      town: { lon: +town.lon.toFixed(4), lat: +town.lat.toFixed(4) },
      radius_km: Math.round(radiusKm),
      p_hit: +hitStats.p_hit.toFixed(4),
    });
    model.save_changes();
  }, [model, encoding, town, radiusKm, hitStats.p_hit]);

  /* width observer */
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 200) setMapW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* play */
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((prev) => (prev >= 120 ? 0 : prev + 5));
    }, 260);
    return () => clearInterval(id);
  }, [playing]);

  /* hops timer */
  React.useEffect(() => {
    if (encoding !== "hops" || !ens.members.length) {
      setHopMember(null);
      return;
    }
    const pick = () => setHopMember(ens.members[Math.floor(Math.random() * ens.members.length)].id);
    pick();
    const id = setInterval(pick, 500);
    return () => clearInterval(id);
  }, [encoding, ens]);

  /* ---- map creation: depends only on nothing mutable by pointer ---- */
  React.useEffect(() => {
    ensureLeafletCss();
    const host = mapHostRef.current;
    if (!host) return;
    const map = L.map(host, {
      center: [27, -90],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    L.tileLayer(TILE_URL, { maxZoom: 16, attribution: TILE_ATTR }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.attributionControl.setPrefix("");

    const panes = {};
    ["dens", "ens", "cone", "dots", "town"].forEach((name, i) => {
      const p = map.createPane(name);
      p.style.zIndex = 400 + i * 10;
      panes[name] = p;
    });

    const encGroup = L.layerGroup().addTo(map);
    const dotGroup = L.layerGroup().addTo(map);
    const townGroup = L.layerGroup().addTo(map);
    const pinGroup = L.layerGroup().addTo(map);

    // density canvas overlay
    const densCanvas = document.createElement("canvas");
    densCanvas.style.position = "absolute";
    densCanvas.style.pointerEvents = "none";
    densCanvas.style.left = "0";
    densCanvas.style.top = "0";
    panes.dens.appendChild(densCanvas);

    layersRef.current = { map, encGroup, dotGroup, townGroup, pinGroup, densCanvas, panes };

    const invalidate = setTimeout(() => map.invalidateSize(), 60);

    return () => {
      clearTimeout(invalidate);
      layersRef.current = {};
      map.remove();
    };
  }, []);

  React.useEffect(() => {
    const st = layersRef.current;
    if (st.map) {
      const id = setTimeout(() => st.map.invalidateSize(), 50);
      return () => clearTimeout(id);
    }
    return () => {};
  }, [mapW]);

  /* ---- town pins ---- */
  React.useEffect(() => {
    const st = layersRef.current;
    if (!st.pinGroup) return;
    st.pinGroup.clearLayers();
    (townRows || []).forEach((d) => {
      L.circleMarker([d.lat, d.lon], {
        radius: 3,
        color: INK,
        weight: 1,
        fillColor: INK,
        fillOpacity: 1,
        interactive: false,
      }).addTo(st.pinGroup);
      L.marker([d.lat, d.lon], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [110, 14],
          iconAnchor: [-5, 8],
          html: `<div style="font:400 11px ${FONT};color:${INK};white-space:nowrap">${d.town}</div>`,
        }),
      }).addTo(st.pinGroup);
    });
    return () => {
      if (st.pinGroup) st.pinGroup.clearLayers();
    };
  }, [townRows]);

  /* ---- encoding layers ---- */
  React.useEffect(() => {
    const st = layersRef.current;
    if (!st.map || !ens.members.length) return;
    const { map, encGroup, densCanvas } = st;
    encGroup.clearLayers();

    const clearDens = () => {
      const ctx = densCanvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, densCanvas.width, densCanvas.height);
      densCanvas.style.display = "none";
    };
    clearDens();

    let densHandler = null;

    if (encoding === "cone") {
      // cone polygon: offset left/right of mean path by radius
      const left = [];
      const right = [];
      for (let i = 0; i < ens.mean.length; i++) {
        const p = ens.mean[i];
        const prev = ens.mean[Math.max(0, i - 1)];
        const next = ens.mean[Math.min(ens.mean.length - 1, i + 1)];
        const dx = (next.lon - prev.lon) * Math.cos((p.lat * Math.PI) / 180);
        const dy = next.lat - prev.lat;
        const len = Math.hypot(dx, dy) || 1;
        const r = ens.cone[i].r_km;
        const rLat = r / 111.32;
        const rLon = r / (111.32 * Math.cos((p.lat * Math.PI) / 180));
        const nx = -dy / len;
        const ny = dx / len;
        left.push([p.lat + ny * rLat, p.lon + nx * rLon]);
        right.push([p.lat - ny * rLat, p.lon - nx * rLon]);
      }
      const ring = left.concat(right.reverse());
      L.polygon(ring, {
        pane: "cone",
        color: ACCENT,
        weight: 1,
        opacity: 0.6,
        fillColor: ACCENT,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(encGroup);
      // end cap circle
      const lastMu = ens.mean[ens.mean.length - 1];
      L.circle([lastMu.lat, lastMu.lon], {
        pane: "cone",
        radius: ens.cone[ens.cone.length - 1].r_km * 1000,
        color: ACCENT,
        weight: 1,
        opacity: 0.6,
        fillColor: ACCENT,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(encGroup);
      L.polyline(
        ens.mean.map((p) => [p.lat, p.lon]),
        { pane: "ens", color: INK, weight: 1.5, interactive: false }
      ).addTo(encGroup);
    } else if (encoding === "spaghetti") {
      ens.members.forEach((m) => {
        L.polyline(
          m.pts.map((p) => [p.lat, p.lon]),
          { pane: "ens", color: INK, weight: 1, opacity: 0.22, interactive: false }
        ).addTo(encGroup);
      });
      L.polyline(
        ens.mean.map((p) => [p.lat, p.lon]),
        { pane: "ens", color: ACCENT, weight: 1.5, interactive: false }
      ).addTo(encGroup);
    } else if (encoding === "density") {
      densCanvas.style.display = "block";
      const pts = [];
      for (const m of ens.members) for (const p of m.pts) pts.push(p);
      const draw = () => {
        const size = map.getSize();
        const dpr = window.devicePixelRatio || 1;
        densCanvas.width = size.x * dpr;
        densCanvas.height = size.y * dpr;
        densCanvas.style.width = size.x + "px";
        densCanvas.style.height = size.y + "px";
        const tl = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(densCanvas, tl);
        const ctx = densCanvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size.x, size.y);

        const cell = 9;
        const cols = Math.ceil(size.x / cell) + 1;
        const rowsN = Math.ceil(size.y / cell) + 1;
        const grid = new Float32Array(cols * rowsN);
        for (const p of pts) {
          const pt = map.latLngToContainerPoint([p.lat, p.lon]);
          if (pt.x < -20 || pt.y < -20 || pt.x > size.x + 20 || pt.y > size.y + 20) continue;
          const cx = Math.floor(pt.x / cell);
          const cy = Math.floor(pt.y / cell);
          if (cx < 0 || cy < 0 || cx >= cols || cy >= rowsN) continue;
          grid[cy * cols + cx] += 1;
        }
        // gaussian blur (separable, 3 box passes)
        const blur = (src, w, h, r) => {
          const tmp = new Float32Array(w * h);
          const out = new Float32Array(w * h);
          for (let pass = 0; pass < 3; pass++) {
            const input = pass === 0 ? src : out;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                let s = 0,
                  n = 0;
                for (let k = -r; k <= r; k++) {
                  const xx = x + k;
                  if (xx < 0 || xx >= w) continue;
                  s += input[y * w + xx];
                  n++;
                }
                tmp[y * w + x] = s / n;
              }
            }
            for (let x = 0; x < w; x++) {
              for (let y = 0; y < h; y++) {
                let s = 0,
                  n = 0;
                for (let k = -r; k <= r; k++) {
                  const yy = y + k;
                  if (yy < 0 || yy >= h) continue;
                  s += tmp[yy * w + x];
                  n++;
                }
                out[y * w + x] = s / n;
              }
            }
          }
          return out;
        };
        const sm = blur(grid, cols, rowsN, 2);
        let mx = 0;
        for (let i = 0; i < sm.length; i++) if (sm[i] > mx) mx = sm[i];
        if (mx <= 0) return;
        const img = ctx.createImageData(Math.round(size.x), Math.round(size.y));
        const W = img.width;
        const H = img.height;
        const rgb = [217, 72, 15];
        for (let y = 0; y < H; y++) {
          const gy = y / cell;
          const y0 = Math.min(rowsN - 1, Math.floor(gy));
          const fy = gy - y0;
          const y1 = Math.min(rowsN - 1, y0 + 1);
          for (let x = 0; x < W; x++) {
            const gx = x / cell;
            const x0 = Math.min(cols - 1, Math.floor(gx));
            const fx = gx - x0;
            const x1 = Math.min(cols - 1, x0 + 1);
            const v =
              sm[y0 * cols + x0] * (1 - fx) * (1 - fy) +
              sm[y0 * cols + x1] * fx * (1 - fy) +
              sm[y1 * cols + x0] * (1 - fx) * fy +
              sm[y1 * cols + x1] * fx * fy;
            const a = Math.pow(v / mx, 0.55);
            const i4 = (y * W + x) * 4;
            img.data[i4] = rgb[0];
            img.data[i4 + 1] = rgb[1];
            img.data[i4 + 2] = rgb[2];
            img.data[i4 + 3] = Math.min(190, a * 190);
          }
        }
        ctx.putImageData(img, 0, 0);
      };
      draw();
      densHandler = draw;
      map.on("moveend zoomend resize", densHandler);
    } else if (encoding === "hops") {
      // drawn by separate effect below
    } else if (encoding === "bands") {
      const bandPoly = (band, key) => {
        const upper = [];
        const lower = [];
        band.forEach((b) => {
          upper.push([b[key === 50 ? "lat50" : "lat90"][1], b[key === 50 ? "lon50" : "lon90"][0]]);
          lower.push([b[key === 50 ? "lat50" : "lat90"][0], b[key === 50 ? "lon50" : "lon90"][1]]);
        });
        return upper.concat(lower.reverse());
      };
      [
        { band: ens.bandsSouth, color: INK },
        { band: ens.bandsNorth, color: ACCENT },
      ].forEach(({ band, color }) => {
        if (band.length < 2) return;
        L.polygon(bandPoly(band, 90), {
          pane: "cone",
          color,
          weight: 1,
          opacity: 0.35,
          fillColor: color,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(encGroup);
        L.polygon(bandPoly(band, 50), {
          pane: "cone",
          color,
          weight: 1,
          opacity: 0.6,
          fillColor: color,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(encGroup);
        L.polyline(
          band.map((b) => [b.latMid, b.lonMid]),
          { pane: "ens", color, weight: 1.5, interactive: false }
        ).addTo(encGroup);
      });
    }

    return () => {
      if (densHandler) map.off("moveend zoomend resize", densHandler);
      encGroup.clearLayers();
      clearDens();
    };
  }, [ens, encoding]);

  /* hops member layer */
  React.useEffect(() => {
    const st = layersRef.current;
    if (!st.map || encoding !== "hops" || hopMember == null) return;
    const m = ens.members.find((x) => x.id === hopMember);
    if (!m) return;
    const line = L.polyline(
      m.pts.map((p) => [p.lat, p.lon]),
      { pane: "ens", color: INK, weight: 2, interactive: false }
    ).addTo(st.map);
    return () => line.remove();
  }, [encoding, hopMember, ens]);

  /* dots at time t + mean marker */
  React.useEffect(() => {
    const st = layersRef.current;
    if (!st.dotGroup || !ens.members.length) return;
    st.dotGroup.clearLayers();
    const pos = ens.posByTime.get(t) || [];
    pos.forEach((p) => {
      L.circleMarker([p.lat, p.lon], {
        pane: "dots",
        radius: 2.2,
        stroke: false,
        fillColor: INK,
        fillOpacity: 0.55,
        interactive: false,
      }).addTo(st.dotGroup);
    });
    const mu = ens.mean.find((m) => m.t === t);
    if (mu) {
      L.circleMarker([mu.lat, mu.lon], {
        pane: "dots",
        radius: 3.5,
        color: "#ffffff",
        weight: 1.5,
        fillColor: ACCENT,
        fillOpacity: 1,
        interactive: false,
      }).addTo(st.dotGroup);
    }
    return () => {
      if (st.dotGroup) st.dotGroup.clearLayers();
    };
  }, [ens, t]);

  /* town marker + ring, imperative drag */
  React.useEffect(() => {
    const st = layersRef.current;
    if (!st.map) return;
    const { map, townGroup } = st;
    townGroup.clearLayers();

    const start = townRef.current;
    const ring = L.circle([start.lat, start.lon], {
      pane: "town",
      radius: radiusRef.current * 1000,
      color: ACCENT,
      weight: 1,
      fillColor: ACCENT,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(townGroup);

    const centerIcon = L.divIcon({
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;cursor:move">
        <div style="width:7px;height:7px;border-radius:50%;background:${ACCENT};box-sizing:content-box;border:1.5px solid #fff"></div></div>`,
    });
    const handleIcon = L.divIcon({
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;cursor:ew-resize">
        <div style="width:7px;height:7px;background:${INK};box-sizing:content-box;border:1.5px solid #fff"></div></div>`,
    });

    const handleLatLng = (c, rkm) =>
      L.latLng(c.lat, c.lng + rkm / (111.32 * Math.cos((c.lat * Math.PI) / 180)));

    const center = L.marker([start.lat, start.lon], {
      icon: centerIcon,
      draggable: true,
      pane: "town",
      keyboard: false,
    }).addTo(townGroup);
    const handle = L.marker(handleLatLng(L.latLng(start.lat, start.lon), radiusRef.current), {
      icon: handleIcon,
      draggable: true,
      pane: "town",
      keyboard: false,
    }).addTo(townGroup);

    center.on("drag", () => {
      const c = center.getLatLng();
      ring.setLatLng(c);
      handle.setLatLng(handleLatLng(c, radiusRef.current));
    });
    center.on("dragend", () => {
      const c = center.getLatLng();
      townRef.current = { lon: c.lng, lat: c.lat };
      setTown({ lon: c.lng, lat: c.lat });
    });

    handle.on("drag", () => {
      const c = ring.getLatLng();
      const h = handle.getLatLng();
      const r = Math.max(10, Math.min(1200, haversineKm(c.lng, c.lat, h.lng, h.lat)));
      radiusRef.current = r;
      ring.setRadius(r * 1000);
      handle.setLatLng(handleLatLng(c, r));
    });
    handle.on("dragend", () => {
      setRadiusKm(Math.round(radiusRef.current));
    });

    return () => {
      center.off();
      handle.off();
      townGroup.clearLayers();
    };
  }, []);

  /* sync ring/handle if radius changed via slider */
  React.useEffect(() => {
    radiusRef.current = radiusKm;
    const st = layersRef.current;
    if (!st.townGroup) return;
    st.townGroup.eachLayer((l) => {
      if (l instanceof L.Circle) l.setRadius(radiusKm * 1000);
    });
    // reposition handle
    const c = townRef.current;
    let circle = null;
    const markers = [];
    st.townGroup.eachLayer((l) => {
      if (l instanceof L.Circle) circle = l;
      else if (l instanceof L.Marker) markers.push(l);
    });
    if (circle && markers.length === 2) {
      const cc = circle.getLatLng();
      markers[1].setLatLng(
        L.latLng(cc.lat, cc.lng + radiusKm / (111.32 * Math.cos((cc.lat * Math.PI) / 180)))
      );
    }
    return () => {};
  }, [radiusKm]);

  const pct = (v) => (v * 100).toFixed(0) + " %";
  const cumAtT = React.useMemo(() => {
    const rec = (hitStats.cum || []).find((d) => d.t === t);
    return rec ? rec.p : 0;
  }, [hitStats.cum, t]);

  const splitCounts = React.useMemo(() => {
    let n = 0;
    ens.endNorth && ens.endNorth.forEach((v) => v && n++);
    return { north: n, south: ens.members.length - n };
  }, [ens]);

  return (
    <div
      style={{
        padding: 12,
        background: "#ffffff",
        color: INK,
        font: `400 12px ${FONT}`,
        display: "flex",
        gap: 12,
        alignItems: "stretch",
      }}
    >
      <div ref={wrapRef} style={{ flex: "1 1 auto", minWidth: 380 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <EncodingSwitch React={React} value={encoding} onChange={setEncoding} />
          <span
            style={{
              font: `400 11px ${MONO}`,
              color: GREY,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {ens.members.length} members
          </span>
        </div>

        <div
          ref={mapHostRef}
          style={{
            height: 600,
            width: "100%",
            border: `1px solid ${HAIR}`,
            background: "#ffffff",
          }}
        />

        <div style={{ marginTop: 8 }}>
          <TimeSlider
            React={React}
            t={t}
            times={ens.times}
            playing={playing}
            onT={(v) => {
              setPlaying(false);
              setT(v);
            }}
            onToggle={() => setPlaying((p) => !p)}
          />
        </div>

        <div style={{ marginTop: 4 }}>
          <StripChart
            React={React}
            series={hitStats.cum}
            width={Math.max(320, mapW)}
            height={96}
            marker={t}
            radiusKm={radiusKm}
          />
        </div>
      </div>

      <div
        style={{
          flex: "0 0 232px",
          borderLeft: `1px solid ${HAIR}`,
          paddingLeft: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <ValueRow
          React={React}
          label={`within ${Math.round(radiusKm)} km, any time`}
          value={pct(hitStats.p_hit)}
          emphasis
        />
        <ValueRow React={React} label="inside cone at 96 h" value={pct(hitStats.inCone)} />
        <ValueRow React={React} label={`passed by ${t} h`} value={pct(cumAtT)} />
        <ValueRow
          React={React}
          label="town"
          value={`${town.lat.toFixed(2)}, ${town.lon.toFixed(2)}`}
        />
        <ValueRow React={React} label="radius" value={`${Math.round(radiusKm)} km`} />
        <ValueRow
          React={React}
          label="ends north of 28°N"
          value={`${splitCounts.north} / ${ens.members.length}`}
        />

        <div style={{ marginTop: 10 }}>
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={Math.round(radiusKm)}
            onChange={(e) => setRadiusKm(+e.target.value)}
            style={{ width: "100%", accentColor: ACCENT, height: 18 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          {(townRows || []).map((d) => (
            <div
              key={d.town}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                borderBottom: `1px solid ${HAIR}`,
                padding: "4px 0",
                cursor: "pointer",
              }}
              onClick={() => {
                townRef.current = { lon: d.lon, lat: d.lat };
                setTown({ lon: d.lon, lat: d.lat });
                const st = layersRef.current;
                if (st.townGroup) {
                  const ms = [];
                  st.townGroup.eachLayer((l) => {
                    if (l instanceof L.Circle) l.setLatLng([d.lat, d.lon]);
                    else if (l instanceof L.Marker) ms.push(l);
                  });
                  if (ms.length === 2) {
                    ms[0].setLatLng([d.lat, d.lon]);
                    ms[1].setLatLng([
                      d.lat,
                      d.lon + radiusRef.current / (111.32 * Math.cos((d.lat * Math.PI) / 180)),
                    ]);
                  }
                }
              }}
            >
              <span
                style={{
                  font: `400 12px ${FONT}`,
                  color:
                    Math.abs(d.lon - town.lon) < 1e-6 && Math.abs(d.lat - town.lat) < 1e-6
                      ? ACCENT
                      : INK,
                }}
              >
                {d.town}
              </span>
              <span
                style={{
                  font: `400 11px ${MONO}`,
                  color: GREY,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.lat.toFixed(2)}, {d.lon.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}