import * as d3 from "https://esm.sh/d3@7";

function parseTimeToMinutes(t) {
  if (t == null) return null;
  if (typeof t === "number") return t;
  const s = String(t).trim();
  if (!s) return null;
  if (s.includes(":")) {
    const parts = s.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  if (s.length === 4 && !isNaN(s)) {
    const h = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2), 10);
    return h * 60 + m;
  }
  return null;
}

function formatMinutesToHHMM(m) {
  if (m == null || isNaN(m)) return "";
  const total = Math.round(m);
  const hrs = Math.floor(total / 60) % 24;
  const mins = total % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

const DAY_MAP = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6
};

function parseHoursString(hoursStr, targetDay) {
  if (!hoursStr || typeof hoursStr !== "string") return null;
  const s = hoursStr.trim();
  if (s === "24/7") return [{ open: 0, close: 24 * 60 }];

  const rules = s.split(";").map(r => r.trim()).filter(Boolean);
  const dayIntervals = [];

  for (const rule of rules) {
    const match = rule.match(/^([A-Za-z,\s-]+)\s+([\d:]+)\s*-\s*([\d:]+)$/);
    if (!match) continue;

    const daysPart = match[1].trim();
    const openM = parseTimeToMinutes(match[2].trim());
    const closeM = parseTimeToMinutes(match[3].trim());
    if (openM == null || closeM == null) continue;

    const dayTokens = daysPart.split(",").map(t => t.trim());
    const appliesToDays = new Set();

    for (const token of dayTokens) {
      if (token.includes("-")) {
        const [startD, endD] = token.split("-").map(d => d.trim().toLowerCase());
        const startIdx = DAY_MAP[startD];
        const endIdx = DAY_MAP[endD];
        if (startIdx !== undefined && endIdx !== undefined) {
          let cur = startIdx;
          while (true) {
            appliesToDays.add(cur);
            if (cur === endIdx) break;
            cur = (cur + 1) % 7;
          }
        }
      } else {
        const dIdx = DAY_MAP[token.toLowerCase()];
        if (dIdx !== undefined) appliesToDays.add(dIdx);
      }
    }

    if (targetDay == null || appliesToDays.has(targetDay)) {
      dayIntervals.push({ open: openM, close: closeM });
    }
  }

  return dayIntervals.length > 0 ? dayIntervals : null;
}

