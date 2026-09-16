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
const MODES = ["walk", "bike", "drive"];

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

function pointInPolygon(pt, vs) {
  const x = pt[0];
  const y = pt[1];
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

    let daysPart = "";
    let timesPart = "";

    if (/^[a-zA-Z,\-]+$/.test(parts[0])) {
      daysPart = parts[0];
      timesPart = parts.slice(1).join(" ");
    } else {
      daysPart = "Mo-Su";
      timesPart = parts.join(" ");
    }

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
    const hasExplicitDays = rules.some((r) => /^[a-zA-Z,\-]+/.test(r.trim()));
    if (hasExplicitDays) return false;
    return null;
  }

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
        if (end === 0) end = 1440;
        if (timeMin >= start && timeMin <= end) {
          return true;
        }
      }
    }
  }

  return false;
}

export const ModeSwitch = ({ mode, onModeChange, React }) => (
  <div
    style={{
      display: "flex",
      gap: 3,
      justifyContent: "center",
      marginBottom: 6,
    }}
  >
    {MODES.map((m) => {
      const isActive = mode === m;
      return (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          style={{
            padding: "3px 10px",
            border: `1px solid ${isActive ? INK_COLOR : HAIRLINE_COLOR}`,
            background: isActive ? INK_COLOR : "transparent",
            color: isActive ? "#ffffff" : INK_COLOR,
            fontSize: 11,
            fontFamily: "system-ui, -apple-system, sans-serif",
            cursor: "pointer",
            borderRadius: 0,
            textTransform: "lowercase",
          }}
        >
          {m}
        </button>
      );
    })}
  </div>
);

