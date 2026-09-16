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

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad2(n) {
  return String(Math.floor(n)).padStart(2, "0");
}

function minToHhmm(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function parseHhmmToMin(str) {
  if (!str) return 0;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || 0, 10);
}

// Parse OSM opening_hours string: returns null if unparseable/blank (unknown), or boolean for open status
// dayIdx: 0=Mo, 1=Tu, 2=We, 3=Th, 4=Fr, 5=Sa, 6=Su
// arrivalMin: minutes from midnight (0..1439)
export function checkIsOpen(hoursStr, dayIdx, arrivalMin) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const s = hoursStr.trim();
  if (!s) return null;
  if (s === "24/7") return true;

  const dayMap = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };

  // Rule segments separated by ';'
  const rules = s.split(";").map((r) => r.trim()).filter(Boolean);
  let hasMatchingDay = false;
  let isOpenNow = false;

  for (const rule of rules) {
    // Regex matching: (Mo-Sa,Su or Tu-Fr etc) and time intervals (04:00-14:00, 17:00-21:00)
    // Some formats: '05:00-20:00' (no days = all days)
    // 'Mo-Sa 04:00-14:00'
    // 'Mo-Fr 05:00-21:00'
    const parts = rule.split(/\s+/);
    let daySpec = null;
    let timeSpec = null;

    if (parts.length === 1) {
      if (parts[0].includes(":")) {
        daySpec = "Mo-Su";
        timeSpec = parts[0];
      }
    } else if (parts.length >= 2) {
      daySpec = parts[0];
      timeSpec = parts.slice(1).join(" ");
    }

    if (!timeSpec) continue;

    // Check if day applies
    let appliesToToday = false;
    if (!daySpec || daySpec === "Mo-Su") {
      appliesToToday = true;
    } else {
      const dayTokens = daySpec.split(",");
      for (const token of dayTokens) {
        if (token.includes("-")) {
          const [dStart, dEnd] = token.split("-");
          const idxS = dayMap[dStart];
          const idxE = dayMap[dEnd];
          if (idxS != null && idxE != null) {
            if (idxS <= idxE) {
              if (dayIdx >= idxS && dayIdx <= idxE) appliesToToday = true;
            } else {
              // Wrap around weekend e.g. Fr-Mo
              if (dayIdx >= idxS || dayIdx <= idxE) appliesToToday = true;
            }
          }
        } else {
          if (dayMap[token] === dayIdx) appliesToToday = true;
        }
      }
    }

    if (appliesToToday) {
      hasMatchingDay = true;
      // Check time ranges e.g. "04:00-14:00" or multiple like "06:00-12:00,13:00-18:00"
      const timeRanges = timeSpec.split(",");
      for (const tr of timeRanges) {
        const [tStart, tEnd] = tr.trim().split("-");
        if (tStart && tEnd) {
          const mStart = parseHhmmToMin(tStart);
          let mEnd = parseHhmmToMin(tEnd);
          if (mEnd === 0 && tEnd.startsWith("24")) mEnd = 1440;
          if (mStart <= mEnd) {
            if (arrivalMin >= mStart && arrivalMin < mEnd) {
              isOpenNow = true;
            }
          } else {
            // Over midnight
            if (arrivalMin >= mStart || arrivalMin < mEnd) {
              isOpenNow = true;
            }
          }
        }
      }
    }
  }

  if (!hasMatchingDay) {
    // If specific days were specified in all rules and today wasn't one of them, it's closed today!
    return false;
  }
  return isOpenNow;
}

export const StatusBadge = ({ insideCount = 0, independentCount = 0, openArrivalCount = 0 }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.95)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      border: "1px solid #1a1a1a",
      boxShadow: "3px 3px 0px #1a1a1a",
      borderRadius: "4px",
      padding: "8px 14px",
      fontFamily: "'Fira Code', monospace",
      fontSize: "11.5px",
      letterSpacing: "0.01em",
      color: "#1a1a1a",
      pointerEvents: "auto",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      userSelect: "none",
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
      <span style={{ margin: "0 6px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#d84315" }}>{independentCount}</span> independent
      <span style={{ margin: "0 6px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#2e7d32" }}>{openArrivalCount}</span> open on arrival
    </div>
  </div>
);

