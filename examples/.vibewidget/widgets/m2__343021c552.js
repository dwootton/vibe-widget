import L from "https://esm.sh/leaflet@1.9.4";

const LEAFLET_CSS_ID = "leaflet-css-bundle-style";
if (typeof document !== "undefined" && !document.getElementById(LEAFLET_CSS_ID)) {
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

const HOTEL = { lat: 29.7522, lon: -95.3578 };
const INITIAL_RADIUS_KM = 3.5;
const ACCENT_COLOR = "#d9480f";
const INK_COLOR = "#111111";
const GREY_COLOR = "#777777";
const HAIRLINE_COLOR = "#d9d9d9";
const OPEN_COLOR = "#2b8a3e";
const CLOSED_COLOR = "#c92a2a";

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function destinationPoint(lat, lon, bearingDeg, distKm) {
  const R = 6371.0;
  const rad = Math.PI / 180;
  const phi1 = lat * rad;
  const lam1 = lon * rad;
  const theta = bearingDeg * rad;
  const d_R = distKm / R;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d_R) +
      Math.cos(phi1) * Math.sin(d_R) * Math.cos(theta)
  );
  const lam2 =
    lam1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(d_R) * Math.cos(phi1),
      Math.cos(d_R) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [phi2 / rad, lam2 / rad];
}

function formatHhMm(totalMin) {
  let m = Math.round(totalMin) % 1440;
  if (m < 0) m += 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseHhMm(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Parse OSM opening hours text
// Returns: true (open), false (closed), null (unknown)
function checkIsOpen(hoursStr, dayIdx, timeMin) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return null;
  }
  const clean = hoursStr.trim();
  if (clean.toLowerCase() === "24/7") return true;

  const dayAbbrs = ["mo", "tu", "we", "th", "fr", "sa", "su"];
  const currentDay = dayAbbrs[dayIdx];

  const rules = clean.split(";").map((s) => s.trim()).filter(Boolean);

  let matchedDayRules = [];

  for (const rule of rules) {
    const parts = rule.split(/\s+/);
    if (parts.length === 0) continue;

    // Check if starts with days specification
    // Could be "Mo-Sa 04:00-14:00" or just "05:00-20:00" (applies to all days)
    let daysPart = "";
    let timesPart = "";

    if (/^[a-zA-Z,\-]+$/.test(parts[0])) {
      daysPart = parts[0];
      timesPart = parts.slice(1).join(" ");
    } else {
      // No day part, applies to all days
      daysPart = "Mo-Su";
      timesPart = parts.join(" ");
    }

    // Check if currentDay matches daysPart
    const dayIntervals = daysPart.split(",").map((s) => s.trim().toLowerCase());
    let matchesThisDay = false;

    for (const dInt of dayIntervals) {
      if (dInt.includes("-")) {
        const [startD, endD] = dInt.split("-");
        const sIdx = dayAbbrs.indexOf(startD);
        const eIdx = dayAbbrs.indexOf(endD);
        if (sIdx !== -1 && eIdx !== -1) {
          if (sIdx <= eIdx) {
            if (dayIdx >= sIdx && dayIdx <= eIdx) matchesThisDay = true;
          } else {
            // wraps around e.g. Fr-Mo
            if (dayIdx >= sIdx || dayIdx <= eIdx) matchesThisDay = true;
          }
        }
      } else {
        if (dInt === currentDay) {
          matchesThisDay = true;
        }
      }
    }

    if (matchesThisDay) {
      matchedDayRules.push(timesPart);
    }
  }

  if (matchedDayRules.length === 0) {
    // If rules specified other days but not this one, it is closed on this day
    // Check if any rule had an explicit day spec
    const hasExplicitDays = rules.some((r) => /^[a-zA-Z,\-]+/.test(r.trim()));
    if (hasExplicitDays) return false;
    return null;
  }

  // Check intervals in matchedDayRules
  for (const timeStr of matchedDayRules) {
    if (timeStr.toLowerCase() === "off" || timeStr.toLowerCase() === "closed") {
      return false;
    }
    const subIntervals = timeStr.split(",").map((s) => s.trim());
    for (const sub of subIntervals) {
      const match = sub.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        const start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        let end = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        if (end === 0) end = 1440; // 24:00 / midnight
        if (timeMin >= start && timeMin <= end) {
          return true;
        }
      }
    }
  }

  return false;
}

