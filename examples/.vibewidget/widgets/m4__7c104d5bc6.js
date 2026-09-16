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

export function checkIsOpen(hoursStr, dayIndex, minutesOfDay) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const raw = hoursStr.trim();
  if (!raw) return null;
  if (raw === "24/7") return true;

  const dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const targetDay = dayNames[dayIndex];

  const rules = raw.split(";").map((r) => r.trim()).filter(Boolean);

  let hasApplicableRule = false;
  let isOpenNow = false;

  for (const rule of rules) {
    if (rule.toLowerCase() === "off") continue;

    const parts = rule.split(/\s+/);
    let daySpec = null;
    let timePart = "";

    if (parts.length === 1) {
      timePart = parts[0];
    } else {
      daySpec = parts[0];
      timePart = parts.slice(1).join(" ");
    }

    let appliesToDay = false;
    if (!daySpec) {
      appliesToDay = true;
    } else {
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
      const timeRanges = timePart.split(",").map((t) => t.trim());
      for (const tr of timeRanges) {
        const match = tr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (match) {
          const startMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          const endMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
          if (endMin < startMin) {
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

export function pointInPolygon(point, vs) {
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
      <span style={{ fontWeight: 700, color: "#d84315" }}>
        {independentCount}
      </span>{" "}
      independent
      <span style={{ margin: "0 5px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#2e7d32" }}>{openCount}</span> open
      on arrival
    </div>
  </div>
);

export const ShopInspector = ({
  shop,
  leaveMinutes = 390,
  dayIndex = 1,
  mode = "bike",
}) => {
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

  const travelCol = `${mode}_min`;
  const travelMin = shop[travelCol] != null ? shop[travelCol] : 0;
  const arrivalMin = leaveMinutes + travelMin;
  const status = checkIsOpen(shop.hours, dayIndex, arrivalMin % 1440);
  const statusText =
    status === true ? "OPEN" : status === false ? "CLOSED" : "HOURS UNKNOWN";
  const statusBg =
    status === true ? "#2e7d32" : status === false ? "#c62828" : "#616161";

  const modeLabels = { walk: "walk", bike: "bike", drive: "drive" };

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
        {shop.street || "Street address unlisted"} ·{" "}
        {Number(shop.km_from_hotel).toFixed(2)} km
      </div>
      <div style={{ fontSize: "10px", color: "#444", marginBottom: "4px" }}>
        <strong>Hours:</strong> {shop.hours || "Unlisted"}
      </div>
      <div
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "center",
          marginTop: "4px",
        }}
      >
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
        <span
          style={{
            fontSize: "10px",
            color: "#333",
            marginLeft: "auto",
            fontWeight: 600,
          }}
        >
          {travelMin ? `${Math.round(travelMin)}m ${modeLabels[mode] || mode}` : ""}
        </span>
      </div>
    </div>
  );
};

export const ModeToggle = ({ React, mode, onModeChange }) => {
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
        gap: "4px",
        marginBottom: "8px",
        padding: "3px",
        background: "#eee9de",
        borderRadius: "5px",
        border: "1px solid #1a1a1a",
      }}
    >
      {modes.map((m, idx) => {
        const isSel = mode === m.key;
        return (
          <React.Fragment key={m.key}>
            {idx > 0 && (
              <span style={{ color: "#888", fontSize: "10px" }}>·</span>
            )}
            <button
              type="button"
              onClick={() => onModeChange(m.key)}
              style={{
                flex: 1,
                padding: "3px 0",
                fontFamily: "'Fira Code', monospace",
                fontSize: "11px",
                fontWeight: isSel ? 700 : 500,
                border: isSel ? "1px solid #1a1a1a" : "1px solid transparent",
                background: isSel ? "#1a1a1a" : "transparent",
                color: isSel ? "#ffffff" : "#222222",
                borderRadius: "3px",
                cursor: "pointer",
                textAlign: "center",
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
  React,
  leaveMinutes,
  arriveMinutes,
  backMinutes,
  shopName,
  isOpen,
  makesIt,
}) => {
  const KEYNOTE_MIN = 8 * 60 + 45; // 08:45 = 525 min
  const spareMin = KEYNOTE_MIN - backMinutes;
  const lateMin = backMinutes - KEYNOTE_MIN;

  const statusText =
    isOpen === true ? "open" : isOpen === false ? "closed" : "hours unknown";

  const cardBg = makesIt ? "#e8f5e9" : "#ffebee";
  const cardBorder = makesIt ? "#2e7d32" : "#c62828";
  const cardShadow = makesIt ? "#1b5e20" : "#8e0000";
  const verdictText = makesIt
    ? `back with ${Math.round(spareMin)} min to spare`
    : `late for the keynote by ${Math.round(lateMin)} min`;

  return (
    <div
      style={{
        marginTop: "6px",
        padding: "7px 9px",
        background: cardBg,
        border: `1.5px solid ${cardBorder}`,
        boxShadow: `2px 2px 0px ${cardShadow}`,
        borderRadius: "4px",
        fontFamily: "'Fira Code', monospace",
        fontSize: "10.5px",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#333",
          lineHeight: 1.35,
          marginBottom: "4px",
        }}
      >
        <span>leave {formatHhMm(leaveMinutes)}</span>
        <span style={{ color: "#777", margin: "0 2px" }}>→</span>
        <span style={{ fontWeight: 700, color: "#111" }}>{shopName}</span>{" "}
        <span>{formatHhMm(arriveMinutes)}</span>
        <span style={{ margin: "0 3px", color: "#888" }}>·</span>
        <span
          style={{
            fontWeight: 700,
            color:
              isOpen === true
                ? "#2e7d32"
                : isOpen === false
                ? "#c62828"
                : "#616161",
          }}
        >
          {statusText}
        </span>
        <span style={{ color: "#777", margin: "0 2px" }}>→</span>
        <span>10 min for donuts</span>
        <span style={{ color: "#777", margin: "0 2px" }}>→</span>
        <span>back {formatHhMm(backMinutes)}</span>
      </div>
      <div
        style={{
          fontWeight: 800,
          fontSize: "11px",
          color: makesIt ? "#1b5e20" : "#b71c1c",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span>{makesIt ? "✓" : "✕"}</span>
        <span>{verdictText}</span>
      </div>
    </div>
  );
};

export const ClockDialPanel = ({
  React,
  leaveMinutes,
  targetShop,
  dayIndex,
  mode = "bike",
  onModeChange,
  onLeaveChange,
  onDayChange,
}) => {
  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const activeDragRef = React.useRef(null);

  const travelCol = `${mode}_min`;
  const travelBackCol = `${mode}_back`;
  const travelMin =
    targetShop && targetShop[travelCol] != null ? targetShop[travelCol] : 15;
  const travelBackMin =
    targetShop && targetShop[travelBackCol] != null
      ? targetShop[travelBackCol]
      : travelMin;

  const arriveMinutes = leaveMinutes + travelMin;
  const backMinutes = arriveMinutes + 10 + travelBackMin;
  const KEYNOTE_MIN = 8 * 60 + 45; // 525 min
  const makesIt = backMinutes <= KEYNOTE_MIN;

  const targetStatus = targetShop
    ? checkIsOpen(targetShop.hours, dayIndex, arriveMinutes % 1440)
    : null;

  const R = 95;
  const CX = 135;
  const CY = 120;
  const R_LEAVE = R;
  const R_ARRIVE = R * 0.7;

  const minToAngle = (m) => {
    const frac = (((m % 1440) + 1440) % 1440) / 1440;
    return frac * 2 * Math.PI - Math.PI / 2;
  };

  const angleToMin = (angle) => {
    let shifted = angle + Math.PI / 2;
    while (shifted < 0) shifted += 2 * Math.PI;
    while (shifted >= 2 * Math.PI) shifted -= 2 * Math.PI;
    return (shifted / (2 * Math.PI)) * 1440;
  };

  const angleLeave = minToAngle(leaveMinutes);
  const angleArrive = minToAngle(arriveMinutes);
  const angleKeynote = minToAngle(KEYNOTE_MIN);
  const angleBack = minToAngle(backMinutes);

  const leavePos = {
    x: CX + R_LEAVE * Math.cos(angleLeave),
    y: CY + R_LEAVE * Math.sin(angleLeave),
  };
  const arrivePos = {
    x: CX + R_ARRIVE * Math.cos(angleArrive),
    y: CY + R_ARRIVE * Math.sin(angleArrive),
  };

  // Fixed tick for Keynote at 08:45
  const keynoteInner = {
    x: CX + (R - 10) * Math.cos(angleKeynote),
    y: CY + (R - 10) * Math.sin(angleKeynote),
  };
  const keynoteOuter = {
    x: CX + (R + 6) * Math.cos(angleKeynote),
    y: CY + (R + 6) * Math.sin(angleKeynote),
  };
  const keynoteLabel = {
    x: CX + (R + 18) * Math.cos(angleKeynote),
    y: CY + (R + 18) * Math.sin(angleKeynote),
  };

  // Hollow marker at back time
  const backMarkerPos = {
    x: CX + (R - 3) * Math.cos(angleBack),
    y: CY + (R - 3) * Math.sin(angleBack),
  };

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

  const midAngle =
    angleLeave +
    (((angleArrive - angleLeave + 2 * Math.PI) % (2 * Math.PI)) / 2);
  const wedgeLabelR = R * 0.42;
  const wedgeLabelPos = {
    x: CX + wedgeLabelR * Math.cos(midAngle),
    y: CY + wedgeLabelR * Math.sin(midAngle),
  };

  const leaveLabelR = R_LEAVE + 18;
  const leaveLabelPos = {
    x: CX + leaveLabelR * Math.cos(angleLeave),
    y: CY + leaveLabelR * Math.sin(angleLeave),
  };

  const arriveLabelR = Math.max(R_ARRIVE - 20, 26);
  const arriveLabelPos = {
    x: CX + arriveLabelR * Math.cos(angleArrive),
    y: CY + arriveLabelR * Math.sin(angleArrive),
  };

  const arcLabelText = React.useMemo(() => {
    const m = Math.round(travelMin);
    if (mode === "walk") return `${m} min on foot`;
    if (mode === "bike") return `${m} min by bike`;
    return `${m} min driving`;
  }, [travelMin, mode]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onLeaveChange(leaveMinutes - 15);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onLeaveChange(leaveMinutes + 15);
    }
  };

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
        onLeaveChange(m - travelMin);
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
        width: "290px",
        height: "560px",
        background: "#fdfbf7",
        borderLeft: "1px solid #1a1a1a",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "10px 11px",
        outline: "none",
        userSelect: "none",
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "14px",
            fontWeight: 800,
            color: "#1a1a1a",
            letterSpacing: "-0.01em",
            marginBottom: "1px",
          }}
        >
          Departure & Arrival
        </div>
        <div
          style={{
            fontSize: "10.5px",
            color: "#555",
            marginBottom: "6px",
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

        {/* 3-button mode toggle above dial */}
        <ModeToggle React={React} mode={mode} onModeChange={onModeChange} />

        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <svg
            ref={svgRef}
            width="270"
            height="240"
            style={{ overflow: "visible", cursor: "default" }}
          >
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="#f7f3ea"
              stroke="#1a1a1a"
              strokeWidth="1.5"
            />
            <circle
              cx={CX}
              cy={CY}
              r={R_ARRIVE}
              fill="none"
              stroke="#dedede"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {dialTicks.map(({ h, lx, ly }) => (
              <text
                key={h}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#888"
                fontSize="9"
                fontFamily="'Fira Code', monospace"
              >
                {h}
              </text>
            ))}

            {/* Keynote 08:45 fixed tick & label */}
            <line
              x1={keynoteInner.x}
              y1={keynoteInner.y}
              x2={keynoteOuter.x}
              y2={keynoteOuter.y}
              stroke="#c62828"
              strokeWidth="2"
            />
            <text
              x={keynoteLabel.x}
              y={keynoteLabel.y}
              textAnchor={Math.cos(angleKeynote) > 0 ? "start" : "end"}
              dominantBaseline="central"
              fill="#c62828"
              fontSize="8.5"
              fontWeight="700"
              fontFamily="'Fira Code', monospace"
            >
              keynote
            </text>

            <path
              d={wedgePath}
              fill="rgba(245, 124, 0, 0.28)"
              stroke="#e65100"
              strokeWidth="1"
              strokeDasharray="2 2"
              pointerEvents="none"
            />

            {/* Arc label reads '<n> min on foot' / 'by bike' / 'driving' */}
            <text
              x={wedgeLabelPos.x}
              y={wedgeLabelPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#b23c00"
              fontSize="8.5"
              fontWeight="700"
              fontFamily="'Fira Code', monospace"
              pointerEvents="none"
            >
              {arcLabelText}
            </text>

            {/* Hollow marker at back time */}
            <circle
              cx={backMarkerPos.x}
              cy={backMarkerPos.y}
              r="5.5"
              fill="none"
              stroke={makesIt ? "#2e7d32" : "#c62828"}
              strokeWidth="2"
              pointerEvents="none"
            />
            <circle
              cx={backMarkerPos.x}
              cy={backMarkerPos.y}
              r="2"
              fill={makesIt ? "#2e7d32" : "#c62828"}
              pointerEvents="none"
            />

            {/* Leave Hand */}
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

            {/* Arrive Hand */}
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

            <g
              transform={`translate(${arrivePos.x}, ${arrivePos.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => handlePointerDown("arrive", e)}
            >
              <circle r="14" fill="transparent" />
              <circle r="7.5" fill="#e65100" stroke="#fff" strokeWidth="2" />
            </g>

            <g
              transform={`translate(${leavePos.x}, ${leavePos.y})`}
              style={{ cursor: "grab" }}
              onPointerDown={(e) => handlePointerDown("leave", e)}
            >
              <circle r="15" fill="transparent" />
              <circle r="8.5" fill="#1a1a1a" stroke="#fff" strokeWidth="2" />
            </g>

            <circle cx={CX} cy={CY} r="4" fill="#1a1a1a" />

            <g
              transform={`translate(${leaveLabelPos.x}, ${leaveLabelPos.y})`}
              pointerEvents="none"
            >
              <rect
                x="-21"
                y="-8.5"
                width="42"
                height="17"
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
                fontSize="9"
                fontWeight="700"
                fontFamily="'Fira Code', monospace"
              >
                {formatHhMm(leaveMinutes)}
              </text>
            </g>

            <g
              transform={`translate(${arriveLabelPos.x}, ${arriveLabelPos.y})`}
              pointerEvents="none"
            >
              <rect
                x="-21"
                y="-8.5"
                width="42"
                height="17"
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
                fontSize="9"
                fontWeight="700"
                fontFamily="'Fira Code', monospace"
              >
                {formatHhMm(arriveMinutes)}
              </text>
            </g>
          </svg>
        </div>
      </div>

      <div>
        {/* Verdict Card under dial */}
        <VerdictCard
          React={React}
          leaveMinutes={leaveMinutes}
          arriveMinutes={arriveMinutes}
          backMinutes={backMinutes}
          shopName={targetShop ? targetShop.name : "Target"}
          isOpen={targetStatus}
          makesIt={makesIt}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            color: "#333",
            margin: "6px 0 4px",
            padding: "0 2px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#1a1a1a",
                display: "inline-block",
              }}
            />
            <span>Leave</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#e65100",
                display: "inline-block",
              }}
            />
            <span>Arrive</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                border: "1.5px solid #2e7d32",
                display: "inline-block",
              }}
            />
            <span>Back</span>
          </div>
          <div style={{ color: "#777", fontSize: "9.5px" }}>◀ ▶ keys</div>
        </div>

        {/* Day Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
            marginBottom: "4px",
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
                  padding: "4px 0",
                  fontFamily: "'Fira Code', monospace",
                  fontSize: "9.5px",
                  fontWeight: isSelected ? 700 : 500,
                  border: isSelected
                    ? "1px solid #1a1a1a"
                    : "1px solid #d0ceca",
                  background: isSelected ? "#1a1a1a" : "#f5f3ee",
                  color: isSelected ? "#ffffff" : "#333333",
                  borderRadius: "3px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const RegionSummaryTable = ({
  React,
  regionSummaries,
  hoveredRegionName,
  onHoverRegion,
}) => {
  if (!regionSummaries || regionSummaries.length === 0) {
    return (
      <div
        style={{
          padding: "8px 14px",
          background: "#faf7f0",
          borderTop: "1px solid #1a1a1a",
          fontSize: "11px",
          color: "#666",
          fontFamily: "'Fira Code', monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          <strong style={{ color: "#1a1a1a" }}>Lasso Regions:</strong> Hold{" "}
          <kbd
            style={{
              background: "#ebe6db",
              padding: "1px 5px",
              borderRadius: "3px",
              border: "1px solid #ccc",
              fontWeight: 700,
              color: "#111",
            }}
          >
            Shift
          </kbd>{" "}
          and drag on map to draw a custom region (A, B, C...).
        </span>
        <span style={{ fontSize: "10px", color: "#888" }}>
          Handles are draggable · Double-click a region on map to delete
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fdfbf7",
        borderTop: "1px solid #1a1a1a",
        fontFamily: "'Fira Code', monospace",
        fontSize: "11px",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
        }}
      >
        <thead>
          <tr
            style={{
              background: "#f2ece1",
              borderBottom: "1px solid #1a1a1a",
              color: "#1a1a1a",
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "11.5px",
              fontWeight: 700,
            }}
          >
            <th style={{ padding: "5px 12px", width: "110px" }}>Region</th>
            <th style={{ padding: "5px 12px", textAlign: "right" }}>n shops</th>
            <th style={{ padding: "5px 12px", textAlign: "right" }}>
              n independent
            </th>
            <th style={{ padding: "5px 12px", textAlign: "right" }}>
              n open on arrival
            </th>
            <th style={{ padding: "5px 12px", textAlign: "right" }}>
              earliest arrival
            </th>
            <th
              style={{
                padding: "5px 12px",
                textAlign: "right",
                fontSize: "9.5px",
                fontFamily: "'Fira Code', monospace",
                fontWeight: 400,
                color: "#777",
              }}
            >
              (dbl-click region on map to delete)
            </th>
          </tr>
        </thead>
        <tbody>
          {regionSummaries.map((summary) => {
            const isHovered = hoveredRegionName === summary.name;
            return (
              <tr
                key={summary.name}
                onMouseEnter={() => onHoverRegion(summary.name)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  borderBottom: "1px solid #e5dfd5",
                  background: isHovered
                    ? "rgba(245, 124, 0, 0.12)"
                    : "transparent",
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "5px 12px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "16px",
                        height: "16px",
                        borderRadius: "3px",
                        background: summary.color || "#6200ea",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "9.5px",
                      }}
                    >
                      {summary.name}
                    </span>
                    <strong style={{ color: "#1a1a1a" }}>
                      Region {summary.name}
                    </strong>
                  </div>
                </td>
                <td
                  style={{
                    padding: "5px 12px",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {summary.nShops}
                </td>
                <td
                  style={{
                    padding: "5px 12px",
                    textAlign: "right",
                    color: "#b23c00",
                    fontWeight: 600,
                  }}
                >
                  {summary.nIndependent}
                </td>
                <td
                  style={{
                    padding: "5px 12px",
                    textAlign: "right",
                    color: summary.nOpen > 0 ? "#2e7d32" : "#888",
                    fontWeight: 600,
                  }}
                >
                  {summary.nOpen}
                </td>
                <td
                  style={{
                    padding: "5px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1a1a1a",
                  }}
                >
                  {summary.earliestArrival}
                </td>
                <td
                  style={{
                    padding: "5px 12px",
                    textAlign: "right",
                    color: "#999",
                    fontSize: "9.5px",
                  }}
                >
                  {summary.vertexCount} handles
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
  injectLeafletStyles();

  const [rawReach, setRawReach] = React.useState(() => model.get("reach"));
  const [rawRoutes, setRawRoutes] = React.useState(() => model.get("routes"));
  const [rawData, setRawData] = React.useState(() => model.get("data"));

  React.useEffect(() => {
    const onReachChange = () => setRawReach(model.get("reach"));
    const onRoutesChange = () => setRawRoutes(model.get("routes"));
    const onDataChange = () => setRawData(model.get("data"));

    model.on("change:reach", onReachChange);
    model.on("change:routes", onRoutesChange);
    model.on("change:data", onDataChange);

    return () => {
      model.off("change:reach", onReachChange);
      model.off("change:routes", onRoutesChange);
      model.off("change:data", onDataChange);
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

  const [mode, setMode] = React.useState("bike");
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [targetIndex, setTargetIndex] = React.useState(2);
  const [dayIndex, setDayIndex] = React.useState(1);
  const [leaveMinutes, setLeaveMinutes] = React.useState(6 * 60 + 30);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [insideIndices, setInsideIndices] = React.useState([]);
  const [openIndices, setOpenIndices] = React.useState([]);

  const [regions, setRegions] = React.useState([]);
  const [hoveredRegionName, setHoveredRegionName] = React.useState(null);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const routePolylineRef = React.useRef(null);
  const routeLabelMarkerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const shopLabelMarkersRef = React.useRef([]);
  const isDraggingEdgeRef = React.useRef(false);
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);

  const regionLayersRef = React.useRef({});
  const lassoPreviewRef = React.useRef(null);
  const isDrawingLassoRef = React.useRef(false);
  const lassoPointsRef = React.useRef([]);
  const regionsRef = React.useRef(regions);
  regionsRef.current = regions;

  const leaveMinutesRef = React.useRef(leaveMinutes);
  leaveMinutesRef.current = leaveMinutes;
  const dayIndexRef = React.useRef(dayIndex);
  dayIndexRef.current = dayIndex;
  const targetIndexRef = React.useRef(targetIndex);
  targetIndexRef.current = targetIndex;
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  const dataRef = React.useRef(data);
  dataRef.current = data;

  const REGION_PALETTE = [
    { color: "#6200ea", fill: "rgba(98, 0, 234, 0.16)" },
    { color: "#00796b", fill: "rgba(0, 121, 107, 0.16)" },
    { color: "#c2185b", fill: "rgba(194, 24, 91, 0.16)" },
    { color: "#00838f", fill: "rgba(0, 131, 143, 0.16)" },
    { color: "#e65100", fill: "rgba(230, 81, 0, 0.16)" },
    { color: "#2e7d32", fill: "rgba(46, 125, 50, 0.16)" },
    { color: "#4527a0", fill: "rgba(69, 39, 160, 0.16)" },
  ];

  const computeRegionsTrait = React.useCallback(
    (regs) => {
      const traitObj = {};
      const curData = dataRef.current;
      regs.forEach((reg) => {
        const matchingIndices = [];
        const vs = reg.latlngs;
        if (vs && vs.length >= 3) {
          curData.forEach((row, idx) => {
            if (row.lat == null || row.lon == null) return;
            if (pointInPolygon([row.lat, row.lon], vs)) {
              matchingIndices.push(idx);
            }
          });
        }
        traitObj[reg.name] = matchingIndices;
      });
      return traitObj;
    },
    []
  );

  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    const deltaLon =
      rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

  const updateReachBands = React.useCallback(
    (curMode) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      if (reachLayerRef.current) {
        reachLayerRef.current.remove();
        reachLayerRef.current = null;
      }
      const curReach = rawReach && rawReach[curMode] ? rawReach[curMode] : null;
      if (curReach) {
        const reachLayer = L.geoJSON(curReach, {
          style: (feature) => {
            const contour =
              feature.properties && feature.properties.contour != null
                ? feature.properties.contour
                : 30;
            let fillOpacity = 0.14;
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
    },
    [rawReach]
  );

  const updateStreetRoute = React.useCallback(
    (curMode, curTargetIdx) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      if (routeLabelMarkerRef.current) {
        routeLabelMarkerRef.current.remove();
        routeLabelMarkerRef.current = null;
      }

      if (!rawRoutes || !rawRoutes[curMode]) return;
      const modeRoutes = rawRoutes[curMode];
      const routeCoords = modeRoutes[curTargetIdx];
      if (!routeCoords || !Array.isArray(routeCoords) || routeCoords.length === 0) {
        return;
      }

      const polyline = L.polyline(routeCoords, {
        color: "#ff6f00",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        zIndexOffset: 800,
        interactive: false,
      }).addTo(map);
      polyline.bringToFront();
      routePolylineRef.current = polyline;

      const midIdx = Math.floor(routeCoords.length / 2);
      const midPoint = routeCoords[midIdx] || routeCoords[0];

      const curData = dataRef.current;
      const targetRow = curData[curTargetIdx];
      const travelCol = `${curMode}_min`;
      const minutesThere =
        targetRow && targetRow[travelCol] != null
          ? Math.round(targetRow[travelCol])
          : 0;

      const labelHtml = `
        <div style="
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
        ">
          <div style="
            background: #1a1a1a;
            color: #ffffff;
            border: 1.5px solid #ff9800;
            padding: 1px 6px;
            border-radius: 10px;
            font-family: 'Fira Code', monospace;
            font-size: 9.5px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.35);
          ">
            ${minutesThere} min
          </div>
        </div>
      `;
      const labelIcon = L.divIcon({
        className: "route-mid-label",
        html: labelHtml,
        iconSize: [0, 0],
      });

      const labelMarker = L.marker(midPoint, {
        icon: labelIcon,
        zIndexOffset: 1400,
        interactive: false,
      }).addTo(map);
      routeLabelMarkerRef.current = labelMarker;
    },
    [rawRoutes]
  );

  const updateDotsAndLabels = React.useCallback(() => {
    const rKm = currentRadiusRef.current;
    const lMin = leaveMinutesRef.current;
    const dIdx = dayIndexRef.current;
    const tIdx = targetIndexRef.current;
    const curMode = modeRef.current;
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);

    const insideArr = [];
    const openArr = [];

    const travelCol = `${curMode}_min`;
    const travelBackCol = `${curMode}_back`;

    shopMarkersRef.current.forEach(({ marker, row, index }) => {
      const distM = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
      const isInside = distM <= rKm * 1000;
      const isTarget = index === tIdx;

      const travelThere = row[travelCol] != null ? row[travelCol] : 0;
      const arrivalMin = lMin + travelThere;
      const isOpen = checkIsOpen(row.hours, dIdx, arrivalMin % 1440);

      if (isInside) {
        insideArr.push(index);
        if (isOpen === true) {
          openArr.push(index);
        }
      }

      let strokeColor = "#1a1a1a";
      let fillColor = row.chain ? "#616161" : "#f57c00";
      let fillOpacity = 0.95;
      let strokeWidth = isTarget ? 3.5 : 1.5;
      let dashArray = null;

      if (!isInside) {
        fillColor = row.chain ? "#9e9e9e" : "#ffb74d";
        strokeColor = "#888";
        strokeWidth = isTarget ? 3 : 1;
        fillOpacity = 0.25;
      } else {
        if (isOpen === true) {
          fillColor = "#2e7d32";
          strokeColor = isTarget ? "#ff3d00" : "#1b5e20";
          fillOpacity = 0.95;
        } else if (isOpen === false) {
          fillColor = "#ffffff";
          strokeColor = isTarget ? "#ff3d00" : "#c62828";
          strokeWidth = isTarget ? 4 : 2.2;
          fillOpacity = 0.05;
        } else {
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

    const targetRow = dataRef.current[tIdx];
    const targetThere =
      targetRow && targetRow[travelCol] != null ? targetRow[travelCol] : 15;
    const targetBack =
      targetRow && targetRow[travelBackCol] != null
        ? targetRow[travelBackCol]
        : targetThere;
    const totalBackMin = lMin + targetThere + 10 + targetBack;
    const backHhMm = formatHhMm(totalBackMin);
    const makesItVal = totalBackMin <= 8 * 60 + 45;

    model.set("inside", insideArr);
    model.set("radius_km", Number(rKm.toFixed(3)));
    model.set("open_on_arrival", openArr);
    model.set("when", { day: dIdx, hhmm: formatHhMm(lMin) });
    model.set("target", tIdx);
    model.set("mode", curMode);
    model.set("back_hhmm", backHhMm);
    model.set("makes_it", makesItVal);
    model.save_changes();
  }, [model]);

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

      updateDotsAndLabels();
    },
    [getEdgeLatLng, updateDotsAndLabels]
  );

  const handleModeChange = React.useCallback(
    (newMode) => {
      modeRef.current = newMode;
      setMode(newMode);
      updateReachBands(newMode);
      updateStreetRoute(newMode, targetIndexRef.current);
      updateDotsAndLabels();
    },
    [updateReachBands, updateStreetRoute, updateDotsAndLabels]
  );

  const deleteRegion = React.useCallback(
    (regionName) => {
      setRegions((prev) => {
        const next = prev.filter((r) => r.name !== regionName);
        const traitObj = computeRegionsTrait(next);
        model.set("regions", traitObj);
        model.save_changes();
        return next;
      });
    },
    [computeRegionsTrait, model]
  );

  const handleVertexChange = React.useCallback(
    (regionName, vIndex, newLatLng) => {
      setRegions((prev) => {
        const next = prev.map((reg) => {
          if (reg.name !== regionName) return reg;
          const newPts = [...reg.latlngs];
          newPts[vIndex] = [newLatLng.lat, newLatLng.lng];
          return { ...reg, latlngs: newPts };
        });
        const traitObj = computeRegionsTrait(next);
        model.set("regions", traitObj);
        model.save_changes();
        return next;
      });
    },
    [computeRegionsTrait, model]
  );

  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [HOTEL_LAT, HOTEL_LON],
      zoom: 12,
      zoomControl: false,
      boxZoom: false,
      doubleClickZoom: false,
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    updateReachBands(modeRef.current);

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

    const circleHit = L.circle([HOTEL_LAT, HOTEL_LON], {
      radius: INITIAL_RADIUS * 1000,
      color: "#ff3d00",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
    }).addTo(map);
    circleHitRef.current = circleHit;

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

    const mapEl = mapContainerRef.current;

    const onLassoMove = (e) => {
      if (!isDrawingLassoRef.current) return;
      const rect = mapEl.getBoundingClientRect();
      const pt = map.containerPointToLatLng(
        L.point(e.clientX - rect.left, e.clientY - rect.top)
      );
      const pts = lassoPointsRef.current;
      const last = pts[pts.length - 1];

      if (last) {
        const p1 = map.latLngToContainerPoint(L.latLng(last[0], last[1]));
        const p2 = L.point(e.clientX - rect.left, e.clientY - rect.top);
        if (p1.distanceTo(p2) < 8) return;
      }

      pts.push([pt.lat, pt.lng]);

      if (!lassoPreviewRef.current) {
        lassoPreviewRef.current = L.polyline(pts, {
          color: "#6200ea",
          weight: 2.5,
          dashArray: "4, 4",
          opacity: 0.9,
        }).addTo(map);
      } else {
        lassoPreviewRef.current.setLatLngs(pts);
      }
    };

    const onLassoUp = () => {
      if (!isDrawingLassoRef.current) return;
      isDrawingLassoRef.current = false;
      map.dragging.enable();

      window.removeEventListener("mousemove", onLassoMove);
      window.removeEventListener("mouseup", onLassoUp);

      if (lassoPreviewRef.current) {
        lassoPreviewRef.current.remove();
        lassoPreviewRef.current = null;
      }

      const rawPts = lassoPointsRef.current;
      lassoPointsRef.current = [];

      if (rawPts.length >= 3) {
        const simplified = [rawPts[0]];
        let prevPix = map.latLngToContainerPoint(L.latLng(rawPts[0][0], rawPts[0][1]));
        for (let i = 1; i < rawPts.length - 1; i++) {
          const curPix = map.latLngToContainerPoint(
            L.latLng(rawPts[i][0], rawPts[i][1])
          );
          if (curPix.distanceTo(prevPix) >= 20) {
            simplified.push(rawPts[i]);
            prevPix = curPix;
          }
        }
        simplified.push(rawPts[rawPts.length - 1]);

        if (simplified.length >= 3) {
          const existingNames = new Set(regionsRef.current.map((r) => r.name));
          let nextLetter = "A";
          for (let code = 65; code <= 90; code++) {
            const letter = String.fromCharCode(code);
            if (!existingNames.has(letter)) {
              nextLetter = letter;
              break;
            }
          }

          const paletteIdx =
            (nextLetter.charCodeAt(0) - 65) % REGION_PALETTE.length;
          const pal = REGION_PALETTE[paletteIdx];

          const newRegion = {
            id: `region_${Date.now()}_${Math.random()}`,
            name: nextLetter,
            color: pal.color,
            fill: pal.fill,
            latlngs: simplified,
          };

          setRegions((prev) => {
            const next = [...prev, newRegion];
            const traitObj = computeRegionsTrait(next);
            model.set("regions", traitObj);
            model.save_changes();
            return next;
          });
        }
      }
    };

    const onCaptureMouseDown = (e) => {
      if (e.shiftKey && e.button === 0) {
        e.stopPropagation();
        e.preventDefault();
        isDrawingLassoRef.current = true;
        map.dragging.disable();

        const rect = mapEl.getBoundingClientRect();
        const pt = map.containerPointToLatLng(
          L.point(e.clientX - rect.left, e.clientY - rect.top)
        );
        lassoPointsRef.current = [[pt.lat, pt.lng]];

        window.addEventListener("mousemove", onLassoMove);
        window.addEventListener("mouseup", onLassoUp);
      }
    };

    mapEl.addEventListener("mousedown", onCaptureMouseDown, true);

    updateStreetRoute(modeRef.current, targetIndexRef.current);

    return () => {
      mapEl.removeEventListener("mousedown", onCaptureMouseDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mousemove", onLassoMove);
      window.removeEventListener("mouseup", onLassoUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    updateReachBands(mode);
  }, [mode, updateReachBands]);

  React.useEffect(() => {
    updateStreetRoute(mode, targetIndex);
  }, [mode, targetIndex, updateStreetRoute]);

  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(regionLayersRef.current).forEach(
      ({ polygon, handleMarkers, badgeMarker }) => {
        if (polygon) polygon.remove();
        if (badgeMarker) badgeMarker.remove();
        handleMarkers.forEach((m) => m.remove());
      }
    );
    regionLayersRef.current = {};

    regions.forEach((reg) => {
      const isHovered = hoveredRegionName === reg.name;

      const polygon = L.polygon(reg.latlngs, {
        color: reg.color,
        weight: isHovered ? 3.5 : 2.2,
        fillColor: reg.color,
        fillOpacity: isHovered ? 0.32 : 0.16,
        dashArray: isHovered ? null : "4, 4",
        interactive: true,
      }).addTo(map);

      polygon.on("dblclick", (e) => {
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e.originalEvent);
          L.DomEvent.preventDefault(e.originalEvent);
        }
        deleteRegion(reg.name);
      });

      const firstPt = reg.latlngs[0];
      const badgeHtml = `
        <div style="transform: translate(-50%, -120%); pointer-events: none; user-select: none;">
          <span style="
            background: ${reg.color};
            color: #ffffff;
            font-family: 'Fira Code', monospace;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 3px;
            border: 1px solid #ffffff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.35);
          ">${reg.name}</span>
        </div>
      `;
      const badgeIcon = L.divIcon({
        className: `region-badge-${reg.name}`,
        html: badgeHtml,
        iconSize: [0, 0],
      });
      const badgeMarker = L.marker(firstPt, {
        icon: badgeIcon,
        zIndexOffset: 1100,
        interactive: false,
      }).addTo(map);

      const handleMarkers = reg.latlngs.map((pt, vIndex) => {
        const handleHtml = `
          <div style="
            width: 9px;
            height: 9px;
            background: #ffffff;
            border: 2px solid ${reg.color};
            border-radius: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 1px 3px rgba(0,0,0,0.45);
            cursor: move;
          "></div>
        `;
        const handleIcon = L.divIcon({
          className: `vertex-handle-${reg.name}-${vIndex}`,
          html: handleHtml,
          iconSize: [0, 0],
        });

        const handle = L.marker(pt, {
          icon: handleIcon,
          draggable: true,
          zIndexOffset: 1300,
        }).addTo(map);

        handle.on("drag", (e) => {
          const newPos = e.target.getLatLng();
          const currentPts = [...reg.latlngs];
          currentPts[vIndex] = [newPos.lat, newPos.lng];
          polygon.setLatLngs(currentPts);
          if (vIndex === 0 && badgeMarker) {
            badgeMarker.setLatLng(newPos);
          }
        });

        handle.on("dragend", (e) => {
          const newPos = e.target.getLatLng();
          handleVertexChange(reg.name, vIndex, newPos);
        });

        return handle;
      });

      regionLayersRef.current[reg.name] = {
        polygon,
        handleMarkers,
        badgeMarker,
      };
    });
  }, [regions, hoveredRegionName, deleteRegion, handleVertexChange]);

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
        updateStreetRoute(modeRef.current, idx);
        updateDotsAndLabels();
      });

      newMarkers.push({ marker, row, index: idx });

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
  }, [data, updateDotsAndLabels, updateStreetRoute]);

  const handleLeaveChange = React.useCallback(
    (newMinutes) => {
      const norm = ((Math.round(newMinutes) % 1440) + 1440) % 1440;
      leaveMinutesRef.current = norm;
      setLeaveMinutes(norm);
      updateDotsAndLabels();
    },
    [updateDotsAndLabels]
  );

  const handleDayChange = React.useCallback(
    (newDay) => {
      dayIndexRef.current = newDay;
      setDayIndex(newDay);
      updateDotsAndLabels();
    },
    [updateDotsAndLabels]
  );

  const targetedShop = data[targetIndex] || data[2] || null;

  const insideCount = insideIndices.length;
  const independentCount = React.useMemo(() => {
    let cnt = 0;
    insideIndices.forEach((idx) => {
      if (data[idx] && !data[idx].chain) cnt++;
    });
    return cnt;
  }, [insideIndices, data]);
  const openCount = openIndices.length;

  const regionSummaries = React.useMemo(() => {
    const travelCol = `${mode}_min`;
    return regions.map((reg) => {
      let nShops = 0;
      let nIndependent = 0;
      let nOpen = 0;
      let minArrivalMin = Infinity;

      data.forEach((row) => {
        if (row.lat == null || row.lon == null) return;
        if (pointInPolygon([row.lat, row.lon], reg.latlngs)) {
          nShops++;
          if (!row.chain) nIndependent++;

          const travelThere = row[travelCol] != null ? row[travelCol] : 0;
          const arrivalMin = leaveMinutes + travelThere;
          const isOpen = checkIsOpen(row.hours, dayIndex, arrivalMin % 1440);
          if (isOpen === true) nOpen++;

          if (arrivalMin < minArrivalMin) {
            minArrivalMin = arrivalMin;
          }
        }
      });

      const earliestArrival =
        minArrivalMin !== Infinity ? formatHhMm(minArrivalMin) : "—";

      return {
        name: reg.name,
        color: reg.color,
        vertexCount: reg.latlngs.length,
        nShops,
        nIndependent,
        nOpen,
        earliestArrival,
      };
    });
  }, [regions, data, leaveMinutes, dayIndex, mode]);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 14px",
          background: "#fdfbf7",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "17px",
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            Houston Donut Reach & Keynote Dial
          </h2>
          <span
            style={{
              fontSize: "10.5px",
              color: "#666",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Shift+Drag for lasso · Drag edge or hands · Click shop to target
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "10.5px",
            color: "#333",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 14,
                height: 4,
                background: "#ff6f00",
                display: "inline-block",
                borderRadius: "2px",
              }}
            />
            <span>Route</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#2e7d32",
                display: "inline-block",
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
                background: "#fff",
                display: "inline-block",
                border: "2px solid #c62828",
              }}
            />
            <span>Closed</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: "560px",
          background: "#eae7dc",
          position: "relative",
        }}
      >
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

          <StatusBadge
            insideCount={insideCount}
            independentCount={independentCount}
            openCount={openCount}
          />

          <ShopInspector
            shop={hoveredShop || targetedShop}
            leaveMinutes={leaveMinutes}
            dayIndex={dayIndex}
            mode={mode}
          />
        </div>

        <ClockDialPanel
          React={React}
          leaveMinutes={leaveMinutes}
          targetShop={targetedShop}
          dayIndex={dayIndex}
          mode={mode}
          onModeChange={handleModeChange}
          onLeaveChange={handleLeaveChange}
          onDayChange={handleDayChange}
        />
      </div>

      <RegionSummaryTable
        React={React}
        regionSummaries={regionSummaries}
        hoveredRegionName={hoveredRegionName}
        onHoverRegion={setHoveredRegionName}
      />
    </div>
  );
}