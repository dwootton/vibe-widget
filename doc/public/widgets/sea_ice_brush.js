import * as d3 from "https://esm.sh/d3@7";

function normalizeData(rawData) {
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  if (typeof rawData === "object") {
    const keys = Object.keys(rawData);
    if (keys.length > 0 && Array.isArray(rawData[keys[0]])) {
      const len = rawData[keys[0]].length;
      const rows = new Array(len);
      for (let i = 0; i < len; i++) {
        const row = {};
        for (const k of keys) {
          row[k] = rawData[k][i];
        }
        rows[i] = row;
      }
      return rows;
    }
  }
  return [];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const START_YEAR = 1979;
const END_YEAR = 2026;
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Widget({ model, React }) {
  const rawData = model.get("data");
  const [data, setData] = React.useState(() => normalizeData(rawData));
  const [region, setRegion] = React.useState("Barents");
  const [brushState, setBrushState] = React.useState({
    year_lo: 2005,
    year_hi: 2015,
    month_lo: 6,
    month_hi: 9
  });
  const [avgFrac, setAvgFrac] = React.useState(null);

  const containerRef = React.useRef(null);
  const chartWrapperRef = React.useRef(null);
  const brushGroupRef = React.useRef(null);
  const brushStateRef = React.useRef(brushState);
  brushStateRef.current = brushState;

  const dataMapRef = React.useRef(new Map());
  const scalesRef = React.useRef({ x: null, y: null, cellWidth: 0, cellHeight: 0 });

  React.useEffect(() => {
    const handleDataChange = () => {
      setData(normalizeData(model.get("data")));
    };
    model.on("change:data", handleDataChange);
    return () => {
      model.off("change:data", handleDataChange);
    };
  }, [model]);

  const regions = React.useMemo(() => {
    const set = new Set();
    for (let i = 0; i < data.length; i++) {
      if (data[i].region) set.add(data[i].region);
    }
    const list = Array.from(set).sort();
    return list.length > 0 ? list : ["Barents"];
  }, [data]);

  React.useEffect(() => {
    if (regions.length > 0 && !regions.includes(region)) {
      if (regions.includes("Barents")) {
        setRegion("Barents");
      } else {
        setRegion(regions[0]);
      }
    }
  }, [regions, region]);

  const regionData = React.useMemo(() => {
    const map = new Map();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (d.region === region) {
        map.set(`${d.year}-${d.month}`, d.frac);
      }
    }
    dataMapRef.current = map;
    return map;
  }, [data, region]);

  const computeStats = React.useCallback((b) => {
    if (!b) return { avg: null, count: 0, validCount: 0 };
    const { year_lo, year_hi, month_lo, month_hi } = b;
    let sum = 0;
    let validCount = 0;
    let totalCells = 0;
    const map = dataMapRef.current;

    for (let y = year_lo; y <= year_hi; y++) {
      for (let m = month_lo; m <= month_hi; m++) {
        totalCells++;
        const val = map.get(`${y}-${m}`);
        if (val !== undefined && val !== null && !isNaN(val)) {
          sum += Number(val);
          validCount++;
        }
      }
    }
    const avg = validCount > 0 ? sum / validCount : null;
    return { avg, count: totalCells, validCount };
  }, []);

  const syncModel = React.useCallback((currentRegion, currentBrush) => {
    if (!currentBrush) {
      model.set("where", { region: currentRegion, month_lo: null, month_hi: null, year_lo: null, year_hi: null });
      model.set("avg_frac", null);
      model.save_changes();
      setAvgFrac(null);
      return;
    }
    const stats = computeStats(currentBrush);
    const avgVal = stats.avg !== null ? Number(stats.avg.toFixed(4)) : null;
    const whereVal = {
      region: currentRegion,
      month_lo: currentBrush.month_lo,
      month_hi: currentBrush.month_hi,
      year_lo: currentBrush.year_lo,
      year_hi: currentBrush.year_hi
    };
    model.set("where", whereVal);
    model.set("avg_frac", avgVal);
    model.save_changes();
    setAvgFrac(stats.avg !== null ? Number(stats.avg.toFixed(2)) : null);
  }, [model, computeStats]);

  React.useEffect(() => {
    syncModel(region, brushStateRef.current);
  }, [region, regionData, syncModel]);

  const updateBrushOverlay = React.useCallback((b) => {
    const bg = brushGroupRef.current;
    if (!bg) return;
    const g = d3.select(bg);

    if (!b) {
      g.style("display", "none");
      return;
    }
    g.style("display", null);

    const { x, y, cellWidth, cellHeight } = scalesRef.current;
    if (!x || !y) return;

    const x0 = x(b.year_lo);
    const x1 = x(b.year_hi) + cellWidth;
    const y0 = y(b.month_lo);
    const y1 = y(b.month_hi) + cellHeight;

    const width = Math.max(1, x1 - x0);
    const height = Math.max(1, y1 - y0);

    g.select(".brush-rect")
      .attr("x", x0)
      .attr("y", y0)
      .attr("width", width)
      .attr("height", height);

    g.select(".edge-w")
      .attr("x", x0 - 4)
      .attr("y", y0)
      .attr("width", 8)
      .attr("height", height);

    g.select(".edge-e")
      .attr("x", x1 - 4)
      .attr("y", y0)
      .attr("width", 8)
      .attr("height", height);

    g.select(".edge-n")
      .attr("x", x0)
      .attr("y", y0 - 4)
      .attr("width", width)
      .attr("height", 8);

    g.select(".edge-s")
      .attr("x", x0)
      .attr("y", y1 - 4)
      .attr("width", width)
      .attr("height", 8);

    g.select(".corner-nw").attr("cx", x0).attr("cy", y0);
    g.select(".corner-ne").attr("cx", x1).attr("cy", y0);
    g.select(".corner-sw").attr("cx", x0).attr("cy", y1);
    g.select(".corner-se").attr("cx", x1).attr("cy", y1);

    const stats = computeStats(b);
    const labelText = stats.avg !== null
      ? `avg ${stats.avg.toFixed(2)} · ${stats.count} cells`
      : `no data · ${stats.count} cells`;

    const labelGroup = g.select(".brush-label-group");
    const labelTextNode = labelGroup.select("text");
    labelTextNode.text(labelText);

    let textY = y0 - 6;
    let anchor = "start";
    let textX = x0 + 1;

    if (y0 < 18) {
      textY = y0 + 14;
    }
    if (x0 > x(END_YEAR) - 90) {
      anchor = "end";
      textX = x1 - 2;
    }

    labelTextNode
      .attr("x", textX)
      .attr("y", textY)
      .attr("text-anchor", anchor);
  }, [computeStats]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = "";

    const margin = { top: 28, right: 20, bottom: 24, left: 38 };
    const width = 840;
    const height = 300;
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const cellWidth = plotWidth / YEARS.length;
    const cellHeight = plotHeight / 12;

    const x = d3.scaleBand()
      .domain(YEARS)
      .range([0, plotWidth])
      .paddingInner(0.04)
      .paddingOuter(0);

    const y = d3.scaleBand()
      .domain(MONTHS)
      .range([0, plotHeight])
      .paddingInner(0.04)
      .paddingOuter(0);

    scalesRef.current = {
      x,
      y,
      cellWidth: x.bandwidth(),
      cellHeight: y.bandwidth(),
      stepX: x.step(),
      stepY: y.step(),
      plotWidth,
      plotHeight
    };

    const colorScale = d3.scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateRgbBasis(["#ffffff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"]));

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .style("display", "block")
      .style("user-select", "none");

    const defs = svg.append("defs");
    const pattern = defs.append("pattern")
      .attr("id", "hatch-pattern")
      .attr("width", 6)
      .attr("height", 6)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");

    pattern.append("rect")
      .attr("width", 6)
      .attr("height", 6)
      .attr("fill", "#fafafa");

    pattern.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 6)
      .attr("stroke", "#d0d0d0")
      .attr("stroke-width", 1.2);

    const g = svg.append("g")
      .attr("class", "plot-area")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("rect")
      .attr("class", "plot-background")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", plotWidth)
      .attr("height", plotHeight)
      .attr("fill", "#ffffff")
      .attr("cursor", "crosshair");

    const cellsGroup = g.append("g").attr("class", "cells");

    for (let yr of YEARS) {
      for (let mo of MONTHS) {
        const key = `${yr}-${mo}`;
        const val = regionData.get(key);
        const hasVal = val !== undefined && val !== null && !isNaN(val);

        cellsGroup.append("rect")
          .attr("x", x(yr))
          .attr("y", y(mo))
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .attr("fill", hasVal ? colorScale(val) : "url(#hatch-pattern)")
          .attr("stroke", "#e5e5e5")
          .attr("stroke-width", 0.5)
          .attr("pointer-events", "none");
      }
    }

    const yAxisGroup = g.append("g").attr("class", "axis-y");
    for (let mo of MONTHS) {
      yAxisGroup.append("text")
        .attr("x", -8)
        .attr("y", y(mo) + y.bandwidth() / 2)
        .attr("dy", "0.32em")
        .attr("text-anchor", "end")
        .attr("fill", "#777777")
        .attr("font-size", 11)
        .attr("font-family", "system-ui, -apple-system, sans-serif")
        .text(MONTH_NAMES[mo - 1]);
    }

    const xAxisGroup = g.append("g").attr("class", "axis-x");
    for (let yr of YEARS) {
      if (yr % 5 === 0) {
        const xPos = x(yr) + x.bandwidth() / 2;
        xAxisGroup.append("line")
          .attr("x1", xPos)
          .attr("x2", xPos)
          .attr("y1", plotHeight)
          .attr("y2", plotHeight + 4)
          .attr("stroke", "#bbbbbb")
          .attr("stroke-width", 1);

        xAxisGroup.append("text")
          .attr("x", xPos)
          .attr("y", plotHeight + 16)
          .attr("text-anchor", "middle")
          .attr("fill", "#777777")
          .attr("font-size", 11)
          .attr("font-family", "system-ui, -apple-system, sans-serif")
          .text(yr);
      }
    }

    const brushG = g.append("g")
      .attr("class", "brush-overlay");
    brushGroupRef.current = brushG.node();

    brushG.append("rect")
      .attr("class", "brush-rect")
      .attr("fill", "#d9480f")
      .attr("fill-opacity", 0.12)
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "move");

    brushG.append("rect")
      .attr("class", "edge-w")
      .attr("fill", "transparent")
      .attr("cursor", "ew-resize");

    brushG.append("rect")
      .attr("class", "edge-e")
      .attr("fill", "transparent")
      .attr("cursor", "ew-resize");

    brushG.append("rect")
      .attr("class", "edge-n")
      .attr("fill", "transparent")
      .attr("cursor", "ns-resize");

    brushG.append("rect")
      .attr("class", "edge-s")
      .attr("fill", "transparent")
      .attr("cursor", "ns-resize");

    brushG.append("circle")
      .attr("class", "corner-nw")
      .attr("r", 3.5)
      .attr("fill", "#ffffff")
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "nwse-resize");

    brushG.append("circle")
      .attr("class", "corner-ne")
      .attr("r", 3.5)
      .attr("fill", "#ffffff")
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "nesw-resize");

    brushG.append("circle")
      .attr("class", "corner-sw")
      .attr("r", 3.5)
      .attr("fill", "#ffffff")
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "nesw-resize");

    brushG.append("circle")
      .attr("class", "corner-se")
      .attr("r", 3.5)
      .attr("fill", "#ffffff")
      .attr("stroke", "#d9480f")
      .attr("stroke-width", 1.5)
      .attr("cursor", "nwse-resize");

    const labelGroup = brushG.append("g")
      .attr("class", "brush-label-group")
      .attr("pointer-events", "none");

    labelGroup.append("text")
      .attr("fill", "#111111")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .attr("font-family", "system-ui, -apple-system, sans-serif")
      .style("paint-order", "stroke")
      .style("stroke", "#ffffff")
      .style("stroke-width", "3px")
      .style("stroke-linejoin", "round");

    function coordsToCell(px, py) {
      const clampedX = Math.max(0, Math.min(plotWidth - 1, px));
      const clampedY = Math.max(0, Math.min(plotHeight - 1, py));

      const yrIdx = Math.floor((clampedX / plotWidth) * YEARS.length);
      const year = YEARS[Math.max(0, Math.min(YEARS.length - 1, yrIdx))];

      const moIdx = Math.floor((clampedY / plotHeight) * 12);
      const month = MONTHS[Math.max(0, Math.min(11, moIdx))];

      return { year, month };
    }

    let dragMode = null;
    let dragStartCoords = null;
    let initialBrush = null;

    function onPointerDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();

      if (chartWrapperRef.current) {
        chartWrapperRef.current.focus();
      }

      const [px, py] = d3.pointer(event, g.node());
      const target = event.target;
      const b = brushStateRef.current;

      if (target.classList.contains("brush-rect")) {
        dragMode = "move";
      } else if (target.classList.contains("edge-w")) {
        dragMode = "w";
      } else if (target.classList.contains("edge-e")) {
        dragMode = "e";
      } else if (target.classList.contains("edge-n")) {
        dragMode = "n";
      } else if (target.classList.contains("edge-s")) {
        dragMode = "s";
      } else if (target.classList.contains("corner-nw")) {
        dragMode = "nw";
      } else if (target.classList.contains("corner-ne")) {
        dragMode = "ne";
      } else if (target.classList.contains("corner-sw")) {
        dragMode = "sw";
      } else if (target.classList.contains("corner-se")) {
        dragMode = "se";
      } else {
        dragMode = "new";
        const c = coordsToCell(px, py);
        initialBrush = {
          year_lo: c.year,
          year_hi: c.year,
          month_lo: c.month,
          month_hi: c.month
        };
        brushStateRef.current = initialBrush;
        dragStartCoords = { ...c };
        updateBrushOverlay(initialBrush);
        syncModel(region, initialBrush);
        setBrushState(initialBrush);

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        return;
      }

      dragStartCoords = coordsToCell(px, py);
      initialBrush = { ...b };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(event) {
      if (!dragMode) return;
      const [px, py] = d3.pointer(event, g.node());
      const currentCell = coordsToCell(px, py);
      let nextBrush = { ...brushStateRef.current };

      if (dragMode === "new") {
        nextBrush = {
          year_lo: Math.min(dragStartCoords.year, currentCell.year),
          year_hi: Math.max(dragStartCoords.year, currentCell.year),
          month_lo: Math.min(dragStartCoords.month, currentCell.month),
          month_hi: Math.max(dragStartCoords.month, currentCell.month)
        };
      } else if (dragMode === "move") {
        const dYear = currentCell.year - dragStartCoords.year;
        const dMonth = currentCell.month - dragStartCoords.month;
        const spanYear = initialBrush.year_hi - initialBrush.year_lo;
        const spanMonth = initialBrush.month_hi - initialBrush.month_lo;

        let newYLo = initialBrush.year_lo + dYear;
        let newYHi = newYLo + spanYear;
        if (newYLo < START_YEAR) {
          newYLo = START_YEAR;
          newYHi = newYLo + spanYear;
        } else if (newYHi > END_YEAR) {
          newYHi = END_YEAR;
          newYLo = newYHi - spanYear;
        }

        let newMLo = initialBrush.month_lo + dMonth;
        let newMHi = newMLo + spanMonth;
        if (newMLo < 1) {
          newMLo = 1;
          newMHi = newMLo + spanMonth;
        } else if (newMHi > 12) {
          newMHi = 12;
          newMLo = newMHi - spanMonth;
        }

        nextBrush = {
          year_lo: newYLo,
          year_hi: newYHi,
          month_lo: newMLo,
          month_hi: newMHi
        };
      } else {
        let yLo = initialBrush.year_lo;
        let yHi = initialBrush.year_hi;
        let mLo = initialBrush.month_lo;
        let mHi = initialBrush.month_hi;

        if (dragMode.includes("w")) {
          yLo = Math.min(currentCell.year, yHi);
        }
        if (dragMode.includes("e")) {
          yHi = Math.max(currentCell.year, yLo);
        }
        if (dragMode.includes("n")) {
          mLo = Math.min(currentCell.month, mHi);
        }
        if (dragMode.includes("s")) {
          mHi = Math.max(currentCell.month, mLo);
        }

        nextBrush = {
          year_lo: yLo,
          year_hi: yHi,
          month_lo: mLo,
          month_hi: mHi
        };
      }

      brushStateRef.current = nextBrush;
      updateBrushOverlay(nextBrush);
      syncModel(region, nextBrush);
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (dragMode) {
        dragMode = null;
        setBrushState({ ...brushStateRef.current });
      }
    }

    g.node().addEventListener("pointerdown", onPointerDown);

    updateBrushOverlay(brushStateRef.current);

    return () => {
      g.node().removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      svg.remove();
    };
  }, [regionData, region, syncModel, updateBrushOverlay]);

  const handleKeyDown = (e) => {
    const b = brushStateRef.current;
    if (!b) return;

    let dYear = 0;
    let dMonth = 0;

    if (e.key === "ArrowLeft") dYear = -1;
    else if (e.key === "ArrowRight") dYear = 1;
    else if (e.key === "ArrowUp") dMonth = -1;
    else if (e.key === "ArrowDown") dMonth = 1;
    else return;

    e.preventDefault();

    const spanYear = b.year_hi - b.year_lo;
    const spanMonth = b.month_hi - b.month_lo;

    let newYLo = b.year_lo + dYear;
    let newYHi = b.year_hi + dYear;
    if (newYLo < START_YEAR || newYHi > END_YEAR) {
      newYLo = b.year_lo;
      newYHi = b.year_hi;
    }

    let newMLo = b.month_lo + dMonth;
    let newMHi = b.month_hi + dMonth;
    if (newMLo < 1 || newMHi > 12) {
      newMLo = b.month_lo;
      newMHi = b.month_hi;
    }

    const nextBrush = {
      year_lo: newYLo,
      year_hi: newYHi,
      month_lo: newMLo,
      month_hi: newMHi
    };

    brushStateRef.current = nextBrush;
    updateBrushOverlay(nextBrush);
    syncModel(region, nextBrush);
    setBrushState(nextBrush);
  };

  const sqlQuery = React.useMemo(() => {
    const b = brushState;
    const avgStr = avgFrac !== null ? avgFrac.toFixed(2) : "NULL";
    if (!b) {
      return `SELECT AVG(frac) FROM ice WHERE region = '${region}'   -- ${avgStr}`;
    }
    return `SELECT AVG(frac) FROM ice WHERE region = '${region}' AND month BETWEEN ${b.month_lo} AND ${b.month_hi} AND year BETWEEN ${b.year_lo} AND ${b.year_hi}   -- ${avgStr}`;
  }, [region, brushState, avgFrac]);

  return (
    <div
      style={{
        background: "#ffffff",
        color: "#111111",
        fontFamily: "system-ui, -apple-system, Inter, Helvetica, sans-serif",
        padding: 12,
        boxSizing: "border-box",
        maxWidth: 880,
        margin: "0 auto"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 13,
              color: "#111111",
              background: "#ffffff",
              border: "1px solid #d9d9d9",
              padding: "3px 8px",
              borderRadius: 0,
              outline: "none",
              cursor: "pointer"
            }}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#777777" }}>
            <span>0</span>
            <div
              style={{
                width: 72,
                height: 8,
                background: "linear-gradient(to right, #ffffff, #c6dbef, #6baed6, #2171b5, #08306b)",
                border: "1px solid #d9d9d9"
              }}
            />
            <span>1</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#777777" }}>
            <svg width="14" height="10" style={{ border: "1px solid #d9d9d9" }}>
              <defs>
                <pattern
                  id="hatch-legend"
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="4" stroke="#777777" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="14" height="10" fill="url(#hatch-legend)" />
            </svg>
            <span>missing</span>
          </div>
        </div>
      </div>

      <div
        ref={chartWrapperRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          outline: "none",
          position: "relative",
          cursor: "default"
        }}
      >
        <div ref={containerRef} />
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid #d9d9d9"
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 12,
            lineHeight: 1.4,
            color: "#111111",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all"
          }}
        >
          {sqlQuery}
        </pre>
      </div>
    </div>
  );
}