export const CountLine = ({ insideCount, independentCount, openAndInTimeCount }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      backgroundColor: "rgba(255, 255, 255, 0.94)",
      padding: "5px 9px",
      border: `1px solid ${HAIRLINE_COLOR}`,
      fontSize: 12,
      fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      color: INK_COLOR,
      fontVariantNumeric: "tabular-nums",
      pointerEvents: "none",
      lineHeight: "16px",
    }}
  >
    <span style={{ fontWeight: 600 }}>{insideCount}</span> inside ·{" "}
    <span style={{ fontWeight: 600 }}>{independentCount}</span> independent ·{" "}
    <span style={{ fontWeight: 600 }}>{openAndInTimeCount}</span> open and back in time
  </div>
);

export const TooltipOverlay = ({ hoveredShop }) => {
  if (!hoveredShop) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: 14,
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        padding: "7px 11px",
        border: `1px solid ${HAIRLINE_COLOR}`,
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        color: INK_COLOR,
        maxWidth: 320,
        pointerEvents: "none",
        lineHeight: "17px",
      }}
    >
      <div style={{ fontWeight: 600 }}>{hoveredShop.name}</div>
      {hoveredShop.street && (
        <div style={{ color: GREY_COLOR, fontSize: 11 }}>{hoveredShop.street}</div>
      )}
      {hoveredShop.hours && (
        <div
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            marginTop: 2,
            color: "#333333",
          }}
        >
          {hoveredShop.hours}
        </div>
      )}
    </div>
  );
};

