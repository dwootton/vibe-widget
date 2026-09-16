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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderTop: "1px dashed #d6d3d1",
        paddingTop: "5px",
      }}
    >
      <span
        style={{
          width: 14,
          height: 9,
          background: "rgba(124, 58, 237, 0.18)",
          border: "1.5px dashed #6d28d9",
          borderRadius: "2px",
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: "10px", color: "#4c1d95" }}>Shift+drag = lasso region</span>
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderTop: "1px dashed #d6d3d1",
        paddingTop: "5px",
      }}
    >
      <span
        style={{
          width: 16,
          height: 0,
          borderTop: "3px solid #ea580c",
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: "10px", color: "#9a3412", fontWeight: 700 }}>
        Click a shop = pin · drag a pin = move stop
      </span>
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        borderTop: "1px dashed #d6d3d1",
        paddingTop: "5px",
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#1d4ed8",
          border: "2px solid #eab308",
          display: "inline-block",
          boxSizing: "border-box",
        }}
      />
      <span style={{ fontSize: "10px", color: "#1e3a8a", fontWeight: 700 }}>
        Click pin № = select · ←/→ hop · Del remove
      </span>
    </div>
  </div>
);

export const InfoTooltip = ({ shop, arrivalTimeStr, status, pinIndex }) => {
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
          color: shop.hours ? "#292524" : "#57534e",
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
      <div
        style={{
          fontSize: "10px",
          marginTop: "6px",
          paddingTop: "5px",
          borderTop: "1px dashed #d6d3d1",
          fontWeight: 700,
          color: pinIndex != null ? "#b91c1c" : "#1d4ed8",
        }}
      >
        {pinIndex != null
          ? `Stop #${pinIndex + 1} — drag to move · click № to select`
          : "Click to pin as next stop"}
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
  React: ReactProp,
}) => {
  const R = ReactProp || (typeof React !== "undefined" ? React : null);
  const svgRef = R.useRef(null);
  const containerRef = R.useRef(null);
  const isDraggingRef = R.useRef(false);

  const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const width = 188;
  const height = 188;
  const cx = width / 2;
  const cy = height / 2;
  const r = 78;

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
    let rad = Math.atan2(y, x);
    let deg = (rad * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    deg = deg % 360;
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
        <circle cx={cx} cy={cy} r={r} fill="#fffdfa" stroke="#292524" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#e7e5e4" strokeWidth="18" />

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
              onClick={() => onChangeDay && onChangeDay(d)}
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
          color: "#44403c",
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

  const clauses = clean.split(";").map((s) => s.trim()).filter(Boolean);

  let matchedAnyClause = false;
  let isOpenNow = false;

  for (const clause of clauses) {
    const m = clause.match(/^([A-Za-z,\s-]+)?\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!m) continue;

    const dayPart = m[1] ? m[1].trim() : null;
    const startStr = m[2];
    const endStr = m[3];

    const [sH, sM] = startStr.split(":").map(Number);
    const [eH, eM] = endStr.split(":").map(Number);
    const startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    if (endMin <= startMin && endMin !== 0) {
      endMin += 1440;
    }

    let appliesToTargetDay = false;
    if (!dayPart) {
      appliesToTargetDay = true;
    } else {
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

// Point-in-polygon on lat/lng ring [[lat,lng],...]
export function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0];
    const xi = ring[i][1];
    const yj = ring[j][0];
    const xj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function fmtClock(m) {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export const RegionTable = ({ rows = [], onHoverRegion, React: ReactProp }) => {
  const cellBase = {
    padding: "7px 10px",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "11.5px",
    color: "#1c1917",
    borderBottom: "1px solid #e7e5e4",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const headBase = {
    padding: "6px 10px",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: "10.5px",
    fontWeight: 800,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#0c0a09",
    borderBottom: "1.5px solid #1c1917",
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 14px 12px 14px",
        background: "#fdfbf7",
        borderTop: "1.5px solid #292524",
        overflow: "auto",
        maxHeight: "190px",
      }}
      onMouseLeave={() => onHoverRegion && onHoverRegion(null)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "14px",
            fontWeight: 800,
            color: "#0c0a09",
            letterSpacing: "0.01em",
          }}
        >
          Lasso regions
        </span>
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "10px",
            color: "#44403c",
          }}
        >
          shift+drag to draw · drag vertices to reshape · double-click inside to delete
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "11.5px",
            color: "#44403c",
            padding: "8px 2px",
            borderTop: "1px dashed #d6d3d1",
          }}
        >
          No regions yet — hold <b>shift</b> and drag a loop across the map.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto" }}>
          <thead>
            <tr>
              <th style={{ ...headBase, textAlign: "left" }}>Region</th>
              <th style={headBase}>Shops</th>
              <th style={headBase}>Independent</th>
              <th style={headBase}>Open on arrival</th>
              <th style={headBase}>Earliest arrival</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onMouseEnter={() => onHoverRegion && onHoverRegion(r.id)}
                onMouseLeave={() => onHoverRegion && onHoverRegion(null)}
                style={{
                  cursor: "default",
                  background: r.hovered ? "rgba(124, 58, 237, 0.12)" : "transparent",
                  transition: "background 220ms ease",
                }}
              >
                <td style={{ ...cellBase, textAlign: "left" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "19px",
                      height: "19px",
                      marginRight: "8px",
                      borderRadius: "4px",
                      background: r.color,
                      color: "#fdfbf7",
                      fontWeight: 800,
                      fontSize: "11px",
                      border: "1px solid #1c1917",
                      verticalAlign: "middle",
                    }}
                  >
                    {r.name}
                  </span>
                  <span style={{ color: "#44403c", fontSize: "10.5px" }}>
                    {r.vertices} pts
                  </span>
                </td>
                <td style={{ ...cellBase, fontWeight: 700 }}>{r.nShops}</td>
                <td style={cellBase}>{r.nIndependent}</td>
                <td style={{ ...cellBase, color: r.nOpen > 0 ? "#15803d" : "#44403c", fontWeight: 700 }}>
                  {r.nOpen}
                </td>
                <td style={{ ...cellBase, color: "#c2410c", fontWeight: 700 }}>
                  {r.earliest || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export const RouteItinerary = ({
  stops = [],
  leaveMinutes = 390,
  dwell = 10,
  totalMinutes = 0,
  selectedStop = null,
  onSelectStop,
  onUnpin,
  onClear,
  onReorder,
  React: ReactProp,
}) => {
  const R = ReactProp || (typeof React !== "undefined" ? React : null);
  const [dragFrom, setDragFrom] = R.useState(null);
  const [dragOver, setDragOver] = R.useState(null);

  const cellBase = {
    padding: "7px 10px",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "11.5px",
    color: "#1c1917",
    borderBottom: "1px solid #e7e5e4",
    textAlign: "right",
    whiteSpace: "nowrap",
  };
  const headBase = {
    padding: "6px 10px",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: "10.5px",
    fontWeight: 800,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "#0c0a09",
    borderBottom: "1.5px solid #1c1917",
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  const commitDrop = (toPos) => {
    if (dragFrom == null || toPos == null || dragFrom === toPos) {
      setDragFrom(null);
      setDragOver(null);
      return;
    }
    if (onReorder) onReorder(dragFrom, toPos);
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "12px 14px 14px 14px",
        background: "linear-gradient(180deg, #fffdf8 0%, #fdf6ec 100%)",
        borderTop: "1.5px solid #292524",
        overflow: "auto",
        maxHeight: "300px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          marginBottom: "7px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "15px",
            fontWeight: 800,
            color: "#0c0a09",
          }}
        >
          The route
        </span>
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "10px",
            color: "#44403c",
          }}
        >
          drag the ⠿ handle to reorder · drag a map pin to move a stop · {dwell} min at each
          stop
        </span>
        <span style={{ flex: "1 1 0" }} />
        <span
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "12px",
            fontWeight: 800,
            color: "#9a3412",
            background: "#ffedd5",
            border: "1.5px solid #ea580c",
            borderRadius: "999px",
            padding: "2px 10px",
          }}
        >
          total {totalMinutes} min
        </span>
        {stops.length > 0 && onClear && (
          <button
            onClick={onClear}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "10.5px",
              fontWeight: 700,
              color: "#fdfbf7",
              background: "#1c1917",
              border: "1.5px solid #1c1917",
              borderRadius: "4px",
              padding: "3px 9px",
              cursor: "pointer",
            }}
          >
            clear route
          </button>
        )}
      </div>

      {stops.length === 0 ? (
        <div
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "11.5px",
            color: "#44403c",
            padding: "8px 2px",
            borderTop: "1px dashed #d6d3d1",
          }}
        >
          Nothing pinned yet — click a donut shop on the map to start the ride from the
          hotel at <b>{fmtClock(leaveMinutes)}</b>.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...headBase, textAlign: "left", width: "26px" }} />
              <th style={{ ...headBase, textAlign: "left" }}>#</th>
              <th style={{ ...headBase, textAlign: "left" }}>Stop</th>
              <th style={headBase}>Leg</th>
              <th style={headBase}>Ride so far</th>
              <th style={headBase}>Arrive</th>
              <th style={headBase}>Status</th>
              <th style={headBase} />
            </tr>
          </thead>
          <tbody>
            {stops.map((s, pos) => {
              const isSel = selectedStop === s.index;
              const isDragging = dragFrom === pos;
              const isOver = dragOver === pos && dragFrom != null && dragFrom !== pos;
              return (
                <tr
                  key={s.key}
                  draggable={false}
                  onDragOver={(e) => {
                    if (dragFrom == null) return;
                    e.preventDefault();
                    setDragOver(pos);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    commitDrop(pos);
                  }}
                  onClick={() => onSelectStop && onSelectStop(s.index)}
                  style={{
                    cursor: "pointer",
                    background: isSel
                      ? "rgba(29, 78, 216, 0.11)"
                      : isDragging
                      ? "rgba(234, 88, 12, 0.14)"
                      : "transparent",
                    opacity: isDragging ? 0.6 : 1,
                    boxShadow: isOver ? "inset 0 2.5px 0 0 #1d4ed8" : "none",
                    transition: "background 220ms ease",
                  }}
                >
                  <td
                    style={{
                      ...cellBase,
                      textAlign: "center",
                      width: "26px",
                      padding: "6px 2px",
                      cursor: "grab",
                    }}
                    draggable
                    onDragStart={(e) => {
                      setDragFrom(pos);
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = "move";
                        try {
                          e.dataTransfer.setData("text/plain", String(pos));
                        } catch (err) {}
                      }
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    title="drag to reorder"
                  >
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "13px",
                        lineHeight: 1,
                        color: "#57534e",
                        userSelect: "none",
                      }}
                    >
                      ⠿
                    </span>
                  </td>
                  <td style={{ ...cellBase, textAlign: "left", width: "34px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        background: isSel ? "#1d4ed8" : "#ea580c",
                        color: "#fffdf8",
                        fontWeight: 800,
                        fontSize: "11px",
                        border: isSel ? "2px solid #eab308" : "1.5px solid #1c1917",
                        boxSizing: "border-box",
                      }}
                    >
                      {s.order}
                    </span>
                  </td>
                  <td style={{ ...cellBase, textAlign: "left" }}>
                    <span
                      style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#0c0a09",
                      }}
                    >
                      {s.name}
                    </span>
                    <span style={{ color: "#44403c", fontSize: "10px", marginLeft: 7 }}>
                      {s.chain ? "chain" : "independent"}
                      {s.kolache ? " · kolache" : ""}
                    </span>
                  </td>
                  <td style={cellBase}>
                    {s.leg == null ? <span style={{ color: "#b91c1c" }}>n/a</span> : `${s.leg}m`}
                  </td>
                  <td style={cellBase}>{s.rideSoFar}m</td>
                  <td style={{ ...cellBase, fontWeight: 800, color: "#c2410c" }}>
                    {s.arriveStr}
                  </td>
                  <td
                    style={{
                      ...cellBase,
                      fontWeight: 700,
                      color:
                        s.status === "open"
                          ? "#15803d"
                          : s.status === "closed"
                          ? "#b91c1c"
                          : "#44403c",
                    }}
                  >
                    {s.status === "open" ? "open" : s.status === "closed" ? "closed" : "unknown"}
                  </td>
                  <td style={{ ...cellBase }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpin && onUnpin(s.index);
                      }}
                      style={{
                        fontFamily: "'Courier New', Courier, monospace",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#7f1d1d",
                        background: "#fef2f2",
                        border: "1px solid #b91c1c",
                        borderRadius: "3px",
                        padding: "2px 7px",
                        cursor: "pointer",
                      }}
                    >
                      unpin
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {stops.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "11px",
            color: "#292524",
            borderTop: "1px dashed #d6d3d1",
            paddingTop: "6px",
          }}
        >
          Leave hotel <b>{fmtClock(leaveMinutes)}</b> · ride{" "}
          <b>{stops[stops.length - 1].rideSoFar} min</b> ·{" "}
          {stops.length} stop{stops.length === 1 ? "" : "s"} × {dwell} min dwell · back on
          the bike at <b>{fmtClock(leaveMinutes + totalMinutes)}</b>
        </div>
      )}
    </div>
  );
};

