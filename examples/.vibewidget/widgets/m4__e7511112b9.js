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
const KEYNOTE_MIN = 8 * 60 + 45; // 08:45 = 525 min

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

export function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const StatusBadge = ({
  insideCount = 0,
  independentCount = 0,
  openArrivalCount = 0,
}) => (
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
      <span style={{ fontWeight: 700, color: "#d84315" }}>
        {independentCount}
      </span>{" "}
      independent
      <span style={{ margin: "0 6px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#2e7d32" }}>
        {openArrivalCount}
      </span>{" "}
      open on arrival
    </div>
  </div>
);

export const ShopInspector = ({
  shop,
  mode = "bike",
  arrivalTime,
  isOpen,
}) => {
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
        Hover over a shop to inspect · Click shop to set as Target · Shift+drag map for Lasso
      </div>
    );
  }

  const openStatusText =
    isOpen === true
      ? "OPEN ON ARRIVAL"
      : isOpen === false
      ? "CLOSED ON ARRIVAL"
      : "HOURS UNKNOWN";
  const openStatusColor =
    isOpen === true ? "#1b5e20" : isOpen === false ? "#b71c1c" : "#616161";
  const openStatusBg =
    isOpen === true ? "#e8f5e9" : isOpen === false ? "#ffebee" : "#eeeeee";

  const travelKey = `${mode}_min`;
  const travelMin = Math.round(shop[travelKey] != null ? shop[travelKey] : 0);
  const modeLabel =
    mode === "walk" ? "Walk" : mode === "drive" ? "Drive" : "Bike ride";

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
        <strong>{modeLabel}:</strong> ~{travelMin} min (Arrive ~{arrivalTime})
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

