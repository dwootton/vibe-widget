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

function parseHHMMToMinutes(hhmm) {
  if (!hhmm) return 0;
  const parts = hhmm.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatMinutesToHHMM(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function pointInPolygon(point, vs) {
  const x = point[1];
  const y = point[0];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1];
    const yi = vs[i][0];
    const xj = vs[j][1];
    const yj = vs[j][0];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function downsamplePoints(pts, minPixelDist = 18, map) {
  if (pts.length <= 4) return pts;
  const sampled = [pts[0]];
  let lastPt = map.latLngToContainerPoint(pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const curPt = map.latLngToContainerPoint(pts[i]);
    const dist = Math.hypot(curPt.x - lastPt.x, curPt.y - lastPt.y);
    if (dist >= minPixelDist) {
      sampled.push(pts[i]);
      lastPt = curPt;
    }
  }
  sampled.push(pts[pts.length - 1]);
  return sampled;
}

function isOpenAt(hoursStr, dayIndex, timeMinutes) {
  if (!hoursStr || !hoursStr.trim()) return "unknown";
  const str = hoursStr.trim();
  if (str === "24/7") return "open";

  const dayNames = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const targetDay = dayNames[dayIndex];

  const rules = str.split(";").map((r) => r.trim()).filter(Boolean);
  let hasSpecificDayRule = false;
  let matchesDay = false;
  let openStatus = false;

  for (const rule of rules) {
    const parts = rule.split(/\s+/);
    if (parts.length === 1 && parts[0].includes("-") && parts[0].includes(":")) {
      const [start, end] = parts[0].split("-");
      const startMin = parseHHMMToMinutes(start);
      let endMin = parseHHMMToMinutes(end);
      if (endMin <= startMin) endMin += 1440;
      let checkMin = timeMinutes;
      if (checkMin < startMin && timeMinutes + 1440 <= endMin) checkMin += 1440;
      if (checkMin >= startMin && checkMin < endMin) return "open";
      return "closed";
    }

    if (parts.length >= 2) {
      const daysPart = parts[0];
      const timePart = parts[1];

      let inRule = false;
      const subRanges = daysPart.split(",");
      for (const sr of subRanges) {
        if (sr.includes("-")) {
          const [d1, d2] = sr.split("-");
          const idx1 = dayNames.indexOf(d1);
          const idx2 = dayNames.indexOf(d2);
          if (idx1 !== -1 && idx2 !== -1) {
            if (idx1 <= idx2) {
              if (dayIndex >= idx1 && dayIndex <= idx2) inRule = true;
            } else {
              if (dayIndex >= idx1 || dayIndex <= idx2) inRule = true;
            }
          }
        } else if (sr === targetDay) {
          inRule = true;
        }
      }

      if (inRule) {
        hasSpecificDayRule = true;
        matchesDay = true;
        const [start, end] = timePart.split("-");
        const startMin = parseHHMMToMinutes(start);
        let endMin = parseHHMMToMinutes(end);
        if (endMin <= startMin) endMin += 1440;
        let checkMin = timeMinutes;
        if (checkMin < startMin && timeMinutes + 1440 <= endMin) checkMin += 1440;
        if (checkMin >= startMin && checkMin < endMin) {
          openStatus = true;
          break;
        }
      }
    }
  }

  if (matchesDay) {
    return openStatus ? "open" : "closed";
  }
  if (hasSpecificDayRule) {
    return "closed";
  }
  return "unknown";
}

export const ModeSwitch = ({ React, mode, onChange }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginBottom: 8,
      fontSize: 12,
      fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
      color: GREY_COLOR,
      userSelect: "none",
    }}
  >
    {MODES.map((m, idx) => {
      const active = mode === m;
      return (
        <React.Fragment key={m}>
          <button
            onClick={() => onChange(m)}
            style={{
              padding: "2px 8px",
              fontSize: 11,
              fontFamily: "inherit",
              border: `1px solid ${active ? INK_COLOR : HAIRLINE_COLOR}`,
              backgroundColor: active ? INK_COLOR : "#ffffff",
              color: active ? "#ffffff" : INK_COLOR,
              cursor: "pointer",
              boxSizing: "border-box",
              lineHeight: "16px",
            }}
          >
            {m}
          </button>
          {idx < MODES.length - 1 && <span style={{ color: HAIRLINE_COLOR }}>·</span>}
        </React.Fragment>
      );
    })}
  </div>
);

export const VerdictLines = ({
  React,
  leaveMins,
  backByMins,
  targetShop,
  mode,
  dayIndex,
}) => {
  if (!targetShop) {
    return (
      <div
        style={{
          width: "100%",
          padding: "6px 4px",
          boxSizing: "border-box",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          fontSize: 11,
          color: GREY_COLOR,
          textAlign: "center",
        }}
      >
        select a shop
      </div>
    );
  }

  const minCol = `${mode}_min`;
  const backCol = `${mode}_back`;
  const mMin = targetShop[minCol] != null ? targetShop[minCol] : 0;
  const mBack = targetShop[backCol] != null ? targetShop[backCol] : mMin;

  const arrMin = leaveMins + mMin;
  const backMin = arrMin + 10 + mBack;
  const status = isOpenAt(targetShop.hours, dayIndex, arrMin);

  const diffMins = backMin - backByMins;
  const makesIt = diffMins <= 0;
  const absDiff = Math.abs(diffMins);

  const shopNameLower = (targetShop.name || "").toLowerCase();
  const line1 = `${formatMinutesToHHMM(leaveMins)} → ${shopNameLower} ${formatMinutesToHHMM(
    arrMin
  )}, ${status} · 10 min · back ${formatMinutesToHHMM(backMin)}`;

  const line2 = makesIt
    ? `${absDiff} min before ${formatMinutesToHHMM(backByMins)}`
    : `${absDiff} min after ${formatMinutesToHHMM(backByMins)}`;

  return (
    <div
      style={{
        width: "100%",
        padding: "6px 6px 2px 6px",
        boxSizing: "border-box",
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: 11,
        lineHeight: "16px",
        textAlign: "left",
        wordBreak: "break-word",
        whiteSpace: "normal",
      }}
    >
      <div style={{ color: INK_COLOR, marginBottom: 3 }}>{line1}</div>
      <div
        style={{
          color: makesIt ? OPEN_COLOR : CLOSED_COLOR,
          fontWeight: 600,
        }}
      >
        {line2}
      </div>
    </div>
  );
};

