import * as d3 from "https://esm.sh/d3@7";
import * as L from "https://esm.sh/leaflet@1.9.4";

const LEAFLET_CSS = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";

const INK = "#1c1c1c";
const MUTED = "#6b6b6b";
const RULE = "#dcdcdc";
const BG = "#ffffff";
const REGION_COLORS = [
  "#2f6f8f", "#8f512f", "#4b7f4b", "#7a4b8f",
  "#8f7a2f", "#2f8f7a", "#8f2f5a", "#4b5a8f",
];

const MODES = [
  { key: "walk", label: "walk", out: "walk_min", back: "walk_back" },
  { key: "bike", label: "bike", out: "bike_min", back: "bike_back" },
  { key: "drive", label: "drive", out: "drive_min", back: "drive_back" },
];

/* ---------------------------------------------------------------- helpers */

function ensureLeafletCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-leaflet-anywidget="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  link.setAttribute("data-leaflet-anywidget", "1");
  document.head.appendChild(link);
}

function toRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // column-oriented dict
  const keys = Object.keys(raw);
  if (!keys.length) return [];
  const first = raw[keys[0]];
  if (Array.isArray(first)) {
    const n = first.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const o = {};
      for (const k of keys) o[k] = raw[k][i];
      out.push(o);
    }
    return out;
  }
  if (first && typeof first === "object") {
    // dict of dicts keyed by index
    const idx = Object.keys(first);
    return idx.map((i) => {
      const o = {};
      for (const k of keys) o[k] = raw[k][i];
      return o;
    });
  }
  return [];
}

function fmtClock(mins) {
  let m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

// parse OSM-ish opening_hours well enough to answer "open at minute-of-day"
function parseHours(str) {
  if (!str || typeof str !== "string") return null;
  const spans = [];
  for (const part of str.split(";")) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!m) {
      if (/24\/7/.test(seg)) spans.push([0, 1440]);
      continue;
    }
    const a = +m[1] * 60 + +m[2];
    let b = +m[3] * 60 + +m[4];
    if (b <= a) b += 1440;
    spans.push([a, b]);
  }
  return spans.length ? spans : null;
}

function openAt(spans, minute) {
  if (!spans) return null; // unknown
  for (const [a, b] of spans) {
    if (minute >= a && minute <= b) return true;
    if (minute + 1440 >= a && minute + 1440 <= b) return true;
  }
  return false;
}

function pointInPoly(pt, poly) {
  // pt [x,y]; poly list of [x,y]
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const hit =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function simplifyPath(pts, tol) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= tol) out.push(p);
  }
  if (out.length < 3) return pts;
  return out;
}

function nextRegionName(existing) {
  const used = new Set(existing.map((r) => r.name));
  for (let i = 0; i < 26 * 26; i++) {
    const nm =
      i < 26
        ? String.fromCharCode(65 + i)
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) +
          String.fromCharCode(65 + (i % 26));
    if (!used.has(nm)) return nm;
  }
  return "Z";
}

/* -------------------------------------------------------------- ClockDial */

