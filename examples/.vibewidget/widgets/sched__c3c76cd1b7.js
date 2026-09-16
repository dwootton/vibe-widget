import * as d3 from "https://esm.sh/d3@7";

// Helper: parse HH:MM or HHMM to minutes from midnight
function parseHHMMToMinutes(val) {
  if (val == null) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (str.includes(":")) {
    const parts = str.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  } else if (/^\d{3,4}$/.test(str)) {
    const num = parseInt(str, 10);
    const h = Math.floor(num / 100);
    const m = num % 100;
    return h * 60 + m;
  }
  return null;
}

// Helper: format minutes from midnight to HH:MM
function formatMinutesToHHMM(mins) {
  if (mins == null || isNaN(mins)) return "--:--";
  const normalized = Math.round(mins);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const hhStr = (h < 10 ? "0" : "") + h;
  const mmStr = (m < 10 ? "0" : "") + m;
  return `${hhStr}:${mmStr}`;
}

// Helper: parse OSM hours string for a specific day index (0=Mon, ..., 6=Sun)
// Returns { unknown: true } OR { closed: true } OR { intervals: [[openMin, closeMin], ...] }
function parseShopHours(hoursStr, dayOfWeek) {
  if (!hoursStr || typeof hoursStr !== "string" || !hoursStr.trim()) {
    return { unknown: true };
  }
  const cleanStr = hoursStr.trim();
  if (cleanStr.toLowerCase() === "24/7") {
    return { unknown: false, closed: false, intervals: [[0, 24 * 60]] };
  }

  const dayMap = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 };
  const targetDay = (dayOfWeek != null && !isNaN(dayOfWeek)) ? ((Number(dayOfWeek) % 7 + 7) % 7) : 0;

  const rules = cleanStr.split(";").map(s => s.trim()).filter(Boolean);
  const matchedIntervals = [];
  let ruleFoundForDay = false;

  for (const rule of rules) {
    const spaceIdx = rule.indexOf(" ");
    if (spaceIdx === -1) {
      if (rule.toLowerCase() === "closed") {
        return { unknown: false, closed: true, intervals: [] };
      }
      continue;
    }
    const daysPart = rule.substring(0, spaceIdx).trim();
    const timePart = rule.substring(spaceIdx + 1).trim();

    // Check if targetDay is in daysPart
    let applies = false;
    const dayRanges = daysPart.split(",").map(d => d.trim().toLowerCase());
    for (const range of dayRanges) {
      if (range.includes("-")) {
        const [dStart, dEnd] = range.split("-").map(d => d.trim());
        const startIdx = dayMap[dStart];
        const endIdx = dayMap[dEnd];
        if (startIdx !== undefined && endIdx !== undefined) {
          if (startIdx <= endIdx) {
            if (targetDay >= startIdx && targetDay <= endIdx) applies = true;
          } else {
            // wraps over Sunday (e.g. Sa-Tu)
            if (targetDay >= startIdx || targetDay <= endIdx) applies = true;
          }
        }
      } else {
        if (dayMap[range] === targetDay) applies = true;
      }
    }

    if (applies) {
      ruleFoundForDay = true;
      if (timePart.toLowerCase() === "off" || timePart.toLowerCase() === "closed") {
        // closed on this day
      } else {
        const tIntervals = timePart.split(",").map(t => t.trim());
        for (const tInt of tIntervals) {
          const [tOpen, tClose] = tInt.split("-").map(t => t.trim());
          const openM = parseHHMMToMinutes(tOpen);
          const closeM = parseHHMMToMinutes(tClose);
          if (openM !== null && closeM !== null) {
            matchedIntervals.push([openM, closeM]);
          }
        }
      }
    }
  }

  if (!ruleFoundForDay) {
    return { unknown: true };
  }
  if (matchedIntervals.length === 0) {
    return { unknown: false, closed: true, intervals: [] };
  }
  return { unknown: false, closed: false, intervals: matchedIntervals };
}

