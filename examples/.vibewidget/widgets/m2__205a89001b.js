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
  // an overnight window opened yesterday can still cover early minutes
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
    <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
    <span style={{ fontWeight: 600, color: ACCENT }}>{countIndependent}</span>{" "}
    independent
    <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
    <span style={{ fontWeight: 600, color: GREEN }}>{countOpen}</span> open and
    back in time
  </div>
);

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
              border: "1px solid " + (on ? INK : "#e4e4e7"),
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
  bikeToMin,
  hasTarget,
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

  /* live pointer handling: values live in refs / functional setState so
     the svg node itself is never rebuilt mid-gesture */
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

  const onMouseDown = (e) => startDrag(e.clientX, e.clientY, () => e.preventDefault());
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

  /* trip arc of the target */
  const tripSweep = Math.min(Math.max(tripMin || 0, 0), 715) / 2;
  const okSweep =
    Math.min(Math.max(Math.min(tripMin || 0, Math.max(haveMin, 0)), 0), 715) / 2;
  const arriveDeg = degOf(leaveMin + (bikeToMin || 0));
  const [atx, aty] = polar(cx, cy, R - 13, arriveDeg);
  const [atx2, aty2] = polar(cx, cy, R - 2, arriveDeg);
  const [alx, aly] = polar(cx, cy, R - 26, arriveDeg);

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
        {/* wedge = time we have */}
        <path
          d={wedgePath(cx, cy, R - 14, leaveDeg, haveMin / 2)}
          fill={INK}
          fillOpacity={0.07}
        />

        {/* rim */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#d4d4d8" strokeWidth={1} />

        {/* hour ticks */}
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
              style={{ font: "500 10px " + fontStack, fill: "#71717a" }}
            >
              {lab}
            </text>
          );
        })}

        {/* target trip arc, just inside the rim */}
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
                d={arcPath(cx, cy, R - 6, leaveDeg + okSweep, leaveDeg + tripSweep)}
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
              {fmtHHMM(leaveMin + (bikeToMin || 0))}
            </text>
          </g>
        )}

        {/* leave handle (on the rim) */}
        <line x1={lsx} y1={lsy} x2={lhx} y2={lhy} stroke={INK} strokeWidth={1.4} />
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

        {/* back-by handle (14px outside the rim) */}
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

        {/* centre caption */}
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
        <span style={{ color: "#71717a", marginRight: 6 }}>target</span>
        {targetName || "—"}
      </div>

      <DayRow React={React} day={day} setDay={setDay} />

      <div
        style={{
          fontSize: 10,
          color: "#71717a",
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

/* ------------------------------------------------------------------ *
 * widget
 * ------------------------------------------------------------------ */

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => normalizeData(model.get("data")));
  const [reach, setReach] = React.useState(() => model.get("reach") || {});
  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backMin, setBackMin] = React.useState(8 * 60 + 45);
  const [day, setDay] = React.useState(1); // Tu
  const [target, setTarget] = React.useState(2);
  const [radiusKm, setRadiusKm] = React.useState(3.5);

  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const elementsRef = React.useRef({ shopRecords: [] });
  const dragActiveRef = React.useRef(false);
  const dragAngleRef = React.useRef(0.65);
  const derivedRef = React.useRef(null);

  const hotelLat = 29.7522;
  const hotelLon = -95.3578;

  /* input subscriptions */
  React.useEffect(() => {
    const onData = () => setData(normalizeData(model.get("data")));
    const onReach = () => setReach(model.get("reach") || {});
    model.on("change:data", onData);
    model.on("change:reach", onReach);
    return () => {
      model.off("change:data", onData);
      model.off("change:reach", onReach);
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

  /* derived state: everything the visuals need */
  const derived = React.useMemo(() => {
    const backAbs = backMin + (backMin <= leaveMin ? 1440 : 0);
    const rows = data.map((s, i) => {
      const distKm = haversineKm(hotelLat, hotelLon, +s.lat, +s.lon);
      const bikeTo = Number(s.bike_min) || 0;
      const bikeBack = Number(s.bike_back) || 0;
      const trip = bikeTo + 10 + bikeBack;
      const arrive = leaveMin + bikeTo;
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
        bikeTo,
        bikeBack,
        trip,
        arrive,
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
  }, [data, radiusKm, leaveMin, backMin, day]);

  derivedRef.current = derived;

  /* map construction — depends only on data / reach / model */
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
    });
    mapRef.current = map;

    map.createPane("reachPane");
    map.getPane("reachPane").style.zIndex = 380;
    map.createPane("shopPane");
    map.getPane("shopPane").style.zIndex = 420;
    map.createPane("circlePane");
    map.getPane("circlePane").style.zIndex = 452;

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

    /* bike reach bands: nested contours painted so the stack lands
       exactly on 6% / 9% / 12% and never darker */
    const bike = reach && reach.bike ? reach.bike : null;
    const feats = bike
      ? bike.features || (bike.type === "Feature" ? [bike] : [])
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
    const reachLayers = [];
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
      reachLayers.push(lyr);
    });

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

      const tooltipHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;line-height:1.45;color:#1e293b;min-width:130px;">
          <div style="font-weight:600;font-size:13px;color:#09090b;margin-bottom:2px;">${escapeHtml(
            shop.name
          )}</div>
          ${
            shop.street
              ? `<div style="color:#52525b;font-size:11px;">${escapeHtml(
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
            ${shop.chain ? "Chain" : "Independent"} · ${distKm.toFixed(2)} km ·
            bike ${Number(shop.bike_min) || 0}/${Number(shop.bike_back) || 0} min
          </div>
        </div>`;
      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -5],
        className: "custom-shop-tooltip",
        opacity: 0.98,
      });
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
      applyStyles(elementsRef.current, derivedRef.current, target);
    }

    /* radius drag */
    const startDrag = (e) => {
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

    const onPointerMove = (e) => {
      if (!dragActiveRef.current) return;
      const ev = e.touches ? e.touches[0] : e;
      if (!ev) return;
      const ll = map.mouseEventToLatLng(ev);
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
    const onPointerUp = () => {
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      map.dragging.enable();
      if (containerRef.current) containerRef.current.style.cursor = "";
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);

    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      reachLayers.forEach((l) => l.remove());
      elementsRef.current = { shopRecords: [] };
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, [data, reach, model]);

  /* live restyle on any dial / day / target / radius change */
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

  /* outputs (debounced a touch so drags stay smooth) */
  React.useEffect(() => {
    const t = setTimeout(() => {
      model.set("inside", derived.insideIdx);
      model.set("radius_km", radiusKm);
      model.set("open_on_arrival", derived.openIdx);
      model.set("when", { day, hhmm: fmtHHMM(leaveMin) });
      model.set("back_by", fmtHHMM(backMin));
      model.set("target", target);
      model.save_changes();
    }, 60);
    return () => clearTimeout(t);
  }, [derived, radiusKm, day, leaveMin, backMin, target, model]);

  const targetRow = derived.rows[target];

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
        width: "100%",
        height: 560,
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
      `}</style>

      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minWidth: 0,
          height: "100%",
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
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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
          overflow: "hidden",
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
          targetName={targetRow ? targetRow.shop.name : null}
          tripMin={targetRow ? targetRow.trip : 0}
          bikeToMin={targetRow ? targetRow.bikeTo : 0}
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
            <span style={{ margin: "0 6px", color: "#d4d4d8" }}>·</span>
            <span style={{ color: RED, fontWeight: 600 }}>○</span> closed
            <span style={{ margin: "0 6px", color: "#d4d4d8" }}>·</span>
            <span style={{ color: GREY, fontWeight: 600 }}>◌</span> unknown
          </div>
          {targetRow && (
            <div style={{ color: "#52525b" }}>
              arrive {fmtHHMM(targetRow.arrive)} · back{" "}
              {fmtHHMM(leaveMin + targetRow.trip)}
              {leaveMin + targetRow.trip > derived.backAbs ? (
                <span style={{ color: RED, fontWeight: 600 }}> · too late</span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}