export const CountLine = ({ insideCount, independentCount, openAndBackCount }) => (
  <div
    style={{
      position: "absolute",
      top: 12,
      left: 12,
      zIndex: 1000,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    <span style={{ fontWeight: 600 }}>{openAndBackCount}</span> open and back in time
  </div>
);

export const TooltipOverlay = ({ hoveredShop }) => {
  if (!hoveredShop) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 12,
        zIndex: 1000,
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        padding: "7px 11px",
        border: `1px solid ${HAIRLINE_COLOR}`,
        fontSize: 12,
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        color: INK_COLOR,
        maxWidth: 300,
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
  React,
  leaveMins,
  backMins,
  targetShop,
  mode,
  onLeaveChange,
  onBackChange,
  onNudge,
}) => {
  const svgRef = React.useRef(null);
  const activeHandleRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  const cx = 140;
  const cy = 135;
  const rRim = 84;
  const rLeave = rRim;
  const rBack = rRim + 14;

  const minsToAngle = (m) => {
    const hours12 = (m % 720) / 60;
    return (hours12 / 12) * 2 * Math.PI - Math.PI / 2;
  };

  const angleLeave = minsToAngle(leaveMins);
  const angleBack = minsToAngle(backMins);

  const lx = cx + rLeave * Math.cos(angleLeave);
  const ly = cy + rLeave * Math.sin(angleLeave);
  const bx = cx + rBack * Math.cos(angleBack);
  const by = cy + rBack * Math.sin(angleBack);

  const wedgeDuration = Math.max(0, Math.min(720, backMins - leaveMins));
  const wedgeSweepAngle = (wedgeDuration / 720) * 2 * Math.PI;
  const wedgeLargeArc = wedgeSweepAngle > Math.PI ? 1 : 0;
  const wEndX = cx + rRim * Math.cos(angleLeave + wedgeSweepAngle);
  const wEndY = cy + rRim * Math.sin(angleLeave + wedgeSweepAngle);
  const wedgePath =
    wedgeDuration > 0 && wedgeDuration < 720
      ? `M ${cx} ${cy} L ${cx + rRim * Math.cos(angleLeave)} ${cy + rRim * Math.sin(angleLeave)} A ${rRim} ${rRim} 0 ${wedgeLargeArc} 1 ${wEndX} ${wEndY} Z`
      : "";

  const rTrip = rRim - 7;
  let tripArcNormal = null;
  let tripArcRed = null;
  let arrTick = null;
  let arrLabel = null;
  let backRimTick = null;

  const minCol = `${mode}_min`;
  const backCol = `${mode}_back`;

  if (targetShop && targetShop[minCol] != null) {
    const mMin = targetShop[minCol];
    const mBack = targetShop[backCol] != null ? targetShop[backCol] : mMin;
    const totalTripMin = mMin + 10 + mBack;
    const arrTimeMins = leaveMins + mMin;
    const tripEndMins = leaveMins + totalTripMin;

    const arrAngle = minsToAngle(arrTimeMins);
    arrTick = {
      x1: cx + (rTrip - 4) * Math.cos(arrAngle),
      y1: cy + (rTrip - 4) * Math.sin(arrAngle),
      x2: cx + (rTrip + 4) * Math.cos(arrAngle),
      y2: cy + (rTrip + 4) * Math.sin(arrAngle),
    };

    const labelR = rTrip - 16;
    arrLabel = {
      x: cx + labelR * Math.cos(arrAngle),
      y: cy + labelR * Math.sin(arrAngle),
      text: formatMinutesToHHMM(arrTimeMins),
    };

    // Hollow tick on the rim at the back time
    const backAngle = minsToAngle(tripEndMins);
    backRimTick = {
      cx: cx + rRim * Math.cos(backAngle),
      cy: cy + rRim * Math.sin(backAngle),
    };

    const normalEndMins = Math.min(tripEndMins, Math.max(leaveMins, backMins));
    const normalDur = Math.max(0, normalEndMins - leaveMins);
    if (normalDur > 0) {
      const sweep = (normalDur / 720) * 2 * Math.PI;
      const arcLarge = sweep > Math.PI ? 1 : 0;
      const sx = cx + rTrip * Math.cos(angleLeave);
      const sy = cy + rTrip * Math.sin(angleLeave);
      const ex = cx + rTrip * Math.cos(angleLeave + sweep);
      const ey = cy + rTrip * Math.sin(angleLeave + sweep);
      tripArcNormal = `M ${sx} ${sy} A ${rTrip} ${rTrip} 0 ${arcLarge} 1 ${ex} ${ey}`;
    }

    if (tripEndMins > backMins && tripEndMins > leaveMins) {
      const redStartMins = Math.max(leaveMins, backMins);
      const redDur = tripEndMins - redStartMins;
      const startAng = minsToAngle(redStartMins);
      const sweep = (redDur / 720) * 2 * Math.PI;
      const arcLarge = sweep > Math.PI ? 1 : 0;
      const sx = cx + rTrip * Math.cos(startAng);
      const sy = cy + rTrip * Math.sin(startAng);
      const ex = cx + rTrip * Math.cos(startAng + sweep);
      const ey = cy + rTrip * Math.sin(startAng + sweep);
      tripArcRed = `M ${sx} ${sy} A ${rTrip} ${rTrip} 0 ${arcLarge} 1 ${ex} ${ey}`;
    }
  }

  const handlePointerDown = (e) => {
    if (!svgRef.current) return;
    svgRef.current.focus();
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dLeave = Math.hypot(px - lx, py - ly);
    const dBack = Math.hypot(px - bx, py - by);

    let chosen = null;
    if (Math.min(dLeave, dBack) <= 20) {
      chosen = dLeave <= dBack ? "leave" : "back";
    } else {
      const dCenter = Math.hypot(px - cx, py - cy);
      if (Math.abs(dCenter - rLeave) < Math.abs(dCenter - rBack)) {
        chosen = "leave";
      } else {
        chosen = "back";
      }
    }

    activeHandleRef.current = chosen;
    isDraggingRef.current = true;
    e.preventDefault();

    const onPointerMove = (ev) => {
      if (!isDraggingRef.current || !svgRef.current) return;
      const r = svgRef.current.getBoundingClientRect();
      const x = ev.clientX - r.left - cx;
      const y = ev.clientY - r.top - cy;
      let angle = Math.atan2(y, x) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;

      let totalMins = (angle / (2 * Math.PI)) * 720;
      totalMins = Math.round(totalMins / 5) * 5;

      if (activeHandleRef.current === "leave") {
        const baseHour = leaveMins >= 720 ? 720 : 0;
        let candidate = baseHour + (totalMins % 720);
        if (Math.abs(candidate - leaveMins) > 360) {
          candidate = candidate >= 720 ? candidate - 720 : candidate + 720;
        }
        onLeaveChange(((candidate % 1440) + 1440) % 1440);
      } else {
        const baseHour = backMins >= 720 ? 720 : 0;
        let candidate = baseHour + (totalMins % 720);
        if (Math.abs(candidate - backMins) > 360) {
          candidate = candidate >= 720 ? candidate - 720 : candidate + 720;
        }
        onBackChange(((candidate % 1440) + 1440) % 1440);
      }
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNudge(activeHandleRef.current || "leave", -15);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNudge(activeHandleRef.current || "leave", 15);
    }
  };

  const leaveLabelR = rLeave + 20;
  const backLabelR = rBack + 22;
  const leaveLabelPos = {
    x: cx + leaveLabelR * Math.cos(angleLeave),
    y: cy + leaveLabelR * Math.sin(angleLeave),
  };
  const backLabelPos = {
    x: cx + backLabelR * Math.cos(angleBack),
    y: cy + backLabelR * Math.sin(angleBack),
  };

  return (
    <svg
      ref={svgRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      width={280}
      height={265}
      style={{
        outline: "none",
        cursor: "pointer",
        display: "block",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <circle cx={cx} cy={cy} r={rRim} fill="none" stroke={HAIRLINE_COLOR} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={rBack} fill="none" stroke="#f0f0f0" strokeWidth={1} />

      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
        const isMajor = i % 3 === 0;
        const len = isMajor ? 6 : 3;
        const x1 = cx + (rRim - len) * Math.cos(angle);
        const y1 = cy + (rRim - len) * Math.sin(angle);
        const x2 = cx + rRim * Math.cos(angle);
        const y2 = cy + rRim * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isMajor ? INK_COLOR : GREY_COLOR}
            strokeWidth={1}
          />
        );
      })}

      <text
        x={cx}
        y={cy - rRim + 15}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GREY_COLOR}
        style={{
          fontSize: 10,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        12
      </text>
      <text
        x={cx + rRim - 13}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GREY_COLOR}
        style={{
          fontSize: 10,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        3
      </text>
      <text
        x={cx}
        y={cy + rRim - 13}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GREY_COLOR}
        style={{
          fontSize: 10,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        6
      </text>
      <text
        x={cx - rRim + 13}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GREY_COLOR}
        style={{
          fontSize: 10,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        9
      </text>

      {wedgePath && <path d={wedgePath} fill="#f4f4f4" opacity={0.7} />}

      {tripArcNormal && (
        <path d={tripArcNormal} fill="none" stroke={INK_COLOR} strokeWidth={2} />
      )}
      {tripArcRed && (
        <path d={tripArcRed} fill="none" stroke={CLOSED_COLOR} strokeWidth={2} />
      )}
      {arrTick && (
        <line
          x1={arrTick.x1}
          y1={arrTick.y1}
          x2={arrTick.x2}
          y2={arrTick.y2}
          stroke={INK_COLOR}
          strokeWidth={1.5}
        />
      )}
      {backRimTick && (
        <circle
          cx={backRimTick.cx}
          cy={backRimTick.cy}
          r={3.5}
          fill="#ffffff"
          stroke={INK_COLOR}
          strokeWidth={1.5}
        />
      )}
      {arrLabel && (
        <text
          x={arrLabel.x}
          y={arrLabel.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={INK_COLOR}
          style={{
            fontSize: 9,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          }}
        >
          {arrLabel.text}
        </text>
      )}

      {/* Leave handle */}
      <circle cx={lx} cy={ly} r={14} fill="transparent" />
      <circle cx={lx} cy={ly} r={5} fill={INK_COLOR} stroke="#ffffff" strokeWidth={1.5} />
      <text
        x={leaveLabelPos.x}
        y={leaveLabelPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={INK_COLOR}
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        {formatMinutesToHHMM(leaveMins)}
      </text>

      {/* Back by handle */}
      <circle cx={bx} cy={by} r={14} fill="transparent" />
      <circle cx={bx} cy={by} r={5} fill={ACCENT_COLOR} stroke="#ffffff" strokeWidth={1.5} />
      <text
        x={backLabelPos.x}
        y={backLabelPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={ACCENT_COLOR}
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        }}
      >
        {formatMinutesToHHMM(backMins)}
      </text>
    </svg>
  );
};

export const DayPicker = ({ activeDay, onChange }) => (
  <div
    style={{
      display: "flex",
      gap: 3,
      justifyContent: "center",
      marginTop: 8,
    }}
  >
    {DAYS.map((d, idx) => {
      const active = activeDay === idx;
      return (
        <button
          key={d}
          onClick={() => onChange(idx)}
          style={{
            width: 28,
            height: 24,
            padding: 0,
            fontSize: 11,
            lineHeight: "22px",
            fontFamily: "system-ui, -apple-system, Inter, sans-serif",
            border: `1px solid ${active ? INK_COLOR : HAIRLINE_COLOR}`,
            backgroundColor: active ? INK_COLOR : "#ffffff",
            color: active ? "#ffffff" : INK_COLOR,
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          {d}
        </button>
      );
    })}
  </div>
);

export const RegionTable = ({
  React,
  regions,
  hoveredRegionName,
  onHoverRegion,
}) => {
  if (!regions || regions.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          padding: "10px 14px",
          borderTop: `1px solid ${HAIRLINE_COLOR}`,
          fontSize: 11,
          fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
          color: GREY_COLOR,
          boxSizing: "border-box",
        }}
      >
        no regions
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        borderTop: `1px solid ${HAIRLINE_COLOR}`,
        backgroundColor: "#ffffff",
        overflowX: "auto",
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
              fontWeight: 400,
              textAlign: "right",
              height: 28,
            }}
          >
            <th style={{ textAlign: "left", padding: "0 12px", fontWeight: 400 }}>region</th>
            <th style={{ padding: "0 12px", fontWeight: 400 }}>shops</th>
            <th style={{ padding: "0 12px", fontWeight: 400 }}>independent</th>
            <th style={{ padding: "0 12px", fontWeight: 400 }}>open on arrival</th>
            <th style={{ padding: "0 12px", fontWeight: 400 }}>earliest arrival</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((reg) => {
            const isHovered = hoveredRegionName === reg.name;
            return (
              <tr
                key={reg.name}
                onMouseEnter={() => onHoverRegion(reg.name)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  borderBottom: `1px solid #f2f2f2`,
                  backgroundColor: isHovered ? "#fafafa" : "transparent",
                  cursor: "pointer",
                  height: 28,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <td
                  style={{
                    textAlign: "left",
                    padding: "0 12px",
                    fontWeight: 600,
                    color: isHovered ? ACCENT_COLOR : INK_COLOR,
                  }}
                >
                  {reg.name}
                </td>
                <td style={{ padding: "0 12px" }}>{reg.nShops}</td>
                <td style={{ padding: "0 12px" }}>{reg.nIndependent}</td>
                <td style={{ padding: "0 12px" }}>{reg.nOpenOnArrival}</td>
                <td
                  style={{
                    padding: "0 12px",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {reg.earliestArrival}
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
  const regionsLayerRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  const radiusKmRef = React.useRef(INITIAL_RADIUS_KM);
  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS_KM);

  const [mode, setMode] = React.useState("bike");
  const modeRef = React.useRef("bike");
  modeRef.current = mode;

  const [dayIndex, setDayIndex] = React.useState(1);
  const [leaveMins, setLeaveMins] = React.useState(6 * 60 + 30);
  const [backMins, setBackMins] = React.useState(8 * 60 + 45);
  const [targetIndex, setTargetIndex] = React.useState(2);

  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [counts, setCounts] = React.useState({
    inside: 0,
    independent: 0,
    openAndBack: 0,
  });

  const [regions, setRegions] = React.useState([]);
  const [hoveredRegionName, setHoveredRegionName] = React.useState(null);

  const regionsRef = React.useRef([]);
  regionsRef.current = regions;
  const hoveredRegionNameRef = React.useRef(null);
  hoveredRegionNameRef.current = hoveredRegionName;

  const timeStateRef = React.useRef({
    leave: 6 * 60 + 30,
    back: 8 * 60 + 45,
    day: 1,
    target: 2,
    mode: "bike",
  });
  timeStateRef.current = {
    leave: leaveMins,
    back: backMins,
    day: dayIndex,
    target: targetIndex,
    mode: mode,
  };

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

  const evaluateAll = (rKm, curLeave, curBack, curDay, curMode) => {
    const shops = shopsRef.current;
    const insideIndices = [];
    const openOnArrivalIndices = [];
    let insideCount = 0;
    let indepCount = 0;
    let openAndBackCount = 0;

    const minCol = `${curMode}_min`;
    const backCol = `${curMode}_back`;

    for (let i = 0; i < shops.length; i++) {
      const s = shops[i];
      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      const isInside = dist <= rKm;

      if (isInside) {
        insideIndices.push(i);
        insideCount++;
        if (!s.chain) indepCount++;

        const mMin = s[minCol] != null ? s[minCol] : 0;
        const mBack = s[backCol] != null ? s[backCol] : mMin;
        const arrMin = curLeave + mMin;
        const status = isOpenAt(s.hours, curDay, arrMin);

        if (status === "open") {
          openOnArrivalIndices.push(i);
        }

        const fitsInTime = curLeave + mMin + 10 + mBack <= curBack;
        if (status === "open" && fitsInTime) {
          openAndBackCount++;
        }
      }
    }

    return {
      insideIndices,
      openOnArrivalIndices,
      insideCount,
      independentCount: indepCount,
      openAndBackCount,
    };
  };

  const syncModelOutputs = (
    rKm,
    insideList,
    openArrivalList,
    curDay,
    curLeave,
    curBack,
    tIdx,
    curMode,
    regsList
  ) => {
    model.set("radius_km", parseFloat(rKm.toFixed(2)));
    model.set("inside", insideList);
    model.set("open_on_arrival", openArrivalList);
    model.set("when", {
      day: curDay,
      hhmm: formatMinutesToHHMM(curLeave),
    });
    model.set("back_by", formatMinutesToHHMM(curBack));
    model.set("target", tIdx);
    model.set("mode", curMode);

    const shops = shopsRef.current;
    const targetShop = tIdx != null ? shops[tIdx] : null;
    let backHHMM = "";
    let makesIt = false;

    if (targetShop) {
      const minCol = `${curMode}_min`;
      const backCol = `${curMode}_back`;
      const mMin = targetShop[minCol] != null ? targetShop[minCol] : 0;
      const mBack = targetShop[backCol] != null ? targetShop[backCol] : mMin;
      const totalTrip = mMin + 10 + mBack;
      const backArrivalMins = curLeave + totalTrip;
      backHHMM = formatMinutesToHHMM(backArrivalMins);
      makesIt = backArrivalMins <= curBack;
    }

    model.set("back_hhmm", backHHMM);
    model.set("makes_it", makesIt);

    const regionsDict = {};
    const listToProcess = regsList !== undefined ? regsList : regionsRef.current;
    listToProcess.forEach((reg) => {
      const matched = [];
      shops.forEach((s, idx) => {
        if (pointInPolygon([s.lat, s.lon], reg.coords)) {
          matched.push(idx);
        }
      });
      regionsDict[reg.name] = matched;
    });
    model.set("regions", regionsDict);

    model.save_changes();
  };

  const updateMapShops = (rKm, curLeave, curBack, curDay, curTarget, curMode) => {
    const layer = shopsLayerRef.current;
    if (!layer) return;
    const shops = shopsRef.current;
    const layers = layer.getLayers();

    const minCol = `${curMode}_min`;
    const backCol = `${curMode}_back`;

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

      const mMin = s[minCol] != null ? s[minCol] : 0;
      const mBack = s[backCol] != null ? s[backCol] : mMin;
      const arrMin = curLeave + mMin;
      const roundTripFits = curLeave + mMin + 10 + mBack <= curBack;
      const status = isOpenAt(s.hours, curDay, arrMin);

      if (isInside) {
        const timeLabel = formatMinutesToHHMM(arrMin);
        let labelColor = GREY_COLOR;
        if (status === "open") labelColor = OPEN_COLOR;
        else if (status === "closed") labelColor = CLOSED_COLOR;

        const opacityCss = roundTripFits ? 1 : 0.35;
        const tooltipContent = `<div style="opacity:${opacityCss};color:${labelColor};font-family:ui-monospace,SF Mono,Menlo,monospace;font-size:10px;line-height:10px;font-weight:600;white-space:nowrap;">${timeLabel}</div>`;

        if (!marker.getTooltip()) {
          marker.bindTooltip(tooltipContent, {
            permanent: true,
            direction: "bottom",
            offset: [0, 6],
            className: "shop-arr-tooltip",
          });
        } else {
          marker.setTooltipContent(tooltipContent);
        }
      } else {
        if (marker.getTooltip()) {
          marker.unbindTooltip();
        }
      }

      if (isInside) {
        const opacityVal = roundTripFits ? 1 : 0.35;
        const baseColor =
          status === "open"
            ? OPEN_COLOR
            : status === "closed"
            ? CLOSED_COLOR
            : GREY_COLOR;

        if (status === "open") {
          marker.setStyle({
            radius: isTarget ? 7 : 5,
            fillColor: isTarget ? ACCENT_COLOR : baseColor,
            fillOpacity: opacityVal,
            color: isTarget ? ACCENT_COLOR : "#ffffff",
            weight: isTarget ? 3.5 : 1.2,
            opacity: opacityVal,
            dashArray: null,
          });
        } else if (status === "closed") {
          marker.setStyle({
            radius: isTarget ? 7 : 5,
            fillColor: "#ffffff",
            fillOpacity: 0.9,
            color: isTarget ? ACCENT_COLOR : baseColor,
            weight: isTarget ? 3.5 : 2,
            opacity: opacityVal,
            dashArray: null,
          });
        } else {
          marker.setStyle({
            radius: isTarget ? 7 : 5,
            fillColor: "#ffffff",
            fillOpacity: 0.8,
            color: isTarget ? ACCENT_COLOR : GREY_COLOR,
            weight: isTarget ? 3.5 : 1.5,
            opacity: opacityVal,
            dashArray: "2, 3",
          });
        }
      } else {
        marker.setStyle({
          radius: 3,
          fillColor: GREY_COLOR,
          color: HAIRLINE_COLOR,
          weight: 0.8,
          opacity: 0.3,
          fillOpacity: 0.2,
          dashArray: null,
        });
      }
    });
  };

  const updateReachBands = (curMode) => {
    const layer = reachLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const reachData = model.get("reach");
    if (!reachData || !reachData[curMode]) return;

    const features = reachData[curMode].features || [];
    const sortedFeatures = [...features].sort((a, b) => {
      const cA = a.properties && a.properties.contour != null ? a.properties.contour : 0;
      const cB = b.properties && b.properties.contour != null ? b.properties.contour : 0;
      return cB - cA;
    });

    L.geoJSON(
      { type: "FeatureCollection", features: sortedFeatures },
      {
        style: (feature) => {
          const contour =
            feature.properties && feature.properties.contour != null
              ? feature.properties.contour
              : 30;
          let op = 0.06;
          if (contour <= 10) op = 0.12;
          else if (contour <= 20) op = 0.09;

          return {
            fillColor: "#46698b",
            fillOpacity: op,
            stroke: false,
            weight: 0,
            interactive: false,
          };
        },
      }
    ).addTo(layer);
  };

  const updateStreetRoute = (curMode, curTarget) => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (curTarget == null) return;
    const routesData = model.get("routes");
    if (!routesData || !routesData[curMode]) return;

    const routeCoords = routesData[curMode][curTarget];
    if (!routeCoords || routeCoords.length < 2) return;

    // Draw route polyline as 2px accent line above the bands
    L.polyline(routeCoords, {
      color: ACCENT_COLOR,
      weight: 2,
      opacity: 0.95,
      interactive: false,
    }).addTo(layer);

    // Label beside the midpoint on a white halo so it never covers route or hotel pin
    const midIdx = Math.floor(routeCoords.length / 2);
    const midPt = routeCoords[midIdx];

    const shops = shopsRef.current;
    const targetShop = shops[curTarget];
    const minCol = `${curMode}_min`;
    const nMin =
      targetShop && targetShop[minCol] != null ? Math.round(targetShop[minCol]) : null;

    if (nMin != null) {
      const labelHtml = `
        <div style="background: rgba(255,255,255,0.96); padding: 1px 4px; border: 1px solid ${HAIRLINE_COLOR}; font-family: ui-monospace, SF Mono, Menlo, monospace; font-size: 10px; font-weight: 600; color: ${INK_COLOR}; white-space: nowrap; box-shadow: 0 0 3px #ffffff, 0 0 3px #ffffff; line-height: 12px;">
          ${nMin} min
        </div>
      `;

      const routeIcon = L.divIcon({
        className: "route-mid-label",
        html: labelHtml,
        iconSize: [0, 0],
        iconAnchor: [-8, 6],
      });

      L.marker(midPt, {
        icon: routeIcon,
        interactive: false,
        zIndexOffset: 1100,
      }).addTo(layer);
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

  const applyAllChanges = (
    newR,
    newLeave,
    newBack,
    newDay,
    newTarget,
    newMode,
    newRegions
  ) => {
    const r = newR !== undefined ? newR : radiusKmRef.current;
    const l = newLeave !== undefined ? newLeave : leaveMins;
    const b = newBack !== undefined ? newBack : backMins;
    const d = newDay !== undefined ? newDay : dayIndex;
    const t = newTarget !== undefined ? newTarget : targetIndex;
    const m = newMode !== undefined ? newMode : modeRef.current;

    const evalRes = evaluateAll(r, l, b, d, m);
    setCounts({
      inside: evalRes.insideCount,
      independent: evalRes.independentCount,
      openAndBack: evalRes.openAndBackCount,
    });

    updateMapShops(r, l, b, d, t, m);
    updateStreetRoute(m, t);

    syncModelOutputs(
      r,
      evalRes.insideIndices,
      evalRes.openArrivalIndices,
      d,
      l,
      b,
      t,
      m,
      newRegions
    );
  };

  const redrawRegionsOnMap = React.useCallback(
    (currentRegionsList, currentHoveredName) => {
      const layer = regionsLayerRef.current;
      if (!layer || !mapRef.current) return;
      layer.clearLayers();

      currentRegionsList.forEach((reg) => {
        const isHovered = currentHoveredName === reg.name;

        const polygon = L.polygon(reg.coords, {
          color: isHovered ? ACCENT_COLOR : INK_COLOR,
          weight: isHovered ? 2 : 1.5,
          opacity: 0.9,
          fillColor: isHovered ? ACCENT_COLOR : INK_COLOR,
          fillOpacity: isHovered ? 0.22 : 0.08,
          dashArray: null,
        }).addTo(layer);

        polygon.bindTooltip(reg.name, {
          permanent: true,
          direction: "center",
          className: "region-name-tooltip",
        });

        polygon.on("dblclick", (e) => {
          L.DomEvent.stop(e);
          const nextList = regionsRef.current.filter((r) => r.name !== reg.name);
          setRegions(nextList);
          applyAllChanges(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            nextList
          );
        });

        reg.coords.forEach((coord, vIdx) => {
          const vIcon = L.divIcon({
            className: "vertex-handle-icon",
            html: `
              <div style="width:16px;height:16px;margin:-8px 0 0 -8px;display:flex;align-items:center;justify-content:center;cursor:grab;">
                <div style="width:7px;height:7px;border-radius:50%;background:${
                  isHovered ? ACCENT_COLOR : INK_COLOR
                };border:1.5px solid #ffffff;box-sizing:border-box;"></div>
              </div>
            `,
            iconSize: [0, 0],
          });

          const vMarker = L.marker(coord, {
            icon: vIcon,
            draggable: true,
            zIndexOffset: 1500,
          }).addTo(layer);

          vMarker.on("dragstart", () => {
            if (mapRef.current) mapRef.current.dragging.disable();
          });

          vMarker.on("drag", (ev) => {
            const nextLatLng = ev.target.getLatLng();
            const newCoords = reg.coords.map((c, i) =>
              i === vIdx ? [nextLatLng.lat, nextLatLng.lng] : c
            );
            polygon.setLatLngs(newCoords);
          });

          vMarker.on("dragend", (ev) => {
            if (mapRef.current) mapRef.current.dragging.enable();
            const nextLatLng = ev.target.getLatLng();
            const nextList = regionsRef.current.map((r) => {
              if (r.name !== reg.name) return r;
              const newCoords = r.coords.map((c, i) =>
                i === vIdx ? [nextLatLng.lat, nextLatLng.lng] : c
              );
              return { ...r, coords: newCoords };
            });
            setRegions(nextList);
            applyAllChanges(
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              nextList
            );
          });
        });
      });
    },
    []
  );

  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [HOTEL.lat, HOTEL.lon],
      zoom: 12,
      zoomControl: false,
      doubleClickZoom: false,
    });
    mapRef.current = map;

    if (map.boxZoom) {
      map.boxZoom.disable();
    }

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 16,
        attribution: "Esri, HERE, Garmin, OpenStreetMap contributors",
      }
    ).addTo(map);

    // Reach Layer
    const reachGroup = L.layerGroup().addTo(map);
    reachLayerRef.current = reachGroup;

    // Route Layer (above bands, below markers)
    const routeGroup = L.layerGroup().addTo(map);
    routeLayerRef.current = routeGroup;

    // Radius circle centered on hotel
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

    // Radius handle marker
    const handlePos = destinationPoint(HOTEL.lat, HOTEL.lon, 90, radiusKmRef.current);
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

    const applyRadius = (newR) => {
      const clamped = Math.max(0.4, Math.min(25, newR));
      radiusKmRef.current = clamped;
      setRadiusKm(clamped);
      updateHandleAndCircle(clamped);
      applyAllChanges(
        clamped,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    };

    edgeHandle.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
    });

    edgeHandle.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyRadius(dist);
    });

    edgeHandle.on("dragend", (e) => {
      isDraggingRef.current = false;
      map.dragging.enable();
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyRadius(dist);
    });

    let circleEdgeDragging = false;
    circle.on("mousedown", (e) => {
      if (e.originalEvent && e.originalEvent.shiftKey) return;
      const clickedDist = distanceKm(HOTEL.lat, HOTEL.lon, e.latlng.lat, e.latlng.lng);
      const diff = Math.abs(clickedDist - radiusKmRef.current);
      if (diff < Math.max(0.4, radiusKmRef.current * 0.18)) {
        circleEdgeDragging = true;
        map.dragging.disable();
        applyRadius(clickedDist);
      }
    });

    const onMapMouseMove = (e) => {
      if (circleEdgeDragging) {
        const dist = distanceKm(HOTEL.lat, HOTEL.lon, e.latlng.lat, e.latlng.lng);
        applyRadius(dist);
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

    // Regions Layer Group
    const regionsGroup = L.layerGroup().addTo(map);
    regionsLayerRef.current = regionsGroup;

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
        setTargetIndex(index);
      });

      marker.addTo(shopsGroup);
    });

    // Initial reach bands
    updateReachBands("bike");

    // Lasso drawing via capture on container + window mousemove/mouseup
    let isDrawingLasso = false;
    let lassoPoints = [];
    let liveLassoPolyline = null;

    const containerEl = containerRef.current;

    const onContainerMouseDown = (e) => {
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        isDrawingLasso = true;
        map.dragging.disable();

        const latlng = map.mouseEventToLatLng(e);
        lassoPoints = [[latlng.lat, latlng.lng]];

        liveLassoPolyline = L.polyline(lassoPoints, {
          color: INK_COLOR,
          weight: 1.5,
          dashArray: "3, 4",
        }).addTo(map);
      }
    };

    const onWindowMouseMove = (e) => {
      if (!isDrawingLasso) return;
      const latlng = map.mouseEventToLatLng(e);
      lassoPoints.push([latlng.lat, latlng.lng]);
      if (liveLassoPolyline) {
        liveLassoPolyline.setLatLngs(lassoPoints);
      }
    };

    const onWindowMouseUp = (e) => {
      if (!isDrawingLasso) return;
      isDrawingLasso = false;
      map.dragging.enable();

      if (liveLassoPolyline) {
        map.removeLayer(liveLassoPolyline);
        liveLassoPolyline = null;
      }

      if (lassoPoints.length >= 4) {
        const sampled = downsamplePoints(lassoPoints, 16, map);
        if (sampled.length >= 3) {
          const usedNames = new Set(regionsRef.current.map((r) => r.name));
          let nextLetter = "A";
          for (let code = 65; code <= 90; code++) {
            const char = String.fromCharCode(code);
            if (!usedNames.has(char)) {
              nextLetter = char;
              break;
            }
          }

          const newRegion = {
            name: nextLetter,
            coords: sampled,
          };
          const nextRegions = [...regionsRef.current, newRegion];
          setRegions(nextRegions);
          applyAllChanges(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            nextRegions
          );
        }
      }
      lassoPoints = [];
    };

    containerEl.addEventListener("mousedown", onContainerMouseDown, true);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);

    // Initial evaluation & model sync
    applyAllChanges(
      radiusKmRef.current,
      leaveMins,
      backMins,
      dayIndex,
      targetIndex,
      "bike",
      []
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
          setTargetIndex(index);
        });
        marker.addTo(shopsGroup);
      });
      applyAllChanges(
        radiusKmRef.current,
        timeStateRef.current.leave,
        timeStateRef.current.back,
        timeStateRef.current.day,
        timeStateRef.current.target,
        timeStateRef.current.mode,
        regionsRef.current
      );
    };

    model.on("change:data", onDataChange);

    return () => {
      model.off("change:data", onDataChange);
      containerEl.removeEventListener("mousedown", onContainerMouseDown, true);
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      map.off("mousemove", onMapMouseMove);
      map.off("mouseup", onMapMouseUp);
      map.remove();
    };
  }, []);

  React.useEffect(() => {
    redrawRegionsOnMap(regions, hoveredRegionName);
  }, [regions, hoveredRegionName, redrawRegionsOnMap]);

  React.useEffect(() => {
    applyAllChanges(
      radiusKmRef.current,
      leaveMins,
      backMins,
      dayIndex,
      targetIndex,
      mode,
      regions
    );
  }, [leaveMins, backMins, dayIndex, targetIndex, mode]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    updateReachBands(newMode);
    applyAllChanges(
      radiusKmRef.current,
      leaveMins,
      backMins,
      dayIndex,
      targetIndex,
      newMode,
      regions
    );
  };

  const handleNudge = (handle, deltaMins) => {
    if (handle === "leave") {
      setLeaveMins((prev) => (((prev + deltaMins) % 1440) + 1440) % 1440);
    } else {
      setBackMins((prev) => (((prev + deltaMins) % 1440) + 1440) % 1440);
    }
  };

  const currentTargetShop =
    targetIndex != null && shopsRef.current[targetIndex]
      ? shopsRef.current[targetIndex]
      : null;

  const regionTableData = React.useMemo(() => {
    const shops = shopsRef.current;
    const minCol = `${mode}_min`;
    return regions.map((reg) => {
      let nShops = 0;
      let nIndependent = 0;
      let nOpenOnArrival = 0;
      let minArrTime = Infinity;

      shops.forEach((s) => {
        if (pointInPolygon([s.lat, s.lon], reg.coords)) {
          nShops++;
          if (!s.chain) nIndependent++;

          const mMin = s[minCol] != null ? s[minCol] : 0;
          const arrMin = leaveMins + mMin;
          if (arrMin < minArrTime) {
            minArrTime = arrMin;
          }

          const status = isOpenAt(s.hours, dayIndex, arrMin);
          if (status === "open") {
            nOpenOnArrival++;
          }
        }
      });

      return {
        name: reg.name,
        nShops,
        nIndependent,
        nOpenOnArrival,
        earliestArrival:
          minArrTime !== Infinity ? formatMinutesToHHMM(minArrTime) : "—",
      };
    });
  }, [regions, leaveMins, dayIndex, mode]);

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        padding: 12,
        boxSizing: "border-box",
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
        .hotel-tooltip {
          background: ${INK_COLOR} !important;
          color: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
          padding: 2px 6px !important;
          font-size: 11px !important;
          border-radius: 0 !important;
        }
        .hotel-tooltip::before {
          border-top-color: ${INK_COLOR} !important;
        }
        .shop-arr-tooltip {
          background: rgba(255, 255, 255, 0.92) !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
          padding: 1px 3px !important;
          border-radius: 0 !important;
        }
        .shop-arr-tooltip::before {
          display: none !important;
        }
        .region-name-tooltip {
          background: rgba(255, 255, 255, 0.92) !important;
          border: 1px solid ${HAIRLINE_COLOR} !important;
          box-shadow: none !important;
          color: ${INK_COLOR} !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 1px 5px !important;
          border-radius: 0 !important;
        }
        .region-name-tooltip::before {
          display: none !important;
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
          flexDirection: "column",
          width: "100%",
          border: `1px solid ${HAIRLINE_COLOR}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: 560,
            overflow: "hidden",
          }}
        >
          {/* Map Panel */}
          <div
            style={{
              position: "relative",
              flex: 1,
              height: "100%",
              overflow: "hidden",
            }}
          >
            <CountLine
              insideCount={counts.inside}
              independentCount={counts.independent}
              openAndBackCount={counts.openAndBack}
            />
            <TooltipOverlay hoveredShop={hoveredShop} />
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          </div>

          {/* Right Dial Panel */}
          <div
            style={{
              width: 295,
              borderLeft: `1px solid ${HAIRLINE_COLOR}`,
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "14px 10px 12px 10px",
              boxSizing: "border-box",
              flexShrink: 0,
              overflowY: "auto",
            }}
          >
            {/* Mode Switch above Dial */}
            <ModeSwitch React={React} mode={mode} onChange={handleModeChange} />

            <ClockDial
              React={React}
              leaveMins={leaveMins}
              backMins={backMins}
              targetShop={currentTargetShop}
              mode={mode}
              onLeaveChange={setLeaveMins}
              onBackChange={setBackMins}
              onNudge={handleNudge}
            />

            {/* Verdict Lines under Dial */}
            <VerdictLines
              React={React}
              leaveMins={leaveMins}
              backByMins={backMins}
              targetShop={currentTargetShop}
              mode={mode}
              dayIndex={dayIndex}
            />

            {/* Day Buttons */}
            <DayPicker activeDay={dayIndex} onChange={setDayIndex} />
          </div>
        </div>

        {/* Compact Table under the map */}
        <RegionTable
          React={React}
          regions={regionTableData}
          hoveredRegionName={hoveredRegionName}
          onHoverRegion={setHoveredRegionName}
        />
      </div>
    </div>
  );
}