export const ClockDial = ({
  React,
  leaveMin = 6 * 60,
  backByMin = 10 * 60,
  onChange,
  size = 208,
}) => {
  const ref = React.useRef(null);
  const liveRef = React.useRef({ leave: leaveMin, back: backByMin });
  const cbRef = React.useRef(onChange);
  cbRef.current = onChange;

  React.useEffect(() => {
    liveRef.current = { leave: leaveMin, back: backByMin };
  }, [leaveMin, backByMin]);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const W = size, H = size;
    const cx = W / 2, cy = H / 2;
    const rRim = size * 0.34;
    const rOut = size * 0.435;

    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", W)
      .attr("height", H)
      .style("display", "block");

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    const angle = (min) => ((min % 720) / 720) * 2 * Math.PI - Math.PI / 2;
    const pos = (min, r) => [Math.cos(angle(min)) * r, Math.sin(angle(min)) * r];

    g.append("circle")
      .attr("r", rRim)
      .attr("fill", "none")
      .attr("stroke", RULE)
      .attr("stroke-width", 1);

    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * 2 * Math.PI - Math.PI / 2;
      const inner = h % 3 === 0 ? rRim - 7 : rRim - 3.5;
      g.append("line")
        .attr("x1", Math.cos(a) * rRim)
        .attr("y1", Math.sin(a) * rRim)
        .attr("x2", Math.cos(a) * inner)
        .attr("y2", Math.sin(a) * inner)
        .attr("stroke", h % 3 === 0 ? "#b9b9b9" : "#e2e2e2")
        .attr("stroke-width", 1);
    }
    [12, 3, 6, 9].forEach((h) => {
      const a = ((h % 12) / 12) * 2 * Math.PI - Math.PI / 2;
      g.append("text")
        .attr("x", Math.cos(a) * (rRim - 18))
        .attr("y", Math.sin(a) * (rRim - 18) + 3.5)
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", MUTED)
        .text(h);
    });

    const arc = d3
      .arc()
      .innerRadius(rRim - 1.5)
      .outerRadius(rRim + 1.5);

    const windowArc = g
      .append("path")
      .attr("fill", INK)
      .attr("opacity", 0.55)
      .attr("pointer-events", "none");

    const leaveG = g.append("g").style("cursor", "grab");
    leaveG
      .append("circle")
      .attr("r", 11)
      .attr("fill", "transparent");
    leaveG
      .append("circle")
      .attr("r", 5)
      .attr("fill", BG)
      .attr("stroke", INK)
      .attr("stroke-width", 1.4);

    const backG = g.append("g").style("cursor", "grab");
    backG.append("circle").attr("r", 11).attr("fill", "transparent");
    backG
      .append("rect")
      .attr("x", -4)
      .attr("y", -4)
      .attr("width", 8)
      .attr("height", 8)
      .attr("fill", INK);

    const lblLeave = g
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", INK)
      .attr("pointer-events", "none");
    const lblBack = g
      .append("text")
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", INK)
      .attr("pointer-events", "none");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -4)
      .attr("font-size", 9)
      .attr("fill", MUTED)
      .attr("letter-spacing", "0.08em")
      .text("LEAVE / BACK BY");

    const center1 = g
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .attr("font-size", 12)
      .attr("fill", INK);

    function render() {
      const { leave, back } = liveRef.current;
      const a0 = angle(leave) + Math.PI / 2;
      let a1 = angle(back) + Math.PI / 2;
      if (a1 < a0) a1 += 2 * Math.PI;
      windowArc.attr("d", arc({ startAngle: a0, endAngle: a1 }));

      const pl = pos(leave, rRim);
      leaveG.attr("transform", `translate(${pl[0]},${pl[1]})`);
      const pb = pos(back, rOut);
      backG.attr("transform", `translate(${pb[0]},${pb[1]})`);

      const ll = pos(leave, rRim - 30);
      lblLeave.attr("x", ll[0]).attr("y", ll[1] + 3).text(fmtClock(leave));
      const lb = pos(back, rOut + 13);
      lblBack.attr("x", lb[0]).attr("y", lb[1] + 3).text(fmtClock(back));

      center1.text(`${fmtClock(leave)} → ${fmtClock(back)}`);
    }

    function minFromEvent(ev) {
      const [mx, my] = d3.pointer(ev, g.node());
      let a = Math.atan2(my, mx) + Math.PI / 2;
      a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let m = (a / (2 * Math.PI)) * 720;
      m = Math.round(m / 5) * 5;
      return m % 720;
    }

    function snapHalfDay(newHalf, prev) {
      // keep the am/pm half implied by previous value
      const base = Math.floor(prev / 720) * 720;
      const cand = base + newHalf;
      const alts = [cand - 720, cand, cand + 720].filter(
        (v) => v >= 0 && v < 1440
      );
      alts.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
      return alts.length ? alts[0] : cand;
    }

    const dragLeave = d3
      .drag()
      .on("start", () => leaveG.style("cursor", "grabbing"))
      .on("drag", (ev) => {
        const half = minFromEvent(ev.sourceEvent || ev);
        liveRef.current.leave = snapHalfDay(half, liveRef.current.leave);
        render();
      })
      .on("end", () => {
        leaveG.style("cursor", "grab");
        cbRef.current &&
          cbRef.current({ ...liveRef.current });
      });

    const dragBack = d3
      .drag()
      .on("start", () => backG.style("cursor", "grabbing"))
      .on("drag", (ev) => {
        const half = minFromEvent(ev.sourceEvent || ev);
        liveRef.current.back = snapHalfDay(half, liveRef.current.back);
        render();
      })
      .on("end", () => {
        backG.style("cursor", "grab");
        cbRef.current && cbRef.current({ ...liveRef.current });
      });

    leaveG.call(dragLeave);
    backG.call(dragBack);
    render();

    const raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      leaveG.on(".drag", null);
      backG.on(".drag", null);
      svg.remove();
    };
  }, [size]);

  return <div ref={ref} style={{ width: size, height: size }} />;
};

