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

const DAYS_OF_WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

function minToHhmm(minutes) {
  if (minutes == null || isNaN(minutes)) return "—";
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmToMin(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function parseOsmHours(hoursStr, dayIndex, timeMinutes) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return "unknown";
  }
  const clean = hoursStr.trim();
  if (clean === "24/7") return "open";

  const dayMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const rules = clean.split(";").map((r) => r.trim());

  let matchedDayRule = false;
  let isOpen = false;

  for (const rule of rules) {
    const spaceIdx = rule.indexOf(" ");
    let daysPart = "";
    let timesPart = "";

    if (spaceIdx === -1) {
      if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(rule)) {
        timesPart = rule;
      } else {
        continue;
      }
    } else {
      const firstToken = rule.slice(0, spaceIdx);
      if (/^[A-Za-z,\-]+$/.test(firstToken)) {
        daysPart = firstToken;
        timesPart = rule.slice(spaceIdx + 1).trim();
      } else {
        timesPart = rule;
      }
    }

    let appliesToDay = true;
    if (daysPart) {
      appliesToDay = false;
      const dayGroups = daysPart.split(",").map((g) => g.trim().toLowerCase());
      for (const group of dayGroups) {
        if (group.includes("-")) {
          const [startStr, endStr] = group.split("-");
          const s = dayMap[startStr];
          const e = dayMap[endStr];
          if (s !== undefined && e !== undefined) {
            if (s <= e) {
              if (dayIndex >= s && dayIndex <= e) appliesToDay = true;
            } else {
              if (dayIndex >= s || dayIndex <= e) appliesToDay = true;
            }
          }
        } else {
          if (dayMap[group] === dayIndex) appliesToDay = true;
        }
      }
    }

    if (appliesToDay) {
      matchedDayRule = true;
      const timeSpans = timesPart.split(",").map((t) => t.trim());
      for (const span of timeSpans) {
        if (span.toLowerCase() === "off" || span.toLowerCase() === "closed") {
          return "closed";
        }
        const [startT, endT] = span.split("-");
        if (startT && endT) {
          const sMin = hhmmToMin(startT);
          let eMin = hhmmToMin(endT);
          if (eMin === 0 && endT.startsWith("24")) eMin = 1440;
          if (eMin < sMin) {
            if (timeMinutes >= sMin || timeMinutes < eMin) {
              isOpen = true;
              break;
            }
          } else {
            if (timeMinutes >= sMin && timeMinutes < eMin) {
              isOpen = true;
              break;
            }
          }
        }
      }
    }
  }

  if (matchedDayRule) {
    return isOpen ? "open" : "closed";
  }
  return "closed";
}

