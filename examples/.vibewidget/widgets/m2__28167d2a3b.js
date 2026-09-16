import * as d3 from "https://esm.sh/d3@7";
import L from "https://esm.sh/leaflet@1.9.4";

export const Badge = ({ insideCount = 0, independentCount = 0, openCount = 0 }) => (
  <div
    style={{
      position: "absolute",
      top: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.95)",
      backdropFilter: "blur(6px)",
      border: "1.5px solid #1c1917",
      boxShadow: "3px 3px 0px #1c1917",
      padding: "7px 13px",
      borderRadius: "4px",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0.02em",
      color: "#1c1917",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: "9px",
        height: "9px",
        borderRadius: "50%",
        background: "#16a34a",
        boxShadow: "0 0 0 2px #dcfce7",
      }}
    />
    <span>
      {insideCount} inside <span style={{ opacity: 0.45 }}>·</span>{" "}
      {independentCount} independent <span style={{ opacity: 0.45 }}>·</span>{" "}
      <span style={{ color: "#15803d" }}>{openCount} open on arrival</span>
    </span>
  </div>
);

export const Legend = () => (
  <div
    style={{
      position: "absolute",
      bottom: 14,
      left: 14,
      zIndex: 1000,
      background: "rgba(253, 251, 247, 0.94)",
      backdropFilter: "blur(6px)",
      border: "1px solid #292524",
      padding: "8px 12px",
      borderRadius: "4px",
      boxShadow: "2px 2px 0px #292524",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "11px",
      color: "#1c1917",
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      pointerEvents: "auto",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "#16a34a",
          border: "1px solid #14532d",
          display: "inline-block",
        }}
      />
      <span>Open on arrival (solid)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "#ffffff",
          border: "2px solid #dc2626",
          display: "inline-block",
          boxSizing: "border-box",
        }}
      />
      <span>Closed on arrival (hollow)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "#ffffff",
          border: "1.5px dashed #78716c",
          display: "inline-block",
          boxSizing: "border-box",
        }}
      />
      <span>Unknown hours (dashed)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          width: 14,
          height: 7,
          background: "rgba(30, 64, 175, 0.45)",
          border: "1px solid #1e3a8a",
          borderRadius: "1px",
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: "10px", color: "#475569" }}>Bike reach (10/20/30m)</span>
    </div>
  </div>
);

export const InfoTooltip = ({ shop, arrivalTimeStr, status }) => {
  if (!shop) return null;
  const statusColor =
    status === "open" ? "#16a34a" : status === "closed" ? "#dc2626" : "#78716c";
  const statusText =
    status === "open"
      ? "OPEN ON ARRIVAL"
      : status === "closed"
      ? "CLOSED ON ARRIVAL"
      : "HOURS UNKNOWN";

  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        zIndex: 1000,
        maxWidth: "260px",
        background: "#fdfbf7",
        border: "1.5px solid #1c1917",
        boxShadow: "3px 3px 0px #1c1917",
        padding: "10px 14px",
        borderRadius: "4px",
        fontFamily: "'Courier New', Courier, monospace",
        color: "#1c1917",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "15px",
          fontWeight: "700",
          marginBottom: "3px",
          lineHeight: "1.2",
          color: "#0c0a09",
        }}
      >
        {shop.name}
      </div>
      <div style={{ fontSize: "10.5px", color: "#57534e", marginBottom: "4px" }}>
        {shop.street ? shop.street : "Street not listed"}
      </div>
      <div
        style={{
          fontSize: "10.5px",
          fontWeight: "700",
          color: statusColor,
          marginBottom: "4px",
          letterSpacing: "0.03em",
        }}
      >
        ● {statusText} {arrivalTimeStr ? `(${arrivalTimeStr})` : ""}
      </div>
      <div
        style={{
          fontSize: "10px",
          color: shop.hours ? "#292524" : "#a8a29e",
          borderTop: "1px dashed #d6d3d1",
          paddingTop: "4px",
          marginTop: "4px",
          lineHeight: "1.3",
        }}
      >
        {shop.hours ? `Hours: ${shop.hours}` : "Hours unlisted"}
      </div>
      <div
        style={{
          fontSize: "10px",
          marginTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          color: "#ea580c",
          fontWeight: "bold",
        }}
      >
        <span>{shop.chain ? "Chain" : "Independent"}</span>
        <span>
          {shop.bike_min != null ? `🚴 ${Math.round(shop.bike_min)}m` : ""}
          {shop.km_from_hotel != null ? ` (${Number(shop.km_from_hotel).toFixed(1)}km)` : ""}
        </span>
      </div>
    </div>
  );
};