// Evaluate shop opening status at arrival time
function evaluateShopStatus(hoursStr, dayOfWeek, arrivalMinutes) {
  const parsed = parseShopHours(hoursStr, dayOfWeek);
  if (parsed.unknown) {
    return { status: "unknown", reason: "hours unknown" };
  }
  if (parsed.closed) {
    return { status: "closed_today", reason: "closed today" };
  }

  let isOpen = false;
  let minOpen = Infinity;
  let maxClose = -Infinity;

  for (const [openM, closeM] of parsed.intervals) {
    if (openM < minOpen) minOpen = openM;
    if (closeM > maxClose) maxClose = closeM;
    if (arrivalMinutes >= openM && arrivalMinutes < closeM) {
      isOpen = true;
      break;
    }
  }

  if (isOpen) {
    return { status: "open", reason: null };
  }

  if (arrivalMinutes < minOpen) {
    return { status: "before_open", reason: `opens at ${formatMinutesToHHMM(minOpen)}` };
  } else if (arrivalMinutes >= maxClose) {
    return { status: "after_close", reason: `closed at ${formatMinutesToHHMM(maxClose)}` };
  }

  return { status: "closed", reason: "closed at arrival" };
}

export const Legend = ({ React }) => {
  const items = [
    { label: "Outbound / Return Ride", color: "#e8eff5", border: "#607d8b" },
    { label: "Shop (Open)", color: "#e8f5e9", border: "#2e7d32" },
    { label: "Shop (Hours Unknown)", color: "#eceff1", border: "#78909c" },
    { label: "Problem / Late / Closed", color: "#ffebee", border: "#c62828" },
    { label: "Keynote Line (08:45)", color: "transparent", border: "#d32f2f", dashed: true },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        marginTop: "16px",
        padding: "10px 16px",
        background: "#faf8f5",
        borderRadius: "8px",
        border: "1px solid #eee8df",
        fontSize: "12px",
        fontFamily: "'Fira Code', Menlo, Monaco, monospace",
        color: "#4a4238",
      }}
    >
      {items.map((item, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {item.dashed ? (
            <div
              style={{
                width: "16px",
                height: "0px",
                borderTop: "2px dashed #d32f2f",
              }}
            />
          ) : (
            <div
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "3px",
                backgroundColor: item.color,
                border: `1.5px solid ${item.border}`,
              }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export const TimelineChart = ({ model, React, target, mode, when, data }) => {
  const containerRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: 720, height: 180 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setDimensions((d) => ({
            ...d,
            width: Math.max(500, Math.floor(entry.contentRect.width)),
          }));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute parameters for timeline
  const timelineData = React.useMemo(() => {
    if (target == null || !data || data.length === 0) return null;
    const row = data[target];
    if (!row) return null;

    const currentMode = (mode || "bike").toLowerCase();
    const minKey = `${currentMode}_min`;
    const backKey = `${currentMode}_back`;

    const thereMin = Math.round(row[minKey] != null ? Number(row[minKey]) : 15);
    const backMin = Math.round(row[backKey] != null ? Number(row[backKey]) : 15);
    const shopStayMin = 10;

    let day = 0;
    let leaveMin = 6 * 60 + 30; // default 06:30
    if (when && typeof when === "object") {
      if (when.day != null) day = Number(when.day);
      const parsed = parseHHMMToMinutes(when.hhmm);
      if (parsed !== null) leaveMin = parsed;
    } else if (typeof when === "string" || typeof when === "number") {
      const parsed = parseHHMMToMinutes(when);
      if (parsed !== null) leaveMin = parsed;
    }

    const arrivalMin = leaveMin + thereMin;
    const leaveShopMin = arrivalMin + shopStayMin;
    const returnMin = leaveShopMin + backMin;

    const keynoteMin = 8 * 60 + 45; // 08:45 = 525 min

    const statusEval = evaluateShopStatus(row.hours, day, arrivalMin);
    const shopIsBad = statusEval.status !== "open" && statusEval.status !== "unknown";
    const shopIsUnknown = statusEval.status === "unknown";

    const rideBackIsLate = returnMin > keynoteMin;

    return {
      row,
      mode: currentMode,
      day,
      leaveMin,
      thereMin,
      arrivalMin,
      shopStayMin,
      leaveShopMin,
      backMin,
      returnMin,
      keynoteMin,
      statusEval,
      shopIsBad,
      shopIsUnknown,
      rideBackIsLate,
    };
  }, [target, mode, when, data]);

  React.useEffect(() => {
    if (!containerRef.current || !timelineData) return;

    const d3Container = d3.select(containerRef.current);
    d3Container.selectAll("*").remove();

    const { width } = dimensions;
    const margin = { top: 28, right: 36, bottom: 48, left: 36 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = 100;
    const svgHeight = innerHeight + margin.top + margin.bottom;

    const svg = d3Container
      .append("svg")
      .attr("width", width)
      .attr("height", svgHeight)
      .style("display", "block")
      .style("overflow", "visible");

    // X scale spanning at least 06:00 (360) to 09:30 (570) and stretching if trip runs later
    const baseMin = Math.min(360, timelineData.leaveMin - 15);
    const baseMax = 9 * 60 + 30; // 570 min
    const tripMax = timelineData.returnMin + 20;
    const xMax = Math.max(baseMax, tripMax);
    const xMin = Math.min(360, baseMin);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerWidth]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    const tickInterval = 30; // every 30 mins
    const firstTick = Math.ceil(xMin / tickInterval) * tickInterval;
    const ticks = [];
    for (let t = firstTick; t <= xMax; t += tickInterval) {
      ticks.push(t);
    }

    // Background track
    const trackY = 22;
    const trackHeight = 46;

    g.append("rect")
      .attr("x", 0)
      .attr("y", trackY)
      .attr("width", innerWidth)
      .attr("height", trackHeight)
      .attr("rx", 6)
      .attr("fill", "#f3ede3")
      .attr("opacity", 0.5);

    // Grid lines & axis labels
    g.selectAll(".grid-line")
      .data(ticks)
      .enter()
      .append("line")
      .attr("x1", (d) => xScale(d))
      .attr("x2", (d) => xScale(d))
      .attr("y1", 8)
      .attr("y2", trackY + trackHeight + 12)
      .attr("stroke", "#ded6c9")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,3");

    g.selectAll(".grid-label")
      .data(ticks)
      .enter()
      .append("text")
      .attr("x", (d) => xScale(d))
      .attr("y", trackY + trackHeight + 28)
      .attr("text-anchor", "middle")
      .attr("fill", "#6c6358")
      .attr("font-size", "11px")
      .attr("font-family", "'Fira Code', Menlo, Monaco, monospace")
      .text((d) => formatMinutesToHHMM(d));

    // Define the 3 blocks
    const blocks = [
      {
        id: "ride-there",
        start: timelineData.leaveMin,
        end: timelineData.arrivalMin,
        label: `${timelineData.thereMin} min ${timelineData.mode}`,
        sublabel: `dep ${formatMinutesToHHMM(timelineData.leaveMin)}`,
        bg: "#eef4f8",
        border: "#78909c",
        textColor: "#1c313a",
        isAlert: false,
      },
      {
        id: "shop",
        start: timelineData.arrivalMin,
        end: timelineData.leaveShopMin,
        label: timelineData.row.name || "Donut Shop",
        sublabel: timelineData.shopIsBad
          ? `Arr ${formatMinutesToHHMM(timelineData.arrivalMin)} • ${timelineData.statusEval.reason}`
          : timelineData.shopIsUnknown
          ? `Arr ${formatMinutesToHHMM(timelineData.arrivalMin)} • hours unknown`
          : `Arr ${formatMinutesToHHMM(timelineData.arrivalMin)} • 10m stop`,
        bg: timelineData.shopIsBad ? "#ffebee" : timelineData.shopIsUnknown ? "#eceff1" : "#e8f5e9",
        border: timelineData.shopIsBad ? "#d32f2f" : timelineData.shopIsUnknown ? "#90a4ae" : "#2e7d32",
        textColor: timelineData.shopIsBad ? "#b71c1c" : timelineData.shopIsUnknown ? "#37474f" : "#1b5e20",
        isAlert: timelineData.shopIsBad,
      },
      {
        id: "ride-back",
        start: timelineData.leaveShopMin,
        end: timelineData.returnMin,
        label: `${timelineData.backMin} min return`,
        sublabel: timelineData.rideBackIsLate
          ? `back ${formatMinutesToHHMM(timelineData.returnMin)} (LATE)`
          : `back ${formatMinutesToHHMM(timelineData.returnMin)}`,
        bg: timelineData.rideBackIsLate ? "#ffebee" : "#eef4f8",
        border: timelineData.rideBackIsLate ? "#d32f2f" : "#78909c",
        textColor: timelineData.rideBackIsLate ? "#b71c1c" : "#1c313a",
        isAlert: timelineData.rideBackIsLate,
      },
    ];

    // Draw blocks with subtle entrance transitions
    const blockGroups = g
      .selectAll(".block-group")
      .data(blocks)
      .enter()
      .append("g")
      .attr("class", "block-group")
      .attr("transform", (d) => `translate(${xScale(d.start)}, ${trackY})`);

    blockGroups
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("height", trackHeight)
      .attr("rx", 5)
      .attr("fill", (d) => d.bg)
      .attr("stroke", (d) => d.border)
      .attr("stroke-width", 1.5)
      .attr("width", 0)
      .transition()
      .duration(700)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => Math.max(4, xScale(d.end) - xScale(d.start)));

    // Labels inside blocks
    blockGroups.each(function (d) {
      const blockWidth = Math.max(4, xScale(d.end) - xScale(d.start));
      const textGroup = d3.select(this).append("g").attr("opacity", 0);

      textGroup
        .transition()
        .delay(200)
        .duration(600)
        .attr("opacity", 1);

      // Primary Title
      textGroup
        .append("text")
        .attr("x", blockWidth / 2)
        .attr("y", 18)
        .attr("text-anchor", "middle")
        .attr("fill", d.textColor)
        .attr("font-size", blockWidth < 70 ? "10px" : "12px")
        .attr("font-weight", "600")
        .attr("font-family", "system-ui, -apple-system, sans-serif")
        .text(() => {
          let str = d.label;
          if (blockWidth < 60 && str.length > 8) str = str.slice(0, 7) + "…";
          return str;
        });

      // Sublabel
      textGroup
        .append("text")
        .attr("x", blockWidth / 2)
        .attr("y", 34)
        .attr("text-anchor", "middle")
        .attr("fill", d.textColor)
        .attr("font-size", blockWidth < 70 ? "9px" : "11px")
        .attr("font-family", "'Fira Code', Menlo, Monaco, monospace")
        .attr("opacity", 0.9)
        .text(() => {
          let str = d.sublabel;
          if (blockWidth < 75 && str.length > 12) str = str.slice(0, 11) + "…";
          return str;
        });
    });

    // Vertical Keynote Line at 08:45
    const keynoteX = xScale(timelineData.keynoteMin);
    const keynoteG = g.append("g").attr("transform", `translate(${keynoteX}, 0)`);

    keynoteG
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", 0)
      .attr("y2", trackY + trackHeight + 10)
      .attr("stroke", "#d32f2f")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3");

    // Keynote tag
    const tagGroup = keynoteG.append("g").attr("transform", "translate(0, -6)");

    tagGroup
      .append("rect")
      .attr("x", -32)
      .attr("y", -14)
      .attr("width", 64)
      .attr("height", 18)
      .attr("rx", 3)
      .attr("fill", "#d32f2f");

    tagGroup
      .append("text")
      .attr("x", 0)
      .attr("y", -1)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("font-family", "'Fira Code', Menlo, Monaco, monospace")
      .text("08:45 KEY");

    return () => {
      d3Container.selectAll("*").remove();
    };
  }, [timelineData, dimensions]);

  if (!timelineData) {
    return (
      <div
        style={{
          height: "140px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px dashed #ded4c3",
          borderRadius: "8px",
          background: "#faf8f5",
          color: "#7e7465",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "18px",
          letterSpacing: "0.02em",
          margin: "12px 0",
        }}
      >
        click a shop on the map
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        minHeight: "160px",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    />
  );
};

export default function Widget({ model, React }) {
  const [target, setTarget] = React.useState(() => model.get("target"));
  const [mode, setMode] = React.useState(() => model.get("mode"));
  const [when, setWhen] = React.useState(() => model.get("when"));
  const [data, setData] = React.useState(() => model.get("data") || []);

  React.useEffect(() => {
    const handleTargetChange = () => setTarget(model.get("target"));
    const handleModeChange = () => setMode(model.get("mode"));
    const handleWhenChange = () => setWhen(model.get("when"));
    const handleDataChange = () => setData(model.get("data") || []);

    model.on("change:target", handleTargetChange);
    model.on("change:mode", handleModeChange);
    model.on("change:when", handleWhenChange);
    model.on("change:data", handleDataChange);

    return () => {
      model.off("change:target", handleTargetChange);
      model.off("change:mode", handleModeChange);
      model.off("change:when", handleWhenChange);
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  return (
    <div
      style={{
        backgroundColor: "#fdfbf7",
        padding: "24px 28px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
        border: "1px solid #ede7dc",
        color: "#2c251e",
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "12px",
          borderBottom: "1px solid #ebd9cc",
          paddingBottom: "10px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "20px",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: "700",
            letterSpacing: "-0.01em",
            color: "#1e1b18",
          }}
        >
          Morning Excursion Timeline
        </h3>
        <span
          style={{
            fontSize: "12px",
            fontFamily: "'Fira Code', Menlo, Monaco, monospace",
            color: "#84796d",
          }}
        >
          Houston Donut Tour
        </span>
      </div>

      <TimelineChart
        model={model}
        React={React}
        target={target}
        mode={mode}
        when={when}
        data={data}
      />

      <Legend React={React} />
    </div>
  );
}