import * as d3 from "https://esm.sh/d3@7";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MonthPicker = ({ selectedMonth, onSelectMonth }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Fira Code', 'Pitch', monospace", fontSize: "12px" }}>
      <span style={{ color: "#5c554e", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Month</span>
      <select
        value={selectedMonth}
        onChange={(e) => onSelectMonth(Number(e.target.value))}
        style={{
          fontFamily: "'Fira Code', 'Pitch', monospace",
          fontSize: "12px",
          fontWeight: 600,
          color: "#1c1917",
          backgroundColor: "#f5f0e6",
          border: "1px solid #d6cebf",
          borderRadius: "4px",
          padding: "4px 8px",
          cursor: "pointer",
          outline: "none"
        }}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};

export const ModeToggle = ({ mode, onToggle }) => {
  const isShared = mode === "shared";
  return (
    <div style={{ display: "flex", alignItems: "center", background: "#ede7da", borderRadius: "18px", padding: "2px", border: "1px solid #d8d0c2" }}>
      <button
        type="button"
        onClick={() => onToggle("shared")}
        style={{
          border: "none",
          outline: "none",
          cursor: "pointer",
          padding: "4px 12px",
          borderRadius: "14px",
          fontSize: "11px",
          fontFamily: "'Fira Code', 'Pitch', monospace",
          fontWeight: isShared ? 700 : 500,
          color: isShared ? "#1c1917" : "#78716c",
          backgroundColor: isShared ? "#ffffff" : "transparent",
          boxShadow: isShared ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.2s ease"
        }}
      >
        shared
      </button>
      <button
        type="button"
        onClick={() => onToggle("per-panel")}
        style={{
          border: "none",
          outline: "none",
          cursor: "pointer",
          padding: "4px 12px",
          borderRadius: "14px",
          fontSize: "11px",
          fontFamily: "'Fira Code', 'Pitch', monospace",
          fontWeight: !isShared ? 700 : 500,
          color: !isShared ? "#1c1917" : "#78716c",
          backgroundColor: !isShared ? "#ffffff" : "transparent",
          boxShadow: !isShared ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          transition: "all 0.2s ease"
        }}
      >
        per panel
      </button>
    </div>
  );
};

export const SqlBar = ({ month, mode, sharedThreshold, totalCount }) => {
  const threshText = mode === "shared" ? sharedThreshold.toFixed(2) : "panel_thresh";
  return (
    <div
      style={{
        backgroundColor: "#1c1917",
        color: "#f5f0e6",
        padding: "12px 18px",
        borderRadius: "6px",
        fontFamily: "'Fira Code', 'Pitch', monospace",
        fontSize: "12.5px",
        lineHeight: 1.55,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
        border: "1px solid #292524",
        overflowX: "auto"
      }}
    >
      <span style={{ color: "#f59e0b", fontWeight: 700 }}>SELECT</span>{" "}
      <span style={{ color: "#fafaf9" }}>region, year,</span>{" "}
      <span style={{ color: "#38bdf8" }}>AVG</span>
      <span style={{ color: "#fafaf9" }}>(frac)</span>{" "}
      <span style={{ color: "#f59e0b", fontWeight: 700 }}>FROM</span>{" "}
      <span style={{ color: "#a78bfa" }}>ice</span>{" "}
      <span style={{ color: "#f59e0b", fontWeight: 700 }}>WHERE</span>{" "}
      <span style={{ color: "#fafaf9" }}>month = {month}</span>{" "}
      <span style={{ color: "#f59e0b", fontWeight: 700 }}>GROUP BY</span>{" "}
      <span style={{ color: "#fafaf9" }}>region, year</span>{" "}
      <span style={{ color: "#f59e0b", fontWeight: 700 }}>HAVING</span>{" "}
      <span style={{ color: "#38bdf8" }}>AVG</span>
      <span style={{ color: "#fafaf9" }}>(frac) &lt; {threshText}</span>
      <span style={{ color: "#78716c", marginLeft: "14px", fontStyle: "italic" }}>
        -- {totalCount} {totalCount === 1 ? "row" : "rows"}
      </span>
    </div>
  );
};

export default function Widget({ model, React }) {
  const [data, setData] = React.useState(() => model.get("data") || []);
  const [selectedMonth, setSelectedMonth] = React.useState(9);
  const [mode, setMode] = React.useState("shared"); // "shared" | "per-panel"
  
  // Shared threshold and per-panel thresholds
  const [sharedThresh, setSharedThresh] = React.useState(0.15);
  const [panelThreshs, setPanelThreshs] = React.useState({});
  
  // Stats state for rendering panel titles & SQL display
  const [panelStats, setPanelStats] = React.useState({});

  const containerRef = React.useRef(null);
  const svgRef = React.useRef(null);
  
  // Ref mirrors to avoid rebuilding SVG chart on drag gestures
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  const sharedThreshRef = React.useRef(sharedThresh);
  sharedThreshRef.current = sharedThresh;
  const panelThreshsRef = React.useRef(panelThreshs);
  panelThreshsRef.current = panelThreshs;
  const selectedMonthRef = React.useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;

  // Listen for data updates from widget model
  React.useEffect(() => {
    const onDataChange = () => {
      setData(model.get("data") || []);
    };
    model.on("change:data", onDataChange);
    return () => {
      model.off("change:data", onDataChange);
    };
  }, [model]);

  // Derive regions from data
  const regions = React.useMemo(() => {
    if (!data || !data.length) return [];
    const set = new Set();
    for (let i = 0; i < data.length; i++) {
      if (data[i].region) set.add(data[i].region);
    }
    return Array.from(set).sort();
  }, [data]);

  // Initialize threshold dicts once regions are ready
  React.useEffect(() => {
    if (!regions.length) return;
    setPanelThreshs((prev) => {
      const next = { ...prev };
      let changed = false;
      regions.forEach((r) => {
        if (next[r] === undefined) {
          next[r] = 0.15;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [regions]);

  // Sync state to Python traits "under" and "thresholds"
  const syncOutputs = React.useCallback((currentUnder, currentThreshs) => {
    model.set("under", currentUnder);
    model.set("thresholds", currentThreshs);
    model.save_changes();
  }, [model]);

  // Compute live stats and update Python outputs
  const updateStatsAndOutputs = React.useCallback(() => {
    if (!regions.length || !data.length) return;
    const m = selectedMonthRef.current;
    const isShared = modeRef.current === "shared";
    const st = sharedThreshRef.current;
    const pts = panelThreshsRef.current;

    // Filter by month and year >= 1979
    const filtered = data.filter((d) => d.month === m && d.year >= 1979 && d.year <= 2026);
    const byRegion = d3.group(filtered, (d) => d.region);

    const newUnder = {};
    const newThresholds = {};
    const newStats = {};

    regions.forEach((r) => {
      const t = isShared ? st : (pts[r] !== undefined ? pts[r] : st);
      newThresholds[r] = t;
      const rows = byRegion.get(r) || [];
      const underYears = [];
      rows.forEach((d) => {
        if (d.frac < t) {
          underYears.push(d.year);
        }
      });
      newUnder[r] = underYears;
      newStats[r] = {
        underCount: underYears.length,
        totalCount: rows.length,
        threshold: t
      };
    });

    setPanelStats(newStats);
    syncOutputs(newUnder, newThresholds);
  }, [regions, data, syncOutputs]);

  // Handler when switching mode
  const handleModeChange = (newMode) => {
    if (newMode === "per-panel" && mode === "shared") {
      // initialize every panel's threshold to the shared line's current value
      const nextPts = {};
      regions.forEach((r) => {
        nextPts[r] = sharedThresh;
      });
      setPanelThreshs(nextPts);
      panelThreshsRef.current = nextPts;
    }
    setMode(newMode);
    modeRef.current = newMode;
    // Trigger visual refresh in SVG
    if (containerRef.current && svgRef.current) {
      updateVisualElementsImperatively();
    }
  };

  // Imperative update function for threshold lines, bars, labels without remounting SVG
  const updateVisualElementsImperatively = React.useCallback(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const isShared = modeRef.current === "shared";
    const st = sharedThreshRef.current;
    const pts = panelThreshsRef.current;

    regions.forEach((r) => {
      const t = isShared ? st : (pts[r] !== undefined ? pts[r] : st);
      const panelGroup = svg.select(`.panel-group-${r.replace(/\s+/g, "_")}`);
      if (panelGroup.empty()) return;

      const yScale = panelGroup.datum()?.yScale;
      if (!yScale) return;

      const yPos = yScale(t);

      // update threshold line & grab area position
      panelGroup.select(".threshold-line")
        .attr("y1", yPos)
        .attr("y2", yPos);

      panelGroup.select(".threshold-grab")
        .attr("y1", yPos)
        .attr("y2", yPos);

      // update threshold value tag
      panelGroup.select(".threshold-tag")
        .attr("y", yPos - 3)
        .text(t.toFixed(2));

      // update bars color
      panelGroup.selectAll(".bar")
        .each(function(d) {
          const isUnder = d.frac < t;
          d3.select(this)
            .attr("fill", isUnder ? "#e11d48" : "#0284c7")
            .attr("opacity", isUnder ? 0.95 : 0.7);
        });

      // update title '· n of N years under'
      const rows = (panelGroup.datum()?.rows) || [];
      const underCount = rows.filter((d) => d.frac < t).length;
      panelGroup.select(".panel-title-stat")
        .text(` · ${underCount} of ${rows.length} yrs under`);
    });

    updateStatsAndOutputs();
  }, [regions, updateStatsAndOutputs]);

  // Main chart render effect - depends only on data, regions, and selectedMonth (layout/data dependencies)
  React.useEffect(() => {
    if (!containerRef.current || !data.length || !regions.length) return;

    // Clear previous SVG
    d3.select(containerRef.current).selectAll("svg").remove();

    const m = selectedMonth;
    const filtered = data.filter((d) => d.month === m && d.year >= 1979 && d.year <= 2026);
    const byRegion = d3.group(filtered, (d) => d.region);

    // Layout configuration: 14 panels in rows of 5 (3 rows: 5, 5, 4)
    const cols = 5;
    const totalPanels = regions.length;
    const rowsCount = Math.ceil(totalPanels / cols);

    const totalWidth = 980;
    const paddingOuter = 16;
    const colGap = 16;
    const rowGap = 26;

    const panelWidth = Math.floor((totalWidth - paddingOuter * 2 - colGap * (cols - 1)) / cols); // ~174px
    const panelHeight = 110;
    const headerHeight = 22;
    const plotHeight = panelHeight - headerHeight;
    const totalHeight = paddingOuter * 2 + rowsCount * panelHeight + (rowsCount - 1) * rowGap;

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("display", "block")
      .style("user-select", "none");

    svgRef.current = svg;

    // Setup Scales
    const xScale = d3.scaleBand()
      .domain(d3.range(1979, 2027))
      .range([0, panelWidth])
      .padding(0.18);

    const yScale = d3.scaleLinear()
      .domain([0, 1.0])
      .range([plotHeight, 0]);

    // Drag behavior definition
    const dragBehavior = d3.drag()
      .on("drag", function(event, d) {
        const targetRegion = d.region;
        const panelGroup = d3.select(this.parentNode);
        const plotNode = panelGroup.select(".plot-area").node();
        
        // Use d3.pointer relative to the plot group as specified
        const [, pointerY] = d3.pointer(event, plotNode);
        const clampedY = Math.max(0, Math.min(plotHeight, pointerY));
        const newThresh = Math.max(0, Math.min(1.0, yScale.invert(clampedY)));

        if (modeRef.current === "shared") {
          sharedThreshRef.current = newThresh;
          setSharedThresh(newThresh);
        } else {
          panelThreshsRef.current = {
            ...panelThreshsRef.current,
            [targetRegion]: newThresh
          };
          setPanelThreshs(panelThreshsRef.current);
        }
        updateVisualElementsImperatively();
      });

    // Render Panels
    regions.forEach((regionName, idx) => {
      const colIdx = idx % cols;
      const rowIdx = Math.floor(idx / cols);
      const px = paddingOuter + colIdx * (panelWidth + colGap);
      const py = paddingOuter + rowIdx * (panelHeight + rowGap);

      const panelData = byRegion.get(regionName) || [];
      const currentThresh = modeRef.current === "shared"
        ? sharedThreshRef.current
        : (panelThreshsRef.current[regionName] ?? 0.15);

      const panelGroup = svg.append("g")
        .attr("class", `panel-group panel-group-${regionName.replace(/\s+/g, "_")}`)
        .attr("transform", `translate(${px}, ${py})`)
        .datum({ region: regionName, yScale, rows: panelData });

      // Panel background card
      panelGroup.append("rect")
        .attr("width", panelWidth)
        .attr("height", panelHeight)
        .attr("rx", 5)
        .attr("fill", "#faf7f0")
        .attr("stroke", "#e2dacb")
        .attr("stroke-width", 1);

      // Panel Header Title & Counter
      const textGroup = panelGroup.append("text")
        .attr("x", 8)
        .attr("y", 15)
        .attr("font-family", "'Playfair Display', Georgia, serif")
        .attr("font-size", "11.5px")
        .attr("fill", "#1c1917");

      textGroup.append("tspan")
        .attr("font-weight", 700)
        .text(regionName);

      const initialUnderCount = panelData.filter((d) => d.frac < currentThresh).length;
      textGroup.append("tspan")
        .attr("class", "panel-title-stat")
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("font-size", "9.5px")
        .attr("font-weight", 500)
        .attr("fill", "#78716c")
        .text(` · ${initialUnderCount} of ${panelData.length} yrs under`);

      // Plot Area Container
      const plotArea = panelGroup.append("g")
        .attr("class", "plot-area")
        .attr("transform", `translate(8, ${headerHeight + 2})`);

      const effectivePlotWidth = panelWidth - 16;
      const innerXScale = d3.scaleBand()
        .domain(d3.range(1979, 2027))
        .range([0, effectivePlotWidth])
        .padding(0.18);

      // Baseline reference (0.0 frac)
      plotArea.append("line")
        .attr("x1", 0)
        .attr("x2", effectivePlotWidth)
        .attr("y1", plotHeight - 12)
        .attr("y2", plotHeight - 12)
        .attr("stroke", "#ded7c8")
        .attr("stroke-width", 1);

      // Inner scale adjusting for bottom margin for year labels
      const barYScale = d3.scaleLinear()
        .domain([0, 1.0])
        .range([plotHeight - 12, 0]);

      // Attach barYScale to datum for accurate drag reading
      panelGroup.datum({ region: regionName, yScale: barYScale, rows: panelData });

      // Draw Bars
      plotArea.selectAll(".bar")
        .data(panelData, (d) => d.year)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (d) => innerXScale(d.year) || 0)
        .attr("y", (d) => barYScale(Math.min(1.0, Math.max(0, d.frac))))
        .attr("width", innerXScale.bandwidth())
        .attr("height", (d) => (plotHeight - 12) - barYScale(Math.min(1.0, Math.max(0, d.frac))))
        .attr("rx", 1)
        .attr("fill", (d) => (d.frac < currentThresh ? "#e11d48" : "#0284c7"))
        .attr("opacity", (d) => (d.frac < currentThresh ? 0.95 : 0.7));

      // Min and Max Year Labels under the axis
      plotArea.append("text")
        .attr("x", 0)
        .attr("y", plotHeight - 2)
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("font-size", "8.5px")
        .attr("fill", "#a8a29e")
        .text("79");

      plotArea.append("text")
        .attr("x", effectivePlotWidth)
        .attr("y", plotHeight - 2)
        .attr("text-anchor", "end")
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("font-size", "8.5px")
        .attr("fill", "#a8a29e")
        .text("26");

      // Threshold Line
      const initY = barYScale(currentThresh);

      plotArea.append("line")
        .attr("class", "threshold-line")
        .attr("x1", 0)
        .attr("x2", effectivePlotWidth)
        .attr("y1", initY)
        .attr("y2", initY)
        .attr("stroke", "#e11d48")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,2")
        .style("pointer-events", "none");

      // Draggable wide hit area (14px invisible grab area)
      plotArea.append("line")
        .attr("class", "threshold-grab")
        .attr("x1", 0)
        .attr("x2", effectivePlotWidth)
        .attr("y1", initY)
        .attr("y2", initY)
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .style("cursor", "ns-resize")
        .call(dragBehavior);

      // Draggable threshold tag showing value
      plotArea.append("text")
        .attr("class", "threshold-tag")
        .attr("x", effectivePlotWidth - 1)
        .attr("y", initY - 3)
        .attr("text-anchor", "end")
        .attr("font-family", "'Fira Code', 'Pitch', monospace")
        .attr("font-size", "8px")
        .attr("font-weight", 700)
        .attr("fill", "#be123c")
        .attr("opacity", 0.85)
        .style("pointer-events", "none")
        .text(currentThresh.toFixed(2));
    });

    // Run initial computation
    updateStatsAndOutputs();

    return () => {
      svg.remove();
    };
  }, [data, regions, selectedMonth]);

  // Compute total rows under threshold for SQL display
  const totalUnderCount = React.useMemo(() => {
    let count = 0;
    Object.values(panelStats).forEach((p) => {
      count += (p.underCount || 0);
    });
    return count;
  }, [panelStats]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1020px",
        margin: "0 auto",
        backgroundColor: "#fdfbf7",
        color: "#1c1917",
        padding: "24px 20px 28px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxSizing: "border-box"
      }}
    >
      {/* Editorial Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: "1.5px solid #e7dfd1",
          paddingBottom: "16px",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span
              style={{
                fontFamily: "'Fira Code', 'Pitch', monospace",
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#be123c",
                fontWeight: 700
              }}
            >
              Arctic Sea Ice Extent · 1979–2026
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "26px",
              fontWeight: 800,
              color: "#1c1917",
              letterSpacing: "-0.01em",
              lineHeight: 1.15
            }}
          >
            Thresholds of Decline
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "13px",
              color: "#57534e",
              lineHeight: 1.4
            }}
          >
            Drag the red dashed threshold line across panels to inspect when regional sea ice fraction drops.
          </p>
        </div>

        {/* Controls: Mode toggle & Month picker */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <ModeToggle mode={mode} onToggle={handleModeChange} />
          <MonthPicker selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />
        </div>
      </div>

      {/* Grid Canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          minHeight: "440px",
          marginBottom: "18px",
          position: "relative"
        }}
      />

      {/* SQL Monospace Live Bar */}
      <SqlBar
        month={selectedMonth}
        mode={mode}
        sharedThreshold={sharedThresh}
        totalCount={totalUnderCount}
      />
    </div>
  );
}