export const ShopInspector = ({ shop, arrivalTime, isOpen }) => {
  if (!shop) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 14,
          zIndex: 1000,
          background: "rgba(253, 251, 247, 0.92)",
          border: "1px dashed #aaa",
          borderRadius: "4px",
          padding: "6px 12px",
          fontFamily: "'Fira Code', monospace",
          fontSize: "11px",
          color: "#666",
          pointerEvents: "none",
        }}
      >
        Hover over a shop to inspect · Click shop to set as Target
      </div>
    );
  }

  const openStatusText =
    isOpen === true ? "OPEN ON ARRIVAL" : isOpen === false ? "CLOSED ON ARRIVAL" : "HOURS UNKNOWN";
  const openStatusColor =
    isOpen === true ? "#1b5e20" : isOpen === false ? "#b71c1c" : "#616161";
  const openStatusBg =
    isOpen === true ? "#e8f5e9" : isOpen === false ? "#ffebee" : "#eeeeee";

  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 14,
        zIndex: 1000,
        maxWidth: "340px",
        background: "#fdfbf7",
        border: "1px solid #1a1a1a",
        boxShadow: "3px 3px 0px #1a1a1a",
        borderRadius: "4px",
        padding: "10px 14px",
        fontFamily: "'Fira Code', monospace",
        fontSize: "11px",
        color: "#1a1a1a",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "15px",
          fontWeight: 700,
          marginBottom: "4px",
          color: "#111",
          lineHeight: 1.2,
        }}
      >
        {shop.name}
      </div>
      <div style={{ color: "#555", marginBottom: "4px" }}>
        {shop.street ? shop.street : "Street address unlisted"}
      </div>
      <div style={{ fontSize: "10.5px", color: "#444", marginBottom: "4px" }}>
        <strong>Hours:</strong> {shop.hours ? shop.hours : "Hours unlisted"}
      </div>
      <div style={{ fontSize: "10.5px", color: "#333", marginBottom: "6px" }}>
        <strong>Bike ride:</strong> ~{Math.round(shop.bike_min || 0)} min (Arrive ~{arrivalTime})
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "2px",
            background: openStatusBg,
            color: openStatusColor,
            fontWeight: 700,
            border: `1px solid ${openStatusColor}40`,
          }}
        >
          {openStatusText}
        </span>
        <span
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: "2px",
            background: shop.chain ? "#e0e0e0" : "#ffeed9",
            color: shop.chain ? "#444" : "#b23c00",
            fontWeight: 700,
          }}
        >
          {shop.chain ? "Chain" : "Independent"}
        </span>
      </div>
    </div>
  );
};

