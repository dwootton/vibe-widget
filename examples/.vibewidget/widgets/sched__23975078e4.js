import * as d3 from "https://esm.sh/d3@7";

// Helper: parse HH:MM or HHMM string to minutes from midnight
function parseHHMM(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.includes(":")) {
    const parts = s.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (s.length === 4) {
    return parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2, 4), 10);
  }
  return null;
}

// Helper: format minutes from midnight to HH:MM
function formatHHMM(min) {
  if (min == null || isNaN(min)) return "";
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Map day index (0=Mon..6=Sun) to day code
const DAY_CODES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Parse OSM opening_hours string for a specific day (0=Mon..6=Sun)
// Returns { open: min, close: min } or null if closed/unknown
function parseShopHours(hoursStr, dayIndex) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const targetDay = DAY_CODES[dayIndex];
  if (!targetDay) return null;

  // Split multiple rules e.g. "Tu-Fr 10:00-18:00; Sa 10:00-16:00"
  const rules = hoursStr.split(";").map((r) => r.trim());
  for (const rule of rules) {
    if (!rule) continue;
    // Format: DayRange [times] e.g. "Mo-Sa 04:00-14:00" or "Su 05:00-14:00"
    const match = rule.match(/^([A-Za-z,\s-]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) continue;
    const [, daysPart, startStr, endStr] = match;
    const daysInRule = expandDays(daysPart);
    if (daysInRule.includes(targetDay)) {
      return {
        open: parseHHMM(startStr),
        close: parseHHMM(endStr),
      };
    }
  }
  // If rule explicitly exists for other days but not this day, it's closed
  return { open: null, close: null, closedToday: true };
}

function expandDays(daysPart) {
  const result = [];
  const segments = daysPart.split(",").map((s) => s.trim());
  for (const seg of segments) {
    if (seg.includes("-")) {
      const [start, end] = seg.split("-").map((s) => s.trim());
      const si = DAY_CODES.indexOf(start);
      const ei = DAY_CODES.indexOf(end);
      if (si !== -1 && ei !== -1) {
        if (si <= ei) {
          for (let i = si; i <= ei; i++) result.push(DAY_CODES[i]);
        } else {
          for (let i = si; i < 7; i++) result.push(DAY_CODES[i]);
          for (let i = 0; i <= ei; i++) result.push(DAY_CODES[i]);
        }
      }
    } else {
      if (DAY_CODES.includes(seg)) result.push(seg);
    }
  }
  return result;
}

export default function Widget({ model, React }) {
  const [target, setTarget] = React.useState(() => model.get("target"));
  const [mode, setMode] = React.useState(() => model.get("mode") || "bike");
  const [when, setWhen] = React.useState(() => model.get("when") || { day: 0, hhmm: "06:30" });
  const [backBy, setBackBy] = React.useState(() => model.get("back_by") || "08:30");
  const [data, setData] = React.useState(() => model.get("data") || []);

  const containerRef = React.useRef(null);

  // Synchronize state with AnyWidget traits
  React.useEffect(() => {
    const onTarget = () => setTarget(model.get("target"));
    const onMode = () => setMode(model.get("mode") || "bike");
    const onWhen = () => setWhen(model.get("when") || { day: 0, hhmm: "06:30" });
    const onBackBy = () => setBackBy(model.get("back_by") || "08:30");
    const onData = () => setData(model.get("data") || []);

    model.on("change:target", onTarget);
    model.on("change:mode", onMode);
    model.on("change:when", onWhen);
    model.on("change:back_by", onBackBy);
    model.on("change:data", onData);

    return () => {
      model.off("change:target", onTarget);
      model.off("change:mode", onMode);
      model.off("change:when", onWhen);
      model.off("change:back_by", onBackBy);
      model.off("change:data", onData);
    };
  }, [model]);

  // Extract selected row data
  const shopRow = React.useMemo(() => {
    if (target == null || !data) return null;
    if (Array.isArray(data)) {
      return data[target] || null;
    }
    // If pandas DataFrame object in dict-of-columns format
    if (typeof data === "object") {
      const keys = Object.keys(data);
      if (keys.length > 0 && Array.isArray(data[keys[0]])) {
        const row = {};
        for (const k of keys) row[k] = data[k][target];
        return row;
      }
    }
    return null;
  }, [target, data]);

  // Calculate schedule and blocks
  const trip = React.useMemo(() => {
    if (!shopRow) return null;

    const startHhmm = typeof when === "object" && when ? when.hhmm : when;
    const day = typeof when === "object" && when && when.day != null ? when.day : 0;
    const startMin = parseHHMM(startHhmm) ?? 390; // default 06:30 = 390 min
    const backByMin = parseHHMM(backBy) ?? 510; // default 08:30 = 510 min

    const activeMode = mode || "bike";
    const minThere = Math.round(shopRow[`${activeMode}_min`] ?? 15);
    const minBack = Math.round(shopRow[`${activeMode}_back`] ?? 15);
    const shopStay = 10;

    const tLeave = startMin;
    const tArriveShop = tLeave + minThere;
    const tLeaveShop = tArriveShop + shopStay;
    const tBack = tLeaveShop + minBack;

    // Shop hours evaluation
    const hoursStr = shopRow.hours;
    let shopStatus = "unknown"; // 'open' | 'before' | 'after' | 'closed' | 'unknown'
    let shopVerdictText = "";

    if (!hoursStr) {
      shopStatus = "unknown";
    } else {
      const parsed = parseShopHours(hoursStr, day);
      if (!parsed || parsed.closedToday || parsed.open == null) {
        shopStatus = "closed";
        shopVerdictText = "closed today";
      } else if (tArriveShop < parsed.open) {
        shopStatus = "before";
        shopVerdictText = `opens ${formatHHMM(parsed.open)}`;
      } else if (tArriveShop >= parsed.close) {
        shopStatus = "after";
        shopVerdictText = `closed ${formatHHMM(parsed.close)}`;
      } else {
        shopStatus = "open";
      }
    }

    return {
      tLeave,
      tArriveShop,
      tLeaveShop,
      tBack,
      minThere,
      minBack,
      shopStay,
      backByMin,
      activeMode,
      shopStatus,
      shopVerdictText,
      shopName: shopRow.name || "shop",
    };
  }, [shopRow, when, mode, backBy]);

  // Render D3 SVG Timeline
  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    if (!trip) return;

    const width = container.clientWidth || 720;
    const height = 90;
    const margin = { top: 22, right: 28, bottom: 26, left: 28 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Timeline range: at least 06:00 (360) to 09:30 (570), stretches if trip or back_by runs later or earlier
    const minTime = Math.min(360, trip.tLeave - 15);
    const maxTime = Math.max(570, trip.tBack + 20, trip.backByMin + 20);

    const x = d3.scaleLinear().domain([minTime, maxTime]).range([0, innerWidth]);

    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      .style("font-family", "system-ui, -apple-system, sans-serif");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Axis marks (every 30 mins)
    const tickInterval = 30;
    const firstTick = Math.ceil(minTime / tickInterval) * tickInterval;
    const ticks = [];
    for (let t = firstTick; t <= maxTime; t += tickInterval) {
      ticks.push(t);
    }

    const axisG = g.append("g").attr("transform", `translate(0, ${innerHeight})`);

    axisG
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    ticks.forEach((t) => {
      const tx = x(t);
      axisG
        .append("line")
        .attr("x1", tx)
        .attr("x2", tx)
        .attr("y1", 0)
        .attr("y2", 4)
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);

      axisG
        .append("text")
        .attr("x", tx)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#777777")
        .attr("font-size", "11px")
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .text(formatHHMM(t));
    });

    // Row block geometry
    const barY = 6;
    const barH = 26;

    // Block 1: Ride there
    const x0 = x(trip.tLeave);
    const x1 = x(trip.tArriveShop);
    const wRide1 = Math.max(0, x1 - x0);

    g.append("rect")
      .attr("x", x0)
      .attr("y", barY)
      .attr("width", wRide1)
      .attr("height", barH)
      .attr("fill", "#f2f2f2")
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    const ride1Label = `${trip.minThere} min ${trip.activeMode}`;
    if (wRide1 > 35) {
      g.append("text")
        .attr("x", x0 + wRide1 / 2)
        .attr("y", barY + 17)
        .attr("text-anchor", "middle")
        .attr("fill", "#111111")
        .attr("font-size", "11px")
        .text(ride1Label);
    }

    // Block 2: Shop block
    const x2 = x(trip.tLeaveShop);
    const wShop = Math.max(0, x2 - x1);

    const isShopRed = trip.shopStatus === "before" || trip.shopStatus === "after" || trip.shopStatus === "closed";
    const shopFill = isShopRed ? "#ffe3e3" : trip.shopStatus === "unknown" ? "#e9ecef" : "#e6fcf5";
    const shopBorder = isShopRed ? "#c92a2a" : trip.shopStatus === "unknown" ? "#adb5bd" : "#2b8a3e";
    const shopTextColor = isShopRed ? "#c92a2a" : "#111111";

    g.append("rect")
      .attr("x", x1)
      .attr("y", barY)
      .attr("width", wShop)
      .attr("height", barH)
      .attr("fill", shopFill)
      .attr("stroke", shopBorder)
      .attr("stroke-width", 1);

    // Text for shop: name and arrival hh:mm, plus reason if red
    const arriveHhmm = formatHHMM(trip.tArriveShop);
    let shopText = `${trip.shopName} ${arriveHhmm}`;
    if (isShopRed && trip.shopVerdictText) {
      shopText = `${trip.shopName} ${arriveHhmm} (${trip.shopVerdictText})`;
    }

    const shopTextElem = g
      .append("text")
      .attr("x", x1 + 6)
      .attr("y", barY + 17)
      .attr("fill", shopTextColor)
      .attr("font-size", "11px")
      .attr("font-weight", 500)
      .text(shopText);

    // If shop label overflows block width, ensure it doesn't get clipped into back-trip
    if (wShop < 120) {
      shopTextElem
        .attr("x", x1 + wShop / 2)
        .attr("y", barY - 4)
        .attr("text-anchor", "middle");
    }

    // Block 3: Ride back ending at 'back hh:mm'
    // Turns red past back_by
    const x3 = x(trip.tBack);
    const xBackBy = x(trip.backByMin);

    if (trip.tBack <= trip.backByMin) {
      // Entire back trip is on time
      const wRide2 = Math.max(0, x3 - x2);
      g.append("rect")
        .attr("x", x2)
        .attr("y", barY)
        .attr("width", wRide2)
        .attr("height", barH)
        .attr("fill", "#f2f2f2")
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);
    } else if (trip.tLeaveShop >= trip.backByMin) {
      // Entire back trip is late
      const wRide2 = Math.max(0, x3 - x2);
      g.append("rect")
        .attr("x", x2)
        .attr("y", barY)
        .attr("width", wRide2)
        .attr("height", barH)
        .attr("fill", "#ffe3e3")
        .attr("stroke", "#c92a2a")
        .attr("stroke-width", 1);
    } else {
      // Back trip splits: [x2..xBackBy] normal, [xBackBy..x3] late
      const w1 = Math.max(0, xBackBy - x2);
      const w2 = Math.max(0, x3 - xBackBy);

      g.append("rect")
        .attr("x", x2)
        .attr("y", barY)
        .attr("width", w1)
        .attr("height", barH)
        .attr("fill", "#f2f2f2")
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);

      g.append("rect")
        .attr("x", xBackBy)
        .attr("y", barY)
        .attr("width", w2)
        .attr("height", barH)
        .attr("fill", "#ffe3e3")
        .attr("stroke", "#c92a2a")
        .attr("stroke-width", 1);
    }

    // Text on or after ride back: ending at 'back hh:mm'
    const backHhmm = formatHHMM(trip.tBack);
    const backLabel = `back ${backHhmm}`;
    const ride2TotalW = Math.max(0, x3 - x2);

    if (ride2TotalW > 60) {
      g.append("text")
        .attr("x", x2 + ride2TotalW / 2)
        .attr("y", barY + 17)
        .attr("text-anchor", "middle")
        .attr("fill", trip.tBack > trip.backByMin ? "#c92a2a" : "#111111")
        .attr("font-size", "11px")
        .text(backLabel);
    } else {
      g.append("text")
        .attr("x", x3 + 4)
        .attr("y", barY + 17)
        .attr("text-anchor", "start")
        .attr("fill", trip.tBack > trip.backByMin ? "#c92a2a" : "#111111")
        .attr("font-size", "11px")
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .text(backLabel);
    }

    // Vertical red hairline at back_by, labelled with that time
    const hairlineG = g.append("g").attr("transform", `translate(${xBackBy}, 0)`);

    hairlineG
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", -2)
      .attr("y2", innerHeight)
      .attr("stroke", "#c92a2a")
      .attr("stroke-width", 1);

    hairlineG
      .append("text")
      .attr("x", 0)
      .attr("y", -6)
      .attr("text-anchor", "middle")
      .attr("fill", "#c92a2a")
      .attr("font-size", "11px")
      .attr("font-weight", 600)
      .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
      .text(formatHHMM(trip.backByMin));

    return () => {
      svg.remove();
    };
  }, [trip]);

  if (target == null || !shopRow) {
    return (
      <div
        style={{
          fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
          fontSize: "12px",
          color: "#777777",
          padding: "12px",
          background: "#ffffff",
          lineHeight: "24px",
        }}
      >
        click a shop on the map
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#ffffff",
        padding: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div ref={containerRef} style={{ width: "100%" }} />
    </div>
  );
}