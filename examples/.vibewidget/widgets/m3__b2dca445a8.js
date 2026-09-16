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

// Ray-casting point-in-polygon test
// point: [lat, lon], polygon: [[lat, lon], ...]
function pointInPolygon(point, vs) {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function checkIsOpen(hoursStr, dayIdx, arrivalMin) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const s = hoursStr.trim();
  if (!s) return null;
  if (s === "24/7") return true;

  const dayMap = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 };
  const rules = s.split(";").map((r) => r.trim()).filter(Boolean);
  let hasMatchingDay = false;
  let isOpenNow = false;

  for (const rule of rules) {
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
            if (arrivalMin >= mStart || arrivalMin < mEnd) {
              isOpenNow = true;
            }
          }
        }
      }
    }
  }

  if (!hasMatchingDay) return false;
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
        Shift+drag to lasso region · Double-click region to delete · Click shop to target
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
  const leaveAngle = (leaveMin / 1440) * 360;
  const arriveAngle = (arriveMin / 1440) * 360;

  const width = 230;
  const height = 230;
  const cx = width / 2;
  const cy = height / 2;
  const dialRadius = 90;
  const handRadius = 72;

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
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

          <circle
            cx={cx}
            cy={cy}
            r={dialRadius}
            fill="url(#dialGlow)"
            stroke="#1a1a1a"
            strokeWidth="2"
          />

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

          <path d={arcPath} fill="rgba(245, 124, 0, 0.28)" stroke="none" />
          <circle cx={cx} cy={cy} r="3" fill="#1a1a1a" />

          <line
            x1={cx}
            y1={cy}
            x2={leavePos.x}
            y2={leavePos.y}
            stroke="#1a1a1a"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={arrivePos.x}
            y2={arrivePos.y}
            stroke="#e65100"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          <g style={{ cursor: "grab" }} onPointerDown={onPointerDownLeave}>
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

          <g style={{ cursor: "grab" }} onPointerDown={onPointerDownArrive}>
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

