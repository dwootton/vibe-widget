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

export function checkIsOpen(hoursStr, dayIdx, totalMinutes) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return null;
  }
  const str = hoursStr.trim();
  if (str === "24/7") return true;

  const dayMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const parts = str.split(";").map((p) => p.trim()).filter(Boolean);

  let matchedRule = false;
  let isOpenNow = false;

  for (const part of parts) {
    const match = part.match(/^(?:([A-Za-z,\s-]+)\s+)?(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) continue;

    const daysPart = match[1] ? match[1].trim() : null;
    const startStr = match[2];
    const endStr = match[3];

    let dayApplies = false;
    if (!daysPart) {
      dayApplies = true;
    } else {
      const dayTokens = daysPart.split(",").map((s) => s.trim());
      for (const token of dayTokens) {
        if (token.includes("-")) {
          const [dStartStr, dEndStr] = token.split("-").map((s) => s.trim().slice(0, 2).toLowerCase());
          const dStart = dayMap[dStartStr];
          const dEnd = dayMap[dEndStr];
          if (dStart !== undefined && dEnd !== undefined) {
            if (dStart <= dEnd) {
              if (dayIdx >= dStart && dayIdx <= dEnd) dayApplies = true;
            } else {
              if (dayIdx >= dStart || dayIdx <= dEnd) dayApplies = true;
            }
          }
        } else {
          const d = dayMap[token.slice(0, 2).toLowerCase()];
          if (d !== undefined && d === dayIdx) dayApplies = true;
        }
      }
    }

    if (dayApplies) {
      matchedRule = true;
      const [sh, sm] = startStr.split(":").map(Number);
      const [eh, em] = endStr.split(":").map(Number);
      const sMin = sh * 60 + sm;
      const eMin = eh * 60 + em;

      if (eMin >= sMin) {
        if (totalMinutes >= sMin && totalMinutes <= eMin) {
          isOpenNow = true;
        }
      } else {
        if (totalMinutes >= sMin || totalMinutes <= eMin) {
          isOpenNow = true;
        }
      }
    }
  }

  if (!matchedRule) {
    return false;
  }
  return isOpenNow;
}

export function formatHhmm(mins) {
  let m = Math.floor(mins) % 1440;
  if (m < 0) m += 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function pointInPolygon(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const StatusBadge = ({ insideCount = 0, independentCount = 0, openCount = 0 }) => (
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
      fontFamily: "'Fira Code', 'Pitch', monospace",
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
      <span style={{ fontWeight: 700, color: "#d84315" }}>{independentCount}</span> independent
      <span style={{ margin: "0 5px", color: "#888" }}>·</span>
      <span style={{ fontWeight: 700, color: "#2e7d32" }}>{openCount}</span> open on arrival
    </div>
  </div>
);

export const ShopInspector = ({ shop, leaveMins = 0, currentDay = 1 }) => {
  if (!shop) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 1000,
          background: "rgba(253, 251, 247, 0.92)",
          border: "1px dashed #bbb",
          borderRadius: "4px",
          padding: "5px 10px",
          fontFamily: "'Fira Code', monospace",
          fontSize: "10.5px",
          color: "#777",
          pointerEvents: "none",
        }}
      >
        Click a shop to target · Shift+drag to draw lasso · Hover for details
      </div>
    );
  }

  const bikeMins = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
  const arrMins = (leaveMins + bikeMins) % 1440;
  const openStatus = checkIsOpen(shop.hours, currentDay, arrMins);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        zIndex: 1000,
        maxWidth: "310px",
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
      <div style={{ color: "#555", fontSize: "10px", marginBottom: "4px" }}>
        {shop.street ? shop.street : "Street unlisted"} · {bikeMins}m bike ({shop.km_from_hotel != null ? shop.km_from_hotel.toFixed(1) : "?"} km)
      </div>
      <div style={{ fontSize: "10px", color: "#444", marginBottom: "6px" }}>
        <strong>Hours:</strong> {shop.hours ? shop.hours : "Unlisted"}
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span
          style={{
            fontSize: "9.5px",
            textTransform: "uppercase",
            padding: "2px 5px",
            borderRadius: "2px",
            background: shop.chain ? "#e0e0e0" : "#ffeed9",
            color: shop.chain ? "#444" : "#b23c00",
            fontWeight: 700,
          }}
        >
          {shop.chain ? "Chain" : "Indie"}
        </span>
        <span
          style={{
            fontSize: "9.5px",
            textTransform: "uppercase",
            padding: "2px 5px",
            borderRadius: "2px",
            background:
              openStatus === true
                ? "#e8f5e9"
                : openStatus === false
                ? "#ffebee"
                : "#f0f0f0",
            color:
              openStatus === true
                ? "#2e7d32"
                : openStatus === false
                ? "#c62828"
                : "#666",
            fontWeight: 700,
          }}
        >
          {openStatus === true
            ? "Open @ arrival"
            : openStatus === false
            ? "Closed @ arrival"
            : "Hours unknown"}
        </span>
      </div>
    </div>
  );
};

