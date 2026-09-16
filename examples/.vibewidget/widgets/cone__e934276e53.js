import * as d3 from "https://esm.sh/d3@7";
import * as Lmod from "https://esm.sh/leaflet@1.9.4";

const L = Lmod.default || Lmod;

const CREAM = "#fdfbf7";
const INK = "#1b1033";
const ROSE = "#d7607f";
const TEAL = "#2f7d76";
const AMBER = "#e8a33d";
const PLUM = "#5b2a6b";

const SERIF = "'Playfair Display', 'Tiempos Headline', Georgia, serif";
const MONO = "'Fira Code', 'Pitch', ui-monospace, 'SF Mono', Menlo, monospace";

const ENCODINGS = [
  { id: "cone", label: "cone", blurb: "mean track + 67th-percentile spread. the official look." },
  { id: "spaghetti", label: "spaghetti", blurb: "all 200 members, raw and unsmoothed." },
  { id: "density", label: "density", blurb: "where the ensemble spends its time, blurred." },
  { id: "hops", label: "hops", blurb: "one plausible future at a time, every 500 ms." },
  { id: "bands", label: "bands", blurb: "50 % / 90 % bands, split by northern vs. southern endings." },
];

const KM_PER_DEG_LAT = 110.574;
function kmPerDegLon(lat) { return 111.32 * Math.cos((lat * Math.PI) / 180); }

function distKm(lon1, lat1, lon2, lat2) {
  const k = kmPerDegLon((lat1 + lat2) / 2);
  return Math.hypot((lon2 - lon1) * k, (lat2 - lat1) * KM_PER_DEG_LAT);
}

function circlePts(lon, lat, km, n = 40) {
  const dLat = km / KM_PER_DEG_LAT;
  const dLon = km / Math.max(1e-6, kmPerDegLon(lat));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return out;
}

function hullLatLng(pts) {
  if (!pts || pts.length < 3) return [];
  const k = Math.cos((24 * Math.PI) / 180);
  const h = d3.polygonHull(pts.map((p) => [p[0] * k, p[1]]));
  if (!h) return [];
  return h.map((p) => [p[1], p[0] / k]);
}

function segDistOrigin(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len ? (-x1 * dx - y1 * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x1 + t * dx, y1 + t * dy);
}

function computeHit(prep, town, radiusKm) {
  if (!prep) return { p: 0, curve: [] };
  const { tracks, times } = prep;
  const k = kmPerDegLon(town.lat);
  const n = times.length;
  const counts = new Float64Array(n);
  let hits = 0;
  for (const tr of tracks) {
    let first = -1;
    let px = (tr[0][0] - town.lon) * k;
    let py = (tr[0][1] - town.lat) * KM_PER_DEG_LAT;
    if (Math.hypot(px, py) <= radiusKm) first = 0;
    for (let i = 1; i < n && first < 0; i++) {
      const cx = (tr[i][0] - town.lon) * k;
      const cy = (tr[i][1] - town.lat) * KM_PER_DEG_LAT;
      if (segDistOrigin(px, py, cx, cy) <= radiusKm) first = i;
      px = cx;
      py = cy;
    }
    if (first >= 0) {
      hits++;
      for (let i = first; i < n; i++) counts[i]++;
    }
  }
  const m = tracks.length || 1;
  return { p: hits / m, curve: times.map((t, i) => ({ t, p: counts[i] / m })) };
}

