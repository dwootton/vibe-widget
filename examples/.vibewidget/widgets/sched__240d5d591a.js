import * as d3 from "https://esm.sh/d3@7";

const DAY_MAP = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseTimeToMinutes(t) {
  if (t === null || t === undefined) return null;
  if (typeof t === "number") return t;
  const str = String(t).trim();
  if (str.includes(":")) {
    const [h, m] = str.split(":").map((v) => parseInt(v, 10));
    if (isNaN(h)) return null;
    return h * 60 + (isNaN(m) ? 0 : m);
  }
  if (/^\d{3,4}$/.test(str)) {
    const pad = str.padStart(4, "0");
    const h = parseInt(pad.slice(0, 2), 10);
    const m = parseInt(pad.slice(2, 4), 10);
    return h * 60 + m;
  }
  return null;
}

function formatMinutes(m) {
  const norm = Math.round(m);
  const hrs = Math.floor(norm / 60);
  const mins = norm % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseOpeningHours(hoursStr, targetDay) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return { open: 0, close: 1440, hasRule: false, closedAllDay: false };
  }
  const clean = hoursStr.trim();
  if (clean.toLowerCase() === "24/7") {
    return { open: 0, close: 1440, hasRule: true, closedAllDay: false };
  }

  const sections = clean.split(";").map((s) => s.trim()).filter(Boolean);
  let matchingRule = null;

  for (const sec of sections) {
    const tokens = sec.split(/\s+/);
    if (tokens.length < 2) continue;
    const daysPart = tokens[0].toLowerCase();
    const timePart = tokens.slice(1).join(" ");

    const days = [];
    const ranges = daysPart.split(",");
    for (const range of ranges) {
      if (range.includes("-")) {
        const [startDayStr, endDayStr] = range.split("-");
        const startDay = DAY_MAP[startDayStr];
        const endDay = DAY_MAP[endDayStr];
        if (startDay !== undefined && endDay !== undefined) {
          if (startDay <= endDay) {
            for (let d = startDay; d <= endDay; d++) days.push(d);
          } else {
            for (let d = startDay; d <= 6; d++) days.push(d);
            for (let d = 0; d <= endDay; d++) days.push(d);
          }
        }
      } else {
        const d = DAY_MAP[range];
        if (d !== undefined) days.push(d);
      }
    }

    if (days.includes(targetDay)) {
      if (timePart.toLowerCase() === "off" || timePart.toLowerCase() === "closed") {
        return { open: null, close: null, hasRule: true, closedAllDay: true };
      }
      const timeMatches = timePart.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if (timeMatches) {
        const openMin = parseTimeToMinutes(timeMatches[1]);
        const closeMin = parseTimeToMinutes(timeMatches[2]);
        matchingRule = { open: openMin, close: closeMin, hasRule: true, closedAllDay: false };
        break;
      }
    }
  }

  if (matchingRule) return matchingRule;
  return { open: null, close: null, hasRule: false, closedAllDay: false };
}

function normalizeDataRows(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (!keys.length) return [];
    const len = Array.isArray(raw[keys[0]]) ? raw[keys[0]].length : 0;
    const list = [];
    for (let i = 0; i < len; i++) {
      const obj = {};
      for (const k of keys) {
        obj[k] = raw[k][i];
      }
      list.push(obj);
    }
    return list;
  }
  return [];
}

export const TimelineLegend = ({ hasViolations }) => (
  <div
    style={{
      marginTop: 20,
      paddingTop: 14,
      borderTop: "1px dashed #e2dad0",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 18,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
      color: "#5c554e",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 14, height: 10, borderRadius: 2, background: "repeating-linear-gradient(45deg, #7c9082, #7c9082 4px, #687e6f 4px, #687e6f 8px)" }} />
      <span>Bicycle Transit (Legs)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 14, height: 10, borderRadius: 2, background: "#e8dcbe", border: "1px solid #c9b996" }} />
      <span>Shop Visit (10 min)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 14, height: 10, borderRadius: 2, background: "#d9534f", border: "1px solid #b33936" }} />
      <span>Issue (Closed / Late Return)</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 14, height: 0, borderTop: "2px dashed #b52a2a" }} />
      <span>08:45 Keynote Deadline</span>
    </div>
    {hasViolations && (
      <div style={{ marginLeft: "auto", color: "#b52a2a", fontWeight: 600 }}>
        Action required: Morning constraint breached
      </div>
    )}
  </div>
);