/* ------------------------------------------------------------ CountCircle */

export const CountCircle = ({
  React,
  total = 0,
  reachable = 0,
  label = "reachable",
  size = 208,
}) => {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const W = size, H = size;
    const cx = W / 2, cy = H / 2;
    const R = size * 0.36;

    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", W)
      .attr("height", H)
      .style("display", "block");
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    g.append("circle")
      .attr("r", R)
      .attr("fill", "none")
      .attr("stroke", RULE)
      .attr("stroke-width", 1);

    const frac = total ? Math.max(0, Math.min(1, reachable / total)) : 0;
    const y = R - 2 * R * frac;
    const halfW = Math.sqrt(Math.max(0, R * R - y * y));

    g.append("path")
      .attr(
        "d",
        `M ${-halfW} ${y} A ${R} ${R} 0 0 0 ${halfW} ${y} Z`
      )
      .attr("fill", INK)
      .attr("opacity", 0.08);

    g.append("line")
      .attr("x1", -halfW - 6)
      .attr("x2", halfW + 6)
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", INK)
      .attr("stroke-width", 1.2);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -6)
      .attr("font-size", 26)
      .attr("fill", INK)
      .text(reachable);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 12)
      .attr("font-size", 10)
      .attr("fill", MUTED)
      .text(`of ${total} ${label}`);

    return () => svg.remove();
  }, [size, total, reachable, label]);

  return <div ref={ref} style={{ width: size, height: size }} />;
};

/* ----------------------------------------------------------- RegionsTable */