function prepareEnsemble(rows) {
  if (!rows || !rows.length) return null;
  const byMember = new Map();
  for (const r of rows) {
    let a = byMember.get(r.member);
    if (!a) { a = []; byMember.set(r.member, a); }
    a.push(r);
  }
  const times = Array.from(new Set(rows.map((r) => +r.t_h))).sort((a, b) => a - b);
  const members = Array.from(byMember.keys()).sort((a, b) => a - b);
  const tracks = [];
  for (const m of members) {
    const arr = byMember.get(m).slice().sort((a, b) => a.t_h - b.t_h);
    if (arr.length !== times.length) continue;
    tracks.push(arr.map((r) => [+r.lon, +r.lat]));
  }
  const nT = times.length;
  const mean = [];
  for (let i = 0; i < nT; i++) {
    mean.push([d3.mean(tracks, (tr) => tr[i][0]), d3.mean(tracks, (tr) => tr[i][1])]);
  }
  const coneR = [];
  const distsPerT = [];
  for (let i = 0; i < nT; i++) {
    const ds = tracks.map((tr) => distKm(tr[i][0], tr[i][1], mean[i][0], mean[i][1]));
    distsPerT.push(ds);
    coneR.push(d3.quantile(ds.slice().sort(d3.ascending), 0.67) || 0);
  }
  const conePoly = hullLatLng(
    mean.flatMap((m, i) => circlePts(m[0], m[1], Math.max(coneR[i], 8)))
  );

  const north = [];
  const south = [];
  tracks.forEach((tr) => (tr[nT - 1][1] > 28 ? north : south).push(tr));
  function bandsFor(group) {
    if (!group.length) return null;
    const gMean = [];
    for (let i = 0; i < nT; i++) {
      gMean.push([d3.mean(group, (tr) => tr[i][0]), d3.mean(group, (tr) => tr[i][1])]);
    }
    const r50 = [];
    const r90 = [];
    for (let i = 0; i < nT; i++) {
      const ds = group
        .map((tr) => distKm(tr[i][0], tr[i][1], gMean[i][0], gMean[i][1]))
        .sort(d3.ascending);
      r50.push(d3.quantile(ds, 0.5) || 0);
      r90.push(d3.quantile(ds, 0.9) || 0);
    }
    return {
      n: group.length,
      mean: gMean,
      poly50: hullLatLng(gMean.flatMap((m, i) => circlePts(m[0], m[1], Math.max(r50[i], 5)))),
      poly90: hullLatLng(gMean.flatMap((m, i) => circlePts(m[0], m[1], Math.max(r90[i], 8)))),
    };
  }
  return {
    times,
    tracks,
    mean,
    coneR,
    conePoly,
    distsPerT,
    points: rows.map((r) => [+r.lon, +r.lat]),
    bands: { north: bandsFor(north), south: bandsFor(south) },
  };
}

const RAMP = d3.interpolateRgbBasis(["#f7e6cf", "#f3b183", "#dd6f88", "#7a3a80", "#2a1440"]);

function createHeat(map, points) {
  const pane = map.getPanes().overlayPane;
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.pointerEvents = "none";
  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 800ms ease";
  pane.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const r = 20;
  const blob = document.createElement("canvas");
  blob.width = blob.height = r * 2;
  const bc = blob.getContext("2d");
  const g = bc.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(0,0,0,0.26)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  bc.fillStyle = g;
  bc.fillRect(0, 0, r * 2, r * 2);

  const lut = [];
  for (let i = 0; i < 256; i++) {
    const c = d3.rgb(RAMP(Math.pow(i / 255, 0.75)));
    lut.push([c.r, c.g, c.b]);
  }

  function draw() {
    const size = map.getSize();
    const tl = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, tl);
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = size.x + "px";
    canvas.style.height = size.y + "px";
    ctx.clearRect(0, 0, size.x, size.y);
    for (const p of points) {
      const pt = map.latLngToContainerPoint([p[1], p[0]]);
      if (pt.x < -r || pt.y < -r || pt.x > size.x + r || pt.y > size.y + r) continue;
      ctx.drawImage(blob, pt.x - r, pt.y - r);
    }
    const img = ctx.getImageData(0, 0, size.x, size.y);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (!a) continue;
      const c = lut[a];
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.min(230, a * 2.4);
    }
    ctx.putImageData(img, 0, 0);
    canvas.style.opacity = "1";
  }
  draw();
  map.on("moveend zoomend resize", draw);
  return {
    destroy() {
      map.off("moveend zoomend resize", draw);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}

export const EncodingSwitch = ({ React, value, onChange }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
    {ENCODINGS.map((e) => {
      const on = e.id === value;
      return (
        <button
          key={e.id}
          onClick={() => onChange(e.id)}
          style={{
            font: `500 12.5px/1 ${MONO}`,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "9px 13px",
            borderRadius: 999,
            cursor: "pointer",
            color: on ? CREAM : INK,
            background: on ? INK : "rgba(27,16,51,0.05)",
            border: `1px solid ${on ? INK : "rgba(27,16,51,0.25)"}`,
            transition: "all 500ms cubic-bezier(.22,.8,.26,1)",
          }}
        >
          {e.label}
        </button>
      );
    })}
  </div>
);

export const TimeScrubber = ({ React, t, onT, playing, onPlay, times }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
    <button
      onClick={onPlay}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: `1px solid ${INK}`,
        background: playing ? INK : CREAM,
        color: playing ? CREAM : INK,
        cursor: "pointer",
        font: `600 13px/1 ${MONO}`,
        flex: "0 0 auto",
        transition: "all 400ms ease",
      }}
      title={playing ? "pause" : "play"}
    >
      {playing ? "❙❙" : "▶"}
    </button>
    <input
      type="range"
      min={0}
      max={120}
      step={5}
      value={t}
      onChange={(e) => onT(+e.target.value)}
      onInput={(e) => onT(+e.target.value)}
      style={{ flex: 1, accentColor: ROSE, height: 22 }}
    />
    <div
      style={{
        font: `600 14px/1 ${MONO}`,
        color: INK,
        minWidth: 92,
        textAlign: "right",
        letterSpacing: "0.04em",
      }}
    >
      t + {String(t).padStart(3, " ")} h
    </div>
  </div>
);

