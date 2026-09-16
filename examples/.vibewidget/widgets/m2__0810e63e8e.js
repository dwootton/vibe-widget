import L from "https://esm.sh/leaflet@1.9.4";

function injectLeafletStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("leaflet-base-styles")) return;
  const link = document.createElement("link");
  link.id = "leaflet-base-styles";
  link.rel = "stylesheet";
  link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

// Parse OSM opening hours syntax for a given day (0=Mo .. 6=Su) and minute-of-day (0..1439)
// Returns: true (open), false (closed), null (unknown)
export function checkIsOpen(hoursStr, dayIndex, minutesOfDay) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const raw = hoursStr.trim();
  if (!raw) return null;
  if (raw === "24/7") return true;

  const dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const targetDay = dayNames[dayIndex];

  // Split multiple rules separated by semicolon
  const rules = raw.split(";").map((r) => r.trim()).filter(Boolean);

  let hasApplicableRule = false;
  let isOpenNow = false;

  for (const rule of rules) {
    if (rule.toLowerCase() === "off") continue;

    // Pattern: [Days] HH:MM-HH:MM[, HH:MM-HH:MM...] OR just HH:MM-HH:MM
    // e.g. "Mo-Sa 04:00-14:00", "05:00-20:00", "Tu-Fr 10:00-18:00, 19:00-21:00"
    const parts = rule.split(/\s+/);
    let daySpec = null;
    let timePart = "";

    if (parts.length === 1) {
      // Just time part, e.g. "05:00-20:00" -> applies all days
      timePart = parts[0];
    } else {
      // First part is day spec or comma-separated days
      daySpec = parts[0];
      timePart = parts.slice(1).join(" ");
    }

    let appliesToDay = false;
    if (!daySpec) {
      appliesToDay = true;
    } else {
      // Check day match
      const subDays = daySpec.split(",").map((s) => s.trim());
      for (const sd of subDays) {
        if (sd.includes("-")) {
          const [startD, endD] = sd.split("-").map((s) => s.trim());
          const sIdx = dayNames.indexOf(startD);
          const eIdx = dayNames.indexOf(endD);
          if (sIdx !== -1 && eIdx !== -1) {
            if (sIdx <= eIdx) {
              if (dayIndex >= sIdx && dayIndex <= eIdx) appliesToDay = true;
            } else {
              // Wrap around e.g. Sa-Tu
              if (dayIndex >= sIdx || dayIndex <= eIdx) appliesToDay = true;
            }
          }
        } else if (sd === targetDay) {
          appliesToDay = true;
        }
      }
    }

    if (appliesToDay) {
      hasApplicableRule = true;
      if (timePart.toLowerCase() === "off") {
        return false;
      }
      // Parse time spans e.g. "04:00-14:00"
      const timeRanges = timePart.split(",").map((t) => t.trim());
      for (const tr of timeRanges) {
        const match = tr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (match) {
          const startMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          const endMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
          if (endMin < startMin) {
            // Over midnight
            if (minutesOfDay >= startMin || minutesOfDay < endMin) {
              isOpenNow = true;
            }
          } else {
            if (minutesOfDay >= startMin && minutesOfDay < endMin) {
              isOpenNow = true;
            }
          }
        }
      }
    }
  }

  if (!hasApplicableRule) return null;
  return isOpenNow;
}

