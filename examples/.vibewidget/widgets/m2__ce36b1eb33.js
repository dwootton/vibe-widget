import * as d3 from "https://esm.sh/d3@7";

// Helper: parse day name to index 0=Mo..6=Su
const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseTime(str) {
  if (!str) return 0;
  const parts = str.split(":");
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function formatTime(min) {
  let m = Math.round(min) % 1440;
  if (m < 0) m += 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Parses OSM opening_hours string for given day index (0=Mo..6=Su) and target minute of day (0..1439)
// Returns: 'open' | 'closed' | 'unknown'
function checkOpen(hoursStr, dayIdx, targetMin) {
  if (!hoursStr || hoursStr.trim() === "") return "unknown";
  const str = hoursStr.trim();
  if (str === "24/7") return "open";

  const subrules = str.split(";").map((s) => s.trim()).filter(Boolean);
  let matchedRuleForDay = false;

  for (const rule of subrules) {
    // Check patterns: "Mo-Sa 04:00-14:00" or "05:00-20:00" or "Tu-Fr 10:00-18:00"
    const parts = rule.split(/\s+/);
    if (parts.length === 1 && rule.includes(":")) {
      // applies to all days: e.g. "05:00-20:00"
      matchedRuleForDay = true;
      const [startS, endS] = parts[0].split("-");
      const startM = parseTime(startS);
      const endM = parseTime(endS);
      if (startM <= endM) {
        if (targetMin >= startM && targetMin < endM) return "open";
      } else {
        // spans midnight
        if (targetMin >= startM || targetMin < endM) return "open";
      }
    } else if (parts.length >= 2) {
      const daySpec = parts[0];
      const timeSpecs = parts.slice(1).join(" ").split(",");

      // Parse days
      const daysInRule = new Set();
      const dayBlocks = daySpec.split(",");
      for (const block of dayBlocks) {
        if (block.includes("-")) {
          const [d1, d2] = block.split("-");
          const i1 = DAY_NAMES.indexOf(d1.trim());
          const i2 = DAY_NAMES.indexOf(d2.trim());
          if (i1 !== -1 && i2 !== -1) {
            let curr = i1;
            while (true) {
              daysInRule.add(curr);
              if (curr === i2) break;
              curr = (curr + 1) % 7;
            }
          }
        } else {
          const idx = DAY_NAMES.indexOf(block.trim());
          if (idx !== -1) daysInRule.add(idx);
        }
      }

      if (daysInRule.has(dayIdx)) {
        matchedRuleForDay = true;
        for (const tSpec of timeSpecs) {
          const [startS, endS] = tSpec.trim().split("-");
          if (!startS || !endS) continue;
          const startM = parseTime(startS);
          const endM = parseTime(endS);
          if (startM <= endM) {
            if (targetMin >= startM && targetMin < endM) return "open";
          } else {
            if (targetMin >= startM || targetMin < endM) return "open";
          }
        }
      }
    }
  }

  return matchedRuleForDay ? "closed" : "unknown";
}

// Convert minute (0..1440 or 0..720) to dial angle (radians clockwise from 12 o'clock)
function minToAngle(min) {
  // 12-hour clock: 720 minutes = 2 * PI
  const normMin = ((min % 720) + 720) % 720;
  return (normMin / 720) * 2 * Math.PI;
}

function angleToMin(rad) {
  // rad from top clockwise in [0, 2*PI)
  let a = rad % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return (a / (2 * Math.PI)) * 720;
}

export const DayRow = ({ React, currentDay, onSelectDay }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 8,
      }}
    >
      {DAY_NAMES.map((name, i) => {
        const isSelected = i === currentDay;
        return (
          <button
            key={name}
            onClick={() => onSelectDay(i)}
            style={{
              padding: "2px 7px",
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              borderRadius: 3,
              border: isSelected ? "1px solid #111827" : "1px solid #d1d5db",
              background: isSelected ? "#111827" : "#f9fafb",
              color: isSelected ? "#ffffff" : "#4b5563",
              cursor: "pointer",
              fontWeight: isSelected ? 600 : 400,
              lineHeight: "16px",
            }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
};

export const ClockDial = ({
  React,
  leaveMin,
  backMin,
  onChangeLeave,
  onChangeBack,
  targetShop,
  activeHandle,
  setActiveHandle,
  onNudge,
}) => {
  const svgRef = React.useRef(null);
  const isDraggingRef = React.useRef(null); // 'leave' | 'back' | null

  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const rimRadius = 70;
  const rLeave = rimRadius;
  const rBack = rimRadius + 14;

  const aLeave = minToAngle(leaveMin);
  const aBack = minToAngle(backMin);

  const leavePos = {
    x: cx + rLeave * Math.sin(aLeave),
    y: cy - rLeave * Math.cos(aLeave),
  };
  const backPos = {
    x: cx + rBack * Math.sin(aBack),
    y: cy - rBack * Math.cos(aBack),
  };

  const getPointerAngle = (e) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left - cx;
    const py = e.clientY - rect.top - cy;
    // Angle clockwise from 12 o'clock (top):
    let ang = Math.atan2(px, -py);
    if (ang < 0) ang += 2 * Math.PI;
    return ang;
  };

  const handlePointerDown = (e) => {
    if (!svgRef.current) return;
    svgRef.current.focus();

    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dLeave = Math.hypot(px - leavePos.x, py - leavePos.y);
    const dBack = Math.hypot(px - backPos.x, py - backPos.y);

    let chosen = null;
    if (dLeave <= 18 && dBack <= 18) {
      chosen = dLeave <= dBack ? "leave" : "back";
    } else if (dLeave <= 18) {
      chosen = "leave";
    } else if (dBack <= 18) {
      chosen = "back";
    }

    if (chosen) {
      isDraggingRef.current = chosen;
      setActiveHandle(chosen);
      svgRef.current.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const ang = getPointerAngle(e);
    const rawMin12 = angleToMin(ang);

    if (isDraggingRef.current === "leave") {
      const baseHour = Math.floor(leaveMin / 720) * 720;
      let newMin = Math.round(baseHour + rawMin12);
      if (Math.abs(newMin - leaveMin) > 400) {
        if (newMin < leaveMin) newMin += 720;
        else newMin -= 720;
      }
      newMin = ((newMin % 1440) + 1440) % 1440;
      onChangeLeave(newMin);
    } else {
      const baseHour = Math.floor(backMin / 720) * 720;
      let newMin = Math.round(baseHour + rawMin12);
      if (Math.abs(newMin - backMin) > 400) {
        if (newMin < backMin) newMin += 720;
        else newMin -= 720;
      }
      newMin = ((newMin % 1440) + 1440) % 1440;
      onChangeBack(newMin);
    }
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current) {
      try {
        svgRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
      isDraggingRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNudge(-15);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNudge(15);
    }
  };

  // Build faint wedge between leave and back
  // Arc from aLeave to aBack clockwise
  const wedgePath = React.useMemo(() => {
    let diff = aBack - aLeave;
    while (diff < 0) diff += 2 * Math.PI;
    const largeArc = diff > Math.PI ? 1 : 0;
    const x1 = cx + rimRadius * Math.sin(aLeave);
    const y1 = cy - rimRadius * Math.cos(aLeave);
    const x2 = cx + rimRadius * Math.sin(aBack);
    const y2 = cy - rimRadius * Math.cos(aBack);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${rimRadius} ${rimRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }, [aLeave, aBack, cx, cy, rimRadius]);

  // Target trip arc inside rim (radius ~ 64)
  const tripArcR = rimRadius - 5;
  const tripArcs = React.useMemo(() => {
    if (!targetShop) return null;
    const bMin = targetShop.bike_min || 0;
    const bBack = targetShop.bike_back || 0;
    const tArrive = leaveMin + bMin;
    const tEnd = leaveMin + bMin + 10 + bBack;

    const aStart = aLeave;
    const aEnd = minToAngle(tEnd);
    const aArrive = minToAngle(tArrive);

    // Any part past backMin is red
    const fitsBeforeBack = tEnd <= backMin;

    if (fitsBeforeBack) {
      let diff = aEnd - aStart;
      while (diff < 0) diff += 2 * Math.PI;
      const largeArc = diff > Math.PI ? 1 : 0;
      const x1 = cx + tripArcR * Math.sin(aStart);
      const y1 = cy - tripArcR * Math.cos(aStart);
      const x2 = cx + tripArcR * Math.sin(aEnd);
      const y2 = cy - tripArcR * Math.cos(aEnd);
      const d = `M ${x1} ${y1} A ${tripArcR} ${tripArcR} 0 ${largeArc} 1 ${x2} ${y2}`;
      return {
        blackArc: d,
        redArc: null,
        tArrive,
        aArrive,
      };
    } else {
      // Split into part before backMin and part after
      const aSplit = aBack;
      let diff1 = aSplit - aStart;
      while (diff1 < 0) diff1 += 2 * Math.PI;
      let diff2 = aEnd - aSplit;
      while (diff2 < 0) diff2 += 2 * Math.PI;

      const x1 = cx + tripArcR * Math.sin(aStart);
      const y1 = cy - tripArcR * Math.cos(aStart);
      const xm = cx + tripArcR * Math.sin(aSplit);
      const ym = cy - tripArcR * Math.cos(aSplit);
      const x2 = cx + tripArcR * Math.sin(aEnd);
      const y2 = cy - tripArcR * Math.cos(aEnd);

      const d1 = `M ${x1} ${y1} A ${tripArcR} ${tripArcR} 0 ${diff1 > Math.PI ? 1 : 0} 1 ${xm} ${ym}`;
      const d2 = `M ${xm} ${ym} A ${tripArcR} ${tripArcR} 0 ${diff2 > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
      return {
        blackArc: d1,
        redArc: d2,
        tArrive,
        aArrive,
      };
    }
  }, [targetShop, leaveMin, backMin, aLeave, aBack, cx, cy, tripArcR]);

  // Clock hour ticks
  const ticks = React.useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const ang = (i / 12) * 2 * Math.PI;
      const isMajor = i % 3 === 0;
      const len = isMajor ? 7 : 4;
      const x1 = cx + rimRadius * Math.sin(ang);
      const y1 = cy - rimRadius * Math.cos(ang);
      const x2 = cx + (rimRadius - len) * Math.sin(ang);
      const y2 = cy - (rimRadius - len) * Math.cos(ang);
      return { x1, y1, x2, y2, isMajor, num: i === 0 ? 12 : i };
    });
  }, [cx, cy, rimRadius]);

  const leaveLabelPos = {
    x: cx + (rLeave + 20) * Math.sin(aLeave),
    y: cy - (rLeave + 20) * Math.cos(aLeave),
  };
  const backLabelPos = {
    x: cx + (rBack + 18) * Math.sin(aBack),
    y: cy - (rBack + 18) * Math.cos(aBack),
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 250,
      }}
    >
      <svg
        ref={svgRef}
        tabIndex={0}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{
          outline: "none",
          cursor: "default",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {/* Clock Face Background */}
        <circle
          cx={cx}
          cy={cy}
          r={rimRadius}
          fill="#fbfcfd"
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />

        {/* Available time faint wedge */}
        <path d={wedgePath} fill="#0ea5e9" fillOpacity="0.1" />

        {/* Target trip arc */}
        {tripArcs && (
          <g>
            {tripArcs.blackArc && (
              <path
                d={tripArcs.blackArc}
                fill="none"
                stroke="#1e293b"
                strokeWidth="2.5"
              />
            )}
            {tripArcs.redArc && (
              <path
                d={tripArcs.redArc}
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
              />
            )}
            {/* Arrival tick and label */}
            <line
              x1={cx + (tripArcR - 4) * Math.sin(tripArcs.aArrive)}
              y1={cy - (tripArcR - 4) * Math.cos(tripArcs.aArrive)}
              x2={cx + (tripArcR + 4) * Math.sin(tripArcs.aArrive)}
              y2={cy - (tripArcR + 4) * Math.cos(tripArcs.aArrive)}
              stroke="#047857"
              strokeWidth="2"
            />
            <text
              x={cx + (tripArcR - 14) * Math.sin(tripArcs.aArrive)}
              y={cy - (tripArcR - 14) * Math.cos(tripArcs.aArrive) + 3}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#047857"
              fontWeight="600"
            >
              {formatTime(tripArcs.tArrive)}
            </text>
          </g>
        )}

        {/* Hour ticks and 12, 3, 6, 9 numbers */}
        {ticks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="#94a3b8"
              strokeWidth={t.isMajor ? 1.5 : 0.8}
            />
            {t.isMajor && (
              <text
                x={cx + (rimRadius - 16) * Math.sin((t.num / 12) * 2 * Math.PI)}
                y={
                  cy -
                  (rimRadius - 16) * Math.cos((t.num / 12) * 2 * Math.PI) +
                  3.5
                }
                textAnchor="middle"
                fontSize="10"
                fontFamily="sans-serif"
                fill="#64748b"
                fontWeight="500"
              >
                {t.num}
              </text>
            )}
          </g>
        ))}

        {/* Outer track for BACK BY handle */}
        <circle
          cx={cx}
          cy={cy}
          r={rBack}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* LEAVE handle (on rim) */}
        <g
          style={{ cursor: "grab" }}
          transform={`translate(${leavePos.x}, ${leavePos.y})`}
        >
          <circle
            r="8"
            fill="#0f172a"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.95"
          />
          <circle r="2.5" fill="#ffffff" />
        </g>
        {/* LEAVE hh:mm outside rim */}
        <text
          x={leaveLabelPos.x}
          y={leaveLabelPos.y + 4}
          textAnchor="middle"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill="#0f172a"
        >
          {formatTime(leaveMin)}
        </text>

        {/* BACK BY handle (14px outside rim) */}
        <g
          style={{ cursor: "grab" }}
          transform={`translate(${backPos.x}, ${backPos.y})`}
        >
          <circle
            r="8"
            fill="#d97706"
            stroke="#ffffff"
            strokeWidth="2"
            opacity="0.95"
          />
          <circle r="2.5" fill="#ffffff" />
        </g>
        {/* BACK BY hh:mm outside rim */}
        <text
          x={backLabelPos.x}
          y={backLabelPos.y + 4}
          textAnchor="middle"
          fontSize="10"
          fontFamily="ui-monospace, monospace"
          fontWeight="600"
          fill="#d97706"
        >
          {formatTime(backMin)}
        </text>
      </svg>

      {/* Target Shop Name in one line */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#1e293b",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: "100%",
          padding: "0 6px",
          minHeight: 18,
        }}
        title={targetShop ? targetShop.name : ""}
      >
        {targetShop ? targetShop.name : "Select a shop"}
      </div>
    </div>
  );
};

export default function VisualizationWidget({ model, React }) {
  const data = model.get("data") || [];
  const reach = model.get("reach") || {};

  // Dial / trip states
  // start Tuesday 06:30 (Tu = index 1), back 08:45
  const [dayIdx, setDayIdx] = React.useState(1);
  const [leaveMin, setLeaveMin] = React.useState(6 * 60 + 30);
  const [backMin, setBackMin] = React.useState(8 * 60 + 45);
  const [targetIdx, setTargetIdx] = React.useState(2); // start with data row 2
  const [activeHandle, setActiveHandle] = React.useState("leave"); // for arrow nudge

  // Map circle radius state (keep circle and count line)
  const [radiusKm, setRadiusKm] = React.useState(7.0);
  const [hoveredShop, setHoveredShop] = React.useState(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });

  const svgRef = React.useRef(null);
  const mapGroupRef = React.useRef(null);

  // Rows as array
  const rows = React.useMemo(() => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      // DataFrame dict-of-columns or dict-of-rows
      const keys = Object.keys(data);
      if (keys.length > 0 && typeof data[keys[0]] === "object") {
        const length = Object.keys(data[keys[0]]).length;
        const res = [];
        for (let i = 0; i < length; i++) {
          const row = {};
          keys.forEach((k) => {
            row[k] = data[k][i];
          });
          res.push(row);
        }
        return res;
      }
    }
    return [];
  }, [data]);

  // Hotel center estimation or minimum distance origin
  // From dataset km_from_hotel = 1.17 is Not Jus Donuts lat 29.74175, lon -95.35949
  // Actual downtown Houston coordinates: lat 29.752, lon -95.362
  const hotelCoords = React.useMemo(() => ({ lat: 29.7525, lon: -95.362 }), []);

  // Sync Outputs
  React.useEffect(() => {
    // calculate open_on_arrival
    const openArrivalList = [];
    rows.forEach((row, idx) => {
      if (row.km_from_hotel <= radiusKm) {
        const arrivalMin = leaveMin + (row.bike_min || 0);
        const st = checkOpen(row.hours, dayIdx, arrivalMin);
        if (st === "open") {
          openArrivalList.push(idx);
        }
      }
    });

    model.set("open_on_arrival", openArrivalList);
    model.set("when", { day: dayIdx, hhmm: formatTime(leaveMin) });
    model.set("back_by", formatTime(backMin));
    model.set("target", targetIdx);
    model.save_changes();
  }, [rows, radiusKm, leaveMin, backMin, dayIdx, targetIdx]);

  // Nudge active handle by +/- 15 min
  const handleNudge = (delta) => {
    if (activeHandle === "leave") {
      setLeaveMin((prev) => {
        let n = (prev + delta) % 1440;
        if (n < 0) n += 1440;
        return n;
      });
    } else {
      setBackMin((prev) => {
        let n = (prev + delta) % 1440;
        if (n < 0) n += 1440;
        return n;
      });
    }
  };

  // Dimensions
  const mapWidth = 520;
  const mapHeight = 440;

  // Map projection fitting all points & reach
  const projection = React.useMemo(() => {
    return d3
      .geoMercator()
      .center([-95.41, 29.75])
      .scale(38000)
      .translate([mapWidth / 2, mapHeight / 2]);
  }, [mapWidth, mapHeight]);

  const geoPath = React.useMemo(
    () => d3.geoPath().projection(projection),
    [projection]
  );

  // Bike reach bands: 30, 20, 10 min
  // Opacities: 6%, 9%, 12% (darker the closer)
  const bikeReachFeatures = React.useMemo(() => {
    if (!reach || !reach.bike || !reach.bike.features) return [];
    // Sort descending by contour so 30 is at bottom, 10 is on top
    const feats = [...reach.bike.features];
    feats.sort((a, b) => (b.properties?.contour || 0) - (a.properties?.contour || 0));
    return feats;
  }, [reach]);

  // Compute counts
  const counts = React.useMemo(() => {
    let inside = 0;
    let independent = 0;
    let openAndInTime = 0;

    rows.forEach((row) => {
      const isInside = row.km_from_hotel <= radiusKm;
      if (isInside) {
        inside++;
        if (!row.chain) independent++;

        const arrivalMin = leaveMin + (row.bike_min || 0);
        const roundTripFits =
          leaveMin + (row.bike_min || 0) + 10 + (row.bike_back || 0) <= backMin;
        const status = checkOpen(row.hours, dayIdx, arrivalMin);
        if (status === "open" && roundTripFits) {
          openAndInTime++;
        }
      }
    });

    return { inside, independent, openAndInTime };
  }, [rows, radiusKm, leaveMin, backMin, dayIdx]);

  // Hotel pixel center
  const hotelPixel = projection([hotelCoords.lon, hotelCoords.lat]);

  // Calculate pixel radius for circle km
  // At latitude 29.75, 1 deg lon ~ 96.6 km
  const kmCirclePx = React.useMemo(() => {
    if (!hotelPixel) return 100;
    const dest = projection([hotelCoords.lon + radiusKm / 96.6, hotelCoords.lat]);
    return Math.abs(dest[0] - hotelPixel[0]);
  }, [projection, hotelCoords, radiusKm, hotelPixel]);

  const targetShop = rows[targetIdx] || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        color: "#1e293b",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: "16px 20px",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        maxWidth: 820,
        margin: "0 auto",
      }}
    >
      {/* Count Line */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
          borderBottom: "1px solid #f1f5f9",
          paddingBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
          <span style={{ fontWeight: 600, color: "#0f172a" }}>
            {counts.inside}
          </span>{" "}
          inside ·{" "}
          <span style={{ fontWeight: 600, color: "#0f172a" }}>
            {counts.independent}
          </span>{" "}
          independent ·{" "}
          <span style={{ fontWeight: 600, color: "#047857" }}>
            {counts.openAndInTime}
          </span>{" "}
          open and back in time
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Radius: <b>{radiusKm.toFixed(1)} km</b>
        </div>
      </div>

      {/* Main visualization row: Map on left, Dial on right */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Map SVG */}
        <div style={{ position: "relative" }}>
          <svg
            ref={svgRef}
            width={mapWidth}
            height={mapHeight}
            style={{
              background: "#fafafa",
              borderRadius: 6,
              border: "1px solid #f1f5f9",
              display: "block",
            }}
          >
            {/* 1. Bike reach bands under shops */}
            <g className="reach-layers">
              {bikeReachFeatures.map((feat, idx) => {
                const contour = feat.properties?.contour || 30;
                // Opacities: 30m -> 0.06, 20m -> 0.09, 10m -> 0.12
                let opacity = 0.06;
                if (contour <= 10) opacity = 0.12;
                else if (contour <= 20) opacity = 0.09;

                return (
                  <path
                    key={idx}
                    d={geoPath(feat)}
                    fill="#475569"
                    fillOpacity={opacity}
                    stroke="#94a3b8"
                    strokeWidth="0.75"
                    strokeOpacity="0.4"
                  />
                );
              })}
            </g>

            {/* 2. KM Circle on top of bands */}
            {hotelPixel && (
              <g className="km-circle-layer">
                <circle
                  cx={hotelPixel[0]}
                  cy={hotelPixel[1]}
                  r={kmCirclePx}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.25"
                  strokeDasharray="4 3"
                />
                {/* Hotel marker */}
                <circle
                  cx={hotelPixel[0]}
                  cy={hotelPixel[1]}
                  r="3.5"
                  fill="#0f172a"
                />
                <circle
                  cx={hotelPixel[0]}
                  cy={hotelPixel[1]}
                  r="7"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
              </g>
            )}

            {/* 3. Shops */}
            <g className="shops-layer">
              {rows.map((shop, i) => {
                const pt = projection([shop.lon, shop.lat]);
                if (!pt) return null;
                const isInside = shop.km_from_hotel <= radiusKm;
                const arrivalMin = leaveMin + (shop.bike_min || 0);
                const roundTripFits =
                  leaveMin + (shop.bike_min || 0) + 10 + (shop.bike_back || 0) <=
                  backMin;
                const openStatus = checkOpen(shop.hours, dayIdx, arrivalMin);
                const isTarget = i === targetIdx;

                // Opacity: if round trip does not fit before BACK BY -> 35% opacity
                const opacity = roundTripFits ? 1 : 0.35;

                return (
                  <g
                    key={shop.osm_id || i}
                    transform={`translate(${pt[0]}, ${pt[1]})`}
                    style={{ cursor: "pointer", opacity }}
                    onClick={() => setTargetIdx(i)}
                    onMouseEnter={(e) => {
                      setHoveredShop(shop);
                      setTooltipPos({ x: pt[0], y: pt[1] });
                    }}
                    onMouseLeave={() => setHoveredShop(null)}
                  >
                    {/* Target thick ring */}
                    {isTarget && (
                      <circle
                        r="11"
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="2.5"
                      />
                    )}

                    {/* Shop dot/ring:
                        open -> solid dot & green label
                        closed -> hollow ring & red label
                        unknown -> dashed ring & grey label
                    */}
                    {openStatus === "open" && (
                      <circle
                        r="4.5"
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                    )}
                    {openStatus === "closed" && (
                      <circle
                        r="4.5"
                        fill="#ffffff"
                        stroke="#dc2626"
                        strokeWidth="2"
                      />
                    )}
                    {openStatus === "unknown" && (
                      <circle
                        r="4.5"
                        fill="#ffffff"
                        stroke="#64748b"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Shop arrival label: 'hh:mm' if inside circle */}
                    {isInside && (
                      <text
                        x="7"
                        y="3"
                        fontSize="9"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="600"
                        fill={
                          openStatus === "open"
                            ? "#059669"
                            : openStatus === "closed"
                            ? "#dc2626"
                            : "#64748b"
                        }
                      >
                        {formatTime(arrivalMin)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hover tooltip */}
          {hoveredShop && (
            <div
              style={{
                position: "absolute",
                left: Math.min(mapWidth - 160, tooltipPos.x + 12),
                top: Math.max(10, tooltipPos.y - 28),
                pointerEvents: "none",
                background: "rgba(15, 23, 42, 0.92)",
                color: "#ffffff",
                padding: "5px 9px",
                borderRadius: 4,
                fontSize: 11,
                lineHeight: "15px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.12)",
                zIndex: 10,
              }}
            >
              <div style={{ fontWeight: 600 }}>{hoveredShop.name}</div>
              <div style={{ color: "#cbd5e1", fontSize: 10 }}>
                {hoveredShop.hours || "Hours unknown"}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>
                Bike: {hoveredShop.bike_min}m out · {hoveredShop.bike_back}m back
              </div>
            </div>
          )}

          {/* Slider overlay for km circle */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.85)",
              padding: "3px 8px",
              borderRadius: 4,
              backdropFilter: "blur(2px)",
              fontSize: 11,
            }}
          >
            <span style={{ color: "#64748b" }}>Circle:</span>
            <input
              type="range"
              min="2"
              max="16"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              style={{ width: 80, height: 4, accentColor: "#475569" }}
            />
          </div>
        </div>

        {/* Dial & Day Controls on right */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 250,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#64748b",
              marginBottom: 4,
            }}
          >
            Schedule Dial
          </div>

          <ClockDial
            React={React}
            leaveMin={leaveMin}
            backMin={backMin}
            onChangeLeave={setLeaveMin}
            onChangeBack={setBackMin}
            targetShop={targetShop}
            activeHandle={activeHandle}
            setActiveHandle={setActiveHandle}
            onNudge={handleNudge}
          />

          <DayRow
            React={React}
            currentDay={dayIdx}
            onSelectDay={(idx) => setDayIdx(idx)}
          />

          <div
            style={{
              fontSize: 10,
              color: "#94a3b8",
              marginTop: 10,
              textAlign: "center",
              lineHeight: "14px",
            }}
          >
            Click dial to focus · ◄ / ► nudge 15m
            <br />
            LEAVE (ink) · BACK BY (amber)
          </div>
        </div>
      </div>
    </div>
  );
}