export const RegionsTable = ({
  React,
  rows = [],
  onHover,
  hovered = null,
  colorFor,
}) => {
  const th = {
    textAlign: "left",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: MUTED,
    padding: "4px 10px 5px 0",
    borderBottom: `1px solid ${RULE}`,
    whiteSpace: "nowrap",
  };
  const td = {
    fontSize: 12,
    color: INK,
    padding: "5px 10px 5px 0",
    borderBottom: `1px solid #f0f0f0`,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          fontFamily:
            "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <thead>
          <tr>
            <th style={th}>region</th>
            <th style={th}>shops</th>
            <th style={th}>independent</th>
            <th style={th}>open on arrival</th>
            <th style={th}>earliest arrival</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td style={{ ...td, color: MUTED }} colSpan={5}>
                shift+drag on the map to lasso a region
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.name}
              onMouseEnter={() => onHover && onHover(r.name)}
              onMouseLeave={() => onHover && onHover(null)}
              style={{
                background: hovered === r.name ? "#f4f4f4" : "transparent",
                cursor: "default",
              }}
            >
              <td style={td}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    marginRight: 7,
                    background: colorFor ? colorFor(r.name) : INK,
                  }}
                />
                {r.name}
              </td>
              <td style={td}>{r.nShops}</td>
              <td style={td}>{r.nIndependent}</td>
              <td style={td}>
                {r.nOpen}
                {r.nUnknown ? (
                  <span style={{ color: MUTED }}> (+{r.nUnknown}?)</span>
                ) : null}
              </td>
              <td style={td}>
                {r.earliest == null ? (
                  <span style={{ color: MUTED }}>—</span>
                ) : (
                  <>
                    {fmtClock(r.earliest)}
                    <span style={{ color: MUTED }}> · {r.earliestName}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ----------------------------------------------------------- ModeSelector */

export const ModeSelector = ({ React, value, onChange, options = MODES }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {options.map((m) => (
      <button
        key={m.key}
        onClick={() => onChange && onChange(m.key)}
        style={{
          font: "inherit",
          fontSize: 11,
          padding: "3px 10px",
          border: `1px solid ${value === m.key ? INK : RULE}`,
          background: value === m.key ? INK : BG,
          color: value === m.key ? "#fff" : INK,
          borderRadius: 2,
          cursor: "pointer",
        }}
      >
        {m.label}
      </button>
    ))}
  </div>
);

/* ------------------------------------------------------------- the widget */

export default function Widget({ model, React }) {
  ensureLeafletCss();

  const rows = React.useMemo(() => toRows(model.get("data")), [model]);
  const [reach, setReach] = React.useState(() => model.get("reach") || {});
  const [mode, setMode] = React.useState("bike");
  const [clock, setClock] = React.useState({ leave: 6 * 60, back: 10 * 60 });
  const [regions, setRegions] = React.useState([]); // {name, latlngs:[[lat,lng],...]}
  const [hovered, setHovered] = React.useState(null);
  const [lassoActive, setLassoActive] = React.useState(false);

  const mapHostRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const overlayRef = React.useRef(null); // svg for lasso preview
  const regionLayerRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const regionsRef = React.useRef(regions);
  const hoveredRef = React.useRef(hovered);

  regionsRef.current = regions;
  hoveredRef.current = hovered;

  /* --- inputs subscription --- */
  React.useEffect(() => {
    const h = () => setReach(model.get("reach") || {});
    model.on("change:reach", h);
    return () => model.off("change:reach", h);
  }, [model]);

  /* --- derived per-row info --- */
  const modeDef = MODES.find((m) => m.key === mode) || MODES[1];
  const enriched = React.useMemo(() => {
    return rows.map((r, i) => {
      const out = Number(r[modeDef.out]);
      const back = Number(r[modeDef.back]);
      const arrive = clock.leave + (Number.isFinite(out) ? out : NaN);
      const returnBy = arrive + (Number.isFinite(back) ? back : NaN);
      const spans = parseHours(r.hours);
      const isOpen = Number.isFinite(arrive) ? openAt(spans, arrive) : null;
      return {
        i,
        name: r.name,
        lat: +r.lat,
        lon: +r.lon,
        chain: !!r.chain,
        kolache: !!r.kolache,
        hours: r.hours,
        note: r.note,
        outMin: out,
        backMin: back,
        arrive,
        returnBy,
        feasible: Number.isFinite(returnBy) && returnBy <= clock.back,
        isOpen,
      };
    });
  }, [rows, modeDef, clock.leave, clock.back]);

  const enrichedRef = React.useRef(enriched);
  enrichedRef.current = enriched;

  const colorFor = React.useCallback((name) => {
    const idx = regionsRef.current.findIndex((r) => r.name === name);
    return REGION_COLORS[(idx < 0 ? 0 : idx) % REGION_COLORS.length];
  }, []);

  /* --- region membership + table rows --- */
  const regionStats = React.useMemo(() => {
    return regions.map((reg) => {
      const poly = reg.latlngs.map(([la, ln]) => [ln, la]); // x=lon,y=lat
      const members = enriched.filter((d) =>
        pointInPoly([d.lon, d.lat], poly)
      );
      let earliest = null;
      let earliestName = "";
      let nOpen = 0;
      let nUnknown = 0;
      for (const m of members) {
        if (m.isOpen === true) nOpen++;
        else if (m.isOpen === null) nUnknown++;
        if (Number.isFinite(m.arrive) && (earliest == null || m.arrive < earliest)) {
          earliest = m.arrive;
          earliestName = m.name;
        }
      }
      return {
        name: reg.name,
        indices: members.map((m) => m.i),
        nShops: members.length,
        nIndependent: members.filter((m) => !m.chain).length,
        nOpen,
        nUnknown,
        earliest,
        earliestName,
      };
    });
  }, [regions, enriched]);

  /* --- output trait --- */
  React.useEffect(() => {
    const payload = {};
    for (const s of regionStats) payload[s.name] = s.indices;
    model.set("regions", payload);
    model.save_changes();
  }, [model, regionStats]);

  /* --- map creation: ONCE. never re-created on re-render --- */
  React.useEffect(() => {
    const host = mapHostRef.current;
    if (!host) return;

    const map = L.map(host, {
      center: [29.7492, -95.4267],
      zoom: 11,
      zoomControl: true,
      boxZoom: false, // shift+drag belongs to the lasso
      preferCanvas: false,
    });
    mapRef.current = map;

    const tiles = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap, &copy; CARTO",
        opacity: 0.85,
      }
    ).addTo(map);

    const reachLayer = L.layerGroup().addTo(map);
    const markerLayer = L.layerGroup().addTo(map);
    const regionLayer = L.layerGroup().addTo(map);
    reachLayerRef.current = reachLayer;
    markerLayerRef.current = markerLayer;
    regionLayerRef.current = regionLayer;

    // lasso preview svg pinned over the map pane
    const svgEl = d3
      .select(host)
      .append("svg")
      .attr("class", "lasso-overlay")
      .style("position", "absolute")
      .style("inset", "0")
      .style("width", "100%")
      .style("height", "100%")
      .style("pointer-events", "none")
      .style("z-index", 650);
    const lassoPath = svgEl
      .append("path")
      .attr("fill", "rgba(28,28,28,0.07)")
      .attr("stroke", INK)
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4 3")
      .attr("d", "");
    overlayRef.current = svgEl.node();

    // ---- lasso gesture: mousedown on container (capture) + window move/up
    const drag = { on: false, pts: [] };

    const containerPoint = (ev) => {
      const rect = host.getBoundingClientRect();
      return [ev.clientX - rect.left, ev.clientY - rect.top];
    };

    const onDown = (ev) => {
      if (!ev.shiftKey || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      drag.on = true;
      drag.pts = [containerPoint(ev)];
      map.dragging.disable();
      setLassoActive(true);
      lassoPath.attr("d", "");
    };

    const onMove = (ev) => {
      if (!drag.on) return;
      ev.preventDefault();
      const p = containerPoint(ev);
      const last = drag.pts[drag.pts.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 2) {
        drag.pts.push(p);
        lassoPath.attr(
          "d",
          "M" + drag.pts.map((q) => `${q[0]},${q[1]}`).join("L") + "Z"
        );
      }
    };

    const onUp = () => {
      if (!drag.on) return;
      drag.on = false;
      map.dragging.enable();
      setLassoActive(false);
      const pts = simplifyPath(drag.pts, 14);
      drag.pts = [];
      lassoPath.attr("d", "");
      if (pts.length < 3) return;
      const latlngs = pts.map((q) => {
        const ll = map.containerPointToLatLng(L.point(q[0], q[1]));
        return [ll.lat, ll.lng];
      });
      setRegions((prev) => [
        ...prev,
        { name: nextRegionName(prev), latlngs },
      ]);
    };

    host.addEventListener("mousedown", onDown, true);
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(host);
    const t = setTimeout(() => map.invalidateSize(), 60);

    return () => {
      clearTimeout(t);
      ro.disconnect();
      host.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      svgEl.remove();
      regionLayer.clearLayers();
      markerLayer.clearLayers();
      reachLayer.clearLayers();
      tiles.remove();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      regionLayerRef.current = null;
      markerLayerRef.current = null;
      reachLayerRef.current = null;
    };
  }, []); // <- map is created once; never re-created

  /* --- reach bands layer --- */
  React.useEffect(() => {
    const map = mapRef.current;
    const layer = reachLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const fc = reach && reach[modeDef.key];
    const added = [];
    if (fc && fc.features) {
      const feats = fc.features
        .slice()
        .sort(
          (a, b) =>
            (b.properties?.contour ?? 0) - (a.properties?.contour ?? 0)
        );
      for (const f of feats) {
        const gj = L.geoJSON(f, {
          style: (feat) => {
            const p = feat.properties || {};
            return {
              color: p.color || "#bf4040",
              weight: 0.8,
              opacity: 0.4,
              fillColor: p.fillColor || "#bf4040",
              fillOpacity: 0.1,
              interactive: false,
            };
          },
        });
        gj.addTo(layer);
        added.push(gj);
      }
    }
    return () => {
      added.forEach((g) => g.remove());
      layer.clearLayers();
    };
  }, [reach, modeDef.key]);

  /* --- shop markers layer (depends on data + clock + mode only) --- */
  React.useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const created = [];
    for (const d of enriched) {
      if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) continue;
      const open = d.isOpen;
      const m = L.circleMarker([d.lat, d.lon], {
        radius: d.feasible ? 5 : 3.2,
        color: d.feasible ? INK : "#b5b5b5",
        weight: 1,
        opacity: 0.9,
        fillColor:
          open === true ? INK : open === false ? "#ffffff" : "#d9d9d9",
        fillOpacity: open === true ? 0.85 : 0.9,
      });
      m.bindTooltip(
        `<div style="font:11px ui-sans-serif,sans-serif;color:${INK}">
           <b>${d.name}</b><br/>
           arrive ${Number.isFinite(d.arrive) ? fmtClock(d.arrive) : "—"} ·
           back ${Number.isFinite(d.returnBy) ? fmtClock(d.returnBy) : "—"}<br/>
           <span style="color:${MUTED}">${d.chain ? "chain" : "independent"}${
          d.kolache ? " · kolaches" : ""
        }${
          open === true ? " · open" : open === false ? " · closed" : " · hours ?"
        }</span>
         </div>`,
        { direction: "top", opacity: 0.97, sticky: true }
      );
      m.addTo(layer);
      created.push(m);
    }

    // sparse arrival labels: the few earliest feasible arrivals
    const labelled = enriched
      .filter((d) => d.feasible && Number.isFinite(d.arrive))
      .sort((a, b) => a.arrive - b.arrive)
      .slice(0, 6);
    for (const d of labelled) {
      const lm = L.marker([d.lat, d.lon], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [90, 14],
          iconAnchor: [-7, 7],
          html: `<div style="font:10px ui-sans-serif,sans-serif;color:${INK};
                   white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff">
                   ${fmtClock(d.arrive)}</div>`,
        }),
      });
      lm.addTo(layer);
      created.push(lm);
    }

    return () => {
      created.forEach((m) => m.remove());
      layer.clearLayers();
    };
  }, [enriched]);

  /* --- region polygons + vertex handles (rebuilt only on region geometry) --- */
  React.useEffect(() => {
    const map = mapRef.current;
    const layer = regionLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const created = [];

    regions.forEach((reg, ri) => {
      const color = REGION_COLORS[ri % REGION_COLORS.length];
      const poly = L.polygon(reg.latlngs, {
        color,
        weight: 1.4,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: hoveredRef.current === reg.name ? 0.2 : 0.07,
      });
      poly.addTo(layer);
      poly._regionName = reg.name;
      created.push(poly);

      poly.on("mouseover", () => setHovered(reg.name));
      poly.on("mouseout", () => setHovered(null));
      poly.on("dblclick", (ev) => {
        L.DomEvent.stopPropagation(ev);
        L.DomEvent.preventDefault(ev);
        setRegions((prev) => prev.filter((r) => r.name !== reg.name));
      });

      // name label at centroid
      const c = poly.getBounds().getCenter();
      const lbl = L.marker(c, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [18, 16],
          iconAnchor: [9, 8],
          html: `<div style="font:11px ui-sans-serif,sans-serif;color:${color};
                   font-weight:600;text-align:center;
                   text-shadow:0 0 3px #fff,0 0 3px #fff">${reg.name}</div>`,
        }),
      });
      lbl.addTo(layer);
      created.push(lbl);

      // draggable vertex handles
      reg.latlngs.forEach((ll, vi) => {
        const h = L.circleMarker(ll, {
          radius: 4,
          color,
          weight: 1.2,
          fillColor: "#fff",
          fillOpacity: 1,
          bubblingMouseEvents: false,
        });
        h.addTo(layer);
        created.push(h);

        let dragging = false;
        const onHDown = (ev) => {
          L.DomEvent.stopPropagation(ev);
          L.DomEvent.preventDefault(ev);
          dragging = true;
          map.dragging.disable();
          if (h._path) h._path.style.cursor = "grabbing";
        };
        const onMapMove = (ev) => {
          if (!dragging) return;
          h.setLatLng(ev.latlng);
          const pts = poly.getLatLngs()[0].slice();
          pts[vi] = ev.latlng;
          poly.setLatLngs(pts);
        };
        const onMapUp = () => {
          if (!dragging) return;
          dragging = false;
          map.dragging.enable();
          if (h._path) h._path.style.cursor = "grab";
          const ll2 = h.getLatLng();
          setRegions((prev) =>
            prev.map((r) =>
              r.name === reg.name
                ? {
                    ...r,
                    latlngs: r.latlngs.map((p, k) =>
                      k === vi ? [ll2.lat, ll2.lng] : p
                    ),
                  }
                : r
            )
          );
        };

        h.on("mousedown", onHDown);
        map.on("mousemove", onMapMove);
        map.on("mouseup", onMapUp);
        if (h._path) h._path.style.cursor = "grab";

        created.push({
          remove: () => {
            h.off("mousedown", onHDown);
            map.off("mousemove", onMapMove);
            map.off("mouseup", onMapUp);
          },
        });
      });
    });

    return () => {
      created.forEach((c) => {
        try {
          c.remove();
        } catch (e) {
          /* noop */
        }
      });
      layer.clearLayers();
    };
  }, [regions]);

  /* --- hover highlight: imperative, no rebuild --- */
  React.useEffect(() => {
    const layer = regionLayerRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      if (l._regionName) {
        const on = hovered === l._regionName;
        l.setStyle({ fillOpacity: on ? 0.2 : 0.07, weight: on ? 2.2 : 1.4 });
      }
    });
    return () => {};
  }, [hovered]);

  const feasibleCount = enriched.filter((d) => d.feasible).length;
  const openCount = enriched.filter((d) => d.feasible && d.isOpen === true).length;

  return (
    <section
      style={{
        fontFamily:
          "ui-sans-serif, -apple-system, 'Helvetica Neue', Arial, sans-serif",
        color: INK,
        background: BG,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          borderBottom: `1px solid ${RULE}`,
          paddingBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 13, letterSpacing: "0.02em" }}>
            Donut run · reachable shops
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
            shift+drag to lasso a region · drag vertices to reshape ·
            double-click inside to delete
          </div>
        </div>
        <ModeSelector React={React} value={mode} onChange={setMode} />
      </header>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div
            ref={mapHostRef}
            style={{
              position: "relative",
              height: 420,
              width: "100%",
              border: `1px solid ${RULE}`,
              background: "#fafafa",
              cursor: lassoActive ? "crosshair" : "grab",
            }}
          />
        </div>

        <div
          style={{
            flex: "0 0 216px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            alignItems: "center",
          }}
        >
          <ClockDial
            React={React}
            leaveMin={clock.leave}
            backByMin={clock.back}
            onChange={({ leave, back }) => setClock({ leave, back })}
          />
          <div
            style={{
              width: "100%",
              height: 1,
              background: RULE,
              margin: "2px 0 2px",
            }}
          />
          <CountCircle
            React={React}
            total={enriched.length}
            reachable={feasibleCount}
            label="in window"
          />
          <div style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
            {openCount} open on arrival · {modeDef.label}
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 8 }}>
        <RegionsTable
          React={React}
          rows={regionStats}
          hovered={hovered}
          onHover={setHovered}
          colorFor={colorFor}
        />
      </div>
    </section>
  );
}