export function formatHhMm(totalMinutes) {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = Math.floor(norm % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const StatusBadge = ({
  insideCount = 0,
  independentCount = 0,
  openCount = 0,
}) => (
  <div
    style={{
      position: "absolute",
      top: 12,
      left: 12,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.94)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      border: "1px solid #1a1a1a",
      boxShadow: "3px 3px 0px #1a1a1a",
      borderRadius: "4px",
      padding: "6px 12px",
      fontFamily: "'Fira Code', monospace",
      fontSize: "11px",
      letterSpacing: "0.02em",
      color: "#1a1a1a",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#e65100",
        boxShadow: "0 0 0 2px rgba(230, 81, 0, 0.25)",
      }}
    />
    <div>
      <span style={{ fontWeight: 700 }}>{insideCount}</span> inside
      <span style={{ margin: "0 5px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#d84315" }}>{independentCount}</span> independent
      <span style={{ margin: "0 5px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#2e7d32" }}>{openCount}</span> open on arrival
    </div>
  </div>
);

export const ShopInspector = ({ shop, leaveMinutes = 390, dayIndex = 1 }) => {
  if (!shop) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 1000,
          background: "rgba(253, 251, 247, 0.92)",
          border: "1px dashed #999",
          borderRadius: "4px",
          padding: "5px 10px",
          fontFamily: "'Fira Code', monospace",
          fontSize: "11px",
          color: "#444",
          pointerEvents: "none",
        }}
      >
        Hover or click a shop dot to inspect / target
      </div>
    );
  }

  const arrivalMin = leaveMinutes + (shop.bike_min || 0);
  const status = checkIsOpen(shop.hours, dayIndex, arrivalMin % 1440);
  const statusText =
    status === true ? "OPEN" : status === false ? "CLOSED" : "HOURS UNKNOWN";
  const statusBg =
    status === true ? "#2e7d32" : status === false ? "#c62828" : "#616161";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 1000,
        maxWidth: "320px",
        background: "#fdfbf7",
        border: "1px solid #1a1a1a",
        boxShadow: "3px 3px 0px #1a1a1a",
        borderRadius: "4px",
        padding: "8px 12px",
        fontFamily: "'Fira Code', monospace",
        fontSize: "11px",
        color: "#1a1a1a",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "14px",
          fontWeight: 700,
          marginBottom: "2px",
          color: "#111",
          lineHeight: 1.2,
        }}
      >
        {shop.name}
      </div>
      <div style={{ color: "#555", fontSize: "10.5px", marginBottom: "3px" }}>
        {shop.street || "Street address unlisted"} · {Number(shop.km_from_hotel).toFixed(2)} km
      </div>
      <div style={{ fontSize: "10px", color: "#444", marginBottom: "4px" }}>
        <strong>Hours:</strong> {shop.hours || "Unlisted"}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "4px" }}>
        <span
          style={{
            fontSize: "9.5px",
            textTransform: "uppercase",
            padding: "2px 5px",
            borderRadius: "2px",
            background: shop.chain ? "#e0e0e0" : "#ffeed9",
            color: shop.chain ? "#222" : "#b23c00",
            fontWeight: 700,
          }}
        >
          {shop.chain ? "Chain" : "Independent"}
        </span>
        <span
          style={{
            fontSize: "9.5px",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "2px",
            background: statusBg,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          {statusText}
        </span>
        <span style={{ fontSize: "10px", color: "#333", marginLeft: "auto", fontWeight: 600 }}>
          {shop.bike_min ? `${Math.round(shop.bike_min)}m bike` : ""}
        </span>
      </div>
    </div>
  );
};