export const Timeline = ({ data, target, mode, when, back_by, React, width = 720 }) => {
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    if (target == null || !data) return;

    let row = null;
    if (Array.isArray(data)) {
      row = data[target];
    } else if (typeof data === "object" && data !== null) {
      if (Array.isArray(data.name)) {
        row = {};
        for (const k of Object.keys(data)) {
          row[k] = data[k][target];
        }
      } else if (data[target]) {
        row = data[target];
      }
    }

    if (!row) return;

    let targetDay = 0;
    let departMin = 390; // 06:30 default

    if (when != null) {
      if (typeof when === "object") {
        if (when.day !== undefined) targetDay = Number(when.day);
        if (when.hhmm !== undefined) {
          const parsed = parseTimeToMinutes(when.hhmm);
          if (parsed !== null) departMin = parsed;
        }
      } else {
        const parsed = parseTimeToMinutes(when);
        if (parsed !== null) departMin = parsed;
      }
    }

    const travelMode = (mode || "bike").toLowerCase();
    const minCol = `${travelMode}_min`;
    const backCol = `${travelMode}_back`;

    const outDuration = Number(row[minCol]) || 0;
    const shopDuration = 10;
    const returnDuration = Number(row[backCol]) || 0;

    const arriveShopMin = departMin + outDuration;
    const leaveShopMin = arriveShopMin + shopDuration;
    const returnMin = leaveShopMin + returnDuration;

    const backByMin = parseTimeToMinutes(back_by);

    const intervals = parseHoursString(row.hours, targetDay);
    let shopVerdict = "unknown";
    let shopReason = "";

    if (row.hours == null || row.hours === "" || intervals === null) {
      shopVerdict = "unknown";
    } else {
      let isOpen = false;
      let earliestOpen = null;
      let latestClose = null;

      for (const inv of intervals) {
        if (earliestOpen === null || inv.open < earliestOpen) earliestOpen = inv.open;
        if (latestClose === null || inv.close > latestClose) latestClose = inv.close;
        if (arriveShopMin >= inv.open && arriveShopMin < inv.close) {
          isOpen = true;
          break;
        }
      }

      if (isOpen) {
        shopVerdict = "open";
      } else {
        shopVerdict = "closed";
        if (earliestOpen !== null && arriveShopMin < earliestOpen) {
          shopReason = `opens ${formatMinutesToHHMM(earliestOpen)}`;
        } else if (latestClose !== null && arriveShopMin >= latestClose) {
          shopReason = `closed ${formatMinutesToHHMM(latestClose)}`;
        } else {
          shopReason = "closed";
        }
      }
    }

    const margin = { top: 28, right: 36, bottom: 26, left: 16 };
    const w = Math.max(container.clientWidth || width, 400);
    const h = 100;
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const baseMin = 360; // 06:00
    const baseMax = 570; // 09:30
    let xMax = Math.max(baseMax, returnMin + 15);
    if (backByMin !== null && backByMin > xMax) {
      xMax = backByMin + 15;
    }
    const xMin = Math.min(baseMin, departMin - 15);

    const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);

    const svg = d3.select(container)
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("display", "block")
      .style("font-family", "system-ui, -apple-system, Inter, Helvetica, sans-serif");

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const barY = 4;
    const barH = 26;

    // Gridlines and axis ticks
    const step = 30;
    const firstTick = Math.ceil(xMin / step) * step;
    const ticks = [];
    for (let t = firstTick; t <= xMax; t += step) {
      ticks.push(t);
    }

    const gridG = g.append("g").attr("class", "grid");
    ticks.forEach(t => {
      const x = xScale(t);
      gridG.append("line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "#f2f2f2")
        .attr("stroke-width", 1);

      gridG.append("text")
        .attr("x", x)
        .attr("y", innerH + 16)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("fill", "#777777")
        .text(formatMinutesToHHMM(t));
    });

    // Baseline axis rule
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", innerH)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    // Block 1: Ride there
    const x1 = xScale(departMin);
    const x2 = xScale(arriveShopMin);
    const block1W = Math.max(0, x2 - x1);

    const b1 = g.append("g");
    b1.append("rect")
      .attr("x", x1)
      .attr("y", barY)
      .attr("width", block1W)
      .attr("height", barH)
      .attr("fill", "#f2f2f2")
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    b1.append("text")
      .attr("x", x1 + 6)
      .attr("y", barY + 17)
      .attr("font-size", 12)
      .attr("fill", "#111111")
      .text(`${Math.round(outDuration)} min ${travelMode}`);

    // Block 2: Shop block
    const x3 = xScale(leaveShopMin);
    const block2W = Math.max(0, x3 - x2);

    let shopFill = "#f2f2f2";
    let shopStroke = "#777777";
    let shopTextColor = "#111111";

    if (shopVerdict === "closed") {
      shopFill = "#fff5f5";
      shopStroke = "#c92a2a";
      shopTextColor = "#c92a2a";
    } else if (shopVerdict === "open") {
      shopFill = "#f2f2f2";
      shopStroke = "#111111";
      shopTextColor = "#111111";
    } else {
      shopFill = "#f2f2f2";
      shopStroke = "#777777";
      shopTextColor = "#777777";
    }

    const b2 = g.append("g");
    b2.append("rect")
      .attr("x", x2)
      .attr("y", barY)
      .attr("width", block2W)
      .attr("height", barH)
      .attr("fill", shopFill)
      .attr("stroke", shopStroke)
      .attr("stroke-width", 1);

    const shopName = row.name || "shop";
    let shopLabel = `${shopName} · ${formatMinutesToHHMM(arriveShopMin)}`;
    if (shopVerdict === "closed" && shopReason) {
      shopLabel = `${shopName} · ${shopReason} (${formatMinutesToHHMM(arriveShopMin)})`;
    }

    b2.append("text")
      .attr("x", x2 + 6)
      .attr("y", barY + 17)
      .attr("font-size", 12)
      .attr("font-weight", shopVerdict === "closed" ? 600 : 400)
      .attr("fill", shopTextColor)
      .text(shopLabel);

    // Block 3: Ride back (split if back_by is exceeded)
    const x4 = xScale(returnMin);

    if (backByMin !== null && backByMin < returnMin) {
      const splitMin = Math.max(leaveShopMin, backByMin);
      const splitX = xScale(splitMin);

      if (splitX > x3) {
        g.append("rect")
          .attr("x", x3)
          .attr("y", barY)
          .attr("width", splitX - x3)
          .attr("height", barH)
          .attr("fill", "#f2f2f2")
          .attr("stroke", "#d9d9d9")
          .attr("stroke-width", 1);
      }

      g.append("rect")
        .attr("x", splitX)
        .attr("y", barY)
        .attr("width", Math.max(0, x4 - splitX))
        .attr("height", barH)
        .attr("fill", "#fff5f5")
        .attr("stroke", "#c92a2a")
        .attr("stroke-width", 1);
    } else {
      g.append("rect")
        .attr("x", x3)
        .attr("y", barY)
        .attr("width", Math.max(0, x4 - x3))
        .attr("height", barH)
        .attr("fill", "#f2f2f2")
        .attr("stroke", "#d9d9d9")
        .attr("stroke-width", 1);
    }

    g.append("text")
      .attr("x", x3 + 6)
      .attr("y", barY + 17)
      .attr("font-size", 12)
      .attr("fill", backByMin !== null && returnMin > backByMin ? "#c92a2a" : "#111111")
      .text(`back ${formatMinutesToHHMM(returnMin)}`);

    // Back_by hairline marker
    if (backByMin !== null) {
      const bX = xScale(backByMin);
      const markG = g.append("g");

      markG.append("line")
        .attr("x1", bX)
        .attr("x2", bX)
        .attr("y1", -12)
        .attr("y2", innerH)
        .attr("stroke", "#c92a2a")
        .attr("stroke-width", 1);

      markG.append("text")
        .attr("x", bX)
        .attr("y", -16)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("font-family", "ui-monospace, SF Mono, Menlo, monospace")
        .attr("fill", "#c92a2a")
        .text(formatMinutesToHHMM(backByMin));
    }

    return () => {
      container.innerHTML = "";
    };
  }, [data, target, mode, when, back_by, width]);

  return <div ref={containerRef} style={{ width: "100%", overflowX: "auto" }} />;
};

export default function Widget({ model, React }) {
  const [target, setTarget] = React.useState(model.get("target"));
  const [mode, setMode] = React.useState(model.get("mode"));
  const [when, setWhen] = React.useState(model.get("when"));
  const [backBy, setBackBy] = React.useState(model.get("back_by"));
  const [data, setData] = React.useState(model.get("data"));

  React.useEffect(() => {
    const onTarget = () => setTarget(model.get("target"));
    const onMode = () => setMode(model.get("mode"));
    const onWhen = () => setWhen(model.get("when"));
    const onBackBy = () => setBackBy(model.get("back_by"));
    const onData = () => setData(model.get("data"));

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

  return (
    <div
      style={{
        background: "#ffffff",
        padding: 12,
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        color: "#111111"
      }}
    >
      {target == null ? (
        <div
          style={{
            fontSize: 13,
            color: "#777777",
            padding: "8px 0",
            lineHeight: "24px"
          }}
        >
          click a shop on the map
        </div>
      ) : (
        <Timeline
          data={data}
          target={target}
          mode={mode}
          when={when}
          back_by={backBy}
          React={React}
        />
      )}
    </div>
  );
}