function pointInPolygon(point, polygon) {
  const x = point[0];
  const y = point[1];
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

export const CountLine = ({ insideCount, independentCount, openAndBackCount }) => (
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
    <span style={{ fontWeight: 600 }}>{openAndBackCount}</span> open and back in time
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

export const RegionsTable = ({ regionsSummary, hoveredRegionName, onHoverRegion }) => {
  if (!regionsSummary || regionsSummary.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        borderTop: `1px solid ${HAIRLINE_COLOR}`,
        paddingTop: 8,
        marginTop: 8,
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        fontSize: 12,
        color: INK_COLOR,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${HAIRLINE_COLOR}`,
              color: GREY_COLOR,
              fontSize: 11,
              fontWeight: 400,
              textAlign: "left",
            }}
          >
            <th style={{ padding: "4px 8px", width: "12%" }}>region</th>
            <th style={{ padding: "4px 8px", textAlign: "right", width: "22%" }}>n shops</th>
            <th style={{ padding: "4px 8px", textAlign: "right", width: "22%" }}>n independent</th>
            <th style={{ padding: "4px 8px", textAlign: "right", width: "22%" }}>n open on arrival</th>
            <th style={{ padding: "4px 8px", textAlign: "right", width: "22%" }}>earliest arrival</th>
          </tr>
        </thead>
        <tbody>
          {regionsSummary.map((r) => {
            const isHovered = hoveredRegionName === r.name;
            return (
              <tr
                key={r.name}
                onMouseEnter={() => onHoverRegion(r.name)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  backgroundColor: isHovered ? "#f7f7f7" : "transparent",
                  borderBottom: `1px solid ${HAIRLINE_COLOR}`,
                  cursor: "default",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.nShops}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.nIndep}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.nOpen}</td>
                <td
                  style={{
                    padding: "6px 8px",
                    textAlign: "right",
                    fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {r.earliestArrival}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const TimeDial = ({
  leaveMin,
  backMin,
  targetShop,
  day,
  onLeaveChange,
  onBackChange,
  onDayChange,
  React,
}) => {
  const svgRef = React.useRef(null);
  const activeHandleRef = React.useRef(null);
  const lastTouchedRef = React.useRef("leave");

  const minToAngle = (m) => ((m % 720) / 720) * 360;
  const angleToMin12 = (angleDeg) => {
    let norm = (angleDeg % 360 + 360) % 360;
    return (norm / 360) * 720;
  };

  const dialCenter = 160;
  const dialRadius = 105;
  const innerArcRadius = 96;

  const leaveAngle = minToAngle(leaveMin);
  const backAngle = minToAngle(backMin);

  const getPt = (angleDeg, r) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: dialCenter + r * Math.cos(rad),
      y: dialCenter + r * Math.sin(rad),
    };
  };

  const describeArc = (startAng, endAng, r) => {
    let span = endAng - startAng;
    while (span < 0) span += 360;
    const p1 = getPt(startAng, r);
    const p2 = getPt(endAng, r);
    const large = span > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  const describeWedge = (startAng, endAng, r) => {
    let span = endAng - startAng;
    while (span < 0) span += 360;
    const p1 = getPt(startAng, r);
    const p2 = getPt(endAng, r);
    const large = span > 180 ? 1 : 0;
    return `M ${dialCenter} ${dialCenter} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
  };

  let wedgeSpan = backAngle - leaveAngle;
  while (wedgeSpan < 0) wedgeSpan += 360;
  const wedgePath = describeWedge(leaveAngle, backAngle, dialRadius);

  let targetTrip = null;
  if (targetShop) {
    const bikeMin = targetShop.bike_min ?? 0;
    const bikeBack = targetShop.bike_back ?? 0;
    const arriveMin = leaveMin + bikeMin;
    const returnMin = leaveMin + bikeMin + 10 + bikeBack;

    const startAng = minToAngle(leaveMin);
    const arriveAng = minToAngle(arriveMin);

    let tripTotalSpan = ((returnMin - leaveMin) / 720) * 360;
    let allowedSpan = ((backMin - leaveMin) / 720) * 360;
    if (allowedSpan <= 0) allowedSpan += 360;

    const arcSegments = [];
    if (tripTotalSpan <= allowedSpan) {
      arcSegments.push({
        path: describeArc(startAng, startAng + tripTotalSpan, innerArcRadius),
        color: INK_COLOR,
      });
    } else {
      arcSegments.push({
        path: describeArc(startAng, startAng + allowedSpan, innerArcRadius),
        color: INK_COLOR,
      });
      arcSegments.push({
        path: describeArc(startAng + allowedSpan, startAng + tripTotalSpan, innerArcRadius),
        color: CLOSED_COLOR,
      });
    }

    const arrivePt = getPt(arriveAng, innerArcRadius);
    const arriveTextPt = getPt(arriveAng, innerArcRadius - 16);

    targetTrip = {
      segments: arcSegments,
      arrivePt,
      arriveTextPt,
      arriveTime: minToHhmm(arriveMin),
      arriveAng,
    };
  }

  const handlePointerDown = (handleKey, e) => {
    e.preventDefault();
    activeHandleRef.current = handleKey;
    lastTouchedRef.current = handleKey;
    if (svgRef.current) {
      svgRef.current.focus();
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!activeHandleRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    deg = (deg % 360 + 360) % 360;

    let target12Min = angleToMin12(deg);
    const step = 5;
    target12Min = Math.round(target12Min / step) * step;

    if (activeHandleRef.current === "leave") {
      let isPm = leaveMin >= 720;
      let newTotal = (isPm ? 720 : 0) + target12Min;
      onLeaveChange(newTotal);
    } else {
      let isPm = backMin >= 720;
      let newTotal = (isPm ? 720 : 0) + target12Min;
      onBackChange(newTotal);
    }
  };

  const handlePointerUp = () => {
    activeHandleRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const delta = -15;
      if (lastTouchedRef.current === "leave") {
        onLeaveChange(((leaveMin + delta) % 1440 + 1440) % 1440);
      } else {
        onBackChange(((backMin + delta) % 1440 + 1440) % 1440);
      }
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = 15;
      if (lastTouchedRef.current === "leave") {
        onLeaveChange(((leaveMin + delta) % 1440 + 1440) % 1440);
      } else {
        onBackChange(((backMin + delta) % 1440 + 1440) % 1440);
      }
    }
  };

  const leavePt = getPt(leaveAngle, dialRadius);
  const backPt = getPt(backAngle, dialRadius);
  const leaveLabelPt = getPt(leaveAngle, dialRadius + 22);
  const backLabelPt = getPt(backAngle, dialRadius + 22);

  const hoursTicks = [];
  for (let h = 0; h < 12; h++) {
    const ang = (h / 12) * 360;
    const isMajor = h % 3 === 0;
    const pOuter = getPt(ang, dialRadius);
    const pInner = getPt(ang, dialRadius - (isMajor ? 7 : 4));
    let numEl = null;
    if (isMajor) {
      const pNum = getPt(ang, dialRadius - 16);
      numEl = (
        <text
          key={`num-${h}`}
          x={pNum.x}
          y={pNum.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 11,
            fill: GREY_COLOR,
            userSelect: "none",
          }}
        >
          {h}
        </text>
      );
    }
    hoursTicks.push(
      <g key={`tick-${h}`}>
        <line
          x1={pInner.x}
          y1={pInner.y}
          x2={pOuter.x}
          y2={pOuter.y}
          stroke={HAIRLINE_COLOR}
          strokeWidth={isMajor ? 1.5 : 1}
        />
        {numEl}
      </g>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 320,
        padding: "16px 12px 12px 12px",
        boxSizing: "border-box",
        borderLeft: `1px solid ${HAIRLINE_COLOR}`,
        backgroundColor: "#ffffff",
      }}
    >
      <svg
        ref={svgRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        width={320}
        height={320}
        style={{
          outline: "none",
          overflow: "visible",
          touchAction: "none",
          cursor: "default",
        }}
      >
        <circle
          cx={dialCenter}
          cy={dialCenter}
          r={dialRadius}
          fill="none"
          stroke={HAIRLINE_COLOR}
          strokeWidth={1}
        />

        {hoursTicks}

        <path d={wedgePath} fill={HAIRLINE_COLOR} opacity={0.35} />

        {targetTrip &&
          targetTrip.segments.map((seg, idx) => (
            <path
              key={`trip-seg-${idx}`}
              d={seg.path}
              fill="none"
              stroke={seg.color}
              strokeWidth={1.5}
            />
          ))}

        {targetTrip && (
          <g>
            <circle
              cx={targetTrip.arrivePt.x}
              cy={targetTrip.arrivePt.y}
              r={2.5}
              fill={INK_COLOR}
            />
            <text
              x={targetTrip.arriveTextPt.x}
              y={targetTrip.arriveTextPt.y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 9.5,
                fill: INK_COLOR,
                userSelect: "none",
              }}
            >
              {targetTrip.arriveTime}
            </text>
          </g>
        )}

        {/* Leave Handle */}
        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("leave", e)}
        >
          <circle
            cx={leavePt.x}
            cy={leavePt.y}
            r={16}
            fill="transparent"
          />
          <circle
            cx={leavePt.x}
            cy={leavePt.y}
            r={5.5}
            fill={INK_COLOR}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </g>
        <text
          x={leaveLabelPt.x}
          y={leaveLabelPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fill: INK_COLOR,
            fontWeight: 500,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {minToHhmm(leaveMin)}
        </text>

        {/* Back By Handle */}
        <g
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => handlePointerDown("back", e)}
        >
          <circle
            cx={backPt.x}
            cy={backPt.y}
            r={16}
            fill="transparent"
          />
          <circle
            cx={backPt.x}
            cy={backPt.y}
            r={5.5}
            fill={ACCENT_COLOR}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        </g>
        <text
          x={backLabelPt.x}
          y={backLabelPt.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fill: ACCENT_COLOR,
            fontWeight: 500,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {minToHhmm(backMin)}
        </text>
      </svg>

      {/* Target Shop Name */}
      <div
        style={{
          width: "100%",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontSize: 13,
          fontWeight: 600,
          color: INK_COLOR,
          marginTop: 10,
          marginBottom: 12,
          minHeight: 18,
        }}
      >
        {targetShop ? targetShop.name : "—"}
      </div>

      {/* Day Buttons */}
      <div
        style={{
          display: "flex",
          gap: 4,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {DAYS_OF_WEEK.map((dName, idx) => {
          const isActive = day === idx;
          return (
            <button
              key={dName}
              onClick={() => onDayChange(idx)}
              style={{
                border: `1px solid ${isActive ? INK_COLOR : HAIRLINE_COLOR}`,
                backgroundColor: isActive ? INK_COLOR : "transparent",
                color: isActive ? "#ffffff" : INK_COLOR,
                padding: "3px 6px",
                fontSize: 11,
                fontFamily: "system-ui, -apple-system, sans-serif",
                cursor: "pointer",
                borderRadius: 0,
                outline: "none",
                minWidth: 26,
              }}
            >
              {dName}
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
  const shopsLayerRef = React.useRef(null);
  const reachLayerRef = React.useRef(null);
  const regionsLayerGroupRef = React.useRef(null);
  const lassoPreviewLayerRef = React.useRef(null);
  const radiusKmRef = React.useRef(INITIAL_RADIUS_KM);

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS_KM);
  const [counts, setCounts] = React.useState({ inside: 0, independent: 0, openAndBack: 0 });
  const [hoveredShop, setHoveredShop] = React.useState(null);

  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backMin, setBackMin] = React.useState(8 * 60 + 45);
  const [day, setDay] = React.useState(1);
  const [targetIndex, setTargetIndex] = React.useState(2);

  // Regions state: array of { id, name, latlngs: [{lat, lng}, ...] }
  const [regions, setRegions] = React.useState([]);
  const [hoveredRegionName, setHoveredRegionName] = React.useState(null);

  const regionsRef = React.useRef(regions);
  regionsRef.current = regions;
  const hoveredRegionNameRef = React.useRef(hoveredRegionName);
  hoveredRegionNameRef.current = hoveredRegionName;

  const leaveMinRef = React.useRef(leaveMin);
  const backMinRef = React.useRef(backMin);
  const dayRef = React.useRef(day);
  const targetIndexRef = React.useRef(targetIndex);

  leaveMinRef.current = leaveMin;
  backMinRef.current = backMin;
  dayRef.current = day;
  targetIndexRef.current = targetIndex;

  const parseShopsFromModel = () => {
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

  const shopsRef = React.useRef(parseShopsFromModel());

  const evaluateState = (rKm, lMin, bMin, dIdx) => {
    const shops = shopsRef.current;
    const insideIndices = [];
    const openOnArrivalIndices = [];
    let insideCount = 0;
    let indepCount = 0;
    let openAndBackCount = 0;

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

        const bikeMin = s.bike_min ?? 0;
        const bikeBack = s.bike_back ?? 0;
        const arriveMin = lMin + bikeMin;
        const roundTripMin = lMin + bikeMin + 10 + bikeBack;

        const openStatus = parseOsmHours(s.hours, dIdx, arriveMin);
        if (openStatus === "open") {
          openOnArrivalIndices.push(i);
        }

        const fitsBeforeBack = roundTripMin <= bMin;
        if (openStatus === "open" && fitsBeforeBack) {
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

  const computeRegionsIndices = (currentRegions) => {
    const shops = shopsRef.current;
    const result = {};
    for (const r of currentRegions) {
      const poly = r.latlngs.map((pt) => [pt.lat, pt.lng]);
      const indices = [];
      for (let i = 0; i < shops.length; i++) {
        const s = shops[i];
        if (pointInPolygon([s.lat, s.lon], poly)) {
          indices.push(i);
        }
      }
      result[r.name] = indices;
    }
    return result;
  };

  const computeRegionsSummary = () => {
    const shops = shopsRef.current;
    const lMin = leaveMinRef.current;
    const dIdx = dayRef.current;

    return regions.map((r) => {
      const poly = r.latlngs.map((pt) => [pt.lat, pt.lng]);
      let nShops = 0;
      let nIndep = 0;
      let nOpen = 0;
      let earliestArrivalMin = Infinity;

      for (let i = 0; i < shops.length; i++) {
        const s = shops[i];
        if (pointInPolygon([s.lat, s.lon], poly)) {
          nShops++;
          if (!s.chain) nIndep++;

          const bikeMin = s.bike_min ?? 0;
          const arriveMin = lMin + bikeMin;
          const openStatus = parseOsmHours(s.hours, dIdx, arriveMin);
          if (openStatus === "open") {
            nOpen++;
          }
          if (arriveMin < earliestArrivalMin) {
            earliestArrivalMin = arriveMin;
          }
        }
      }

      return {
        name: r.name,
        nShops,
        nIndep,
        nOpen,
        earliestArrival:
          earliestArrivalMin === Infinity ? "—" : minToHhmm(earliestArrivalMin),
      };
    });
  };

  const syncOutputs = (rKm, insideIndices, openIndices, lMin, bMin, dIdx, tIdx, regionsMap) => {
    model.set("radius_km", parseFloat(rKm.toFixed(2)));
    model.set("inside", insideIndices);
    model.set("open_on_arrival", openIndices);
    model.set("when", { day: dIdx, hhmm: minToHhmm(lMin) });
    model.set("back_by", minToHhmm(bMin));
    model.set("target", tIdx);
    model.set("regions", regionsMap);
    model.save_changes();
  };

  const updateMarkers = () => {
    const layer = shopsLayerRef.current;
    if (!layer) return;
    const shops = shopsRef.current;
    const rKm = radiusKmRef.current;
    const lMin = leaveMinRef.current;
    const bMin = backMinRef.current;
    const dIdx = dayRef.current;
    const tIdx = targetIndexRef.current;

    layer.eachLayer((marker) => {
      const idx = marker.__shopIndex;
      const s = shops[idx];
      if (!s) return;

      const dist =
        s.km_from_hotel != null
          ? s.km_from_hotel
          : distanceKm(HOTEL.lat, HOTEL.lon, s.lat, s.lon);
      const isInside = dist <= rKm;
      const isTarget = idx === tIdx;

      const bikeMin = s.bike_min ?? 0;
      const bikeBack = s.bike_back ?? 0;
      const arriveMin = lMin + bikeMin;
      const roundTripMin = lMin + bikeMin + 10 + bikeBack;
      const fitsBeforeBack = roundTripMin <= bMin;
      const openStatus = parseOsmHours(s.hours, dIdx, arriveMin);

      const html = generateMarkerHtml(s, isInside, isTarget, fitsBeforeBack, openStatus, arriveMin);
      marker.setIcon(
        L.divIcon({
          className: "custom-shop-marker",
          html: html,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
      );
      if (isTarget) {
        marker.setZIndexOffset(2000);
      } else if (isInside) {
        marker.setZIndexOffset(500);
      } else {
        marker.setZIndexOffset(100);
      }
    });
  };

  const generateMarkerHtml = (s, isInside, isTarget, fitsBeforeBack, openStatus, arriveMin) => {
    const opacity = fitsBeforeBack ? 1.0 : 0.35;
    const arrivalHhmm = minToHhmm(arriveMin);

    let symbolSvg = "";
    let labelColor = GREY_COLOR;

    if (!isInside) {
      symbolSvg = `<circle cx="0" cy="0" r="3" fill="${GREY_COLOR}" stroke="${HAIRLINE_COLOR}" stroke-width="0.8" opacity="0.4" />`;
    } else {
      if (openStatus === "open") {
        labelColor = OPEN_COLOR;
        symbolSvg = `<circle cx="0" cy="0" r="4.5" fill="${OPEN_COLOR}" stroke="#ffffff" stroke-width="1.2" />`;
      } else if (openStatus === "closed") {
        labelColor = CLOSED_COLOR;
        symbolSvg = `<circle cx="0" cy="0" r="4.5" fill="none" stroke="${CLOSED_COLOR}" stroke-width="1.6" />`;
      } else {
        labelColor = GREY_COLOR;
        symbolSvg = `<circle cx="0" cy="0" r="4.5" fill="none" stroke="${GREY_COLOR}" stroke-width="1.4" stroke-dasharray="2,2" />`;
      }

      if (isTarget) {
        symbolSvg += `<circle cx="0" cy="0" r="8.5" fill="none" stroke="${ACCENT_COLOR}" stroke-width="2.5" />`;
      }
    }

    const timeLabel = isInside
      ? `<div style="
          position: absolute;
          left: 8px;
          top: -6px;
          font-family: ui-monospace, SF Mono, Menlo, monospace;
          font-size: 10px;
          color: ${labelColor};
          white-space: nowrap;
          pointer-events: none;
          line-height: 12px;
          user-select: none;
        ">${arrivalHhmm}</div>`
      : "";

    return `
      <div style="opacity: ${opacity}; position: relative; pointer-events: auto;">
        <svg style="overflow: visible; position: absolute; left: 0; top: 0;" width="0" height="0">
          <circle cx="0" cy="0" r="12" fill="transparent" />
          ${symbolSvg}
        </svg>
        ${timeLabel}
      </div>
    `;
  };

  const deleteRegion = (regionId) => {
    setRegions((prev) => {
      const remaining = prev.filter((r) => r.id !== regionId);
      const renumbered = remaining.map((r, i) => ({
        ...r,
        name: String.fromCharCode(65 + i),
      }));
      return renumbered;
    });
  };

  const updateRegionVertex = (regionId, vertexIdx, newLatLng) => {
    setRegions((prev) =>
      prev.map((r) => {
        if (r.id !== regionId) return r;
        const nextPts = [...r.latlngs];
        nextPts[vertexIdx] = { lat: newLatLng.lat, lng: newLatLng.lng };
        return { ...r, latlngs: nextPts };
      })
    );
  };

  // Re-render polygons + draggable vertex handles whenever regions or hovered region changes
  React.useEffect(() => {
    const group = regionsLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    regions.forEach((region) => {
      const isHighlighted = hoveredRegionName === region.name;
      const polyCoords = region.latlngs.map((pt) => [pt.lat, pt.lng]);

      const polygon = L.polygon(polyCoords, {
        color: isHighlighted ? ACCENT_COLOR : INK_COLOR,
        weight: isHighlighted ? 2 : 1.5,
        fillColor: isHighlighted ? ACCENT_COLOR : INK_COLOR,
        fillOpacity: isHighlighted ? 0.18 : 0.08,
      });

      polygon.on("dblclick", (e) => {
        L.DomEvent.stop(e);
        deleteRegion(region.id);
      });

      polygon.addTo(group);

      // Region center label
      let centerLat = 0;
      let centerLng = 0;
      region.latlngs.forEach((pt) => {
        centerLat += pt.lat;
        centerLng += pt.lng;
      });
      centerLat /= region.latlngs.length;
      centerLng /= region.latlngs.length;

      const labelIcon = L.divIcon({
        className: "region-label-icon",
        html: `<div style="
          font-family: system-ui, -apple-system, sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: ${isHighlighted ? ACCENT_COLOR : INK_COLOR};
          transform: translate(-50%, -50%);
          pointer-events: none;
          user-select: none;
        ">${region.name}</div>`,
        iconSize: [0, 0],
      });
      L.marker([centerLat, centerLng], { icon: labelIcon, interactive: false }).addTo(group);

      // Vertex handles
      region.latlngs.forEach((pt, vIdx) => {
        const handleIcon = L.divIcon({
          className: "vertex-handle-icon",
          html: `
            <div style="width: 16px; height: 16px; margin: -8px 0 0 -8px; display: flex; align-items: center; justify-content: center; cursor: grab;">
              <div style="width: 7px; height: 7px; border-radius: 50%; background: ${isHighlighted ? ACCENT_COLOR : INK_COLOR}; border: 1.5px solid #ffffff; box-sizing: border-box;"></div>
            </div>
          `,
          iconSize: [0, 0],
        });

        const vertexMarker = L.marker([pt.lat, pt.lng], {
          icon: handleIcon,
          draggable: true,
          zIndexOffset: 1700,
        });

        vertexMarker.on("dragstart", () => {
          if (mapRef.current) mapRef.current.dragging.disable();
        });
        vertexMarker.on("drag", (e) => {
          const latlng = e.target.getLatLng();
          const nextPts = region.latlngs.map((p, i) =>
            i === vIdx ? { lat: latlng.lat, lng: latlng.lng } : p
          );
          polygon.setLatLngs(nextPts.map((p) => [p.lat, p.lng]));
        });
        vertexMarker.on("dragend", (e) => {
          if (mapRef.current) mapRef.current.dragging.enable();
          const latlng = e.target.getLatLng();
          updateRegionVertex(region.id, vIdx, latlng);
        });

        vertexMarker.addTo(group);
      });
    });
  }, [regions, hoveredRegionName]);

  // Leaflet map setup effect
  React.useEffect(() => {
    if (!containerRef.current) return;

    // Turn off Leaflet's shift box-zoom so shift+drag draws lasso
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

    // Bike Reach geojson layer
    const reachData = model.get("reach");
    const bikeReach = reachData ? reachData.bike : null;
    if (bikeReach) {
      const reachLayer = L.geoJSON(bikeReach, {
        style: (feature) => {
          const contour = feature.properties?.contour ?? 30;
          let fillOpacity = 0.06;
          if (contour <= 10) fillOpacity = 0.12;
          else if (contour <= 20) fillOpacity = 0.09;
          else fillOpacity = 0.06;

          return {
            fillColor: "#4a6fa5",
            fillOpacity: fillOpacity,
            weight: 0,
            stroke: false,
            interactive: false,
          };
        },
      }).addTo(map);
      reachLayerRef.current = reachLayer;
    }

    // Circle centered on hotel
    const circle = L.circle([HOTEL.lat, HOTEL.lon], {
      radius: radiusKmRef.current * 1000,
      color: INK_COLOR,
      weight: 1.5,
      opacity: 0.85,
      fillColor: INK_COLOR,
      fillOpacity: 0.04,
      interactive: true,
    }).addTo(map);
    circleRef.current = circle;

    // Draggable edge handle
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
      zIndexOffset: 1500,
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

    // Hotel pin
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
      zIndexOffset: 1600,
    })
      .bindTooltip("hotel", {
        permanent: false,
        direction: "top",
        offset: [0, -20],
        className: "hotel-tooltip",
      })
      .addTo(map);

    // Group for lasso regions and handles
    const regionsGroup = L.layerGroup().addTo(map);
    regionsLayerGroupRef.current = regionsGroup;

    // Temporary layer for active lasso preview
    const lassoPreview = L.polyline([], {
      color: INK_COLOR,
      weight: 1.5,
      dashArray: "3, 3",
      interactive: false,
    }).addTo(map);
    lassoPreviewLayerRef.current = lassoPreview;

    const applyRadius = (newR) => {
      const clamped = Math.max(0.4, Math.min(25, newR));
      radiusKmRef.current = clamped;
      if (circleRef.current) circleRef.current.setRadius(clamped * 1000);
      if (edgeHandleRef.current) {
        const hPos = destinationPoint(HOTEL.lat, HOTEL.lon, 90, clamped);
        edgeHandleRef.current.setLatLng(hPos);
        edgeHandleRef.current.setTooltipContent(
          `<span style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-variant-numeric:tabular-nums;color:${INK_COLOR};padding:1px 3px;font-weight:500;">${clamped.toFixed(
            1
          )} km</span>`
        );
      }
      setRadiusKm(clamped);
      const evalRes = evaluateState(
        clamped,
        leaveMinRef.current,
        backMinRef.current,
        dayRef.current
      );
      setCounts({
        inside: evalRes.insideCount,
        independent: evalRes.independentCount,
        openAndBack: evalRes.openAndBackCount,
      });
      syncOutputs(
        clamped,
        evalRes.insideIndices,
        evalRes.openOnArrivalIndices,
        leaveMinRef.current,
        backMinRef.current,
        dayRef.current,
        targetIndexRef.current,
        computeRegionsIndices(regionsRef.current)
      );
      updateMarkers();
    };

    edgeHandle.on("dragstart", () => map.dragging.disable());
    edgeHandle.on("drag", (e) => {
      const latlng = e.target.getLatLng();
      const dist = distanceKm(HOTEL.lat, HOTEL.lon, latlng.lat, latlng.lng);
      applyRadius(dist);
    });
    edgeHandle.on("dragend", (e) => {
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

    // Lasso drawing via Shift+drag
    let isLassoing = false;
    let lassoPoints = [];

    const mapContainer = containerRef.current;

    const onMouseDownContainer = (e) => {
      if (e.shiftKey && e.button === 0) {
        isLassoing = true;
        lassoPoints = [];
        map.dragging.disable();
        const pt = map.mouseEventToLatLng(e);
        lassoPoints.push(pt);
        lassoPreview.setLatLngs(lassoPoints);
        e.preventDefault();
      }
    };

    const onMouseMoveContainer = (e) => {
      if (isLassoing) {
        const pt = map.mouseEventToLatLng(e);
        const last = lassoPoints[lassoPoints.length - 1];
        if (!last || distanceKm(last.lat, last.lng, pt.lat, pt.lng) > 0.05) {
          lassoPoints.push(pt);
          lassoPreview.setLatLngs(lassoPoints);
        }
      } else if (circleEdgeDragging) {
        const pt = map.mouseEventToLatLng(e);
        const dist = distanceKm(HOTEL.lat, HOTEL.lon, pt.lat, pt.lng);
        applyRadius(dist);
      }
    };

    const onMouseUpContainer = (e) => {
      if (isLassoing) {
        isLassoing = false;
        lassoPreview.setLatLngs([]);
        map.dragging.enable();

        if (lassoPoints.length >= 3) {
          // Downsample points slightly if very dense for crisp polygon vertex handles
          const simplified = [];
          for (let i = 0; i < lassoPoints.length; i++) {
            if (
              i === 0 ||
              i === lassoPoints.length - 1 ||
              distanceKm(
                lassoPoints[i].lat,
                lassoPoints[i].lng,
                simplified[simplified.length - 1].lat,
                simplified[simplified.length - 1].lng
              ) > 0.15
            ) {
              simplified.push(lassoPoints[i]);
            }
          }
          if (simplified.length < 3) simplified.push(...lassoPoints);

          setRegions((prev) => {
            const nextName = String.fromCharCode(65 + prev.length);
            const newRegion = {
              id: Date.now() + Math.random(),
              name: nextName,
              latlngs: simplified.map((p) => ({ lat: p.lat, lng: p.lng })),
            };
            return [...prev, newRegion];
          });
        }
      }
      if (circleEdgeDragging) {
        circleEdgeDragging = false;
        map.dragging.enable();
      }
    };

    mapContainer.addEventListener("mousedown", onMouseDownContainer);
    window.addEventListener("mousemove", onMouseMoveContainer);
    window.addEventListener("mouseup", onMouseUpContainer);

    // Shops layer
    const shopsGroup = L.layerGroup().addTo(map);
    shopsLayerRef.current = shopsGroup;

    const shops = shopsRef.current;
    shops.forEach((shop, index) => {
      const marker = L.marker([shop.lat, shop.lon], {
        icon: L.divIcon({
          className: "custom-shop-marker",
          html: `<div style="width:0;height:0;"></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      });
      marker.__shopIndex = index;

      marker.on("mouseover", () => setHoveredShop(shop));
      marker.on("mouseout", () => setHoveredShop(null));
      marker.on("click", () => {
        targetIndexRef.current = index;
        setTargetIndex(index);
        syncOutputs(
          radiusKmRef.current,
          evalResInitial.insideIndices,
          evalResInitial.openOnArrivalIndices,
          leaveMinRef.current,
          backMinRef.current,
          dayRef.current,
          index,
          computeRegionsIndices(regionsRef.current)
        );
        updateMarkers();
      });

      marker.addTo(shopsGroup);
    });

    // Initial state calculation and output sync
    const evalResInitial = evaluateState(
      radiusKmRef.current,
      leaveMinRef.current,
      backMinRef.current,
      dayRef.current
    );
    setCounts({
      inside: evalResInitial.insideCount,
      independent: evalResInitial.independentCount,
      openAndBack: evalResInitial.openAndBackCount,
    });
    syncOutputs(
      radiusKmRef.current,
      evalResInitial.insideIndices,
      evalResInitial.openOnArrivalIndices,
      leaveMinRef.current,
      backMinRef.current,
      dayRef.current,
      targetIndexRef.current,
      {}
    );

    updateMarkers();

    const onDataChange = () => {
      shopsRef.current = parseShopsFromModel();
      shopsGroup.clearLayers();
      shopsRef.current.forEach((shop, index) => {
        const marker = L.marker([shop.lat, shop.lon], {
          icon: L.divIcon({
            className: "custom-shop-marker",
            html: `<div style="width:0;height:0;"></div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        });
        marker.__shopIndex = index;
        marker.on("mouseover", () => setHoveredShop(shop));
        marker.on("mouseout", () => setHoveredShop(null));
        marker.on("click", () => {
          targetIndexRef.current = index;
          setTargetIndex(index);
          const ev = evaluateState(
            radiusKmRef.current,
            leaveMinRef.current,
            backMinRef.current,
            dayRef.current
          );
          syncOutputs(
            radiusKmRef.current,
            ev.insideIndices,
            ev.openOnArrivalIndices,
            leaveMinRef.current,
            backMinRef.current,
            dayRef.current,
            index,
            computeRegionsIndices(regionsRef.current)
          );
          updateMarkers();
        });
        marker.addTo(shopsGroup);
      });
      const ev = evaluateState(
        radiusKmRef.current,
        leaveMinRef.current,
        backMinRef.current,
        dayRef.current
      );
      setCounts({
        inside: ev.insideCount,
        independent: ev.independentCount,
        openAndBack: ev.openAndBackCount,
      });
      syncOutputs(
        radiusKmRef.current,
        ev.insideIndices,
        ev.openOnArrivalIndices,
        leaveMinRef.current,
        backMinRef.current,
        dayRef.current,
        targetIndexRef.current,
        computeRegionsIndices(regionsRef.current)
      );
      updateMarkers();
    };

    model.on("change:data", onDataChange);

    return () => {
      model.off("change:data", onDataChange);
      mapContainer.removeEventListener("mousedown", onMouseDownContainer);
      window.removeEventListener("mousemove", onMouseMoveContainer);
      window.removeEventListener("mouseup", onMouseUpContainer);
      map.remove();
    };
  }, []);

  // Update shop markers and outputs when dial/day/target/regions changes
  React.useEffect(() => {
    updateMarkers();
    const ev = evaluateState(radiusKm, leaveMin, backMin, day);
    setCounts({
      inside: ev.insideCount,
      independent: ev.independentCount,
      openAndBack: ev.openAndBackCount,
    });
    const regionsMap = computeRegionsIndices(regions);
    syncOutputs(
      radiusKm,
      ev.insideIndices,
      ev.openOnArrivalIndices,
      leaveMin,
      backMin,
      day,
      targetIndex,
      regionsMap
    );
  }, [leaveMin, backMin, day, targetIndex, regions]);

  const targetShop = shopsRef.current[targetIndex] || null;
  const regionsSummary = computeRegionsSummary();

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
        .custom-shop-marker, .vertex-handle-icon, .region-label-icon {
          background: none !important;
          border: none !important;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 520,
          border: `1px solid ${HAIRLINE_COLOR}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "1 1 auto",
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

        <TimeDial
          leaveMin={leaveMin}
          backMin={backMin}
          targetShop={targetShop}
          day={day}
          onLeaveChange={setLeaveMin}
          onBackChange={setBackMin}
          onDayChange={setDay}
          React={React}
        />
      </div>

      <RegionsTable
        regionsSummary={regionsSummary}
        hoveredRegionName={hoveredRegionName}
        onHoverRegion={setHoveredRegionName}
      />
    </div>
  );
}