export const RegionsTable = ({
  React,
  regions,
  data,
  leaveMin,
  dayIndex,
  hoveredRegionName,
  onHoverRegion,
  onDeleteRegion,
}) => {
  const regionNames = Object.keys(regions).sort();

  if (regionNames.length === 0) {
    return (
      <div
        style={{
          padding: "10px 16px",
          fontSize: "11px",
          color: "#666",
          fontStyle: "italic",
          background: "#fdfbf7",
          borderTop: "1px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          No lasso regions created yet. Hold <strong>Shift</strong> and drag on the map to draw Region A, B, C...
        </span>
        <span style={{ fontSize: "10px", color: "#999" }}>
          Double-click any region to delete
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        background: "#fdfbf7",
        borderTop: "1px solid #1a1a1a",
        padding: "8px 16px 10px 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 800,
            fontSize: "13px",
            color: "#1a1a1a",
          }}
        >
          Lasso Regions
        </span>
        <span style={{ fontSize: "10px", color: "#888", fontFamily: "'Fira Code', monospace" }}>
          Drag vertex handles on map to reshape · Double-click polygon to delete
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'Fira Code', monospace",
            fontSize: "11px",
            color: "#1a1a1a",
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1.5px solid #1a1a1a",
                textAlign: "left",
                color: "#555",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <th style={{ padding: "4px 8px" }}>Region</th>
              <th style={{ padding: "4px 8px" }}>Total Shops</th>
              <th style={{ padding: "4px 8px" }}>Independent</th>
              <th style={{ padding: "4px 8px" }}>Open on Arrival</th>
              <th style={{ padding: "4px 8px" }}>Earliest Arrival</th>
              <th style={{ padding: "4px 8px", textAlign: "right" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {regionNames.map((name) => {
              const indices = regions[name] || [];
              let indepCount = 0;
              let openCount = 0;
              let earliestArrMin = Infinity;

              indices.forEach((idx) => {
                const row = data[idx];
                if (!row) return;
                if (!row.chain) indepCount++;

                const bMin = row.bike_min != null ? row.bike_min : 15;
                const arrMin = (leaveMin + bMin) % 1440;
                if (arrMin < earliestArrMin) earliestArrMin = arrMin;

                const isOpen = checkIsOpen(row.hours, dayIndex, arrMin);
                if (isOpen === true) openCount++;
              });

              const earliestText =
                indices.length === 0 || earliestArrMin === Infinity
                  ? "—"
                  : minToHhmm(earliestArrMin);

              const isHovered = hoveredRegionName === name;

              return (
                <tr
                  key={name}
                  onMouseEnter={() => onHoverRegion(name)}
                  onMouseLeave={() => onHoverRegion(null)}
                  style={{
                    borderBottom: "1px dashed #dcd5c5",
                    background: isHovered ? "#fff3e0" : "transparent",
                    transition: "background 0.15s ease",
                    cursor: "pointer",
                  }}
                >
                  <td style={{ padding: "6px 8px", fontWeight: 800 }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: 20,
                        height: 20,
                        lineHeight: "20px",
                        textAlign: "center",
                        borderRadius: "3px",
                        background: "#1a1a1a",
                        color: "#fdfbf7",
                        fontSize: "11px",
                        marginRight: 6,
                      }}
                    >
                      {name}
                    </span>
                    Region {name}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <strong>{indices.length}</strong>
                  </td>
                  <td style={{ padding: "6px 8px", color: "#d84315", fontWeight: 700 }}>
                    {indepCount}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#2e7d32", fontWeight: 700 }}>
                    {openCount}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      style={{
                        background: "#eae7dc",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        fontSize: "10.5px",
                      }}
                    >
                      {earliestText}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRegion(name);
                      }}
                      title={`Delete Region ${name}`}
                      style={{
                        background: "transparent",
                        border: "1px solid #c62828",
                        color: "#c62828",
                        borderRadius: "3px",
                        padding: "2px 6px",
                        fontSize: "10px",
                        cursor: "pointer",
                        fontFamily: "'Fira Code', monospace",
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  injectLeafletStyles();

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
  const INITIAL_DAY = 1; // Tuesday
  const INITIAL_LEAVE_MIN = 6 * 60 + 30; // 06:30
  const INITIAL_TARGET_INDEX = 2;

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [targetIndex, setTargetIndex] = React.useState(INITIAL_TARGET_INDEX);
  const [leaveMin, setLeaveMin] = React.useState(INITIAL_LEAVE_MIN);
  const [dayIndex, setDayIndex] = React.useState(INITIAL_DAY);
  const [insideIndices, setInsideIndices] = React.useState([]);
  const [openArrivalIndices, setOpenArrivalIndices] = React.useState([]);

  // Lasso regions state: [{ name: 'A', latlngs: [[lat, lon], ...] }, ...]
  const [regionsList, setRegionsList] = React.useState([]);
  const [hoveredRegionName, setHoveredRegionName] = React.useState(null);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const reachLayerGroupRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  // Lasso layer & interactive handles tracking
  const lassoGroupRef = React.useRef(null);
  const regionLayersRef = React.useRef({}); // name -> { polygon, handles: [], labelMarker }
  const isLassoingRef = React.useRef(false);
  const lassoPointsRef = React.useRef([]);
  const lassoTempPolylineRef = React.useRef(null);

  // Ref to always have latest data & regionsList for callbacks
  const dataRef = React.useRef(data);
  dataRef.current = data;
  const regionsListRef = React.useRef(regionsList);
  regionsListRef.current = regionsList;
  const hoveredRegionNameRef = React.useRef(hoveredRegionName);
  hoveredRegionNameRef.current = hoveredRegionName;

  const targetShop = data[targetIndex] || data[0] || null;
  const targetBikeMin = targetShop ? targetShop.bike_min || 15 : 15;

  const evaluateShop = React.useCallback((row, leaveTime, currentDay) => {
    const bMin = row.bike_min != null ? row.bike_min : 15;
    const arrMin = (leaveTime + bMin) % 1440;
    const arrHhmm = minToHhmm(arrMin);
    const isOpen = checkIsOpen(row.hours, currentDay, arrMin);
    return { arrHhmm, isOpen };
  }, []);

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
          fillColor = "#fdfbf7";
          fillOpacity = 0.95;
          weight = isTarget ? 4 : 2.5;
        } else {
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

  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    const deltaLon = rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

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

  // Compute regions dictionary: name -> list of shop row indices
  const computeRegionsDict = React.useCallback((rList, curData) => {
    const out = {};
    rList.forEach((reg) => {
      const vs = reg.latlngs.map((pt) => [pt[0], pt[1]]);
      const insideShops = [];
      curData.forEach((row, idx) => {
        if (row.lat == null || row.lon == null) return;
        if (pointInPolygon([row.lat, row.lon], vs)) {
          insideShops.push(idx);
        }
      });
      out[reg.name] = insideShops;
    });
    return out;
  }, []);

  // Update regions output trait
  const syncRegionsOutput = React.useCallback(
    (rList) => {
      const dict = computeRegionsDict(rList, dataRef.current);
      model.set("regions", dict);
      model.save_changes();
    },
    [computeRegionsDict, model]
  );

  // Next region name: A, B, C...
  const getNextRegionName = (existingList) => {
    const existing = new Set(existingList.map((r) => r.name));
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i);
      if (!existing.has(char)) return char;
    }
    return `R${existingList.length + 1}`;
  };

  // Delete region callback
  const deleteRegion = React.useCallback(
    (name) => {
      setRegionsList((prev) => {
        const next = prev.filter((r) => r.name !== name);
        syncRegionsOutput(next);
        return next;
      });
    },
    [syncRegionsOutput]
  );

  // Vertex handle drag update
  const handleVertexDrag = React.useCallback(
    (regionName, vertexIdx, newLatLng) => {
      setRegionsList((prev) => {
        const next = prev.map((r) => {
          if (r.name !== regionName) return r;
          const newPts = [...r.latlngs];
          newPts[vertexIdx] = [newLatLng.lat, newLatLng.lng];
          return { ...r, latlngs: newPts };
        });
        syncRegionsOutput(next);
        return next;
      });
    },
    [syncRegionsOutput]
  );

  // Initialize outputs on mount
  React.useEffect(() => {
    const initInside = computeInside(INITIAL_RADIUS);
    const initOpen = updateMarkersAndLabels(
      INITIAL_RADIUS,
      INITIAL_TARGET_INDEX,
      INITIAL_LEAVE_MIN,
      INITIAL_DAY
    );
    model.set({
      inside: initInside,
      radius_km: INITIAL_RADIUS,
      open_on_arrival: initOpen,
      when: { day: INITIAL_DAY, hhmm: minToHhmm(INITIAL_LEAVE_MIN) },
      target: INITIAL_TARGET_INDEX,
      regions: {},
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
      boxZoom: false, // Turn off Leaflet's shift box-zoom so lasso gets the gesture
      doubleClickZoom: false, // Disable default dblclick zoom to avoid conflict with region delete
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    const reachGroup = L.layerGroup().addTo(map);
    reachLayerGroupRef.current = reachGroup;

    // Reach bands
    const bikeReach = reach && reach.bike;
    if (bikeReach && bikeReach.features) {
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

    // Layer group for lassos
    const lassoGroup = L.layerGroup().addTo(map);
    lassoGroupRef.current = lassoGroup;

    // Interactive radius circle
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

    // --- Shift+Drag Lasso Gesture Implementation ---
    const mapContainer = mapContainerRef.current;

    const onMapMouseDown = (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      L.DomEvent.stopPropagation(e);

      isLassoingRef.current = true;
      map.dragging.disable();

      const startPt = map.mouseEventToLatLng(e);
      lassoPointsRef.current = [startPt];

      if (lassoTempPolylineRef.current) {
        lassoTempPolylineRef.current.remove();
      }
      lassoTempPolylineRef.current = L.polyline([startPt], {
        color: "#673ab7",
        weight: 2.5,
        dashArray: "4, 4",
      }).addTo(map);

      const onWindowMouseMove = (evt) => {
        if (!isLassoingRef.current) return;
        const pt = map.mouseEventToLatLng(evt);
        const pts = lassoPointsRef.current;
        // Sample points with slight distance filter
        const last = pts[pts.length - 1];
        if (map.latLngToLayerPoint(last).distanceTo(map.latLngToLayerPoint(pt)) > 6) {
          pts.push(pt);
          if (lassoTempPolylineRef.current) {
            lassoTempPolylineRef.current.setLatLngs(pts);
          }
        }
      };

      const onWindowMouseUp = (evt) => {
        if (!isLassoingRef.current) return;
        isLassoingRef.current = false;
        map.dragging.enable();
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);

        if (lassoTempPolylineRef.current) {
          lassoTempPolylineRef.current.remove();
          lassoTempPolylineRef.current = null;
        }

        const pts = lassoPointsRef.current;
        if (pts.length >= 3) {
          // Simplify / downsample polygon to avoid having hundreds of handles
          // Keep every K-th point if very dense (target ~8-18 vertices)
          let sampled = pts;
          if (pts.length > 20) {
            const step = Math.ceil(pts.length / 16);
            sampled = pts.filter((_, i) => i % step === 0);
          }
          if (sampled.length >= 3) {
            const coords = sampled.map((p) => [p.lat, p.lng]);
            const newName = getNextRegionName(regionsListRef.current);
            const newRegion = { name: newName, latlngs: coords };
            const nextList = [...regionsListRef.current, newRegion];
            setRegionsList(nextList);
            syncRegionsOutput(nextList);
          }
        }
        lassoPointsRef.current = [];
      };

      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
    };

    mapContainer.addEventListener("mousedown", onMapMouseDown, true);

    return () => {
      mapContainer.removeEventListener("mousedown", onMapMouseDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update regions rendered on Leaflet when regionsList or hoveredRegionName changes
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    const lassoGroup = lassoGroupRef.current;
    if (!map || !lassoGroup) return;

    // Clean existing region layers
    lassoGroup.clearLayers();
    regionLayersRef.current = {};

    regionsList.forEach((region) => {
      const isHovered = hoveredRegionName === region.name;
      const poly = L.polygon(region.latlngs, {
        color: isHovered ? "#e65100" : "#673ab7",
        weight: isHovered ? 3 : 2,
        fillColor: isHovered ? "#ff9800" : "#9575cd",
        fillOpacity: isHovered ? 0.35 : 0.18,
        dashArray: isHovered ? null : "4, 4",
      }).addTo(lassoGroup);

      // Double-click inside region deletes it
      poly.on("dblclick", (e) => {
        L.DomEvent.stopPropagation(e);
        deleteRegion(region.name);
      });

      // Hover triggers highlight
      poly.on("mouseover", () => setHoveredRegionName(region.name));
      poly.on("mouseout", () => setHoveredRegionName(null));

      // Region center badge label
      const center = poly.getBounds().getCenter();
      const badgeHtml = `
        <div style="
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
        ">
          <span style="
            background: #1a1a1a;
            color: #fdfbf7;
            font-family: 'Fira Code', monospace;
            font-size: 10px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">Region ${region.name}</span>
        </div>
      `;
      const badgeIcon = L.divIcon({
        className: "region-badge-icon",
        html: badgeHtml,
        iconSize: [0, 0],
      });
      L.marker(center, {
        icon: badgeIcon,
        zIndexOffset: 1200,
        interactive: false,
      }).addTo(lassoGroup);

      // Vertex drag handles
      const handleMarkers = region.latlngs.map((pt, vIdx) => {
        const handle = L.circleMarker(pt, {
          radius: 5,
          color: "#ffffff",
          weight: 2,
          fillColor: isHovered ? "#e65100" : "#512da8",
          fillOpacity: 1,
          interactive: true,
        }).addTo(lassoGroup);

        // Make handle draggable via mouse events
        handle.on("mousedown", (e) => {
          L.DomEvent.stopPropagation(e);
          map.dragging.disable();

          const onHandleMove = (evt) => {
            const nextLatLng = map.mouseEventToLatLng(evt);
            handle.setLatLng(nextLatLng);
            const currentPts = [...region.latlngs];
            currentPts[vIdx] = [nextLatLng.lat, nextLatLng.lng];
            poly.setLatLngs(currentPts);
          };

          const onHandleUp = (evt) => {
            map.dragging.enable();
            window.removeEventListener("mousemove", onHandleMove);
            window.removeEventListener("mouseup", onHandleUp);
            const finalLatLng = map.mouseEventToLatLng(evt);
            handleVertexDrag(region.name, vIdx, finalLatLng);
          };

          window.addEventListener("mousemove", onHandleMove);
          window.addEventListener("mouseup", onHandleUp);
        });

        return handle;
      });

      regionLayersRef.current[region.name] = { poly, handleMarkers };
    });
  }, [regionsList, hoveredRegionName, deleteRegion, handleVertexDrag]);

  // Populate shop markers and live label tags
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    shopMarkersRef.current.forEach(({ marker, labelMarker }) => {
      marker.remove();
      if (labelMarker) labelMarker.remove();
    });
    shopMarkersRef.current = [];

    const newMarkers = [];
    data.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;

      const marker = L.circleMarker([row.lat, row.lon], {
        radius: 6,
        fillColor: "#757575",
        color: "#1a1a1a",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.9,
        interactive: true,
      }).addTo(map);

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

    // Sync regions output with new data
    syncRegionsOutput(regionsListRef.current);
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

  const handleLeaveChange = React.useCallback((newLeaveMin) => {
    setLeaveMin(newLeaveMin);
  }, []);

  const handleDayChange = React.useCallback((newDayIdx) => {
    setDayIndex(newDayIdx);
  }, []);

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

  const hoveredStatus = React.useMemo(() => {
    if (!hoveredShop) return null;
    const { arrHhmm, isOpen } = evaluateShop(hoveredShop, leaveMin, dayIndex);
    return { arrHhmm, isOpen };
  }, [hoveredShop, leaveMin, dayIndex, evaluateShop]);

  // Table regions dictionary
  const regionsDict = React.useMemo(() => {
    return computeRegionsDict(regionsList, data);
  }, [regionsList, data, computeRegionsDict]);

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
            Leave & Reach Planner + Lasso Regions
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
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                border: "1.5px dashed #673ab7",
                background: "rgba(149, 117, 205, 0.4)",
                display: "inline-block",
                borderRadius: "2px",
              }}
            />
            <span style={{ color: "#512da8", fontWeight: 700 }}>Lasso</span>
          </div>
        </div>
      </div>

      {/* Main Content: Map (Left) + 24h Clock Dial Column (Right) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "530px",
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

      {/* Compact Regions Table Under Map */}
      <RegionsTable
        React={React}
        regions={regionsDict}
        data={data}
        leaveMin={leaveMin}
        dayIndex={dayIndex}
        hoveredRegionName={hoveredRegionName}
        onHoverRegion={setHoveredRegionName}
        onDeleteRegion={deleteRegion}
      />
    </div>
  );
}