export const HitStrip = ({ React, curve, t, width = 640, height = 140, radiusKm = 80 }) => {
  const ref = React.useRef(null);
  const markerRef = React.useRef(null);

  React.useEffect(() => {
    const host = ref.current;
    if (!host || !curve || !curve.length) return;
    const m = { l: 46, r: 16, t: 16, b: 26 };
    const w = Math.max(240, width);
    const svg = d3.select(host).append("svg").attr("width", w).attr("height", height);
    const x = d3.scaleLinear().domain([0, 120]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([height - m.b, m.t]);

    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "hitgrad")
      .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("y1", y(1)).attr("y2", y(0));
    grad.append("stop").attr("offset", "0%").attr("stop-color", ROSE).attr("stop-opacity", 0.55);
    grad.append("stop").attr("offset", "100%").attr("stop-color", AMBER).attr("stop-opacity", 0.08);

    const g = svg.append("g");

    y.ticks(3).forEach((v) => {
      g.append("line")
        .attr("x1", m.l).attr("x2", w - m.r)
        .attr("y1", y(v)).attr("y2", y(v))
        .attr("stroke", "rgba(27,16,51,0.14)")
        .attr("stroke-dasharray", v === 0 ? null : "2 4");
      g.append("text")
        .attr("x", m.l - 8).attr("y", y(v) + 4)
        .attr("text-anchor", "end")
        .attr("fill", INK)
        .style("font", `500 10.5px ${MONO}`)
        .text(d3.format(".0%")(v));
    });

    [0, 24, 48, 72, 96, 120].forEach((v) => {
      g.append("text")
        .attr("x", x(v)).attr("y", height - 8)
        .attr("text-anchor", "middle")
        .attr("fill", INK)
        .style("font", `500 10.5px ${MONO}`)
        .text(v + "h");
    });

    const area = d3.area().x((d) => x(d.t)).y0(y(0)).y1((d) => y(d.p)).curve(d3.curveMonotoneX);
    const line = d3.line().x((d) => x(d.t)).y((d) => y(d.p)).curve(d3.curveMonotoneX);

    g.append("path").datum(curve).attr("fill", "url(#hitgrad)").attr("d", area);
    g.append("path")
      .datum(curve)
      .attr("fill", "none")
      .attr("stroke", INK)
      .attr("stroke-width", 2)
      .attr("d", line);

    g.append("text")
      .attr("x", m.l).attr("y", m.t - 3)
      .attr("fill", INK)
      .style("font", `500 10.5px ${MONO}`)
      .style("letter-spacing", "0.08em")
      .text(`P(PASSED WITHIN ${Math.round(radiusKm)} KM BY HOUR t)`);

    const mk = g.append("g");
    mk.append("line")
      .attr("y1", m.t).attr("y2", height - m.b)
      .attr("stroke", ROSE).attr("stroke-width", 1.5);
    mk.append("circle").attr("r", 3.5).attr("fill", ROSE).attr("cy", height - m.b);
    markerRef.current = { mk, x, y, curve, height, m };

    return () => {
      markerRef.current = null;
      svg.remove();
    };
  }, [curve, width, height, radiusKm]);

  React.useEffect(() => {
    const st = markerRef.current;
    if (!st) return;
    const px = st.x(t);
    const row = st.curve.reduce(
      (a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a),
      st.curve[0]
    );
    st.mk.attr("transform", `translate(${px},0)`);
    st.mk.select("circle").attr("cy", st.y(row.p));
    return () => {};
  }, [t, curve, width]);

  return <div ref={ref} style={{ width: "100%" }} />;
};