export const SelectionHint = ({ shop = null, order = null, onDelete, onClear }) => {
  if (!shop) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        right: 60,
        zIndex: 1000,
        background: "#0f172a",
        border: "1.5px solid #eab308",
        borderRadius: "5px",
        boxShadow: "3px 3px 0px rgba(15,23,42,0.6)",
        padding: "8px 12px",
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "11px",
        color: "#f8fafc",
        maxWidth: "270px",
      }}
    >
      <div style={{ fontWeight: 800, color: "#fde68a", marginBottom: 3 }}>
        Stop #{order} selected
      </div>
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "13px",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {shop.name}
      </div>
      <div style={{ lineHeight: 1.5, color: "#e2e8f0" }}>
        <b>←</b>/<b>→</b> hop to next nearest shop
        <br />
        <b>Delete</b> / <b>Backspace</b> removes it
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
        <button
          onClick={onDelete}
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "10px",
            fontWeight: 700,
            color: "#fef2f2",
            background: "#b91c1c",
            border: "1px solid #fecaca",
            borderRadius: "3px",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          delete
        </button>
        <button
          onClick={onClear}
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "10px",
            fontWeight: 700,
            color: "#0f172a",
            background: "#e2e8f0",
            border: "1px solid #94a3b8",
            borderRadius: "3px",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          deselect
        </button>
      </div>
    </div>
  );
};

