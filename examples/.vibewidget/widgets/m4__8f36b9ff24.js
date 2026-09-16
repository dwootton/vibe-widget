import * as d3 from "https://esm.sh/d3@7";

// Helper: parse minutes to HH:MM format
function minToHHMM(mins) {
  const norm = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Standalone Mode Switch
export const ModeSwitch = ({ React, mode, onModeChange }) => {
  const modes = [
    { key: "walk", label: "walk" },
    { key: "bike", label: "bike" },
    { key: "drive", label: "drive" }
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 12 }}>
      {modes.map((m, i) => (
        <React.Fragment key={m.key}>
          {i > 0 && <span style={{ color: "#9ca3af", fontSize: 13, userSelect: "none" }}>·</span>}
          <button
            type="button"
            onClick={() => onModeChange(m.key)}
            style={{
              background: "none",
              border: "none",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontWeight: mode === m.key ? 700 : 400,
              color: mode === m.key ? "#111827" : "#6b7280",
              textDecoration: mode === m.key ? "underline" : "none",
              textUnderlineOffset: 3
            }}
          >
            {m.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// Standalone Verdict lines under dial
export const VerdictLines = ({ React, leaveMins, targetShop, travelThere, travelBack, dwellMin, backByMins }) => {
  const arrMins = leaveMins + travelThere;
  const backMins = arrMins + dwellMin + travelBack;
  const backTimeStr = minToHHMM(backMins);
  const leaveStr = minToHHMM(leaveMins);
  const arrStr = minToHHMM(arrMins);
  const backByStr = minToHHMM(backByMins);

  const diffMins = Math.round(backByMins - backMins);
  const makesIt = diffMins >= 0;
  const diffAbs = Math.abs(diffMins);

  const targetName = (targetShop && targetShop.name) ? targetShop.name.toLowerCase() : "destination";

  return (
    <div style={{
      marginTop: 14,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.6,
      color: "#1f2937",
      wordBreak: "break-word",
      textAlign: "center",
      maxWidth: 290,
      margin: "12px auto 0 auto"
    }}>
      <div>
        {leaveStr} → {targetName} {arrStr}, open · {dwellMin} min · back {backTimeStr}
      </div>
      <div style={{ color: makesIt ? "#15803d" : "#dc2626", fontWeight: 600, marginTop: 3 }}>
        {makesIt ? `${diffAbs} min before ${backByStr}` : `${diffAbs} min after ${backByStr}`}
      </div>
    </div>
  );
};

// Standalone Dial Component
export const TimeDial = ({
  React,
  leaveMins,
  onLeaveChange,
  backByMins,
  onBackByChange,
  travelThere,
  travelBack,
  dwellMin
}) => {
  const svgRef = React.useRef(null);
  const isDraggingRef = React.useRef(null); // 'leave' | 'backBy'

  const totalMin = 1440;
  const radius = 95;
  const cx = 115;
  const cy = 115;

  const minToAngle = (m) => ((m % totalMin) / totalMin) * 2 * Math.PI - Math.PI / 2;
  const angleToMin = (angle) => {
    let a = angle + Math.PI / 2;
    while (a < 0) a += 2 * Math.PI;
    while (a >= 2 * Math.PI) a -= 2 * Math.PI;
    return (a / (2 * Math.PI)) * totalMin;
  };

  const arrMins = leaveMins + travelThere;
  const returnMins = arrMins + dwellMin + travelBack;

  // Arc path generator
  const getArcPath = (startM, endM, r) => {
    let span = endM - startM;
    if (span <= 0) span += totalMin;
    if (span >= totalMin) span = totalMin - 0.001;
    const a0 = minToAngle(startM);
    const a1 = a0 + (span / totalMin) * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const largeArc = span > totalMin / 2 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
  };

  const handlePointerDown = (handleKey, e) => {
    e.preventDefault();
    isDraggingRef.current = handleKey;
    const onPointerMove = (ev) => {
      if (!isDraggingRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const px = ev.clientX - rect.left - cx;
      const py = ev.clientY - rect.top - cy;
      const angle = Math.atan2(py, px);
      const rawMin = angleToMin(angle);
      // Snap to 5-minute increments
      const snappedMin = Math.round(rawMin / 5) * 5;
      if (isDraggingRef.current === "leave") {
        onLeaveChange(snappedMin % totalMin);
      } else if (isDraggingRef.current === "backBy") {
        onBackByChange(snappedMin % totalMin);
      }
    };
    const onPointerUp = () => {
      isDraggingRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Hour tick marks
  const hourTicks = [];
  for (let h = 0; h < 24; h++) {
    const a = minToAngle(h * 60);
    const isMajor = h % 6 === 0;
    const isMinor = h % 3 === 0;
    const rIn = isMajor ? radius - 10 : isMinor ? radius - 7 : radius - 4;
    const x1 = cx + radius * Math.cos(a);
    const y1 = cy + radius * Math.sin(a);
    const x2 = cx + rIn * Math.cos(a);
    const y2 = cy + rIn * Math.sin(a);
    hourTicks.push({ h, x1, y1, x2, y2, isMajor, a });
  }

  // Handle positions
  const leaveAngle = minToAngle(leaveMins);
  const lx = cx + radius * Math.cos(leaveAngle);
  const ly = cy + radius * Math.sin(leaveAngle);

  const backByAngle = minToAngle(backByMins);
  const bx = cx + radius * Math.cos(backByAngle);
  const by = cy + radius * Math.sin(backByAngle);

  // Arrival tick on rim
  const arrAngle = minToAngle(arrMins);
  const ax1 = cx + (radius - 5) * Math.cos(arrAngle);
  const ay1 = cy + (radius - 5) * Math.sin(arrAngle);
  const ax2 = cx + (radius + 5) * Math.cos(arrAngle);
  const ay2 = cy + (radius + 5) * Math.sin(arrAngle);

  // Hollow tick on rim at return time
  const retAngle = minToAngle(returnMins);
  const rx1 = cx + (radius - 7) * Math.cos(retAngle);
  const ry1 = cy + (radius - 7) * Math.sin(retAngle);
  const rx2 = cx + (radius + 7) * Math.cos(retAngle);
  const ry2 = cy + (radius + 7) * Math.sin(retAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        ref={svgRef}
        width={230}
        height={230}
        style={{ userSelect: "none", overflow: "visible", touchAction: "none" }}
      >
        {/* Background Rim */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={3} />

        {/* Hour ticks */}
        {hourTicks.map((t) => (
          <g key={t.h}>
            <line
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.isMajor ? "#4b5563" : "#d1d5db"}
              strokeWidth={t.isMajor ? 1.5 : 1}
            />
            {t.isMajor && (
              <text
                x={cx + (radius - 19) * Math.cos(t.a)}
                y={cy + (radius - 19) * Math.sin(t.a) + 3.5}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
                fontFamily="ui-monospace, monospace"
              >
                {t.h}
              </text>
            )}
          </g>
        ))}

        {/* Trip Arc: leave to return */}
        <path
          d={getArcPath(leaveMins, returnMins, radius)}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Arrival Tick along arc */}
        <line
          x1={ax1}
          y1={ay1}
          x2={ax2}
          y2={ay2}
          stroke="#1d4ed8"
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Hollow Tick on rim at back time */}
        <line
          x1={rx1}
          y1={ry1}
          x2={rx2}
          y2={ry2}
          stroke="#111827"
          strokeWidth={2}
          strokeDasharray="2,2"
        />

        {/* Leave Handle (Solid Accent Circle with hit area) */}
        <g
          style={{ cursor: "grab" }}
          onPointerDown={(e) => handlePointerDown("leave", e)}
        >
          <circle cx={lx} cy={ly} r={14} fill="transparent" />
          <circle cx={lx} cy={ly} r={6.5} fill="#3b82f6" stroke="#ffffff" strokeWidth={2} />
        </g>

        {/* Back By Handle (Dark Border Circle with hit area) */}
        <g
          style={{ cursor: "grab" }}
          onPointerDown={(e) => handlePointerDown("backBy", e)}
        >
          <circle cx={bx} cy={by} r={14} fill="transparent" />
          <circle cx={bx} cy={by} r={6.5} fill="#111827" stroke="#ffffff" strokeWidth={2} />
        </g>
      </svg>
      {/* Day row underneath dial */}
      <div style={{
        marginTop: 4,
        display: "flex",
        justifyContent: "space-between",
        width: 200,
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        color: "#6b7280"
      }}>
        <span>LEAVE {minToHHMM(leaveMins)}</span>
        <span>BACK BY {minToHHMM(backByMins)}</span>
      </div>
    </div>
  );
};

// Standalone Lasso Regions & Table Component
export const LassoTable = ({ React, shops, selectedShop, onSelectShop, mode }) => {
  return (
    <div style={{
      maxHeight: 180,
      overflowY: "auto",
      borderTop: "1px solid #f3f4f6",
      paddingTop: 8,
      fontSize: 11,
      fontFamily: "ui-monospace, monospace"
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead>
          <tr style={{ color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
            <th style={{ padding: "4px 6px", fontWeight: 500 }}>Shop</th>
            <th style={{ padding: "4px 6px", fontWeight: 500, textAlign: "right" }}>Km</th>
            <th style={{ padding: "4px 6px", fontWeight: 500, textAlign: "right" }}>Out</th>
            <th style={{ padding: "4px 6px", fontWeight: 500, textAlign: "right" }}>Back</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((s, idx) => {
            const isSelected = selectedShop && selectedShop._index === s._index;
            const minCol = `${mode}_min`;
            const backCol = `${mode}_back`;
            return (
              <tr
                key={s.osm_id || idx}
                onClick={() => onSelectShop(s)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? "#f3f4f6" : "transparent",
                  color: isSelected ? "#111827" : "#374151",
                  borderBottom: "1px solid #f9fafb"
                }}
              >
                <td style={{ padding: "4px 6px", maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.name}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: "#6b7280" }}>
                  {s.km_from_hotel != null ? Number(s.km_from_hotel).toFixed(1) : "-"}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                  {s[minCol] != null ? `${Math.round(s[minCol])}m` : "-"}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right" }}>
                  {s[backCol] != null ? `${Math.round(s[backCol])}m` : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Main interactive widget
export default function Widget({ model, React }) {
  // Inputs from model
  const rawData = model.get("data");
  const reachInput = model.get("reach") || {};
  const routesInput = model.get("routes") || {};

  // Normalise shops data array
  const shops = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData.map((d, i) => ({ ...d, _index: i }));
    // DataFrame in columns format or records
    if (rawData.columns && rawData.data) {
      return rawData.data.map((row, i) => {
        const obj = { _index: i };
        rawData.columns.forEach((col, cIdx) => {
          obj[col] = row[cIdx];
        });
        return obj;
      });
    }
    // Object with column arrays
    const keys = Object.keys(rawData);
    if (keys.length > 0 && Array.isArray(rawData[keys[0]])) {
      const len = rawData[keys[0]].length;
      const arr = [];
      for (let i = 0; i < len; i++) {
        const obj = { _index: i };
        keys.forEach((k) => {
          obj[k] = rawData[k][i];
        });
        arr.push(obj);
      }
      return arr;
    }
    return [];
  }, [rawData]);

  // Widget state
  const [mode, setMode] = React.useState("bike"); // start on bike
  const [targetIndex, setTargetIndex] = React.useState(() => {
    // default target: Christy's if exists, else first row
    const found = shops.findIndex((s) => s.name && s.name.toLowerCase().includes("christy"));
    return found >= 0 ? found : 0;
  });

  // Time state in minutes from midnight (06:30 = 390, 07:30 = 450)
  const [leaveMins, setLeaveMins] = React.useState(390);
  const [backByMins, setBackByMins] = React.useState(450);
  const dwellMin = 10;

  // Hotel location
  const hotelCoord = [29.7518, -95.3571]; // Downtown Houston

  // Active target shop
  const targetShop = shops[targetIndex] || shops[0] || null;

  // Selected mode travel times
  const travelThere = targetShop ? (Number(targetShop[`${mode}_min`]) || 15) : 15;
  const travelBack = targetShop ? (Number(targetShop[`${mode}_back`]) || 15) : 15;

  const returnMins = leaveMins + travelThere + dwellMin + travelBack;
  const backHHMM = minToHHMM(returnMins);
  const makesIt = returnMins <= backByMins;

  // Synchronise Python outputs
  React.useEffect(() => {
    model.set("mode", mode);
    model.set("back_hhmm", backHHMM);
    model.set("makes_it", makesIt);
    model.save_changes();
  }, [mode, backHHMM, makesIt]);

  // Listen to external trait changes
  React.useEffect(() => {
    const onTraitChange = () => {
      // Re-render if model updates externally
    };
    model.on("change:data", onTraitChange);
    model.on("change:reach", onTraitChange);
    model.on("change:routes", onTraitChange);
    return () => {
      model.off("change:data", onTraitChange);
      model.off("change:reach", onTraitChange);
      model.off("change:routes", onTraitChange);
    };
  }, []);

  // Map SVG Ref and rendering
  const mapSvgRef = React.useRef(null);
  const [lassoFilteredIndices, setLassoFilteredIndices] = React.useState(null);

  // Compute map projection
  const width = 450;
  const height = 480;

  const projection = React.useMemo(() => {
    return d3.geoMercator()
      .center([-95.405, 29.755])
      .scale(62000)
      .translate([width / 2, height / 2]);
  }, [width, height]);

  const pathGen = React.useMemo(() => d3.geoPath().projection(projection), [projection]);

  // Hotel screen point
  const hotelPos = projection([hotelCoord[1], hotelCoord[0]]) || [width / 2, height / 2];

  // Reach bands for current mode
  const currentReach = reachInput[mode] || null;

  // Route points for current mode and target shop
  const currentRoute = React.useMemo(() => {
    const modeRoutes = routesInput[mode];
    if (!modeRoutes) return null;
    const r = modeRoutes[targetIndex];
    if (r && Array.isArray(r) && r.length > 0) return r;
    return null;
  }, [routesInput, mode, targetIndex]);

  // Calculate route SVG path and midpoint for label
  const { routePathString, midLabelPos, routeMidMin } = React.useMemo(() => {
    if (!currentRoute || currentRoute.length === 0) {
      return { routePathString: null, midLabelPos: null, routeMidMin: null };
    }
    const coords = currentRoute.map((pt) => projection([pt[1], pt[0]]));
    const pathStr = d3.line()
      .x((d) => d[0])
      .y((d) => d[1])(coords);

    const midIdx = Math.floor(coords.length / 2);
    const midPoint = coords[midIdx] || coords[0];
    const nMin = Math.round(travelThere);

    return {
      routePathString: pathStr,
      midLabelPos: [midPoint[0] + 12, midPoint[1] - 8],
      routeMidMin: nMin
    };
  }, [currentRoute, projection, travelThere]);

  // Lasso interaction logic
  const [lassoPolygon, setLassoPolygon] = React.useState(null);
  const lassoActiveRef = React.useRef(false);
  const lassoPointsRef = React.useRef([]);

  const handleMapPointerDown = (e) => {
    // Only start lasso if shift key is pressed or clicking map background
    if (e.target.tagName !== "svg" && e.target.id !== "map-bg") return;
    lassoActiveRef.current = true;
    const rect = mapSvgRef.current.getBoundingClientRect();
    const pt = [e.clientX - rect.left, e.clientY - rect.top];
    lassoPointsRef.current = [pt];
    setLassoPolygon([pt]);

    const onPointerMove = (ev) => {
      if (!lassoActiveRef.current) return;
      const curPt = [ev.clientX - rect.left, ev.clientY - rect.top];
      lassoPointsRef.current.push(curPt);
      setLassoPolygon([...lassoPointsRef.current]);
    };

    const onPointerUp = () => {
      lassoActiveRef.current = false;
      const pts = lassoPointsRef.current;
      if (pts.length > 3) {
        // Find shops inside polygon
        const selected = [];
        shops.forEach((s) => {
          const pos = projection([s.lon, s.lat]);
          if (pos && d3.polygonContains(pts, pos)) {
            selected.push(s._index);
          }
        });
        setLassoFilteredIndices(selected.length > 0 ? selected : null);
      } else {
        setLassoFilteredIndices(null);
      }
      setLassoPolygon(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const displayedShops = React.useMemo(() => {
    if (!lassoFilteredIndices) return shops;
    return shops.filter((s) => lassoFilteredIndices.includes(s._index));
  }, [shops, lassoFilteredIndices]);

  const fittingCount = shops.filter((s) => {
    const tOut = Number(s[`${mode}_min`]) || 0;
    const tRet = Number(s[`${mode}_back`]) || 0;
    return (leaveMins + tOut + dwellMin + tRet) <= backByMins;
  }).length;

  return (
    <div style={{
      display: "flex",
      flexDirection: "row",
      gap: 16,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: "#ffffff",
      color: "#111827",
      padding: 16,
      borderRadius: 8,
      boxSizing: "border-box"
    }}>
      {/* Map Column */}
      <div style={{ position: "relative", width: 450, height: 480, border: "1px solid #f3f4f6", borderRadius: 6, overflow: "hidden" }}>
        {/* Count line indicator */}
        <div style={{
          position: "absolute",
          top: 10,
          left: 12,
          zIndex: 10,
          fontSize: 12,
          fontFamily: "ui-monospace, monospace",
          color: "#4b5563",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "2px 6px",
          borderRadius: 4
        }}>
          {fittingCount} of {shops.length} shops back by {minToHHMM(backByMins)}
        </div>

        <svg
          ref={mapSvgRef}
          id="map-bg"
          width={width}
          height={height}
          onPointerDown={handleMapPointerDown}
          style={{ cursor: "crosshair", display: "block" }}
        >
          {/* Background circle / bounds */}
          <circle cx={hotelPos[0]} cy={hotelPos[1]} r={210} fill="#f9fafb" stroke="#e5e7eb" strokeWidth={1} />

          {/* Isochrone / Reach bands */}
          {currentReach && currentReach.features && (
            <g style={{ pointerEvents: "none" }}>
              {currentReach.features.map((feat, idx) => {
                const pathD = pathGen(feat);
                const fillCol = feat.properties?.fillColor || feat.properties?.fill || "#cbd5e1";
                const op = feat.properties?.["fill-opacity"] || feat.properties?.fillOpacity || 0.2;
                return (
                  <path
                    key={idx}
                    d={pathD}
                    fill={fillCol}
                    fillOpacity={op}
                    stroke={fillCol}
                    strokeWidth={0.8}
                    strokeOpacity={op * 1.5}
                  />
                );
              })}
            </g>
          )}

          {/* Street Route Hotel -> Target (2px accent line above bands) */}
          {routePathString && (
            <g style={{ pointerEvents: "none" }}>
              <path
                d={routePathString}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {midLabelPos && (
                <g transform={`translate(${midLabelPos[0]}, ${midLabelPos[1]})`}>
                  {/* Halo rect */}
                  <rect
                    x={-4}
                    y={-10}
                    width={48}
                    height={15}
                    fill="#ffffff"
                    rx={3}
                    opacity={0.95}
                  />
                  <text
                    x={20}
                    y={1}
                    textAnchor="middle"
                    fill="#1e40af"
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={600}
                  >
                    {routeMidMin} min
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Lasso polygon overlay */}
          {lassoPolygon && lassoPolygon.length > 1 && (
            <polygon
              points={lassoPolygon.map((p) => p.join(",")).join(" ")}
              fill="rgba(59, 130, 246, 0.1)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          )}

          {/* Hotel Marker Pin */}
          <g transform={`translate(${hotelPos[0]}, ${hotelPos[1]})`} style={{ pointerEvents: "none" }}>
            <circle r={6} fill="#111827" stroke="#ffffff" strokeWidth={2} />
            <circle r={2} fill="#ffffff" />
          </g>

          {/* Shop Pins and Arrival Labels */}
          {shops.map((s) => {
            const pos = projection([s.lon, s.lat]);
            if (!pos) return null;
            const isTarget = targetShop && targetShop._index === s._index;
            const outMin = Number(s[`${mode}_min`]) || 0;
            const backMin = Number(s[`${mode}_back`]) || 0;
            const totalTrip = leaveMins + outMin + dwellMin + backMin;
            const fits = totalTrip <= backByMins;
            const opacity = fits ? 1.0 : 0.35; // 35% fading of shops that do not fit
            const arrTimeStr = minToHHMM(leaveMins + outMin);

            return (
              <g
                key={s.osm_id || s._index}
                transform={`translate(${pos[0]}, ${pos[1]})`}
                onClick={() => setTargetIndex(s._index)}
                style={{ cursor: "pointer", opacity }}
              >
                {/* Target highlight circle */}
                {isTarget && (
                  <circle r={11} fill="none" stroke="#2563eb" strokeWidth={1.8} strokeDasharray="3,2" />
                )}
                {/* Pin circle */}
                <circle
                  r={isTarget ? 5 : 3.5}
                  fill={isTarget ? "#2563eb" : fits ? "#111827" : "#9ca3af"}
                  stroke="#ffffff"
                  strokeWidth={1}
                />
                {/* Arrival label */}
                <text
                  x={7}
                  y={3}
                  fontSize={9}
                  fill={isTarget ? "#1e40af" : "#4b5563"}
                  fontWeight={isTarget ? 700 : 400}
                  fontFamily="ui-monospace, monospace"
                  style={{ userSelect: "none" }}
                >
                  {arrTimeStr}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dial & Info Column */}
      <div style={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}>
        <div>
          {/* Mode switch above dial */}
          <ModeSwitch React={React} mode={mode} onModeChange={setMode} />

          {/* Time dial with both handles and day row */}
          <TimeDial
            React={React}
            leaveMins={leaveMins}
            onLeaveChange={setLeaveMins}
            backByMins={backByMins}
            onBackByChange={setBackByMins}
            travelThere={travelThere}
            travelBack={travelBack}
            dwellMin={dwellMin}
          />

          {/* Monospace verdict lines under dial */}
          <VerdictLines
            React={React}
            leaveMins={leaveMins}
            targetShop={targetShop}
            travelThere={travelThere}
            travelBack={travelBack}
            dwellMin={dwellMin}
            backByMins={backByMins}
          />
        </div>

        {/* Lasso filtered shop table */}
        <LassoTable
          React={React}
          shops={displayedShops}
          selectedShop={targetShop}
          onSelectShop={(s) => setTargetIndex(s._index)}
          mode={mode}
        />
      </div>
    </div>
  );
}