export const ClockDial = ({
  leaveMin,
  backByMin,
  targetShop,
  dayIdx,
  onDayChange,
  onLeaveChange,
  onBackByChange,
  React,
}) => {
  const svgRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const lastTouchedRef = React.useRef("leave"); // 'leave' | 'back'
  const draggingRef = React.useRef(null);

  const cx = 140;
  const cy = 140;
  const rRim = 88;
  const rLeave = rRim;
  const rBack = rRim + 12;

  // 12-hour clock face: 12 is top (-90°), clockwise
  // 12 hours = 720 min = 360 deg -> 0.5 deg per minute
  const minToAngle = (m) => {
    const minIn12 = m % 720;
    return (minIn12 * 0.5 - 90) * (Math.PI / 180);
  };

  const getPt = (angle, radius) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const leaveAngle = minToAngle(leaveMin);
  const backAngle = minToAngle(backByMin);

  // Wedge path between leave and back by
  // Handle angles for SVG arc
  let wedgeSweep = ((backByMin - leaveMin) % 720 + 720) % 720;
  if (backByMin > leaveMin && wedgeSweep === 0) wedgeSweep = 720;
  const largeArcFlag = wedgeSweep > 360 ? 1 : wedgeSweep > 180 ? 1 : 0;
  const ptLeaveRim = getPt(leaveAngle, rRim);
  const ptBackRim = getPt(backAngle, rRim);

  let wedgePath = "";
  if (wedgeSweep > 0 && wedgeSweep < 720) {
    wedgePath = `M ${cx} ${cy} L ${ptLeaveRim.x} ${ptLeaveRim.y} A ${rRim} ${rRim} 0 ${largeArcFlag} 1 ${ptBackRim.x} ${ptBackRim.y} Z`;
  } else if (wedgeSweep >= 720) {
    wedgePath = `M ${cx - rRim} ${cy} A ${rRim} ${rRim} 0 1 0 ${cx + rRim} ${cy} A ${rRim} ${rRim} 0 1 0 ${cx - rRim} ${cy} Z`;
  }

  // Target trip arc
  // Trip rides just inside the rim (e.g. r = rRim - 7)
  const rTrip = rRim - 7;
  let tripArcNormal = null;
  let tripArcLate = null;
  let arrivalPt = null;
  let arrivalLabelPos = null;
  let arrivalTimeStr = "";

  if (targetShop && targetShop.bike_min != null && targetShop.bike_back != null) {
    const bMin = targetShop.bike_min;
    const bBack = targetShop.bike_back;
    const arriveMin = leaveMin + bMin;
    const tripTotalMin = bMin + 10 + bBack;
    const tripEndMin = leaveMin + tripTotalMin;

    arrivalTimeStr = formatHhMm(arriveMin);
    const arriveAngle = minToAngle(arriveMin);
    arrivalPt = getPt(arriveAngle, rTrip);
    const labelAngle = arriveAngle;
    arrivalLabelPos = getPt(labelAngle, rTrip - 16);

    const normalEndMin = Math.min(tripEndMin, backByMin);
    const normalSpan = Math.max(0, normalEndMin - leaveMin);
    if (normalSpan > 0) {
      const startA = minToAngle(leaveMin);
      const endA = minToAngle(normalEndMin);
      const p1 = getPt(startA, rTrip);
      const p2 = getPt(endA, rTrip);
      const arcSweep = normalSpan % 720;
      const arcLarge = arcSweep > 180 ? 1 : 0;
      tripArcNormal = `M ${p1.x} ${p1.y} A ${rTrip} ${rTrip} 0 ${arcLarge} 1 ${p2.x} ${p2.y}`;
    }

    if (tripEndMin > backByMin) {
      const lateSpan = tripEndMin - backByMin;
      const startA = minToAngle(backByMin);
      const endA = minToAngle(tripEndMin);
      const p1 = getPt(startA, rTrip);
      const p2 = getPt(endA, rTrip);
      const arcSweep = lateSpan % 720;
      const arcLarge = arcSweep > 180 ? 1 : 0;
      tripArcLate = `M ${p1.x} ${p1.y} A ${rTrip} ${rTrip} 0 ${arcLarge} 1 ${p2.x} ${p2.y}`;
    }
  }

  // Pointer angle measurement from svg center
  const getAngleFromEvent = (e) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const svgCenterX = rect.left + rect.width / 2;
    const svgCenterY = rect.top + rect.height / 2;
    const dx = e.clientX - svgCenterX;
    const dy = e.clientY - svgCenterY;
    let angle = Math.atan2(dy, dx); // -PI to PI, 0 is 3 o'clock, -PI/2 is 12 o'clock
    // normalize to [0, 2PI) starting at 12 o'clock (-PI/2)
    let norm = angle + Math.PI / 2;
    if (norm < 0) norm += 2 * Math.PI;
    return norm;
  };

  const handlePointerDown = (type, e) => {
    e.preventDefault();
    draggingRef.current = type;
    lastTouchedRef.current = type;
    if (containerRef.current) {
      containerRef.current.focus();
    }

    const onPointerMove = (moveEv) => {
      const rad = getAngleFromEvent(moveEv);
      // rad / (2*PI) * 720 = minutes from 00:00 or 12:00
      let minutes = (rad / (2 * Math.PI)) * 720;
      // Snap to nearest 5 or 15 mins? The task says nudges are 15m, dial continuous or standard
      minutes = Math.round(minutes);
      if (minutes >= 720) minutes = 0;

      if (draggingRef.current === "leave") {
        // preserve AM/PM roughly or map to reasonable 24h
        // leave starts at 06:30 (morning)
        const baseH = leaveMin >= 720 ? 720 : 0;
        onLeaveChange(baseH + minutes);
      } else if (draggingRef.current === "back") {
        const baseH = backByMin >= 720 ? 720 : 0;
        onBackByChange(baseH + minutes);
      }
    };

    const onPointerUp = () => {
      draggingRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const target = lastTouchedRef.current;
      if (target === "leave") {
        onLeaveChange(Math.max(0, leaveMin - 15));
      } else {
        onBackByChange(Math.max(0, backByMin - 15));
      }
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const target = lastTouchedRef.current;
      if (target === "leave") {
        onLeaveChange(Math.min(1439, leaveMin + 15));
      } else {
        onBackByChange(Math.min(1439, backByMin + 15));
      }
    }
  };

  const ptLeaveHandle = getPt(leaveAngle, rLeave);
  const ptBackHandle = getPt(backAngle, rBack);

  const leaveLabelPt = getPt(leaveAngle, rLeave + 28);
  const backLabelPt = getPt(backAngle, rBack + 28);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: 280,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        outline: "none",
        userSelect: "none",
        boxSizing: "border-box",
        padding: "8px 0",
      }}
    >
      <svg
        ref={svgRef}
        width={280}
        height={280}
        style={{ overflow: "visible", display: "block" }}
      >
        {/* Clock rim */}
        <circle
          cx={cx}
          cy={cy}
          r={rRim}
          fill="none"
          stroke={HAIRLINE_COLOR}
          strokeWidth={1}
        />

        {/* Hour ticks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          const isQuarter = i % 3 === 0;
          const r1 = rRim - (isQuarter ? 6 : 3);
          const p1 = getPt(a, r1);
          const p2 = getPt(a, rRim);
          const numPt = getPt(a, rRim - 14);
          const label = i === 0 ? "12" : String(i);

          return (
            <g key={i}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={INK_COLOR}
                strokeWidth={isQuarter ? 1.5 : 0.8}
              />
              {isQuarter && (
                <text
                  x={numPt.x}
                  y={numPt.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fill={GREY_COLOR}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Faint wedge between leave and back by */}
        {wedgePath && <path d={wedgePath} fill="#f2f2f2" opacity={0.7} />}

        {/* Target trip arc inside rim */}
        {tripArcNormal && (
          <path
            d={tripArcNormal}
            fill="none"
            stroke={INK_COLOR}
            strokeWidth={2}
          />
        )}
        {tripArcLate && (
          <path
            d={tripArcLate}
            fill="none"
            stroke={CLOSED_COLOR}
            strokeWidth={2}
          />
        )}
        {arrivalPt && (
          <g>
            <circle cx={arrivalPt.x} cy={arrivalPt.y} r={2} fill={INK_COLOR} />
            <text
              x={arrivalLabelPos.x}
              y={arrivalLabelPos.y}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-monospace, SF Mono, Menlo, monospace"
              fill={INK_COLOR}
            >
              {arrivalTimeStr}
            </text>
          </g>
        )}

        {/* LEAVE handle (on rim) */}
        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("leave", e)}
        >
          {/* Hit area */}
          <circle cx={ptLeaveHandle.x} cy={ptLeaveHandle.y} r={16} fill="transparent" />
          <circle
            cx={ptLeaveHandle.x}
            cy={ptLeaveHandle.y}
            r={5}
            fill={INK_COLOR}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </g>

        {/* BACK BY handle (12px outside rim) */}
        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("back", e)}
        >
          {/* Hit area */}
          <circle cx={ptBackHandle.x} cy={ptBackHandle.y} r={16} fill="transparent" />
          <circle
            cx={ptBackHandle.x}
            cy={ptBackHandle.y}
            r={5}
            fill={ACCENT_COLOR}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </g>

        {/* Time labels outside rim */}
        <text
          x={leaveLabelPt.x}
          y={leaveLabelPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-monospace, SF Mono, Menlo, monospace"
          fontSize={11}
          fontWeight={lastTouchedRef.current === "leave" ? 600 : 400}
          fill={INK_COLOR}
        >
          {formatHhMm(leaveMin)}
        </text>

        <text
          x={backLabelPt.x}
          y={backLabelPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-monospace, SF Mono, Menlo, monospace"
          fontSize={11}
          fontWeight={lastTouchedRef.current === "back" ? 600 : 400}
          fill={ACCENT_COLOR}
        >
          {formatHhMm(backByMin)}
        </text>
      </svg>

      {/* Target name in one line under the dial */}
      <div
        style={{
          height: 18,
          lineHeight: "18px",
          fontSize: 12,
          fontWeight: 600,
          color: INK_COLOR,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: "100%",
          padding: "0 8px",
          marginTop: 6,
        }}
      >
        {targetShop ? targetShop.name : ""}
      </div>

      {/* Day row: Mo Tu We Th Fr Sa Su */}
      <div
        style={{
          display: "flex",
          gap: 3,
          marginTop: 10,
          justifyContent: "center",
        }}
      >
        {DAYS.map((d, idx) => {
          const isActive = dayIdx === idx;
          return (
            <button
              key={d}
              onClick={() => onDayChange(idx)}
              style={{
                width: 28,
                height: 24,
                padding: 0,
                border: `1px solid ${isActive ? INK_COLOR : HAIRLINE_COLOR}`,
                background: isActive ? INK_COLOR : "transparent",
                color: isActive ? "#ffffff" : INK_COLOR,
                fontSize: 11,
                fontFamily: "system-ui, -apple-system, sans-serif",
                cursor: "pointer",
                borderRadius: 0,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const edgeHandleRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const shopsLayerRef = React.useRef(null);
  const radiusKmRef = React.useRef(INITIAL_RADIUS_KM);

  // States
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS_KM);
  // Default leave Tuesday 06:30 (Tu = index 1), back by 08:45
  const [dayIdx, setDayIdx] = React.useState(1);
  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backByMin, setBackByMin] = React.useState(8 * 60 + 45);
  const [targetIdx, setTargetIdx] = React.useState(2); // start with data row 2
  const [hoveredShop, setHoveredShop] = React.useState(null);

  const [counts, setCounts] = React.useState({
    inside: 0,
    independent: 0,
    openAndInTime: 0,
  });

  const getShops = () => {
    const raw = model.get("data");
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "object") {
      if (Array.isArray(raw.data)) {
        const cols = raw.columns || [];
        return raw.data.map((row) => {
          const item = {};
          cols.forEach((col, i) => {
            item[col] = row[i];
          });
          return item;
        });
      }
      const keys = Object.keys(raw);
      if (keys.length > 0 && typeof raw[keys[0]] === "object") {
        const rowKeys = Object.keys(raw[keys[0]]);
        return rowKeys.map((idx) => {
          const item = {};
          keys.forEach((k) => {
            item[k] = raw[k][idx];
          });
          return item;
        });
      }
    }
    return [];
  };

  const shopsRef = React.useRef(getShops());
  const leaveMinRef = React.useRef(leaveMin);
  const backByMinRef = React.useRef(backByMin);
  const dayIdxRef = React.useRef(dayIdx);
  const targetIdxRef = React.useRef(targetIdx);

  leaveMinRef.current = leaveMin;
  backByMinRef.current = backByMin;
  dayIdxRef.current = dayIdx;
  targetIdxRef.current = targetIdx;

  const evaluateState = (rKm, currentLeave, currentBackBy, curDay, curTarget) => {
    const shops = shopsRef.current;
    const insideIndices = [];
    const openOnArrival = [];
    let insideCount = 0;
    let indepCount = 0;
    let openAndInTimeCount = 0;

    for (let i = 0; i < shops.length; i++) {
      const s = shops[i];
      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      if (dist <= rKm) {
        insideIndices.push(i);
        insideCount++;
        if (!s.chain) indepCount++;

        const arriveMin = currentLeave + (s.bike_min || 0);
        const isOpen = checkIsOpen(s.hours, curDay, arriveMin);
        if (isOpen === true) {
          openOnArrival.push(i);
        }

        const roundTripMin = (s.bike_min || 0) + 10 + (s.bike_back || 0);
        const backMin = currentLeave + roundTripMin;
        const fitsInTime = backMin <= currentBackBy;

        if (isOpen === true && fitsInTime) {
          openAndInTimeCount++;
        }
      }
    }

    return {
      insideIndices,
      openOnArrival,
      insideCount,
      independentCount: indepCount,
      openAndInTimeCount,
    };
  };

  const syncAllOutputs = (rKm, insideIndices, openIndices, curDay, curLeave, curBack, curTarget) => {
    model.set("radius_km", parseFloat(rKm.toFixed(2)));
    model.set("inside", insideIndices);
    model.set("open_on_arrival", openIndices);
    model.set("when", { day: curDay, hhmm: formatHhMm(curLeave) });
    model.set("back_by", formatHhMm(curBack));
    model.set("target", curTarget);
    model.save_changes();
  };

  // Re-style shops on map
  const updateShopsVisuals = () => {
    const layer = shopsLayerRef.current;
    if (!layer) return;
    const shops = shopsRef.current;
    const rKm = radiusKmRef.current;
    const curLeave = leaveMinRef.current;
    const curBack = backByMinRef.current;
    const curDay = dayIdxRef.current;
    const curTarget = targetIdxRef.current;

    const layers = layer.getLayers();

    layers.forEach((marker) => {
      const idx = marker.__shopIndex;
      const s = shops[idx];
      if (!s) return;

      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      const isInside = dist <= rKm;
      const isTarget = idx === curTarget;

      const arriveMin = curLeave + (s.bike_min || 0);
      const arriveHhMm = formatHhMm(arriveMin);
      const isOpen = checkIsOpen(s.hours, curDay, arriveMin);

      const roundTripMin = (s.bike_min || 0) + 10 + (s.bike_back || 0);
      const backMin = curLeave + roundTripMin;
      const fitsInTime = backMin <= curBack;

      const baseOpacity = fitsInTime ? 1.0 : 0.35;

      if (isInside) {
        let labelColor = GREY_COLOR;
        let fillColor = "transparent";
        let strokeColor = INK_COLOR;
        let strokeDash = undefined;

        if (isOpen === true) {
          labelColor = OPEN_COLOR;
          fillColor = s.chain ? GREY_COLOR : ACCENT_COLOR;
          strokeColor = "#ffffff";
        } else if (isOpen === false) {
          labelColor = CLOSED_COLOR;
          fillColor = "transparent";
          strokeColor = CLOSED_COLOR;
        } else {
          // Unknown hours
          labelColor = GREY_COLOR;
          fillColor = "transparent";
          strokeColor = GREY_COLOR;
          strokeDash = "2, 2";
        }

        marker.setStyle({
          radius: isTarget ? 7 : 5,
          fillColor: fillColor,
          color: isTarget ? INK_COLOR : strokeColor,
          weight: isTarget ? 3 : 1.5,
          opacity: baseOpacity,
          fillOpacity: fillColor === "transparent" ? 0 : baseOpacity,
          dashArray: strokeDash,
        });

        // Small label 'hh:mm' next to marker
        const tooltipHtml = `<span style="font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:10px;font-variant-numeric:tabular-nums;color:${labelColor};opacity:${baseOpacity};">${arriveHhMm}</span>`;
        if (marker.getTooltip()) {
          marker.setTooltipContent(tooltipHtml);
        } else {
          marker.bindTooltip(tooltipHtml, {
            permanent: true,
            direction: "right",
            offset: [6, 0],
            className: "shop-arrival-tooltip",
          });
        }
      } else {
        // Outside circle
        if (marker.getTooltip()) {
          marker.unbindTooltip();
        }
        marker.setStyle({
          radius: 3,
          fillColor: GREY_COLOR,
          color: HAIRLINE_COLOR,
          weight: 0.8,
          opacity: 0.45,
          fillOpacity: 0.35,
          dashArray: undefined,
        });
      }
    });
  };

  const updateHandleAndCircle = (rKm) => {
    if (circleRef.current) {
      circleRef.current.setRadius(rKm * 1000);
    }
    if (edgeHandleRef.current) {
      const handlePos = destinationPoint(HOTEL.lat, HOTEL.lon, 90, rKm);
      edgeHandleRef.current.setLatLng(handlePos);
      const labelText = `${rKm.toFixed(1)} km`;
      edgeHandleRef.current.setTooltipContent(
        `<span style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_COLOR};padding:1px 3px;font-weight:500;">${labelText}</span>`
      );
    }
  };

  // Dragging / radius update helper
  const applyNewRadius = (newR) => {
    const clamped = Math.max(0.4, Math.min(25, newR));
    radiusKmRef.current = clamped;
    updateHandleAndCircle(clamped);
    updateShopsVisuals();
    const evalRes = evaluateState(
      clamped,
      leaveMinRef.current,
      backByMinRef.current,
      dayIdxRef.current,
      targetIdxRef.current
    );
    setCounts({
      inside: evalRes.insideCount,
      independent: evalRes.independentCount,
      openAndInTime: evalRes.openAndInTimeCount,
    });
    setRadiusKm(clamped);
    syncAllOutputs(
      clamped,
      evalRes.insideIndices,
      evalRes.openOnArrival,
      dayIdxRef.current,
      leaveMinRef.current,
      backByMinRef.current,
      targetIdxRef.current
    );
  };

  // Initialize map and layers
  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [HOTEL.lat, HOTEL.lon],
      zoom: 12,
      zoomControl: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "Esri, HERE, Garmin, OpenStreetMap contributors",
      }
    ).addTo(map);

    // Bike reach geojson bands
    const reachData = model.get("reach");
    const bikeReach = reachData && reachData.bike ? reachData.bike : null;
    if (bikeReach) {
      // 30, 20, 10 minute bike reach
      // translucent grey-blue bands at 6%, 9%, 12% opacity (darker the closer, never heavier than that)
      const reachGroup = L.geoJSON(bikeReach, {
        style: (feature) => {
          const contour = feature.properties ? feature.properties.contour : 30;
          let opacity = 0.06;
          if (contour <= 10) opacity = 0.12;
          else if (contour <= 20) opacity = 0.09;
          return {
            fillColor: "#4a6984",
            fillOpacity: opacity,
            weight: 0.5,
            color: "#4a6984",
            opacity: opacity * 1.5,
          };
        },
        interactive: false,
      }).addTo(map);
      reachLayerRef.current = reachGroup;
    }

    // Hotel fixed ink pin
    const hotelIcon = L.divIcon({
      className: "hotel-pin-icon",
      html: `
        <svg width="24" height="24" viewBox="0 0 24 24" style="overflow:visible;display:block;">
          <circle cx="12" cy="12" r="5" fill="${INK_COLOR}" stroke="#ffffff" stroke-width="1.5" />
          <line x1="12" y1="17" x2="12" y2="22" stroke="${INK_COLOR}" stroke-width="2" stroke-linecap="round" />
        </svg>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 22],
    });

    L.marker([HOTEL.lat, HOTEL.lon], {
      icon: hotelIcon,
      interactive: true,
      zIndexOffset: 1000,
    })
      .bindTooltip("hotel", {
        permanent: false,
        direction: "top",
        offset: [0, -20],
        className: "hotel-tooltip",
      })
      .addTo(map);

    // Circle centered on hotel - stays on top of reach bands
    const circle = L.circle([HOTEL.lat, HOTEL.lon], {
      radius: radiusKmRef.current * 1000,
      color: INK_COLOR,
      weight: 1.5,
      opacity: 0.85,
      fillColor: INK_COLOR,
      fillOpacity: 0.03,
      interactive: true,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable edge handle on the eastern rim of the circle
    const handlePos = destinationPoint(
      HOTEL.lat,
      HOTEL.lon,
      90,
      radiusKmRef.current
    );
    const handleIcon = L.divIcon({
      className: "edge-handle-icon",
      html: `
        <div style="width:24px;height:24px;margin:-12px 0 0 -12px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;">
          <div style="width:9px;height:9px;border-radius:50%;background:${INK_COLOR};border:1.5px solid #ffffff;box-sizing:border-box;"></div>
        </div>
      `,
      iconSize: [0, 0],
    });

    const edgeHandle = L.marker(handlePos, {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 1200,
    }).addTo(map);
    edgeHandleRef.current = edgeHandle;

    edgeHandle.bindTooltip(
      `<span style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_COLOR};padding:1px 3px;font-weight:500;">${radiusKmRef.current.toFixed(
        1
      )} km</span>`,
      {
        permanent: true,
        direction: "right",
        offset: [10, 0],
        className: "edge-radius-tooltip",
      }
    );

    edgeHandle.on("dragstart", () => {
      map.dragging.disable();
    });

    edgeHandle.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyNewRadius(dist);
    });

    edgeHandle.on("dragend", (e) => {
      map.dragging.enable();
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyNewRadius(dist);
    });

    let circleEdgeDragging = false;
    circle.on("mousedown", (e) => {
      const clickedDist = distanceKm(
        HOTEL.lat,
        HOTEL.lon,
        e.latlng.lat,
        e.latlng.lng
      );
      const diff = Math.abs(clickedDist - radiusKmRef.current);
      if (diff < Math.max(0.4, radiusKmRef.current * 0.18)) {
        circleEdgeDragging = true;
        map.dragging.disable();
        applyNewRadius(clickedDist);
      }
    });

    const onMapMouseMove = (e) => {
      if (circleEdgeDragging) {
        const dist = distanceKm(
          HOTEL.lat,
          HOTEL.lon,
          e.latlng.lat,
          e.latlng.lng
        );
        applyNewRadius(dist);
      }
    };

    const onMapMouseUp = () => {
      if (circleEdgeDragging) {
        circleEdgeDragging = false;
        map.dragging.enable();
      }
    };

    map.on("mousemove", onMapMouseMove);
    map.on("mouseup", onMapMouseUp);

    // Shops layer
    const shopsGroup = L.layerGroup().addTo(map);
    shopsLayerRef.current = shopsGroup;

    const shops = shopsRef.current;
    shops.forEach((shop, index) => {
      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: 5,
        fillColor: GREY_COLOR,
        color: "#ffffff",
        weight: 1,
        fillOpacity: 1,
      });
      marker.__shopIndex = index;

      marker.on("mouseover", () => {
        setHoveredShop(shop);
        marker.bringToFront();
      });

      marker.on("mouseout", () => {
        setHoveredShop(null);
      });

      marker.on("click", () => {
        setTargetIdx(index);
        targetIdxRef.current = index;
        updateShopsVisuals();
        const evalRes = evaluateState(
          radiusKmRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          dayIdxRef.current,
          index
        );
        syncAllOutputs(
          radiusKmRef.current,
          evalRes.insideIndices,
          evalRes.openOnArrival,
          dayIdxRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          index
        );
      });

      marker.addTo(shopsGroup);
    });

    // Initial evaluation & outputs
    updateShopsVisuals();
    const initEval = evaluateState(
      radiusKmRef.current,
      leaveMinRef.current,
      backByMinRef.current,
      dayIdxRef.current,
      targetIdxRef.current
    );
    setCounts({
      inside: initEval.insideCount,
      independent: initEval.independentCount,
      openAndInTime: initEval.openAndInTimeCount,
    });
    syncAllOutputs(
      radiusKmRef.current,
      initEval.insideIndices,
      initEval.openOnArrival,
      dayIdxRef.current,
      leaveMinRef.current,
      backByMinRef.current,
      targetIdxRef.current
    );

    const onDataChange = () => {
      shopsRef.current = getShops();
      shopsGroup.clearLayers();
      shopsRef.current.forEach((shop, index) => {
        const marker = L.circleMarker([shop.lat, shop.lon], {
          radius: 5,
          fillColor: GREY_COLOR,
          color: "#ffffff",
          weight: 1,
          fillOpacity: 1,
        });
        marker.__shopIndex = index;
        marker.on("mouseover", () => {
          setHoveredShop(shop);
          marker.bringToFront();
        });
        marker.on("mouseout", () => {
          setHoveredShop(null);
        });
        marker.on("click", () => {
          setTargetIdx(index);
          targetIdxRef.current = index;
          updateShopsVisuals();
          const evalRes = evaluateState(
            radiusKmRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            dayIdxRef.current,
            index
          );
          syncAllOutputs(
            radiusKmRef.current,
            evalRes.insideIndices,
            evalRes.openOnArrival,
            dayIdxRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            index
          );
        });
        marker.addTo(shopsGroup);
      });
      updateShopsVisuals();
      const evalRes = evaluateState(
        radiusKmRef.current,
        leaveMinRef.current,
        backByMinRef.current,
        dayIdxRef.current,
        targetIdxRef.current
      );
      setCounts({
        inside: evalRes.insideCount,
        independent: evalRes.independentCount,
        openAndInTime: evalRes.openAndInTimeCount,
      });
      syncAllOutputs(
        radiusKmRef.current,
        evalRes.insideIndices,
        evalRes.openOnArrival,
        dayIdxRef.current,
        leaveMinRef.current,
        backByMinRef.current,
        targetIdxRef.current
      );
    };

    model.on("change:data", onDataChange);

    return () => {
      model.off("change:data", onDataChange);
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
    };
  }, []);

  // Update shop visuals live when leaveMin, backByMin, dayIdx, or targetIdx change
  React.useEffect(() => {
    updateShopsVisuals();
    const evalRes = evaluateState(
      radiusKmRef.current,
      leaveMin,
      backByMin,
      dayIdx,
      targetIdx
    );
    setCounts({
      inside: evalRes.insideCount,
      independent: evalRes.independentCount,
      openAndInTime: evalRes.openAndInTimeCount,
    });
    syncAllOutputs(
      radiusKmRef.current,
      evalRes.insideIndices,
      evalRes.openOnArrival,
      dayIdx,
      leaveMin,
      backByMin,
      targetIdx
    );
  }, [leaveMin, backByMin, dayIdx, targetIdx]);

  const shops = shopsRef.current;
  const currentTargetShop =
    targetIdx >= 0 && targetIdx < shops.length ? shops[targetIdx] : null;

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        padding: 12,
        boxSizing: "border-box",
        position: "relative",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      }}
    >
      <style>{`
        .edge-radius-tooltip {
          background: rgba(255, 255, 255, 0.95) !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
          padding: 2px 6px !important;
          border-radius: 0 !important;
        }
        .edge-radius-tooltip::before {
          border-right-color: ${HAIRLINE_COLOR} !important;
        }
        .shop-arrival-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .shop-arrival-tooltip::before {
          display: none !important;
        }
        .hotel-tooltip {
          background: ${INK_COLOR} !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
          font-family: system-ui, -apple-system, Inter, Helvetica, sans-serif !important;
          border-radius: 0 !important;
        }
        .hotel-tooltip::before {
          border-top-color: ${INK_COLOR} !important;
        }
        .leaflet-container {
          background-color: #f2f2f2;
          font-family: inherit;
        }
        .leaflet-bar {
          border-radius: 0 !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
        }
        .leaflet-bar a {
          border-radius: 0 !important;
          color: ${INK_COLOR} !important;
          border-bottom: 1px solid ${HAIRLINE_COLOR} !important;
        }
        .leaflet-bar a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-attribution {
          background: rgba(255, 255, 255, 0.85) !important;
          color: ${GREY_COLOR} !important;
          font-size: 10px !important;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: 560,
          border: `1px solid ${HAIRLINE_COLOR}`,
          overflow: "hidden",
        }}
      >
        {/* Map side */}
        <div
          style={{
            position: "relative",
            flex: 1,
            height: "100%",
            borderRight: `1px solid ${HAIRLINE_COLOR}`,
          }}
        >
          <CountLine
            insideCount={counts.inside}
            independentCount={counts.independent}
            openAndInTimeCount={counts.openAndInTime}
          />
          <TooltipOverlay hoveredShop={hoveredShop} />
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* 12-hour dial right of the map */}
        <div
          style={{
            width: 300,
            height: "100%",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ClockDial
            leaveMin={leaveMin}
            backByMin={backByMin}
            targetShop={currentTargetShop}
            dayIdx={dayIdx}
            onDayChange={setDayIdx}
            onLeaveChange={setLeaveMin}
            onBackByChange={setBackByMin}
            React={React}
          />
        </div>
      </div>
    </div>
  );
}