// 24h Clock Dial Component with Draggable LEAVE & ARRIVE Hands and Day Selector
export const ClockDialPanel = ({
  React,
  leaveMinutes,
  targetShop,
  dayIndex,
  onLeaveChange,
  onDayChange,
}) => {
  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const activeDragRef = React.useRef(null); // 'leave' | 'arrive' | null

  const bikeMin = targetShop && targetShop.bike_min != null ? targetShop.bike_min : 15;
  const arriveMinutes = leaveMinutes + bikeMin;

  const R = 95; // dial radius
  const CX = 135;
  const CY = 125;
  const R_LEAVE = R;
  const R_ARRIVE = R * 0.7;

  // Convert minutes (0..1440) to dial angle (radians and degrees). 0 min (midnight) is top (-PI/2)
  const minToAngle = (m) => {
    const frac = ((m % 1440) + 1440) % 1440 / 1440;
    return frac * 2 * Math.PI - Math.PI / 2;
  };

  // Convert dial angle back to minutes (0..1439)
  const angleToMin = (angle) => {
    let shifted = angle + Math.PI / 2;
    while (shifted < 0) shifted += 2 * Math.PI;
    while (shifted >= 2 * Math.PI) shifted -= 2 * Math.PI;
    return (shifted / (2 * Math.PI)) * 1440;
  };

  const angleLeave = minToAngle(leaveMinutes);
  const angleArrive = minToAngle(arriveMinutes);

  const leavePos = {
    x: CX + R_LEAVE * Math.cos(angleLeave),
    y: CY + R_LEAVE * Math.sin(angleLeave),
  };
  const arrivePos = {
    x: CX + R_ARRIVE * Math.cos(angleArrive),
    y: CY + R_ARRIVE * Math.sin(angleArrive),
  };

  // SVG wedge path between angleLeave and angleArrive clockwise
  const wedgePath = React.useMemo(() => {
    const a1 = angleLeave;
    let delta = angleArrive - angleLeave;
    while (delta < 0) delta += 2 * Math.PI;
    while (delta >= 2 * Math.PI) delta -= 2 * Math.PI;
    const a2 = a1 + delta;

    const largeArc = delta > Math.PI ? 1 : 0;
    const x1 = CX + R * Math.cos(a1);
    const y1 = CY + R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2);
    const y2 = CY + R * Math.sin(a2);

    return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }, [angleLeave, angleArrive, R, CX, CY]);

  // Wedge mid angle for the duration label
  const midAngle = angleLeave + ((angleArrive - angleLeave + 2 * Math.PI) % (2 * Math.PI)) / 2;
  const wedgeLabelR = R * 0.42;
  const wedgeLabelPos = {
    x: CX + wedgeLabelR * Math.cos(midAngle),
    y: CY + wedgeLabelR * Math.sin(midAngle),
  };

  // Non-overlapping label placements for LEAVE and ARRIVE handles
  // LEAVE handle is at outer rim (R); push label outward
  const leaveLabelR = R_LEAVE + 20;
  const leaveLabelPos = {
    x: CX + leaveLabelR * Math.cos(angleLeave),
    y: CY + leaveLabelR * Math.sin(angleLeave),
  };

  // ARRIVE handle is at inner ring (0.7 R); push label inwards or offset
  const arriveLabelR = Math.max(R_ARRIVE - 20, 26);
  const arriveLabelPos = {
    x: CX + arriveLabelR * Math.cos(angleArrive),
    y: CY + arriveLabelR * Math.sin(angleArrive),
  };

  // Keyboard navigation for 15-min nudges
  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onLeaveChange(leaveMinutes - 15);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onLeaveChange(leaveMinutes + 15);
    }
  };

  // Pointer drag logic
  const handlePointerDown = (which, e) => {
    e.preventDefault();
    activeDragRef.current = which;
    if (containerRef.current) {
      containerRef.current.focus();
    }

    const onMove = (moveEvt) => {
      if (!activeDragRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const pointerX = moveEvt.clientX - rect.left;
      const pointerY = moveEvt.clientY - rect.top;
      const angle = Math.atan2(pointerY - CY, pointerX - CX);
      const m = angleToMin(angle);

      if (activeDragRef.current === "leave") {
        onLeaveChange(m);
      } else if (activeDragRef.current === "arrive") {
        onLeaveChange(m - bikeMin);
      }
    };

    const onUp = () => {
      activeDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Dial hour marks 0, 3, 6, 9, 12, 15, 18, 21
  const dialTicks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
    const ang = (h / 24) * 2 * Math.PI - Math.PI / 2;
    const tx = CX + (R - 6) * Math.cos(ang);
    const ty = CY + (R - 6) * Math.sin(ang);
    const lx = CX + (R - 16) * Math.cos(ang);
    const ly = CY + (R - 16) * Math.sin(ang);
    return { h, tx, ty, lx, ly };
  });

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: "270px",
        height: "560px",
        background: "#fdfbf7",
        borderLeft: "1px solid #1a1a1a",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "14px 12px",
        outline: "none",
        userSelect: "none",
      }}
    >
      {/* Header & Target Shop Name */}
      <div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "15px",
            fontWeight: 800,
            color: "#1a1a1a",
            letterSpacing: "-0.01em",
            marginBottom: "2px",
          }}
        >
          Departure & Arrival
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#555",
            marginBottom: "10px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Target:{" "}
          <strong style={{ color: "#d84315" }}>
            {targetShop ? targetShop.name : "None selected"}
          </strong>
        </div>

        {/* 24h Clock Dial SVG */}
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <svg
            ref={svgRef}
            width="270"
            height="260"
            style={{ overflow: "visible", cursor: "default" }}
          >
            {/* Dial Background circle */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="#f7f3ea"
              stroke="#1a1a1a"
              strokeWidth="1.5"
            />
            {/* 70% inner circle guideline */}
            <circle
              cx={CX}
              cy={CY}
              r={R_ARRIVE}
              fill="none"
              stroke="#dedede"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Hour ticks and labels */}
            {dialTicks.map(({ h, lx, ly }) => (
              <text
                key={h}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#888"
                fontSize="9.5"
                fontFamily="'Fira Code', monospace"
              >
                {h}
              </text>
            ))}

            {/* Shaded Wedge between hands */}
            <path
              d={wedgePath}
              fill="rgba(245, 124, 0, 0.28)"
              stroke="#e65100"
              strokeWidth="1"
              strokeDasharray="2 2"
              pointerEvents="none"
            />

            {/* Wedge label: <n> min by bike */}
            <text
              x={wedgeLabelPos.x}
              y={wedgeLabelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#b23c00"
              fontSize="9"
              fontWeight="700"
              fontFamily="'Fira Code', monospace"
              pointerEvents="none"
            >
              {Math.round(bikeMin)}m bike
            </text>

            {/* LEAVE Hand (Dark) */}
            <line
              x1={CX}
              y1={CY}
              x2={leavePos.x}
              y2={leavePos.y}
              stroke="#1a1a1a"
              strokeWidth="2.5"
              strokeLinecap="round"
              pointerEvents="none"
            />

            {/* ARRIVE Hand (Orange) */}
            <line
              x1={CX}
              y1={CY}
              x2={arrivePos.x}
              y2={arrivePos.y}
              stroke="#e65100"
              strokeWidth="2.5"
              strokeLinecap="round"
              pointerEvents="none"
            />

            {/* ARRIVE Handle (rides 70% inner ring) with hit circle */}
            <g
              transform={`translate(${arrivePos.x}, ${arrivePos.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => handlePointerDown("arrive", e)}
            >
              <circle r="14" fill="transparent" />
              <circle r="7.5" fill="#e65100" stroke="#fff" strokeWidth="2" />
            </g>

            {/* LEAVE Handle (rides outer rim R) with hit circle */}
            <g
              transform={`translate(${leavePos.x}, ${leavePos.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => handlePointerDown("leave", e)}
            >
              <circle r="15" fill="transparent" />
              <circle r="8.5" fill="#1a1a1a" stroke="#fff" strokeWidth="2" />
            </g>

            {/* Center cap */}
            <circle cx={CX} cy={CY} r="4" fill="#1a1a1a" />

            {/* Time badge for LEAVE handle (non-overlapping, outer) */}
            <g transform={`translate(${leaveLabelPos.x}, ${leaveLabelPos.y})`} pointerEvents="none">
              <rect
                x="-22"
                y="-9"
                width="44"
                height="18"
                rx="3"
                fill="#1a1a1a"
                stroke="#fff"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="'Fira Code', monospace"
              >
                {formatHhMm(leaveMinutes)}
              </text>
            </g>

            {/* Time badge for ARRIVE handle (non-overlapping, inner) */}
            <g transform={`translate(${arriveLabelPos.x}, ${arriveLabelPos.y})`} pointerEvents="none">
              <rect
                x="-22"
                y="-9"
                width="44"
                height="18"
                rx="3"
                fill="#e65100"
                stroke="#fff"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="'Fira Code', monospace"
              >
                {formatHhMm(arriveMinutes)}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Legend & Day Buttons Row */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10.5px",
            color: "#333",
            marginBottom: "8px",
            padding: "0 4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#1a1a1a",
                display: "inline-block",
              }}
            />
            <span>Leave</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#e65100",
                display: "inline-block",
              }}
            />
            <span>Arrive</span>
          </div>
          <div style={{ color: "#777", fontSize: "10px" }}>Use ◀ ▶ keys</div>
        </div>

        {/* Compact row of 7 small day buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "3px",
            marginBottom: "6px",
          }}
        >
          {days.map((d, i) => {
            const isSelected = i === dayIndex;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onDayChange(i)}
                style={{
                  padding: "5px 0",
                  fontFamily: "'Fira Code', monospace",
                  fontSize: "10px",
                  fontWeight: isSelected ? 700 : 500,
                  border: isSelected ? "1px solid #1a1a1a" : "1px solid #d0ceca",
                  background: isSelected ? "#1a1a1a" : "#f5f3ee",
                  color: isSelected ? "#ffffff" : "#333333",
                  borderRadius: "3px",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow: isSelected ? "1px 1px 0px #1a1a1a" : "none",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>

        {/* Status Indicator Note */}
        <div
          style={{
            fontSize: "10px",
            color: "#666",
            background: "#f3efe6",
            padding: "5px 7px",
            borderRadius: "4px",
            border: "1px dashed #ccc",
            lineHeight: 1.3,
          }}
        >
          <span>Dot ring styles on map:</span>
          <div style={{ display: "flex", gap: "6px", marginTop: "3px" }}>
            <span style={{ color: "#2e7d32", fontWeight: 700 }}>● Open</span>
            <span style={{ color: "#c62828", fontWeight: 700 }}>○ Closed</span>
            <span style={{ color: "#757575", fontWeight: 700 }}>◌ ?</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  injectLeafletStyles();

  // Normalize data rows
  const rawData = model.get("data");
  const data = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length === 0) return [];
      const firstCol = rawData[keys[0]];
      const len = Array.isArray(firstCol)
        ? firstCol.length
        : Object.keys(firstCol).length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        keys.forEach((k) => {
          row[k] = Array.isArray(rawData[k]) ? rawData[k][i] : rawData[k][i];
        });
        rows.push(row);
      }
      return rows;
    }
    return [];
  }, [rawData]);

  const rawReach = model.get("reach");

  const HOTEL_LAT = 29.7522;
  const HOTEL_LON = -95.3578;
  const INITIAL_RADIUS = 3.5;

  // States
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [targetIndex, setTargetIndex] = React.useState(2); // start with row 2 targeted
  const [dayIndex, setDayIndex] = React.useState(1); // start with Tue (0=Mo, 1=Tu)
  const [leaveMinutes, setLeaveMinutes] = React.useState(6 * 60 + 30); // 06:30 = 390
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [insideIndices, setInsideIndices] = React.useState([]);
  const [openIndices, setOpenIndices] = React.useState([]);

  // Refs for Leaflet objects and gestures
  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const shopLabelMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  // Live state refs to avoid effect recreation during drags
  const leaveMinutesRef = React.useRef(leaveMinutes);
  leaveMinutesRef.current = leaveMinutes;
  const dayIndexRef = React.useRef(dayIndex);
  dayIndexRef.current = dayIndex;
  const targetIndexRef = React.useRef(targetIndex);
  targetIndexRef.current = targetIndex;

  // Initialize declared outputs
  React.useEffect(() => {
    const initWhen = { day: 1, hhmm: "06:30" };
    model.set("radius_km", INITIAL_RADIUS);
    model.set("target", 2);
    model.set("when", initWhen);
    model.set("inside", []);
    model.set("open_on_arrival", []);
    model.save_changes();
  }, []);

  // Compute inside indices given radius
  const computeInside = React.useCallback(
    (radKm) => {
      const inside = [];
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      data.forEach((row, idx) => {
        const lat = row.lat;
        const lon = row.lon;
        if (lat == null || lon == null) return;
        const distM = hotelLatLng.distanceTo(L.latLng(lat, lon));
        if (distM <= radKm * 1000) {
          inside.push(idx);
        }
      });
      return inside;
    },
    [data]
  );

  // Function to place edge label at (hotel + radius due East)
  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    const deltaLon = rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

  // Sync dot styles and arrival labels live across all shops
  const updateDotsAndLabels = React.useCallback(() => {
    const rKm = currentRadiusRef.current;
    const lMin = leaveMinutesRef.current;
    const dIdx = dayIndexRef.current;
    const tIdx = targetIndexRef.current;
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);

    const insideArr = [];
    const openArr = [];

    shopMarkersRef.current.forEach(({ marker, row, index }) => {
      const distM = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
      const isInside = distM <= rKm * 1000;
      const isTarget = index === tIdx;
      const arrivalMin = lMin + (row.bike_min != null ? row.bike_min : 0);
      const isOpen = checkIsOpen(row.hours, dIdx, arrivalMin % 1440);

      if (isInside) {
        insideArr.push(index);
        if (isOpen === true) {
          openArr.push(index);
        }
      }

      // Restyle marker:
      // Open -> solid dot (color fill)
      // Closed -> hollow ring (transparent fill, red stroke)
      // Unknown -> dashed ring (grey stroke)
      // Target gets thick ring
      let strokeColor = "#1a1a1a";
      let fillColor = row.chain ? "#616161" : "#f57c00";
      let fillOpacity = 0.95;
      let strokeWidth = isTarget ? 3.5 : 1.5;
      let dashArray = null;

      if (!isInside) {
        // Outside circle: subdued
        fillColor = row.chain ? "#9e9e9e" : "#ffb74d";
        strokeColor = "#888";
        strokeWidth = isTarget ? 3 : 1;
        fillOpacity = 0.25;
      } else {
        // Inside circle
        if (isOpen === true) {
          fillColor = "#2e7d32"; // solid green dot
          strokeColor = isTarget ? "#ff3d00" : "#1b5e20";
          fillOpacity = 0.95;
        } else if (isOpen === false) {
          fillColor = "#ffffff"; // hollow ring
          strokeColor = isTarget ? "#ff3d00" : "#c62828";
          strokeWidth = isTarget ? 4 : 2.2;
          fillOpacity = 0.05;
        } else {
          // unknown hours
          fillColor = "#ffffff";
          strokeColor = isTarget ? "#ff3d00" : "#757575";
          strokeWidth = isTarget ? 3.5 : 1.8;
          dashArray = "3, 3";
          fillOpacity = 0.05;
        }
      }

      marker.setStyle({
        radius: isTarget ? 8.5 : isInside ? 6.5 : 4,
        color: strokeColor,
        weight: strokeWidth,
        fillColor: fillColor,
        fillOpacity: fillOpacity,
        opacity: isInside ? 1 : 0.35,
        dashArray: dashArray,
      });

      if (isTarget && marker.bringToFront) {
        marker.bringToFront();
      }

      // Update shop small arrival label
      const labelObj = shopLabelMarkersRef.current[index];
      if (labelObj && labelObj.marker) {
        const el = labelObj.marker.getElement();
        if (el) {
          if (!isInside) {
            el.style.display = "none";
          } else {
            el.style.display = "block";
            const textSpan = el.querySelector(".shop-time-text");
            if (textSpan) {
              textSpan.textContent = formatHhMm(arrivalMin);
              // Color label based on open/closed/unknown
              if (isOpen === true) {
                textSpan.style.color = "#1b5e20";
                textSpan.style.borderColor = "#a5d6a7";
                textSpan.style.background = "rgba(232, 245, 233, 0.92)";
              } else if (isOpen === false) {
                textSpan.style.color = "#b71c1c";
                textSpan.style.borderColor = "#ef9a9a";
                textSpan.style.background = "rgba(255, 235, 238, 0.92)";
              } else {
                textSpan.style.color = "#616161";
                textSpan.style.borderColor = "#e0e0e0";
                textSpan.style.background = "rgba(245, 245, 245, 0.92)";
              }
            }
          }
        }
      }
    });

    setInsideIndices(insideArr);
    setOpenIndices(openArr);

    model.set("inside", insideArr);
    model.set("open_on_arrival", openArr);
    model.set("target", tIdx);
    model.set("when", { day: dIdx, hhmm: formatHhMm(lMin) });
    model.save_changes();
  }, [model]);

  // Apply radius changes
  const applyRadius = React.useCallback(
    (newR) => {
      currentRadiusRef.current = newR;
      setRadiusKm(newR);

      if (circleRef.current) {
        circleRef.current.setRadius(newR * 1000);
      }
      if (circleHitRef.current) {
        circleHitRef.current.setRadius(newR * 1000);
      }
      if (edgeLabelMarkerRef.current) {
        edgeLabelMarkerRef.current.setLatLng(getEdgeLatLng(newR));
        const el = edgeLabelMarkerRef.current.getElement();
        if (el) {
          const textEl = el.querySelector(".edge-label-text");
          if (textEl) textEl.textContent = `${newR.toFixed(2)} km`;
        }
      }

      model.set("radius_km", Number(newR.toFixed(3)));
      updateDotsAndLabels();
    },
    [getEdgeLatLng, updateDotsAndLabels, model]
  );

  // Initialize Map
  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [HOTEL_LAT, HOTEL_LON],
      zoom: 12,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    // OSM Carto Positron / Standard
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Render reach.bike geojson bands under shops
    const bikeReach = rawReach && rawReach.bike ? rawReach.bike : null;
    if (bikeReach) {
      // 30, 20, 10 min bike reach: darker the closer (10 min darkest, 30 min lightest)
      const reachLayer = L.geoJSON(bikeReach, {
        style: (feature) => {
          const contour = feature.properties ? feature.properties.contour : 30;
          let fillOpacity = 0.12;
          let fillColor = "#64b5f6";
          if (contour <= 10) {
            fillOpacity = 0.38;
            fillColor = "#1976d2";
          } else if (contour <= 20) {
            fillOpacity = 0.24;
            fillColor = "#2196f3";
          }
          return {
            fillColor: fillColor,
            fillOpacity: fillOpacity,
            color: "#1565c0",
            weight: 1,
            opacity: 0.45,
          };
        },
        interactive: false,
      }).addTo(map);
      reachLayerRef.current = reachLayer;
    }

    // Hotel Dark Pin Marker
    const hotelPinHtml = `
      <div style="
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <span style="
          background: #111;
          color: #fdfbf7;
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 6px;
          border-radius: 3px;
          margin-bottom: 2px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 1px solid #444;
          white-space: nowrap;
        ">hotel</span>
        <div style="
          width: 13px;
          height: 13px;
          background: #111;
          border: 2px solid #fff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 5px rgba(0,0,0,0.4);
        "></div>
      </div>
    `;

    const hotelIcon = L.divIcon({
      className: "hotel-pin-icon",
      html: hotelPinHtml,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    L.marker([HOTEL_LAT, HOTEL_LON], {
      icon: hotelIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    // Interactive circle stays on top of reach bands
    const circle = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#d84315",
      weight: 2.2,
      opacity: 0.95,
      fillColor: "#ff8a65",
      fillOpacity: 0.08,
      dashArray: "6, 4",
      interactive: false,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable hit border for edge dragging
    const circleHit = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#ff3d00",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
    }).addTo(map);
    circleHitRef.current = circleHit;

    // Edge label marker riding east on the circle edge
    const edgeLabelHtml = `
      <div style="
        transform: translate(-10%, -50%);
        pointer-events: auto;
        cursor: ew-resize;
        user-select: none;
      ">
        <div style="
          background: #1a1a1a;
          color: #fdfbf7;
          border: 1px solid #ffffff;
          padding: 2px 7px;
          border-radius: 12px;
          font-family: 'Fira Code', monospace;
          fontSize: 11px;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        ">
          <span style="font-size: 8px; opacity: 0.7;">◀▶</span>
          <span class="edge-label-text">${INITIAL_RADIUS.toFixed(2)} km</span>
        </div>
      </div>
    `;
    const edgeLabelIcon = L.divIcon({
      className: "edge-label-icon",
      html: edgeLabelHtml,
      iconSize: [0, 0],
    });

    const edgeMarker = L.marker(getEdgeLatLng(INITIAL_RADIUS), {
      icon: edgeLabelIcon,
      zIndexOffset: 1500,
      interactive: true,
    }).addTo(map);
    edgeLabelMarkerRef.current = edgeMarker;

    // Pointer-based radius drag handlers
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);

    const onPointerMove = (e) => {
      if (!isDraggingEdgeRef.current) return;
      const pointerLatLng = map.mouseEventToLatLng(e);
      const distM = hotelLatLng.distanceTo(pointerLatLng);
      const newRadKm = Math.min(Math.max(distM / 1000, 0.4), 25.0);
      applyRadius(newRadKm);
    };

    const onPointerUp = () => {
      if (!isDraggingEdgeRef.current) return;
      isDraggingEdgeRef.current = false;
      map.dragging.enable();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    const startRadiusDrag = (e) => {
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      isDraggingEdgeRef.current = true;
      map.dragging.disable();
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    circleHit.on("mousedown", startRadiusDrag);
    edgeMarker.on("mousedown", startRadiusDrag);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update shop dots and small arrival labels when data changes
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    shopMarkersRef.current.forEach(({ marker }) => marker.remove());
    shopMarkersRef.current = [];
    shopLabelMarkersRef.current.forEach(({ marker }) => marker.remove());
    shopLabelMarkersRef.current = [];

    const newMarkers = [];
    const newLabels = [];

    data.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;

      const marker = L.circleMarker([row.lat, row.lon], {
        radius: idx === targetIndex ? 8.5 : 5.5,
        fillColor: "#f57c00",
        color: "#1a1a1a",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.9,
        interactive: true,
      }).addTo(map);

      marker.on("mouseover", () => {
        setHoveredShop(row);
      });
      marker.on("mouseout", () => {
        setHoveredShop(null);
      });

      marker.on("click", (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        targetIndexRef.current = idx;
        setTargetIndex(idx);
        updateDotsAndLabels();
      });

      newMarkers.push({ marker, row, index: idx });

      // Small arrival label 'hh:mm' offset slightly from dot
      const labelHtml = `
        <div style="transform: translate(8px, -8px); pointer-events: none; user-select: none;">
          <span class="shop-time-text" style="
            font-family: 'Fira Code', monospace;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 3px;
            border-radius: 2px;
            border: 1px solid #ccc;
            background: rgba(253, 251, 247, 0.92);
            color: #1a1a1a;
            white-space: nowrap;
            box-shadow: 1px 1px 2px rgba(0,0,0,0.15);
          ">--:--</span>
        </div>
      `;
      const labelIcon = L.divIcon({
        className: "shop-arrival-label",
        html: labelHtml,
        iconSize: [0, 0],
      });

      const labelMarker = L.marker([row.lat, row.lon], {
        icon: labelIcon,
        zIndexOffset: 600,
        interactive: false,
      }).addTo(map);

      newLabels.push({ marker: labelMarker, index: idx });
    });

    shopMarkersRef.current = newMarkers;
    shopLabelMarkersRef.current = newLabels;

    updateDotsAndLabels();
  }, [data, updateDotsAndLabels]);

  // Live callback when LEAVE hand is dragged or keys pressed
  const handleLeaveChange = React.useCallback(
    (newMinutes) => {
      const norm = ((Math.round(newMinutes) % 1440) + 1440) % 1440;
      leaveMinutesRef.current = norm;
      setLeaveMinutes(norm);
      updateDotsAndLabels();
    },
    [updateDotsAndLabels]
  );

  // Live callback when Day button is pressed
  const handleDayChange = React.useCallback(
    (newDay) => {
      dayIndexRef.current = newDay;
      setDayIndex(newDay);
      updateDotsAndLabels();
    },
    [updateDotsAndLabels]
  );

  // Get currently targeted shop object
  const targetedShop = data[targetIndex] || data[2] || null;

  // Counts for status badge
  const insideCount = insideIndices.length;
  const independentCount = React.useMemo(() => {
    let cnt = 0;
    insideIndices.forEach((idx) => {
      if (data[idx] && !data[idx].chain) cnt++;
    });
    return cnt;
  }, [insideIndices, data]);
  const openCount = openIndices.length;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "960px",
        margin: "0 auto",
        fontFamily: "'Fira Code', monospace",
        background: "#fdfbf7",
        borderRadius: "8px",
        border: "1px solid #1a1a1a",
        boxShadow: "4px 4px 0px #1a1a1a",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "9px 16px",
          background: "#fdfbf7",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "18px",
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            Houston Donut Reach & Hours
          </h2>
          <span
            style={{
              fontSize: "11px",
              color: "#666",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Drag circle radius or dial hands · Click shop to target
          </span>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "11px",
            color: "#333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "3px",
                background: "#1976d2",
                opacity: 0.55,
                display: "inline-block",
              }}
            />
            <span>Bike reach (10/20/30m)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#2e7d32",
                display: "inline-block",
                border: "1px solid #1b5e20",
              }}
            />
            <span>Open</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#fff",
                display: "inline-block",
                border: "2px solid #c62828",
              }}
            />
            <span>Closed</span>
          </div>
        </div>
      </div>

      {/* Main Container: Map (left) + 24h Clock Dial (right) */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "560px",
          background: "#eae7dc",
          position: "relative",
        }}
      >
        {/* Map Canvas */}
        <div
          style={{
            position: "relative",
            flex: 1,
            height: "100%",
          }}
        >
          <div
            ref={mapContainerRef}
            style={{
              width: "100%",
              height: "100%",
              outline: "none",
            }}
          />

          {/* Badge: <n> inside · <k> independent · <j> open on arrival */}
          <StatusBadge
            insideCount={insideCount}
            independentCount={independentCount}
            openCount={openCount}
          />

          {/* Hover / Selection Inspector */}
          <ShopInspector
            shop={hoveredShop || targetedShop}
            leaveMinutes={leaveMinutes}
            dayIndex={dayIndex}
          />
        </div>

        {/* Clock Dial Panel */}
        <ClockDialPanel
          React={React}
          leaveMinutes={leaveMinutes}
          targetShop={targetedShop}
          dayIndex={dayIndex}
          onLeaveChange={handleLeaveChange}
          onDayChange={handleDayChange}
        />
      </div>
    </div>
  );
}