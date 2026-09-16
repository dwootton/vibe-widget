import * as d3 from "https://esm.sh/d3@7";

// Helper for median calculation
function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const MetricBadge = ({ label, value, color }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 8px",
      borderRadius: 12,
      background: color ? `${color}15` : "rgba(0,0,0,0.04)",
      border: `1px solid ${color ? `${color}40` : "rgba(0,0,0,0.08)"}`,
      fontFamily: "'SF Mono', Menlo, Consolas, Monaco, monospace",
      fontSize: 11,
      color: color || "#2b2b2b"
    }}
  >
    <span style={{ fontWeight: 600 }}>{label}</span>
    <span>{value}</span>
  </span>
);

export const ThresholdLegend = ({ thresholds, activeIdx, onRemoveSecond }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontFamily: "'SF Mono', Menlo, monospace",
      fontSize: 12,
      color: "#4a443b",
      padding: "4px 8px"
    }}
  >
    {thresholds.map((t, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: i === activeIdx ? "#fdf0e6" : "#f5f1eb",
          border: `1px solid ${i === activeIdx ? "#d9531e" : "#d8d1c5"}`,
          borderRadius: 4,
          padding: "3px 8px",
          fontWeight: i === activeIdx ? 600 : 400
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 3,
            backgroundColor: i === 0 ? "#d9531e" : "#356598",
            borderRadius: 1.5
          }}
        />
        <span>T{i + 1}: {Math.round(t)} mL/min</span>
        {i === 1 && (
          <button
            onClick={onRemoveSecond}
            title="Remove 2nd threshold"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#8c8273",
              fontSize: 13,
              lineHeight: 1,
              padding: "0 2px",
              marginLeft: 2
            }}
          >
            ×
          </button>
        )}
      </div>
    ))}
    <span style={{ color: "#8c8273", fontSize: 11, fontStyle: "italic", marginLeft: 4 }}>
      {thresholds.length === 1 ? "Shift+Click plot to add T2 · Drag or ↑/↓ arrows to adjust" : "Drag or ↑/↓ arrows to adjust selected"}
    </span>
  </div>
);