export const ClockDial = ({
  React,
  leaveMin,
  targetBikeMin,
  dayIndex,
  targetShop,
  onLeaveChange,
  onDayChange,
}) => {
  const svgRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const isDraggingLeaveRef = React.useRef(false);
  const isDraggingArriveRef = React.useRef(false);

  const arriveMin = (leaveMin + targetBikeMin) % 1440;

  // 24h clock: 0 min = 0 deg (top, midnight). Each minute = 360 / 1440 = 0.25 deg
  const leaveAngle = (leaveMin / 1440) * 360;
  const arriveAngle = (arriveMin / 1440) * 360;

  const width = 230;
  const height = 230;
  const cx = width / 2;
  const cy = height / 2;
  const dialRadius = 90;
  const handRadius = 72;

  // Convert angle (degrees, 0 = 12 o'clock / top, clockwise) to SVG coordinates
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // SVG arc path between two angles
  const describeArc = (x, y, radius, startAngle, endAngle) => {
    // Normalizing angles
    let span = endAngle - startAngle;
    while (span < 0) span += 360;
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = span <= 180 ? "0" : "1";
    return [
      "M",
      x,
      y,
      "L",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      1,
      end.x,
      end.y,
      "Z",
    ].join(" ");
  };

  const getPointerAngle = (e) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    // atan2 gives angle from positive X axis clockwise. We want 0 at top (-Y axis).
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return deg;
  };

  const onPointerDownLeave = (e) => {
    e.preventDefault();
    if (containerRef.current) containerRef.current.focus();
    isDraggingLeaveRef.current = true;

    const onPointerMove = (evt) => {
      if (!isDraggingLeaveRef.current) return;
      const angle = getPointerAngle(evt);
      let mins = Math.round((angle / 360) * 1440);
      mins = ((mins % 1440) + 1440) % 1440;
      onLeaveChange(mins);
    };

    const onPointerUp = () => {
      isDraggingLeaveRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerDownArrive = (e) => {
    e.preventDefault();
    if (containerRef.current) containerRef.current.focus();
    isDraggingArriveRef.current = true;

    const onPointerMove = (evt) => {
      if (!isDraggingArriveRef.current) return;
      const angle = getPointerAngle(evt);
      let newArriveMin = Math.round((angle / 360) * 1440);
      newArriveMin = ((newArriveMin % 1440) + 1440) % 1440;
      let newLeave = newArriveMin - targetBikeMin;
      newLeave = ((newLeave % 1440) + 1440) % 1440;
      onLeaveChange(newLeave);
    };

    const onPointerUp = () => {
      isDraggingArriveRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Keyboard nudge with 15 min increments
  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (leaveMin - 15 + 1440) % 1440;
      onLeaveChange(n);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const n = (leaveMin + 15) % 1440;
      onLeaveChange(n);
    }
  };

  const leavePos = polarToCartesian(cx, cy, handRadius, leaveAngle);
  const arrivePos = polarToCartesian(cx, cy, handRadius, arriveAngle);

  // Hour tick marks
  const ticks = [];
  for (let h = 0; h < 24; h++) {
    const angle = (h / 24) * 360;
    const isMajor = h % 6 === 0;
    const isMedium = h % 3 === 0;
    const rIn = isMajor ? dialRadius - 9 : isMedium ? dialRadius - 6 : dialRadius - 3;
    const p1 = polarToCartesian(cx, cy, rIn, angle);
    const p2 = polarToCartesian(cx, cy, dialRadius, angle);
    const pText = polarToCartesian(cx, cy, dialRadius - 16, angle);
    ticks.push({ h, angle, p1, p2, pText, isMajor });
  }

  const arcPath = describeArc(cx, cy, handRadius * 0.9, leaveAngle, arriveAngle);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        outline: "none",
        userSelect: "none",
        width: "100%",
      }}
    >
      {/* Target header */}
      <div
        style={{
          width: "100%",
          padding: "8px 10px 4px 10px",
          borderBottom: "1px dashed #d0c9b8",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#888",
            fontWeight: 700,
          }}
        >
          Target Shop
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "15px",
            fontWeight: 800,
            color: "#1a1a1a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={targetShop?.name || "None"}
        >
          {targetShop?.name || "Select a shop"}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#e65100",
            fontWeight: 700,
            fontFamily: "'Fira Code', monospace",
          }}
        >
          {Math.round(targetBikeMin)} min bike ride
        </div>
      </div>

      {/* Dial SVG */}
      <div style={{ position: "relative", width, height }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ overflow: "visible", display: "block" }}
        >
          <defs>
            <radialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="85%" stopColor="#fdfbf7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ebe4d4" stopOpacity="0.6" />
            </radialGradient>
          </defs>

          {/* Clock face base */}
          <circle
            cx={cx}
            cy={cy}
            r={dialRadius}
            fill="url(#dialGlow)"
            stroke="#1a1a1a"
            strokeWidth="2"
          />

          {/* Ticks */}
          {ticks.map((t) => (
            <g key={t.h}>
              <line
                x1={t.p1.x}
                y1={t.p1.y}
                x2={t.p2.x}
                y2={t.p2.y}
                stroke="#444"
                strokeWidth={t.isMajor ? 2 : 1}
              />
              {t.isMajor && (
                <text
                  x={t.pText.x}
                  y={t.pText.y + 3.5}
                  textAnchor="middle"
                  fontFamily="'Fira Code', monospace"
                  fontSize="9.5px"
                  fontWeight="700"
                  fill="#555"
                >
                  {pad2(t.h)}
                </text>
              )}
            </g>
          ))}

          {/* Shaded arc between Leave and Arrive */}
          <path d={arcPath} fill="rgba(245, 124, 0, 0.28)" stroke="none" />

          {/* Dial center pin */}
          <circle cx={cx} cy={cy} r="3" fill="#1a1a1a" />

          {/* LEAVE Hand (Dark) */}
          <line
            x1={cx}
            y1={cy}
            x2={leavePos.x}
            y2={leavePos.y}
            stroke="#1a1a1a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* ARRIVE Hand (Orange) */}
          <line
            x1={cx}
            y1={cy}
            x2={arrivePos.x}
            y2={arrivePos.y}
            stroke="#e65100"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Hit area + knob for LEAVE */}
          <g
            style={{ cursor: "grab" }}
            onPointerDown={onPointerDownLeave}
          >
            <circle cx={leavePos.x} cy={leavePos.y} r="14" fill="transparent" />
            <circle
              cx={leavePos.x}
              cy={leavePos.y}
              r="7"
              fill="#1a1a1a"
              stroke="#fdfbf7"
              strokeWidth="2"
            />
          </g>

          {/* Hit area + knob for ARRIVE */}
          <g
            style={{ cursor: "grab" }}
            onPointerDown={onPointerDownArrive}
          >
            <circle cx={arrivePos.x} cy={arrivePos.y} r="14" fill="transparent" />
            <circle
              cx={arrivePos.x}
              cy={arrivePos.y}
              r="7"
              fill="#e65100"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        </svg>

        {/* Hand tip labels: LEAVE */}
        <div
          style={{
            position: "absolute",
            left: leavePos.x,
            top: leavePos.y,
            transform: "translate(-50%, -130%)",
            background: "#1a1a1a",
            color: "#fdfbf7",
            padding: "1px 5px",
            borderRadius: "3px",
            fontSize: "10px",
            fontFamily: "'Fira Code', monospace",
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {minToHhmm(leaveMin)}
        </div>

        {/* Hand tip labels: ARRIVE */}
        <div
          style={{
            position: "absolute",
            left: arrivePos.x,
            top: arrivePos.y,
            transform: "translate(-50%, 40%)",
            background: "#e65100",
            color: "#ffffff",
            padding: "1px 5px",
            borderRadius: "3px",
            fontSize: "10px",
            fontFamily: "'Fira Code', monospace",
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        >
          {minToHhmm(arriveMin)}
        </div>
      </div>

      {/* Arc label: '<n> min by bike' */}
      <div
        style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: "11px",
          color: "#d84315",
          fontWeight: 700,
          background: "#fff3e0",
          border: "1px solid #ffcc80",
          borderRadius: "12px",
          padding: "2px 10px",
          marginTop: "-4px",
          marginBottom: "10px",
        }}
      >
        {Math.round(targetBikeMin)} min by bike
      </div>

      {/* Day buttons Mo Tu We Th Fr Sa Su */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          padding: "0 6px",
          gap: "3px",
        }}
      >
        {DAY_NAMES.map((d, idx) => {
          const isActive = idx === dayIndex;
          return (
            <button
              key={d}
              onClick={() => onDayChange(idx)}
              style={{
                flex: 1,
                padding: "5px 0",
                fontSize: "11px",
                fontFamily: "'Fira Code', monospace",
                fontWeight: isActive ? 800 : 500,
                background: isActive ? "#1a1a1a" : "#fdfbf7",
                color: isActive ? "#fdfbf7" : "#333",
                border: "1px solid #1a1a1a",
                borderRadius: "3px",
                cursor: "pointer",
                boxShadow: isActive ? "1px 1px 0px #e65100" : "none",
                transition: "all 0.1s ease",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div
        style={{
          fontSize: "9.5px",
          color: "#888",
          marginTop: "6px",
          fontStyle: "italic",
        }}
      >
        Use ◀ / ▶ keys to nudge Leave 15m
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

  const reach = model.get("reach");

  const HOTEL_LAT = 29.7522;
  const HOTEL_LON = -95.3578;
  const INITIAL_RADIUS = 3.5;
  const INITIAL_DAY = 1; // Tuesday (0=Mo, 1=Tu)
  const INITIAL_LEAVE_MIN = 6 * 60 + 30; // 06:30
  const INITIAL_TARGET_INDEX = 2; // Row 2 targeted

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [targetIndex, setTargetIndex] = React.useState(INITIAL_TARGET_INDEX);
  const [leaveMin, setLeaveMin] = React.useState(INITIAL_LEAVE_MIN);
  const [dayIndex, setDayIndex] = React.useState(INITIAL_DAY);
  const [insideIndices, setInsideIndices] = React.useState([]);
  const [openArrivalIndices, setOpenArrivalIndices] = React.useState([]);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const reachLayerGroupRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  const targetShop = data[targetIndex] || data[0] || null;
  const targetBikeMin = targetShop ? (targetShop.bike_min || 15) : 15;

  // Compute shop arrival times & open status
  const evaluateShop = React.useCallback(
    (row, leaveTime, currentDay) => {
      const bMin = row.bike_min != null ? row.bike_min : 15;
      const arrMin = (leaveTime + bMin) % 1440;
      const arrHhmm = minToHhmm(arrMin);
      const isOpen = checkIsOpen(row.hours, currentDay, arrMin);
      return { arrHhmm, isOpen };
    },
    []
  );

  // Compute inside indices given radius
  const computeInside = React.useCallback(
    (radius) => {
      const inside = [];
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      data.forEach((row, idx) => {
        const lat = row.lat;
        const lon = row.lon;
        if (lat == null || lon == null) return;
        const distMeters = hotelLatLng.distanceTo(L.latLng(lat, lon));
        if (distMeters <= radius * 1000) {
          inside.push(idx);
        }
      });
      return inside;
    },
    [data]
  );

  // Restyle markers and update labels live
  const updateMarkersAndLabels = React.useCallback(
    (radKm, curTargetIdx, curLeaveMin, curDayIdx) => {
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      const openArr = [];

      shopMarkersRef.current.forEach(({ marker, labelMarker, row, index }) => {
        const distMeters = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
        const isInside = distMeters <= radKm * 1000;
        const isTarget = index === curTargetIdx;
        const { arrHhmm, isOpen } = evaluateShop(row, curLeaveMin, curDayIdx);

        if (isInside && isOpen === true) {
          openArr.push(index);
        }

        // Appearance based on open / closed / unknown
        // open: solid dot (#2e7d32)
        // closed: hollow ring (#d32f2f)
        // unknown: dashed ring (#757575)
        let strokeColor = "#1a1a1a";
        let fillColor = "#757575";
        let fillOpacity = 0.9;
        let dashArray = null;
        let weight = isTarget ? 3.5 : 1.5;
        let radius = isTarget ? 8.5 : isInside ? 6.5 : 4;

        if (isOpen === true) {
          strokeColor = "#1b5e20";
          fillColor = "#2e7d32";
          fillOpacity = 0.95;
        } else if (isOpen === false) {
          strokeColor = "#c62828";
          fillColor = "#fdfbf7"; // hollow ring
          fillOpacity = 0.95;
          weight = isTarget ? 4 : 2.5;
        } else {
          // Unknown
          strokeColor = "#616161";
          fillColor = "#fdfbf7";
          fillOpacity = 0.8;
          dashArray = "3, 3";
          weight = isTarget ? 3.5 : 2;
        }

        if (!isInside) {
          fillOpacity = 0.25;
          weight = isTarget ? 3 : 1;
          dashArray = null;
        }

        // Target gets prominent border
        if (isTarget) {
          strokeColor = "#e65100";
          weight = 4;
        }

        marker.setStyle({
          radius,
          fillColor,
          color: strokeColor,
          weight,
          fillOpacity,
          opacity: 1,
          dashArray,
        });

        if (isTarget && marker.bringToFront) {
          marker.bringToFront();
        }

        // Label update
        if (labelMarker) {
          const labelEl = labelMarker.getElement();
          if (isInside) {
            if (labelEl) {
              labelEl.style.display = "block";
              const tagEl = labelEl.querySelector(".shop-arr-label");
              if (tagEl) {
                tagEl.textContent = arrHhmm;
                let bg = "#fdfbf7";
                let textCol = "#616161";
                let borderCol = "#888";
                if (isOpen === true) {
                  bg = "#e8f5e9";
                  textCol = "#1b5e20";
                  borderCol = "#2e7d32";
                } else if (isOpen === false) {
                  bg = "#ffebee";
                  textCol = "#c62828";
                  borderCol = "#c62828";
                }
                tagEl.style.background = bg;
                tagEl.style.color = textCol;
                tagEl.style.borderColor = borderCol;
              }
            }
          } else {
            if (labelEl) labelEl.style.display = "none";
          }
        }
      });

      return openArr;
    },
    [evaluateShop]
  );

  // Function to place edge label at (hotel + radius due East)
  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    const deltaLon = rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

  // Sync radius state and notify model
  const applyRadius = React.useCallback(
    (newR) => {
      currentRadiusRef.current = newR;
      setRadiusKm(newR);

      if (circleRef.current) circleRef.current.setRadius(newR * 1000);
      if (circleHitRef.current) circleHitRef.current.setRadius(newR * 1000);
      if (edgeLabelMarkerRef.current) {
        edgeLabelMarkerRef.current.setLatLng(getEdgeLatLng(newR));
        const el = edgeLabelMarkerRef.current.getElement();
        if (el) {
          const textEl = el.querySelector(".edge-label-text");
          if (textEl) textEl.textContent = `${newR.toFixed(2)} km`;
        }
      }

      const newInside = computeInside(newR);
      setInsideIndices(newInside);

      const openArr = updateMarkersAndLabels(newR, targetIndex, leaveMin, dayIndex);
      setOpenArrivalIndices(openArr);

      model.set("radius_km", Number(newR.toFixed(3)));
      model.set("inside", newInside);
      model.set("open_on_arrival", openArr);
      model.save_changes();
    },
    [computeInside, updateMarkersAndLabels, getEdgeLatLng, targetIndex, leaveMin, dayIndex, model]
  );

  // Initialize outputs on mount
  React.useEffect(() => {
    const initInside = computeInside(INITIAL_RADIUS);
    const initOpen = updateMarkersAndLabels(INITIAL_RADIUS, INITIAL_TARGET_INDEX, INITIAL_LEAVE_MIN, INITIAL_DAY);
    model.set({
      inside: initInside,
      radius_km: INITIAL_RADIUS,
      open_on_arrival: initOpen,
      when: { day: INITIAL_DAY, hhmm: minToHhmm(INITIAL_LEAVE_MIN) },
      target: INITIAL_TARGET_INDEX,
    });
    model.save_changes();
  }, []);

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

    // CartoDB Positron for high-quality muted scrollytelling background
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    // Layer group for bike reach polygons under shops
    const reachGroup = L.layerGroup().addTo(map);
    reachLayerGroupRef.current = reachGroup;

    // Draw reach bands if available
    const bikeReach = reach && reach.bike;
    if (bikeReach && bikeReach.features) {
      // 30, 20, 10 min reach contours: darker the closer (10 darkest, 30 lightest)
      const sortedFeatures = [...bikeReach.features].sort(
        (a, b) => (b.properties?.contour || 0) - (a.properties?.contour || 0)
      );

      sortedFeatures.forEach((feat) => {
        const contour = feat.properties?.contour;
        let fillOpacity = 0.12;
        let fillColor = "#64b5f6";
        let strokeColor = "#1976d2";
        if (contour === 10) {
          fillOpacity = 0.38;
          fillColor = "#1565c0";
          strokeColor = "#0d47a1";
        } else if (contour === 20) {
          fillOpacity = 0.22;
          fillColor = "#1e88e5";
          strokeColor = "#1565c0";
        }

        L.geoJSON(feat, {
          style: {
            fillColor,
            fillOpacity,
            color: strokeColor,
            weight: 1.2,
            dashArray: "4, 4",
            interactive: false,
          },
        }).addTo(reachGroup);
      });
    }

    // Interactive radius circle (stays on top of reach)
    const circle = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#d84315",
      weight: 2.2,
      opacity: 0.9,
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
          font-size: 11px;
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
          width: 14px;
          height: 14px;
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
      zIndexOffset: 1600,
    }).addTo(map);

    // Radius drag
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

  // Populate shop markers and live label tags
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing
    shopMarkersRef.current.forEach(({ marker, labelMarker }) => {
      marker.remove();
      if (labelMarker) labelMarker.remove();
    });
    shopMarkersRef.current = [];

    const newMarkers = [];
    data.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;

      // Leaflet Circle Marker
      const marker = L.circleMarker([row.lat, row.lon], {
        radius: 6,
        fillColor: "#757575",
        color: "#1a1a1a",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.9,
        interactive: true,
      }).addTo(map);

      // Label Marker for hh:mm
      const labelHtml = `
        <div style="
          transform: translate(-50%, -170%);
          pointer-events: none;
          user-select: none;
        ">
          <span class="shop-arr-label" style="
            display: inline-block;
            font-family: 'Fira Code', monospace;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            border: 1px solid #888;
            background: #fdfbf7;
            color: #333;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            white-space: nowrap;
          ">--:--</span>
        </div>
      `;
      const labelIcon = L.divIcon({
        className: "shop-arr-label-icon",
        html: labelHtml,
        iconSize: [0, 0],
      });
      const labelMarker = L.marker([row.lat, row.lon], {
        icon: labelIcon,
        zIndexOffset: 1100,
        interactive: false,
      }).addTo(map);

      marker.on("mouseover", () => setHoveredShop(row));
      marker.on("mouseout", () => setHoveredShop(null));
      marker.on("click", (e) => {
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        setTargetIndex(idx);
        model.set("target", idx);
        model.save_changes();
      });

      newMarkers.push({ marker, labelMarker, row, index: idx });
    });

    shopMarkersRef.current = newMarkers;

    const openArr = updateMarkersAndLabels(
      currentRadiusRef.current,
      targetIndex,
      leaveMin,
      dayIndex
    );
    setOpenArrivalIndices(openArr);
    const currInside = computeInside(currentRadiusRef.current);
    setInsideIndices(currInside);
  }, [data]);

  // Live restyling whenever target, leaveMin, dayIndex, or radiusKm changes
  React.useEffect(() => {
    const openArr = updateMarkersAndLabels(
      currentRadiusRef.current,
      targetIndex,
      leaveMin,
      dayIndex
    );
    setOpenArrivalIndices(openArr);

    model.set("open_on_arrival", openArr);
    model.set("when", { day: dayIndex, hhmm: minToHhmm(leaveMin) });
    model.set("target", targetIndex);
    model.save_changes();
  }, [targetIndex, leaveMin, dayIndex]);

  // Handler for dial leave changes
  const handleLeaveChange = React.useCallback((newLeaveMin) => {
    setLeaveMin(newLeaveMin);
  }, []);

  const handleDayChange = React.useCallback((newDayIdx) => {
    setDayIndex(newDayIdx);
  }, []);

  // Compute stats for status badge
  const { insideCount, independentCount, openArrivalCount } = React.useMemo(() => {
    let indep = 0;
    insideIndices.forEach((idx) => {
      const row = data[idx];
      if (row && !row.chain) indep++;
    });
    return {
      insideCount: insideIndices.length,
      independentCount: indep,
      openArrivalCount: openArrivalIndices.length,
    };
  }, [insideIndices, openArrivalIndices, data]);

  // Evaluated status for hovered shop
  const hoveredStatus = React.useMemo(() => {
    if (!hoveredShop) return null;
    const { arrHhmm, isOpen } = evaluateShop(hoveredShop, leaveMin, dayIndex);
    return { arrHhmm, isOpen };
  }, [hoveredShop, leaveMin, dayIndex, evaluateShop]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "980px",
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
          padding: "10px 18px",
          background: "#fdfbf7",
          borderBottom: "1px solid #1a1a1a",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "19px",
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            Houston Donut Explorer
          </h2>
          <span
            style={{
              fontSize: "11px",
              color: "#666",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Leave & Reach Planner
          </span>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "10.5px",
            color: "#333",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#2e7d32",
                display: "inline-block",
                border: "1px solid #1b5e20",
              }}
            />
            <span>Open</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#fdfbf7",
                display: "inline-block",
                border: "2px solid #c62828",
              }}
            />
            <span>Closed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#fdfbf7",
                display: "inline-block",
                border: "1.5px dashed #616161",
              }}
            />
            <span>Unknown</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#e65100",
                display: "inline-block",
                border: "2px solid #1a1a1a",
              }}
            />
            <span style={{ fontWeight: 700 }}>Target</span>
          </div>
        </div>
      </div>

      {/* Main Content: Map (Left) + 24h Clock Dial Column (Right) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "560px",
          background: "#eae7dc",
        }}
      >
        {/* Map Canvas */}
        <div
          style={{
            position: "relative",
            flex: "1 1 auto",
            height: "100%",
            minWidth: "0",
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

          {/* Badge top-left */}
          <StatusBadge
            insideCount={insideCount}
            independentCount={independentCount}
            openArrivalCount={openArrivalCount}
          />

          {/* Hover Inspector bottom-left */}
          <ShopInspector
            shop={hoveredShop}
            arrivalTime={hoveredStatus?.arrHhmm}
            isOpen={hoveredStatus?.isOpen}
          />
        </div>

        {/* Dial Sidebar (Right) */}
        <div
          style={{
            width: "250px",
            flexShrink: 0,
            background: "#fdfbf7",
            borderLeft: "1px solid #1a1a1a",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            boxSizing: "border-box",
            zIndex: 10,
          }}
        >
          <ClockDial
            React={React}
            leaveMin={leaveMin}
            targetBikeMin={targetBikeMin}
            dayIndex={dayIndex}
            targetShop={targetShop}
            onLeaveChange={handleLeaveChange}
            onDayChange={handleDayChange}
          />

          {/* Reach Legend / Information footer */}
          <div
            style={{
              width: "100%",
              background: "#f4f0e6",
              border: "1px solid #dcd5c5",
              borderRadius: "4px",
              padding: "6px 8px",
              fontSize: "10px",
              color: "#555",
              lineHeight: 1.4,
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: "2px" }}>
              Bike Reach Bands
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#1565c0",
                  opacity: 0.6,
                  display: "inline-block",
                  borderRadius: "2px",
                }}
              />
              <span>10m</span>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#1e88e5",
                  opacity: 0.4,
                  display: "inline-block",
                  borderRadius: "2px",
                }}
              />
              <span>20m</span>
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: "#64b5f6",
                  opacity: 0.3,
                  display: "inline-block",
                  borderRadius: "2px",
                }}
              />
              <span>30m isochrone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}