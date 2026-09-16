import L from "https://esm.sh/leaflet@1.9.4";

/* ------------------------------------------------------------------ *
 * helpers (pure, module level — no React here)
 * ------------------------------------------------------------------ */

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const INK = "#18181b";
const ACCENT = "#d9480f";
const RED = "#b91c1c";
const GREEN = "#15803d";
const GREY = "#52525b";
const MODES = ["walk", "bike", "drive"];

const REGION_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#4d7c0f",
  "#0369a1",
  "#9333ea",
];

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

const pad2 = (n) => String(n).padStart(2, "0");

function fmtHHMM(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ":" + pad2(m % 60);
}

function toMin(hhmm) {
  const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function expandDays(spec) {
  const out = [];
  spec.split(",").forEach((tok) => {
    const t = tok.trim();
    const parts = t.split("-").map((x) => x.trim());
    if (parts.length === 2) {
      const a = DAY_NAMES.indexOf(parts[0]);
      const b = DAY_NAMES.indexOf(parts[1]);
      if (a < 0 || b < 0) return;
      let i = a;
      for (let guard = 0; guard < 8; guard++) {
        out.push(i);
        if (i === b) break;
        i = (i + 1) % 7;
      }
    } else {
      const a = DAY_NAMES.indexOf(parts[0]);
      if (a >= 0) out.push(a);
    }
  });
  return out;
}

/* returns null for unknown, else array[7] of [start,end] minute pairs */
function parseHours(text) {
  if (text === null || text === undefined) return null;
  const t = String(text).trim();
  if (!t) return null;
  if (/24\s*\/\s*7/.test(t) || /^24h$/i.test(t)) {
    return DAY_NAMES.map(() => [[0, 1440]]);
  }
  const perDay = [[], [], [], [], [], [], []];
  let any = false;
  const dayRe =
    /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/;
  t.split(";").forEach((chunk) => {
    let s = chunk.trim();
    if (!s) return;
    if (/^(?:.*\s)?(off|closed)$/i.test(s)) return;
    let days = [0, 1, 2, 3, 4, 5, 6];
    let timePart = s;
    const m = s.match(dayRe);
    if (m) {
      const d = expandDays(m[1]);
      if (d.length) days = d;
      timePart = m[2];
    }
    if (/24\s*\/\s*7/.test(timePart)) {
      days.forEach((d) => perDay[d].push([0, 1440]));
      any = true;
      return;
    }
    const ranges = timePart.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g) || [];
    if (!ranges.length) return;
    ranges.forEach((r) => {
      const [a, b] = r.split("-").map((x) => x.trim());
      const s0 = toMin(a);
      const s1 = toMin(b);
      if (s0 === null || s1 === null) return;
      days.forEach((d) => perDay[d].push([s0, s1]));
      any = true;
    });
  });
  return any ? perDay : null;
}

function isOpenAt(perDay, day, mins) {
  if (!perDay) return false;
  const d = ((day % 7) + 7) % 7;
  const prev = (d + 6) % 7;
  const hit = (list, t) =>
    list.some(([s, e]) => (e > s ? t >= s && t < e : t >= s || t < e));
  if (hit(perDay[d], mins)) return true;
  return perDay[prev].some(([s, e]) => e <= s && mins < e);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeData(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.columns && Array.isArray(raw.data)) {
    return raw.data.map((row) => {
      const obj = {};
      raw.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
  if (typeof raw === "object") {
    const cols = Object.keys(raw);
    if (!cols.length) return [];
    const first = raw[cols[0]];
    if (Array.isArray(first)) {
      return first.map((_, i) => {
        const obj = {};
        cols.forEach((c) => {
          obj[c] = raw[c][i];
        });
        return obj;
      });
    }
  }
  return [];
}

function getPerimeterLatLng(centerLat, centerLon, radiusMeters, angleRad) {
  const dLat = (radiusMeters * Math.cos(angleRad)) / 111139;
  const dLon =
    (radiusMeters * Math.sin(angleRad)) /
    (111139 * Math.cos((centerLat * Math.PI) / 180));
  return [centerLat + dLat, centerLon + dLon];
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* polygon hit test in screen (or lat/lng) space */
function pointInPoly(pt, poly) {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const nextRegionName = (used) => {
  for (let i = 0; i < 26 * 26; i++) {
    const nm =
      i < 26
        ? String.fromCharCode(65 + i)
        : String.fromCharCode(65 + Math.floor(i / 26) - 1) +
          String.fromCharCode(65 + (i % 26));
    if (!used.has(nm)) return nm;
  }
  return "Z";
};

/* dial geometry ---------------------------------------------------- */
const degOf = (mins) => ((((mins % 720) + 720) % 720) / 720) * 360;
const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
function arcPath(cx, cy, r, a0, a1) {
  if (!(a1 > a0 + 1e-6)) return "";
  const [sx, sy] = polar(cx, cy, r, a0);
  let d = `M ${sx.toFixed(2)} ${sy.toFixed(2)}`;
  let cur = a0;
  while (cur < a1 - 1e-6) {
    const next = Math.min(cur + 90, a1);
    const [x, y] = polar(cx, cy, r, next);
    d += ` A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    cur = next;
  }
  return d;
}
function wedgePath(cx, cy, r, a0, sweep) {
  const s = Math.max(0, Math.min(sweep, 359.99));
  if (s < 0.3) return "";
  const [sx, sy] = polar(cx, cy, r, a0);
  let d = `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)}`;
  let cur = a0;
  const end = a0 + s;
  while (cur < end - 1e-6) {
    const next = Math.min(cur + 90, end);
    const [x, y] = polar(cx, cy, r, next);
    d += ` A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    cur = next;
  }
  return d + " Z";
}
function timeFromAngle(cur, deg) {
  const m12 = (Math.round(((deg / 360) * 720) / 5) * 5) % 720;
  const cur12 = ((cur % 720) + 720) % 720;
  let diff = m12 - cur12;
  while (diff > 360) diff -= 720;
  while (diff <= -360) diff += 720;
  return (((cur + diff) % 1440) + 1440) % 1440;
}
const wrapDay = (m) => (((m % 1440) + 1440) % 1440);

/* route helpers ---------------------------------------------------- */
function routeFor(routes, mode, row) {
  if (!routes || typeof routes !== "object") return null;
  const byMode = routes[mode];
  if (!byMode) return null;
  let seq = null;
  if (Array.isArray(byMode)) seq = byMode[row];
  else if (typeof byMode === "object") seq = byMode[row] || byMode[String(row)];
  if (!Array.isArray(seq) || seq.length < 2) return null;
  const pts = seq
    .map((p) =>
      Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null
    )
    .filter((p) => p && isFinite(p[0]) && isFinite(p[1]));
  return pts.length >= 2 ? pts : null;
}

/* cumulative-length midpoint of a polyline, plus local direction */
function polylineMidpoint(pts) {
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(d);
    total += d;
  }
  if (total <= 0) return { pt: pts[0], idx: 0 };
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total / 2) {
      const t = segs[i] > 0 ? (total / 2 - acc) / segs[i] : 0;
      const a = pts[i];
      const b = pts[i + 1];
      return {
        pt: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        idx: i,
        a,
        b,
      };
    }
    acc += segs[i];
  }
  return { pt: pts[pts.length - 1], idx: segs.length - 1 };
}