export default function Widget({ model, React }) {
  const containerRef = React.useRef(null);
  const widgetBoxRef = React.useRef(null);

  // Raw data from Python model
  const rawData = model.get("data") || [];

  // thresholds: [T1] or [T1, T2]
  const [thresholds, setThresholds] = React.useState([60]);
  const [activeThresholdIdx, setActiveThresholdIdx] = React.useState(0);

  // Metrics state to trigger react header re-renders
  const [metrics, setMetrics] = React.useState({
    "under 65": { crossed: 0, medianVisit: null, total: 0, bands: [] },
    "65+": { crossed: 0, medianVisit: null, total: 0, bands: [] }
  });

  // Keep live refs so drag handlers, keydown handlers, and d3 imperatively reference latest state
  const thresholdsRef = React.useRef(thresholds);
  thresholdsRef.current = thresholds;

  const activeIdxRef = React.useRef(activeThresholdIdx);
  activeIdxRef.current = activeThresholdIdx;

  // Store patient line nodes and threshold line nodes per group
  const chartHandlesRef = React.useRef(null);

  // Group raw data into patient trajectories
  const processedData = React.useMemo(() => {
    // patient -> { patient, age_group, points: [{visit, egfr}] }
    const patientMap = new Map();
    const rows = Array.isArray(rawData) ? rawData : [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let p = patientMap.get(row.patient);
      if (!p) {
        p = {
          patient: row.patient,
          age_group: row.age_group,
          points: []
        };
        patientMap.set(row.patient, p);
      }
      p.points.push({ visit: row.visit, egfr: row.egfr });
    }

    // Sort points by visit
    const under65 = [];
    const over65 = [];

    patientMap.forEach((p) => {
      p.points.sort((a, b) => a.visit - b.visit);
      p.firstEgfr = p.points[0]?.egfr ?? 0;
      p.lastEgfr = p.points[p.points.length - 1]?.egfr ?? 0;
      if (p.age_group === "under 65") {
        under65.push(p);
      } else {
        over65.push(p);
      }
    });

    return {
      under65,
      over65,
      allPatients: Array.from(patientMap.values())
    };
  }, [rawData]);

  // Recalculate patient crossing status and summary metrics
  const evaluateMetrics = React.useCallback(
    (currentThresholds) => {
      const t1 = currentThresholds[0];
      const hasTwo = currentThresholds.length > 1;
      const t2 = hasTwo ? currentThresholds[1] : null;
      const lowerT = hasTwo ? Math.min(t1, t2) : null;
      const upperT = hasTwo ? Math.max(t1, t2) : null;

      const crossedPatientIds = [];

      const evalGroup = (patients) => {
        let crossedCount = 0;
        const crossingVisits = [];
        let bandLow = 0;
        let bandMid = 0;
        let bandHigh = 0;

        patients.forEach((p) => {
          // Cross definition: egfr below threshold at last visit and above it at first visit
          const isCrossed = p.lastEgfr < t1 && p.firstEgfr > t1;
          p.isCrossed = isCrossed;

          if (isCrossed) {
            crossedPatientIds.push(p.patient);
            crossedCount++;

            // Find first visit where egfr dropped below t1
            let crossVisit = null;
            for (let i = 0; i < p.points.length; i++) {
              if (p.points[i].egfr < t1) {
                crossVisit = p.points[i].visit;
                break;
              }
            }
            if (crossVisit !== null) crossingVisits.push(crossVisit);
          }

          if (hasTwo) {
            // Count distribution across bands based on last visit eGFR
            if (p.lastEgfr < lowerT) bandLow++;
            else if (p.lastEgfr <= upperT) bandMid++;
            else bandHigh++;
          }
        });

        const medV = median(crossingVisits);
        return {
          total: patients.length,
          crossed: crossedCount,
          medianVisit: medV,
          bands: hasTwo ? [bandLow, bandMid, bandHigh] : []
        };
      };

      const mUnder = evalGroup(processedData.under65);
      const mOver = evalGroup(processedData.over65);

      setMetrics({
        "under 65": mUnder,
        "65+": mOver
      });

      // Synchronize outputs to Python model
      model.set("crossed", crossedPatientIds);
      model.set("thresholds", currentThresholds);
      model.save_changes();
    },
    [processedData, model]
  );

  // Imperatively re-style lines and move threshold horizontal guidelines
  const updateVisualMarks = React.useCallback(
    (currentThresholds, activeIdx) => {
      if (!chartHandlesRef.current) return;
      const {
        panels,
        thresholdG1,
        thresholdG2,
        yScale
      } = chartHandlesRef.current;

      const t1 = currentThresholds[0];

      // Update patient trajectory line colors & opacities
      panels.forEach((pInfo) => {
        pInfo.patientLines
          .attr("stroke", (d) => {
            const isCrossed = d.lastEgfr < t1 && d.firstEgfr > t1;
            return isCrossed ? "#d9531e" : "#b0aba3";
          })
          .attr("stroke-width", (d) => {
            const isCrossed = d.lastEgfr < t1 && d.firstEgfr > t1;
            return isCrossed ? 1.85 : 0.85;
          })
          .attr("stroke-opacity", (d) => {
            const isCrossed = d.lastEgfr < t1 && d.firstEgfr > t1;
            return isCrossed ? 0.95 : 0.35;
          });
      });

      // Update T1 elements
      const y1 = yScale(t1);
      thresholdG1.each(function () {
        const g = d3.select(this);
        g.select(".guideline-visible")
          .attr("y1", y1)
          .attr("y2", y1)
          .attr("stroke", activeIdx === 0 ? "#d9531e" : "#e67345")
          .attr("stroke-width", activeIdx === 0 ? 2.5 : 1.75);
        g.select(".guideline-grab")
          .attr("y1", y1)
          .attr("y2", y1);
        g.select(".guideline-badge")
          .attr("transform", `translate(6, ${y1 - 6})`);
        g.select(".guideline-text")
          .text(`T1: ${Math.round(t1)}`);
      });

      // Update T2 elements if present
      if (currentThresholds.length > 1) {
        const t2 = currentThresholds[1];
        const y2 = yScale(t2);
        thresholdG2.style("display", null);
        thresholdG2.each(function () {
          const g = d3.select(this);
          g.select(".guideline-visible")
            .attr("y1", y2)
            .attr("y2", y2)
            .attr("stroke", activeIdx === 1 ? "#1b4d7e" : "#356598")
            .attr("stroke-width", activeIdx === 1 ? 2.5 : 1.75);
          g.select(".guideline-grab")
            .attr("y1", y2)
            .attr("y2", y2);
          g.select(".guideline-badge")
            .attr("transform", `translate(6, ${y2 - 6})`);
          g.select(".guideline-text")
            .text(`T2: ${Math.round(t2)}`);
        });
      } else {
        thresholdG2.style("display", "none");
      }
    },
    []
  );

  // Initialize output model traits on mount
  React.useEffect(() => {
    evaluateMetrics(thresholdsRef.current);
  }, [evaluateMetrics]);

  // Main D3 static scaffold setup (depends ONLY on processedData)
  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const totalWidth = 820;
    const totalHeight = 380;
    const margin = { top: 32, right: 28, bottom: 42, left: 44 };
    const panelGap = 36;
    const availableWidth = totalWidth - margin.left - margin.right - panelGap;
    const panelWidth = availableWidth / 2;
    const plotHeight = totalHeight - margin.top - margin.bottom;

    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("style", "width: 100%; height: auto; display: block; overflow: visible;");

    // X Scale: visits 0 to 7
    const xScale = d3.scaleLinear().domain([0, 7]).range([0, panelWidth]);
    // Y Scale: egfr 0 to 120
    const yScale = d3.scaleLinear().domain([0, 120]).range([plotHeight, 0]);

    const lineGenerator = d3
      .line()
      .x((d) => xScale(d.visit))
      .y((d) => yScale(d.egfr))
      .curve(d3.curveMonotoneX);

    const groupsData = [
      { key: "under 65", title: "under 65", data: processedData.under65, xOffset: margin.left },
      { key: "65+", title: "65+", data: processedData.over65, xOffset: margin.left + panelWidth + panelGap }
    ];

    const panels = [];
    const plotGroupSelections = [];

    // Subtle background grid styling
    groupsData.forEach((grp) => {
      const g = svg
        .append("g")
        .attr("class", `panel-${grp.key.replace(/\s+/g, "")}`)
        .attr("transform", `translate(${grp.xOffset}, ${margin.top})`);

      plotGroupSelections.push(g);

      // Panel background
      g.append("rect")
        .attr("width", panelWidth)
        .attr("height", plotHeight)
        .attr("fill", "#faf8f5")
        .attr("rx", 3)
        .attr("stroke", "#e8e3dc")
        .attr("stroke-width", 1);

      // Horizontal subtle gridlines
      const yTicks = [20, 40, 60, 80, 100, 120];
      g.append("g")
        .attr("class", "grid")
        .selectAll("line")
        .data(yTicks)
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("y1", (d) => yScale(d))
        .attr("y2", (d) => yScale(d))
        .attr("stroke", "#eeeae3")
        .attr("stroke-width", 1);

      // Patient trajectory lines
      const patientLines = g
        .append("g")
        .attr("class", "patient-trajectories")
        .selectAll("path")
        .data(grp.data)
        .enter()
        .append("path")
        .attr("d", (d) => lineGenerator(d.points))
        .attr("fill", "none")
        .attr("stroke", "#b0aba3")
        .attr("stroke-width", 0.85)
        .attr("stroke-opacity", 0.35)
        .attr("stroke-linecap", "round");

      // X Axis
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(8)
        .tickFormat((d) => `V${d}`)
        .tickSize(4);

      g.append("g")
        .attr("transform", `translate(0, ${plotHeight})`)
        .call(xAxis)
        .call((sel) => sel.select(".domain").attr("stroke", "#d0c9be"))
        .call((sel) => sel.selectAll(".tick line").attr("stroke", "#d0c9be"))
        .call((sel) =>
          sel
            .selectAll(".tick text")
            .attr("fill", "#6f675b")
            .attr("font-family", "'SF Mono', Menlo, monospace")
            .attr("font-size", "10px")
        );

      // Y Axis
      const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(4);
      g.append("g")
        .call(yAxis)
        .call((sel) => sel.select(".domain").attr("stroke", "#d0c9be"))
        .call((sel) => sel.selectAll(".tick line").attr("stroke", "#d0c9be"))
        .call((sel) =>
          sel
            .selectAll(".tick text")
            .attr("fill", "#6f675b")
            .attr("font-family", "'SF Mono', Menlo, monospace")
            .attr("font-size", "10px")
        );

      // Axis label for left panel
      if (grp.key === "under 65") {
        g.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -30)
          .attr("x", -plotHeight / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#7b7367")
          .attr("font-size", "10.5px")
          .attr("font-family", "'SF Mono', Menlo, monospace")
          .text("eGFR (mL/min/1.73m²)");
      }

      // X Axis Label
      g.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", plotHeight + 34)
        .attr("text-anchor", "middle")
        .attr("fill", "#7b7367")
        .attr("font-size", "10px")
        .attr("font-family", "'SF Mono', Menlo, monospace")
        .text("Visit number");

      panels.push({ key: grp.key, group: g, patientLines });
    });

    // Create threshold guidelines in each panel
    const thresholdG1Selection = [];
    const thresholdG2Selection = [];

    panels.forEach((p) => {
      // Threshold 1 group
      const t1G = p.group.append("g").attr("class", "guideline-t1");
      t1G
        .append("line")
        .attr("class", "guideline-visible")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("stroke", "#d9531e")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,3");

      const t1Badge = t1G.append("g").attr("class", "guideline-badge");
      t1Badge
        .append("rect")
        .attr("width", 54)
        .attr("height", 16)
        .attr("rx", 3)
        .attr("fill", "#ffffff")
        .attr("stroke", "#d9531e")
        .attr("stroke-width", 1);
      t1Badge
        .append("text")
        .attr("class", "guideline-text")
        .attr("x", 27)
        .attr("y", 11)
        .attr("text-anchor", "middle")
        .attr("fill", "#d9531e")
        .attr("font-family", "'SF Mono', Menlo, monospace")
        .attr("font-size", "9.5px")
        .attr("font-weight", "600");

      // Invisible grab area ~14px
      t1G
        .append("line")
        .attr("class", "guideline-grab")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .attr("cursor", "ns-resize");

      thresholdG1Selection.push(t1G.node());

      // Threshold 2 group
      const t2G = p.group.append("g").attr("class", "guideline-t2").style("display", "none");
      t2G
        .append("line")
        .attr("class", "guideline-visible")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("stroke", "#356598")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "3,3");

      const t2Badge = t2G.append("g").attr("class", "guideline-badge");
      t2Badge
        .append("rect")
        .attr("width", 54)
        .attr("height", 16)
        .attr("rx", 3)
        .attr("fill", "#ffffff")
        .attr("stroke", "#356598")
        .attr("stroke-width", 1);
      t2Badge
        .append("text")
        .attr("class", "guideline-text")
        .attr("x", 27)
        .attr("y", 11)
        .attr("text-anchor", "middle")
        .attr("fill", "#356598")
        .attr("font-family", "'SF Mono', Menlo, monospace")
        .attr("font-size", "9.5px")
        .attr("font-weight", "600");

      t2G
        .append("line")
        .attr("class", "guideline-grab")
        .attr("x1", 0)
        .attr("x2", panelWidth)
        .attr("stroke", "transparent")
        .attr("stroke-width", 14)
        .attr("cursor", "ns-resize");

      thresholdG2Selection.push(t2G.node());
    });

    const d3ThresholdG1 = d3.selectAll(thresholdG1Selection);
    const d3ThresholdG2 = d3.selectAll(thresholdG2Selection);

    chartHandlesRef.current = {
      panels,
      thresholdG1: d3ThresholdG1,
      thresholdG2: d3ThresholdG2,
      yScale
    };

    // Drag behavior builder for guidelines
    const makeDrag = (thresholdIndex) => {
      return d3
        .drag()
        .on("start", function (event) {
          event.sourceEvent.stopPropagation();
          event.sourceEvent.preventDefault();
          if (widgetBoxRef.current) {
            widgetBoxRef.current.focus();
          }
          setActiveThresholdIdx(thresholdIndex);
          activeIdxRef.current = thresholdIndex;
          d3.select(document.body).style("user-select", "none");
        })
        .on("drag", function (event) {
          // Rule 15: Read pointer position as d3.pointer(event, <the plot group the scales draw into>) and invert
          // "this" is the grab line inside the panel's plot group
          const plotGroupNode = this.parentNode.parentNode;
          const [, pointerY] = d3.pointer(event, plotGroupNode);
          const rawVal = yScale.invert(pointerY);
          const clamped = Math.max(0, Math.min(120, rawVal));

          const cur = [...thresholdsRef.current];
          cur[thresholdIndex] = clamped;
          thresholdsRef.current = cur;

          updateVisualMarks(cur, thresholdIndex);
          evaluateMetrics(cur);
        })
        .on("end", function () {
          d3.select(document.body).style("user-select", "");
          setThresholds([...thresholdsRef.current]);
        });
    };

    d3ThresholdG1.selectAll(".guideline-grab").call(makeDrag(0));
    d3ThresholdG2.selectAll(".guideline-grab").call(makeDrag(1));

    // Shift+Click anywhere in a panel adds a second shared threshold
    plotGroupSelections.forEach((g) => {
      g.on("click", function (event) {
        if (!event.shiftKey) return;
        event.preventDefault();
        if (widgetBoxRef.current) {
          widgetBoxRef.current.focus();
        }

        const [, pointerY] = d3.pointer(event, this);
        const rawVal = yScale.invert(pointerY);
        const clamped = Math.max(0, Math.min(120, rawVal));

        const cur = [...thresholdsRef.current];
        if (cur.length < 2) {
          cur.push(clamped);
        } else {
          // If already 2, adjust T2
          cur[1] = clamped;
        }

        thresholdsRef.current = cur;
        activeIdxRef.current = 1;
        setActiveThresholdIdx(1);
        setThresholds(cur);
        updateVisualMarks(cur, 1);
        evaluateMetrics(cur);
      });
    });

    // Render initial state
    updateVisualMarks(thresholdsRef.current, activeIdxRef.current);

    return () => {
      d3.select(document.body).style("user-select", "");
      svg.remove();
    };
  }, [processedData, updateVisualMarks, evaluateMetrics]);

  // Handle arrow key nudging on focused widget container
  const handleKeyDown = (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? 1 : -1;
      const cur = [...thresholdsRef.current];
      const targetIdx = activeIdxRef.current >= cur.length ? 0 : activeIdxRef.current;
      const nextVal = Math.max(0, Math.min(120, cur[targetIdx] + delta));

      cur[targetIdx] = nextVal;
      thresholdsRef.current = cur;
      setThresholds(cur);

      updateVisualMarks(cur, targetIdx);
      evaluateMetrics(cur);
    }
  };

  const handleRemoveSecond = () => {
    if (thresholdsRef.current.length > 1) {
      const cur = [thresholdsRef.current[0]];
      thresholdsRef.current = cur;
      activeIdxRef.current = 0;
      setActiveThresholdIdx(0);
      setThresholds(cur);
      updateVisualMarks(cur, 0);
      evaluateMetrics(cur);
    }
  };

  // Header summary formatter
  const renderPanelHeader = (groupKey) => {
    const info = metrics[groupKey];
    if (!info) return null;

    if (thresholds.length === 1) {
      const medText = info.medianVisit !== null ? `visit ${info.medianVisit}` : "none";
      return (
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "14px",
            color: "#1c1917"
          }}
        >
          <span style={{ fontWeight: 700, fontSize: "14.5px", marginRight: 6 }}>{groupKey}</span>
          <span style={{ color: "#78716c", fontFamily: "'SF Mono', Menlo, monospace", fontSize: "12px" }}>
            · <strong style={{ color: "#d9531e" }}>{info.crossed}</strong> crossed · median crossing {medText}
          </span>
        </div>
      );
    }

    // Two thresholds mode: counts per band
    const tLow = Math.min(...thresholds);
    const tHigh = Math.max(...thresholds);
    const [bLow, bMid, bHigh] = info.bands || [0, 0, 0];

    return (
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "13.5px",
          color: "#1c1917"
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "14px", marginRight: 4 }}>{groupKey}</span>
        <span style={{ color: "#78716c", fontFamily: "'SF Mono', Menlo, monospace", fontSize: "11px" }}>
          · &lt;{Math.round(tLow)}: <strong style={{ color: "#292524" }}>{bLow}</strong> · {Math.round(tLow)}-{Math.round(tHigh)}: <strong style={{ color: "#292524" }}>{bMid}</strong> · &gt;{Math.round(tHigh)}: <strong style={{ color: "#292524" }}>{bHigh}</strong>
        </span>
      </div>
    );
  };

  return (
    <section
      ref={widgetBoxRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: "none",
        backgroundColor: "#fdfbf7",
        color: "#211f1d",
        padding: "20px 24px",
        borderRadius: 8,
        border: "1px solid #eee8df",
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.04)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}
    >
      {/* Narrative header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 22,
              letterSpacing: "-0.01em",
              color: "#1a1816"
            }}
          >
            Longitudinal eGFR Trajectories
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <MetricBadge label="TOTAL PATIENTS" value={processedData.allPatients.length} />
            <MetricBadge
              label="TOTAL CROSSED"
              value={metrics["under 65"].crossed + metrics["65+"].crossed}
              color="#d9531e"
            />
          </div>
        </div>
        <p style={{ margin: "4px 0 0 0", color: "#6e6659", fontSize: 13, maxWidth: 660, lineHeight: 1.4 }}>
          Tracking renal progression across patient cohorts. Orange lines mark patients whose initial filtration
          was above threshold but deteriorated past it by the final visit.
        </p>
      </div>

      {/* Threshold indicator and control ribbon */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          background: "rgba(240, 236, 228, 0.45)",
          padding: "4px 10px",
          borderRadius: 6
        }}
      >
        <ThresholdLegend
          thresholds={thresholds}
          activeIdx={activeThresholdIdx}
          onRemoveSecond={handleRemoveSecond}
        />
      </div>

      {/* Synchronized Panel Headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 36,
          paddingLeft: 44,
          paddingRight: 28,
          marginBottom: 6
        }}
      >
        <div>{renderPanelHeader("under 65")}</div>
        <div>{renderPanelHeader("65+")}</div>
      </div>

      {/* D3 visualization canvas */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          cursor: "default"
        }}
      />
    </section>
  );
}