export default function MorningTimelineWidget({ model, React }) {
  const [route, setRoute] = React.useState(model.get("route"));
  const [when, setWhen] = React.useState(model.get("when"));
  const [legs, setLegs] = React.useState(model.get("legs") || []);
  const [data, setData] = React.useState(model.get("data") || []);
  const [hoveredStop, setHoveredStop] = React.useState(null);

  React.useEffect(() => {
    const handleRoute = () => setRoute(model.get("route"));
    const handleWhen = () => setWhen(model.get("when"));
    const handleLegs = () => setLegs(model.get("legs") || []);
    const handleData = () => setData(model.get("data") || []);

    model.on("change:route", handleRoute);
    model.on("change:when", handleWhen);
    model.on("change:legs", handleLegs);
    model.on("change:data", handleData);

    return () => {
      model.off("change:route", handleRoute);
      model.off("change:when", handleWhen);
      model.off("change:legs", handleLegs);
      model.off("change:data", handleData);
    };
  }, [model]);

  const rows = React.useMemo(() => normalizeDataRows(data), [data]);

  const itinerary = React.useMemo(() => {
    if (!Array.isArray(route) || route.length === 0) {
      return null;
    }

    let startMinutes = 390; // default 06:30
    let day = 0; // Monday
    if (when && typeof when === "object") {
      if (when.day !== undefined && when.day !== null) {
        const d = Number(when.day);
        // the map sends a short name ("Tu"); accept that as well as an index
        day = Number.isFinite(d)
          ? d
          : Math.max(0, ["mo", "tu", "we", "th", "fr", "sa", "su"].indexOf(String(when.day).slice(0, 2).toLowerCase()));
      }
      if (when.hhmm) {
        const parsed = parseTimeToMinutes(when.hhmm);
        if (parsed !== null) startMinutes = parsed;
      }
    } else if (typeof when === "string") {
      const parsed = parseTimeToMinutes(when);
      if (parsed !== null) startMinutes = parsed;
    }

    const KEYNOTE_DEADLINE = 525; // 08:45
    const stopsList = [];
    let currentTime = startMinutes;
    let prevIndexInLegs = 0; // 0 = hotel

    for (let i = 0; i < route.length; i++) {
      const stopIdx = route[i];
      const stopData = rows[stopIdx] || { name: `Shop #${stopIdx}`, hours: null };
      const curIndexInLegs = stopIdx + 1;

      let legMin = 15;
      if (Array.isArray(legs) && legs[prevIndexInLegs] && legs[prevIndexInLegs][curIndexInLegs] != null) {
        legMin = Number(legs[prevIndexInLegs][curIndexInLegs]);
      } else if (stopData.bike_min != null) {
        legMin = Number(stopData.bike_min);
      }

      const rideStart = currentTime;
      const rideEnd = rideStart + legMin;
      const shopStart = rideEnd;
      const shopEnd = shopStart + 10; // 10 min at each shop

      currentTime = shopEnd;
      prevIndexInLegs = curIndexInLegs;

      const parsedHours = parseOpeningHours(stopData.hours, day);
      let arrivesBeforeOpen = false;
      let shopReason = null;

      if (parsedHours.closedAllDay) {
        arrivesBeforeOpen = true;
        shopReason = `Closed on ${DAY_NAMES[day] || "this day"}`;
      } else if (parsedHours.hasRule && parsedHours.open != null && shopStart < parsedHours.open) {
        arrivesBeforeOpen = true;
        shopReason = `Arrives ${formatMinutes(shopStart)}, opens at ${formatMinutes(parsedHours.open)}`;
      }

      stopsList.push({
        step: i + 1,
        stopIdx,
        shopData: stopData,
        legDuration: legMin,
        rideStart,
        rideEnd,
        shopStart,
        shopEnd,
        arrivesBeforeOpen,
        parsedHours,
        shopReason,
      });
    }

    // Final ride back to hotel
    let returnLegMin = 15;
    if (Array.isArray(legs) && legs[prevIndexInLegs] && legs[prevIndexInLegs][0] != null) {
      returnLegMin = Number(legs[prevIndexInLegs][0]);
    } else if (stopsList.length > 0 && stopsList[stopsList.length - 1].shopData.bike_min != null) {
      returnLegMin = Number(stopsList[stopsList.length - 1].shopData.bike_min);
    }

    const returnRideStart = currentTime;
    const returnArrival = returnRideStart + returnLegMin;
    const isLateReturn = returnArrival > KEYNOTE_DEADLINE;

    // Attach reasons and violations
    stopsList.forEach((st) => {
      st.lateReturn = isLateReturn;
      const violations = [];
      if (st.arrivesBeforeOpen) violations.push(st.shopReason);
      if (isLateReturn) {
        violations.push(`Trip returns at ${formatMinutes(returnArrival)} (after 08:45 keynote deadline)`);
      }
      st.isRed = violations.length > 0;
      st.violations = violations;
    });

    return {
      startMinutes,
      day,
      dayName: DAY_NAMES[day] || `Day ${day}`,
      stops: stopsList,
      returnLeg: {
        rideStart: returnRideStart,
        rideEnd: returnArrival,
        duration: returnLegMin,
      },
      finalReturnMinutes: returnArrival,
      isLateReturn,
    };
  }, [route, when, legs, rows]);

  // Compute scale boundaries
  const { minX, maxX } = React.useMemo(() => {
    let minMinutes = 360; // 06:00
    let maxMinutes = 570; // 09:30

    if (itinerary) {
      if (itinerary.startMinutes < minMinutes) minMinutes = Math.floor(itinerary.startMinutes / 30) * 30;
      if (itinerary.finalReturnMinutes > maxMinutes) {
        maxMinutes = Math.ceil((itinerary.finalReturnMinutes + 15) / 30) * 30;
      }
    }
    return { minX: minMinutes, maxX: maxMinutes };
  }, [itinerary]);

  // SVG Chart Dimensions
  const chartWidth = 780;
  const labelColWidth = 170;
  const timelineColWidth = chartWidth - labelColWidth - 40;
  const rowHeight = 44;
  const headerHeight = 36;
  const numRows = itinerary ? itinerary.stops.length + 1 : 0; // stops + return ride row
  const chartHeight = headerHeight + numRows * rowHeight + 10;

  // Scale generator
  const scaleX = React.useCallback(
    (minutes) => {
      const clamped = Math.max(minX, Math.min(maxX, minutes));
      return labelColWidth + ((clamped - minX) / (maxX - minX)) * timelineColWidth;
    },
    [minX, maxX, labelColWidth, timelineColWidth]
  );

  // Time grid ticks every 30 minutes
  const ticks = React.useMemo(() => {
    const list = [];
    for (let m = minX; m <= maxX; m += 30) {
      list.push(m);
    }
    return list;
  }, [minX, maxX]);

  const keynoteX = scaleX(525); // 08:45 keynote

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        color: "#272422",
        padding: "24px 28px",
        borderRadius: "12px",
        border: "1px solid #ebd9c8",
        boxShadow: "0 6px 20px rgba(70, 50, 30, 0.05)",
        fontFamily: "'Playfair Display', Georgia, serif",
        boxSizing: "border-box",
        maxWidth: 860,
        margin: "0 auto",
      }}
    >
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "2px solid #272422",
          paddingBottom: "10px",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              color: "#1e1b18",
            }}
          >
            Morning Expedition
          </h2>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "#796f66",
              marginTop: "4px",
            }}
          >
            {itinerary
              ? `Leaving hotel at ${formatMinutes(itinerary.startMinutes)} on ${itinerary.dayName} · ${itinerary.stops.length} stop${itinerary.stops.length === 1 ? "" : "s"}`
              : "No active itinerary"}
          </div>
        </div>

        {itinerary && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: "right",
              fontSize: "12px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "4px 8px",
                borderRadius: "4px",
                backgroundColor: itinerary.isLateReturn ? "#fbeae8" : "#edf3ee",
                color: itinerary.isLateReturn ? "#b52a2a" : "#2e683e",
                fontWeight: 600,
                border: `1px solid ${itinerary.isLateReturn ? "#f0b8b2" : "#c2dec9"}`,
              }}
            >
              Back at Hotel: {formatMinutes(itinerary.finalReturnMinutes)}
              {itinerary.isLateReturn ? " (Late for 08:45)" : " (On Time)"}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!itinerary || itinerary.stops.length === 0 ? (
        <div
          style={{
            padding: "54px 20px",
            textAlign: "center",
            border: "1px dashed #d5c8bb",
            borderRadius: "8px",
            backgroundColor: "#faf6f0",
            margin: "20px 0",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "19px",
              fontStyle: "italic",
              color: "#5e5246",
              letterSpacing: "0.2px",
            }}
          >
            pin a shop on the map
          </p>
          <span
            style={{
              display: "inline-block",
              marginTop: 8,
              fontSize: "12px",
              fontFamily: "'JetBrains Mono', monospace",
              color: "#938576",
            }}
          >
            Select donut and breakfast spots to schedule the morning ride.
          </span>
        </div>
      ) : (
        <div style={{ overflowX: "auto", position: "relative" }}>
          <svg
            width={chartWidth}
            height={chartHeight}
            style={{ display: "block", overflow: "visible" }}
          >
            <defs>
              <pattern
                id="bikeHatch"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#486350" strokeWidth="2.5" />
                <line x1="0" y1="0" x2="8" y2="0" stroke="#688070" strokeWidth="1" opacity="0.4" />
              </pattern>
              <pattern
                id="bikeHatchAlert"
                width="8"
                height="8"
                patternTransform="rotate(45 0 0)"
                patternUnits="userSpaceOnUse"
              >
                <line x1="0" y1="0" x2="0" y2="8" stroke="#c44340" strokeWidth="2.5" />
              </pattern>
            </defs>

            {/* Time Axis Grid & Labels */}
            {ticks.map((t) => {
              const x = scaleX(t);
              const isKeynote = t === 525;
              return (
                <g key={t} opacity={isKeynote ? 0.3 : 1}>
                  <line
                    x1={x}
                    y1={headerHeight - 6}
                    x2={x}
                    y2={chartHeight - 8}
                    stroke="#e4ded5"
                    strokeWidth={t % 60 === 0 ? "1.5" : "1"}
                    strokeDasharray={t % 60 === 0 ? "none" : "3,3"}
                  />
                  <text
                    x={x}
                    y={headerHeight - 12}
                    textAnchor="middle"
                    fontFamily="'JetBrains Mono', monospace"
                    fontSize="11px"
                    fill="#6e6459"
                    fontWeight={t % 60 === 0 ? "600" : "400"}
                  >
                    {formatMinutes(t)}
                  </text>
                </g>
              );
            })}

            {/* Keynote Vertical Line at 08:45 */}
            {keynoteX >= labelColWidth && keynoteX <= chartWidth && (
              <g>
                <line
                  x1={keynoteX}
                  y1={headerHeight - 8}
                  x2={keynoteX}
                  y2={chartHeight - 4}
                  stroke="#b52a2a"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
                <rect
                  x={keynoteX - 44}
                  y={6}
                  width={88}
                  height={18}
                  rx={3}
                  fill="#b52a2a"
                />
                <text
                  x={keynoteX}
                  y={19}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="'JetBrains Mono', monospace"
                  fontSize="10px"
                  fontWeight="600"
                  letterSpacing="0.4px"
                >
                  08:45 KEYNOTE
                </text>
              </g>
            )}

            {/* Rows for each Stop */}
            {itinerary.stops.map((stop, i) => {
              const y = headerHeight + i * rowHeight;
              const rideStartX = scaleX(stop.rideStart);
              const rideEndX = scaleX(stop.rideEnd);
              const rideW = Math.max(2, rideEndX - rideStartX);

              const shopStartX = rideEndX;
              const shopEndX = scaleX(stop.shopEnd);
              const shopW = Math.max(4, shopEndX - shopStartX);

              const isRed = stop.isRed;
              const shopColor = isRed ? "#d9534f" : "#e6d5b0";
              const shopBorder = isRed ? "#a82d2a" : "#bfa77a";
              const textColor = isRed ? "#ffffff" : "#2d2417";

              return (
                <g
                  key={stop.step}
                  onMouseEnter={() => setHoveredStop(stop)}
                  onMouseLeave={() => setHoveredStop(null)}
                  style={{ cursor: "default" }}
                >
                  {/* Subtle row highlight */}
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={rowHeight - 6}
                    fill={i % 2 === 0 ? "rgba(0,0,0,0.015)" : "transparent"}
                    rx={4}
                  />

                  {/* Left Label: Shop Name & Sequence */}
                  <text
                    x={0}
                    y={y + 16}
                    fontFamily="'Playfair Display', Georgia, serif"
                    fontSize="13px"
                    fontWeight="600"
                    fill={isRed ? "#a82d2a" : "#221d17"}
                  >
                    <tspan
                      fontFamily="'JetBrains Mono', monospace"
                      fontSize="11px"
                      fill="#8c7f73"
                      fontWeight="400"
                    >
                      {stop.step}.{" "}
                    </tspan>
                    {stop.shopData.name ? (stop.shopData.name.length > 17 ? stop.shopData.name.slice(0, 16) + "…" : stop.shopData.name) : `Shop ${stop.stopIdx}`}
                  </text>

                  {/* Street or note sublabel */}
                  <text
                    x={16}
                    y={y + 29}
                    fontFamily="'JetBrains Mono', monospace"
                    fontSize="10px"
                    fill="#85776a"
                  >
                    arr {formatMinutes(stop.shopStart)} ({stop.legDuration}m ride)
                  </text>

                  {/* Ride Bar */}
                  <rect
                    x={rideStartX}
                    y={y + 6}
                    width={rideW}
                    height={22}
                    rx={3}
                    fill="url(#bikeHatch)"
                    stroke="#5a7161"
                    strokeWidth="1"
                  />
                  {rideW > 28 && (
                    <text
                      x={rideStartX + rideW / 2}
                      y={y + 20}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontFamily="'JetBrains Mono', monospace"
                      fontSize="10px"
                      fontWeight="600"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {stop.legDuration}m
                    </text>
                  )}

                  {/* Shop Block */}
                  <rect
                    x={shopStartX}
                    y={y + 4}
                    width={shopW}
                    height={26}
                    rx={4}
                    fill={shopColor}
                    stroke={shopBorder}
                    strokeWidth={isRed ? "1.8" : "1"}
                  />

                  {/* Text inside or next to shop block */}
                  <g>
                    <text
                      x={shopStartX + 6}
                      y={y + 21}
                      fill={textColor}
                      fontFamily="'JetBrains Mono', monospace"
                      fontSize="11px"
                      fontWeight="600"
                    >
                      {formatMinutes(stop.shopStart)}
                      {shopW > 55 ? ` ${stop.shopData.name.split(" ")[0]}` : ""}
                    </text>
                  </g>

                  {/* Red Reason Marker / Warning Badge */}
                  {isRed && (
                    <g transform={`translate(${shopEndX + 8}, ${y + 5})`}>
                      <rect
                        x={0}
                        y={0}
                        width={Math.min(220, chartWidth - shopEndX - 16)}
                        height={24}
                        rx={4}
                        fill="#fae9e8"
                        stroke="#e89895"
                        strokeWidth="1"
                      />
                      <text
                        x={6}
                        y={15}
                        fill="#a62825"
                        fontFamily="'JetBrains Mono', monospace"
                        fontSize="10px"
                        fontWeight="600"
                      >
                        {stop.violations[0].length > 34
                          ? stop.violations[0].slice(0, 32) + "…"
                          : stop.violations[0]}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Return Ride Row */}
            {(() => {
              const y = headerHeight + itinerary.stops.length * rowHeight;
              const ret = itinerary.returnLeg;
              const rStartX = scaleX(ret.rideStart);
              const rEndX = scaleX(ret.rideEnd);
              const rW = Math.max(3, rEndX - rStartX);
              const isLate = itinerary.isLateReturn;

              return (
                <g key="return-leg">
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={rowHeight - 6}
                    fill="rgba(0,0,0,0.02)"
                    rx={4}
                  />
                  <text
                    x={0}
                    y={y + 16}
                    fontFamily="'Playfair Display', Georgia, serif"
                    fontSize="13px"
                    fontWeight="700"
                    fill={isLate ? "#a82d2a" : "#322920"}
                  >
                    Return to Hotel
                  </text>
                  <text
                    x={0}
                    y={y + 29}
                    fontFamily="'JetBrains Mono', monospace"
                    fontSize="10px"
                    fill="#85776a"
                  >
                    {ret.duration}m ride · reaches hotel {formatMinutes(ret.rideEnd)}
                  </text>

                  {/* Ride Bar to Hotel */}
                  <rect
                    x={rStartX}
                    y={y + 6}
                    width={rW}
                    height={22}
                    rx={3}
                    fill={isLate ? "url(#bikeHatchAlert)" : "url(#bikeHatch)"}
                    stroke={isLate ? "#b52a2a" : "#5a7161"}
                    strokeWidth="1.2"
                  />
                  {rW > 28 && (
                    <text
                      x={rStartX + rW / 2}
                      y={y + 20}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontFamily="'JetBrains Mono', monospace"
                      fontSize="10px"
                      fontWeight="600"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {ret.duration}m
                    </text>
                  )}

                  {/* Hotel Arrival Marker */}
                  <rect
                    x={rEndX}
                    y={y + 4}
                    width={22}
                    height={26}
                    rx={4}
                    fill={isLate ? "#d9534f" : "#2f4f38"}
                    stroke={isLate ? "#992320" : "#1f3827"}
                    strokeWidth="1"
                  />
                  <text
                    x={rEndX + 11}
                    y={y + 20}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12px"
                  >
                    ⚑
                  </text>

                  {/* Late tag if applicable */}
                  {isLate && (
                    <g transform={`translate(${rEndX + 28}, ${y + 5})`}>
                      <rect
                        x={0}
                        y={0}
                        width={180}
                        height={24}
                        rx={4}
                        fill="#fae9e8"
                        stroke="#e89895"
                        strokeWidth="1"
                      />
                      <text
                        x={6}
                        y={15}
                        fill="#b52a2a"
                        fontFamily="'JetBrains Mono', monospace"
                        fontSize="10px"
                        fontWeight="700"
                      >
                        Late: {formatMinutes(ret.rideEnd)} &gt; 08:45
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>

          {/* Interactive Inspection Card when hovering */}
          {hoveredStop && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                backgroundColor: hoveredStop.isRed ? "#fff2f1" : "#f4efe6",
                border: `1px solid ${hoveredStop.isRed ? "#f1aba7" : "#dfd5c4"}`,
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <strong>{hoveredStop.shopData.name}</strong>{" "}
                {hoveredStop.shopData.street ? `(${hoveredStop.shopData.street})` : ""}
              </div>
              <div>
                Posted Hours:{" "}
                <span style={{ color: "#61564c" }}>
                  {hoveredStop.shopData.hours || "Unspecified / Open early"}
                </span>
              </div>
              {hoveredStop.violations.length > 0 && (
                <div style={{ color: "#a82d2a", fontWeight: "bold" }}>
                  ⚠ {hoveredStop.violations.join(" · ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend below the last row */}
      <TimelineLegend hasViolations={Boolean(itinerary && (itinerary.isLateReturn || itinerary.stops.some(s => s.arrivesBeforeOpen)))} />
    </div>
  );
}