/* ------------------------------------------------------------------ *
 * standalone components
 * ------------------------------------------------------------------ */

export const MapStatsBadge = ({ countInside, countIndependent, countOpen }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 6,
      padding: "6px 12px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      fontWeight: 500,
      color: INK,
      letterSpacing: "-0.01em",
      pointerEvents: "none",
      userSelect: "none",
      whiteSpace: "nowrap",
    }}
  >
    <span style={{ fontWeight: 600 }}>{countInside}</span> inside
    <span style={{ margin: "0 6px", color: "#71717a" }}>·</span>
    <span style={{ fontWeight: 600, color: ACCENT }}>{countIndependent}</span>{" "}
    independent
    <span style={{ margin: "0 6px", color: "#71717a" }}>·</span>
    <span style={{ fontWeight: 600, color: GREEN }}>{countOpen}</span> open and
    back in time
  </div>
);

export const LassoHint = ({ active }) => (
  <div
    style={{
      position: "absolute",
      bottom: 10,
      left: 14,
      zIndex: 1000,
      pointerEvents: "none",
      userSelect: "none",
      background: "rgba(255,255,255,0.9)",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 5,
      padding: "3px 8px",
      font: "500 10.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      letterSpacing: "0.02em",
      color: active ? INK : "#3f3f46",
    }}
  >
    {active
      ? "drawing lasso…"
      : "shift + drag = lasso · double-click a region to delete"}
  </div>
);

