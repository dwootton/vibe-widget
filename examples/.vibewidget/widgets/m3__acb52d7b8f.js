import L from "https://esm.sh/leaflet@1.9.4";

export const MapStatsBadge = ({ countInside, countIndependent, countOpenInTime }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(255, 255, 255, 0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(0, 0, 0, 0.08)",
      borderRadius: 6,
      padding: "6px 12px",
      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      fontWeight: 500,
      color: "#18181b",
      letterSpacing: "-0.01em",
      pointerEvents: "none",
      userSelect: "none",
    }}
  >
    <span style={{ fontWeight: 600 }}>{countInside}</span> inside
    <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
    <span style={{ fontWeight: 600, color: "#d9480f" }}>{countIndependent}</span> independent
    <span style={{ margin: "0 6px", color: "#a1a1aa" }}>·</span>
    <span style={{ fontWeight: 600, color: "#16a34a" }}>{countOpenInTime}</span> open and back in time
  </div>
);

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
    if (cols.length === 0) return [];
    const firstCol = raw[cols[0]];
    if (Array.isArray(firstCol)) {
      return firstCol.map((_, i) => {
        const obj = {};
        cols.forEach((col) => {
          obj[col] = raw[col][i];
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

function timeToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minToHhmm(minutes) {
  const norm = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DAY_MAP = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };

function parseOsmHours(hoursStr, dayOfWeek, arrivalMin) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return null;
  }
  const clean = hoursStr.trim().toLowerCase();
  if (clean === "24/7" || clean.includes("24/7")) return true;

  const clauses = clean.split(";").map((s) => s.trim()).filter(Boolean);
  let hasMatchingDay = false;

  for (const clause of clauses) {
    const parts = clause.split(/\s+/);
    if (parts.length === 1 && parts[0].includes("-")) {
      const [startStr, endStr] = parts[0].split("-");
      const sMin = timeToMin(startStr);
      let eMin = timeToMin(endStr);
      if (eMin === 0 && endStr.includes("24")) eMin = 1440;
      if (arrivalMin >= sMin && arrivalMin < eMin) return true;
      hasMatchingDay = true;
      continue;
    }

    const timeRangeStr = parts[parts.length - 1];
    const daysStr = parts.slice(0, parts.length - 1).join(" ");

    let appliesToDay = false;
    const dayRanges = daysStr.split(",").map((s) => s.trim());
    for (const dr of dayRanges) {
      if (dr.includes("-")) {
        const [d1, d2] = dr.split("-").map((s) => s.trim());
        const startDay = DAY_MAP[d1];
        const endDay = DAY_MAP[d2];
        if (startDay !== undefined && endDay !== undefined) {
          if (startDay <= endDay) {
            if (dayOfWeek >= startDay && dayOfWeek <= endDay) appliesToDay = true;
          } else {
            if (dayOfWeek >= startDay || dayOfWeek <= endDay) appliesToDay = true;
          }
        }
      } else if (DAY_MAP[dr] !== undefined) {
        if (DAY_MAP[dr] === dayOfWeek) appliesToDay = true;
      }
    }

    if (appliesToDay) {
      hasMatchingDay = true;
      if (timeRangeStr.includes("-")) {
        const [startStr, endStr] = timeRangeStr.split("-");
        const sMin = timeToMin(startStr);
        let eMin = timeToMin(endStr);
        if (eMin === 0 && (endStr.includes("24") || endStr === "00:00")) eMin = 1440;
        if (arrivalMin >= sMin && arrivalMin < eMin) return true;
      } else if (timeRangeStr === "off") {
        return false;
      }
    }
  }

  if (!hasMatchingDay) {
    return false;
  }
  return false;
}

// Point in polygon (ray-casting algorithm)
function pointInPolygon(pt, poly) {
  const x = pt[0], y = pt[1];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getRegionLetter(index) {
  let name = "";
  let num = index;
  while (num >= 0) {
    name = String.fromCharCode(65 + (num % 26)) + name;
    num = Math.floor(num / 26) - 1;
  }
  return name;
}

export const RegionsTable = ({ React, regions, hoveredRegionId, onHoverRegion, onDeleteRegion }) => {
  if (!regions || regions.length === 0) {
    return (
      <div
        style={{
          padding: "8px 12px",
          fontSize: 11.5,
          color: "#71717a",
          borderTop: "1px solid #e4e4e7",
          background: "#fafafa",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          userSelect: "none",
        }}
      >
        <span style={{ fontWeight: 600, color: "#18181b" }}>Shift + drag</span> on the map to draw a lasso region. Drag handles to tweak; double-click inside a region to delete.
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: "1px solid #e4e4e7",
        background: "#ffffff",
        overflowX: "auto",
        maxHeight: 120,
        overflowY: "auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 11.5,
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
            <th style={{ padding: "4px 8px", fontWeight: 600, width: 60 }}>Region</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>Shops</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>Independent</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>Open on arrival</th>
            <th style={{ padding: "4px 8px", fontWeight: 600 }}>Earliest arrival</th>
            <th style={{ padding: "4px 8px", width: 30, textAlign: "right" }}></th>
          </tr>
        </thead>
        <tbody>
          {regions.map((reg) => {
            const isHovered = hoveredRegionId === reg.id;
            return (
              <tr
                key={reg.id}
                onMouseEnter={() => onHoverRegion(reg.id)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  background: isHovered ? "#f1f5f9" : "transparent",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <td style={{ padding: "4px 8px", fontWeight: 700, color: "#09090b" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 18,
                      height: 18,
                      lineHeight: "18px",
                      textAlign: "center",
                      borderRadius: 3,
                      background: isHovered ? "#09090b" : "#e2e8f0",
                      color: isHovered ? "#ffffff" : "#1e293b",
                      fontSize: 11,
                      marginRight: 4,
                    }}
                  >
                    {reg.name}
                  </span>
                </td>
                <td style={{ padding: "4px 8px", fontWeight: 500, color: "#18181b" }}>
                  {reg.nShops}
                </td>
                <td style={{ padding: "4px 8px", fontWeight: 500, color: "#d9480f" }}>
                  {reg.nIndependent}
                </td>
                <td style={{ padding: "4px 8px", fontWeight: 500, color: "#16a34a" }}>
                  {reg.nOpen}
                </td>
                <td style={{ padding: "4px 8px", fontWeight: 600, color: "#334155", fontFamily: "monospace" }}>
                  {reg.earliestArrival || "—"}
                </td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>
                  <button
                    type="button"
                    title="Delete region"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRegion(reg.id);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#94a3b8",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                  >
                    &times;
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const ClockDial = ({
  React,
  leaveMin,
  backMin,
  dayOfWeek,
  targetShop,
  onLeaveChange,
  onBackChange,
  onDayChange,
}) => {
  const svgRef = React.useRef(null);
  const lastTouchedRef = React.useRef("leave");
  const draggingRef = React.useRef(null);

  const cx = 135;
  const cy = 135;
  const rimR = 86;
  const leaveR = rimR;
  const backR = rimR + 14;

  const minToAngle = (m) => ((m % 720) / 720) * 2 * Math.PI;

  const leaveAngle = minToAngle(leaveMin);
  const backAngle = minToAngle(backMin);

  const leaveX = cx + leaveR * Math.sin(leaveAngle);
  const leaveY = cy - leaveR * Math.cos(leaveAngle);

  const backX = cx + backR * Math.sin(backAngle);
  const backY = cy - backR * Math.cos(backAngle);

  // Time-we-have faint wedge
  const buildWedgePath = () => {
    let diff = (backMin - leaveMin) % 720;
    if (diff < 0) diff += 720;
    if (diff === 0) return "";
    const angleDelta = (diff / 720) * 2 * Math.PI;
    const a1 = leaveAngle;
    const a2 = leaveAngle + angleDelta;
    const x1 = cx + rimR * Math.sin(a1);
    const y1 = cy - rimR * Math.cos(a1);
    const x2 = cx + rimR * Math.sin(a2);
    const y2 = cy - rimR * Math.cos(a2);
    const largeArc = angleDelta > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${rimR} ${rimR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  let tripUnderBackPath = "";
  let tripOverBackPath = "";
  let arrivePt = null;
  let arriveHhmm = "";

  if (targetShop && targetShop.bike_min !== undefined) {
    const bikeMin = targetShop.bike_min || 0;
    const bikeBack = targetShop.bike_back || 0;
    const arriveM = leaveMin + bikeMin;
    const tripTotal = bikeMin + 10 + bikeBack;
    const endM = leaveMin + tripTotal;
    arriveHhmm = minToHhmm(arriveM);

    const tripArcR = rimR - 5;
    const aArrive = minToAngle(arriveM);
    arrivePt = {
      x: cx + tripArcR * Math.sin(aArrive),
      y: cy - tripArcR * Math.cos(aArrive),
      tickInnerX: cx + (tripArcR - 4) * Math.sin(aArrive),
      tickInnerY: cy - (tripArcR - 4) * Math.cos(aArrive),
      tickOuterX: cx + (tripArcR + 4) * Math.sin(aArrive),
      tickOuterY: cy - (tripArcR + 4) * Math.cos(aArrive),
      labelX: cx + (tripArcR - 14) * Math.sin(aArrive),
      labelY: cy - (tripArcR - 14) * Math.cos(aArrive),
      angle: aArrive,
    };

    const makeArc = (startM, endMVal, radius) => {
      const dur = Math.max(0, endMVal - startM);
      if (dur <= 0) return "";
      const dAngle = (dur / 720) * 2 * Math.PI;
      const sA = minToAngle(startM);
      const eA = sA + dAngle;
      const x1 = cx + radius * Math.sin(sA);
      const y1 = cy - radius * Math.cos(sA);
      const x2 = cx + radius * Math.sin(eA);
      const y2 = cy - radius * Math.cos(eA);
      const largeArc = dAngle > Math.PI ? 1 : 0;
      return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    if (endM <= backMin) {
      tripUnderBackPath = makeArc(leaveMin, endM, tripArcR);
    } else if (leaveMin < backMin) {
      tripUnderBackPath = makeArc(leaveMin, backMin, tripArcR);
      tripOverBackPath = makeArc(backMin, endM, tripArcR);
    } else {
      tripOverBackPath = makeArc(leaveMin, endM, tripArcR);
    }
  }

  const handlePointerDown = (e) => {
    if (!svgRef.current) return;
    svgRef.current.focus();

    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dLeave = Math.hypot(px - leaveX, py - leaveY);
    const dBack = Math.hypot(px - backX, py - backY);

    let chosen = null;
    if (dLeave <= 18 && dBack <= 18) {
      chosen = dLeave <= dBack ? "leave" : "back";
    } else if (dLeave <= 18) {
      chosen = "leave";
    } else if (dBack <= 18) {
      chosen = "back";
    } else {
      const dRim = Math.abs(Math.hypot(px - cx, py - cy) - rimR);
      if (dRim <= 26) {
        chosen = dLeave <= dBack ? "leave" : "back";
      }
    }

    if (chosen) {
      e.preventDefault();
      draggingRef.current = chosen;
      lastTouchedRef.current = chosen;
    }
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const rad = Math.atan2(px - cx, cy - py);
    let normRad = rad;
    if (normRad < 0) normRad += 2 * Math.PI;

    const clockMin = (normRad / (2 * Math.PI)) * 720;
    const snapped12 = Math.round(clockMin / 5) * 5;

    if (draggingRef.current === "leave") {
      const baseHour = Math.floor(leaveMin / 720) * 720;
      let newLeave = baseHour + snapped12;
      newLeave = ((newLeave % 1440) + 1440) % 1440;
      onLeaveChange(newLeave);
    } else if (draggingRef.current === "back") {
      const baseHour = Math.floor(backMin / 720) * 720;
      let newBack = baseHour + snapped12;
      newBack = ((newBack % 1440) + 1440) % 1440;
      onBackChange(newBack);
    }
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 15 : -15;
      const targetHandle = lastTouchedRef.current || "leave";
      if (targetHandle === "leave") {
        const next = ((leaveMin + delta) % 1440 + 1440) % 1440;
        onLeaveChange(next);
      } else {
        const next = ((backMin + delta) % 1440 + 1440) % 1440;
        onBackChange(next);
      }
    }
  };

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const leaveLabelR = rimR + 25;
  const leaveLabelX = cx + leaveLabelR * Math.sin(leaveAngle);
  const leaveLabelY = cy - leaveLabelR * Math.cos(leaveAngle);

  const backLabelR = backR + 22;
  const backLabelX = cx + backLabelR * Math.sin(backAngle);
  const backLabelY = cy - backLabelR * Math.cos(backAngle);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 270,
        padding: "10px 8px 12px",
        background: "#ffffff",
        borderLeft: "1px solid #e4e4e7",
        boxSizing: "border-box",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <svg
        ref={svgRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onKeyDown={handleKeyDown}
        width={270}
        height={270}
        style={{
          outline: "none",
          cursor: draggingRef.current ? "grabbing" : "default",
          touchAction: "none",
          display: "block",
        }}
      >
        <path d={buildWedgePath()} fill="#0f172a" fillOpacity={0.06} />

        <circle cx={cx} cy={cy} r={rimR} fill="none" stroke="#d4d4d8" strokeWidth={1.5} />

        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * 2 * Math.PI;
          const isMain = i % 3 === 0;
          const len = isMain ? 9 : 5;
          const x1 = cx + (rimR - len) * Math.sin(a);
          const y1 = cy - (rimR - len) * Math.cos(a);
          const x2 = cx + rimR * Math.sin(a);
          const y2 = cy - rimR * Math.cos(a);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#71717a"
              strokeWidth={isMain ? 1.5 : 1}
            />
          );
        })}

        {[
          { label: "12", a: 0 },
          { label: "3", a: Math.PI / 2 },
          { label: "6", a: Math.PI },
          { label: "9", a: (3 * Math.PI) / 2 },
        ].map(({ label, a }) => {
          const textR = rimR - 19;
          const tx = cx + textR * Math.sin(a);
          const ty = cy - textR * Math.cos(a) + 4;
          return (
            <text
              key={label}
              x={tx}
              y={ty}
              textAnchor="middle"
              style={{
                fontSize: 10,
                fontWeight: 600,
                fill: "#71717a",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                pointerEvents: "none",
              }}
            >
              {label}
            </text>
          );
        })}

        {tripUnderBackPath && (
          <path
            d={tripUnderBackPath}
            fill="none"
            stroke="#18181b"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}
        {tripOverBackPath && (
          <path
            d={tripOverBackPath}
            fill="none"
            stroke="#dc2626"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        )}

        {arrivePt && (
          <g pointerEvents="none">
            <line
              x1={arrivePt.tickInnerX}
              y1={arrivePt.tickInnerY}
              x2={arrivePt.tickOuterX}
              y2={arrivePt.tickOuterY}
              stroke="#18181b"
              strokeWidth={1.5}
            />
            <text
              x={arrivePt.labelX}
              y={arrivePt.labelY + 3}
              textAnchor="middle"
              style={{
                fontSize: 9,
                fontWeight: 600,
                fill: "#18181b",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {arriveHhmm}
            </text>
          </g>
        )}

        <circle cx={cx} cy={cy} r={2.5} fill="#71717a" />

        <g
          style={{ cursor: "grab" }}
          onPointerDown={() => {
            lastTouchedRef.current = "leave";
          }}
        >
          <circle cx={leaveX} cy={leaveY} r={16} fill="transparent" />
          <circle cx={leaveX} cy={leaveY} r={6.5} fill="#18181b" stroke="#ffffff" strokeWidth={2} />
        </g>

        <g
          style={{ cursor: "grab" }}
          onPointerDown={() => {
            lastTouchedRef.current = "back";
          }}
        >
          <circle cx={backX} cy={backY} r={16} fill="transparent" />
          <circle cx={backX} cy={backY} r={6.5} fill="#ea580c" stroke="#ffffff" strokeWidth={2} />
        </g>

        <text
          x={leaveLabelX}
          y={leaveLabelY + 4}
          textAnchor="middle"
          style={{
            fontSize: 10,
            fontWeight: 600,
            fill: "#18181b",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', monospace",
            pointerEvents: "none",
          }}
        >
          {minToHhmm(leaveMin)}
        </text>

        <text
          x={backLabelX}
          y={backLabelY + 4}
          textAnchor="middle"
          style={{
            fontSize: 10,
            fontWeight: 600,
            fill: "#ea580c",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', monospace",
            pointerEvents: "none",
          }}
        >
          {minToHhmm(backMin)}
        </text>
      </svg>

      <div
        style={{
          width: "100%",
          padding: "2px 6px",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 11.5,
          fontWeight: 600,
          color: "#18181b",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          marginBottom: 8,
          minHeight: 18,
        }}
        title={targetShop ? targetShop.name : "None selected"}
      >
        {targetShop ? targetShop.name : "—"}
      </div>

      <div
        style={{
          display: "flex",
          gap: 3,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {[1, 2, 3, 4, 5, 6, 0].map((dIndex) => {
          const isSelected = dayOfWeek === dIndex;
          return (
            <button
              key={dIndex}
              type="button"
              onClick={() => onDayChange(dIndex)}
              style={{
                border: isSelected ? "1px solid #18181b" : "1px solid #e4e4e7",
                background: isSelected ? "#18181b" : "#f4f4f5",
                color: isSelected ? "#ffffff" : "#52525b",
                borderRadius: 4,
                padding: "3px 6px",
                fontSize: 11,
                fontWeight: isSelected ? 600 : 500,
                cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                lineHeight: 1.2,
                outline: "none",
              }}
            >
              {days[dIndex]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => normalizeData(model.get("data")));
  const [reach, setReach] = React.useState(() => model.get("reach") || null);

  const [leaveMin, setLeaveMin] = React.useState(390);
  const [backMin, setBackMin] = React.useState(525);
  const [dayOfWeek, setDayOfWeek] = React.useState(1);
  const [targetIdx, setTargetIdx] = React.useState(2);

  const [stats, setStats] = React.useState({ n: 0, k: 0, j: 0 });
  const [regionsList, setRegionsList] = React.useState([]);
  const [hoveredRegionId, setHoveredRegionId] = React.useState(null);

  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const dragActiveRef = React.useRef(false);
  const dragAngleRef = React.useRef(0.65);
  const radiusKmRef = React.useRef(3.5);

  const lassoStateRef = React.useRef({
    isLassoing: false,
    pts: [],
    polyLine: null,
  });

  const regionsDataRef = React.useRef([]);
  const nextRegionIndexRef = React.useRef(0);

  const elementsRef = React.useRef({
    visualCircle: null,
    hitCircle: null,
    edgeMarker: null,
    reachLayers: [],
    shopRecords: [],
    regionLayers: new Map(),
  });

  const hotelLat = 29.7522;
  const hotelLon = -95.3578;
  const hotelLatLng = L.latLng(hotelLat, hotelLon);

  // Sync inputs from python
  React.useEffect(() => {
    const handleDataChange = () => setData(normalizeData(model.get("data")));
    const handleReachChange = () => setReach(model.get("reach") || null);
    model.on("change:data", handleDataChange);
    model.on("change:reach", handleReachChange);
    return () => {
      model.off("change:data", handleDataChange);
      model.off("change:reach", handleReachChange);
    };
  }, [model]);

  // Leaflet CSS injection
  React.useEffect(() => {
    if (!document.getElementById("leaflet-base-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-base-css";
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  // Compute regions summary table and sync 'regions' trait
  const updateRegionsStats = React.useCallback(() => {
    const currentData = data;
    const currentLeaveMin = leaveMin;
    const currentDay = dayOfWeek;

    const traitRegions = {};
    const tableList = regionsDataRef.current.map((reg) => {
      const polyPts = reg.latlngs.map((ll) => [ll.lat, ll.lng]);
      const insideIndices = [];
      let nIndependent = 0;
      let nOpen = 0;
      let earliestMin = Infinity;

      currentData.forEach((shop, idx) => {
        if (pointInPolygon([shop.lat, shop.lon], polyPts)) {
          insideIndices.push(idx);
          if (!shop.chain) nIndependent++;
          const bikeMin = shop.bike_min || 0;
          const arrivalMin = currentLeaveMin + bikeMin;
          if (arrivalMin < earliestMin) earliestMin = arrivalMin;
          const openStatus = parseOsmHours(shop.hours, currentDay, arrivalMin);
          if (openStatus === true) nOpen++;
        }
      });

      traitRegions[reg.name] = insideIndices;

      return {
        id: reg.id,
        name: reg.name,
        nShops: insideIndices.length,
        nIndependent,
        nOpen,
        earliestArrival: earliestMin !== Infinity ? minToHhmm(earliestMin) : null,
      };
    });

    setRegionsList(tableList);
    model.set("regions", traitRegions);
    model.save_changes();
  }, [data, leaveMin, dayOfWeek, model]);

  // Re-calc regions summary when leaveMin, dayOfWeek, or data updates
  React.useEffect(() => {
    updateRegionsStats();
  }, [updateRegionsStats]);

  // Handle region polygon deletion
  const deleteRegion = React.useCallback((id) => {
    const reg = regionsDataRef.current.find((r) => r.id === id);
    if (!reg) return;

    if (elementsRef.current.regionLayers.has(id)) {
      const layerGroup = elementsRef.current.regionLayers.get(id);
      if (mapRef.current && layerGroup) {
        mapRef.current.removeLayer(layerGroup);
      }
      elementsRef.current.regionLayers.delete(id);
    }

    regionsDataRef.current = regionsDataRef.current.filter((r) => r.id !== id);
    updateRegionsStats();
  }, [updateRegionsStats]);

  // Highlighting region when table row hovered
  React.useEffect(() => {
    regionsDataRef.current.forEach((reg) => {
      const layerGroup = elementsRef.current.regionLayers.get(reg.id);
      if (layerGroup && reg.polygon) {
        if (hoveredRegionId === reg.id) {
          reg.polygon.setStyle({
            color: "#09090b",
            weight: 2.5,
            fillOpacity: 0.22,
          });
        } else {
          reg.polygon.setStyle({
            color: "#0284c7",
            weight: 1.5,
            fillOpacity: 0.08,
          });
        }
      }
    });
  }, [hoveredRegionId]);

  // Map initialization - runs only once
  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [hotelLat, hotelLon],
      zoom: 12,
      minZoom: 10,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false,
      boxZoom: false, // turn off leaflet's shift box-zoom so the lasso gets the gesture
    });
    mapRef.current = map;

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

    // Bike reach bands
    const reachLayers = [];
    if (reach && reach.bike && reach.bike.features) {
      const sortedFeatures = [...reach.bike.features].sort(
        (a, b) => (b.properties?.contour || 0) - (a.properties?.contour || 0)
      );

      sortedFeatures.forEach((feat) => {
        const contour = feat.properties?.contour;
        let fillOpacity = 0.06;
        if (contour <= 10) fillOpacity = 0.12;
        else if (contour <= 20) fillOpacity = 0.09;

        const lyr = L.geoJSON(feat, {
          style: {
            fillColor: "#475569",
            fillOpacity: fillOpacity,
            color: "#64748b",
            weight: 1,
            opacity: 0.25,
          },
          interactive: false,
        }).addTo(map);
        reachLayers.push(lyr);
      });
    }

    // Hotel Marker
    const hotelPinIcon = L.divIcon({
      className: "hotel-ink-pin",
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); pointer-events: none;">
          <div style="
            background: #09090b;
            color: #fafafa;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 3px;
            margin-bottom: 2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            white-space: nowrap;
          ">Hotel</div>
          <svg width="20" height="26" viewBox="0 0 24 30" fill="none">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 18 12 18s12-9.5 12-18c0-6.63-5.37-12-12-12z" fill="#09090b"/>
            <circle cx="12" cy="11" r="4.5" fill="#f4f4f5"/>
          </svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker(hotelLatLng, { icon: hotelPinIcon, zIndexOffset: 2000, interactive: false }).addTo(map);

    // Initial radius: 3.5 km
    const startRadiusM = 3500;
    radiusKmRef.current = 3.5;

    // Boundary circle
    const visualCircle = L.circle(hotelLatLng, {
      radius: startRadiusM,
      color: "#475569",
      weight: 1.5,
      dashArray: "4, 4",
      fillColor: "#0f172a",
      fillOpacity: 0.03,
      interactive: false,
    }).addTo(map);

    const hitCircle = L.circle(hotelLatLng, {
      radius: startRadiusM,
      color: "transparent",
      weight: 22,
      fill: false,
      interactive: true,
    }).addTo(map);

    const createEdgeLabelIcon = (rKm) =>
      L.divIcon({
        className: "radius-label-badge",
        html: `
          <div style="
            transform: translate(-50%, -50%);
            background: #18181b;
            color: #fafafa;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 500;
            padding: 2px 7px;
            border-radius: 9999px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.8);
            cursor: ew-resize;
            user-select: none;
            white-space: nowrap;
          ">${rKm.toFixed(1)} km</div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

    const initPos = getPerimeterLatLng(hotelLat, hotelLon, startRadiusM, dragAngleRef.current);
    const edgeMarker = L.marker(initPos, {
      icon: createEdgeLabelIcon(3.5),
      zIndexOffset: 1500,
      interactive: true,
    }).addTo(map);

    // Shop Markers
    const shopRecords = data.map((shop, index) => {
      const sLatLng = L.latLng(shop.lat, shop.lon);
      const distKm = hotelLatLng.distanceTo(sLatLng) / 1000;

      const marker = L.circleMarker(sLatLng, {
        radius: 4,
        fillColor: "#94a3b8",
        color: "#94a3b8",
        weight: 1,
        fillOpacity: 0.35,
        opacity: 0.35,
      }).addTo(map);

      const labelMarker = L.marker(sLatLng, {
        icon: L.divIcon({
          className: "shop-arrival-badge",
          html: `<div style="display:none;"></div>`,
          iconSize: [0, 0],
          iconAnchor: [-8, 6],
        }),
        interactive: false,
      }).addTo(map);

      const tooltipHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.45; color: #1e293b; min-width: 140px;">
          <div style="font-weight: 600; font-size: 13px; color: #09090b; margin-bottom: 2px;">${escapeHtml(shop.name)}</div>
          ${shop.street ? `<div style="color: #64748b; font-size: 11px;">${escapeHtml(shop.street)}</div>` : ""}
          ${shop.hours ? `<div style="color: #52525b; font-size: 11px; margin-top: 3px;">${escapeHtml(shop.hours)}</div>` : ""}
          <div style="margin-top: 4px; font-size: 10.5px; font-weight: 500; color: ${shop.chain ? "#71717a" : "#d9480f"};">
            ${shop.chain ? "Chain" : "Independent"} · ${distKm.toFixed(2)} km
          </div>
          <div style="color: #64748b; font-size: 10.5px; margin-top: 2px;">
            Bike: ${Math.round(shop.bike_min || 0)}m out · ${Math.round(shop.bike_back || 0)}m back
          </div>
        </div>
      `;

      marker.bindTooltip(tooltipHtml, {
        direction: "top",
        offset: [0, -5],
        className: "custom-shop-tooltip",
        opacity: 0.98,
      });

      marker.on("click", () => {
        setTargetIdx(index);
      });

      return { marker, labelMarker, shop, distKm, index };
    });

    elementsRef.current = {
      visualCircle,
      hitCircle,
      edgeMarker,
      reachLayers,
      shopRecords,
      regionLayers: elementsRef.current.regionLayers,
    };

    // Radius drag logic
    const startDrag = (e) => {
      L.DomEvent.stopPropagation(e);
      dragActiveRef.current = true;
      map.dragging.disable();
      if (containerRef.current) containerRef.current.style.cursor = "ew-resize";
      if (e.latlng) {
        dragAngleRef.current = Math.atan2(e.latlng.lng - hotelLon, e.latlng.lat - hotelLat);
      }
    };

    hitCircle.on("mousedown", startDrag);
    edgeMarker.on("mousedown", startDrag);

    hitCircle.on("mouseover", () => {
      if (!dragActiveRef.current && containerRef.current) containerRef.current.style.cursor = "ew-resize";
    });
    hitCircle.on("mouseout", () => {
      if (!dragActiveRef.current && containerRef.current) containerRef.current.style.cursor = "";
    });

    // Helper: create region polygon on map with handles
    const createRegionLayer = (region) => {
      const layerGroup = L.layerGroup().addTo(map);

      // Polygon
      const polygon = L.polygon(region.latlngs, {
        color: "#0284c7",
        weight: 1.5,
        fillColor: "#0284c7",
        fillOpacity: 0.08,
      }).addTo(layerGroup);

      region.polygon = polygon;

      // Double-click inside region deletes it
      polygon.on("dblclick", (e) => {
        L.DomEvent.stopPropagation(e);
        deleteRegion(region.id);
      });

      // Name label in center of polygon
      const bounds = polygon.getBounds();
      const center = bounds.getCenter();
      const labelIcon = L.divIcon({
        className: "region-center-label",
        html: `<div style="
          transform: translate(-50%, -50%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700;
          font-size: 11px;
          color: #0369a1;
          background: rgba(255, 255, 255, 0.85);
          padding: 1px 5px;
          border-radius: 3px;
          border: 1px solid #bae6fd;
          pointer-events: none;
        ">${region.name}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const centerMarker = L.marker(center, { icon: labelIcon, interactive: false }).addTo(layerGroup);

      // Draggable handle on every vertex
      const vertexMarkers = region.latlngs.map((latlng, vertexIdx) => {
        const handle = L.circleMarker(latlng, {
          radius: 3.5,
          color: "#0284c7",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 1.5,
        }).addTo(layerGroup);

        let isDraggingVertex = false;

        const onHandleDown = (ev) => {
          L.DomEvent.stopPropagation(ev);
          isDraggingVertex = true;
          map.dragging.disable();

          const onWindowMove = (mv) => {
            if (!isDraggingVertex) return;
            const mouseLatLng = map.mouseEventToLatLng(mv);
            if (!mouseLatLng) return;
            region.latlngs[vertexIdx] = mouseLatLng;
            handle.setLatLng(mouseLatLng);
            polygon.setLatLngs(region.latlngs);
            centerMarker.setLatLng(polygon.getBounds().getCenter());
          };

          const onWindowUp = () => {
            if (!isDraggingVertex) return;
            isDraggingVertex = false;
            map.dragging.enable();
            window.removeEventListener("mousemove", onWindowMove);
            window.removeEventListener("mouseup", onWindowUp);
            updateRegionsStats();
          };

          window.addEventListener("mousemove", onWindowMove);
          window.addEventListener("mouseup", onWindowUp);
        };

        handle.on("mousedown", onHandleDown);
        return handle;
      });

      elementsRef.current.regionLayers.set(region.id, layerGroup);
    };

    // Lasso drawing via mousedown with capture on map container
    const mapContainer = containerRef.current;

    const handleMapContainerMouseDown = (e) => {
      if (e.shiftKey && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();

        map.dragging.disable();
        lassoStateRef.current.isLassoing = true;
        const initialLatLng = map.mouseEventToLatLng(e);
        lassoStateRef.current.pts = [initialLatLng];

        // Temporary polyline to visualize lasso
        lassoStateRef.current.polyLine = L.polyline([initialLatLng], {
          color: "#0284c7",
          weight: 2,
          dashArray: "3, 3",
          interactive: false,
        }).addTo(map);
      }
    };

    mapContainer.addEventListener("mousedown", handleMapContainerMouseDown, true);

    const handleWindowMouseMove = (e) => {
      // 1. Circle radius drag
      if (dragActiveRef.current) {
        const mouseEvent = e.touches ? e.touches[0] : e;
        if (!mouseEvent) return;

        const currentLatLng = map.mouseEventToLatLng(mouseEvent);
        if (!currentLatLng) return;

        const distM = hotelLatLng.distanceTo(currentLatLng);
        const clampedMeters = Math.max(400, Math.min(22000, distM));
        const rKm = Math.round((clampedMeters / 1000) * 10) / 10;
        radiusKmRef.current = rKm;

        visualCircle.setRadius(clampedMeters);
        hitCircle.setRadius(clampedMeters);

        const angle = Math.atan2(currentLatLng.lng - hotelLon, currentLatLng.lat - hotelLat);
        dragAngleRef.current = angle;

        const newPos = getPerimeterLatLng(hotelLat, hotelLon, clampedMeters, angle);
        edgeMarker.setLatLng(newPos);
        edgeMarker.setIcon(createEdgeLabelIcon(rKm));

        renderShops(rKm);
        return;
      }

      // 2. Lasso drawing
      if (lassoStateRef.current.isLassoing) {
        const currentLatLng = map.mouseEventToLatLng(e);
        if (!currentLatLng) return;

        const pts = lassoStateRef.current.pts;
        const lastPt = pts[pts.length - 1];
        // Sample points at least 8 pixels apart to keep smooth and lightweight
        const p1 = map.latLngToContainerPoint(lastPt);
        const p2 = map.latLngToContainerPoint(currentLatLng);
        if (Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 8) {
          pts.push(currentLatLng);
          lassoStateRef.current.polyLine.setLatLngs(pts);
        }
      }
    };

    const handleWindowMouseUp = (e) => {
      // 1. End circle drag
      if (dragActiveRef.current) {
        dragActiveRef.current = false;
        map.dragging.enable();
        if (containerRef.current) containerRef.current.style.cursor = "";
        renderShops(radiusKmRef.current);
      }

      // 2. End lasso drag
      if (lassoStateRef.current.isLassoing) {
        lassoStateRef.current.isLassoing = false;
        map.dragging.enable();

        if (lassoStateRef.current.polyLine) {
          map.removeLayer(lassoStateRef.current.polyLine);
          lassoStateRef.current.polyLine = null;
        }

        const pts = lassoStateRef.current.pts;
        if (pts && pts.length >= 3) {
          const regionName = getRegionLetter(nextRegionIndexRef.current);
          nextRegionIndexRef.current += 1;
          const regId = "reg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

          const newRegion = {
            id: regId,
            name: regionName,
            latlngs: [...pts],
          };

          regionsDataRef.current.push(newRegion);
          createRegionLayer(newRegion);
          updateRegionsStats();
        }
        lassoStateRef.current.pts = [];
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("touchmove", handleWindowMouseMove, { passive: false });
    window.addEventListener("touchend", handleWindowMouseUp);

    // Initial render of shops
    renderShops(3.5);
    updateRegionsStats();

    return () => {
      mapContainer.removeEventListener("mousedown", handleMapContainerMouseDown, true);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowMouseMove);
      window.removeEventListener("touchend", handleWindowMouseUp);
      map.remove();
    };
  }, []); // Run map creation effect exactly once

  // Synchronized update for shop styling, labels, counts, and output traits
  const renderShops = React.useCallback(
    (currentRadiusKm) => {
      const { shopRecords } = elementsRef.current;
      if (!shopRecords || shopRecords.length === 0) return;

      const rKm = currentRadiusKm !== undefined ? currentRadiusKm : radiusKmRef.current;
      const inside = [];
      const openOnArrival = [];
      let nInside = 0;
      let kIndependent = 0;
      let jOpenInTime = 0;

      shopRecords.forEach(({ marker, labelMarker, shop, distKm, index }) => {
        const isInside = distKm <= rKm;
        const isTarget = index === targetIdx;

        const bikeMin = shop.bike_min || 0;
        const bikeBack = shop.bike_back || 0;
        const arrivalMin = leaveMin + bikeMin;
        const tripEndMin = leaveMin + bikeMin + 10 + bikeBack;
        const fitsInTime = tripEndMin <= backMin;
        const arrivalHhmm = minToHhmm(arrivalMin);

        const openStatus = parseOsmHours(shop.hours, dayOfWeek, arrivalMin);

        if (isInside) {
          inside.push(index);
          nInside++;
          if (!shop.chain) kIndependent++;

          if (openStatus === true) {
            openOnArrival.push(index);
            if (fitsInTime) jOpenInTime++;
          }

          let strokeColor = "#16a34a";
          let fillColor = "#16a34a";
          let fillOpacity = 1;
          let weight = isTarget ? 3.5 : 1.5;
          let dashArray = null;
          let labelColor = "#16a34a";

          if (openStatus === false) {
            strokeColor = "#dc2626";
            fillColor = "#ffffff";
            fillOpacity = 0.9;
            labelColor = "#dc2626";
          } else if (openStatus === null) {
            strokeColor = "#71717a";
            fillColor = "#ffffff";
            fillOpacity = 0.8;
            dashArray = "3, 3";
            labelColor = "#71717a";
          }

          if (isTarget) {
            strokeColor = "#09090b";
            weight = 3.5;
          }

          const markOpacity = fitsInTime ? 1 : 0.35;
          const markFillOpacity = fitsInTime ? fillOpacity : fillOpacity * 0.35;

          marker.setStyle({
            radius: isTarget ? 7.5 : 5,
            color: strokeColor,
            fillColor: fillColor,
            weight: weight,
            dashArray: dashArray,
            opacity: markOpacity,
            fillOpacity: markFillOpacity,
          });

          labelMarker.setIcon(
            L.divIcon({
              className: "shop-arrival-badge",
              html: `
                <div style="
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
                  font-size: 10px;
                  font-weight: 600;
                  color: ${labelColor};
                  opacity: ${fitsInTime ? 1 : 0.4};
                  background: rgba(255, 255, 255, 0.88);
                  padding: 1px 3px;
                  border-radius: 3px;
                  white-space: nowrap;
                  pointer-events: none;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
                ">${arrivalHhmm}</div>
              `,
              iconSize: [0, 0],
              iconAnchor: [-7, 7],
            })
          );

          marker.bringToFront();
        } else {
          marker.setStyle({
            radius: isTarget ? 6 : 3.5,
            fillColor: "#94a3b8",
            color: isTarget ? "#18181b" : "#94a3b8",
            weight: isTarget ? 2.5 : 0,
            dashArray: null,
            fillOpacity: 0.35,
            opacity: 0.35,
          });
          labelMarker.setIcon(
            L.divIcon({
              className: "shop-arrival-badge",
              html: `<div style="display:none;"></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            })
          );
        }
      });

      setStats({ n: nInside, k: kIndependent, j: jOpenInTime });

      // Synchronize required traits to Python
      model.set("inside", inside);
      model.set("radius_km", rKm);
      model.set("open_on_arrival", openOnArrival);
      model.set("when", { day: dayOfWeek, hhmm: minToHhmm(leaveMin) });
      model.set("back_by", minToHhmm(backMin));
      model.set("target", targetIdx);
      model.save_changes();
    },
    [data, dayOfWeek, leaveMin, backMin, targetIdx, model]
  );

  // Live restyle on any dial handle, day, target, or radius change
  React.useEffect(() => {
    renderShops(radiusKmRef.current);
  }, [renderShops]);

  const targetShop = data && targetIdx >= 0 && targetIdx < data.length ? data[targetIdx] : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: 620,
        boxSizing: "border-box",
        borderRadius: 8,
        border: "1px solid #e4e4e7",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .custom-shop-tooltip {
          background: rgba(255, 255, 255, 0.96) !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          border-radius: 6px !important;
          padding: 6px 10px !important;
        }
        .custom-shop-tooltip::before {
          border-top-color: #e2e8f0 !important;
        }
        .leaflet-container {
          background: #f4f4f5 !important;
        }
      `}</style>

      {/* Top section: Map + Dial */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: 480,
          position: "relative",
        }}
      >
        {/* Left Map View */}
        <div style={{ position: "relative", flex: 1, height: "100%", minWidth: 320 }}>
          <MapStatsBadge
            countInside={stats.n}
            countIndependent={stats.k}
            countOpenInTime={stats.j}
          />
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Right 12-Hour Dial + Controls */}
        <ClockDial
          React={React}
          leaveMin={leaveMin}
          backMin={backMin}
          dayOfWeek={dayOfWeek}
          targetShop={targetShop}
          onLeaveChange={setLeaveMin}
          onBackChange={setBackMin}
          onDayChange={setDayOfWeek}
        />
      </div>

      {/* Under Map: Compact Lasso Regions Table */}
      <RegionsTable
        React={React}
        regions={regionsList}
        hoveredRegionId={hoveredRegionId}
        onHoverRegion={setHoveredRegionId}
        onDeleteRegion={deleteRegion}
      />
    </div>
  );
}