export const ModeToggle = ({ mode, onModeChange }) => {
  const modes = [
    { key: "walk", label: "walk" },
    { key: "bike", label: "bike" },
    { key: "drive", label: "drive" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        padding: "4px 0 8px 0",
        gap: "4px",
      }}
    >
      {modes.map((m, idx) => {
        const isActive = mode === m.key;
        return (
          <React.Fragment key={m.key}>
            {idx > 0 && (
              <span style={{ color: "#888", fontSize: "11px" }}>·</span>
            )}
            <button
              onClick={() => onModeChange(m.key)}
              style={{
                background: isActive ? "#1a1a1a" : "transparent",
                color: isActive ? "#fdfbf7" : "#333",
                border: isActive ? "1px solid #1a1a1a" : "1px solid transparent",
                borderRadius: "3px",
                padding: "2px 8px",
                fontFamily: "'Fira Code', monospace",
                fontSize: "11px",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {m.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const VerdictCard = ({
  leaveMin,
  arriveMin,
  backMin,
  shopName,
  isOpen,
  makesIt,
  diffMin,
}) => {
  const statusStr =
    isOpen === true
      ? "open"
      : isOpen === false
      ? "closed"
      : "hours unknown";

  const isGreen = makesIt;
  const bg = isGreen ? "#e8f5e9" : "#ffebee";
  const border = isGreen ? "#2e7d32" : "#c62828";
  const textColor = isGreen ? "#1b5e20" : "#b71c1c";

  const verdictSummary = isGreen
    ? `back with ${diffMin} min to spare`
    : `late for the keynote by ${diffMin} min`;

  return (
    <div
      style={{
        width: "100%",
        marginTop: "8px",
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: "4px",
        padding: "8px 10px",
        fontFamily: "'Fira Code', monospace",
        fontSize: "10.5px",
        color: "#1a1a1a",
        lineHeight: 1.45,
        boxSizing: "border-box",
        boxShadow: `2px 2px 0px ${border}40`,
      }}
    >
      <div style={{ color: "#333", marginBottom: "4px" }}>
        leave {minToHhmm(leaveMin)} →{" "}
        <strong style={{ color: "#111" }}>{shopName || "Target"}</strong>{" "}
        {minToHhmm(arriveMin)} ·{" "}
        <span
          style={{
            fontWeight: 700,
            color:
              isOpen === true
                ? "#2e7d32"
                : isOpen === false
                ? "#c62828"
                : "#666",
          }}
        >
          {statusStr}
        </span>{" "}
        → 10 min for donuts → back {minToHhmm(backMin)}
      </div>
      <div
        style={{
          fontWeight: 800,
          color: textColor,
          fontSize: "11.5px",
          letterSpacing: "-0.01em",
          borderTop: `1px dashed ${border}60`,
          paddingTop: "4px",
        }}
      >
        {verdictSummary}
      </div>
    </div>
  );
};

export const ClockDial = ({
  React,
  leaveMin,
  targetTravelMin,
  targetBackMin,
  mode,
  dayIndex,
  targetShop,
  onLeaveChange,
  onDayChange,
}) => {
  const svgRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const isDraggingLeaveRef = React.useRef(false);
  const isDraggingArriveRef = React.useRef(false);

  const arriveMin = (leaveMin + targetTravelMin) % 1440;
  const backMin = (arriveMin + 10 + targetBackMin) % 1440;

  const leaveAngle = (leaveMin / 1440) * 360;
  const arriveAngle = (arriveMin / 1440) * 360;
  const keynoteAngle = (KEYNOTE_MIN / 1440) * 360;
  const backAngle = (backMin / 1440) * 360;

  const width = 230;
  const height = 230;
  const cx = width / 2;
  const cy = height / 2;
  const dialRadius = 88;
  const handRadius = 70;

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
      let newLeave = newArriveMin - targetTravelMin;
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

  // Keynote fixed tick positions (08:45)
  const keynoteTickIn = polarToCartesian(cx, cy, dialRadius - 10, keynoteAngle);
  const keynoteTickOut = polarToCartesian(cx, cy, dialRadius + 2, keynoteAngle);
  const keynoteTextPos = polarToCartesian(cx, cy, dialRadius - 20, keynoteAngle);

  // Back hollow marker pos
  const backMarkerPos = polarToCartesian(cx, cy, dialRadius - 5, backAngle);

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

  const arcLabel =
    mode === "walk"
      ? `${Math.round(targetTravelMin)} min on foot`
      : mode === "drive"
      ? `${Math.round(targetTravelMin)} min driving`
      : `${Math.round(targetTravelMin)} min by bike`;

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
          padding: "4px 8px 6px 8px",
          borderBottom: "1px dashed #d0c9b8",
          marginBottom: "4px",
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
            fontSize: "14.5px",
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
          {arcLabel}
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
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="85%" stopColor="#fdfbf7" stopOpacity="0.85" />
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
                  fontSize="9px"
                  fontWeight="700"
                  fill="#555"
                >
                  {pad2(t.h)}
                </text>
              )}
            </g>
          ))}

          {/* Keynote fixed tick at 08:45 */}
          <line
            x1={keynoteTickIn.x}
            y1={keynoteTickIn.y}
            x2={keynoteTickOut.x}
            y2={keynoteTickOut.y}
            stroke="#2e7d32"
            strokeWidth="3"
          />
          <text
            x={keynoteTextPos.x}
            y={keynoteTextPos.y}
            textAnchor="middle"
            fontFamily="'Fira Code', monospace"
            fontSize="8.5px"
            fontWeight="800"
            fill="#1b5e20"
          >
            keynote
          </text>

          {/* Arrive arc */}
          <path d={arcPath} fill="rgba(245, 124, 0, 0.28)" stroke="none" />
          <circle cx={cx} cy={cy} r="3" fill="#1a1a1a" />

          {/* Hands */}
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

          {/* Hollow marker at Back time */}
          <circle
            cx={backMarkerPos.x}
            cy={backMarkerPos.y}
            r={5.5}
            fill="#ffffff"
            stroke={backMin <= KEYNOTE_MIN ? "#2e7d32" : "#c62828"}
            strokeWidth="2.5"
          />

          {/* Draggable leave handle */}
          <g style={{ cursor: "grab" }} onPointerDown={onPointerDownLeave}>
            <circle cx={leavePos.x} cy={leavePos.y} r="14" fill="transparent" />
            <circle
              cx={leavePos.x}
              cy={leavePos.y}
              r={7}
              fill="#1a1a1a"
              stroke="#fdfbf7"
              strokeWidth="2"
            />
          </g>

          {/* Draggable arrive handle */}
          <g style={{ cursor: "grab" }} onPointerDown={onPointerDownArrive}>
            <circle cx={arrivePos.x} cy={arrivePos.y} r="14" fill="transparent" />
            <circle
              cx={arrivePos.x}
              cy={arrivePos.y}
              r={7}
              fill="#e65100"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        </svg>

        {/* Leave label */}
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

        {/* Arrive label */}
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
          marginBottom: "8px",
        }}
      >
        {arcLabel}
      </div>

      {/* Day Selector Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          padding: "0 4px",
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
                padding: "4px 0",
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
          marginTop: "4px",
          fontStyle: "italic",
        }}
      >
        Use ◀ / ▶ keys to nudge Leave 15m
      </div>
    </div>
  );
};

export const RegionsTable = ({
  regionsList,
  data,
  mode,
  leaveMin,
  dayIndex,
  hoveredRegionName,
  onHoverRegion,
}) => {
  const travelKey = `${mode}_min`;

  const stats = React.useMemo(() => {
    return regionsList.map((reg) => {
      const indices = reg.indices || [];
      const nShops = indices.length;
      let nIndependent = 0;
      let nOpen = 0;
      let earliestMin = Infinity;

      indices.forEach((idx) => {
        const row = data[idx];
        if (!row) return;
        if (!row.chain) nIndependent++;
        const tMin = row[travelKey] != null ? row[travelKey] : 15;
        const arrMin = (leaveMin + tMin) % 1440;
        if (arrMin < earliestMin) {
          earliestMin = arrMin;
        }
        const isOpen = checkIsOpen(row.hours, dayIndex, arrMin);
        if (isOpen === true) nOpen++;
      });

      const earliestArrival =
        earliestMin !== Infinity ? minToHhmm(earliestMin) : "—";

      return {
        name: reg.name,
        color: reg.color,
        nShops,
        nIndependent,
        nOpen,
        earliestArrival,
      };
    });
  }, [regionsList, data, travelKey, leaveMin, dayIndex]);

  return (
    <div
      style={{
        borderTop: "1px solid #1a1a1a",
        background: "#fdfbf7",
        padding: "10px 16px",
        fontFamily: "'Fira Code', monospace",
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
            fontSize: "11px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#1a1a1a",
          }}
        >
          Lasso Regions ({regionsList.length})
        </span>
        <span style={{ fontSize: "10px", color: "#666" }}>
          Shift+drag on map to lasso · Drag handles to adjust · Double-click inside region to delete
        </span>
      </div>

      {regionsList.length === 0 ? (
        <div
          style={{
            padding: "8px 12px",
            background: "#f7f4ed",
            border: "1px dashed #c0b8a4",
            borderRadius: "4px",
            fontSize: "11px",
            color: "#777",
            textAlign: "center",
          }}
        >
          No custom regions created yet. Hold <strong>Shift</strong> and drag on the map to draw a lasso.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1.5px solid #1a1a1a",
                  color: "#333",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <th style={{ padding: "4px 8px" }}>Region</th>
                <th style={{ padding: "4px 8px" }}>Shops</th>
                <th style={{ padding: "4px 8px" }}>Independent</th>
                <th style={{ padding: "4px 8px" }}>Open On Arrival</th>
                <th style={{ padding: "4px 8px" }}>Earliest Arrival</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const isHovered = hoveredRegionName === row.name;
                return (
                  <tr
                    key={row.name}
                    onMouseEnter={() => onHoverRegion(row.name)}
                    onMouseLeave={() => onHoverRegion(null)}
                    style={{
                      borderBottom: "1px solid #e0dacf",
                      background: isHovered
                        ? "rgba(230, 81, 0, 0.12)"
                        : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "6px 8px", fontWeight: 700 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          lineHeight: "16px",
                          textAlign: "center",
                          borderRadius: "3px",
                          background: row.color,
                          color: "#fff",
                          marginRight: "6px",
                          fontSize: "10px",
                          boxShadow: "1px 1px 0px rgba(0,0,0,0.4)",
                        }}
                      >
                        {row.name}
                      </span>
                      Region {row.name}
                    </td>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                      {row.nShops}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontWeight: 600,
                        color: "#b23c00",
                      }}
                    >
                      {row.nIndependent}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontWeight: 600,
                        color: "#1b5e20",
                      }}
                    >
                      {row.nOpen}
                    </td>
                    <td style={{ padding: "6px 8px", color: "#1a1a1a" }}>
                      {row.earliestArrival}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const REGION_COLORS = [
  "#d81b60",
  "#8e24aa",
  "#3949ab",
  "#00897b",
  "#fb8c00",
  "#6d4c41",
  "#00acc1",
  "#43a047",
];

function getRegionColor(index) {
  return REGION_COLORS[index % REGION_COLORS.length];
}

function getRegionName(index) {
  let name = "";
  let i = index;
  while (i >= 0) {
    name = String.fromCharCode(65 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  }
  return name;
}

export default function Widget({ model, React }) {
  injectLeafletStyles();

  const [rawData, setRawData] = React.useState(() => model.get("data"));
  const [reach, setReach] = React.useState(() => model.get("reach"));
  const [routes, setRoutes] = React.useState(() => model.get("routes"));

  React.useEffect(() => {
    const handleDataChange = () => setRawData(model.get("data"));
    const handleReachChange = () => setReach(model.get("reach"));
    const handleRoutesChange = () => setRoutes(model.get("routes"));
    model.on("change:data", handleDataChange);
    model.on("change:reach", handleReachChange);
    model.on("change:routes", handleRoutesChange);
    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:reach", handleReachChange);
      model.off("change:routes", handleRoutesChange);
    };
  }, [model]);

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

  const HOTEL_LAT = 29.7522;
  const HOTEL_LON = -95.3578;
  const INITIAL_RADIUS = 3.5;
  const INITIAL_DAY = 1;
  const INITIAL_LEAVE_MIN = 6 * 60 + 30;
  const INITIAL_TARGET_INDEX = 2;
  const INITIAL_MODE = "bike";

  const [mode, setMode] = React.useState(INITIAL_MODE);
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [targetIndex, setTargetIndex] = React.useState(INITIAL_TARGET_INDEX);
  const [leaveMin, setLeaveMin] = React.useState(INITIAL_LEAVE_MIN);
  const [dayIndex, setDayIndex] = React.useState(INITIAL_DAY);
  const [insideIndices, setInsideIndices] = React.useState([]);
  const [openArrivalIndices, setOpenArrivalIndices] = React.useState([]);

  const [regionsList, setRegionsList] = React.useState([]);
  const [hoveredRegionName, setHoveredRegionName] = React.useState(null);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const reachLayerGroupRef = React.useRef(null);
  const routeLayerGroupRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  const regionLayersRef = React.useRef(new Map());
  const lassoSvgOverlayRef = React.useRef(null);
  const isLassoActiveRef = React.useRef(false);
  const lassoPointsRef = React.useRef([]);
  const regionCountCounterRef = React.useRef(0);

  const regionsListRef = React.useRef(regionsList);
  regionsListRef.current = regionsList;

  const dataRef = React.useRef(data);
  dataRef.current = data;

  const targetShop = data[targetIndex] || data[0] || null;

  // Travel time columns depending on active mode
  const travelKey = `${mode}_min`;
  const backKey = `${mode}_back`;
  const targetTravelMin = targetShop ? targetShop[travelKey] || 15 : 15;
  const targetBackMin = targetShop ? targetShop[backKey] || 15 : 15;

  const arriveMin = (leaveMin + targetTravelMin) % 1440;
  const backMin = (arriveMin + 10 + targetBackMin) % 1440;
  const backHhmm = minToHhmm(backMin);
  const makesIt = backMin <= KEYNOTE_MIN;
  const diffMin = Math.abs(backMin - KEYNOTE_MIN);

  const evaluateShop = React.useCallback(
    (row, curMode, leaveTime, currentDay) => {
      const tMin = row[`${curMode}_min`] != null ? row[`${curMode}_min`] : 15;
      const arrMin = (leaveTime + tMin) % 1440;
      const arrHhmm = minToHhmm(arrMin);
      const isOpen = checkIsOpen(row.hours, currentDay, arrMin);
      return { arrHhmm, isOpen };
    },
    []
  );

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
    (radKm, curTargetIdx, curMode, curLeaveMin, curDayIdx) => {
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      const openArr = [];

      shopMarkersRef.current.forEach(({ marker, labelMarker, row, index }) => {
        const distMeters = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
        const isInside = distMeters <= radKm * 1000;
        const isTarget = index === curTargetIdx;
        const { arrHhmm, isOpen } = evaluateShop(
          row,
          curMode,
          curLeaveMin,
          curDayIdx
        );

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

      const openArr = updateMarkersAndLabels(
        newR,
        targetIndex,
        mode,
        leaveMin,
        dayIndex
      );
      setOpenArrivalIndices(openArr);

      model.set("radius_km", Number(newR.toFixed(3)));
      model.set("inside", newInside);
      model.set("open_on_arrival", openArr);
      model.save_changes();
    },
    [
      computeInside,
      updateMarkersAndLabels,
      getEdgeLatLng,
      targetIndex,
      mode,
      leaveMin,
      dayIndex,
      model,
    ]
  );

  const computeEnclosedShops = React.useCallback((latLngs) => {
    const polyArr = latLngs.map((pt) => [pt[0], pt[1]]);
    const inside = [];
    dataRef.current.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;
      if (pointInPolygon([row.lat, row.lon], polyArr)) {
        inside.push(idx);
      }
    });
    return inside;
  }, []);

  const syncRegionsModel = React.useCallback(
    (list) => {
      const dict = {};
      list.forEach((reg) => {
        dict[reg.name] = reg.indices;
      });
      model.set("regions", dict);
      model.save_changes();
    },
    [model]
  );

  // Initialize outputs on mount
  React.useEffect(() => {
    const initInside = computeInside(INITIAL_RADIUS);
    const initOpen = updateMarkersAndLabels(
      INITIAL_RADIUS,
      INITIAL_TARGET_INDEX,
      INITIAL_MODE,
      INITIAL_LEAVE_MIN,
      INITIAL_DAY
    );

    const initTarget = data[INITIAL_TARGET_INDEX] || data[0] || {};
    const initTMin = initTarget[`${INITIAL_MODE}_min`] || 15;
    const initBMin = initTarget[`${INITIAL_MODE}_back`] || 15;
    const initArr = (INITIAL_LEAVE_MIN + initTMin) % 1440;
    const initBack = (initArr + 10 + initBMin) % 1440;

    model.set({
      inside: initInside,
      radius_km: INITIAL_RADIUS,
      open_on_arrival: initOpen,
      when: { day: INITIAL_DAY, hhmm: minToHhmm(INITIAL_LEAVE_MIN) },
      target: INITIAL_TARGET_INDEX,
      regions: {},
      mode: INITIAL_MODE,
      back_hhmm: minToHhmm(initBack),
      makes_it: initBack <= KEYNOTE_MIN,
    });
    model.save_changes();
  }, []);

  // Update reach bands when reach data or active mode changes
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !reachLayerGroupRef.current) return;
    const reachGroup = reachLayerGroupRef.current;
    reachGroup.clearLayers();

    const currentReach = reach && reach[mode];
    if (currentReach && currentReach.features) {
      const sortedFeatures = [...currentReach.features].sort(
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
  }, [reach, mode]);

  // Update street route on map above bands
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routeLayerGroupRef.current) return;
    const routeGroup = routeLayerGroupRef.current;
    routeGroup.clearLayers();

    const modeRoutes = routes && routes[mode];
    const targetRoute = modeRoutes && modeRoutes[targetIndex];

    if (Array.isArray(targetRoute) && targetRoute.length > 0) {
      // Draw thick orange route line
      const polyline = L.polyline(targetRoute, {
        color: "#e65100",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(routeGroup);

      // Midpoint for '<n> min' label
      const midIdx = Math.floor(targetRoute.length / 2);
      const midPoint = targetRoute[midIdx];

      if (midPoint) {
        const midHtml = `
          <div style="
            transform: translate(-50%, -50%);
            background: #1a1a1a;
            color: #ffffff;
            border: 1.5px solid #ffffff;
            border-radius: 10px;
            padding: 1px 6px;
            font-family: 'Fira Code', monospace;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            pointer-events: none;
          ">
            ${Math.round(targetTravelMin)} min
          </div>
        `;
        const midIcon = L.divIcon({
          className: "route-mid-label",
          html: midHtml,
          iconSize: [0, 0],
        });
        L.marker(midPoint, {
          icon: midIcon,
          interactive: false,
          zIndexOffset: 1550,
        }).addTo(routeGroup);
      }
    }
  }, [routes, mode, targetIndex, targetTravelMin]);

  // Initialize Leaflet Map
  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [HOTEL_LAT, HOTEL_LON],
      zoom: 12,
      zoomControl: false,
      boxZoom: false,
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

    // Isochrone reach polygons layer group
    const reachGroup = L.layerGroup().addTo(map);
    reachLayerGroupRef.current = reachGroup;

    // Street route layer group (above bands, below markers)
    const routeGroup = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = routeGroup;

    // Radius circle
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

    // Draggable hit border
    const circleHit = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#ff3d00",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
    }).addTo(map);
    circleHitRef.current = circleHit;

    // Edge label marker
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

    // Radius circle edge drag
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
    const onEdgePointerMove = (e) => {
      if (!isDraggingEdgeRef.current) return;
      const pointerLatLng = map.mouseEventToLatLng(e);
      const distM = hotelLatLng.distanceTo(pointerLatLng);
      const newRadKm = Math.min(Math.max(distM / 1000, 0.4), 25.0);
      applyRadius(newRadKm);
    };

    const onEdgePointerUp = () => {
      if (!isDraggingEdgeRef.current) return;
      isDraggingEdgeRef.current = false;
      map.dragging.enable();
      window.removeEventListener("pointermove", onEdgePointerMove);
      window.removeEventListener("pointerup", onEdgePointerUp);
    };

    const startRadiusDrag = (e) => {
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        L.DomEvent.preventDefault(e.originalEvent);
      }
      isDraggingEdgeRef.current = true;
      map.dragging.disable();
      window.addEventListener("pointermove", onEdgePointerMove);
      window.addEventListener("pointerup", onEdgePointerUp);
    };

    circleHit.on("mousedown", startRadiusDrag);
    edgeMarker.on("mousedown", startRadiusDrag);

    // Lasso drawing via Shift+drag on map container
    const mapDiv = mapContainerRef.current;

    const onMapMouseDown = (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      map.dragging.disable();
      isLassoActiveRef.current = true;
      const rect = mapDiv.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      lassoPointsRef.current = [pt];

      if (lassoSvgOverlayRef.current) {
        lassoSvgOverlayRef.current.style.display = "block";
        const polyline = lassoSvgOverlayRef.current.querySelector(
          ".lasso-polyline"
        );
        if (polyline) {
          polyline.setAttribute("points", `${pt.x},${pt.y}`);
        }
      }

      window.addEventListener("mousemove", onMapMouseMove);
      window.addEventListener("mouseup", onMapMouseUp);
    };

    const onMapMouseMove = (e) => {
      if (!isLassoActiveRef.current) return;
      const rect = mapDiv.getBoundingClientRect();
      const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      lassoPointsRef.current.push(pt);

      if (lassoSvgOverlayRef.current) {
        const polyline = lassoSvgOverlayRef.current.querySelector(
          ".lasso-polyline"
        );
        if (polyline) {
          const ptsStr = lassoPointsRef.current
            .map((p) => `${p.x},${p.y}`)
            .join(" ");
          polyline.setAttribute("points", ptsStr);
        }
      }
    };

    const onMapMouseUp = () => {
      if (!isLassoActiveRef.current) return;
      isLassoActiveRef.current = false;
      map.dragging.enable();
      window.removeEventListener("mousemove", onMapMouseMove);
      window.removeEventListener("mouseup", onMapMouseUp);

      if (lassoSvgOverlayRef.current) {
        lassoSvgOverlayRef.current.style.display = "none";
        const polyline = lassoSvgOverlayRef.current.querySelector(
          ".lasso-polyline"
        );
        if (polyline) polyline.setAttribute("points", "");
      }

      const pts = lassoPointsRef.current;
      if (pts.length < 5) return;

      const maxVertices = 16;
      const step = Math.max(1, Math.floor(pts.length / maxVertices));
      const sampled = [];
      for (let i = 0; i < pts.length; i += step) {
        sampled.push(pts[i]);
      }
      if (sampled.length < 3) return;

      const latLngs = sampled.map((p) => {
        const ll = map.containerPointToLatLng([p.x, p.y]);
        return [ll.lat, ll.lng];
      });

      const currentCount = regionCountCounterRef.current;
      regionCountCounterRef.current += 1;
      const regName = getRegionName(currentCount);
      const regColor = getRegionColor(currentCount);
      const id =
        "region_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);

      const indices = computeEnclosedShops(latLngs);
      const newRegion = {
        id,
        name: regName,
        color: regColor,
        latLngs,
        indices,
      };

      setRegionsList((prev) => {
        const updated = [...prev, newRegion];
        syncRegionsModel(updated);
        return updated;
      });
    };

    mapDiv.addEventListener("mousedown", onMapMouseDown, true);

    return () => {
      mapDiv.removeEventListener("mousedown", onMapMouseDown, true);
      window.removeEventListener("mousemove", onMapMouseMove);
      window.removeEventListener("mouseup", onMapMouseUp);
      window.removeEventListener("pointermove", onEdgePointerMove);
      window.removeEventListener("pointerup", onEdgePointerUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update region polygon objects, vertex handles, and center labels on map
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentIds = new Set(regionsList.map((r) => r.id));

    for (const [id, layerObj] of regionLayersRef.current.entries()) {
      if (!currentIds.has(id)) {
        if (layerObj.polygon) layerObj.polygon.remove();
        if (layerObj.handles) layerObj.handles.forEach((h) => h.remove());
        if (layerObj.labelMarker) layerObj.labelMarker.remove();
        regionLayersRef.current.delete(id);
      }
    }

    regionsList.forEach((reg) => {
      let layerObj = regionLayersRef.current.get(reg.id);
      const isHovered = hoveredRegionName === reg.name;

      if (!layerObj) {
        const polygon = L.polygon(reg.latLngs, {
          color: reg.color,
          weight: isHovered ? 3.5 : 2.2,
          opacity: 0.95,
          fillColor: reg.color,
          fillOpacity: isHovered ? 0.35 : 0.2,
          className: "lasso-region-poly",
        }).addTo(map);

        polygon.on("dblclick", (e) => {
          L.DomEvent.stopPropagation(e);
          setRegionsList((prev) => {
            const updated = prev.filter((r) => r.id !== reg.id);
            syncRegionsModel(updated);
            return updated;
          });
        });

        const handleIconHtml = `
          <div style="
            width: 9px;
            height: 9px;
            background: #ffffff;
            border: 2px solid ${reg.color};
            border-radius: 50%;
            cursor: move;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            transform: translate(-50%, -50%);
          "></div>
        `;
        const handleIcon = L.divIcon({
          className: "lasso-vertex-handle",
          html: handleIconHtml,
          iconSize: [0, 0],
        });

        const handles = reg.latLngs.map((pt, vertexIdx) => {
          const handleMarker = L.marker(pt, {
            icon: handleIcon,
            draggable: true,
            zIndexOffset: 1400,
          }).addTo(map);

          handleMarker.on("drag", (e) => {
            const newLl = e.target.getLatLng();
            const currRegion = regionsListRef.current.find(
              (r) => r.id === reg.id
            );
            if (!currRegion) return;
            const updatedLatLngs = [...currRegion.latLngs];
            updatedLatLngs[vertexIdx] = [newLl.lat, newLl.lng];

            polygon.setLatLngs(updatedLatLngs);
            if (layerObj.labelMarker) {
              const bounds = polygon.getBounds();
              layerObj.labelMarker.setLatLng(bounds.getCenter());
            }
          });

          handleMarker.on("dragend", (e) => {
            const newLl = e.target.getLatLng();
            setRegionsList((prev) => {
              const updated = prev.map((r) => {
                if (r.id !== reg.id) return r;
                const nextPts = [...r.latLngs];
                nextPts[vertexIdx] = [newLl.lat, newLl.lng];
                const newIndices = computeEnclosedShops(nextPts);
                return { ...r, latLngs: nextPts, indices: newIndices };
              });
              syncRegionsModel(updated);
              return updated;
            });
          });

          return handleMarker;
        });

        const center = polygon.getBounds().getCenter();
        const labelHtml = `
          <div style="
            transform: translate(-50%, -50%);
            pointer-events: none;
            user-select: none;
          ">
            <span style="
              background: ${reg.color};
              color: #ffffff;
              font-family: 'Fira Code', monospace;
              fontSize: 11px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 3px;
              border: 1px solid #ffffff;
              box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            ">${reg.name}</span>
          </div>
        `;
        const labelIcon = L.divIcon({
          className: "lasso-region-label",
          html: labelHtml,
          iconSize: [0, 0],
        });
        const labelMarker = L.marker(center, {
          icon: labelIcon,
          zIndexOffset: 1300,
          interactive: false,
        }).addTo(map);

        layerObj = { polygon, handles, labelMarker };
        regionLayersRef.current.set(reg.id, layerObj);
      } else {
        layerObj.polygon.setStyle({
          weight: isHovered ? 3.5 : 2.2,
          fillOpacity: isHovered ? 0.38 : 0.2,
        });

        layerObj.polygon.setLatLngs(reg.latLngs);
        reg.latLngs.forEach((pt, vIdx) => {
          if (layerObj.handles[vIdx]) {
            layerObj.handles[vIdx].setLatLng(pt);
          }
        });
        const center = layerObj.polygon.getBounds().getCenter();
        if (layerObj.labelMarker) {
          layerObj.labelMarker.setLatLng(center);
        }
      }
    });
  }, [regionsList, hoveredRegionName, computeEnclosedShops, syncRegionsModel]);

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
      });

      newMarkers.push({ marker, labelMarker, row, index: idx });
    });

    shopMarkersRef.current = newMarkers;

    const openArr = updateMarkersAndLabels(
      currentRadiusRef.current,
      targetIndex,
      mode,
      leaveMin,
      dayIndex
    );
    setOpenArrivalIndices(openArr);
    const currInside = computeInside(currentRadiusRef.current);
    setInsideIndices(currInside);
  }, [data]);

  // Live restyling whenever target, mode, leaveMin, dayIndex change
  React.useEffect(() => {
    const openArr = updateMarkersAndLabels(
      currentRadiusRef.current,
      targetIndex,
      mode,
      leaveMin,
      dayIndex
    );
    setOpenArrivalIndices(openArr);

    model.set("open_on_arrival", openArr);
    model.set("when", { day: dayIndex, hhmm: minToHhmm(leaveMin) });
    model.set("target", targetIndex);
    model.set("mode", mode);
    model.set("back_hhmm", backHhmm);
    model.set("makes_it", makesIt);
    model.save_changes();
  }, [targetIndex, mode, leaveMin, dayIndex, backHhmm, makesIt]);

  const handleLeaveChange = React.useCallback((newLeaveMin) => {
    setLeaveMin(newLeaveMin);
  }, []);

  const handleDayChange = React.useCallback((newDayIdx) => {
    setDayIndex(newDayIdx);
  }, []);

  const handleModeChange = React.useCallback((newMode) => {
    setMode(newMode);
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
    const { arrHhmm, isOpen } = evaluateShop(
      hoveredShop,
      mode,
      leaveMin,
      dayIndex
    );
    return { arrHhmm, isOpen };
  }, [hoveredShop, mode, leaveMin, dayIndex, evaluateShop]);

  const targetOpenStatus = React.useMemo(() => {
    if (!targetShop) return null;
    return checkIsOpen(targetShop.hours, dayIndex, arriveMin);
  }, [targetShop, dayIndex, arriveMin]);

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
            Leave & Reach Planner + Street Route
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
          height: "590px",
          background: "#eae7dc",
          position: "relative",
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

          {/* SVG Overlay for Live In-Flight Lasso Drawing */}
          <svg
            ref={lassoSvgOverlayRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 2000,
              display: "none",
            }}
          >
            <polyline
              className="lasso-polyline"
              fill="rgba(216, 27, 96, 0.18)"
              stroke="#d81b60"
              strokeWidth="2.5"
              strokeDasharray="5, 3"
              points=""
            />
          </svg>

          {/* Badge top-left */}
          <StatusBadge
            insideCount={insideCount}
            independentCount={independentCount}
            openArrivalCount={openArrivalCount}
          />

          {/* Hover Inspector bottom-left */}
          <ShopInspector
            shop={hoveredShop}
            mode={mode}
            arrivalTime={hoveredStatus?.arrHhmm}
            isOpen={hoveredStatus?.isOpen}
          />
        </div>

        {/* Dial Sidebar (Right) */}
        <div
          style={{
            width: "260px",
            flexShrink: 0,
            background: "#fdfbf7",
            borderLeft: "1px solid #1a1a1a",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
            zIndex: 10,
            overflowY: "auto",
          }}
        >
          {/* Three-Button Mode Toggle above Dial */}
          <ModeToggle mode={mode} onModeChange={handleModeChange} />

          {/* Two-hand Dial */}
          <ClockDial
            React={React}
            leaveMin={leaveMin}
            targetTravelMin={targetTravelMin}
            targetBackMin={targetBackMin}
            mode={mode}
            dayIndex={dayIndex}
            targetShop={targetShop}
            onLeaveChange={handleLeaveChange}
            onDayChange={handleDayChange}
          />

          {/* Verdict Card under Dial */}
          <VerdictCard
            leaveMin={leaveMin}
            arriveMin={arriveMin}
            backMin={backMin}
            shopName={targetShop?.name}
            isOpen={targetOpenStatus}
            makesIt={makesIt}
            diffMin={diffMin}
          />
        </div>
      </div>

      {/* Compact Regions Table Under Map */}
      <RegionsTable
        regionsList={regionsList}
        data={data}
        mode={mode}
        leaveMin={leaveMin}
        dayIndex={dayIndex}
        hoveredRegionName={hoveredRegionName}
        onHoverRegion={setHoveredRegionName}
      />
    </div>
  );
}