export const ModeSwitch = ({ React, mode, setMode }) => {
  const [hover, setHover] = React.useState(null);
  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return (
    <div
      role="radiogroup"
      aria-label="travel mode"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        border: "1px solid #d4d4d8",
        borderRadius: 6,
        overflow: "hidden",
        margin: "0 8px 2px",
        background: "#fff",
      }}
    >
      {MODES.map((m, i) => {
        const on = m === mode;
        return (
          <button
            key={m}
            role="radio"
            aria-checked={on}
            onClick={() => setMode(m)}
            onMouseEnter={() => setHover(m)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: "1 1 0",
              height: 26,
              padding: 0,
              cursor: "pointer",
              border: "none",
              borderLeft: i === 0 ? "none" : "1px solid #e4e4e7",
              background: on ? INK : hover === m ? "#f4f4f5" : "#fff",
              color: on ? "#fafafa" : "#3f3f46",
              font:
                (on ? "600 " : "500 ") +
                "11px/1 " +
                fontStack,
              letterSpacing: "0.06em",
              textTransform: "lowercase",
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
};

export const VerdictLines = ({
  React,
  leaveMin,
  targetName,
  arriveMin,
  status,
  dwellMin,
  backHomeMin,
  backByMin,
  hasTarget,
}) => {
  if (!hasTarget) {
    return (
      <div
        style={{
          margin: "6px 10px 0",
          font: "400 11px/1.55 " + MONO,
          color: "#3f3f46",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        no target — click a shop on the map
      </div>
    );
  }
  const backAbs = backByMin + (backByMin <= leaveMin ? 1440 : 0);
  const diff = Math.round(backAbs - backHomeMin);
  const ok = diff >= 0;
  const line1 =
    fmtHHMM(leaveMin) +
    " → " +
    String(targetName || "—").toLowerCase() +
    " " +
    fmtHHMM(arriveMin) +
    ", " +
    status +
    " · " +
    dwellMin +
    " min · back " +
    fmtHHMM(backHomeMin);
  const line2 =
    Math.abs(diff) +
    (ok ? " min before " : " min after ") +
    fmtHHMM(backByMin);
  const base = {
    font: "400 11px/1.55 " + MONO,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
  return (
    <div style={{ margin: "6px 10px 0" }}>
      <div style={{ ...base, color: INK }}>{line1}</div>
      <div style={{ ...base, color: ok ? GREEN : RED, fontWeight: 600 }}>
        {line2}
      </div>
    </div>
  );
};

export const DayRow = ({ React, day, setDay }) => {
  const [hover, setHover] = React.useState(-1);
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {DAY_NAMES.map((d, i) => {
        const on = i === day;
        return (
          <button
            key={d}
            onClick={() => setDay(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(-1)}
            style={{
              width: 30,
              height: 22,
              padding: 0,
              cursor: "pointer",
              borderRadius: 4,
              border: "1px solid " + (on ? INK : "#d4d4d8"),
              background: on ? INK : hover === i ? "#f4f4f5" : "#fff",
              color: on ? "#fafafa" : "#3f3f46",
              font: "500 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              letterSpacing: "0.02em",
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
};

export const RegionTable = ({ React, rows, onHover, onDelete, colorOf }) => {
  const [hoverName, setHoverName] = React.useState(null);
  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const th = {
    textAlign: "left",
    font: "500 9.5px " + fontStack,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#3f3f46",
    padding: "0 8px 4px 0",
    borderBottom: "1px solid #e4e4e7",
    whiteSpace: "nowrap",
  };
  const td = {
    font: "400 11.5px " + fontStack,
    color: INK,
    padding: "4px 8px 4px 0",
    borderBottom: "1px solid #f4f4f5",
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        border: "1px solid #e4e4e7",
        borderRadius: 8,
        background: "#fff",
        padding: "8px 10px",
        overflow: "auto",
        maxHeight: 150,
      }}
    >
      {rows.length === 0 ? (
        <div style={{ font: "400 11.5px " + fontStack, color: "#3f3f46" }}>
          no regions yet — hold <b>shift</b> and drag on the map to lasso one
        </div>
      ) : (
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...th, width: 54 }}>region</th>
              <th style={th}>shops</th>
              <th style={th}>independent</th>
              <th style={th}>open on arrival</th>
              <th style={th}>earliest arrival</th>
              <th style={{ ...th, width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hot = hoverName === r.name;
              return (
                <tr
                  key={r.name}
                  onMouseEnter={() => {
                    setHoverName(r.name);
                    onHover(r.name);
                  }}
                  onMouseLeave={() => {
                    setHoverName(null);
                    onHover(null);
                  }}
                  style={{ background: hot ? "#f4f4f5" : "transparent" }}
                >
                  <td style={{ ...td, fontWeight: 600 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: colorOf(r.name),
                        marginRight: 6,
                      }}
                    />
                    {r.name}
                  </td>
                  <td style={td}>{r.nShops}</td>
                  <td style={{ ...td, color: r.nIndep ? ACCENT : INK }}>
                    {r.nIndep}
                  </td>
                  <td style={{ ...td, color: r.nOpen ? GREEN : INK }}>
                    {r.nOpen}
                  </td>
                  <td style={td}>
                    {r.earliest == null ? "—" : fmtHHMM(r.earliest)}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => onDelete(r.name)}
                      title={"delete region " + r.name}
                      style={{
                        cursor: "pointer",
                        border: "1px solid #d4d4d8",
                        background: "#fff",
                        borderRadius: 4,
                        width: 18,
                        height: 18,
                        padding: 0,
                        font: "500 11px/1 " + fontStack,
                        color: "#3f3f46",
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export const TimeDial = ({
  React,
  width = 340,
  height = 316,
  leaveMin,
  backMin,
  setLeave,
  setBack,
  day,
  setDay,
  targetName,
  tripMin,
  toMinutes,
  backHomeMin,
  hasTarget,
  mode,
  setMode,
}) => {
  const svgRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const lastRef = React.useRef("leave");
  const [focused, setFocused] = React.useState(false);

  const cx = width / 2;
  const cy = 150;
  const R = 92;
  const R_BACK = R + 14;

  const leaveDeg = degOf(leaveMin);
  const backDeg = degOf(backMin);
  const backAbs = backMin + (backMin <= leaveMin ? 1440 : 0);
  const haveMin = backAbs - leaveMin;

  const [lhx, lhy] = polar(cx, cy, R, leaveDeg);
  const [bhx, bhy] = polar(cx, cy, R_BACK, backDeg);

  React.useEffect(() => {
    const localPoint = (ev) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      const sx = width / r.width;
      const sy = height / r.height;
      return [(ev.clientX - r.left) * sx, (ev.clientY - r.top) * sy];
    };
    const onMove = (e) => {
      const which = dragRef.current;
      if (!which) return;
      const ev = e.touches ? e.touches[0] : e;
      if (!ev) return;
      const p = localPoint(ev);
      if (!p) return;
      if (e.cancelable && e.touches) e.preventDefault();
      const deg =
        ((Math.atan2(p[0] - cx, -(p[1] - cy)) * 180) / Math.PI + 360) % 360;
      if (which === "leave") setLeave((cur) => timeFromAngle(cur, deg));
      else setBack((cur) => timeFromAngle(cur, deg));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      dragRef.current = null;
    };
  }, [cx, cy, width, height, setLeave, setBack]);

  const startDrag = (clientX, clientY, preventFn) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = (clientX - r.left) * (width / r.width);
    const y = (clientY - r.top) * (height / r.height);
    const dL = Math.hypot(x - lhx, y - lhy);
    const dB = Math.hypot(x - bhx, y - bhy);
    let which = null;
    if (dL <= 18 || dB <= 18) which = dL <= dB ? "leave" : "back";
    if (which) {
      preventFn();
      dragRef.current = which;
      lastRef.current = which;
      svg.focus();
    }
  };

  const onMouseDown = (e) =>
    startDrag(e.clientX, e.clientY, () => e.preventDefault());
  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (t) startDrag(t.clientX, t.clientY, () => e.preventDefault());
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const d = e.key === "ArrowLeft" ? -15 : 15;
      const set = lastRef.current === "back" ? setBack : setLeave;
      set((cur) => wrapDay(cur + d));
    }
  };

  const tripSweep = Math.min(Math.max(tripMin || 0, 0), 715) / 2;
  const okSweep =
    Math.min(Math.max(Math.min(tripMin || 0, Math.max(haveMin, 0)), 0), 715) / 2;
  const arriveDeg = degOf(leaveMin + (toMinutes || 0));
  const [atx, aty] = polar(cx, cy, R - 13, arriveDeg);
  const [atx2, aty2] = polar(cx, cy, R - 2, arriveDeg);
  const [alx, aly] = polar(cx, cy, R - 26, arriveDeg);

  const homeDeg = degOf(backHomeMin || 0);
  const [hbx, hby] = polar(cx, cy, R + 7, homeDeg);

  const [llx, lly] = polar(cx, cy, R + 32, leaveDeg);
  const [blx, bly] = polar(cx, cy, R + 52, backDeg);
  const [lsx, lsy] = polar(cx, cy, R * 0.34, leaveDeg);
  const [bsx, bsy] = polar(cx, cy, R * 0.34, backDeg);

  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        fontFamily: fontStack,
      }}
    >
      <ModeSwitch React={React} mode={mode} setMode={setMode} />

      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "center",
          fontSize: 10.5,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#3f3f46",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: 7,
              background: INK,
              marginRight: 5,
            }}
          />
          leave
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: 7,
              background: ACCENT,
              marginRight: 5,
            }}
          />
          back by
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: 7,
              background: "#fff",
              border: "1.4px solid " + INK,
              marginRight: 5,
            }}
          />
          back
        </span>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        tabIndex={0}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: "block",
          outline: "none",
          touchAction: "none",
          cursor: "default",
          background: "transparent",
          borderRadius: 8,
          boxShadow: focused ? "inset 0 0 0 1px #d4d4d8" : "none",
        }}
      >
        <path
          d={wedgePath(cx, cy, R - 14, leaveDeg, haveMin / 2)}
          fill={INK}
          fillOpacity={0.07}
        />

        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#d4d4d8"
          strokeWidth={1}
        />

        {Array.from({ length: 12 }, (_, i) => {
          const d = i * 30;
          const major = i % 3 === 0;
          const [x1, y1] = polar(cx, cy, R - (major ? 8 : 5), d);
          const [x2, y2] = polar(cx, cy, R, d);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? "#a1a1aa" : "#e4e4e7"}
              strokeWidth={major ? 1.2 : 1}
            />
          );
        })}
        {[
          ["12", 0],
          ["3", 90],
          ["6", 180],
          ["9", 270],
        ].map(([lab, d]) => {
          const [x, y] = polar(cx, cy, R - 22, d);
          return (
            <text
              key={lab}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ font: "500 10px " + fontStack, fill: "#52525b" }}
            >
              {lab}
            </text>
          );
        })}

        {hasTarget && tripSweep > 0 && (
          <g>
            <path
              d={arcPath(cx, cy, R - 6, leaveDeg, leaveDeg + okSweep)}
              fill="none"
              stroke={INK}
              strokeWidth={1.6}
              strokeLinecap="butt"
            />
            {tripSweep > okSweep + 0.05 && (
              <path
                d={arcPath(
                  cx,
                  cy,
                  R - 6,
                  leaveDeg + okSweep,
                  leaveDeg + tripSweep
                )}
                fill="none"
                stroke={RED}
                strokeWidth={1.8}
                strokeLinecap="butt"
              />
            )}
            <line
              x1={atx}
              y1={aty}
              x2={atx2}
              y2={aty2}
              stroke={INK}
              strokeWidth={1.1}
            />
            <text
              x={alx}
              y={aly}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                font: "500 9.5px " + fontStack,
                fill: INK,
                paintOrder: "stroke",
                stroke: "#fff",
                strokeWidth: 3,
              }}
            >
              {fmtHHMM(leaveMin + (toMinutes || 0))}
            </text>
          </g>
        )}

        {hasTarget && (
          <circle
            cx={hbx}
            cy={hby}
            r={4.2}
            fill="#fff"
            stroke={INK}
            strokeWidth={1.4}
          />
        )}

        <line
          x1={lsx}
          y1={lsy}
          x2={lhx}
          y2={lhy}
          stroke={INK}
          strokeWidth={1.4}
        />
        <circle
          cx={lhx}
          cy={lhy}
          r={6}
          fill={INK}
          stroke="#fff"
          strokeWidth={1.6}
          style={{ cursor: "grab" }}
        />
        <text
          x={llx}
          y={lly}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            font: "600 11px " + fontStack,
            fill: INK,
            paintOrder: "stroke",
            stroke: "#fff",
            strokeWidth: 3.5,
          }}
        >
          {fmtHHMM(leaveMin)}
        </text>

        <line
          x1={bsx}
          y1={bsy}
          x2={bhx}
          y2={bhy}
          stroke={ACCENT}
          strokeWidth={1.2}
          strokeDasharray="3,3"
          opacity={0.85}
        />
        <circle
          cx={bhx}
          cy={bhy}
          r={6}
          fill={ACCENT}
          stroke="#fff"
          strokeWidth={1.6}
          style={{ cursor: "grab" }}
        />
        <text
          x={blx}
          y={bly}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            font: "600 11px " + fontStack,
            fill: ACCENT,
            paintOrder: "stroke",
            stroke: "#fff",
            strokeWidth: 3.5,
          }}
        >
          {fmtHHMM(backMin)}
        </text>

        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ font: "500 10.5px " + fontStack, fill: "#3f3f46" }}
        >
          {Math.floor(Math.max(haveMin, 0) / 60)}h {Math.max(haveMin, 0) % 60}m
        </text>
      </svg>

      <div
        style={{
          fontSize: 11.5,
          color: INK,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          padding: "0 6px",
        }}
        title={targetName || ""}
      >
        <span style={{ color: "#52525b", marginRight: 6 }}>target</span>
        {targetName || "—"}
      </div>

      <DayRow React={React} day={day} setDay={setDay} />

      <div
        style={{
          fontSize: 10,
          color: "#52525b",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        drag a handle · ← → nudges 15 min
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * leaflet styling (imperative, never rebuilds the map)
 * ------------------------------------------------------------------ */

function statusColor(status) {
  return status === "open" ? GREEN : status === "closed" ? RED : GREY;
}

function labelIcon(txt, color, alpha) {
  return L.divIcon({
    className: "shop-time-label",
    html:
      `<div style="transform:translate(8px,-15px);white-space:nowrap;` +
      `font:600 10px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;` +
      `color:${color};opacity:${alpha};text-shadow:0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff;">${txt}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const EMPTY_ICON = L.divIcon({
  className: "shop-time-label",
  html: "",
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const VERTEX_ICON = (color) =>
  L.divIcon({
    className: "region-vertex",
    html: `<div style="width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:9px;background:#fff;border:1.6px solid ${color};box-shadow:0 1px 2px rgba(0,0,0,0.18);cursor:move;"></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

function routeLabelIcon(txt, dx, dy) {
  return L.divIcon({
    className: "route-min-label",
    html:
      `<div style="transform:translate(${dx}px,${dy}px);white-space:nowrap;` +
      `font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;` +
      `color:${ACCENT};background:rgba(255,255,255,0.94);border:1px solid rgba(0,0,0,0.08);` +
      `border-radius:3px;padding:1px 5px;box-shadow:0 1px 3px rgba(0,0,0,0.10);">${txt}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function applyStyles(els, derived, targetIdx) {
  if (!els || !els.shopRecords) return;
  els.shopRecords.forEach((rec) => {
    const d = derived.rows[rec.index];
    if (!d) return;
    const isTarget = rec.index === targetIdx;
    if (!d.inside) {
      rec.marker.setStyle({
        radius: isTarget ? 5 : 3.5,
        fillColor: "#94a3b8",
        color: isTarget ? INK : "#94a3b8",
        weight: isTarget ? 2.5 : 0,
        fillOpacity: 0.3,
        opacity: isTarget ? 0.8 : 0.3,
        dashArray: null,
      });
      rec.label.setIcon(EMPTY_ICON);
      return;
    }
    const base = d.shop.chain ? "#52525b" : ACCENT;
    let st;
    if (d.status === "open") {
      st = {
        radius: 6,
        fillColor: base,
        color: "#ffffff",
        weight: 1.5,
        fillOpacity: 1,
        opacity: 1,
        dashArray: null,
      };
    } else if (d.status === "closed") {
      st = {
        radius: 5.5,
        fillColor: "#ffffff",
        color: base,
        weight: 1.8,
        fillOpacity: 0.95,
        opacity: 1,
        dashArray: null,
      };
    } else {
      st = {
        radius: 5.5,
        fillColor: "#ffffff",
        color: base,
        weight: 1.5,
        fillOpacity: 0.8,
        opacity: 1,
        dashArray: "2,2",
      };
    }
    if (!d.fits) {
      st.fillOpacity = st.fillOpacity * 0.35;
      st.opacity = 0.35;
    }
    if (isTarget) {
      st.weight = 3.5;
      st.color = INK;
      st.radius = st.radius + 2.5;
    }
    rec.marker.setStyle(st);
    rec.marker.bringToFront();
    rec.label.setIcon(
      labelIcon(fmtHHMM(d.arrive), statusColor(d.status), d.fits ? 1 : 0.4)
    );
  });
  if (els.visualCircle) els.visualCircle.bringToFront();
}

/* rebuild the reach bands for a given mode (imperative) */
function buildReachLayers(map, reach, mode) {
  const src = reach && reach[mode] ? reach[mode] : null;
  const feats = src
    ? src.features || (src.type === "Feature" ? [src] : [])
    : [];
  const sorted = feats
    .slice()
    .sort(
      (a, b) =>
        Number((b.properties || {}).contour || 0) -
        Number((a.properties || {}).contour || 0)
    );
  const targets = [0.06, 0.09, 0.12];
  let prevAlpha = 0;
  const layers = [];
  sorted.forEach((f, i) => {
    const t = targets[Math.min(i, targets.length - 1)];
    const a = prevAlpha >= 1 ? 0 : (t - prevAlpha) / (1 - prevAlpha);
    prevAlpha = t;
    const lyr = L.geoJSON(f, {
      pane: "reachPane",
      interactive: false,
      style: {
        color: "#5b7290",
        weight: 0,
        fillColor: "#5b7290",
        fillOpacity: Math.max(a, 0),
        opacity: 0,
      },
    }).addTo(map);
    layers.push(lyr);
  });
  return layers;
}

/* ------------------------------------------------------------------ *
 * widget
 * ------------------------------------------------------------------ */

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => normalizeData(model.get("data")));
  const [reach, setReach] = React.useState(() => model.get("reach") || {});
  const [routes, setRoutes] = React.useState(() => model.get("routes") || {});
  const [mode, setMode] = React.useState("bike");
  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backMin, setBackMin] = React.useState(8 * 60 + 45);
  const [day, setDay] = React.useState(1); // Tu
  const [target, setTarget] = React.useState(2);
  const [radiusKm, setRadiusKm] = React.useState(3.5);
  const [regions, setRegions] = React.useState([]);
  const [lassoActive, setLassoActive] = React.useState(false);

  const DWELL = 10;

  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const elementsRef = React.useRef({ shopRecords: [] });
  const dragActiveRef = React.useRef(false);
  const dragAngleRef = React.useRef(0.65);
  const derivedRef = React.useRef(null);
  const targetRef = React.useRef(target);
  const regionLayersRef = React.useRef(new Map());
  const reachLayersRef = React.useRef([]);
  const routeLayerRef = React.useRef(null);
  const routeLabelRef = React.useRef(null);
  const hoverRegionRef = React.useRef(null);
  const setRegionsRef = React.useRef(setRegions);
  setRegionsRef.current = setRegions;
  targetRef.current = target;

  const hotelLat = 29.7522;
  const hotelLon = -95.3578;

  /* input subscriptions */
  React.useEffect(() => {
    const onData = () => setData(normalizeData(model.get("data")));
    const onReach = () => setReach(model.get("reach") || {});
    const onRoutes = () => setRoutes(model.get("routes") || {});
    model.on("change:data", onData);
    model.on("change:reach", onReach);
    model.on("change:routes", onRoutes);
    return () => {
      model.off("change:data", onData);
      model.off("change:reach", onReach);
      model.off("change:routes", onRoutes);
    };
  }, [model]);

  /* leaflet css */
  React.useEffect(() => {
    if (!document.getElementById("leaflet-base-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-base-css";
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    return () => {};
  }, []);

  const colorOf = React.useCallback(
    (name) => {
      const i = regions.findIndex((r) => r.name === name);
      return REGION_COLORS[(i < 0 ? 0 : i) % REGION_COLORS.length];
    },
    [regions]
  );

  /* derived state: everything the visuals need (mode-driven) */
  const derived = React.useMemo(() => {
    const keyTo = mode + "_min";
    const keyBack = mode + "_back";
    const backAbs = backMin + (backMin <= leaveMin ? 1440 : 0);
    const rows = data.map((s, i) => {
      const distKm = haversineKm(hotelLat, hotelLon, +s.lat, +s.lon);
      const toMinutes = Number(s[keyTo]) || 0;
      const backMinutes = Number(s[keyBack]) || 0;
      const trip = toMinutes + DWELL + backMinutes;
      const arrive = leaveMin + toMinutes;
      const arriveDay = (day + Math.floor(arrive / 1440)) % 7;
      const parsed = parseHours(s.hours);
      const status = !parsed
        ? "unknown"
        : isOpenAt(parsed, arriveDay, arrive % 1440)
        ? "open"
        : "closed";
      return {
        index: i,
        shop: s,
        distKm,
        inside: distKm <= radiusKm,
        toMinutes,
        backMinutes,
        trip,
        arrive,
        backHome: leaveMin + trip,
        arriveDay,
        status,
        fits: leaveMin + trip <= backAbs,
      };
    });
    const insideIdx = [];
    const openIdx = [];
    let k = 0;
    let j = 0;
    rows.forEach((r) => {
      if (!r.inside) return;
      insideIdx.push(r.index);
      if (!r.shop.chain) k++;
      if (r.status === "open") {
        openIdx.push(r.index);
        if (r.fits) j++;
      }
    });
    return { rows, insideIdx, openIdx, n: insideIdx.length, k, j, backAbs };
  }, [data, radiusKm, leaveMin, backMin, day, mode]);

  derivedRef.current = derived;

  /* region membership + stats */
  const regionStats = React.useMemo(() => {
    return regions.map((reg) => {
      const poly = reg.pts.map((p) => [p[1], p[0]]);
      const idx = [];
      derived.rows.forEach((r) => {
        const lat = +r.shop.lat;
        const lng = +r.shop.lon;
        if (pointInPoly([lng, lat], poly)) idx.push(r.index);
      });
      let nIndep = 0;
      let nOpen = 0;
      let earliest = null;
      idx.forEach((i) => {
        const r = derived.rows[i];
        if (!r.shop.chain) nIndep++;
        if (r.status === "open") nOpen++;
        if (earliest == null || r.arrive < earliest) earliest = r.arrive;
      });
      return {
        name: reg.name,
        indices: idx,
        nShops: idx.length,
        nIndep,
        nOpen,
        earliest,
      };
    });
  }, [regions, derived]);

  /* map construction — depends only on data / model */
  React.useEffect(() => {
    if (!containerRef.current) return;

    const hotelLatLng = L.latLng(hotelLat, hotelLon);
    const map = L.map(containerRef.current, {
      center: [hotelLat, hotelLon],
      zoom: 12,
      minZoom: 10,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
      boxZoom: false,
    });
    mapRef.current = map;
    if (map.boxZoom) map.boxZoom.disable();

    map.createPane("reachPane");
    map.getPane("reachPane").style.zIndex = 380;
    map.createPane("routePane");
    map.getPane("routePane").style.zIndex = 400;
    map.createPane("shopPane");
    map.getPane("shopPane").style.zIndex = 420;
    map.createPane("circlePane");
    map.getPane("circlePane").style.zIndex = 452;
    map.createPane("regionPane");
    map.getPane("regionPane").style.zIndex = 445;
    map.createPane("lassoPane");
    map.getPane("lassoPane").style.zIndex = 470;
    map.getPane("lassoPane").style.pointerEvents = "none";

    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addAttribution("Tiles &copy; Esri")
      .addTo(map);
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 16 }
    ).addTo(map);

    const hotelPinIcon = L.divIcon({
      className: "hotel-ink-pin",
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:none;">
          <div style="background:#09090b;color:#fafafa;font-size:10px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;padding:2px 6px;border-radius:3px;margin-bottom:2px;box-shadow:0 1px 3px rgba(0,0,0,0.25);white-space:nowrap;">Hotel</div>
          <svg width="20" height="26" viewBox="0 0 24 30" fill="none">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 18 12 18s12-9.5 12-18c0-6.63-5.37-12-12-12z" fill="#09090b"/>
            <circle cx="12" cy="11" r="4.5" fill="#f4f4f5"/>
          </svg>
        </div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(hotelLatLng, {
      icon: hotelPinIcon,
      zIndexOffset: 2000,
      interactive: false,
    }).addTo(map);

    const startRadiusM = (derivedRef.current ? radiusKm : 3.5) * 1000;

    const visualCircle = L.circle(hotelLatLng, {
      pane: "circlePane",
      radius: startRadiusM,
      color: "#475569",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#0f172a",
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(map);

    const hitCircle = L.circle(hotelLatLng, {
      pane: "circlePane",
      radius: startRadiusM,
      color: "transparent",
      weight: 22,
      fill: false,
      interactive: true,
    }).addTo(map);

    const createEdgeLabelIcon = (rKm) =>
      L.divIcon({
        className: "radius-label-badge",
        html: `<div style="transform:translate(-50%,-50%);background:#18181b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:500;padding:2px 7px;border-radius:9999px;box-shadow:0 1px 4px rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.8);cursor:ew-resize;user-select:none;white-space:nowrap;">${rKm.toFixed(
          1
        )} km</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

    const initPos = getPerimeterLatLng(
      hotelLat,
      hotelLon,
      startRadiusM,
      dragAngleRef.current
    );
    const edgeMarker = L.marker(initPos, {
      icon: createEdgeLabelIcon(startRadiusM / 1000),
      zIndexOffset: 1500,
      interactive: true,
    }).addTo(map);

    const shopRecords = data.map((shop, index) => {
      const sLatLng = L.latLng(+shop.lat, +shop.lon);
      const distKm = haversineKm(hotelLat, hotelLon, +shop.lat, +shop.lon);
      const marker = L.circleMarker(sLatLng, {
        pane: "shopPane",
        radius: 3.5,
        fillColor: "#94a3b8",
        color: "#94a3b8",
        weight: 0,
        fillOpacity: 0.3,
        opacity: 0.3,
      }).addTo(map);

      const tip = () => {
        const d = derivedRef.current ? derivedRef.current.rows[index] : null;
        return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#18181b;min-width:130px;">
          <div style="font-weight:600;font-size:13px;color:#09090b;margin-bottom:2px;">${escapeHtml(
            shop.name
          )}</div>
          ${
            shop.street
              ? `<div style="color:#3f3f46;font-size:11px;">${escapeHtml(
                  shop.street
                )}</div>`
              : ""
          }
          <div style="color:#3f3f46;font-size:11px;margin-top:3px;">${
            shop.hours ? escapeHtml(shop.hours) : "hours unknown"
          }</div>
          <div style="margin-top:4px;font-size:10.5px;font-weight:500;color:${
            shop.chain ? "#52525b" : ACCENT
          };">
            ${shop.chain ? "Chain" : "Independent"} · ${distKm.toFixed(2)} km${
          d
            ? ` · ${d.toMinutes}/${d.backMinutes} min`
            : ""
        }
          </div>
        </div>`;
      };
      marker.bindTooltip(tip(), {
        direction: "top",
        offset: [0, -5],
        className: "custom-shop-tooltip",
        opacity: 0.98,
      });
      marker.on("tooltipopen", () => marker.setTooltipContent(tip()));
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setTarget(index);
      });

      const label = L.marker(sLatLng, {
        icon: EMPTY_ICON,
        interactive: false,
        zIndexOffset: 900,
      }).addTo(map);

      return { marker, label, shop, distKm, index };
    });

    elementsRef.current = { visualCircle, hitCircle, edgeMarker, shopRecords };

    if (derivedRef.current) {
      applyStyles(elementsRef.current, derivedRef.current, targetRef.current);
    }

    /* ---------------- radius drag ---------------- */
    const startDrag = (e) => {
      if (e.originalEvent && e.originalEvent.shiftKey) return;
      L.DomEvent.stopPropagation(e);
      dragActiveRef.current = true;
      map.dragging.disable();
      if (containerRef.current) containerRef.current.style.cursor = "ew-resize";
      if (e.latlng) {
        dragAngleRef.current = Math.atan2(
          e.latlng.lng - hotelLon,
          e.latlng.lat - hotelLat
        );
      }
    };
    hitCircle.on("mousedown", startDrag);
    edgeMarker.on("mousedown", startDrag);
    hitCircle.on("mouseover", () => {
      if (!dragActiveRef.current && containerRef.current)
        containerRef.current.style.cursor = "ew-resize";
    });
    hitCircle.on("mouseout", () => {
      if (!dragActiveRef.current && containerRef.current)
        containerRef.current.style.cursor = "";
    });

    /* ---------------- lasso ---------------- */
    const lassoState = { drawing: false, pts: [], line: null };

    const clearLasso = () => {
      if (lassoState.line) {
        lassoState.line.remove();
        lassoState.line = null;
      }
      lassoState.pts = [];
      lassoState.drawing = false;
    };

    const onContainerMouseDown = (ev) => {
      if (!ev.shiftKey || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      dragActiveRef.current = false;
      map.dragging.disable();
      const ll = map.mouseEventToLatLng(ev);
      lassoState.drawing = true;
      lassoState.pts = [[ll.lat, ll.lng]];
      lassoState.line = L.polyline(lassoState.pts, {
        pane: "lassoPane",
        color: INK,
        weight: 1.4,
        opacity: 0.85,
        dashArray: "4,3",
        interactive: false,
      }).addTo(map);
      setLassoActive(true);
      if (containerRef.current) containerRef.current.style.cursor = "crosshair";
    };

    const finishLasso = () => {
      if (!lassoState.drawing) return;
      const raw = lassoState.pts.slice();
      clearLasso();
      map.dragging.enable();
      setLassoActive(false);
      if (containerRef.current) containerRef.current.style.cursor = "";
      if (raw.length < 3) return;
      const screen = raw.map((p) => {
        const q = map.latLngToContainerPoint(L.latLng(p[0], p[1]));
        return [q.x, q.y];
      });
      const keep = [];
      let last = null;
      screen.forEach((s, i) => {
        if (last === null || Math.hypot(s[0] - last[0], s[1] - last[1]) >= 14) {
          keep.push(i);
          last = s;
        }
      });
      if (keep.length < 3) return;
      const pts = keep.map((i) => raw[i]);
      setRegionsRef.current((prev) => {
        const used = new Set(prev.map((r) => r.name));
        return prev.concat([{ name: nextRegionName(used), pts }]);
      });
    };

    const onWindowMouseMove = (ev) => {
      if (lassoState.drawing) {
        const ll = map.mouseEventToLatLng(ev);
        const last = lassoState.pts[lassoState.pts.length - 1];
        if (
          !last ||
          Math.abs(last[0] - ll.lat) > 1e-6 ||
          Math.abs(last[1] - ll.lng) > 1e-6
        ) {
          lassoState.pts.push([ll.lat, ll.lng]);
          if (lassoState.line) lassoState.line.setLatLngs(lassoState.pts);
        }
        return;
      }
      if (!dragActiveRef.current) return;
      const e2 = ev.touches ? ev.touches[0] : ev;
      if (!e2) return;
      const ll = map.mouseEventToLatLng(e2);
      if (!ll) return;
      const distM = hotelLatLng.distanceTo(ll);
      const clamped = Math.max(400, Math.min(22000, distM));
      const rKm = Math.round((clamped / 1000) * 10) / 10;
      visualCircle.setRadius(clamped);
      hitCircle.setRadius(clamped);
      const angle = Math.atan2(ll.lng - hotelLon, ll.lat - hotelLat);
      dragAngleRef.current = angle;
      edgeMarker.setLatLng(
        getPerimeterLatLng(hotelLat, hotelLon, clamped, angle)
      );
      edgeMarker.setIcon(createEdgeLabelIcon(rKm));
      setRadiusKm(rKm);
    };

    const onWindowMouseUp = () => {
      if (lassoState.drawing) {
        finishLasso();
        return;
      }
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      map.dragging.enable();
      if (containerRef.current) containerRef.current.style.cursor = "";
    };

    const onTouchMove = (e) => {
      if (!dragActiveRef.current) return;
      onWindowMouseMove(e);
    };

    const el = containerRef.current;
    el.addEventListener("mousedown", onContainerMouseDown, true);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onWindowMouseUp);

    return () => {
      el.removeEventListener("mousedown", onContainerMouseDown, true);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onWindowMouseUp);
      clearLasso();
      regionLayersRef.current.forEach((entry) => {
        entry.poly.remove();
        entry.handles.forEach((h) => h.remove());
        if (entry.tag) entry.tag.remove();
      });
      regionLayersRef.current = new Map();
      reachLayersRef.current.forEach((l) => l.remove());
      reachLayersRef.current = [];
      if (routeLayerRef.current) routeLayerRef.current.remove();
      routeLayerRef.current = null;
      if (routeLabelRef.current) routeLabelRef.current.remove();
      routeLabelRef.current = null;
      elementsRef.current = { shopRecords: [] };
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, [data, model]);

  /* ---- reach bands follow the mode ---- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    reachLayersRef.current.forEach((l) => l.remove());
    reachLayersRef.current = buildReachLayers(map, reach, mode);
    return () => {
      reachLayersRef.current.forEach((l) => l.remove());
      reachLayersRef.current = [];
    };
  }, [reach, mode, data]);

  /* ---- street route hotel → target, above the bands ---- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (routeLabelRef.current) {
      routeLabelRef.current.remove();
      routeLabelRef.current = null;
    }
    const pts = routeFor(routes, mode, target);
    const row = derived.rows[target];
    if (!pts || !row) return () => {};

    const line = L.polyline(pts, {
      pane: "routePane",
      color: ACCENT,
      weight: 2,
      opacity: 0.95,
      lineJoin: "round",
      lineCap: "round",
      interactive: false,
    }).addTo(map);
    routeLayerRef.current = line;

    const mid = polylineMidpoint(pts);
    /* offset the badge perpendicular to the local heading so it never
       sits on top of the route, and push it away from the hotel pin */
    let dx = 12;
    let dy = -8;
    if (mid.a && mid.b) {
      const vlat = mid.b[0] - mid.a[0];
      const vlon = mid.b[1] - mid.a[1];
      const len = Math.hypot(vlat, vlon) || 1;
      // screen space: x ~ lon, y ~ -lat
      const nx = -(-vlat / len);
      const ny = -(vlon / len);
      dx = nx * 16 + 4;
      dy = ny * 16 - 6;
    }
    const nearHotel =
      Math.hypot(mid.pt[0] - hotelLat, mid.pt[1] - hotelLon) < 0.004;
    if (nearHotel) {
      dx = dx + 18;
      dy = dy + 18;
    }
    const label = L.marker(mid.pt, {
      pane: "routePane",
      interactive: false,
      zIndexOffset: 1700,
      icon: routeLabelIcon(row.toMinutes + " min", Math.round(dx), Math.round(dy)),
    }).addTo(map);
    routeLabelRef.current = label;

    return () => {
      line.remove();
      label.remove();
      if (routeLayerRef.current === line) routeLayerRef.current = null;
      if (routeLabelRef.current === label) routeLabelRef.current = null;
    };
  }, [routes, mode, target, derived, data]);

  /* ---- region layers: sync leaflet polygons + vertex handles ---- */
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = regionLayersRef.current;
    const alive = new Set(regions.map((r) => r.name));

    Array.from(store.keys()).forEach((name) => {
      if (!alive.has(name)) {
        const e = store.get(name);
        e.poly.remove();
        e.handles.forEach((h) => h.remove());
        if (e.tag) e.tag.remove();
        store.delete(name);
      }
    });

    regions.forEach((reg, ri) => {
      const color = REGION_COLORS[ri % REGION_COLORS.length];
      let entry = store.get(reg.name);
      if (!entry) {
        const poly = L.polygon(reg.pts, {
          pane: "regionPane",
          color,
          weight: 1.4,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.08,
          interactive: true,
        }).addTo(map);
        poly.on("dblclick", (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          setRegionsRef.current((prev) =>
            prev.filter((r) => r.name !== reg.name)
          );
        });
        const tag = L.marker(reg.pts[0], {
          pane: "regionPane",
          interactive: false,
          zIndexOffset: 1200,
          icon: L.divIcon({
            className: "region-tag",
            html: `<div style="transform:translate(6px,-16px);font:600 10.5px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${color};letter-spacing:0.05em;text-shadow:0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff;">${reg.name}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        }).addTo(map);
        entry = { poly, handles: [], tag, color };
        store.set(reg.name, entry);
      } else {
        entry.poly.setLatLngs(reg.pts);
        entry.poly.setStyle({ color, fillColor: color });
        if (entry.tag) entry.tag.setLatLng(reg.pts[0]);
        entry.color = color;
      }

      if (entry.handles.length !== reg.pts.length) {
        entry.handles.forEach((h) => h.remove());
        entry.handles = reg.pts.map((p, vi) => {
          const m = L.marker(p, {
            pane: "regionPane",
            icon: VERTEX_ICON(color),
            draggable: true,
            zIndexOffset: 1400,
            keyboard: false,
          }).addTo(map);
          m.on("dragstart", () => {
            map.dragging.disable();
          });
          m.on("drag", (e) => {
            const ll = e.target.getLatLng();
            const cur = entry.poly.getLatLngs()[0].slice();
            cur[vi] = ll;
            entry.poly.setLatLngs(cur);
          });
          m.on("dragend", (e) => {
            map.dragging.enable();
            const ll = e.target.getLatLng();
            setRegionsRef.current((prev) =>
              prev.map((r) => {
                if (r.name !== reg.name) return r;
                const pts = r.pts.slice();
                pts[vi] = [ll.lat, ll.lng];
                return { ...r, pts };
              })
            );
          });
          return m;
        });
      } else {
        entry.handles.forEach((m, vi) => {
          const ll = m.getLatLng();
          const p = reg.pts[vi];
          if (
            Math.abs(ll.lat - p[0]) > 1e-9 ||
            Math.abs(ll.lng - p[1]) > 1e-9
          ) {
            m.setLatLng(p);
          }
          m.setIcon(VERTEX_ICON(color));
        });
      }
    });
    return () => {};
  }, [regions]);

  const handleRegionHover = React.useCallback((name) => {
    hoverRegionRef.current = name;
    const store = regionLayersRef.current;
    store.forEach((entry, key) => {
      const on = name === key;
      entry.poly.setStyle({
        weight: on ? 2.6 : 1.4,
        fillOpacity: on ? 0.2 : 0.08,
        opacity: name && !on ? 0.4 : 0.9,
      });
      if (on && entry.poly.bringToFront) entry.poly.bringToFront();
    });
  }, []);

  const handleRegionDelete = React.useCallback((name) => {
    setRegions((prev) => prev.filter((r) => r.name !== name));
  }, []);

  /* live restyle on any dial / day / target / radius / mode change */
  React.useEffect(() => {
    const els = elementsRef.current;
    if (!els || !els.shopRecords || !els.shopRecords.length) return;
    if (els.visualCircle) {
      els.visualCircle.setRadius(radiusKm * 1000);
      els.hitCircle.setRadius(radiusKm * 1000);
    }
    applyStyles(els, derived, target);
    return () => {};
  }, [derived, target, radiusKm]);

  const targetRow = derived.rows[target];
  const backHome = targetRow ? targetRow.backHome : leaveMin;
  const makesIt = targetRow ? targetRow.backHome <= derived.backAbs : true;

  /* outputs */
  React.useEffect(() => {
    const regionsOut = {};
    regionStats.forEach((r) => {
      regionsOut[r.name] = r.indices;
    });
    const t = setTimeout(() => {
      model.set("inside", derived.insideIdx);
      model.set("radius_km", radiusKm);
      model.set("open_on_arrival", derived.openIdx);
      model.set("when", { day, hhmm: fmtHHMM(leaveMin) });
      model.set("back_by", fmtHHMM(backMin));
      model.set("target", target);
      model.set("regions", regionsOut);
      model.set("mode", mode);
      model.set("back_hhmm", fmtHHMM(backHome));
      model.set("makes_it", !!makesIt);
      model.save_changes();
    }, 60);
    return () => clearTimeout(t);
  }, [
    derived,
    radiusKm,
    day,
    leaveMin,
    backMin,
    target,
    regionStats,
    mode,
    backHome,
    makesIt,
    model,
  ]);

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
        width: "100%",
        height: 660,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .custom-shop-tooltip {
          background: rgba(255,255,255,0.97) !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
        }
        .custom-shop-tooltip::before { border-top-color: #e2e8f0 !important; }
        .leaflet-container { background: #f4f4f5 !important; }
        .shop-time-label { background: none !important; border: none !important; }
        .hotel-ink-pin, .radius-label-badge { background: none !important; border: none !important; }
        .region-vertex, .region-tag { background: none !important; border: none !important; }
        .route-min-label { background: none !important; border: none !important; }
      `}</style>

      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
            borderRadius: 8,
            border: "1px solid #e4e4e7",
            background: "#f4f4f5",
          }}
        >
          <MapStatsBadge
            countInside={derived.n}
            countIndependent={derived.k}
            countOpen={derived.j}
          />
          <LassoHint active={lassoActive} />
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        <RegionTable
          React={React}
          rows={regionStats}
          onHover={handleRegionHover}
          onDelete={handleRegionDelete}
          colorOf={colorOf}
        />
      </div>

      <div
        style={{
          flex: "0 0 348px",
          height: "100%",
          padding: "12px 4px",
          borderRadius: 8,
          border: "1px solid #e4e4e7",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          gap: 4,
          overflow: "auto",
        }}
      >
        <TimeDial
          React={React}
          width={340}
          height={316}
          leaveMin={leaveMin}
          backMin={backMin}
          setLeave={setLeaveMin}
          setBack={setBackMin}
          day={day}
          setDay={setDay}
          mode={mode}
          setMode={setMode}
          targetName={targetRow ? targetRow.shop.name : null}
          tripMin={targetRow ? targetRow.trip : 0}
          toMinutes={targetRow ? targetRow.toMinutes : 0}
          backHomeMin={backHome}
          hasTarget={!!targetRow}
        />

        <VerdictLines
          React={React}
          leaveMin={leaveMin}
          targetName={targetRow ? targetRow.shop.name : null}
          arriveMin={targetRow ? targetRow.arrive : leaveMin}
          status={targetRow ? targetRow.status : "unknown"}
          dwellMin={DWELL}
          backHomeMin={backHome}
          backByMin={backMin}
          hasTarget={!!targetRow}
        />

        <div
          style={{
            marginTop: 6,
            padding: "8px 14px 0",
            borderTop: "1px solid #f4f4f5",
            fontSize: 11,
            color: "#3f3f46",
            lineHeight: 1.7,
          }}
        >
          <div>
            <span style={{ color: GREEN, fontWeight: 600 }}>●</span> open on
            arrival
            <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
            <span style={{ color: RED, fontWeight: 600 }}>○</span> closed
            <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
            <span style={{ color: GREY, fontWeight: 600 }}>◌</span> unknown
          </div>
          <div style={{ color: "#3f3f46", marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>{regionStats.length}</span> region
            {regionStats.length === 1 ? "" : "s"} · shift + drag to lasso · drag
            a vertex to reshape · double-click inside to delete
          </div>
        </div>
      </div>
    </div>
  );
}