export const StatPanel = ({ React, pHit, radiusKm, onRadius, coneShare, town, encoding, t, memberCount }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      right: 14,
      zIndex: 650,
      width: 236,
      background: "rgba(253,251,247,0.95)",
      border: `1px solid rgba(27,16,51,0.35)`,
      borderRadius: 4,
      padding: "13px 14px",
      boxShadow: "0 8px 26px rgba(27,16,51,0.16)",
      backdropFilter: "blur(3px)",
    }}
  >
    <div
      style={{
        font: `500 10px ${MONO}`,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#6b5a7a",
      }}
    >
      my town
    </div>
    <div style={{ font: `400 21px/1.15 ${SERIF}`, color: INK, marginTop: 3 }}>
      {town.lat.toFixed(2)}°N, {Math.abs(town.lon).toFixed(2)}°W
    </div>
    <div style={{ height: 1, background: "rgba(27,16,51,0.18)", margin: "11px 0" }} />
    <div style={{ font: `400 11.5px/1.5 ${MONO}`, color: INK }}>
      P(track passes within {Math.round(radiusKm)} km at any time) ={" "}
      <span style={{ color: ROSE, fontWeight: 700, fontSize: 15 }}>
        {d3.format(".0%")(pHit)}
      </span>
    </div>
    <div style={{ font: `400 11.5px/1.5 ${MONO}`, color: INK, marginTop: 8 }}>
      members inside the cone at 96 h:{" "}
      <span style={{ color: PLUM, fontWeight: 700, fontSize: 15 }}>
        {d3.format(".0%")(coneShare)}
      </span>
    </div>
    <div style={{ height: 1, background: "rgba(27,16,51,0.18)", margin: "11px 0" }} />
    <label
      style={{
        font: `500 10px ${MONO}`,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#6b5a7a",
      }}
    >
      ring radius — {Math.round(radiusKm)} km
    </label>
    <input
      type="range"
      min={10}
      max={400}
      step={5}
      value={Math.round(radiusKm)}
      onChange={(e) => onRadius(+e.target.value)}
      onInput={(e) => onRadius(+e.target.value)}
      style={{ width: "100%", accentColor: TEAL, marginTop: 4 }}
    />
    <div style={{ font: `400 10px/1.4 ${MONO}`, color: "#6b5a7a", marginTop: 6 }}>
      {memberCount} members · showing “{encoding}” · marker at t+{t} h · drag the pin or the
      teal handle.
    </div>
  </div>
);