const REGION_COLORS = [
  "#6d28d9",
  "#0e7490",
  "#b45309",
  "#be185d",
  "#15803d",
  "#1d4ed8",
  "#7c2d12",
  "#9333ea",
];

const DWELL = 10;

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const shellRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const hotelPos = React.useMemo(() => [29.7522, -95.3578], []);

  const [leaveMinutes, setLeaveMinutes] = React.useState(390);
  const [leaveDay, setLeaveDay] = React.useState("Tu");

  const leaveMinutesRef = React.useRef(390);
  leaveMinutesRef.current = leaveMinutes;
  const leaveDayRef = React.useRef("Tu");
  leaveDayRef.current = leaveDay;

  const [rawIsochrones, setRawIsochrones] = React.useState(() => model.get("isochrones"));
  const [rawData, setRawData] = React.useState(() => model.get("data"));
  const [rawLegs, setRawLegs] = React.useState(() => model.get("legs"));

  React.useEffect(() => {
    const onIsoChange = () => setRawIsochrones(model.get("isochrones"));
    const onDataChange = () => setRawData(model.get("data"));
    const onLegsChange = () => setRawLegs(model.get("legs"));
    model.on("change:isochrones", onIsoChange);
    model.on("change:data", onDataChange);
    model.on("change:legs", onLegsChange);
    return () => {
      model.off("change:isochrones", onIsoChange);
      model.off("change:data", onDataChange);
      model.off("change:legs", onLegsChange);
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

  const legs = React.useMemo(() => {
    if (!rawLegs) return [];
    if (Array.isArray(rawLegs)) return rawLegs;
    return [];
  }, [rawLegs]);

  const legsRef = React.useRef(legs);
  legsRef.current = legs;

  const dataRef = React.useRef(data);
  dataRef.current = data;

  const [hoveredShopInfo, setHoveredShopInfo] = React.useState(null);
  const [stats, setStats] = React.useState({ insideCount: 0, independentCount: 0, openCount: 0 });

  // Pinned route: array of data row indices, in pin order
  const [route, setRoute] = React.useState([]);
  const routeRef = React.useRef([]);
  routeRef.current = route;

  // Selected pin (data row index) for keyboard ops
  const [selectedStop, setSelectedStop] = React.useState(null);
  const selectedStopRef = React.useRef(null);
  selectedStopRef.current = selectedStop;

  // Live drag preview of a pin: { position: k, targetIndex: rowIdx } or null
  const [dragPreview, setDragPreview] = React.useState(null);
  const dragPreviewRef = React.useRef(null);
  dragPreviewRef.current = dragPreview;

  // Regions
  const [regions, setRegions] = React.useState([]);
  const regionsRef = React.useRef([]);
  regionsRef.current = regions;
  const [hoveredRegionId, setHoveredRegionId] = React.useState(null);
  const hoveredRegionIdRef = React.useRef(null);

  // Map elements refs
  const circleRef = React.useRef(null);
  const hitCircleRef = React.useRef(null);
  const handleMarkerRef = React.useRef(null);
  const isochroneLayerRef = React.useRef(null);
  const shopMarkersRef = React.useRef([]);
  const radiusKmRef = React.useRef(3.5);
  const isDraggingRef = React.useRef(false);

  // Route layer refs
  const routeLayerGroupRef = React.useRef(null);

  // Lasso / region layer refs
  const regionLayerGroupRef = React.useRef(null);
  const regionRenderRef = React.useRef(new Map());
  const lassoDraftRef = React.useRef(null);
  const nextRegionIdxRef = React.useRef(0);

  React.useEffect(() => {
    const linkId = "leaflet-css-bundle";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://esm.sh/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const styleId = "leaflet-custom-styles-clock-lasso-route-dragpins";
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
          color: #14532d !important;
          background: rgba(240, 253, 244, 0.95) !important;
          border: 1px solid #16a34a !important;
        }
        .shop-time-label-closed {
          color: #991b1b !important;
          background: rgba(254, 242, 242, 0.95) !important;
          border: 1px solid #dc2626 !important;
        }
        .shop-time-label-unknown {
          color: #292524 !important;
          background: rgba(245, 245, 244, 0.95) !important;
          border: 1px solid #a8a29e !important;
        }
        .region-vertex-handle {
          background: transparent !important;
          border: none !important;
        }
        .region-vertex-dot {
          width: 11px;
          height: 11px;
          box-sizing: border-box;
          border-radius: 50%;
          background: #fdfbf7;
          border: 2.5px solid #6d28d9;
          box-shadow: 0 1px 3px rgba(0,0,0,0.35);
          cursor: grab;
          transition: transform 140ms ease;
        }
        .region-vertex-dot:hover { transform: scale(1.35); }
        .region-name-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .region-name-chip {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 13px;
          font-weight: 800;
          color: #fdfbf7;
          background: #6d28d9;
          border: 1.5px solid #1c1917;
          border-radius: 5px;
          padding: 1px 7px;
          box-shadow: 2px 2px 0 #1c1917;
          transform: translate(-50%, -50%);
          display: inline-block;
          pointer-events: none;
        }
        .lasso-active .leaflet-grab { cursor: crosshair !important; }

        .pin-marker-wrap { background: transparent !important; border: none !important; }
        .pin-marker-inner {
          display: flex;
          align-items: center;
          gap: 5px;
          transform: translate(-13px, -13px);
          pointer-events: auto;
          animation: pin-pop 520ms cubic-bezier(.22,1.2,.3,1) both;
        }
        .pin-marker-inner.dragging { animation: none; }
        @keyframes pin-pop {
          0% { opacity: 0; transform: translate(-13px, -4px) scale(0.6); }
          100% { opacity: 1; transform: translate(-13px, -13px) scale(1); }
        }
        .pin-marker-num {
          width: 26px; height: 26px;
          flex: 0 0 26px;
          box-sizing: border-box;
          border-radius: 50%;
          background: radial-gradient(circle at 34% 30%, #fb923c 0%, #ea580c 62%, #c2410c 100%);
          border: 2px solid #1c1917;
          color: #fffdf8;
          font-family: 'Courier New', Courier, monospace;
          font-size: 13px;
          font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 2px 2px 0 rgba(28,25,23,0.75);
          cursor: pointer;
          transition: box-shadow 200ms ease, transform 200ms ease;
        }
        .pin-marker-inner.selected .pin-marker-num {
          background: radial-gradient(circle at 34% 30%, #60a5fa 0%, #1d4ed8 62%, #1e3a8a 100%);
          border-color: #eab308;
          box-shadow: 0 0 0 4px rgba(234,179,8,0.45), 2px 2px 0 rgba(28,25,23,0.75);
        }
        .pin-marker-grip {
          width: 14px;
          height: 26px;
          flex: 0 0 14px;
          box-sizing: border-box;
          border-radius: 4px;
          background: rgba(255,253,248,0.96);
          border: 1.5px solid #1c1917;
          color: #57534e;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1;
          display: flex; align-items: center; justify-content: center;
          cursor: grab;
          box-shadow: 1px 1px 0 rgba(28,25,23,0.5);
        }
        .pin-marker-grip:active { cursor: grabbing; }
        .pin-marker-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 12px;
          font-weight: 800;
          color: #1c1917;
          background: rgba(255, 253, 248, 0.96);
          border: 1.5px solid #1c1917;
          border-radius: 4px;
          padding: 1px 6px;
          white-space: nowrap;
          box-shadow: 2px 2px 0 rgba(28,25,23,0.45);
          cursor: grab;
        }
        .pin-marker-inner.selected .pin-marker-name {
          border-color: #1d4ed8;
          color: #1e3a8a;
        }
        .leg-label { background: transparent !important; border: none !important; box-shadow: none !important; }
        .leg-label-chip {
          font-family: 'Courier New', Courier, monospace;
          font-size: 10.5px;
          font-weight: 800;
          color: #fffdf8;
          background: #1c1917;
          border: 1.5px solid #ea580c;
          border-radius: 999px;
          padding: 1px 7px;
          white-space: nowrap;
          transform: translate(-50%, -50%);
          display: inline-block;
          pointer-events: none;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
        .leg-label-chip.ghost {
          background: #1d4ed8;
          border-color: #eab308;
        }
        .snap-halo-ring {
          border-radius: 50%;
          box-sizing: border-box;
          width: 30px; height: 30px;
          border: 2.5px dashed #1d4ed8;
          background: rgba(29,78,216,0.12);
          transform: translate(-15px,-15px);
          pointer-events: none;
          animation: halo-pulse 900ms ease-in-out infinite alternate;
        }
        @keyframes halo-pulse {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }
        .snap-halo { background: transparent !important; border: none !important; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const getPerimeterPoint = React.useCallback((centerLatLng, radiusMeters, bearingDeg = 90) => {
    const R = 6378137;
    const d = radiusMeters / R;
    const th = (bearingDeg * Math.PI) / 180;
    const p1 = (centerLatLng[0] * Math.PI) / 180;
    const l1 = (centerLatLng[1] * Math.PI) / 180;

    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
    const l2 =
      l1 +
      Math.atan2(
        Math.sin(th) * Math.sin(d) * Math.cos(p1),
        Math.cos(d) - Math.sin(p1) * Math.sin(p2)
      );

    return [(p2 * 180) / Math.PI, (l2 * 180) / Math.PI];
  }, []);

  const fmtMin = fmtClock;

  const legBetween = React.useCallback((fromRow, toRow, lg) => {
    const i = fromRow < 0 ? 0 : fromRow + 1;
    const j = toRow < 0 ? 0 : toRow + 1;
    if (!lg || !lg[i]) return null;
    const v = lg[i][j];
    if (v == null || Number.isNaN(v)) {
      const rev = lg[j] ? lg[j][i] : null;
      return rev == null || Number.isNaN(rev) ? null : Math.round(rev);
    }
    return Math.round(v);
  }, []);

  // ---- plan builder usable from handlers (pure) ----
  const buildPlan = React.useCallback(
    (routeArr, dataArr, lg, leaveMin, day) => {
      const stops = [];
      let cumRide = 0;
      let prev = -1;
      routeArr.forEach((rowIdx, k) => {
        const shop = dataArr[rowIdx];
        if (!shop) return;
        let leg = legBetween(prev, rowIdx, lg);
        if (leg == null) {
          leg = prev < 0 && shop.bike_min != null ? Math.round(shop.bike_min) : null;
        }
        const legVal = leg == null ? 0 : leg;
        cumRide += legVal;
        const arrive = leaveMin + cumRide + k * DWELL;
        const status = checkIsOpen(shop.hours, day, ((arrive % 1440) + 1440) % 1440);
        stops.push({
          key: `${rowIdx}-${k}`,
          index: rowIdx,
          order: k + 1,
          name: shop.name,
          chain: !!shop.chain,
          kolache: !!shop.kolache,
          lat: shop.lat,
          lon: shop.lon,
          leg,
          rideSoFar: cumRide,
          arriveMin: arrive,
          arriveStr: fmtClock(arrive),
          status,
        });
        prev = rowIdx;
      });
      return { stops, totalMinutes: cumRide + stops.length * DWELL, totalRide: cumRide };
    },
    [legBetween]
  );

  // ---- route computation (derived, with live drag preview applied) ----
  const effectiveRoute = React.useMemo(() => {
    if (!dragPreview) return route;
    const next = route.slice();
    if (
      dragPreview.position != null &&
      dragPreview.position >= 0 &&
      dragPreview.position < next.length &&
      dragPreview.targetIndex != null
    ) {
      next[dragPreview.position] = dragPreview.targetIndex;
    }
    return next;
  }, [route, dragPreview]);

  const routePlan = React.useMemo(
    () => buildPlan(effectiveRoute, data, legs, leaveMinutes, leaveDay),
    [effectiveRoute, data, legs, leaveMinutes, leaveDay, buildPlan]
  );

  const routePlanRef = React.useRef(routePlan);
  routePlanRef.current = routePlan;

  // ---- region stats ----
  const regionRows = React.useMemo(() => {
    return regions.map((reg) => {
      let nShops = 0;
      let nIndependent = 0;
      let nOpen = 0;
      let earliestBike = null;
      const idx = [];
      data.forEach((shop, i) => {
        if (shop.lat == null || shop.lon == null) return;
        if (!pointInRing(shop.lat, shop.lon, reg.ring)) return;
        idx.push(i);
        nShops += 1;
        if (!shop.chain) nIndependent += 1;
        const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
        const arrival = (leaveMinutes + bikeMin) % 1440;
        if (checkIsOpen(shop.hours, leaveDay, arrival) === "open") nOpen += 1;
        if (earliestBike == null || bikeMin < earliestBike) earliestBike = bikeMin;
      });
      return {
        id: reg.id,
        name: reg.name,
        color: reg.color,
        vertices: reg.ring.length,
        indices: idx,
        nShops,
        nIndependent,
        nOpen,
        earliest: earliestBike == null ? null : fmtMin(leaveMinutes + earliestBike),
      };
    });
  }, [regions, data, leaveMinutes, leaveDay]);

  // sync regions output
  React.useEffect(() => {
    const out = {};
    regionRows.forEach((r) => {
      out[r.name] = r.indices;
    });
    model.set("regions", out);
    model.save_changes();
  }, [regionRows, model]);

  // sync route output
  React.useEffect(() => {
    model.set("route", route);
    model.save_changes();
  }, [route, model]);

  const togglePin = React.useCallback((rowIdx) => {
    setRoute((prev) =>
      prev.includes(rowIdx) ? prev.filter((i) => i !== rowIdx) : [...prev, rowIdx]
    );
    setSelectedStop((prev) => (prev === rowIdx ? null : prev));
  }, []);

  // ---- nearest-shop ordering helper (by great-circle distance) ----
  const nearestOrder = React.useCallback((rowIdx, dataArr) => {
    const origin = dataArr[rowIdx];
    if (!origin) return [];
    const R = 6371;
    const toRad = (v) => (v * Math.PI) / 180;
    const dist = (a, b) => {
      const dLat = toRad(b.lat - a.lat);
      const dLon = toRad(b.lon - a.lon);
      const la1 = toRad(a.lat);
      const la2 = toRad(b.lat);
      const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    return dataArr
      .map((s, i) => ({ i, d: s && s.lat != null ? dist(origin, s) : Infinity }))
      .filter((o) => o.i !== rowIdx && Number.isFinite(o.d))
      .sort((a, b) => a.d - b.d);
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
      const pinnedSet = new Set(routeRef.current);
      const dp = dragPreviewRef.current;
      if (dp && dp.targetIndex != null) pinnedSet.add(dp.targetIndex);

      shopMarkersRef.current.forEach(({ marker, shop, index }) => {
        const d = hotelLatLng.distanceTo(L.latLng(shop.lat, shop.lon));
        const isInside = d <= currentRadiusMeters;

        const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
        const arrivalTotalMin = (currentMinutes + bikeMin) % 1440;
        const arrStr = fmtClock(arrivalTotalMin);

        const status = checkIsOpen(shop.hours, currentDay, arrivalTotalMin);
        const pinned = pinnedSet.has(index);

        if (isInside) {
          insideIndices.push(index);
          insideCount += 1;
          if (!shop.chain) independentCount += 1;
          if (status === "open") {
            openIndices.push(index);
            openCount += 1;
          }

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
          if (pinned) {
            markerStyle = { ...markerStyle, radius: 7.5, weight: 2.6, color: "#c2410c" };
          }

          marker.setStyle(markerStyle);
          marker.bringToFront();

          marker.unbindTooltip();
          if (!pinned) {
            marker.bindTooltip(arrStr, {
              permanent: true,
              direction: "bottom",
              offset: [0, 6],
              className: `shop-time-label ${labelClass}`,
            });
          }
        } else {
          marker.unbindTooltip();
          marker.setStyle({
            radius: pinned ? 6 : 3.5,
            fillColor: pinned ? "#fdba74" : "#a8a29e",
            color: pinned ? "#c2410c" : "#78716c",
            weight: pinned ? 2.4 : 1,
            opacity: pinned ? 1 : 0.35,
            fillOpacity: pinned ? 0.9 : 0.3,
            dashArray: null,
          });
        }
      });

      setStats({ insideCount, independentCount, openCount });

      const leaveHhmm = fmtClock(currentMinutes);

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
    model.set("regions", {});
    model.set("route", []);
    model.save_changes();
    return () => {};
  }, [model]);

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

  // ---- reorder from drag handles ----
  const handleReorder = React.useCallback((fromPos, toPos) => {
    setRoute((prev) => {
      if (
        fromPos == null ||
        toPos == null ||
        fromPos < 0 ||
        toPos < 0 ||
        fromPos >= prev.length ||
        toPos >= prev.length ||
        fromPos === toPos
      )
        return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromPos, 1);
      next.splice(toPos, 0, moved);
      return next;
    });
  }, []);

  // ---- keyboard: delete / hop to nearest ----
  const handleKeyDown = React.useCallback(
    (e) => {
      const sel = selectedStopRef.current;
      if (sel == null) return;
      const rt = routeRef.current;
      const pos = rt.indexOf(sel);
      if (pos < 0) {
        setSelectedStop(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setRoute((prev) => prev.filter((i) => i !== sel));
        setSelectedStop(null);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const order = nearestOrder(sel, dataRef.current);
        const used = new Set(rt);
        used.delete(sel);
        const candidates = order.filter((o) => !used.has(o.i)).map((o) => o.i);
        if (candidates.length === 0) return;
        // step forward/backward through the nearest ranking
        const cursor = dir > 0 ? 0 : candidates.length - 1;
        const target = candidates[cursor];
        setRoute((prev) => {
          const next = prev.slice();
          const p = next.indexOf(sel);
          if (p < 0) return prev;
          next[p] = target;
          return next;
        });
        setSelectedStop(target);
        return;
      }
      if (e.key === "Escape") {
        setSelectedStop(null);
      }
    },
    [nearestOrder]
  );

  // ---------- MAP SETUP (depends only on data/isochrones/layout) ----------
  React.useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [hotelPos[0], hotelPos[1] - 0.008],
      zoom: 12.8,
      zoomControl: false,
      boxZoom: false,
    });
    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (rawIsochrones && rawIsochrones.features) {
      const sortedFeatures = [...rawIsochrones.features].sort((a, b) => {
        const cA = a.properties?.contour ?? 0;
        const cB = b.properties?.contour ?? 0;
        return cB - cA;
      });

      const isoLayer = L.geoJSON(
        { ...rawIsochrones, features: sortedFeatures },
        {
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
        }
      ).addTo(map);
      isochroneLayerRef.current = isoLayer;
    }

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

    const initialHandlePos = getPerimeterPoint(hotelPos, radiusKmRef.current * 1000, 90);
    const handleIcon = L.divIcon({
      className: "radius-label-handle",
      html: `<div id="radius-pill" class="radius-badge-pill">${radiusKmRef.current.toFixed(
        1
      )} km ↔</div>`,
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
      if (e.originalEvent && e.originalEvent.shiftKey) return;
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

    hotelMarker.bindTooltip("Hotel (Start)", {
      direction: "top",
      offset: [0, -18],
      className: "hotel-tooltip",
    });

    // region layer group
    const regionGroup = L.layerGroup().addTo(map);
    regionLayerGroupRef.current = regionGroup;

    // route layer group (above regions)
    const routeGroup = L.layerGroup().addTo(map);
    routeLayerGroupRef.current = routeGroup;

    // shop markers
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
        bubblingMouseEvents: false,
      }).addTo(map);

      marker.on("mouseover", () => {
        const bikeMin = shop.bike_min != null ? Math.round(shop.bike_min) : 0;
        const arrTotal = (leaveMinutesRef.current + bikeMin) % 1440;
        const st = checkIsOpen(shop.hours, leaveDayRef.current, arrTotal);
        const pinAt = routeRef.current.indexOf(index);
        setHoveredShopInfo({
          shop,
          arrivalTimeStr: fmtClock(arrTotal),
          status: st,
          pinIndex: pinAt < 0 ? null : pinAt,
        });
      });

      marker.on("mouseout", () => {
        setHoveredShopInfo(null);
      });

      marker.on("click", (e) => {
        if (e.originalEvent) {
          L.DomEvent.stopPropagation(e);
          if (e.originalEvent.shiftKey) return;
        }
        if (shellRef.current) shellRef.current.focus();
        togglePin(index);
      });

      shopMarkersRef.current.push({ marker, shop, index });
    });

    // ---------------- LASSO GESTURE ----------------
    const container = map.getContainer();
    let drawing = false;
    let draftPts = [];
    let draftLine = null;

    const simplify = (pts, tolMeters) => {
      if (pts.length < 3) return pts;
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const last = out[out.length - 1];
        if (L.latLng(last).distanceTo(L.latLng(pts[i])) >= tolMeters) out.push(pts[i]);
      }
      if (out.length < 3) return pts;
      return out;
    };

    const onLassoMove = (e) => {
      if (!drawing) return;
      const ll = e.latlng;
      draftPts.push([ll.lat, ll.lng]);
      if (draftLine) draftLine.setLatLngs(draftPts);
    };

    const finishLasso = () => {
      if (!drawing) return;
      drawing = false;
      map.off("mousemove", onLassoMove);
      map.off("mouseup", finishLasso);
      container.classList.remove("lasso-active");
      if (!isDraggingRef.current) map.dragging.enable();

      if (draftLine) {
        regionGroup.removeLayer(draftLine);
        draftLine = null;
      }
      lassoDraftRef.current = null;

      const c = map.getCenter();
      const p1 = map.latLngToContainerPoint(c);
      const p2 = L.point(p1.x + 12, p1.y);
      const tol = c.distanceTo(map.containerPointToLatLng(p2));

      let ring = simplify(draftPts, tol);
      if (ring.length > 24) {
        const step = Math.ceil(ring.length / 24);
        ring = ring.filter((_, i) => i % step === 0);
      }
      draftPts = [];
      if (ring.length < 3) return;

      const idx = nextRegionIdxRef.current++;
      const name =
        String.fromCharCode(65 + (idx % 26)) + (idx >= 26 ? String(Math.floor(idx / 26)) : "");
      const id = `reg-${idx}-${Date.now()}`;
      const color = REGION_COLORS[idx % REGION_COLORS.length];
      setRegions((prev) => [...prev, { id, name, color, ring }]);
    };

    const onMapMouseDown = (e) => {
      const oe = e.originalEvent;
      if (!oe || !oe.shiftKey) return;
      if (drawing) return;
      oe.preventDefault();
      drawing = true;
      map.dragging.disable();
      container.classList.add("lasso-active");
      draftPts = [[e.latlng.lat, e.latlng.lng]];
      draftLine = L.polyline(draftPts, {
        color: "#6d28d9",
        weight: 2.2,
        opacity: 0.95,
        dashArray: "5,4",
        interactive: false,
      }).addTo(regionGroup);
      lassoDraftRef.current = draftLine;
      map.on("mousemove", onLassoMove);
      map.on("mouseup", finishLasso);
    };

    map.on("mousedown", onMapMouseDown);

    updateVisualState(radiusKmRef.current, leaveMinutesRef.current, leaveDayRef.current);

    return () => {
      map.off("mousedown", onMapMouseDown);
      map.off("mousemove", onLassoMove);
      map.off("mouseup", finishLasso);
      regionRenderRef.current.clear();
      regionLayerGroupRef.current = null;
      routeLayerGroupRef.current = null;
      shopMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [hotelPos, getPerimeterPoint, updateVisualState, data, rawIsochrones, togglePin]);

  // ---------------- RENDER ROUTE (polyline + draggable numbered pins + leg labels) ----------------
  React.useEffect(() => {
    const map = mapRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const stops = routePlan.stops;
    const dragging = dragPreviewRef.current;
    if (stops.length > 0) {
      const pts = [hotelPos, ...stops.map((s) => [s.lat, s.lon])];

      L.polyline(pts, {
        color: "#fffdf8",
        weight: 8,
        opacity: 0.85,
        lineJoin: "round",
        lineCap: "round",
        interactive: false,
      }).addTo(group);

      L.polyline(pts, {
        color: dragging ? "#1d4ed8" : "#ea580c",
        weight: 3.6,
        opacity: 0.95,
        dashArray: dragging ? "7,5" : "1,0",
        lineJoin: "round",
        lineCap: "round",
        interactive: false,
      }).addTo(group);

      // leg labels at midpoints
      stops.forEach((s, k) => {
        const a = pts[k];
        const b = pts[k + 1];
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const txt = s.leg == null ? "? min" : `${s.leg} min`;
        const ghost =
          dragging && (k === dragging.position || k === dragging.position + 1) ? " ghost" : "";
        L.marker(mid, {
          icon: L.divIcon({
            className: "leg-label",
            html: `<div class="leg-label-chip${ghost}">${txt}</div>`,
            iconSize: [52, 18],
            iconAnchor: [26, 9],
          }),
          interactive: false,
          zIndexOffset: 1400,
        }).addTo(group);
      });

      // snap halo while dragging
      if (dragging && dragging.targetIndex != null) {
        const tgt = data[dragging.targetIndex];
        if (tgt) {
          L.marker([tgt.lat, tgt.lon], {
            icon: L.divIcon({
              className: "snap-halo",
              html: `<div class="snap-halo-ring"></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
            interactive: false,
            zIndexOffset: 1450,
          }).addTo(group);
        }
      }

      // numbered pins — draggable, snapping to nearest shop
      stops.forEach((s, pos) => {
        const esc = String(s.name).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const isSel = selectedStop === s.index;
        const isDragPin = dragging && dragging.position === pos;
        const cls = `pin-marker-inner${isSel ? " selected" : ""}${
          isDragPin ? " dragging" : ""
        }`;
        const m = L.marker([s.lat, s.lon], {
          icon: L.divIcon({
            className: "pin-marker-wrap",
            html: `<div class="${cls}"><div class="pin-marker-num" data-role="num">${s.order}</div><div class="pin-marker-grip" data-role="grip">⠿</div><div class="pin-marker-name" data-role="name">${esc}</div></div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          interactive: true,
          draggable: true,
          zIndexOffset: 1500 + pos,
        }).addTo(group);

        // click on the number = select/deselect (does not unpin)
        const el = m.getElement();
        if (el) {
          const numEl = el.querySelector('[data-role="num"]');
          if (numEl) {
            L.DomEvent.on(numEl, "click", (ev) => {
              L.DomEvent.stop(ev);
              if (shellRef.current) shellRef.current.focus();
              setSelectedStop((prev) => (prev === s.index ? null : s.index));
            });
          }
        }

        // drag: snap to nearest shop under cursor, live-update route preview
        m.on("dragstart", () => {
          map.dragging.disable();
          setHoveredShopInfo(null);
          setDragPreview({ position: pos, targetIndex: s.index });
        });

        m.on("drag", (ev) => {
          const ll = ev.latlng || (ev.target && ev.target.getLatLng());
          if (!ll) return;
          // find nearest shop in screen space
          const p = map.latLngToContainerPoint(ll);
          let best = null;
          let bestD = Infinity;
          const rt = routeRef.current;
          data.forEach((shop, i) => {
            if (shop.lat == null || shop.lon == null) return;
            const q = map.latLngToContainerPoint([shop.lat, shop.lon]);
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d < bestD) {
              // allow the pin's own current shop, disallow other already-pinned shops
              const takenElsewhere = rt.some((r, k) => r === i && k !== pos);
              if (!takenElsewhere) {
                bestD = d;
                best = i;
              }
            }
          });
          if (best != null) {
            const cur = dragPreviewRef.current;
            if (!cur || cur.targetIndex !== best) {
              setDragPreview({ position: pos, targetIndex: best });
            }
          }
        });

        m.on("dragend", () => {
          map.dragging.enable();
          const cur = dragPreviewRef.current;
          setDragPreview(null);
          if (!cur || cur.targetIndex == null) return;
          const target = cur.targetIndex;
          setRoute((prev) => {
            if (cur.position >= prev.length) return prev;
            if (prev[cur.position] === target) return prev;
            const next = prev.slice();
            next[cur.position] = target;
            return next;
          });
          setSelectedStop((prev) => (prev === s.index ? target : prev));
        });

        m.on("mouseover", () => {
          if (dragPreviewRef.current) return;
          const pinAt = routeRef.current.indexOf(s.index);
          setHoveredShopInfo({
            shop: data[s.index],
            arrivalTimeStr: s.arriveStr,
            status: s.status,
            pinIndex: pinAt < 0 ? null : pinAt,
          });
        });
        m.on("mouseout", () => setHoveredShopInfo(null));
      });
    }

    return () => {
      try {
        group.clearLayers();
      } catch (err) {}
    };
  }, [routePlan, hotelPos, data, selectedStop]);

  // re-style shop markers when pins / drag preview change
  React.useEffect(() => {
    updateVisualState(radiusKmRef.current, leaveMinutesRef.current, leaveDayRef.current);
    return () => {};
  }, [route, dragPreview, updateVisualState]);

  // drop selection if its stop disappears
  React.useEffect(() => {
    if (selectedStop != null && !route.includes(selectedStop)) {
      setSelectedStop(null);
    }
    return () => {};
  }, [route, selectedStop]);

  // ---------------- RENDER / SYNC REGION LAYERS ----------------
  React.useEffect(() => {
    const map = mapRef.current;
    const group = regionLayerGroupRef.current;
    if (!map || !group) return;

    const rendered = regionRenderRef.current;
    const liveIds = new Set(regions.map((r) => r.id));

    for (const [id, entry] of Array.from(rendered.entries())) {
      if (!liveIds.has(id)) {
        try {
          group.removeLayer(entry.poly);
          entry.handles.forEach((h) => group.removeLayer(h));
          if (entry.label) group.removeLayer(entry.label);
        } catch (err) {}
        rendered.delete(id);
      }
    }

    const centroidOf = (ring) => {
      let la = 0;
      let lo = 0;
      ring.forEach((p) => {
        la += p[0];
        lo += p[1];
      });
      return [la / ring.length, lo / ring.length];
    };

    const deleteRegion = (id) => {
      setRegions((prev) => prev.filter((r) => r.id !== id));
      setHoveredRegionId((h) => (h === id ? null : h));
    };

    regions.forEach((reg) => {
      let entry = rendered.get(reg.id);
      if (!entry) {
        const poly = L.polygon(reg.ring, {
          color: reg.color,
          weight: 2,
          opacity: 0.95,
          dashArray: "6,4",
          fillColor: reg.color,
          fillOpacity: 0.14,
          interactive: true,
        }).addTo(group);

        poly.on("dblclick", (e) => {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e.originalEvent);
          }
          deleteRegion(reg.id);
        });
        poly.on("mouseover", () => setHoveredRegionId(reg.id));
        poly.on("mouseout", () => setHoveredRegionId((h) => (h === reg.id ? null : h)));

        const label = L.marker(centroidOf(reg.ring), {
          icon: L.divIcon({
            className: "region-name-label",
            html: `<div class="region-name-chip" style="background:${reg.color}">${reg.name}</div>`,
            iconSize: [30, 22],
            iconAnchor: [15, 11],
          }),
          interactive: false,
          zIndexOffset: 900,
        }).addTo(group);

        const handles = reg.ring.map((pt, vi) => {
          const hm = L.marker(pt, {
            icon: L.divIcon({
              className: "region-vertex-handle",
              html: `<div class="region-vertex-dot" style="border-color:${reg.color}"></div>`,
              iconSize: [11, 11],
              iconAnchor: [5.5, 5.5],
            }),
            draggable: true,
            zIndexOffset: 1000,
          }).addTo(group);

          hm.on("dragstart", () => {
            map.dragging.disable();
          });
          hm.on("drag", (ev) => {
            const cur = rendered.get(reg.id);
            if (!cur) return;
            cur.ring[vi] = [ev.latlng.lat, ev.latlng.lng];
            cur.poly.setLatLngs(cur.ring);
            cur.label.setLatLng(centroidOf(cur.ring));
          });
          hm.on("dragend", () => {
            map.dragging.enable();
            const cur = rendered.get(reg.id);
            if (!cur) return;
            const newRing = cur.ring.map((p) => [p[0], p[1]]);
            setRegions((prev) =>
              prev.map((r) => (r.id === reg.id ? { ...r, ring: newRing } : r))
            );
          });

          return hm;
        });

        entry = { poly, handles, label, ring: reg.ring.map((p) => [p[0], p[1]]) };
        rendered.set(reg.id, entry);
      } else {
        entry.ring = reg.ring.map((p) => [p[0], p[1]]);
        entry.poly.setLatLngs(entry.ring);
        entry.label.setLatLng(centroidOf(entry.ring));
        entry.handles.forEach((h, i) => {
          if (entry.ring[i]) h.setLatLng(entry.ring[i]);
        });
      }
    });

    return () => {};
  }, [regions]);

  // hover highlight
  React.useEffect(() => {
    hoveredRegionIdRef.current = hoveredRegionId;
    const rendered = regionRenderRef.current;
    regions.forEach((reg) => {
      const entry = rendered.get(reg.id);
      if (!entry) return;
      const on = hoveredRegionId === reg.id;
      entry.poly.setStyle({
        weight: on ? 3.6 : 2,
        fillOpacity: on ? 0.32 : 0.14,
        dashArray: on ? null : "6,4",
      });
      if (on && entry.poly.bringToFront) entry.poly.bringToFront();
    });
    return () => {};
  }, [hoveredRegionId, regions]);

  const rowsForTable = regionRows.map((r) => ({
    ...r,
    hovered: r.id === hoveredRegionId,
  }));

  const selectedShop = selectedStop != null ? data[selectedStop] : null;
  const selectedOrder =
    selectedStop != null ? routePlan.stops.findIndex((s) => s.index === selectedStop) + 1 : null;

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: "100%",
        background: "#fdfbf7",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1.5px solid #292524",
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.08)",
        fontFamily: "'Courier New', Courier, monospace",
        display: "flex",
        flexDirection: "column",
        outline: "none",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px 16px",
          borderBottom: "1.5px dashed #d6d3d1",
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "22px",
            fontWeight: 800,
            color: "#0c0a09",
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          Pin the donuts, ride the line.
        </div>
        <div
          style={{
            marginTop: "4px",
            fontSize: "11.5px",
            color: "#44403c",
          }}
        >
          Set a departure on the dial, stretch the circle, lasso a neighbourhood — then
          click shops to build a route out of the hotel. <b>Drag a pin</b> onto another shop
          and it snaps there, minutes recomputing mid-gesture. <b>Drag the ⠿ handles</b> in
          the list to reorder. Click a pin's number to select it: <b>←/→</b> hops it to the
          next nearest shop, <b>Delete</b> drops it. Every stop costs {DWELL} minutes of
          eating.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "520px",
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
              pinIndex={hoveredShopInfo.pinIndex}
            />
          )}
          <Legend />
          <SelectionHint
            shop={selectedShop}
            order={selectedOrder}
            onDelete={() => {
              const sel = selectedStop;
              if (sel == null) return;
              setRoute((prev) => prev.filter((i) => i !== sel));
              setSelectedStop(null);
              if (shellRef.current) shellRef.current.focus();
            }}
            onClear={() => setSelectedStop(null)}
          />
          {dragPreview && (
            <div
              style={{
                position: "absolute",
                top: 56,
                left: 14,
                zIndex: 1000,
                background: "#1d4ed8",
                border: "1.5px solid #eab308",
                borderRadius: "999px",
                padding: "4px 12px",
                color: "#fffbeb",
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: "11.5px",
                fontWeight: 800,
                pointerEvents: "none",
                boxShadow: "2px 2px 0 rgba(15,23,42,0.5)",
              }}
            >
              snapping to{" "}
              {data[dragPreview.targetIndex] ? data[dragPreview.targetIndex].name : "—"} ·
              total {routePlan.totalMinutes} min
            </div>
          )}
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
            gap: "14px",
            padding: "16px 12px",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <ClockDial
            React={React}
            leaveMinutes={leaveMinutes}
            day={leaveDay}
            onChangeTime={handleTimeChange}
            onChangeDay={handleDayChange}
            onNudge={handleNudge}
          />
          <div
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1.5px solid #292524",
              borderRadius: "6px",
              background: "#fffdf8",
              boxShadow: "3px 3px 0px #1c1917",
              padding: "9px 10px",
            }}
          >
            <div
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#0c0a09",
                marginBottom: "5px",
              }}
            >
              Route
            </div>
            <div style={{ fontSize: "11px", color: "#1c1917", lineHeight: 1.5 }}>
              stops <b>{routePlan.stops.length}</b>
              <br />
              ride <b>{routePlan.totalRide} min</b>
              <br />
              dwell <b>{routePlan.stops.length * DWELL} min</b>
              <br />
              <span style={{ color: "#9a3412", fontWeight: 800 }}>
                total {routePlan.totalMinutes} min
              </span>
              <br />
              {routePlan.stops.length > 0 && (
                <span style={{ color: "#292524" }}>
                  done <b>{fmtClock(leaveMinutes + routePlan.totalMinutes)}</b>
                </span>
              )}
              {selectedStop != null && (
                <>
                  <br />
                  <span style={{ color: "#1d4ed8", fontWeight: 800 }}>
                    #{selectedOrder} selected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <RouteItinerary
        React={React}
        stops={routePlan.stops}
        leaveMinutes={leaveMinutes}
        dwell={DWELL}
        totalMinutes={routePlan.totalMinutes}
        selectedStop={selectedStop}
        onSelectStop={(idx) => {
          if (shellRef.current) shellRef.current.focus();
          setSelectedStop((prev) => (prev === idx ? null : idx));
        }}
        onUnpin={(idx) => {
          setRoute((prev) => prev.filter((i) => i !== idx));
          setSelectedStop((prev) => (prev === idx ? null : prev));
        }}
        onClear={() => {
          setRoute([]);
          setSelectedStop(null);
        }}
        onReorder={handleReorder}
      />

      <RegionTable
        React={React}
        rows={rowsForTable}
        onHoverRegion={setHoveredRegionId}
      />
    </div>
  );
}