export const VerdictLines = ({
  leaveMin,
  backByMin,
  targetShop,
  mode,
  dayIdx,
  React,
}) => {
  if (!targetShop) {
    return (
      <div
        style={{
          width: "100%",
          padding: "6px 12px 0 12px",
          boxSizing: "border-box",
          minHeight: 38,
        }}
      />
    );
  }

  const minKey = `${mode}_min`;
  const backKey = `${mode}_back`;
  const tMin = targetShop[minKey] != null ? targetShop[minKey] : 0;
  const tBack = targetShop[backKey] != null ? targetShop[backKey] : 0;

  const arriveMin = leaveMin + tMin;
  const backMin = leaveMin + tMin + 10 + tBack;

  const isOpen = checkIsOpen(targetShop.hours, dayIdx, arriveMin);
  const statusStr = isOpen === true ? "open" : isOpen === false ? "closed" : "hours unknown";

  const leaveStr = formatHhMm(leaveMin);
  const arriveStr = formatHhMm(arriveMin);
  const backStr = formatHhMm(backMin);
  const backByStr = formatHhMm(backByMin);

  const shopName = (targetShop.name || "").toLowerCase();
  const line1 = `${leaveStr} → ${shopName} ${arriveStr}, ${statusStr} · 10 min · back ${backStr}`;

  const diff = Math.round(backByMin - backMin);
  let line2 = "";
  let line2Color = OPEN_COLOR;

  if (diff >= 0) {
    line2 = `${diff} min before ${backByStr}`;
    line2Color = OPEN_COLOR;
  } else {
    line2 = `${Math.abs(diff)} min after ${backByStr}`;
    line2Color = CLOSED_COLOR;
  }

  return (
    <div
      style={{
        width: "100%",
        padding: "8px 12px 0 12px",
        boxSizing: "border-box",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: 11,
        lineHeight: "15px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: INK_COLOR,
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {line1}
      </div>
      <div
        style={{
          color: line2Color,
          fontWeight: 600,
          marginTop: 2,
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {line2}
      </div>
    </div>
  );
};

export const CountLine = ({ insideCount, independentCount, openAndInTimeCount, React }) => (
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

export const TooltipOverlay = ({ hoveredShop, React }) => {
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
  mode,
  dayIdx,
  onDayChange,
  onLeaveChange,
  onBackByChange,
  React,
}) => {
  const svgRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const lastTouchedRef = React.useRef("leave");
  const draggingRef = React.useRef(null);

  const cx = 140;
  const cy = 135;
  const rRim = 82;
  const rLeave = rRim;
  const rBack = rRim + 12;

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

  const rTrip = rRim - 7;
  let tripArcNormal = null;
  let tripArcLate = null;
  let arrivalPt = null;
  let arrivalLabelPos = null;
  let arrivalTimeStr = "";
  let backRimTick = null;

  const minKey = `${mode}_min`;
  const backKey = `${mode}_back`;

  if (targetShop && targetShop[minKey] != null && targetShop[backKey] != null) {
    const tMin = targetShop[minKey];
    const tBack = targetShop[backKey];
    const arriveMin = leaveMin + tMin;
    const tripTotalMin = tMin + 10 + tBack;
    const tripEndMin = leaveMin + tripTotalMin;

    arrivalTimeStr = formatHhMm(arriveMin);
    const arriveAngle = minToAngle(arriveMin);
    arrivalPt = getPt(arriveAngle, rTrip);
    arrivalLabelPos = getPt(arriveAngle, rTrip - 15);

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

    const backRimAngle = minToAngle(tripEndMin);
    backRimTick = {
      p1: getPt(backRimAngle, rRim - 4),
      p2: getPt(backRimAngle, rRim + 4),
    };
  }

  const getAngleFromEvent = (e) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const svgCenterX = rect.left + rect.width / 2;
    const svgCenterY = rect.top + (cy / 270) * rect.height;
    const dx = e.clientX - svgCenterX;
    const dy = e.clientY - svgCenterY;
    let angle = Math.atan2(dy, dx);
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
      let minutes = (rad / (2 * Math.PI)) * 720;
      minutes = Math.round(minutes);
      if (minutes >= 720) minutes = 0;

      if (draggingRef.current === "leave") {
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

  const leaveLabelPt = getPt(leaveAngle, rLeave + 24);
  const backLabelPt = getPt(backAngle, rBack + 24);

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
      }}
    >
      <svg
        ref={svgRef}
        width={280}
        height={265}
        style={{ overflow: "visible", display: "block" }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={rRim}
          fill="none"
          stroke={HAIRLINE_COLOR}
          strokeWidth={1}
        />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          const isQuarter = i % 3 === 0;
          const r1 = rRim - (isQuarter ? 6 : 3);
          const p1 = getPt(a, r1);
          const p2 = getPt(a, rRim);
          const numPt = getPt(a, rRim - 13);
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

        {wedgePath && <path d={wedgePath} fill="#f2f2f2" opacity={0.7} />}

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

        {backRimTick && (
          <line
            x1={backRimTick.p1.x}
            y1={backRimTick.p1.y}
            x2={backRimTick.p2.x}
            y2={backRimTick.p2.y}
            stroke={INK_COLOR}
            strokeWidth={1.5}
            strokeDasharray="2, 2"
          />
        )}

        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("leave", e)}
        >
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

        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("back", e)}
        >
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

      <div
        style={{
          display: "flex",
          gap: 3,
          marginTop: 2,
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
                height: 22,
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

export const RegionsTable = ({
  regionsList,
  regionStats,
  hoveredRegion,
  onHoverRegion,
  React,
}) => {
  if (!regionsList || regionsList.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        borderTop: `1px solid ${HAIRLINE_COLOR}`,
        paddingTop: 10,
        marginTop: 10,
        boxSizing: "border-box",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
          color: INK_COLOR,
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${HAIRLINE_COLOR}`,
              color: GREY_COLOR,
              fontSize: 11,
            }}
          >
            <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 400 }}>region</th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>shops</th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>independent</th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>open on arrival</th>
            <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 400 }}>earliest arrival</th>
          </tr>
        </thead>
        <tbody>
          {regionsList.map((r) => {
            const stats = regionStats[r.name] || {
              count: 0,
              independent: 0,
              openOnArrival: 0,
              earliestArrival: "—",
            };
            const isHovered = hoveredRegion === r.name;
            return (
              <tr
                key={r.name}
                onMouseEnter={() => onHoverRegion(r.name)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  borderBottom: `1px solid ${HAIRLINE_COLOR}`,
                  backgroundColor: isHovered ? "#f7f7f7" : "transparent",
                  cursor: "default",
                }}
              >
                <td
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    fontWeight: 600,
                  }}
                >
                  {r.name}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stats.count}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stats.independent}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {stats.openOnArrival}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "6px 8px",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {stats.earliestArrival}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const edgeHandleRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const routeLayerRef = React.useRef(null);
  const shopsLayerRef = React.useRef(null);
  const regionsLayerGroupRef = React.useRef(null);

  const radiusKmRef = React.useRef(INITIAL_RADIUS_KM);
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS_KM);
  const [dayIdx, setDayIdx] = React.useState(1);
  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backByMin, setBackByMin] = React.useState(8 * 60 + 45);
  const [targetIdx, setTargetIdx] = React.useState(2);
  const [mode, setMode] = React.useState("bike");
  const [hoveredShop, setHoveredShop] = React.useState(null);

  const [regions, setRegions] = React.useState([]);
  const [hoveredRegion, setHoveredRegion] = React.useState(null);
  const regionsRef = React.useRef([]);
  regionsRef.current = regions;
  const hoveredRegionRef = React.useRef(null);
  hoveredRegionRef.current = hoveredRegion;

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
  const modeRef = React.useRef(mode);

  leaveMinRef.current = leaveMin;
  backByMinRef.current = backByMin;
  dayIdxRef.current = dayIdx;
  targetIdxRef.current = targetIdx;
  modeRef.current = mode;

  const nextRegionName = (currentRegions) => {
    const used = new Set(currentRegions.map((r) => r.name));
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(65 + i);
      if (!used.has(char)) return char;
    }
    let n = 1;
    while (true) {
      const name = `R${n}`;
      if (!used.has(name)) return name;
      n++;
    }
  };

  const getRegionIndicesMap = (currentRegions) => {
    const shops = shopsRef.current;
    const res = {};
    currentRegions.forEach((r) => {
      const polyPts = r.latlngs.map((ll) => [ll.lat, ll.lng]);
      const indices = [];
      shops.forEach((s, idx) => {
        if (pointInPolygon([s.lat, s.lon], polyPts)) {
          indices.push(idx);
        }
      });
      res[r.name] = indices;
    });
    return res;
  };

  const evaluateState = (rKm, currentLeave, currentBackBy, curDay, curTarget, curMode) => {
    const shops = shopsRef.current;
    const insideIndices = [];
    const openOnArrival = [];
    let insideCount = 0;
    let indepCount = 0;
    let openAndInTimeCount = 0;

    const minKey = `${curMode}_min`;
    const backKey = `${curMode}_back`;

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

        const tMin = s[minKey] != null ? s[minKey] : 0;
        const tBack = s[backKey] != null ? s[backKey] : 0;

        const arriveMin = currentLeave + tMin;
        const isOpen = checkIsOpen(s.hours, curDay, arriveMin);
        if (isOpen === true) {
          openOnArrival.push(i);
        }

        const roundTripMin = tMin + 10 + tBack;
        const backMin = currentLeave + roundTripMin;
        const fitsInTime = backMin <= currentBackBy;

        if (isOpen === true && fitsInTime) {
          openAndInTimeCount++;
        }
      }
    }

    let backHhmm = "";
    let makesIt = false;
    const targetShop = curTarget >= 0 && curTarget < shops.length ? shops[curTarget] : null;
    if (targetShop) {
      const tMin = targetShop[minKey] != null ? targetShop[minKey] : 0;
      const tBack = targetShop[backKey] != null ? targetShop[backKey] : 0;
      const targetBackMin = currentLeave + tMin + 10 + tBack;
      backHhmm = formatHhMm(targetBackMin);
      makesIt = targetBackMin <= currentBackBy;
    }

    return {
      insideIndices,
      openOnArrival,
      insideCount,
      independentCount: indepCount,
      openAndInTimeCount,
      backHhmm,
      makesIt,
    };
  };

  const syncAllOutputs = (
    rKm,
    insideIndices,
    openIndices,
    curDay,
    curLeave,
    curBack,
    curTarget,
    curRegions,
    curMode,
    backHhmm,
    makesIt
  ) => {
    model.set("radius_km", parseFloat(rKm.toFixed(2)));
    model.set("inside", insideIndices);
    model.set("open_on_arrival", openIndices);
    model.set("when", { day: curDay, hhmm: formatHhMm(curLeave) });
    model.set("back_by", formatHhMm(curBack));
    model.set("target", curTarget);
    model.set("regions", getRegionIndicesMap(curRegions));
    model.set("mode", curMode);
    model.set("back_hhmm", backHhmm);
    model.set("makes_it", makesIt);
    model.save_changes();
  };

  const updateShopsVisuals = () => {
    const layer = shopsLayerRef.current;
    if (!layer) return;
    const shops = shopsRef.current;
    const rKm = radiusKmRef.current;
    const curLeave = leaveMinRef.current;
    const curBack = backByMinRef.current;
    const curDay = dayIdxRef.current;
    const curTarget = targetIdxRef.current;
    const curMode = modeRef.current;

    const minKey = `${curMode}_min`;
    const backKey = `${curMode}_back`;

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

      const tMin = s[minKey] != null ? s[minKey] : 0;
      const tBack = s[backKey] != null ? s[backKey] : 0;

      const arriveMin = curLeave + tMin;
      const arriveHhMm = formatHhMm(arriveMin);
      const isOpen = checkIsOpen(s.hours, curDay, arriveMin);

      const roundTripMin = tMin + 10 + tBack;
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

  const updateReachLayer = (curMode) => {
    if (!mapRef.current) return;
    if (reachLayerRef.current) {
      mapRef.current.removeLayer(reachLayerRef.current);
      reachLayerRef.current = null;
    }
    const reachData = model.get("reach");
    const modeReach = reachData && reachData[curMode] ? reachData[curMode] : null;
    if (modeReach) {
      const reachGroup = L.geoJSON(modeReach, {
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
      }).addTo(mapRef.current);
      reachLayerRef.current = reachGroup;
    }
  };

  const updateRouteLayer = (curMode, curTarget) => {
    if (!mapRef.current) return;
    if (routeLayerRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const routesData = model.get("routes");
    if (!routesData || !routesData[curMode]) return;
    const routeCoords = routesData[curMode][curTarget];
    if (!routeCoords || routeCoords.length === 0) return;

    const group = L.layerGroup().addTo(mapRef.current);
    routeLayerRef.current = group;

    const polyline = L.polyline(routeCoords, {
      color: ACCENT_COLOR,
      weight: 2,
      opacity: 0.95,
      interactive: false,
    }).addTo(group);

    const shops = shopsRef.current;
    const targetShop = curTarget >= 0 && curTarget < shops.length ? shops[curTarget] : null;
    const minKey = `${curMode}_min`;
    const minutesVal = targetShop && targetShop[minKey] != null ? Math.round(targetShop[minKey]) : null;

    if (minutesVal != null && routeCoords.length > 1) {
      const midIdx = Math.floor(routeCoords.length / 2);
      const p1 = routeCoords[Math.max(0, midIdx - 1)];
      const p2 = routeCoords[Math.min(routeCoords.length - 1, midIdx + 1)];
      const midPt = routeCoords[midIdx];

      const dLat = p2[0] - p1[0];
      const dLon = p2[1] - p1[1];
      const norm = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
      const perpLat = -dLon / norm;
      const perpLon = dLat / norm;
      const offsetDist = 0.0022;

      const labelLat = midPt[0] + perpLat * offsetDist;
      const labelLon = midPt[1] + perpLon * offsetDist;

      const labelIcon = L.divIcon({
        className: "route-midpoint-icon",
        html: `
          <div style="
            background: #ffffff;
            box-shadow: 0 0 0 2px #ffffff;
            padding: 1px 4px;
            font-family: ui-monospace, SF Mono, Menlo, monospace;
            font-size: 10px;
            color: ${INK_COLOR};
            white-space: nowrap;
            pointer-events: none;
            display: inline-block;
            line-height: 12px;
          ">${minutesVal} min</div>
        `,
        iconSize: [0, 0],
      });

      L.marker([labelLat, labelLon], {
        icon: labelIcon,
        interactive: false,
      }).addTo(group);
    }
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
      targetIdxRef.current,
      modeRef.current
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
      targetIdxRef.current,
      regionsRef.current,
      modeRef.current,
      evalRes.backHhmm,
      evalRes.makesIt
    );
  };

  const redrawRegions = () => {
    const group = regionsLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const currentRegions = regionsRef.current;
    const activeHover = hoveredRegionRef.current;

    currentRegions.forEach((reg) => {
      const isHovered = activeHover === reg.name;

      const polygon = L.polygon(reg.latlngs, {
        color: isHovered ? ACCENT_COLOR : INK_COLOR,
        weight: isHovered ? 2 : 1.5,
        dashArray: isHovered ? undefined : "3, 3",
        fillColor: isHovered ? ACCENT_COLOR : INK_COLOR,
        fillOpacity: isHovered ? 0.16 : 0.07,
        interactive: true,
      });

      polygon.on("dblclick", (e) => {
        L.DomEvent.stopPropagation(e);
        const updated = regionsRef.current.filter((r) => r.name !== reg.name);
        setRegions(updated);
        regionsRef.current = updated;
        redrawRegions();
        const evalRes = evaluateState(
          radiusKmRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          dayIdxRef.current,
          targetIdxRef.current,
          modeRef.current
        );
        syncAllOutputs(
          radiusKmRef.current,
          evalRes.insideIndices,
          evalRes.openOnArrival,
          dayIdxRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          targetIdxRef.current,
          updated,
          modeRef.current,
          evalRes.backHhmm,
          evalRes.makesIt
        );
      });

      polygon.addTo(group);

      const bounds = polygon.getBounds();
      const center = bounds.getCenter();
      const labelIcon = L.divIcon({
        className: "region-label-icon",
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-weight:600;color:${
            isHovered ? ACCENT_COLOR : INK_COLOR
          };pointer-events:none;transform:translate(-50%,-50%);">${reg.name}</div>
        `,
        iconSize: [0, 0],
      });
      L.marker(center, { icon: labelIcon, interactive: false }).addTo(group);

      reg.latlngs.forEach((pt, vertexIdx) => {
        const handleIcon = L.divIcon({
          className: "lasso-vertex-icon",
          html: `
            <div style="width:20px;height:20px;margin:-10px 0 0 -10px;display:flex;align-items:center;justify-content:center;cursor:move;">
              <div style="width:7px;height:7px;border-radius:50%;background:${
                isHovered ? ACCENT_COLOR : INK_COLOR
              };border:1.5px solid #ffffff;box-sizing:border-box;"></div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const vertexMarker = L.marker([pt.lat, pt.lng], {
          icon: handleIcon,
          draggable: true,
          zIndexOffset: 1500,
        });

        vertexMarker.on("dragstart", () => {
          if (mapRef.current) mapRef.current.dragging.disable();
        });

        vertexMarker.on("drag", (e) => {
          const newPos = e.target.getLatLng();
          reg.latlngs[vertexIdx] = { lat: newPos.lat, lng: newPos.lng };
          polygon.setLatLngs(reg.latlngs);
        });

        vertexMarker.on("dragend", () => {
          if (mapRef.current) mapRef.current.dragging.enable();
          const updated = [...regionsRef.current];
          setRegions(updated);
          redrawRegions();
          const evalRes = evaluateState(
            radiusKmRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            dayIdxRef.current,
            targetIdxRef.current,
            modeRef.current
          );
          syncAllOutputs(
            radiusKmRef.current,
            evalRes.insideIndices,
            evalRes.openOnArrival,
            dayIdxRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            targetIdxRef.current,
            updated,
            modeRef.current,
            evalRes.backHhmm,
            evalRes.makesIt
          );
        });

        vertexMarker.addTo(group);
      });
    });
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    modeRef.current = newMode;
    updateReachLayer(newMode);
    updateRouteLayer(newMode, targetIdxRef.current);
    updateShopsVisuals();

    const evalRes = evaluateState(
      radiusKmRef.current,
      leaveMinRef.current,
      backByMinRef.current,
      dayIdxRef.current,
      targetIdxRef.current,
      newMode
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
      targetIdxRef.current,
      regionsRef.current,
      newMode,
      evalRes.backHhmm,
      evalRes.makesIt
    );
  };

  // Initialize map and layers
  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [HOTEL.lat, HOTEL.lon],
      zoom: 12,
      zoomControl: false,
      boxZoom: false,
      doubleClickZoom: false,
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

    updateReachLayer("bike");

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
      if (e.originalEvent && e.originalEvent.shiftKey) return;
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

    const regionsGroup = L.layerGroup().addTo(map);
    regionsLayerGroupRef.current = regionsGroup;

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

      marker.on("click", (e) => {
        if (e.originalEvent && e.originalEvent.shiftKey) return;
        setTargetIdx(index);
        targetIdxRef.current = index;
        updateRouteLayer(modeRef.current, index);
        updateShopsVisuals();
        const evalRes = evaluateState(
          radiusKmRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          dayIdxRef.current,
          index,
          modeRef.current
        );
        syncAllOutputs(
          radiusKmRef.current,
          evalRes.insideIndices,
          evalRes.openOnArrival,
          dayIdxRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          index,
          regionsRef.current,
          modeRef.current,
          evalRes.backHhmm,
          evalRes.makesIt
        );
      });

      marker.addTo(shopsGroup);
    });

    updateRouteLayer("bike", 2);

    // Lasso drawing via shift + drag
    let isLassoing = false;
    let lassoPoints = [];
    let lassoPolyline = null;

    const mapContainer = containerRef.current;

    const handleContainerMouseDown = (e) => {
      if (e.shiftKey && e.button === 0) {
        isLassoing = true;
        map.dragging.disable();
        const pt = map.mouseEventToLatLng(e);
        lassoPoints = [pt];
        lassoPolyline = L.polyline(lassoPoints, {
          color: INK_COLOR,
          weight: 1.5,
          dashArray: "3, 3",
          opacity: 0.8,
        }).addTo(map);
      }
    };

    const handleContainerMouseMove = (e) => {
      if (!isLassoing) return;
      const pt = map.mouseEventToLatLng(e);
      const last = lassoPoints[lassoPoints.length - 1];
      const dist = map.latLngToContainerPoint(pt).distanceTo(
        map.latLngToContainerPoint(last)
      );
      if (dist > 8) {
        lassoPoints.push(pt);
        if (lassoPolyline) {
          lassoPolyline.setLatLngs(lassoPoints);
        }
      }
    };

    const simplifyLasso = (pts) => {
      if (pts.length <= 12) return pts;
      const step = Math.ceil(pts.length / 16);
      const res = [];
      for (let i = 0; i < pts.length; i += step) {
        res.push(pts[i]);
      }
      return res;
    };

    const handleContainerMouseUp = (e) => {
      if (!isLassoing) return;
      isLassoing = false;
      map.dragging.enable();

      if (lassoPolyline) {
        map.removeLayer(lassoPolyline);
        lassoPolyline = null;
      }

      if (lassoPoints.length >= 3) {
        const simplified = simplifyLasso(lassoPoints).map((p) => ({
          lat: p.lat,
          lng: p.lng,
        }));
        const name = nextRegionName(regionsRef.current);
        const newRegion = {
          name,
          latlngs: simplified,
        };
        const nextRegions = [...regionsRef.current, newRegion];
        setRegions(nextRegions);
        regionsRef.current = nextRegions;
        redrawRegions();

        const evalRes = evaluateState(
          radiusKmRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          dayIdxRef.current,
          targetIdxRef.current,
          modeRef.current
        );
        syncAllOutputs(
          radiusKmRef.current,
          evalRes.insideIndices,
          evalRes.openOnArrival,
          dayIdxRef.current,
          leaveMinRef.current,
          backByMinRef.current,
          targetIdxRef.current,
          nextRegions,
          modeRef.current,
          evalRes.backHhmm,
          evalRes.makesIt
        );
      }
      lassoPoints = [];
    };

    mapContainer.addEventListener("mousedown", handleContainerMouseDown, true);
    window.addEventListener("mousemove", handleContainerMouseMove);
    window.addEventListener("mouseup", handleContainerMouseUp);

    // Initial evaluation & outputs
    updateShopsVisuals();
    const initEval = evaluateState(
      radiusKmRef.current,
      leaveMinRef.current,
      backByMinRef.current,
      dayIdxRef.current,
      targetIdxRef.current,
      modeRef.current
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
      targetIdxRef.current,
      [],
      modeRef.current,
      initEval.backHhmm,
      initEval.makesIt
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
        marker.on("click", (e) => {
          if (e.originalEvent && e.originalEvent.shiftKey) return;
          setTargetIdx(index);
          targetIdxRef.current = index;
          updateRouteLayer(modeRef.current, index);
          updateShopsVisuals();
          const evalRes = evaluateState(
            radiusKmRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            dayIdxRef.current,
            index,
            modeRef.current
          );
          syncAllOutputs(
            radiusKmRef.current,
            evalRes.insideIndices,
            evalRes.openOnArrival,
            dayIdxRef.current,
            leaveMinRef.current,
            backByMinRef.current,
            index,
            regionsRef.current,
            modeRef.current,
            evalRes.backHhmm,
            evalRes.makesIt
          );
        });
        marker.addTo(shopsGroup);
      });
      updateRouteLayer(modeRef.current, targetIdxRef.current);
      updateShopsVisuals();
      const evalRes = evaluateState(
        radiusKmRef.current,
        leaveMinRef.current,
        backByMinRef.current,
        dayIdxRef.current,
        targetIdxRef.current,
        modeRef.current
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
        targetIdxRef.current,
        regionsRef.current,
        modeRef.current,
        evalRes.backHhmm,
        evalRes.makesIt
      );
    };

    const onReachChange = () => {
      updateReachLayer(modeRef.current);
    };

    const onRoutesChange = () => {
      updateRouteLayer(modeRef.current, targetIdxRef.current);
    };

    model.on("change:data", onDataChange);
    model.on("change:reach", onReachChange);
    model.on("change:routes", onRoutesChange);

    return () => {
      model.off("change:data", onDataChange);
      model.off("change:reach", onReachChange);
      model.off("change:routes", onRoutesChange);
      mapContainer.removeEventListener("mousedown", handleContainerMouseDown, true);
      window.removeEventListener("mousemove", handleContainerMouseMove);
      window.removeEventListener("mouseup", handleContainerMouseUp);
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
    };
  }, []);

  React.useEffect(() => {
    updateShopsVisuals();
    const evalRes = evaluateState(
      radiusKmRef.current,
      leaveMin,
      backByMin,
      dayIdx,
      targetIdx,
      mode
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
      targetIdx,
      regionsRef.current,
      mode,
      evalRes.backHhmm,
      evalRes.makesIt
    );
  }, [leaveMin, backByMin, dayIdx, targetIdx]);

  React.useEffect(() => {
    redrawRegions();
  }, [hoveredRegion, regions]);

  // Compute regions table statistics
  const regionStats = React.useMemo(() => {
    const shops = shopsRef.current;
    const stats = {};
    const curLeave = leaveMin;
    const curDay = dayIdx;
    const minKey = `${mode}_min`;

    regions.forEach((reg) => {
      const polyPts = reg.latlngs.map((ll) => [ll.lat, ll.lng]);
      let count = 0;
      let independent = 0;
      let openOnArrival = 0;
      let earliestArrivalMin = Infinity;

      shops.forEach((s) => {
        if (pointInPolygon([s.lat, s.lon], polyPts)) {
          count++;
          if (!s.chain) independent++;

          const tMin = s[minKey] != null ? s[minKey] : 0;
          const arriveMin = curLeave + tMin;
          if (arriveMin < earliestArrivalMin) {
            earliestArrivalMin = arriveMin;
          }
          const isOpen = checkIsOpen(s.hours, curDay, arriveMin);
          if (isOpen === true) {
            openOnArrival++;
          }
        }
      });

      stats[reg.name] = {
        count,
        independent,
        openOnArrival,
        earliestArrival:
          earliestArrivalMin === Infinity
            ? "—"
            : formatHhMm(earliestArrivalMin),
      };
    });

    return stats;
  }, [regions, leaveMin, dayIdx, mode]);

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
            React={React}
          />
          <TooltipOverlay hoveredShop={hoveredShop} React={React} />
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        <div
          style={{
            width: 300,
            height: "100%",
            backgroundColor: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 0",
            boxSizing: "border-box",
          }}
        >
          <ModeSwitch
            mode={mode}
            onModeChange={handleModeChange}
            React={React}
          />
          <ClockDial
            leaveMin={leaveMin}
            backByMin={backByMin}
            targetShop={currentTargetShop}
            mode={mode}
            dayIdx={dayIdx}
            onDayChange={setDayIdx}
            onLeaveChange={setLeaveMin}
            onBackByChange={setBackByMin}
            React={React}
          />
          <VerdictLines
            leaveMin={leaveMin}
            backByMin={backByMin}
            targetShop={currentTargetShop}
            mode={mode}
            dayIdx={dayIdx}
            React={React}
          />
        </div>
      </div>

      <RegionsTable
        regionsList={regions}
        regionStats={regionStats}
        hoveredRegion={hoveredRegion}
        onHoverRegion={setHoveredRegion}
        React={React}
      />
    </div>
  );
}