export default function Widget({ model, React }) {
  const [version, setVersion] = React.useState(0);
  const rows = model.get("data") || [];
  const towns = model.get("towns") || [];

  const prep = React.useMemo(() => prepareEnsemble(rows), [rows, version]);

  const houston = React.useMemo(() => {
    const h = (towns || []).find((d) => String(d.town).toLowerCase() === "houston");
    return h ? { lon: +h.lon, lat: +h.lat } : { lon: -95.37, lat: 29.76 };
  }, [towns, version]);

  const [encoding, setEncoding] = React.useState("cone");
  const [t, setT] = React.useState(48);
  const [playing, setPlaying] = React.useState(false);
  const [town, setTown] = React.useState(houston);
  const [radiusKm, setRadiusKm] = React.useState(80);
  const [cssReady, setCssReady] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(0);
  const [stripW, setStripW] = React.useState(700);
  const [hopMember, setHopMember] = React.useState(null);

  const mapDivRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const dotsRef = React.useRef([]);
  const meanDotRef = React.useRef(null);
  const townMarkerRef = React.useRef(null);
  const ringRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const townRef = React.useRef(town);
  const radiusRef = React.useRef(radiusKm);
  const tRef = React.useRef(t);
  const draggingRef = React.useRef({ town: false, radius: false });
  const rafRef = React.useRef(0);
  const stripHostRef = React.useRef(null);

  townRef.current = town;
  radiusRef.current = radiusKm;
  tRef.current = t;

  const hit = React.useMemo(
    () => computeHit(prep, town, radiusKm),
    [prep, town.lon, town.lat, radiusKm]
  );

  const coneShare96 = React.useMemo(() => {
    if (!prep) return 0;
    const i = prep.times.indexOf(96) >= 0 ? prep.times.indexOf(96) : prep.times.length - 1;
    const ds = prep.distsPerT[i];
    const r = prep.coneR[i];
    return ds.filter((d) => d <= r).length / (ds.length || 1);
  }, [prep]);

  /* ---------- inputs ---------- */
  React.useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    model.on("change:data", bump);
    model.on("change:towns", bump);
    return () => {
      model.off("change:data", bump);
      model.off("change:towns", bump);
    };
  }, [model]);

  /* ---------- outputs ---------- */
  React.useEffect(() => {
    model.set("encoding", encoding);
    model.set("town", { lon: +town.lon.toFixed(4), lat: +town.lat.toFixed(4) });
    model.set("radius_km", Math.round(radiusKm));
    model.set("p_hit", +hit.p.toFixed(4));
    model.save_changes();
    return () => {};
  }, [model, encoding, town.lon, town.lat, radiusKm, hit.p]);

  /* ---------- stylesheet + fonts ---------- */
  React.useEffect(() => {
    const nodes = [];
    const mk = (href, onload) => {
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = href;
      if (onload) el.onload = onload;
      document.head.appendChild(el);
      nodes.push(el);
    };
    mk("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", () => setCssReady(true));
    mk("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Fira+Code:wght@400;500;600&display=swap");
    const fallback = setTimeout(() => setCssReady(true), 1600);
    return () => {
      clearTimeout(fallback);
      nodes.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    };
  }, []);

  /* ---------- map ---------- */
  React.useEffect(() => {
    if (!cssReady || !mapDivRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: [27, -90],
      zoom: 5,
      zoomControl: true,
      preferCanvas: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: "&copy; OpenStreetMap",
      opacity: 0.85,
    }).addTo(map);
    map.createPane("dotsPane").style.zIndex = 470;
    map.createPane("ringPane").style.zIndex = 480;
    mapRef.current = map;
    setMapReady((v) => v + 1);
    const invalidate = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(invalidate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      mapRef.current = null;
      dotsRef.current = [];
      meanDotRef.current = null;
      townMarkerRef.current = null;
      ringRef.current = null;
      handleRef.current = null;
      map.remove();
    };
  }, [cssReady]);

  /* ---------- input towns pins ---------- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !towns.length) return;
    const g = L.layerGroup().addTo(map);
    towns.forEach((d) => {
      L.marker([+d.lat, +d.lon], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div style="transform:translate(-5px,-5px);display:flex;align-items:center;gap:5px;white-space:nowrap">
            <span style="width:9px;height:9px;border-radius:50%;background:${INK};border:2px solid ${CREAM};box-shadow:0 0 0 1px rgba(27,16,51,.4)"></span>
            <span style="font:500 10.5px ${MONO};color:${INK};background:rgba(253,251,247,.8);padding:1px 4px;border-radius:2px;letter-spacing:.04em">${d.town}</span>
          </div>`,
        }),
      }).addTo(g);
    });
    return () => {
      map.removeLayer(g);
    };
  }, [mapReady, towns, version]);

  /* ---------- encoding layers ---------- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !prep) return;
    const group = L.layerGroup().addTo(map);
    let timer = null;
    let heat = null;

    const meanLatLng = prep.mean.map((p) => [p[1], p[0]]);

    if (encoding === "cone") {
      L.polygon(prep.conePoly, {
        color: PLUM,
        weight: 1,
        opacity: 0.45,
        dashArray: "4 5",
        fillColor: PLUM,
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(group);
      L.polyline(meanLatLng, { color: INK, weight: 2.6, opacity: 0.95, interactive: false }).addTo(group);
      prep.times.forEach((tt, i) => {
        if (tt % 24 !== 0) return;
        L.circleMarker([prep.mean[i][1], prep.mean[i][0]], {
          radius: 3,
          color: INK,
          weight: 1.4,
          fillColor: CREAM,
          fillOpacity: 1,
          interactive: false,
        }).addTo(group);
      });
    } else if (encoding === "spaghetti") {
      prep.tracks.forEach((tr, i) => {
        L.polyline(
          tr.map((p) => [p[1], p[0]]),
          {
            color: i % 3 === 0 ? TEAL : i % 3 === 1 ? PLUM : ROSE,
            weight: 0.8,
            opacity: 0.38,
            interactive: false,
          }
        ).addTo(group);
      });
    } else if (encoding === "density") {
      heat = createHeat(map, prep.points);
    } else if (encoding === "hops") {
      const line = L.polyline([], {
        color: PLUM,
        weight: 4,
        opacity: 0.95,
        lineCap: "round",
        interactive: false,
      }).addTo(group);
      const ghost = L.polyline([], {
        color: ROSE,
        weight: 2,
        opacity: 0.25,
        interactive: false,
      }).addTo(group);
      let prev = null;
      const pick = () => {
        const idx = Math.floor(Math.random() * prep.tracks.length);
        const lls = prep.tracks[idx].map((p) => [p[1], p[0]]);
        if (prev) ghost.setLatLngs(prev);
        line.setLatLngs(lls);
        prev = lls;
        setHopMember(idx);
      };
      pick();
      timer = setInterval(pick, 500);
    } else if (encoding === "bands") {
      const spec = [
        { b: prep.bands.north, c: ROSE, label: "ends north of 28°N" },
        { b: prep.bands.south, c: TEAL, label: "ends south of 28°N" },
      ];
      spec.forEach(({ b, c }) => {
        if (!b) return;
        L.polygon(b.poly90, {
          color: c, weight: 1, opacity: 0.35, fillColor: c, fillOpacity: 0.1, interactive: false,
        }).addTo(group);
        L.polygon(b.poly50, {
          color: c, weight: 1.2, opacity: 0.6, fillColor: c, fillOpacity: 0.24, interactive: false,
        }).addTo(group);
        L.polyline(b.mean.map((p) => [p[1], p[0]]), {
          color: c, weight: 2.2, opacity: 0.95, dashArray: "6 4", interactive: false,
        }).addTo(group);
      });
    }

    return () => {
      if (timer) clearInterval(timer);
      if (heat) heat.destroy();
      map.removeLayer(group);
    };
  }, [encoding, prep, mapReady]);

  /* ---------- member dots at time t ---------- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !prep) return;
    const renderer = L.svg({ pane: "dotsPane" }).addTo(map);
    const idx = Math.max(0, Math.min(prep.times.length - 1, Math.round(tRef.current / 5)));
    const dots = prep.tracks.map((tr) =>
      L.circleMarker([tr[idx][1], tr[idx][0]], {
        renderer,
        pane: "dotsPane",
        radius: 2.4,
        stroke: false,
        fillColor: INK,
        fillOpacity: 0.5,
        interactive: false,
      }).addTo(map)
    );
    const meanDot = L.circleMarker([prep.mean[idx][1], prep.mean[idx][0]], {
      renderer,
      pane: "dotsPane",
      radius: 6.5,
      color: INK,
      weight: 2,
      fillColor: AMBER,
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);
    dotsRef.current = dots;
    meanDotRef.current = meanDot;
    return () => {
      dotsRef.current = [];
      meanDotRef.current = null;
      dots.forEach((d) => map.removeLayer(d));
      map.removeLayer(meanDot);
      map.removeLayer(renderer);
    };
  }, [prep, mapReady]);

  React.useEffect(() => {
    if (!prep || !dotsRef.current.length) return;
    const idx = Math.max(0, Math.min(prep.times.length - 1, Math.round(t / 5)));
    dotsRef.current.forEach((dot, i) => {
      const p = prep.tracks[i][idx];
      dot.setLatLng([p[1], p[0]]);
    });
    if (meanDotRef.current) {
      meanDotRef.current.setLatLng([prep.mean[idx][1], prep.mean[idx][0]]);
    }
    return () => {};
  }, [t, prep, mapReady]);

  /* ---------- town marker + ring + radius handle ---------- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const schedule = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setTown({ ...townRef.current });
        setRadiusKm(radiusRef.current);
      });
    };

    const t0 = townRef.current;
    const ring = L.circle([t0.lat, t0.lon], {
      pane: "ringPane",
      radius: radiusRef.current * 1000,
      color: TEAL,
      weight: 2,
      dashArray: "5 5",
      fillColor: TEAL,
      fillOpacity: 0.07,
      interactive: false,
    }).addTo(map);

    const marker = L.marker([t0.lat, t0.lon], {
      draggable: true,
      autoPan: true,
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<div style="transform:translate(-9px,-30px);cursor:grab">
          <div style="width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${ROSE};border:2px solid ${CREAM};box-shadow:0 2px 6px rgba(27,16,51,.4)"></div>
          <div style="margin-top:4px;transform:translateX(-14px);font:600 10.5px ${MONO};color:${INK};background:rgba(253,251,247,.9);padding:1px 5px;border-radius:2px;white-space:nowrap;letter-spacing:.05em">my town</div>
        </div>`,
      }),
    }).addTo(map);

    const eastPoint = (lon, lat, km) => [lat, lon + km / Math.max(1e-6, kmPerDegLon(lat))];
    const handle = L.marker(eastPoint(t0.lon, t0.lat, radiusRef.current), {
      draggable: true,
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<div style="transform:translate(-7px,-7px);width:14px;height:14px;border-radius:50%;background:${CREAM};border:2.5px solid ${TEAL};cursor:ew-resize;box-shadow:0 1px 4px rgba(27,16,51,.35)"></div>`,
      }),
    }).addTo(map);

    townMarkerRef.current = marker;
    ringRef.current = ring;
    handleRef.current = handle;

    const onTownStart = () => { draggingRef.current.town = true; };
    const onTownDrag = (e) => {
      const ll = e.target.getLatLng();
      townRef.current = { lon: ll.lng, lat: ll.lat };
      ring.setLatLng(ll);
      handle.setLatLng(eastPoint(ll.lng, ll.lat, radiusRef.current));
      schedule();
    };
    const onTownEnd = (e) => {
      draggingRef.current.town = false;
      onTownDrag(e);
    };

    const onHandleStart = () => { draggingRef.current.radius = true; };
    const onHandleDrag = (e) => {
      const ll = e.target.getLatLng();
      const c = townRef.current;
      const km = Math.max(10, Math.min(400, distKm(c.lon, c.lat, ll.lng, ll.lat)));
      radiusRef.current = km;
      ring.setRadius(km * 1000);
      schedule();
    };
    const onHandleEnd = () => {
      draggingRef.current.radius = false;
      const c = townRef.current;
      handle.setLatLng(eastPoint(c.lon, c.lat, radiusRef.current));
      schedule();
    };

    marker.on("dragstart", onTownStart);
    marker.on("drag", onTownDrag);
    marker.on("dragend", onTownEnd);
    handle.on("dragstart", onHandleStart);
    handle.on("drag", onHandleDrag);
    handle.on("dragend", onHandleEnd);

    return () => {
      marker.off("dragstart", onTownStart);
      marker.off("drag", onTownDrag);
      marker.off("dragend", onTownEnd);
      handle.off("dragstart", onHandleStart);
      handle.off("drag", onHandleDrag);
      handle.off("dragend", onHandleEnd);
      townMarkerRef.current = null;
      ringRef.current = null;
      handleRef.current = null;
      map.removeLayer(marker);
      map.removeLayer(handle);
      map.removeLayer(ring);
    };
  }, [mapReady]);

  /* ---------- sync ring/handle when state changes outside the gesture ---------- */
  React.useEffect(() => {
    const ring = ringRef.current;
    const handle = handleRef.current;
    const marker = townMarkerRef.current;
    if (!ring || !handle || !marker) return;
    if (!draggingRef.current.town) {
      marker.setLatLng([town.lat, town.lon]);
      ring.setLatLng([town.lat, town.lon]);
    }
    if (!draggingRef.current.radius) {
      ring.setRadius(radiusKm * 1000);
      handle.setLatLng([
        town.lat,
        town.lon + radiusKm / Math.max(1e-6, kmPerDegLon(town.lat)),
      ]);
    }
    return () => {};
  }, [town.lon, town.lat, radiusKm, mapReady]);

  /* ---------- play loop ---------- */
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((prev) => (prev >= 120 ? 0 : prev + 5));
    }, 320);
    return () => clearInterval(id);
  }, [playing]);

  /* ---------- strip width ---------- */
  React.useEffect(() => {
    const host = stripHostRef.current;
    if (!host) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setStripW(Math.round(w));
    });
    ro.observe(host);
    setStripW(Math.round(host.getBoundingClientRect().width || 700));
    return () => ro.disconnect();
  }, []);

  const activeBlurb = ENCODINGS.find((e) => e.id === encoding)?.blurb || "";

  return (
    <section
      style={{
        background: CREAM,
        color: INK,
        padding: "30px 28px 34px",
        fontFamily: MONO,
        borderTop: `3px solid ${INK}`,
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div
          style={{
            font: `500 10.5px ${MONO}`,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#6b5a7a",
          }}
        >
          chapter four · the ensemble
        </div>
        <h1
          style={{
            font: `700 clamp(30px, 4.4vw, 52px)/1.03 ${SERIF}`,
            margin: "8px 0 6px",
            letterSpacing: "-0.015em",
          }}
        >
          Five ways to draw the same{" "}
          <em style={{ fontStyle: "italic", color: ROSE }}>doubt</em>.
        </h1>
        <p
          style={{
            font: `400 14.5px/1.65 ${MONO}`,
            maxWidth: 640,
            color: "#2b2038",
            margin: "0 0 18px",
          }}
        >
          Two hundred plausible futures leave the same point in the Gulf. Nothing below is a
          different forecast — only a different way of admitting what we don’t know. Scrub the
          hours, drag your town, and watch the number that actually matters move.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            marginBottom: 6,
          }}
        >
          <EncodingSwitch React={React} value={encoding} onChange={setEncoding} />
          <div
            style={{
              font: `400 12px/1.4 ${MONO}`,
              color: "#4a3c5c",
              flex: "1 1 220px",
              minWidth: 200,
              transition: "opacity 800ms ease",
            }}
          >
            {activeBlurb}
            {encoding === "hops" && hopMember != null ? ` · member ${hopMember}` : ""}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            height: 600,
            marginTop: 12,
            border: `1px solid rgba(27,16,51,0.35)`,
            borderRadius: 4,
            overflow: "hidden",
            background: "#e9e4dc",
          }}
        >
          <div ref={mapDivRef} style={{ position: "absolute", inset: 0 }} />
          {!cssReady && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: `500 12px ${MONO}`,
                color: INK,
              }}
            >
              loading basemap…
            </div>
          )}
          <StatPanel
            React={React}
            pHit={hit.p}
            radiusKm={radiusKm}
            onRadius={(v) => setRadiusKm(v)}
            coneShare={coneShare96}
            town={town}
            encoding={encoding}
            t={t}
            memberCount={prep ? prep.tracks.length : 0}
          />
          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 14,
              zIndex: 650,
              background: "rgba(253,251,247,0.94)",
              border: `1px solid rgba(27,16,51,0.3)`,
              borderRadius: 4,
              padding: "8px 12px",
              font: `400 10.5px/1.7 ${MONO}`,
              color: INK,
            }}
          >
            <span style={{ color: AMBER, fontWeight: 700 }}>●</span> mean position at t ·{" "}
            <span style={{ color: INK, opacity: 0.55, fontWeight: 700 }}>●</span> members at t ·{" "}
            <span style={{ color: TEAL, fontWeight: 700 }}>◯</span> your ring
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <TimeScrubber
            React={React}
            t={t}
            onT={(v) => { setPlaying(false); setT(v); }}
            playing={playing}
            onPlay={() => setPlaying((p) => !p)}
            times={prep ? prep.times : []}
          />
        </div>

        <div
          ref={stripHostRef}
          style={{
            marginTop: 14,
            borderTop: `1px solid rgba(27,16,51,0.25)`,
            paddingTop: 6,
          }}
        >
          <HitStrip
            React={React}
            curve={hit.curve}
            t={t}
            width={stripW}
            height={150}
            radiusKm={radiusKm}
          />
        </div>

        <p
          style={{
            font: `400 12.5px/1.7 ${MONO}`,
            color: "#4a3c5c",
            maxWidth: 680,
            marginTop: 6,
          }}
        >
          The strip is cumulative: once a member has clipped your ring it stays counted. The
          curve’s final height is exactly the{" "}
          <span style={{ color: ROSE, fontWeight: 600 }}>{d3.format(".0%")(hit.p)}</span> in the
          panel — the same ensemble, one more encoding.
        </p>
      </div>
    </section>
  );
}