export const ClockDial = ({
  React,
  leaveMins,
  bikeMins,
  targetShopName,
  day,
  onLeaveChange,
  onDayChange,
}) => {
  const dialRef = React.useRef(null);
  const isDraggingLeave = React.useRef(false);
  const isDraggingArrive = React.useRef(false);

  const arriveMins = (leaveMins + bikeMins) % 1440;
  const size = 260;
  const center = size / 2;
  const rOuter = 95;
  const rInner = rOuter * 0.7;
  const handleR = 10;

  const minsToAngle = (m) => ((m % 1440) / 1440) * 2 * Math.PI - Math.PI / 2;

  const angleLeave = minsToAngle(leaveMins);
  const angleArrive = minsToAngle(arriveMins);

  const leaveX = center + rOuter * Math.cos(angleLeave);
  const leaveY = center + rOuter * Math.sin(angleLeave);

  const arriveX = center + rInner * Math.cos(angleArrive);
  const arriveY = center + rInner * Math.sin(angleArrive);

  const tripFraction = (Math.max(bikeMins, 0) % 1440) / 1440;
  const largeArcFlag = tripFraction > 0.5 ? 1 : 0;
  const wedgePath = `M ${center} ${center} L ${center + rOuter * Math.cos(angleLeave)} ${center + rOuter * Math.sin(angleLeave)} A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${center + rOuter * Math.cos(angleArrive)} ${center + rOuter * Math.sin(angleArrive)} Z`;

  const getPointerMins = (e) => {
    if (!dialRef.current) return 0;
    const rect = dialRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - center;
    const y = e.clientY - rect.top - center;
    let rad = Math.atan2(y, x) + Math.PI / 2;
    if (rad < 0) rad += 2 * Math.PI;
    const frac = rad / (2 * Math.PI);
    return Math.round(frac * 1440) % 1440;
  };

  const handlePointerDownLeave = (e) => {
    e.preventDefault();
    if (dialRef.current) dialRef.current.focus();
    isDraggingLeave.current = true;

    const onPointerMove = (ev) => {
      if (!isDraggingLeave.current) return;
      const m = getPointerMins(ev);
      onLeaveChange(m);
    };

    const onPointerUp = () => {
      isDraggingLeave.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handlePointerDownArrive = (e) => {
    e.preventDefault();
    if (dialRef.current) dialRef.current.focus();
    isDraggingArrive.current = true;

    const onPointerMove = (ev) => {
      if (!isDraggingArrive.current) return;
      const targetArrMins = getPointerMins(ev);
      let newLeave = targetArrMins - bikeMins;
      while (newLeave < 0) newLeave += 1440;
      onLeaveChange(newLeave % 1440);
    };

    const onPointerUp = () => {
      isDraggingArrive.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      let n = (leaveMins - 15) % 1440;
      if (n < 0) n += 1440;
      onLeaveChange(n);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onLeaveChange((leaveMins + 15) % 1440);
    }
  };

  const leaveLabelR = rOuter + 22;
  const arriveLabelR = Math.max(rInner - 22, 14);
  const leaveLabelX = center + leaveLabelR * Math.cos(angleLeave);
  const leaveLabelY = center + leaveLabelR * Math.sin(angleLeave);
  const arriveLabelX = center + arriveLabelR * Math.cos(angleArrive);
  const arriveLabelY = center + arriveLabelR * Math.sin(angleArrive);

  const hourTicks = [];
  for (let h = 0; h < 24; h++) {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    const isMajor = h % 6 === 0;
    const isMid = h % 3 === 0;
    const tLen = isMajor ? 8 : isMid ? 5 : 3;
    const x1 = center + (rOuter - tLen) * Math.cos(a);
    const y1 = center + (rOuter - tLen) * Math.sin(a);
    const x2 = center + rOuter * Math.cos(a);
    const y2 = center + rOuter * Math.sin(a);

    let textElem = null;
    if (isMajor) {
      const tx = center + (rOuter - 16) * Math.cos(a);
      const ty = center + (rOuter - 16) * Math.sin(a);
      textElem = (
        <text
          key={`th-${h}`}
          x={tx}
          y={ty}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "9px",
            fill: "#666",
            fontWeight: 700,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {h === 0 ? "0" : h}h
        </text>
      );
    }

    hourTicks.push(
      <g key={`tick-${h}`}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={isMajor ? "#222" : isMid ? "#777" : "#bbb"}
          strokeWidth={isMajor ? 1.5 : 1}
        />
        {textElem}
      </g>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "280px",
        background: "#fdfbf7",
        borderLeft: "1px solid #1a1a1a",
        padding: "12px 10px 10px 10px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "4px 8px 8px 8px",
          borderBottom: "1px dashed #d0c8b8",
          marginBottom: "8px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "9.5px",
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          Target Destination
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "14px",
            fontWeight: 700,
            color: "#1a1a1a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginTop: "1px",
          }}
          title={targetShopName}
        >
          {targetShopName || "None selected"}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#e65100",
            fontWeight: 700,
            fontFamily: "'Fira Code', monospace",
            marginTop: "2px",
          }}
        >
          {Math.round(bikeMins)} min by bike
        </div>
      </div>

      <svg
        ref={dialRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        width={size}
        height={size}
        style={{
          outline: "none",
          cursor: "default",
          touchAction: "none",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))",
        }}
      >
        <circle
          cx={center}
          cy={center}
          r={rOuter}
          fill="#faf7f0"
          stroke="#1a1a1a"
          strokeWidth={1.8}
        />
        <circle
          cx={center}
          cy={center}
          r={rInner}
          fill="none"
          stroke="#d4cfc2"
          strokeWidth={1.2}
          strokeDasharray="2, 2"
        />
        <path
          d={wedgePath}
          fill="rgba(255, 152, 0, 0.22)"
          stroke="rgba(230, 81, 0, 0.4)"
          strokeWidth={1}
        />
        {hourTicks}
        <text
          x={center}
          y={center + 26}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: "9.5px",
            fontWeight: 700,
            fill: "#d84315",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {Math.round(bikeMins)} min by bike
        </text>

        <line
          x1={center}
          y1={center}
          x2={center + (rOuter - 3) * Math.cos(angleLeave)}
          y2={center + (rOuter - 3) * Math.sin(angleLeave)}
          stroke="#1a1a1a"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <line
          x1={center}
          y1={center}
          x2={center + (rInner - 2) * Math.cos(angleArrive)}
          y2={center + (rInner - 2) * Math.sin(angleArrive)}
          stroke="#e65100"
          strokeWidth={2.2}
          strokeLinecap="round"
        />

        <circle cx={center} cy={center} r={3.5} fill="#1a1a1a" />

        <g
          transform={`translate(${arriveX}, ${arriveY})`}
          style={{ cursor: "grab" }}
          onPointerDown={handlePointerDownArrive}
        >
          <circle r={handleR + 6} fill="transparent" />
          <circle
            r={handleR}
            fill="#e65100"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }}
          />
          <text
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "7.5px",
              fill: "#fff",
              fontWeight: 800,
              pointerEvents: "none",
            }}
          >
            ARR
          </text>
        </g>

        <g
          transform={`translate(${leaveX}, ${leaveY})`}
          style={{ cursor: "grab" }}
          onPointerDown={handlePointerDownLeave}
        >
          <circle r={handleR + 6} fill="transparent" />
          <circle
            r={handleR}
            fill="#1a1a1a"
            stroke="#ffffff"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}
          />
          <text
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "7.5px",
              fill: "#fff",
              fontWeight: 800,
              pointerEvents: "none",
            }}
          >
            LV
          </text>
        </g>

        <g transform={`translate(${leaveLabelX}, ${leaveLabelY})`}>
          <rect
            x={-20}
            y={-8}
            width={40}
            height={16}
            rx={3}
            fill="#1a1a1a"
            stroke="#fff"
            strokeWidth={0.8}
          />
          <text
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "9.5px",
              fontWeight: 700,
              fill: "#ffffff",
              pointerEvents: "none",
            }}
          >
            {formatHhmm(leaveMins)}
          </text>
        </g>

        <g transform={`translate(${arriveLabelX}, ${arriveLabelY})`}>
          <rect
            x={-19}
            y={-7}
            width={38}
            height={14}
            rx={3}
            fill="#ffeed9"
            stroke="#e65100"
            strokeWidth={0.8}
          />
          <text
            y={1}
            textAnchor="middle"
            dominantBaseline="central"
            style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: "9px",
              fontWeight: 800,
              fill: "#b23c00",
              pointerEvents: "none",
            }}
          >
            {formatHhmm(arriveMins)}
          </text>
        </g>
      </svg>

      <div
        style={{
          fontSize: "9px",
          color: "#777",
          fontFamily: "'Fira Code', monospace",
          marginTop: "2px",
          marginBottom: "8px",
          textAlign: "center",
        }}
      >
        Click dial & use ◀ / ▶ arrow keys (±15m)
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          gap: "3px",
        }}
      >
        {DAY_NAMES.map((dName, idx) => {
          const isSelected = day === idx;
          return (
            <button
              key={dName}
              onClick={() => onDayChange(idx)}
              style={{
                flex: 1,
                padding: "5px 0",
                fontSize: "10px",
                fontFamily: "'Fira Code', monospace",
                fontWeight: isSelected ? 800 : 500,
                background: isSelected ? "#1a1a1a" : "#faf7f0",
                color: isSelected ? "#fdfbf7" : "#333",
                border: "1px solid #1a1a1a",
                borderRadius: "3px",
                cursor: "pointer",
                boxShadow: isSelected ? "inset 0 1px 2px rgba(0,0,0,0.3)" : "1px 1px 0px #1a1a1a",
                transition: "all 0.15s ease",
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

export const RegionsTable = ({
  React,
  regions,
  data,
  leaveMins,
  day,
  hoveredRegion,
  onHoverRegion,
  onDeleteRegion,
}) => {
  if (!regions || regions.length === 0) {
    return (
      <div
        style={{
          padding: "10px 16px",
          fontSize: "11px",
          color: "#777",
          fontStyle: "italic",
          borderTop: "1px solid #1a1a1a",
          background: "#faf7f0",
        }}
      >
        No regions drawn yet. Hold <strong>Shift</strong> and drag on the map to lasso a region.
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        borderTop: "1px solid #1a1a1a",
        background: "#faf7f0",
        boxSizing: "border-box",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "11px",
          fontFamily: "'Fira Code', monospace",
          textAlign: "left",
        }}
      >
        <thead>
          <tr
            style={{
              background: "#ede8db",
              borderBottom: "1px solid #1a1a1a",
              color: "#1a1a1a",
              fontWeight: 700,
            }}
          >
            <th style={{ padding: "6px 12px" }}>Region</th>
            <th style={{ padding: "6px 12px" }}>Shops</th>
            <th style={{ padding: "6px 12px" }}>Independent</th>
            <th style={{ padding: "6px 12px" }}>Open on Arrival</th>
            <th style={{ padding: "6px 12px" }}>Earliest Arrival</th>
            <th style={{ padding: "6px 12px", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((reg) => {
            const isHovered = hoveredRegion === reg.id;
            const indices = reg.indices || [];
            const nShops = indices.length;

            let nIndie = 0;
            let nOpen = 0;
            let earliestArrMins = null;

            indices.forEach((idx) => {
              const shop = data[idx];
              if (!shop) return;
              if (!shop.chain) nIndie++;

              const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
              const arrM = (leaveMins + bikeMin) % 1440;
              const isOpen = checkIsOpen(shop.hours, day, arrM);
              if (isOpen === true) nOpen++;

              if (earliestArrMins === null || arrM < earliestArrMins) {
                earliestArrMins = arrM;
              }
            });

            const earliestStr =
              nShops > 0 && earliestArrMins !== null
                ? formatHhmm(earliestArrMins)
                : "—";

            return (
              <tr
                key={reg.id}
                onMouseEnter={() => onHoverRegion(reg.id)}
                onMouseLeave={() => onHoverRegion(null)}
                style={{
                  background: isHovered ? "#fff5e6" : "transparent",
                  borderBottom: "1px solid #e0dacb",
                  transition: "background 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "6px 12px", fontWeight: 700, color: "#1a1a1a" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "18px",
                      height: "18px",
                      lineHeight: "18px",
                      textAlign: "center",
                      borderRadius: "3px",
                      background: isHovered ? "#d84315" : "#1a1a1a",
                      color: "#fff",
                      fontSize: "10.5px",
                      marginRight: "6px",
                    }}
                  >
                    {reg.name}
                  </span>
                  Region {reg.name}
                </td>
                <td style={{ padding: "6px 12px", color: "#1a1a1a" }}>{nShops}</td>
                <td style={{ padding: "6px 12px", color: "#d84315", fontWeight: 600 }}>
                  {nIndie}
                </td>
                <td style={{ padding: "6px 12px", color: "#2e7d32", fontWeight: 600 }}>
                  {nOpen}
                </td>
                <td style={{ padding: "6px 12px", color: "#1a1a1a" }}>{earliestStr}</td>
                <td style={{ padding: "6px 12px", textAlign: "right" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRegion(reg.id);
                    }}
                    title="Delete Region (or dblclick inside region on map)"
                    style={{
                      background: "none",
                      border: "1px solid #ccc",
                      borderRadius: "3px",
                      padding: "2px 6px",
                      fontSize: "10px",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      color: "#888",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#c62828";
                      e.currentTarget.style.borderColor = "#c62828";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#888";
                      e.currentTarget.style.borderColor = "#ccc";
                    }}
                  >
                    ✕
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

  const rawReach = model.get("reach");

  const HOTEL_LAT = 29.7522;
  const HOTEL_LON = -95.3578;
  const INITIAL_RADIUS = 3.5;

  const [radiusKm, setRadiusKm] = React.useState(INITIAL_RADIUS);
  const [targetIndex, setTargetIndex] = React.useState(2);
  const [day, setDay] = React.useState(1);
  const [leaveMins, setLeaveMins] = React.useState(6 * 60 + 30);
  const [hoveredShop, setHoveredShop] = React.useState(null);

  // Regions state: Array of { id, name, latlngs: [[lat, lng], ...] }
  const [regions, setRegions] = React.useState([]);
  const [hoveredRegionId, setHoveredRegionId] = React.useState(null);

  const mapContainerRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const circleRef = React.useRef(null);
  const circleHitRef = React.useRef(null);
  const edgeLabelMarkerRef = React.useRef(null);
  const isDraggingEdgeRef = React.useRef(false);

  const markersRef = React.useRef([]);
  const reachLayerRef = React.useRef(null);

  // Live state refs
  const currentRadiusRef = React.useRef(INITIAL_RADIUS);
  const targetIndexRef = React.useRef(targetIndex);
  targetIndexRef.current = targetIndex;
  const leaveMinsRef = React.useRef(leaveMins);
  leaveMinsRef.current = leaveMins;
  const dayRef = React.useRef(day);
  dayRef.current = day;
  const regionsRef = React.useRef(regions);
  regionsRef.current = regions;
  const dataRef = React.useRef(data);
  dataRef.current = data;

  // Regions leaflet layers storage: map region id -> { polygon, handleMarkers, badgeMarker }
  const regionLayersRef = React.useRef(new Map());

  // Lasso in-flight state
  const isLassoActiveRef = React.useRef(false);
  const lassoPointsRef = React.useRef([]);
  const lassoPolylineRef = React.useRef(null);

  // Region letters generator
  const getNextRegionName = (existingRegions) => {
    const existingNames = new Set(existingRegions.map((r) => r.name));
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!existingNames.has(letter)) return letter;
    }
    let count = existingRegions.length + 1;
    return `R${count}`;
  };

  // Compute shop indices inside polygon
  const computeRegionIndices = React.useCallback((latlngs, shops) => {
    if (!latlngs || latlngs.length < 3) return [];
    const ring = latlngs.map((pt) => [pt[0], pt[1]]);
    const inside = [];
    shops.forEach((shop, idx) => {
      if (shop.lat == null || shop.lon == null) return;
      if (pointInPolygon([shop.lat, shop.lon], ring)) {
        inside.push(idx);
      }
    });
    return inside;
  }, []);

  // Update regions output dict: { A: [0, 1], B: [3] }
  const syncRegionsOutput = React.useCallback((currentRegs) => {
    const outputDict = {};
    const shops = dataRef.current;
    currentRegs.forEach((reg) => {
      const indices = computeRegionIndices(reg.latlngs, shops);
      outputDict[reg.name] = indices;
    });
    model.set("regions", outputDict);
    model.save_changes();
  }, [computeRegionIndices, model]);

  // Delete region helper
  const deleteRegion = React.useCallback((regId) => {
    const map = mapInstanceRef.current;
    const layers = regionLayersRef.current.get(regId);
    if (layers && map) {
      if (layers.polygon) layers.polygon.remove();
      if (layers.badgeMarker) layers.badgeMarker.remove();
      if (layers.handleMarkers) {
        layers.handleMarkers.forEach((m) => m.remove());
      }
      regionLayersRef.current.delete(regId);
    }
    setRegions((prev) => {
      const next = prev.filter((r) => r.id !== regId);
      syncRegionsOutput(next);
      return next;
    });
  }, [syncRegionsOutput]);

  // Simplify raw mouse points down to manageable polygon vertices (~10-25 vertices)
  const simplifyPoints = (pts) => {
    if (pts.length <= 16) return pts;
    const step = Math.ceil(pts.length / 16);
    const sampled = [];
    for (let i = 0; i < pts.length; i += step) {
      sampled.push(pts[i]);
    }
    // ensure last point connects nicely
    if (sampled[sampled.length - 1] !== pts[pts.length - 1]) {
      sampled.push(pts[pts.length - 1]);
    }
    return sampled;
  };

  // Initialize outputs on mount
  React.useEffect(() => {
    model.set("radius_km", INITIAL_RADIUS);
    model.set("target", 2);
    model.set("when", { day: 1, hhmm: "06:30" });
    model.set("inside", []);
    model.set("open_on_arrival", []);
    model.set("regions", {});
    model.save_changes();
  }, []);

  const computeInside = React.useCallback(
    (rad) => {
      const inside = [];
      const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);
      data.forEach((row, idx) => {
        if (row.lat == null || row.lon == null) return;
        const distM = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
        if (distM <= rad * 1000) {
          inside.push(idx);
        }
      });
      return inside;
    },
    [data]
  );

  const getEdgeLatLng = React.useCallback((rKm) => {
    const rMeters = rKm * 1000;
    const deltaLon = rMeters / (111320 * Math.cos((HOTEL_LAT * Math.PI) / 180));
    return L.latLng(HOTEL_LAT, HOTEL_LON + deltaLon);
  }, []);

  const updateShopsDisplay = React.useCallback(() => {
    const rad = currentRadiusRef.current;
    const curTarget = targetIndexRef.current;
    const curLeave = leaveMinsRef.current;
    const curDay = dayRef.current;
    const hotelLatLng = L.latLng(HOTEL_LAT, HOTEL_LON);

    const insideIndices = [];
    const openOnArrival = [];

    markersRef.current.forEach(({ marker, labelMarker, row, index }) => {
      if (!marker) return;
      const distM = hotelLatLng.distanceTo(L.latLng(row.lat, row.lon));
      const isInside = distM <= rad * 1000;
      const isTarget = index === curTarget;

      if (isInside) {
        insideIndices.push(index);
      }

      const shopBikeMin = row.bike_min != null ? row.bike_min : 0;
      const arrivalMin = (curLeave + Math.round(shopBikeMin)) % 1440;
      const openStatus = checkIsOpen(row.hours, curDay, arrivalMin);

      if (isInside && openStatus === true) {
        openOnArrival.push(index);
      }

      if (isInside) {
        if (openStatus === true) {
          marker.setStyle({
            radius: isTarget ? 8.5 : 6,
            fillColor: "#2e7d32",
            fillOpacity: 0.95,
            color: isTarget ? "#1a1a1a" : "#1b5e20",
            weight: isTarget ? 3.5 : 1.2,
            dashArray: null,
            opacity: 1,
          });
        } else if (openStatus === false) {
          marker.setStyle({
            radius: isTarget ? 8.5 : 5.5,
            fillColor: "#ffffff",
            fillOpacity: 0.9,
            color: isTarget ? "#1a1a1a" : "#d32f2f",
            weight: isTarget ? 3.5 : 2,
            dashArray: null,
            opacity: 1,
          });
        } else {
          marker.setStyle({
            radius: isTarget ? 8.5 : 5.5,
            fillColor: "#f5f5f5",
            fillOpacity: 0.85,
            color: isTarget ? "#1a1a1a" : "#757575",
            weight: isTarget ? 3.5 : 1.8,
            dashArray: "3, 3",
            opacity: 1,
          });
        }

        if (isTarget && marker.bringToFront) {
          marker.bringToFront();
        }

        if (labelMarker) {
          const hhmmStr = formatHhmm(arrivalMin);
          const labelColor =
            openStatus === true
              ? "#1b5e20"
              : openStatus === false
              ? "#c62828"
              : "#555555";
          const labelBg =
            openStatus === true
              ? "#e8f5e9"
              : openStatus === false
              ? "#ffebee"
              : "#f5f5f5";

          const el = labelMarker.getElement();
          if (el) {
            el.style.display = "block";
            const textSpan = el.querySelector(".shop-arr-time");
            if (textSpan) {
              textSpan.textContent = hhmmStr;
              textSpan.style.color = labelColor;
              textSpan.style.background = labelBg;
              textSpan.style.borderColor = isTarget ? "#1a1a1a" : labelColor;
              textSpan.style.fontWeight = isTarget ? "800" : "600";
            }
          }
        }
      } else {
        marker.setStyle({
          radius: isTarget ? 7 : 3.5,
          fillColor: "#bdbdbd",
          fillOpacity: 0.25,
          color: isTarget ? "#1a1a1a" : "#9e9e9e",
          weight: isTarget ? 2.5 : 0.8,
          dashArray: null,
          opacity: 0.4,
        });

        if (labelMarker) {
          const el = labelMarker.getElement();
          if (el) {
            el.style.display = "none";
          }
        }
      }
    });

    return { insideIndices, openOnArrival };
  }, []);

  const syncModelOutputs = React.useCallback(
    (ins, opn) => {
      model.set("radius_km", Number(currentRadiusRef.current.toFixed(3)));
      model.set("target", targetIndexRef.current);
      model.set("when", {
        day: dayRef.current,
        hhmm: formatHhmm(leaveMinsRef.current),
      });
      model.set("inside", ins);
      model.set("open_on_arrival", opn);
      model.save_changes();
    },
    [model]
  );

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

      const { insideIndices, openOnArrival } = updateShopsDisplay();
      syncModelOutputs(insideIndices, openOnArrival);
    },
    [getEdgeLatLng, updateShopsDisplay, syncModelOutputs]
  );

  // Leaflet Map Initialization + Shift-Lasso Handler
  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    // Turn off boxZoom so Shift+Drag lasso gesture gets through cleanly!
    const map = L.map(mapContainerRef.current, {
      center: [HOTEL_LAT, HOTEL_LON],
      zoom: 12,
      zoomControl: false,
      boxZoom: false,
    });
    mapInstanceRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    if (rawReach && rawReach.bike) {
      const bikeGeo = JSON.parse(JSON.stringify(rawReach.bike));
      if (bikeGeo.features) {
        bikeGeo.features.sort((a, b) => {
          const ca = a.properties && a.properties.contour ? a.properties.contour : 0;
          const cb = b.properties && b.properties.contour ? b.properties.contour : 0;
          return cb - ca;
        });
      }

      reachLayerRef.current = L.geoJSON(bikeGeo, {
        style: (feature) => {
          const contour = feature.properties ? feature.properties.contour : 30;
          const opacities = { 10: 0.35, 20: 0.22, 30: 0.12 };
          const op = opacities[contour] || 0.15;
          return {
            fillColor: "#0288d1",
            fillOpacity: op,
            color: "#0277bd",
            weight: 1.2,
            opacity: 0.5,
            interactive: false,
          };
        },
      }).addTo(map);
    }

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
          fontSize: 11px;
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

    L.marker([HOTEL_LAT, HOTEL_LON], {
      icon: L.divIcon({
        className: "hotel-pin-icon",
        html: hotelPinHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      zIndexOffset: 1200,
    }).addTo(map);

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

    // Shift + Drag Lasso handling on Map container
    const mapEl = mapContainerRef.current;

    const onLassoMouseDown = (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();

      isLassoActiveRef.current = true;
      map.dragging.disable();

      const startLatLng = map.mouseEventToLatLng(e);
      lassoPointsRef.current = [[startLatLng.lat, startLatLng.lng]];

      if (lassoPolylineRef.current) {
        lassoPolylineRef.current.remove();
      }
      lassoPolylineRef.current = L.polyline([[startLatLng.lat, startLatLng.lng]], {
        color: "#d84315",
        weight: 2.5,
        dashArray: "4, 4",
      }).addTo(map);

      const onLassoMouseMove = (moveEv) => {
        if (!isLassoActiveRef.current) return;
        const curLatLng = map.mouseEventToLatLng(moveEv);
        const lastPt = lassoPointsRef.current[lassoPointsRef.current.length - 1];
        const dist = Math.hypot(curLatLng.lat - lastPt[0], curLatLng.lng - lastPt[1]);
        if (dist > 0.0003) {
          lassoPointsRef.current.push([curLatLng.lat, curLatLng.lng]);
          if (lassoPolylineRef.current) {
            lassoPolylineRef.current.setLatLngs(lassoPointsRef.current);
          }
        }
      };

      const onLassoMouseUp = () => {
        if (!isLassoActiveRef.current) return;
        isLassoActiveRef.current = false;
        map.dragging.enable();

        window.removeEventListener("mousemove", onLassoMouseMove);
        window.removeEventListener("mouseup", onLassoMouseUp);

        if (lassoPolylineRef.current) {
          lassoPolylineRef.current.remove();
          lassoPolylineRef.current = null;
        }

        const rawPts = lassoPointsRef.current;
        if (rawPts.length >= 4) {
          const simplified = simplifyPoints(rawPts);
          const currentRegs = regionsRef.current;
          const nextName = getNextRegionName(currentRegs);
          const newRegion = {
            id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: nextName,
            latlngs: simplified,
          };
          const nextRegs = [...currentRegs, newRegion];
          setRegions(nextRegs);
          syncRegionsOutput(nextRegs);
        }
      };

      window.addEventListener("mousemove", onLassoMouseMove);
      window.addEventListener("mouseup", onLassoMouseUp);
    };

    mapEl.addEventListener("mousedown", onLassoMouseDown);

    return () => {
      mapEl.removeEventListener("mousedown", onLassoMouseDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update shop markers on map when data changes
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker, labelMarker }) => {
      if (marker) marker.remove();
      if (labelMarker) labelMarker.remove();
    });
    markersRef.current = [];

    const newMarkers = [];

    data.forEach((row, idx) => {
      if (row.lat == null || row.lon == null) return;

      const marker = L.circleMarker([row.lat, row.lon], {
        radius: 6,
        fillColor: "#2e7d32",
        color: "#1a1a1a",
        weight: 1.5,
        fillOpacity: 0.9,
        interactive: true,
      }).addTo(map);

      const labelDivHtml = `
        <div style="
          transform: translate(-50%, -24px);
          pointer-events: none;
          user-select: none;
        ">
          <span class="shop-arr-time" style="
            display: inline-block;
            font-family: 'Fira Code', monospace;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            border: 1px solid #1b5e20;
            background: #e8f5e9;
            color: #1b5e20;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            white-space: nowrap;
          ">--:--</span>
        </div>
      `;

      const labelMarker = L.marker([row.lat, row.lon], {
        icon: L.divIcon({
          className: "shop-arrival-label",
          html: labelDivHtml,
          iconSize: [0, 0],
        }),
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

    markersRef.current = newMarkers;

    const { insideIndices, openOnArrival } = updateShopsDisplay();
    syncModelOutputs(insideIndices, openOnArrival);
    syncRegionsOutput(regionsRef.current);
  }, [data]);

  // Synchronize Leaflet rendering of regions, handles, badges, and double-click delete
  React.useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Determine removed regions
    const currentIds = new Set(regions.map((r) => r.id));
    regionLayersRef.current.forEach((layers, regId) => {
      if (!currentIds.has(regId)) {
        if (layers.polygon) layers.polygon.remove();
        if (layers.badgeMarker) layers.badgeMarker.remove();
        if (layers.handleMarkers) {
          layers.handleMarkers.forEach((m) => m.remove());
        }
        regionLayersRef.current.delete(regId);
      }
    });

    // Create or update layers for each region
    regions.forEach((reg) => {
      let layers = regionLayersRef.current.get(reg.id);
      const isHovered = hoveredRegionId === reg.id;

      if (!layers) {
        // Create polygon
        const polygon = L.polygon(reg.latlngs, {
          color: isHovered ? "#b71c1c" : "#e65100",
          weight: isHovered ? 3.5 : 2.2,
          fillColor: isHovered ? "#ffab91" : "#ffe0b2",
          fillOpacity: isHovered ? 0.45 : 0.28,
          dashArray: "5, 4",
          interactive: true,
        }).addTo(map);

        // Double click inside region to delete
        polygon.on("dblclick", (e) => {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);
          }
          deleteRegion(reg.id);
        });

        polygon.on("mouseover", () => setHoveredRegionId(reg.id));
        polygon.on("mouseout", () => {
          setHoveredRegionId((curr) => (curr === reg.id ? null : curr));
        });

        // Center badge marker for region name
        const bounds = polygon.getBounds();
        const centerLatLng = bounds.getCenter();

        const badgeHtml = `
          <div style="
            transform: translate(-50%, -50%);
            pointer-events: none;
            user-select: none;
          ">
            <span class="region-badge-name" style="
              display: inline-block;
              font-family: 'Fira Code', monospace;
              font-size: 11px;
              font-weight: 800;
              padding: 2px 7px;
              border-radius: 4px;
              border: 1px solid #1a1a1a;
              background: #1a1a1a;
              color: #fdfbf7;
              box-shadow: 2px 2px 0px rgba(0,0,0,0.3);
            ">${reg.name}</span>
          </div>
        `;

        const badgeMarker = L.marker(centerLatLng, {
          icon: L.divIcon({
            className: "region-center-badge",
            html: badgeHtml,
            iconSize: [0, 0],
          }),
          zIndexOffset: 1250,
          interactive: false,
        }).addTo(map);

        // Draggable vertex handles
        const handleMarkers = reg.latlngs.map((pt, vIdx) => {
          const handleMarker = L.circleMarker(pt, {
            radius: 5,
            fillColor: "#ffffff",
            fillOpacity: 1,
            color: "#e65100",
            weight: 2,
            interactive: true,
          }).addTo(map);

          // Drag vertex logic
          let isDraggingVertex = false;

          const onVertexMove = (ev) => {
            if (!isDraggingVertex) return;
            const newLatLng = map.mouseEventToLatLng(ev);
            handleMarker.setLatLng(newLatLng);

            // Imperatively update polygon & badge without full rebuild
            const updatedPts = [...reg.latlngs];
            updatedPts[vIdx] = [newLatLng.lat, newLatLng.lng];
            reg.latlngs = updatedPts;
            polygon.setLatLngs(updatedPts);
            badgeMarker.setLatLng(polygon.getBounds().getCenter());
          };

          const onVertexUp = () => {
            if (!isDraggingVertex) return;
            isDraggingVertex = false;
            map.dragging.enable();
            window.removeEventListener("mousemove", onVertexMove);
            window.removeEventListener("mouseup", onVertexUp);

            // Commit changed vertices to React state
            setRegions((prev) => {
              const next = prev.map((r) =>
                r.id === reg.id ? { ...r, latlngs: [...reg.latlngs] } : r
              );
              syncRegionsOutput(next);
              return next;
            });
          };

          handleMarker.on("mousedown", (ev) => {
            if (ev.originalEvent) {
              L.DomEvent.stopPropagation(ev.originalEvent);
              L.DomEvent.preventDefault(ev.originalEvent);
            }
            isDraggingVertex = true;
            map.dragging.disable();
            window.addEventListener("mousemove", onVertexMove);
            window.addEventListener("mouseup", onVertexUp);
          });

          return handleMarker;
        });

        layers = { polygon, badgeMarker, handleMarkers };
        regionLayersRef.current.set(reg.id, layers);
      } else {
        // Update styling if hover changed
        layers.polygon.setStyle({
          color: isHovered ? "#b71c1c" : "#e65100",
          weight: isHovered ? 3.5 : 2.2,
          fillColor: isHovered ? "#ffab91" : "#ffe0b2",
          fillOpacity: isHovered ? 0.45 : 0.28,
        });

        if (isHovered && layers.polygon.bringToFront) {
          layers.polygon.bringToFront();
          layers.handleMarkers.forEach((m) => m.bringToFront && m.bringToFront());
        }

        const bEl = layers.badgeMarker.getElement();
        if (bEl) {
          const badgeSpan = bEl.querySelector(".region-badge-name");
          if (badgeSpan) {
            badgeSpan.style.background = isHovered ? "#b71c1c" : "#1a1a1a";
          }
        }
      }
    });
  }, [regions, hoveredRegionId, deleteRegion, syncRegionsOutput]);

  React.useEffect(() => {
    const { insideIndices, openOnArrival } = updateShopsDisplay();
    syncModelOutputs(insideIndices, openOnArrival);
  }, [targetIndex, day, leaveMins, updateShopsDisplay, syncModelOutputs]);

  // Derived counts for badge & dial
  const targetRow = data[targetIndex] || data[0] || {};
  const targetBikeMin = targetRow.bike_min != null ? targetRow.bike_min : 15;

  const currentInside = computeInside(radiusKm);
  const insideCount = currentInside.length;
  let independentCount = 0;
  let openCount = 0;

  currentInside.forEach((idx) => {
    const r = data[idx];
    if (r && !r.chain) independentCount++;
    if (r) {
      const bMin = r.bike_min != null ? r.bike_min : 0;
      const arr = (leaveMins + Math.round(bMin)) % 1440;
      if (checkIsOpen(r.hours, day, arr) === true) {
        openCount++;
      }
    }
  });

  // Calculate table rows with shops
  const enrichedRegions = React.useMemo(() => {
    return regions.map((reg) => {
      const indices = computeRegionIndices(reg.latlngs, data);
      return {
        ...reg,
        indices,
      };
    });
  }, [regions, data, computeRegionIndices]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "960px",
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
          padding: "9px 16px",
          background: "#fdfbf7",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "18px",
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.01em",
            }}
          >
            Houston Donut Clock & Reach
          </h2>
          <span
            style={{
              fontSize: "11px",
              color: "#666",
              fontFamily: "'Fira Code', monospace",
            }}
          >
            Shift+drag map to lasso region · Click dot to target shop
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
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#fff",
                display: "inline-block",
                border: "2px solid #d32f2f",
              }}
            />
            <span>Closed</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#f5f5f5",
                display: "inline-block",
                border: "1.5px dashed #757575",
              }}
            />
            <span>Unknown</span>
          </div>
        </div>
      </div>

      {/* Main Content: Map + Right Clock Dial */}
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "540px",
          background: "#eae7dc",
          position: "relative",
        }}
      >
        {/* Map Container */}
        <div
          style={{
            flex: 1,
            height: "100%",
            position: "relative",
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
            shop={hoveredShop}
            leaveMins={leaveMins}
            currentDay={day}
          />
        </div>

        {/* 24h Clock Dial Panel on Right */}
        <ClockDial
          React={React}
          leaveMins={leaveMins}
          bikeMins={targetBikeMin}
          targetShopName={targetRow.name}
          day={day}
          onLeaveChange={(m) => setLeaveMins(m)}
          onDayChange={(d) => setDay(d)}
        />
      </div>

      {/* Under-map Compact Regions Table */}
      <RegionsTable
        React={React}
        regions={enrichedRegions}
        data={data}
        leaveMins={leaveMins}
        day={day}
        hoveredRegion={hoveredRegionId}
        onHoverRegion={(id) => setHoveredRegionId(id)}
        onDeleteRegion={(id) => deleteRegion(id)}
      />
    </div>
  );
}