export const ClockDial = ({
  leaveMinutes = 390,
  day = "Tu",
  onChangeTime,
  onChangeDay,
  onNudge,
}) => {
  const svgRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const width = 188;
  const height = 188;
  const cx = width / 2;
  const cy = height / 2;
  const r = 78;

  // 1440 min in 24h. 00:00 is top (-90 deg / 0 deg from 12 o'clock)
  const angleDeg = (leaveMinutes / 1440) * 360;
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const handLength = r - 18;
  const handX = cx + handLength * Math.cos(angleRad);
  const handY = cy + handLength * Math.sin(angleRad);

  const hours24 = Math.floor(leaveMinutes / 60) % 24;
  const mins = leaveMinutes % 60;
  const hhmm = `${String(hours24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  const setTimeFromPointer = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    let rad = Math.atan2(y, x); // -pi to pi from +x axis (3 o'clock)
    let deg = (rad * 180) / Math.PI + 90; // 0 at top (12 o'clock)
    if (deg < 0) deg += 360;
    deg = deg % 360;
    // Map deg to minutes (snap to closest minute)
    let minutes = Math.round((deg / 360) * 1440) % 1440;
    if (onChangeTime) onChangeTime(minutes);
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    if (containerRef.current) containerRef.current.focus();
    setTimeFromPointer(e);

    const onMove = (moveEvt) => {
      if (!isDraggingRef.current) return;
      setTimeFromPointer(moveEvt);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      if (onNudge) onNudge(-15);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      if (onNudge) onNudge(15);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        outline: "none",
        userSelect: "none",
        padding: "10px 8px 12px 8px",
        background: "#fdfbf7",
        borderRadius: "6px",
        border: "1.5px solid #292524",
        boxShadow: "3px 3px 0px #1c1917",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "12.5px",
          fontWeight: "800",
          letterSpacing: "0.04em",
          color: "#0c0a09",
          textTransform: "uppercase",
          marginBottom: "2px",
        }}
      >
        Leave Hotel
      </div>
      <div
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "20px",
          fontWeight: "800",
          color: "#ea580c",
          letterSpacing: "0.06em",
          marginBottom: "4px",
        }}
      >
        {hhmm}
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        style={{ cursor: "pointer", touchAction: "none" }}
      >
        {/* Dial Face */}
        <circle cx={cx} cy={cy} r={r} fill="#fffdfa" stroke="#292524" strokeWidth="2" />
        <circle
          cx={cx}
          cy={cy}
          r={r - 1}
          fill="none"
          stroke="#e7e5e4"
          strokeWidth="18"
        />

        {/* 24 Hour ticks & numerals */}
        {Array.from({ length: 24 }).map((_, h) => {
          const a = ((h / 24) * 360 - 90) * (Math.PI / 180);
          const isMajor = h % 3 === 0;
          const tickLen = isMajor ? 8 : 4;
          const x1 = cx + (r - 2) * Math.cos(a);
          const y1 = cy + (r - 2) * Math.sin(a);
          const x2 = cx + (r - 2 - tickLen) * Math.cos(a);
          const y2 = cy + (r - 2 - tickLen) * Math.sin(a);

          const textR = r - 15;
          const tx = cx + textR * Math.cos(a);
          const ty = cy + textR * Math.sin(a);

          return (
            <g key={h}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMajor ? "#1c1917" : "#a8a29e"}
                strokeWidth={isMajor ? 1.5 : 1}
              />
              {isMajor && (
                <text
                  x={tx}
                  y={ty}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9px"
                  fontFamily="'Courier New', Courier, monospace"
                  fontWeight="700"
                  fill="#44403c"
                >
                  {h}
                </text>
              )}
            </g>
          );
        })}

        {/* Hour Hand */}
        <line
          x1={cx}
          y1={cy}
          x2={handX}
          y2={handY}
          stroke="#ea580c"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx={handX} cy={handY} r={5.5} fill="#ea580c" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r={4.5} fill="#1c1917" />
      </svg>

      {/* Day Buttons Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          marginTop: "6px",
          gap: "2px",
        }}
      >
        {days.map((d) => {
          const isSel = d === day;
          return (
            <button
              key={d}
              onClick={() => onChangeDay(d)}
              style={{
                flex: "1 1 0",
                padding: "3px 0",
                fontSize: "11px",
                fontFamily: "'Courier New', Courier, monospace",
                fontWeight: isSel ? "800" : "600",
                color: isSel ? "#fafaf9" : "#292524",
                background: isSel ? "#1c1917" : "#f5f5f4",
                border: "1px solid #1c1917",
                borderRadius: "3px",
                cursor: "pointer",
                boxShadow: isSel ? "inset 0 1px 2px rgba(0,0,0,0.3)" : "none",
                transition: "background 0.12s ease",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div
        style={{
          fontSize: "9px",
          color: "#78716c",
          marginTop: "6px",
          fontFamily: "'Courier New', Courier, monospace",
        }}
      >
        [← / →] nudge 15m
      </div>
    </div>
  );
};

// Parser for OSM opening_hours string
export function checkIsOpen(hoursStr, dayOfWeek, minuteOfDay) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return "unknown";
  }
  const clean = hoursStr.trim();
  if (clean === "24/7") return "open";

  const dayMap = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 7 };
  const targetDayIdx = dayMap[dayOfWeek] || 1;

  // Split multiple clauses by semicolon
  const clauses = clean.split(";").map((s) => s.trim()).filter(Boolean);

  let matchedAnyClause = false;
  let isOpenNow = false;

  for (const clause of clauses) {
    // Pattern example: "Mo-Sa 04:00-14:00", "Su 05:00-14:00", "05:00-20:00", "Tu-Fr 10:00-18:00"
    // Match optional day part and time part
    const m = clause.match(/^([A-Za-z,\s-]+)?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;

    const dayPart = m[1] ? m[1].trim() : null;
    const startStr = m[2];
    const endStr = m[3];

    const [sH, sM] = startStr.split(":").map(Number);
    const [eH, eM] = endStr.split(":").map(Number);
    const startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    // Handle overnight span like 22:00-04:00
    if (endMin <= startMin && endMin !== 0) {
      endMin += 1440;
    }

    let appliesToTargetDay = false;
    if (!dayPart) {
      // Applies every day
      appliesToTargetDay = true;
    } else {
      // Day tokens could be "Mo-Sa", "Tu,Th", "Su"
      const subDays = dayPart.split(",").map((s) => s.trim());
      for (const sd of subDays) {
        if (sd.includes("-")) {
          const [d1, d2] = sd.split("-").map((s) => s.trim());
          const idx1 = dayMap[d1];
          const idx2 = dayMap[d2];
          if (idx1 && idx2) {
            if (idx1 <= idx2) {
              if (targetDayIdx >= idx1 && targetDayIdx <= idx2) {
                appliesToTargetDay = true;
                break;
              }
            } else {
              // Wrap around week (e.g. Sa-Tu)
              if (targetDayIdx >= idx1 || targetDayIdx <= idx2) {
                appliesToTargetDay = true;
                break;
              }
            }
          }
        } else if (dayMap[sd] === targetDayIdx) {
          appliesToTargetDay = true;
          break;
        }
      }
    }

    if (appliesToTargetDay) {
      matchedAnyClause = true;
      let checkMin = minuteOfDay;
      if (checkMin >= startMin && checkMin <= endMin) {
        isOpenNow = true;
        break;
      }
      // Also check overnight wrap
      if (endMin > 1440 && checkMin + 1440 <= endMin) {
        isOpenNow = true;
        break;
      }
    }
  }

  if (isOpenNow) return "open";
  if (matchedAnyClause) return "closed";
  return "unknown";
}

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const hotelPos = React.useMemo(() => [29.7522, -95.3578], []);

  // Time & Day state: Start Tue 06:30 (390 min)
  const [leaveMinutes, setLeaveMinutes] = React.useState(390);
  const [leaveDay, setLeaveDay] = React.useState("Tu");

  const leaveMinutesRef = React.useRef(390);
  leaveMinutesRef.current = leaveMinutes;
  const leaveDayRef = React.useRef("Tu");
  leaveDayRef.current = leaveDay;

  // Raw data from model
  const [rawIsochrones, setRawIsochrones] = React.useState(() => model.get("isochrones"));
  const [rawData, setRawData] = React.useState(() => model.get("data"));

  React.useEffect(() => {
    const onIsoChange = () => setRawIsochrones(model.get("isochrones"));
    const onDataChange = () => setRawData(model.get("data"));
    model.on("change:isochrones", onIsoChange);
    model.on("change:data", onDataChange);
    return () => {
      model.off("change:isochrones", onIsoChange);
      model.off("change:data", onDataChange);
    };
  }, [model]);

  const data = React.useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === "object") {
      const keys = Object.keys(rawData);
      if (keys.length === 0) return [];
      const len = Array.isArray(rawData[keys[0]])
        ? rawData[keys[0]].length
        : Object.keys(rawData[keys[0]]).length;
      const rows = [];
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = rawData[k][i] !== undefined ? rawData[k][i] : rawData[k][String(i)];
        }
        rows.push(row);
      }
      return rows;
    }
    return [];
  }, [rawData]);

  const [hoveredShopInfo, setHoveredShopInfo] = React.useState(null);
  const [stats, setStats] = React.useState({ insideCount: 0, independentCount: 0, openCount: 0 });

  // Map elements refs
  const circleRef = React.useRef(null);
  const hitCircleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const isochroneLayerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const radiusKmRef = React.useRef(3.5);
  const isDraggingRef = React.useRef(false);

  // Initialize CSS stylesheet once
  React.useEffect(() => {
    const linkId = "leaflet-css-bundle";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const styleId = "leaflet-custom-styles-clock";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .leaflet-grab { cursor: grab; }
        .leaflet-dragging .leaflet-grab { cursor: grabbing; }
        .radius-label-handle {
          background: transparent !important;
          border: none !important;
          user-select: none;
        }
        .radius-badge-pill {
          background: #1c1917;
          color: #fafaf9;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 12px;
          white-space: nowrap;
          border: 1.5px solid #ea580c;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          cursor: ew-resize;
          transform: translate(-50%, -50%);
          display: inline-block;
          pointer-events: auto;
          transition: transform 0.1s ease, background 0.1s ease;
        }
        .radius-badge-pill:hover, .radius-badge-pill.active {
          transform: translate(-50%, -50%) scale(1.1);
          background: #ea580c;
          color: #ffffff;
        }
        .hotel-pin-custom {
          background: #09090b;
          border: 2px solid #fdfbf7;
          border-radius: 50% 50% 50% 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          transform: rotate(-45deg);
        }
        .shop-time-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-family: 'Courier New', Courier, monospace !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          padding: 1px 3px !important;
          border-radius: 3px !important;
          white-space: nowrap !important;
        }
        .shop-time-label-open {
          color: #15803d !important;
          background: rgba(240, 253, 244, 0.9) !important;
          border: 1px solid #86efac !important;
        }
        .shop-time-label-closed {
          color: #b91c1c !important;
          background: rgba(254, 242, 242, 0.9) !important;
          border: 1px solid #fca5a5 !important;
        }
        .shop-time-label-unknown {
          color: #57534e !important;
          background: rgba(245, 245, 244, 0.9) !important;
          border: 1px solid #d6d3d1 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const getPerimeterPoint = React.useCallback((centerLatLng, radiusMeters, bearingDeg = 90) => {
    const R = 6378137;
    const δ = radiusMeters / R;
    const θ = (bearingDeg * Math.PI) / 180;
    const φ1 = (centerLatLng[0] * Math.PI) / 180;
    const λ1 = (centerLatLng[1] * Math.PI) / 180;

    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
      );

    return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
  }, []);

  // Update shop marker styling, labels, and sync traits
  const updateVisualState = React.useCallback(
    (currentRadiusKm, currentMinutes, currentDay) => {
      const hotelLatLng = L.latLng(hotelPos[0], hotelPos[1]);
      const currentRadiusMeters = currentRadiusKm * 1000;
      const insideIndices = [];
      const openIndices = [];
      let insideCount = 0;
      let independentCount = 0;
      let openCount = 0;

      shopMarkersRef.current.forEach(({ marker, shop, index }) => {
        const d = hotelLatLng.distanceTo(L.latLng(shop.lat, shop.lon));
        const isInside = d <= currentRadiusMeters;

        // Arrival time at shop = leave time + bike_min
        const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
        const arrivalTotalMin = (currentMinutes + bikeMin) % 1440;
        const arrH = Math.floor(arrivalTotalMin / 60);
        const arrM = arrivalTotalMin % 60;
        const arrStr = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`;

        const status = checkIsOpen(shop.hours, currentDay, arrivalTotalMin);

        if (isInside) {
          insideIndices.push(index);
          insideCount += 1;
          if (!shop.chain) independentCount += 1;
          if (status === "open") {
            openIndices.push(index);
            openCount += 1;
          }

          // Open -> solid dot; Closed -> hollow ring; Unknown -> dashed ring
          let markerStyle = {};
          let labelClass = "";
          if (status === "open") {
            markerStyle = {
              radius: 6,
              fillColor: "#16a34a",
              color: "#14532d",
              weight: 1.8,
              opacity: 1,
              fillOpacity: 0.95,
              dashArray: null,
            };
            labelClass = "shop-time-label-open";
          } else if (status === "closed") {
            markerStyle = {
              radius: 6,
              fillColor: "#ffffff",
              color: "#dc2626",
              weight: 2.2,
              opacity: 1,
              fillOpacity: 0.85,
              dashArray: null,
            };
            labelClass = "shop-time-label-closed";
          } else {
            markerStyle = {
              radius: 5.5,
              fillColor: "#ffffff",
              color: "#78716c",
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.8,
              dashArray: "3, 3",
            };
            labelClass = "shop-time-label-unknown";
          }

          marker.setStyle(markerStyle);
          marker.bringToFront();

          // Bind / Update permanent arrival label
          marker.unbindTooltip();
          marker.bindTooltip(arrStr, {
            permanent: true,
            direction: "bottom",
            offset: [0, 6],
            className: `shop-time-label ${labelClass}`,
          });
        } else {
          // Outside circle: no label, muted styling
          marker.unbindTooltip();
          marker.setStyle({
            radius: 3.5,
            fillColor: "#a8a29e",
            color: "#78716c",
            weight: 1,
            opacity: 0.35,
            fillOpacity: 0.3,
            dashArray: null,
          });
        }
      });

      // Update badge counts in local state
      setStats({ insideCount, independentCount, openCount });

      // Format when object {day, hhmm}
      const leaveH = Math.floor(currentMinutes / 60) % 24;
      const leaveM = currentMinutes % 60;
      const leaveHhmm = `${String(leaveH).padStart(2, "0")}:${String(leaveM).padStart(2, "0")}`;

      // Sync outputs to Python widget model
      model.set("radius_km", Math.round(currentRadiusKm * 100) / 100);
      model.set("inside", insideIndices);
      model.set("open_on_arrival", openIndices);
      model.set("when", { day: currentDay, hhmm: leaveHhmm });
      model.save_changes();
    },
    [hotelPos, model]
  );

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set("radius_km", 3.5);
    model.set("inside", []);
    model.set("open_on_arrival", []);
    model.set("when", { day: "Tu", hhmm: "06:30" });
    model.save_changes();
  }, [model]);

  // Handle dial updates
  const handleTimeChange = (newMin) => {
    setLeaveMinutes(newMin);
    leaveMinutesRef.current = newMin;
    updateVisualState(radiusKmRef.current, newMin, leaveDayRef.current);
  };

  const handleDayChange = (newDay) => {
    setLeaveDay(newDay);
    leaveDayRef.current = newDay;
    updateVisualState(radiusKmRef.current, leaveMinutesRef.current, newDay);
  };

  const handleNudge = (delta) => {
    let next = (leaveMinutesRef.current + delta) % 1440;
    if (next < 0) next += 1440;
    handleTimeChange(next);
  };

  // Map Setup Effect
  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [hotelPos[0], hotelPos[1] - 0.008],
      zoom: 12.8,
      zoomControl: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Isochrone layer: 30, 20, 10 minute bike reach as 3 translucent blue bands (darker closer)
    if (rawIsochrones && rawIsochrones.features) {
      // Sort descending by contour (30 -> 20 -> 10) so 10 is on top
      const sortedFeatures = [...rawIsochrones.features].sort((a, b) => {
        const cA = a.properties?.contour ?? 0;
        const cB = b.properties?.contour ?? 0;
        return cB - cA;
      });

      const isoLayer = L.geoJSON({ ...rawIsochrones, features: sortedFeatures }, {
        style: (feature) => {
          const contour = feature.properties?.contour ?? 30;
          let fillOpacity = 0.16;
          let weight = 1.2;
          let color = "#1e40af";
          if (contour <= 10) {
            fillOpacity = 0.36;
            weight = 1.8;
            color = "#172554";
          } else if (contour <= 20) {
            fillOpacity = 0.24;
            weight = 1.4;
            color = "#1e3a8a";
          }
          return {
            fillColor: "#2563eb",
            fillOpacity,
            color,
            weight,
            interactive: false,
          };
        },
      }).addTo(map);
      isochroneLayerRef.current = isoLayer;
    }

    // Visible km circle stays on top of isochrones
    const circle = L.circle(hotelPos, {
      radius: radiusKmRef.current * 1000,
      color: "#ea580c",
      weight: 2.2,
      opacity: 0.9,
      fillColor: "#ea580c",
      fillOpacity: 0.05,
      interactive: false,
    }).addTo(map);
    circleRef.current = circle;

    // Hit-testing circle for dragging edge
    const hitCircle = L.circle(hotelPos, {
      radius: radiusKmRef.current * 1000,
      color: "#ea580c",
      weight: 18,
      opacity: 0.001,
      fill: false,
      interactive: true,
      className: "leaflet-grab",
    }).addTo(map);
    hitCircleRef.current = hitCircle;

    // Radius drag handle with label
    const initialHandlePos = getPerimeterPoint(hotelPos, radiusKmRef.current * 1000, 90);
    const handleIcon = L.divIcon({
      className: "radius-label-handle",
      html: `<div id="radius-pill" class="radius-badge-pill">${radiusKmRef.current.toFixed(1)} km ↔</div>`,
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    });

    const handleMarker = L.marker(initialHandlePos, {
      icon: handleIcon,
      draggable: true,
      zIndexOffset: 1300,
    }).addTo(map);
    handleMarkerRef.current = handleMarker;

    const applyNewRadius = (newRadiusKm) => {
      const clampedKm = Math.max(0.4, Math.min(25, newRadiusKm));
      radiusKmRef.current = clampedKm;
      const meters = clampedKm * 1000;

      circle.setRadius(meters);
      hitCircle.setRadius(meters);

      const newPos = getPerimeterPoint(hotelPos, meters, 90);
      handleMarker.setLatLng(newPos);

      const pill = document.getElementById("radius-pill");
      if (pill) pill.innerText = `${clampedKm.toFixed(1)} km ↔`;

      updateVisualState(clampedKm, leaveMinutesRef.current, leaveDayRef.current);
    };

    handleMarker.on("dragstart", () => {
      isDraggingRef.current = true;
      map.dragging.disable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.add("active");
    });

    handleMarker.on("drag", (e) => {
      const currentPos = e.latlng;
      const dMeters = L.latLng(hotelPos).distanceTo(currentPos);
      applyNewRadius(dMeters / 1000);
    });

    handleMarker.on("dragend", () => {
      isDraggingRef.current = false;
      map.dragging.enable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.remove("active");
    });

    hitCircle.on("mousedown", (e) => {
      isDraggingRef.current = true;
      map.dragging.disable();
      const pill = document.getElementById("radius-pill");
      if (pill) pill.classList.add("active");

      const onMouseMove = (moveEvt) => {
        if (!isDraggingRef.current) return;
        const dMeters = L.latLng(hotelPos).distanceTo(moveEvt.latlng);
        applyNewRadius(dMeters / 1000);
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
        map.dragging.enable();
        if (pill) pill.classList.remove("active");
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    });

    // Dark Hotel Pin
    const hotelIcon = L.divIcon({
      className: "hotel-pin-wrapper",
      html: `
        <div style="position: relative; width: 22px; height: 22px;">
          <div class="hotel-pin-custom" style="width: 18px; height: 18px; position: absolute; top: 0; left: 2px;"></div>
          <div style="position: absolute; top: 5px; left: 7px; width: 8px; height: 8px; border-radius: 50%; background: #fdfbf7;"></div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 20],
    });
    const hotelMarker = L.marker(hotelPos, {
      icon: hotelIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    hotelMarker.bindTooltip("Hotel (Center)", {
      direction: "top",
      offset: [0, -18],
      className: "hotel-tooltip",
    });

    // Populate donut shop markers
    shopMarkersRef.current = [];
    data.forEach((shop, index) => {
      if (shop.lat == null || shop.lon == null) return;

      const marker = L.circleMarker([shop.lat, shop.lon], {
        radius: 6,
        fillColor: "#16a34a",
        color: "#14532d",
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85,
        interactive: true,
      }).addTo(map);

      marker.on("mouseover", () => {
        const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
        const arrTotal = (leaveMinutesRef.current + bikeMin) % 1440;
        const arrH = Math.floor(arrTotal / 60);
        const arrM = arrTotal % 60;
        const arrStr = `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`;
        const st = checkIsOpen(shop.hours, leaveDayRef.current, arrTotal);

        setHoveredShopInfo({
          shop,
          arrivalTimeStr: arrStr,
          status: st,
        });
      });

      marker.on("mouseout", () => {
        setHoveredShopInfo(null);
      });

      shopMarkersRef.current.push({ marker, shop, index });
    });

    // Sync initial state
    updateVisualState(radiusKmRef.current, leaveMinutesRef.current, leaveDayRef.current);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [hotelPos, getPerimeterPoint, updateVisualState, data, rawIsochrones]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "560px",
        background: "#fdfbf7",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1.5px solid #292524",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* Map Column */}
      <div
        style={{
          position: "relative",
          flex: "1 1 0%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Badge
          insideCount={stats.insideCount}
          independentCount={stats.independentCount}
          openCount={stats.openCount}
        />
        {hoveredShopInfo && (
          <InfoTooltip
            shop={hoveredShopInfo.shop}
            arrivalTimeStr={hoveredShopInfo.arrivalTimeStr}
            status={hoveredShopInfo.status}
          />
        )}
        <Legend />
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            background: "#f7f4ec",
          }}
        />
      </div>

      {/* Clock & Departure Controls Column */}
      <div
        style={{
          width: "220px",
          height: "100%",
          background: "#fdfbf7",
          borderLeft: "1.5px solid #292524",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 12px",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <ClockDial
          leaveMinutes={leaveMinutes}
          day={leaveDay}
          onChangeTime={handleTimeChange}
          onChangeDay={handleDayChange}
          onNudge={handleNudge}
        />
      </div>
    </div>
  );
}